'use client';

import { Icon } from '@/components/ui/Icon';
import { useT } from '@/lib/i18n';
import type { SourceDoc, CaseQuestion } from '@/data/cases/types';
import { DOC_META } from './docMeta';

/**
 * The investigation panel — renders every source document. Stays mounted and
 * reachable during the question rounds (core pedagogy: we test evidence-FINDING,
 * not memory). When `highlight` is set (post-answer reveal), the matching source
 * is emphasised and its evidence passage marked.
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
        return (
          <article
            key={doc.id}
            className={`card !p-0 overflow-hidden transition ${
              isEvidence ? 'ring-2 ring-mango shadow-toy' : ''
            }`}
            aria-label={t(meta.labelKey)}
          >
            <header className={`flex items-center gap-2 bg-gradient-to-r ${meta.accent} px-4 py-2.5 text-white`}>
              <Icon name={meta.icon} className="h-4 w-4" />
              <span className="text-xs font-extrabold uppercase tracking-wide opacity-90">{t(meta.labelKey)}</span>
              <span className="ml-auto truncate font-display text-sm font-extrabold">{doc.title}</span>
            </header>
            <div className="px-4 py-3 text-sm font-semibold leading-relaxed text-ink-soft whitespace-pre-line">
              {isEvidence && highlight ? highlightPassage(doc.body, highlight.passage) : doc.body}
            </div>
          </article>
        );
      })}
    </div>
  );
}

/** Wrap the evidence passage in a highlight mark (first occurrence).
 *  When `passage` is empty (cloud reveal knows the source but not the exact text,
 *  since publicCase strips it), the source is just ring-highlighted, no <mark>. */
function highlightPassage(body: string, passage: string) {
  if (!passage) return body;
  const idx = body.indexOf(passage);
  if (idx < 0) return body;
  return (
    <>
      {body.slice(0, idx)}
      <mark className="rounded bg-sun/70 px-0.5 font-bold text-ink">{passage}</mark>
      {body.slice(idx + passage.length)}
    </>
  );
}

/** Compact helper to read the evidence highlight for a question. */
export function evidenceFor(q: CaseQuestion): { sourceId: string; passage: string } {
  return { sourceId: q.evidenceSourceId, passage: q.evidencePassage };
}
