import type { Mark, WordAnalysis } from '../engine/align'
import type { PhonemeId } from '../data/phonemes'
import { REPORT_ORDER } from '../data/phonemes'
import { CATEGORIES, COLLAPSING_CATEGORIES, category, type CategoryId } from '../data/categories'
import { unitResults } from '../engine/units'
import type { PatternMatch } from '../engine/patterns'
import { isReading, type Project, type Test } from '../state/types'
import { cellKey, type TestAnalysis } from '../state/useAnalysis'

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
  /** graphemeConfusion[studentId][unitKey][what came out] — see {@link producedKey}. */
  graphemeConfusion: Map<string, Map<string, Map<string, number>>>
  /** Distinct things students actually produced, for confusion matrix columns. */
  producedUnits: string[]
  /**
   * True when `producedUnits` holds sounds rather than letters, so a report can
   * label and format the axis correctly. See {@link producedKey}.
   */
  producedIsSound: boolean

  /**
   * The words behind each error, so a report can say "wrote `s` for `sh` in
   * *ship*" rather than only "1 time". Keyed by `exampleKey`, capped per key.
   */
  examples: Map<string, ErrorExample[]>
}

export interface ErrorExample {
  word: string
  /** What came out, in the same terms the confusion sheet counts — see {@link producedKey}. */
  wrote: string
  /**
   * Kept so a report can separate a genuine sound error from a phonetically
   * plausible spelling. "kat" for "cat" and "cet" for "cat" are both incorrect,
   * but they call for completely different teaching.
   */
  mark: Mark
}

/** Enough examples to be convincing in a meeting, few enough to bound memory. */
const MAX_EXAMPLES = 3

export function exampleKey(studentId: string, unitKey: string, wrote: string): string {
  return `${studentId}|${unitKey}|${wrote}`
}

export function getExamples(reports: Reports, studentId: string, unitKey: string, wrote: string) {
  return reports.examples.get(exampleKey(studentId, unitKey, wrote)) ?? []
}

export const CLASS = '__class'

/**
 * Report rows for a spanning pattern aggregate across the whole test, so "dw"
 * from two different words lands on one row. The label is part of the key so that
 * structurally-detected clusters, which all share an id, stay separate.
 */
export function patternRowKey(p: PatternMatch): string {
  return `pattern:${p.id}:${p.label}`
}

/** True for a report row that came from a spanning pattern rather than a column. */
export function isPatternKey(key: string): boolean {
  return key.startsWith('pattern:')
}

/**
 * The produced axis of the grapheme confusion sheet, in one place.
 *
 * Spelling and reading produce different things, and the column has to say
 * which. In a spelling test the student chose the letters, so the letters are
 * the answer. In a reading test the letters are the TEACHER'S shorthand for a
 * sound she heard — "shun" and "shn" are one mispronunciation typed two ways —
 * so counting them splits one error across two columns of an already sparse
 * grid, and credits the student with a spelling they never produced. The sound
 * is what the reader produced, and the sheet becomes grapheme → sound: the
 * exact mirror of encoding's sound → grapheme.
 *
 * An `exact` reading lands on the diagonal whatever came out of the phonemizer.
 * The consonant rescue in `markOf` exists precisely because a respelling runs
 * through eSpeak as a whole word, so a letter changed elsewhere can alter a
 * neighbouring consonant's sound — an artefact of the round trip, not something
 * the student said. Showing it off the diagonal would invent a substitution and
 * contradict the accuracy sheet, which counted the same answer correct.
 *
 * A `plausible` reading does NOT fold onto the diagonal. It is a reduced vowel
 * or a curated accent variant, and the teacher is the authority on her own
 * students' dialect: she can only exercise that judgement over evidence she can
 * see.
 */
export function producedKey(outcome: {
  spoken: boolean
  mark: Mark
  /** The letters the teacher has down for this unit. */
  letters: string
  /** The sounds those letters make. */
  phonemes: PhonemeId[]
  /** The sounds the unit was asking for. */
  target: PhonemeId[]
}): string {
  if (!outcome.spoken) return outcome.letters || NONE
  return soundsKey(outcome.mark === 'exact' ? outcome.target : outcome.phonemes)
}

/**
 * Sounds as one column key. `+` is the join a unit key already uses, and the ids
 * are the inventory's (`SH`, `AE`), so a key never collides with a spelling.
 */
export function soundsKey(phonemes: PhonemeId[]): string {
  return phonemes.join('+') || NONE
}

/** The sounds back out of a column key, for display. */
export function soundsOf(key: string): PhonemeId[] {
  return key === NONE || key === '' ? [] : key.split('+')
}

/** The column a row's correct answer lands in — the diagonal of the sheet. */
export function diagonalKey(row: GraphemeRow, producedIsSound: boolean): string {
  return producedIsSound ? soundsKey(row.phonemes) : row.letters
}

/**
 * True when the SOUND was right, whatever letters were used.
 *
 * Distinct from isCorrect(), which is about scoring and depends on whether the
 * teacher counts a different-spelling answer as correct. This one decides
 * whether an answer represents a sound confusion at all.
 */
export function soundAccepted(mark: Mark): boolean {
  return mark === 'exact' || mark === 'plausible'
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
export interface ReportSource {
  test: Test
  analysis: TestAnalysis
}

/** Reports for a single test — what most of the tabs want. */
export function buildReports(project: Project, test: Test, analysis: TestAnalysis): Reports {
  return buildReportsAcross(project, [{ test, analysis }])
}

/**
 * Reports aggregated over any set of tests.
 *
 * Every accumulator below already sums across words, so summing across tests as
 * well needs nothing more than a longer list of words to walk. Counts, examples
 * and confusions all pool, which is what a profile spanning a term should show.
 */
export function buildReportsAcross(project: Project, sources: ReportSource[]): Reports {
  const amber = project.settings.amberCountsCorrect

  const accuracy = new Map<PhonemeId, Map<string, Tally>>()
  const misuse = new Map<PhonemeId, Map<string, number>>()
  const confusion = new Map<string, Map<string, Map<string, number>>>()
  const seenTargets = new Set<PhonemeId>()
  const seenProduced = new Set<PhonemeId>()

  const graphemeAccuracy = new Map<string, Map<string, Tally>>()
  const graphemeConfusion = new Map<string, Map<string, Map<string, number>>>()
  const graphemeRows = new Map<string, GraphemeRow>()
  const seenProducedUnits = new Set<string>()
  const examples = new Map<string, ErrorExample[]>()

  /*
   * One axis for the whole sheet, decided here rather than per word.
   *
   * A unit's row key is its letters and its sounds, so the same grapheme from a
   * spelling test and from a reading test is one row. Choosing the axis per
   * word would hand that row both a letter column and a sound column, and it
   * would be correct in neither. Mixed selections cannot be made through the
   * tabs; if one ever arrives it falls back to letters, which is what the sheet
   * did before reading tests existed.
   */
  const spoken = sources.length > 0 && sources.every(({ test }) => isReading(test))

  const addExample = (studentId: string, unitKey: string, produced: string, word: string, mark: Mark) => {
    const key = exampleKey(studentId, unitKey, produced)
    const list = examples.get(key) ?? []
    if (list.length < MAX_EXAMPLES) {
      list.push({ word, wrote: produced, mark })
      examples.set(key, list)
    }
  }

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

  // Flattened so the body below is unchanged whether one test or twelve.
  const everyWord = sources.flatMap(({ test, analysis }) =>
    test.words.map((word) => ({ word, analysis })),
  )

  for (const { word, analysis } of everyWord) {
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

        const record = (key: string, correct: boolean, produced: string, mark: Mark) => {
          tally(nested(graphemeAccuracy, key, () => new Map<string, Tally>()), student.id, correct)
          tally(nested(graphemeAccuracy, key, () => new Map<string, Tally>()), CLASS, correct)
          seenProducedUnits.add(produced)
          addGraphemeConfusion(student.id, key, produced)
          // Only anything less than exact is worth quoting as evidence.
          if (mark !== 'exact') addExample(student.id, key, produced, word.text, mark)
        }

        for (const r of results) {
          record(
            r.unit.key,
            isCorrect(r.mark, amber),
            producedKey({
              spoken,
              mark: r.mark,
              letters: r.studentLetters,
              phonemes: r.studentPhonemes,
              target: r.unit.phonemes,
            }),
            r.mark,
          )
        }

        // A spanning pattern counts as right only when every column it covers is.
        for (const p of spanning) {
          const covered = results.filter(
            (r) => r.unit.startSlot < p.end && r.unit.endSlot > p.start,
          )
          if (covered.length === 0) continue
          // A pattern is only a sound error if one of its parts is; otherwise the
          // sounds were all there and only the spelling differed.
          const patternMark: Mark = covered.every((r) => r.mark === 'exact')
            ? 'exact'
            : covered.every((r) => r.mark === 'exact' || r.mark === 'plausible')
              ? 'plausible'
              : 'wrong'
          record(
            patternRowKey(p),
            covered.every((r) => isCorrect(r.mark, amber)),
            producedKey({
              spoken,
              mark: patternMark,
              letters: covered.map((r) => r.studentLetters).join(''),
              phonemes: covered.flatMap((r) => r.studentPhonemes),
              target: covered.flatMap((r) => r.unit.phonemes),
            }),
            patternMark,
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

        // The marking may have accepted a sound that is not literally the target
        // — "accept any unstressed vowel for a schwa" does exactly that. Such an
        // answer belongs on the diagonal, or the confusion matrix would report a
        // swap that the accuracy report counts as correct, and drilling into it
        // would show rows saying "correct" under a cell that reads as an error.
        const accepted = soundAccepted(slot.mark)
        addConfusion(student.id, slot.target, accepted ? slot.target : first)

        if (!accepted) {
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

  /*
   * Columns run in the order the teacher already reads that axis in:
   * alphabetical for spellings, and the phoneme inventory's own order for
   * sounds, which is what every other sound axis in the app uses. ∅ is not an
   * answer, so it sits at the end either way.
   */
  const phonemeRank = new Map(REPORT_ORDER.map((p, i) => [p, i]))
  const bySound = (a: string, b: string) => {
    const [x, y] = [soundsOf(a), soundsOf(b)]
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      const d = (phonemeRank.get(x[i]) ?? 99) - (phonemeRank.get(y[i]) ?? 99)
      if (d !== 0) return d
    }
    return 0
  }
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
    producedUnits: [...seenProducedUnits].sort((a, b) =>
      a === NONE ? 1 : b === NONE ? -1 : spoken ? bySound(a, b) : a.localeCompare(b),
    ),
    producedIsSound: spoken,
    examples,
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

/* ------------------------------------------------------------------ *
 * Progress across tests
 * ------------------------------------------------------------------ */

export type ProgressLevel = 'category' | 'grapheme'

export interface ProgressPoint {
  testId: string
  testName: string
  date: string
  /**
   * null means the row was not assessed in that test — either the spelling never
   * came up, or the student attempted none of the words containing it. Showing
   * this as 0/0 rather than as a zero matters: a gap must never read as
   * regression on a report a teacher takes into an IEP meeting.
   */
  tally: Tally | null
}

export interface ProgressRow {
  key: string
  label: string
  category: CategoryId
  /** The sounds, for grapheme rows. Empty for category rows. */
  phonemes: PhonemeId[]
  points: ProgressPoint[]
}

/** Tests in date order, falling back to the order they were created in. */
export function testsInOrder(project: Project): Test[] {
  return [...project.tests].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      project.tests.indexOf(a) - project.tests.indexOf(b),
  )
}

/**
 * Accuracy for each category (or each grapheme) across every test, for one
 * student or for the class.
 *
 * Categories are the better default: an individual spelling may appear on one
 * test and never again, whereas a category almost always recurs, so the line is
 * actually comparable.
 */
export function buildProgress(
  project: Project,
  byTest: Map<string, TestAnalysis>,
  who: string,
  level: ProgressLevel,
  /*
   * Which tests make up the time series, defaulting to all of them.
   *
   * This is the one report that does not go through `buildReportsAcross`, so it
   * is also the one place the encode/decode filter cannot reach on its own. Left
   * to itself it would put a spelling test and a reading test in adjacent
   * columns and call the difference growth, when the two are opposite questions.
   */
  tests: Test[] = testsInOrder(project),
): ProgressRow[] {
  const perTest = tests.map((test) => {
    const analysis = byTest.get(test.id)
    return { test, reports: analysis ? buildReports(project, test, analysis) : null }
  })

  const rows = new Map<string, ProgressRow>()
  const categoryRank = new Map(CATEGORIES.map((c, i) => [c.id, i]))

  const rowFor = (key: string, label: string, category: CategoryId, phonemes: PhonemeId[]) => {
    let row = rows.get(key)
    if (!row) {
      row = { key, label, category, phonemes, points: [] }
      rows.set(key, row)
    }
    return row
  }

  for (const { test, reports } of perTest) {
    const stamp = { testId: test.id, testName: test.name, date: test.date }

    if (!reports) {
      for (const row of rows.values()) row.points.push({ ...stamp, tally: null })
      continue
    }

    // Sum this test's tallies into whichever rows the chosen level asks for.
    const totals = new Map<string, Tally>()
    const meta = new Map<string, { label: string; category: CategoryId; phonemes: PhonemeId[] }>()

    for (const g of reports.graphemes) {
      const key = level === 'category' ? g.category : g.key
      const label = level === 'category' ? category(g.category).label : g.patternLabel ?? g.letters
      if (!meta.has(key)) {
        meta.set(key, {
          label,
          category: g.category,
          phonemes: level === 'category' ? [] : g.phonemes,
        })
      }
      const t = getGraphemeTally(reports, g.key, who)
      const acc = totals.get(key) ?? { correct: 0, total: 0 }
      acc.correct += t.correct
      acc.total += t.total
      totals.set(key, acc)
    }

    for (const [key, info] of meta) rowFor(key, info.label, info.category, info.phonemes)

    for (const row of rows.values()) {
      const t = totals.get(row.key)
      row.points.push({ ...stamp, tally: t && t.total > 0 ? t : null })
    }
  }

  // A row created part-way through needs blank points for the earlier tests.
  for (const row of rows.values()) {
    while (row.points.length < tests.length) {
      const test = tests[row.points.length]
      row.points.unshift({ testId: test.id, testName: test.name, date: test.date, tally: null })
    }
  }

  return [...rows.values()].sort(
    (a, b) =>
      (categoryRank.get(a.category) ?? 99) - (categoryRank.get(b.category) ?? 99) ||
      a.label.localeCompare(b.label),
  )
}

export function getGraphemeTally(reports: Reports, key: string, who: string): Tally {
  return reports.graphemeAccuracy.get(key)?.get(who) ?? { correct: 0, total: 0 }
}

export function getGraphemeConfusion(
  reports: Reports,
  who: string,
  key: string,
  produced: string,
): number {
  return reports.graphemeConfusion.get(who)?.get(key)?.get(produced) ?? 0
}
