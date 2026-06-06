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
  group: AchievementGroupId;
  title: string;
  titleKey: string;
  description: string;
  descriptionKey: string;
  hintKey: string;
  emoji: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  check: (s: AchievementSnapshot) => boolean;
}

export type AchievementGroupId = 'start' | 'stars' | 'growth' | 'arena';

export interface AchievementGroup {
  id: AchievementGroupId;
  emoji: string;
  titleKey: string;
  subtitleKey: string;
}

export const ACHIEVEMENT_GROUPS: AchievementGroup[] = [
  {
    id: 'start',
    emoji: '🌱',
    titleKey: 'ach.group.start.title',
    subtitleKey: 'ach.group.start.subtitle',
  },
  {
    id: 'stars',
    emoji: '⭐',
    titleKey: 'ach.group.stars.title',
    subtitleKey: 'ach.group.stars.subtitle',
  },
  {
    id: 'growth',
    emoji: '🚀',
    titleKey: 'ach.group.growth.title',
    subtitleKey: 'ach.group.growth.subtitle',
  },
  {
    id: 'arena',
    emoji: '⚔️',
    titleKey: 'ach.group.arena.title',
    subtitleKey: 'ach.group.arena.subtitle',
  },
];

export const ACHIEVEMENTS: Achievement[] = [
  { code: 'FIRST_WIN', group: 'start', title: 'First Win', titleKey: 'ach.firstWin.title', description: 'Finish your first game.', descriptionKey: 'ach.firstWin.desc', hintKey: 'ach.firstWin.hint', emoji: '🎉', rarity: 'common', check: (s) => s.gamesCompleted >= 1 },
  { code: 'PERFECTIONIST', group: 'start', title: 'Perfectionist', titleKey: 'ach.perfectionist.title', description: 'Get 3 stars in a game.', descriptionKey: 'ach.perfectionist.desc', hintKey: 'ach.perfectionist.hint', emoji: '💯', rarity: 'rare', check: (s) => s.perfectGames >= 1 },
  { code: 'ALL_GAMES', group: 'start', title: 'Game Champion', titleKey: 'ach.allGames.title', description: 'Win all 16 games.', descriptionKey: 'ach.allGames.desc', hintKey: 'ach.allGames.hint', emoji: '🏆', rarity: 'legendary', check: (s) => s.gamesCompleted >= 16 },
  { code: 'STAR_COLLECTOR', group: 'stars', title: 'Star Collector', titleKey: 'ach.starCollector.title', description: 'Earn 10 stars.', descriptionKey: 'ach.starCollector.desc', hintKey: 'ach.starCollector.hint', emoji: '⭐', rarity: 'common', check: (s) => s.totalStars >= 10 },
  { code: 'EXPLORER', group: 'stars', title: 'World Explorer', titleKey: 'ach.explorer.title', description: 'Unlock 3 worlds.', descriptionKey: 'ach.explorer.desc', hintKey: 'ach.explorer.hint', emoji: '🗺️', rarity: 'rare', check: (s) => s.zonesUnlocked >= 3 },
  { code: 'CHAMPION', group: 'stars', title: 'Code Hero', titleKey: 'ach.champion.title', description: 'Unlock Python Planet.', descriptionKey: 'ach.champion.desc', hintKey: 'ach.champion.hint', emoji: '🪐', rarity: 'legendary', check: (s) => s.totalStars >= 20 },
  { code: 'STREAK_3', group: 'growth', title: 'On Fire', titleKey: 'ach.streak3.title', description: 'Keep a 3-day streak.', descriptionKey: 'ach.streak3.desc', hintKey: 'ach.streak3.hint', emoji: '🔥', rarity: 'rare', check: (s) => s.streak >= 3 },
  { code: 'LEVEL_5', group: 'growth', title: 'Rising Star', titleKey: 'ach.level5.title', description: 'Reach Level 5.', descriptionKey: 'ach.level5.desc', hintKey: 'ach.level5.hint', emoji: '🚀', rarity: 'epic', check: (s) => s.level >= 5 },
  { code: 'RICH', group: 'growth', title: 'Coin Master', titleKey: 'ach.rich.title', description: 'Save up 200 coins.', descriptionKey: 'ach.rich.desc', hintKey: 'ach.rich.hint', emoji: '💰', rarity: 'epic', check: (s) => s.coins >= 200 },
  // ── Battle Learn Arena ──
  { code: 'ARENA_ROOKIE', group: 'arena', title: 'Arena Rookie', titleKey: 'ach.arenaRookie.title', description: 'Win your first Arena match.', descriptionKey: 'ach.arenaRookie.desc', hintKey: 'ach.arenaRookie.hint', emoji: '⚔️', rarity: 'rare', check: (s) => s.arenaWins >= 1 },
  { code: 'ARENA_SCHOLAR', group: 'arena', title: 'Battle Scholar', titleKey: 'ach.arenaScholar.title', description: 'Answer 25 Arena questions right.', descriptionKey: 'ach.arenaScholar.desc', hintKey: 'ach.arenaScholar.hint', emoji: '📚', rarity: 'epic', check: (s) => s.arenaCorrect >= 25 },
  { code: 'ARENA_LEGEND', group: 'arena', title: 'Arena Legend', titleKey: 'ach.arenaLegend.title', description: 'Win 5 Arena matches.', descriptionKey: 'ach.arenaLegend.desc', hintKey: 'ach.arenaLegend.hint', emoji: '🥇', rarity: 'legendary', check: (s) => s.arenaWins >= 5 },
];

export const RARITY_RING: Record<Achievement['rarity'], string> = {
  common: 'ring-mint',
  rare: 'ring-sky',
  epic: 'ring-grape',
  legendary: 'ring-mango',
};
