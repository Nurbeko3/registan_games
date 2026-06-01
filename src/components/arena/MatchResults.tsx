'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { TEAMS, type MatchResult } from '@/lib/arena/types';
import { Confetti } from '@/components/ui/Confetti';

/** Post-match screen. Win or lose, the framing is positive: it celebrates what
 *  the child LEARNED (accuracy, questions, XP) as much as the battle result. */
export function MatchResults({ result, onPlayAgain }: { result: MatchResult; onPlayAgain: () => void }) {
  const acc = result.answered ? Math.round((result.correct / result.answered) * 100) : 0;
  const mine = TEAMS[result.myTeam];

  return (
    <div className="relative">
      {result.won && <Confetti />}
      <div className="card text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260 }} className="text-6xl">
          {result.won ? '🏆' : '🎓'}
        </motion.div>
        <p className="mt-2 font-display text-2xl font-extrabold">
          {result.won ? 'Victory!' : 'Great effort!'}
        </p>
        <p className="text-ink-soft">
          {result.won ? `${mine.emoji} ${mine.name} win!` : 'Every question made you smarter. 🧠'}
        </p>
        <p className="mt-2 font-display text-3xl font-extrabold">
          <span className="text-bubble-600">{result.redScore}</span>
          <span className="mx-2 text-ink-faint">–</span>
          <span className="text-sky-600">{result.blueScore}</span>
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat icon="⚡" label="Your tag-outs" value={result.elims} />
        <Stat icon="🎯" label="Quiz accuracy" value={`${acc}%`} />
        <Stat icon="✅" label="Correct answers" value={`${result.correct}/${result.answered}`} />
        <Stat icon="📈" label="XP earned" value={`+${result.xpEarned}`} />
      </div>

      <div className="mt-3 flex justify-center">
        <span className="chip bg-mango/20 text-ink">💰 +{result.coinsEarned} coins</span>
      </div>

      <div className="mt-5 flex gap-2">
        <Link href="/arena" className="btn-ghost flex-1 text-center">⚔️ New match</Link>
        <button onClick={onPlayAgain} className="btn-primary flex-1">🔁 Rematch</button>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: number | string }) {
  return (
    <div className="card flex flex-col items-center gap-0.5 p-3 text-center">
      <span className="text-xl">{icon}</span>
      <span className="font-display text-xl font-extrabold">{value}</span>
      <span className="text-[11px] font-bold text-ink-faint">{label}</span>
    </div>
  );
}
