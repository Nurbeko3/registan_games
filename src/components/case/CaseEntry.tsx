'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Stars } from '@/components/ui/Bits';
import { Notice, PageHeader } from '@/components/ui/Primitives';
import { isCloudEnabled } from '@/lib/supabase/client';
import { useT, useLocale } from '@/lib/i18n';
import { useGame, useHydrated } from '@/store/useGame';
import { dailyCaseForDay } from '@/data/cases';
import { localizeCaseTitle } from '@/data/cases/i18n';
import { DetectiveRankBadge } from './DetectiveRankBadge';

/**
 * Case Files mode select. Bot Practice is offline; Friendly Room + Classroom
 * Tournament are realtime modes that need the cloud backend.
 */
export function CaseEntry() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const hydrated = useHydrated();
  const caseRecords = useGame((s) => s.cases);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const cloud = mounted && isCloudEnabled();

  // Daily case — deterministic, offline-safe
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const dailyCase = dailyCaseForDay(dayIndex);
  const dailyTitle = localizeCaseTitle(dailyCase, locale);
  const dailyStars = hydrated ? (caseRecords[dailyCase.id]?.stars ?? 0) : 0;

  return (
    <main id="main" className="page-pad-bottom min-h-screen">
      <TopBar />
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <PageHeader icon="search" title={t('case.title')} description={t('case.sub')} />

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
          {/* Detective rank progress */}
          <DetectiveRankBadge variant="full" />

          {/* Daily Case card */}
          <button
            type="button"
            onClick={() => router.push(`/case/practice?case=${dailyCase.id}`)}
            className="card card-hover group flex items-center gap-4 text-left focus-visible:ring-2 focus-visible:ring-brand"
            aria-label={`${t('case.dailyCase')}: ${dailyTitle}`}
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100" aria-hidden="true">
              <Icon name="gift" className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-display text-sm font-bold text-fg">{t('case.dailyCase')}</p>
                <span className="badge bg-amber-100 text-amber-700">{t('case.dailyTag')}</span>
              </div>
              <p className="mt-0.5 truncate text-sm font-semibold text-fg-soft">{dailyTitle}</p>
              <p className="text-xs text-fg-faint">{t('case.dailyCaseSub')}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <Stars count={dailyStars} size="text-sm" />
              <Icon name="arrowRight" className="h-4 w-4 text-brand transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </div>
          </button>
        </div>

        <p className="eyebrow mt-8">{t('home.modes')}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <ModeCard
            icon="bot"
            tone="bg-brand-50 text-brand ring-brand-100"
            title={t('case.mode.bot')}
            desc={t('case.mode.botDesc')}
            onClick={() => router.push('/case/practice')}
          />
          <ModeCard
            icon="users"
            tone="bg-violet-50 text-violet-600 ring-violet-100"
            title={t('case.mode.friendly')}
            desc={t('case.mode.friendlyDesc')}
            online
            onClick={cloud ? () => router.push('/case/friendly') : undefined}
          />
          <ModeCard
            icon="graduation"
            tone="bg-warning-50 text-warning-600 ring-warning-100"
            title={t('case.mode.classroom')}
            desc={t('case.mode.classroomDesc')}
            online
            onClick={cloud ? () => router.push('/case/friendly') : undefined}
          />
        </div>

        {mounted && !cloud && (
          <Notice className="mt-5" icon="signal" tone="neutral">
            {t('case.needNet')}
          </Notice>
        )}
      </div>
    </main>
  );
}

function ModeCard({
  icon, tone, title, desc, online, soon, onClick,
}: {
  icon: IconName; tone: string; title: string; desc: string;
  online?: boolean; soon?: boolean; onClick?: () => void;
}) {
  const t = useT();
  const disabled = soon || !onClick;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`card group flex h-full flex-col text-left transition focus-visible:ring-2 focus-visible:ring-brand ${
        disabled ? 'cursor-not-allowed opacity-60' : 'card-hover'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${tone}`}>
          <Icon name={icon} className="h-5 w-5" />
        </span>
        {online && <span className="badge-brand">{t('case.online')}</span>}
        {soon && <span className="badge-neutral">{t('case.shareSoon')}</span>}
      </div>
      <p className="mt-4 font-display text-base font-extrabold text-fg">{title}</p>
      <p className="mt-1 flex-1 text-sm leading-relaxed text-fg-soft">{desc}</p>
      {!disabled && (
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-brand">
          {t('home.openMode')}
          <Icon name="arrowRight" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      )}
    </button>
  );
}
