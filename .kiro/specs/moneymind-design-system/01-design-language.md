# 01 — Design Language

## Brand personality

Authoritative yet visionary. MoneyMind positions personal finance as an
intelligent, frictionless journey, not a chore. The interface should feel
like a high-performance instrument: precise, responsive, deceptively simple.

We are *not*:

- Playful or cartoonish (no Mint, no YNAB, no Revolut illustrations)
- Bank-corporate (no Bank of America, no SBI YONO, no HDFC NetBanking)
- Crypto-bro (no neon-on-black "trading desk")

We are closer to:

- **Apple Wallet** — surface restraint, generous padding, financial figures
  treated like jewelry.
- **Linear** — interaction precision, kinetic feedback, dark-mode authority.
- **Tesla App** — luminous depth, instrument-panel data density without clutter.
- **CRED** — premium feel without imitating its specific color language.

## Visual principles

### 1. Reductionist hierarchy

Show one primary thing per screen region. Push secondary information to
collapsible affordances or peripheral chips. Never compete two financial
figures in the same card.

> "If two numbers are competing for the user's eye, one is wrong."

### 2. Luminous depth

Depth is achieved through **tonal layering** (slightly lighter surfaces sit
"closer" to the user) and **backdrop blur** (modals/popovers float on a frosted
sheet over the underlying content). Avoid drop shadows for depth on cards;
rely on a 1px inner border at white/8% instead. Drop shadows are reserved for
modals.

### 3. Kinetic precision

Every transition has weight. No instant pops, no rubber-band overshoots
(except the bottom-sheet drag handle). Targets:

- Card press: 80ms scale to 0.98, 200ms back. Spring damping ~20.
- Sheet open: 320ms cubic-bezier(0.16, 1, 0.3, 1).
- AI orb pulse: 1.2s ease-in-out, infinite.

### 4. AI as a first-class visual citizen

AI-generated content is *visually distinct* from user-entered data:

- A 1px animated gradient stroke (Neon Cyan to Electric Blue, 4s loop).
- Headlines fill with the same cyan-to-blue gradient.
- A small "neural" left-bar (3px wide, full-height) on AI list items.

Users should be able to glance at any screen and immediately tell which parts
are *AI-suggested* vs *fact*.

### 5. Financial figures are sacred

- Always Inter, weight 700, letter-spacing -0.02em or tighter.
- Always tabular-nums (`font-variant-numeric: tabular-nums`) so columns align.
- Always show currency symbol on the same baseline, slightly de-emphasized
  (60% size, 70% opacity).
- Never truncate with an ellipsis. If a number doesn't fit, downscale the type ramp.

## Mood references

| Element | Reference |
|---|---|
| Surface treatment | Apple Wallet card stack |
| Information density | Linear keyboard-driven views |
| Material feel | Tesla in-car UI ambient gradients |
| Type weight on numbers | Stripe Atlas dashboard |
| AI surface treatment | Notion AI inline highlights, Vercel v0 streaming |
| Motion | Things 3 list item drag, Linear modal transitions |

## Anti-patterns

These have come up in fintech designs we want to avoid:

- **Heavy iconography.** Avoid full-color illustrated icons in primary nav.
  Use single-stroke geometric icons at 1.5px stroke.
- **Stock-app red/green.** Don't use saturated stop-light red/green for
  debit/credit. Use Emerald (`#10B981`) for credit and a desaturated coral
  (`#ffb4ab`) for error/debit.
- **Skeuomorphism.** No leather, no paper, no embossing.
- **Decorative gradients on text.** Gradient fills are reserved for AI
  surfaces. Plain financial figures stay solid.
- **Carousels of 8+ cards.** If there are more than ~5 cards, use a list with
  a "see all" affordance.
