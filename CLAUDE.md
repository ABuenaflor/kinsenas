# CLAUDE.md — Kinsenas: Payday Budget Tracker

> Project context for Claude Code. Put this file at the repo root. Treat it as the product spec and the source of truth for architecture, calculations, and design. If a request conflicts with this file, ask before deviating, and update this file when a decision changes.

"Kinsenas" is a working name (Filipino slang for the semi-monthly paycheck). Rename freely.

## 0. Implementation notes (decisions made while building v1)

- Installed majors are newer than when this spec was written: Vite 8, Motion 13, Zod 4, Recharts 3, Tailwind 4, ESLint 9. React Router is pinned to **v7** as specified. TypeScript is **6.0** (not 7): typescript-eslint doesn't support the TS 7 native compiler yet.
- `@/` path alias → `src/`.
- Lenis smooth scroll is wired but off by default.
- Hand-built primitives only; no Radix was needed.
- **Edit vs Re-apply (§12.1):** each saved cutoff stores a `basis` (rates, gov settings, applicable custom deductions, rule, buckets). Editing recomputes with that basis; only "Re-apply current rules" swaps in current settings. Store schema v2; cutoffs saved under v1 have no basis and edit with current settings.
- **Payday default:** opens on the most recent unlogged payday (looks back one month), else the current cutoff.
- **Motion** loads through `<LazyMotion>` with async `domMax` features; use `m.*` components, not `motion.*`.
- **Fonts** are self-hosted in `public/fonts` (SIL OFL) with preloads; no third-party font CSS.
- **Initial load:** static boot shell in `index.html`; a build plugin (`vite.config.ts`) modulepreloads the current route's chunk, Motion features, and onboarding (first run only). Drawers are lazy and idle-prefetched; the ⌘K palette is in the main bundle so it takes keystrokes instantly.
- **Measured (Lighthouse, production build):** Accessibility 99–100 and Best Practices 100 on every page; desktop Performance 98–99; mobile (simulated slow 4G) Performance ~80–88, below the §15 target of 90. What remains is download time for React + React Router before first render; closing the gap would need prerendering/SSR.
- `npm run lint` = ESLint (typescript-eslint, react-hooks, jsx-a11y).

---

## 1. What we are building

A personal budget web app for a salaried worker in the Philippines who gets paid **twice a month: on the 15th and at the end of the month** (30th/31st, or 28th/29th in February).

Each payday the user:
1. Enters the **gross salary** received for that cutoff.
2. The app **automatically deducts** government contributions (SSS, PhilHealth, Pag-IBIG), optional withholding tax, and any **custom deductions** the user defined (loans, insurance, co-op, etc.).
3. The **net pay** is split by an **allocation rule** (default 50% Savings / 30% Essentials / 20% Wants). Everything is customizable: bucket names, count, percentages, fixed amounts, colors.

Other pages:
- **Insights**: charts of how much was saved, allocated, and spent every month.
- **Expenses**: log spending against a bucket and category, with running totals.
- **To-Buy**: a wishlist where the user sets money aside for each item and tracks progress.
- **Settings**: every rule, rate, deduction, bucket, category, theme, and data export/import.

Single user, offline-first, no backend, no login. All data lives in the browser.

---

## 2. Tech stack & commands

| Concern | Choice |
|---|---|
| Build | **Vite** + **React 19** + **TypeScript** (strict) |
| Routing | **React Router v7** (`react-router`), `createBrowserRouter` |
| Styling | **Tailwind CSS v4** (`@tailwindcss/vite`, tokens in CSS via `@theme`) + `clsx` + `tailwind-merge` (`cn()` helper) |
| Motion | **Motion** (`motion` package, `import { motion, AnimatePresence } from "motion/react"`) |
| 3D | **Spline** (`@splinetool/react-spline` + `@splinetool/runtime`), lazy-loaded, optional |
| Smooth scroll | `lenis` (optional, toggle in Settings, auto-off with reduced motion) |
| State | **Zustand v5** with `persist` middleware (localStorage), versioned migrations |
| Validation | **Zod** (import files, forms) |
| Charts | **Recharts** (custom tooltips/legends styled with our tokens) |
| Dates | **date-fns** |
| Icons | `lucide-react` |
| Tests | **Vitest** + React Testing Library |

Scripts: `dev`, `build`, `preview`, `test` (vitest), `lint`, `typecheck` (`tsc --noEmit`).

**Before calling any task done:** `npm run typecheck && npm test && npm run build` must pass.

---

## 3. The "DIY" concept

"DIY" means two things here, and both apply.

### 3a. Build it yourself (engineering)
- **No prebuilt component library** (no MUI, Chakra, Ant, Mantine, DaisyUI). Every UI primitive is hand-built in `src/components/ui/` with Tailwind + Motion, in the copy-paste-and-own spirit of Skiper UI / shadcn.
- Headless helpers are fine where accessibility is hard (you may hand-roll, or use `@radix-ui/react-*` primitives for Dialog/Popover/Select **only if** hand-rolling would compromise a11y).
- Use Skiper UI, Manus, and Spline as **references for feel**, not as code sources. Do not paste Skiper UI Pro/premium component code (licensed). Write original implementations.

### 3b. Handmade "workshop" visual layer (design)
A clean, calm, minimal base (Manus-like) with **tactile, handmade accents**, like a well-kept budgeting notebook or a cash-envelope system on a craft table. Accents stay below ~10% of any screen. Data, inputs, and tables stay clean and legible.

DIY motifs to use (sparingly, purposefully):
- **Paper grain**: subtle SVG `feTurbulence` noise overlay (2–4% opacity), fixed, `pointer-events: none`.
- **Graph-paper / cutting-mat grid**: faint dotted grid background on the main canvas (dot grid in light theme, cutting-mat grid lines in dark).
- **Receipt card**: the payday breakdown renders as a thermal receipt: mono font, dashed separators, zig-zag torn bottom edge (CSS `mask`), line items "print" in one by one.
- **Rubber stamp**: saving a cutoff slams a rotated "PAID ✓" / "SAVED" stamp onto the receipt (scale 1.8→1, slight rotation, tiny screen shake, ink texture via mask).
- **Cash envelopes**: allocation buckets render as envelopes/jars that fill up (the envelope budgeting method is literally DIY budgeting).
- **Masking tape labels**: section labels and To-Buy cards held by a strip of semi-transparent "tape" (rotated −2°..3°, torn ends via `clip-path`).
- **Stickers**: category chips look like die-cut stickers (white outline, soft shadow, random rotation −3°..3° seeded by id, lift/peel on hover).
- **Label-maker tags**: bucket names on small embossed tape labels (dark tape, raised light letters, letter-spaced mono).
- **Hand-drawn strokes**: SVG underlines, circles, and arrows that draw in (`pathLength` 0→1) under key numbers and headings.
- **Margin notes**: occasional handwritten annotations (Caveat font) such as "nice, +₱500 saved" with a hand-drawn arrow. Max one per screen.
- **Polaroids**: To-Buy items with images appear as polaroid cards pinned with tape.

---

## 4. Design references, distilled

| Reference | Take this | Don't |
|---|---|---|
| **Manus** (manus.im) | Warm off-white canvas, generous whitespace, serif display headlines paired with a clean sans, soft shadows (`0 8px 24px` low-alpha), 12–16px radii, calm scroll-reveals, 200ms ease-out hovers. | Copy logo, brand colors, or copy text. |
| **Skiper UI** (skiper-ui.com) | Black-canvas dark theme, Geist type, spring-weighted micro-interactions, high-polish details: magnetic buttons, spotlight/glow cards, rolling number tickers, blur-in text reveals, animated tab pills, speed-dial FAB. | Paste premium code; over-animate data views. |
| **Spline** (spline.design) | One interactive 3D object as a hero moment (coin jar/piggy bank) that reacts to the cursor and to "save" events. | Put 3D on every page; block first paint on it. |

**Themes**
- **Paper** (default, light): Manus-leaning.
- **Workbench** (dark): Skiper-leaning black canvas.
- `system` follows `prefers-color-scheme`.

---

## 5. Design tokens

Define as CSS variables in `src/styles/index.css` under Tailwind v4 `@theme`, with a `[data-theme="workbench"]` override. Components use tokens only, never raw hex.

### Color
| Token | Paper (light) | Workbench (dark) | Use |
|---|---|---|---|
| `--bg` | `#F6F3EC` | `#0B0B0C` | canvas |
| `--surface` | `#FFFDF8` | `#141416` | cards |
| `--surface-2` | `#EFEAE0` | `#1C1C1F` | insets, inputs |
| `--line` | `#E2DCCF` | `#27272B` | borders, grid |
| `--ink` | `#1A1916` | `#EDEBE6` | primary text |
| `--muted` | `#6B675E` | `#8D8A84` | secondary text |
| `--accent` | `#1A1916` | `#EDEBE6` | primary buttons (ink on paper) |
| `--highlight` | `#F2D14B` | `#E8C547` | marker highlights, focus accents |
| `--savings` | `#2E7D5B` | `#4FB386` | savings bucket / "saved" series |
| `--essentials` | `#3559C7` | `#6F8CF0` | essentials bucket |
| `--wants` | `#D9682F` | `#F08A52` | wants bucket |
| `--deduction` | `#8A8175` | `#77736C` | deductions (neutral) |
| `--danger` | `#C23B2E` | `#F06A5B` | overspend, destructive |
| `--success` | `#2E7D5B` | `#4FB386` | confirmations |

Extra user-created buckets pick from a curated swatch set (8 colors pre-checked for AA contrast on both themes). Never rely on color alone: charts get direct labels, patterns, or legends with names.

### Type
- Display: **Instrument Serif** (headlines, big hero numbers on Paper).
- UI: **Geist** (all UI text).
- Numbers: **Geist Mono** with `font-variant-numeric: tabular-nums` (all money).
- Handwritten accent: **Caveat** (margin notes only).
- Scale: 12 / 14 / 16 / 18 / 22 / 28 / 36 / 48 / 64. Body 16. Money hero 48–64.

### Shape & depth
- Radii: `--r-sm 8px`, `--r-md 12px`, `--r-lg 16px`, `--r-xl 24px`, pills `9999px`.
- Shadows (Paper): `--shadow-1: 0 1px 2px rgb(26 25 22 / .06), 0 8px 24px rgb(26 25 22 / .06)`; `--shadow-2` stronger for drawers.
- Workbench: shadows replaced by 1px `--line` borders + subtle inner glow.
- Spacing: 4px base. Page gutter 16px mobile, 24px tablet, 40px desktop. Max content width 1200px.

---

## 6. Motion system

Motion must feel **quick and seamless**: fast responses, no waiting on animations, no layout jank.

`src/motion/tokens.ts`:
```ts
export const ease = { out: [0.22, 1, 0.36, 1], inOut: [0.65, 0, 0.35, 1] } as const;
export const dur = { fast: 0.15, base: 0.25, page: 0.32, slow: 0.5 } as const;
export const spring = {
  snappy: { type: "spring", stiffness: 500, damping: 35 },
  soft:   { type: "spring", stiffness: 220, damping: 26 },
  bouncy: { type: "spring", stiffness: 380, damping: 18 },
} as const;
```

Rules:
- Animate only `transform`, `opacity`, `filter`, `clip-path`. Never animate width/height/top/left directly (use `layout` for size changes).
- Interactions respond within 100ms. Page transitions ≤ 350ms. Never block input during an animation.
- Wrap the app in `<MotionConfig reducedMotion="user">` plus a Settings override. With reduced motion: no transforms, parallax, shake, or 3D; keep short opacity fades.
- Route-level code splitting (`React.lazy`) so transitions never wait on chunk loads; prefetch sibling routes on nav hover/focus.

### Page transitions
Blur-fade-slide between routes using a frozen outlet so the exiting page doesn't re-render with new route data (see `src/components/layout/AnimatedOutlet.tsx`). Scroll to top on route change (after exit completes).

### Signature interactions
- **Nav pill**: active indicator is a shared `layoutId="nav-pill"` element that glides between items.
- **Number ticker**: money values roll digit-by-digit (odometer) when they change; `useSpring` for smaller counters.
- **Receipt printing**: breakdown lines stagger in (40ms apart) as the salary is typed (debounced 150ms).
- **Split bar**: segments animate width via `layout`; handles spring back on release.
- **Stamp**: on save, stamp with `spring.bouncy`, 2px shake, ink-splatter fade.
- **Lists**: `AnimatePresence` + `layout` for add/remove/reorder; new rows slide in from the quick-add source.
- **Cards**: spotlight (cursor-following radial gradient) on desktop hover; magnetic primary buttons (max 6px pull).
- **Headings**: word-by-word blur-in on first view (`whileInView`, `once: true`).
- **Hand-drawn strokes**: `pathLength` 0→1, 600ms, after content settles.
- **Overspend**: amount shakes once (x: 0,-4,4,-2,0) and turns `--danger`.
- **Progress** (To-Buy): ring/bar fills with `spring.soft`; reaching 100% triggers a small confetti of paper scraps (hand-built, ≤ 24 particles, reduced-motion safe).

---

## 7. Hand-built component inventory (`src/components/ui/`)

`Button` (solid / ghost / outline / danger / icon), `MagneticButton`, `Card`, `SpotlightCard`, `NumberTicker`, `MoneyInput` (₱ prefix, formats as you type, accepts `25,000.50`), `PercentInput`, `SegmentedControl` (animated pill), `Tabs`, `Drawer` (bottom sheet on mobile, side sheet on desktop, drag-to-dismiss), `Dialog`, `ConfirmDialog` (type-to-confirm for destructive actions), `Toast` (with Undo), `Tooltip`, `Select`, `DatePicker` (simple month grid), `Switch`, `ProgressBar`, `ProgressRing`, `SplitBar` (draggable allocation bar), `Sticker`, `Tape`, `LabelTag`, `Stamp`, `Receipt`, `Envelope` (bucket card), `HandStroke` (underline / circle / arrow SVGs), `MarginNote`, `EmptyState` (DIY doodle illustration + CTA), `Skeleton`, `KeyboardHint`.

Layout (`src/components/layout/`): `AppShell`, `Dock` (bottom dock on mobile, floating pill nav top on desktop), `AnimatedOutlet`, `QuickAddFab` (speed dial: + Expense / + Payday / + To-Buy), `CommandPalette` (⌘K / Ctrl+K: jump to page, quick-add expense with natural input like `250 lunch wants`), `GrainOverlay`, `GridBackground`, `ThemeToggle`.

All interactive components must be keyboard-operable, have visible focus rings (2px `--highlight` outline + offset), correct ARIA roles, and 44×44px minimum touch targets.

---

## 8. Information architecture

| Route | Page | Nav label |
|---|---|---|
| `/` | Payday (enter a cutoff, see breakdown, history) | Payday |
| `/expenses` | Expense tracker | Expenses |
| `/to-buy` | To-Buy list | To-Buy |
| `/insights` | Data visualization | Insights |
| `/settings` | Deductions, rules, rates, categories, appearance, data | Settings |

- First launch opens **Onboarding** (3 steps, skippable; see §12.6).
- The global Quick Add FAB and ⌘K palette are available on every page.
- A **period switcher** (◀ Sep 2026 · 15th ▶) sits in the header of Payday, Expenses, and Insights, and is shared via the store so switching pages keeps context.

---

## 9. Domain model

Money is **always integer centavos**. Percentages are **basis points** (10000 = 100%). No floats in storage or math. Types live in `src/domain/types.ts` (Settings, GovDeduction, GovRates, CustomDeduction, Bucket, AllocationRule, Cutoff, Category, Expense, Contribution, ToBuyItem).

Key points:
- `Half = "A" | "B"`; A = first payday (default 15th), B = second payday (default last day). `CutoffId = "YYYY-MM-A|B"`.
- `settings.monthlyBasicSalary: Centavos | null` — basis for SSS/PhilHealth/Pag-IBIG; null → use cutoff gross × 2.
- `GovDeduction { id: sss|philhealth|pagibig|tax, enabled, mode: auto|fixed, fixedAmount, schedule: split|A|B }` (schedule ignored for tax).
- `CustomDeduction { kind: fixed|percent, amount, percent, schedule: every|A|B, startCutoff?, endCutoff?, active, order }`.
- `Bucket { countsAsSavings, archived, order }`; `AllocationRule { shares: RuleShare[] }` with `RuleShare { kind: percent|fixed }`.
- `Cutoff` stores **snapshots** (deductions, totalDeductions, net, allocations) at save time. Changing settings later never silently rewrites history.
- `Expense.cutoffId` is auto-derived from date (§10.2), user-overridable.
- `ToBuyItem { contributions: Contribution[] (amount < 0 = withdrawal), autoContribution, status: saving|ready|bought|archived, purchase? }`.

Store shape: `{ settings, govRates, govDeductions, customDeductions, buckets, rules, categories, cutoffs, expenses, toBuy, ui: { period, theme… } }`. Keep `ui` out of persistence except theme.

---

## 10. Calculation rules

All logic lives in **pure functions** under `src/domain/` with **no React imports**, and is fully unit-tested. UI only calls selectors.

### 10.1 Money helpers (`src/lib/money.ts`)
- `pct(amount: Centavos, bps: Bps) = Math.round(amount * bps / 10000)` (half away from zero for positives).
- `parseMoney("25,000.50") → 2500050`; reject more than 2 decimals; strip `₱`, spaces, commas.
- `formatMoney(c) → "₱25,000.50"` via `Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" })`. Compact variant for charts (`₱25.0k`).

### 10.2 Paydays & pay periods (`src/lib/periods.ts`)
- Payday dates in month M: `d1 = min(first, lastDay(M))`, `d2 = second === "last" ? lastDay(M) : min(second, lastDay(M))`.
- A cutoff's **pay period** runs from its payday until the day before the next payday.
- `periodOf(date)`: if `day ≥ d2` → `M-B`; else if `day ≥ d1` → `M-A`; else → previous month's `B`.
- Expenses are auto-assigned `cutoffId = periodOf(expense.date)`; the user can override.
- "Month" in reports = the month's two cutoffs (`M-A` + `M-B`) and the expenses attributed to them.

### 10.3 Government contributions (`src/domain/contributions.ts`)
Monthly employee shares from monthly basis `M = settings.monthlyBasicSalary ?? cutoff.gross * 2`, then scheduled onto cutoffs.
- **SSS**: `MSC = clamp(floor((M + step/2) / step) * step, mscMin, mscMax)`; share = `pct(MSC, employeeRate)`.
- **PhilHealth**: share = `pct(clamp(M, floor, ceiling), employeeRate)`.
- **Pag-IBIG**: rate = `M ≤ lowThreshold ? lowRate : highRate`; share = `pct(min(M, maxFundSalary), rate)`.
- **Scheduling** of monthly `m`: `split` → A `floor(m/2)`, B `m − floor(m/2)`; `A` → all on A; `B` → all on B.
- `mode: "fixed"` uses `fixedAmount` per applicable cutoff instead.
- If `cutoff.govAlreadyDeducted` → all gov lines and tax are 0.

### 10.4 Withholding tax (`src/domain/tax.ts`)
`taxable = gross − (this cutoff's SSS + PhilHealth + Pag-IBIG)`; highest bracket with `taxable ≥ over`; `tax = base + pct(taxable − over, rate)`; never negative. Label "Withholding tax (est.)".

### 10.5 Custom deductions (`src/domain/deductions.ts`)
Applies when `active`, schedule matches the half (`every` matches both), and cutoff within `[startCutoff, endCutoff]`. Amount = fixed or `pct(gross, percent)`. Order: gov → tax → custom (by `order`).
`net = gross − totalDeductions`. If `net < 0`, clamp allocations to 0, show a danger banner, still allow saving.

### 10.6 Allocation (`src/domain/allocation.ts`)
1. **Fixed shares** first, in order, each `min(fixedAmount, remaining)`.
2. **Percent shares** split the remainder `R`; must total exactly 100.00%; a rule needs ≥ 1 percent share.
3. Rounding: **largest-remainder method** (ties → larger bps → earlier order).

Presets: **50/30/20** (default), **70/20/10**, **60/30/10**, **20/50/30**.

### 10.7 Derived metrics (`src/domain/metrics.ts`)
- `allocated[bucket]` = snapshot; `spent[bucket]` = Σ expenses; `earmarked[bucket]` = Σ To-Buy contributions in the cutoff for items `saving | ready` funded by the bucket.
- `remaining = allocated − spent − earmarked`.
- **Saved** = Σ allocated to savings buckets − Σ spent from them. **Spent** = Σ all expenses. **Unspent** = Σ remaining of non-savings buckets (floored at 0). **Savings rate** = Saved ÷ Net.
- Bought items' contributions stop counting as earmarked; the purchase expense counts as spent.

---

## 11. Default government rates (PH, 2026)

Shipped in `src/domain/govRates.ts` as `PH_2026`; editable in Settings → Rates with "Reset to 2026 defaults". Label: "Rates last reviewed: Sep 2026 — verify against your payslip".

| Item | Rule | Employee share / month |
|---|---|---|
| SSS | 15% of MSC (EE 5%, ER 10%); MSC ₱5,000–₱35,000 in ₱500 steps | ₱250 – ₱1,750 |
| PhilHealth | 5% of monthly basic, split 50/50; floor ₱10,000, ceiling ₱100,000 | ₱250 – ₱2,500 |
| Pag-IBIG | 1% if ≤ ₱1,500, else 2%; MFS ₱10,000 | up to ₱200 |
| Withholding tax | TRAIN semi-monthly table (RR 11-2018 Annex E, 2023 onward) | brackets in code |

Receipt footer: "Estimates only. Your employer's payroll is the official computation."

---

## 12. Pages

- **Payday (`/`)**: hero strip (greeting, next payday countdown, optional 3D coin jar), input card (cutoff picker, gross MoneyInput, "already deducted" toggle, collapsible adjust: one-time extra deduction, rule, note), live receipt, envelopes, save + stamp + toast with Undo, history grouped by month with drawer (stored receipt, Re-apply current rules with diff, delete).
- **Expenses (`/expenses`)**: header totals (Cutoff | Month | All time), per-bucket progress, quick add (Enter keeps form open), list grouped by day, filters (search, category, bucket, amount range), by-category breakdown, CSV export.
- **To-Buy (`/to-buy`)**: summary strip, item cards (polaroid if image), progress, ETA, add money / withdraw / mark as bought / edit / archive, auto set-aside, sort + drag reorder, bought section, contribution history.
- **Insights (`/insights`)**: range + granularity + bucket filter; KPI tiles with sparklines and ▲/▼ deltas; Monthly flow, Allocated vs spent, Savings over time, Where the gross went, Spending by category, Spending calendar.
- **Settings (`/settings`)**: Paydays & salary, Government deductions, Rates, Custom deductions, Buckets & rules (SplitBar), Categories, Appearance & motion, Data.
- **Onboarding**: 3 skippable steps (paydays + salary, deductions, split).
- **Spline hero**: lazy, `VITE_SPLINE_SCENE_URL`, `CoinFallback` otherwise; hidden with show3D off / reduced motion / < 768px / < 4 cores; loaded on idle.

---

## 13. Persistence, import/export, demo data

- Zustand `persist` → `localStorage` key `kinsenas:v1`, `version: 1`, `migrate()` in `src/store/migrations.ts`. Every schema change bumps the version and adds a migration + test.
- Storage wrapped in try/catch; if unavailable, run in-memory with a banner "Data won't be saved in this browser mode."
- Export JSON = `{ app: "kinsenas", version, exportedAt, data }`. Import validates with Zod (`src/store/schema.ts`) and reports the failing field.
- `src/dev/demoData.ts`: 6 months of seeded, deterministic demo data.

---

## 15. Coding conventions

- TypeScript `strict`, no `any`, no non-null assertions on store data.
- **Never** do money math outside `lib/money.ts` and `domain/`. No floats for money.
- Domain functions are pure and deterministic (pass `today` in).
- Components ≲ 200 lines; extract hooks.
- IDs via `crypto.randomUUID()`.
- Every destructive action has Undo (toast) or a confirm dialog.
- Copy tone: friendly, short, Taglish-friendly ("Sahod day!"), never shaming.
- Accessibility: WCAG 2.1 AA in both themes; `aria-live="polite"` on Net and totals; charts get an `aria-label` summary or hidden table.

---

## 17. Acceptance tests

Encoded in `src/domain/__tests__/acceptance.test.ts` (cases A–L). Do not change expected values without updating this file.

## 18. Out of scope for v1

Cloud sync/accounts, multi-currency, bank/e-wallet imports, recurring expenses, 13th-month and bonus handling, full annual tax reconciliation, PWA/offline install and push reminders, shared household budgets.
