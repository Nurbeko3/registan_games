'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { GameProps } from './GameProps';

interface Choice { text: string; to: string; good?: boolean }
interface Node {
  id: string;
  scene: string;
  emoji: string;
  tip?: string;
  choices?: Choice[];
  ending?: 'win' | 'retry';
}

const STORY: Record<string, Node> = {
  /* ── Chapter 1: Loops ── */
  start: {
    id: 'start',
    emoji: '🤖',
    scene: 'Robo must cross 3 rivers to reach the treasure. How should it move?',
    tip: '💡 A loop repeats an action multiple times.',
    choices: [
      { text: '🔁 Repeat "jump" 3 times — use a loop!', to: 'bridge', good: true },
      { text: '✍️ Write "jump" just once', to: 'stuck1' },
    ],
  },
  stuck1: {
    id: 'stuck1',
    emoji: '😅',
    scene: 'Robo crossed only one river and got stuck! A loop repeats actions automatically.',
    ending: 'retry',
  },
  bridge: {
    id: 'bridge',
    emoji: '🌉',
    scene: 'All 3 rivers crossed! A locked gate appears. What should Robo check?',
    tip: '💡 IF statements let your code make decisions.',
    choices: [
      { text: '🔑 IF I have the key, THEN open gate', to: 'forest', good: true },
      { text: '💪 Smash the gate randomly', to: 'stuck2' },
    ],
  },
  stuck2: {
    id: 'stuck2',
    emoji: '🚪',
    scene: "The gate won't budge! Conditions (IF) help code decide what to do. Try again.",
    ending: 'retry',
  },

  /* ── Chapter 2: Variables ── */
  forest: {
    id: 'forest',
    emoji: '🌳',
    scene: "Great! Robo enters the Coding Forest. A wizard asks: 'Where do you store the score in a game?'",
    tip: '💡 A variable is a named box that holds a value.',
    choices: [
      { text: '📦 In a variable — like score = 0', to: 'mountain', good: true },
      { text: '🧠 Just remember it in your head', to: 'stuck3' },
    ],
  },
  stuck3: {
    id: 'stuck3',
    emoji: '🧙',
    scene: "The wizard shakes his head — computers don't have a memory unless you use variables!",
    ending: 'retry',
  },

  /* ── Chapter 3: Debugging ── */
  mountain: {
    id: 'mountain',
    emoji: '⛰️',
    scene: "Robo climbs the mountain and finds a broken bridge: `total = total + 1` → but total was never defined! How do you fix it?",
    tip: '💡 Variables must be created before you can use them.',
    choices: [
      { text: '✅ Add `total = 0` before the loop', to: 'win', good: true },
      { text: '🚀 Just run it and hope for the best', to: 'stuck4' },
    ],
  },
  stuck4: {
    id: 'stuck4',
    emoji: '💥',
    scene: "The program crashed with NameError: 'total' is not defined. Always initialise variables first!",
    ending: 'retry',
  },

  /* ── Win ── */
  win: {
    id: 'win',
    emoji: '💎',
    scene: 'Robo fixed the bug, crossed every challenge and found the treasure! You understand loops, conditions AND variables!',
    ending: 'win',
  },
};

export function CodeAdventure({ onWin }: GameProps) {
  const [nodeId, setNodeId] = useState('start');
  const [mistakes, setMistakes] = useState(0);
  const node = STORY[nodeId];

  const handleChoice = (c: Choice) => {
    if (!c.good) setMistakes((m) => m + 1);
    setNodeId(c.to);
  };

  if (node.ending === 'win') {
    const stars = mistakes === 0 ? 3 : mistakes === 1 ? 2 : 1;
    return (
      <div className="card text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-6xl">
          {node.emoji}
        </motion.div>
        <p className="mt-3 text-xl font-extrabold text-ink-soft">{node.scene}</p>
        <p className="mt-2 text-base font-extrabold text-ink-faint">Mistakes: {mistakes}</p>
        <button onClick={() => onWin(stars)} className="btn-primary mt-4 w-full">
          Claim reward 🎁
        </button>
      </div>
    );
  }

  if (node.ending === 'retry') {
    return (
      <div className="card text-center">
        <div className="text-6xl">{node.emoji}</div>
        <p className="mt-3 text-xl font-extrabold text-ink-soft">{node.scene}</p>
        <button onClick={() => setNodeId('start')} className="btn-ghost mt-4 w-full">
          ↺ Try again
        </button>
      </div>
    );
  }

  return (
    <motion.div
      key={nodeId}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="card text-center"
    >
      <div className="text-6xl">{node.emoji}</div>
      <p className="mt-3 text-2xl font-extrabold">{node.scene}</p>
      {node.tip && (
        <p className="mt-3 rounded-2xl bg-sun/20 px-5 py-3 text-lg font-extrabold text-ink-soft">
          {node.tip}
        </p>
      )}
      <div className="mt-6 grid gap-3">
        {node.choices?.map((c) => (
          <button key={c.text} onClick={() => handleChoice(c)} className="btn-ghost w-full justify-start text-left text-lg">
            {c.text}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
