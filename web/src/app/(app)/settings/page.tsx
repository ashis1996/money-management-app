'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  User as UserIcon,
  Mail,
  Phone,
  Bell,
  PieChart,
  Calendar,
  FileText,
  Sparkles,
  Tag as TagIcon,
  Lock,
  Database,
  ShieldCheck,
  HelpCircle,
  MessageSquare,
  Star,
  LogOut,
  Send,
  Inbox,
  Smartphone,
  Bot,
  ChevronRight,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Toggle } from '@/components/ui/Toggle';
import {
  useNotificationPreferences,
  useUnreadCount,
  useUpdateNotificationPreferences,
} from '@/hooks/useNotifications';
import { useSendTestPush, useUpdateProfile } from '@/hooks/useUser';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/cn';
import type { Archetype, NotificationPreferences } from '@/types';

const ARCHETYPE_LABELS: Record<Archetype, { label: string; description: string }> = {
  SPEND_HEAVY: {
    label: 'The Enthusiast',
    description: 'You enjoy life — we help you control the spend',
  },
  SAVINGS_FOCUSED: {
    label: 'The Saver',
    description: 'Disciplined and goal-oriented',
  },
  CREDIT_USER: {
    label: 'The Card Player',
    description: 'Cards are your tool of choice',
  },
  SUBSCRIPTION_HEAVY: {
    label: 'The Subscriber',
    description: 'Many recurring services to optimise',
  },
  BALANCED: {
    label: 'Balanced',
    description: 'Well-managed across categories',
  },
};

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const updateProfile = useUpdateProfile();
  const sendTestPush = useSendTestPush();

  const prefsQuery = useNotificationPreferences();
  const updatePrefs = useUpdateNotificationPreferences();
  const unreadQuery = useUnreadCount();

  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; message: string } | null>(null);

  // Self-clearing toast — keeps the screen feedback simple without
  // pulling in a full notification library at this stage. We can
  // upgrade to a Sonner / Radix toast in the Phase 9 polish pass.
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Local UI-only toggles. These don't have backend endpoints yet —
  // they're persisted in localStorage so a refresh doesn't lose them.
  // When the user-preferences API lands we'll move them server-side.
  const [aiInsightsLocal, setAiInsightsLocal] = useLocalToggle('mm:ai-insights', true);
  const [behavioralTagsLocal, setBehavioralTagsLocal] = useLocalToggle(
    'mm:behavioral-tags',
    true,
  );
  const [autoCaptureLocal, setAutoCaptureLocal] = useLocalToggle('mm:auto-capture', true);
  const [smsParseLocal, setSmsParseLocal] = useLocalToggle('mm:sms-parse', true);
  const [emailParseLocal, setEmailParseLocal] = useLocalToggle('mm:email-parse', true);
  const [upiNotifLocal, setUpiNotifLocal] = useLocalToggle('mm:upi-notif', true);

  const archetype = ((user as unknown as { archetype?: Archetype })?.archetype ?? 'BALANCED') as Archetype;
  const archetypeMeta = ARCHETYPE_LABELS[archetype] ?? ARCHETYPE_LABELS.BALANCED;
  const initial =
    user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U';

  const prefs = prefsQuery.data;
  const setPref = (patch: Partial<NotificationPreferences>) => {
    updatePrefs.mutate(patch, {
      onError: (err) =>
        setToast({
          kind: 'err',
          message: err instanceof Error ? err.message : 'Could not save preference',
        }),
    });
  };

  const handleSendTestPush = () =>
    sendTestPush.mutate(
      { title: 'Test from MoneyMind', body: 'Push notifications are working.' },
      {
        onSuccess: () => setToast({ kind: 'ok', message: 'Test push queued' }),
        onError: (err) =>
          setToast({
            kind: 'err',
            message:
              err instanceof Error
                ? `Could not send: ${err.message}`
                : 'Could not send test push',
          }),
      },
    );

  const exportTransactions = async () => {
    try {
      const res = await fetch('/api/proxy/transactions', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const body = (await res.json()) as { data?: unknown[] };
      const rows = (body.data ?? []) as Array<Record<string, unknown>>;
      const csv = transactionsToCsv(rows);
      downloadCsv(`moneymind-transactions-${new Date().toISOString().slice(0, 10)}.csv`, csv);
      setToast({ kind: 'ok', message: `Exported ${rows.length} transactions` });
    } catch (err) {
      setToast({
        kind: 'err',
        message: err instanceof Error ? err.message : 'Export failed',
      });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-headline-lg text-on-surface">Settings</h1>
        <p className="text-body-sm text-on-surface-variant mt-1">
          Profile, preferences, and account
        </p>
      </div>

      {/* Profile hero */}
      <Card variant="hero" padding="lg" className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div
            aria-hidden
            className="flex h-16 w-16 flex-none items-center justify-center rounded-full border-2 border-accent-ai/40 bg-accent-ai/15 text-display-lg text-accent-ai font-bold"
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-headline-md text-on-surface">{user?.name ?? 'User'}</h2>
            <p className="truncate text-body-sm text-on-surface-variant">{user?.email}</p>
            {user?.phone && (
              <p className="truncate text-body-sm text-on-surface-variant">{user.phone}</p>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={() => setProfileOpen(true)}>
            Edit
          </Button>
        </div>

        <div className="flex items-center gap-3 rounded-md border border-accent-ai/30 bg-accent-ai/5 px-3 py-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-md border border-accent-ai/30 bg-accent-ai/10">
            <Sparkles size={16} strokeWidth={1.75} className="text-accent-ai" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
              Your archetype
            </p>
            <p className="truncate text-body-md font-bold text-on-surface">
              {archetypeMeta.label}
            </p>
            <p className="text-body-sm text-on-surface-variant">{archetypeMeta.description}</p>
          </div>
        </div>
      </Card>

      {/* Capture modes */}
      <Section title="Capture modes">
        <SettingsRow
          icon={Bot}
          label="Auto-capture"
          hint="Automatically capture from SMS, email, UPI"
          toggle={{
            checked: autoCaptureLocal,
            onChange: setAutoCaptureLocal,
            label: 'Auto-capture',
          }}
        />
        <SettingsRow
          icon={Inbox}
          label="SMS parsing"
          hint="HDFC, ICICI, SBI, Axis, +30 more banks"
          disabled={!autoCaptureLocal}
          toggle={{
            checked: smsParseLocal,
            onChange: setSmsParseLocal,
            label: 'SMS parsing',
          }}
        />
        <SettingsRow
          icon={Mail}
          label="Email parsing"
          hint="Bank statements and invoices"
          disabled={!autoCaptureLocal}
          toggle={{
            checked: emailParseLocal,
            onChange: setEmailParseLocal,
            label: 'Email parsing',
          }}
        />
        <SettingsRow
          icon={Smartphone}
          label="UPI notifications"
          hint="GPay, PhonePe, Paytm"
          disabled={!autoCaptureLocal}
          toggle={{
            checked: upiNotifLocal,
            onChange: setUpiNotifLocal,
            label: 'UPI notifications',
          }}
        />
        <SettingsRow
          icon={Bell}
          label="Send test push"
          hint="Verify push notifications work"
          onClick={handleSendTestPush}
          loading={sendTestPush.isPending}
          rightSlot={<Send size={14} strokeWidth={1.75} className="text-on-surface-variant" />}
        />
      </Section>

      {/* AI features */}
      <Section title="AI features">
        <SettingsRow
          icon={Sparkles}
          label="AI insights"
          hint="Daily nudges and personalised recommendations"
          toggle={{
            checked: aiInsightsLocal,
            onChange: setAiInsightsLocal,
            label: 'AI insights',
          }}
        />
        <SettingsRow
          icon={TagIcon}
          label="Behavioural tagging"
          hint="Late-night, weekend, impulse pattern detection"
          toggle={{
            checked: behavioralTagsLocal,
            onChange: setBehavioralTagsLocal,
            label: 'Behavioural tagging',
          }}
        />
      </Section>

      {/* Notifications */}
      <Section title="Notifications">
        <SettingsRow
          icon={Bell}
          label="Push notifications"
          hint="Bills, alerts, weekly summaries"
          toggle={{
            checked: prefs?.pushEnabled ?? true,
            onChange: (v) => setPref({ pushEnabled: v }),
            label: 'Push notifications',
          }}
          rightSlot={
            unreadQuery.data ? (
              <Badge variant="error" size="sm">
                {unreadQuery.data}
              </Badge>
            ) : undefined
          }
        />
        <SettingsRow
          icon={Mail}
          label="Email notifications"
          hint="Weekly digest by email"
          toggle={{
            checked: prefs?.emailEnabled ?? false,
            onChange: (v) => setPref({ emailEnabled: v }),
            label: 'Email notifications',
          }}
        />
        <SettingsRow
          icon={PieChart}
          label="Budget alerts"
          hint="Notify when 80% of any budget is spent"
          toggle={{
            checked: prefs?.budgetAlerts ?? true,
            onChange: (v) => setPref({ budgetAlerts: v }),
            label: 'Budget alerts',
          }}
        />
        <SettingsRow
          icon={Calendar}
          label="Subscription alerts"
          hint="Subscription renewals and price hikes"
          toggle={{
            checked: prefs?.subscriptionAlerts ?? true,
            onChange: (v) => setPref({ subscriptionAlerts: v }),
            label: 'Subscription alerts',
          }}
        />
        <SettingsRow
          icon={FileText}
          label="Insight nudges"
          hint="Behavioural and pattern-based insights"
          toggle={{
            checked: prefs?.insightAlerts ?? false,
            onChange: (v) => setPref({ insightAlerts: v }),
            label: 'Insight nudges',
          }}
        />
        <SettingsRow
          icon={ShieldCheck}
          label="Security alerts"
          hint="New logins, large or unusual charges"
          toggle={{
            checked: prefs?.securityAlerts ?? true,
            onChange: (v) => setPref({ securityAlerts: v }),
            label: 'Security alerts',
          }}
        />
      </Section>

      {/* Privacy & security */}
      <Section title="Privacy & security">
        <SettingsRow
          icon={Lock}
          label="Change password"
          hint="Sign out of other devices on next sign-in"
          onClick={() => setPasswordOpen(true)}
        />
        <SettingsRow
          icon={Database}
          label="Export data"
          hint="Download your transactions as CSV"
          onClick={exportTransactions}
        />
        <SettingsRow
          icon={ShieldCheck}
          label="Data privacy"
          hint="Your data stays on this device unless we tell you otherwise"
          onClick={() => window.open('https://github.com/ashis1996/money-management-app', '_blank', 'noopener')}
        />
      </Section>

      {/* Support */}
      <Section title="Support">
        <SettingsRow icon={HelpCircle} label="Help center" hint="FAQs and how-tos" disabled />
        <SettingsRow icon={MessageSquare} label="Contact us" hint="hello@moneymind.app" disabled />
        <SettingsRow icon={Star} label="Rate MoneyMind" hint="App store reviews" disabled />
      </Section>

      {/* Danger zone */}
      <div className="flex flex-col gap-2 pt-2">
        <Button
          variant="destructive"
          fullWidth
          leadingIcon={<LogOut size={16} strokeWidth={2} />}
          onClick={() => setLogoutOpen(true)}
        >
          Log out
        </Button>
        <p className="text-center text-label-sm uppercase tracking-wider text-on-surface-variant">
          MoneyMind • web client
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            'fixed bottom-6 right-6 z-toast max-w-sm rounded-md border px-4 py-3 text-body-sm shadow-modal',
            toast.kind === 'ok'
              ? 'border-accent-success/40 bg-accent-success/15 text-accent-success'
              : 'border-accent-error/40 bg-accent-error/15 text-accent-error',
          )}
        >
          {toast.message}
        </div>
      )}

      {/* Profile edit modal */}
      <ProfileEditModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        defaults={{
          name: user?.name ?? '',
          email: user?.email ?? '',
          phone: user?.phone ?? '',
        }}
        isPending={updateProfile.isPending}
        onSubmit={(payload) =>
          updateProfile.mutate(payload, {
            onSuccess: () => {
              setProfileOpen(false);
              setToast({ kind: 'ok', message: 'Profile updated' });
            },
            onError: (err) =>
              setToast({
                kind: 'err',
                message: err instanceof Error ? err.message : 'Could not update profile',
              }),
          })
        }
      />

      {/* Password change modal */}
      <PasswordModal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        isPending={updateProfile.isPending}
        onSubmit={(password) =>
          updateProfile.mutate(
            { password },
            {
              onSuccess: () => {
                setPasswordOpen(false);
                setToast({ kind: 'ok', message: 'Password updated' });
              },
              onError: (err) =>
                setToast({
                  kind: 'err',
                  message: err instanceof Error ? err.message : 'Could not update password',
                }),
            },
          )
        }
      />

      {/* Logout confirm */}
      <Modal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title="Log out?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setLogoutOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setLogoutOpen(false);
                logout().then(() => {
                  if (typeof window !== 'undefined') window.location.href = '/login';
                });
              }}
              leadingIcon={<LogOut size={16} strokeWidth={2} />}
            >
              Log out
            </Button>
          </>
        }
      >
        <p className="text-body-md text-on-surface-variant">
          You&apos;ll need to sign in again on this device.
        </p>
      </Modal>
    </div>
  );
}

// =============================================================
// Layout primitives
// =============================================================
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-label-sm uppercase tracking-wider text-on-surface-variant">{title}</h2>
      <Card padding="none" className="overflow-hidden">
        <ul className="divide-y divide-[var(--border-default)]">{children}</ul>
      </Card>
    </section>
  );
}

interface SettingsRowProps {
  icon: LucideIcon;
  label: string;
  hint?: string;
  toggle?: {
    checked: boolean;
    onChange: (next: boolean) => void;
    label: string;
  };
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  rightSlot?: React.ReactNode;
  destructive?: boolean;
}

function SettingsRow({
  icon: Icon,
  label,
  hint,
  toggle,
  onClick,
  disabled,
  loading,
  rightSlot,
  destructive,
}: SettingsRowProps) {
  const interactive = !!toggle || !!onClick;
  const dim = disabled || loading;

  // The whole row is clickable for non-toggle rows. Toggle rows expose a
  // dedicated switch; the row itself is non-interactive so the SR
  // experience matches the visual one.
  const handleRowClick = () => {
    if (dim) return;
    if (toggle) toggle.onChange(!toggle.checked);
    else onClick?.();
  };

  const baseClass = cn(
    'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-snappy',
    interactive && !dim && 'hover:bg-surface-container-high',
    dim && 'opacity-50 cursor-not-allowed',
    'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-outline',
  );

  const inner = (
    <>
      <span
        aria-hidden
        className={cn(
          'flex h-10 w-10 flex-none items-center justify-center rounded-md border',
          destructive
            ? 'border-accent-error/30 bg-accent-error/10'
            : 'border-[var(--border-default)] bg-surface-container-high',
        )}
      >
        <Icon
          size={18}
          strokeWidth={1.75}
          className={destructive ? 'text-accent-error' : 'text-on-surface-variant'}
        />
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-body-md font-semibold',
            destructive ? 'text-accent-error' : 'text-on-surface',
          )}
        >
          {label}
        </p>
        {hint && <p className="text-body-sm text-on-surface-variant mt-0.5">{hint}</p>}
      </div>
      {rightSlot && <span className="flex-none">{rightSlot}</span>}
      {toggle ? (
        <Toggle
          checked={toggle.checked}
          onChange={toggle.onChange}
          label={toggle.label}
          disabled={dim}
        />
      ) : interactive ? (
        <ChevronRight size={16} strokeWidth={1.75} className="flex-none text-outline" />
      ) : null}
    </>
  );

  return (
    <li className="block">
      {interactive ? (
        <button
          type="button"
          onClick={handleRowClick}
          disabled={dim}
          aria-disabled={dim || undefined}
          className={baseClass}
        >
          {inner}
        </button>
      ) : (
        <div className={baseClass}>{inner}</div>
      )}
    </li>
  );
}

// =============================================================
// Modals
// =============================================================
function ProfileEditModal({
  open,
  onClose,
  defaults,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  defaults: { name: string; email: string; phone: string };
  onSubmit: (payload: { name?: string; email?: string; phone?: string }) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(defaults.name);
  const [email, setEmail] = useState(defaults.email);
  const [phone, setPhone] = useState(defaults.phone);

  // Reset the form whenever the modal is reopened so a stale draft from
  // a previous session doesn't reappear.
  useEffect(() => {
    if (open) {
      setName(defaults.name);
      setEmail(defaults.email);
      setPhone(defaults.phone);
    }
  }, [open, defaults.name, defaults.email, defaults.phone]);

  const dirty = useMemo(
    () =>
      name.trim() !== defaults.name ||
      email.trim() !== defaults.email ||
      phone.trim() !== defaults.phone,
    [name, email, phone, defaults],
  );

  const submit = () => {
    const payload: { name?: string; email?: string; phone?: string } = {};
    if (name.trim() !== defaults.name) payload.name = name.trim();
    if (email.trim() !== defaults.email) payload.email = email.trim();
    if (phone.trim() !== defaults.phone) payload.phone = phone.trim();
    if (Object.keys(payload).length === 0) return;
    onSubmit(payload);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit profile"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!dirty}
            loading={isPending}
            trailingIcon={<ArrowRight size={16} strokeWidth={2} />}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Name"
          leadingIcon={<UserIcon size={16} strokeWidth={1.75} />}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="Email"
          type="email"
          leadingIcon={<Mail size={16} strokeWidth={1.75} />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Phone"
          leadingIcon={<Phone size={16} strokeWidth={1.75} />}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
    </Modal>
  );
}

function PasswordModal({
  open,
  onClose,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (password: string) => void;
  isPending: boolean;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPassword('');
      setConfirm('');
      setError(null);
    }
  }, [open]);

  const submit = () => {
    if (password.length < 8) {
      setError('Use at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    onSubmit(password);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change password"
      description="At least 8 characters. We'll keep you signed in on this device."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={isPending}>
            Update
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="New password"
          type="password"
          leadingIcon={<Lock size={16} strokeWidth={1.75} />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <Input
          label="Confirm new password"
          type="password"
          leadingIcon={<Lock size={16} strokeWidth={1.75} />}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
        {error && <p className="text-body-sm text-accent-error">{error}</p>}
      </div>
    </Modal>
  );
}

// =============================================================
// Helpers
// =============================================================

/**
 * UI-only toggle backed by localStorage. We pull the initial value
 * lazily so SSR/CSR hydration doesn't trip on a value that doesn't
 * exist yet on the server.
 */
function useLocalToggle(key: string, fallback: boolean) {
  const [value, setValue] = useState(fallback);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(key);
    if (raw === '1') setValue(true);
    else if (raw === '0') setValue(false);
  }, [key]);

  const update = (next: boolean) => {
    setValue(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, next ? '1' : '0');
    }
  };

  return [value, update] as const;
}

function transactionsToCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) {
    return 'date,merchant,category,type,amount,description\n';
  }
  const header = 'date,merchant,category,type,amount,description\n';
  const escape = (v: unknown): string => {
    const s = v == null ? '' : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const body = rows
    .map((r) =>
      [
        r.transactionDate ?? r.date ?? '',
        r.merchantName ?? r.merchant ?? '',
        r.categoryId ?? r.category ?? '',
        r.type ?? '',
        r.amount ?? '',
        r.description ?? '',
      ]
        .map(escape)
        .join(','),
    )
    .join('\n');
  return header + body + '\n';
}

function downloadCsv(filename: string, csv: string) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Defer revocation to give the browser time to start the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
