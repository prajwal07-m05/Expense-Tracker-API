import { useMemo, useState } from 'react'
import {
  compareMonths,
  computeMonthly,
  formatCompact,
  formatMonth,
  formatMoney,
  listMonths,
  type Expense,
} from '@/lib/expenses'
import { useCountUp } from '@/lib/useCountUp'

type Props = { expenses: Expense[] }

/** Deliberately unhinged copy — the number is the message, this is the tone. */
const verdict = (pct: number | null, delta: number) => {
  if (pct === null) return delta > 0 ? 'brand new spending arc unlocked' : 'nothing here. suspiciously clean'
  if (pct >= 50) return 'the wallet is not okay. it is screaming'
  if (pct >= 15) return 'spending up. we are simply not beating the allegations'
  if (pct > 3) return 'slightly worse. we move'
  if (pct >= -3) return 'basically flat. financially unbothered'
  if (pct > -25) return 'down a bit. quietly cooking'
  return 'certified saver behaviour. touch grass, keep the streak'
}

export default function InsightsPanel({ expenses }: Props) {
  const months = useMemo(() => listMonths(expenses), [expenses])
  const [monthA, setMonthA] = useState<string | null>(null)
  const [monthB, setMonthB] = useState<string | null>(null)

  // Default to newest vs. the one before it, but never fight an explicit choice.
  const a = monthA && months.includes(monthA) ? monthA : (months[0] ?? null)
  const b = monthB && months.includes(monthB) ? monthB : (months[1] ?? months[0] ?? null)

  const cmp = useMemo(() => compareMonths(expenses, a, b), [expenses, a, b])
  const trend = useMemo(() => computeMonthly(expenses), [expenses])
  const rollingA = useCountUp(cmp.totalA)

  if (months.length === 0) {
    return (
      <section className="anim-rise border border-dashed border-ink/25 px-6 py-20 text-center">
        <p className="font-display text-3xl font-bold uppercase leading-none">No data, no drama</p>
        <p className="mt-3 text-[13px] text-mute">
          Log a couple of expenses and this page turns into a receipt-based personality test.
        </p>
      </section>
    )
  }

  const up = cmp.delta > 0
  const peak = Math.max(...trend.map((m) => m.total), 1)
  const moverMax = Math.max(...cmp.movers.map((m) => Math.max(m.a, m.b)), 1)

  return (
    <div className="flex flex-col gap-9">
      {/* ------------------------------------------------- month pickers */}
      <section className="anim-rise">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl font-bold uppercase leading-none">The damage report</h2>
          <span className="mono text-[9px] lowercase text-accent">pick any two months · we&rsquo;ll do the maths</span>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto_1fr]">
          <MonthPicker label="this one" value={a} months={months} onChange={setMonthA} accent />
          <div className="hidden items-end pb-2 sm:flex">
            <span aria-hidden className="mono text-[11px] text-mute">
              vs
            </span>
          </div>
          <MonthPicker label="against" value={b} months={months} onChange={setMonthB} />
        </div>
      </section>

      {/* ------------------------------------------------- headline delta */}
      <section
        className="anim-rise border border-ink/25 bg-ink px-6 py-7 text-paper"
        style={{ animationDelay: '80ms' }}
      >
        <p className="mono text-[9px] uppercase text-mute-ink">
          {a ? formatMonth(a) : '—'} spend
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-x-5 gap-y-2">
          <p className="mono text-[2.6rem] font-light leading-none">{formatMoney(rollingA)}</p>
          <p
            className={`font-display text-2xl font-bold uppercase leading-none ${
              up ? 'text-accent' : 'text-paper'
            }`}
          >
            <span aria-hidden>{up ? '▲' : '▼'}</span>{' '}
            {cmp.pct === null ? 'new' : `${Math.abs(cmp.pct).toFixed(0)}%`}
          </p>
        </div>
        <p className="mt-3 max-w-[46ch] text-[13px] leading-relaxed text-mute-ink">
          {verdict(cmp.pct, cmp.delta)} — that&rsquo;s{' '}
          <span className="mono text-paper">{formatMoney(Math.abs(cmp.delta))}</span>{' '}
          {up ? 'more' : 'less'} than {b ? formatMonth(b) : 'last time'}.
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-ink-line pt-5 sm:grid-cols-4">
          <Stat label="entries" value={String(cmp.countA)} sub={`was ${cmp.countB}`} />
          <Stat
            label="avg receipt"
            value={formatCompact(cmp.countA ? cmp.totalA / cmp.countA : 0)}
            sub={`was ${formatCompact(cmp.countB ? cmp.totalB / cmp.countB : 0)}`}
          />
          <Stat
            label="per day"
            value={formatCompact(cmp.totalA / daysIn(a))}
            sub={`${daysIn(a)} days`}
          />
          <Stat
            label="biggest hit"
            value={cmp.biggestA ? formatCompact(cmp.biggestA.amount) : '—'}
            sub={cmp.biggestA?.title ?? 'nothing logged'}
          />
        </dl>
      </section>

      {/* ------------------------------------------------------- movers */}
      <section className="anim-rise" style={{ animationDelay: '140ms' }}>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl font-bold uppercase leading-none">Where it went</h2>
          <span className="mono text-[9px] lowercase text-mute">biggest swing first</span>
        </div>

        <ul className="mt-5 space-y-5">
          {cmp.movers.map((mover, index) => (
            <li key={mover.category} className="anim-slide" style={{ animationDelay: `${index * 55}ms` }}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="font-display text-[17px] font-medium uppercase tracking-wide">
                  {mover.category}
                </span>
                <span className="flex items-baseline gap-3">
                  <span className="mono text-[12px]">{formatMoney(mover.a)}</span>
                  <span
                    className={`mono text-[10px] ${
                      mover.delta > 0 ? 'text-accent' : 'text-mute'
                    }`}
                  >
                    {mover.delta === 0
                      ? '—'
                      : `${mover.delta > 0 ? '+' : '−'}${formatCompact(Math.abs(mover.delta))}`}
                  </span>
                </span>
              </div>

              {/* Two stacked rails: solid = the month you picked, hairline = the one you compared against. */}
              <div className="mt-2 space-y-1">
                <Rail width={(mover.a / moverMax) * 100} height={7} fill="bg-accent" delay={index * 55} />
                <Rail
                  width={(mover.b / moverMax) * 100}
                  height={3}
                  fill="bg-ink/35"
                  delay={index * 55 + 90}
                />
              </div>
            </li>
          ))}
        </ul>

        <p className="mono mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] uppercase text-mute">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-[7px] w-4 bg-accent" /> {a ? formatMonth(a) : '—'}
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-[3px] w-4 bg-ink/35" /> {b ? formatMonth(b) : '—'}
          </span>
        </p>
      </section>

      {/* -------------------------------------------------------- trend */}
      <section className="anim-rise border-t border-ink/30 pt-6" style={{ animationDelay: '200ms' }}>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl font-bold uppercase leading-none">The whole arc</h2>
          <span className="mono text-[9px] lowercase text-mute">tap a bar to compare it</span>
        </div>

        <div className="scroll-quiet mt-6 flex items-end gap-3 overflow-x-auto pb-2">
          {[...trend].reverse().map((month, index) => {
            const isA = month.month === a
            const isB = month.month === b
            return (
              <button
                key={month.month}
                onClick={() => (isA ? setMonthB(month.month) : setMonthA(month.month))}
                title={`${formatMonth(month.month)} — ${formatMoney(month.total)}`}
                className="group flex min-w-[54px] flex-1 flex-col items-center gap-2
                           focus-visible:outline-2 focus-visible:outline-offset-4
                           focus-visible:outline-accent"
              >
                <span className="mono text-[9px] text-mute">{formatCompact(month.total)}</span>
                <span className="flex h-32 w-full items-end">
                  <span
                    className={`anim-bar-y w-full transition-colors duration-300 ${
                      isA ? 'bg-accent' : isB ? 'bg-ink/55' : 'bg-ink/18 group-hover:bg-ink/40'
                    }`}
                    style={{
                      height: `${Math.max(4, (month.total / peak) * 100)}%`,
                      animationDelay: `${index * 60}ms`,
                    }}
                  />
                </span>
                <span
                  className={`mono text-[9px] uppercase ${isA || isB ? 'text-ink' : 'text-mute'}`}
                >
                  {month.month.slice(5)}/{month.month.slice(2, 4)}
                </span>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}

/** Days in the month, so "per day" doesn't quietly divide by 30 for February. */
const daysIn = (month: string | null) => {
  if (!month) return 1
  const [year, m] = month.split('-').map(Number)
  return new Date(year, m, 0).getDate()
}

function Rail({
  width,
  height,
  fill,
  delay,
}: {
  width: number
  height: number
  fill: string
  delay: number
}) {
  return (
    <div className="w-full bg-ink/8" style={{ height }}>
      <div
        className={`anim-bar h-full ${fill}`}
        style={{ width: `${width > 0 ? Math.max(width, 1.5) : 0}%`, animationDelay: `${delay}ms` }}
      />
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <dt className="mono text-[9px] uppercase text-mute-ink">{label}</dt>
      <dd className="mono mt-1.5 text-[15px] text-paper">{value}</dd>
      <dd className="mono mt-0.5 truncate text-[9px] lowercase text-mute-ink">{sub}</dd>
    </div>
  )
}

function MonthPicker({
  label,
  value,
  months,
  onChange,
  accent = false,
}: {
  label: string
  value: string | null
  months: string[]
  onChange: (month: string) => void
  accent?: boolean
}) {
  return (
    <label className="block">
      <span className="mono block text-[9px] uppercase text-mute">{label}</span>
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1 w-full cursor-pointer appearance-none border-b bg-transparent py-2
                    font-display text-xl font-medium uppercase tracking-wide outline-none
                    transition-colors duration-300 hover:border-accent focus:border-accent ${
                      accent ? 'border-accent text-ink' : 'border-ink/30 text-mute'
                    }`}
      >
        {months.map((month) => (
          <option key={month} value={month}>
            {formatMonth(month)}
          </option>
        ))}
      </select>
    </label>
  )
}
