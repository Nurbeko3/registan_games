'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/ui/Icon';
import type { GameProps } from './GameProps';

/**
 * OUTPUT ORACLE — Python Planet's finale. A space-themed, timed "what will it
 * print?" gauntlet with a combo chain. Mixes everything a Code Hero has learned;
 * the rocket climbs with each streak. Champions only!
 */

interface Q { code: string[]; options: string[]; answer: number }
const POOL: Q[] = [
  { code: ['nums = [1, 2, 3]', 'print(sum(nums))'], options: ['6', '123', '3'], answer: 0 },
  { code: ['s = "hi"', 'print(s * 3)'], options: ['hihihi', 'hi3', '9'], answer: 0 },
  { code: ['print(len("python"))'], options: ['6', '5', 'python'], answer: 0 },
  { code: ['x = 7', 'print(x % 3)'], options: ['1', '2', '0'], answer: 0 },
  { code: ['print([i*i for i in range(3)])'], options: ['[0, 1, 4]', '[1, 4, 9]', '[0, 1, 2]'], answer: 0 },
  { code: ['d = {"a": 1, "b": 2}', 'print(d["b"])'], options: ['2', '1', 'b'], answer: 0 },
  { code: ['print("a,b,c".split(",")[1])'], options: ['b', 'a', 'c'], answer: 0 },
  { code: ['n = 5', 'print(n if n > 3 else 0)'], options: ['5', '0', 'True'], answer: 0 },
  { code: ['print(2 ** 4)'], options: ['16', '8', '24'], answer: 0 },
  { code: ['print("HELLO".lower())'], options: ['hello', 'HELLO', 'Hello'], answer: 0 },
  { code: ['t = 0', 'for i in range(4):', '    t += i', 'print(t)'], options: ['6', '4', '10'], answer: 0 },
  { code: ['print(list(range(2, 5)))'], options: ['[2, 3, 4]', '[2, 3, 4, 5]', '[2, 5]'], answer: 0 },
];

const LIMIT = 9000;
const COUNT = 8;

// shuffle the option order so the answer isn't always first
function prep(q: Q): Q {
  const idx = q.options.map((_, i) => i).sort(() => Math.random() - 0.5);
  return { code: q.code, options: idx.map((i) => q.options[i]), answer: idx.indexOf(q.answer) };
}

export function OutputOracle({ onWin }: GameProps) {
  const quiz = useMemo(() => [...POOL].sort(() => Math.random() - 0.5).slice(0, COUNT).map(prep), []);
  const [qi, setQi] = useState(0);
  const [phase, setPhase] = useState<'play' | 'reveal'>('play');
  const [picked, setPicked] = useState<number | null>(null);
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState(0);
  const [correct, setCorrect] = useState(0);

  const q = quiz[qi];

  useEffect(() => {
    if (phase !== 'play') return;
    const id = setTimeout(() => handle(-1), LIMIT);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qi, phase]);

  const handle = (i: number) => {
    setPhase((p) => {
      if (p !== 'play') return p;
      const ok = i === q.answer;
      setPicked(i);
      if (ok) { setCorrect((c) => c + 1); setCombo((c) => { const n = c + 1; setBest((b) => Math.max(b, n)); return n; }); }
      else setCombo(0);
      setTimeout(() => {
        if (qi < quiz.length - 1) { setQi((v) => v + 1); setPicked(null); setPhase('play'); }
        else {
          const acc = (correct + (ok ? 1 : 0)) / quiz.length;
          const stars = acc >= 0.85 ? 3 : acc >= 0.55 ? 2 : 1;
          setTimeout(() => onWin(stars), 40);
        }
      }, 1050);
      return 'reveal';
    });
  };

  const rocket = Math.min(1, combo / 5);
  const starfield = useMemo(() => Array.from({ length: 16 }, (_, i) => (
    <span key={i} className="pointer-events-none absolute text-white/25"
      style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, fontSize: i % 3 ? 8 : 12 }} aria-hidden>✦</span>
  )), []);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-fg p-4 text-white shadow-sm dark:bg-bg-subtle">
      {starfield}

      <div className="relative mb-3 flex items-center justify-between gap-2">
        <span className="chip bg-white/10 text-white/90 ring-white/10 tabular-nums"><Icon name="planet" className="h-3.5 w-3.5" /> {qi + 1}/{quiz.length}</span>
        <span className={`chip ring-white/10 tabular-nums ${combo >= 2 ? 'bg-amber-400/25 text-amber-200' : 'bg-white/10 text-white/70'}`}>
          <Icon name="flame" className="h-3.5 w-3.5" /> Kombo ×{combo}
        </span>
      </div>

      <div className="relative flex gap-3">
        {/* rocket track */}
        <div className="relative h-auto w-9 shrink-0 rounded-lg bg-white/10">
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-lg" aria-hidden>🌙</span>
          <motion.span className="absolute left-1/2 -translate-x-1/2 text-2xl" animate={{ bottom: `${6 + rocket * 80}%`, rotate: rocket > 0.6 ? -8 : 0 }}
            transition={{ type: 'spring', stiffness: 140, damping: 14 }} aria-hidden>🚀</motion.span>
        </div>

        <div className="min-w-0 flex-1">
          {/* timer */}
          <div className="mb-2 h-1 overflow-hidden rounded-full bg-white/15">
            <motion.div key={qi} initial={{ width: '100%' }} animate={{ width: phase === 'play' ? '0%' : undefined }}
              transition={{ duration: LIMIT / 1000, ease: 'linear' }} className="h-full bg-amber-400" />
          </div>

          {/* code */}
          <div className="overflow-x-auto rounded-xl bg-black/40 p-3 font-mono text-sm leading-relaxed text-success-300">
            {q.code.map((line, i) => <div key={i} className="whitespace-pre">{line}</div>)}
          </div>

          {/* options */}
          <div className="mt-3 grid gap-2">
            {q.options.map((opt, i) => {
              const reveal = phase === 'reveal';
              const isAns = i === q.answer;
              const isMine = i === picked;
              const cls = reveal
                ? isAns ? 'bg-success-500/25 ring-2 ring-success-400' : isMine ? 'bg-danger-500/25 ring-2 ring-danger-400' : 'bg-white/10 opacity-60'
                : 'bg-white/10 hover:bg-white/20';
              return (
                <motion.button key={i} type="button" whileTap={{ scale: 0.98 }} disabled={reveal} onClick={() => handle(i)}
                  className={`rounded-xl p-3 text-center font-mono text-base font-bold transition ${cls}`}>
                  {opt} {reveal && isAns && '✓'}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {phase === 'reveal' && (
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`relative mt-3 text-center text-sm font-bold ${picked === q.answer ? 'text-success-300' : 'text-danger-300'}`}>
            {picked === q.answer ? (combo >= 3 ? `${combo} ketma-ket!` : 'To‘g‘ri!') : picked === -1 ? 'Vaqt tugadi!' : 'To‘g‘risi belgilandi'}
          </motion.p>
        )}
      </AnimatePresence>
      <p className="relative mt-2 text-center text-xs text-white/50">Eng uzun kombo: ×{best} · tez va to‘g‘ri javob = 3 yulduz</p>
    </div>
  );
}
