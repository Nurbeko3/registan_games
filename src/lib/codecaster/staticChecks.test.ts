import { describe, it, expect } from 'vitest';
import { analyzePython, usedConcept, type ConceptKey } from './staticChecks';

describe('analyzePython — sequence', () => {
  it('empty / whitespace-only code has no statements', () => {
    expect(analyzePython('').sequence).toBe(false);
    expect(analyzePython('   \n\n  ').sequence).toBe(false);
  });

  it('a single statement counts as a sequence', () => {
    expect(analyzePython('hero.moveRight()').sequence).toBe(true);
  });

  it('a comment-only program is not a sequence', () => {
    const u = analyzePython('# just a note');
    expect(u.sequence).toBe(false);
    expect(u.comment).toBe(true);
  });
});

describe('analyzePython — comments', () => {
  it('detects a real comment', () => {
    expect(analyzePython('hero.moveRight()  # go east').comment).toBe(true);
  });

  it('a # inside a string is NOT a comment', () => {
    expect(analyzePython('hero.say("press # to start")').comment).toBe(false);
  });

  it('"# for loop here" is a comment, not a for loop', () => {
    const u = analyzePython('# for loop here');
    expect(u.comment).toBe(true);
    expect(u.for).toBe(false);
  });
});

describe('analyzePython — for loops', () => {
  it('for ... in range(): counts as for + call', () => {
    const u = analyzePython('for i in range(4):\n    hero.moveRight()');
    expect(u.for).toBe(true);
    expect(u.call).toBe(true);
    expect(u.sequence).toBe(true);
  });

  it('the one-liner from the brief: for i in range(4): hero.moveRight()', () => {
    const u = analyzePython('for i in range(4): hero.moveRight()');
    expect(u.for).toBe(true);
    expect(u.call).toBe(true);
  });

  it('8 brute-force calls do NOT earn the loop star', () => {
    const code = Array(8).fill('hero.moveRight()').join('\n');
    const u = analyzePython(code);
    expect(u.for).toBe(false);
    expect(u.while).toBe(false);
    expect(u.call).toBe(true);
    expect(u.sequence).toBe(true);
  });

  it('"for" as a substring without the loop shape does not count', () => {
    expect(analyzePython('comfort = 3').for).toBe(false);
    expect(analyzePython('hero.say("for the win")').for).toBe(false);
  });

  it('for over a list', () => {
    expect(analyzePython('for d in path:\n    hero.move(d)').for).toBe(true);
  });
});

describe('analyzePython — while loops', () => {
  it('while with a sensor counts', () => {
    const u = analyzePython('while hero.canMove("right"):\n    hero.moveRight()');
    expect(u.while).toBe(true);
    expect(u.call).toBe(true);
  });

  it('"while" inside a string does not count', () => {
    expect(analyzePython('hero.say("while you wait")').while).toBe(false);
  });
});

describe('analyzePython — if / elif', () => {
  it('if with comparison counts as if, not variable', () => {
    const u = analyzePython('if x <= 1:\n    hero.moveRight()');
    expect(u.if).toBe(true);
    expect(u.variable).toBe(false);
  });

  it('elif counts as if', () => {
    const code = 'if a:\n    pass\nelif b:\n    pass';
    expect(analyzePython(code).if).toBe(true);
  });

  it('hero.say("if x == 3") is a call only — not if, not variable', () => {
    const u = analyzePython('hero.say("if x == 3")');
    expect(u.if).toBe(false);
    expect(u.variable).toBe(false);
    expect(u.call).toBe(true);
  });
});

describe('analyzePython — variables (assignment heuristic)', () => {
  it('steps = 3 is a variable', () => {
    const u = analyzePython('steps = 3');
    expect(u.variable).toBe(true);
  });

  it('x == 3 (comparison) is NOT a variable', () => {
    expect(analyzePython('x == 3').variable).toBe(false);
  });

  it('keyword-arg call f(x=1) is NOT a top-level assignment', () => {
    expect(analyzePython('hero.go(x=1)').variable).toBe(false);
  });

  it('assignment whose value uses a keyword arg still counts', () => {
    expect(analyzePython('result = compute(x=1)').variable).toBe(true);
  });

  it('augmented assignment x += 1 is NOT counted as introducing a variable', () => {
    expect(analyzePython('x += 1').variable).toBe(false);
  });

  it('def line is not an assignment', () => {
    expect(analyzePython('def go(n=3):\n    pass').variable).toBe(false);
  });

  it('list assignment is a variable', () => {
    const u = analyzePython('path = ["right","up"]');
    expect(u.variable).toBe(true);
    expect(u.list).toBe(true);
  });

  it('tuple/multiple assignment counts', () => {
    expect(analyzePython('a, b = 1, 2').variable).toBe(true);
  });
});

describe('analyzePython — functions', () => {
  it('def go(n): is a function', () => {
    const u = analyzePython('def go(n):\n    hero.moveRight()');
    expect(u.function).toBe(true);
  });

  it('def with no params is a function', () => {
    expect(analyzePython('def step():\n    pass').function).toBe(true);
  });

  it('"def" inside a string does not count', () => {
    expect(analyzePython('hero.say("def not")').function).toBe(false);
  });
});

describe('analyzePython — lists', () => {
  it('list literal in assignment', () => {
    expect(analyzePython('path = ["right","up"]').list).toBe(true);
  });

  it('list iterated inline', () => {
    expect(analyzePython('for d in ["a","b"]:\n    pass').list).toBe(true);
  });

  it('bare indexing a[0] is NOT a list literal', () => {
    expect(analyzePython('hero.move(path[0])').list).toBe(false);
  });

  it('empty list literal assigned counts', () => {
    expect(analyzePython('items = []').list).toBe(true);
  });
});

describe('analyzePython — calls', () => {
  it('detects method call', () => {
    expect(analyzePython('hero.moveRight()').call).toBe(true);
  });

  it('detects range() inside a for header', () => {
    expect(analyzePython('for i in range(3):\n    pass').call).toBe(true);
  });

  it('a plain assignment with no call has no call', () => {
    expect(analyzePython('steps = 3').call).toBe(false);
  });

  it('control keywords followed by ( are not calls on their own', () => {
    // `if (cond):` — the only paren is the keyword's; no real call
    expect(analyzePython('if (x):\n    pass').call).toBe(false);
  });
});

describe('string / comment stripping crux', () => {
  it('keywords hidden in strings never trigger', () => {
    const code = 'hero.say("for if while def [list] x == 3")';
    const u = analyzePython(code);
    expect(u.for).toBe(false);
    expect(u.if).toBe(false);
    expect(u.while).toBe(false);
    expect(u.function).toBe(false);
    expect(u.list).toBe(false);
    expect(u.variable).toBe(false);
    expect(u.call).toBe(true);
  });

  it('escaped quotes inside a string are handled', () => {
    const u = analyzePython('hero.say("she said \\"if\\" loudly")');
    expect(u.if).toBe(false);
    expect(u.call).toBe(true);
  });

  it('triple-quoted docstring content is ignored', () => {
    const code = 'def f():\n    """for i in range(3): if x == 1"""\n    hero.moveRight()';
    const u = analyzePython(code);
    expect(u.function).toBe(true);
    expect(u.for).toBe(false);
    expect(u.if).toBe(false);
    expect(u.call).toBe(true);
  });
});

describe('usedConcept agrees with analyzePython', () => {
  const samples: string[] = [
    'for i in range(4): hero.moveRight()',
    'hero.moveRight()',
    '# for loop here',
    'hero.say("if x == 3")',
    'steps = 3',
    'if x <= 1:\n    pass',
    'def go(n):\n    pass',
    'path = ["right","up"]',
    'while hero.canMove("right"):\n    hero.moveRight()',
  ];
  const keys: ConceptKey[] = [
    'sequence',
    'comment',
    'variable',
    'for',
    'while',
    'if',
    'function',
    'list',
    'call',
  ];

  it('matches for every sample and concept', () => {
    for (const code of samples) {
      const usage = analyzePython(code);
      for (const k of keys) {
        expect(usedConcept(code, k)).toBe(usage[k]);
      }
    }
  });
});
