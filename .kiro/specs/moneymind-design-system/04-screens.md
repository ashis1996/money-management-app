# 04 — Screen-Level Guidance

> **Status:** Exploratory. The screen ingredients in the original brief are
> *guidance*, not a binding screen list. The product already has its own
> domain (Health Score, Money Leaks, Action Cards, Subscriptions, Weekly
> Summary, AI Coach) — these notes adapt the design language to that
> domain rather than reproducing the brief literally.

This file is intentionally short. Per-screen decisions belong in the screen's
own ticket; what *must* stay consistent is the language and components above.

---

## Home / Dashboard

**Goal:** the user instantly understands "how am I doing?" and "what should
I do next?".

Hero stack (top to bottom on mobile; left column on desktop):

1. **Greeting strip.** Time-of-day greeting + AI peer-comparison subline
   (e.g. *"Healthier than 82% of users this month"*). AI gradient text on
   the comparison line only.
2. **Total Wealth hero card** (`display-xl` figure, currency suffix
   small, animated count-up on first paint, breakdown chips below).
3. **Health Score card** with hero ring + factor rows pulled from
   `health.factors` (do not hardcode rows).

Below the hero, a personalized **widget grid**. Order driven by archetype
(see `mobile/src/utils/archetype.ts` once landed):

- `SPEND_HEAVY` -> Money Leaks -> Health -> Action Cards -> Spending Insights
- `SAVINGS_FOCUSED` -> Goals -> Health -> Spending -> Forecast -> Action Cards
- `CREDIT_USER` -> Upcoming Payments -> Health -> Spending -> Leaks -> Action Cards
- `SUBSCRIPTION_HEAVY` -> Subscriptions -> Leaks -> Action Cards -> Health
- `BALANCED` -> Health -> Spending -> Goals -> Action Cards -> Leaks -> Subscriptions

Below the grid: Recent Transactions list (5 rows) + "View all" link.

Loading: skeletons matching the hero, ring, and 3 widget cards.
Errors: if all queries fail, show a single full-screen error state with retry.
Partial errors: each widget shows its own inline error with a tiny retry icon.

---

## Transactions

- Smart search bar at top (with voice icon on mobile).
- Horizontal category chip rail (scrollable).
- Mini analytics strip showing month-to-date spend / savings.
- Grouped list (date headers): merchant logo, name, category, amount.
- Swipe (mobile) / hover-reveal (web) actions: edit, delete, recategorize.
- AI nudge card surfaces only when `uncategorizedCount > 0`.

---

## Subscriptions

- Overview card: active count, monthly cost, yearly cost.
- Subscription grid (cards 2-up on mobile, 3- or 4-up on desktop).
- Card: logo, name, amount, frequency badge, next-billing relative date.
- Inline AI savings card highlights unused / duplicate / price-increase risks.
- Vertical timeline of upcoming renewals (Today / Tomorrow / This week / Later).

---

## Insights

- AI summary hero card (gradient text on headline).
- Donut: spending by category. Drill-down on tap.
- 6-month line chart: income, expense, savings.
- Top-merchants ranked list.
- AI recommendations stack with priority chip.
- Forecast widget (AI surface).

---

## Health Score (dedicated)

- Large hero ring (200x200).
- Factor breakdown list — driven by `health.factors` from the API.
- Recommendations list (AI surface).
- Score history sparkline.

---

## Money Leaks

- Hero stat: potential monthly savings (`display-xl`).
- List of detected leaks with type chip, monthly impact, and a primary action
  ("Cancel", "Reduce", "Move to savings").

---

## Goals

- Goal cards with animated liquid-fill progress.
- Tap -> goal detail with contribution timeline + AI completion forecast.
- Empty state offers templates (Emergency, Car, House, Travel, Education).

---

## Budgets

- Monthly summary: budget total, spent, remaining.
- Per-category rings.
- AI budget health note (AI surface).

---

## Notifications

- Sectioned by type (Transactions, Subscriptions, AI Alerts, Security, Goals).
- Unread items have a 3px leading bar at `accent-primary`.
- Each notification has an inline action when applicable.

---

## AI Financial Coach (the crown)

- Hero: animated AI orb (centered, 120px on mobile, 200px on desktop).
- Input bar with sample-question chips below.
- Streamed response area; AI surfaces for generated widgets (charts, action
  buttons, forecasts).
- One-tap action buttons in responses ("Create Budget", "Pause Spotify").

---

## Settings

- Profile header card.
- Sectioned: Account, Preferences, AI Preferences, Support.
- Logout is a destructive button at the bottom; confirmation modal before exit.

---

## Auth (Login / Register / Onboarding)

- Full-bleed hero gradient (`surface` -> `surface-container-low` with a 600px
  radial cyan glow).
- Card-style form on top, max-w 400px on web; full-width on mobile.
- Onboarding uses 3 paged screens with the AI orb introducing itself, then
  permission requests (notifications, SMS read on Android).
