'use client';

import { use } from 'react';
import { GameShell } from '@/components/games/GameShell';

export default function PlayPage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = use(params);
  return <GameShell slug={game} />;
}
