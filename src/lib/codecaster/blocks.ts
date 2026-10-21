/**
 * Blocks → code: the data model behind the Codecaster block editor.
 *
 * Young students (7–9) assemble a vertical stack of blocks; this module turns
 * that stack into the exact Python the engine runs (`hero.moveRight()`,
 * `for i in range(n):` …), so grading, replay and anti-cheat are unchanged —
 * the blocks are only an input method. Pure and framework-free (tested).
 */

import type { CommandId } from '@/data/codecaster/commands';

/** Blocks a student can place; `repeat` nests other blocks. */
export type BlockKind =
  | 'moveRight' | 'moveLeft' | 'moveUp' | 'moveDown'
  | 'collect' | 'useKey' | 'attack' | 'say' | 'comment'
  | 'repeat' | 'ifCanMove';

export interface LeafBlock {
  id: string;
  kind: Exclude<BlockKind, 'repeat' | 'ifCanMove'>;
  /** Text argument for `say` / `comment`. */
  text?: string;
}

export interface RepeatBlock {
  id: string;
  kind: 'repeat';
  times: number;
  children: Block[];
}

export interface IfCanMoveBlock {
  id: string;
  kind: 'ifCanMove';
  direction: Direction;
  children: Block[];
  otherwise: Block[];
}

export type Block = LeafBlock | RepeatBlock | IfCanMoveBlock;
export type Direction = 'right' | 'left' | 'up' | 'down';

export const DIRECTIONS: Direction[] = ['right', 'left', 'up', 'down'];

/** Map from a level's taught command ids to the block kinds the palette shows. */
export function blockKindsForCommands(commands: CommandId[]): BlockKind[] {
  const kinds: BlockKind[] = [];
  for (const c of commands) {
    if (c === 'forLoop') kinds.push('repeat');
    else if (c === 'ifElse') kinds.push('ifCanMove');
    else kinds.push(c);
  }
  return kinds;
}

/**
 * Block kinds shown in a level's palette: the level's taught commands, plus
 * `repeat` always (control flow is the whole point of block-building for young
 * learners and `for` is valid Python at any level). `ifCanMove` appears only
 * when the level teaches if/else.
 */
export function paletteKindsForLevel(commands: CommandId[]): BlockKind[] {
  const kinds = blockKindsForCommands(commands);
  if (!kinds.includes('repeat')) kinds.push('repeat');
  return kinds;
}

let seq = 0;
/** Stable-enough ids for React keys (not persisted). */
export function newBlockId(): string {
  seq += 1;
  return `b${Date.now().toString(36)}${seq}`;
}

/** Create a fresh block of a kind with sensible defaults. */
export function createBlock(kind: BlockKind): Block {
  const id = newBlockId();
  switch (kind) {
    case 'repeat': return { id, kind, times: 3, children: [] };
    case 'ifCanMove': return { id, kind, direction: 'right', children: [], otherwise: [] };
    case 'say': return { id, kind, text: 'hello' };
    case 'comment': return { id, kind, text: '...' };
    default: return { id, kind };
  }
}

const LEAF_CODE: Record<LeafBlock['kind'], string> = {
  moveRight: 'hero.moveRight()',
  moveLeft: 'hero.moveLeft()',
  moveUp: 'hero.moveUp()',
  moveDown: 'hero.moveDown()',
  collect: 'hero.collect()',
  useKey: 'hero.useKey()',
  attack: 'hero.attack()',
  say: 'hero.say("…")',
  comment: '# …',
};

/** Escape a user string for a double-quoted Python literal. */
function pyString(s: string): string {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ') + '"';
}

function emit(blocks: Block[], indent: number, out: string[]): void {
  const pad = '    '.repeat(indent);
  for (const b of blocks) {
    if (b.kind === 'repeat') {
      const n = Math.max(1, Math.min(99, Math.floor(b.times) || 1));
      out.push(`${pad}for i in range(${n}):`);
      if (b.children.length === 0) out.push(`${pad}    pass`);
      else emit(b.children, indent + 1, out);
    } else if (b.kind === 'ifCanMove') {
      out.push(`${pad}if hero.canMove(${pyString(b.direction)}):`);
      if (b.children.length === 0) out.push(`${pad}    pass`);
      else emit(b.children, indent + 1, out);
      if (b.otherwise.length > 0) {
        out.push(`${pad}else:`);
        emit(b.otherwise, indent + 1, out);
      }
    } else if (b.kind === 'say') {
      out.push(`${pad}hero.say(${pyString(b.text ?? '')})`);
    } else if (b.kind === 'comment') {
      out.push(`${pad}# ${(b.text ?? '').replace(/\n/g, ' ')}`);
    } else {
      out.push(`${pad}${LEAF_CODE[b.kind]}`);
    }
  }
}

/** Generate runnable Python for a block stack (trailing newline, 4-space indents). */
export function blocksToPython(blocks: Block[]): string {
  if (blocks.length === 0) return '';
  const out: string[] = [];
  emit(blocks, 0, out);
  return out.join('\n') + '\n';
}

/** Count every block, including nested ones. */
export function countBlocks(blocks: Block[]): number {
  let n = 0;
  for (const b of blocks) {
    n += 1;
    if (b.kind === 'repeat') n += countBlocks(b.children);
    else if (b.kind === 'ifCanMove') n += countBlocks(b.children) + countBlocks(b.otherwise);
  }
  return n;
}

// ── immutable tree helpers (used by the UI) ─────────────────────────────────

/** A path addresses a block: [index, slot, index, slot, ...] from the root. */
export type Slot = 'children' | 'otherwise';
export type BlockPath = Array<number | Slot>;

function listAt(root: Block[], path: BlockPath): Block[] {
  let list = root;
  for (let i = 0; i < path.length; i += 2) {
    const idx = path[i] as number;
    const slot = path[i + 1] as Slot;
    const b = list[idx];
    if (!b || (b.kind !== 'repeat' && b.kind !== 'ifCanMove')) return list;
    list = b.kind === 'repeat' ? b.children : slot === 'otherwise' ? b.otherwise : b.children;
  }
  return list;
}

/** Return a new tree with `fn` applied to the list addressed by `path`. */
export function updateList(root: Block[], path: BlockPath, fn: (list: Block[]) => Block[]): Block[] {
  if (path.length === 0) return fn(root);
  const idx = path[0] as number;
  const slot = path[1] as Slot;
  return root.map((b, i) => {
    if (i !== idx) return b;
    if (b.kind === 'repeat') return { ...b, children: updateList(b.children, path.slice(2), fn) };
    if (b.kind === 'ifCanMove') {
      return slot === 'otherwise'
        ? { ...b, otherwise: updateList(b.otherwise, path.slice(2), fn) }
        : { ...b, children: updateList(b.children, path.slice(2), fn) };
    }
    return b;
  });
}

export function appendBlock(root: Block[], path: BlockPath, block: Block): Block[] {
  return updateList(root, path, (list) => [...list, block]);
}

export function removeBlock(root: Block[], path: BlockPath, index: number): Block[] {
  return updateList(root, path, (list) => list.filter((_, i) => i !== index));
}

export function moveBlock(root: Block[], path: BlockPath, index: number, delta: -1 | 1): Block[] {
  return updateList(root, path, (list) => {
    const j = index + delta;
    if (j < 0 || j >= list.length) return list;
    const next = list.slice();
    const [item] = next.splice(index, 1);
    next.splice(j, 0, item!);
    return next;
  });
}

export function updateBlock(root: Block[], path: BlockPath, index: number, patch: Partial<Block>): Block[] {
  return updateList(root, path, (list) => list.map((b, i) => (i === index ? ({ ...b, ...patch } as Block) : b)));
}

export function blockAt(root: Block[], path: BlockPath, index: number): Block | undefined {
  return listAt(root, path)[index];
}

/** Insert a block at `index` inside the list addressed by `path`. */
export function insertBlock(root: Block[], path: BlockPath, index: number, block: Block): Block[] {
  return updateList(root, path, (list) => {
    const next = list.slice();
    next.splice(Math.max(0, Math.min(list.length, index)), 0, block);
    return next;
  });
}

/** Deep-copy a block (and its children) with fresh ids. */
export function cloneBlock(b: Block): Block {
  if (b.kind === 'repeat') return { ...b, id: newBlockId(), children: b.children.map(cloneBlock) };
  if (b.kind === 'ifCanMove') return { ...b, id: newBlockId(), children: b.children.map(cloneBlock), otherwise: b.otherwise.map(cloneBlock) };
  return { ...b, id: newBlockId() };
}

/** True when `path` still addresses an existing container in `root`. */
export function pathExists(root: Block[], path: BlockPath): boolean {
  let list = root;
  for (let i = 0; i < path.length; i += 2) {
    const b = list[path[i] as number];
    if (!b || (b.kind !== 'repeat' && b.kind !== 'ifCanMove')) return false;
    const slot = path[i + 1] as Slot;
    if (slot === 'otherwise' && b.kind !== 'ifCanMove') return false;
    list = b.kind === 'repeat' ? b.children : slot === 'otherwise' ? b.otherwise : b.children;
  }
  return true;
}
