/** Kid-friendly coding quiz used by the multiplayer "Code Battle" mode.
 *  Everyone in a room answers the same questions; fastest correct = most points. */

export interface PartyQuestion {
  q: string;
  options: string[];
  answer: number; // index of the correct option
  emoji: string;
}

export const PARTY_QUIZ: PartyQuestion[] = [
  { emoji: '🔁', q: 'What does a LOOP do?', options: ['Repeats actions', 'Deletes files', 'Prints once', 'Nothing'], answer: 0 },
  { emoji: '🐛', q: 'A mistake in code is called a…', options: ['Bug', 'Cat', 'Snack', 'Cloud'], answer: 0 },
  { emoji: '🔢', q: 'In binary, what is 2 + 2?', options: ['100', '11', '10', '22'], answer: 0 },
  { emoji: '📦', q: 'A variable is like a…', options: ['Box that stores a value', 'Type of pizza', 'Game level', 'Robot'], answer: 0 },
  { emoji: '❓', q: 'Which keyword makes a decision?', options: ['if', 'jump', 'color', 'loop'], answer: 0 },
  { emoji: '🐍', q: 'Which language has a snake mascot?', options: ['Python', 'Java', 'Ruby', 'Go'], answer: 0 },
  { emoji: '➕', q: 'What does print("Hi"+"!") show?', options: ['Hi!', 'Hi +!', 'HiHi', 'Error'], answer: 0 },
  { emoji: '🔄', q: 'range(3) gives the numbers…', options: ['0, 1, 2', '1, 2, 3', '3', '0, 1, 2, 3'], answer: 0 },
  { emoji: '🎯', q: 'An algorithm is a…', options: ['Step-by-step plan', 'Type of bug', 'Computer brand', 'Color'], answer: 0 },
  { emoji: '⭐', q: 'True or False: computers do exactly what we tell them.', options: ['True', 'False', 'Sometimes', 'Never'], answer: 0 },
];
