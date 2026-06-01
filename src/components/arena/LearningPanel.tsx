'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CATEGORY_META, type LearnState, type PreparedQuestion } from '@/lib/arena/types';
import { Confetti } from '@/components/ui/Confetti';
import { QuestionRenderer } from './QuestionRenderer';

const DIFF_STYLE: Record<string, string> = {
  easy: 'bg-mint/20 text-mint-600',
  medium: 'bg-sun/30 text-mango-600',
  hard: 'bg-bubble/20 text-bubble-600',
};

/** The LEARNING POD: shown over a blurred battlefield when the hero is tagged out.
 *  Answer right → respawn + rewards. Answer wrong → a friendly tip + a short
 *  charge-up, then a brand-new question. There is no losing here, only learning. */
export function LearningPanel({
  prepared,
  learnState,
  lastReward,
  cooldownMs,
  onAnswer,
}: {
  prepared: PreparedQuestion;
  learnState: LearnState;
  lastReward: { xp: number; coins: number } | null;
  cooldownMs: number;
  onAnswer: (response: number | string[]) => void;
}) {
  const { q } = prepared;
  const cat = CATEGORY_META[q.category];

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
        className="card relative w-full max-w-md overflow-hidden"
      >
        {/* playful pod header */}
        <div className="-mx-6 -mt-6 mb-4 flex items-center justify-between bg-gradient-to-r from-grape to-bubble px-5 py-3 text-white">
          <span className="font-display text-sm font-extrabold uppercase tracking-wide">🛟 Learning Pod</span>
          <span className="chip bg-white/20 text-white">{cat.emoji} {cat.label}</span>
        </div>

        <AnimatePresence mode="wait">
          {/* ── ANSWERING ── */}
          {learnState === 'answering' && (
            <motion.div key="ask" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="mb-3 flex items-center justify-between">
                <span className={`chip ${DIFF_STYLE[q.difficulty]}`}>{q.difficulty}</span>
                <span className="text-sm font-bold text-ink-faint">Answer to respawn ⚡</span>
              </div>
              <div className="mb-4 text-center">
                <div className="text-4xl">{q.emoji}</div>
                <p className="mt-2 font-display text-lg font-extrabold leading-snug">{q.prompt}</p>
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
              <p className="mt-2 font-display text-2xl font-extrabold text-mint-600">Correct!</p>
              <p className="text-ink-soft">Respawning you now…</p>
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
              <div className="text-5xl">💡</div>
              <p className="mt-2 font-display text-lg font-extrabold text-grape">Almost — here's the trick!</p>
              <p className="mt-2 rounded-2xl bg-grape-50 p-3 text-sm font-semibold text-ink-soft">{q.explain}</p>
              <p className="mt-4 text-sm font-bold text-ink-faint">Charging your respawn pod…</p>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-grape-100">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: cooldownMs / 1000, ease: 'linear' }}
                  className="h-full bg-gradient-to-r from-grape to-bubble"
                />
              </div>
              <p className="mt-2 text-xs text-ink-faint">A fresh question is on the way — you've got this! 💪</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
