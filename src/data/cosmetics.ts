/** Unlockable characters (avatars) and themes — bought with coins or unlocked
 *  by level. Purely cosmetic, stored in the persisted game store. */

export interface Avatar {
  id: string;
  emoji: string;
  name: string;
  cost: number; // coins; 0 = free/default
  unlockLevel?: number;
}

export const AVATARS: Avatar[] = [
  { id: 'kid', emoji: '🧒', name: 'Rookie', cost: 0 },
  { id: 'robot', emoji: '🤖', name: 'Byte Bot', cost: 50 },
  { id: 'fox', emoji: '🦊', name: 'Clever Fox', cost: 80 },
  { id: 'cat', emoji: '🐱', name: 'Code Cat', cost: 80 },
  { id: 'alien', emoji: '👾', name: 'Pixel Alien', cost: 120 },
  { id: 'wizard', emoji: '🧙', name: 'Loop Wizard', cost: 150, unlockLevel: 5 },
  { id: 'dragon', emoji: '🐲', name: 'Algo Dragon', cost: 250, unlockLevel: 8 },
  { id: 'astronaut', emoji: '🧑‍🚀', name: 'Space Coder', cost: 300, unlockLevel: 10 },
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
export const getTheme = (id: string): Theme => THEMES.find((t) => t.id === id) ?? THEMES[0];
