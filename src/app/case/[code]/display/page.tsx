'use client';

import { use } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCaseRoom } from '@/lib/caseFiles/useCaseRoom';
import { useT } from '@/lib/i18n';
import { useGame } from '@/store/useGame';
import { Scoreboard, type Standing } from '@/components/case/Scoreboard';

interface Props {
  params: Promise<{ code: string }>;
}

/**
 * Projector / big-screen read-only display for a classroom tournament.
 * PUBLIC — no admin gate. Uses spectator:true so it never appears in the roster.
 * Designed for projection: min-h-screen dark background, huge text, high contrast.
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

  const standings: Standing[] = players.map((p, i) => ({
    id: p.id,
    name: p.name,
    emoji: i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🧑',
    score: p.score,
  }));

  const currentQ = caseDef?.questions[qIndex] ?? null;

  // ── connecting ──────────────────────────────────────────────────────
  if (phase === 'connecting') {
    return (
      <Screen>
        <div className="grid min-h-screen place-items-center">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-white/20 border-t-white" />
        </div>
      </Screen>
    );
  }

  // ── error ───────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <Screen>
        <div className="grid min-h-screen place-items-center p-8">
          <div className="rounded-3xl bg-white/10 p-10 text-center">
            <p className="text-6xl">📡</p>
            <p className="mt-4 font-display text-3xl font-extrabold text-white">
              Xonaga ulanib bo'lmadi
            </p>
            <p className="mt-2 text-white/70">
              Kod: <strong className="font-mono tracking-widest">{code}</strong>
            </p>
          </div>
        </div>
      </Screen>
    );
  }

  // ── lobby ───────────────────────────────────────────────────────────
  if (phase === 'lobby') {
    return (
      <Screen>
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
          <p className="font-display text-xl font-extrabold uppercase tracking-widest text-white/60">
            {t('acase.proj.lobbyTitle')}
          </p>

          {/* Giant room code */}
          <motion.div
            initial={reducedMotion ? false : { scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-3xl bg-white/10 px-12 py-8 text-center backdrop-blur-sm"
          >
            <p className="font-display text-lg font-extrabold uppercase tracking-widest text-white/60">
              {t('acase.proj.joinAt')}{' '}
              <span className="text-sun">{t('acase.proj.caseFiles')}</span>,{' '}
              {t('acase.proj.thenEnter')}
            </p>
            <p className="mt-4 font-display text-9xl font-extrabold tracking-[0.2em] text-white">
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
              className="font-display text-2xl font-extrabold text-white/80"
            >
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
      <Screen>
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
          <p className="font-display text-sm font-extrabold uppercase tracking-widest text-white/50">
            {t('acase.proj.investigateTitle')}
          </p>
          <h1 className="font-display text-6xl font-extrabold text-white max-w-3xl leading-tight">
            {caseDef.title}
          </h1>
          <p className="max-w-2xl text-xl text-white/80 leading-relaxed">
            {caseDef.briefing}
          </p>
          <p className="mt-4 rounded-2xl bg-white/10 px-6 py-3 text-lg font-bold text-white/70">
            {t('acase.proj.investigateSub')}
          </p>
        </div>
      </Screen>
    );
  }

  // ── question ─────────────────────────────────────────────────────────
  if (phase === 'question' && caseDef && currentQ) {
    return (
      <Screen>
        <div className="flex min-h-screen flex-col gap-6 p-8">
          {/* Badge */}
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-white/20 px-4 py-1.5 font-display text-sm font-extrabold text-white">
              {t('acase.proj.questionBadge', { n: String(qIndex + 1), total: String(total) })}
            </span>
            <span className="font-bold text-white/50">
              {players.length} ta o'quvchi
            </span>
          </div>

          {/* Question prompt */}
          <motion.div
            key={qIndex}
            initial={reducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col justify-center"
          >
            <p className="font-display text-4xl font-extrabold leading-snug text-white lg:text-5xl">
              {currentQ.prompt}
            </p>

            {/* Choices — shown but NOT highlighted */}
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {currentQ.choices.map((choice, i) => (
                <li
                  key={i}
                  className="rounded-2xl bg-white/10 px-6 py-4 font-semibold text-white/80 text-lg"
                >
                  <span className="mr-2 font-extrabold text-white/50">
                    {String.fromCharCode(65 + i)}.
                  </span>
                  {choice}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Scoreboard — capped at 12 */}
          <div className="mt-4">
            <ProjectorScoreboard standings={standings.slice(0, 12)} />
          </div>
        </div>
      </Screen>
    );
  }

  // ── reveal ────────────────────────────────────────────────────────────
  if (phase === 'reveal' && caseDef && currentQ) {
    return (
      <Screen>
        <div className="flex min-h-screen flex-col gap-6 p-8">
          {/* Badge */}
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-mint/30 px-4 py-1.5 font-display text-sm font-extrabold text-mint-300">
              {t('acase.proj.revealTitle')}
            </span>
            <span className="font-bold text-white/50">
              {t('acase.proj.questionBadge', { n: String(qIndex + 1), total: String(total) })}
            </span>
          </div>

          {/* Question prompt */}
          <p className="font-display text-3xl font-extrabold leading-snug text-white/80 lg:text-4xl">
            {currentQ.prompt}
          </p>

          {/* Choices — correct one highlighted */}
          <ul className="grid gap-3 sm:grid-cols-2">
            {currentQ.choices.map((choice, i) => {
              const isCorrect = revealCorrect === i;
              return (
                <motion.li
                  key={i}
                  initial={reducedMotion ? false : { opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: reducedMotion ? 0 : (isCorrect ? 0 : 0.1 * i), duration: 0.2 }}
                  className={`rounded-2xl px-6 py-4 text-lg font-semibold transition
                    ${isCorrect
                      ? 'bg-mint/30 ring-2 ring-mint text-white font-extrabold'
                      : 'bg-white/10 text-white/50'
                    }`}
                >
                  <span className="mr-2 font-extrabold" aria-hidden={!isCorrect}>
                    {isCorrect ? '✓' : String.fromCharCode(65 + i) + '.'}
                  </span>
                  {choice}
                </motion.li>
              );
            })}
          </ul>

          {/* Scoreboard */}
          <div className="mt-2">
            <ProjectorScoreboard standings={standings.slice(0, 12)} />
          </div>
        </div>
      </Screen>
    );
  }

  // ── ended ─────────────────────────────────────────────────────────────
  if (phase === 'ended') {
    const winner = standings[0];
    return (
      <Screen>
        <div className="relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden p-8">
          {/* Simple confetti - CSS only, respects reduced motion */}
          {!reducedMotion && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
              {Array.from({ length: 30 }, (_, i) => (
                <motion.span
                  key={i}
                  className="absolute top-0 h-3 w-3 rounded-sm"
                  style={{
                    left: `${Math.random() * 100}%`,
                    background: ['#7C5CFC', '#FF9F43', '#22C55E', '#FFD43B', '#FF7AB6'][i % 5],
                  }}
                  initial={{ y: -20, opacity: 1, rotate: 0 }}
                  animate={{ y: '105vh', rotate: Math.random() * 360, opacity: [1, 1, 0] }}
                  transition={{ duration: 2 + Math.random(), delay: Math.random() * 0.5 }}
                />
              ))}
            </div>
          )}

          <p className="font-display text-2xl font-extrabold uppercase tracking-widest text-white/60">
            {t('acase.proj.endedTitle')}
          </p>

          {winner && (
            <motion.div
              initial={reducedMotion ? false : { scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="rounded-3xl bg-sun/30 px-10 py-8 text-center ring-2 ring-sun"
            >
              <p className="text-5xl">🏆</p>
              <p className="mt-2 font-display text-xl font-extrabold uppercase tracking-wide text-sun">
                {t('acase.proj.winner')}
              </p>
              <p className="mt-1 font-display text-5xl font-extrabold text-white">
                {winner.name}
              </p>
              <p className="font-display text-2xl font-extrabold text-sun">
                {winner.score} ball
              </p>
            </motion.div>
          )}

          <div className="w-full max-w-xl">
            <p className="mb-3 font-display text-xs font-extrabold uppercase tracking-widest text-white/50 text-center">
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

/** Dark projection-optimised wrapper */
function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d0d1a] to-[#1a0d2e]">
      {children}
    </div>
  );
}

/** Compact scoreboard styled for the dark projector background */
function ProjectorScoreboard({ standings }: { standings: Standing[] }) {
  const ranked = [...standings].sort((a, b) => b.score - a.score);
  return (
    <ol className="flex flex-wrap gap-2">
      {ranked.map((s, i) => (
        <li
          key={s.id}
          className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-bold
            ${i === 0 ? 'bg-sun/30 text-sun' : 'bg-white/10 text-white/80'}`}
        >
          <span className="w-4 text-center font-extrabold text-white/40">{i + 1}</span>
          <span>{s.emoji}</span>
          <span className="max-w-[9rem] truncate">{s.name}</span>
          <span className="ml-1 font-extrabold">{s.score}</span>
        </li>
      ))}
    </ol>
  );
}
