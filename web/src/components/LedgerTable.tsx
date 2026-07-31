import { formatDate, formatMoney, type Expense } from '@/lib/expenses'

type Props = {
  expenses: Expense[]
  /** Ids mid-exit-animation. Optional so a partial hot-reload can't crash the tree. */
  removing?: string[]
  flashId?: string | null
  onDelete: (id: string) => void
  onSelectCategory: (category: string) => void
}

export default function LedgerTable({
  expenses,
  removing = [],
  flashId = null,
  onDelete,
  onSelectCategory,
}: Props) {
  const exiting = new Set(removing)

  if (expenses.length === 0) {
    return (
      <div className="anim-rise border border-dashed border-ink/25 px-6 py-16 text-center">
        <p className="font-display text-2xl font-bold uppercase leading-none">Empty in here</p>
        <p className="mono mt-3 text-[10px] lowercase text-mute">
          nothing matches that filter — clear it, or log something new
        </p>
      </div>
    )
  }

  return (
    <div className="scroll-quiet -mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[580px] border-collapse text-left">
        <thead>
          <tr className="border-y border-ink/30">
            {['date', 'description', 'category', 'amount', ''].map((heading, i) => (
              <th
                key={heading || 'actions'}
                scope="col"
                className={`mono py-2 text-[9px] font-normal uppercase text-mute ${
                  i === 3 ? 'text-right' : ''
                }`}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense, index) => (
            <tr
              key={expense.id}
              className={`group border-b border-ink/12 transition-colors duration-300 hover:bg-paper-dim ${
                exiting.has(expense.id) ? 'anim-strike' : 'anim-print'
              } ${flashId === expense.id ? 'anim-flash' : ''}`}
              style={{ animationDelay: exiting.has(expense.id) ? '0ms' : `${index * 34}ms` }}
            >
              <td className="mono whitespace-nowrap py-3.5 pr-4 text-[10px] text-mute">
                {formatDate(expense.date)}
              </td>
              <td className="py-3.5 pr-4 text-[0.98rem] font-medium leading-snug">
                {expense.title}
              </td>
              <td className="py-3.5 pr-4">
                <button
                  onClick={() => onSelectCategory(expense.category)}
                  className="rule-sweep font-display text-[13px] font-medium uppercase tracking-wide
                             text-ink transition-colors duration-300 hover:text-accent
                             focus-visible:outline-2 focus-visible:outline-offset-4
                             focus-visible:outline-accent"
                >
                  {expense.category}
                </button>
              </td>
              <td className="mono whitespace-nowrap py-3.5 text-right text-[13px]">
                {formatMoney(expense.amount)}
              </td>
              <td className="w-9 py-3.5 pl-3 text-right">
                <button
                  onClick={() => onDelete(expense.id)}
                  aria-label={`Delete ${expense.title}`}
                  title="Delete entry"
                  className="mono translate-x-1 text-[12px] text-mute opacity-0 transition-all
                             duration-300 hover:text-accent focus-visible:translate-x-0
                             focus-visible:opacity-100 group-hover:translate-x-0
                             group-hover:opacity-100 focus-visible:outline-2
                             focus-visible:outline-offset-4 focus-visible:outline-accent"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
