'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useCaseRoom } from '@/lib/caseFiles/useCaseRoom';
import { Scoreboard, type Standing } from './Scoreboard';
import { SourcesPane } from './SourcesPane';
import { Icon } from '@/components/ui/Icon';
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

  // ── offline / error ──────────────────────────────────────────────────
  if (!isCloudEnabled() || phase === 'error') {
    return (
      <div className="min-h-screen bg-cloud">
        <AdminHeader code={code} />
        <div className="mx-auto max-w-2xl px-4 py-10">
          <div className="card text-center">
            <div className="text-5xl">📡</div>
            <p className="mt-3 font-display text-xl font-extrabold">
              Supabase ulanmagan
            </p>
            <p className="mt-2 text-ink-soft">
              Classroom mode faqat cloud bilan ishlaydi. <code>.env.local</code> faylida
              Supabase kalitlarini tekshiring.
            </p>
            <Link href="/admin/cases" className="btn-primary mt-5">
              ← Orqaga
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── connecting ───────────────────────────────────────────────────────
  if (phase === 'connecting') {
    return (
      <div className="min-h-screen bg-cloud">
        <AdminHeader code={code} />
        <div className="grid min-h-[60vh] place-items-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-grape-100 border-t-grape" />
        </div>
      </div>
    );
  }

  // ── lobby ────────────────────────────────────────────────────────────
  if (phase === 'lobby') {
    return (
      <div className="min-h-screen bg-cloud">
        <AdminHeader code={code} />
        <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">
          {/* Room code — large, clearly visible */}
          <div className="card text-center">
            <p className="text-sm font-bold text-ink-soft">O'quvchilar uchun xona kodi</p>
            <p className="my-3 font-display text-7xl font-extrabold tracking-widest text-grape">
              {code}
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={copyCode}
                className="inline-flex items-center gap-2 rounded-xl bg-grape-50 px-4 py-2 text-sm font-extrabold text-grape hover:bg-grape-100 transition"
              >
                <Icon name={copied ? 'check' : 'gift'} className="h-4 w-4" />
                {copied ? 'Nusxalandi!' : 'Kodni nusxalash'}
              </button>
              <button
                type="button"
                onClick={openProjector}
                className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-extrabold text-white hover:bg-ink/80 transition"
              >
                <Icon name="eye" className="h-4 w-4" />
                Proyektorda ko'rsatish
              </button>
            </div>
          </div>

          {/* Case info */}
          {caseDef && (
            <div className="flex items-center gap-3 rounded-2xl bg-grape-50 px-4 py-3">
              <Icon name="search" className="h-5 w-5 shrink-0 text-grape" />
              <div>
                <p className="font-display font-extrabold text-ink">{caseDef.title}</p>
                <p className="text-xs font-bold text-ink-faint">
                  {caseDef.gradeBand} sinf · {caseDef.questions.length} ta savol
                </p>
              </div>
            </div>
          )}

          {/* Roster */}
          <div className="card">
            <p className="font-display font-extrabold">
              O'quvchilar ({players.length})
            </p>
            <ol className="mt-3 max-h-72 space-y-1.5 overflow-y-auto">
              {players.length === 0 ? (
                <li className="py-4 text-center text-sm font-bold text-ink-faint">
                  Hali hech kim qo'shilmagan — o'quvchilar xona kodini kiriting.
                </li>
              ) : (
                players.map((p, i) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl bg-cloud px-3 py-2"
                  >
                    <span className="w-6 text-center text-sm font-extrabold text-ink-faint">{i + 1}</span>
                    <span className="flex-1 font-bold truncate">{p.name}</span>
                  </li>
                ))
              )}
            </ol>
          </div>

          <button
            type="button"
            onClick={startInvestigation}
            disabled={players.length < 1}
            className="btn-primary w-full py-4 text-xl disabled:opacity-40"
          >
            Tekshirishni boshlash →
          </button>
        </main>
      </div>
    );
  }

  // ── investigation ────────────────────────────────────────────────────
  if (phase === 'investigation' && caseDef) {
    return (
      <div className="min-h-screen bg-cloud">
        <AdminHeader code={code} />
        <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
          <div className="rounded-3xl bg-gradient-to-br from-sky to-grape p-6 text-white shadow-toy">
            <p className="font-display text-xs font-extrabold uppercase tracking-widest opacity-80">
              Tekshirish bosqichi
            </p>
            <h1 className="mt-1 font-display text-3xl font-extrabold">{caseDef.title}</h1>
            <p className="mt-2 text-white/90 font-semibold leading-relaxed">{caseDef.briefing}</p>
          </div>

          <p className="rounded-2xl bg-sun/15 px-4 py-3 text-sm font-bold text-mango-600">
            O'quvchilar hozir manbalarni o'qimoqda. Tayyor bo'lganda savollarni boshlang.
          </p>

          <SourcesPane sources={caseDef.sources} />

          <button
            type="button"
            onClick={advanceQuestion}
            className="btn-primary w-full py-4 text-xl"
          >
            Savollarni boshlash →
          </button>
        </main>
      </div>
    );
  }

  // ── question ─────────────────────────────────────────────────────────
  if (phase === 'question' && caseDef && currentQ) {
    return (
      <div className="min-h-screen bg-cloud">
        <AdminHeader code={code} />
        <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
          {/* Progress */}
          <div className="flex items-center justify-between text-sm font-bold text-ink-soft">
            <span>Savol {qIndex + 1} / {total}</span>
            <span>{players.length} ta o'quvchi</span>
          </div>

          {/* Question card */}
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-grape to-bubble text-white shrink-0">
                <Icon name="search" className="h-5 w-5" />
              </span>
              <p className="font-display text-xs font-extrabold uppercase tracking-wide text-ink-faint">
                {qIndex + 1}-savol
              </p>
            </div>
            <p className="font-display text-2xl font-extrabold leading-snug text-ink">
              {currentQ.prompt}
            </p>
            {/* Choices shown greyed-out — teacher can see them; correct answer hidden */}
            <ul className="mt-4 space-y-2">
              {currentQ.choices.map((choice, i) => (
                <li
                  key={i}
                  className="rounded-2xl border-2 border-grape-100 bg-white px-4 py-3 font-semibold text-ink-soft"
                >
                  <span className="mr-2 font-extrabold text-ink-faint">
                    {String.fromCharCode(65 + i)}.
                  </span>
                  {choice}
                </li>
              ))}
            </ul>
          </div>

          <Scoreboard standings={standings} title="Joriy holat" />

          <button
            type="button"
            onClick={advanceReveal}
            className="btn-primary w-full py-4 text-xl"
          >
            Javobni ochish →
          </button>
        </main>
      </div>
    );
  }

  // ── reveal ────────────────────────────────────────────────────────────
  if (phase === 'reveal' && caseDef && currentQ) {
    return (
      <div className="min-h-screen bg-cloud">
        <AdminHeader code={code} />
        <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
          {/* Progress */}
          <div className="flex items-center justify-between text-sm font-bold text-ink-soft">
            <span>Savol {qIndex + 1} / {total}</span>
            <span>{players.length} ta o'quvchi</span>
          </div>

          {/* Question + revealed answer */}
          <div className="card">
            <p className="font-display text-2xl font-extrabold leading-snug text-ink">
              {currentQ.prompt}
            </p>
            <ul className="mt-4 space-y-2">
              {currentQ.choices.map((choice, i) => {
                const isCorrect = revealCorrect === i;
                return (
                  <li
                    key={i}
                    className={`rounded-2xl border-2 px-4 py-3 font-semibold transition
                      ${isCorrect
                        ? 'border-mint bg-mint/15 font-extrabold text-mint-600'
                        : 'border-grape-100 bg-white text-ink-soft'
                      }`}
                  >
                    <span className="mr-2 font-extrabold">
                      {isCorrect ? '✓' : `${String.fromCharCode(65 + i)}.`}
                    </span>
                    {choice}
                  </li>
                );
              })}
            </ul>
          </div>

          <Scoreboard standings={standings} title="Joriy holat" />

          <button
            type="button"
            onClick={isLastQuestion ? endMatch : advanceQuestion}
            className="btn-primary w-full py-4 text-xl"
          >
            {isLastQuestion ? 'Natijalarni ko\'rsatish' : 'Keyingi savol →'}
          </button>
        </main>
      </div>
    );
  }

  // ── ended ─────────────────────────────────────────────────────────────
  if (phase === 'ended') {
    const winner = standings[0];
    return (
      <div className="min-h-screen bg-cloud">
        <AdminHeader code={code} />
        <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">
          {/* Winner banner */}
          <AnimatePresence>
            {winner && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25 }}
                className="rounded-3xl bg-gradient-to-br from-sun to-mango p-6 text-center shadow-toy motion-reduce:transition-none motion-reduce:animate-none"
              >
                <p className="text-4xl">🏆</p>
                <p className="mt-2 font-display text-xs font-extrabold uppercase tracking-widest text-mango-700">
                  Chempion
                </p>
                <p className="mt-1 font-display text-3xl font-extrabold text-ink">
                  {winner.name}
                </p>
                <p className="font-display text-xl font-extrabold text-mango-700">
                  {winner.score} ball
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <Scoreboard standings={standings} title="Yakuniy natijalar" />

          {/* Actions */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={downloadXlsx}
              disabled={downloading}
              className="btn-sun flex-1 py-3 text-base disabled:opacity-60"
            >
              {downloading ? 'Yuklanmoqda…' : '⬇️ Excel natijalar'}
            </button>
            <Link
              href="/admin/cases"
              className="btn-ghost flex-1 py-3 text-center text-base font-extrabold"
            >
              Yangi turnir
            </Link>
          </div>

          <p className="text-xs text-ink-faint text-center">
            Excel faylda har bir o'quvchining to'liq natijalari bo'ladi.
          </p>
        </main>
      </div>
    );
  }

  return null;
}

// ── shared header ─────────────────────────────────────────────────────────────
function AdminHeader({ code }: { code: string }) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-grape-100 bg-white px-4 py-3">
      <div className="flex items-center gap-2 font-display font-extrabold">
        🕵️ Sinf boshqaruvi
        <span className="chip bg-grape-50 text-grape font-mono text-xs tracking-widest">
          {code}
        </span>
      </div>
      <Link href="/admin/cases" className="btn-ghost px-3 py-1.5 text-sm">
        ← Orqaga
      </Link>
    </header>
  );
}
