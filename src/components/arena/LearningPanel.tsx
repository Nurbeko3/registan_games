'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CATEGORY_META, type LearnState, type PreparedQuestion } from '@/lib/arena/types';
import { Confetti } from '@/components/ui/Confetti';
import { useT } from '@/lib/i18n';
import { QuestionRenderer } from './QuestionRenderer';

const DIFF_STYLE: Record<string, string> = {
  easy: 'bg-mint/20 text-mint-600',
  medium: 'bg-sun/30 text-mango-600',
  hard: 'bg-bubble/20 text-bubble-600',
};

function correctAnswer(prepared: PreparedQuestion): string {
  const { q } = prepared;
  switch (q.type) {
    case 'mcq':
    case 'code-fill':
    case 'truefalse':
      return prepared.correctIndex === undefined ? '' : prepared.options?.[prepared.correctIndex] ?? '';
    case 'debug':
      return q.lines[q.buggyLine] ?? '';
    case 'binary':
      return String(q.target);
    case 'order':
      return q.blocks.join(' → ');
  }
}

/** The LEARNING POD: shown over a blurred battlefield when the hero is tagged out.
 *  Answer right → respawn + rewards. Answer wrong → a friendly tip + a short
 *  charge-up, then a brand-new question. There is no losing here, only learning. */
export function LearningPanel({
  prepared,
  learnState,
  lastReward,
  cooldownMs,
  onAnswer,
  onLeave,
}: {
  prepared: PreparedQuestion;
  learnState: LearnState;
  lastReward: { xp: number; coins: number } | null;
  cooldownMs: number;
  onAnswer: (response: number | string[]) => void;
  onLeave: () => void;
}) {
  const t = useT();
  const { q } = prepared;
  const cat = CATEGORY_META[q.category];
  const catLabel = q.category === 'hardware' ? t('arena.cat.hardware') : cat.label;

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ scale: 0.8, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 20 }}
        className="card relative w-full max-w-2xl overflow-hidden p-7"
      >
        {/* playful pod header */}
        <div className="-mx-7 -mt-7 mb-6 flex items-center justify-between bg-gradient-to-r from-grape to-bubble px-6 py-4 text-white">
          <span className="font-display text-lg font-extrabold uppercase tracking-wide">{t('arena.learn.pod')}</span>
          <div className="flex items-center gap-2">
            <span className="chip bg-white/20 text-white">{cat.emoji} {catLabel}</span>
            <button
              onClick={onLeave}
              className="rounded-full bg-white/20 px-3 py-1 text-xs font-extrabold text-white transition hover:bg-white/30"
            >
              ← {t('hud.leave')}
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* ── ANSWERING ── */}
          {learnState === 'answering' && (
            <motion.div key="ask" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="mb-4 flex items-center justify-between">
                <span className={`chip ${DIFF_STYLE[q.difficulty]}`}>{t(`diff.${q.difficulty}`)}</span>
                <span className="text-base font-bold text-ink-faint">{t('arena.learn.answer')}</span>
              </div>
              <div className="mb-5 text-center">
                <div className="text-5xl">{q.emoji}</div>
                <p className="mt-3 font-display text-3xl font-extrabold leading-tight">{q.prompt}</p>
              </div>
              <QuestionRenderer prepared={prepared} onAnswer={onAnswer} />
            </motion.div>
          )}

          {/* ── CORRECT → respawning ── */}
          {learnState === 'correct' && (
            <motion.div key="ok" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-4 text-center">
              <Confetti />
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }} className="text-6xl">
                🎉
              </motion.div>
              <p className="mt-2 font-display text-2xl font-extrabold text-mint-600">{t('arena.learn.correct')}</p>
              <p className="text-ink-soft">{t('arena.learn.respawning')}</p>
              {lastReward && (
                <div className="mt-3 flex justify-center gap-2">
                  <span className="chip bg-sun/30 text-ink">⚡ +{lastReward.xp} XP</span>
                  <span className="chip bg-mango/20 text-ink">💰 +{lastReward.coins}</span>
                </div>
              )}
            </motion.div>
          )}

          {/* ── WRONG → gentle tip + charge-up, then a new question ── */}
          {learnState === 'wrong-cooldown' && (
            <motion.div key="learn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-2 text-center">
              <div className="text-6xl">💡</div>
              <p className="mt-2 font-display text-2xl font-extrabold text-grape">{t('arena.learn.almost')}</p>
              <p className="mt-4 text-sm font-bold uppercase tracking-wide text-ink-faint">{t('arena.learn.correctAnswer')}</p>
              <p className="mt-2 rounded-2xl bg-mint/15 p-4 font-display text-2xl font-extrabold text-mint-700">{correctAnswer(prepared)}</p>
              <p className="mt-4 text-sm font-bold text-ink-faint">{t('arena.learn.fresh')}</p>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-grape-100">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: cooldownMs / 1000, ease: 'linear' }}
                  className="h-full bg-gradient-to-r from-grape to-bubble"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
