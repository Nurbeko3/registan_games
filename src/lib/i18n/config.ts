/** i18n config — three languages, offline-first, no routing/middleware.
 *  The active locale lives in the Zustand store (persisted to localStorage). */

export type Locale = 'uz' | 'ru' | 'en';

export const LOCALES: { id: Locale; flag: string; native: string }[] = [
  { id: 'uz', flag: '🇺🇿', native: "O'zbekcha" },
  { id: 'ru', flag: '🇷🇺', native: 'Русский' },
  { id: 'en', flag: '🇬🇧', native: 'English' },
];

/** Default = the server-rendered locale. Keep in sync with the store default. */
export const DEFAULT_LOCALE: Locale = 'uz';
