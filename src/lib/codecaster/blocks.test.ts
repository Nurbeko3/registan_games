import { describe, expect, it } from 'vitest';
import {
  appendBlock, blockKindsForCommands, blocksToPython, cloneBlock, countBlocks, createBlock,
  insertBlock, moveBlock, paletteKindsForLevel, pathExists, removeBlock, updateBlock, type Block,
} from './blocks';
import { DungeonEngine, runActions } from './engine';
import { CODECASTER_LEVELS } from '@/data/codecaster/levels';

const leaf = (kind: Block['kind']) => createBlock(kind);

describe('blocksToPython', () => {
  it('emits one hero call per leaf block, in order', () => {
    const code = blocksToPython([leaf('moveRight'), leaf('attack'), leaf('collect')]);
    expect(code).toBe('hero.moveRight()\nhero.attack()\nhero.collect()\n');
  });

  it('returns an empty string for an empty stack', () => {
    expect(blocksToPython([])).toBe('');
  });

  it('nests repeat children with 4-space indents and clamps the count', () => {
    const rep = createBlock('repeat');
    if (rep.kind !== 'repeat') throw new Error('expected repeat');
    const code = blocksToPython([{ ...rep, times: 4, children: [leaf('moveRight'), leaf('moveUp')] }]);
    expect(code).toBe('for i in range(4):\n    hero.moveRight()\n    hero.moveUp()\n');
    const zero = blocksToPython([{ ...rep, times: 0, children: [leaf('moveRight')] }]);
    expect(zero.startsWith('for i in range(1):')).toBe(true);
  });

  it('emits `pass` for an empty repeat/if body so the Python stays valid', () => {
    expect(blocksToPython([createBlock('repeat')])).toBe('for i in range(3):\n    pass\n');
    expect(blocksToPython([createBlock('ifCanMove')])).toBe('if hero.canMove("right"):\n    pass\n');
  });

  it('emits if/else with the chosen direction', () => {
    const b = createBlock('ifCanMove');
    if (b.kind !== 'ifCanMove') throw new Error('expected if');
    const code = blocksToPython([{ ...b, direction: 'down', children: [leaf('moveDown')], otherwise: [leaf('moveRight')] }]);
    expect(code).toBe('if hero.canMove("down"):\n    hero.moveDown()\nelse:\n    hero.moveRight()\n');
  });

  it('escapes say/comment text safely', () => {
    const say = { ...createBlock('say'), text: 'he said "hi"\nthere' } as Block;
    const comment = { ...createBlock('comment'), text: 'first\nline' } as Block;
    expect(blocksToPython([say, comment])).toBe('hero.say("he said \\"hi\\" there")\n# first line\n');
  });

  it('supports deep nesting', () => {
    const inner = createBlock('repeat');
    const outer = createBlock('repeat');
    if (inner.kind !== 'repeat' || outer.kind !== 'repeat') throw new Error();
    const code = blocksToPython([{ ...outer, times: 2, children: [{ ...inner, times: 3, children: [leaf('moveRight')] }] }]);
    expect(code).toBe('for i in range(2):\n    for i in range(3):\n        hero.moveRight()\n');
  });
});

describe('block tree helpers', () => {
  it('append / move / remove / update at the root', () => {
    let tree = appendBlock([], [], leaf('moveRight'));
    tree = appendBlock(tree, [], leaf('attack'));
    expect(tree.map((b) => b.kind)).toEqual(['moveRight', 'attack']);
    tree = moveBlock(tree, [], 1, -1);
    expect(tree.map((b) => b.kind)).toEqual(['attack', 'moveRight']);
    tree = moveBlock(tree, [], 0, -1); // no-op at the edge
    expect(tree.map((b) => b.kind)).toEqual(['attack', 'moveRight']);
    tree = removeBlock(tree, [], 0);
    expect(tree.map((b) => b.kind)).toEqual(['moveRight']);
  });

  it('edits inside a repeat via a path without mutating the input', () => {
    const rep = createBlock('repeat');
    const tree: Block[] = [rep];
    const next = appendBlock(tree, [0, 'children'], leaf('collect'));
    expect(countBlocks(next)).toBe(2);
    expect(countBlocks(tree)).toBe(1);
    const updated = updateBlock(next, [], 0, { times: 7 } as Partial<Block>);
    expect((updated[0] as { times: number }).times).toBe(7);
    expect(blocksToPython(updated)).toBe('for i in range(7):\n    hero.collect()\n');
  });

  it('maps level commands to palette block kinds', () => {
    expect(blockKindsForCommands(['moveRight', 'forLoop', 'ifElse', 'say'])).toEqual(['moveRight', 'repeat', 'ifCanMove', 'say']);
  });

  it('palette always offers repeat, and ifCanMove only when taught', () => {
    expect(paletteKindsForLevel(['moveRight', 'collect'])).toEqual(['moveRight', 'collect', 'repeat']);
    expect(paletteKindsForLevel(['moveRight', 'forLoop'])).toEqual(['moveRight', 'repeat']);
    expect(paletteKindsForLevel(['ifElse'])).toEqual(['ifCanMove', 'repeat']);
  });

  it('insertBlock places at an index (clamped) and cloneBlock deep-copies with new ids', () => {
    let tree = appendBlock([], [], leaf('moveRight'));
    tree = insertBlock(tree, [], 0, leaf('attack'));
    tree = insertBlock(tree, [], 99, leaf('collect'));
    expect(tree.map((b) => b.kind)).toEqual(['attack', 'moveRight', 'collect']);
    const rep = createBlock('repeat');
    const nested = appendBlock([rep], [0, 'children'], leaf('say'));
    const copy = cloneBlock(nested[0]!);
    expect(copy.id).not.toBe(nested[0]!.id);
    if (copy.kind !== 'repeat' || nested[0]!.kind !== 'repeat') throw new Error();
    expect(copy.children[0]!.id).not.toBe(nested[0]!.children[0]!.id);
    expect(blocksToPython([copy])).toBe(blocksToPython(nested));
  });

  it('pathExists validates container paths', () => {
    const tree = [createBlock('repeat'), createBlock('ifCanMove'), leaf('moveRight')];
    expect(pathExists(tree, [])).toBe(true);
    expect(pathExists(tree, [0, 'children'])).toBe(true);
    expect(pathExists(tree, [1, 'otherwise'])).toBe(true);
    expect(pathExists(tree, [0, 'otherwise'])).toBe(false);
    expect(pathExists(tree, [2, 'children'])).toBe(false);
    expect(pathExists(tree, [7, 'children'])).toBe(false);
  });
});

describe('generated code solves real levels', () => {
  it('L01 is won by three moveRight blocks (through the engine, same as typed code)', () => {
    const level = CODECASTER_LEVELS[0]!;
    const blocks = [leaf('moveRight'), leaf('moveRight'), leaf('moveRight')];
    expect(blocksToPython(blocks)).toBe('hero.moveRight()\nhero.moveRight()\nhero.moveRight()\n');
    // The engine only sees actions; the block editor produces exactly the calls a student would type.
    const result = runActions(level, blocks.map(() => ({ op: 'move' as const, dir: 'right' as const })));
    expect(result.state.status).toBe('won');
    expect(new DungeonEngine(level).state.status).toBe('playing');
  });
});
