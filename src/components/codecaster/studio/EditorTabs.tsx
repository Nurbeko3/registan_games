'use client';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useT } from '@/lib/i18n';

export type EditorTab = 'main' | 'readme' | 'blocks';

const TAB_META: Record<EditorTab, { icon: IconName; label: string; mono: boolean }> = {
  main: { icon: 'fileCode', label: 'main.py', mono: true },
  readme: { icon: 'book', label: 'README.md', mono: true },
  blocks: { icon: 'blocks', label: 'studio.blocks', mono: false },
};

/** Editor tab strip with the Run / Reset actions on the right. */
export function EditorTabs({
  tabs,
  active,
  onSelect,
  onClose,
  onRun,
  onReset,
  running,
}: {
  tabs: EditorTab[];
  active: EditorTab;
  onSelect: (t: EditorTab) => void;
  onClose: (t: EditorTab) => void;
  onRun: () => void;
  onReset: () => void;
  running: boolean;
}) {
  const t = useT();
  return (
    <div className="flex h-10 shrink-0 items-stretch border-b border-border bg-surface-2">
      <div role="tablist" className="flex min-w-0 flex-1 items-stretch overflow-x-auto scrollbar-none">
        {tabs.map((id) => {
          const m = TAB_META[id];
          const isActive = id === active;
          return (
            <div
              key={id}
              role="tab"
              aria-selected={isActive}
              className={`group relative flex shrink-0 items-center gap-1.5 border-r border-border pl-3 pr-1.5 text-xs transition ${
                isActive ? 'bg-surface text-fg' : 'text-fg-faint hover:bg-surface-3 hover:text-fg'
              }`}
            >
              {isActive && <span className="absolute inset-x-0 top-0 h-0.5 bg-brand" aria-hidden />}
              <button type="button" onClick={() => onSelect(id)} className={`inline-flex items-center gap-1.5 py-2 ${m.mono ? 'font-mono' : 'font-display font-bold'}`}>
                <Icon name={m.icon} className="h-3.5 w-3.5 opacity-80" />
                {m.mono ? m.label : t(m.label)}
              </button>
              {id !== 'main' ? (
                <button type="button" onClick={() => onClose(id)} aria-label={t('common.close')} className="grid h-5 w-5 place-items-center rounded text-fg-faint opacity-0 transition hover:bg-surface-3 hover:text-fg group-hover:opacity-100 focus-visible:opacity-100">
                  <Icon name="x" className="h-3 w-3" />
                </button>
              ) : <span className="w-1.5" />}
            </div>
          );
        })}
      </div>
      <div className="flex shrink-0 items-center gap-1.5 px-2">
        <button type="button" onClick={onReset} disabled={running} className="btn-subtle h-7 min-h-0 gap-1 rounded-md px-2 text-xs">
          <Icon name="refresh" className="h-3.5 w-3.5" /> {t('cc.reset')}
        </button>
        <button type="button" onClick={onRun} disabled={running} className="btn-primary h-7 min-h-0 gap-1.5 rounded-md px-2.5 text-xs" title={t('studio.runShortcut')}>
          <Icon name={running ? 'refresh' : 'play'} className={`h-3.5 w-3.5 ${running ? 'animate-spin' : ''}`} />
          {running ? t('cc.running') : t('cc.run')}
          <kbd className="hidden rounded border border-white/30 px-1 font-mono text-[10px] font-medium opacity-80 sm:inline">{t('studio.runShortcut')}</kbd>
        </button>
      </div>
    </div>
  );
}
