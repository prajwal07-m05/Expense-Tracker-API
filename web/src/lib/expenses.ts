/**
 * Client-side mirror of the FastAPI service in `expense-tracker-api/`.
 *
 * Same rules as the backend: server-generated ids, categories normalised to
 * trimmed lowercase, and money held as integer paise (the JS equivalent of the
 * backend's `Decimal`) so that summing a column never drifts the way floats do.
 */

/** Demo receipts that ship with the app vs. entries the user typed themselves. */
export type Source = 'sample' | 'mine'

export type Expense = {
  id: string
  title: string
  /** Amount in paise — integer, never a float. Divide by 100 only to display. */
  amount: number
  category: string
  /** ISO `YYYY-MM-DD`. */
  date: string
  source: Source
}

export type CategoryTotal = { category: string; total: number; count: number }
export type Totals = { total: number; count: number; byCategory: CategoryTotal[] }
export type MonthTotal = { month: string; total: number; count: number; byCategory: CategoryTotal[] }

export const normaliseCategory = (value: string) =>
  value.trim().toLowerCase().split(/\s+/).filter(Boolean).join(' ')

export const toPaise = (rupees: number) => Math.round(rupees * 100)

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
})

export const formatMoney = (paise: number) => inr.format(paise / 100)

/** Compact form for chart labels: ₹1.2L, ₹8.4K, ₹940. */
export const formatCompact = (paise: number) => {
  const rupees = paise / 100
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}K`
  return `₹${Math.round(rupees)}`
}

export const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

export const formatMonth = (month: string) =>
  new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  })

export const todayISO = () => {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `exp_${Math.random().toString(36).slice(2, 11)}`

// ---------------------------------------------------------------- queries

export type Filters = { category?: string | null; from?: string | null; to?: string | null }

/** `GET /expenses` — newest first, optional category / date-range filters. */
export const filterExpenses = (expenses: Expense[], filters: Filters = {}) => {
  const wanted = filters.category ? normaliseCategory(filters.category) : null
  return expenses
    .filter(
      (e) =>
        (wanted === null || e.category === wanted) &&
        (!filters.from || e.date >= filters.from) &&
        (!filters.to || e.date <= filters.to),
    )
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

const bucket = (expenses: Expense[]): CategoryTotal[] => {
  const totals = new Map<string, CategoryTotal>()
  for (const expense of expenses) {
    const entry = totals.get(expense.category) ?? { category: expense.category, total: 0, count: 0 }
    entry.total += expense.amount
    entry.count += 1
    totals.set(expense.category, entry)
  }
  // Biggest spend first — that's the interesting order for a report.
  return [...totals.values()].sort((a, b) => b.total - a.total || a.category.localeCompare(b.category))
}

/** `GET /expenses/totals` — overall figure plus the per-category breakdown. */
export const computeTotals = (expenses: Expense[]): Totals => ({
  total: expenses.reduce((sum, e) => sum + e.amount, 0),
  count: expenses.length,
  byCategory: bucket(expenses),
})

/** `GET /expenses/summary/monthly` — grouped by calendar month, newest first. */
export const computeMonthly = (expenses: Expense[]): MonthTotal[] => {
  const grouped = new Map<string, Expense[]>()
  for (const expense of expenses) {
    const key = expense.date.slice(0, 7)
    grouped.set(key, [...(grouped.get(key) ?? []), expense])
  }
  return [...grouped.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, items]) => ({
      month,
      total: items.reduce((sum, e) => sum + e.amount, 0),
      count: items.length,
      byCategory: bucket(items),
    }))
}

export const listCategories = (expenses: Expense[]) =>
  [...new Set(expenses.map((e) => e.category))].sort()

/** Every `YYYY-MM` that has at least one entry, newest first. */
export const listMonths = (expenses: Expense[]) =>
  [...new Set(expenses.map((e) => e.date.slice(0, 7)))].sort((a, b) => b.localeCompare(a))

export const monthExpenses = (expenses: Expense[], month: string | null) =>
  month ? expenses.filter((e) => e.date.slice(0, 7) === month) : []

// ------------------------------------------------------------- comparison

export type CategoryDelta = {
  category: string
  a: number
  b: number
  delta: number
  /** Percent change from B to A. `null` when B was zero — that's "new", not "+∞%". */
  pct: number | null
}

export type Comparison = {
  monthA: string | null
  monthB: string | null
  totalA: number
  totalB: number
  countA: number
  countB: number
  delta: number
  pct: number | null
  /** Per-category, biggest absolute movement first. */
  movers: CategoryDelta[]
  biggestA: Expense | null
}

const pctChange = (a: number, b: number) => (b === 0 ? null : ((a - b) / b) * 100)

/**
 * Month A measured against month B. Both months are looked up in the same
 * expense list, so the caller controls the scope (everything / sample / mine)
 * simply by passing a different array.
 */
export const compareMonths = (
  expenses: Expense[],
  monthA: string | null,
  monthB: string | null,
): Comparison => {
  const rowsA = monthExpenses(expenses, monthA)
  const rowsB = monthExpenses(expenses, monthB)
  const totalA = rowsA.reduce((sum, e) => sum + e.amount, 0)
  const totalB = rowsB.reduce((sum, e) => sum + e.amount, 0)

  const byA = new Map(bucket(rowsA).map((row) => [row.category, row.total]))
  const byB = new Map(bucket(rowsB).map((row) => [row.category, row.total]))
  const movers: CategoryDelta[] = [...new Set([...byA.keys(), ...byB.keys()])]
    .map((category) => {
      const a = byA.get(category) ?? 0
      const b = byB.get(category) ?? 0
      return { category, a, b, delta: a - b, pct: pctChange(a, b) }
    })
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta) || x.category.localeCompare(y.category))

  return {
    monthA,
    monthB,
    totalA,
    totalB,
    countA: rowsA.length,
    countB: rowsB.length,
    delta: totalA - totalB,
    pct: pctChange(totalA, totalB),
    movers,
    biggestA: rowsA.reduce<Expense | null>(
      (top, e) => (top === null || e.amount > top.amount ? e : top),
      null,
    ),
  }
}

// ------------------------------------------------------------ seed + store

const STORAGE_KEY = 'oops-wallet/v2'
/** Pre-`source` store. Anything found there is adopted as sample data. */
const LEGACY_KEY = 'expense-tracker/v1'

const seed = (): Expense[] => {
  const now = new Date()
  const monthOf = (back: number, day: number) => {
    const d = new Date(now.getFullYear(), now.getMonth() - back, day)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  const rows: [string, number, string, string][] = [
    ['Monthly rent', 1850000, 'housing', monthOf(0, 1)],
    ['Metro card recharge', 60000, 'transport', monthOf(0, 3)],
    ['Groceries — BigBasket', 342550, 'food', monthOf(0, 4)],
    ['Broadband bill', 99900, 'utilities', monthOf(0, 6)],
    ['Filter coffee, Rameshwaram', 12000, 'food', monthOf(0, 9)],
    ['Paperback — Midnight’s Children', 49900, 'books', monthOf(0, 12)],
    ['Monthly rent', 1850000, 'housing', monthOf(1, 1)],
    ['Electricity bill', 214300, 'utilities', monthOf(1, 5)],
    ['Auto to office', 18000, 'transport', monthOf(1, 8)],
    ['Dinner — Karim’s', 128000, 'food', monthOf(1, 14)],
    ['Cinema — PVR', 45000, 'entertainment', monthOf(1, 18)],
    ['Monthly rent', 1850000, 'housing', monthOf(2, 1)],
    ['Train ticket, IRCTC', 78500, 'transport', monthOf(2, 11)],
    ['Groceries — local market', 187500, 'food', monthOf(2, 16)],
    ['Gym membership', 250000, 'health', monthOf(2, 20)],
  ]
  return rows.map(([title, amount, category, date]) => ({
    id: newId(),
    title,
    amount,
    category,
    date,
    source: 'sample' as const,
  }))
}

/** Sample rows only — used to restore the demo set without touching the user's own. */
export const sampleExpenses = seed

const parseStore = (raw: string | null): Expense[] | null => {
  if (!raw) return null
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) return null
  return parsed
    .filter(
      (e) =>
        e && typeof e.id === 'string' && typeof e.amount === 'number' && typeof e.title === 'string',
    )
    .map((e) => ({ ...e, source: e.source === 'mine' ? 'mine' : 'sample' }) as Expense)
}

export const loadExpenses = (): Expense[] => {
  try {
    return parseStore(localStorage.getItem(STORAGE_KEY)) ?? parseStore(localStorage.getItem(LEGACY_KEY)) ?? seed()
  } catch {
    // A corrupt store shouldn't take the whole app down.
    return seed()
  }
}

export const saveExpenses = (expenses: Expense[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses))
  } catch {
    /* storage full or blocked — the in-memory state is still correct */
  }
}

/** Restore the demo receipts. Entries the user typed are kept — losing those would be rude. */
export const resetExpenses = (current: Expense[] = []) => {
  try {
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    /* ignore */
  }
  return [...seed(), ...current.filter((e) => e.source === 'mine')]
}
