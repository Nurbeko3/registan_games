'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '@/store/useGame';
import { LOCALES, useLocale, useT } from '@/lib/i18n';
import { Icon } from '@/components/ui/Icon';

/** Compact language picker — code button → menu of the 3 languages. */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const t = useT();
  const locale = useLocale();
  const setLocale = useGame((s) => s.setLocale);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LOCALES.find((l) => l.id === locale) ?? LOCALES[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`${t('lang.label')} — ${current.native}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-bold text-fg-soft shadow-xs transition hover:border-border-strong hover:text-fg"
      >
        <Icon name="planet" className="h-4 w-4" />
        <span className="uppercase tracking-wide">{current.id}</span>
        <Icon name="chevronDown" className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            role="listbox"
            aria-label={t('lang.label')}
            className="absolute right-0 z-50 mt-1.5 w-44 overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-lg"
          >
            {LOCALES.map((l) => {
              const active = l.id === locale;
              return (
                <li key={l.id} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onClick={() => { setLocale(l.id); setOpen(false); }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-semibold transition ${
                      active ? 'bg-brand-50 text-brand-700' : 'text-fg hover:bg-surface-2'
                    }`}
                  >
                    <span className="w-7 text-2xs font-bold uppercase tracking-wide text-fg-faint">{l.id}</span>
                    <span className="flex-1">{l.native}</span>
                    {active && <Icon name="check" className="h-4 w-4" />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
