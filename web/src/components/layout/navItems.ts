import {
  Home,
  CreditCard,
  Repeat,
  BarChart3,
  Sparkles,
  Settings,
  Building,
  Target,
  PieChart,
  Bell,
  Activity,
  Droplet,
  CalendarRange,
  type LucideIcon,
} from 'lucide-react';

/**
 * Single source of truth for the in-app navigation. Both the desktop
 * `Sidebar` and the responsive `MobileNav` drawer iterate over this
 * structure so the two surfaces can never drift.
 *
 * Items are grouped (Overview / Money / You) to keep the 12-row rail
 * scannable; the spec asked for grouped sections once the surface grew
 * past ~6 items.
 *
 * `badgeKey` is a string handle that the consumer can interpret to
 * fetch a live counter (today only `notifications`). Embedding the
 * value here would force the nav config into a hook context, which
 * isn't safe to do at module scope.
 */
export type NavBadgeKey = 'notifications';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badgeKey?: NavBadgeKey;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: Home },
      { href: '/insights', label: 'Insights', icon: BarChart3 },
      { href: '/weekly-summary', label: 'Weekly summary', icon: CalendarRange },
    ],
  },
  {
    label: 'Money',
    items: [
      { href: '/transactions', label: 'Transactions', icon: CreditCard },
      { href: '/accounts', label: 'Accounts', icon: Building },
      { href: '/budgets', label: 'Budgets', icon: PieChart },
      { href: '/goals', label: 'Goals', icon: Target },
      { href: '/subscriptions', label: 'Subscriptions', icon: Repeat },
      { href: '/money-leaks', label: 'Money leaks', icon: Droplet },
    ],
  },
  {
    label: 'You',
    items: [
      { href: '/health-score', label: 'Health score', icon: Activity },
      { href: '/ai-coach', label: 'AI Coach', icon: Sparkles },
      { href: '/notifications', label: 'Notifications', icon: Bell, badgeKey: 'notifications' },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

/**
 * Match logic shared between the desktop and mobile lists so the
 * "active" highlight is identical. Treats nested routes (`/transactions/123`)
 * as still belonging to the parent (`/transactions`).
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/');
}
