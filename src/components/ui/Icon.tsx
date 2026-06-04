'use client';

export type IconName =
  | 'arena'
  | 'binary'
  | 'bot'
  | 'brain'
  | 'bug'
  | 'calculator'
  | 'city'
  | 'cloud'
  | 'coin'
  | 'compass'
  | 'crown'
  | 'flame'
  | 'forest'
  | 'gem'
  | 'gift'
  | 'home'
  | 'lock'
  | 'loop'
  | 'map'
  | 'mountain'
  | 'party'
  | 'pattern'
  | 'planet'
  | 'profile'
  | 'puzzle'
  | 'rank'
  | 'rocket'
  | 'signal'
  | 'spark'
  | 'star'
  | 'sword'
  | 'trophy'
  | 'user'
  | 'warning'
  | 'wrench'
  | 'x'
  | 'zap';

const gameIcons: Record<string, IconName> = {
  'robot-maze': 'bot',
  'memory-match': 'brain',
  'binary-challenge': 'binary',
  'algorithm-race': 'zap',
  'fix-the-bug': 'bug',
  'code-adventure': 'compass',
  'logic-puzzle': 'puzzle',
  'treasure-hunt': 'gem',
  'pattern-pop': 'pattern',
  'loop-output': 'loop',
  'quick-math': 'calculator',
};

const worldIcons: Record<string, IconName> = {
  'coding-forest': 'forest',
  'algorithm-mountain': 'mountain',
  'ai-city': 'city',
  'web-kingdom': 'crown',
  'python-planet': 'planet',
};

export function gameIcon(slug: string): IconName {
  return gameIcons[slug] ?? 'spark';
}

export function worldIcon(slug: string): IconName {
  return worldIcons[slug] ?? 'map';
}

export function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

export function IconTile({ name, className = '', iconClassName = 'h-7 w-7' }: { name: IconName; className?: string; iconClassName?: string }) {
  return (
    <span className={`grid place-items-center rounded-2xl bg-white/20 text-current ring-1 ring-white/30 ${className}`}>
      <Icon name={name} className={iconClassName} />
    </span>
  );
}

const paths: Record<IconName, React.ReactNode> = {
  arena: <><path d="m6 18 7.5-7.5" /><path d="m18 18-7.5-7.5" /><path d="M7.5 6.5 10.5 9.5" /><path d="M16.5 6.5 13.5 9.5" /></>,
  binary: <><path d="M7 7h2v10H7" /><path d="M15 7a2 2 0 0 1 2 2v6a2 2 0 1 1-4 0V9a2 2 0 0 1 2-2Z" /></>,
  bot: <><rect x="5" y="8" width="14" height="11" rx="3" /><path d="M12 8V5" /><path d="M9 13h.01" /><path d="M15 13h.01" /><path d="M9.5 17h5" /></>,
  brain: <><path d="M8 7a3 3 0 0 1 5-2 3 3 0 0 1 5 3 3 3 0 0 1-1 5 3 3 0 0 1-3 5h-1V5" /><path d="M8 7a3 3 0 0 0-2 5 3 3 0 0 0 2 6h3V5" /></>,
  bug: <><path d="M8 8a4 4 0 0 1 8 0v8a4 4 0 0 1-8 0V8Z" /><path d="M4 13h4" /><path d="M16 13h4" /><path d="M5 19l3-2" /><path d="M19 19l-3-2" /><path d="M9 4l2 2" /><path d="M15 4l-2 2" /></>,
  calculator: <><rect x="6" y="3.5" width="12" height="17" rx="2" /><path d="M9 7h6" /><path d="M9 11h.01" /><path d="M12 11h.01" /><path d="M15 11h.01" /><path d="M9 15h.01" /><path d="M12 15h.01" /><path d="M15 15h.01" /></>,
  city: <><path d="M4 20h16" /><path d="M6 20V8l5-3v15" /><path d="M13 20V7h5v13" /><path d="M8 11h1" /><path d="M8 15h1" /><path d="M15 11h1" /><path d="M15 15h1" /></>,
  cloud: <><path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.3 1.7A3.2 3.2 0 0 0 7 18Z" /></>,
  coin: <><circle cx="12" cy="12" r="8" /><path d="M12 7v10" /><path d="M9.5 9.5A2.5 2.5 0 0 1 12 8h1a2 2 0 0 1 0 4h-2a2 2 0 0 0 0 4h1a2.5 2.5 0 0 0 2.5-1.5" /></>,
  compass: <><circle cx="12" cy="12" r="8" /><path d="m15 9-2 5-5 2 2-5 5-2Z" /></>,
  crown: <><path d="m4 8 4 4 4-7 4 7 4-4-2 10H6L4 8Z" /><path d="M6 20h12" /></>,
  flame: <><path d="M12 21c4 0 7-3 7-7 0-3-2-5-4-7 .2 2-1 3.5-2.5 4C12 8 10 5 7 3c.5 4-2 6-2 10 0 5 3 8 7 8Z" /></>,
  forest: <><path d="M12 3 5 14h4l-2 4h10l-2-4h4L12 3Z" /><path d="M12 18v3" /></>,
  gem: <><path d="M6 4h12l3 5-9 11L3 9l3-5Z" /><path d="M3 9h18" /><path d="m8 9 4 11 4-11" /></>,
  gift: <><path d="M4 11h16v9H4z" /><path d="M4 11V7h16v4" /><path d="M12 7v13" /><path d="M12 7H8.5A2.5 2.5 0 1 1 12 4.7V7Z" /><path d="M12 7h3.5A2.5 2.5 0 1 0 12 4.7V7Z" /></>,
  home: <><path d="M4 10.8 12 4l8 6.8" /><path d="M6.5 10.5V20h11v-9.5" /><path d="M10 20v-5h4v5" /></>,
  lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V8a4 4 0 0 1 8 0v2" /></>,
  loop: <><path d="M17 7h-7a4 4 0 0 0 0 8h1" /><path d="m14 4 3 3-3 3" /><path d="M7 17h7a4 4 0 0 0 0-8h-1" /><path d="m10 20-3-3 3-3" /></>,
  map: <><path d="M5 5.5 10 4l4 1.5 5-1.5v14.5L14 20l-4-1.5L5 20V5.5Z" /><path d="M10 4v14.5" /><path d="M14 5.5V20" /></>,
  mountain: <><path d="m3 20 7-14 4 8 2-4 5 10H3Z" /><path d="m10 6 2 4 2-2" /></>,
  party: <><path d="M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M15.5 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" /><path d="M3.5 19c.7-3.2 2.6-5 5-5s4.3 1.8 5 5" /><path d="M12.5 18.5c.7-2.2 2.1-3.4 4-3.4 1.7 0 3 1.1 4 3.4" /></>,
  pattern: <><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></>,
  planet: <><circle cx="12" cy="12" r="5" /><path d="M3 13c3 4 15 4 18-2" /><path d="M5 9c4-3 12-3 14 0" /></>,
  profile: <><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  puzzle: <><path d="M8 4h5v4h3a2 2 0 1 1 0 4h-3v8H8v-4H5a2 2 0 1 1 0-4h3V4Z" /></>,
  rank: <><path d="M8 4h8v3a4 4 0 0 1-8 0V4Z" /><path d="M8 6H5.5A2.5 2.5 0 0 0 8 10" /><path d="M16 6h2.5A2.5 2.5 0 0 1 16 10" /><path d="M12 11v4" /><path d="M8.5 20h7" /></>,
  rocket: <><path d="M12 15 9 12c1-4 4-7 9-8-1 5-4 8-8 9Z" /><path d="M9 12 5 16l3 1 1 3 4-4" /><path d="M15 6h.01" /></>,
  signal: <><path d="M5 13a10 10 0 0 1 14 0" /><path d="M8 16a6 6 0 0 1 8 0" /><path d="M12 20h.01" /><path d="M2 9a15 15 0 0 1 20 0" /></>,
  spark: <><path d="M12 3v5" /><path d="M12 16v5" /><path d="M3 12h5" /><path d="M16 12h5" /><path d="m6 6 3 3" /><path d="m15 15 3 3" /><path d="m18 6-3 3" /><path d="m9 15-3 3" /></>,
  star: <><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 16.9 6.6 19.8l1-6.1-4.4-4.3 6.1-.9L12 3Z" /></>,
  sword: <><path d="M14.5 4.5 20 4l-.5 5.5L9 20l-5-5L14.5 4.5Z" /><path d="m13 7 4 4" /><path d="m7 17-3 3" /></>,
  trophy: <><path d="M8 4h8v3a4 4 0 0 1-8 0V4Z" /><path d="M8 6H5.5A2.5 2.5 0 0 0 8 10" /><path d="M16 6h2.5A2.5 2.5 0 0 1 16 10" /><path d="M12 11v5" /><path d="M8 20h8" /></>,
  user: <><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  warning: <><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v5" /><path d="M12 17h.01" /></>,
  wrench: <><path d="M14.7 6.3a4 4 0 0 0-5 5L4 17l3 3 5.7-5.7a4 4 0 0 0 5-5l-3 3-3-3 3-3Z" /></>,
  x: <><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>,
  zap: <><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></>,
};
