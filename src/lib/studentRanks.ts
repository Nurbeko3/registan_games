export interface StudentRank {
  id: string;
  titleKey: string;
  descriptionKey: string;
  emoji: string;
  minLevel: number;
  maxLevel: number | null;
  color: string;
}

export const STUDENT_RANKS: StudentRank[] = [
  {
    id: 'soldier',
    titleKey: 'rank.soldier.title',
    descriptionKey: 'rank.soldier.desc',
    emoji: '🪖',
    minLevel: 1,
    maxLevel: 10,
    color: 'from-mint to-mint-600',
  },
  {
    id: 'scout',
    titleKey: 'rank.scout.title',
    descriptionKey: 'rank.scout.desc',
    emoji: '🧭',
    minLevel: 11,
    maxLevel: 20,
    color: 'from-sky to-sky-600',
  },
  {
    id: 'ranger',
    titleKey: 'rank.ranger.title',
    descriptionKey: 'rank.ranger.desc',
    emoji: '🏹',
    minLevel: 21,
    maxLevel: 30,
    color: 'from-grape to-grape-400',
  },
  {
    id: 'knight',
    titleKey: 'rank.knight.title',
    descriptionKey: 'rank.knight.desc',
    emoji: '🛡️',
    minLevel: 31,
    maxLevel: 40,
    color: 'from-bubble to-grape',
  },
  {
    id: 'captain',
    titleKey: 'rank.captain.title',
    descriptionKey: 'rank.captain.desc',
    emoji: '🚀',
    minLevel: 41,
    maxLevel: 50,
    color: 'from-mango to-sun',
  },
  {
    id: 'expert',
    titleKey: 'rank.expert.title',
    descriptionKey: 'rank.expert.desc',
    emoji: '💻',
    minLevel: 51,
    maxLevel: 60,
    color: 'from-sky to-bubble',
  },
  {
    id: 'master',
    titleKey: 'rank.master.title',
    descriptionKey: 'rank.master.desc',
    emoji: '👑',
    minLevel: 61,
    maxLevel: null,
    color: 'from-sun to-mango',
  },
];

export function studentRankIndexForLevel(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  const index = STUDENT_RANKS.findIndex(
    (rank) => safeLevel >= rank.minLevel && (rank.maxLevel === null || safeLevel <= rank.maxLevel),
  );
  return index < 0 ? STUDENT_RANKS.length - 1 : index;
}

export function studentRankForLevel(level: number): StudentRank {
  return STUDENT_RANKS[studentRankIndexForLevel(level)];
}

export function nextStudentRank(level: number): StudentRank | null {
  return STUDENT_RANKS[studentRankIndexForLevel(level) + 1] ?? null;
}

export function isRankPromotion(level: number): boolean {
  if (level <= 1) return false;
  return studentRankForLevel(level).id !== studentRankForLevel(level - 1).id;
}
