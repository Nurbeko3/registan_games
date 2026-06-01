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

  useEffect(() => {
    if (!isCloudEnabled()) {
      setPhase('error');
      return;
    }
    const channel = supabase!.channel(`kcq-room-${code}`, {
      config: { presence: { key: playerId.current }, broadcast: { self: true } },
    });
    channelRef.current = channel;

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState() as Record<string, Array<Partial<PartyPlayer>>>;
      const list: PartyPlayer[] = Object.entries(state).map(([id, metas]) => ({
        id,
        name: metas[0]?.name ?? 'Player',
        avatar: metas[0]?.avatar ?? '🐱',
        score: metas[0]?.score ?? 0,
        isHost: metas[0]?.isHost ?? false,
      }));
      list.sort((a, b) => b.score - a.score);
      setPlayers(list);
    });

    channel.on('broadcast', { event: 'start' }, ({ payload }) => {
      setOrder(payload.order as number[]);
      setSelected(null);
    });
    channel.on('broadcast', { event: 'question' }, ({ payload }) => {
      qStart.current = Date.now();
      setQIndex(payload.index as number);
      setSelected(null);
      setPhase('question');
    });
    channel.on('broadcast', { event: 'reveal' }, () => setPhase('reveal'));
    channel.on('broadcast', { event: 'end' }, () => setPhase('ended'));

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        updatePresence();
        setPhase((p) => (p === 'connecting' ? 'lobby' : p));
      }
    });

    return () => {
      clearTimers();
      void channel.unsubscribe();
      void supabase!.removeChannel(channel);
    };
  }, [code, updatePresence]);

  // Host drives the match timing; all clients (incl. host) react to broadcasts.
  const hostRunQuestion = useCallback((i: number, ord: number[]) => {
    channelRef.current?.send({ type: 'broadcast', event: 'question', payload: { index: i } });
    timers.current.push(
      setTimeout(() => {
        channelRef.current?.send({ type: 'broadcast', event: 'reveal', payload: { index: i } });
        timers.current.push(
          setTimeout(() => {
            if (i + 1 < ord.length) hostRunQuestion(i + 1, ord);
            else channelRef.current?.send({ type: 'broadcast', event: 'end', payload: {} });
          }, REVEAL_MS),
        );
      }, QUESTION_MS),
    );
  }, []);

  const startGame = useCallback(() => {
    if (!meta.current.isHost) return;
    const ord = [...PARTY_QUIZ.keys()].sort(() => Math.random() - 0.5).slice(0, QUESTIONS_PER_MATCH);
    score.current = 0;
    updatePresence();
    channelRef.current?.send({ type: 'broadcast', event: 'start', payload: { order: ord } });
    timers.current.push(setTimeout(() => hostRunQuestion(0, ord), 500));
  }, [hostRunQuestion, updatePresence]);

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
