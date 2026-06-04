'use client';

import { motion } from 'framer-motion';
import { WEAPONS, type WeaponId, getWeapon, getWeaponStats } from '@/lib/arena/weapons';
import { useT } from '@/lib/i18n';
import { Icon } from '@/components/ui/Icon';
import { WeaponIcon } from './WeaponIcon';

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

  return (
    <section className={compact ? 'mt-4' : 'mt-5'}>
      <div className="mb-2 flex items-center justify-between">
        <p className="font-display font-extrabold">{t('loadout.title')}</p>
        <span className="rounded-full bg-grape-50 px-2.5 py-1 text-[11px] font-extrabold text-grape">{t('loadout.hint')}</span>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-grape-100/80">
        <div className="flex snap-x gap-2 overflow-x-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {WEAPONS.map((w) => {
            const active = w.id === value;
            return (
              <motion.button
                key={w.id}
                whileTap={{ scale: 0.97 }}
                onClick={() => onChange(w.id)}
                className={`snap-center rounded-2xl p-2 text-left transition ${
                  active ? 'min-w-[190px] bg-ink text-white ring-2 ring-sun' : 'min-w-[132px] bg-grape-50 text-ink hover:bg-grape-100'
                }`}
              >
                <WeaponIcon id={w.id} className={active ? 'h-16 w-full' : 'h-12 w-full'} />
                <p className="mt-1 truncate font-display text-sm font-extrabold">{t(w.nameKey)}</p>
                {active && <p className="text-[11px] font-bold text-white/65">{t('loadout.selected')}</p>}
              </motion.button>
            );
          })}
        </div>

        <div className="border-t border-grape-100 px-3 py-3">
          <div className="flex items-center gap-3">
            <WeaponIcon id={selected.id} className="h-16 w-28 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-extrabold leading-tight">{t(selected.nameKey)}</p>
              <p className="text-xs font-bold text-ink-soft">{t('loadout.sub')}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat label={t('loadout.power')} value={stats.power} />
            <Stat label={t('loadout.speed')} value={stats.speed} />
            <Stat label={t('loadout.control')} value={stats.control} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-ink-faint">
        <Icon name="spark" className="h-3 w-3" /> {label}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-grape-100">
        <div className="h-full rounded-full bg-gradient-to-r from-grape to-sky" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
