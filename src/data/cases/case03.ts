/**
 * case03 — "The Postcard That Lied" · Band 10-12 · history
 * A fictional history puzzle: an undated postcard is placed in time by
 * cross-referencing two other documents. Fully fictional places/events.
 */

import type { CaseDef } from './types';

const case03: CaseDef = {
  id: 'case03',
  title: 'The Postcard That Lied',
  gradeBand: '10-12',
  subject: 'history',
  briefing:
    'A museum found an old postcard claiming the town clock tower was "brand new." ' +
    'But when was it really written? Use the other records to place it in time.',
  sources: [
    {
      id: 's1',
      kind: 'note',
      title: 'The postcard',
      body:
        'Greetings from Rivertown! Our brand-new clock tower was finished just last month and ' +
        'everyone gathered to hear it chime. I posted this from the new train station. ' +
        'Wish you were here! — T.',
    },
    {
      id: 's2',
      kind: 'ticket',
      title: 'Museum timeline card',
      body:
        'Rivertown key dates (fictional):\n' +
        '• Clock tower completed: spring 1908\n' +
        '• Train station opened: 1911\n' +
        '• Great flood: 1925',
    },
    {
      id: 's3',
      kind: 'email',
      title: 'Curator notes',
      body:
        'Subject: dating the postcard\n\n' +
        'The writer mentions posting it FROM the train station, and the station did not exist ' +
        'until 1911. So even though the card calls the clock tower "brand new," it cannot have ' +
        'been written in 1908. Trust the station date.',
    },
  ],
  questions: [
    {
      id: 'q1',
      prompt: 'According to the timeline card, when did the train station open?',
      choices: ['1908', '1911', '1925', 'last month'],
      answerIndex: 1,
      evidenceSourceId: 's2',
      evidencePassage: 'Train station opened: 1911',
      concept: 'literal',
    },
    {
      id: 'q2',
      prompt: 'Where does the postcard writer say they posted it from?',
      choices: ['The clock tower', 'The new train station', 'The museum', 'The river'],
      answerIndex: 1,
      evidenceSourceId: 's1',
      evidencePassage: 'I posted this from the new train station.',
      concept: 'literal',
    },
    {
      id: 'q3',
      prompt:
        'Combining the postcard and the timeline, the postcard could NOT have been written before which year?',
      choices: ['1908', '1911', '1925', '1900'],
      answerIndex: 1,
      evidenceSourceId: 's2',
      evidencePassage: 'Train station opened: 1911',
      concept: 'crossRef',
    },
    {
      id: 'q4',
      prompt: 'Why is the postcard wrong to call the clock tower "brand new"?',
      choices: [
        'The tower was never built',
        'The station opened in 1911, years after the tower was finished in 1908',
        'The flood destroyed it',
        'The writer made up the town',
      ],
      answerIndex: 1,
      evidenceSourceId: 's3',
      evidencePassage: 'the station did not exist until 1911',
      concept: 'inference',
    },
  ],
};

export default case03;
