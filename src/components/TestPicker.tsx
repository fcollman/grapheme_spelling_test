import type { Test } from '../state/types'

/**
 * Chooses which tests a report covers.
 *
 * Teachers want different windows for different conversations: the last three
 * for "how is it going now", the first three against the last three for an
 * annual review, one test for a specific lesson, or everything for a full
 * picture. Toggling individual tests covers all of those, and the shortcuts
 * cover the common ones in a click.
 */
export function TestPicker({
  tests,
  selected,
  onChange,
}: {
  /** In date order, oldest first. */
  tests: Test[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}) {
  const set = (ids: string[]) => onChange(new Set(ids))

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  const lastN = (n: number) => set(tests.slice(-n).map((t) => t.id))
  const firstN = (n: number) => set(tests.slice(0, n).map((t) => t.id))

  const allSelected = selected.size === tests.length && tests.length > 0

  return (
    <div className="testpicker no-print">
      <div className="testpicker-actions">
        <span className="testpicker-label">
          Tests included
          <strong>
            {selected.size} of {tests.length}
          </strong>
        </span>
        {/*
          Two buttons rather than one that changes label: a single toggle reading
          "Select all" gives no way to clear a partial selection.
        */}
        <button className="btn" disabled={allSelected} onClick={() => set(tests.map((t) => t.id))}>
          Select all
        </button>
        <button className="btn" disabled={selected.size === 0} onClick={() => set([])}>
          Clear
        </button>
        <button className="btn" disabled={tests.length <= 3} onClick={() => lastN(3)}>
          Last 3
        </button>
        <button className="btn" disabled={tests.length <= 3} onClick={() => firstN(3)}>
          First 3
        </button>
        <button className="btn" disabled={tests.length === 0} onClick={() => lastN(1)}>
          Most recent
        </button>
      </div>

      <div className="testpicker-list">
        {tests.map((t) => {
          const on = selected.has(t.id)
          return (
            <button
              key={t.id}
              className={`testchip ${on ? 'on' : ''}`}
              aria-pressed={on}
              onClick={() => toggle(t.id)}
              title={on ? `Remove ${t.name}` : `Add ${t.name}`}
            >
              <span className="mark">{on ? '✓' : '+'}</span>
              <span className="name">{t.name}</span>
              <span className="date">{t.date}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
