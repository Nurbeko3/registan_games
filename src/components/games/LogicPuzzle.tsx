'use client';

import { useState, useMemo } from 'react';
import { Reorder } from 'framer-motion';
import { useT } from '@/lib/i18n';
import type { GameProps } from './GameProps';

interface Block { id: number; text: string }
interface PuzzleSet { title: string; blocks: Block[] }

const PUZZLE_SETS: PuzzleSet[] = [
  {
    title: 'Morning Routine',
    blocks: [
      { id: 1, text: '🌅 Wake up' },
      { id: 2, text: '🪥 Brush teeth' },
      { id: 3, text: '🥣 Eat breakfast' },
      { id: 4, text: '🎒 Pack bag' },
      { id: 5, text: '🚌 Go to school' },
    ],
  },
  {
    title: 'Run a Program',
    blocks: [
      { id: 1, text: '📝 Write the code' },
      { id: 2, text: '💾 Save the file' },
      { id: 3, text: '▶ Run the program' },
      { id: 4, text: '🐛 Fix any bugs' },
      { id: 5, text: '✅ See the result' },
    ],
  },
  {
    title: 'Search Algorithm',
    blocks: [
      { id: 1, text: '📋 Start at the list' },
      { id: 2, text: '🔍 Check first item' },
      { id: 3, text: '✅ Is it the one? Done!' },
      { id: 4, text: '➡️ Move to next item' },
      { id: 5, text: '🔁 Repeat until found' },
    ],
  },
  {
    title: 'Make a Website',
    blocks: [
      { id: 1, text: '💡 Plan the design' },
      { id: 2, text: '🏗️ Write the HTML' },
      { id: 3, text: '🎨 Add CSS styles' },
      { id: 4, text: '⚡ Add JavaScript' },
      { id: 5, text: '🚀 Deploy online' },
    ],
  },
  {
    title: 'Fix a Bug',
    blocks: [
      { id: 1, text: '🔴 Notice something is wrong' },
      { id: 2, text: '🔎 Read the error message' },
      { id: 3, text: '📍 Find the broken line' },
      { id: 4, text: '✏️ Fix the code' },
      { id: 5, text: '▶ Test it again' },
    ],
  },
];

export function LogicPuzzle({ onWin }: GameProps) {
  const t = useT();
  const order = useMemo(
    () => [...Array(PUZZLE_SETS.length).keys()].sort(() => Math.random() - 0.5),
    [],
  );
  const [step, setStep] = useState(0);
  const [triesThisStep, setTriesThisStep] = useState(0);
  const [totalWrong, setTotalWrong] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [completed, setCompleted] = useState<number[]>([]);

  const puzzle = PUZZLE_SETS[order[step]];
  const shuffled = useMemo(() => [...puzzle.blocks].sort(() => Math.random() - 0.5), [puzzle]);
  const [blocks, setBlocks] = useState<Block[]>(shuffled);

  const resetBlocks = (newStep: number) => {
    const newPuzzle = PUZZLE_SETS[order[newStep]];
    setBlocks([...newPuzzle.blocks].sort(() => Math.random() - 0.5));
    setTriesThisStep(0);
    setMsg(null);
  };

  const check = () => {
    setTriesThisStep((t) => t + 1);
    const ok = blocks.every((b, i) => b.id === i + 1);
    if (ok) {
      setCompleted((c) => [...c, step]);
      if (step + 1 >= PUZZLE_SETS.length) {
        const stars = totalWrong === 0 ? 3 : totalWrong <= 2 ? 2 : 1;
        onWin(stars);
      } else {
        setMsg(t('mg.logic.correct'));
        setTimeout(() => {
          setStep((s) => {
            const next = s + 1;
            resetBlocks(next);
            return next;
          });
        }, 900);
      }
    } else {
      setTotalWrong((w) => w + 1);
      setMsg(t('mg.logic.wrong'));
      setTimeout(() => setMsg(null), 1600);
    }
  };

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-display font-extrabold">🧩 {puzzle.title}</p>
        <span className="chip bg-grape-50 text-grape text-xs">
          {step + 1}/{PUZZLE_SETS.length}
        </span>
      </div>
      <p className="text-center text-sm font-bold text-ink-soft">
        {t('mg.logic.instr')}
      </p>
      <Reorder.Group
        axis="y"
        values={blocks}
        onReorder={setBlocks}
        className="mx-auto mt-4 max-w-sm space-y-2"
      >
        {blocks.map((b, i) => (
          <Reorder.Item
            key={b.id}
            value={b}
            className="flex cursor-grab items-center gap-3 rounded-2xl bg-cloud p-3 font-bold shadow-card active:cursor-grabbing"
            whileDrag={{ scale: 1.04, boxShadow: '0 12px 24px rgba(124,92,252,0.3)' }}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-grape font-display text-white">
              {i + 1}
            </span>
            <span className="text-base">{b.text}</span>
            <span className="ml-auto text-ink-faint">⠿</span>
          </Reorder.Item>
        ))}
      </Reorder.Group>
      {msg && (
        <p className={`mt-3 text-center text-sm font-bold ${msg.startsWith('✅') ? 'text-mint-600' : 'text-bubble-600'}`}>
          {msg}
        </p>
      )}
      <button onClick={check} className="btn-primary mt-4 w-full">
        {t('mg.logic.check')}
      </button>
    </div>
  );
}
