/** Metadata for every mini-game. The actual playable component lives in
 *  components/games and is wired up in components/games/registry.ts. */

export interface GameMeta {
  slug: string;
  title: string;
  emoji: string;
  blurb: string;
  skill: string;
  color: string; // tailwind gradient classes
  baseXp: number;
}

export const GAMES: GameMeta[] = [
  { slug: 'forest-trail', title: 'Forest Trail', emoji: '🦊', blurb: 'Program the fox to gather berries and reach its den!', skill: 'Sequencing & Loops', color: 'from-success-500 to-success-600', baseXp: 50 },
  { slug: 'robot-maze', title: 'Robot Maze', emoji: '🤖', blurb: 'Program the robot to reach the flag!', skill: 'Sequencing', color: 'from-brand-500 to-brand-600', baseXp: 40 },
  { slug: 'memory-match', title: 'Memory Match', emoji: '🧠', blurb: 'Flip cards and match the pairs.', skill: 'Memory', color: 'from-success-500 to-success-600', baseXp: 30 },
  { slug: 'summit-sort', title: 'Summit Sort', emoji: '⛰️', blurb: 'Sort the crystals small→large to climb the summit!', skill: 'Sorting', color: 'from-info-500 to-info-600', baseXp: 50 },
  { slug: 'binary-challenge', title: 'Binary Challenge', emoji: '🔢', blurb: 'Flip the bits to make the number!', skill: 'Binary', color: 'from-info-500 to-info-600', baseXp: 45 },
  { slug: 'algorithm-race', title: 'Algorithm Race', emoji: '⚡', blurb: 'Tap the numbers in order — fast!', skill: 'Sorting', color: 'from-warning-500 to-warning-600', baseXp: 35 },
  { slug: 'train-robot', title: 'Train the Robot', emoji: '🤖', blurb: 'Teach the AI with examples, then watch it learn to predict!', skill: 'AI · Machine Learning', color: 'from-brand-500 to-brand-600', baseXp: 50 },
  { slug: 'fix-the-bug', title: 'Fix the Bug', emoji: '🐛', blurb: 'Find the line with the sneaky bug.', skill: 'Debugging', color: 'from-violet-500 to-violet-600', baseXp: 45 },
  { slug: 'code-adventure', title: 'Code Adventure', emoji: '🗺️', blurb: 'Choose your path through the story.', skill: 'Logic', color: 'from-brand-500 to-brand-600', baseXp: 40 },
  { slug: 'build-page', title: 'Build the Page', emoji: '👑', blurb: 'Stack HTML blocks to match the royal webpage!', skill: 'Web · HTML', color: 'from-violet-500 to-violet-600', baseXp: 50 },
  { slug: 'output-oracle', title: 'Output Oracle', emoji: '🪐', blurb: 'Predict the output — combo gauntlet for Code Heroes!', skill: 'Python · Finale', color: 'from-warning-500 to-warning-600', baseXp: 60 },
  { slug: 'variable-vault', title: 'Variable Vault', emoji: '📦', blurb: 'Track changing values and unlock the vault!', skill: 'Python · Variables', color: 'from-info-500 to-info-600', baseXp: 50 },
  { slug: 'if-else-quest', title: 'If/Else Quest', emoji: '🛤️', blurb: 'Read conditions and choose the path Python takes!', skill: 'Python · Conditions', color: 'from-warning-500 to-warning-600', baseXp: 55 },
  { slug: 'list-lab', title: 'List Lab', emoji: '🧪', blurb: 'Explore indexes, updates and loops through lists!', skill: 'Python · Lists', color: 'from-brand-500 to-brand-600', baseXp: 55 },
  { slug: 'logic-puzzle', title: 'Logic Puzzle', emoji: '🧩', blurb: 'Put the code blocks in the right order.', skill: 'Algorithms', color: 'from-success-500 to-success-600', baseXp: 40 },
  { slug: 'treasure-hunt', title: 'Treasure Hunt', emoji: '💎', blurb: 'Use clues to dig up the treasure!', skill: 'Deduction', color: 'from-amber-500 to-amber-600', baseXp: 45 },
  { slug: 'pattern-pop', title: 'Pattern Pop', emoji: '🟣', blurb: 'Watch the colors, then repeat the pattern!', skill: 'Memory', color: 'from-brand-500 to-brand-600', baseXp: 40 },
  { slug: 'loop-output', title: 'Loop Output', emoji: '🔮', blurb: 'Guess what the program will print.', skill: 'Loops', color: 'from-info-500 to-info-600', baseXp: 45 },
  { slug: 'quick-math', title: 'Quick Math', emoji: '🧮', blurb: 'Solve fast before time runs out!', skill: 'Numbers', color: 'from-warning-500 to-warning-600', baseXp: 35 },
];

export const getGame = (slug: string): GameMeta | undefined => GAMES.find((g) => g.slug === slug);
