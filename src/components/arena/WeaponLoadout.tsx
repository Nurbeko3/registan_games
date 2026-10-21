'use client';

import { useEffect, useRef } from 'react';
import { WEAPONS, type WeaponId, getWeapon, getWeaponStats } from '@/lib/arena/weapons';
import { useT } from '@/lib/i18n';
import { Icon, type IconName } from '@/components/ui/Icon';
import { WeaponIcon } from './WeaponIcon';

/** Blaster picker: a "your blaster" summary card with 1–5 dot ratings, plus a
 *  horizontally scrolling strip of selectable cards with arrow navigation. */
export function WeaponLoadout({
  value,
  onChange,
  compact = false,
}: {
  value: WeaponId;
  onChange: (id: WeaponId) => void;
  compact?: boolean;
}) {
  const t = useT();
  const selected = getWeapon(value);
  const stats = getWeaponStats(selected);

  const scrollRef = useRef<HTMLDivElement>(null);
  const index = WEAPONS.findIndex((w) => w.id === value);
  const atStart = index <= 0;
  const atEnd = index >= WEAPONS.length - 1;

  /** Arrow nav: move the selection by one and slide it to the middle. */
  const go = (dir: -1 | 1) => {
    const next = Math.min(WEAPONS.length - 1, Math.max(0, index + dir));
    if (next !== index) onChange(WEAPONS[next].id);
  };

  // Keep the chosen blaster centred in the strip whenever it changes.
  useEffect(() => {
    const container = scrollRef.current;
    const el = container?.querySelector<HTMLElement>('[data-active="true"]');
    if (!container || !el) return;
    const c = container.getBoundingClientRect();
    const e = el.getBoundingClientRect();
    container.scrollBy({ left: e.left + e.width / 2 - (c.left + c.width / 2), behavior: 'smooth' });
  }, [value]);

  return (
    <section className={compact ? 'mt-4' : 'mt-6'} aria-label={t('loadout.title')}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-fg">{t('loadout.title')}</p>
        <span className="badge-neutral">{t('loadout.hint')}</span>
      </div>

      <div className="panel">
        {/* ── selected blaster ── */}
        <div className="flex items-center gap-4 p-4">
          <div className="grid h-16 w-20 shrink-0 place-items-center rounded-xl bg-surface-2 ring-1 ring-inset ring-border">
            <WeaponIcon id={selected.id} className="h-12 w-16" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-base font-extrabold text-fg">{t(selected.nameKey)}</p>
            <p className="mt-0.5 text-xs text-fg-soft">{t('loadout.sub')}</p>
            <div className="mt-2.5 grid gap-1.5">
              <StatRow icon="zap" label={t('loadout.power')} value={stats.power} />
              <StatRow icon="activity" label={t('loadout.speed')} value={stats.speed} />
              <StatRow icon="target" label={t('loadout.control')} value={stats.control} />
            </div>
          </div>
        </div>

        {/* ── strip ── */}
        <div className="relative border-t border-border px-10 py-3">
          <Arrow dir="left" disabled={atStart} onClick={() => go(-1)} label={t('loadout.prev')} />
          <div ref={scrollRef} className="scrollbar-none flex snap-x gap-2 overflow-x-auto" role="radiogroup" aria-label={t('loadout.title')}>
            {WEAPONS.map((w) => {
              const active = w.id === value;
              return (
                <button
                  key={w.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-active={active}
                  onClick={() => onChange(w.id)}
                  className={`relative w-[96px] shrink-0 snap-center rounded-xl border p-2 text-center transition ${
                    active
                      ? 'border-brand bg-brand-50 shadow-xs'
                      : 'border-border bg-surface hover:border-border-strong hover:bg-surface-2'
                  }`}
                >
                  {active && (
                    <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-brand text-white ring-2 ring-surface">
                      <Icon name="check" className="h-3 w-3" />
                    </span>
                  )}
                  <div className="grid h-10 w-full place-items-center">
                    <WeaponIcon id={w.id} className="h-9 w-12" />
                  </div>
                  <p className={`mt-1 line-clamp-2 text-[11px] font-bold leading-tight ${active ? 'text-brand-700' : 'text-fg-soft'}`}>{t(w.nameKey)}</p>
                </button>
              );
            })}
          </div>
          <Arrow dir="right" disabled={atEnd} onClick={() => go(1)} label={t('loadout.next')} />
        </div>
      </div>
    </section>
  );
}

function Arrow({ dir, disabled, onClick, label }: { dir: 'left' | 'right'; disabled: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`absolute top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg border border-border bg-surface text-fg-soft shadow-xs transition ${
        dir === 'left' ? 'left-1.5' : 'right-1.5'
      } ${disabled ? 'cursor-not-allowed opacity-30' : 'hover:border-border-strong hover:text-fg'}`}
    >
      <Icon name={dir === 'left' ? 'chevronLeft' : 'chevronRight'} className="h-4 w-4" />
    </button>
  );
}

/** One stat as an icon + label + 5 dots (1–5 filled). */
function StatRow({ icon, label, value }: { icon: IconName; label: string; value: number }) {
  const filled = Math.max(1, Math.min(5, Math.round(value / 20)));
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-fg-soft">
        <Icon name={icon} className="h-3.5 w-3.5 text-fg-faint" />
        {label}
      </span>
      <span className="flex gap-1" aria-label={`${filled}/5`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className={`h-1.5 w-3 rounded-full ${i < filled ? 'bg-brand' : 'bg-border'}`} />
        ))}
      </span>
    </div>
  );
}
