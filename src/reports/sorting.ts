/**
 * Spreadsheet-style column sorting for the accuracy sheets.
 *
 * The sheets are built in a teaching order — the scope and sequence for
 * spellings, the sound chart for phonemes — which is the right way to read them
 * when you are planning. It is the wrong way to read them when the question is
 * "what is this class worst at", because that answer is scattered down the
 * page. Sorting by a column answers that question in one click, and sorting by
 * a student's column asks it of one child.
 */

export interface SortState {
  columnId: string
  /** `asc` puts the lowest score first, which is the order teachers ask for. */
  direction: 'asc' | 'desc'
}

export interface Tally {
  correct: number
  total: number
}

/**
 * Clicking a column cycles worst first, best first, then back to the sheet's
 * own order.
 *
 * The third state matters: the teaching order is the only one that shows what
 * was taught alongside what it is usually taught with, so there has to be a way
 * back to it that is not "reload the page".
 */
export function nextSort(current: SortState | null, columnId: string): SortState | null {
  if (current === null || current.columnId !== columnId) return { columnId, direction: 'asc' }
  if (current.direction === 'asc') return { columnId, direction: 'desc' }
  return null
}

/**
 * Rows in the order the chosen column puts them, or unchanged when nothing is
 * chosen.
 *
 * @param tallyOf the score a row has in a given column
 * @param labelOf how the row is labelled, used only to break exact ties so the
 *   order does not shuffle between renders
 */
export function sortRows<T>(
  rows: readonly T[],
  sort: SortState | null,
  tallyOf: (row: T, columnId: string) => Tally,
  labelOf: (row: T) => string,
): T[] {
  if (sort === null) return [...rows]

  const score = (row: T) => tallyOf(row, sort.columnId)

  return [...rows].sort((a, b) => {
    const ta = score(a)
    const tb = score(b)

    /*
     * Anything that never came up sinks to the bottom whichever way round the
     * sort is. A blank cell is the absence of a score, not a bad one, and
     * letting 0 of 0 lead a "worst first" list would bury the real answer under
     * sounds the test never asked for.
     */
    if (ta.total === 0 || tb.total === 0) {
      if (ta.total === tb.total) return labelOf(a).localeCompare(labelOf(b))
      return ta.total === 0 ? 1 : -1
    }

    const fa = ta.correct / ta.total
    const fb = tb.correct / tb.total
    if (fa !== fb) return sort.direction === 'asc' ? fa - fb : fb - fa

    // Same percentage: the one with more attempts behind it is the firmer
    // finding, so it leads regardless of direction.
    if (ta.total !== tb.total) return tb.total - ta.total

    return labelOf(a).localeCompare(labelOf(b))
  })
}

/** What the header button says it will do, so a click is never a guess. */
export function sortHint(sort: SortState | null, columnId: string, label: string, naturalOrder: string): string {
  if (sort?.columnId !== columnId) return `Sort by ${label}, worst first`
  return sort.direction === 'asc'
    ? `Sorted worst first — click for best first`
    : `Sorted best first — click to go back to ${naturalOrder}`
}
