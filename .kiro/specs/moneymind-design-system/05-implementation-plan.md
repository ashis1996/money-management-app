# 05 — Implementation Plan

A phased rollout that takes us from the current state (light-themed mobile,
no web app) to a fully shipped MoneyMind across both platforms.

## Sequencing

```
Phase 0: Land tokens + scaffolds  --------> (this PR's follow-ups)
Phase 1: Mobile blocker fixes (already in-progress branch)
Phase 2: Mobile theme migration to MoneyMind tokens
Phase 3: Mobile component refresh (Button, Card, Input, Badge, Header, Charts)
Phase 4: Mobile screen refresh (Home, Transactions, Subscriptions, AI Coach first)
Phase 5: Web app scaffold (Next.js 14 + Tailwind preset + shared tokens)
Phase 6: Web auth + dashboard + transactions
Phase 7: Web subscriptions + insights + health + leaks + AI coach
Phase 8: Web settings + notifications + goals + budgets
Phase 9: Polish pass — motion, empty states, skeletons, accessibility audit
```

Phases 1, 2, 3, 5 can run in parallel once tokens are landed. Screens (4, 6,
7, 8) depend on their respective component libraries.

---

## Phase 0 — Land tokens + scaffolds (this spec)

**Deliverable:** this PR.

Files added:
- `.kiro/specs/moneymind-design-system/*.md`
- `.kiro/specs/moneymind-design-system/tokens/tokens.yaml`
- `.kiro/specs/moneymind-design-system/tokens/theme.mobile.ts`
- `.kiro/specs/moneymind-design-system/tokens/theme.web.css`
- `.kiro/specs/moneymind-design-system/tokens/tailwind.preset.js`

These scaffolds are the **reference implementation** of the tokens. Mobile
and Web each copy/import them in subsequent phases.

---

## Phase 1 — Mobile blocker fixes

Branch: `fix/mobile-blockers-and-quality` (already started, paused for this spec).

Scope (does not depend on this design spec):
- Fix `package.json` `main` and add `index.js` with `registerRootComponent`.
- Strip missing-asset references from `app.json`.
- Add `babel-plugin-module-resolver` so `@/*` aliases work.
- Drop unused Redux dependencies.
- Tighten `services/api.ts` types and serialize the refresh-token race.
- Standardize the API base URL resolution.
- Add `ErrorBoundary` and basic `utils/format` helpers.

Ships independently. Does not change visual design.

---

## Phase 2 — Mobile theme migration

Branch: `feat/mobile-theme-moneymind`.

1. Replace `mobile/src/styles/theme.ts` with values from
   `tokens/theme.mobile.ts`.
2. Add Inter font loading via `expo-font` in `App.tsx`.
3. Add a `<ThemeProvider>` (lightweight context) that exposes tokens to
   styled-components-style consumers, even if we keep `StyleSheet.create`.
4. Add `BlurView` glass primitive (`expo-blur`).
5. Update `App.tsx` to set `expo-status-bar` to `light` and the system UI
   background to `surface`.

Acceptance: every existing screen renders without color contrast regressions
on a dark background. Functional parity, not redesign.

---

## Phase 3 — Mobile component refresh

Branch: `feat/mobile-components-moneymind`.

Refresh in this order (each is reviewable on its own):

1. `Button` — variants (primary, secondary, ai, ghost, destructive).
2. `Card` — default, glass, hero, ai variants.
3. `Input` — focus glow, leading/trailing slots, error state.
4. `Badge` — status palette.
5. `ProgressRing` / `ProgressBar` — restyled with leading-edge glow.
6. `Header` — for screen-level chrome.
7. New: `AiOrb` — the floating assistant orb.
8. New: `Skeleton` — shimmer primitive.
9. New: `EmptyState` — mascot variant.

Each PR includes a "Storybook"-style demo screen at `mobile/src/screens/_dev/`
gated behind a debug flag.

---

## Phase 4 — Mobile screen refresh

Order, picked for risk (start with the most visible, redesign the AI Coach
last since it depends on the orb):

1. **Home / Dashboard** — full redesign with archetype-driven widget order.
2. **Transactions** — search, chips, grouped list, swipe actions.
3. **Subscriptions** — grid, AI savings card, timeline.
4. **Insights** — AI hero, donut, line, recommendations.
5. **Health Score, Money Leaks** — hero ring + factor list.
6. **Goals, Budgets** — animated progress, templates.
7. **Notifications** — sectioned list, unread bar.
8. **Settings** — sectioned account management.
9. **Auth + Onboarding** — radial gradient hero, AI orb intro.
10. **AI Coach** — orb hero, streamed responses, action buttons.

Each screen ships behind a feature flag (`enableMoneyMindUI`) until the suite
is complete, so partial rollout doesn't expose mismatched screens.

---

## Phase 5 — Web scaffold

Branch: `feat/web-app-scaffold`.

```
web/
  app/                       # Next.js App Router
    (auth)/login/page.tsx
    (auth)/register/page.tsx
    (app)/layout.tsx         # sidebar + topbar shell
    (app)/dashboard/page.tsx
    (app)/transactions/page.tsx
    ...
  components/
    ui/                      # primitives (Button, Card, Input, Badge, ...)
    layout/                  # Sidebar, Topbar, AppShell
    charts/                  # Recharts wrappers with token-aware styles
  lib/
    api.ts                   # mirror of mobile/src/services/api.ts
    queryKeys.ts             # mirror of mobile/src/hooks/queryKeys.ts
    auth/                    # cookie-based session helpers
  hooks/                     # useTransactions, useDashboard, ...
  store/
    auth.ts                  # zustand store, web equivalent (cookie-backed)
  styles/
    globals.css              # imports tokens/theme.web.css
  tailwind.config.ts         # extends tokens/tailwind.preset.js
```

Stack:
- Next.js 14 App Router
- TypeScript strict
- Tailwind CSS + the preset from this spec
- React Query
- Zustand (auth store)
- Lucide icons
- Recharts for charts
- Framer Motion for transitions
- next-themes only if Phase v2 introduces light mode

Auth: HTTP-only cookies set by an internal Route Handler that proxies to the
NestJS `/auth/login`. The browser never sees the JWT, only a session cookie.

---

## Phase 6-8 — Web screens

Per-phase scope is small enough that each PR covers ~2-4 screens. The screen
list mirrors `04-screens.md` adapted for desktop layouts (sidebar + topbar +
content column).

---

## Phase 9 — Polish

- Motion audit: confirm every interactive surface uses the right motion token.
- Skeletons everywhere data loads.
- Empty states everywhere a list could be empty.
- Reduced-motion variants verified.
- Accessibility:
  - 4.5:1 contrast on all text.
  - All interactive controls have labels.
  - Keyboard navigation on web.
  - Screen reader pass on mobile.
- Performance: bundle size budget, mobile JS thread profile, web LCP.

---

## Open dependencies / unknowns

- **Animated AI gradient stroke on mobile.** RN doesn't support animated
  conic gradients natively. Plan: use `react-native-svg` with a rotating
  `LinearGradient` clipped to a stroke-only path. Build a small POC in Phase 3
  before committing every AI surface to it.
- **Inter on Android.** Make sure we ship Inter via `expo-font`; Android does
  not have it preinstalled. iOS will fall back to SF gracefully.
- **Backdrop blur on Android.** `expo-blur` quality varies. We may need a
  fallback that uses a darker semi-opaque background with no blur on
  older Android; verify on a Pixel 4a baseline in Phase 2.
- **Web cookie auth vs. localStorage tokens.** Recommendation is cookies for
  XSS safety; needs a tiny backend route added (`/auth/web/login`) that wraps
  the existing `/auth/login`. Confirm before Phase 5.
