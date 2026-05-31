import { BackgroundGlow } from './BackgroundGlow';

/**
 * Centered, full-bleed shell for unauthenticated screens (login,
 * register, password reset, ...). Renders the ambient glow behind
 * a frosted card.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen w-full bg-surface text-on-surface flex items-center justify-center px-5 py-12">
      <BackgroundGlow />
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
