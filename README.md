# Kinsenas — Payday Budget Tracker

A personal, offline-first budget app for people in the Philippines paid on the 15th and at the end of the month. Log each cutoff's gross pay; SSS, PhilHealth, Pag-IBIG, withholding tax and your own deductions are taken out automatically, and the net is split into envelopes (50/30/20 by default). Track expenses, save up for To-Buy items, and see it all in Insights.

All data stays in your browser (localStorage). No account, no server.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Vitest (domain math, §17 acceptance cases, store, UI) |
| `npm run lint` | ESLint (TypeScript, React hooks, jsx-a11y) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run preview` | Serve the production build |

Want sample data? Settings → Data → **Load demo data** (6 months, deterministic).

Deploys as a static site (see `vercel.json` for SPA routing and caching).

Optional 3D hero: set `VITE_SPLINE_SCENE_URL` in `.env` (see `.env.example`). Without it, a hand-built CSS coin stack is shown.

## Where things live

- `src/domain/` — pure money math (integer centavos, basis points), no React. Start with `computeCutoff.ts`.
- `src/store/` — Zustand store, persistence + migrations, Zod import schema, selectors.
- `src/components/ui/` — hand-built primitives (no component library).
- `src/features/` — the five pages plus onboarding.

`CLAUDE.md` is the product spec and source of truth for calculations and design.

> Estimates only. Your employer's payroll is the official computation.
