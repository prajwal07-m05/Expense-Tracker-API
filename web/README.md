# Oops Wallet — demo front end

An optional React + TypeScript UI for the Smart Expense Tracker API. It is **not**
part of the assignment deliverable; the API in the parent folder is. It exists so the
project can be demonstrated without a REST client.

```bash
cd web
npm install
npm run dev      # http://localhost:5173
```

`npm run build` typechecks with `tsc --noEmit` and then produces a production bundle in
`dist/`.

## What it does

Add, filter, total, summarise and delete expenses — the same five operations as the API,
plus the monthly summary. The UI is split into three tabs:

* **Sample** — the demo receipts that ship with the app.
* **Create** — only the entries you've typed yourself.
* **Insights** — compare any two months: headline delta, per-category movers, month trend.

Every expense carries `source: 'sample' | 'mine'`, so the tabs are three views onto one
store rather than three datasets. Restoring the sample set keeps your own entries.

## How it relates to the API

The UI currently reads and writes `localStorage`, not HTTP, so it can be opened as a
static page with no server running. `src/lib/expenses.ts` is a deliberate mirror of the
Python service and keeps its two most important rules:

* **Money is an integer** (paise), never a float — the JS equivalent of the backend's
  `Decimal`. `0.1 + 0.2` totals exactly `₹0.30`.
* **Categories are normalised** to trimmed lowercase, so filtering is case-insensitive
  and grouping doesn't split `Food` from `food`.

Because the query and aggregation functions (`filterExpenses`, `computeTotals`,
`computeMonthly`) take a plain array and return plain data, swapping `localStorage` for
`fetch` against the FastAPI service is a change to the data source only, not to the
components.

## Design

Brutalist ledger: newsprint ground with a grain overlay, an ink sidebar, a single
vermilion accent. Type is Big Shoulders Display (condensed headlines), Familjen Grotesk
(body) and Martian Mono (figures, set with tabular numerals so currency columns align).

Motion is used to explain state, not to decorate: totals roll from the old value to the
new one, rows print in left-to-right on a stagger, deletions strike out before leaving,
bars grow from zero, and the wire ticker pauses on hover. Everything collapses to instant
under `prefers-reduced-motion: reduce`.

## Layout

```
web/
├── index.html
├── src/
│   ├── App.tsx                    # layout, tab + filter state, add/delete orchestration
│   ├── main.tsx
│   ├── index.css                  # fonts, design tokens, keyframes
│   ├── components/
│   │   ├── AddExpenseForm.tsx
│   │   ├── InsightsPanel.tsx      # month-vs-month comparison dashboard
│   │   ├── LedgerTable.tsx
│   │   ├── MonthlySummary.tsx
│   │   ├── Ticker.tsx
│   │   └── TotalsPanel.tsx
│   └── lib/
│       ├── expenses.ts            # domain logic mirroring the API
│       └── useCountUp.ts          # rAF value animation, reduced-motion aware
├── package.json
├── tsconfig.json
└── vite.config.ts
```

