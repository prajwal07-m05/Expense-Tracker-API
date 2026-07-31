import { formatMoney, type Totals } from '@/lib/expenses'
import { useCountUp } from '@/lib/useCountUp'

type Props = {
  totals: Totals
  activeCategory: string | null
  onSelectCategory: (category: string | null) => void
  /** Which slice of the store these numbers cover. */
  caption?: string
}

export default function TotalsPanel({
  totals,
  activeCategory,
  onSelectCategory,
  caption = 'all of it',
}: Props) {
  const rolling = useCountUp(totals.total)
  const max = totals.byCategory[0]?.total ?? 1

  return (
    <section className="anim-rise" style={{ animationDelay: '220ms' }}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-bold uppercase leading-none tracking-[0.02em] text-paper">
          The damage
        </h2>
        <span className="mono text-[9px] lowercase text-accent">{caption}</span>
      </div>

      <div className="mt-4 border-t border-ink-line pt-4">
        <p className="mono text-[9px] uppercase text-mute-ink">
          {activeCategory ? `just ${activeCategory}` : 'grand total'}
        </p>
        <p className="mono mt-2 text-[2.1rem] font-light leading-none text-paper">
          {formatMoney(rolling)}
          <span aria-hidden className="anim-caret ml-1 inline-block text-accent">▌</span>
        </p>
        <p className="mono mt-3 text-[10px] text-mute-ink">
          {totals.count} {totals.count === 1 ? 'entry' : 'entries'} recorded
        </p>
      </div>

      <ul className="mt-5 space-y-3.5 border-t border-ink-line pt-4">
        {totals.byCategory.length === 0 && (
          <li className="mono text-[10px] text-mute-ink">₹0 spent. immaculate. unrealistic</li>
        )}
        {totals.byCategory.map((row, index) => {
          const isActive = row.category === activeCategory
          return (
            <li
              key={row.category}
              className="anim-slide"
              style={{ animationDelay: `${260 + index * 55}ms` }}
            >
              <button
                onClick={() => onSelectCategory(isActive ? null : row.category)}
                aria-pressed={isActive}
                className="group block w-full text-left focus-visible:outline-2
                           focus-visible:outline-offset-4 focus-visible:outline-accent"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    className={`font-display text-[15px] font-medium uppercase tracking-wide transition-colors ${
                      isActive ? 'text-accent' : 'text-paper group-hover:text-accent'
                    }`}
                  >
                    {row.category}
                  </span>
                  <span className="mono text-[10px] text-mute-ink transition-colors group-hover:text-paper">
                    {formatMoney(row.total)}
                  </span>
                </div>
                <div className="mt-1.5 h-[3px] w-full overflow-hidden bg-ink-line/70">
                  <div
                    className={`anim-bar h-full transition-[width,background-color] duration-700 ${
                      isActive ? 'bg-accent' : 'bg-mute-ink group-hover:bg-accent'
                    }`}
                    style={{
                      width: `${Math.max(2, (row.total / max) * 100)}%`,
                      animationDelay: `${320 + index * 55}ms`,
                    }}
                  />
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
