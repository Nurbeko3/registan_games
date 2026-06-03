/** BATTLE LEARN ARENA — weapon catalog.
 *
 *  Non-violent by design: these are colorful "blasters" that fire energy bolts
 *  in a game of tag. Each has the competitive-shooter knobs (damage, fire rate,
 *  reload, magazine, recoil, spread, range) so the arena reads like a real
 *  esport while staying kid-friendly. Names are i18n keys (see translations.ts).
 *
 *  Pure data — no React, no engine imports — so the engine, HUD and tests share it. */

export type WeaponId =
  | 'training-rifle'
  | 'energy-rifle'
  | 'burst-rifle'
  | 'smg'
  | 'shotgun'
  | 'sniper'
  | 'support'
  | 'learning-blaster';

export interface WeaponSpec {
  id: WeaponId;
  /** i18n key, e.g. 'weapon.energy-rifle.name'. */
  nameKey: string;
  /** English fallback name. */
  name: string;
  emoji: string;
  /** damage per bolt that lands (before headshot/crit multiplier). */
  damage: number;
  /** ms between shots (lower = faster). */
  fireRate: number;
  /** ms to reload a full magazine. */
  reloadMs: number;
  /** rounds per magazine. */
  magSize: number;
  /** rounds carried in reserve at spawn. */
  reserve: number;
  /** recoil kick multiplier (1 = baseline). */
  recoil: number;
  /** half-angle of the spread cone, radians (0 = laser-accurate). */
  spread: number;
  /** bolt travel speed (world units / sec). */
  bulletSpeed: number;
  /** bolt lifetime in ms → effective range. */
  rangeMs: number;
  /** bolts fired per trigger pull (shotgun > 1). */
  pellets: number;
  /** headshot/crit damage multiplier. */
  headshotMult: number;
}

/** Order here is the weapon-switch order (number keys 1..8 in the HUD). */
export const WEAPONS: WeaponSpec[] = [
  { id: 'training-rifle',  nameKey: 'weapon.training-rifle.name',  name: 'Training Rifle',  emoji: '🎯', damage: 20, fireRate: 240, reloadMs: 1400, magSize: 24, reserve: 96,  recoil: 0.7, spread: 0.03,  bulletSpeed: 380, rangeMs: 1600, pellets: 1, headshotMult: 1.5 },
  { id: 'energy-rifle',    nameKey: 'weapon.energy-rifle.name',    name: 'Energy Rifle',    emoji: '⚡', damage: 24, fireRate: 150, reloadMs: 1900, magSize: 30, reserve: 120, recoil: 1.0, spread: 0.05,  bulletSpeed: 420, rangeMs: 1500, pellets: 1, headshotMult: 1.6 },
  { id: 'burst-rifle',     nameKey: 'weapon.burst-rifle.name',     name: 'Burst Rifle',     emoji: '🔱', damage: 22, fireRate: 320, reloadMs: 1800, magSize: 30, reserve: 90,  recoil: 0.9, spread: 0.02,  bulletSpeed: 440, rangeMs: 1500, pellets: 3, headshotMult: 1.7 },
  { id: 'smg',             nameKey: 'weapon.smg.name',             name: 'SMG',             emoji: '💨', damage: 14, fireRate: 80,  reloadMs: 1700, magSize: 35, reserve: 140, recoil: 0.6, spread: 0.09,  bulletSpeed: 360, rangeMs: 1100, pellets: 1, headshotMult: 1.3 },
  { id: 'shotgun',         nameKey: 'weapon.shotgun.name',         name: 'Shotgun',         emoji: '🌟', damage: 11, fireRate: 700, reloadMs: 2400, magSize: 7,  reserve: 35,  recoil: 1.6, spread: 0.16,  bulletSpeed: 340, rangeMs: 650,  pellets: 8, headshotMult: 1.2 },
  { id: 'sniper',          nameKey: 'weapon.sniper.name',          name: 'Sniper',          emoji: '🔭', damage: 80, fireRate: 1300, reloadMs: 2600, magSize: 5, reserve: 20,  recoil: 1.8, spread: 0.005, bulletSpeed: 700, rangeMs: 2400, pellets: 1, headshotMult: 2.0 },
  { id: 'support',         nameKey: 'weapon.support.name',         name: 'Support',         emoji: '🛡️', damage: 18, fireRate: 110, reloadMs: 3200, magSize: 60, reserve: 120, recoil: 0.8, spread: 0.07,  bulletSpeed: 380, rangeMs: 1500, pellets: 1, headshotMult: 1.4 },
  { id: 'learning-blaster', nameKey: 'weapon.learning-blaster.name', name: 'Learning Blaster', emoji: '📘', damage: 16, fireRate: 200, reloadMs: 1500, magSize: 20, reserve: 80, recoil: 0.7, spread: 0.04, bulletSpeed: 400, rangeMs: 1400, pellets: 1, headshotMult: 1.5 },
];

const BY_ID: Record<WeaponId, WeaponSpec> = Object.fromEntries(
  WEAPONS.map((w) => [w.id, w]),
) as Record<WeaponId, WeaponSpec>;

export const getWeapon = (id: WeaponId): WeaponSpec => BY_ID[id];

/** The blaster every fighter spawns with. */
export const DEFAULT_WEAPON: WeaponId = 'energy-rifle';
