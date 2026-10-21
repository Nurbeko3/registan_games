'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { python } from '@codemirror/lang-python';
import { EditorView } from '@codemirror/view';
import { autocompletion, type CompletionSource } from '@codemirror/autocomplete';
import { motion, useReducedMotion } from 'framer-motion';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/lib/i18n';
import type { ExplainedError } from '@/lib/codecaster/errors';
import type { CommandSpec } from '@/data/codecaster/commands';

// CodeMirror touches the DOM/measures text — load client-only to avoid any
// hydration mismatch (mirrors the project's "gate dynamic bits" convention).
const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), { ssr: false });

// Colours come from the design tokens so the editor follows light/dark mode.
const editorTheme = EditorView.theme({
  '&': { fontSize: '14px', backgroundColor: 'rgb(var(--surface))', color: 'rgb(var(--fg))' },
  '.cm-content': { fontFamily: 'var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace', padding: '12px 0', minHeight: '260px' },
  '.cm-gutters': { backgroundColor: 'rgb(var(--surface-2))', color: 'rgb(var(--fg-faint))', border: 'none', borderRight: '1px solid rgb(var(--border))' },
  '.cm-activeLine': { backgroundColor: 'rgb(var(--brand-500) / 0.06)' },
  '.cm-activeLineGutter': { backgroundColor: 'rgb(var(--brand-500) / 0.10)' },
  '.cm-cursor': { borderLeftColor: 'rgb(var(--brand-500))' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: 'rgb(var(--brand-500) / 0.18) !important' },
  '&.cm-focused': { outline: 'none' },
  '.cm-tooltip-autocomplete': {
    borderRadius: '0.75rem',
    overflow: 'hidden',
    border: '1px solid rgb(var(--border))',
    backgroundColor: 'rgb(var(--surface))',
    color: 'rgb(var(--fg))',
    boxShadow: '0 12px 24px -6px rgb(16 24 40 / 0.14)',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'rgb(var(--brand-50))',
    color: 'rgb(var(--brand-700))',
  },
});

export type RunState = 'idle' | 'running' | 'won' | 'lost' | 'error';

interface CodePaneProps {
  code: string;
  onChange: (code: string) => void;
  onRun: () => void;
  onReset: () => void;
  onHint: () => void;
  runState: RunState;
  output: string[];
  error: ExplainedError | null;
  errorLine?: number;
  hintsRevealed: number;
  hintsTotal: number;
  /** Only the commands relevant to the current level — drives palette + autocomplete. */
  commands: CommandSpec[];
}

/**
 * Builds a CodeMirror `CompletionSource` scoped to this level's commands only.
 * Triggers on word characters and right after `hero.` so kids see exactly the
 * handful of calls they've been taught — never the full 11-command catalog.
 */
function buildCompletionSource(commands: CommandSpec[], describe: (key: string) => string): CompletionSource {
  const options = commands.map((c) => ({
    label: c.apply,
    apply: c.apply,
    detail: c.label,
    info: describe(c.detailKey),
    type: 'function',
    boost: 1,
  }));

  return (context) => {
    // Match either a bare identifier prefix ("mov", "hero") or "hero.something".
    const word = context.matchBefore(/[\w.]*/);
    if (!word) return null;
    if (word.from === word.to && !context.explicit) return null;
    return {
      from: word.from,
      options,
      validFor: /^[\w.]*$/,
    };
  };
}

export function CodePane({
  code, onChange, onRun, onReset, onHint,
  runState, output, error, hintsRevealed, hintsTotal, commands,
}: CodePaneProps) {
  const t = useT();
  const shouldReduceMotion = useReducedMotion();
  const running = runState === 'running';

  const extensions = useMemo(() => {
    const source = buildCompletionSource(commands, (key) => t(key));
    return [
      python(),
      editorTheme,
      EditorView.lineWrapping,
      autocompletion({ override: [source], activateOnTyping: true }),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commands]);

  const insertSnippet = (snippet: string) => {
    // Append at the end with a separating newline — simplest & predictable for
    // young/touch users who can't reliably position a cursor in a tiny editor.
    const sep = code.length > 0 && !code.endsWith('\n') ? '\n' : '';
    onChange(`${code}${sep}${snippet}`);
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRun}
          disabled={running}
          className="btn-primary btn-sm gap-1.5"
        >
          {running ? (
            <motion.span
              aria-hidden
              animate={shouldReduceMotion ? {} : { rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
            >
              <Icon name="refresh" className="h-4 w-4" />
            </motion.span>
          ) : (
            <Icon name="play" className="h-4 w-4" />
          )}
          {running ? t('cc.running') : t('cc.run')}
        </button>
        <button type="button" onClick={onReset} className="btn-secondary btn-sm gap-1.5">
          <Icon name="refresh" className="h-3.5 w-3.5" /> {t('cc.reset')}
        </button>
        <button
          type="button"
          onClick={onHint}
          disabled={hintsRevealed >= hintsTotal}
          className="btn-subtle btn-sm gap-1.5 text-amber-700 hover:bg-amber-50"
        >
          <Icon name="spark" className="h-3.5 w-3.5" />
          {t('cc.hint')}{hintsRevealed > 0 ? ` (${hintsRevealed}/${hintsTotal})` : ''}
        </button>
        <span className={`ml-auto ${
          runState === 'won' ? 'badge-success' : runState === 'error' ? 'badge-danger' : runState === 'lost' ? 'badge-warning' : runState === 'running' ? 'badge-brand' : 'badge-neutral'
        }`}>
          {runState === 'idle' ? 'ready' : runState}
        </span>
      </div>

      {/* Editor */}
      <div className="overflow-hidden rounded-xl border border-border">
        <CodeMirror
          value={code}
          height="280px"
          extensions={extensions}
          onChange={onChange}
          editable={!running}
          basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
          aria-label={t('cc.editorAlt')}
        />
      </div>

      {/* Relevant-only command palette */}
      <div>
        <p className="eyebrow mb-1.5">
          {t('cc.palette')}
        </p>
        <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label={t('cc.snippets')}>
          {commands.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => insertSnippet(c.insert)}
              disabled={running}
              title={t(c.detailKey)}
              className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 font-mono text-xs font-semibold text-fg transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
            >
              {c.iconName && <Icon name={c.iconName} className="h-3.5 w-3.5" />}
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Output / error panel */}
      <div className="rounded-xl border border-border bg-surface-2 px-3.5 py-3">
        <p className="eyebrow">{t('cc.output')}</p>
        {error ? (
          <div role="alert" className="mt-2 flex items-start gap-2.5 rounded-lg border border-danger-100 bg-danger-50 px-3 py-2.5 text-danger-700">
            <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-display text-sm font-bold">
                {t(error.titleKey)}{error.line != null ? ` · ${t('cc.line', { n: error.line })}` : ''}
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-danger-700/90">{t(error.bodyKey, error.vars)}</p>
            </div>
          </div>
        ) : output.length > 0 ? (
          <ul className="mt-2 space-y-1 font-mono text-sm">
            {output.map((line, i) => (
              <li key={i} className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-fg">
                {line}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-sm text-fg-faint">{t('cc.outputEmpty')}</p>
        )}
      </div>
    </div>
  );
}
