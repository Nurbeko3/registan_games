'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, isCloudEnabled } from '@/lib/supabase/client';
import { getCase } from '@/data/cases';
import { localizeCase } from '@/data/cases/i18n';
import { publicCase, type PublicCase } from '@/data/cases/types';
import { useLocale } from '@/lib/i18n';

/**
 * Case Files realtime room — the React binding for Friendly / Classroom matches.
 *
 * Cloned from src/lib/party/useParty.ts and adapted to migration 0011:
 *  - Phase machine (lobby→investigation→question→reveal→ended) is RPC-authoritative;
 *    the host drives it (no auto-advance in MVP — §9 LOCKED).
 *  - Per-player score/streak live in the relational `kcq_case_players` table and
 *    stream over `postgres_changes` (NOT presence) — scales to classrooms.
 *  - Answers are scored server-side; the client never holds the answer key. The
 *    correct option for the just-closed question arrives via the host's `reveal`
 *    broadcast (the host learns it from kcq_case_advance_reveal's return).
 */

export type CaseRoomPhase =
  | 'connecting' | 'lobby' | 'investigation' | 'question' | 'reveal' | 'ended' | 'error';

export interface CaseRoomPlayer {
  id: string;
  name: string;
  score: number;
  streak: number;
  isHost: boolean;
}

export interface CaseAnswerOutcome {
  qIndex: number;
  option: number;
  correct: boolean;
  xp: number;
  score: number;
}

export interface CasePlayerResult {
  stars: number;
  solveXp: number;
  correctCount: number;
  totalQ: number;
  hintUsed: boolean;
  score: number;
}

export interface UseCaseRoomOptions {
  /** Required for the host: which case to create the room with. */
  caseId?: string;
  isHost: boolean;
  name: string;
  /** Classroom tournaments: teacher is host-only and does not join as a player. */
  isClassroom?: boolean;
  /**
   * Spectator mode: the client subscribes to room/player changes but does NOT
   * call join() — it will not appear as a player in the roster.
   * Used by the projector display route /case/[code]/display.
   */
  spectator?: boolean;
}

const SESSION_PREFIX = 'kcq.case.session.';
const randomId = () => Math.random().toString(36).slice(2, 10);

interface CaseSession { playerId: string; hostToken?: string; playerToken?: string }

function readRoomSession(code: string): CaseSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`${SESSION_PREFIX}${code}`);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<CaseSession>;
    if (typeof p.playerId !== 'string' || !p.playerId) return null;
    return {
      playerId: p.playerId,
      hostToken: typeof p.hostToken === 'string' ? p.hostToken : undefined,
      playerToken: typeof p.playerToken === 'string' ? p.playerToken : undefined,
    };
  } catch { return null; }
}

function writeRoomSession(code: string, s: CaseSession) {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(`${SESSION_PREFIX}${code}`, JSON.stringify(s)); } catch {}
}

interface RawPlayer { player_id?: unknown; display_name?: unknown; score?: unknown; streak?: unknown; is_host?: unknown }

function normalizePlayer(raw: RawPlayer): CaseRoomPlayer | null {
  if (typeof raw.player_id !== 'string' || !raw.player_id) return null;
  return {
    id: raw.player_id,
    name: typeof raw.display_name === 'string' && raw.display_name ? raw.display_name : 'Player',
    score: Math.max(0, Math.floor(Number(raw.score) || 0)),
    streak: Math.max(0, Math.floor(Number(raw.streak) || 0)),
    isHost: raw.is_host === true,
  };
}

export function useCaseRoom(code: string, opts: UseCaseRoomOptions) {
  const locale = useLocale();
  const [phase, setPhase] = useState<CaseRoomPhase>('connecting');
  const [players, setPlayers] = useState<CaseRoomPlayer[]>([]);
  const [caseId, setCaseId] = useState<string | null>(opts.caseId ?? null);
  const [qIndex, setQIndex] = useState(-1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [roomIsClassroom, setRoomIsClassroom] = useState<boolean>(!!opts.isClassroom);
  const [lastAnswer, setLastAnswer] = useState<CaseAnswerOutcome | null>(null);
  const [revealCorrect, setRevealCorrect] = useState<number | null>(null);
  const [results, setResults] = useState<Record<string, CasePlayerResult> | null>(null);

  const saved = readRoomSession(code);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const playerId = useRef(saved?.playerId ?? randomId());
  const hostId = useRef<string | null>(opts.isHost ? playerId.current : null);
  const hostToken = useRef<string | null>(opts.isHost ? saved?.hostToken ?? null : null);
  const playerToken = useRef<string | null>(saved?.playerToken ?? null);
  const playersMap = useRef<Record<string, CaseRoomPlayer>>({});
  const lastRevision = useRef(-1);
  const meta = useRef(opts);
  meta.current = opts;

  const hostPlays = !opts.isClassroom; // teacher in a classroom does not play

  const rebuildPlayers = useCallback(() => {
    const list = Object.values(playersMap.current);
    list.sort((a, b) => (b.score === a.score ? a.name.localeCompare(b.name) : b.score - a.score));
    setPlayers(list);
  }, []);

  const persist = useCallback(() => {
    writeRoomSession(code, {
      playerId: playerId.current,
      hostToken: hostToken.current ?? undefined,
      playerToken: playerToken.current ?? undefined,
    });
  }, [code]);

  const applyRoomRow = useCallback((raw: unknown) => {
    const s = raw as {
      host_id?: unknown; case_id?: unknown; q_set?: unknown; phase?: unknown;
      q_index?: unknown; revision?: unknown; is_classroom?: unknown;
    };
    const revision = Number(s.revision);
    if (Number.isFinite(revision) && revision <= lastRevision.current) return;
    if (Number.isFinite(revision)) lastRevision.current = revision;
    if (typeof s.host_id === 'string') hostId.current = s.host_id;
    if (typeof s.case_id === 'string') setCaseId(s.case_id);
    if (Array.isArray(s.q_set)) setTotal(s.q_set.length);
    if (typeof s.is_classroom === 'boolean') setRoomIsClassroom(s.is_classroom);

    const nextIndex = Number(s.q_index);
    const valid = ['lobby', 'investigation', 'question', 'reveal', 'ended'] as const;
    const nextPhase = (valid as readonly string[]).includes(s.phase as string)
      ? (s.phase as CaseRoomPhase) : null;
    if (!nextPhase) return;

    setQIndex(Number.isInteger(nextIndex) ? nextIndex : -1);
    if (nextPhase === 'question') {
      // a freshly opened question — clear last round's answer/reveal
      setSelected(null);
      setLastAnswer(null);
      setRevealCorrect(null);
    }
    setPhase(nextPhase);
  }, []);

  const seedPlayers = useCallback((rawPlayers: unknown) => {
    if (!Array.isArray(rawPlayers)) return;
    const map: Record<string, CaseRoomPlayer> = {};
    for (const rp of rawPlayers) {
      const p = normalizePlayer(rp as RawPlayer);
      if (p) map[p.id] = p;
    }
    playersMap.current = map;
    rebuildPlayers();
  }, [rebuildPlayers]);

  const applyState = useCallback((state: unknown) => {
    const s = state as { players?: unknown };
    applyRoomRow(state);
    seedPlayers(s.players);
  }, [applyRoomRow, seedPlayers]);

  const join = useCallback(async () => {
    if (!isCloudEnabled() || (meta.current.isHost && !hostPlays)) return;
    const { data, error } = await supabase!.rpc('kcq_case_join', {
      p_code: code, p_player_id: playerId.current, p_display_name: meta.current.name,
    });
    if (error || !data?.ok) return;
    playerToken.current = data.token as string;
    persist();
    applyState(data.state);
  }, [applyState, code, hostPlays, persist]);

  // ── connect ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isCloudEnabled()) { setPhase('error'); return; }
    persist();
    const channel = supabase!.channel(`kcq-case-${code}`, {
      config: { presence: { key: playerId.current }, broadcast: { self: true } },
    });
    channelRef.current = channel;

    channel.on('postgres_changes',
      { event: '*', schema: 'public', table: 'kcq_case_rooms', filter: `code=eq.${code}` },
      ({ new: next }) => applyRoomRow(next));

    channel.on('postgres_changes',
      { event: '*', schema: 'public', table: 'kcq_case_players', filter: `room_code=eq.${code}` },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as RawPlayer).player_id;
          if (typeof id === 'string') delete playersMap.current[id];
        } else {
          const p = normalizePlayer(payload.new as RawPlayer);
          if (p) playersMap.current[p.id] = p;
        }
        rebuildPlayers();
      });

    // host → all: the just-closed question's correct option (teaching moment)
    channel.on('broadcast', { event: 'reveal' }, ({ payload }) => {
      const qi = Number(payload?.qIndex);
      const opt = Number(payload?.correctOption);
      if (Number.isInteger(opt)) setRevealCorrect(opt);
      void qi;
    });
    // host → all: final per-player results
    channel.on('broadcast', { event: 'results' }, ({ payload }) => {
      if (payload?.results) setResults(payload.results as Record<string, CasePlayerResult>);
    });

    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
      if (meta.current.isHost) {
        const resume = hostToken.current
          ? supabase!.rpc('kcq_case_host_resume', { p_code: code, p_host_id: playerId.current, p_token: hostToken.current })
          : Promise.resolve({ data: null, error: null });
        resume.then(({ data }) => {
          if (data?.ok) {
            hostToken.current = data.token as string;
            hostId.current = playerId.current;
            persist();
            applyState(data.state);
            if (hostPlays) void join();
            return;
          }
          supabase!.rpc('kcq_case_create', {
            p_code: code, p_host_id: playerId.current,
            p_case_id: meta.current.caseId, p_is_classroom: !!meta.current.isClassroom,
          }).then(({ data: created, error }) => {
            if (error || !created?.ok) { setPhase('error'); return; }
            hostToken.current = created.token as string;
            hostId.current = playerId.current;
            if (meta.current.caseId) setCaseId(meta.current.caseId);
            persist();
            setPhase((p) => (p === 'connecting' ? 'lobby' : p));
            if (hostPlays) void join();
          });
        });
      } else {
        supabase!.rpc('kcq_case_state', { p_code: code }).then(({ data, error }) => {
          if (error || !data?.ok) { setPhase('error'); return; }
          applyState(data.state);
          if (!meta.current.spectator) void join();
        });
      }
    });

    return () => { void channel.unsubscribe(); void supabase!.removeChannel(channel); };
  }, [applyRoomRow, applyState, code, hostPlays, join, persist, rebuildPlayers]);

  // ── host controls ──────────────────────────────────────────────────
  const hostRpc = useCallback(async (name: string) => {
    if (!meta.current.isHost || !hostToken.current || !isCloudEnabled()) return null;
    const { data, error } = await supabase!.rpc(name, { p_code: code, p_token: hostToken.current });
    return error ? null : data;
  }, [code]);

  const startInvestigation = useCallback(() => { void hostRpc('kcq_case_start_investigation'); }, [hostRpc]);
  const advanceQuestion = useCallback(() => { void hostRpc('kcq_case_advance_question'); }, [hostRpc]);

  const advanceReveal = useCallback(async () => {
    const data = await hostRpc('kcq_case_advance_reveal');
    if (data?.ok && Number.isInteger(data.correct_option)) {
      channelRef.current?.send({
        type: 'broadcast', event: 'reveal',
        payload: { qIndex: data.q_index, correctOption: data.correct_option },
      });
    }
  }, [hostRpc]);

  const endMatch = useCallback(async () => {
    const data = await hostRpc('kcq_case_end_match');
    if (data?.ok && data.results) {
      const mapped: Record<string, CasePlayerResult> = {};
      for (const [pid, r] of Object.entries(data.results as Record<string, Record<string, unknown>>)) {
        mapped[pid] = {
          stars: Number(r.stars) || 0,
          solveXp: Number(r.solve_xp) || 0,
          correctCount: Number(r.correct_count) || 0,
          totalQ: Number(r.total_q) || 0,
          hintUsed: r.hint_used === true,
          score: Number(r.score) || 0,
        };
      }
      setResults(mapped);
      channelRef.current?.send({ type: 'broadcast', event: 'results', payload: { results: mapped } });
    }
  }, [hostRpc]);

  // ── player actions ─────────────────────────────────────────────────
  const answer = useCallback((option: number) => {
    if (phase !== 'question' || selected !== null || qIndex < 0) return;
    setSelected(option);
    if (!playerToken.current || !isCloudEnabled()) return;
    supabase!.rpc('kcq_case_answer', {
      p_code: code, p_player_id: playerId.current, p_player_token: playerToken.current,
      p_q_index: qIndex, p_option: option,
    }).then(({ data }) => {
      if (data?.ok) {
        setLastAnswer({
          qIndex, option, correct: data.correct === true,
          xp: Number(data.xp) || 0, score: Number(data.score) || 0,
        });
      }
    });
  }, [code, phase, qIndex, selected]);

  const openHint = useCallback(() => {
    if (!playerToken.current || !isCloudEnabled() || qIndex < 0) return;
    void supabase!.rpc('kcq_case_open_hint', {
      p_code: code, p_player_id: playerId.current, p_player_token: playerToken.current, p_q_index: qIndex,
    });
  }, [code, qIndex]);

  // Localise the case for display BEFORE stripping answers — every client
  // renders content from its own bundle, and localizeCase keeps choice order +
  // answerIndex identical, so server scoring stays locale-independent.
  const caseDef: PublicCase | null = caseId ? (() => {
    const c = getCase(caseId);
    return c ? publicCase(localizeCase(c, locale)) : null;
  })() : null;

  /**
   * Host-only: fetch per-player detailed results from the server for the
   * classroom results export (Excel download). Returns the RPC data or null.
   * No-ops gracefully when cloud is disabled or host token is missing.
   */
  const teacherResults = async () => {
    if (!meta.current.isHost || !hostToken.current || !isCloudEnabled()) return null;
    const { data, error } = await supabase!.rpc('kcq_case_teacher_results', {
      p_code: code,
      p_token: hostToken.current,
    });
    if (error) return null;
    return data as Array<{
      player_id: string;
      display_name: string;
      total_score: number;
      q_results: Array<{
        q_index: number;
        answered: boolean;
        correct: boolean;
        hint_used: boolean;
        xp: number;
      }>;
    }> | null;
  };

  return {
    phase, players, caseId, caseDef, qIndex, total, selected, lastAnswer, revealCorrect, results,
    isClassroom: roomIsClassroom,
    myId: playerId.current,
    isHost: opts.isHost,
    myResult: results?.[playerId.current] ?? null,
    // host
    startInvestigation, advanceQuestion, advanceReveal, endMatch,
    // host-only: classroom results export
    teacherResults,
    // player
    answer, openHint,
  };
}
