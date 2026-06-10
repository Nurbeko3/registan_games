'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useGame } from '@/store/useGame';
import { CaseRoomScreen } from '@/components/case/CaseRoomScreen';

export default function CaseRoomPage() {
  return (
    <Suspense fallback={null}>
      <Room />
    </Suspense>
  );
}

function Room() {
  const params = useParams();
  const search = useSearchParams();

  const code = String(params.code ?? '').toUpperCase();
  const isHost = search.get('host') === '1';
  const caseId = search.get('case') ?? undefined;

  const playerName = useGame((s) => s.playerName);

  return (
    <CaseRoomScreen
      code={code}
      isHost={isHost}
      caseId={caseId}
      playerName={playerName || 'Player'}
    />
  );
}
