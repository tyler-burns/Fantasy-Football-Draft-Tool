import { useId, useState } from 'react'
import styles from './NumberField.module.css'

interface NumberFieldProps {
  readonly label: string
  readonly value: number
  readonly step?: number
  readonly hint?: string
  /** Returns an error message, or null if valid. Runs before onCommit. */
  readonly validate?: (value: number) => string | null
  readonly onCommit: (value: number) => void
}

/** <input type="number"> gives "" when cleared and allows transient invalid
 * states ("-", "1e"). Never dispatch raw values into app state: keep the raw
 * string locally, parse+validate on change, and only commit on success --
 * but leave the last-good value rendered so the app keeps working while the
 * field is mid-edit. Direct analogue of the Python constructors' validation,
 * without the app crashing mid-keystroke. */
export function NumberField({ label, value, step = 0.1, hint, validate, onCommit }: NumberFieldProps) {
  const [raw, setRaw] = useState(String(value))
  const [error, setError] = useState<string | null>(null)
  const [lastValue, setLastValue] = useState(value)
  const id = useId()

  // If the committed value changes from outside (e.g. a preset was
  // selected), sync the displayed text -- but not while the user still has
  // an uncommitted edit in flight with an error showing. Adjusted during
  // render (React's recommended pattern for "derive state from a prop
  // change") rather than an effect, so there's no extra render pass.
  if (value !== lastValue) {
    setLastValue(value)
    if (error === null) setRaw(String(value))
  }

  function handleChange(text: string) {
    setRaw(text)
    if (text.trim() === '') {
      setError('required')
      return
    }
    const parsed = Number(text)
    if (!Number.isFinite(parsed)) {
      setError('not a number')
      return
    }
    const problem = validate?.(parsed) ?? null
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    onCommit(parsed)
  }

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        step={step}
        className={`${styles.input} ${error ? styles.invalid : ''}`}
        value={raw}
        onChange={(e) => handleChange(e.target.value)}
      />
      {error ? <span className={styles.error}>{error}</span> : hint ? <span className={styles.hint}>{hint}</span> : null}
    </div>
  )
}
