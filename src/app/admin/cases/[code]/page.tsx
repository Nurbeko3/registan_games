'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ClassroomHostScreen } from '@/components/case/ClassroomHostScreen';

interface AdminInfo { id: string; email: string; name: string; role: 'super' | 'admin' }

interface Props {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ case?: string }>;
}

export default function AdminCasesCodePage({ params, searchParams }: Props) {
  const { code } = use(params);
  const { case: caseId } = use(searchParams);

  const [admin, setAdmin] = useState<AdminInfo | null | undefined>(undefined);

  const refresh = useCallback(() => {
    fetch('/api/admin/me')
      .then((r) => r.json())
      .then((d) => setAdmin(d.ok ? d.admin : null))
      .catch(() => setAdmin(null));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

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
          <Link href="/admin" className="btn-primary mt-5 block">
            Admin panelga kirish
          </Link>
        </motion.div>
      </div>
    );
  }

  if (!caseId) {
    // Rejoining an existing room — the hook will resume from Postgres
    return (
      <ClassroomHostScreen
        code={code.toUpperCase()}
        caseId=""
      />
    );
  }

  return (
    <ClassroomHostScreen
      code={code.toUpperCase()}
      caseId={caseId}
    />
  );
}
