# 03 — Components

This document specifies the *visual contract* for each foundational component.
Public API (props, slots) is decided when each component ships; this spec
covers look, states, and behavior.

---

## Button

### Variants

| Variant | Background | Text | Border |
|---|---|---|---|
| `primary` | `accent-primary` (`#3B82F6`) | White | inset 1px `rgba(255,255,255,0.16)` |
| `secondary` | `surface-container-high` at 60% + 30px blur | `on-surface` | 1px `rgba(255,255,255,0.10)` |
| `ai` | `surface-container` | gradient text (cyan to blue) | animated AI gradient |
| `ghost` | transparent | `on-surface` | none |
| `destructive` | `accent-error` at 16% | `accent-error` | 1px `accent-error` at 40% |

### Sizes

| Size | Height | Padding-x | Type |
|---|---|---|---|
| `sm` | 32px | 12px | `label-md` |
| `md` | 44px | 20px | `label-md` |
| `lg` | 52px | 24px | `body-md` weight 600 |

Always 8px radius. Always tabular-nums on any number inside.

### States

- **Hover (web):** brightness +6%.
- **Press:** scale to 0.98 over 80ms; snap back over 200ms.
- **Focus-visible:** 2px outline at `outline` (`#909096`) with 2px offset.
- **Disabled:** 40% opacity, no press feedback, cursor `not-allowed`.
- **Loading:** content swapped for 16px spinner; width preserved (no jump).

---

## Card

### Default card

```
background: surface-container (#191f2f)
border: 1px solid rgba(255, 255, 255, 0.06)
border-radius: 16px
padding: 24px (20px on mobile if space is tight)
```

Subtle 2% noise overlay simulates premium material. On web this is a CSS
`background-image` data-URL noise; on mobile it's an `Image` with
`resizeMode="repeat"` at 2% opacity layered behind content.

### Glass card (modals, popovers, AI hero)

```
background: rgba(25, 31, 47, 0.60)
backdrop-filter: blur(30px)
border: 1px solid rgba(255, 255, 255, 0.08)
border-radius: 16px
```

### Hero card (Total Wealth, Health Score)

- 24px radius.
- Background: a vertical gradient from `surface-container-high` to
  `surface-container`.
- Optional ambient halo: a 600px radial gradient at 8% opacity of
  `accent-primary` positioned top-right, blurred 80px, behind content.
- Padding 32px.

### AI card

- Default card +
- 1px stroke that animates through the AI gradient, 4s loop.
- Headline uses gradient text fill.
- Optional 3px-wide cyan "neural bar" on the leading edge for list items.

---

## Input

```
background: surface-container-lowest (#070e1d)
border: 1px solid rgba(255, 255, 255, 0.06)
height: 48px
radius: 8px
padding-x: 16px
type: body-md
placeholder: on-surface-variant at 70%
```

### Focus state

```
border: 1px solid accent-ai (#22D3EE)
box-shadow: 0 0 0 4px rgba(34, 211, 238, 0.15)
```

The cyan focus glow is unique and instantly readable as "this is interactive."

### Sizes & decorations

- Leading icon (e.g. magnifier): 20px, `on-surface-variant`, 12px gap to text.
- Trailing affordance (clear button, voice icon): 32x32 hit area.
- Helper text: `body-sm`, `on-surface-variant`, 6px below input.
- Error: border `accent-error`, helper text `accent-error`.

---

## Status chip / Badge

Pill-shaped (full radius). Heights 22px (compact) or 28px (default).

| Status | Background | Text |
|---|---|---|
| `active` | `accent-success` at 16% | `accent-success` |
| `pending` | `accent-warning` at 16% | `accent-warning` |
| `paused` | `outline-variant` at 30% | `on-surface-variant` |
| `cancelled` | `accent-error` at 16% | `accent-error` |
| `ai` | gradient (cyan to blue) at 16% | gradient text |
| `urgent` | `accent-error` at 24% | `accent-error`, **uppercase** `label-sm` |

---

## List row

```
height: 64px (default), 72px with description
padding-x: 20px on mobile, 24px on desktop
```

Layout (left to right):

```
[ leading visual 40x40 ]  [ stack: title (body-md) + meta (body-sm muted) ]  [ trailing: amount (mono-data, semibold) + caption ]
```

Divider between rows: 1px `outline-variant` at 30% opacity, indented to align
with the title (skip the leading visual width).

Swipe actions (mobile): reveal at 24px width per action; first action is
destructive-coral, second is neutral.

---

## Bottom navigation (mobile)

```
height: 76px + safe area
background: surface-container-low at 80% + 40px backdrop blur
border-top: 1px outline-variant at 40%
```

5 tabs: Home, Transactions, Subscriptions, Insights, Settings. Active tab gets
`accent-primary` icon and label; inactive gets `on-surface-variant`.

A floating **AI Assistant orb** (56x56, full radius) sits centered above the
nav bar at -28px:

- Background: AI gradient.
- Soft outer glow: 32px blur, 60% opacity of `accent-ai`.
- Pulse animation: 1.2s ease-in-out scale 1 -> 1.04, infinite.
- Inner: chat-bubble glyph 24px, white.

---

## Sidebar (web)

```
width: 240px (collapsed: 72px)
background: surface-container-low
border-right: 1px outline-variant
padding: 24px 12px
```

Logo at top, 24px gap, then nav items. Active nav item:

- 8px radius pill background at `surface-container-high`.
- 3px leading bar in `accent-primary`.
- Icon + label both at `accent-primary`.

Bottom of sidebar: user pill (avatar, name, email, hover-revealed menu).

---

## Topbar (web)

```
height: 64px
background: surface-container-low at 70% + 24px backdrop blur (sticky)
border-bottom: 1px outline-variant
```

Contents: page title (`headline-md`) on the left; AI search bar (max-w 480px,
height 40px) center; notifications + avatar on the right.

---

## AI Assistant orb (mobile + web)

The crown jewel. A persistent floating orb that opens the AI Coach.

- 56x56 circle.
- Inner gradient: AI gradient at 80% (cyan top-left to blue bottom-right).
- Outer glow: 40px blur, 80% `accent-ai`.
- 1px stroke at white/20%.
- Pulse: scales 1.00 -> 1.04 over 1.2s ease-in-out, infinite.
- Tap: orb scales to 0.92 with a 80ms damped spring; opens the AI Coach
  bottom sheet (mobile) or right rail (web).

When the AI is "thinking" (a request is in flight), the orb's stroke rotates
the AI gradient at 4s, and a second concentric ring expands and fades.

---

## Charts

All charts are dark-on-dark. Lines are 2px. Areas under lines use a vertical
gradient from the line color to transparent.

| Chart | Library (web) | Library (mobile) |
|---|---|---|
| Line / area | Recharts or Visx | `react-native-svg` + custom path |
| Donut | Recharts | `react-native-svg` |
| Bar | Recharts | `react-native-svg` |

### Conventions

- **Income line:** `accent-success`. Area: success to transparent.
- **Expense line:** `accent-error`. Area: error to transparent.
- **Forecast (AI projection):** dashed 2px `accent-ai` line. Area: cyan at 12% to transparent.
- **Axis labels:** `label-sm`, `on-surface-variant`.
- **Gridlines:** 1px `outline-variant` at 30% opacity, dashed.
- **Tooltip:** glass card, `body-sm`.

---

## Progress (rings & bars)

### Ring

- Stroke width 8px (large hero ring) or 4px (inline ring).
- Track: `outline-variant` at 40%.
- Indicator: `accent-success` for goals/budgets; `accent-primary` for neutral
  progress; AI gradient for AI-generated progress.
- Center label: large number with `display-lg`/`headline-lg`, label below.

### Bar

- 4px height, fully rounded.
- Track: `outline-variant` at 40%.
- Indicator: same color logic as ring.
- Leading edge has a 16px-wide white-at-20% glow that slides in on first paint.

---

## Skeletons

When data is loading, render a skeleton shaped like the final content.

```
background: linear-gradient(90deg,
  surface-container 0%,
  surface-container-high 50%,
  surface-container 100%);
background-size: 200% 100%;
animation: shimmer 1.4s linear infinite;
```

Skeletons radius matches the final element. Skeletons must not appear for less
than 200ms (to avoid flash).

---

## Empty states

Required for every list. Components:

- 96x96 line illustration (single-stroke, `outline` color).
- `headline-md` heading.
- `body-md` description, max 2 lines, `on-surface-variant`.
- A primary CTA.

Never show a blank screen. The AI mascot (a small geometric orb) appears in
empty states for AI surfaces.

---

## Icons

- Single-stroke geometric icons (Lucide for web; `@expo/vector-icons` Feather
  set for mobile).
- 1.5px stroke at 24px size.
- 20px size for inline / metadata.
- Color: `on-surface-variant` by default, `accent-primary` when active.
