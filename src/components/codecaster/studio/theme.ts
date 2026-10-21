/**
 * Code Studio editor theme — CodeMirror styling on the app's design tokens so
 * the editor follows light/dark mode (VS Code Dark+ feel in dark mode).
 */
import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

export const studioEditorTheme = EditorView.theme({
  '&': {
    fontSize: '14px',
    backgroundColor: 'rgb(var(--surface))',
    color: 'rgb(var(--fg))',
    height: '100%',
  },
  '.cm-scroller': { fontFamily: 'var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace', lineHeight: '1.6' },
  '.cm-content': { padding: '12px 0', caretColor: 'rgb(var(--brand-500))' },
  '.cm-line': { padding: '0 12px' },
  '.cm-gutters': {
    backgroundColor: 'rgb(var(--surface))',
    color: 'rgb(var(--fg-faint))',
    border: 'none',
    borderRight: '1px solid rgb(var(--border))',
    minWidth: '44px',
  },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 6px', fontSize: '12px' },
  '.cm-activeLine': { backgroundColor: 'rgb(var(--brand-500) / 0.06)' },
  '.cm-activeLineGutter': { backgroundColor: 'rgb(var(--brand-500) / 0.10)', color: 'rgb(var(--fg))' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'rgb(var(--brand-500))', borderLeftWidth: '2px' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: 'rgb(var(--brand-500) / 0.18) !important' },
  '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': { backgroundColor: 'rgb(var(--brand-500) / 0.16)', outline: '1px solid rgb(var(--brand-300))', borderRadius: '2px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-tooltip-autocomplete': {
    borderRadius: '0.625rem',
    overflow: 'hidden',
    border: '1px solid rgb(var(--border))',
    backgroundColor: 'rgb(var(--surface))',
    color: 'rgb(var(--fg))',
    boxShadow: '0 12px 24px -6px rgb(16 24 40 / 0.18)',
    fontFamily: 'var(--font-mono), ui-monospace, monospace',
    fontSize: '13px',
  },
  '.cm-tooltip-autocomplete ul li': { padding: '4px 8px' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: 'rgb(var(--brand-50))', color: 'rgb(var(--brand-700))' },
  '.cm-completionDetail': { color: 'rgb(var(--fg-faint))', fontStyle: 'normal', marginLeft: '8px' },
  '.cm-completionIcon': { opacity: '0.6' },
  '.cm-placeholder': { color: 'rgb(var(--fg-faint))' },
});

/** VS Code-ish token colours mapped onto the semantic palette. */
export const studioHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: [t.keyword, t.controlKeyword, t.operatorKeyword], color: 'rgb(var(--violet-600))', fontWeight: '600' },
    { tag: [t.definitionKeyword, t.moduleKeyword], color: 'rgb(var(--violet-600))' },
    { tag: [t.string, t.special(t.string)], color: 'rgb(var(--success-600))' },
    { tag: [t.number, t.bool, t.null], color: 'rgb(var(--amber-600))' },
    { tag: [t.comment, t.lineComment, t.blockComment], color: 'rgb(var(--fg-faint))', fontStyle: 'italic' },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'rgb(var(--info-600))' },
    { tag: [t.propertyName, t.attributeName], color: 'rgb(var(--brand-600))' },
    { tag: [t.variableName, t.name], color: 'rgb(var(--fg))' },
    { tag: [t.self, t.atom], color: 'rgb(var(--brand-600))' },
    { tag: [t.operator, t.punctuation, t.paren, t.bracket, t.brace], color: 'rgb(var(--fg-soft))' },
    { tag: t.invalid, color: 'rgb(var(--danger-600))', textDecoration: 'underline wavy' },
  ]),
);
