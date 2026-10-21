'use client';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useT } from '@/lib/i18n';

export type SideView = 'explorer' | 'mission' | 'blocks' | 'hints';

const ITEMS: { id: SideView; icon: IconName; key: string }[] = [
  { id: 'explorer', icon: 'folder', key: 'studio.explorer' },
  { id: 'mission', icon: 'target', key: 'studio.mission' },
  { id: 'blocks', icon: 'blocks', key: 'studio.blocks' },
  { id: 'hints', icon: 'lightbulb', key: 'studio.hints' },
];

/** 48px vertical icon rail — clicking the active item toggles the side panel. */
export function ActivityBar({
  active,
  open,
  onSelect,
  hintBadge,
}: {
  active: SideView;
  open: boolean;
  onSelect: (view: SideView) => void;
  hintBadge?: number;
}) {
  const t = useT();
  return (
    <nav className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-surface-2 py-2" aria-label={t('studio.editorTitle')}>
      {ITEMS.map((item) => {
        const isActive = open && active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            title={t(item.key)}
            aria-label={t(item.key)}
            aria-pressed={isActive}
            className={`relative grid h-10 w-10 place-items-center rounded-lg transition ${
              isActive ? 'bg-surface text-brand shadow-xs ring-1 ring-border' : 'text-fg-faint hover:bg-surface-3 hover:text-fg'
            }`}
          >
            {isActive && <span className="absolute -left-1.5 top-2 h-6 w-0.5 rounded-full bg-brand" aria-hidden />}
            <Icon name={item.icon} className="h-5 w-5" />
            {item.id === 'hints' && hintBadge ? (
              <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">{hintBadge}</span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
