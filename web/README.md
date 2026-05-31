# MoneyMind Web

The web companion to the MoneyMind mobile app. Same domain, same backend, same design tokens — different surface.

## Stack

- **Next.js 14** (App Router) with TypeScript strict mode
- **Tailwind CSS** + a hand-rolled preset that consumes the design-system tokens
- **React Query 5** for data caching
- **Zustand** for the auth store
- **Lucide** icons
- **Inter** via `next/font/google`

## Local development

```bash
# from the repository root
npm install --workspaces --include-workspace-root
cp web/.env.example web/.env.local

# point INTERNAL_API_URL at a running NestJS backend
# (the dev backend listens on http://localhost:3000/api/v1 by default)

# start the web app on port 3001
npm run dev:web
```

The browser hits `http://localhost:3001`. All client API calls go through `/api/proxy/*` which runs in the Next.js server and forwards to the backend with a Bearer token from an httpOnly cookie. The browser never sees the JWT directly.

## Architecture at a glance

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # unauthenticated shell (login, register)
│   ├── (app)/                    # authenticated shell (14 routes)
│   ├── api/
│   │   ├── auth/{login,register,logout,me}/route.ts
│   │   └── proxy/[...path]/route.ts   # auth-injecting proxy to NestJS
│   ├── globals.css               # design tokens (CSS variables)
│   ├── layout.tsx                # root layout (Inter font, providers)
│   └── providers.tsx             # React Query + auth bootstrap
├── components/
│   ├── ui/                       # Button, Card, Input, Badge, Modal, Toggle, ProgressRing, ...
│   ├── layout/                   # AppShell, Sidebar, Topbar, AuthShell, BackgroundGlow, MobileNav
│   └── ai/                       # AiOrb (and future AI surfaces)
├── hooks/                        # React Query hooks (one per domain)
├── lib/
│   ├── api.ts                    # browser → /api/proxy
│   ├── api-server.ts             # server → backend (cookies + bearer)
│   ├── auth/cookies.ts           # set/clear/read mm_at + mm_rt
│   ├── env.ts                    # ServerEnv / PublicEnv
│   ├── format.ts                 # currency / date / greeting (mirror mobile)
│   ├── archetype.ts              # widget-order logic (mirror mobile)
│   └── categories.ts             # category vocabulary (mirror mobile)
├── store/auth.ts                 # zustand store (user, login, logout, bootstrap)
├── types/index.ts                # domain types (mirror mobile)
└── middleware.ts                 # gate (app)/* routes on cookie presence
```

### Routes

Authenticated shell (`(app)/`):

| Route | Purpose |
|---|---|
| `/dashboard` | Hero stats, archetype, health score, action cards |
| `/transactions` (+ `[id]`, `/new`) | List, detail, create |
| `/accounts` | Net worth, link / sync / set-primary |
| `/budgets` | Per-category cards with progress |
| `/goals` | Per-goal ring, contribute, target dates |
| `/subscriptions` | Active list, leak hints, cancel walkthrough |
| `/calendar` | Upcoming subscription renewals grouped by week |
| `/insights` | Period analytics, top categories / merchants |
| `/health-score` | Score breakdown + recommendations |
| `/money-leaks` | AI-detected leaks with monthly savings impact |
| `/notifications` | Bucketed inbox with mark-read / delete |
| `/weekly-summary` | AI summary + behavioural patterns + 8-week history |
| `/ai-coach` | Conversational AI assistant |
| `/settings` | Profile, capture modes, preferences, export |

Unauthenticated (`(auth)/`): `/login`, `/register`.

### Auth flow

1. User submits the login form → `POST /api/auth/login`.
2. Route handler calls NestJS `POST /auth/login` server-side.
3. On success, sets `mm_at` (15m) and `mm_rt` (7d) httpOnly cookies; returns the user JSON.
4. Client stores `user` in the Zustand store; the browser never sees the JWT.
5. Client API calls go to `/api/proxy/*` → reads cookie → forwards with `Authorization: Bearer …`.
6. On 401 the proxy attempts a single `/auth/refresh` round-trip, sets new cookies, and retries the original request.
7. Logout: `POST /api/auth/logout` calls backend logout (best-effort) and clears cookies.

Middleware gates every route under `(app)/` on cookie presence and bounces unauthenticated visitors to `/login?next=…`.

## Responsive nav

Below `lg` (1024px) the persistent `Sidebar` is hidden and a slide-in `MobileNav` drawer takes over. The hamburger trigger lives in the `Topbar`. Both nav surfaces iterate over `components/layout/navItems.ts` so they can never drift.

## Design tokens

`src/app/globals.css` defines the MoneyMind dark palette as CSS custom properties. `tailwind.preset.js` exposes them as Tailwind utilities (e.g. `bg-surface-container`, `text-on-surface`, `border-accent-ai`). Both are 1:1 mirrors of `.kiro/specs/moneymind-design-system/tokens/`.

When the spec changes, update the spec first; sync the runtime mirrors in the same PR.

## Verification commands

```bash
# from the web/ workspace
npx tsc --noEmit          # type check
npx next lint             # lint
npx next build            # production build (catches server/client boundary issues)
```
