'use client';

import type { WeaponId } from '@/lib/arena/weapons';

const COLORS: Record<WeaponId, { body: string; accent: string; glow: string }> = {
  'training-rifle': { body: '#7C5CFC', accent: '#FFD43B', glow: '#EDE6FF' },
  'energy-rifle': { body: '#2563EB', accent: '#22D3EE', glow: '#DBF4FF' },
  'burst-rifle': { body: '#6D4BDB', accent: '#F59E0B', glow: '#F3E8FF' },
  smg: { body: '#0F766E', accent: '#34D399', glow: '#D1FAE5' },
  shotgun: { body: '#BE185D', accent: '#FDBA74', glow: '#FFE4E6' },
  sniper: { body: '#1E1B4B', accent: '#A78BFA', glow: '#EDE9FE' },
  support: { body: '#475569', accent: '#38BDF8', glow: '#E0F2FE' },
  'learning-blaster': { body: '#7C2D12', accent: '#FDE047', glow: '#FEF3C7' },
};

export function WeaponIcon({ id, className = '' }: { id: WeaponId; className?: string }) {
  const c = COLORS[id];
  return (
    <svg viewBox="0 0 120 72" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={`weapon-${id}`} x1="16" x2="102" y1="16" y2="54" gradientUnits="userSpaceOnUse">
          <stop stopColor={c.accent} />
          <stop offset="0.5" stopColor={c.body} />
          <stop offset="1" stopColor="#1E1B3A" />
        </linearGradient>
      </defs>
      <ellipse cx="54" cy="38" rx="46" ry="23" fill={c.glow} />
      <path d="M16 33h54l14-9h18c4 0 7 3 7 7v5c0 4-3 7-7 7H84L70 53H46l-8 12H24l7-18H16c-5 0-9-4-9-9s4-5 9-5Z" fill={`url(#weapon-${id})`} />
      <path d="M44 48h18l8 15H56l-5-8h-7v-7Z" fill="#1E1B3A" opacity="0.82" />
      <path d="M80 29h20M76 38h27" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.78" />
      <circle cx="29" cy="38" r="7" fill="#fff" opacity="0.72" />
      <circle cx="29" cy="38" r="3" fill={c.accent} />
      {id === 'shotgun' && <path d="M86 22l12-10M93 46l15 8" stroke={c.accent} strokeWidth="5" strokeLinecap="round" />}
      {id === 'sniper' && <path d="M44 23h26M54 17v12" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.7" />}
      {id === 'support' && <rect x="58" y="48" width="24" height="8" rx="4" fill={c.accent} />}
    </svg>
  );
}

