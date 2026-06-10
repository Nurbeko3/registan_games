/**
 * case01 — "The Missing Mascot" · Band 7-9 · reading
 * Easiest case: short sources, mostly literal retrieval + one simple cross-ref.
 * Fully fictional. Daily-rotation eligible.
 */

import type { CaseDef } from './types';

const case01: CaseDef = {
  id: 'case01',
  title: 'The Missing Mascot',
  gradeBand: '7-9',
  subject: 'reading',
  isDaily: true,
  briefing:
    "Sunnydale School's plush owl mascot, Hooty, vanished from the trophy shelf on Friday. " +
    'Read the clues and find out who borrowed it — and why.',
  sources: [
    {
      id: 's1',
      kind: 'note',
      title: 'Note on the trophy shelf',
      body:
        'Hooty is with me for the weekend! I needed our mascot for the poster I am painting ' +
        'for the football final. I will bring it back Monday morning, I promise.\n\n— The art club',
    },
    {
      id: 's2',
      kind: 'chatLog',
      title: 'Art Club group chat',
      body:
        'Mia: Who has the big paintbrushes?\n' +
        'Sam: I do. I am painting the owl poster tonight.\n' +
        'Mia: Did you take Hooty from the shelf?\n' +
        'Sam: Yes, I borrowed it on Friday so I could copy its colours.\n' +
        'Mia: Cool. The final is on Saturday so we need the poster by Friday.',
    },
    {
      id: 's3',
      kind: 'profileCard',
      title: 'Club member card — Sam',
      body:
        'Name: Sam\nClub: Art Club\nRole: Poster painter\nFavourite colour: teal\n' +
        'Note: Sam joined the Art Club this term and loves painting animals.',
    },
  ],
  questions: [
    {
      id: 'q1',
      prompt: 'Who borrowed Hooty the mascot?',
      choices: ['Mia', 'Sam', 'The football coach', 'Nobody'],
      answerIndex: 1,
      evidenceSourceId: 's2',
      evidencePassage: 'Yes, I borrowed it on Friday so I could copy its colours.',
      concept: 'literal',
    },
    {
      id: 'q2',
      prompt: 'Why was the mascot taken?',
      choices: [
        'To hide it as a prank',
        'To use it for a football poster',
        'To clean it',
        'To give it away',
      ],
      answerIndex: 1,
      evidenceSourceId: 's1',
      evidencePassage: 'I needed our mascot for the poster I am painting for the football final.',
      concept: 'literal',
    },
    {
      id: 'q3',
      prompt: 'When did the borrower say they took Hooty?',
      choices: ['Monday', 'Saturday', 'Friday', 'Sunday'],
      answerIndex: 2,
      evidenceSourceId: 's2',
      evidencePassage: 'I borrowed it on Friday',
      concept: 'literal',
    },
    {
      id: 'q4',
      prompt:
        'Using the note AND the chat, what is the LAST day the poster could be finished on time?',
      choices: ['Monday', 'Friday', 'Saturday', 'Sunday'],
      answerIndex: 1,
      evidenceSourceId: 's2',
      evidencePassage: 'The final is on Saturday so we need the poster by Friday.',
      concept: 'crossRef',
    },
  ],
};

export default case01;
