import { describe, expect, it } from 'vitest'
import { nextSort, sortRows, type SortState, type Tally } from './sorting'

/**
 * The sheets are built in teaching order; sorting is how a teacher asks "what
 * is this class worst at" without reading down the whole page. These pin down
 * the parts that are easy to get subtly wrong — what happens to rows nothing
 * was asked about, and what happens to ties.
 */

interface Row {
  label: string
  cells: Record<string, Tally>
}

const row = (label: string, cells: Record<string, [number, number]>): Row => ({
  label,
  cells: Object.fromEntries(Object.entries(cells).map(([k, [c, t]]) => [k, { correct: c, total: t }])),
})

const order = (rows: Row[], sort: SortState | null) =>
  sortRows(rows, sort, (r, c) => r.cells[c] ?? { correct: 0, total: 0 }, (r) => r.label).map((r) => r.label)

describe('cycling a column', () => {
  it('goes worst first, best first, then back to the sheet order', () => {
    const a = nextSort(null, 'class')
    expect(a).toEqual({ columnId: 'class', direction: 'asc' })

    const b = nextSort(a, 'class')
    expect(b).toEqual({ columnId: 'class', direction: 'desc' })

    // The teaching order has to be reachable again, not just by reloading.
    expect(nextSort(b, 'class')).toBeNull()
  })

  it('starts a different column over at worst first', () => {
    const onClass: SortState = { columnId: 'class', direction: 'desc' }
    expect(nextSort(onClass, 'stu1')).toEqual({ columnId: 'stu1', direction: 'asc' })
  })
})

describe('sorting rows by a column', () => {
  const rows = [
    row('ai', { class: [1, 4] }), // 25%
    row('ea', { class: [3, 4] }), // 75%
    row('oa', { class: [2, 4] }), // 50%
  ]

  it('leaves the sheet alone when nothing is chosen', () => {
    expect(order(rows, null)).toEqual(['ai', 'ea', 'oa'])
  })

  it('puts the worst first, and reverses', () => {
    expect(order(rows, { columnId: 'class', direction: 'asc' })).toEqual(['ai', 'oa', 'ea'])
    expect(order(rows, { columnId: 'class', direction: 'desc' })).toEqual(['ea', 'oa', 'ai'])
  })

  it('sorts one student without regard to the rest of the class', () => {
    const byStudent = [
      row('ai', { class: [1, 4], stu1: [2, 2] }),
      row('ea', { class: [3, 4], stu1: [0, 2] }),
    ]
    expect(order(byStudent, { columnId: 'stu1', direction: 'asc' })).toEqual(['ea', 'ai'])
  })
})

describe('rows with nothing to score', () => {
  const rows = [
    row('never', { class: [0, 0] }),
    row('bad', { class: [1, 4] }),
    row('good', { class: [4, 4] }),
  ]

  it('sinks them whichever way the sort runs', () => {
    // 0 of 0 is the absence of a score, not a bad one — leading a "worst first"
    // list with it would bury the real answer.
    expect(order(rows, { columnId: 'class', direction: 'asc' })).toEqual(['bad', 'good', 'never'])
    expect(order(rows, { columnId: 'class', direction: 'desc' })).toEqual(['good', 'bad', 'never'])
  })
})

describe('ties', () => {
  it('leads with the score that has more behind it', () => {
    const rows = [row('thin', { class: [1, 2] }), row('thick', { class: [10, 20] })]
    // Both 50%, but twenty attempts is a firmer finding than two.
    expect(order(rows, { columnId: 'class', direction: 'asc' })).toEqual(['thick', 'thin'])
    expect(order(rows, { columnId: 'class', direction: 'desc' })).toEqual(['thick', 'thin'])
  })

  it('falls back to the label, so the order never shuffles', () => {
    const rows = [row('oa', { class: [1, 2] }), row('ai', { class: [1, 2] })]
    expect(order(rows, { columnId: 'class', direction: 'asc' })).toEqual(['ai', 'oa'])
  })
})
