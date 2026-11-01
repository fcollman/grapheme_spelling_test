import { sortHint, type SortState } from '../reports/sorting'

/**
 * A column heading that sorts the sheet by its own numbers.
 *
 * The arrow is always there rather than appearing on hover, because a teacher
 * has to be able to see that the sheet can be sorted without first discovering
 * it by accident.
 */
export function SortHeader({
  columnId,
  label,
  sort,
  onSort,
  naturalOrder,
  className,
}: {
  columnId: string
  label: string
  sort: SortState | null
  onSort: (columnId: string) => void
  /** What a third click returns to, named in the tooltip. */
  naturalOrder: string
  className?: string
}) {
  const active = sort?.columnId === columnId
  const direction = active ? sort.direction : null

  return (
    <th
      className={`sortable ${active ? 'sorted' : ''} ${className ?? ''}`}
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button className="sortbtn" onClick={() => onSort(columnId)} title={sortHint(sort, columnId, label, naturalOrder)}>
        <span className="sortlabel">{label}</span>
        {/* Unsorted columns show a faint double arrow; the sorted one shows which way. */}
        <span className={`sortmark ${active ? 'on' : ''}`} aria-hidden="true">
          {direction === 'asc' ? '▲' : direction === 'desc' ? '▼' : '⇅'}
        </span>
      </button>
    </th>
  )
}
