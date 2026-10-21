'use client';

import { use } from 'react';
import { ClassroomHostScreen } from '@/components/case/ClassroomHostScreen';
import { AdminGate } from '@/components/admin/AdminShell';

interface Props {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ case?: string }>;
}

/** Teacher's live console for one classroom room. The host screen is a
 *  full-bleed projector-friendly view, so it renders without the admin
 *  sidebar; the auth gate is the same as every other admin page. */
export default function AdminCasesCodePage({ params, searchParams }: Props) {
  const { code } = use(params);
  const { case: caseId } = use(searchParams);

  return (
    <AdminGate>
      {() => (
        // No caseId → rejoining an existing room; the hook resumes from Postgres.
        <ClassroomHostScreen code={code.toUpperCase()} caseId={caseId ?? ''} />
      )}
    </AdminGate>
  );
}
