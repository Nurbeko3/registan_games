/** Shared types for BATTLE LEARN ARENA — the competitive "learn-while-you-play" mode.
 *
 *  Design rule #1: a child must NEVER feel punished for being tagged out.
 *  Every elimination opens a LEARNING MODE challenge; answering it is the way
 *  back into the fun. Death = a learning opportunity, framed as a power-up.
 *
 *  These types are pure data (no React) so the engine, the mock-multiplayer
 *  simulation, and a future Supabase Realtime backend can all share them. */

// ── Teams ───────────────────────────────────────────────────────────────────
export type TeamId = 'red' | 'blue';

export interface TeamInfo {
  id: TeamId;
  name: string;
  emoji: string;
  /** tailwind text/bg accent token, e.g. "bubble" or "sky" */
  accent: string;
}

export const TEAMS: Record<TeamId, TeamInfo> = {
  red: { id: 'red', name: 'Red Foxes', emoji: '🦊', accent: 'bubble' },
  blue: { id: 'blue', name: 'Blue Whales', emoji: '🐳', accent: 'sky' },
};

export const otherTeam = (t: TeamId): TeamId => (t === 'red' ? 'blue' : 'red');

/** One human in a multiplayer match (M2 embodied players). The host builds the
 *  roster from lobby presence and ships it in the start handshake so every client
 *  builds the same set of fighters and knows which one is theirs. */
export interface RosterEntry {
  netId: string;
  name: string;
  avatar: string;
  team: TeamId;
}

// ── Players (local hero + simulated bots; identical shape for future netcode) ─
export interface ArenaPlayer {
  id: string;
  name: string;
  avatar: string;
  team: TeamId;
  /** false for the human player, true for simulated teammates/opponents */
  isBot: boolean;
  /** true while alive on the battlefield, false while in the learning pod */
  alive: boolean;
  /** personal tag-outs scored this match (for the post-match scoreboard) */
  score: number;
}

// ── Question bank ─────────────────────────────────────────────────────────────
export type Category =
  | 'programming'
  | 'logic'
  | 'math'
  | 'algorithms'
  | 'web'
  | 'ai'
  | 'hardware';

export type Difficulty = 'easy' | 'medium' | 'hard';

/** Uzbek school class (1–11). An extra classification on every question so the
 *  admin can organise the bank by grade; orthogonal to `difficulty`, which still
 *  drives arena matchmaking. */
export type Grade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
export const GRADES: Grade[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export const CATEGORY_META: Record<Category, { label: string; emoji: string }> = {
  programming: { label: 'Programming', emoji: '💻' },
  logic: { label: 'Logic', emoji: '🧠' },
  math: { label: 'Mathematics', emoji: '🧮' },
  algorithms: { label: 'Algorithms', emoji: '🪜' },
  web: { label: 'Web Dev', emoji: '🌐' },
  ai: { label: 'AI Basics', emoji: '🤖' },
  hardware: { label: 'Железо', emoji: '🖥️' },
};

interface BaseQuestion {
  id: string;
  category: Category;
  difficulty: Difficulty;
  /** Uzbek school class (1–11). Optional for back-compat; static + imported
   *  questions set it. */
  grade?: Grade;
  emoji: string;
  prompt: string;
  /** Kid-friendly teaching note shown on a wrong answer — never scolding. */
  explain: string;
}

/** Multiple choice — pick one option. */
export interface MultipleChoiceQuestion extends BaseQuestion {
  type: 'mcq';
  options: string[];
  answer: number; // index into options
}

/** True / False — a special two-option multiple choice. */
export interface TrueFalseQuestion extends BaseQuestion {
  type: 'truefalse';
  answer: boolean;
}

/** Code completion — choose the token that fills the ___ blank in `code`. */
export interface CodeFillQuestion extends BaseQuestion {
  type: 'code-fill';
  code: string; // contains the literal "___" placeholder
  options: string[];
  answer: number;
}

/** Debug challenge — tap the line that contains the bug. */
export interface DebugQuestion extends BaseQuestion {
  type: 'debug';
  lines: string[];
  buggyLine: number; // index into lines
}

/** Drag-and-drop / tap-to-order — arrange the blocks into the correct sequence.
 *  `blocks` is authored in the CORRECT order; the engine shuffles for display. */
export interface OrderQuestion extends BaseQuestion {
  type: 'order';
  blocks: string[];
}

/** Binary challenge — flip 5 bits (0..31) to match the target number. */
export interface BinaryQuestion extends BaseQuestion {
  type: 'binary';
  target: number; // 1..31
}

export type ArenaQuestion =
  | MultipleChoiceQuestion
  | TrueFalseQuestion
  | CodeFillQuestion
  | DebugQuestion
  | OrderQuestion
  | BinaryQuestion;

/** A question prepared for display: answer/option order is randomized here so
 *  the same question never looks identical twice (anti-cheat-learning). */
export interface PreparedQuestion {
  q: ArenaQuestion;
  /** shuffled options for mcq / code-fill / truefalse; correctIndex tracks the answer */
  options?: string[];
  correctIndex?: number;
  /** shuffled display order for `order` questions (correct order stays q.blocks) */
  shuffledBlocks?: string[];
}

// ── Match config & results ────────────────────────────────────────────────────
export type ModeId = 'deathmatch' | 'capture-the-flag' | 'king-of-the-hill' | 'knowledge-war';

export interface ArenaMode {
  id: ModeId;
  name: string;
  emoji: string;
  blurb: string;
  /** points a team needs to win the match */
  targetScore: number;
  /** word shown for a point, e.g. "tag-outs", "captures", "hill ticks" */
  scoreLabel: string;
  /** ms between simulated battle ticks — pacing differs per mode */
  tickMs: number;
  /** in Knowledge War you can ONLY return via a correct answer (no free respawn drift) */
  learnToRespawn: boolean;
}

export interface MatchResult {
  won: boolean;
  myTeam: TeamId;
  redScore: number;
  blueScore: number;
  /** tag-outs the human player personally scored */
  elims: number;
  /** questions answered correctly in the learning pod */
  correct: number;
  /** total questions attempted */
  answered: number;
  xpEarned: number;
  coinsEarned: number;
}

// ── Match flow (shared by the engine + UI) ────────────────────────────────────
export type ArenaPhase = 'intro' | 'playing' | 'dying' | 'learning' | 'ended';

/** Sub-state while the hero is in the LEARNING POD (the respawn screen). */
export type LearnState = 'answering' | 'correct' | 'wrong-cooldown';
