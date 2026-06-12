/** Room ORCHESTRATION for Battle Learn Arena.
 *
 *  Wraps a realtime Transport into a lobby: presence → live player list, host
 *  broadcasts settings + the start signal, players toggle ready/team. This is
 *  the same presence+broadcast shape proven in `lib/party/useParty.ts`, lifted
 *  into a small observable service the React hook subscribes to.
 *
 *  Two host models:
 *   • custom rooms — the creator is the fixed host.
 *   • quick match  — host is ELECTED (lowest present id) so a shared public room
 *     always has exactly one host even as people come and go. */

import { getMode } from '@/data/arenaModes';
import { createTransport, type PresenceMeta, type Transport } from './realtime';
import { MatchService } from './matchService';
import {
  arenaRoomCreate,
  arenaRoomEnd,
  arenaRoomStart,
  arenaRoomState,
  type PersistentRoomState,
} from './roomPersistence';
import {
  DEFAULT_SETTINGS,
  makeMatchId,
  makeSeed,
  type ConnectionState,
  type MatchScores,
  type NetEvent,
  type NetEventType,
  type RoomPhase,
  type RoomPlayer,
  type RoomSettings,
} from './types';
import type { TeamId, RosterEntry } from '@/lib/arena/types';

const COUNTDOWN_MS = 3200;

const VALID_DIFFICULTIES: RoomSettings['difficulty'][] = ['easy', 'medium', 'hard', 'expert'];
const VALID_MODES: string[] = ['deathmatch', 'capture-the-flag', 'king-of-the-hill', 'knowledge-war'];

/** Sanitize host-broadcast settings: clamp numerics, validate enums, fill any
 *  missing or malformed field from DEFAULT_SETTINGS. This prevents a corrupt or
 *  malicious settings payload from putting the room into an invalid state
 *  (e.g. durationSec=0, targetScore negative, unknown modeId). */
function sanitizeSettings(raw: Partial<RoomSettings>): RoomSettings {
  const d = DEFAULT_SETTINGS;
  return {
    mapId: typeof raw.mapId === 'string' && raw.mapId.trim() ? raw.mapId.slice(0, 40) : d.mapId,
    modeId: VALID_MODES.includes(raw.modeId as string) ? (raw.modeId as RoomSettings['modeId']) : d.modeId,
    perTeam: typeof raw.perTeam === 'number' && Number.isFinite(raw.perTeam)
      ? Math.max(1, Math.min(6, Math.round(raw.perTeam))) : d.perTeam,
    botFill: typeof raw.botFill === 'boolean' ? raw.botFill : d.botFill,
    targetScore: typeof raw.targetScore === 'number' && Number.isFinite(raw.targetScore)
      ? Math.max(1, Math.min(200, Math.round(raw.targetScore))) : d.targetScore,
    durationSec: typeof raw.durationSec === 'number' && Number.isFinite(raw.durationSec)
      ? Math.max(30, Math.min(600, Math.round(raw.durationSec))) : d.durationSec,
    difficulty: VALID_DIFFICULTIES.includes(raw.difficulty as RoomSettings['difficulty'])
      ? (raw.difficulty as RoomSettings['difficulty']) : d.difficulty,
    // grade is optional (undefined = all classes); keep a valid 1–11 or drop it.
    grade: typeof raw.grade === 'number' && raw.grade >= 1 && raw.grade <= 11
      ? (Math.round(raw.grade) as RoomSettings['grade']) : d.grade,
    v: typeof raw.v === 'number' ? raw.v : d.v,
  };
}
const FROM_KEY = '__from';
const PLAYER_META_EVENT = 'player_meta';
const OPTIMISTIC_META_MS = 3000;
/** How long a code-joining client waits to see the host before declaring the
 *  room non-existent (invalid code). Generous enough for cross-device presence. */
const ROOM_FIND_MS = 6000;
/** Grace period after a roster player drops from presence mid-match before we
 *  treat them as gone. A refresh/tab-reload re-appears well within this, so the
 *  player resumes and their character is never removed; only a real disconnect
 *  (no return) eventually triggers the "left" removal + notice. */
const RECONNECT_GRACE_MS = 12000;

export interface RoomState {
  phase: RoomPhase;
  connection: ConnectionState;
  kind: 'cloud' | 'local';
  myId: string;
  isHost: boolean;
  players: RoomPlayer[];
  settings: RoomSettings;
  /** epoch ms the match starts at, during 'countdown' */
  startAt: number | null;
  /** shared identity of the CURRENT match (null until the host starts one). */
  matchId: string | null;
  /** shared PRNG seed → every client builds the identical arena. */
  seed: number | null;
  /** host-authoritative live score (mirrored to everyone during play). */
  liveScores: MatchScores | null;
  /** host-authoritative final score (set once when the match ends). */
  matchEnd: MatchScores | null;
  /** last realtime event seen (name + epoch ms) — for the debug panel. */
  lastEvent: { name: string; at: number } | null;
  /** M2: the humans in this match + their teams (built by the host at start). */
  roster: RosterEntry[];
  /** why we're in the 'error' phase: 'cloud' = no connection; 'notfound' = the
   *  joined code has no host (invalid / non-existent room). */
  errorReason: 'cloud' | 'notfound' | 'hostleft' | null;
}

export interface RoomOptions {
  name: string;
  avatar: string;
  isHost: boolean;
  /** stable per-tab player id so refresh can rejoin as the same host/player */
  clientId?: string;
  /** quick match → host is elected rather than fixed */
  quick?: boolean;
  settings?: RoomSettings;
  hostRole?: 'player' | 'observer';
}

export class RoomService {
  private transport: Transport;
  private me: PresenceMeta;
  private settings: RoomSettings;
  private readonly quick: boolean;
  private readonly forcedHost: boolean;
  private presence: Record<string, PresenceMeta> = {};
  private optimisticPresence: Record<string, { meta: PresenceMeta; until: number }> = {};
  private phase: RoomPhase = 'connecting';
  private connection: ConnectionState = 'offline';
  private startAt: number | null = null;
  private matchId: string | null = null;
  private seed: number | null = null;
  private liveScores: MatchScores | null = null;
  private matchEnd: MatchScores | null = null;
  private lastEvent: { name: string; at: number } | null = null;
  private roster: RosterEntry[] = [];
  /** roster ids already removed mid-match (via presence-drop OR their own
   *  'leave'), so we inject/announce each departure exactly once. */
  private leftNetIds = new Set<string>();
  /** roster ids currently absent from presence mid-match, on a grace timer.
   *  Cleared if they reconnect (refresh); fires removal only if they don't. */
  private leaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private match: MatchService;
  private listeners = new Set<(s: RoomState) => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private persistenceTimer: ReturnType<typeof setInterval> | null = null;
  private persistenceBusy = false;
  private persistenceRevision = -1;
  private hostToken: string | null = null;
  // join validation: a code-joiner must see a host or the room is "not found"
  private validated = false;
  private validateTimer: ReturnType<typeof setTimeout> | null = null;
  private errorReason: 'cloud' | 'notfound' | 'hostleft' | null = null;
  private trustedHostId: string | null = null;
  private metaSeq = 0;
  private seenMetaSeq = new Map<string, number>();

  constructor(public readonly code: string, opts: RoomOptions) {
    this.quick = opts.quick ?? false;
    this.forcedHost = opts.isHost;
    this.settings = opts.settings ?? { ...DEFAULT_SETTINGS };
    this.transport = createTransport(code, opts.clientId);
    this.trustedHostId = opts.isHost ? this.transport.id : null;
    this.match = new MatchService(this.transport, this.transport.id);
    const role = opts.isHost ? opts.hostRole ?? 'observer' : 'player';
    this.me = {
      name: opts.name || 'Player',
      avatar: opts.avatar,
      team: 'red',
      ready: opts.isHost ? role === 'observer' : false,
      isHost: opts.isHost,
      role,
    };
  }

  /** Am I currently the host? Fixed for custom rooms, elected for quick match. */
  private isHost(): boolean {
    if (!this.quick) return this.forcedHost;
    const ids = Object.keys(this.presence);
    if (!ids.length) return true; // alone → I host
    return this.transport.id === ids.slice().sort()[0];
  }

  subscribe(cb: (s: RoomState) => void): () => void {
    this.listeners.add(cb);
    cb(this.snapshot());
    return () => this.listeners.delete(cb);
  }

  private emit() { const s = this.snapshot(); this.listeners.forEach((cb) => cb(s)); }

  private toPlayers(): RoomPlayer[] {
    // Optimistic local echo: my OWN row always reflects my latest intent
    // (ready/team) immediately, instead of waiting for the presence round-trip
    // to come back (which over Supabase makes taps look like they did nothing).
    const myId = this.transport.id;
    const merged: Record<string, PresenceMeta> = {
      ...this.presence,
      [myId]: { ...(this.presence[myId] ?? this.me), ...this.me },
    };
    const list: RoomPlayer[] = Object.entries(merged).map(([id, m]) => ({ id, ...m }));
    list.sort((a, b) => (a.isHost === b.isHost ? a.name.localeCompare(b.name) : a.isHost ? -1 : 1));
    return list;
  }

  snapshot(): RoomState {
    return {
      phase: this.phase,
      connection: this.connection,
      kind: this.transport.kind,
      myId: this.transport.id,
      isHost: this.isHost(),
      players: this.toPlayers(),
      settings: this.settings,
      startAt: this.startAt,
      matchId: this.matchId,
      seed: this.seed,
      liveScores: this.liveScores,
      matchEnd: this.matchEnd,
      lastEvent: this.lastEvent,
      roster: this.roster,
      errorReason: this.errorReason,
    };
  }

  /** A code-joiner (not host, not quick) must prove the room exists by seeing a
   *  host in presence within ROOM_FIND_MS — otherwise it's an invalid code. */
  private startJoinValidation() {
    if (this.forcedHost || this.quick || this.validated || this.validateTimer) return;
    this.validateTimer = setTimeout(() => {
      if (!this.validated) {
        this.errorReason = 'notfound';
        this.phase = 'error';
        this.emit();
      }
    }, ROOM_FIND_MS);
  }

  private note(name: string) { this.lastEvent = { name, at: Date.now() }; }

  /** Reconcile presence against the match roster. A roster player missing from
   *  presence starts a grace timer (covers refresh/reconnect); if they come
   *  back the timer is cancelled. Only when the grace elapses without a return
   *  do we remove their character + show the "left" notice — so a refresh never
   *  drops a player, but a real disconnect eventually does. */
  private reviewMatchPresence(present: Record<string, PresenceMeta>) {
    const inMatch = this.phase === 'countdown' || this.phase === 'playing';
    if (!inMatch) { this.clearLeaveTimers(); return; }
    for (const entry of this.roster) {
      const id = entry.netId;
      if (id === this.transport.id || this.leftNetIds.has(id)) continue;
      if (present[id]) {
        // reconnected (or never really gone) — cancel any pending removal
        const pending = this.leaveTimers.get(id);
        if (pending) { clearTimeout(pending); this.leaveTimers.delete(id); }
        continue;
      }
      if (this.leaveTimers.has(id)) continue; // already counting down
      this.leaveTimers.set(id, setTimeout(() => {
        this.leaveTimers.delete(id);
        // still in a match, still absent, still not already removed?
        if (this.phase !== 'countdown' && this.phase !== 'playing') return;
        if (this.presence[id] || this.leftNetIds.has(id)) return;
        this.leftNetIds.add(id);
        this.match.injectLeave(id, entry.name);
      }, RECONNECT_GRACE_MS));
    }
  }

  private clearLeaveTimers() {
    for (const timer of this.leaveTimers.values()) clearTimeout(timer);
    this.leaveTimers.clear();
  }

  private startCountdown(startAt: number) {
    if (this.timer) clearTimeout(this.timer);
    const delay = Math.max(0, startAt - Date.now());
    if (delay <= 80) {
      this.phase = 'playing';
      this.emit();
      return;
    }
    this.phase = 'countdown';
    this.emit();
    this.timer = setTimeout(() => {
      this.phase = 'playing';
      this.emit();
    }, delay);
  }

  private adoptStart(payload: {
    matchId: string;
    seed: number;
    roster: RosterEntry[];
    /** Relative path (live broadcast): count down from NOW. Preferred — it is
     *  immune to cross-device wall-clock skew, which made clients enter the
     *  match at wildly different times when we synced on an absolute deadline. */
    countdownMs?: number;
    /** Absolute path (persistence recovery for clients that missed the
     *  broadcast): a server-derived epoch ms. Only used when countdownMs absent. */
    startAt?: number;
  }) {
    this.matchId = payload.matchId || makeMatchId();
    this.seed = Number(payload.seed) || 0;
    this.roster = Array.isArray(payload.roster) ? payload.roster : [];
    this.leftNetIds.clear();
    this.clearLeaveTimers();
    this.startAt =
      typeof payload.countdownMs === 'number'
        ? Date.now() + payload.countdownMs
        : payload.startAt ?? Date.now() + COUNTDOWN_MS;
    this.liveScores = { red: 0, blue: 0 };
    this.matchEnd = null;
    this.startCountdown(this.startAt);
  }

  private adoptPersistentState(state: PersistentRoomState) {
    if (state.revision <= this.persistenceRevision) return;
    this.persistenceRevision = state.revision;
    if (state.host_client_id) this.trustedHostId = state.host_client_id;
    if (state.settings) this.settings = { ...this.settings, ...state.settings };

    if (!this.forcedHost && !this.quick && !this.validated) {
      this.validated = true;
      if (this.validateTimer) { clearTimeout(this.validateTimer); this.validateTimer = null; }
      if (this.phase === 'connecting') this.phase = 'lobby';
    }

    if (state.status === 'playing' && state.match_id && typeof state.seed === 'number') {
      // Realtime already started this exact match. The persistence RPC/poll can
      // arrive later with a server-derived started_at; adopting it again would
      // restart the countdown and make the host or some clients enter late.
      if (
        state.match_id === this.matchId &&
        this.seed === state.seed &&
        (this.phase === 'countdown' || this.phase === 'playing')
      ) {
        this.emit();
        return;
      }
      const parsedStart = state.started_at ? Date.parse(state.started_at) : NaN;
      this.adoptStart({
        matchId: state.match_id,
        seed: state.seed,
        roster: state.roster,
        startAt: Number.isFinite(parsedStart) ? parsedStart : Date.now() + COUNTDOWN_MS,
      });
      return;
    }

    if (state.status === 'ended') {
      if (!this.forcedHost) {
        this.errorReason = 'hostleft';
        this.phase = 'error';
      } else {
        this.phase = 'ended';
      }
    }
    this.emit();
  }

  private async ensurePersistentRoom(): Promise<string | null> {
    if (!this.forcedHost || this.quick) return this.hostToken;
    if (this.hostToken) return this.hostToken;
    const res = await arenaRoomCreate(this.code, this.transport.id, this.settings);
    if (res.ok) {
      this.hostToken = res.token ?? null;
      if (res.state) this.adoptPersistentState(res.state);
    }
    return this.hostToken;
  }

  private async pullPersistentState() {
    if (this.persistenceBusy) return;
    this.persistenceBusy = true;
    const res = await arenaRoomState(this.code);
    this.persistenceBusy = false;
    if (!res.ok || !res.state) return;
    this.adoptPersistentState(res.state);
  }

  private startPersistencePolling() {
    if (this.persistenceTimer) return;
    void this.pullPersistentState();
    this.persistenceTimer = setInterval(() => {
      if (this.phase === 'playing' || this.phase === 'ended' || this.phase === 'error') return;
      void this.pullPersistentState();
    }, 1400);
  }

  private hostId(): string | null {
    if (!this.quick && this.trustedHostId) return this.trustedHostId;
    const hosts = Object.entries(this.presence)
      .filter(([, p]) => p.isHost)
      .map(([id]) => id)
      .sort();
    if (hosts.length) return hosts[0];
    return this.quick ? Object.keys(this.presence).sort()[0] ?? this.transport.id : null;
  }

  private fromHost(payload: Record<string, unknown>): boolean {
    const from = payload[FROM_KEY];
    return typeof from === 'string' && from === this.hostId();
  }

  private sanitizeMeta(id: string, payload: Record<string, unknown>, existing?: PresenceMeta): PresenceMeta {
    const team: TeamId = payload.team === 'blue' ? 'blue' : 'red';
    const fixedHost = !this.quick && (id === this.trustedHostId || (this.forcedHost && id === this.transport.id));
    return {
      name: typeof payload.name === 'string' && payload.name.trim() ? payload.name.slice(0, 20) : existing?.name ?? 'Player',
      avatar: typeof payload.avatar === 'string' && payload.avatar ? payload.avatar : existing?.avatar ?? '🐱',
      team,
      ready: payload.ready === true,
      isHost: this.quick ? payload.isHost === true : fixedHost,
      role: payload.role === 'observer' ? 'observer' : 'player',
    };
  }

  private mergeOptimistic(map: Record<string, PresenceMeta>): Record<string, PresenceMeta> {
    const now = Date.now();
    const merged = { ...map };
    for (const [id, entry] of Object.entries(this.optimisticPresence)) {
      if (entry.until <= now) {
        delete this.optimisticPresence[id];
        continue;
      }
      merged[id] = entry.meta;
    }
    return merged;
  }

  private publishMe() {
    this.metaSeq += 1;
    this.transport.track(this.me);
    this.transport.broadcast(PLAYER_META_EVENT, { ...(this.me as unknown as Record<string, unknown>), metaSeq: this.metaSeq });
    this.emit();
  }

  async connect() {
    const t = this.transport;
    t.onState((s) => {
      this.connection = s;
      if (s === 'connected') {
        // host goes straight to the lobby; a code-joiner stays 'connecting'
        // (shown as "looking for room…") until a host is confirmed present.
        if (this.phase === 'connecting' && (this.forcedHost || this.quick)) this.phase = 'lobby';
        if (this.forcedHost && !this.quick) void this.ensurePersistentRoom();
        if (!this.quick) this.startPersistencePolling();
        this.startJoinValidation();
      }
      if (s === 'error') { this.errorReason = 'cloud'; this.phase = 'error'; }
      this.emit();
    });
    t.onPresence((map) => {
      const mergedMap = this.mergeOptimistic(map);
      const grew = Object.keys(mergedMap).length > Object.keys(this.presence).length;
      this.note('presence');
      this.presence = mergedMap;
      this.reviewMatchPresence(mergedMap);
      // a code-joiner is "in" only once a host actually shows up in the room
      const seenHost = Object.entries(mergedMap).find(([, p]) => p.isHost);
      if (!this.forcedHost && !this.quick && !this.validated && seenHost) {
        this.trustedHostId = seenHost[0];
        this.validated = true;
        if (this.phase === 'connecting') this.phase = 'lobby'; // now show the real lobby
        if (this.validateTimer) { clearTimeout(this.validateTimer); this.validateTimer = null; }
      }
      // keep my own host crown accurate (matters for elected quick-match hosts)
      const host = this.isHost();
      if (this.me.isHost !== host) {
        this.me = { ...this.me, isHost: host };
        t.track(this.me);
        if (host) t.broadcast('settings', this.settings as unknown as Record<string, unknown>);
      } else if (host && grew) {
        // a newcomer arrived — sync them to the current settings
        t.broadcast('settings', this.settings as unknown as Record<string, unknown>);
      }
      this.emit();
    });
    t.on('settings', (payload) => {
      this.note('settings');
      if (this.isHost()) return; // host is the source of truth
      if (!this.fromHost(payload)) return;
      this.settings = sanitizeSettings(payload as unknown as Partial<RoomSettings>);
      this.emit();
    });
    t.on(PLAYER_META_EVENT, (payload) => {
      this.note(PLAYER_META_EVENT);
      const from = payload[FROM_KEY];
      if (typeof from !== 'string') return;
      const seq = Number(payload.metaSeq);
      if (Number.isFinite(seq)) {
        const last = this.seenMetaSeq.get(from) ?? 0;
        if (seq <= last) return;
        this.seenMetaSeq.set(from, seq);
      }
      const meta = this.sanitizeMeta(from, payload, this.presence[from]);
      this.optimisticPresence[from] = { meta, until: Date.now() + OPTIMISTIC_META_MS };
      this.presence = { ...this.presence, [from]: meta };
      this.emit();
    });
    t.on('start', (payload) => {
      this.note('start');
      if (!this.fromHost(payload)) return;
      // Ignore echoes/retries of a match we already adopted: Supabase delivers
      // the host its OWN start (broadcast:self), and we may re-send for
      // reliability. Re-adopting would reset the relative countdown and make us
      // enter late. matchId is unique per start, so it's a safe identity.
      const incomingMatch = typeof payload.matchId === 'string' ? payload.matchId : '';
      if (incomingMatch && incomingMatch === this.matchId && (this.phase === 'countdown' || this.phase === 'playing')) return;
      const broadcastCountdown = Number(payload.countdownMs);
      const broadcastStartAt = Number(payload.startAt);
      const hasCountdown = Number.isFinite(broadcastCountdown);
      this.adoptStart({
        matchId: (payload.matchId as string) ?? makeMatchId(),
        seed: Number(payload.seed) || 0,
        roster: Array.isArray(payload.roster) ? (payload.roster as RosterEntry[]) : [],
        // Count down from the moment WE received this, not from the host's
        // wall clock — so device clock skew can't make us enter early/late.
        // An older host may instead send an absolute startAt; honor it as a
        // fallback. If neither is present, adoptStart defaults to COUNTDOWN_MS.
        countdownMs: hasCountdown ? broadcastCountdown : undefined,
        startAt: !hasCountdown && Number.isFinite(broadcastStartAt) ? broadcastStartAt : undefined,
      });
    });
    // host-authoritative score mirror (host also receives its own via broadcast:self)
    t.on('score', (payload) => {
      this.note('score');
      if (!this.fromHost(payload)) return;
      this.liveScores = { red: Number(payload.red) || 0, blue: Number(payload.blue) || 0 };
      this.emit();
    });
    t.on('match_end', (payload) => {
      this.note('match_end');
      if (!this.fromHost(payload)) return;
      this.matchEnd = { red: Number(payload.red) || 0, blue: Number(payload.blue) || 0 };
      this.liveScores = this.matchEnd;
      // keep phase 'playing' so RoomLobby keeps ArenaGame mounted to show results;
      // ArenaGame owns the results screen and the exit back to the menu.
      this.emit();
    });
    t.on('host_left', (payload) => {
      this.note('host_left');
      if (!this.fromHost(payload)) return;
      this.errorReason = 'hostleft';
      this.phase = 'error';
      this.emit();
    });
    // M2: in-match event relay (move/shoot/down/respawn). Register the 'net'
    // handler BEFORE connect so the transport attaches it to the channel.
    this.match.start();
    await t.connect(this.me);
  }

  // emit() so my own row updates instantly (optimistic); track() syncs to others.
  setReady(ready: boolean) { this.me = { ...this.me, ready }; this.publishMe(); }
  setTeam(team: TeamId) { this.me = { ...this.me, team }; this.publishMe(); }

  /** Host-only: change room settings (mode change also resets the target score). */
  updateSettings(patch: Partial<RoomSettings>) {
    if (!this.isHost()) return;
    const next = { ...this.settings, ...patch };
    if (patch.modeId) next.targetScore = getMode(patch.modeId).targetScore;
    this.settings = next;
    this.transport.broadcast('settings', next as unknown as Record<string, unknown>);
    this.emit();
  }

  /** Host-only: mint ONE match identity (id + seed) and tell everyone to start it.
   *  This is the fix for "one room = many local matches": the seed makes every
   *  client build the IDENTICAL arena, and the id lets us prove they share it. */
  start() {
    if (!this.isHost()) return;
    // guard: never start until every joined player has readied up
    const players = this.toPlayers();
    const contenders = players.filter((p) => !(p.isHost && p.role === 'observer'));
    if (contenders.length < 2 || contenders.some((p) => !p.ready)) return;
    // Send a relative countdown, not an absolute deadline: every client (incl.
    // the host) counts down from when it receives this, so mismatched device
    // clocks can't stagger entry. Residual skew is just one-way send latency.
    const payload = { matchId: makeMatchId(), seed: makeSeed(), roster: this.buildRoster(contenders), countdownMs: COUNTDOWN_MS };
    void this.persistStart(payload);
    this.transport.broadcast('start', payload);
    this.adoptStart(payload);
  }

  private async persistStart(payload: { matchId: string; seed: number; roster: RosterEntry[] }) {
    const token = await this.ensurePersistentRoom();
    if (!token) return;
    const res = await arenaRoomStart(this.code, token, {
      ...payload,
      settings: this.settings,
      countdownMs: COUNTDOWN_MS,
    });
    if (res.ok && res.state) this.adoptPersistentState(res.state);
  }

  /** Host builds the match roster from the SAME lobby snapshot used by start().
   *  This avoids a race where optimistic player metadata is visible/ready in the
   *  host UI, but raw presence lags and would omit that non-host from roster. */
  private buildRoster(players: RoomPlayer[]): RosterEntry[] {
    const map: Record<string, RosterEntry> = {};
    for (const p of players) {
      if (p.isHost && p.role === 'observer') continue;
      map[p.id] = { netId: p.id, name: p.name, avatar: p.avatar, team: p.team };
    }
    const entries = Object.values(map);
    // Safety: if everyone ended up on one team there'd be no opponent — auto-split
    // (deterministically by netId) so a 1v1 always has someone to play against.
    const hasRed = entries.some((e) => e.team === 'red');
    const hasBlue = entries.some((e) => e.team === 'blue');
    if (entries.length >= 2 && (!hasRed || !hasBlue)) {
      [...entries].sort((a, b) => (a.netId < b.netId ? -1 : 1))
        .forEach((e, i) => { e.team = i % 2 === 0 ? 'red' : 'blue'; });
    }
    return entries;
  }

  /** M2: send one in-match event (move coalesced, shoot/down/respawn immediate). */
  sendNet(t: NetEventType, data: NetEvent['data']) { this.match.send(t, data); }

  /** M2: drain remote in-match events for the engine to apply this frame. */
  drainNet(): NetEvent[] { return this.match.receive(); }

  /** Host-only: push the authoritative live score to every client. No-op for
   *  non-hosts so a client can never fork the canonical score. */
  reportScores(red: number, blue: number) {
    if (!this.isHost()) return;
    this.liveScores = { red, blue };
    this.transport.broadcast('score', { red, blue });
  }

  /** Host-only: declare the match over with the final authoritative score. */
  reportEnd(red: number, blue: number) {
    if (!this.isHost()) return;
    this.matchEnd = { red, blue };
    this.transport.broadcast('match_end', { red, blue });
    if (this.hostToken) void arenaRoomEnd(this.code, this.hostToken);
  }

  closeRoom() {
    if (this.isHost()) {
      this.transport.broadcast('host_left', { reason: 'closed' });
      if (this.hostToken) void arenaRoomEnd(this.code, this.hostToken);
    }
    this.leave();
  }

  leave() {
    if (this.timer) clearTimeout(this.timer);
    if (this.validateTimer) clearTimeout(this.validateTimer);
    if (this.persistenceTimer) clearInterval(this.persistenceTimer);
    this.clearLeaveTimers();
    this.match.stop();
    this.transport.disconnect();
    this.listeners.clear();
  }
}
