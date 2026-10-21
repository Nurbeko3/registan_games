'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  parseSheetRows,
  TEMPLATE_HEADERS,
  TEMPLATE_EXAMPLES,
  type ImportedQuestion,
  type ParseError,
} from '@/lib/arena/questionImport';
import { GRADES } from '@/lib/arena/types';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, Notice, PageHeader, StatCard } from '@/components/ui/Primitives';
import { AdminGate, AdminShell, TableSkeleton } from '@/components/admin/AdminShell';

/** One row as returned by kcq_admin_arena_q_list (to_jsonb of the table row). */
interface QRow {
  id: string;
  type: string;
  category: string;
  difficulty: string;
  grade: number;
  emoji: string;
  prompt_uz: string; prompt_ru: string; prompt_en: string;
  options_uz: string[] | null;
  answer: number | null;
  bool_answer: boolean | null;
  active: boolean;
}

export default function AdminArenaQuestionsPage() {
  return (
    <AdminGate>
      {(admin, logout) => (
        <AdminShell admin={admin} onLogout={() => void logout()}>
          <QuestionsManager />
        </AdminShell>
      )}
    </AdminGate>
  );
}

const DIFFICULTY_BADGE: Record<string, string> = { easy: 'badge-success', medium: 'badge-warning', hard: 'badge-danger' };

function QuestionsManager() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [questions, setQuestions] = useState<QRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [gradeFilter, setGradeFilter] = useState<number | 'all'>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [query, setQuery] = useState('');
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/arena-questions');
      const d = await r.json().catch(() => ({}));
      setQuestions(d.ok ? (d.questions as QRow[]) : []);
    } catch {
      setQuestions([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const byGrade = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const q of questions) counts[q.grade] = (counts[q.grade] ?? 0) + 1;
    return counts;
  }, [questions]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return questions.filter((row) =>
      (gradeFilter === 'all' || row.grade === gradeFilter)
      && (difficultyFilter === 'all' || row.difficulty === difficultyFilter)
      && (!q || [row.prompt_uz, row.prompt_ru, row.prompt_en, row.category].some((s) => (s ?? '').toLowerCase().includes(q))),
    );
  }, [questions, gradeFilter, difficultyFilter, query]);

  // ── Excel template (3 languages per question) ──────────────────────────────
  const downloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(TEMPLATE_EXAMPLES, { header: [...TEMPLATE_HEADERS] });
    ws['!cols'] = TEMPLATE_HEADERS.map((h) => ({ wch: h.startsWith('prompt') || h.startsWith('explain') ? 34 : h.startsWith('opt') ? 16 : 10 }));

    // a short instructions sheet (Uzbek)
    const notes = XLSX.utils.aoa_to_sheet([
      ['Ustun', 'Izoh'],
      ['id', 'Bo‘sh qoldiring — avtomatik yaratiladi (yoki o‘zingiz noyob kod bering)'],
      ['grade', 'Sinf: 1 dan 11 gacha (majburiy)'],
      ['difficulty', 'Qiyinlik: easy / medium / hard'],
      ['category', 'Bo‘lim: hardware, os, ergonomics, programming, logic, math, algorithms, web, ai'],
      ['type', 'Savol turi: mcq (variantli) yoki truefalse (to‘g‘ri/noto‘g‘ri)'],
      ['emoji', 'Savol belgisi, masalan 🖥️ (ixtiyoriy)'],
      ['prompt_uz / ru / en', 'Savol matni 3 tilda. Kamida bittasini to‘ldiring — qolganlari avtomatik nusxalanadi'],
      ['opt1..4_uz / ru / en', 'Javob variantlari 3 tilda (mcq uchun). Tartibi 3 tilda bir xil bo‘lsin'],
      ['answer', 'mcq: to‘g‘ri variant raqami (1–4). truefalse: TRUE yoki FALSE'],
      ['explain_uz / ru / en', 'Noto‘g‘ri javobda ko‘rinadigan tushuntirish (3 tilda)'],
    ]);
    notes['!cols'] = [{ wch: 22 }, { wch: 70 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Savollar');
    XLSX.utils.book_append_sheet(wb, notes, 'Yo‘riqnoma');
    XLSX.writeFile(wb, 'kcq-arena-savollar-namuna.xlsx');
  };

  const onFile = async (file: File) => {
    setImporting(true); setMsg(null); setParseErrors([]);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[];
      // normalize header keys → lowercase/trim so column casing doesn't matter
      const rows = json.map((o) => {
        const low: Record<string, unknown> = {};
        for (const k of Object.keys(o)) low[k.trim().toLowerCase()] = o[k];
        return low;
      });

      const { questions: parsed, errors } = parseSheetRows(rows);
      setParseErrors(errors);
      if (parsed.length === 0) {
        setImporting(false);
        setMsg({ kind: 'err', text: 'Faylda yaroqli savol topilmadi. Namunadan foydalaning.' });
        return;
      }

      const r = await fetch('/api/admin/arena-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsed as ImportedQuestion[] }),
      });
      const d = await r.json().catch(() => ({}));
      setImporting(false);
      if (!d.ok) { setMsg({ kind: 'err', text: 'Import xatosi. Supabase ulanganini tekshiring.' }); return; }
      setMsg({ kind: 'ok', text: `${d.count} ta savol qo‘shildi${errors.length ? `, ${errors.length} qator o‘tkazib yuborildi` : ''}.` });
      void load();
    } catch {
      setImporting(false);
      setMsg({ kind: 'err', text: 'Faylni o‘qib bo‘lmadi.' });
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const remove = async (id: string) => {
    setQuestions((qs) => qs.filter((q) => q.id !== id));
    await fetch(`/api/admin/arena-questions/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
  };

  const clearAll = async () => {
    if (!confirm('Barcha import qilingan savollar o‘chirilsinmi? (Saytdagi asosiy savollar qoladi)')) return;
    setQuestions([]);
    await fetch('/api/admin/arena-questions', { method: 'DELETE' }).catch(() => {});
    void load();
  };

  const gradesCovered = Object.keys(byGrade).length;

  return (
    <>
      <PageHeader
        eyebrow="Arena"
        title="Arena savollari"
        description="Uch tilli savollar bankini Excel orqali to‘ldiring. Import qilingan savollar saytdagi asosiy savollarga qo‘shiladi."
        actions={
          <>
            <button type="button" onClick={downloadTemplate} className="btn-secondary btn-sm">
              <Icon name="download" className="h-3.5 w-3.5" />Namuna (Excel)
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={importing} className="btn-primary btn-sm">
              <Icon name="upload" className="h-3.5 w-3.5" />{importing ? 'Yuklanmoqda…' : 'Excel import'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
            />
          </>
        }
      />

      <div className="mt-6 space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Import qilingan savollar" value={loading ? '—' : questions.length} icon="help" tone="brand" />
          <StatCard label="Qamrab olingan sinflar" value={loading ? '—' : `${gradesCovered}/${GRADES.length}`} icon="graduation" tone="success" />
          <StatCard label="Variantli (mcq)" value={loading ? '—' : questions.filter((q) => q.type !== 'truefalse').length} icon="layers" />
          <StatCard label="To‘g‘ri / noto‘g‘ri" value={loading ? '—' : questions.filter((q) => q.type === 'truefalse').length} icon="checkCircle" />
        </div>

        <AnimatePresence>
          {msg && (
            <motion.div key="msg" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Notice tone={msg.kind === 'ok' ? 'success' : 'danger'} action={<button type="button" onClick={() => setMsg(null)} className="btn-subtle btn-sm">Yopish</button>}>
                {msg.text}
              </Notice>
            </motion.div>
          )}
          {parseErrors.length > 0 && (
            <motion.div key="errs" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Notice tone="warning" action={<button type="button" onClick={() => setParseErrors([])} className="btn-subtle btn-sm">Yopish</button>}>
                <p className="font-bold">O‘tkazib yuborilgan qatorlar</p>
                <ul className="mt-1 space-y-0.5 text-xs">
                  {parseErrors.slice(0, 10).map((e) => (
                    <li key={e.row}>{e.row}-qator: {e.message}</li>
                  ))}
                  {parseErrors.length > 10 && <li>… va yana {parseErrors.length - 10} ta</li>}
                </ul>
              </Notice>
            </motion.div>
          )}
        </AnimatePresence>

        <Notice tone="brand" icon="info">
          Namunani yuklab oling, savollarni 3 tilda (o‘zbek, rus, ingliz) to‘ldiring, so‘ng faylni yuklang. Bironta til bo‘sh qolsa, u to‘ldirilgan tildan nusxalanadi.
        </Notice>

        {/* table */}
        <section className="panel">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3.5 lg:flex-row lg:items-center lg:px-5">
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-base font-extrabold text-fg">Savollar <span className="font-semibold text-fg-faint">({questions.length})</span></h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Qidirish…" aria-label="Savolni qidirish" className="input h-9 min-h-0 w-44 py-0 pl-9 sm:w-56" />
              </div>
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                aria-label="Sinf"
                className="input h-9 min-h-0 w-auto py-0"
              >
                <option value="all">Barcha sinflar</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>{g}-sinf{byGrade[g] ? ` (${byGrade[g]})` : ''}</option>
                ))}
              </select>
              <select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value as typeof difficultyFilter)}
                aria-label="Qiyinlik"
                className="input h-9 min-h-0 w-auto py-0"
              >
                <option value="all">Barcha qiyinliklar</option>
                <option value="easy">Oson</option>
                <option value="medium">O‘rta</option>
                <option value="hard">Qiyin</option>
              </select>
              {questions.length > 0 && (
                <button type="button" onClick={clearAll} className="btn-danger-soft btn-sm">
                  <Icon name="trash" className="h-3.5 w-3.5" />Hammasini o‘chirish
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : questions.length === 0 ? (
            <EmptyState
              icon="upload"
              tone="brand"
              title="Hali import qilingan savol yo‘q"
              description="Namunani yuklab oling va to‘ldirilgan faylni import qiling."
              action={
                <>
                  <button type="button" onClick={downloadTemplate} className="btn-secondary btn-sm"><Icon name="download" className="h-3.5 w-3.5" />Namuna (Excel)</button>
                  <button type="button" onClick={() => fileRef.current?.click()} className="btn-primary btn-sm"><Icon name="upload" className="h-3.5 w-3.5" />Excel import</button>
                </>
              }
              className="!rounded-none !border-0 !shadow-none"
            />
          ) : shown.length === 0 ? (
            <EmptyState icon="search" title="Mos savol topilmadi" description="Filtrlarni o‘zgartirib ko‘ring." className="!rounded-none !border-0 !shadow-none" />
          ) : (
            <div className="overflow-x-auto">
              <table className="table min-w-[760px]">
                <thead>
                  <tr>
                    <th className="w-[46%]">Savol</th>
                    <th>Sinf</th>
                    <th>Qiyinlik</th>
                    <th>Bo‘lim</th>
                    <th>Javob</th>
                    <th className="text-right">Amal</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((q) => <QuestionRow key={q.id} q={q} onDelete={() => remove(q.id)} />)}
                </tbody>
              </table>
            </div>
          )}
          {!loading && questions.length > 0 && (
            <div className="border-t border-border px-4 py-2.5 text-xs text-fg-faint sm:px-5">{shown.length} / {questions.length} ta savol</div>
          )}
        </section>
      </div>
    </>
  );
}

function QuestionRow({ q, onDelete }: { q: QRow; onDelete: () => void }) {
  const correct = q.type === 'truefalse'
    ? (q.bool_answer ? 'TRUE' : 'FALSE')
    : (q.options_uz && q.answer != null ? q.options_uz[q.answer] : '—');
  const langs: [string, string][] = [['uz', q.prompt_uz], ['ru', q.prompt_ru], ['en', q.prompt_en]];
  return (
    <tr>
      <td>
        <div className="grid gap-1">
          {langs.map(([code, text]) => (
            <p key={code} className={`flex min-w-0 items-start gap-2 ${code === 'uz' ? 'text-sm font-bold text-fg' : 'text-xs text-fg-soft'}`}>
              <span className="mt-0.5 w-5 shrink-0 text-2xs font-bold uppercase tracking-wide text-fg-faint">{code}</span>
              <span className="line-clamp-2">{text || '—'}</span>
            </p>
          ))}
        </div>
      </td>
      <td className="whitespace-nowrap"><span className="badge-brand">{q.grade}-sinf</span></td>
      <td className="whitespace-nowrap"><span className={DIFFICULTY_BADGE[q.difficulty] ?? 'badge-neutral'}>{q.difficulty}</span></td>
      <td className="whitespace-nowrap text-xs font-semibold text-fg-soft">{q.category}</td>
      <td className="max-w-[12rem]">
        <span className="line-clamp-2 text-xs font-semibold text-fg">{q.type === 'truefalse' ? <span className="badge-neutral">{correct}</span> : correct}</span>
      </td>
      <td className="text-right">
        <button type="button" onClick={onDelete} aria-label="O‘chirish" className="btn-subtle btn-sm text-danger hover:bg-danger-50 hover:text-danger-700">
          <Icon name="trash" className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}
