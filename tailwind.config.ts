import type { Config } from 'tailwindcss';

/**
 * KidsCode design tokens.
 *
 * Every colour is a CSS variable (see `globals.css`) so the whole palette —
 * including dark mode — is swapped at the `:root` / `.dark` level without
 * touching components. Tokens are defined as `R G B` triplets so Tailwind's
 * opacity modifiers (`bg-brand/10`, `ring-border/60`) keep working.
 *
 * Semantic names (`brand`, `fg`, `surface`, `border`, `success`, …) are the
 * vocabulary for new code. The legacy playful names (`grape`, `mint`, `sky`,
 * `sun`, `mango`, `bubble`, `ink`, `cloud`) are kept as aliases of those
 * semantic scales so the existing component tree moves onto the new palette
 * in one step — do not add new usages of the legacy names.
 */
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const scale = (name: string) => ({
  DEFAULT: v(`${name}-500`),
  50: v(`${name}-50`),
  100: v(`${name}-100`),
  200: v(`${name}-200`),
  300: v(`${name}-300`),
  400: v(`${name}-400`),
  500: v(`${name}-500`),
  600: v(`${name}-600`),
  700: v(`${name}-700`),
  800: v(`${name}-800`),
  900: v(`${name}-900`),
});

const brand = scale('brand');
const success = scale('success');
const warning = scale('warning');
const danger = scale('danger');
const info = scale('info');
const amber = scale('amber');
const violet = scale('violet');

const fg = { DEFAULT: v('fg'), soft: v('fg-soft'), faint: v('fg-faint'), inverse: v('fg-inverse') };

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── semantic ────────────────────────────────────────────────
        brand,
        success,
        warning,
        danger,
        info,
        amber,
        violet,
        fg,
        bg: { DEFAULT: v('bg'), subtle: v('bg-subtle') },
        surface: { DEFAULT: v('surface'), 2: v('surface-2'), 3: v('surface-3') },
        border: { DEFAULT: v('border'), strong: v('border-strong') },
        // ── legacy aliases (kept for the existing tree) ─────────────
        grape: brand,
        mint: success,
        sky: info,
        sun: amber,
        mango: warning,
        bubble: danger,
        ink: fg,
        cloud: v('bg'),
      },
      fontFamily: {
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        // the radius scale: sm 6 · md 8 · lg 10 · xl 12 · 2xl 16 · 3xl 20
        lg: '0.625rem',
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.25rem',
        xl2: '1rem', // legacy alias
      },
      boxShadow: {
        // one restrained elevation scale — borders carry the structure
        xs: '0 1px 2px 0 rgb(16 24 40 / 0.05)',
        sm: '0 1px 3px 0 rgb(16 24 40 / 0.08), 0 1px 2px -1px rgb(16 24 40 / 0.06)',
        md: '0 4px 8px -2px rgb(16 24 40 / 0.08), 0 2px 4px -2px rgb(16 24 40 / 0.04)',
        lg: '0 12px 24px -6px rgb(16 24 40 / 0.12), 0 4px 8px -4px rgb(16 24 40 / 0.06)',
        xl: '0 24px 48px -12px rgb(16 24 40 / 0.18)',
        // legacy aliases
        card: '0 1px 3px 0 rgb(16 24 40 / 0.08), 0 1px 2px -1px rgb(16 24 40 / 0.06)',
        soft: '0 1px 2px 0 rgb(16 24 40 / 0.05)',
        toy: '0 12px 24px -6px rgb(16 24 40 / 0.12), 0 4px 8px -4px rgb(16 24 40 / 0.06)',
        pop: '0 4px 8px -2px rgb(16 24 40 / 0.08), 0 2px 4px -2px rgb(16 24 40 / 0.04)',
        focus: '0 0 0 4px rgb(var(--brand-500) / 0.18)',
      },
      keyframes: {
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        wiggle: { '0%,100%': { transform: 'rotate(-2deg)' }, '50%': { transform: 'rotate(2deg)' } },
        pop: { '0%': { transform: 'scale(0.96)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'fade-up': { '0%': { transform: 'translateY(6px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      },
      animation: {
        float: 'float 5s ease-in-out infinite',
        wiggle: 'wiggle 2s ease-in-out infinite',
        pop: 'pop 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
        'fade-up': 'fade-up 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
