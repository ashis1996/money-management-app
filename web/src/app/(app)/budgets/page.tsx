'use client';

import { useMemo, useState } from 'react';
import {
  Plus,
  Sparkles,
  Trash2,
  ArrowRight,
  Utensils,
  ShoppingBag,
  Car,
  Clapperboard,
  Zap,
  Pill,
  Package,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { useBudgets, useCreateBudget, useDeleteBudget } from '@/hooks/useBudgets';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/cn';

type Period = 'WEEKLY' | 'MONTHLY' | 'YEARLY';

interface BudgetCategoryOption {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

// Local catalogue (separate from `lib/categories.ts` because budgets and
// transactions don't share the exact set — e.g. transactions also include
// "subscription" as a leaf, but a budget on subscriptions is redundant).
const BUDGET_CATEGORIES: BudgetCategoryOption[] = [
  { id: 'food', label: 'Food & Dining', icon: Utensils, color: '#EF4444' },
  { id: 'shopping', label: 'Shopping', icon: ShoppingBag, color: '#A78BFA' },
  { id: 'transport', label: 'Transport', icon: Car, color: '#3B82F6' },
  { id: 'entertainment', label: 'Entertainment', icon: Clapperboard, color: '#F472B6' },
  { id: 'bills', label: 'Bills', icon: Zap, color: '#fbbf24' },
  { id: 'health', label: 'Health', icon: Pill, color: '#10B981' },
  { id: 'other', label: 'Other', icon: Package, color: '#909096' },
];

function categoryFor(id: string | undefined): BudgetCategoryOption {
  return (
    BUDGET_CATEGORIES.find((c) => c.id === (id ?? '').toLowerCase()) ??
    BUDGET_CATEGORIES[BUDGET_CATEGORIES.length - 1]
  );
}

interface BudgetVm {
  id: string;
  name: string;
  category: string;
  limit: number;
  spent: number;
  period: Period;
  daysLeft: number;
  remaining: number;
  utilization: number;
  isOverBudget: boolean;
  dailyAllowance: number;
}

export default function BudgetsPage() {
  const budgetsQuery = useBudgets();
  const createBudget = useCreateBudget();
  const deleteBudget = useDeleteBudget();

  const budgets: BudgetVm[] = useMemo(() => {
    const list = (budgetsQuery.data ?? []) as unknown as Array<Record<string, unknown>>;
    return list.map((b) => {
      const limit = Number(b.amountLimit ?? b.limit ?? b.amount ?? 0);
      const spent = Number(b.amountSpent ?? b.spent ?? 0);
      return {
        id: String(b.id),
        name: String(b.name ?? 'Budget'),
        category: String(b.categoryId ?? b.category ?? 'other'),
        limit,
        spent,
        period: (b.period ?? 'MONTHLY') as Period,
        daysLeft: Number(b.daysLeft ?? 0),
        remaining: Number(b.remaining ?? Math.max(0, limit - spent)),
        utilization: Number(b.utilization ?? (limit > 0 ? (spent / limit) * 100 : 0)),
        isOverBudget: !!b.isOverBudget || spent > limit,
        dailyAllowance: Number(b.dailyAllowance ?? 0),
      };
    });
  }, [budgetsQuery.data]);

  const [createOpen, setCreateOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<BudgetVm | null>(null);

  const stats = useMemo(() => {
    const totalLimit = budgets.reduce((s, b) => s + b.limit, 0);
    const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
    const overshooting = budgets.filter((b) => b.isOverBudget).length;
    return {
      totalLimit,
      totalSpent,
      remaining: Math.max(0, totalLimit - totalSpent),
      overshooting,
      utilization: totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0,
    };
  }, [budgets]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-headline-lg text-on-surface">Budgets</h1>
          <p className="text-body-sm text-on-surface-variant mt-1">
            {budgets.length} active
          </p>
        </div>
        <Button leadingIcon={<Plus size={16} strokeWidth={2.5} />} onClick={() => setCreateOpen(true)}>
          New budget
        </Button>
      </div>

      {/* Hero stats */}
      <Card variant="hero" padding="lg" className="flex flex-col gap-4">
        <div className="flex items-stretch gap-4">
          <StatCol label="Budget" value={formatCurrency(stats.totalLimit, { compact: true })} />
          <Divider />
          <StatCol label="Spent" value={formatCurrency(stats.totalSpent, { compact: true })} />
          <Divider />
          <StatCol
            label="Left"
            value={formatCurrency(stats.remaining, { compact: true })}
            tone="success"
          />
        </div>
        <div className="flex items-center justify-between border-t border-[var(--border-default)] pt-3">
          <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
            {stats.utilization}% utilised
          </p>
          {stats.overshooting > 0 && (
            <Badge variant="error" size="sm">
              {stats.overshooting} over
            </Badge>
          )}
        </div>
        <ProgressBar
          value={stats.utilization}
          color={
            stats.utilization >= 100
              ? 'var(--accent-error)'
              : stats.utilization >= 80
                ? 'var(--accent-warning)'
                : 'var(--accent-success)'
          }
        />
      </Card>

      {/* AI summary */}
      {budgets.length > 0 && (
        <Card variant="ai" padding="md" className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-md border border-accent-ai/30 bg-accent-ai/10">
            <Sparkles size={16} strokeWidth={1.75} className="text-accent-ai" />
          </div>
          <p className="flex-1 text-body-sm text-on-surface min-w-0">
            {stats.overshooting > 0 ? (
              <>
                <span className="text-accent-error font-semibold">
                  {stats.overshooting} {stats.overshooting === 1 ? 'budget is' : 'budgets are'}{' '}
                  over
                </span>{' '}
                their limit. Click into one to see where the spend is going.
              </>
            ) : (
              <>
                On track to save{' '}
                <span className="text-accent-success font-semibold tabular-nums">
                  {formatCurrency(stats.remaining, { compact: true })}
                </span>{' '}
                this period — keep it up.
              </>
            )}
          </p>
        </Card>
      )}

      {/* Budget list */}
      {budgetsQuery.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} h={200} rounded="lg" />
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <EmptyState
          icon={<Package size={48} strokeWidth={1.5} />}
          title="No budgets yet"
          description="Set a category budget — we'll alert you at 80% so you never overshoot."
          action={
            <Button leadingIcon={<Plus size={16} strokeWidth={2.5} />} onClick={() => setCreateOpen(true)}>
              Create budget
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {budgets.map((b) => (
            <BudgetCard key={b.id} budget={b} onDelete={() => setConfirmDelete(b)} />
          ))}
        </div>
      )}

      <CreateBudgetModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(payload) =>
          createBudget.mutate(payload, {
            onSuccess: () => setCreateOpen(false),
          })
        }
        isPending={createBudget.isPending}
      />

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={confirmDelete ? `Delete ${confirmDelete.name}?` : ''}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteBudget.isPending}
              onClick={() => {
                if (!confirmDelete) return;
                deleteBudget.mutate(confirmDelete.id, {
                  onSuccess: () => setConfirmDelete(null),
                });
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-body-md text-on-surface-variant">
          You can recreate it any time. Transactions tied to this category are not affected.
        </p>
      </Modal>
    </div>
  );
}

// =============================================================
// Budget card
// =============================================================
function BudgetCard({ budget, onDelete }: { budget: BudgetVm; onDelete: () => void }) {
  const cat = categoryFor(budget.category);
  const Icon = cat.icon;
  const utilization = Math.round(budget.utilization);
  const tone =
    utilization >= 100
      ? 'var(--accent-error)'
      : utilization >= 80
        ? 'var(--accent-warning)'
        : 'var(--accent-success)';
  const status: { label: string; variant: 'success' | 'warning' | 'error' } =
    utilization >= 100
      ? { label: 'Over', variant: 'error' }
      : utilization >= 80
        ? { label: 'Watch', variant: 'warning' }
        : { label: 'On track', variant: 'success' };

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div
          aria-hidden
          className="flex h-11 w-11 flex-none items-center justify-center rounded-md border"
          style={{ backgroundColor: cat.color + '22', borderColor: cat.color + '44' }}
        >
          <Icon size={18} strokeWidth={1.75} style={{ color: cat.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="truncate text-body-lg font-bold text-on-surface">{budget.name}</h3>
          <p className="text-body-sm text-on-surface-variant truncate">
            {cat.label} • {budget.period.toLowerCase()}
            {budget.daysLeft > 0 ? ` • ${budget.daysLeft}d left` : ''}
          </p>
        </div>
        <Badge variant={status.variant} size="sm">
          {status.label}
        </Badge>
      </div>

      {/* Figures */}
      <div className="flex items-baseline gap-1 border-t border-[var(--border-default)] pt-3">
        <span className="text-display-lg tabular-nums text-on-surface">
          {formatCurrency(budget.spent, { compact: budget.spent >= 100000 })}
        </span>
        <span className="text-body-md text-on-surface-variant tabular-nums">
          / {formatCurrency(budget.limit, { compact: budget.limit >= 100000 })}
        </span>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-label-sm uppercase tracking-wider">
          <span className="text-on-surface-variant">{utilization}% used</span>
          {budget.dailyAllowance > 0 && !budget.isOverBudget && (
            <span className="text-on-surface-variant tabular-nums">
              {formatCurrency(budget.dailyAllowance, { compact: true })}/day left
            </span>
          )}
        </div>
        <ProgressBar value={Math.min(100, utilization)} color={tone} />
      </div>

      <div className="flex gap-2 border-t border-[var(--border-default)] pt-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={onDelete}
          leadingIcon={<Trash2 size={14} strokeWidth={2} />}
          className="flex-1"
        >
          Delete
        </Button>
        <Button
          size="sm"
          className="flex-2"
          // Drill-down view is on the Phase 9 polish list — for now we
          // route into the Transactions list filtered by this category.
          onClick={() => {
            const url = `/transactions?category=${encodeURIComponent(budget.category)}`;
            if (typeof window !== 'undefined') window.location.href = url;
          }}
          trailingIcon={<ArrowRight size={14} strokeWidth={2} />}
        >
          View transactions
        </Button>
      </div>
    </Card>
  );
}

// =============================================================
// Create modal
// =============================================================
function CreateBudgetModal({
  open,
  onClose,
  onCreate,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: {
    name: string;
    amountLimit: number;
    categoryId: string;
    period: Period;
  }) => void;
  isPending: boolean;
}) {
  const [category, setCategory] = useState<string>('food');
  const [limit, setLimit] = useState('');
  const [period, setPeriod] = useState<Period>('MONTHLY');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setCategory('food');
    setLimit('');
    setPeriod('MONTHLY');
    setError(null);
  };

  const submit = () => {
    const value = Number((limit || '').replace(/[^0-9.]/g, ''));
    if (!value || value <= 0) {
      setError('Set a positive limit');
      return;
    }
    const cat = categoryFor(category);
    onCreate({
      name: cat.label,
      amountLimit: value,
      categoryId: category,
      period,
    });
    reset();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="New budget"
      description="Pick a category and a cap. We'll nudge you at 80%."
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={isPending} trailingIcon={<ArrowRight size={16} strokeWidth={2} />}>
            Create budget
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <p className="mb-2 text-label-sm uppercase tracking-wider text-on-surface-variant">
            Category
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {BUDGET_CATEGORIES.map((c) => {
              const active = category === c.id;
              const Icon = c.icon;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setCategory(c.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-3 py-2.5 text-body-sm font-medium transition-colors duration-snappy',
                    active
                      ? 'text-on-surface'
                      : 'border-[var(--border-default)] bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
                  )}
                  style={
                    active
                      ? { borderColor: c.color, backgroundColor: c.color + '14' }
                      : undefined
                  }
                >
                  <Icon
                    size={16}
                    strokeWidth={1.75}
                    style={{ color: active ? c.color : undefined }}
                  />
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <Input
          label="Limit (₹)"
          placeholder="10000"
          inputMode="decimal"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
        />

        <div>
          <p className="mb-2 text-label-sm uppercase tracking-wider text-on-surface-variant">
            Period
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(['WEEKLY', 'MONTHLY', 'YEARLY'] as Period[]).map((p) => {
              const active = period === p;
              return (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    'rounded-md border py-2 text-body-sm font-medium transition-colors',
                    active
                      ? 'border-accent-primary bg-accent-primary/15 text-accent-primary'
                      : 'border-[var(--border-default)] bg-surface-container-low text-on-surface-variant hover:bg-surface-container',
                  )}
                >
                  {p.charAt(0) + p.slice(1).toLowerCase()}
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="text-body-sm text-accent-error">{error}</p>}
      </div>
    </Modal>
  );
}

function StatCol({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'error';
}) {
  return (
    <div className="flex flex-col gap-1 flex-1">
      <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      <span
        className={cn(
          'text-headline-md tabular-nums',
          tone === 'success'
            ? 'text-accent-success'
            : tone === 'error'
              ? 'text-accent-error'
              : 'text-on-surface',
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="w-px self-stretch bg-[var(--border-default)]" />;
}
