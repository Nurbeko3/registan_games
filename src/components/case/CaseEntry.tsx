'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Stars } from '@/components/ui/Bits';
import { isCloudEnabled } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n';
import { useGame, useHydrated } from '@/store/useGame';
import { dailyCaseForDay } from '@/data/cases';
import { DetectiveRankBadge } from './DetectiveRankBadge';

/**
 * Case Files mode select. Bot Practice ships in INC 3 (offline). Friendly Room +
 * Classroom Tournament are realtime modes wired in later increments — shown here
 * with a "soon" affordance so the surface is discoverable.
 */
export function CaseEntry() {
  const t = useT();
  const router = useRouter();
  const hydrated = useHydrated();
  const caseRecords = useGame((s) => s.cases);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const cloud = mounted && isCloudEnabled();

  // Daily case — deterministic, offline-safe
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const dailyCase = dailyCaseForDay(dayIndex);
  const dailyStars = hydrated ? (caseRecords[dailyCase.id]?.stars ?? 0) : 0;

  return (
    <main id="main" className="min-h-screen dotted page-pad-bottom">
      <TopBar showBack />
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-grape-50 text-grape" aria-hidden="true">
            <Icon name="search" className="h-6 w-6" />
          </span>
          <div>
            <h1 className="h-section">{t('case.title')}</h1>
            <p className="text-sm text-ink-soft">{t('case.sub')}</p>
          </div>
        </div>

        {/* Detective rank progress */}
        <div className="mt-4">
          <DetectiveRankBadge variant="full" />
        </div>

        {/* Daily Case card */}
        <button
          type="button"
          onClick={() => router.push(`/case/practice?case=${dailyCase.id}`)}
          className="mt-5 flex w-full items-center gap-4 rounded-3xl border-2 border-sun/60 bg-gradient-to-br from-sun/10 to-mango/10 px-4 py-4 text-left transition hover:border-sun hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grape"
          aria-label={`${t('case.dailyCase')}: ${dailyCase.title}`}
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sun to-mango text-white" aria-hidden="true">
            <Icon name="gift" className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-display font-extrabold text-ink">{t('case.dailyCase')}</p>
              <span className="rounded-full bg-sun/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-mango-600" aria-hidden="true">
                ★
              </span>
            </div>
            <p className="mt-0.5 truncate text-sm font-bold text-ink-faint">{dailyCase.title}</p>
            <p className="text-[11px] font-bold text-ink-faint">{t('case.dailyCaseSub')}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Stars count={dailyStars} size="text-sm" />
            <Icon name="rocket" className="h-5 w-5 text-mango-600" aria-hidden="true" />
          </div>
        </button>

        <div className="mt-5 space-y-3">
          <ModeCard
            icon="bot"
            accent="from-sky to-grape"
            title={t('case.mode.bot')}
            desc={t('case.mode.botDesc')}
            onClick={() => router.push('/case/practice')}
          />
          <ModeCard
            icon="party"
            accent="from-grape to-bubble"
            title={t('case.mode.friendly')}
            desc={t('case.mode.friendlyDesc')}
            online
            onClick={cloud ? () => router.push('/case/friendly') : undefined}
          />
          <ModeCard
            icon="trophy"
            accent="from-mango to-sun"
            title={t('case.mode.classroom')}
            desc={t('case.mode.classroomDesc')}
            online
            onClick={cloud ? () => router.push('/case/friendly') : undefined}
          />
        </div>

        {mounted && !cloud && (
          <p className="mt-5 flex items-start gap-2 rounded-2xl bg-cloud px-4 py-3 text-sm font-bold text-ink-soft">
            <Icon name="signal" className="mt-0.5 h-5 w-5 shrink-0 text-grape" aria-hidden="true" />
            {t('case.needNet')}
          </p>
        )}
      </div>
    </main>
  );
}

function ModeCard({
  icon, accent, title, desc, online, soon, onClick,
}: {
  icon: IconName; accent: string; title: string; desc: string;
  online?: boolean; soon?: boolean; onClick?: () => void;
}) {
  const t = useT();
  const disabled = soon || !onClick;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-3xl border-2 px-4 py-4 text-left transition ${
        disabled
          ? 'cursor-not-allowed border-grape-100/60 bg-white/60'
          : 'border-grape-100 bg-white hover:border-grape-400 hover:shadow-card'
      }`}
    >
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${accent} text-white`}>
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-display font-extrabold text-ink">{title}</p>
          {online && (
            <span className="rounded-full bg-sky/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-sky-600">
              {t('case.online')}
            </span>
          )}
          {soon && (
            <span className="rounded-full bg-grape-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-grape">
              {t('case.shareSoon')}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm font-bold text-ink-faint">{desc}</p>
      </div>
      {!disabled && <Icon name="rocket" className="h-5 w-5 shrink-0 text-grape" />}
    </button>
  );
}
