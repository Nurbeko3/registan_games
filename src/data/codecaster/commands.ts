/**
 * Codecaster command catalog — the single source of truth for every
 * `hero.*` (and Python-control-flow) snippet the play screen can surface.
 *
 * A level only ever shows the commands listed in its `commands: CommandId[]`
 * field (see `CodecasterLevel`), in teaching order — both in the tap-to-insert
 * palette (`CodePane`) and in the CodeMirror autocomplete dropdown. This keeps
 * young learners from being dumped with all 11 commands on day one.
 *
 * `insert` vs `apply`:
 *   - `insert` — full snippet the PALETTE BUTTON appends (trailing `\n`,
 *     ready to run as its own line/block).
 *   - `apply`  — what AUTOCOMPLETE inserts at the cursor while typing
 *     (no trailing newline — the student is mid-line).
 *
 * Real Python only: every `apply`/`insert` must stay valid for the engine
 * (`hero.moveRight/Left/Up/Down()`, `hero.collect()`, `hero.useKey()`,
 * `hero.attack()`, `hero.say("...")`, `#` comments, `for`/`if-else`).
 */

import type { CodecasterLevel } from './types';
import type { IconName } from '@/components/ui/Icon';

export type CommandId =
  | 'moveRight'
  | 'moveLeft'
  | 'moveUp'
  | 'moveDown'
  | 'collect'
  | 'useKey'
  | 'attack'
  | 'say'
  | 'comment'
  | 'forLoop'
  | 'ifElse';

export interface CommandSpec {
  /** Stable identifier — also the curriculum key listed in `level.commands`. */
  id: CommandId;
  /** Palette button text, e.g. "hero.moveRight()". */
  label: string;
  /** Full snippet the palette button inserts (trailing `\n`). */
  insert: string;
  /** What autocomplete inserts at the cursor (no trailing `\n`). */
  apply: string;
  /** i18n key for the autocomplete dropdown's one-line description. */
  detailKey: string;
  /** Lucide icon shown next to the command in the palette. */
  iconName?: IconName;
}

export const COMMANDS: Record<CommandId, CommandSpec> = {
  moveRight: {
    id: 'moveRight',
    label: 'hero.moveRight()',
    insert: 'hero.moveRight()\n',
    apply: 'hero.moveRight()',
    detailKey: 'cc.cmd.moveRight',
    iconName: 'compass',
  },
  moveLeft: {
    id: 'moveLeft',
    label: 'hero.moveLeft()',
    insert: 'hero.moveLeft()\n',
    apply: 'hero.moveLeft()',
    detailKey: 'cc.cmd.moveLeft',
    iconName: 'compass',
  },
  moveUp: {
    id: 'moveUp',
    label: 'hero.moveUp()',
    insert: 'hero.moveUp()\n',
    apply: 'hero.moveUp()',
    detailKey: 'cc.cmd.moveUp',
    iconName: 'compass',
  },
  moveDown: {
    id: 'moveDown',
    label: 'hero.moveDown()',
    insert: 'hero.moveDown()\n',
    apply: 'hero.moveDown()',
    detailKey: 'cc.cmd.moveDown',
    iconName: 'compass',
  },
  collect: {
    id: 'collect',
    label: 'hero.collect()',
    insert: 'hero.collect()\n',
    apply: 'hero.collect()',
    detailKey: 'cc.cmd.collect',
    iconName: 'gem',
  },
  useKey: {
    id: 'useKey',
    label: 'hero.useKey()',
    insert: 'hero.useKey()\n',
    apply: 'hero.useKey()',
    detailKey: 'cc.cmd.useKey',
    iconName: 'lock',
  },
  attack: {
    id: 'attack',
    label: 'hero.attack()',
    insert: 'hero.attack()\n',
    apply: 'hero.attack()',
    detailKey: 'cc.cmd.attack',
    iconName: 'sword',
  },
  say: {
    id: 'say',
    label: 'hero.say("...")',
    insert: 'hero.say("hello")\n',
    apply: 'hero.say("hello")',
    detailKey: 'cc.cmd.say',
    iconName: 'spark',
  },
  comment: {
    id: 'comment',
    label: '# comment',
    insert: '# ...\n',
    apply: '# ...',
    detailKey: 'cc.cmd.comment',
    iconName: 'binary',
  },
  forLoop: {
    id: 'forLoop',
    label: 'for i in range(3):',
    insert: 'for i in range(3):\n    hero.moveRight()\n',
    apply: 'for i in range(3):\n    hero.moveRight()',
    detailKey: 'cc.cmd.forLoop',
    iconName: 'loop',
  },
  ifElse: {
    id: 'ifElse',
    label: 'if / else',
    insert: 'if hero.canMove("right"):\n    hero.moveRight()\nelse:\n    hero.moveDown()\n',
    apply: 'if hero.canMove("right"):\n    hero.moveRight()\nelse:\n    hero.moveDown()',
    detailKey: 'cc.cmd.ifElse',
    iconName: 'puzzle',
  },
};

/** Returns the level's relevant commands, in the curriculum order it declares them. */
export function commandsForLevel(level: CodecasterLevel): CommandSpec[] {
  return level.commands.map((id) => COMMANDS[id]);
}
