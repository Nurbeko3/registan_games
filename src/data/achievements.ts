/** Achievement definitions. Each has a pure predicate over the game snapshot,
 *  so new badges are just data + a one-line check. */

export interface AchievementSnapshot {
  xp: number;
  level: number;
  coins: number;
  streak: number;
  totalStars: number;
  gamesCompleted: number;
  perfectGames: number; // games finished with 3 stars
  zonesUnlocked: number;
  arenaWins: number; // Battle Learn Arena matches won
  arenaCorrect: number; // questions answered correctly in the arena learning pod
}

export interface Achievement {
  code: string;
  title: string;
  description: string;
  emoji: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  check: (s: AchievementSnapshot) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { code: 'FIRST_WIN', title: 'First Win', description: 'Finish your first game.', emoji: '🎉', rarity: 'common', check: (s) => s.gamesCompleted >= 1 },
  { code: 'STAR_COLLECTOR', title: 'Star Collector', description: 'Earn 10 stars.', emoji: '⭐', rarity: 'common', check: (s) => s.totalStars >= 10 },
  { code: 'PERFECTIONIST', title: 'Perfectionist', description: 'Get 3 stars in a game.', emoji: '💯', rarity: 'rare', check: (s) => s.perfectGames >= 1 },
  { code: 'EXPLORER', title: 'World Explorer', description: 'Unlock 3 worlds.', emoji: '🗺️', rarity: 'rare', check: (s) => s.zonesUnlocked >= 3 },
  { code: 'STREAK_3', title: 'On Fire', description: 'Keep a 3-day streak.', emoji: '🔥', rarity: 'rare', check: (s) => s.streak >= 3 },
  { code: 'LEVEL_5', title: 'Rising Star', description: 'Reach Level 5.', emoji: '🚀', rarity: 'epic', check: (s) => s.level >= 5 },
  { code: 'RICH', title: 'Coin Master', description: 'Save up 200 coins.', emoji: '💰', rarity: 'epic', check: (s) => s.coins >= 200 },
  { code: 'ALL_GAMES', title: 'Game Champion', description: 'Win all 11 games.', emoji: '🏆', rarity: 'legendary', check: (s) => s.gamesCompleted >= 11 },
  { code: 'CHAMPION', title: 'Code Hero', description: 'Unlock Python Planet.', emoji: '🪐', rarity: 'legendary', check: (s) => s.totalStars >= 20 },
  // ── Battle Learn Arena ──
  { code: 'ARENA_ROOKIE', title: 'Arena Rookie', description: 'Win your first Arena match.', emoji: '⚔️', rarity: 'rare', check: (s) => s.arenaWins >= 1 },
  { code: 'ARENA_SCHOLAR', title: 'Battle Scholar', description: 'Answer 25 Arena questions right.', emoji: '📚', rarity: 'epic', check: (s) => s.arenaCorrect >= 25 },
  { code: 'ARENA_LEGEND', title: 'Arena Legend', description: 'Win 5 Arena matches.', emoji: '🥇', rarity: 'legendary', check: (s) => s.arenaWins >= 5 },
];

export const RARITY_RING: Record<Achievement['rarity'], string> = {
  common: 'ring-mint',
  rare: 'ring-sky',
  epic: 'ring-grape',
  legendary: 'ring-mango',
};
