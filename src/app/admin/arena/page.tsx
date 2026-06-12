'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  parseSheetRows,
  TEMPLATE_HEADERS,
  TEMPLATE_EXAMPLES,
  type ImportedQuestion,
  type ParseError,
} from '@/lib/arena/questionImport';
import { GRADES } from '@/lib/arena/types';

interface AdminInfo { id: string; email: string; name: string; role: 'super' | 'admin' }

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
  const [admin, setAdmin] = useState<AdminInfo | null | undefined>(undefined);

  useEffect(() => {
    fetch('/api/admin/me')
      .then((r) => r.json())
      .then((d) => setAdmin(d.ok ? d.admin : null))
      .catch(() => setAdmin(null));
  }, []);

  if (admin === undefined) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white" />
      </div>
    );
  }

  if (admin === null) {
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-to-br from-ink to-grape-600 p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-toy text-center"
        >
          <div className="text-4xl">🔒</div>
          <h1 className="mt-2 font-display text-xl font-extrabold">Kirish kerak</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Bu sahifadan foydalanish uchun admin sifatida tizimga kiring.
          </p>
          <Link href="/admin" className="btn-primary mt-5 block">Admin panelga kirish</Link>
        </motion.div>
      </div>
    );
  }

  return <QuestionsManager admin={admin} />;
}

function QuestionsManager({ admin }: { admin: AdminInfo }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [questions, setQuestions] = useState<QRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [gradeFilter, setGradeFilter] = useState<number | 'all'>('all');
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

  const shown = useMemo(
    () => (gradeFilter === 'all' ? questions : questions.filter((q) => q.grade === gradeFilter)),
    [questions, gradeFilter],
  );

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
      ['category', 'Bo‘lim: hardware, programming, logic, math, algorithms, web, ai'],
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

  return (
    <div className="min-h-screen bg-cloud">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-grape-100 bg-white px-4 py-3">
        <div className="flex items-center gap-2 font-display font-extrabold">
          ⚔️ Arena savollari
          <span className="hidden text-sm font-bold text-ink-faint sm:inline">{admin.email}</span>
        </div>
        <Link href="/admin" className="btn-ghost px-3 py-1.5 text-sm">← Admin panel</Link>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 space-y-5">
        {/* Import */}
        <section className="card">
          <h2 className="font-display text-xl font-extrabold">Excel orqali savol qo‘shish</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Avval namunani yuklab oling, savollarni 3 tilda (o‘zbek, rus, ingliz) to‘ldiring, so‘ng faylni yuklang.
            Bironta til bo‘sh qolsa, u avtomatik to‘ldirilgan tildan nusxalanadi.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={downloadTemplate} className="btn-ghost">📄 Namuna Excelni yuklab olish</button>
            <button onClick={() => fileRef.current?.click()} disabled={importing} className="btn-primary disabled:opacity-50">
              {importing ? 'Yuklanmoqda…' : '⬆️ Excel faylni import qilish'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
            />
          </div>

          {msg && (
            <p className={`mt-3 rounded-xl px-3 py-2 text-sm font-bold ${msg.kind === 'ok' ? 'bg-mint/15 text-mint-700' : 'bg-bubble/15 text-bubble-600'}`}>
              {msg.text}
            </p>
          )}
          {parseErrors.length > 0 && (
            <div className="mt-3 rounded-xl bg-mango/10 p-3 text-sm">
              <p className="font-extrabold text-mango-700">O‘tkazib yuborilgan qatorlar:</p>
              <ul className="mt-1 space-y-0.5 text-ink-soft">
                {parseErrors.slice(0, 10).map((e) => (
                  <li key={e.row}>{e.row}-qator: {e.message}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Grade filter + list */}
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-extrabold">
              Import qilingan savollar <span className="text-ink-faint">({questions.length})</span>
            </h2>
            {questions.length > 0 && (
              <button onClick={clearAll} className="text-sm font-bold text-bubble-600 hover:underline">Hammasini o‘chirish</button>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <GradePill active={gradeFilter === 'all'} onClick={() => setGradeFilter('all')} label="Hammasi" count={questions.length} />
            {GRADES.map((g) => (
              <GradePill key={g} active={gradeFilter === g} onClick={() => setGradeFilter(g)} label={`${g}-sinf`} count={byGrade[g] ?? 0} />
            ))}
          </div>

          <div className="mt-4 space-y-2">
            {loading ? (
              <p className="text-sm text-ink-faint">Yuklanmoqda…</p>
            ) : shown.length === 0 ? (
              <p className="rounded-xl bg-cloud px-3 py-6 text-center text-sm font-bold text-ink-faint">
                {questions.length === 0
                  ? 'Hali import qilingan savol yo‘q. Yuqoridagi namunadan boshlang.'
                  : 'Bu sinf uchun savol yo‘q.'}
              </p>
            ) : (
              shown.map((q) => <QuestionItem key={q.id} q={q} onDelete={() => remove(q.id)} />)
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function GradePill({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-extrabold shadow-card transition ${active ? 'bg-grape text-white' : 'bg-white hover:bg-grape-50'}`}
    >
      {label}{count > 0 && <span className={`ml-1 ${active ? 'text-white/70' : 'text-ink-faint'}`}>{count}</span>}
    </button>
  );
}

function QuestionItem({ q, onDelete }: { q: QRow; onDelete: () => void }) {
  const correct = q.type === 'truefalse'
    ? (q.bool_answer ? 'TRUE' : 'FALSE')
    : (q.options_uz && q.answer != null ? q.options_uz[q.answer] : '—');
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-grape-100 bg-white p-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-grape-50 text-lg">{q.emoji || '❓'}</span>
      <div className="min-w-0 flex-1">
        <p className="font-display font-extrabold text-ink">{q.prompt_uz || q.prompt_ru || q.prompt_en}</p>
        <p className="mt-0.5 text-xs font-bold text-ink-faint">
          {q.grade}-sinf · {q.difficulty} · {q.category} · ✅ {correct}
        </p>
      </div>
      <button onClick={onDelete} aria-label="O‘chirish" className="shrink-0 rounded-lg px-2 py-1 text-sm font-bold text-bubble-600 hover:bg-bubble/10">
        🗑️
      </button>
    </div>
  );
}
