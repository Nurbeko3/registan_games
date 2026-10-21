'use client';

import { Icon } from '@/components/ui/Icon';
import { useT } from '@/lib/i18n';
import type { RunState } from '../CodePane';

/** VS Code-style status bar: 24px, brand-coloured in both colour schemes. */
export function StatusBar({
  runState,
  line,
  col,
  savedFlash,
  problems,
}: {
  runState: RunState;
  line: number;
  col: number;
  savedFlash: boolean;
  problems: number;
}) {
  const t = useT();
  const stateLabel =
    runState === 'running' ? t('cc.running')
      : runState === 'won' ? t('studio.won')
        : runState === 'lost' ? t('studio.lost')
          : runState === 'error' ? t('studio.errorState')
            : t('studio.ready');
  const stateIcon =
    runState === 'running' ? 'refresh' : runState === 'won' ? 'checkCircle' : runState === 'error' || runState === 'lost' ? 'warning' : 'checkCircle';

  return (
    <div className="flex h-6 shrink-0 items-center gap-3 overflow-hidden bg-brand px-3 font-mono text-[11px] font-medium text-white">
      <span className="inline-flex items-center gap-1.5">
        <Icon name="binary" className="h-3 w-3" /> Python 3 · Skulpt
      </span>
      <span className="hidden items-center gap-1.5 sm:inline-flex">
        <Icon name="fileCode" className="h-3 w-3" /> main.py
      </span>
      <span className={`inline-flex items-center gap-1.5 ${runState === 'running' ? 'animate-pulse' : ''}`}>
        <Icon name={stateIcon} className="h-3 w-3" /> {stateLabel}
      </span>
      {problems > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded bg-white/15 px-1.5">
          <Icon name="warning" className="h-3 w-3" /> {problems}
        </span>
      )}
      {savedFlash && (
        <span className="inline-flex items-center gap-1.5 animate-pop">
          <Icon name="save" className="h-3 w-3" /> {t('studio.saved')}
        </span>
      )}
      <span className="flex-1" />
      <span className="tabular-nums">{t('studio.ln', { l: line, c: col })}</span>
      <span className="hidden sm:inline">Spaces: 4</span>
      <span className="hidden sm:inline">UTF-8</span>
    </div>
  );
}
