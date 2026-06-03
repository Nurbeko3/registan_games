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
/** How long a code-joining client waits to see the host before declaring the
 *  room non-existent (invalid code). Generous enough for cross-device presence. */
const ROOM_FIND_MS = 6000;

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
  errorReason: 'cloud' | 'notfound' | null;
}

export interface RoomOptions {
  name: string;
  avatar: string;
  isHost: boolean;
  /** quick match → host is elected rather than fixed */
  quick?: boolean;
  settings?: RoomSettings;
}

export class RoomService {
  private transport: Transport;
  private me: PresenceMeta;
  private settings: RoomSettings;
  private readonly quick: boolean;
  private readonly forcedHost: boolean;
  private presence: Record<string, PresenceMeta> = {};
  private phase: RoomPhase = 'connecting';
  private connection: ConnectionState = 'offline';
  private startAt: number | null = null;
  private matchId: string | null = null;
  private seed: number | null = null;
  private liveScores: MatchScores | null = null;
  private matchEnd: MatchScores | null = null;
  private lastEvent: { name: string; at: number } | null = null;
  private roster: RosterEntry[] = [];
  private match: MatchService;
  private listeners = new Set<(s: RoomState) => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  // join validation: a code-joiner must see a host or the room is "not found"
  private validated = false;
  private validateTimer: ReturnType<typeof setTimeout> | null = null;
  private errorReason: 'cloud' | 'notfound' | null = null;

  constructor(public readonly code: string, opts: RoomOptions) {
    this.quick = opts.quick ?? false;
    this.forcedHost = opts.isHost;
    this.settings = opts.settings ?? { ...DEFAULT_SETTINGS };
    this.transport = createTransport(code);
    this.match = new MatchService(this.transport, this.transport.id);
    this.me = {
      name: opts.name || 'Player',
      avatar: opts.avatar,
      team: 'red',
      ready: opts.isHost,
      isHost: opts.isHost,
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

  async connect() {
    const t = this.transport;
    t.onState((s) => {
      this.connection = s;
      if (s === 'connected') {
        // host goes straight to the lobby; a code-joiner stays 'connecting'
        // (shown as "looking for room…") until a host is confirmed present.
        if (this.phase === 'connecting' && (this.forcedHost || this.quick)) this.phase = 'lobby';
        this.startJoinValidation();
      }
      if (s === 'error') { this.errorReason = 'cloud'; this.phase = 'error'; }
      this.emit();
    });
    t.onPresence((map) => {
      const grew = Object.keys(map).length > Object.keys(this.presence).length;
      this.note('presence');
      this.presence = map;
      // a code-joiner is "in" only once a host actually shows up in the room
      if (!this.forcedHost && !this.quick && !this.validated && Object.values(map).some((p) => p.isHost)) {
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
      this.settings = payload as unknown as RoomSettings;
      this.emit();
    });
    t.on('start', (payload) => {
      this.note('start');
      // adopt the host's match identity so EVERY client loads the same arena
      this.matchId = (payload.matchId as string) ?? makeMatchId();
      this.seed = Number(payload.seed) || 0;
      this.roster = Array.isArray(payload.roster) ? (payload.roster as RosterEntry[]) : [];
      this.startAt = Number(payload.at) || Date.now() + COUNTDOWN_MS;
      this.liveScores = { red: 0, blue: 0 };
      this.matchEnd = null;
      this.phase = 'countdown';
      this.emit();
      const delay = Math.max(0, this.startAt - Date.now());
      this.timer = setTimeout(() => { this.phase = 'playing'; this.emit(); }, delay);
    });
    // host-authoritative score mirror (host also receives its own via broadcast:self)
    t.on('score', (payload) => {
      this.note('score');
      this.liveScores = { red: Number(payload.red) || 0, blue: Number(payload.blue) || 0 };
      this.emit();
    });
    t.on('match_end', (payload) => {
      this.note('match_end');
      this.matchEnd = { red: Number(payload.red) || 0, blue: Number(payload.blue) || 0 };
      this.liveScores = this.matchEnd;
      // keep phase 'playing' so RoomLobby keeps ArenaGame mounted to show results;
      // ArenaGame owns the results screen and the exit back to the menu.
      this.emit();
    });
    // M2: in-match event relay (move/shoot/down/respawn). Register the 'net'
    // handler BEFORE connect so the transport attaches it to the channel.
    this.match.start();
    await t.connect(this.me);
  }

  // emit() so my own row updates instantly (optimistic); track() syncs to others.
  setReady(ready: boolean) { this.me = { ...this.me, ready }; this.transport.track(this.me); this.emit(); }
  setTeam(team: TeamId) { this.me = { ...this.me, team }; this.transport.track(this.me); this.emit(); }

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
    const players = Object.values(this.presence);
    if (!players.length || players.some((p) => !p.ready)) return;
    const at = Date.now() + COUNTDOWN_MS;
    this.transport.broadcast('start', { at, matchId: makeMatchId(), seed: makeSeed(), roster: this.buildRoster() });
  }

  /** Host builds the match roster from lobby presence (netId + chosen team). */
  private buildRoster(): RosterEntry[] {
    const map: Record<string, RosterEntry> = {};
    for (const [netId, m] of Object.entries(this.presence)) {
      map[netId] = { netId, name: m.name, avatar: m.avatar, team: m.team };
    }
    // make sure I'm in it with my latest team/avatar (presence can lag a beat)
    map[this.transport.id] = {
      netId: this.transport.id, name: this.me.name, avatar: this.me.avatar, team: this.me.team,
    };
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
  }

  leave() {
    if (this.timer) clearTimeout(this.timer);
    if (this.validateTimer) clearTimeout(this.validateTimer);
    this.match.stop();
    this.transport.disconnect();
    this.listeners.clear();
  }
}
