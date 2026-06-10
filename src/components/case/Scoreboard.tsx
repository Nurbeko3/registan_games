'use client';

import { useT } from '@/lib/i18n';

export interface Standing {
  id: string;
  name: string;
  emoji: string;
  score: number;
  isPlayer?: boolean;
}

/**
 * Live standings between questions. Designed to scale: with up to ~8 players it
 * renders plainly; for big classrooms (30+, INC 7) the list becomes scrollable —
 * `maxVisibleHeight` caps it so it never pushes the game off-screen.
 */
export function Scoreboard({ standings, title }: { standings: Standing[]; title?: string }) {
  const t = useT();
  const ranked = [...standings].sort((a, b) => b.score - a.score);
  return (
    <div className="card">
      <p className="font-display text-xs font-extrabold uppercase tracking-wide text-ink-faint">
        {title ?? t('case.scoreboard')}
      </p>
      <ol className="mt-3 max-h-[46vh] space-y-1.5 overflow-y-auto">
        {ranked.map((s, i) => (
          <li
            key={s.id}
            className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${
              s.isPlayer ? 'bg-grape-50 ring-1 ring-grape-400' : 'bg-white'
            }`}
          >
            <span className="w-6 text-center font-display text-sm font-extrabold text-ink-faint">{i + 1}</span>
            <span className="text-xl" aria-hidden>{s.emoji}</span>
            <span className="flex-1 truncate font-bold text-ink">
              {s.isPlayer ? t('case.you') : s.name}
            </span>
            <span className="font-display font-extrabold text-grape">{s.score}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
