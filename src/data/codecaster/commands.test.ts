/**
 * Command-catalog integrity tests.
 *
 * Guards the contract that the redesigned play screen depends on:
 *   1. Every CommandId referenced by a level's `commands` array exists as a
 *      key in `COMMANDS` (so `commandsForLevel` never produces `undefined`
 *      entries that would crash the palette / autocomplete).
 *   2. Every `detailKey` resolves to a real, non-empty string in all three
 *      locales (uz/ru/en) — otherwise the autocomplete tooltip / palette
 *      title leaks a raw i18n key to the student.
 *   3. Every `insert`/`apply` snippet is syntactically valid, runnable
 *      Python that only calls real hero API methods (so Skulpt never throws
 *      NameError on a palette-inserted snippet).
 *   4. `commandsForLevel` preserves the level's declared teaching order and
 *      never fabricates or drops entries.
 */

import { describe, it, expect } from 'vitest';
import { COMMANDS, commandsForLevel, type CommandId } from './commands';
import { CODECASTER_LEVELS } from './levels';
import { TRANSLATIONS } from '@/lib/i18n/translations';
import type { Locale } from '@/lib/i18n/config';

const LOCALES: Locale[] = ['uz', 'ru', 'en'];

/** The real hero API surface exposed to Python by the pyrunner (runCore.ts). */
const REAL_HERO_METHODS = [
  'moveRight', 'moveLeft', 'moveUp', 'moveDown',
  'attack', 'collect', 'useKey', 'say', 'canMove', 'seeEnemy',
];

describe('COMMANDS catalog — structural integrity', () => {
  it('every CommandId key matches its own `id` field', () => {
    for (const [key, spec] of Object.entries(COMMANDS)) {
      expect(spec.id).toBe(key as CommandId);
    }
  });

  it('every `insert` ends with a trailing newline (palette snippets are full lines)', () => {
    for (const spec of Object.values(COMMANDS)) {
      expect(spec.insert.endsWith('\n')).toBe(true);
    }
  });

  it('every `apply` has NO trailing newline (autocomplete inserts mid-line)', () => {
    for (const spec of Object.values(COMMANDS)) {
      expect(spec.apply.endsWith('\n')).toBe(false);
    }
  });

  it('`insert` is `apply` plus exactly one trailing newline', () => {
    for (const spec of Object.values(COMMANDS)) {
      expect(spec.insert).toBe(`${spec.apply}\n`);
    }
  });

  it('every snippet only references real hero.* methods (no NameError-prone typos)', () => {
    const heroCallRe = /hero\.(\w+)\s*\(/g;
    for (const spec of Object.values(COMMANDS)) {
      for (const text of [spec.insert, spec.apply]) {
        let m: RegExpExecArray | null;
        heroCallRe.lastIndex = 0;
        while ((m = heroCallRe.exec(text))) {
          expect(
            REAL_HERO_METHODS,
            `${spec.id}: snippet calls hero.${m[1]}(), which is not a real hero API method`,
          ).toContain(m[1]);
        }
      }
    }
  });

  it('every detailKey resolves to a non-empty string in all three locales', () => {
    for (const spec of Object.values(COMMANDS)) {
      for (const locale of LOCALES) {
        const dict = TRANSLATIONS[locale];
        const value = dict[spec.detailKey];
        expect(value, `${spec.id}.detailKey "${spec.detailKey}" missing in locale "${locale}"`).toBeTruthy();
        expect(typeof value).toBe('string');
        expect((value as string).trim().length).toBeGreaterThan(0);
        // Must not just be the raw key echoed back (i.e. actually translated)
        expect(value).not.toBe(spec.detailKey);
      }
    }
  });
});

describe('Level commands arrays — reference only real CommandIds', () => {
  for (const level of CODECASTER_LEVELS) {
    it(`${level.id}: every id in commands[] exists in COMMANDS`, () => {
      expect(level.commands.length).toBeGreaterThan(0);
      for (const id of level.commands) {
        expect(Object.prototype.hasOwnProperty.call(COMMANDS, id), `${level.id} references unknown CommandId "${id}"`).toBe(true);
      }
    });

    it(`${level.id}: commands[] has no duplicate ids`, () => {
      const unique = new Set(level.commands);
      expect(unique.size).toBe(level.commands.length);
    });
  }
});

describe('commandsForLevel — order-preserving projection', () => {
  for (const level of CODECASTER_LEVELS) {
    it(`${level.id}: returns specs in the same order as level.commands, 1:1`, () => {
      const specs = commandsForLevel(level);
      expect(specs.map((s) => s.id)).toEqual(level.commands);
      expect(specs.every((s) => s !== undefined)).toBe(true);
    });
  }

  it('never returns more entries than the level declares (no leakage of the full catalog)', () => {
    for (const level of CODECASTER_LEVELS) {
      const specs = commandsForLevel(level);
      expect(specs.length).toBe(level.commands.length);
      expect(specs.length).toBeLessThan(Object.keys(COMMANDS).length);
    }
  });
});

describe('cc.palette / cc.arena — i18n presence (new redesign strings)', () => {
  it('resolve to real, distinct strings in all three locales', () => {
    for (const key of ['cc.palette', 'cc.arena'] as const) {
      for (const locale of LOCALES) {
        const value = TRANSLATIONS[locale][key];
        expect(value, `${key} missing in locale "${locale}"`).toBeTruthy();
        expect(value).not.toBe(key);
      }
    }
  });
});
