'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { WEAPONS, type WeaponId, getWeapon, getWeaponStats } from '@/lib/arena/weapons';
import { useT } from '@/lib/i18n';
import { WeaponIcon } from './WeaponIcon';

/** A playful, kid-friendly blaster picker: a big "this is your blaster" card with
 *  simple 1–5 dot ratings (no abstract % bars), plus a colorful tap-to-change row. */

/** Per-blaster accent gradient — gives each card its own happy colour. */
const ACCENT: Record<WeaponId, string> = {
  'training-rifle': 'from-grape to-grape-400',
  'energy-rifle': 'from-sky to-grape',
  'burst-rifle': 'from-grape to-bubble',
  smg: 'from-mint to-sky',
  shotgun: 'from-bubble to-mango',
  sniper: 'from-grape-700 to-grape',
  support: 'from-sky to-mint',
  'learning-blaster': 'from-mango to-sun',
};

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
    <section className={compact ? 'mt-4' : 'mt-5'}>
      <div className="mb-2 flex items-center justify-between">
        <p className="font-display font-extrabold">{t('loadout.title')}</p>
        <span className="rounded-full bg-grape-50 px-2.5 py-1 text-[11px] font-extrabold text-grape">{t('loadout.hint')}</span>
      </div>

      {/* ── your blaster (big & friendly) ── */}
      <div className="rounded-[26px] bg-white p-4 shadow-card ring-1 ring-grape-100/80">
        <div className="flex items-center gap-3.5">
          <div className={`grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-gradient-to-br ${ACCENT[selected.id]} shadow-card`}>
            <WeaponIcon id={selected.id} className="h-14 w-16 drop-shadow" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-2xl leading-none">{selected.emoji}</span>
              <p className="truncate font-display text-xl font-extrabold leading-tight">{t(selected.nameKey)}</p>
            </div>
            <p className="mt-0.5 text-xs font-bold text-ink-soft">{t('loadout.sub')}</p>
          </div>
        </div>

        <div className="mt-3.5 space-y-2.5">
          <StatRow emoji="💪" label={t('loadout.power')} value={stats.power} />
          <StatRow emoji="⚡" label={t('loadout.speed')} value={stats.speed} />
          <StatRow emoji="🎯" label={t('loadout.control')} value={stats.control} />
        </div>
      </div>

      {/* ── tap an arrow (or swipe) to change blaster ── */}
      <div className="relative mt-3 px-9">
        <Arrow dir="left" disabled={atStart} onClick={() => go(-1)} label={t('loadout.prev')} />
        <div
          ref={scrollRef}
          className="flex snap-x gap-2.5 overflow-x-auto pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {WEAPONS.map((w) => {
            const active = w.id === value;
            return (
              <motion.button
                key={w.id}
                data-active={active}
                whileTap={{ scale: 0.94 }}
                onClick={() => onChange(w.id)}
                aria-pressed={active}
                className={`relative w-[104px] shrink-0 snap-center rounded-2xl p-2.5 text-center transition ${
                  active
                    ? 'scale-[1.04] bg-white shadow-card ring-2 ring-grape'
                    : 'bg-grape-50/70 ring-1 ring-transparent hover:bg-grape-100'
                }`}
              >
                {active && (
                  <span className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-grape text-[13px] font-extrabold text-white shadow-card ring-2 ring-white">
                    ✓
                  </span>
                )}
                <div className={`mx-auto grid h-12 w-full place-items-center rounded-xl bg-gradient-to-br ${ACCENT[w.id]} ${active ? '' : 'opacity-90'}`}>
                  <WeaponIcon id={w.id} className="h-9 w-12" />
                </div>
                <div className="mt-1.5 flex items-center justify-center gap-1">
                  <span className="text-sm leading-none">{w.emoji}</span>
                  <p className="line-clamp-2 font-display text-[11px] font-extrabold leading-tight">{t(w.nameKey)}</p>
                </div>
              </motion.button>
            );
          })}
        </div>
        <Arrow dir="right" disabled={atEnd} onClick={() => go(1)} label={t('loadout.next')} />
      </div>
    </section>
  );
}

/** Big, kid-friendly round arrow that switches to the prev/next blaster. */
function Arrow({ dir, disabled, onClick, label }: { dir: 'left' | 'right'; disabled: boolean; onClick: () => void; label: string }) {
  return (
    <motion.button
      type="button"
      whileTap={disabled ? undefined : { scale: 0.88 }}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`absolute top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white text-grape shadow-card ring-1 ring-grape-100 transition ${
        dir === 'left' ? 'left-0' : 'right-0'
      } ${disabled ? 'cursor-not-allowed opacity-30' : 'hover:bg-grape-50 active:bg-grape-100'}`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        {dir === 'left' ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
      </svg>
    </motion.button>
  );
}

/** One stat as an emoji + label + 5 friendly dots (1–5 filled). */
function StatRow({ emoji, label, value }: { emoji: string; label: string; value: number }) {
  const filled = Math.max(1, Math.min(5, Math.round(value / 20)));
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-sm font-extrabold text-ink">
        <span className="text-base leading-none">{emoji}</span>
        {label}
      </span>
      <span className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full ${i < filled ? 'bg-gradient-to-r from-grape to-sky' : 'bg-grape-100'}`}
          />
        ))}
      </span>
    </div>
  );
}
