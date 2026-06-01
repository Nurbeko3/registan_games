/**
 * Offline "AI Mentor" knowledge — predefined, kid-friendly hints & tips per game.
 *
 * FUTURE-READY: `getHint` is the single seam to swap in a real model later
 * (e.g. OpenAI or Supabase Edge Function). Today it returns canned encouragement;
 * the call signature already matches an async provider.
 */

export const MENTOR_GREETINGS = [
  "Hi, I'm Byte! 🤖 Tap me anytime you need a hint!",
  "Stuck? No worries — every coder gets stuck. Let's think together! 💡",
  "You're doing great! Want a little tip? ✨",
];


export const ENCOURAGEMENTS = [
  'Nice try! 💪',
  "You're so close! 🌟",
  'Great thinking! 🧠',
  'Keep going, hero! 🚀',
  'Mistakes help us learn! 🌈',
];

const HINTS: Record<string, string[]> = {
  'robot-maze': [
    'Plan the whole path before you press Run.',
    'Count the squares to the flag first.',
    'Fewer moves = more stars. Can you find a shortcut?',
  ],
  'memory-match': [
    'Try to remember where each card is.',
    'Start from a corner and work across.',
    'Matched a pair? Great — fewer cards to track!',
  ],
  'binary-challenge': [
    'Each bit is worth double the one to its right: 1, 2, 4, 8…',
    'Add up the ON bits to check your number.',
    'Turn the biggest bit on first, then fill the rest.',
  ],
  'algorithm-race': [
    'Look for the smallest number first.',
    'Sorting means smallest → biggest.',
    'Stay calm — speed comes with practice!',
  ],
  'fix-the-bug': [
    'Read each line slowly, like a detective. 🔍',
    'Bugs often hide in spelling or the wrong symbol.',
    'Ask: does this line do what it says?',
  ],
  'code-adventure': [
    'Think about what each choice will do next.',
    'There is no wrong path — only learning!',
    'Loops repeat things. Could that help here?',
  ],
  'logic-puzzle': [
    'What must happen FIRST? Start there.',
    'Read the blocks like steps in a recipe. 🍳',
    'Try the order in your head before you check.',
  ],
  'treasure-hunt': [
    'Closer tiles show a smaller number.',
    '0 means you found it!',
    'Use each clue to shrink your search.',
  ],
};

export interface HintRequest {
  game: string;
  attempt: number;
}

export type HintProvider = (req: HintRequest) => Promise<string>;

/** Default provider — instant, offline, kid-safe canned hints. */
const localHintProvider: HintProvider = async ({ game, attempt }) => {
  const list = HINTS[game] ?? ['Break the problem into tiny steps and try one at a time!'];
  return list[attempt % list.length];
};

/*
 * FUTURE AI SEAM — to use a real model, implement this and call
 * setHintProvider(cloudHintProvider). No other code changes needed.
 *
 *   import { supabase, isCloudEnabled } from '@/lib/supabase/client';
 *   const cloudHintProvider: HintProvider = async (req) => {
 *     if (!isCloudEnabled()) return localHintProvider(req);
 *     const { data } = await supabase!.functions.invoke('hint', { body: req });
 *     return data?.hint ?? localHintProvider(req);
 *   };
 */

let activeHintProvider: HintProvider = localHintProvider;

/** Swap the hint source (e.g. to a Supabase Edge Function) in one call. */
export function setHintProvider(provider: HintProvider): void {
  activeHintProvider = provider;
}

/** Returns a hint. Always falls back to local hints if a provider fails. */
export async function getHint(req: HintRequest): Promise<string> {
  try {
    return await activeHintProvider(req);
  } catch {
    return localHintProvider(req);
  }
}
