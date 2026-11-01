import { useEffect, useState } from 'react'
import { analyze, type AlignOptions, type WordAnalysis } from '../engine/align'
import { analyzeWords, cleanWord } from '../engine/phonemize'
import { findPatterns, type PatternMatch } from '../engine/patterns'
import { buildUnits, type GraphemeUnit } from '../engine/units'
import type { NormalizedWord } from '../engine/normalize'
import { isReading, type Project, type Test } from './types'

/** Everything the reports need about one test. */
export interface TestAnalysis {
  /** Keyed `${wordId}|${studentId}`. */
  byCell: Map<string, WordAnalysis>
  /** Keyed by wordId: the target breakdown alone, for the word map header. */
  byWord: Map<string, WordAnalysis>
  /** Keyed by wordId: the grapheme units the teacher marks. */
  unitsByWord: Map<string, GraphemeUnit[]>
  /** Keyed by wordId: phonics patterns found in the target word. */
  patternsByWord: Map<string, PatternMatch[]>
}

export interface AnalysisResult extends TestAnalysis {
  loading: boolean
  error: string | null
}

export function cellKey(wordId: string, studentId: string) {
  return `${wordId}|${studentId}`
}

const EMPTY: NormalizedWord = { phonemes: [], stress: [], unknown: [], raw: '' }

export function emptyTestAnalysis(): TestAnalysis {
  return {
    byCell: new Map(),
    byWord: new Map(),
    unitsByWord: new Map(),
    patternsByWord: new Map(),
  }
}

const INITIAL: AnalysisResult = { ...emptyTestAnalysis(), loading: true, error: null }

const NOT_ANALYSED: AnalysisResult = { ...emptyTestAnalysis(), loading: false, error: null }

/**
 * Whether this engine knows how to score this test yet.
 *
 * A reading test records what a student said, not what they wrote, and the
 * aligner decides `exact` against `plausible` by comparing letters — so running
 * a passage through it would score every correctly-read sound as a near miss.
 * Numbers that look right and are not are worse than none, so until decoding
 * scoring lands, reading tests are left alone rather than mis-scored.
 *
 * Skipping them is also what keeps the cost sane: a passage is a few hundred
 * words against a spelling test's twenty.
 */
export function analysisApplies(test: Test): boolean {
  return !isReading(test)
}

/**
 * Phonemizes every target word and every attempt across the given tests in one
 * batched engine call. The engine cache is module-level, so a word that recurs in
 * a later test costs nothing.
 */
export async function collectNorms(
  project: Project,
  tests: Test[],
): Promise<Map<string, NormalizedWord>> {
  const strings: string[] = []
  for (const test of tests) {
    if (!analysisApplies(test)) continue
    for (const w of test.words) {
      strings.push(cleanWord(w.text))
      for (const s of project.students) {
        strings.push(cleanWord(test.responses[w.id]?.[s.id] ?? ''))
      }
    }
  }
  return analyzeWords(strings.filter(Boolean))
}

/**
 * Aligns one test against pre-phonemized words. Pure and synchronous, so it can
 * be run for the active test or for every test without duplicating the logic.
 */
export function analyzeTest(
  project: Project,
  test: Test,
  norms: Map<string, NormalizedWord>,
  options: AlignOptions,
): TestAnalysis {
  const result = emptyTestAnalysis()

  /** A teacher-confirmed breakdown replaces whatever the engine produced. */
  const targetNorm = (wordId: string, text: string): NormalizedWord => {
    const confirmed = test.wordPhonemes[wordId]
    const engine = norms.get(text) ?? EMPTY
    if (!confirmed) return engine
    return { phonemes: confirmed, stress: confirmed.map(() => 0), unknown: [], raw: engine.raw }
  }

  for (const w of test.words) {
    const text = cleanWord(w.text)
    const tNorm = targetNorm(w.id, text)
    const target = analyze(text, '', tNorm, EMPTY, {}, options)
    result.byWord.set(w.id, target)

    const patterns = findPatterns(
      target.targetPhonemes,
      target.targetGraphemes,
      target.syllables,
      target.word,
    )
    result.patternsByWord.set(w.id, patterns)
    result.unitsByWord.set(w.id, buildUnits(target, patterns))

    for (const s of project.students) {
      const attempt = cleanWord(test.responses[w.id]?.[s.id] ?? '')
      const overrides = test.overrides[w.id]?.[s.id] ?? {}
      result.byCell.set(
        cellKey(w.id, s.id),
        analyze(text, attempt, tNorm, norms.get(attempt) ?? EMPTY, overrides, options),
      )
    }
  }

  return result
}

/** The parts of a test that change its analysis. Renaming it must not re-run anything. */
function testSignature(project: Project, test: Test) {
  return {
    id: test.id,
    words: test.words.map((w) => [w.id, w.text]),
    responses: test.responses,
    overrides: test.overrides,
    wordPhonemes: test.wordPhonemes,
    students: project.students.map((s) => s.id),
    lenientSchwa: project.settings.lenientSchwa,
  }
}

/**
 * Analyses the active test. One batched engine round-trip covers the whole test
 * (~250ms for a class set), so this re-runs wholesale rather than patching cells.
 */
export function useAnalysis(project: Project, test: Test): AnalysisResult {
  const [result, setResult] = useState<AnalysisResult>(INITIAL)
  // Worked out before the signature, because stringifying a whole passage's
  // responses on every render is exactly the cost this avoids.
  const applies = analysisApplies(test)
  const signature = applies ? JSON.stringify(testSignature(project, test)) : ''

  useEffect(() => {
    if (!applies) setResult(NOT_ANALYSED)
  }, [applies])

  useEffect(() => {
    if (!applies) return
    let cancelled = false

    async function run() {
      try {
        const options = { lenientSchwa: project.settings.lenientSchwa }
        const norms = await collectNorms(project, [test])
        if (cancelled) return
        setResult({ ...analyzeTest(project, test, norms, options), loading: false, error: null })
      } catch (e) {
        if (!cancelled) setResult({ ...INITIAL, loading: false, error: String(e) })
      }
    }

    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, applies])

  return result
}

export interface AllTestsAnalysis {
  loading: boolean
  error: string | null
  /** Keyed by test id. */
  byTest: Map<string, TestAnalysis>
}

const ALL_INITIAL: AllTestsAnalysis = { loading: true, error: null, byTest: new Map() }

/**
 * Analyses every test, for the progress-over-time report.
 *
 * `enabled` keeps it off until that tab is actually opened: a term's worth of
 * tests is fast, but a full year could take a second or two, and there is no
 * reason to pay it while the teacher is entering a spelling test.
 */
export function useAllTests(project: Project, enabled: boolean): AllTestsAnalysis {
  const [result, setResult] = useState<AllTestsAnalysis>(ALL_INITIAL)
  const scorable = project.tests.filter(analysisApplies)
  const signature = JSON.stringify(enabled ? scorable.map((t) => testSignature(project, t)) : null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    async function run() {
      try {
        const options = { lenientSchwa: project.settings.lenientSchwa }
        const norms = await collectNorms(project, scorable)
        if (cancelled) return
        const byTest = new Map<string, TestAnalysis>()
        for (const t of scorable) byTest.set(t.id, analyzeTest(project, t, norms, options))
        setResult({ loading: false, error: null, byTest })
      } catch (e) {
        if (!cancelled) setResult({ loading: false, error: String(e), byTest: new Map() })
      }
    }

    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, enabled])

  return result
}
