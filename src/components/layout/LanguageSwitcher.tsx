'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '@/store/useGame';
import { LOCALES, useLocale } from '@/lib/i18n';

/** Compact language picker — flag button → dropdown of the 3 languages. */
export function LanguageSwitcher() {
  const locale = useLocale();
  const setLocale = useGame((s) => s.setLocale);
  const [open, setOpen] = useState(false);
  const current = LOCALES.find((l) => l.id === locale) ?? LOCALES[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Language"
        className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-lg shadow-card"
      >
        <span>{current.flag}</span>
        <span className="text-xs font-extrabold text-ink-faint">{current.id.toUpperCase()}</span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.ul
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              className="absolute right-0 z-50 mt-2 w-40 overflow-hidden rounded-2xl bg-white p-1 shadow-toy ring-1 ring-grape-100"
            >
              {LOCALES.map((l) => (
                <li key={l.id}>
                  <button
                    onClick={() => { setLocale(l.id); setOpen(false); }}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-bold transition ${
                      l.id === locale ? 'bg-grape text-white' : 'hover:bg-grape-50'
                    }`}
                  >
                    <span className="text-lg">{l.flag}</span>
                    <span className="flex-1">{l.native}</span>
                    {l.id === locale && <span>✓</span>}
                  </button>
                </li>
              ))}
            </motion.ul>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
