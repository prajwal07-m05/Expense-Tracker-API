import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import AddExpenseForm from '@/components/AddExpenseForm'
import InsightsPanel from '@/components/InsightsPanel'
import LedgerTable from '@/components/LedgerTable'
import MonthlySummary from '@/components/MonthlySummary'
import Ticker from '@/components/Ticker'
import TotalsPanel from '@/components/TotalsPanel'
import {
  computeMonthly,
  computeTotals,
  filterExpenses,
  listCategories,
  loadExpenses,
  newId,
  resetExpenses,
  saveExpenses,
  type Expense,
} from '@/lib/expenses'

const EXIT_MS = 260

type Tab = 'sample' | 'create' | 'insights'

const TABS: { id: Tab; label: string; blurb: string }[] = [
  { id: 'sample', label: 'Sample', blurb: 'a fake month of receipts, already loaded' },
  { id: 'create', label: 'Create', blurb: 'your money, your mess' },
  { id: 'insights', label: 'Insights', blurb: 'the part that hurts' },
]

export default function App() {
  const [expenses, setExpenses] = useState<Expense[]>(loadExpenses)
  const [tab, setTab] = useState<Tab>('sample')
  const [category, setCategory] = useState<string | null>(null)
  // Ids mid-exit-animation — still rendered, struck out, removed when it ends.
  const [removing, setRemoving] = useState<string[]>([])
  const [flashId, setFlashId] = useState<string | null>(null)
  const timers = useRef<number[]>([])

  useEffect(() => saveExpenses(expenses), [expenses])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const mine = useMemo(() => expenses.filter((e) => e.source === 'mine'), [expenses])
  const sample = useMemo(() => expenses.filter((e) => e.source === 'sample'), [expenses])

  // Each tab is a window onto the same store, never a separate copy of it.
  const scope = tab === 'create' ? mine : tab === 'sample' ? sample : expenses

  // Drop a filter whose last matching row just left the current scope.
  useEffect(() => {
    if (category && !scope.some((e) => e.category === category)) setCategory(null)
  }, [scope, category])

  const visible = useMemo(() => filterExpenses(scope, { category }), [scope, category])
  const totals = useMemo(() => computeTotals(visible), [visible])
  const months = useMemo(() => computeMonthly(scope), [scope])
  const categories = useMemo(() => listCategories(scope), [scope])
  const allTotals = useMemo(() => computeTotals(expenses), [expenses])

  const addExpense = (draft: Omit<Expense, 'id' | 'source'>) => {
    const expense: Expense = { ...draft, id: newId(), source: 'mine' }
    setExpenses((current) => [expense, ...current])
    setTab('create')
    setCategory(null)
    setFlashId(expense.id)
    timers.current.push(window.setTimeout(() => setFlashId(null), 1200))
  }

  const deleteExpense = (id: string) => {
    if (removing.includes(id)) return
    setRemoving((current) => [...current, id])
    timers.current.push(
      window.setTimeout(() => {
        setExpenses((current) => current.filter((e) => e.id !== id))
        setRemoving((current) => current.filter((x) => x !== id))
      }, EXIT_MS),
    )
  }

  const goTo = (next: Tab) => {
    setTab(next)
    setCategory(null)
  }

  // The shell uses overflow-x-clip, never -hidden: `hidden` makes it a scroll
  // container and silently breaks the sidebar's position:sticky. `clip` doesn't.
  return (
    <div className="grain min-h-screen overflow-x-clip lg:grid lg:grid-cols-[minmax(340px,22vw)_1fr]">
      {/* ------------------------------------------------------ ink column */}
      <aside className="scroll-quiet relative flex min-w-0 flex-col gap-8 bg-ink px-7 py-9 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
        {/* Rotated spine label along the divide — the ledger's book edge. */}
        <span
          aria-hidden
          className="mono pointer-events-none absolute right-1.5 top-1/2 hidden -translate-y-1/2
                     rotate-180 text-[8px] uppercase tracking-[0.5em] text-ink-line
                     [writing-mode:vertical-rl] lg:block"
        >
          broke but organised
        </span>

        <header className="anim-rise">
          <div className="flex items-center gap-2.5">
            <span className="anim-stamp h-3 w-3 bg-accent" aria-hidden />
            <span className="mono text-[9px] uppercase text-mute-ink">certified overspender</span>
          </div>
          <h1 className="mt-4 font-display text-[3.9rem] font-black uppercase leading-[0.82] tracking-[-0.01em] text-paper">
            Oops
            <br />
            <span className="text-accent">Wallet</span>
          </h1>
          <p className="mt-4 max-w-[32ch] text-[15px] leading-snug text-paper">
            spend now, panic later — we&rsquo;ll do the maths.
          </p>
          <p className="mt-2 max-w-[32ch] text-[13px] leading-relaxed text-mute-ink">
            Every rupee you&rsquo;d rather not think about, logged, totalled and gently judged.
          </p>
        </header>

        {tab === 'create' ? (
          <AddExpenseForm expenses={expenses} onAdd={addExpense} />
        ) : (
          <section className="anim-rise border border-ink-line px-5 py-5" style={{ animationDelay: '120ms' }}>
            <h2 className="font-display text-xl font-bold uppercase leading-none text-paper">
              {tab === 'sample' ? 'Just browsing?' : 'Want better numbers?'}
            </h2>
            <p className="mt-2.5 text-[13px] leading-relaxed text-mute-ink">
              {tab === 'sample'
                ? 'These receipts are ours, not yours. Hit create and start logging the real ones.'
                : 'Insights get sharper the more you log. Add a few of your own.'}
            </p>
            <button
              onClick={() => goTo('create')}
              className="mono mt-4 border border-accent px-3 py-2 text-[9px] uppercase text-accent
                         transition-colors duration-300 hover:bg-accent hover:text-paper
                         focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              start my own →
            </button>
          </section>
        )}

        {tab !== 'insights' && (
          <TotalsPanel
            totals={totals}
            activeCategory={category}
            onSelectCategory={setCategory}
            caption={tab === 'create' ? 'yours only' : 'sample set'}
          />
        )}

        <footer className="mt-auto border-t border-ink-line pt-4">
          <button
            onClick={() => {
              setExpenses((current) => resetExpenses(current))
              setCategory(null)
            }}
            className="rule-sweep mono text-[9px] uppercase text-mute-ink transition-colors
                       duration-300 hover:text-accent focus-visible:outline-2
                       focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            restore the sample receipts
          </button>
          <p className="mono mt-2 text-[8px] lowercase text-mute-ink/70">
            your entries stay put — only the demo set is rebuilt
          </p>
        </footer>
      </aside>

      {/* ----------------------------------------------------- paper column
          min-w-0 is load-bearing: a grid item defaults to min-width:auto, so the
          ticker's w-max track and the table's min-width would otherwise stretch
          this 1fr column past the viewport and drag the centred content off-screen. */}
      <main className="min-w-0 px-6 pb-9 sm:px-10 lg:px-14">
        <div className="-mx-6 sm:-mx-10 lg:-mx-14">
          <Ticker rows={allTotals.byCategory} total={allTotals.total} />
        </div>

        <div className="mx-auto flex max-w-3xl flex-col gap-9 pt-9">
          {/* ------------------------------------------------------- tabs */}
          <nav className="anim-rise flex flex-wrap items-end gap-x-7 gap-y-2 border-b border-ink/25 pb-3">
            {TABS.map((entry) => {
              const isOn = tab === entry.id
              return (
                <button
                  key={entry.id}
                  onClick={() => goTo(entry.id)}
                  aria-current={isOn ? 'page' : undefined}
                  className="group relative text-left focus-visible:outline-2
                             focus-visible:outline-offset-4 focus-visible:outline-accent"
                >
                  <span
                    className={`font-display block text-[2rem] font-bold uppercase leading-none
                                transition-colors duration-300 ${
                                  isOn ? 'text-ink' : 'text-mute hover:text-accent'
                                }`}
                  >
                    {entry.label}
                  </span>
                  <span
                    className={`mono mt-1 block text-[9px] lowercase transition-colors duration-300 ${
                      isOn ? 'text-accent' : 'text-mute/70'
                    }`}
                  >
                    {entry.blurb}
                  </span>
                  {/* Active marker sweeps in rather than snapping. */}
                  <span
                    aria-hidden
                    className={`absolute -bottom-3 left-0 h-[3px] bg-accent transition-all
                                duration-500 [transition-timing-function:var(--ease-expo)] ${
                                  isOn ? 'w-full' : 'w-0'
                                }`}
                  />
                </button>
              )
            })}
          </nav>

          {tab === 'insights' ? (
            <InsightsPanel expenses={expenses} />
          ) : (
            <>
              <section>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="font-display text-2xl font-bold uppercase leading-none">
                    {tab === 'create' ? 'Your receipts' : 'Sample receipts'}
                  </h2>
                  <span className="mono text-[9px] lowercase text-accent">
                    {category ? `filtered to ${category}` : 'newest regret first'}
                  </span>
                </div>

                {scope.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <FilterChip active={category === null} onClick={() => setCategory(null)} index={0}>
                      all · {scope.length}
                    </FilterChip>
                    {categories.map((name, index) => (
                      <FilterChip
                        key={name}
                        active={category === name}
                        onClick={() => setCategory(category === name ? null : name)}
                        index={index + 1}
                      >
                        {name}
                      </FilterChip>
                    ))}
                  </div>
                )}

                <div className="mt-6">
                  {tab === 'create' && mine.length === 0 ? (
                    <div className="anim-rise border border-dashed border-ink/25 px-6 py-16 text-center">
                      <p className="font-display text-3xl font-bold uppercase leading-none">
                        Nothing logged yet
                      </p>
                      <p className="mx-auto mt-3 max-w-[42ch] text-[13px] leading-relaxed text-mute">
                        Use the form on the left. First entry takes about nine seconds, which is
                        roughly how long the coffee lasted.
                      </p>
                    </div>
                  ) : (
                    <LedgerTable
                      expenses={visible}
                      removing={removing}
                      flashId={flashId}
                      onDelete={deleteExpense}
                      onSelectCategory={setCategory}
                    />
                  )}
                </div>
              </section>

              {scope.length > 0 && <MonthlySummary months={months} />}
            </>
          )}

          <p className="mono pb-4 text-[9px] uppercase text-mute">
            saved right here in your browser · nothing leaves this tab
          </p>
        </div>
      </main>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  index,
  children,
}: {
  active: boolean
  onClick: () => void
  index: number
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{ animationDelay: `${index * 45}ms` }}
      className={`anim-slide font-display border px-3 py-1 text-[14px] font-medium uppercase
                  tracking-wide transition-[background-color,border-color,color,transform]
                  duration-300 hover:-translate-y-0.5 focus-visible:outline-2
                  focus-visible:outline-offset-4 focus-visible:outline-accent ${
                    active
                      ? 'border-accent bg-accent text-paper'
                      : 'border-ink/30 text-ink hover:border-accent hover:text-accent'
                  }`}
    >
      {children}
    </button>
  )
}
