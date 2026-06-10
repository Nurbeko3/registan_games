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
      <span className="inline-flex items-center gap-1.5 rounded-full bg-grape-50 px-3 py-1 font-display text-xs font-extrabold text-grape">
        <span aria-hidden="true">{rank.emoji}</span>
        {t(rank.nameKey)}
      </span>
    );
  }

  // full variant
  return (
    <div className="rounded-2xl border border-grape-100 bg-white px-4 py-3 shadow-card">
      {/* rank chip row */}
      <div className="flex items-center gap-2">
        <span className="text-2xl leading-none" aria-hidden="true">{rank.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-extrabold text-ink">{t(rank.nameKey)}</p>
          {next ? (
            <p className="text-[11px] font-bold text-ink-faint">
              {t('case.rankProgress', { current: caseXp, max: next.minCaseXp })}
              {' · '}
              {t('case.nextRank', { rank: t(next.nameKey) })}
            </p>
          ) : (
            <p className="text-[11px] font-bold text-grape">{t('case.maxRank')}</p>
          )}
        </div>
      </div>

      {/* progress bar */}
      <div
        className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-grape-100"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={next ? t('case.nextRank', { rank: t(next.nameKey) }) : t('case.maxRank')}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-grape to-sky transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
