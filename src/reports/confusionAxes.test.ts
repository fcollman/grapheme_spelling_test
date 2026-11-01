import { describe, expect, it } from 'vitest'
import { confusionColumns, trimToConfusions } from './confusionAxes'

const NONE = '∅'

/**
 * These exist because "hide empty rows and columns" was reported as doing
 * nothing on the grapheme confusion sheet. It was not a broken checkbox: the
 * columns were built from what students wrote, so a column existed exactly when
 * someone had written in it and none could ever be empty. The same gap left
 * targets nobody spelled correctly with no column to be correct in, so there
 * was no complete diagonal to show.
 */

describe('building the column axis', () => {
  it('gives every target a column, including ones nobody wrote', () => {
    // "ck" was never written by anyone. Without a column it has no diagonal
    // cell, and the row cannot show a correct answer even in principle.
    const cols = confusionColumns(['ai', 'ck', 'sh'], ['ai', 'sh', 'k'], NONE)
    expect(cols).toContain('ck')
  })

  it('orders columns to match the rows, so the diagonal runs diagonally', () => {
    // Alphabetical columns against teaching-order rows scatter the correct
    // answers; this is what makes them line up.
    const cols = confusionColumns(['sh', 'ai', 'ck'], ['ai', 'ck', 'sh'], NONE)
    expect(cols.slice(0, 3)).toEqual(['sh', 'ai', 'ck'])
  })

  it('puts spellings that were never a target after the targets', () => {
    const cols = confusionColumns(['ai'], ['ai', 'zz'], NONE)
    expect(cols).toEqual(['ai', 'zz', NONE])
  })

  it('keeps "nothing written" last and only once', () => {
    const cols = confusionColumns(['ai'], [NONE, 'a', NONE], NONE)
    expect(cols).toEqual(['ai', 'a', NONE])
    expect(cols.filter((c) => c === NONE)).toHaveLength(1)
  })

  it('never repeats a column when a spelling is both target and written', () => {
    const cols = confusionColumns(['ai', 'ai'], ['ai'], NONE)
    expect(cols).toEqual(['ai', NONE])
  })
})

describe('trimming to what was actually confused', () => {
  /*
   *        sh   ck   s    ∅        "sh" was written as "s" twice and left
   *   sh    4    .   2    .        blank once; "ck" was always right; "ai"
   *   ck    .    3   .    .        never came up at all.
   *   ai    .    .   .    .
   */
  const rows = ['sh', 'ck', 'ai']
  const cols = ['sh', 'ck', 's', NONE]
  const counts: Record<string, Record<string, number>> = {
    sh: { sh: 4, s: 2, [NONE]: 1 },
    ck: { ck: 3 },
  }
  const count = (r: string, c: string) => counts[r]?.[c] ?? 0
  const isDiagonal = (r: string, c: string) => r === c
  const trim = () => trimToConfusions(rows, cols, count, isDiagonal)

  it('keeps only the rows that were confused with something', () => {
    // "ck" was spelled correctly three times and never wrongly. That is a
    // diagonal entry, not a confusion, so the row has nothing to show.
    expect(trim().rows).toEqual(['sh'])
  })

  it('keeps only the columns something landed in wrongly', () => {
    // This is the regression. Counting any entry at all kept every column
    // alive on the strength of its own diagonal, so ticking the box changed
    // nothing and the control looked broken.
    expect(trim().cols).toEqual(['s', NONE])
  })

  it('does not let a diagonal entry hold a row or column up', () => {
    const allCorrect = (r: string, c: string) => (r === c ? 5 : 0)
    const trimmed = trimToConfusions(rows, cols, allCorrect, isDiagonal)
    expect(trimmed.rows).toEqual([])
    expect(trimmed.cols).toEqual([])
  })

  it('counts a blank as a confusion, since writing nothing is an error', () => {
    expect(trim().cols).toContain(NONE)
  })

  it('leaves the full axes alone, so the complete grid is still reachable', () => {
    trim()
    expect(rows).toEqual(['sh', 'ck', 'ai'])
    expect(cols).toEqual(['sh', 'ck', 's', NONE])
  })
})

describe('the two together, as the sheet uses them', () => {
  it('shows a complete diagonal untrimmed, and only the errors trimmed', () => {
    const targets = ['sh', 'ck', 'ai']
    const written = ['s', 'sh', 'a']
    const counts: Record<string, Record<string, number>> = {
      sh: { sh: 4, s: 2 },
      ck: { ck: 3 },
      ai: { a: 1 },
    }
    const count = (r: string, c: string) => counts[r]?.[c] ?? 0

    const cols = confusionColumns(targets, written, NONE)
    // Untrimmed, every row can meet its own column: that is the diagonal.
    for (const t of targets) expect(cols).toContain(t)

    const trimmed = trimToConfusions(targets, cols, count, (r, c) => r === c)
    expect(trimmed.rows).toEqual(['sh', 'ai'])
    expect(trimmed.cols).toEqual(['s', 'a'])
  })
})
