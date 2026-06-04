'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameProps } from './GameProps';

/**
 * TRAIN THE ROBOT — AI City's flagship. The child is the teacher: first they
 * label a few examples (supervised learning), then the robot starts predicting.
 * When it meets something new it guesses, and the child corrects it — and it
 * gets smarter. A genuine, tactile intro to how machines learn from examples.
 */

type Cat = 'nature' | 'tech';
interface Item { emoji: string; type: string; cat: Cat }

const DECK: Item[] = [
  // taught first (4)
  { emoji: '🍎', type: 'fruit', cat: 'nature' },
  { emoji: '⚙️', type: 'gear', cat: 'tech' },
  { emoji: '🍌', type: 'fruit', cat: 'nature' },
  { emoji: '🔋', type: 'gear', cat: 'tech' },
  // predicted (robot guesses; new types appear → it must be corrected, then learns)
  { emoji: '🍓', type: 'fruit', cat: 'nature' },
  { emoji: '🤖', type: 'gear', cat: 'tech' },
  { emoji: '🐱', type: 'animal', cat: 'nature' }, // NEW → robot unsure
  { emoji: '🖱️', type: 'gear', cat: 'tech' },
  { emoji: '🐶', type: 'animal', cat: 'nature' }, // learned from the cat correction
  { emoji: '🌻', type: 'plant', cat: 'nature' },  // NEW
  { emoji: '💾', type: 'gear', cat: 'tech' },
  { emoji: '🐰', type: 'animal', cat: 'nature' },
];

const TEACH = 4;
const BIN: Record<Cat, { label: string; emoji: string; ring: string; bg: string }> = {
  nature: { label: 'Tabiat', emoji: '🌿', ring: 'ring-mint', bg: 'bg-mint/15' },
  tech: { label: 'Texnika', emoji: '🔧', ring: 'ring-sky', bg: 'bg-sky/15' },
};

export function TrainRobot({ onWin }: GameProps) {
  const deck = useMemo(() => DECK, []);
  const [i, setI] = useState(0);
  const [model, setModel] = useState<Record<string, Cat>>({});
  const [robotRight, setRobotRight] = useState(0);
  const [predicted, setPredicted] = useState(0);
  const [feedback, setFeedback] = useState<null | { ok: boolean; cat: Cat }>(null);
  const [phaseGuess, setPhaseGuess] = useState<Cat | null>(null);

  const item = deck[i];
  const teaching = i < TEACH;
  const learnedPct = Math.round((Object.keys(model).length / 4) * 100); // ~4 distinct types

  // ── teaching: child sorts the example ──
  const teach = (cat: Cat) => {
    const correct = cat === item.cat;
    setModel((m) => ({ ...m, [item.type]: item.cat })); // learn the TRUE label
    setFeedback({ ok: correct, cat: item.cat });
    setTimeout(next, 900);
  };

  // ── predicting: robot guesses, child confirms / corrects ──
  const robotGuess = (): Cat => model[item.type] ?? (Math.random() < 0.5 ? 'nature' : 'tech');
  const startPredict = () => setPhaseGuess(robotGuess());

  const judge = (childSaysCorrect: boolean) => {
    const guess = phaseGuess!;
    const wasRight = guess === item.cat;
    setPredicted((p) => p + 1);
    if (wasRight) setRobotRight((r) => r + 1);
    if (!wasRight) setModel((m) => ({ ...m, [item.type]: item.cat })); // correction → learns
    else setModel((m) => ({ ...m, [item.type]: item.cat }));
    setFeedback({ ok: wasRight, cat: item.cat });
    setPhaseGuess(null);
    void childSaysCorrect;
    setTimeout(next, 1000);
  };

  const next = () => {
    setFeedback(null);
    setI((v) => {
      const nx = v + 1;
      if (nx >= deck.length) {
        const acc = predicted ? robotRight / predicted : 0;
        const stars = acc >= 0.85 ? 3 : acc >= 0.6 ? 2 : 1;
        setTimeout(() => onWin(stars), 50);
        return v;
      }
      return nx;
    });
  };

  const done = i >= deck.length - 1 && feedback === null && !phaseGuess && !teaching && predicted >= deck.length - TEACH;

  return (
    <div className="overflow-hidden rounded-xl2 bg-gradient-to-br from-[#efe7ff] to-[#e0d4ff] p-4 shadow-card">
      {/* brain meter */}
      <div className="mb-3 flex items-center gap-3">
        <span className="text-2xl">🧠</span>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/70">
          <motion.div animate={{ width: `${Math.min(100, learnedPct)}%` }} transition={{ type: 'spring', stiffness: 120, damping: 18 }}
            className="h-full rounded-full bg-gradient-to-r from-grape to-bubble" />
        </div>
        <span className="chip bg-white/70 text-grape">{teaching ? `📘 ${i + 1}/${TEACH}` : `🎯 ${robotRight}/${predicted || 0}`}</span>
      </div>

      {/* robot + item */}
      <div className="relative grid place-items-center rounded-2xl bg-white/70 py-6">
        <motion.div animate={feedback ? (feedback.ok ? { y: [0, -8, 0] } : { rotate: [0, -8, 8, 0] }) : { y: [0, -4, 0] }}
          transition={{ duration: feedback ? 0.5 : 2, repeat: feedback ? 0 : Infinity }} className="text-5xl">
          {feedback ? (feedback.ok ? '🤖' : '😵‍💫') : '🤖'}
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div key={i + (phaseGuess ?? '') + (feedback ? 'f' : '')} initial={{ scale: 0, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0 }}
            className="mt-2 grid h-20 w-20 place-items-center rounded-2xl bg-white text-5xl shadow-card">
            {item.emoji}
          </motion.div>
        </AnimatePresence>

        <p className="mt-3 h-5 text-sm font-bold">
          {feedback ? (
            <span className={feedback.ok ? 'text-mint-600' : 'text-bubble-600'}>
              {feedback.ok ? '✅ To‘g‘ri!' : `💡 Bu — ${BIN[feedback.cat].emoji} ${BIN[feedback.cat].label}`}
            </span>
          ) : phaseGuess ? (
            <span className="text-grape">🤖 Robot o‘yladi: <b>{BIN[phaseGuess].emoji} {BIN[phaseGuess].label}</b>?</span>
          ) : teaching ? (
            <span className="text-ink-soft">Buni qaysi qutiga qo‘yamiz?</span>
          ) : (
            <span className="text-ink-soft">Robotga taxmin qildiraylik…</span>
          )}
        </p>
      </div>

      {/* controls */}
      <div className="mt-4">
        {teaching && !feedback && (
          <div className="grid grid-cols-2 gap-3">
            {(['nature', 'tech'] as const).map((c) => (
              <button key={c} onClick={() => teach(c)}
                className={`flex flex-col items-center gap-1 rounded-2xl py-4 font-display font-extrabold shadow-card ring-2 transition active:scale-95 ${BIN[c].bg} ${BIN[c].ring}`}>
                <span className="text-3xl">{BIN[c].emoji}</span>{BIN[c].label}
              </button>
            ))}
          </div>
        )}

        {!teaching && !feedback && !phaseGuess && (
          <button onClick={startPredict} className="btn-primary w-full text-lg">🤔 Robot taxmin qilsin</button>
        )}

        {!teaching && phaseGuess && (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => judge(true)} className="rounded-2xl bg-mint/20 py-4 font-display font-extrabold text-mint-600 shadow-card ring-2 ring-mint transition active:scale-95">✅ To‘g‘ri</button>
            <button onClick={() => judge(false)} className="rounded-2xl bg-bubble/15 py-4 font-display font-extrabold text-bubble-600 shadow-card ring-2 ring-bubble transition active:scale-95">❌ Xato — to‘g‘rila</button>
          </div>
        )}
      </div>

      <p className="mt-3 text-center text-[11px] text-ink-faint">
        {teaching ? '📘 Robotni misollar bilan o‘rgatyapsiz (supervised learning).' : '🎯 Robot o‘rgangani sayin aniqroq taxmin qiladi!'}
      </p>
    </div>
  );
}
