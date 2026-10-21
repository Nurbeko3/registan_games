'use client';

import { Icon } from '@/components/ui/Icon';
import { useT } from '@/lib/i18n';
import { MissionBrief } from '../MissionPanel';
import type { CodecasterLevel } from '@/data/codecaster/types';
import type { SideView } from './ActivityBar';
import type { EditorTab } from './EditorTabs';

/** The 260px side panel: Explorer tree / Mission brief / Blocks shortcut / Hints ladder. */
export function SidePanel({
  view,
  level,
  activeTab,
  onOpenTab,
  hintsRevealed,
  onHint,
}: {
  view: SideView;
  level: CodecasterLevel;
  activeTab: EditorTab;
  onOpenTab: (t: EditorTab) => void;
  hintsRevealed: number;
  onHint: () => void;
}) {
  const t = useT();
  const titles: Record<SideView, string> = { explorer: 'studio.explorer', mission: 'studio.mission', blocks: 'studio.blocks', hints: 'studio.hints' };

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-surface-2" aria-label={t(titles[view])}>
      <p className="eyebrow flex h-9 items-center px-4">{t(titles[view])}</p>

      {view === 'explorer' && (
        <ul className="px-2 text-[13px]">
          <li className="flex items-center gap-1.5 px-2 py-1 font-bold text-fg-soft">
            <Icon name="chevronDown" className="h-3.5 w-3.5" />
            <Icon name="folderOpen" className="h-4 w-4 text-brand" />
            <span className="font-mono">{t('studio.project')}/</span>
          </li>
          <FileRow active={activeTab === 'main'} onClick={() => onOpenTab('main')} icon="fileCode" label="main.py" tone="text-info-600" />
          <FileRow active={activeTab === 'readme'} onClick={() => onOpenTab('readme')} icon="book" label="README.md" tone="text-fg-faint" />
          <FileRow active={activeTab === 'blocks'} onClick={() => onOpenTab('blocks')} icon="blocks" label={t('studio.blocks')} tone="text-violet-600" mono={false} />
        </ul>
      )}

      {view === 'mission' && (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          <MissionBrief level={level} compact />
        </div>
      )}

      {view === 'blocks' && (
        <div className="px-4 py-2 text-sm text-fg-soft">
          <p>{t('blocks.hint')}</p>
          <button type="button" onClick={() => onOpenTab('blocks')} className="btn-secondary btn-sm mt-3 gap-1.5">
            <Icon name="blocks" className="h-4 w-4" /> {t('studio.blocks')}
          </button>
        </div>
      )}

      {view === 'hints' && (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {hintsRevealed === 0 ? (
            <p className="px-1 text-sm text-fg-soft">{t('studio.noHints')}</p>
          ) : (
            <ol className="space-y-2">
              {level.hints.slice(0, hintsRevealed).map((h, i) => (
                <li key={i} className="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2 text-sm leading-relaxed text-fg-soft dark:bg-amber-50/30">
                  <Icon name="spark" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span className="whitespace-pre-line">{t(h)}</span>
                </li>
              ))}
            </ol>
          )}
          <button
            type="button"
            onClick={onHint}
            disabled={hintsRevealed >= level.hints.length}
            className="btn-secondary btn-sm mt-3 w-full gap-1.5 text-amber-700"
          >
            <Icon name="lightbulb" className="h-4 w-4" />
            {t('studio.hintBtn')} ({hintsRevealed}/{level.hints.length})
          </button>
        </div>
      )}
    </aside>
  );
}

function FileRow({ active, onClick, icon, label, tone, mono = true }: { active: boolean; onClick: () => void; icon: 'fileCode' | 'book' | 'blocks'; label: string; tone: string; mono?: boolean }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? 'true' : undefined}
        className={`flex w-full items-center gap-1.5 rounded-md py-1 pl-7 pr-2 text-left transition ${
          active ? 'bg-brand-50 text-brand-700' : 'text-fg-soft hover:bg-surface-3 hover:text-fg'
        }`}
      >
        <Icon name={icon} className={`h-4 w-4 ${active ? '' : tone}`} />
        <span className={mono ? 'font-mono' : 'font-semibold'}>{label}</span>
      </button>
    </li>
  );
}
