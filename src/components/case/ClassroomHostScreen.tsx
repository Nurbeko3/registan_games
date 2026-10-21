'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useCaseRoom } from '@/lib/caseFiles/useCaseRoom';
import { Scoreboard, type Standing } from './Scoreboard';
import { SourcesPane } from './SourcesPane';
import { CaseBriefing } from './CaseBriefing';
import { CaseMetaBadges } from './CaseMeta';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, Notice, PageLoading } from '@/components/ui/Primitives';
import { isCloudEnabled } from '@/lib/supabase/client';

interface Props {
  code: string;
  caseId: string;
}

/**
 * Teacher's pacing console for a classroom tournament.
 * - No auto-advance: teacher drives every phase transition.
 * - Teacher does NOT answer questions (isClassroom:true → hostPlays=false).
 * - Designed to be readable on a laptop projected to a wall:
 *   large text, high contrast, generous spacing.
 */
export function ClassroomHostScreen({ code, caseId }: Props) {
  const room = useCaseRoom(code, {
    caseId,
    isHost: true,
    isClassroom: true,
    name: 'Teacher',
  });

  const {
    phase,
    players,
    caseDef,
    qIndex,
    total,
    revealCorrect,
    startInvestigation,
    advanceQuestion,
    advanceReveal,
    endMatch,
    teacherResults,
  } = room;

  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const copyCode = useCallback(() => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const openProjector = useCallback(() => {
    window.open(`/case/${code}/display`, '_blank', 'noopener,noreferrer');
  }, [code]);

  const downloadXlsx = useCallback(async () => {
    setDownloading(true);
    try {
      const rows = await teacherResults();
      if (!rows || rows.length === 0) {
        alert("Ma'lumotlar topilmadi yoki server bilan aloqa yo'q.");
        return;
      }
      const XLSX = await import('xlsx');
      const totalQ = rows[0]?.q_results?.length ?? total;
      const headers = [
        'Ism',
        'Jami ball',
        'To\'g\'ri',
        ...Array.from({ length: totalQ }, (_, i) => `S${i + 1}`),
        'Maslahat',
      ];
      const data = rows.map((r) => {
        const correctCount = r.q_results.filter((q) => q.correct).length;
        const hintCount = r.q_results.filter((q) => q.hint_used).length;
        const perQ = r.q_results.map((q) => (q.answered ? (q.correct ? '+' : '-') : '?'));
        return [r.display_name, r.total_score, correctCount, ...perQ, hintCount];
      });
      const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Natijalar');
      XLSX.writeFile(wb, `kcq-classroom-${code}.xlsx`);
    } finally {
      setDownloading(false);
    }
  }, [code, teacherResults, total]);

  const standings: Standing[] = players.map((p) => ({
    id: p.id,
    name: p.name,
    emoji: '🧑',
    score: p.score,
  }));

  const currentQ = caseDef?.questions[qIndex] ?? null;
  const isLastQuestion = qIndex + 1 >= total;

  const phaseLabel: Record<string, string> = {
    lobby: 'Kutish',
    investigation: 'Tekshirish',
    question: `Savol ${qIndex + 1}/${total}`,
    reveal: `Javob ${qIndex + 1}/${total}`,
    ended: 'Yakun',
  };

  // ── offline / error ──────────────────────────────────────────────────
  if (!isCloudEnabled() || phase === 'error') {
    return (
      <div className="min-h-screen bg-bg">
        <AdminHeader code={code} />
        <div className="mx-auto max-w-2xl px-4 py-10">
          <EmptyState
            icon="signal"
            tone="danger"
            title="Backend ulanmagan"
            description={
              <>
                Classroom rejimi faqat cloud bilan ishlaydi. <code className="rounded bg-surface-3 px-1 font-mono text-xs">NEXT_PUBLIC_API_URL</code> sozlanganini tekshiring.
              </>
            }
            action={
              <Link href="/admin/cases" className="btn-primary">
                <Icon name="arrowLeft" className="h-4 w-4" />
                Orqaga
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  // ── connecting ───────────────────────────────────────────────────────
  if (phase === 'connecting') {
    return (
      <div className="min-h-screen bg-bg">
        <AdminHeader code={code} />
        <PageLoading />
      </div>
    );
  }

  // ── lobby ────────────────────────────────────────────────────────────
  if (phase === 'lobby') {
    return (
      <div className="min-h-screen bg-bg">
        <AdminHeader code={code} phase={phaseLabel.lobby} />
        <main className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6">
          {/* Room code — large, clearly visible */}
          <section className="card text-center">
            <p className="eyebrow">O'quvchilar uchun xona kodi</p>
            <p className="my-4 font-mono text-6xl font-bold tracking-[0.3em] text-fg sm:text-7xl" aria-label={code}>
              {code}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={copyCode} className="btn-secondary">
                <Icon name={copied ? 'check' : 'copy'} className="h-4 w-4" />
                {copied ? 'Nusxalandi' : 'Kodni nusxalash'}
              </button>
              <button type="button" onClick={openProjector} className="btn-primary">
                <Icon name="monitor" className="h-4 w-4" />
                Proyektorda ko'rsatish
              </button>
            </div>
          </section>

          {/* Case info */}
          {caseDef && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-xs">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand ring-1 ring-inset ring-brand-100">
                <Icon name="search" className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-bold text-fg">{caseDef.title}</p>
                <CaseMetaBadges caseDef={caseDef} className="mt-1" />
              </div>
            </div>
          )}

          {/* Roster */}
          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="font-display text-sm font-bold text-fg">O'quvchilar</p>
              <span className="badge-neutral">{players.length}</span>
            </div>
            <ol className="max-h-72 divide-y divide-border overflow-y-auto">
              {players.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-fg-faint">
                  Hali hech kim qo'shilmagan — o'quvchilar xona kodini kiritsin.
                </li>
              ) : (
                players.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-6 text-center text-xs font-bold tabular-nums text-fg-faint">{i + 1}</span>
                    <span className="flex-1 truncate text-sm font-bold text-fg">{p.name}</span>
                    <span className="h-2 w-2 rounded-full bg-success-500" aria-label="online" />
                  </li>
                ))
              )}
            </ol>
          </section>

          <button
            type="button"
            onClick={startInvestigation}
            disabled={players.length < 1}
            className="btn-primary btn-lg w-full"
          >
            <Icon name="play" className="h-4 w-4" />
            Tekshirishni boshlash
          </button>
        </main>
      </div>
    );
  }

  // ── investigation ────────────────────────────────────────────────────
  if (phase === 'investigation' && caseDef) {
    return (
      <div className="min-h-screen bg-bg">
        <AdminHeader code={code} phase={phaseLabel.investigation} />
        <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
          <CaseBriefing
            title={caseDef.title}
            briefing={caseDef.briefing}
            caseDef={caseDef}
            aside={
              <span className="inline-flex items-center gap-1.5">
                <Icon name="users" className="h-3.5 w-3.5" />
                {players.length} ta o'quvchi
              </span>
            }
          />

          <Notice tone="warning" icon="timer">
            O'quvchilar hozir manbalarni o'qimoqda. Tayyor bo'lganda savollarni boshlang.
          </Notice>

          <SourcesPane sources={caseDef.sources} />

          <button type="button" onClick={advanceQuestion} className="btn-primary btn-lg w-full">
            Savollarni boshlash
            <Icon name="arrowRight" className="h-4 w-4" />
          </button>
        </main>
      </div>
    );
  }

  // ── question / reveal ────────────────────────────────────────────────
  if ((phase === 'question' || phase === 'reveal') && caseDef && currentQ) {
    const isReveal = phase === 'reveal';
    return (
      <div className="min-h-screen bg-bg">
        <AdminHeader code={code} phase={isReveal ? phaseLabel.reveal : phaseLabel.question} />
        <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
          {/* Progress */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="badge-neutral">Savol {qIndex + 1} / {total}</span>
              {isReveal && <span className="badge-success">Javob ochildi</span>}
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-fg-faint">
              <Icon name="users" className="h-3.5 w-3.5" />
              {players.length} ta o'quvchi
            </span>
          </div>

          {/* Question card */}
          <section className="card">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand ring-1 ring-inset ring-brand-100">
                  <Icon name="help" className="h-4 w-4" />
                </span>
                <p className="eyebrow">{qIndex + 1}-savol</p>
              </div>
              <div className="flex items-center gap-1" aria-hidden>
                {Array.from({ length: total }).map((_, i) => (
                  <span key={i} className={`h-1.5 w-4 rounded-full ${i < qIndex ? 'bg-brand' : i === qIndex ? 'bg-brand-300' : 'bg-border'}`} />
                ))}
              </div>
            </div>
            <p className="mt-4 font-display text-2xl font-extrabold leading-snug tracking-tight text-fg">
              {currentQ.prompt}
            </p>
            {/* Choices — teacher sees them; the correct one is highlighted only on reveal */}
            <ul className="mt-5 space-y-2">
              {currentQ.choices.map((choice, i) => {
                const isCorrect = isReveal && revealCorrect === i;
                return (
                  <li
                    key={i}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-base font-semibold ${
                      isCorrect
                        ? 'border-success-300 bg-success-50 text-success-700 ring-2 ring-success-200'
                        : isReveal
                          ? 'border-border bg-surface text-fg-faint opacity-60'
                          : 'border-border bg-surface text-fg'
                    }`}
                  >
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md font-display text-xs font-bold ${isCorrect ? 'bg-success-600 text-white' : 'bg-surface-2 text-fg-soft'}`}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="flex-1">{choice}</span>
                    {isCorrect && <Icon name="checkCircle" className="h-5 w-5 shrink-0" />}
                  </li>
                );
              })}
            </ul>
          </section>

          <Scoreboard standings={standings} title="Joriy holat" />

          {isReveal ? (
            <button
              type="button"
              onClick={isLastQuestion ? endMatch : advanceQuestion}
              className="btn-primary btn-lg w-full"
            >
              {isLastQuestion ? 'Natijalarni ko\'rsatish' : 'Keyingi savol'}
              <Icon name="arrowRight" className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" onClick={advanceReveal} className="btn-primary btn-lg w-full">
              <Icon name="eye" className="h-4 w-4" />
              Javobni ochish
            </button>
          )}
        </main>
      </div>
    );
  }

  // ── ended ─────────────────────────────────────────────────────────────
  if (phase === 'ended') {
    const winner = [...standings].sort((a, b) => b.score - a.score)[0];
    return (
      <div className="min-h-screen bg-bg">
        <AdminHeader code={code} phase={phaseLabel.ended} />
        <main className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6">
          {/* Winner banner */}
          <AnimatePresence>
            {winner && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="card text-center motion-reduce:animate-none motion-reduce:transition-none"
              >
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-600">
                  <Icon name="trophy" className="h-7 w-7" />
                </span>
                <p className="eyebrow mt-4">Chempion</p>
                <p className="mt-1 font-display text-3xl font-extrabold tracking-tight text-fg">{winner.name}</p>
                <p className="mt-1 font-display text-lg font-bold text-amber-600">{winner.score} ball</p>
              </motion.section>
            )}
          </AnimatePresence>

          <Scoreboard standings={standings} title="Yakuniy natijalar" />

          {/* Actions */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={downloadXlsx}
              disabled={downloading}
              className="btn-primary flex-1"
            >
              <Icon name="download" className="h-4 w-4" />
              {downloading ? 'Yuklanmoqda…' : 'Excel natijalar'}
            </button>
            <Link href="/admin/cases" className="btn-secondary flex-1">
              Yangi turnir
            </Link>
          </div>

          <p className="text-center text-xs text-fg-faint">
            Excel faylda har bir o'quvchining to'liq natijalari bo'ladi.
          </p>
        </main>
      </div>
    );
  }

  return null;
}

// ── shared header ─────────────────────────────────────────────────────────────
function AdminHeader({ code, phase }: { code: string; phase?: string }) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4 sm:px-6">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">
          <Icon name="graduation" className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold text-fg">Sinf boshqaruvi</p>
          {phase && <p className="text-2xs font-semibold uppercase tracking-wide text-fg-faint">{phase}</p>}
        </div>
        <span className="chip ml-1 bg-surface-2 font-mono text-xs tracking-[0.2em] text-fg">{code}</span>
        <div className="flex-1" />
        <Link href="/admin/cases" className="btn-secondary btn-sm">
          <Icon name="arrowLeft" className="h-4 w-4" />
          Orqaga
        </Link>
      </div>
    </header>
  );
}
