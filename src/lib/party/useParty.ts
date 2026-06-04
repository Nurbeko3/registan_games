'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, isCloudEnabled } from '@/lib/supabase/client';
import { PARTY_QUIZ, type PartyQuestion } from '@/data/partyQuiz';

export interface PartyPlayer {
  id: string;
  name: string;
  avatar: string;
  score: number;
  isHost: boolean;
}

export type PartyPhase = 'connecting' | 'lobby' | 'question' | 'reveal' | 'ended' | 'error';

const QUESTIONS_PER_MATCH = 5;
const QUESTION_MS = 11_000;
const REVEAL_MS = 3_500;
const PARTY_SESSION_PREFIX = 'kcq.party.session.';

const randomId = () => Math.random().toString(36).slice(2, 10);

interface PartyOptions {
  name: string;
  avatar: string;
  isHost: boolean;
}

interface PartyPresence {
  name?: string;
  avatar?: string;
  isHost?: boolean;
}

interface PartySession {
  playerId: string;
  hostToken?: string;
  playerToken?: string;
}

function readPartySession(code: string): PartySession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`${PARTY_SESSION_PREFIX}${code}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PartySession>;
    if (typeof parsed.playerId !== 'string' || !parsed.playerId) return null;
    return {
      playerId: parsed.playerId,
      hostToken: typeof parsed.hostToken === 'string' ? parsed.hostToken : undefined,
      playerToken: typeof parsed.playerToken === 'string' ? parsed.playerToken : undefined,
    };
  } catch {
    return null;
  }
}

function writePartySession(code: string, session: PartySession) {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(`${PARTY_SESSION_PREFIX}${code}`, JSON.stringify(session)); } catch {}
}

function safeScoreMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {};
  const scores: Record<string, number> = {};
  for (const [id, score] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(score);
    if (typeof id === 'string' && Number.isFinite(n)) scores[id] = Math.max(0, Math.floor(n));
  }
  return scores;
}

/**
 * Shared quiz party room.
 *  - Presence carries only display metadata.
 *  - Room phase/order is Supabase RPC-authoritative.
 *  - Scores are host-calculated and mirrored to clients; non-hosts cannot set
 *    arbitrary scores through presence anymore.
 */
export function useParty(code: string, opts: PartyOptions) {
  const [phase, setPhase] = useState<PartyPhase>('connecting');
  const [players, setPlayers] = useState<PartyPlayer[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [qIndex, setQIndex] = useState(-1);
  const [selected, setSelected] = useState<number | null>(null);

  const phaseRef = useRef(phase);
  const orderRef = useRef(order);
  const qIndexRef = useRef(qIndex);
  const saved = readPartySession(code);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const playerId = useRef(saved?.playerId ?? randomId());
  const hostId = useRef<string | null>(opts.isHost ? playerId.current : null);
  const hostToken = useRef<string | null>(opts.isHost ? saved?.hostToken ?? null : null);
  const playerToken = useRef<string | null>(saved?.playerToken ?? null);
  const lastRevision = useRef(-1);
  const meta = useRef(opts);
  meta.current = opts;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const presenceRef = useRef<Record<string, PartyPresence>>({});
  const scoresRef = useRef<Record<string, number>>({});
  phaseRef.current = phase;
  orderRef.current = order;
  qIndexRef.current = qIndex;

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const rebuildPlayers = useCallback(() => {
    const list: PartyPlayer[] = Object.entries(presenceRef.current).map(([id, latest]) => ({
      id,
      name: typeof latest.name === 'string' && latest.name.trim() ? latest.name.slice(0, 20) : 'Player',
      avatar: typeof latest.avatar === 'string' && latest.avatar ? latest.avatar : '🐱',
      score: scoresRef.current[id] ?? 0,
      isHost: id === hostId.current,
    }));
    if (!list.some((p) => p.id === playerId.current)) {
      list.push({
        id: playerId.current,
        name: meta.current.name || 'Player',
        avatar: meta.current.avatar || '🐱',
        score: scoresRef.current[playerId.current] ?? 0,
        isHost: playerId.current === hostId.current,
      });
    }
    list.sort((a, b) => (b.score === a.score ? (a.isHost === b.isHost ? a.name.localeCompare(b.name) : a.isHost ? -1 : 1) : b.score - a.score));
    setPlayers(list);
  }, []);

  const updatePresence = useCallback(() => {
    const own = {
      name: meta.current.name,
      avatar: meta.current.avatar,
      isHost: playerId.current === hostId.current,
    };
    presenceRef.current = { ...presenceRef.current, [playerId.current]: own };
    rebuildPlayers();
    void channelRef.current?.track(own);
  }, [rebuildPlayers]);

  const pushHostState = useCallback(async (nextPhase: 'lobby' | 'question' | 'reveal' | 'ended', index: number, ord?: number[]) => {
    if (!hostToken.current || !isCloudEnabled()) return false;
    const { data, error } = await supabase!.rpc('kcq_party_host_state', {
      p_code: code,
      p_token: hostToken.current,
      p_phase: nextPhase,
      p_q_index: index,
      p_order: ord ?? null,
    });
    return !error && !!data?.ok;
  }, [code]);

  const hostRunQuestion = useCallback((i: number, ord: number[]) => {
    void pushHostState('question', i, ord);
  }, [pushHostState]);

  const joinRoom = useCallback(async () => {
    if (!isCloudEnabled()) return false;
    const { data, error } = await supabase!.rpc('kcq_party_join', {
      p_code: code,
      p_player_id: playerId.current,
    });
    if (error || !data?.ok) return false;
    playerToken.current = data.token as string;
    writePartySession(code, {
      playerId: playerId.current,
      hostToken: hostToken.current ?? undefined,
      playerToken: playerToken.current,
    });
    applyRoomState(data.state);
    return true;
  }, [code]);

  const scheduleHostTimers = useCallback((nextPhase: PartyPhase, index: number, ord: number[], updatedAtMs: number) => {
    if (!meta.current.isHost || !hostToken.current) return;
    clearTimers();
    if (nextPhase === 'question' && index >= 0) {
      const elapsed = Math.max(0, Date.now() - updatedAtMs);
      const wait = Math.max(0, QUESTION_MS - elapsed);
      timers.current.push(setTimeout(() => { void pushHostState('reveal', index, ord); }, wait));
    } else if (nextPhase === 'reveal' && index >= 0) {
      const elapsed = Math.max(0, Date.now() - updatedAtMs);
      const wait = Math.max(0, REVEAL_MS - elapsed);
      timers.current.push(setTimeout(() => {
        if (index + 1 < ord.length) hostRunQuestion(index + 1, ord);
        else void pushHostState('ended', index, ord);
      }, wait));
    }
  }, [hostRunQuestion, pushHostState]);

  const applyRoomState = useCallback((raw: unknown) => {
    const state = raw as {
      host_id?: unknown;
      phase?: unknown;
      order?: unknown;
      order_indices?: unknown;
      q_index?: unknown;
      scores?: unknown;
      revision?: unknown;
      updated_at?: unknown;
    };
    const revision = Number(state.revision);
    if (Number.isFinite(revision) && revision <= lastRevision.current) return;
    if (Number.isFinite(revision)) lastRevision.current = revision;
    if (typeof state.host_id === 'string') hostId.current = state.host_id;

    const rawOrder = Array.isArray(state.order) ? state.order : state.order_indices;
    const nextOrder = Array.isArray(rawOrder)
      ? rawOrder.filter((n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < PARTY_QUIZ.length).slice(0, QUESTIONS_PER_MATCH)
      : [];
    const nextIndex = Number(state.q_index);
    const nextPhase = state.phase === 'question' || state.phase === 'reveal' || state.phase === 'ended' || state.phase === 'lobby'
      ? state.phase
      : null;
    if (!nextPhase) return;

    const updatedAtMs = typeof state.updated_at === 'string' ? Date.parse(state.updated_at) : Date.now();
    const safeUpdatedAt = Number.isFinite(updatedAtMs) ? updatedAtMs : Date.now();
    scoresRef.current = safeScoreMap(state.scores);
    setOrder(nextOrder);
    setQIndex(Number.isInteger(nextIndex) ? nextIndex : -1);
    if (nextPhase === 'question') {
      setSelected(null);
    }
    setPhase(nextPhase);
    scheduleHostTimers(nextPhase, Number.isInteger(nextIndex) ? nextIndex : -1, nextOrder, safeUpdatedAt);
    rebuildPlayers();
    updatePresence();
  }, [rebuildPlayers, scheduleHostTimers, updatePresence]);

  useEffect(() => {
    if (!isCloudEnabled()) {
      setPhase('error');
      return;
    }
    writePartySession(code, { playerId: playerId.current, hostToken: hostToken.current ?? undefined, playerToken: playerToken.current ?? undefined });
    const channel = supabase!.channel(`kcq-room-${code}`, {
      config: { presence: { key: playerId.current }, broadcast: { self: true } },
    });
    channelRef.current = channel;

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'kcq_party_rooms', filter: `code=eq.${code}` },
      ({ new: next }) => applyRoomState(next),
    );

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState() as Record<string, Array<PartyPresence>>;
      const claimedHosts = Object.entries(state)
        .filter(([, metas]) => metas.some((m) => m.isHost === true))
        .map(([id]) => id)
        .sort();
      if (!hostId.current && claimedHosts.length) hostId.current = claimedHosts[0];
      presenceRef.current = Object.fromEntries(Object.entries(state).map(([id, metas]) => [id, metas[metas.length - 1] ?? {}]));
      rebuildPlayers();
    });

    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
      updatePresence();
      if (meta.current.isHost) {
        const resume = hostToken.current
          ? supabase!.rpc('kcq_party_host_resume', { p_code: code, p_host_id: playerId.current, p_token: hostToken.current })
          : Promise.resolve({ data: null, error: null });
        resume.then(({ data }) => {
          if (data?.ok) {
            hostToken.current = data.token as string;
            hostId.current = playerId.current;
            writePartySession(code, { playerId: playerId.current, hostToken: hostToken.current, playerToken: playerToken.current ?? undefined });
            applyRoomState(data.state);
            void joinRoom();
            return;
          }
          supabase!.rpc('kcq_party_create', { p_code: code, p_host_id: playerId.current }).then(({ data: created, error }) => {
            if (error || !created?.ok) {
              setPhase('error');
              return;
            }
            hostToken.current = created.token as string;
            hostId.current = playerId.current;
            writePartySession(code, { playerId: playerId.current, hostToken: hostToken.current, playerToken: playerToken.current ?? undefined });
            scoresRef.current = {};
            setPhase((p) => (p === 'connecting' ? 'lobby' : p));
            void joinRoom();
          });
        });
      } else {
        supabase!.rpc('kcq_party_state', { p_code: code }).then(({ data, error }) => {
          if (error || !data?.ok) {
            setPhase('error');
            return;
          }
          applyRoomState(data.state);
          void joinRoom();
        });
      }
    });

    return () => {
      clearTimers();
      void channel.unsubscribe();
      void supabase!.removeChannel(channel);
    };
  }, [applyRoomState, code, joinRoom, rebuildPlayers, updatePresence]);

  const startGame = useCallback(() => {
    if (!meta.current.isHost) return;
    const ord = [...PARTY_QUIZ.keys()].sort(() => Math.random() - 0.5).slice(0, QUESTIONS_PER_MATCH);
    scoresRef.current = {};
    rebuildPlayers();
    setOrder(ord);
    setSelected(null);
    void pushHostState('lobby', -1, ord);
    clearTimers();
    timers.current.push(setTimeout(() => hostRunQuestion(0, ord), 500));
  }, [hostRunQuestion, pushHostState, rebuildPlayers]);

  const answer = useCallback(
    (optionIndex: number) => {
      if (phase !== 'question' || selected !== null || qIndex < 0) return;
      setSelected(optionIndex);
      if (!playerToken.current || !isCloudEnabled()) return;
      supabase!.rpc('kcq_party_answer', {
        p_code: code,
        p_player_id: playerId.current,
        p_player_token: playerToken.current,
        p_q_index: qIndex,
        p_option: optionIndex,
      }).then(({ data }) => {
        if (data?.scores) {
          scoresRef.current = safeScoreMap(data.scores);
          rebuildPlayers();
        }
      });
    },
    [code, phase, selected, qIndex, rebuildPlayers],
  );

  const question: PartyQuestion | null =
    qIndex >= 0 && order[qIndex] !== undefined ? PARTY_QUIZ[order[qIndex]] : null;

  return {
    phase,
    players,
    question,
    qIndex,
    total: order.length,
    selected,
    isHost: opts.isHost,
    myId: playerId.current,
    questionMs: QUESTION_MS,
    startGame,
    answer,
  };
}
