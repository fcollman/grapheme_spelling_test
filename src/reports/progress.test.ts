import { describe, expect, it } from 'vitest'
import { analyzeTest, collectNorms, cellKey, type TestAnalysis } from '../state/useAnalysis'
import {
  buildProgress,
  buildReports,
  buildReportsAcross,
  CLASS,
  getExamples,
  getGraphemeTally,
  testsInOrder,
} from './aggregate'
import type { Project, Test } from '../state/types'

const students = [
  { id: 's1', name: 'Ava' },
  { id: 's2', name: 'Ben' },
]

function makeTest(
  id: string,
  name: string,
  date: string,
  words: Array<[string, string]>,
  responses: Record<string, Record<string, string>>,
): Test {
  return {
    id,
    name,
    date,
    words: words.map(([wid, text]) => ({ id: wid, text, nonsense: false })),
    responses,
    overrides: {},
    wordPhonemes: {},
  }
}

/**
 * Three tests across a term. The middle one deliberately contains no digraph, so
 * the "not assessed vs zero" distinction can be asserted.
 */
function makeProject(): Project {
  return {
    version: 1,
    students,
    tests: [
      makeTest('t1', 'January', '2026-01-10', [['w1', 'ship'], ['w2', 'cat']], {
        w1: { s1: 'ship', s2: 'sip' },
        w2: { s1: 'cat', s2: 'cat' },
      }),
      makeTest('t2', 'February', '2026-02-10', [['w3', 'cat'], ['w4', 'dog']], {
        w3: { s1: 'cat', s2: 'cat' },
        w4: { s1: 'dog', s2: 'dog' },
      }),
      makeTest('t3', 'March', '2026-03-10', [['w5', 'ship'], ['w6', 'cat']], {
        w5: { s1: 'ship', s2: 'ship' },
        w6: { s1: 'cat', s2: 'cat' },
      }),
    ],
    activeTestId: 't1',
    settings: { notation: 'sound', lenientSchwa: true, amberCountsCorrect: false },
  }
}

async function analyseAll(project: Project) {
  const norms = await collectNorms(project, project.tests)
  const byTest = new Map<string, TestAnalysis>()
  for (const t of project.tests) {
    byTest.set(t.id, analyzeTest(project, t, norms, { lenientSchwa: true }))
  }
  return byTest
}

describe('analyzeTest', () => {
  it('produces one analysis per word and student', async () => {
    const project = makeProject()
    const test = project.tests[0]
    const norms = await collectNorms(project, [test])
    const a = analyzeTest(project, test, norms, { lenientSchwa: true })

    expect(a.byWord.size).toBe(2)
    expect(a.byCell.size).toBe(4)
    expect(a.unitsByWord.get('w1')?.map((u) => u.letters)).toEqual(['sh', 'i', 'p'])
    // Ben wrote "sip" for "ship": the digraph is wrong, the rest is right.
    expect(a.byCell.get(cellKey('w1', 's2'))?.slots.map((s) => s.mark)).toEqual([
      'wrong',
      'exact',
      'exact',
    ])
  })

  it('applies a teacher-confirmed breakdown and per-cell overrides', async () => {
    const project = makeProject()
    const test: Test = {
      ...project.tests[0],
      wordPhonemes: { w1: ['SH', 'I', 'P'] },
      overrides: { w1: { s2: { 0: { student: ['SH'], mark: 'exact' } } } },
    }
    const norms = await collectNorms(project, [test])
    const a = analyzeTest(project, test, norms, { lenientSchwa: true })

    const cell = a.byCell.get(cellKey('w1', 's2'))!
    expect(cell.targetPhonemes).toEqual(['SH', 'I', 'P'])
    expect(cell.slots[0].mark).toBe('exact')
    expect(cell.slots[0].overridden).toBe(true)
  })
})

describe('error examples', () => {
  it('records the word an error came from', async () => {
    const project = makeProject()
    const test = project.tests[0]
    const norms = await collectNorms(project, [test])
    const reports = buildReports(project, test, analyzeTest(project, test, norms, {}))

    const sh = reports.graphemes.find((g) => g.letters === 'sh')!
    // Ben wrote "sip", so "s" was written where "sh" was needed, in the word ship.
    expect(getExamples(reports, 's2', sh.key, 's').map((e) => e.word)).toEqual(['ship'])
    // Ava got it right, so there is nothing to quote.
    expect(getExamples(reports, 's1', sh.key, 'sh')).toEqual([])
  })

  it('separates a wrong sound from a plausible spelling', async () => {
    const project: Project = {
      ...makeProject(),
      tests: [
        makeTest('t', 'Marks', '2026-01-01', [['w1', 'cat']], {
          // Ava spelled the right sounds differently; Ben got a sound wrong.
          w1: { s1: 'kat', s2: 'cet' },
        }),
      ],
      activeTestId: 't',
    }
    const test = project.tests[0]
    const norms = await collectNorms(project, [test])
    const reports = buildReports(project, test, analyzeTest(project, test, norms, {}))

    const c = reports.graphemes.find((g) => g.letters === 'c')!
    const a = reports.graphemes.find((g) => g.letters === 'a' && g.phonemes.join() === 'A')!

    expect(getExamples(reports, 's1', c.key, 'k')[0].mark).toBe('plausible')
    expect(getExamples(reports, 's2', a.key, 'e')[0].mark).toBe('wrong')
  })

  it('caps the examples it keeps', async () => {
    const words: Array<[string, string]> = Array.from({ length: 6 }, (_, i) => [`w${i}`, 'ship'])
    const responses = Object.fromEntries(words.map(([id]) => [id, { s1: 'sip', s2: 'sip' }]))
    const project: Project = {
      ...makeProject(),
      tests: [makeTest('t', 'Many', '2026-01-01', words, responses)],
      activeTestId: 't',
    }
    const test = project.tests[0]
    const norms = await collectNorms(project, [test])
    const reports = buildReports(project, test, analyzeTest(project, test, norms, {}))

    const sh = reports.graphemes.find((g) => g.letters === 'sh')!
    expect(getExamples(reports, 's1', sh.key, 's').length).toBe(3)
  })
})

describe('reports across several tests', () => {
  it('pools counts from every test given to it', async () => {
    const project = makeProject()
    const byTest = await analyseAll(project)
    const sources = project.tests.map((test) => ({ test, analysis: byTest.get(test.id)! }))
    const across = buildReportsAcross(project, sources)

    // "sh" is on test 1 and test 3. Ben wrote "sip" then "ship".
    const sh = across.graphemes.find((g) => g.letters === 'sh')!
    expect(getGraphemeTally(across, sh.key, 's2')).toEqual({ correct: 1, total: 2 })
    expect(getGraphemeTally(across, sh.key, 's1')).toEqual({ correct: 2, total: 2 })

    // "cat" is on all three tests and both students always got it right.
    const c = across.graphemes.find((g) => g.letters === 'c' && g.phonemes.join() === 'K')!
    expect(getGraphemeTally(across, c.key, CLASS)).toEqual({ correct: 6, total: 6 })
  })

  it('matches the single-test report when given one test', async () => {
    const project = makeProject()
    const byTest = await analyseAll(project)
    const test = project.tests[0]
    const analysis = byTest.get(test.id)!

    const one = buildReports(project, test, analysis)
    const across = buildReportsAcross(project, [{ test, analysis }])

    expect(across.graphemes.map((g) => g.key)).toEqual(one.graphemes.map((g) => g.key))
    for (const g of one.graphemes) {
      expect(getGraphemeTally(across, g.key, CLASS)).toEqual(getGraphemeTally(one, g.key, CLASS))
    }
  })

  it('pools the quoted error examples too', async () => {
    const project = makeProject()
    const byTest = await analyseAll(project)
    // Only the two tests containing "ship".
    const sources = [project.tests[0], project.tests[2]].map((test) => ({
      test,
      analysis: byTest.get(test.id)!,
    }))
    const across = buildReportsAcross(project, sources)

    const sh = across.graphemes.find((g) => g.letters === 'sh')!
    expect(getExamples(across, 's2', sh.key, 's').map((e) => e.word)).toEqual(['ship'])
  })

  it('returns an empty report when no tests are selected', () => {
    const project = makeProject()
    const empty = buildReportsAcross(project, [])
    expect(empty.graphemes).toEqual([])
    expect(empty.phonemes).toEqual([])
  })
})

describe('progress over time', () => {
  it('orders tests by date regardless of the order they were created', () => {
    const project = makeProject()
    project.tests = [project.tests[2], project.tests[0], project.tests[1]]
    expect(testsInOrder(project).map((t) => t.name)).toEqual(['January', 'February', 'March'])
  })

  it('returns one point per test for every row', async () => {
    const project = makeProject()
    const rows = buildProgress(project, await analyseAll(project), CLASS, 'category')
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      expect(r.points.map((p) => p.testName)).toEqual(['January', 'February', 'March'])
    }
  })

  it('marks a category missing from a test as not assessed, not as zero', async () => {
    const project = makeProject()
    const rows = buildProgress(project, await analyseAll(project), CLASS, 'category')

    const digraph = rows.find((r) => r.category === 'consonant-digraph')!
    // February had no digraph in it at all.
    expect(digraph.points[1].tally).toBeNull()
    // January and March did.
    expect(digraph.points[0].tally).not.toBeNull()
    expect(digraph.points[2].tally).not.toBeNull()
  })

  it('shows a student improving between tests', async () => {
    const project = makeProject()
    const rows = buildProgress(project, await analyseAll(project), 's2', 'category')

    const digraph = rows.find((r) => r.category === 'consonant-digraph')!
    // Ben wrote "sip" in January and "ship" in March.
    expect(digraph.points[0].tally).toEqual({ correct: 0, total: 1 })
    expect(digraph.points[2].tally).toEqual({ correct: 1, total: 1 })
  })

  it('can break down by individual spelling as well as by category', async () => {
    const project = makeProject()
    const rows = buildProgress(project, await analyseAll(project), CLASS, 'grapheme')
    const labels = rows.map((r) => r.label)
    expect(labels).toContain('sh')
    expect(labels).toContain('c')
    // A grapheme row carries the sounds it makes; a category row does not.
    expect(rows.find((r) => r.label === 'sh')!.phonemes).toEqual(['SH'])
  })

  it('handles a project with a single test without crashing', async () => {
    const project = makeProject()
    project.tests = [project.tests[0]]
    const rows = buildProgress(project, await analyseAll(project), CLASS, 'category')
    for (const r of rows) expect(r.points).toHaveLength(1)
  })
})
