/**
 * case02 — "The Overdue Library Book" · Band 10-12 · logic
 * Introduces reconciling a date across two sources (cross-ref) + a simple inference.
 * Fully fictional.
 */

import type { CaseDef } from './types';

const case02: CaseDef = {
  id: 'case02',
  title: 'The Overdue Library Book',
  gradeBand: '10-12',
  subject: 'logic',
  briefing:
    'The library says a book about volcanoes is three days overdue and a fine is owed. ' +
    'The student says it was returned on time. Read the records and decide who is right.',
  sources: [
    {
      id: 's1',
      kind: 'ticket',
      title: 'Library loan record',
      body:
        'Book: "Mountains of Fire"\nBorrower: card #2207\nBorrowed: 2 March\n' +
        'Due back: 16 March\nReturned: not recorded\nFine: 3 days × 200 so\'m',
    },
    {
      id: 's2',
      kind: 'email',
      title: 'Email from the borrower',
      body:
        'Subject: I returned the volcano book!\n\n' +
        'Hello, I think there is a mistake. I dropped "Mountains of Fire" into the return box ' +
        'on 15 March, the day before it was due. My friend Dana saw me do it. ' +
        'Please check the box — maybe it was not scanned back in.',
    },
    {
      id: 's3',
      kind: 'chatLog',
      title: 'Chat with Dana',
      body:
        'Librarian: Dana, did you see the volcano book returned?\n' +
        'Dana: Yes. We walked in together on 15 March and I watched it go into the return box.\n' +
        'Librarian: The box was emptied on 17 March, so an unscanned book could sit there for days.',
    },
  ],
  questions: [
    {
      id: 'q1',
      prompt: 'What date was the book due back?',
      choices: ['2 March', '15 March', '16 March', '17 March'],
      answerIndex: 2,
      evidenceSourceId: 's1',
      evidencePassage: 'Due back: 16 March',
      concept: 'literal',
    },
    {
      id: 'q2',
      prompt: 'What date does the borrower say they returned it?',
      choices: ['15 March', '16 March', '17 March', '2 March'],
      answerIndex: 0,
      evidenceSourceId: 's2',
      evidencePassage: 'on 15 March, the day before it was due',
      concept: 'literal',
    },
    {
      id: 'q3',
      prompt:
        'Comparing the loan record and the email, was the book returned BEFORE its due date?',
      choices: [
        'No — it was three days late',
        'Yes — returned 15 March, due 16 March',
        'It was never borrowed',
        'It was due 2 March',
      ],
      answerIndex: 1,
      evidenceSourceId: 's2',
      evidencePassage: 'on 15 March, the day before it was due',
      concept: 'crossRef',
    },
    {
      id: 'q4',
      prompt: 'Why might the library not have a "Returned" date even if the book came back on time?',
      choices: [
        'The borrower kept it',
        'The return box was only emptied on 17 March, so an unscanned book sat there',
        'Dana hid the book',
        'The book was lost in the volcano',
      ],
      answerIndex: 1,
      evidenceSourceId: 's3',
      evidencePassage: 'The box was emptied on 17 March, so an unscanned book could sit there for days.',
      concept: 'inference',
    },
  ],
};

export default case02;
