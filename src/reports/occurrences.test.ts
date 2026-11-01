import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../state/types'
import { analyzeTest, collectNorms, type TestAnalysis } from '../state/useAnalysis'
import {
  buildReportsAcross,
  CLASS,
  getGraphemeTally,
  getTally,
  getConfusion,
  getGraphemeConfusion,
  getMisuse,
  NONE,
  type ReportSource,
} from './aggregate'
import { findOccurrences } from './occurrences'
import type { Project, Test } from '../state/types'

const students = [
  { id: 's1', name: 'Ava' },
  { id: 's2', name: 'Ben' },
  { id: 's3', name: 'Cruz' },
]

const test: Test = {
  id: 't1',
  name: 'Unit 1',
  date: '2026-01-10',
  words: [
    { id: 'w1', text: 'ship', nonsense: false },
    { id: 'w2', text: 'cat', nonsense: false },
    { id: 'w3', text: 'stop', nonsense: false },
    { id: 'w4', text: 'bank', nonsense: false },
  ],
  responses: {
    w1: { s1: 'ship', s2: 'sip', s3: 'ship' },
    w2: { s1: 'cat', s2: 'kat', s3: 'cet' },
    w3: { s1: 'stop', s2: 'sop', s3: 'stop' },
    w4: { s1: 'bank', s2: 'bak', s3: 'bank' },
  },
  overrides: {},
  wordPhonemes: {},
}

const project: Project = {
  version: 1,
  students,
  tests: [test],
  activeTestId: 't1',
  settings: { ...DEFAULT_SETTINGS },
}

async function setup() {
  const norms = await collectNorms(project, project.tests)
  const analysis: TestAnalysis = analyzeTest(project, test, norms, { lenientSchwa: true })
  const sources: ReportSource[] = [{ test, analysis }]
  return { sources, reports: buildReportsAcross(project, sources) }
}

const drillFor = (over: Partial<Parameters<typeof findOccurrences>[1]>) => ({
  kind: 'grapheme' as const,
  key: '',
  label: '',
  studentId: CLASS,
  sources: [] as ReportSource[],
  scopeLabel: 'Unit 1',
  ...over,
})

describe('drilling into an accuracy figure', () => {
  /**
   * The whole point: the list shown must be exactly what the number counted. If
   * these drift, the modal quietly contradicts the cell that opened it.
   */
  it('returns one row per counted opportunity, for every grapheme and student', async () => {
    const { sources, reports } = await setup()

    for (const g of reports.graphemes) {
      for (const who of [...students.map((s) => s.id), CLASS]) {
        const tally = getGraphemeTally(reports, g.key, who)
        const rows = findOccurrences(project, drillFor({ kind: 'grapheme', key: g.key, studentId: who, sources }))

        expect(rows.length, `${g.letters} (${g.key}) for ${who}`).toBe(tally.total)
        expect(rows.filter((r) => r.mark === 'exact').length, `${g.letters} correct for ${who}`).toBe(
          tally.correct,
        )
      }
    }
  })

  it('matches the phoneme tallies too', async () => {
    const { sources, reports } = await setup()

    for (const p of reports.phonemes) {
      for (const who of [...students.map((s) => s.id), CLASS]) {
        const tally = getTally(reports, p, who)
        const rows = findOccurrences(project, drillFor({ kind: 'phoneme', key: p, studentId: who, sources }))
        expect(rows.length, `${p} for ${who}`).toBe(tally.total)
      }
    }
  })

  it('carries the evidence a teacher needs to see', async () => {
    const { sources, reports } = await setup()
    const sh = reports.graphemes.find((g) => g.letters === 'sh')!
    const rows = findOccurrences(project, drillFor({ key: sh.key, studentId: 's2', sources }))

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      word: 'ship',
      attempt: 'sip',
      targetLetters: 'sh',
      wroteLetters: 's',
      mark: 'wrong',
      testName: 'Unit 1',
    })
  })

  it('includes a blend row, which has no column of its own', async () => {
    const { sources, reports } = await setup()
    const blend = reports.graphemes.find((g) => g.patternLabel === 'st')!
    const rows = findOccurrences(project, drillFor({ key: blend.key, studentId: CLASS, sources }))

    expect(rows.length).toBe(getGraphemeTally(reports, blend.key, CLASS).total)
    // Ben wrote "sop", losing the /t/, so his "st" is wrong.
    expect(rows.find((r) => r.studentId === 's2')?.mark).toBe('wrong')
  })

  it('collects a whole category across its graphemes', async () => {
    const { sources, reports } = await setup()
    const shortVowelTotal = reports.graphemes
      .filter((g) => g.category === 'short-vowel')
      .reduce((n, g) => n + getGraphemeTally(reports, g.key, 's1').total, 0)

    const rows = findOccurrences(
      project,
      drillFor({ kind: 'category', key: 'short-vowel', studentId: 's1', sources }),
    )
    expect(rows.length).toBe(shortVowelTotal)
  })

  it('separates a plausible spelling from a wrong sound', async () => {
    const { sources, reports } = await setup()
    const c = reports.graphemes.find((g) => g.letters === 'c' && g.phonemes.join() === 'K')!
    const rows = findOccurrences(project, drillFor({ key: c.key, studentId: CLASS, sources }))

    // Ben wrote "kat": right sound, other spelling. Cruz wrote "cet": c is fine.
    expect(rows.find((r) => r.studentId === 's2')?.mark).toBe('plausible')
    expect(rows.find((r) => r.studentId === 's3')?.mark).toBe('exact')
  })

  it('matches every cell of the grapheme confusion matrix', async () => {
    const { sources, reports } = await setup()

    for (const g of reports.graphemes) {
      for (const written of reports.writtenSpellings) {
        for (const who of ['s1', CLASS]) {
          const count = getGraphemeConfusion(reports, who, g.key, written)
          const rows = findOccurrences(
            project,
            drillFor({ kind: 'grapheme', key: g.key, studentId: who, sources, produced: written }),
          )
          expect(rows.length, `${g.letters} -> "${written}" for ${who}`).toBe(count)
        }
      }
    }
  })

  it('matches every cell of the phoneme confusion matrix, including ∅', async () => {
    const { sources, reports } = await setup()
    const targets = [...reports.phonemes, NONE]
    const produced = [...reports.producedPhonemes, NONE]

    for (const target of targets) {
      for (const p of produced) {
        for (const who of ['s2', CLASS]) {
          const count = getConfusion(reports, who, target, p)
          const rows = findOccurrences(
            project,
            drillFor({ kind: 'phoneme', key: target, studentId: who, sources, produced: p }),
          )
          expect(rows.length, `${target} -> ${p} for ${who}`).toBe(count)
        }
      }
    }
  })

  it('reads a confusion cell as the specific swap it counts', async () => {
    const { sources, reports } = await setup()
    const sh = reports.graphemes.find((g) => g.letters === 'sh')!

    // Ben wrote "sip" for "ship": "s" where "sh" was needed.
    const swapped = findOccurrences(
      project,
      drillFor({ key: sh.key, studentId: CLASS, sources, produced: 's' }),
    )
    expect(swapped).toHaveLength(1)
    expect(swapped[0]).toMatchObject({ word: 'ship', wroteLetters: 's', producedKey: 's' })

    // And the diagonal holds the two who got it right.
    const right = findOccurrences(
      project,
      drillFor({ key: sh.key, studentId: CLASS, sources, produced: 'sh' }),
    )
    expect(right.map((r) => r.studentId).sort()).toEqual(['s1', 's3'])
  })

  it('matches the misuse counts for every sound and student', async () => {
    const { sources, reports } = await setup()

    for (const p of reports.producedPhonemes) {
      for (const who of [...students.map((s) => s.id), CLASS]) {
        const count = getMisuse(reports, p, who)
        const rows = findOccurrences(
          project,
          drillFor({ kind: 'misuse', key: p, studentId: who, sources }),
        )
        expect(rows.length, `misuse of ${p} for ${who}`).toBe(count)
      }
    }
  })

  it('reads a misuse cell as a sound reached for where it was not wanted', async () => {
    const { sources } = await setup()
    // Cruz wrote "cet" for "cat", so /e/ turned up where /a/ was needed.
    const rows = findOccurrences(project, drillFor({ kind: 'misuse', key: 'E', studentId: 's3', sources }))

    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0]).toMatchObject({ word: 'cat', attempt: 'cet', wroteLetters: 'e' })
    // Never lists a sound the word actually called for.
    expect(rows.every((r) => r.sounds[0] !== 'E')).toBe(true)
  })

  /**
   * Regression. "bombastic" carries an unstressed schwa spelled "o", so a student
   * who writes "o" produces /o/ — which the lenient-schwa setting accepts. That
   * answer used to be counted correct by the accuracy report while also appearing
   * as a /ə/ → /o/ swap in the confusion matrix, so drilling into an off-diagonal
   * cell showed a list of rows all saying "correct".
   */
  describe('a sound the marking accepted', () => {
    const schwaTest: Test = {
      id: 'ts',
      name: 'Schwa',
      date: '2026-02-01',
      words: [{ id: 'ws', text: 'bombastic', nonsense: false }],
      responses: { ws: { s1: 'bombastic', s2: 'bombastick', s3: 'bomback' } },
      overrides: {},
      wordPhonemes: {},
    }

    async function build(lenientSchwa: boolean) {
      const p: Project = {
        ...project,
        tests: [schwaTest],
        activeTestId: 'ts',
        settings: { ...project.settings, lenientSchwa },
      }
      const norms = await collectNorms(p, p.tests)
      const analysis = analyzeTest(p, schwaTest, norms, { lenientSchwa })
      const sources: ReportSource[] = [{ test: schwaTest, analysis }]
      return { p, sources, reports: buildReportsAcross(p, sources) }
    }

    it('sits on the diagonal, not off it, when lenient schwa is on', async () => {
      const { reports } = await build(true)
      expect(getConfusion(reports, CLASS, 'SCHWA', 'O')).toBe(0)
      expect(getConfusion(reports, CLASS, 'SCHWA', 'SCHWA')).toBeGreaterThan(0)
      // And it is not a misuse of /o/ either, since /o/ was accepted here.
      expect(getMisuse(reports, 'O', CLASS)).toBe(0)
    })

    it('is a real confusion again when lenient schwa is off', async () => {
      const { reports } = await build(false)
      expect(getConfusion(reports, CLASS, 'SCHWA', 'O')).toBeGreaterThan(0)
      expect(getMisuse(reports, 'O', CLASS)).toBeGreaterThan(0)
    })

    it('never shows a row marked correct under an off-diagonal cell', async () => {
      for (const lenient of [true, false]) {
        const { p, sources, reports } = await build(lenient)
        for (const produced of [...reports.producedPhonemes, NONE]) {
          if (produced === 'SCHWA') continue // the diagonal may of course be correct
          const rows = findOccurrences(p, {
            kind: 'phoneme',
            key: 'SCHWA',
            label: '',
            studentId: CLASS,
            sources,
            scopeLabel: '',
            produced,
          })
          const wronglyCorrect = rows.filter((r) => r.mark === 'exact' || r.mark === 'plausible')
          expect(wronglyCorrect, `lenient=${lenient}, /ə/ -> ${produced}`).toEqual([])
        }
      }
    })
  })

  it('skips words a student did not attempt', async () => {
    const blank: Test = { ...test, id: 't2', responses: { ...test.responses, w1: { s1: '', s2: '', s3: '' } } }
    const blankProject: Project = { ...project, tests: [blank], activeTestId: 't2' }
    const norms = await collectNorms(blankProject, blankProject.tests)
    const sources: ReportSource[] = [
      { test: blank, analysis: analyzeTest(blankProject, blank, norms, { lenientSchwa: true }) },
    ]
    const reports = buildReportsAcross(blankProject, sources)
    const sh = reports.graphemes.find((g) => g.letters === 'sh')!

    expect(getGraphemeTally(reports, sh.key, CLASS).total).toBe(0)
    expect(findOccurrences(blankProject, drillFor({ key: sh.key, studentId: CLASS, sources }))).toEqual([])
  })
})
