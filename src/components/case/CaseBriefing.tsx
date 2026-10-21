'use client';

import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/lib/i18n';
import { CaseMetaBadges, type CaseMetaLike } from './CaseMeta';

/** Investigation-phase header: case title, briefing and meta, with an optional
 *  trailing slot (player count, projector buttons…). */
export function CaseBriefing({
  title,
  briefing,
  caseDef,
  aside,
}: {
  title: string;
  briefing: string;
  caseDef: CaseMetaLike & { sources: readonly unknown[] };
  aside?: ReactNode;
}) {
  const t = useT();
  return (
    <section className="card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand ring-1 ring-inset ring-brand-100">
            <Icon name="search" className="h-4 w-4" />
          </span>
          <p className="eyebrow">{t('case.investigate')}</p>
        </div>
        {aside && <div className="shrink-0 text-xs font-semibold text-fg-faint">{aside}</div>}
      </div>
      <h1 className="mt-3 font-display text-2xl font-extrabold leading-tight tracking-tight text-fg">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-fg-soft sm:text-[0.9375rem]">{briefing}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <CaseMetaBadges caseDef={caseDef} />
        <span className="text-2xs font-semibold text-fg-faint">{t('case.sourcesN', { n: caseDef.sources.length })}</span>
      </div>
    </section>
  );
}
