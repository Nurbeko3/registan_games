/** BATTLE LEARN ARENA question bank.
 *
 *  Every entry is plain data — adding a question is a one-line append, so the
 *  pool is freely expandable (anti-cheat-learning rule: big, growing pools).
 *  Covers all six categories across three difficulties and six question types.
 *
 *  Tone: warm and encouraging. The `explain` field is the teaching moment shown
 *  on a wrong answer — it teaches, it never scolds. A child should leave every
 *  question knowing a little more, never feeling dumb.
 *
 *  Difficulty maps to player level (see questionEngine.difficultyForLevel):
 *    Lv 1–4 → easy · Lv 5–14 → medium · Lv 15+ → hard. */

import type { ArenaQuestion } from '@/lib/arena/types';

export const ARENA_QUESTIONS: ArenaQuestion[] = [
  // ── PROGRAMMING ────────────────────────────────────────────────────────────
  { id: 'p-e1', type: 'mcq', category: 'programming', difficulty: 'easy', emoji: '📦',
    prompt: 'A variable is like a…', options: ['Box that stores a value', 'Type of pizza', 'Game level', 'Robot'], answer: 0,
    explain: 'A variable is a labelled box where your program keeps a value so it can use it later.' },
  { id: 'p-e2', type: 'mcq', category: 'programming', difficulty: 'easy', emoji: '🐛',
    prompt: 'A mistake in code is called a…', options: ['Bug', 'Snack', 'Cloud', 'Star'], answer: 0,
    explain: 'A mistake in code is a "bug". Finding and fixing it is called debugging!' },
  { id: 'p-e3', type: 'truefalse', category: 'programming', difficulty: 'easy', emoji: '🤖',
    prompt: 'Computers do exactly what we tell them to do.', answer: true,
    explain: 'True! Computers follow instructions precisely — so we must be careful and clear.' },
  { id: 'p-m1', type: 'code-fill', category: 'programming', difficulty: 'medium', emoji: '🔁',
    prompt: 'Fill the blank to repeat 3 times:', code: 'for i in ___(3):\n    print(i)', options: ['range', 'loop', 'count', 'repeat'], answer: 0,
    explain: 'In Python, range(3) gives 0, 1, 2 — perfect for repeating something 3 times.' },
  { id: 'p-m2', type: 'mcq', category: 'programming', difficulty: 'medium', emoji: '➕',
    prompt: 'What does print("Hi" + "!") show?', options: ['Hi!', 'Hi +!', 'HiHi', 'Error'], answer: 0,
    explain: 'The + joins (concatenates) text, so "Hi" + "!" becomes "Hi!".' },
  { id: 'p-h1', type: 'code-fill', category: 'programming', difficulty: 'hard', emoji: '🧩',
    prompt: 'Make a function that returns a doubled number:', code: 'def double(n):\n    ___ n * 2', options: ['return', 'print', 'give', 'send'], answer: 0,
    explain: 'A function hands a value back with the "return" keyword.' },

  // ── LOGIC ──────────────────────────────────────────────────────────────────
  { id: 'l-e1', type: 'mcq', category: 'logic', difficulty: 'easy', emoji: '❓',
    prompt: 'Which keyword makes a decision?', options: ['if', 'jump', 'color', 'loop'], answer: 0,
    explain: 'An "if" statement chooses what to do based on whether something is true.' },
  { id: 'l-e2', type: 'truefalse', category: 'logic', difficulty: 'easy', emoji: '🚦',
    prompt: 'AND is true only when BOTH things are true.', answer: true,
    explain: 'Right! "AND" needs both sides true. "OR" needs just one.' },
  { id: 'l-m1', type: 'mcq', category: 'logic', difficulty: 'medium', emoji: '🔀',
    prompt: 'If x = 5, is (x > 3 AND x < 10) true?', options: ['True', 'False'], answer: 0,
    explain: '5 is bigger than 3 AND smaller than 10, so both parts are true → True.' },
  { id: 'l-m2', type: 'mcq', category: 'logic', difficulty: 'medium', emoji: '🙅',
    prompt: 'What is NOT(true)?', options: ['false', 'true', 'maybe', 'zero'], answer: 0,
    explain: 'NOT flips a value: NOT(true) becomes false.' },
  { id: 'l-h1', type: 'mcq', category: 'logic', difficulty: 'hard', emoji: '🧠',
    prompt: 'All cats purr. Tig is a cat. So Tig…', options: ['purrs', 'barks', 'flies', 'might purr'], answer: 0,
    explain: 'If ALL cats purr and Tig is a cat, then Tig must purr. That is deduction!' },

  // ── MATHEMATICS ──────────────────────────────────────────────────────────────
  { id: 'm-e1', type: 'mcq', category: 'math', difficulty: 'easy', emoji: '➗',
    prompt: 'What is 12 ÷ 4?', options: ['3', '4', '6', '8'], answer: 0,
    explain: '12 split into 4 equal groups makes 3 in each group.' },
  { id: 'm-e2', type: 'mcq', category: 'math', difficulty: 'easy', emoji: '✖️',
    prompt: 'What is 7 × 6?', options: ['42', '36', '48', '13'], answer: 0,
    explain: '7 sixes: 6, 12, 18, 24, 30, 36, 42 → 42.' },
  { id: 'm-m1', type: 'mcq', category: 'math', difficulty: 'medium', emoji: '％',
    prompt: 'What is 25% of 80?', options: ['20', '25', '40', '15'], answer: 0,
    explain: '25% means one quarter. 80 ÷ 4 = 20.' },
  { id: 'm-m2', type: 'mcq', category: 'math', difficulty: 'medium', emoji: '🔢',
    prompt: 'What is the next prime after 7?', options: ['11', '8', '9', '10'], answer: 0,
    explain: '8, 9, 10 all divide evenly. 11 only divides by 1 and itself → prime.' },
  { id: 'm-h1', type: 'mcq', category: 'math', difficulty: 'hard', emoji: '📐',
    prompt: 'A square has area 49. Its side is…', options: ['7', '24.5', '14', '12'], answer: 0,
    explain: 'Area = side × side. The number times itself that makes 49 is 7.' },

  // ── ALGORITHMS ───────────────────────────────────────────────────────────────
  { id: 'a-e1', type: 'mcq', category: 'algorithms', difficulty: 'easy', emoji: '🎯',
    prompt: 'An algorithm is a…', options: ['Step-by-step plan', 'Type of bug', 'Computer brand', 'Color'], answer: 0,
    explain: 'An algorithm is just a clear list of steps to solve a problem — like a recipe.' },
  { id: 'a-e2', type: 'order', category: 'algorithms', difficulty: 'easy', emoji: '🥪',
    prompt: 'Order the steps to make a sandwich:', blocks: ['Get bread', 'Add filling', 'Close sandwich', 'Eat'],
    explain: 'Algorithms run in order: bread first, filling, close it, then eat!' },
  { id: 'a-m1', type: 'order', category: 'algorithms', difficulty: 'medium', emoji: '🪜',
    prompt: 'Order these steps to find the biggest number:', blocks: ['Start with the first number', 'Look at the next number', 'Keep the bigger one', 'Repeat to the end'],
    explain: 'You compare and keep the biggest as you walk through the whole list.' },
  { id: 'a-m2', type: 'mcq', category: 'algorithms', difficulty: 'medium', emoji: '🔎',
    prompt: 'Binary search works only on a list that is…', options: ['Sorted', 'Empty', 'Reversed text', 'Colorful'], answer: 0,
    explain: 'Binary search jumps to the middle, so the list must be sorted first.' },
  { id: 'a-h1', type: 'mcq', category: 'algorithms', difficulty: 'hard', emoji: '⚡',
    prompt: 'Which is usually FASTER to search 1000 sorted items?', options: ['Binary search', 'Checking one by one', 'Both same', 'Neither works'], answer: 0,
    explain: 'Binary search halves the list each step (~10 checks) vs up to 1000 one-by-one.' },

  // ── WEB DEVELOPMENT ──────────────────────────────────────────────────────────
  { id: 'w-e1', type: 'mcq', category: 'web', difficulty: 'easy', emoji: '🏷️',
    prompt: 'HTML is used to…', options: ['Build web pages', 'Cook food', 'Drive cars', 'Paint walls'], answer: 0,
    explain: 'HTML is the language that builds the structure of web pages.' },
  { id: 'w-e2', type: 'mcq', category: 'web', difficulty: 'easy', emoji: '🎨',
    prompt: 'Which language styles a web page (colors, fonts)?', options: ['CSS', 'HTML', 'SQL', 'JSON'], answer: 0,
    explain: 'CSS adds the colors, fonts, and layout. HTML is the structure underneath.' },
  { id: 'w-m1', type: 'code-fill', category: 'web', difficulty: 'medium', emoji: '🔗',
    prompt: 'Finish the link tag:', code: '<a ___="https://site.com">Go</a>', options: ['href', 'src', 'link', 'url'], answer: 0,
    explain: 'A link uses href (hypertext reference) to say where it goes.' },
  { id: 'w-m2', type: 'mcq', category: 'web', difficulty: 'medium', emoji: '🖼️',
    prompt: 'Which tag shows an image?', options: ['<img>', '<image>', '<pic>', '<photo>'], answer: 0,
    explain: 'The <img> tag (with a src attribute) displays a picture.' },
  { id: 'w-h1', type: 'mcq', category: 'web', difficulty: 'hard', emoji: '🌐',
    prompt: 'What does a browser ask a server with to GET a page?', options: ['An HTTP request', 'A phone call', 'A cookie jar', 'A CSS file'], answer: 0,
    explain: 'Browsers send an HTTP request; the server replies with the page.' },

  // ── AI BASICS ────────────────────────────────────────────────────────────────
  { id: 'ai-e1', type: 'mcq', category: 'ai', difficulty: 'easy', emoji: '🤖',
    prompt: 'AI learns by looking at lots of…', options: ['Examples (data)', 'Snacks', 'Clouds', 'Stickers'], answer: 0,
    explain: 'AI finds patterns by studying many examples — that data is how it learns.' },
  { id: 'ai-e2', type: 'truefalse', category: 'ai', difficulty: 'easy', emoji: '🧠',
    prompt: 'AI can make mistakes too.', answer: true,
    explain: 'True! AI learns from examples, so it can be wrong — we should always check.' },
  { id: 'ai-m1', type: 'mcq', category: 'ai', difficulty: 'medium', emoji: '🏷️',
    prompt: 'Teaching AI with labelled examples is called…', options: ['Supervised learning', 'Sleeping', 'Guessing', 'Drawing'], answer: 0,
    explain: 'When every example has the right answer (a label), it is supervised learning.' },
  { id: 'ai-m2', type: 'mcq', category: 'ai', difficulty: 'medium', emoji: '💬',
    prompt: 'A program that chats using AI is often called a…', options: ['Chatbot', 'Spreadsheet', 'Printer', 'Browser'], answer: 0,
    explain: 'A chatbot uses AI to understand and reply to what you type.' },
  { id: 'ai-h1', type: 'mcq', category: 'ai', difficulty: 'hard', emoji: '🧩',
    prompt: 'A "neural network" is loosely inspired by the…', options: ['Brain', 'Ocean', 'Engine', 'Calendar'], answer: 0,
    explain: 'Neural networks connect tiny units like the neurons in a brain.' },

  // ── BINARY (cross-category fun) ────────────────────────────────────────────
  { id: 'b-e1', type: 'binary', category: 'math', difficulty: 'easy', emoji: '🔟',
    prompt: 'Flip the bits to make this number:', target: 5,
    explain: '5 = 4 + 1, so turn on the 4-bit and the 1-bit.' },
  { id: 'b-m1', type: 'binary', category: 'math', difficulty: 'medium', emoji: '🔢',
    prompt: 'Flip the bits to make this number:', target: 13,
    explain: '13 = 8 + 4 + 1.' },
  { id: 'b-h1', type: 'binary', category: 'math', difficulty: 'hard', emoji: '💡',
    prompt: 'Flip the bits to make this number:', target: 26,
    explain: '26 = 16 + 8 + 2.' },

  // ── DEBUG CHALLENGES ───────────────────────────────────────────────────────
  { id: 'd-m1', type: 'debug', category: 'programming', difficulty: 'medium', emoji: '🐞',
    prompt: 'Tap the buggy line:', lines: ['score = 0', 'score = score + 1', 'print(scor)'], buggyLine: 2,
    explain: 'Line 3 misspells the variable: "scor" should be "score".' },
  { id: 'd-h1', type: 'debug', category: 'programming', difficulty: 'hard', emoji: '🐞',
    prompt: 'Tap the buggy line:', lines: ['for i in range(3)', '    print(i)', '# done'], buggyLine: 0,
    explain: 'Line 1 is missing the colon — it should be "for i in range(3):".' },
];
