'use client';

import { use } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCaseRoom } from '@/lib/caseFiles/useCaseRoom';
import { useT } from '@/lib/i18n';
import { useGame } from '@/store/useGame';
import { Icon } from '@/components/ui/Icon';
import type { Standing } from '@/components/case/Scoreboard';

interface Props {
  params: Promise<{ code: string }>;
}

/**
 * Projector / big-screen read-only display for a classroom tournament.
 * PUBLIC — no admin gate. Uses spectator:true so it never appears in the roster.
 * Designed for projection: always-dark canvas, huge type, high contrast.
 * Reduced-motion safe (Framer Motion respects prefers-reduced-motion via CSS).
 */
export default function DisplayPage({ params }: Props) {
  const { code } = use(params);
  return <ProjectorScreen code={code.toUpperCase()} />;
}

function ProjectorScreen({ code }: { code: string }) {
  const t = useT();
  const reducedMotion = useGame((s) => s.settings.reducedMotion);

  const room = useCaseRoom(code, {
    isHost: false,
    name: 'Display',
    spectator: true,
  });

  const { phase, players, caseDef, qIndex, total, revealCorrect } = room;

  const standings: Standing[] = players.map((p) => ({
    id: p.id,
    name: p.name,
    emoji: '',
    score: p.score,
  }));

  const currentQ = caseDef?.questions[qIndex] ?? null;

  // ── connecting ──────────────────────────────────────────────────────
  if (phase === 'connecting') {
    return (
      <Screen code={code}>
        <div className="grid min-h-screen place-items-center">
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-white/15 border-t-white" />
        </div>
      </Screen>
    );
  }

  // ── error ───────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <Screen code={code}>
        <div className="grid min-h-screen place-items-center p-8">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-12 py-10 text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/10 text-white">
              <Icon name="signal" className="h-8 w-8" />
            </span>
            <p className="mt-5 font-display text-3xl font-extrabold text-white">Xonaga ulanib bo'lmadi</p>
            <p className="mt-2 text-lg text-white/60">
              Kod: <strong className="font-mono tracking-[0.2em] text-white">{code}</strong>
            </p>
          </div>
        </div>
      </Screen>
    );
  }

  // ── lobby ───────────────────────────────────────────────────────────
  if (phase === 'lobby') {
    return (
      <Screen code={code}>
        <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
          <p className="font-display text-xl font-bold uppercase tracking-[0.2em] text-white/50">
            {t('acase.proj.lobbyTitle')}
          </p>

          {/* Giant room code */}
          <motion.div
            initial={reducedMotion ? false : { scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-2xl border border-white/10 bg-white/5 px-14 py-10 text-center"
          >
            <p className="text-lg font-semibold text-white/60">
              {t('acase.proj.joinAt')}{' '}
              <span className="font-bold text-[#7CC4F8]">{t('acase.proj.caseFiles')}</span>,{' '}
              {t('acase.proj.thenEnter')}
            </p>
            <p className="mt-5 font-mono text-8xl font-bold tracking-[0.25em] text-white lg:text-9xl">
              {code}
            </p>
          </motion.div>

          {/* Live player count */}
          <AnimatePresence mode="wait">
            <motion.p
              key={players.length}
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-6 py-3 font-display text-2xl font-bold text-white/85"
            >
              <Icon name="users" className="h-6 w-6 text-white/50" />
              {t('acase.proj.players', { n: String(players.length) })}
            </motion.p>
          </AnimatePresence>
        </div>
      </Screen>
    );
  }

  // ── investigation ────────────────────────────────────────────────────
  if (phase === 'investigation' && caseDef) {
    return (
      <Screen code={code}>
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
          <p className="font-display text-base font-bold uppercase tracking-[0.2em] text-white/50">
            {t('acase.proj.investigateTitle')}
          </p>
          <h1 className="max-w-4xl font-display text-5xl font-extrabold leading-tight tracking-tight text-white lg:text-6xl">
            {caseDef.title}
          </h1>
          <p className="max-w-3xl text-2xl leading-relaxed text-white/75">
            {caseDef.briefing}
          </p>
          <p className="mt-4 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-xl font-semibold text-white/70">
            <Icon name="eye" className="h-6 w-6 text-[#7CC4F8]" />
            {t('acase.proj.investigateSub')}
          </p>
        </div>
      </Screen>
    );
  }

  // ── question ─────────────────────────────────────────────────────────
  if (phase === 'question' && caseDef && currentQ) {
    return (
      <Screen code={code}>
        <div className="flex min-h-screen flex-col gap-8 p-8 lg:p-12">
          <div className="flex items-center justify-between">
            <span className="rounded-full border border-white/15 bg-white/10 px-5 py-2 font-display text-lg font-bold text-white">
              {t('acase.proj.questionBadge', { n: String(qIndex + 1), total: String(total) })}
            </span>
            <span className="inline-flex items-center gap-2 text-lg font-semibold text-white/50">
              <Icon name="users" className="h-5 w-5" />
              {players.length} ta o'quvchi
            </span>
          </div>

          <motion.div
            key={qIndex}
            initial={reducedMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-1 flex-col justify-center"
          >
            <p className="font-display text-4xl font-extrabold leading-snug tracking-tight text-white lg:text-6xl">
              {currentQ.prompt}
            </p>

            {/* Choices — shown but NOT highlighted */}
            <ul className="mt-10 grid gap-4 sm:grid-cols-2">
              {currentQ.choices.map((choice, i) => (
                <li
                  key={i}
                  className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-2xl font-semibold text-white/85"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/10 font-display text-lg font-bold text-white/70">
                    {String.fromCharCode(65 + i)}
                  </span>
                  {choice}
                </li>
              ))}
            </ul>
          </motion.div>

          <ProjectorScoreboard standings={standings.slice(0, 12)} />
        </div>
      </Screen>
    );
  }

  // ── reveal ────────────────────────────────────────────────────────────
  if (phase === 'reveal' && caseDef && currentQ) {
    return (
      <Screen code={code}>
        <div className="flex min-h-screen flex-col gap-8 p-8 lg:p-12">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/15 px-5 py-2 font-display text-lg font-bold text-emerald-300">
              <Icon name="checkCircle" className="h-5 w-5" />
              {t('acase.proj.revealTitle')}
            </span>
            <span className="text-lg font-semibold text-white/50">
              {t('acase.proj.questionBadge', { n: String(qIndex + 1), total: String(total) })}
            </span>
          </div>

          <p className="font-display text-3xl font-extrabold leading-snug tracking-tight text-white/80 lg:text-5xl">
            {currentQ.prompt}
          </p>

          {/* Choices — correct one highlighted */}
          <ul className="grid gap-4 sm:grid-cols-2">
            {currentQ.choices.map((choice, i) => {
              const isCorrect = revealCorrect === i;
              return (
                <motion.li
                  key={i}
                  initial={reducedMotion ? false : { opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: reducedMotion ? 0 : (isCorrect ? 0 : 0.08 * i), duration: 0.2 }}
                  className={`flex items-center gap-4 rounded-2xl border px-6 py-5 text-2xl font-semibold ${
                    isCorrect
                      ? 'border-emerald-400/60 bg-emerald-400/15 font-bold text-white ring-2 ring-emerald-400/40'
                      : 'border-white/10 bg-white/5 text-white/40'
                  }`}
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg font-display text-lg font-bold ${isCorrect ? 'bg-emerald-400 text-emerald-950' : 'bg-white/10 text-white/50'}`}>
                    {isCorrect ? <Icon name="check" className="h-6 w-6" /> : String.fromCharCode(65 + i)}
                  </span>
                  {choice}
                </motion.li>
              );
            })}
          </ul>

          <ProjectorScoreboard standings={standings.slice(0, 12)} />
        </div>
      </Screen>
    );
  }

  // ── ended ─────────────────────────────────────────────────────────────
  if (phase === 'ended') {
    const winner = [...standings].sort((a, b) => b.score - a.score)[0];
    return (
      <Screen code={code}>
        <div className="relative flex min-h-screen flex-col items-center justify-center gap-10 overflow-hidden p-8">
          {/* Simple confetti - respects reduced motion */}
          {!reducedMotion && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
              {Array.from({ length: 30 }, (_, i) => (
                <motion.span
                  key={i}
                  className="absolute top-0 h-3 w-3 rounded-sm"
                  style={{
                    left: `${Math.random() * 100}%`,
                    background: ['#5B8DEF', '#F5B428', '#34C778', '#56B0F0', '#F58C32'][i % 5],
                  }}
                  initial={{ y: -20, opacity: 1, rotate: 0 }}
                  animate={{ y: '105vh', rotate: Math.random() * 360, opacity: [1, 1, 0] }}
                  transition={{ duration: 2 + Math.random(), delay: Math.random() * 0.5 }}
                />
              ))}
            </div>
          )}

          <p className="font-display text-2xl font-bold uppercase tracking-[0.2em] text-white/50">
            {t('acase.proj.endedTitle')}
          </p>

          {winner && (
            <motion.div
              initial={reducedMotion ? false : { scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="rounded-2xl border border-amber-300/40 bg-amber-300/10 px-14 py-10 text-center"
            >
              <span className="mx-auto grid h-20 w-20 place-items-center rounded-2xl bg-amber-300/20 text-amber-300">
                <Icon name="trophy" className="h-10 w-10" />
              </span>
              <p className="mt-5 font-display text-xl font-bold uppercase tracking-[0.15em] text-amber-300">
                {t('acase.proj.winner')}
              </p>
              <p className="mt-2 font-display text-6xl font-extrabold tracking-tight text-white">{winner.name}</p>
              <p className="mt-2 font-display text-3xl font-bold text-amber-300">{winner.score} ball</p>
            </motion.div>
          )}

          <div className="w-full max-w-3xl">
            <p className="mb-4 text-center font-display text-base font-bold uppercase tracking-[0.2em] text-white/50">
              {t('acase.proj.finalStandings')}
            </p>
            <ProjectorScoreboard standings={standings.slice(0, 12)} />
          </div>
        </div>
      </Screen>
    );
  }

  return null;
}

// ── helpers ───────────────────────────────────────────────────────────────────

/** Always-dark projection wrapper (independent of the app colour scheme). */
function Screen({ children, code }: { children: React.ReactNode; code: string }) {
  return (
    <div className="min-h-screen bg-[#0B111C] text-white" style={{ colorScheme: 'dark' }}>
      <div className="grid-bg pointer-events-none fixed inset-0 opacity-[0.08]" aria-hidden />
      <div className="pointer-events-none fixed left-6 top-5 z-10 flex items-center gap-2 text-sm font-bold text-white/35">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-white/10 text-white/70">
          <Icon name="binary" className="h-3.5 w-3.5" />
        </span>
        KidsCode Quest
        <span className="ml-2 font-mono tracking-[0.2em] text-white/50">{code}</span>
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}

/** Compact scoreboard styled for the dark projector background */
function ProjectorScoreboard({ standings }: { standings: Standing[] }) {
  const ranked = [...standings].sort((a, b) => b.score - a.score);
  if (ranked.length === 0) return null;
  return (
    <ol className="flex flex-wrap justify-center gap-3">
      {ranked.map((s, i) => (
        <li
          key={s.id}
          className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-lg font-bold ${
            i === 0
              ? 'border-amber-300/40 bg-amber-300/15 text-amber-200'
              : i < 3
                ? 'border-white/15 bg-white/10 text-white'
                : 'border-white/10 bg-white/5 text-white/75'
          }`}
        >
          <span className={`grid h-7 w-7 place-items-center rounded-md font-display text-sm tabular-nums ${i === 0 ? 'bg-amber-300 text-amber-950' : 'bg-white/10 text-white/60'}`}>
            {i + 1}
          </span>
          <span className="max-w-[12rem] truncate">{s.name}</span>
          <span className="font-display tabular-nums">{s.score}</span>
        </li>
      ))}
    </ol>
  );
}
