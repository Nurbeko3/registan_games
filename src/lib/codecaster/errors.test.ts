/**
 * errors.ts — kid-friendly Skulpt traceback mapping tests.
 *
 * Goals: every realistic PyError shape resolves to a SPECIFIC, defined i18n
 * key (never undefined / empty), most-specific-first ordering holds (e.g.
 * IndentationError isn't swallowed by the generic SyntaxError branch), vars
 * (line/name) pass through correctly, and unknown messages hit the generic
 * fallback rather than throwing or returning garbage.
 */

import { describe, it, expect } from 'vitest';
import { explainError } from './errors';
import type { PyError } from './pyrunner/protocol';

const err = (over: Partial<PyError>): PyError => ({ kind: 'runtime', message: '', ...over });

// Every key this module can possibly emit — used to assert "always a known key".
const KNOWN_TITLE_KEYS = new Set([
  'cc.err.timeout',
  'cc.err.indent',
  'cc.err.colon',
  'cc.err.name',
  'cc.err.equals',
  'cc.err.quotes',
  'cc.err.syntax',
  'cc.err.generic',
]);
const KNOWN_BODY_KEYS = new Set([
  'cc.err.timeoutBody',
  'cc.err.indentBody',
  'cc.err.colonBody',
  'cc.err.nameBody',
  'cc.err.equalsBody',
  'cc.err.quotesBody',
  'cc.err.syntaxBody',
  'cc.err.genericBody',
]);

function assertKnownKeys(e: ReturnType<typeof explainError>) {
  expect(e.titleKey).toBeTruthy();
  expect(e.bodyKey).toBeTruthy();
  expect(KNOWN_TITLE_KEYS.has(e.titleKey)).toBe(true);
  expect(KNOWN_BODY_KEYS.has(e.bodyKey)).toBe(true);
}

describe('explainError — specific pattern -> key mapping', () => {
  it('EM-01: timeout kind maps to the timeout key regardless of message text', () => {
    const e = explainError(err({ kind: 'timeout', message: 'whatever' }));
    expect(e.titleKey).toBe('cc.err.timeout');
    expect(e.bodyKey).toBe('cc.err.timeoutBody');
    assertKnownKeys(e);
  });

  it('EM-02: IndentationError maps to the indent key (and is NOT swallowed by the generic SyntaxError branch)', () => {
    const variants = [
      'IndentationError: unexpected indent',
      'IndentationError: expected an indented block',
      'SyntaxError: unexpected indent', // Skulpt sometimes wraps indentation issues as SyntaxError
    ];
    for (const message of variants) {
      const e = explainError(err({ kind: 'syntax', message }));
      expect(e.titleKey, `for message: ${message}`).toBe('cc.err.indent');
      expect(e.bodyKey).toBe('cc.err.indentBody');
    }
  });

  it('EM-03: missing colon variants map to the colon key', () => {
    const variants = [
      "SyntaxError: expected ':'",
      'SyntaxError: bad token',
      'ParseError: bad input',
    ];
    for (const message of variants) {
      const e = explainError(err({ kind: 'syntax', message }));
      expect(e.titleKey, `for message: ${message}`).toBe('cc.err.colon');
    }
  });

  it('EM-04: NameError maps to the name key and extracts the offending identifier into vars.name', () => {
    const e = explainError(err({ kind: 'runtime', message: "NameError: name 'moveright' is not defined", line: 4 }));
    expect(e.titleKey).toBe('cc.err.name');
    expect(e.bodyKey).toBe('cc.err.nameBody');
    expect(e.vars).toEqual({ name: 'moveright' });
    expect(e.line).toBe(4);
  });

  it('EM-05: NameError-shaped message without the "name X is not defined" pattern still maps to the name key, with vars omitted (no name extracted)', () => {
    const e = explainError(err({ kind: 'runtime', message: "NameError: free variable referenced before assignment" }));
    expect(e.titleKey).toBe('cc.err.name');
    expect(e.vars).toBeUndefined();
  });

  it('EM-06: assignment-in-comparison ("=" vs "==") maps to the equals key', () => {
    const variants = [
      "SyntaxError: can't assign to literal",
      'SyntaxError: cannot assign to operator',
      'SyntaxError: assign to literal',
    ];
    for (const message of variants) {
      const e = explainError(err({ kind: 'syntax', message }));
      expect(e.titleKey, `for message: ${message}`).toBe('cc.err.equals');
    }
  });

  it('EM-07: unterminated string / missing quotes maps to the quotes key', () => {
    const variants = [
      'SyntaxError: EOL while scanning string literal',
      'SyntaxError: unterminated string literal',
      'SyntaxError: unexpected EOF while parsing',
    ];
    for (const message of variants) {
      const e = explainError(err({ kind: 'syntax', message }));
      expect(e.titleKey, `for message: ${message}`).toBe('cc.err.quotes');
    }
  });

  it('EM-08: a generic SyntaxError (no specific pattern matched) maps to the syntax key', () => {
    const e = explainError(err({ kind: 'syntax', message: 'SyntaxError: invalid syntax' }));
    expect(e.titleKey).toBe('cc.err.syntax');
    expect(e.bodyKey).toBe('cc.err.syntaxBody');
  });

  it('EM-09: kind "syntax" with a totally unrecognized message still maps to the syntax key (kind alone is enough)', () => {
    const e = explainError(err({ kind: 'syntax', message: 'gibberish that matches nothing specific' }));
    expect(e.titleKey).toBe('cc.err.syntax');
  });

  it('EM-10: an unrecognized runtime message falls back to the generic key (never undefined)', () => {
    const e = explainError(err({ kind: 'runtime', message: 'TypeError: something exotic Skulpt has never said before' }));
    expect(e.titleKey).toBe('cc.err.generic');
    expect(e.bodyKey).toBe('cc.err.genericBody');
  });

  it('EM-11: kind "internal" with no recognizable message falls back to generic', () => {
    const e = explainError(err({ kind: 'internal', message: '' }));
    expect(e.titleKey).toBe('cc.err.generic');
  });
});

describe('explainError — ordering / most-specific-first guarantees', () => {
  it('ORD-01: a message containing both "IndentationError" and "SyntaxError" resolves to indent (specific wins over generic)', () => {
    const e = explainError(err({ kind: 'syntax', message: 'SyntaxError: IndentationError: unexpected indent' }));
    expect(e.titleKey).toBe('cc.err.indent');
  });

  it('ORD-02: "is not defined" wins over a generic SyntaxError classification when both could loosely match', () => {
    // Skulpt sometimes reports undefined names as a parse-stage complaint;
    // the NameError-ish phrase should still route to the name explanation.
    const e = explainError(err({ kind: 'syntax', message: "ReferenceError: 'pip' is not defined" }));
    expect(e.titleKey).toBe('cc.err.name');
  });

  it('ORD-03: timeout kind wins even if the message also contains SyntaxError-looking text', () => {
    const e = explainError(err({ kind: 'timeout', message: 'SyntaxError: this should not matter' }));
    expect(e.titleKey).toBe('cc.err.timeout');
  });
});

describe('explainError — vars/line passthrough & edge inputs', () => {
  it('VL-01: line number passes through untouched when present', () => {
    const e = explainError(err({ kind: 'runtime', message: 'NameError: name "x" is not defined', line: 12 }));
    expect(e.line).toBe(12);
  });

  it('VL-02: line is omitted (undefined) when Skulpt does not report one', () => {
    const e = explainError(err({ kind: 'runtime', message: 'TypeError: oops' }));
    expect(e.line).toBeUndefined();
  });

  it('VL-03: line 0 is passed through as-is (falsy but valid) — not coerced to undefined', () => {
    const e = explainError(err({ kind: 'runtime', message: 'TypeError: oops', line: 0 }));
    expect(e.line).toBe(0);
  });

  it('VL-04: an empty/missing message string never throws and resolves to a known key', () => {
    expect(() => explainError(err({ kind: 'runtime', message: '' }))).not.toThrow();
    expect(() => explainError({ kind: 'runtime' } as PyError)).not.toThrow(); // message entirely absent
    const e = explainError({ kind: 'runtime' } as PyError);
    assertKnownKeys(e);
  });

  it('VL-05: matching is case-insensitive (Skulpt casing is not guaranteed across builds)', () => {
    const e1 = explainError(err({ kind: 'syntax', message: "nameerror: name 'x' is not defined" }));
    expect(e1.titleKey).toBe('cc.err.name');
    const e2 = explainError(err({ kind: 'syntax', message: 'INDENTATIONERROR: UNEXPECTED INDENT' }));
    expect(e2.titleKey).toBe('cc.err.indent');
  });

  it('VL-06: extractName grabs the LAST/most relevant quoted identifier shape, ignoring surrounding noise', () => {
    const e = explainError(err({ kind: 'runtime', message: "Traceback...\nNameError: name 'movRight' is not defined\n" }));
    expect(e.vars).toEqual({ name: 'movRight' });
  });

  it('VL-07: a name containing special regex characters does not break extraction or throw', () => {
    const e = explainError(err({ kind: 'runtime', message: "NameError: name 'foo.bar[0]' is not defined" }));
    expect(() => e).not.toThrow();
    expect(e.vars).toEqual({ name: 'foo.bar[0]' });
  });
});

describe('explainError — exhaustive fuzz over every known key resolves to a defined pair', () => {
  it('FZ-01: a battery of realistic and synthetic messages all resolve to a known {titleKey, bodyKey} pair', () => {
    const battery: PyError[] = [
      err({ kind: 'syntax', message: '' }),
      err({ kind: 'runtime', message: '' }),
      err({ kind: 'internal', message: '' }),
      err({ kind: 'timeout', message: '' }),
      err({ kind: 'syntax', message: 'Token (2, 5): mismatched input' }),
      err({ kind: 'runtime', message: "AttributeError: 'NoneType' object has no attribute 'moveRight'" }),
      err({ kind: 'runtime', message: 'TypeError: moveRight() takes 1 positional argument but 2 were given' }),
      err({ kind: 'runtime', message: 'IndexError: list index out of range' }),
      err({ kind: 'runtime', message: 'ZeroDivisionError: integer division or modulo by zero' }),
      err({ kind: 'runtime', message: 'RecursionError: maximum recursion depth exceeded' }),
      err({ kind: 'syntax', message: 'unexpected EOF while parsing' }),
      err({ kind: 'syntax', message: "EOL while scanning string literal" }),
    ];
    for (const e of battery) {
      const explained = explainError(e);
      assertKnownKeys(explained);
    }
  });
});
