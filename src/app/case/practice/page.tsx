import { Suspense } from 'react';
import { BotPracticeWrapper } from '@/components/case/BotPracticeWrapper';

/** Offline Bot Practice — pick a case and play solo against detective bots.
 *  Accepts an optional `?case=<id>` query param to deep-link into a specific
 *  case (used by the Daily Case card on /case). `useSearchParams` requires a
 *  Suspense boundary for the static-export/CSR-bailout (Next.js build gate). */
export default function CasePracticePage() {
  return (
    <Suspense fallback={null}>
      <BotPracticeWrapper />
    </Suspense>
  );
}
