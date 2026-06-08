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

const editorTheme = EditorView.theme({
  '&': { fontSize: '15px', borderRadius: '1rem', overflow: 'hidden' },
  '.cm-content': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', padding: '14px 0', minHeight: '260px' },
  '.cm-gutters': { backgroundColor: '#F7F6FE', color: '#8B87B3', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'rgba(124,92,252,0.06)' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(124,92,252,0.10)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-tooltip-autocomplete': {
    borderRadius: '0.85rem',
    overflow: 'hidden',
    border: '1px solid rgba(124,92,252,0.18)',
    boxShadow: '0 12px 28px -8px rgba(60,40,140,0.28)',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'rgba(124,92,252,0.14)',
    color: '#3D2E8C',
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
      {/* Editor */}
      <div className="overflow-hidden rounded-2xl ring-1 ring-grape-100/60">
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
        <p className="mb-1.5 px-0.5 text-[11px] font-extrabold uppercase tracking-wide text-ink-faint">
          {t('cc.palette')}
        </p>
        <div className="-mx-1 flex flex-wrap gap-1.5 px-1" role="toolbar" aria-label={t('cc.snippets')}>
          {commands.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => insertSnippet(c.insert)}
              disabled={running}
              title={t(c.detailKey)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-grape-50 px-3 py-2 text-xs font-extrabold text-grape ring-1 ring-grape-100 transition hover:bg-grape-100 disabled:opacity-50 min-h-[44px]"
            >
              {c.iconName && <Icon name={c.iconName} className="h-3.5 w-3.5" />}
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRun}
          disabled={running}
          className="btn-primary min-h-[44px] flex-1 gap-2 disabled:opacity-60"
        >
          {running ? (
            <motion.span
              aria-hidden
              animate={shouldReduceMotion ? {} : { rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
            >
              <Icon name="loop" className="h-5 w-5" />
            </motion.span>
          ) : (
            <Icon name="zap" className="h-5 w-5" />
          )}
          {running ? t('cc.running') : t('cc.run')}
        </button>
        <button type="button" onClick={onReset} className="btn-ghost min-h-[44px] gap-2">
          <Icon name="loop" className="h-4 w-4" /> {t('cc.reset')}
        </button>
        <button
          type="button"
          onClick={onHint}
          disabled={hintsRevealed >= hintsTotal}
          className="btn-sun min-h-[44px] gap-2 disabled:opacity-60"
        >
          <Icon name="spark" className="h-4 w-4" />
          {t('cc.hint')}{hintsRevealed > 0 ? ` (${hintsRevealed}/${hintsTotal})` : ''}
        </button>
      </div>

      {/* Output / error panel */}
      <div className="rounded-2xl bg-cloud/70 px-4 py-3">
        <p className="text-xs font-extrabold uppercase tracking-wide text-ink-faint">{t('cc.output')}</p>
        {error ? (
          <div className="mt-2 rounded-xl bg-bubble/10 px-3 py-2.5 ring-1 ring-bubble/20">
            <p className="font-display text-sm font-extrabold text-bubble-600">
              {t(error.titleKey)}{error.line != null ? ` · ${t('cc.line', { n: error.line })}` : ''}
            </p>
            <p className="mt-1 text-sm font-bold leading-relaxed text-ink-soft">{t(error.bodyKey, error.vars)}</p>
          </div>
        ) : output.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {output.map((line, i) => (
              <li key={i} className="rounded-lg bg-white px-3 py-1.5 text-sm font-bold text-ink ring-1 ring-grape-100/50">
                {line}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-sm font-bold text-ink-faint">{t('cc.outputEmpty')}</p>
        )}
      </div>
    </div>
  );
}
