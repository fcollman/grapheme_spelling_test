import { useEffect, useState } from 'react'
import { analyze, type WordAnalysis } from '../engine/align'
import { analyzeWords, cleanWord } from '../engine/phonemize'
import { findPatterns, type PatternMatch } from '../engine/patterns'
import { buildUnits, type GraphemeUnit } from '../engine/units'
import type { NormalizedWord } from '../engine/normalize'
import type { Project, Test } from './types'

export interface AnalysisResult {
  loading: boolean
  error: string | null
  /** Keyed `${wordId}|${studentId}`. */
  byCell: Map<string, WordAnalysis>
  /** Keyed by wordId: the target breakdown alone, for the word map header. */
  byWord: Map<string, WordAnalysis>
  /** Keyed by wordId: the grapheme units the teacher marks. */
  unitsByWord: Map<string, GraphemeUnit[]>
  /** Keyed by wordId: phonics patterns found in the target word. */
  patternsByWord: Map<string, PatternMatch[]>
}

export function cellKey(wordId: string, studentId: string) {
  return `${wordId}|${studentId}`
}

const EMPTY: NormalizedWord = { phonemes: [], stress: [], unknown: [], raw: '' }

const INITIAL: AnalysisResult = {
  loading: true,
  error: null,
  byCell: new Map(),
  byWord: new Map(),
  unitsByWord: new Map(),
  patternsByWord: new Map(),
}

/**
 * Analyses every word/student pair in the active test.
 *
 * One batched engine round-trip covers the whole test (~250ms for a class set),
 * so this re-runs wholesale whenever the test or the relevant settings change
 * rather than trying to patch individual cells.
 */
export function useAnalysis(project: Project, test: Test): AnalysisResult {
  const [result, setResult] = useState<AnalysisResult>(INITIAL)

  // Re-run only when something that changes the analysis changes. Renaming a
  // student or a test must not trigger a re-analysis.
  const signature = JSON.stringify({
    words: test.words.map((w) => [w.id, w.text]),
    responses: test.responses,
    overrides: test.overrides,
    wordPhonemes: test.wordPhonemes,
    students: project.students.map((s) => s.id),
    lenientSchwa: project.settings.lenientSchwa,
  })

  useEffect(() => {
    let cancelled = false
    const options = { lenientSchwa: project.settings.lenientSchwa }

    async function run() {
      try {
        const words = test.words.map((w) => cleanWord(w.text))
        const attempts = test.words.flatMap((w) =>
          project.students.map((s) => cleanWord(test.responses[w.id]?.[s.id] ?? '')),
        )
        const norms = await analyzeWords([...words, ...attempts].filter(Boolean))
        if (cancelled) return

        /** A teacher-confirmed breakdown replaces whatever the engine produced. */
        const targetNorm = (wordId: string, text: string): NormalizedWord => {
          const confirmed = test.wordPhonemes[wordId]
          const engine = norms.get(text) ?? EMPTY
          if (!confirmed) return engine
          return { phonemes: confirmed, stress: confirmed.map(() => 0), unknown: [], raw: engine.raw }
        }

        const byCell = new Map<string, WordAnalysis>()
        const byWord = new Map<string, WordAnalysis>()
        const unitsByWord = new Map<string, GraphemeUnit[]>()
        const patternsByWord = new Map<string, PatternMatch[]>()

        for (const w of test.words) {
          const text = cleanWord(w.text)
          const tNorm = targetNorm(w.id, text)
          const target = analyze(text, '', tNorm, EMPTY, {}, options)
          byWord.set(w.id, target)

          const patterns = findPatterns(
            target.targetPhonemes,
            target.targetGraphemes,
            target.syllables,
            target.word,
          )
          patternsByWord.set(w.id, patterns)
          unitsByWord.set(w.id, buildUnits(target, patterns))

          for (const s of project.students) {
            const attempt = cleanWord(test.responses[w.id]?.[s.id] ?? '')
            const overrides = test.overrides[w.id]?.[s.id] ?? {}
            byCell.set(
              cellKey(w.id, s.id),
              analyze(text, attempt, tNorm, norms.get(attempt) ?? EMPTY, overrides, options),
            )
          }
        }

        setResult({ loading: false, error: null, byCell, byWord, unitsByWord, patternsByWord })
      } catch (e) {
        if (!cancelled) setResult({ ...INITIAL, loading: false, error: String(e) })
      }
    }

    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  return result
}
