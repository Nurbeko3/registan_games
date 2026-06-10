/**
 * case04 — "The Wilting Greenhouse" · Band 13-14 · science
 * Harder: a controlled-variable inference plus a two-source cross-ref.
 * Fully fictional school greenhouse experiment.
 */

import type { CaseDef } from './types';

const case04: CaseDef = {
  id: 'case04',
  title: 'The Wilting Greenhouse',
  gradeBand: '13-14',
  subject: 'science',
  briefing:
    'The science club\'s bean plants on Shelf B keep wilting while Shelf A thrives. ' +
    'Read the log and the notes to work out the real cause.',
  sources: [
    {
      id: 's1',
      kind: 'note',
      title: 'Experiment setup',
      body:
        'Two shelves, same bean seeds, same soil, watered the same amount each day.\n' +
        'Shelf A: next to the south window.\n' +
        'Shelf B: in the back corner behind a tall cupboard.\n' +
        'Everything is identical except the position.',
    },
    {
      id: 's2',
      kind: 'ticket',
      title: 'Light meter readings (lux)',
      body:
        'Daily light measured at noon:\n' +
        'Shelf A: 18,000 lux\n' +
        'Shelf B: 1,200 lux\n' +
        'Healthy bean plants need at least 10,000 lux.',
    },
    {
      id: 's3',
      kind: 'chatLog',
      title: 'Club discussion',
      body:
        'Lola: Maybe Shelf B needs more water?\n' +
        'Ravi: No — the setup note says both shelves get the same water.\n' +
        'Lola: Then the only thing different is how much light each shelf gets.\n' +
        'Ravi: Right. Shelf B is hidden behind the cupboard.',
    },
  ],
  questions: [
    {
      id: 'q1',
      prompt: 'How much light does Shelf B get at noon?',
      choices: ['18,000 lux', '10,000 lux', '1,200 lux', 'None recorded'],
      answerIndex: 2,
      evidenceSourceId: 's2',
      evidencePassage: 'Shelf B: 1,200 lux',
      concept: 'literal',
    },
    {
      id: 'q2',
      prompt: 'According to the setup, what is the ONLY difference between the shelves?',
      choices: ['The soil', 'The amount of water', 'The seeds', 'The position'],
      answerIndex: 3,
      evidenceSourceId: 's1',
      evidencePassage: 'Everything is identical except the position.',
      concept: 'literal',
    },
    {
      id: 'q3',
      prompt:
        'Using the readings AND the healthy-plant rule, does Shelf B get enough light?',
      choices: [
        'Yes — well above the minimum',
        'No — 1,200 lux is far below the 10,000 lux needed',
        'It gets exactly enough',
        'Light was not measured',
      ],
      answerIndex: 1,
      evidenceSourceId: 's2',
      evidencePassage: 'Healthy bean plants need at least 10,000 lux.',
      concept: 'crossRef',
    },
    {
      id: 'q4',
      prompt: 'What is the most likely cause of the wilting on Shelf B?',
      choices: [
        'Too much water',
        'Bad seeds',
        'Too little light because it is hidden behind the cupboard',
        'Wrong soil',
      ],
      answerIndex: 2,
      evidenceSourceId: 's3',
      evidencePassage: 'the only thing different is how much light each shelf gets',
      concept: 'inference',
    },
  ],
};

export default case04;
