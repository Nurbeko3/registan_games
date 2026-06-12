/**
 * Case content localisation registry + resolver.
 *
 * `localizeCase(caseDef, locale)` returns the case with uz/ru DISPLAY text
 * merged on top of the canonical English `CaseDef`. English (and any missing
 * translation) returns the case unchanged. Answer keys / choice order / concept
 * flags are never touched, so server scoring is locale-independent.
 */

import type { Locale } from '@/lib/i18n/config';
import type { CaseDef } from '../types';
import { applyCaseL10n, type CaseTranslations } from './types';
import case01L10n from './case01';
import case02L10n from './case02';
import case03L10n from './case03';
import case04L10n from './case04';
import case05L10n from './case05';

const TRANSLATIONS: Record<string, CaseTranslations> = {
  case01: case01L10n,
  case02: case02L10n,
  case03: case03L10n,
  case04: case04L10n,
  case05: case05L10n,
};

/** Localise a full canonical case for display in the active locale. */
export function localizeCase(c: CaseDef, locale: Locale): CaseDef {
  if (locale === 'en') return c;
  return applyCaseL10n(c, TRANSLATIONS[c.id]?.[locale]);
}

/** Localise just a case's title — for pickers/lists that don't need the body. */
export function localizeCaseTitle(c: CaseDef, locale: Locale): string {
  if (locale === 'en') return c.title;
  return TRANSLATIONS[c.id]?.[locale]?.title || c.title;
}

export { TRANSLATIONS as CASE_TRANSLATIONS };
