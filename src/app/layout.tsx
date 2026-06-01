import type { Metadata, Viewport } from 'next';
import { Baloo_2, Nunito } from 'next/font/google';
import './globals.css';
import { AppChrome } from '@/components/AppChrome';

const display = Baloo_2({ subsets: ['latin'], variable: '--font-display', weight: ['500', '600', '700', '800'] });
const sans = Nunito({ subsets: ['latin'], variable: '--font-sans', weight: ['400', '600', '700', '800'] });

export const metadata: Metadata = {
  title: 'KidsCode Quest — Learn to code by playing!',
  description: 'A fun adventure game where kids aged 7–14 learn programming through mini-games, worlds and quests.',
  keywords: ['kids coding game', 'learn to code', 'coding for kids', 'programming games'],
};

export const viewport: Viewport = {
  themeColor: '#7C5CFC',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 btn-primary">
          Skip to content
        </a>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
