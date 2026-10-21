import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Manrope, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { AppChrome } from '@/components/AppChrome';

const display = Manrope({ subsets: ['latin', 'cyrillic'], variable: '--font-display', weight: ['500', '600', '700', '800'] });
const sans = Plus_Jakarta_Sans({ subsets: ['latin', 'cyrillic-ext'], variable: '--font-sans', weight: ['400', '500', '600', '700'] });
const mono = JetBrains_Mono({ subsets: ['latin', 'cyrillic'], variable: '--font-mono', weight: ['400', '500', '700'] });

export const metadata: Metadata = {
  title: 'KidsCode Quest — Learn to code by playing',
  description: 'An educational game platform where kids aged 7–14 learn programming through mini-games, worlds and quests.',
  keywords: ['kids coding game', 'learn to code', 'coding for kids', 'programming games'],
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F7F8FA' },
    { media: '(prefers-color-scheme: dark)', color: '#0B111C' },
  ],
  width: 'device-width',
  initialScale: 1,
};

/** Applies the persisted colour scheme before first paint (no flash). Reads
 *  the same `kcq.v2` store the app persists to; falls back to the OS setting. */
const themeScript = `(function(){try{var s=JSON.parse(localStorage.getItem('kcq.v2')||'{}').state;var m=s&&s.settings&&s.settings.colorScheme;if(!m||m==='system'){m=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}if(m==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={`${display.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a href="#main" className="btn-primary sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100]">
          Skip to content
        </a>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
