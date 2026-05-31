'use client';

import { useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { BackgroundGlow } from './BackgroundGlow';
import { AiOrb } from '@/components/ai/AiOrb';

/**
 * Authenticated app shell — sidebar (lg+), topbar, content column,
 * floating AI orb. Children render inside a max-width container with
 * the standard 64px desktop / 20px mobile margins.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <div className="relative min-h-screen w-full bg-surface text-on-surface">
      <BackgroundGlow />
      <div className="relative z-10 flex">
        <Sidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <Topbar />
          <main className="flex-1 px-5 py-8 lg:px-16 lg:py-10">
            <div className="mx-auto w-full max-w-[1280px]">{children}</div>
          </main>
        </div>
      </div>

      {/* Floating AI orb — Phase 6+ wires it into the chat coach. For now
          it routes to the placeholder /ai-coach screen so the affordance
          is discoverable. */}
      <div className="fixed bottom-6 right-6 z-ai-orb">
        <AiOrb onClick={() => router.push('/ai-coach')} />
      </div>
    </div>
  );
}
