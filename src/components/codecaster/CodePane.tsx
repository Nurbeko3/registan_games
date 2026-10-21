'use client';

import { useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { python } from '@codemirror/lang-python';
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { indentUnit } from '@codemirror/language';
import { Prec } from '@codemirror/state';
import { indentWithTab } from '@codemirror/commands';
import { autocompletion, type CompletionSource } from '@codemirror/autocomplete';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/lib/i18n';
import { studioEditorTheme, studioHighlight } from './studio/theme';
import type { CommandSpec } from '@/data/codecaster/commands';

// CodeMirror touches the DOM/measures text — load client-only to avoid any
// hydration mismatch (mirrors the project's "gate dynamic bits" convention).
const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), { ssr: false });

export type RunState = 'idle' | 'running' | 'won' | 'lost' | 'error';

export interface CursorPos { line: number; col: number }

interface CodePaneProps {
  code: string;
  onChange: (code: string) => void;
  /** Mod+Enter inside the editor. */
  onRun: () => void;
  /** Mod+S inside the editor (browser save is suppressed). */
  onSave?: () => void;
  onCursor?: (pos: CursorPos) => void;
  running: boolean;
  /** Only the commands relevant to the current level — drives palette + autocomplete. */
  commands: CommandSpec[];
  /** Editor height; `100%` fills a flex parent. */
  height?: string;
  /** Show the tap-to-insert command strip under the editor. */
  showPalette?: boolean;
  className?: string;
}

/**
 * Builds a CodeMirror `CompletionSource` scoped to this level's commands only.
 * Triggers on word characters and right after `hero.` so kids see exactly the
 * handful of calls they've been taught — never the full catalog.
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
    const word = context.matchBefore(/[\w.]*/);
    if (!word) return null;
    if (word.from === word.to && !context.explicit) return null;
    return { from: word.from, options, validFor: /^[\w.]*$/ };
  };
}

/**
 * The Code Studio editor: CodeMirror 6 + Python, level-scoped autocomplete,
 * VS Code-style keymap (Mod+Enter run, Mod+S save flash, Tab = 4 spaces),
 * bracket matching/closing, cursor tracking for the status bar, and an
 * optional tap-to-insert command strip for touch users.
 */
export function CodePane({
  code, onChange, onRun, onSave, onCursor, running, commands,
  height = '100%', showPalette = true, className = '',
}: CodePaneProps) {
  const t = useT();

  // Keymap handlers read the latest callbacks through refs so the extension
  // array stays stable (rebuilding extensions resets editor state).
  const runRef = useRef(onRun);
  const saveRef = useRef(onSave);
  const cursorRef = useRef(onCursor);
  useEffect(() => { runRef.current = onRun; saveRef.current = onSave; cursorRef.current = onCursor; });

  const extensions = useMemo(() => {
    const source = buildCompletionSource(commands, (key) => t(key));
    return [
      python(),
      studioEditorTheme,
      studioHighlight,
      indentUnit.of('    '),
      EditorView.lineWrapping,
      cmPlaceholder('# hero.moveRight()'),
      autocompletion({ override: [source], activateOnTyping: true }),
      // Highest precedence so Mod-Enter beats the default Enter binding.
      Prec.highest(keymap.of([
        { key: 'Mod-Enter', run: () => { runRef.current(); return true; } },
        { key: 'Mod-s', run: () => { saveRef.current?.(); return true; }, preventDefault: true },
        indentWithTab,
      ])),
      EditorView.updateListener.of((u) => {
        if (!cursorRef.current) return;
        if (u.selectionSet || u.docChanged || u.focusChanged) {
          const pos = u.state.selection.main.head;
          const line = u.state.doc.lineAt(pos);
          cursorRef.current({ line: line.number, col: pos - line.from + 1 });
        }
      }),
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
    <div className={`flex min-h-0 flex-1 flex-col ${className}`}>
      <div className="relative min-h-0 flex-1">
        <CodeMirror
          className="absolute inset-0 [&_.cm-editor]:h-full"
          theme="none"
          value={code}
          height={height}
          extensions={extensions}
          onChange={onChange}
          editable={!running}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: true,
            highlightActiveLineGutter: true,
            bracketMatching: true,
            closeBrackets: true,
            indentOnInput: true,
            autocompletion: false, // we provide our own scoped source above
          }}
          indentWithTab={false} // handled by our keymap (4 spaces)
          aria-label={t('cc.editorAlt')}
        />
      </div>

      {showPalette && (
        <div className="shrink-0 border-t border-border bg-surface-2 px-3 py-2">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none" role="toolbar" aria-label={t('cc.snippets')}>
            <span className="eyebrow shrink-0">{t('cc.palette')}</span>
            {commands.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => insertSnippet(c.insert)}
                disabled={running}
                title={t(c.detailKey)}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-2 font-mono text-xs font-semibold text-fg transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
              >
                {c.iconName && <Icon name={c.iconName} className="h-3.5 w-3.5" />}
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
