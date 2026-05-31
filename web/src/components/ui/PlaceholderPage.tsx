import { Sparkles } from 'lucide-react';
import { Card } from './Card';
import { Badge } from './Badge';

interface PlaceholderPageProps {
  title: string;
  description: string;
  phase: string;
}

/**
 * Friendly "coming soon" surface used for app routes that exist for
 * navigation but haven't been wired yet. Phase 5 ships the scaffold
 * + Dashboard; subsequent phases replace these one by one.
 */
export function PlaceholderPage({ title, description, phase }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-headline-lg text-on-surface">{title}</h1>
        <Badge variant="ai" size="md">
          {phase}
        </Badge>
      </div>
      <Card
        variant="ai"
        padding="xl"
        className="min-h-[280px] flex flex-col items-center justify-center text-center"
      >
        <Sparkles size={32} className="text-accent-ai mb-3" strokeWidth={1.75} />
        <h2 className="text-headline-md text-ai-gradient">Coming up next</h2>
        <p className="text-body-md text-on-surface-variant max-w-md mt-2">{description}</p>
      </Card>
    </div>
  );
}
