import { describe, expect, it } from 'vitest'
import { analyzeMany, analyzePair } from '../engine/analyze'
import { findPatterns } from '../engine/patterns'
import { buildUnits } from '../engine/units'
import {
  buildReports,
  CLASS,
  getConfusion,
  getGraphemeConfusion,
  getGraphemeTally,
  getMisuse,
  getTally,
  NONE,
} from './aggregate'
import { cellKey, type AnalysisResult } from '../state/useAnalysis'
import type { Project, Test } from '../state/types'
import { toCsv } from '../export/csv'

const students = [
  { id: 's1', name: 'Ava' },
  { id: 's2', name: 'Ben' },
]
const words = [
  { id: 'w1', text: 'ship', nonsense: false },
  { id: 'w2', text: 'stop', nonsense: false },
]
const responses: Record<string, Record<string, string>> = {
  w1: { s1: 'ship', s2: 'sip' }, // Ben: /sh/ -> /s/
  w2: { s1: 'stop', s2: 'sop' }, // Ben: /t/ omitted
}

async function build(overrides: Partial<Project['settings']> = {}) {
  const test: Test = { id: 't', name: 'T', date: '2026-01-01', words, responses, overrides: {}, wordPhonemes: {} }
  const project: Project = {
    version: 1,
    students,
    tests: [test],
    activeTestId: 't',
    settings: { notation: 'sound', lenientSchwa: true, amberCountsCorrect: false, anonymize: false, ...overrides },
  }

  const pairs = words.flatMap((w) => students.map((s) => ({ word: w.text, attempt: responses[w.id][s.id] })))
  const results = await analyzeMany(pairs)

  const byCell = new Map()
  let i = 0
  for (const w of words) for (const s of students) byCell.set(cellKey(w.id, s.id), results[i++])

  const byWord = new Map()
  const unitsByWord = new Map()
  const patternsByWord = new Map()
  for (const w of words) {
    const target = await analyzePair(w.text, '')
    const patterns = findPatterns(target.targetPhonemes, target.targetGraphemes, target.syllables, target.word)
    byWord.set(w.id, target)
    patternsByWord.set(w.id, patterns)
    unitsByWord.set(w.id, buildUnits(target, patterns))
  }

  const analysis: AnalysisResult = {
    loading: false,
    error: null,
    byCell,
    byWord,
    unitsByWord,
    patternsByWord,
  }

  return { reports: buildReports(project, test, analysis), project, test }
}

describe('report aggregation', () => {
  it('counts accuracy per student and for the class', async () => {
    const { reports } = await build()
    // /sh/ appears once, in "ship": Ava right, Ben wrong.
    expect(getTally(reports, 'SH', 's1')).toEqual({ correct: 1, total: 1 })
    expect(getTally(reports, 'SH', 's2')).toEqual({ correct: 0, total: 1 })
    expect(getTally(reports, 'SH', CLASS)).toEqual({ correct: 1, total: 2 })
    // /p/ appears in both words, both students correct.
    expect(getTally(reports, 'P', CLASS)).toEqual({ correct: 4, total: 4 })
  })

  it('reports a phoneme that never came up as 0/0 rather than as failure', async () => {
    const { reports } = await build()
    expect(getTally(reports, 'ZH', 's1')).toEqual({ correct: 0, total: 0 })
    expect(reports.phonemes).not.toContain('ZH')
  })

  it('counts a substituted sound as misuse by the student who produced it', async () => {
    const { reports } = await build()
    // Ben wrote /s/ where /sh/ was needed, so /s/ is over-used by Ben only.
    expect(getMisuse(reports, 'S', 's2')).toBe(1)
    expect(getMisuse(reports, 'S', 's1')).toBe(0)
    expect(getMisuse(reports, 'S', CLASS)).toBe(1)
  })

  it('places correct answers on the confusion diagonal and errors off it', async () => {
    const { reports } = await build()
    expect(getConfusion(reports, CLASS, 'SH', 'SH')).toBe(1)
    expect(getConfusion(reports, CLASS, 'SH', 'S')).toBe(1)
    expect(getConfusion(reports, 's2', 'SH', 'S')).toBe(1)
    expect(getConfusion(reports, 's1', 'SH', 'S')).toBe(0)
  })

  it('records an omission in the ∅ column', async () => {
    const { reports } = await build()
    expect(getConfusion(reports, 's2', 'T', NONE)).toBe(1)
    expect(getConfusion(reports, 's1', 'T', NONE)).toBe(0)
  })

  it('lets amber count as correct when the teacher asks it to', async () => {
    const strict = await build({ amberCountsCorrect: false })
    const lenient = await build({ amberCountsCorrect: true })
    // "sip" for "ship" is a wrong sound either way, so /sh/ must not move.
    expect(getTally(strict.reports, 'SH', CLASS).correct).toBe(1)
    expect(getTally(lenient.reports, 'SH', CLASS).correct).toBe(1)
  })
})

describe('grapheme reports', () => {
  it('lists each grapheme unit once, grouped by category', async () => {
    const { reports } = await build()
    const keys = reports.graphemes.map((g) => `${g.letters}=${g.phonemes.join('+')}`)
    // "ship" gives sh/i/p, "stop" gives s/t/o/p — p and s appear in both but once here.
    expect(keys).toContain('sh=SH')
    expect(keys.filter((k) => k === 'p=P')).toHaveLength(1)

    const categories = reports.graphemes.map((g) => g.category)
    expect(categories).toContain('consonant-digraph')
    expect(categories).toContain('short-vowel')
  })

  it('counts grapheme accuracy per student', async () => {
    const { reports } = await build()
    const sh = reports.graphemes.find((g) => g.letters === 'sh')!
    // Ava wrote "ship", Ben wrote "sip".
    expect(getGraphemeTally(reports, sh.key, 's1')).toEqual({ correct: 1, total: 1 })
    expect(getGraphemeTally(reports, sh.key, 's2')).toEqual({ correct: 0, total: 1 })
    expect(getGraphemeTally(reports, sh.key, CLASS)).toEqual({ correct: 1, total: 2 })
  })

  it('records which spelling was written for which', async () => {
    const { reports } = await build()
    const sh = reports.graphemes.find((g) => g.letters === 'sh')!
    expect(getGraphemeConfusion(reports, 's2', sh.key, 's')).toBe(1)
    expect(getGraphemeConfusion(reports, 's1', sh.key, 'sh')).toBe(1)
  })

  it('reports a blend even though it is not a column of its own', async () => {
    // Regression: blends deliberately stay as separate columns, so "st" is only a
    // tag in the grid. It still has to appear in the report, since blends are one
    // of the categories being tracked.
    const { reports } = await build()
    const blend = reports.graphemes.find((g) => g.category === 'blend-initial' && g.patternLabel === 'st')
    expect(blend, `no blend row in: ${reports.graphemes.map((g) => g.patternLabel ?? g.letters).join(', ')}`)
      .toBeDefined()
    expect(blend!.kind).toBe('pattern')
    expect(blend!.phonemes).toEqual(['S', 'T'])
  })

  it('counts a blend wrong when any sound inside it is wrong', async () => {
    const { reports } = await build()
    const blend = reports.graphemes.find((g) => g.category === 'blend-initial' && g.patternLabel === 'st')!
    // Ava wrote "stop", Ben wrote "sop" — Ben lost the /t/, so his "st" fails.
    expect(getGraphemeTally(reports, blend.key, 's1')).toEqual({ correct: 1, total: 1 })
    expect(getGraphemeTally(reports, blend.key, 's2')).toEqual({ correct: 0, total: 1 })
    expect(getGraphemeTally(reports, blend.key, CLASS)).toEqual({ correct: 1, total: 2 })
  })

  it('does not double count a collapsed chunk as both column and pattern', async () => {
    const { reports } = await build()
    const patternRows = reports.graphemes.filter((g) => g.kind === 'pattern')
    // Velar nasal and consonant-le are already columns, so they must not also
    // appear as spanning-pattern rows.
    expect(patternRows.some((g) => g.category === 'velar-nasal')).toBe(false)
    expect(patternRows.some((g) => g.category === 'consonant-le')).toBe(false)
  })

  it('records a missing spelling in the ∅ column', async () => {
    const { reports } = await build()
    const t = reports.graphemes.find((g) => g.letters === 't' && g.phonemes.join() === 'T')!
    // Ben wrote "sop" for "stop", so nothing was written for the t.
    expect(getGraphemeConfusion(reports, 's2', t.key, NONE)).toBe(1)
  })
})

describe('csv', () => {
  it('quotes fields that would otherwise break a row', () => {
    const csv = toCsv([
      ['plain', 'has,comma', 'has"quote', 'has\nnewline'],
    ])
    expect(csv).toContain('plain,"has,comma","has""quote","has\nnewline"')
  })

  it('starts with a BOM so Excel reads IPA correctly', () => {
    expect(toCsv([['/ʃ/']]).startsWith('﻿')).toBe(true)
  })

  it('uses CRLF line endings', () => {
    expect(toCsv([['a'], ['b']])).toBe('﻿a\r\nb\r\n')
  })
})
