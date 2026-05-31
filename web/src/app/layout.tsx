import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import { PublicEnv } from '@/lib/env';
import './globals.css';

// Inter loaded via next/font: avoids FOUC, gets preloaded with
// `display: swap`, exposes a CSS variable Tailwind picks up via the
// preset's font family stack.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: `${PublicEnv.appName} — AI-powered finance`,
  description: 'Track expenses, detect money leaks, and get AI-driven financial coaching.',
  applicationName: PublicEnv.appName,
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#0c1322',
  width: 'device-width',
  initialScale: 1,
  // The brand vibe is dark-locked — see the spec; light support is a
  // post-v1 effort, not a runtime override.
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-surface text-on-surface antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
