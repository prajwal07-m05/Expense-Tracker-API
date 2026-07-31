import { formatMoney, type CategoryTotal } from '@/lib/expenses'

type Props = { rows: CategoryTotal[]; total: number }

/**
 * A financial-wire ticker across the top of the ledger. The track holds two
 * identical copies of the content and translates by -50%, so the loop is
 * seamless; hovering pauses it.
 */
export default function Ticker({ rows, total }: Props) {
  if (rows.length === 0) return null

  const items = [
    { key: 'total', label: 'total spend', value: formatMoney(total), hot: true },
    ...rows.map((row) => ({
      key: row.category,
      label: row.category,
      value: `${formatMoney(row.total)} · ${row.count}×`,
      hot: false,
    })),
  ]

  const strip = (ariaHidden: boolean) => (
    <div
      aria-hidden={ariaHidden || undefined}
      className="flex shrink-0 items-center gap-8 pr-8"
    >
      {items.map((item) => (
        <span key={item.key} className="flex shrink-0 items-center gap-2 whitespace-nowrap">
          <span
            className={`h-1.5 w-1.5 shrink-0 ${item.hot ? 'bg-accent' : 'bg-mute-ink/60'}`}
            aria-hidden
          />
          <span className="mono text-[9px] uppercase text-mute-ink">{item.label}</span>
          <span className={`mono text-[9px] ${item.hot ? 'text-accent' : 'text-paper'}`}>
            {item.value}
          </span>
        </span>
      ))}
    </div>
  )

  return (
    <div className="overflow-hidden border-y border-ink-line bg-ink py-2.5">
      <div className="ticker-track flex w-max">
        {strip(false)}
        {strip(true)}
      </div>
    </div>
  )
}
