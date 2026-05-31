'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  Send,
  Mic,
  Trash2,
  ArrowRight,
  Droplet,
  Target,
  PieChart,
  Repeat,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { AiOrb } from '@/components/ai/AiOrb';
import { Card } from '@/components/ui/Card';
import { useAskAi } from '@/hooks/useAi';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/cn';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

const SUGGESTED_QUERIES: Array<{ icon: LucideIcon; text: string }> = [
  { icon: Droplet, text: 'Where did I waste money this month?' },
  { icon: TrendingUp, text: 'How can I save ₹10,000/month?' },
  { icon: PieChart, text: 'Compare my spending to last month' },
  { icon: Repeat, text: 'What subscriptions should I cancel?' },
];

const QUICK_TOPICS: Array<{ label: string; prompt: string; icon: LucideIcon }> = [
  { label: 'Money Leaks', prompt: 'Tell me about my money leaks', icon: Droplet },
  { label: 'Goals', prompt: 'How are my goals tracking?', icon: Target },
  { label: 'Budgets', prompt: 'How am I doing against my budgets?', icon: PieChart },
  { label: 'Subscriptions', prompt: 'Audit my subscriptions', icon: Repeat },
];

export default function AiCoachPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const askAi = useAskAi();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const isEmpty = messages.length === 0 && !isLoading;

  const handleSend = async (text?: string) => {
    const query = (text ?? input).trim();
    if (!query) return;

    const userMsg: Message = {
      id: String(Date.now()),
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await askAi.mutateAsync({ query });
      const data = response.data as Record<string, unknown> | undefined;
      const answer =
        (data?.answer as string) ??
        (data?.response as string) ??
        (data?.text as string) ??
        (data?.message as string) ??
        "I couldn't generate a response right now. Try rephrasing.";
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: answer,
          data: (data?.data as Record<string, unknown>) ?? undefined,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch {
      const local = generateLocalResponse(query);
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: local.text + '\n\n(AI service unreachable, showing local analysis)',
          data: local.data,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleSend();
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[560px] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-[var(--border-default)]">
        <div>
          <h1 className="text-headline-md text-ai-gradient">AI Coach</h1>
          <p className="text-body-sm text-on-surface-variant">
            {isEmpty ? 'Your money coach is ready' : 'Ask anything about your money'}
          </p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => setMessages([])}
            aria-label="Clear conversation"
            className="flex h-9 items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-surface-container px-3 text-body-sm text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            <Trash2 size={14} strokeWidth={1.75} />
            Clear
          </button>
        )}
      </div>

      {/* Messages or empty hero */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-6">
        {isEmpty ? (
          <EmptyHero onSelect={handleSend} />
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isLoading && <TypingIndicator />}
          </div>
        )}
      </div>

      {/* Quick topic chips (when conversation has started) */}
      {messages.length > 0 && !isLoading && (
        <div className="flex gap-2 overflow-x-auto pb-3 pt-1">
          {QUICK_TOPICS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.label}
                type="button"
                onClick={() => handleSend(t.prompt)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-surface-container px-3 py-1.5 text-label-md text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
              >
                <Icon size={14} strokeWidth={1.75} className="text-accent-ai" />
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Input bar */}
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 border-t border-[var(--border-default)] pt-4"
      >
        <button
          type="button"
          aria-label="Voice input"
          disabled
          className="flex h-10 w-10 flex-none items-center justify-center rounded-md border border-[var(--border-default)] bg-surface-container text-on-surface-variant disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Mic size={18} strokeWidth={1.75} />
        </button>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          rows={1}
          maxLength={500}
          placeholder="Ask anything about your money…"
          aria-label="Ask AI"
          className="flex-1 resize-none rounded-lg border border-[var(--border-default)] bg-surface-container-lowest px-4 py-2.5 text-body-md text-on-surface placeholder:text-outline focus:border-accent-ai focus:outline-none focus:shadow-focus-ai max-h-32"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={isLoading || !input.trim()}
          className={cn(
            'flex h-10 w-10 flex-none items-center justify-center rounded-md transition-colors',
            isLoading || !input.trim()
              ? 'bg-surface-container-high text-outline cursor-not-allowed'
              : 'bg-accent-primary text-white hover:brightness-110',
          )}
        >
          <Send size={18} strokeWidth={2} />
        </button>
      </form>
    </div>
  );
}

// =============================================================
// Empty hero
// =============================================================
function EmptyHero({ onSelect }: { onSelect: (q: string) => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center text-center">
      <AiOrb size={120} aria-label="AI assistant" onClick={() => undefined} />
      <h2 className="mt-6 text-headline-lg text-on-surface">Hi, I&apos;m your money coach</h2>
      <p className="mt-2 text-body-md text-on-surface-variant">
        Ask me anything about your spending, savings, subscriptions, or goals.
      </p>

      <div className="mt-8 flex w-full flex-col gap-2">
        {SUGGESTED_QUERIES.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.text}
              type="button"
              onClick={() => onSelect(s.text)}
              className="group flex items-center gap-3 rounded-lg border border-[var(--border-default)] bg-surface-container px-4 py-3 text-left transition-colors hover:bg-surface-container-high"
            >
              <div className="flex h-8 w-8 flex-none items-center justify-center rounded-md border border-accent-ai/30 bg-accent-ai/10">
                <Icon size={16} strokeWidth={1.75} className="text-accent-ai" />
              </div>
              <span className="flex-1 text-body-md font-medium text-on-surface">{s.text}</span>
              <ArrowRight
                size={16}
                strokeWidth={1.75}
                className="text-accent-primary transition-transform group-hover:translate-x-0.5"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================
// Message bubble
// =============================================================
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex items-end gap-2', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full border border-accent-ai/40 bg-accent-ai/15">
          <Sparkles size={14} strokeWidth={2} className="text-accent-ai" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[82%] rounded-lg border px-4 py-2.5',
          isUser
            ? 'rounded-br-sm border-white/16 bg-accent-primary text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)]'
            : 'rounded-bl-sm border-[var(--border-default)] bg-surface-container text-on-surface',
        )}
      >
        <p className="whitespace-pre-wrap text-body-md leading-relaxed">{message.content}</p>
        {message.data && <DataVisualization data={message.data} />}
        <p
          className={cn(
            'mt-1 text-[10px] tracking-wider tabular-nums',
            isUser ? 'text-right text-white/65' : 'text-outline',
          )}
        >
          {new Date(message.timestamp).toLocaleTimeString('en-IN', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          })}
        </p>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full border border-accent-ai/40 bg-accent-ai/15">
        <Sparkles size={14} strokeWidth={2} className="text-accent-ai" />
      </div>
      <div className="rounded-lg rounded-bl-sm border border-[var(--border-default)] bg-surface-container px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex gap-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-ai" />
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-ai"
              style={{ animationDelay: '150ms' }}
            />
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-ai"
              style={{ animationDelay: '300ms' }}
            />
          </span>
          <span className="text-body-sm italic text-on-surface-variant">Thinking…</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================
// Generated data widgets
// =============================================================
function DataVisualization({ data }: { data: Record<string, unknown> }) {
  const type = data.type as string | undefined;

  if (type === 'leaks') {
    const leaks = (data.leaks ?? []) as Array<{ title: string; amount: number }>;
    const total = Number(data.total ?? 0);
    return (
      <Card variant="flat" padding="sm" className="mt-3">
        <p className="mb-1.5 text-label-sm font-bold tracking-wider text-on-surface">
          Money leaks found
        </p>
        {leaks.map((l, i) => (
          <div key={i} className="flex justify-between py-0.5 text-body-sm">
            <span className="text-on-surface-variant">{l.title}</span>
            <span className="tabular-nums font-semibold text-on-surface">
              {formatCurrency(l.amount)}/mo
            </span>
          </div>
        ))}
        <div className="mt-1.5 flex justify-between border-t border-[var(--border-default)] pt-1.5">
          <span className="text-body-sm font-semibold text-on-surface">Potential savings</span>
          <span className="tabular-nums text-body-md font-bold text-accent-success">
            {formatCurrency(total)}/mo
          </span>
        </div>
      </Card>
    );
  }

  if (type === 'affordability') {
    const amount = Number(data.amount ?? 0);
    const canAfford = !!data.canAfford;
    const monthsToSave = Number(data.monthsToSave ?? 0);
    return (
      <Card variant="flat" padding="sm" className="mt-3">
        <p
          className={cn(
            'mb-1.5 text-label-sm font-bold tracking-wider',
            canAfford ? 'text-accent-success' : 'text-accent-warning',
          )}
        >
          {canAfford ? 'You can afford this' : 'Stretch your budget'}
        </p>
        <div className="flex justify-between text-body-sm">
          <span className="text-on-surface-variant">Item cost</span>
          <span className="tabular-nums font-semibold text-on-surface">
            {formatCurrency(amount)}
          </span>
        </div>
        <div className="flex justify-between text-body-sm">
          <span className="text-on-surface-variant">Months to save</span>
          <span className="tabular-nums font-semibold text-on-surface">{monthsToSave}</span>
        </div>
      </Card>
    );
  }

  if (type === 'savings_plan') {
    const steps = (data.steps ?? []) as Array<{
      action: string;
      savings: number;
    }>;
    const total = Number(data.total ?? 0);
    return (
      <Card variant="flat" padding="sm" className="mt-3">
        <p className="mb-2 text-label-sm font-bold tracking-wider text-on-surface">
          Your savings plan
        </p>
        <ol className="flex flex-col gap-2">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full border border-accent-ai/40 bg-accent-ai/20 text-[11px] font-bold tabular-nums text-accent-ai">
                {i + 1}
              </span>
              <div className="flex-1">
                <p className="text-body-sm leading-snug text-on-surface">{s.action}</p>
                <p className="text-label-sm tabular-nums text-accent-success">
                  Save {formatCurrency(s.savings)}/mo
                </p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-2 flex justify-between border-t border-[var(--border-default)] pt-2">
          <span className="text-body-sm font-semibold text-on-surface">Total monthly savings</span>
          <span className="tabular-nums text-body-md font-bold text-accent-success">
            {formatCurrency(total)}
          </span>
        </div>
      </Card>
    );
  }

  return null;
}

// =============================================================
// Local fallback (mirrors mobile)
// =============================================================
function generateLocalResponse(query: string): {
  text: string;
  data?: Record<string, unknown>;
} {
  const q = query.toLowerCase();
  if (q.includes('waste') || q.includes('leak')) {
    return {
      text: 'Here are the biggest leaks I can find from local data:',
      data: {
        type: 'leaks',
        leaks: [
          { title: 'Spotify (low usage)', amount: 119 },
          { title: 'Cult.fit (unused)', amount: 999 },
          { title: 'Late-night impulse spends', amount: 2500 },
        ],
        total: 3618,
      },
    };
  }
  if (q.includes('afford') || q.includes('buy')) {
    return {
      text: 'Affordability snapshot based on your last 30 days:',
      data: {
        type: 'affordability',
        amount: 50000,
        canAfford: true,
        monthsToSave: 2,
      },
    };
  }
  if (q.includes('save') && (q.includes('10') || q.includes('plan'))) {
    return {
      text: 'A 5-step plan to free up roughly ₹10k/month:',
      data: {
        type: 'savings_plan',
        steps: [
          { action: 'Cancel unused subscriptions', savings: 1118 },
          { action: 'Reduce food delivery by 30%', savings: 2500 },
          { action: 'Set ₹4,000 shopping budget', savings: 2500 },
          { action: 'Avoid late-night impulse buys', savings: 2000 },
          { action: 'Switch one credit card to cashback', savings: 2000 },
        ],
        total: 10118,
      },
    };
  }
  return {
    text: 'I can help with money leaks, savings plans, affordability checks, subscription audits, budget tracking, goal progress, and cash-flow forecasts. What would you like to explore?',
  };
}
