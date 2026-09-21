import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../state/types'
import { analyzeMany, analyzePair } from '../engine/analyze'
import { findPatterns } from '../engine/patterns'
import { buildUnits } from '../engine/units'
import { buildReports, CLASS, getGraphemeTally, getTally, type Reports } from './aggregate'
import { cellKey, type AnalysisResult } from '../state/useAnalysis'
import type { Project, Test } from '../state/types'
import type { CategoryId } from '../data/categories'
import { CATEGORIES } from '../data/categories'

/**
 * What issue #1 actually asked for, stated as numbers.
 *
 * > if a student spells their → thar, I would want the app to show that the
 * > student correctly represented the consonant digraph /th/ but did not
 * > accurately spell the irregular/red-word portion … Not lower mastery of the
 * > consonant digraph skill when the digraph was correct.
 *
 * These tests exist because that behaviour falls out of a category assignment
 * made three files away, in `data/irregular.ts`. Nothing in the report layer
 * knows red words exist, so nothing in the report layer would catch a
 * regression — if someone deletes a table row, only these fail.
 */

const students = [{ id: 's1', name: 'Ava' }]

async function build(words: Array<{ text: string; wrote: string }>) {
  const wordRows = words.map((w, i) => ({ id: `w${i}`, text: w.text, nonsense: false }))
  const responses: Record<string, Record<string, string>> = {}
  words.forEach((w, i) => (responses[`w${i}`] = { s1: w.wrote }))

  const test: Test = {
    id: 't', name: 'T', date: '2026-01-01',
    words: wordRows, responses, overrides: {}, wordPhonemes: {},
  }
  const project: Project = {
    version: 1, students, tests: [test], activeTestId: 't', settings: { ...DEFAULT_SETTINGS },
  }

  const results = await analyzeMany(words.map((w) => ({ word: w.text, attempt: w.wrote })))
  const byCell = new Map()
  wordRows.forEach((w, i) => byCell.set(cellKey(w.id, 's1'), results[i]))

  const byWord = new Map()
  const unitsByWord = new Map()
  const patternsByWord = new Map()
  for (const w of wordRows) {
    const target = await analyzePair(w.text, '')
    const patterns = findPatterns(target.targetPhonemes, target.targetGraphemes, target.syllables, target.word)
    byWord.set(w.id, target)
    patternsByWord.set(w.id, patterns)
    unitsByWord.set(w.id, buildUnits(target, patterns))
  }

  const analysis: AnalysisResult = {
    loading: false, error: null, byCell, byWord, unitsByWord, patternsByWord,
  }
  return { reports: buildReports(project, test, analysis), analysis, byCell }
}

/** Sums the grapheme rows into a category total, the way every report does. */
function categoryTally(reports: Reports, id: CategoryId) {
  let correct = 0
  let total = 0
  for (const g of reports.graphemes) {
    if (g.category !== id) continue
    const t = getGraphemeTally(reports, g.key, 's1')
    correct += t.correct
    total += t.total
  }
  return { correct, total }
}

describe('their -> thar', () => {
  it('still credits the consonant digraph the student got right', async () => {
    const { reports } = await build([{ text: 'their', wrote: 'thar' }])
    expect(categoryTally(reports, 'consonant-digraph')).toEqual({ correct: 1, total: 1 })
  })

  it('does not blame r-controlled vowels for a memorised spelling', async () => {
    const { reports } = await build([{ text: 'their', wrote: 'thar' }])
    // The `eir` is the red part, so r-controlled never saw an opportunity at all
    // — which the reports render as "not assessed", not as 0%.
    expect(categoryTally(reports, 'r-controlled')).toEqual({ correct: 0, total: 0 })
    expect(categoryTally(reports, 'red-word')).toEqual({ correct: 0, total: 1 })
  })

  it('still counts the whole word as misspelled', async () => {
    const { byCell } = await build([{ text: 'their', wrote: 'thar' }])
    expect(byCell.get(cellKey('w0', 's1'))?.spellingCorrect).toBe(false)
  })
})

describe('said -> sed', () => {
  it('puts the error on the red-word row, not on short vowels', async () => {
    const { reports } = await build([{ text: 'said', wrote: 'sed' }])
    expect(categoryTally(reports, 'red-word')).toEqual({ correct: 0, total: 1 })
    expect(categoryTally(reports, 'short-vowel')).toEqual({ correct: 0, total: 0 })
    // The consonants either side are ordinary and still count.
    expect(categoryTally(reports, 'consonant')).toEqual({ correct: 2, total: 2 })
  })

  it('credits a student who remembered it', async () => {
    const { reports } = await build([{ text: 'said', wrote: 'said' }])
    expect(categoryTally(reports, 'red-word')).toEqual({ correct: 1, total: 1 })
  })
})

describe('the regular twin is untouched', () => {
  it('keeps ai/ā in rain on long vowels', async () => {
    const { reports } = await build([{ text: 'rain', wrote: 'rane' }])
    expect(categoryTally(reports, 'long-vowel').total).toBe(1)
    expect(categoryTally(reports, 'red-word')).toEqual({ correct: 0, total: 0 })
  })
})

describe('the By sound tabs are deliberately left alone', () => {
  /*
   * A decision, not an oversight. The by-sound reports answer "did the student
   * hear and encode this sound", which is a fair question about a red word too:
   * writing "thar" for "their" really is /ar/ where /air/ was wanted. Only the
   * spelling-side reports, which are about phonics skills, stop counting it.
   */
  it('still records the sound error for their -> thar', async () => {
    const { reports } = await build([{ text: 'their', wrote: 'thar' }])
    expect(getTally(reports, 'AIR', 's1')).toEqual({ correct: 0, total: 1 })
  })

  it('still records the sound as correct for said -> sed', async () => {
    // They heard /e/ and wrote a letter that makes /e/. By sound that is right;
    // by spelling it is a red-word miss. Both readings are true at once.
    const { reports } = await build([{ text: 'said', wrote: 'sed' }])
    expect(getTally(reports, 'E', CLASS)).toEqual({ correct: 0, total: 1 })
    expect(getTally(reports, 'E', 's1').total).toBe(1)
  })
})

describe('the category is wired up like every other one', () => {
  it('is declared, so category() will not throw on it', () => {
    const c = CATEGORIES.find((x) => x.id === 'red-word')
    expect(c?.label).toBe('Red word (irregular)')
    expect(c?.description).toContain('remembered')
  })
})
