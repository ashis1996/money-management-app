'use client';

import { useMemo, useState } from 'react';
import {
  Building,
  Wallet as WalletIcon,
  CreditCard,
  TrendingUp,
  Home as HomeIcon,
  Plus,
  Star,
  RefreshCw,
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
import { Skeleton } from '@/components/ui/Skeleton';
import {
  useAccounts,
  useCreateAccount,
  useDeleteAccount,
  useSetPrimaryAccount,
  useSyncAccount,
} from '@/hooks/useAccounts';
import { formatCurrency, formatRelativeDays } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Account, AccountType } from '@/types';

interface TypeOption {
  type: AccountType;
  label: string;
  icon: LucideIcon;
  color: string;
}

const TYPE_OPTIONS: TypeOption[] = [
  { type: 'BANK', label: 'Bank account', icon: Building, color: '#3B82F6' },
  { type: 'WALLET', label: 'Wallet', icon: WalletIcon, color: '#A78BFA' },
  { type: 'CREDIT_CARD', label: 'Credit card', icon: CreditCard, color: '#F472B6' },
  { type: 'INVESTMENT', label: 'Investment', icon: TrendingUp, color: '#10B981' },
  { type: 'LOAN', label: 'Loan', icon: HomeIcon, color: '#fbbf24' },
];

function typeOptFor(type: AccountType): TypeOption {
  return TYPE_OPTIONS.find((t) => t.type === type) ?? TYPE_OPTIONS[0];
}

type FilterType = 'all' | AccountType;

const FILTER_TABS: { key: FilterType; label: string; icon?: LucideIcon }[] = [
  { key: 'all', label: 'All' },
  { key: 'BANK', label: 'Bank', icon: Building },
  { key: 'WALLET', label: 'Wallet', icon: WalletIcon },
  { key: 'CREDIT_CARD', label: 'Credit card', icon: CreditCard },
  { key: 'INVESTMENT', label: 'Investment', icon: TrendingUp },
  { key: 'LOAN', label: 'Loan', icon: HomeIcon },
];

export default function AccountsPage() {
  const accountsQuery = useAccounts();
  const createAccount = useCreateAccount();
  const deleteAccount = useDeleteAccount();
  const setPrimary = useSetPrimaryAccount();
  const syncAccount = useSyncAccount();

  const accounts: Account[] = useMemo(() => {
    const list = (accountsQuery.data ?? []) as unknown as Array<Record<string, unknown>>;
    return list.map((a) => ({
      id: String(a.id),
      userId: String(a.userId ?? ''),
      accountName: String(a.accountName ?? a.name ?? 'Account'),
      accountType: (a.accountType ?? a.type ?? 'BANK') as AccountType,
      providerName: a.providerName ? String(a.providerName) : undefined,
      maskedAccountNumber: a.maskedAccountNumber ? String(a.maskedAccountNumber) : undefined,
      ifscCode: a.ifscCode ? String(a.ifscCode) : undefined,
      balance: Number(a.balance ?? 0),
      currency: String(a.currency ?? 'INR'),
      color: a.color ? String(a.color) : undefined,
      icon: a.icon ? String(a.icon) : undefined,
      isPrimary: !!a.isPrimary,
      isActive: a.isActive !== false,
      updatedAt: a.updatedAt ? String(a.updatedAt) : undefined,
      createdAt: a.createdAt ? String(a.createdAt) : undefined,
    }));
  }, [accountsQuery.data]);

  const [filter, setFilter] = useState<FilterType>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<Account | null>(null);

  // Net worth is computed locally rather than relying on the
  // /accounts/net-worth endpoint so the hero figure stays in lockstep
  // with the visible list — even if the user filters or the backend
  // round-trip lags. (The endpoint exists; we just don't need it here.)
  const totals = useMemo(() => {
    const assets = accounts
      .filter((a) => a.balance > 0 && a.accountType !== 'LOAN')
      .reduce((s, a) => s + a.balance, 0);
    const liabilities = accounts
      .filter((a) => a.balance < 0 || a.accountType === 'LOAN')
      .reduce((s, a) => s + Math.abs(a.balance), 0);
    return { assets, liabilities, netWorth: assets - liabilities };
  }, [accounts]);

  const filtered = useMemo(() => {
    if (filter === 'all') return accounts;
    return accounts.filter((a) => a.accountType === filter);
  }, [accounts, filter]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-headline-lg text-on-surface">Accounts</h1>
          <p className="text-body-sm text-on-surface-variant mt-1">
            {accounts.length} linked
          </p>
        </div>
        <Button leadingIcon={<Plus size={16} strokeWidth={2.5} />} onClick={() => setCreateOpen(true)}>
          Add account
        </Button>
      </div>

      {/* Net worth hero */}
      <Card variant="hero" padding="lg">
        <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
          Net worth
        </p>
        <p
          className={cn(
            'mt-1 text-display-lg tabular-nums',
            totals.netWorth >= 0 ? 'text-on-surface' : 'text-accent-error',
          )}
        >
          {totals.netWorth < 0 ? '−' : ''}
          {formatCurrency(Math.abs(totals.netWorth))}
        </p>
        <div className="mt-4 flex items-stretch gap-4 border-t border-[var(--border-default)] pt-4">
          <div className="flex-1">
            <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
              Assets
            </p>
            <p className="text-headline-sm tabular-nums text-accent-success mt-1">
              {formatCurrency(totals.assets, { compact: true })}
            </p>
          </div>
          <div className="w-px self-stretch bg-[var(--border-default)]" />
          <div className="flex-1 text-right">
            <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
              Liabilities
            </p>
            <p className="text-headline-sm tabular-nums text-accent-error mt-1">
              {formatCurrency(totals.liabilities, { compact: true })}
            </p>
          </div>
        </div>
      </Card>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTER_TABS.map((tab) => {
          const active = filter === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              aria-pressed={active}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-label-md transition-colors duration-snappy',
                active
                  ? 'border-accent-primary bg-accent-primary text-white'
                  : 'border-[var(--border-default)] bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
              )}
            >
              {Icon && <Icon size={14} strokeWidth={1.75} aria-hidden />}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* List */}
      {accountsQuery.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} h={160} rounded="lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Building size={48} strokeWidth={1.5} />}
          title={accounts.length === 0 ? 'No accounts yet' : 'No accounts match this filter'}
          description={
            accounts.length === 0
              ? 'Add your first account to start tracking your net worth.'
              : 'Try a different category.'
          }
          action={
            accounts.length === 0 ? (
              <Button leadingIcon={<Plus size={16} strokeWidth={2.5} />} onClick={() => setCreateOpen(true)}>
                Add account
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((acc) => (
            <AccountCard
              key={acc.id}
              account={acc}
              onSetPrimary={() => setPrimary.mutate(acc.id)}
              onSync={() => syncAccount.mutate(acc.id)}
              onRemove={() => setConfirmRemove(acc)}
            />
          ))}
        </div>
      )}

      <CreateAccountModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(payload) =>
          createAccount.mutate(payload, {
            onSuccess: () => setCreateOpen(false),
          })
        }
        isPending={createAccount.isPending}
      />

      <Modal
        open={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        title={confirmRemove ? `Remove ${confirmRemove.accountName}?` : ''}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteAccount.isPending}
              onClick={() => {
                if (!confirmRemove) return;
                deleteAccount.mutate(confirmRemove.id, {
                  onSuccess: () => setConfirmRemove(null),
                });
              }}
            >
              Remove
            </Button>
          </>
        }
      >
        <p className="text-body-md text-on-surface-variant">
          Transactions linked to this account will remain, but the account will be unlinked.
        </p>
      </Modal>
    </div>
  );
}

// =============================================================
// Account card
// =============================================================
function AccountCard({
  account,
  onSetPrimary,
  onSync,
  onRemove,
}: {
  account: Account;
  onSetPrimary: () => void;
  onSync: () => void;
  onRemove: () => void;
}) {
  const opt = typeOptFor(account.accountType);
  const Icon = opt.icon;
  const balanceColor =
    account.balance < 0
      ? 'text-accent-error'
      : account.accountType === 'LOAN'
        ? 'text-accent-warning'
        : 'text-on-surface';

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div
          aria-hidden
          className="flex h-12 w-12 flex-none items-center justify-center rounded-md border"
          style={{ backgroundColor: opt.color + '22', borderColor: opt.color + '44' }}
        >
          <Icon size={20} strokeWidth={1.75} style={{ color: opt.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-body-lg font-bold text-on-surface">
              {account.accountName}
            </h3>
            {account.isPrimary && (
              <Badge variant="ai" size="sm">
                Primary
              </Badge>
            )}
          </div>
          <p className="truncate text-body-sm text-on-surface-variant">
            {account.providerName ?? opt.label}
            {account.maskedAccountNumber ? ` • ${account.maskedAccountNumber}` : ''}
          </p>
        </div>
      </div>

      <p className={cn('text-display-lg tabular-nums', balanceColor)}>
        {account.balance < 0 ? '−' : ''}
        {formatCurrency(Math.abs(account.balance))}
      </p>

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-default)] pt-4">
        {!account.isPrimary && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSetPrimary}
            leadingIcon={<Star size={14} strokeWidth={1.75} />}
          >
            Set primary
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onSync}
          leadingIcon={<RefreshCw size={14} strokeWidth={1.75} />}
        >
          Sync
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="ml-auto text-accent-error hover:bg-accent-error/10"
          leadingIcon={<Trash2 size={14} strokeWidth={1.75} />}
        >
          Remove
        </Button>
      </div>

      {account.updatedAt && (
        <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
          Synced {formatRelativeDays(account.updatedAt)}
        </p>
      )}
    </Card>
  );
}

// =============================================================
// Create account modal
// =============================================================
interface CreatePayload {
  accountType: AccountType;
  accountName: string;
  providerName?: string;
  maskedAccountNumber?: string;
  balance?: number;
}

function CreateAccountModal({
  open,
  onClose,
  onCreate,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: CreatePayload) => void;
  isPending: boolean;
}) {
  const [type, setType] = useState<AccountType | null>(null);
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('');
  const [mask, setMask] = useState('');
  const [balance, setBalance] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setType(null);
    setName('');
    setProvider('');
    setMask('');
    setBalance('');
    setError(null);
  };

  const submit = () => {
    if (!type) {
      setError('Pick an account type');
      return;
    }
    if (!name.trim()) {
      setError('Give the account a name');
      return;
    }
    onCreate({
      accountType: type,
      accountName: name.trim(),
      providerName: provider.trim() || undefined,
      maskedAccountNumber: mask.trim() || undefined,
      balance: balance ? Number(balance.replace(/[^0-9.-]/g, '')) : 0,
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
      title="Link an account"
      description="Track its balance and let MoneyMind reconcile transactions to it."
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={isPending} trailingIcon={<ArrowRight size={16} strokeWidth={2} />}>
            Add account
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <p className="mb-2 text-label-sm uppercase tracking-wider text-on-surface-variant">
            Type
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TYPE_OPTIONS.map((opt) => {
              const active = type === opt.type;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.type}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setType(opt.type)}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-3 py-2.5 text-body-sm font-medium transition-colors duration-snappy',
                    active
                      ? 'text-on-surface'
                      : 'border-[var(--border-default)] bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
                  )}
                  style={
                    active
                      ? {
                          borderColor: opt.color,
                          backgroundColor: opt.color + '14',
                        }
                      : undefined
                  }
                >
                  <Icon
                    size={16}
                    strokeWidth={1.75}
                    style={{ color: active ? opt.color : undefined }}
                  />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <Input
          label="Name"
          placeholder="e.g. Salary account"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="Provider"
          placeholder="HDFC Bank, ICICI, Paytm…"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Last 4 digits"
            placeholder="****1234"
            value={mask}
            onChange={(e) => setMask(e.target.value)}
          />
          <Input
            label="Balance (₹)"
            placeholder="50000"
            inputMode="decimal"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
          />
        </div>

        {error && <p className="text-body-sm text-accent-error">{error}</p>}
      </div>
    </Modal>
  );
}
