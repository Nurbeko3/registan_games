/**
 * staticChecks.ts — concept-usage detection for the Codecaster 3-star gate.
 *
 * PURE, dependency-free. No DOM, no React, no Node APIs. Safe to run on the
 * client or replayed on the server (see docs/codecaster-design.md §6.1 — this
 * is the `staticChecks(code)` half of the `PyRunner` interface, kept separate
 * so it can grade the "used the target concept, not a brute-force copy-paste"
 * star without a Python runtime).
 *
 * --------------------------------------------------------------------------
 * HOW IT WORKS
 * --------------------------------------------------------------------------
 * This is a heuristic line/regex scanner, NOT a Python parser. Beginner code
 * is small and regular, so a careful regex pass is plenty — but the crux is
 * that keywords/operators hiding inside comments and strings must NOT count:
 *
 *   # this is a for loop          -> for  = false (it's a comment)
 *   hero.say("if you see this")   -> if   = false (it's a string)
 *   hero.say("x == 3")            -> if/variable = false
 *
 * So the pipeline is:
 *   1. Detect `comment` on the ORIGINAL text (a real `#` outside a string).
 *   2. STRIP comments (`#` to end-of-line) and string literal *contents*
 *      (the quotes survive as empty `""`/`''` so call/assignment shape is
 *      preserved), respecting escapes. Triple-quoted strings/docstrings are
 *      handled too.
 *   3. Run keyword/operator detection against the STRIPPED code only.
 *
 * --------------------------------------------------------------------------
 * KNOWN LIMITS (acceptable for a kids' teaching tool)
 * --------------------------------------------------------------------------
 * - `variable`: line-based heuristic. A real assignment is `name = expr`
 *   where `=` is not part of `== >= <= != += -= *= /=` etc., the line does
 *   not start with a keyword (`if/elif/while/for/return/...`), and is not a
 *   `def`/lambda or a bare keyword-arg call like `f(x=1)`. We require the
 *   `=` to sit at the statement's top level (paren depth 0), which rejects
 *   `f(x=1)` but accepts `x = f(a=1)`. Augmented assignments (`x += 1`) are
 *   intentionally NOT counted as introducing a variable (they mutate one).
 *   Tuple/multiple assignment (`a, b = 1, 2`) and annotated (`x: int = 1`)
 *   are still detected because a top-level `=` remains.
 * - `list`: matches a `[...]` literal that looks like data — assigned
 *   (`= [...]`), iterated (`in [...]`), or a bracket pair containing a comma
 *   or string. We deliberately do NOT count bare indexing (`a[0]`, `path[i]`)
 *   to avoid false positives; the tradeoff is that a one-element no-comma
 *   literal used somewhere odd could be missed (rare in beginner code).
 * - `call`: any `name(...)` / `obj.method(...)`. Excludes the def site and
 *   control keywords that are followed by `(`.
 * - Multi-line constructs split mid-token are out of scope (kids type one
 *   statement per line).
 */

export type ConceptKey =
  | 'sequence'
  | 'comment'
  | 'variable'
  | 'for'
  | 'while'
  | 'if'
  | 'function'
  | 'list'
  | 'call';

export interface ConceptUsage {
  sequence: boolean; // ≥1 statement
  comment: boolean; // a # comment
  variable: boolean; // an assignment like `x = 3` (NOT ==, <=, def, or keyword args)
  for: boolean; // a `for ... in ...:` loop
  while: boolean; // a `while ...:` loop
  if: boolean; // an `if`/`elif`
  function: boolean; // a `def name(...):`
  list: boolean; // a list literal `[...]`
  call: boolean; // any function call `name(...)`
}

/** Keywords that may be directly followed by `(` but are NOT function calls. */
const NON_CALL_KEYWORDS = new Set([
  'if',
  'elif',
  'while',
  'for',
  'return',
  'and',
  'or',
  'not',
  'in',
  'is',
  'else',
  'print', // `print` IS a call — kept out of this set on purpose (see below)
]);
// `print` should count as a call, so remove it from the exclusion set.
NON_CALL_KEYWORDS.delete('print');

/**
 * Strip comment and string-literal CONTENT from Python source.
 *
 * Returns code where:
 *   - everything from an unquoted `#` to end of line is removed,
 *   - string literals keep their delimiters but lose their inner text
 *     (`"hello"` -> `""`, `'a\'b'` -> `''`), so call/assignment structure
 *     (parens, commas, `=`) outside strings is untouched while keywords
 *     hidden inside strings vanish.
 *
 * Handles single/double quotes, escaped quotes, and triple-quoted strings.
 */
function stripCommentsAndStrings(code: string): string {
  let out = '';
  let i = 0;
  const n = code.length;

  while (i < n) {
    const ch = code[i];
    const two = code.slice(i, i + 3);

    // Triple-quoted string (''' or """)
    if (two === '"""' || two === "'''") {
      const quote = two;
      out += quote; // keep opening delimiter
      i += 3;
      while (i < n && code.slice(i, i + 3) !== quote) {
        // preserve newlines so line counting downstream stays sane
        if (code[i] === '\n') out += '\n';
        i += 1;
      }
      if (i < n) {
        out += quote; // closing delimiter
        i += 3;
      }
      continue;
    }

    // Single/double quoted string
    if (ch === '"' || ch === "'") {
      const quote = ch;
      out += quote;
      i += 1;
      while (i < n && code[i] !== quote) {
        if (code[i] === '\\') {
          i += 2; // skip escaped char
          continue;
        }
        if (code[i] === '\n') break; // unterminated string on this line; bail
        i += 1;
      }
      if (i < n && code[i] === quote) {
        out += quote;
        i += 1;
      }
      continue;
    }

    // Comment: `#` to end of line
    if (ch === '#') {
      while (i < n && code[i] !== '\n') i += 1;
      continue; // newline (if any) handled on next iteration
    }

    out += ch;
    i += 1;
  }

  return out;
}

/**
 * Does the ORIGINAL source contain a real `#` comment (one outside a string)?
 * Scans the original text tracking string state so a `#` inside a literal
 * (`"a#b"`) or inside a docstring is not mistaken for a comment.
 */
function hasComment(code: string): boolean {
  let i = 0;
  const n = code.length;
  while (i < n) {
    const ch = code[i];
    const three = code.slice(i, i + 3);
    if (three === '"""' || three === "'''") {
      const q = three;
      i += 3;
      while (i < n && code.slice(i, i + 3) !== q) i += 1;
      i += 3;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const q = ch;
      i += 1;
      while (i < n && code[i] !== q) {
        if (code[i] === '\\') {
          i += 2;
          continue;
        }
        if (code[i] === '\n') break;
        i += 1;
      }
      i += 1;
      continue;
    }
    if (ch === '#') return true;
    i += 1;
  }
  return false;
}

/** Split into logical lines, trimmed; blank lines dropped. */
function nonBlankLines(stripped: string): string[] {
  return stripped
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

const FOR_RE = /(^|\s)for\s+.+\s+in\s+.+:/;
const WHILE_RE = /(^|;)\s*while\b.*:/;
const IF_RE = /(^|;)\s*(if|elif)\b.*:/;
const DEF_RE = /(^|;)\s*def\s+[A-Za-z_]\w*\s*\(/;

/**
 * True if the line (paren depth 0) contains a top-level `=` that is a real
 * assignment operator, not part of `== <= >= != += -= *= /= //= **= %= etc`.
 */
function hasTopLevelAssignment(line: string): boolean {
  let depth = 0;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') depth -= 1;
    else if (c === '=' && depth === 0) {
      const prev = line[i - 1];
      const next = line[i + 1];
      // part of ==, !=, <=, >=  ->  next or prev is '='
      if (next === '=') {
        i += 1; // skip the second '='
        continue;
      }
      if (prev === '=') continue; // already consumed as `==`
      // augmented (+= -= *= /= %= //= **= &= |= ^= >>= <<=) -> prev is op char
      if (prev !== undefined && '+-*/%&|^<>@'.includes(prev)) continue;
      return true; // a lone, top-level '=' : assignment
    }
  }
  return false;
}

const ASSIGNMENT_LINE_KEYWORDS = /^(if|elif|else|while|for|def|class|return|yield|with|assert|lambda|import|from|global|nonlocal|raise|del|print|pass|break|continue)\b/;

function isAssignment(line: string): boolean {
  if (ASSIGNMENT_LINE_KEYWORDS.test(line)) return false;
  return hasTopLevelAssignment(line);
}

/**
 * Detect a list literal: `[ ... ]` that looks like data rather than indexing.
 * Accept when the bracket pair is: preceded by `=` or `in` or `(` or `,` or
 * `return`/start, OR contains a comma, OR contains a quote. Reject bare
 * indexing such as `a[0]` / `path[i]`.
 */
function hasListLiteral(stripped: string): boolean {
  for (let i = 0; i < stripped.length; i += 1) {
    if (stripped[i] !== '[') continue;
    // find matching close
    let depth = 0;
    let j = i;
    for (; j < stripped.length; j += 1) {
      if (stripped[j] === '[') depth += 1;
      else if (stripped[j] === ']') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    if (j >= stripped.length) break; // unbalanced
    const inner = stripped.slice(i + 1, j);

    // What precedes the '['? Skip whitespace backwards.
    let k = i - 1;
    while (k >= 0 && /\s/.test(stripped[k])) k -= 1;
    const prevChar = k >= 0 ? stripped[k] : '';
    // grab the trailing word before the bracket (for `in`, `return`)
    let w = k;
    while (w >= 0 && /[A-Za-z_]/.test(stripped[w])) w -= 1;
    const prevWord = stripped.slice(w + 1, k + 1);

    const indexing = /[A-Za-z_0-9)\]]/.test(prevChar) && prevWord !== 'in' && prevWord !== 'return';
    if (indexing) continue; // looks like subscription: a[...], foo()[...]

    if (inner.includes(',') || /['"]/.test(inner)) return true;
    // empty or single-element literal at a data position
    if (
      prevChar === '=' ||
      prevChar === '(' ||
      prevChar === ',' ||
      prevChar === '' ||
      prevChar === ':' ||
      prevWord === 'in' ||
      prevWord === 'return'
    ) {
      return true;
    }
  }
  return false;
}

/** Detect any function call `name(...)` / `obj.method(...)` in stripped code. */
function hasCall(stripped: string): boolean {
  const re = /([A-Za-z_]\w*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    const name = m[1];
    // Skip `def name(` definition sites and control keywords followed by `(`.
    const before = stripped.slice(0, m.index);
    if (/\bdef\s*$/.test(before)) continue;
    if (NON_CALL_KEYWORDS.has(name)) continue;
    return true;
  }
  return false;
}

export function analyzePython(code: string): ConceptUsage {
  const comment = hasComment(code);
  const stripped = stripCommentsAndStrings(code);
  const lines = nonBlankLines(stripped);

  let isFor = false;
  let isWhile = false;
  let isIf = false;
  let isFunction = false;
  let variable = false;

  for (const line of lines) {
    if (!isFor && FOR_RE.test(line)) isFor = true;
    if (!isWhile && WHILE_RE.test(line)) isWhile = true;
    if (!isIf && IF_RE.test(line)) isIf = true;
    if (!isFunction && DEF_RE.test(line)) isFunction = true;
    if (!variable && isAssignment(line)) variable = true;
  }

  return {
    sequence: lines.length > 0,
    comment,
    variable,
    for: isFor,
    while: isWhile,
    if: isIf,
    function: isFunction,
    list: hasListLiteral(stripped),
    call: hasCall(stripped),
  };
}

/** True if the given target concept is present (used for the 3-star gate). */
export function usedConcept(code: string, concept: ConceptKey): boolean {
  return analyzePython(code)[concept];
}
