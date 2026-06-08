/**
 * Codecaster level registry.
 *
 * Import order determines the in-game sequence.  Each file exports a single
 * `CodecasterLevel` as its default export; this index collects them into the
 * canonical ordered array and exposes a safe `getLevel` lookup.
 */

import type { CodecasterLevel } from '../types';

import L01 from './L01';
import L02 from './L02';
import L03 from './L03';
import L04 from './L04';
import L05 from './L05';
import L06 from './L06';
import L07 from './L07';
import L08 from './L08';
import L09 from './L09';
import L10 from './L10';

export const CODECASTER_LEVELS: CodecasterLevel[] = [
  L01,
  L02,
  L03,
  L04,
  L05,
  L06,
  L07,
  L08,
  L09,
  L10,
];

/**
 * Look up a level by its id string (e.g. 'L01').
 * Returns undefined when the id is not found — callers must handle this
 * gracefully (no throws, so server-side validation stays safe).
 */
export function getLevel(id: string): CodecasterLevel | undefined {
  return CODECASTER_LEVELS.find((l) => l.id === id);
}
