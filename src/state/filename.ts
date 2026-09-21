import { useStore } from './store'

/**
 * Names for downloaded files.
 *
 * A teacher downloading a term's reports ends up with a dozen files in one
 * folder, and the only thing that tells them apart is the name. So a name says,
 * in order: which class, which tests, which report, and when.
 *
 *     Block 2A - 3 tests - Accuracy by grapheme - 2026-09-20.csv
 *     Block 2A - Test 5 Beginning blends - Spelling test - 2026-06-01.csv
 *
 * Parts that are empty drop out, so a project with no class name set still gets
 * something readable rather than a leading separator.
 */

/** Space-hyphen-space rather than an en dash: it survives every filesystem. */
const JOIN = ' - '

/**
 * Characters no filesystem will take, plus the ones browsers quietly rewrite.
 * Everything else is left alone — a name is meant to read like a name, so
 * spaces, apostrophes and accents stay.
 */
const ILLEGAL = /[\\/:*?"<>|\u0000-\u001f]/g

export function cleanNamePart(part: string): string {
  return part
    .replace(ILLEGAL, ' ')
    // A part that already contains the separator would make the name ambiguous.
    .replace(/\s+-\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildFileName(parts: Array<string | undefined | null>): string {
  const cleaned = parts.map((p) => (p ? cleanNamePart(p) : '')).filter((p) => p !== '')
  // Every part could be blank on a brand new project with nothing named yet.
  return cleaned.length > 0 ? cleaned.join(JOIN) : 'Grapheme Spelling Test'
}

/** Today, as the ISO date the rest of the app stores dates in. */
export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

type Part = string | undefined | null

/**
 * @returns a name builder that already knows the class.
 *
 * `scope` is what the export covers — one test's name, "3 tests", a student, or
 * several of those — and `date` should be the test's own date when the export
 * covers a single test, since that is the date a teacher will look for it
 * under. Falls back to today for anything pooled.
 */
export function useFileName(): (report: string, scope?: Part[], date?: string) => string {
  const { project } = useStore()
  return (report, scope = [], date) =>
    buildFileName([project.className, ...scope, report, date ?? today()])
}
