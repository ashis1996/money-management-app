'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, Search, LogOut, User as UserIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';

/**
 * Sticky top bar. Frosted-glass background so content scrolls behind it.
 *
 * Contents:
 *   - Search (display-only in Phase 5; wired in Phase 6+)
 *   - Notifications bell (placeholder badge)
 *   - User chip with logout menu
 */
export function Topbar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Click-outside to close the user menu. Standard pattern; cheaper
  // than pulling in a popover lib for one menu.
  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <header
      className="sticky top-0 z-sticky w-full border-b border-outline-variant
                 bg-surface-container-low/70 backdrop-blur-topbar"
    >
      <div className="flex h-16 items-center gap-4 px-5 lg:px-8">
        <div className="hidden md:flex flex-1 max-w-[480px]">
          <div className="flex h-10 w-full items-center gap-2 rounded-md border border-[var(--border-default)] bg-surface-container-lowest px-3">
            <Search
              size={16}
              strokeWidth={1.75}
              className="text-on-surface-variant"
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="Search transactions, merchants, categories…"
              aria-label="Search"
              disabled
              className="w-full bg-transparent text-body-sm placeholder:text-outline focus:outline-none disabled:cursor-not-allowed"
            />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            aria-label="Notifications"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--border-default)] bg-surface-container hover:bg-surface-container-high transition-colors"
          >
            <Bell
              size={18}
              strokeWidth={1.75}
              className="text-on-surface-variant"
              aria-hidden="true"
            />
            {/* Badge indicator — wired with real unread count in Phase 6+ */}
            <span
              className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent-error"
              aria-hidden="true"
            />
          </button>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex h-10 items-center gap-2 rounded-md border border-[var(--border-default)] bg-surface-container px-2 pr-3 hover:bg-surface-container-high transition-colors"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent-primary/20 text-accent-primary">
                <UserIcon size={14} strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="hidden md:block text-body-sm text-on-surface max-w-[140px] truncate">
                {user?.name || user?.email || 'Account'}
              </span>
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-12 w-56 rounded-lg border border-[var(--border-default)] bg-surface-container-highest shadow-modal p-1"
              >
                <div className="px-3 py-2 text-label-sm text-on-surface-variant border-b border-outline-variant/40">
                  {user?.email}
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-body-sm text-accent-error hover:bg-accent-error/10 transition-colors"
                >
                  <LogOut size={14} strokeWidth={2} aria-hidden="true" />
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
