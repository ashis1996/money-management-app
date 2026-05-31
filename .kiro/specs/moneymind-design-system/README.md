# MoneyMind Design System — Spec

**Status:** Draft for review
**Scope:** Mobile (React Native / Expo) + Web (Next.js)
**Owner:** Design + Frontend
**Supersedes:** `mobile/src/styles/theme.ts` (current light theme will be replaced)

---

## Why this spec

The current mobile theme is a generic light palette. We want MoneyMind to feel
premium, AI-first, and trustworthy — closer to **Apple Wallet x Revolut x CRED x
Linear x Tesla App** than to a generic fintech tracker.

This spec defines the design language once so it can be applied consistently to
both the mobile app and the new web app without drift.

## Documents

| File | Purpose |
|---|---|
| [`01-design-language.md`](./01-design-language.md) | Brand voice, visual principles, mood |
| [`02-design-tokens.md`](./02-design-tokens.md) | Color, type, spacing, radius, elevation tokens |
| [`03-components.md`](./03-components.md) | Buttons, cards, inputs, charts, AI surfaces |
| [`04-screens.md`](./04-screens.md) | Screen-level guidance (exploratory, not binding) |
| [`05-implementation-plan.md`](./05-implementation-plan.md) | Rollout plan across mobile + web |
| [`tokens/tokens.yaml`](./tokens/tokens.yaml) | Canonical token source (machine-readable) |
| [`tokens/theme.mobile.ts`](./tokens/theme.mobile.ts) | RN theme scaffold |
| [`tokens/theme.web.css`](./tokens/theme.web.css) | CSS custom properties scaffold |
| [`tokens/tailwind.preset.js`](./tokens/tailwind.preset.js) | Tailwind preset scaffold |

## TL;DR

- **Vibe:** Futuristic minimalism with glassmorphism. Dark, obsidian foundation.
  Generous whitespace. Reductionist hierarchy.
- **Surface palette:** Material 3 dark roles anchored on `#0c1322`.
- **Brand accents:** Electric Blue (`#3B82F6`) for primary CTAs, Neon Cyan
  (`#22D3EE`) reserved for AI-augmented surfaces, Emerald (`#10B981`) for gains.
- **Type:** Inter at every level. Tight tracking on financial figures. AI
  insight headlines use a cyan-to-blue gradient fill.
- **Shape:** `rounded-lg` (16px) for cards, `rounded-md` (8px) for controls,
  full pill for status chips.
- **Depth:** Tonal layering + backdrop blur. AI surfaces get an animated 1px
  cyan-to-blue gradient stroke.
- **Motion:** Weighted, dampened transitions. Reanimated on mobile, Framer
  Motion on web.

## What this spec is **not**

- A pixel-perfect Figma export. The screen ingredients in
  [`04-screens.md`](./04-screens.md) are guidance — the team adapts them to the
  product's real data and flows.
- A binding component library API. Component contracts are defined when each
  component is built; this spec defines look, feel, and behavior.

## Review questions

Before we start implementing, these are the open calls we want a sign-off on:

1. **Light mode?** This spec is dark-first. Do we ship a light variant in v1
   or punt to v2? (Recommendation: dark-only v1, light in v2.)
2. **Currency / locale.** INR / `en-IN` is the default. Confirm.
3. **Typography license.** Inter is OFL — fine for both apps. Confirm we don't
   want SF Pro Display (Apple-licensed, mobile-only).
4. **Web framework.** Next.js 14 App Router + Tailwind + shadcn-style
   primitives is the assumption. Confirm.
5. **Component governance.** Co-locate web components with mobile components in
   a `packages/ui` workspace, or keep them separate per platform? (Recommendation:
   separate — shared *tokens*, separate *components*, since RN and web rendering
   models diverge sharply.)
