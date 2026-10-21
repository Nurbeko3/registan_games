'use client';

import { Icon } from '@/components/ui/Icon';
import { useT } from '@/lib/i18n';
import type { ExplainedError } from '@/lib/codecaster/errors';

export type BottomTab = 'terminal' | 'problems';

/** Collapsible VS Code-style bottom panel: Terminal (program output) + Problems (errors). */
export function BottomPanel({
  tab,
  onTab,
  open,
  onToggle,
  output,
  error,
  className = '',
}: {
  tab: BottomTab;
  onTab: (t: BottomTab) => void;
  open: boolean;
  onToggle: () => void;
  output: string[];
  error: ExplainedError | null;
  className?: string;
}) {
  const t = useT();
  const problems = error ? 1 : 0;

  return (
    <section className={`flex shrink-0 flex-col border-t border-border bg-surface ${className}`} aria-label={t('studio.terminal')}>
      <div className="flex h-9 items-center gap-1 border-b border-border px-2">
        <TabButton active={tab === 'terminal'} onClick={() => onTab('terminal')} icon="terminal" label={t('studio.terminal')} />
        <TabButton active={tab === 'problems'} onClick={() => onTab('problems')} icon="warning" label={t('studio.problems')} count={problems} tone={problems ? 'danger' : undefined} />
        <span className="flex-1" />
        <button type="button" onClick={onToggle} aria-label={open ? t('studio.collapse') : t('studio.expand')} className="btn-subtle h-7 w-7 min-h-0 rounded-md p-0">
          <Icon name="chevronDown" className={`h-4 w-4 transition-transform ${open ? '' : 'rotate-180'}`} />
        </button>
      </div>

      {open && (
        <div className="h-44 overflow-y-auto px-3 py-2.5 font-mono text-[13px] leading-relaxed">
          {tab === 'terminal' ? (
            output.length > 0 ? (
              <ol className="space-y-0.5">
                {output.map((line, i) => (
                  <li key={i} className="flex gap-2 text-fg">
                    <span className="select-none text-brand">›</span>
                    <span className="whitespace-pre-wrap break-words">{line}</span>
                  </li>
                ))}
                <li className="flex gap-2 text-fg-faint"><span className="select-none text-brand">›</span><span className="inline-block h-4 w-2 animate-pulse bg-fg-faint/50 align-middle" aria-hidden /></li>
              </ol>
            ) : (
              <p className="text-fg-faint">{t('studio.terminalEmpty')}</p>
            )
          ) : error ? (
            <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-danger-100 bg-danger-50 px-3 py-2.5 text-danger-700">
              <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 font-sans">
                <p className="font-display text-sm font-bold">
                  {t(error.titleKey)}{error.line != null ? ` · ${t('cc.line', { n: error.line })}` : ''}
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-danger-700/90">{t(error.bodyKey, error.vars)}</p>
              </div>
            </div>
          ) : (
            <p className="inline-flex items-center gap-2 font-sans text-sm text-success-600">
              <Icon name="checkCircle" className="h-4 w-4" /> {t('studio.noProblems')}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function TabButton({ active, onClick, icon, label, count, tone }: { active: boolean; onClick: () => void; icon: 'terminal' | 'warning'; label: string; count?: number; tone?: 'danger' }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-bold uppercase tracking-wide transition ${
        active ? 'bg-surface-3 text-fg' : 'text-fg-faint hover:text-fg'
      }`}
    >
      <Icon name={icon} className="h-3.5 w-3.5" />
      {label}
      {count ? <span className={`rounded-full px-1.5 text-[10px] ${tone === 'danger' ? 'bg-danger text-white' : 'bg-surface-3'}`}>{count}</span> : null}
    </button>
  );
}
