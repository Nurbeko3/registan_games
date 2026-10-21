'use client';

import { useGame, useHydrated } from '@/store/useGame';
import { rankForCaseXp, nextRankForCaseXp } from '@/lib/caseLeveling';
import { useT } from '@/lib/i18n';

/**
 * Displays the player's current Detective rank (derived from caseXp).
 *
 * variant="compact"  — emoji + name chip only (for result screens, inline badges).
 * variant="full"     — chip + progress bar toward next rank (for CaseEntry header,
 *                      rewards profile card).
 *
 * Reads caseXp from the store by default; pass an explicit `caseXp` prop to
 * render a snapshot value (e.g. ResultsScreen shows post-match XP).
 *
 * Hydration safety: before the store rehydrates we fall back to caseXp=0 (Cadet),
 * which is the correct initial state and avoids SSR/client mismatch.
 */
export function DetectiveRankBadge({
  variant = 'full',
  caseXp: propCaseXp,
}: {
  variant?: 'compact' | 'full';
  caseXp?: number;
}) {
  const t = useT();
  const hydrated = useHydrated();
  const storeCaseXp = useGame((s) => s.caseXp);

  // Use propCaseXp when provided (e.g. ResultsScreen passes post-match caseXp);
  // otherwise fall back to the store value, but only after hydration.
  const caseXp = propCaseXp !== undefined ? propCaseXp : hydrated ? storeCaseXp : 0;

  const rank = rankForCaseXp(caseXp);
  const next = nextRankForCaseXp(caseXp);

  // Progress toward next rank (0–100 %)
  const pct = next
    ? Math.round(((caseXp - rank.minCaseXp) / (next.minCaseXp - rank.minCaseXp)) * 100)
    : 100;

  if (variant === 'compact') {
    return (
      <span className="chip bg-info-50 text-info-700">
        <span aria-hidden="true">{rank.emoji}</span>
        {t(rank.nameKey)}
      </span>
    );
  }

  // full variant
  return (
    <div className="card !p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-info-50 text-xl leading-none ring-1 ring-inset ring-info-100" aria-hidden="true">
          {rank.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-extrabold text-fg">{t(rank.nameKey)}</p>
          {next ? (
            <p className="text-xs font-semibold text-fg-faint">
              {t('case.rankProgress', { current: caseXp, max: next.minCaseXp })}
              {' · '}
              {t('case.nextRank', { rank: t(next.nameKey) })}
            </p>
          ) : (
            <p className="text-xs font-semibold text-info-600">{t('case.maxRank')}</p>
          )}
        </div>
        <span className="shrink-0 text-xs font-bold tabular-nums text-fg-faint">{pct}%</span>
      </div>

      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={next ? t('case.nextRank', { rank: t(next.nameKey) }) : t('case.maxRank')}
      >
        <div
          className="h-full rounded-full bg-info-500 transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
