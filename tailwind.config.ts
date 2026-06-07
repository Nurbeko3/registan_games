import type { Config } from 'tailwindcss';

/**
 * Design tokens — bright, playful, Pixar-energy palette with strong contrast
 * for accessibility (all text/bg pairs meet WCAG AA).
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        grape: { DEFAULT: '#7C5CFC', 50: '#F1EDFF', 100: '#E3DBFF', 400: '#9B82FF', 600: '#6841F0', 700: '#5733C7' },
        mango: { DEFAULT: '#FF9F43', 600: '#F2840E' },
        bubble: { DEFAULT: '#FF7AB6', 600: '#F0509A' },
        mint: { DEFAULT: '#22C55E', 600: '#16A34A' },
        sky: { DEFAULT: '#3BA7FF', 600: '#1E8FF0' },
        sun: { DEFAULT: '#FFD43B', 600: '#F5C211' },
        ink: { DEFAULT: '#1E1B3A', soft: '#46426B', faint: '#8B87B3' },
        cloud: '#F7F6FE',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: { xl2: '1.75rem', blob: '42% 58% 63% 37% / 41% 44% 56% 59%' },
      boxShadow: {
        pop: '0 10px 0 0 rgba(30,27,58,0.12)',
        toy: '0 18px 40px -12px rgba(124,92,252,0.45)',
        card: '0 8px 30px -10px rgba(30,27,58,0.18)',
        soft: '0 4px 24px -6px rgba(30,27,58,0.12)',
      },
      keyframes: {
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-14px)' } },
        wiggle: { '0%,100%': { transform: 'rotate(-3deg)' }, '50%': { transform: 'rotate(3deg)' } },
        pop: { '0%': { transform: 'scale(0.8)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        float: 'float 4s ease-in-out infinite',
        wiggle: 'wiggle 2s ease-in-out infinite',
        pop: 'pop 0.3s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
