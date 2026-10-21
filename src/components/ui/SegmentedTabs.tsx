'use client';

import { Icon, type IconName } from '@/components/ui/Icon';

export interface SegmentedTab<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

/**
 * A segmented control (extracted from the Codecaster PaneTab). Generic over
 * the tab value type. Used for the Codecaster World|Code and the Case Files
 * Sources|Question toggles on phones.
 */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  className = '',
}: {
  tabs: SegmentedTab<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div className={`flex items-stretch rounded-xl bg-surface-3 p-1 ${className}`} role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={`flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-lg px-4 font-display text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              active ? 'bg-surface text-fg shadow-xs' : 'text-fg-soft hover:text-fg'
            }`}
          >
            {tab.icon && <Icon name={tab.icon} className="h-4 w-4" />} {tab.label}
          </button>
        );
      })}
    </div>
  );
}
