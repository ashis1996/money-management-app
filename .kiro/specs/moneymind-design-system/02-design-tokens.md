# 02 — Design Tokens

The canonical, machine-readable source is
[`tokens/tokens.yaml`](./tokens/tokens.yaml). This document explains the
*intent* behind each token group so implementers know when to reach for which.

---

## Color

We layer two systems:

1. **Material 3 surface roles** (`surface`, `surface-container-*`, `on-surface`,
   `outline`, etc.) — for structural UI: backgrounds, dividers, text on
   surfaces. These are dark, near-monochromatic, and consistent.
2. **Brand accents** — for meaning-bearing UI: primary action, AI, success,
   error. These are saturated and used sparingly.

### Surface roles (Material 3)

| Token | Hex | Use |
|---|---|---|
| `surface` | `#0c1322` | Page background |
| `surface-container-lowest` | `#070e1d` | Press-state background, deepest layer |
| `surface-container-low` | `#141b2b` | Slight lift (e.g. nav bar background) |
| `surface-container` | `#191f2f` | Default card background |
| `surface-container-high` | `#232a3a` | Elevated card / hover state |
| `surface-container-highest` | `#2e3545` | Modal background, popover |
| `outline` | `#909096` | Strong divider, focused outline |
| `outline-variant` | `#46464c` | Subtle divider |
| `on-surface` | `#dce2f7` | Primary text |
| `on-surface-variant` | `#c6c6cc` | Secondary text |

Cards sit at `surface-container` with a 1px inner border at `rgba(255,255,255,0.06)`.
Modals sit at `surface-container-highest` with a 30px backdrop blur.

### Brand accents

| Token | Hex | Reserved for |
|---|---|---|
| `accent-primary` | `#3B82F6` | Primary CTAs, primary nav active state, links |
| `accent-ai` | `#22D3EE` | AI-generated content, "smart" features, AI orb |
| `accent-success` | `#10B981` | Credits, gains, completed goals, positive deltas |
| `accent-warning` | `#fbbf24` | Approaching budget limits, soft warnings |
| `accent-error` | `#ffb4ab` | Errors, debits when emphasizing loss, destructive actions |

The Material 3 palette already defines `primary`, `secondary`, `tertiary`
roles (`#c3c6d4`, `#adc6ff`, `#2fd9f4`). Those are kept for **structural**
chrome where they apply (focus rings, M3 components if we ever pull any in),
but **brand accents above are the source of truth for meaning**.

### AI gradient

```
linear-gradient(135deg, #22D3EE 0%, #3B82F6 100%)
```

Used as:
- Border stroke on AI surfaces (animated, 4s loop).
- Text fill on AI insight headlines.
- Glow on the floating AI assistant orb.

### Glass surface formula

```
background: rgba(25, 31, 47, 0.60);   /* surface-container at 60% */
backdrop-filter: blur(30px);
border: 1px solid rgba(255, 255, 255, 0.06);
```

On mobile (RN), backdrop blur uses `expo-blur`'s `BlurView` with `tint="dark"`
and `intensity={40}`.

---

## Typography

**Family:** Inter (OFL, free for both platforms). Fallbacks:
`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.

| Token | Mobile size | Desktop size | Weight | Line-height | Tracking |
|---|---|---|---|---|---|
| `display-xl` | 48px | 64px | 700 | 1.1 | -0.04em |
| `display-lg` | 40px | 48px | 700 | 1.1 | -0.03em |
| `headline-lg` | 28px | 32px | 600 | 1.2 | -0.02em |
| `headline-md` | 22px | 24px | 600 | 1.3 | -0.015em |
| `headline-sm` | 18px | 20px | 600 | 1.4 | -0.01em |
| `body-lg` | 16px | 18px | 400 | 1.6 | 0 |
| `body-md` | 15px | 16px | 400 | 1.6 | 0 |
| `body-sm` | 13px | 14px | 400 | 1.5 | 0 |
| `label-md` | 13px | 14px | 500 | 1 | 0.02em |
| `label-sm` | 11px | 12px | 500 | 1 | 0.04em, **uppercase** |
| `mono-data` | 14px | 14px | 500 | 1 | 0.05em (`tabular-nums`) |

### When to use which

- `display-xl` -> hero balance figures (Total Wealth, Account Balance).
- `headline-lg` -> section titles within a screen.
- `headline-md` -> card titles.
- `body-lg` -> AI insight body copy (intentionally larger for readability).
- `body-md` -> default copy.
- `label-sm` -> metadata, timestamps, "URGENT" / "ACTIVE" badges.
- `mono-data` -> tabular numerics in transaction lists, columnar data.

### AI gradient text

Headlines on AI cards apply the AI gradient as `background-clip: text` (web)
or via `react-native-svg` `LinearGradient` (mobile).

---

## Spacing

Base unit: **4px**. All spacing values are multiples.

| Token | Value | Use |
|---|---|---|
| `space-1` | 4px | Tight in-cluster gaps |
| `space-2` | 8px | Stack between siblings inside a chip/button |
| `space-3` | 12px | Form field row gap |
| `space-4` | 16px | Default content padding (mobile) |
| `space-5` | 20px | Default mobile screen margin |
| `space-6` | 24px | Card internal padding, default desktop gutter |
| `space-8` | 32px | Section gap |
| `space-10` | 40px | Hero block padding-top |
| `space-12` | 48px | Major separators |
| `space-16` | 64px | Desktop screen margin |

### Layout

- **Mobile screen margin:** 20px L/R.
- **Desktop screen margin:** 64px L/R, max content width 1280px.
- **Card internal padding:** 24px on all sides; 20px on mobile if cramped.
- **Cards float:** never edge-to-edge. Min 16px from screen margin.

---

## Radius

| Token | Value | Use |
|---|---|---|
| `radius-sm` | 4px | Inline tags, very small chips |
| `radius-md` | 8px | Buttons, inputs, segmented controls |
| `radius-lg` | 16px | Cards, modal sheets, list rows |
| `radius-xl` | 24px | Hero cards, full-bleed feature cards |
| `radius-full` | 9999px | Status chips, AI orb, avatars |

**Rule:** A card never has a radius smaller than its largest internal control.
A 24px hero card cannot contain a 16px button, only 8px.

---

## Elevation

We avoid box-shadow for depth on cards. Depth comes from:

| Level | Treatment |
|---|---|
| **0 — base** | `surface` (`#0c1322`) |
| **1 — card** | `surface-container` + 1px inner border `rgba(255,255,255,0.06)` |
| **2 — elevated card** | `surface-container-high` + same border |
| **3 — modal/popover** | `surface-container-highest` at 80% opacity, 30px backdrop blur, drop-shadow `0 30px 40px rgba(59,130,246,0.20)` |
| **AI surface** | Any of 1-3 + animated 1px gradient border (`#22D3EE` to `#3B82F6`, 4s loop) |

### Drop shadow recipe (modals only)

```
box-shadow: 0 30px 40px -10px rgba(59, 130, 246, 0.20),
            0 12px 20px -8px rgba(0, 0, 0, 0.50);
```

---

## Border / stroke

| Token | Value | Use |
|---|---|---|
| `border-default` | 1px `rgba(255,255,255,0.06)` | Card inner border |
| `border-subtle` | 1px `outline-variant` (`#46464c`) | List dividers |
| `border-strong` | 1px `outline` (`#909096`) | Focused input borders |
| `border-ai` | 1px AI gradient | AI surfaces (animated) |
| `border-success` | 1px `accent-success` at 30% | Positive emphasis |
| `border-error` | 1px `accent-error` at 50% | Error emphasis |

---

## Motion

| Token | Duration | Easing | Use |
|---|---|---|---|
| `motion-tap` | 80ms / 200ms | spring (damping 20) | Press scale to 0.98 and back |
| `motion-snappy` | 200ms | cubic-bezier(0.4, 0, 0.2, 1) | List item appear, hover state |
| `motion-soft` | 320ms | cubic-bezier(0.16, 1, 0.3, 1) | Sheet/modal open, screen transitions |
| `motion-ambient` | 1.2s | ease-in-out, infinite | AI orb pulse, neural particles |
| `motion-stroke` | 4s | linear, infinite | AI gradient border rotation |

Reduced-motion: all `infinite` loops collapse to a static state. `motion-tap`
becomes opacity 0.7 instead of scale.
