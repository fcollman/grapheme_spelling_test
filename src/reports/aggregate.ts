import type { Mark, WordAnalysis } from '../engine/align'
import type { PhonemeId } from '../data/phonemes'
import { REPORT_ORDER } from '../data/phonemes'
import { CATEGORIES, COLLAPSING_CATEGORIES, type CategoryId } from '../data/categories'
import { unitResults } from '../engine/units'
import type { PatternMatch } from '../engine/patterns'
import type { Project, Test } from '../state/types'
import { cellKey, type AnalysisResult } from '../state/useAnalysis'

/** Marker used for an omitted sound (row/column ∅ in the confusion matrix). */
export const NONE = '∅'

export interface Tally {
  correct: number
  total: number
}

export interface GraphemeRow {
  key: string
  /** The target word's letters for this row, used for the confusion diagonal. */
  letters: string
  phonemes: PhonemeId[]
  category: CategoryId
  /** Set when the row is a taught chunk rather than a plain grapheme. */
  patternLabel?: string
  /**
   * 'unit' is one column of the marking grid. 'pattern' is a taught pattern that
   * spans several columns — a blend — which has no column of its own but still
   * needs reporting, since blends are one of the categories being tracked.
   */
  kind: 'unit' | 'pattern'
}

export interface Reports {
  /** Phonemes that actually occur in this test, in inventory order. */
  phonemes: PhonemeId[]
  /** accuracy[phoneme][studentId] and accuracy[phoneme].__class */
  accuracy: Map<PhonemeId, Map<string, Tally>>
  /** misuse[phoneme][studentId]: times the student produced it where it was wrong. */
  misuse: Map<PhonemeId, Map<string, number>>
  /** confusion[studentId][target][produced]; '__class' holds the whole-class sum. */
  confusion: Map<string, Map<string, Map<string, number>>>
  /** Every phoneme the students actually produced, for confusion matrix columns. */
  producedPhonemes: PhonemeId[]

  /** The grapheme units this test covered, grouped by category and ordered. */
  graphemes: GraphemeRow[]
  /** graphemeAccuracy[unitKey][studentId] */
  graphemeAccuracy: Map<string, Map<string, Tally>>
  /** graphemeConfusion[studentId][unitKey][letters the student wrote] */
  graphemeConfusion: Map<string, Map<string, Map<string, number>>>
  /** Distinct spellings students actually wrote, for confusion matrix columns. */
  writtenSpellings: string[]
}

export const CLASS = '__class'

/**
 * Report rows for a spanning pattern aggregate across the whole test, so "dw"
 * from two different words lands on one row. The label is part of the key so that
 * structurally-detected clusters, which all share an id, stay separate.
 */
function patternRowKey(p: PatternMatch): string {
  return `pattern:${p.id}:${p.label}`
}

function isCorrect(mark: Mark, amberCounts: boolean): boolean {
  if (mark === 'exact') return true
  if (mark === 'plausible') return amberCounts
  return false
}

function bump<K>(map: Map<K, number>, key: K, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by)
}

function tally(map: Map<string, Tally>, key: string, correct: boolean) {
  const t = map.get(key) ?? { correct: 0, total: 0 }
  t.total += 1
  if (correct) t.correct += 1
  map.set(key, t)
}

function nested<K1, V>(map: Map<K1, V>, key: K1, make: () => V): V {
  let v = map.get(key)
  if (v === undefined) {
    v = make()
    map.set(key, v)
  }
  return v
}

/**
 * Rolls every analysed cell up into the three report shapes.
 *
 * Only attempted words count: a word a student did not write produces no
 * opportunities, so it shows as 0/0 rather than dragging accuracy down.
 */
export function buildReports(project: Project, test: Test, analysis: AnalysisResult): Reports {
  const amber = project.settings.amberCountsCorrect

  const accuracy = new Map<PhonemeId, Map<string, Tally>>()
  const misuse = new Map<PhonemeId, Map<string, number>>()
  const confusion = new Map<string, Map<string, Map<string, number>>>()
  const seenTargets = new Set<PhonemeId>()
  const seenProduced = new Set<PhonemeId>()

  const graphemeAccuracy = new Map<string, Map<string, Tally>>()
  const graphemeConfusion = new Map<string, Map<string, Map<string, number>>>()
  const graphemeRows = new Map<string, GraphemeRow>()
  const seenSpellings = new Set<string>()

  const addGraphemeConfusion = (studentId: string, key: string, written: string) => {
    for (const who of [studentId, CLASS]) {
      const forStudent = nested(graphemeConfusion, who, () => new Map<string, Map<string, number>>())
      bump(nested(forStudent, key, () => new Map<string, number>()), written)
    }
  }

  const addConfusion = (studentId: string, target: string, produced: string) => {
    for (const who of [studentId, CLASS]) {
      const forStudent = nested(confusion, who, () => new Map<string, Map<string, number>>())
      const row = nested(forStudent, target, () => new Map<string, number>())
      bump(row, produced)
    }
  }

  for (const word of test.words) {
    const units = analysis.unitsByWord.get(word.id) ?? []
    const target = analysis.byWord.get(word.id)

    // Patterns that span several columns instead of collapsing into one — blends,
    // and kind/old words. They have no column, but they are categories the
    // teacher tracks, so they need their own rows. Collapsed patterns are already
    // units, so excluding them here avoids counting them twice.
    const spanning = (analysis.patternsByWord.get(word.id) ?? []).filter(
      (p) => !COLLAPSING_CATEGORIES.has(p.category),
    )

    for (const u of units) {
      graphemeRows.set(u.key, {
        key: u.key,
        letters: u.letters,
        phonemes: u.phonemes,
        category: u.category,
        patternLabel: u.patternLabel,
        kind: 'unit',
      })
    }

    for (const p of spanning) {
      graphemeRows.set(patternRowKey(p), {
        key: patternRowKey(p),
        letters: (target?.targetGraphemes ?? []).slice(p.start, p.end).join(''),
        phonemes: (target?.targetPhonemes ?? []).slice(p.start, p.end),
        category: p.category,
        patternLabel: p.label,
        kind: 'pattern',
      })
    }

    for (const student of project.students) {
      const a: WordAnalysis | undefined = analysis.byCell.get(cellKey(word.id, student.id))
      if (!a) continue

      // --- grapheme layer: what the teacher marks ---
      if (a.attempted) {
        const results = unitResults(a, units)

        const record = (key: string, correct: boolean, written: string) => {
          tally(nested(graphemeAccuracy, key, () => new Map<string, Tally>()), student.id, correct)
          tally(nested(graphemeAccuracy, key, () => new Map<string, Tally>()), CLASS, correct)
          seenSpellings.add(written)
          addGraphemeConfusion(student.id, key, written)
        }

        for (const r of results) {
          record(r.unit.key, isCorrect(r.mark, amber), r.studentLetters || NONE)
        }

        // A spanning pattern counts as right only when every column it covers is.
        for (const p of spanning) {
          const covered = results.filter(
            (r) => r.unit.startSlot < p.end && r.unit.endSlot > p.start,
          )
          if (covered.length === 0) continue
          record(
            patternRowKey(p),
            covered.every((r) => isCorrect(r.mark, amber)),
            covered.map((r) => r.studentLetters).join('') || NONE,
          )
        }
      }

      // --- phoneme layer ---
      for (const slot of a.slots) {
        seenTargets.add(slot.target)

        if (!a.attempted) continue

        tally(nested(accuracy, slot.target, () => new Map<string, Tally>()), student.id, isCorrect(slot.mark, amber))
        tally(nested(accuracy, slot.target, () => new Map<string, Tally>()), CLASS, isCorrect(slot.mark, amber))

        if (slot.student.length === 0) {
          addConfusion(student.id, slot.target, NONE)
          continue
        }

        // The first produced phoneme is the substitution; anything after it is an
        // inserted sound, which belongs in the insertion row, not the diagonal.
        const [first, ...extra] = slot.student
        seenProduced.add(first)
        addConfusion(student.id, slot.target, first)

        if (first !== slot.target) {
          bump(nested(misuse, first, () => new Map<string, number>()), student.id)
          bump(nested(misuse, first, () => new Map<string, number>()), CLASS)
        }

        for (const ins of extra) {
          seenProduced.add(ins)
          addConfusion(student.id, NONE, ins)
          bump(nested(misuse, ins, () => new Map<string, number>()), student.id)
          bump(nested(misuse, ins, () => new Map<string, number>()), CLASS)
        }
      }
    }
  }

  const order = (set: Set<PhonemeId>) => REPORT_ORDER.filter((p) => set.has(p))

  // Grapheme rows come out grouped by category in the taxonomy's own order, then
  // alphabetically, so the report reads like a scope and sequence.
  const categoryRank = new Map(CATEGORIES.map((c, i) => [c.id, i]))
  const graphemes = [...graphemeRows.values()].sort(
    (a, b) =>
      (categoryRank.get(a.category) ?? 99) - (categoryRank.get(b.category) ?? 99) ||
      a.letters.localeCompare(b.letters) ||
      a.phonemes.join().localeCompare(b.phonemes.join()),
  )

  return {
    phonemes: order(seenTargets),
    accuracy,
    misuse,
    confusion,
    producedPhonemes: order(seenProduced),
    graphemes,
    graphemeAccuracy,
    graphemeConfusion,
    writtenSpellings: [...seenSpellings].sort((a, b) =>
      a === NONE ? 1 : b === NONE ? -1 : a.localeCompare(b),
    ),
  }
}

export function getTally(reports: Reports, phoneme: PhonemeId, who: string): Tally {
  return reports.accuracy.get(phoneme)?.get(who) ?? { correct: 0, total: 0 }
}

export function getMisuse(reports: Reports, phoneme: PhonemeId, who: string): number {
  return reports.misuse.get(phoneme)?.get(who) ?? 0
}

export function getConfusion(reports: Reports, who: string, target: string, produced: string): number {
  return reports.confusion.get(who)?.get(target)?.get(produced) ?? 0
}

export function getGraphemeTally(reports: Reports, key: string, who: string): Tally {
  return reports.graphemeAccuracy.get(key)?.get(who) ?? { correct: 0, total: 0 }
}

export function getGraphemeConfusion(
  reports: Reports,
  who: string,
  key: string,
  written: string,
): number {
  return reports.graphemeConfusion.get(who)?.get(key)?.get(written) ?? 0
}
