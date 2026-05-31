'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNav } from './MobileNav';
import { BackgroundGlow } from './BackgroundGlow';
import { AiOrb } from '@/components/ai/AiOrb';

/**
 * Authenticated app shell. Layout:
 *
 *   - Below `lg`: Topbar (with hamburger) + MobileNav drawer + content
 *   - `lg+`     : persistent Sidebar | (Topbar + content)
 *
 * The drawer's open state is owned here so the Topbar's hamburger
 * button can reflect the correct `aria-expanded` value and so the
 * drawer can auto-close on route changes.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="relative min-h-screen w-full bg-surface text-on-surface">
      <BackgroundGlow />

      {/* Drawer: always mounted so the slide animation has a home in
          both directions; visibility is driven internally. */}
      <MobileNav open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="relative z-10 flex">
        <Sidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <Topbar onOpenNav={() => setNavOpen(true)} navOpen={navOpen} />
          <main className="flex-1 px-5 py-8 lg:px-16 lg:py-10">
            <div className="mx-auto w-full max-w-[1280px]">{children}</div>
          </main>
        </div>
      </div>

      {/* Floating AI orb — Phase 6+ wires it into the chat coach. For
          now it routes to the /ai-coach screen so the affordance is
          discoverable. */}
      <div className="fixed bottom-6 right-6 z-ai-orb">
        <AiOrb onClick={() => router.push('/ai-coach')} />
      </div>
    </div>
  );
}
