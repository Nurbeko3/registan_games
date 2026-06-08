/**
 * errors.ts — translate a Skulpt PyError into a kind, kid-English explanation.
 *
 * PURE logic (no React/DOM). Maps common Skulpt traceback shapes to i18n KEYS
 * (the component does the actual t(key, vars) lookup), so the encouraging copy
 * lives in translations.ts and stays trilingual. Framing is always "the hero
 * got confused on line N", never "you failed" — see docs/codecaster-design.md
 * §4.10.
 *
 * Detection is substring/regex over `err.message` (Skulpt messages are English,
 * technical). We return the MOST SPECIFIC match and fall back to a generic
 * runtime/syntax message when nothing matches.
 */

import type { PyError } from './pyrunner/protocol';

/** A translated, kid-friendly explanation of a Python error. */
export interface ExplainedError {
  /** i18n key for the short, friendly title (e.g. "Oops — a tiny hiccup!"). */
  titleKey: string;
  /** i18n key for the body that explains what to fix, encouragingly. */
  bodyKey: string;
  /** 1-based source line the hero "got confused" on, when Skulpt reports one. */
  line?: number;
  /** Interpolation vars for the body string (e.g. {name} for NameError). */
  vars?: Record<string, string | number>;
}

/**
 * Pull the offending identifier out of a NameError message, e.g.
 *   "NameError: name 'moveright' is not defined" -> "moveright".
 */
function extractName(message: string): string | undefined {
  const m = /name '([^']+)' is not defined/i.exec(message)
    ?? /'([^']+)' is not defined/i.exec(message);
  return m?.[1];
}

/**
 * Explain a PyError as i18n keys + vars.
 *
 * Order matters: most-specific patterns are tested first so e.g. an
 * IndentationError isn't swallowed by the broad SyntaxError fallback.
 */
export function explainError(err: PyError): ExplainedError {
  const msg = err.message ?? '';
  const line = err.line;
  const base = (titleKey: string, bodyKey: string, vars?: ExplainedError['vars']): ExplainedError => ({
    titleKey,
    bodyKey,
    line,
    ...(vars ? { vars } : {}),
  });

  // 1. Timeout — the loop never ended (engine hit its step cap / wall clock).
  if (err.kind === 'timeout') {
    return base('cc.err.timeout', 'cc.err.timeoutBody');
  }

  // 2. Indentation — must be checked BEFORE the generic SyntaxError branch.
  if (/IndentationError/i.test(msg) || /unexpected indent/i.test(msg) || /expected an indented block/i.test(msg)) {
    return base('cc.err.indent', 'cc.err.indentBody');
  }

  // 3. Missing colon at the end of an if/for/while/def line.
  //    Skulpt reports this variously: "expected ':'", "bad token", "bad input".
  if (/expected ':'/i.test(msg) || /bad token/i.test(msg) || /bad input/i.test(msg) || /expected ?:/i.test(msg)) {
    return base('cc.err.colon', 'cc.err.colonBody');
  }

  // 4. Undefined name — typo'd command or an unquoted word (NameError).
  if (/NameError/i.test(msg) || /is not defined/i.test(msg)) {
    const name = extractName(msg);
    return base('cc.err.name', 'cc.err.nameBody', name ? { name } : undefined);
  }

  // 5. `=` used where `==` was meant (assignment in a comparison position).
  //    Skulpt surfaces this as a SyntaxError mentioning assignment.
  if (/can't assign/i.test(msg) || /cannot assign/i.test(msg) || /assign to (literal|operator)/i.test(msg)) {
    return base('cc.err.equals', 'cc.err.equalsBody');
  }

  // 6. Missing quotes / unterminated string literal.
  if (/EOL while scanning string/i.test(msg) || /unterminated string/i.test(msg) || /unexpected EOF/i.test(msg)) {
    return base('cc.err.quotes', 'cc.err.quotesBody');
  }

  // 7. Any other syntax problem — generic, still kind.
  if (err.kind === 'syntax' || /SyntaxError/i.test(msg)) {
    return base('cc.err.syntax', 'cc.err.syntaxBody');
  }

  // 8. Generic runtime / internal fallback.
  return base('cc.err.generic', 'cc.err.genericBody');
}
