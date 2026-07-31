import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { listCategories, normaliseCategory, todayISO, toPaise, type Expense } from '@/lib/expenses'

type Props = {
  expenses: Expense[]
  /** `source` is stamped by the caller — everything typed here is the user's own. */
  onAdd: (expense: Omit<Expense, 'id' | 'source'>) => void
}

const field =
  'peer w-full bg-transparent border-b border-ink-line py-2 text-paper placeholder:text-mute-ink/50 ' +
  'outline-none transition-[border-color,color] duration-300 hover:border-mute-ink focus:border-accent'

const label =
  'mono block text-[9px] uppercase text-mute-ink transition-colors duration-300 peer-focus:text-accent'

export default function AddExpenseForm({ expenses, onAdd }: Props) {
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [date, setDate] = useState(todayISO)
  const [error, setError] = useState<string | null>(null)

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    // Same validation contract as the API: non-blank title, amount > 0, category set.
    const parsedAmount = Number(amount)
    if (!title.trim()) return setError('title is required')
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0)
      return setError('amount must be greater than zero')
    if (!normaliseCategory(category)) return setError('category is required')

    onAdd({
      title: title.trim(),
      amount: toPaise(parsedAmount),
      category: normaliseCategory(category),
      date,
    })
    setTitle('')
    setAmount('')
    setCategory('')
    setDate(todayISO())
    setError(null)
  }

  // ⌘/Ctrl + Enter submits from any field.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit()
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={onKeyDown}
      noValidate
      className="anim-rise space-y-5"
      style={{ animationDelay: '120ms' }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-bold uppercase leading-none tracking-[0.02em] text-paper">
          What&rsquo;d you buy
        </h2>
        <span className="mono text-[9px] lowercase text-accent">be honest</span>
      </div>

      <div className="flex flex-col-reverse">
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="filter coffee at rameshwaram"
          maxLength={120}
          className={field}
        />
        <label className={label} htmlFor="title">
          description
        </label>
      </div>

      <div className="grid grid-cols-[1.15fr_1fr] gap-4">
        <div className="flex flex-col-reverse">
          <input
            id="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="120.00"
            className={`${field} mono text-[15px]`}
          />
          <label className={label} htmlFor="amount">
            amount ₹
          </label>
        </div>
        <div className="flex flex-col-reverse">
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`${field} mono text-[12px] [color-scheme:dark]`}
          />
          <label className={label} htmlFor="date">
            date
          </label>
        </div>
      </div>

      <div className="flex flex-col-reverse">
        <input
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          list="known-categories"
          placeholder="food"
          maxLength={50}
          className={field}
        />
        <label className={label} htmlFor="category">
          category
        </label>
        <datalist id="known-categories">
          {listCategories(expenses).map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>

      <div className="min-h-[16px]">
        {error && (
          <p role="alert" className="mono anim-slide text-[10px] lowercase text-accent">
            ✕ {error}
          </p>
        )}
      </div>

      <button
        type="submit"
        className="group relative w-full overflow-hidden border border-accent px-4 py-3
                   text-left focus-visible:outline-2 focus-visible:outline-offset-4
                   focus-visible:outline-accent"
      >
        {/* Accent fill retracts to the right on hover, leaving an outlined button. */}
        <span
          aria-hidden
          className="absolute inset-0 origin-left scale-x-100 bg-accent transition-transform
                     duration-500 [transition-timing-function:var(--ease-expo)]
                     group-hover:origin-right group-hover:scale-x-0"
        />
        <span className="relative flex items-center justify-between">
          <span className="font-display text-base font-bold uppercase tracking-[0.06em] text-paper transition-colors duration-300 group-hover:text-accent">
            Record expense
          </span>
          <span
            aria-hidden
            className="mono text-[9px] text-paper/70 transition-all duration-300 group-hover:translate-x-1 group-hover:text-accent"
          >
            ⌘⏎
          </span>
        </span>
      </button>
    </form>
  )
}
