'use client';

import { motion } from 'framer-motion';

/**
 * "Byte" the robot mascot — pure SVG so it's crisp, themeable and dependency-free.
 * Floats and blinks to feel alive (Pixar-style appeal).
 */
export function Mascot({ size = 220 }: { size?: number }) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="img"
      aria-label="Byte, the friendly coding robot"
      initial={{ y: 0 }}
      animate={{ y: [0, -14, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* antenna */}
      <line x1="100" y1="32" x2="100" y2="14" stroke="#5733C7" strokeWidth="5" strokeLinecap="round" />
      <circle cx="100" cy="12" r="7" fill="#FFD43B" />
      {/* head */}
      <rect x="44" y="34" width="112" height="92" rx="26" fill="#7C5CFC" />
      <rect x="44" y="34" width="112" height="92" rx="26" fill="url(#g)" opacity="0.25" />
      {/* face screen */}
      <rect x="60" y="52" width="80" height="56" rx="18" fill="#1E1B3A" />
      {/* eyes (blink) */}
      <motion.g animate={{ scaleY: [1, 1, 0.1, 1] }} transition={{ duration: 4, repeat: Infinity, times: [0, 0.85, 0.9, 1] }} style={{ transformOrigin: '100px 76px' }}>
        <circle cx="84" cy="76" r="9" fill="#3BA7FF" />
        <circle cx="116" cy="76" r="9" fill="#3BA7FF" />
        <circle cx="87" cy="73" r="3" fill="#fff" />
        <circle cx="119" cy="73" r="3" fill="#fff" />
      </motion.g>
      {/* smile */}
      <path d="M82 92 q18 16 36 0" stroke="#FF7AB6" strokeWidth="5" fill="none" strokeLinecap="round" />
      {/* body */}
      <rect x="58" y="124" width="84" height="56" rx="22" fill="#FF9F43" />
      <circle cx="80" cy="152" r="6" fill="#fff" />
      <circle cx="100" cy="152" r="6" fill="#fff" />
      <circle cx="120" cy="152" r="6" fill="#fff" />
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
      </defs>
    </motion.svg>
  );
}
