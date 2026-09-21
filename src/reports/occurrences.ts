import type { Mark } from '../engine/align'
import type { PhonemeId } from '../data/phonemes'
import type { CategoryId } from '../data/categories'
import { COLLAPSING_CATEGORIES } from '../data/categories'
import { unitResults } from '../engine/units'
import { cellKey } from '../state/useAnalysis'
import type { Project } from '../state/types'
import { CLASS, isPatternKey, NONE, patternRowKey, soundAccepted, type ReportSource } from './aggregate'

/**
 * The individual answers behind a single number in a report.
 *
 * A cell reading "4/6" is only actionable if a teacher can see which six words
 * those were and which two went wrong, so every accuracy figure can be opened up
 * into the answers that produced it.
 *
 * This deliberately mirrors the iteration in `buildReportsAcross`: the list it
 * returns has to be exactly the items that were counted, or the modal would
 * contradict the number that opened it. A test asserts the two agree.
 */

export type DrillKind = 'grapheme' | 'phoneme' | 'category' | 'misuse'

export interface Drill {
  kind: DrillKind
  /**
   * A grapheme unit key, a category id, or a phoneme id. For 'phoneme' that is
   * the sound the word NEEDED; for 'misuse' it is the sound the student
   * PRODUCED where something else was wanted.
   */
  key: string
  /** What to call it in the modal title. */
  label: string
  sounds?: PhonemeId[]
  /** A student id, or CLASS for the whole-class column. */
  studentId: string
  /** Which tests the clicked cell covered. */
  sources: ReportSource[]
  /** Describes that scope in words, e.g. "Test 4" or "13 tests". */
  scopeLabel: string
  /**
   * Set for a confusion-matrix cell, which is narrower than an accuracy cell: it
   * counts only the answers where this particular thing came out. For a grapheme
   * matrix that is the letters written; for a phoneme matrix, the sound produced.
   * `∅` means nothing was written there.
   */
  produced?: string
}

export interface Occurrence {
  testId: string
  testName: string
  testDate: string
  studentId: string
  word: string
  nonsense: boolean
  /** The teacher's red-word tick, shown beside the word in the drill-down. */
  redWord: boolean
  /** The whole word as the student wrote it. */
  attempt: string
  /** The letters the target word uses for this unit. */
  targetLetters: string
  /** The letters the student used for it. */
  wroteLetters: string
  sounds: PhonemeId[]
  mark: Mark
  /**
   * What came out here, in the same terms the confusion matrix counts: the
   * letters written, or the sound produced, or `∅` for nothing.
   */
  producedKey: string
}

export function findOccurrences(project: Project, drill: Drill): Occurrence[] {
  const out: Occurrence[] = []
  const students =
    drill.studentId === CLASS
      ? project.students
      : project.students.filter((s) => s.id === drill.studentId)

  const wanted = (producedKey: string) => drill.produced === undefined || drill.produced === producedKey

  for (const { test, analysis } of drill.sources) {
    for (const word of test.words) {
      const units = analysis.unitsByWord.get(word.id) ?? []
      const patterns = analysis.patternsByWord.get(word.id) ?? []

      // Patterns that did not collapse into a column still have report rows, so
      // they need to be drillable the same way.
      const spanning = patterns.filter((p) => !COLLAPSING_CATEGORIES.has(p.category))

      for (const student of students) {
        const a = analysis.byCell.get(cellKey(word.id, student.id))
        if (!a || !a.attempted) continue

        const stamp = {
          testId: test.id,
          testName: test.name,
          testDate: test.date,
          studentId: student.id,
          word: word.text,
          nonsense: word.nonsense,
          redWord: !!word.redWord,
          attempt: a.attempt,
        }

        // Misuse counts a sound the student REACHED FOR where it was not wanted,
        // whatever the target happened to be — both a substitution and an extra
        // sound inserted on top of one. Mirrors the misuse tally exactly.
        if (drill.kind === 'misuse') {
          for (const slot of a.slots) {
            const [produced, ...extra] = slot.student

            // Not a misuse if the marking accepted the sound — lenient schwa can
            // accept a vowel that is not literally the target.
            if (produced === drill.key && !soundAccepted(slot.mark)) {
              out.push({
                ...stamp,
                targetLetters: slot.targetGrapheme,
                wroteLetters: slot.studentGrapheme,
                sounds: [slot.target],
                mark: slot.mark,
                producedKey: drill.key,
              })
            }

            for (const inserted of extra) {
              if (inserted !== drill.key) continue
              out.push({
                ...stamp,
                // An inserted sound had nothing to be needed for.
                targetLetters: '',
                wroteLetters: slot.studentGrapheme,
                sounds: [slot.target],
                mark: 'wrong',
                producedKey: drill.key,
              })
            }
          }
          continue
        }

        if (drill.kind === 'phoneme') {
          for (const slot of a.slots) {
            // The ∅ row of a phoneme confusion matrix is not a target at all —
            // it counts sounds inserted on top of whatever the slot needed, so
            // it has to be gathered from inside other slots.
            if (drill.key === NONE) {
              for (const inserted of slot.student.slice(1)) {
                if (!wanted(inserted)) continue
                out.push({
                  ...stamp,
                  // Nothing was required here — that is what makes it an
                  // insertion — so the "needed" column must not name the sound
                  // the slot was for, or the row reads as if that went wrong.
                  targetLetters: '',
                  wroteLetters: slot.studentGrapheme,
                  sounds: [inserted],
                  mark: 'wrong',
                  producedKey: inserted,
                })
              }
              continue
            }

            if (slot.target !== drill.key) continue
            // Mirrors the matrix: an accepted sound sits on the diagonal.
            const producedKey =
              slot.student.length === 0
                ? NONE
                : soundAccepted(slot.mark)
                  ? slot.target
                  : slot.student[0]
            if (!wanted(producedKey)) continue
            out.push({
              ...stamp,
              targetLetters: slot.targetGrapheme,
              wroteLetters: slot.studentGrapheme,
              sounds: slot.student.length > 0 ? slot.student : [slot.target],
              mark: slot.mark,
              producedKey,
            })
          }
          continue
        }

        const results = unitResults(a, units)

        for (const r of results) {
          const matches =
            drill.kind === 'grapheme'
              ? r.unit.key === drill.key
              : r.unit.category === (drill.key as CategoryId)
          if (!matches) continue
          const producedKey = r.studentLetters || NONE
          if (!wanted(producedKey)) continue
          out.push({
            ...stamp,
            targetLetters: r.unit.letters,
            wroteLetters: r.studentLetters,
            sounds: r.unit.phonemes,
            mark: r.mark,
            producedKey,
          })
        }

        // Spanning patterns: a blend row, or a category that includes one.
        for (const p of spanning) {
          const isThisRow =
            drill.kind === 'grapheme'
              ? isPatternKey(drill.key) && patternRowKey(p) === drill.key
              : p.category === (drill.key as CategoryId)
          if (!isThisRow) continue

          const covered = results.filter(
            (r) => r.unit.startSlot < p.end && r.unit.endSlot > p.start,
          )
          if (covered.length === 0) continue

          const mark: Mark = covered.every((r) => r.mark === 'exact')
            ? 'exact'
            : covered.every((r) => r.mark === 'exact' || r.mark === 'plausible')
              ? 'plausible'
              : 'wrong'

          const wrote = covered.map((r) => r.studentLetters).join('')
          const producedKey = wrote || NONE
          if (!wanted(producedKey)) continue

          out.push({
            ...stamp,
            targetLetters: covered.map((r) => r.unit.letters).join(''),
            wroteLetters: wrote,
            sounds: covered.flatMap((r) => r.unit.phonemes),
            mark,
            producedKey,
          })
        }
      }
    }
  }

  return out
}
