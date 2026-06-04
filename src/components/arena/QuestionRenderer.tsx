'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useT } from '@/lib/i18n';
import type { PreparedQuestion } from '@/lib/arena/types';

/** Renders any of the six BATTLE LEARN ARENA question types and reports the
 *  player's response back up. The parent (LearningPanel) decides what happens
 *  next — this component is purely the interaction surface. */
export function QuestionRenderer({
  prepared,
  onAnswer,
}: {
  prepared: PreparedQuestion;
  onAnswer: (response: number | string[]) => void;
}) {
  const t = useT();
  const { q } = prepared;

  // reset any internal assembly state whenever a fresh question appears
  const [order, setOrder] = useState<string[]>([]);
  const [bits, setBits] = useState<boolean[]>([false, false, false, false, false]);
  useEffect(() => {
    setOrder([]);
    setBits([false, false, false, false, false]);
  }, [prepared]);

  // ── tap-one-option types: mcq / code-fill / truefalse ──
  if ((q.type === 'mcq' || q.type === 'code-fill' || q.type === 'truefalse') && prepared.options) {
    return (
      <div>
        {q.type === 'code-fill' && (
          <pre className="mb-3 overflow-x-auto rounded-2xl bg-ink p-3 text-left font-mono text-sm leading-relaxed text-mint">
            {q.code.replace('___', '⬜')}
          </pre>
        )}
        <div className="grid gap-2">
          {prepared.options.map((opt, i) => (
            <motion.button
              key={i}
              whileTap={{ scale: 0.97 }}
              onClick={() => onAnswer(i)}
              className="rounded-2xl bg-white p-3 text-center font-display font-extrabold shadow-card hover:bg-grape-50"
            >
              {opt}
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  // ── debug: tap the buggy line ──
  if (q.type === 'debug') {
    return (
      <div className="grid gap-2 text-left">
        {q.lines.map((line, i) => (
          <motion.button
            key={i}
            whileTap={{ scale: 0.98 }}
            onClick={() => onAnswer(i)}
            className="flex items-center gap-2 rounded-2xl bg-ink p-3 font-mono text-sm text-cloud hover:ring-2 hover:ring-bubble"
          >
            <span className="text-ink-faint">{i + 1}</span>
            <span>{line}</span>
          </motion.button>
        ))}
      </div>
    );
  }

  // ── order: tap blocks into the right sequence, then Check ──
  if (q.type === 'order' && prepared.shuffledBlocks) {
    const remaining = prepared.shuffledBlocks.filter((b) => !order.includes(b));
    return (
      <div>
        <div className="min-h-[3rem] rounded-2xl border-2 border-dashed border-grape-100 p-2">
          {order.length === 0 ? (
            <p className="py-2 text-sm font-bold text-ink-faint">{t('arena.q.tap')}</p>
          ) : (
            <ol className="flex flex-wrap gap-2">
              {order.map((b, i) => (
                <li key={b} className="chip bg-grape text-white">
                  <span className="opacity-70">{i + 1}.</span> {b}
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {remaining.map((b) => (
            <motion.button
              key={b}
              whileTap={{ scale: 0.95 }}
              onClick={() => setOrder((o) => [...o, b])}
              className="rounded-2xl bg-white px-3 py-2 font-bold shadow-card hover:bg-grape-50"
            >
              {b}
            </motion.button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={() => setOrder([])} className="btn-ghost flex-1 py-2 text-sm">{t('arena.q.reset')}</button>
          <button
            onClick={() => onAnswer(order)}
            disabled={remaining.length > 0}
            className="btn-primary flex-1 py-2 text-sm disabled:opacity-40"
          >
            {t('arena.q.check')}
          </button>
        </div>
      </div>
    );
  }

  // ── binary: flip 5 bits to match the target, then Check ──
  if (q.type === 'binary') {
    const BITS = [16, 8, 4, 2, 1];
    const value = bits.reduce((sum, on, i) => sum + (on ? BITS[i] : 0), 0);
    return (
      <div className="text-center">
        <p className="font-display text-4xl font-extrabold text-grape">{q.target}</p>
        <div className="mt-3 flex justify-center gap-2">
          {BITS.map((bit, i) => (
            <button
              key={bit}
              onClick={() => setBits((b) => b.map((v, idx) => (idx === i ? !v : v)))}
              className={`grid h-14 w-12 place-items-center rounded-2xl font-display text-xl font-extrabold shadow-card transition ${
                bits[i] ? 'bg-grape text-white' : 'bg-white text-ink-faint'
              }`}
            >
              {bits[i] ? 1 : 0}
              <span className="mt-0.5 block text-[9px] font-bold opacity-70">{bit}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 font-bold">{t('arena.q.your')} <span className={value === q.target ? 'text-mint-600' : 'text-bubble-600'}>{value}</span></p>
        <button onClick={() => onAnswer(value)} className="btn-primary mt-3 w-full py-2 text-sm">{t('arena.q.check')}</button>
      </div>
    );
  }

  return null;
}
