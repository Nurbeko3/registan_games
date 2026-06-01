/** The game world — 5 zones unlocked progressively by total stars earned.
 *  4 content zones (2 games each = 8 games) + a final celebration planet. */

export interface Zone {
  slug: string;
  title: string;
  emoji: string;
  description: string;
  color: string;
  unlockStars: number; // total stars needed to enter
  games: string[]; // game slugs
  finale?: boolean;
}

export const ZONES: Zone[] = [
  {
    slug: 'coding-forest',
    title: 'Coding Forest',
    emoji: '🌳',
    description: 'Where every coder begins. Learn to give instructions!',
    color: 'from-mint to-mint-600',
    unlockStars: 0,
    games: ['robot-maze', 'memory-match', 'pattern-pop'],
  },
  {
    slug: 'algorithm-mountain',
    title: 'Algorithm Mountain',
    emoji: '⛰️',
    description: 'Climb high by mastering numbers and order.',
    color: 'from-sky to-sky-600',
    unlockStars: 3,
    games: ['binary-challenge', 'algorithm-race', 'loop-output'],
  },
  {
    slug: 'ai-city',
    title: 'AI City',
    emoji: '🤖',
    description: 'A bright city where machines learn to think.',
    color: 'from-grape to-grape-600',
    unlockStars: 8,
    games: ['fix-the-bug', 'code-adventure'],
  },
  {
    slug: 'web-kingdom',
    title: 'Web Kingdom',
    emoji: '👑',
    description: 'Build wonders and solve royal puzzles.',
    color: 'from-bubble to-bubble-600',
    unlockStars: 14,
    games: ['logic-puzzle', 'treasure-hunt', 'quick-math'],
  },
  {
    slug: 'python-planet',
    title: 'Python Planet',
    emoji: '🪐',
    description: 'The champion’s world — for true code heroes!',
    color: 'from-mango to-bubble',
    unlockStars: 20,
    games: [],
    finale: true,
  },
];

export const getZone = (slug: string): Zone | undefined => ZONES.find((z) => z.slug === slug);

/** Which zone a game belongs to. */
export const zoneOfGame = (gameSlug: string): Zone | undefined => ZONES.find((z) => z.games.includes(gameSlug));
