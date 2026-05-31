'use client';

import { useMemo, useState } from 'react';
import {
  Shield,
  Plane,
  Smartphone,
  Car,
  Home as HomeIcon,
  GraduationCap,
  Heart as HeartIcon,
  Target,
  Plus,
  Sparkles,
  Trash2,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  useContributeGoal,
  useCreateGoal,
  useDeleteGoal,
  useGoals,
} from '@/hooks/useGoals';
import { formatCurrency, formatRelativeDays } from '@/lib/format';
import { cn } from '@/lib/cn';

interface GoalCategoryOption {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

const GOAL_CATEGORIES: GoalCategoryOption[] = [
  { id: 'emergency', label: 'Emergency', icon: Shield, color: '#10B981' },
  { id: 'travel', label: 'Travel', icon: Plane, color: '#3B82F6' },
  { id: 'gadget', label: 'Gadget', icon: Smartphone, color: '#A78BFA' },
  { id: 'vehicle', label: 'Vehicle', icon: Car, color: '#fbbf24' },
  { id: 'home', label: 'Home', icon: HomeIcon, color: '#F472B6' },
  { id: 'education', label: 'Education', icon: GraduationCap, color: '#22D3EE' },
  { id: 'wedding', label: 'Wedding', icon: HeartIcon, color: '#EC4899' },
  { id: 'other', label: 'Other', icon: Target, color: '#6366F1' },
];

function categoryFor(id: string | undefined): GoalCategoryOption {
  return (
    GOAL_CATEGORIES.find((c) => c.id === (id ?? '').toLowerCase()) ??
    GOAL_CATEGORIES[GOAL_CATEGORIES.length - 1]
  );
}

interface GoalVm {
  id: string;
  name: string;
  category: string;
  targetAmount: number;
  currentAmount: number;
  progressPercent: number;
  targetDate?: string;
  isCompleted: boolean;
  monthsToGoal?: number | null;
}

type FilterType = 'active' | 'completed' | 'all';

export default function GoalsPage() {
  const goalsQuery = useGoals();
  const createGoal = useCreateGoal();
  const contributeGoal = useContributeGoal();
  const deleteGoal = useDeleteGoal();

  const goals: GoalVm[] = useMemo(() => {
    const list = (goalsQuery.data ?? []) as unknown as Array<Record<string, unknown>>;
    return list.map((g) => {
      const target = Number(g.targetAmount ?? 0);
      const current = Number(g.currentAmount ?? 0);
      return {
        id: String(g.id),
        name: String(g.name ?? 'Goal'),
        category: String(g.category ?? g.categoryId ?? 'other'),
        targetAmount: target,
        currentAmount: current,
        progressPercent: Number(g.progressPercent ?? (target > 0 ? (current / target) * 100 : 0)),
        targetDate: g.targetDate ? String(g.targetDate) : undefined,
        isCompleted: !!g.isCompleted,
        monthsToGoal:
          typeof g.monthsToGoal === 'number'
            ? (g.monthsToGoal as number)
            : g.monthsToGoal == null
              ? null
              : Number(g.monthsToGoal),
      };
    });
  }, [goalsQuery.data]);

  const [filter, setFilter] = useState<FilterType>('active');
  const [createOpen, setCreateOpen] = useState(false);
  const [contributeFor, setContributeFor] = useState<GoalVm | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<GoalVm | null>(null);

  const filtered = useMemo(() => {
    if (filter === 'active') return goals.filter((g) => !g.isCompleted);
    if (filter === 'completed') return goals.filter((g) => g.isCompleted);
    return goals;
  }, [goals, filter]);

  const stats = useMemo(() => {
    const active = goals.filter((g) => !g.isCompleted);
    const completed = goals.filter((g) => g.isCompleted).length;
    const totalTarget = active.reduce((s, g) => s + g.targetAmount, 0);
    const totalSaved = active.reduce((s, g) => s + g.currentAmount, 0);
    const overall = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;
    return {
      activeCount: active.length,
      completed,
      totalTarget,
      totalSaved,
      overall,
    };
  }, [goals]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-headline-lg text-on-surface">Savings Goals</h1>
          <p className="text-body-sm text-on-surface-variant mt-1">
            {stats.activeCount} active
            {stats.completed > 0 ? ` • ${stats.completed} completed` : ''}
          </p>
        </div>
        <Button leadingIcon={<Plus size={16} strokeWidth={2.5} />} onClick={() => setCreateOpen(true)}>
          New goal
        </Button>
      </div>

      {/* Hero stats */}
      <Card variant="hero" padding="lg">
        <div className="flex items-center gap-6">
          <ProgressRing
            value={stats.overall}
            size={104}
            strokeWidth={8}
            color="var(--accent-success)"
            centerLabel={
              <div className="text-center">
                <div className="text-headline-md tabular-nums text-on-surface">
                  {Math.round(stats.overall)}%
                </div>
              </div>
            }
            label="Overall savings progress"
          />
          <div className="flex-1 min-w-0">
            <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
              Saved towards goals
            </p>
            <p className="mt-1 text-display-lg tabular-nums text-on-surface">
              {formatCurrency(stats.totalSaved)}
            </p>
            <p className="text-body-sm text-on-surface-variant tabular-nums">
              of {formatCurrency(stats.totalTarget)} target
            </p>
          </div>
        </div>
      </Card>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['active', 'completed', 'all'] as FilterType[]).map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={active}
              className={cn(
                'shrink-0 rounded-full border px-4 py-2 text-label-md transition-colors duration-snappy',
                active
                  ? 'border-accent-primary bg-accent-primary text-white'
                  : 'border-[var(--border-default)] bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          );
        })}
      </div>

      {/* List */}
      {goalsQuery.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} h={220} rounded="lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Target size={48} strokeWidth={1.5} />}
          title={filter === 'completed' ? 'No completed goals yet' : 'No goals yet'}
          description={
            filter === 'completed'
              ? 'Complete a goal to celebrate it here.'
              : "Set a savings goal — we'll track contributions and forecast when you'll hit it."
          }
          action={
            filter !== 'completed' ? (
              <Button leadingIcon={<Plus size={16} strokeWidth={2.5} />} onClick={() => setCreateOpen(true)}>
                Create goal
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onContribute={() => setContributeFor(goal)}
              onDelete={() => setConfirmDelete(goal)}
            />
          ))}
        </div>
      )}

      <CreateGoalModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(payload) =>
          createGoal.mutate(payload, {
            onSuccess: () => setCreateOpen(false),
          })
        }
        isPending={createGoal.isPending}
      />

      <ContributeModal
        goal={contributeFor}
        onClose={() => setContributeFor(null)}
        onContribute={(amount) => {
          if (!contributeFor) return;
          contributeGoal.mutate(
            { id: contributeFor.id, amount },
            { onSuccess: () => setContributeFor(null) },
          );
        }}
        isPending={contributeGoal.isPending}
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
              loading={deleteGoal.isPending}
              onClick={() => {
                if (!confirmDelete) return;
                deleteGoal.mutate(confirmDelete.id, {
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
          You&apos;ll lose its history of contributions, but you can recreate the goal at any time.
        </p>
      </Modal>
    </div>
  );
}

// =============================================================
// Goal card
// =============================================================
function GoalCard({
  goal,
  onContribute,
  onDelete,
}: {
  goal: GoalVm;
  onContribute: () => void;
  onDelete: () => void;
}) {
  const cat = categoryFor(goal.category);
  const Icon = cat.icon;
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const progress = Math.min(100, Math.max(0, goal.progressPercent));

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
          <h3 className="truncate text-body-lg font-bold text-on-surface">{goal.name}</h3>
          <p className="text-body-sm text-on-surface-variant truncate">{cat.label}</p>
        </div>
        {goal.isCompleted && (
          <Badge variant="success" size="sm">
            Done
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-5 border-t border-[var(--border-default)] pt-4">
        <ProgressRing
          value={progress}
          size={88}
          strokeWidth={7}
          color={cat.color}
          centerLabel={
            <div className="text-center">
              <div className="text-headline-sm tabular-nums text-on-surface">
                {Math.round(progress)}%
              </div>
            </div>
          }
          label={`${goal.name} progress`}
        />
        <div className="flex-1 min-w-0">
          <p className="text-body-md tabular-nums">
            <span className="font-bold text-on-surface">
              {formatCurrency(goal.currentAmount, { compact: goal.currentAmount >= 100000 })}
            </span>
            <span className="text-on-surface-variant"> / </span>
            <span className="text-on-surface-variant">
              {formatCurrency(goal.targetAmount, { compact: goal.targetAmount >= 100000 })}
            </span>
          </p>
          <p className="mt-1 text-label-sm uppercase tracking-wider text-accent-success tabular-nums">
            {formatCurrency(remaining, { compact: remaining >= 100000 })} to go
          </p>
          {goal.monthsToGoal != null && goal.monthsToGoal !== undefined && (
            <p className="mt-2 inline-flex items-center gap-1 text-body-sm text-accent-ai">
              <Sparkles size={12} strokeWidth={2} />
              {goal.monthsToGoal} {goal.monthsToGoal === 1 ? 'month' : 'months'} at this pace
            </p>
          )}
          {goal.targetDate && (
            <p className="text-body-sm text-on-surface-variant mt-1">
              Target {formatRelativeDays(goal.targetDate)}
            </p>
          )}
        </div>
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
          onClick={onContribute}
          trailingIcon={<ArrowRight size={14} strokeWidth={2} />}
          className="flex-2"
          disabled={goal.isCompleted}
        >
          Contribute
        </Button>
      </div>
    </Card>
  );
}

// =============================================================
// Create / Contribute modals
// =============================================================
function CreateGoalModal({
  open,
  onClose,
  onCreate,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: {
    name: string;
    targetAmount: number;
    category: string;
    targetDate?: string;
  }) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [category, setCategory] = useState<string>('other');
  const [targetDate, setTargetDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setTarget('');
    setCategory('other');
    setTargetDate('');
    setError(null);
  };

  const submit = () => {
    const amount = Number(target.replace(/[^0-9.]/g, ''));
    if (!name.trim() || !amount || amount <= 0) {
      setError('Add a name and target amount');
      return;
    }
    onCreate({
      name: name.trim(),
      targetAmount: amount,
      category,
      targetDate: targetDate || undefined,
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
      title="New goal"
      description="We'll track contributions and forecast when you'll hit it."
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={isPending} trailingIcon={<ArrowRight size={16} strokeWidth={2} />}>
            Create goal
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Input
          label="Name"
          placeholder="Europe trip"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Target amount (₹)"
            placeholder="300000"
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
          <Input
            label="Target date"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </div>

        <div>
          <p className="mb-2 text-label-sm uppercase tracking-wider text-on-surface-variant">
            Category
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {GOAL_CATEGORIES.map((c) => {
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

        {error && <p className="text-body-sm text-accent-error">{error}</p>}
      </div>
    </Modal>
  );
}

function ContributeModal({
  goal,
  onClose,
  onContribute,
  isPending,
}: {
  goal: GoalVm | null;
  onClose: () => void;
  onContribute: (amount: number) => void;
  isPending: boolean;
}) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setAmount('');
    setError(null);
    onClose();
  };

  const submit = () => {
    const value = Number((amount || '').replace(/[^0-9.]/g, ''));
    if (!value || value <= 0) {
      setError('Enter a positive amount');
      return;
    }
    onContribute(value);
    setAmount('');
    setError(null);
  };

  return (
    <Modal
      open={!!goal}
      onClose={handleClose}
      title={goal ? `Add to ${goal.name}` : ''}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={isPending} trailingIcon={<ArrowRight size={16} strokeWidth={2} />}>
            Contribute
          </Button>
        </>
      }
    >
      {goal && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-accent-success/30 bg-accent-success/10 p-3 text-center">
            <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
              Remaining to target
            </p>
            <p className="mt-1 text-headline-md tabular-nums text-accent-success">
              {formatCurrency(Math.max(0, goal.targetAmount - goal.currentAmount))}
            </p>
          </div>
          <Input
            label="Amount (₹)"
            placeholder="5000"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
          {error && <p className="text-body-sm text-accent-error">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
