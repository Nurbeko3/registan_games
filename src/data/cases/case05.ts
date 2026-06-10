/**
 * case05 — "The Locked Clubroom" · Band 13-14 · logic
 * The hardest seed case: an alibi puzzle needing THREE sources reconciled and a
 * multi-step inference. Fully fictional.
 */

import type { CaseDef } from './types';

const case05: CaseDef = {
  id: 'case05',
  title: 'The Locked Clubroom',
  gradeBand: '13-14',
  subject: 'logic',
  briefing:
    'Someone left the chess clubroom unlocked overnight and the spare key is missing. ' +
    'Three members had a key. Read the logs and work out who was last inside.',
  sources: [
    {
      id: 's1',
      kind: 'ticket',
      title: 'Door sign-out sheet',
      body:
        'Whoever leaves LAST must sign the time and lock up.\n' +
        'Mon 17:10 — Aziza (signed in)\n' +
        'Mon 17:45 — Bek (signed in)\n' +
        'Mon 18:30 — Aziza signed OUT\n' +
        'Mon 18:55 — Bek signed OUT\n' +
        '(No sign-out after 18:55.)',
    },
    {
      id: 's2',
      kind: 'chatLog',
      title: 'Club chat that evening',
      body:
        'Aziza: I left at half six, Bek you were still there.\n' +
        'Bek: I left just before seven. Carl came in right as I was leaving.\n' +
        'Carl: Yeah I popped in after Bek left to grab my jacket.\n' +
        'Aziza: Carl, did you sign the sheet?\n' +
        'Carl: ...I forgot to.',
    },
    {
      id: 's3',
      kind: 'profileCard',
      title: 'Key holders',
      body:
        'People with a clubroom key: Aziza, Bek, Carl.\n' +
        'Rule: the LAST person inside is responsible for locking the door.\n' +
        'The spare key normally hangs on the hook inside the room.',
    },
  ],
  questions: [
    {
      id: 'q1',
      prompt: 'According to the sign-out sheet, who was the last person to SIGN OUT?',
      choices: ['Aziza', 'Bek', 'Carl', 'No one signed in'],
      answerIndex: 1,
      evidenceSourceId: 's1',
      evidencePassage: 'Mon 18:55 — Bek signed OUT',
      concept: 'literal',
    },
    {
      id: 'q2',
      prompt: 'In the chat, who entered the room as Bek was leaving?',
      choices: ['Aziza', 'Dana', 'Carl', 'The coach'],
      answerIndex: 2,
      evidenceSourceId: 's2',
      evidencePassage: 'Carl came in right as I was leaving.',
      concept: 'literal',
    },
    {
      id: 'q3',
      prompt:
        'The sheet shows Bek as last out, but the chat says someone entered AFTER Bek. Who was actually inside last?',
      choices: ['Aziza', 'Bek', 'Carl', 'Nobody'],
      answerIndex: 2,
      evidenceSourceId: 's2',
      evidencePassage: 'I popped in after Bek left to grab my jacket.',
      concept: 'crossRef',
    },
    {
      id: 'q4',
      prompt:
        'Using all three sources, who was responsible for locking up — and why is the sheet misleading?',
      choices: [
        'Bek, because he signed out last',
        'Aziza, because she left first',
        'Carl, because he was inside last but never signed the sheet',
        'No one, the door locks itself',
      ],
      answerIndex: 2,
      evidenceSourceId: 's2',
      evidencePassage: '...I forgot to.',
      concept: 'crossRef',
    },
  ],
};

export default case05;
