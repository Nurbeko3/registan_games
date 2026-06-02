'use client';

import { useMemo } from 'react';
import { useGame, useHydrated } from '@/store/useGame';
import { DEFAULT_LOCALE, type Locale } from './config';
import { TRANSLATIONS } from './translations';

export type { Locale } from './config';
export { LOCALES, DEFAULT_LOCALE } from './config';

type Vars = Record<string, string | number>;

/** Translate a key for a given locale. Falls back: locale → English → the key. */
export function translate(locale: Locale, key: string, vars?: Vars): string {
  const dict = TRANSLATIONS[locale] ?? TRANSLATIONS[DEFAULT_LOCALE];
  let s = dict[key] ?? TRANSLATIONS.en[key] ?? key;
  if (vars) for (const k of Object.keys(vars)) s = s.replaceAll(`{${k}}`, String(vars[k]));
  return s;
}

/** Hook → a `t(key, vars?)` function bound to the current locale.
 *  Before hydration it uses DEFAULT_LOCALE so SSR and first client paint match. */
export function useT() {
  const hydrated = useHydrated();
  const locale = useGame((s) => s.locale);
  const active = hydrated ? locale : DEFAULT_LOCALE;
  return useMemo(() => (key: string, vars?: Vars) => translate(active, key, vars), [active]);
}

/** The active locale (hydration-safe). */
export function useLocale(): Locale {
  const hydrated = useHydrated();
  const locale = useGame((s) => s.locale);
  return hydrated ? locale : DEFAULT_LOCALE;
}
