import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type Project, type Test } from '../state/types'
import { analyzeTest, collectNorms } from '../state/useAnalysis'
import { buildReportsAcross, CLASS, type ReportSource } from './aggregate'
import { compareGraphemes, comparePhonemes, MIN_EVIDENCE } from './compare'
import { findOccurrences, type Occurrence } from './occurrences'

/**
 * Opening a figure on the two comparison sheets.
 *
 * Every other accuracy sheet lets a teacher click a number and see the answers
 * behind it, and these two have to as well or the headline figure is something
 * she has to take on trust. The twist is that a row's last column is made of
 * both directions at once, so the list behind it holds spelling and reading
 * together — and each answer has to say which it was.
 */

const students = [
  { id: 's1', name: 'Ava' },
  { id: 's2', name: 'Ben' },
]

const spelling: Test = {
  id: 'spell',
  name: 'Unit 1',
  date: '2026-01-10',
  words: [
    { id: 'w1', text: 'ship', nonsense: false },
    { id: 'w2', text: 'cat', nonsense: false },
  ],
  responses: {
    w1: { s1: 'ship', s2: 'sip' },
    w2: { s1: 'cat', s2: 'kat' },
  },
  overrides: {},
  wordPhonemes: {},
}

const reading: Test = {
  id: 'read',
  name: 'Reading · The shop',
  date: '2026-02-10',
  kind: 'reading',
  passage: 'shop chat',
  words: [
    { id: 'r1', text: 'shop', nonsense: false, start: 0, end: 4 },
    { id: 'r2', text: 'chat', nonsense: false, start: 5, end: 9 },
  ],
  responses: {
    r1: { s1: 'shop', s2: 'sop' },
    r2: { s1: 'chat', s2: 'chat' },
  },
  overrides: {},
  wordPhonemes: {},
}

const project: Project = {
  version: 1,
  students,
  tests: [spelling, reading],
  activeTestId: 'spell',
  settings: { ...DEFAULT_SETTINGS },
}

async function setup() {
  const norms = await collectNorms(project, project.tests)
  const source = (test: Test): ReportSource => ({
    test,
    analysis: analyzeTest(project, test, norms, { lenientSchwa: true }),
  })
  const encoding = [source(spelling)]
  const decoding = [source(reading)]
  return {
    encoding,
    decoding,
    encodingReports: buildReportsAcross(project, encoding),
    decodingReports: buildReportsAcross(project, decoding),
  }
}

const drill = (over: Partial<Parameters<typeof findOccurrences>[1]>) => ({
  kind: 'grapheme' as const,
  key: '',
  label: '',
  studentId: CLASS,
  sources: [] as ReportSource[],
  scopeLabel: 'both',
  ...over,
})

describe('opening a cell on a comparison sheet', () => {
  it('lists exactly the answers each side counted, for every row and student', async () => {
    const { encoding, decoding, encodingReports, decodingReports } = await setup()

    for (const who of [...students.map((s) => s.id), CLASS]) {
      const rows = compareGraphemes(encodingReports, decodingReports, who, MIN_EVIDENCE)
      expect(rows.length).toBeGreaterThan(0)

      for (const r of rows) {
        const spelled = findOccurrences(project, drill({ key: r.key, studentId: who, sources: encoding }))
        const read = findOccurrences(project, drill({ key: r.key, studentId: who, sources: decoding }))

        expect(spelled.length, `${r.key} spelled by ${who}`).toBe(r.encoding.total)
        expect(read.length, `${r.key} read by ${who}`).toBe(r.decoding.total)
      }
    }
  })

  it('matches the sound rows too', async () => {
    const { encoding, decoding, encodingReports, decodingReports } = await setup()
    const rows = comparePhonemes(encodingReports, decodingReports, CLASS, MIN_EVIDENCE)
    expect(rows.length).toBeGreaterThan(0)

    for (const r of rows) {
      const as = (sources: ReportSource[]) =>
        findOccurrences(project, drill({ kind: 'phoneme', key: r.key, sources })).length
      expect(as(encoding), `${r.key} spelled`).toBe(r.encoding.total)
      expect(as(decoding), `${r.key} read`).toBe(r.decoding.total)
    }
  })

  /**
   * The last column is the one a teacher reads first, so it has to open too —
   * and what is behind it is both sides, not one of them.
   */
  it('opens the combined figure into both directions at once', async () => {
    const { encoding, decoding, encodingReports, decodingReports } = await setup()
    const rows = compareGraphemes(encodingReports, decodingReports, CLASS, MIN_EVIDENCE)
    const sh = rows.find((r) => r.unit.kind === 'grapheme' && r.unit.row.letters === 'sh')!

    const both = findOccurrences(project, drill({ key: sh.key, sources: [...encoding, ...decoding] }))
    expect(both.length).toBe(sh.encoding.total + sh.decoding.total)
    expect(both.some((o) => o.testId === 'spell')).toBe(true)
    expect(both.some((o) => o.testId === 'read')).toBe(true)
  })

  it('says of each answer whether it was written or read aloud', async () => {
    const { encoding, decoding, encodingReports, decodingReports } = await setup()
    const rows = compareGraphemes(encodingReports, decodingReports, CLASS, MIN_EVIDENCE)
    const sh = rows.find((r) => r.unit.kind === 'grapheme' && r.unit.row.letters === 'sh')!

    const both = findOccurrences(project, drill({ key: sh.key, sources: [...encoding, ...decoding] }))
    const spokenOf = (o: Occurrence) => o.spoken

    // Without this the list would head a spoken row "they wrote" and credit the
    // student with a spelling they never produced.
    expect(both.filter((o) => o.testId === 'spell').every((o) => !spokenOf(o))).toBe(true)
    expect(both.filter((o) => o.testId === 'read').every(spokenOf)).toBe(true)
  })
})
