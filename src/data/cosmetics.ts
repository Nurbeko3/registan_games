/** Unlockable characters (avatars) and themes — bought with coins or unlocked
 *  by level. Purely cosmetic, stored in the persisted game store. */

export interface Avatar {
  id: string;
  /** Wire/canvas glyph — presence meta and the arena canvas still ship/draw
   *  this, so it must stay a single emoji. Also the fallback when `img` is unset. */
  emoji: string;
  name: string;
  cost: number; // coins; 0 = free/default
  unlockLevel?: number;
  /** Pixel-art portrait under public/ (DiceBear pixel-art CC0 / bottts, fetched
   *  by scripts/fetch-avatars.mjs). UI surfaces prefer this over the emoji. */
  img?: string;
}

export const AVATARS: Avatar[] = [
  { id: 'kid', emoji: '🧒', name: 'Rookie', cost: 0, img: '/avatars/kid.svg' },
  { id: 'boy', emoji: '👦', name: 'Boy', cost: 0, img: '/avatars/boy.svg' },
  { id: 'girl', emoji: '👧', name: 'Girl', cost: 0, img: '/avatars/girl.svg' },
  { id: 'robot', emoji: '🤖', name: 'Byte Bot', cost: 50, img: '/avatars/robot.svg' },
  { id: 'fox', emoji: '🦊', name: 'Clever Fox', cost: 80 },
  { id: 'cat', emoji: '🐱', name: 'Code Cat', cost: 80 },
  { id: 'alien', emoji: '👾', name: 'Pixel Alien', cost: 120, img: '/avatars/alien.svg' },
  { id: 'wizard', emoji: '🧙', name: 'Loop Wizard', cost: 150, unlockLevel: 5, img: '/avatars/wizard.svg' },
  { id: 'spark', emoji: '🔴', name: 'Spark Bot', cost: 200, unlockLevel: 6, img: '/avatars/spark.svg' },
  { id: 'dragon', emoji: '🐲', name: 'Algo Dragon', cost: 250, unlockLevel: 8 },
  { id: 'astronaut', emoji: '🧑‍🚀', name: 'Space Coder', cost: 300, unlockLevel: 10, img: '/avatars/astronaut.svg' },
  { id: 'nova', emoji: '🟣', name: 'Nova Bot', cost: 350, unlockLevel: 12, img: '/avatars/nova.svg' },
];

export interface Theme {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  // CSS gradient applied to the app background
  bg: string;
}

export const THEMES: Theme[] = [
  { id: 'cloud', name: 'Daydream', emoji: '☁️', cost: 0, bg: 'bg-cloud' },
  { id: 'sunset', name: 'Sunset', emoji: '🌅', cost: 60, bg: 'bg-gradient-to-b from-bubble/20 to-mango/20' },
  { id: 'ocean', name: 'Ocean', emoji: '🌊', cost: 60, bg: 'bg-gradient-to-b from-sky/20 to-mint/20' },
  { id: 'galaxy', name: 'Galaxy', emoji: '🌌', cost: 150, bg: 'bg-gradient-to-b from-grape/25 to-ink/10' },
];

export const getAvatar = (id: string): Avatar => AVATARS.find((a) => a.id === id) ?? AVATARS[0];

/** Resolve from an id ('robot') OR the wire emoji ('🤖'). Presence/broadcast
 *  metas ship the emoji for backward-compat — receivers upgrade it to the
 *  pixel portrait when it maps to a known avatar; unknown strings return null. */
export const resolveAvatar = (idOrEmoji: string): Avatar | null =>
  AVATARS.find((a) => a.id === idOrEmoji || a.emoji === idOrEmoji) ?? null;
export const getTheme = (id: string): Theme => THEMES.find((t) => t.id === id) ?? THEMES[0];
