'use client';

import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/lib/i18n';
import type { SourceDoc, CaseQuestion, SourceKind } from '@/data/cases/types';
import { DOC_META } from './docMeta';

/**
 * The investigation panel — renders every source document as a "paper" card
 * skinned by its kind (chat bubbles, profile rows, email meta…). Stays mounted
 * and reachable during the question rounds (core pedagogy: we test
 * evidence-FINDING, not memory). When `highlight` is set (post-answer reveal),
 * the matching source is emphasised and its evidence passage marked.
 */
export function SourcesPane({
  sources,
  highlight,
}: {
  sources: SourceDoc[];
  highlight?: { sourceId: string; passage: string } | null;
}) {
  const t = useT();
  return (
    <div className="space-y-3">
      {sources.map((doc) => {
        const meta = DOC_META[doc.kind];
        const isEvidence = highlight?.sourceId === doc.id;
        const range = isEvidence && highlight ? passageRange(doc.body, highlight.passage) : null;
        return (
          <article
            key={doc.id}
            className={`panel overflow-hidden transition-[box-shadow,border-color] ${
              isEvidence ? 'border-amber-400 shadow-md ring-2 ring-amber-200' : ''
            }`}
            aria-label={t(meta.labelKey)}
          >
            <header className="flex items-center gap-2.5 border-b border-border bg-surface-2 px-4 py-2.5">
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${meta.accent}`}>
                <Icon name={meta.icon} className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 truncate font-display text-sm font-bold text-fg">{doc.title}</span>
              <span className="badge-neutral shrink-0">{t(meta.labelKey)}</span>
              {isEvidence && (
                <span className="badge inline-flex shrink-0 items-center gap-1 bg-amber-100 text-amber-700">
                  <Icon name="eye" className="h-3 w-3" />
                  {t('case.evidence')}
                </span>
              )}
            </header>
            <div className="px-4 py-3.5 text-sm leading-relaxed text-fg-soft">
              <DocBody kind={doc.kind} body={doc.body} range={range} />
            </div>
          </article>
        );
      })}
    </div>
  );
}

/* ── body renderers ─────────────────────────────────────────────────────── */

const SPEAKER = /^([^:\n]{1,28}):\s(.+)$/;

function DocBody({ kind, body, range }: { kind: SourceKind; body: string; range: [number, number] | null }) {
  const lines = splitWithOffsets(body);

  if (kind === 'chatLog') {
    const speakers: string[] = [];
    return (
      <ul className="space-y-2">
        {lines.map((ln, i) => {
          const m = ln.text.match(SPEAKER);
          if (!m) {
            return ln.text.trim() ? (
              <li key={i} className="px-1 text-xs text-fg-faint">{mark(ln, range)}</li>
            ) : null;
          }
          const who = m[1];
          if (!speakers.includes(who)) speakers.push(who);
          const side = speakers.indexOf(who) % 2 === 0 ? 'left' : 'right';
          const msgStart = ln.start + m[0].length - m[2].length;
          return (
            <li key={i} className={`flex ${side === 'right' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[88%] rounded-xl px-3 py-2 ${side === 'right' ? 'bg-brand-50 text-fg' : 'bg-surface-2 text-fg'}`}>
                <p className="text-2xs font-bold uppercase tracking-wide text-fg-faint">{who}</p>
                <p className="mt-0.5 text-sm">{mark({ text: m[2], start: msgStart }, range)}</p>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  if (kind === 'profileCard' || kind === 'ticket') {
    const rows = lines.filter((l) => l.text.trim());
    const allKv = rows.length > 0 && rows.every((l) => SPEAKER.test(l.text));
    if (allKv) {
      return (
        <dl className="divide-y divide-border">
          {rows.map((ln, i) => {
            const m = ln.text.match(SPEAKER)!;
            const valStart = ln.start + m[0].length - m[2].length;
            return (
              <div key={i} className="grid grid-cols-[minmax(6rem,34%)_1fr] gap-3 py-1.5 first:pt-0 last:pb-0">
                <dt className="truncate text-xs font-bold uppercase tracking-wide text-fg-faint">{m[1]}</dt>
                <dd className="text-sm font-medium text-fg">{mark({ text: m[2], start: valStart }, range)}</dd>
              </div>
            );
          })}
        </dl>
      );
    }
  }

  if (kind === 'email') {
    // Leading "Key: value" lines (From/To/Subject…) become a meta block.
    const metaLines: typeof lines = [];
    let i = 0;
    while (i < lines.length && SPEAKER.test(lines[i].text) && metaLines.length < 4) {
      metaLines.push(lines[i]);
      i++;
    }
    const rest = lines.slice(i);
    return (
      <div>
        {metaLines.length > 0 && (
          <dl className="mb-3 rounded-lg border border-border bg-surface-2 px-3 py-2">
            {metaLines.map((ln, k) => {
              const m = ln.text.match(SPEAKER)!;
              const valStart = ln.start + m[0].length - m[2].length;
              return (
                <div key={k} className="flex gap-2 py-0.5 text-xs">
                  <dt className="w-16 shrink-0 font-bold uppercase tracking-wide text-fg-faint">{m[1]}</dt>
                  <dd className="font-medium text-fg">{mark({ text: m[2], start: valStart }, range)}</dd>
                </div>
              );
            })}
          </dl>
        )}
        <Paragraphs lines={rest} range={range} />
      </div>
    );
  }

  return <Paragraphs lines={lines} range={range} />;
}

function Paragraphs({ lines, range }: { lines: Line[]; range: [number, number] | null }) {
  return (
    <div className="space-y-1.5 whitespace-pre-line">
      {lines.map((ln, i) =>
        ln.text.trim() ? (
          <p key={i} className={/^[—–-]\s/.test(ln.text) ? 'text-xs font-semibold text-fg-faint' : ''}>
            {mark(ln, range)}
          </p>
        ) : null,
      )}
    </div>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

interface Line { text: string; start: number }

function splitWithOffsets(body: string): Line[] {
  const out: Line[] = [];
  let pos = 0;
  for (const text of body.split('\n')) {
    out.push({ text, start: pos });
    pos += text.length + 1;
  }
  return out;
}

/** Character range of the evidence passage in the body, or null.
 *  When `passage` is empty (cloud reveal knows the source but not the exact text,
 *  since publicCase strips it), the source is just ring-highlighted, no <mark>. */
function passageRange(body: string, passage: string): [number, number] | null {
  if (!passage) return null;
  const idx = body.indexOf(passage);
  return idx < 0 ? null : [idx, idx + passage.length];
}

/** Render a line, wrapping the part that overlaps the evidence range in <mark>. */
function mark(ln: Line, range: [number, number] | null): ReactNode {
  if (!range) return ln.text;
  const [a, b] = range;
  const s = Math.max(a, ln.start);
  const e = Math.min(b, ln.start + ln.text.length);
  if (s >= e) return ln.text;
  const from = s - ln.start;
  const to = e - ln.start;
  return (
    <>
      {ln.text.slice(0, from)}
      <mark className="rounded bg-amber-200 px-0.5 font-semibold text-fg">{ln.text.slice(from, to)}</mark>
      {ln.text.slice(to)}
    </>
  );
}

/** Compact helper to read the evidence highlight for a question. */
export function evidenceFor(q: CaseQuestion): { sourceId: string; passage: string } {
  return { sourceId: q.evidenceSourceId, passage: q.evidencePassage };
}
