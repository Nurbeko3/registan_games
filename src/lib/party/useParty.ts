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

const randomId = () => Math.random().toString(36).slice(2, 10);

interface PartyOptions {
  name: string;
  avatar: string;
  isHost: boolean;
}

/**
 * Realtime multiplayer room over a single Supabase channel.
 *  • Presence  → live player list + scores (each player tracks their own score)
 *  • Broadcast → host syncs the phase (start / question / reveal / end)
 * No database tables needed — rooms are ephemeral, like a party game.
 */
export function useParty(code: string, opts: PartyOptions) {
  const [phase, setPhase] = useState<PartyPhase>('connecting');
  const [players, setPlayers] = useState<PartyPlayer[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [qIndex, setQIndex] = useState(-1);
  const [selected, setSelected] = useState<number | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const playerId = useRef(randomId());
  const hostId = useRef<string | null>(opts.isHost ? playerId.current : null);
  const hostToken = useRef<string | null>(null);
  const lastRevision = useRef(-1);
  const score = useRef(0);
  const qStart = useRef(0);
  const meta = useRef(opts);
  meta.current = opts;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const updatePresence = useCallback(() => {
    void channelRef.current?.track({
      name: meta.current.name,
      avatar: meta.current.avatar,
      score: score.current,
      isHost: meta.current.isHost,
    });
  }, []);

  const applyRoomState = useCallback((raw: unknown) => {
    const state = raw as {
      host_id?: unknown;
      phase?: unknown;
      order?: unknown;
      order_indices?: unknown;
      q_index?: unknown;
      revision?: unknown;
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

    setOrder(nextOrder);
    setQIndex(Number.isInteger(nextIndex) ? nextIndex : -1);
    if (nextPhase === 'question') {
      qStart.current = Date.now();
      setSelected(null);
    }
    setPhase(nextPhase);
  }, []);

  const pushHostState = useCallback(async (phase: 'lobby' | 'question' | 'reveal' | 'ended', index: number, ord?: number[]) => {
    if (!hostToken.current || !isCloudEnabled()) return false;
    const { data, error } = await supabase!.rpc('kcq_party_host_state', {
      p_code: code,
      p_token: hostToken.current,
      p_phase: phase,
      p_q_index: index,
      p_order: ord ?? null,
    });
    return !error && !!data?.ok;
  }, [code]);

  useEffect(() => {
    if (!isCloudEnabled()) {
      setPhase('error');
      return;
    }
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
      const state = channel.presenceState() as Record<string, Array<Partial<PartyPlayer>>>;
      const claimedHosts = Object.entries(state)
        .filter(([, metas]) => metas.some((m) => m.isHost === true))
        .map(([id]) => id)
        .sort();
      if (!hostId.current && claimedHosts.length) hostId.current = claimedHosts[0];
      const list: PartyPlayer[] = Object.entries(state).map(([id, metas]) => {
        const latest = metas[metas.length - 1] ?? {};
        return {
          id,
          name: typeof latest.name === 'string' && latest.name.trim() ? latest.name.slice(0, 20) : 'Player',
          avatar: typeof latest.avatar === 'string' && latest.avatar ? latest.avatar : '🐱',
          score: typeof latest.score === 'number' && Number.isFinite(latest.score) ? latest.score : 0,
          isHost: id === hostId.current,
        };
      });
      list.sort((a, b) => b.score - a.score);
      setPlayers(list);
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        updatePresence();
        if (meta.current.isHost) {
          supabase!.rpc('kcq_party_create', { p_code: code, p_host_id: playerId.current }).then(({ data, error }) => {
            if (error || !data?.ok) {
              setPhase('error');
              return;
            }
            hostToken.current = data.token as string;
            hostId.current = playerId.current;
            setPhase((p) => (p === 'connecting' ? 'lobby' : p));
          });
        } else {
          supabase!.rpc('kcq_party_state', { p_code: code }).then(({ data, error }) => {
            if (error || !data?.ok) {
              setPhase('error');
              return;
            }
            applyRoomState(data.state);
          });
        }
      }
    });

    return () => {
      clearTimers();
      void channel.unsubscribe();
      void supabase!.removeChannel(channel);
    };
  }, [applyRoomState, code, updatePresence]);

  // Host drives timing through RPC-validated room state; clients listen to DB changes.
  const hostRunQuestion = useCallback((i: number, ord: number[]) => {
    void pushHostState('question', i, ord);
    timers.current.push(
      setTimeout(() => {
        void pushHostState('reveal', i, ord);
        timers.current.push(
          setTimeout(() => {
            if (i + 1 < ord.length) hostRunQuestion(i + 1, ord);
            else void pushHostState('ended', i, ord);
          }, REVEAL_MS),
        );
      }, QUESTION_MS),
    );
  }, [pushHostState]);

  const startGame = useCallback(() => {
    if (!meta.current.isHost) return;
    const ord = [...PARTY_QUIZ.keys()].sort(() => Math.random() - 0.5).slice(0, QUESTIONS_PER_MATCH);
    score.current = 0;
    updatePresence();
    setOrder(ord);
    setSelected(null);
    void pushHostState('lobby', -1, ord);
    timers.current.push(setTimeout(() => hostRunQuestion(0, ord), 500));
  }, [hostRunQuestion, pushHostState, updatePresence]);

  const answer = useCallback(
    (optionIndex: number) => {
      if (phase !== 'question' || selected !== null || qIndex < 0) return;
      setSelected(optionIndex);
      const q = PARTY_QUIZ[order[qIndex]];
      if (q && optionIndex === q.answer) {
        const timeMs = Date.now() - qStart.current;
        score.current += Math.max(20, 100 - Math.floor(timeMs / 120));
        updatePresence();
      }
    },
    [phase, selected, qIndex, order, updatePresence],
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
