import { useState } from 'react'
import { formatCompact, formatMonth, formatMoney, type MonthTotal } from '@/lib/expenses'

type Props = { months: MonthTotal[] }

export default function MonthlySummary({ months }: Props) {
  // The newest month starts expanded; the rest open on click.
  const [open, setOpen] = useState<string | null>(months[0]?.month ?? null)
  const peak = Math.max(...months.map((m) => m.total), 1)

  return (
    <section className="border-t border-ink/30 pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl font-bold uppercase leading-none">Month by month</h2>
        <span className="mono text-[9px] lowercase text-accent">ranked by regret</span>
      </div>

      {months.length === 0 ? (
        <p className="mono mt-4 text-[10px] lowercase text-mute">nothing to summarise yet</p>
      ) : (
        <ul className="mt-6 space-y-1">
          {months.map((month, index) => {
            const isOpen = open === month.month
            return (
              <li
                key={month.month}
                className="anim-rise border-b border-ink/12"
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : month.month)}
                  aria-expanded={isOpen}
                  className="group w-full py-3.5 text-left focus-visible:outline-2
                             focus-visible:outline-offset-4 focus-visible:outline-accent"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="flex items-baseline gap-2.5">
                      <span
                        aria-hidden
                        className={`mono text-[9px] text-accent transition-transform duration-300 ${
                          isOpen ? 'rotate-90' : ''
                        }`}
                      >
                        ▶
                      </span>
                      <span className="font-display text-lg font-medium uppercase tracking-wide transition-colors duration-300 group-hover:text-accent">
                        {formatMonth(month.month)}
                      </span>
                    </span>
                    <span className="mono text-[13px]">{formatMoney(month.total)}</span>
                  </div>

                  {/* Month-over-month magnitude: one hairline, scaled to the peak month. */}
                  <div className="mt-2 h-px w-full bg-ink/10">
                    <div
                      className="anim-bar h-full bg-ink/45 transition-colors duration-300 group-hover:bg-accent"
                      style={{
                        width: `${Math.max(4, (month.total / peak) * 100)}%`,
                        animationDelay: `${index * 70 + 120}ms`,
                      }}
                    />
                  </div>
                </button>

                <div
                  className={`grid transition-[grid-template-rows,opacity] duration-500 [transition-timing-function:var(--ease-expo)] ${
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="pb-5 pl-6 pt-1">
                      {/* Stacked bar: each segment is one category's share of the month. */}
                      <div className="flex h-6 w-full overflow-hidden border border-ink/25">
                        {month.byCategory.map((slice, sliceIndex) => (
                          <div
                            key={slice.category}
                            title={`${slice.category} — ${formatMoney(slice.total)}`}
                            style={{
                              width: `${(slice.total / month.total) * 100}%`,
                              backgroundColor:
                                sliceIndex === 0 ? 'var(--color-accent)' : 'var(--color-ink)',
                              opacity:
                                sliceIndex === 0 ? 1 : Math.max(0.14, 0.68 - sliceIndex * 0.13),
                              transitionDelay: `${sliceIndex * 60}ms`,
                            }}
                            className="h-full transition-opacity duration-500 hover:opacity-100"
                          />
                        ))}
                      </div>

                      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5">
                        <div className="flex items-baseline gap-1.5">
                          <dt className="mono text-[9px] uppercase text-mute">entries</dt>
                          <dd className="mono text-[10px]">{month.count}</dd>
                        </div>
                        <div className="flex items-baseline gap-1.5">
                          <dt className="mono text-[9px] uppercase text-mute">average</dt>
                          <dd className="mono text-[10px]">
                            {formatCompact(month.total / month.count)}
                          </dd>
                        </div>
                        {month.byCategory.map((slice) => (
                          <div key={slice.category} className="flex items-baseline gap-1.5">
                            <dt className="mono text-[9px] uppercase text-mute">
                              {slice.category}
                            </dt>
                            <dd className="mono text-[10px]">{formatCompact(slice.total)}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
