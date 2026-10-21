'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@/components/ui/Icon';
import type { GameProps } from './GameProps';
import { playSfx } from '@/lib/sound';

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
    tip: 'A loop repeats an action multiple times.',
    choices: [
      { text: 'Repeat "jump" 3 times — use a loop!', to: 'bridge', good: true },
      { text: 'Write "jump" just once', to: 'stuck1' },
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
    tip: 'IF statements let your code make decisions.',
    choices: [
      { text: 'IF I have the key, THEN open gate', to: 'forest', good: true },
      { text: 'Smash the gate randomly', to: 'stuck2' },
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
    tip: 'A variable is a named box that holds a value.',
    choices: [
      { text: 'In a variable — like score = 0', to: 'mountain', good: true },
      { text: 'Just remember it in your head', to: 'stuck3' },
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
    tip: 'Variables must be created before you can use them.',
    choices: [
      { text: 'Add `total = 0` before the loop', to: 'win', good: true },
      { text: 'Just run it and hope for the best', to: 'stuck4' },
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

function SceneTile({ emoji }: { emoji: string }) {
  return (
    <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-border bg-surface-2 text-4xl" aria-hidden>
      {emoji}
    </span>
  );
}

export function CodeAdventure({ onWin }: GameProps) {
  const [nodeId, setNodeId] = useState('start');
  const [mistakes, setMistakes] = useState(0);
  const node = STORY[nodeId];

  const handleChoice = (c: Choice) => {
    if (!c.good) setMistakes((m) => m + 1);
    playSfx(c.good ? 'success' : 'error');
    setNodeId(c.to);
  };

  if (node.ending === 'win') {
    const stars = mistakes === 0 ? 3 : mistakes === 1 ? 2 : 1;
    return (
      <div className="card text-center">
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <SceneTile emoji={node.emoji} />
        </motion.div>
        <p className="mt-4 text-base font-semibold text-fg">{node.scene}</p>
        <p className="mt-2 text-sm text-fg-faint">Mistakes: {mistakes}</p>
        <button type="button" onClick={() => onWin(stars)} className="btn-primary mt-5 w-full">
          <Icon name="gift" className="h-4 w-4" /> Claim reward
        </button>
      </div>
    );
  }

  if (node.ending === 'retry') {
    return (
      <div className="card text-center">
        <SceneTile emoji={node.emoji} />
        <p className="mt-4 text-base font-semibold text-fg-soft">{node.scene}</p>
        <button type="button" onClick={() => setNodeId('start')} className="btn-secondary mt-5 w-full">
          <Icon name="refresh" className="h-4 w-4" /> Try again
        </button>
      </div>
    );
  }

  return (
    <motion.div
      key={nodeId}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      className="card text-center"
    >
      <SceneTile emoji={node.emoji} />
      <p className="mt-4 font-display text-lg font-extrabold text-fg">{node.scene}</p>
      {node.tip && (
        <p className="mt-3 inline-flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-left text-sm font-medium text-amber-800">
          <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{node.tip}</span>
        </p>
      )}
      <div className="mt-5 grid gap-2">
        {node.choices?.map((c) => (
          <button key={c.text} type="button" onClick={() => handleChoice(c)} className="btn-secondary w-full justify-start whitespace-normal text-left">
            <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-fg-faint" />
            {c.text}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
