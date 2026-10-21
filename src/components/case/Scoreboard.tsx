'use client';

import { Icon } from '@/components/ui/Icon';
import { useT } from '@/lib/i18n';

export interface Standing {
  id: string;
  name: string;
  emoji: string;
  score: number;
  isPlayer?: boolean;
  /** Optional current streak (shown as a chip when ≥ 2). */
  streak?: number;
}

/** Rank tile — gold / silver / bronze for the podium, neutral after that. */
export function RankBadge({ rank, size = 'h-7 w-7 text-xs' }: { rank: number; size?: string }) {
  const tone =
    rank === 1
      ? 'bg-amber-100 text-amber-700'
      : rank === 2
        ? 'bg-surface-3 text-fg-soft'
        : rank === 3
          ? 'bg-warning-100 text-warning-700'
          : 'bg-surface-2 text-fg-faint';
  return (
    <span className={`grid shrink-0 place-items-center rounded-md font-display font-bold tabular-nums ${size} ${tone}`} aria-label={`#${rank}`}>
      {rank}
    </span>
  );
}

/**
 * Live standings between questions. Designed to scale: with up to ~8 players it
 * renders plainly; for big classrooms (30+) the list becomes scrollable —
 * the max-height caps it so it never pushes the game off-screen.
 */
export function Scoreboard({ standings, title }: { standings: Standing[]; title?: string }) {
  const t = useT();
  const ranked = [...standings].sort((a, b) => b.score - a.score);
  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="font-display text-sm font-bold text-fg">{title ?? t('case.scoreboard')}</p>
        <Icon name="rank" className="h-4 w-4 text-fg-faint" />
      </div>
      <ol className="max-h-[46vh] divide-y divide-border overflow-y-auto">
        {ranked.map((s, i) => (
          <li key={s.id} className={`flex items-center gap-3 px-4 py-2.5 ${s.isPlayer ? 'bg-brand-50/60' : ''}`}>
            <RankBadge rank={i + 1} />
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface-2 text-base" aria-hidden>
              {s.emoji}
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate text-sm font-bold text-fg">{s.isPlayer ? t('case.you') : s.name}</span>
              {s.streak !== undefined && s.streak >= 2 && (
                <span className="badge-warning inline-flex items-center gap-1">
                  <Icon name="flame" className="h-3 w-3" />
                  {s.streak}
                </span>
              )}
            </span>
            <span className="font-display text-sm font-bold tabular-nums text-fg">{s.score}</span>
          </li>
        ))}
        {ranked.length === 0 && <li className="px-4 py-6 text-center text-sm text-fg-faint">—</li>}
      </ol>
    </section>
  );
}
