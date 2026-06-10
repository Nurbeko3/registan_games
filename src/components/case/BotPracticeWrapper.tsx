'use client';

import { useSearchParams } from 'next/navigation';
import { BotPracticeScreen } from './BotPracticeScreen';

/**
 * Thin client wrapper that reads the `?case=<id>` query param and passes it
 * as `initialCaseId` to BotPracticeScreen.
 *
 * This is extracted into a separate `'use client'` component so the parent
 * page.tsx remains a Server Component (no `useSearchParams` there).
 */
export function BotPracticeWrapper() {
  const searchParams = useSearchParams();
  const initialCaseId = searchParams.get('case') ?? undefined;
  return <BotPracticeScreen initialCaseId={initialCaseId} />;
}
