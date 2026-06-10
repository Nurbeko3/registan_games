'use client';

import { Icon, type IconName } from '@/components/ui/Icon';

export interface SegmentedTab<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

/**
 * A mobile-style segmented control (extracted from the Codecaster PaneTab).
 * Generic over the tab value type. Used for the Case Files Sources|Question
 * toggle on phones.
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
    <div className={`flex items-center gap-2 ${className}`} role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl2 px-4 py-2.5 font-display text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grape focus-visible:ring-offset-2 ${
              active ? 'bg-grape text-white shadow-card' : 'bg-white text-ink-soft ring-1 ring-grape-100/70'
            }`}
          >
            {tab.icon && <Icon name={tab.icon} className="h-4 w-4" />} {tab.label}
          </button>
        );
      })}
    </div>
  );
}
