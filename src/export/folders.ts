/**
 * Where each kind of export lands inside the teacher's chosen folder.
 *
 * Every folder name here is a literal in source, and `ReportFolder` is a union
 * of exactly those literals. That is deliberate and load-bearing: the obvious
 * shortcut is to derive the folder from the file name, which already contains
 * the class and often a student's name — and that would put a real child's name
 * on a folder in Google Drive, visible in a folder listing, even with "Hide
 * student names" switched on. A frozen list makes that a type error instead of
 * a judgement call, and `folders.test.ts` keeps it that way.
 *
 * Student names belong in the file name, where `names()` already applies the
 * privacy toggle to them.
 */

/** One folder per kind of export, matching the ten places that export a CSV. */
export const REPORT_FOLDERS = [
  'Spelling test',
  'Grapheme analysis',
  'Student profile',
  'Progress over time',
  'Accuracy by grapheme',
  'Grapheme confusion',
  'Accuracy by phoneme',
  'Phoneme misuse',
  'Phoneme confusion',
  'Examples',
] as const

export type ReportFolder = (typeof REPORT_FOLDERS)[number]

/**
 * The app's own folder inside whatever the teacher picked, so choosing "My
 * Drive" scatters nothing into the root of their Drive.
 */
export const ROOT_FOLDER = 'Grapheme Spelling Test'

/** The path an export is written to, relative to the chosen folder. */
export function exportPath(folder: ReportFolder, fileName: string): string[] {
  return [ROOT_FOLDER, folder, fileName]
}

/**
 * A name that is not already taken in the folder.
 *
 * `getFileHandle(name, { create: true })` overwrites without asking — unlike the
 * save dialog, there is no "a file with that name exists, replace it?" step. A
 * teacher exporting the same report twice in a session would silently lose the
 * first one, possibly after sending a link to it, so the second becomes
 * "… (2)".
 */
export function uniqueName(taken: Iterable<string>, wanted: string): string {
  const existing = new Set(taken)
  if (!existing.has(wanted)) return wanted

  const dot = wanted.lastIndexOf('.')
  const stem = dot > 0 ? wanted.slice(0, dot) : wanted
  const ext = dot > 0 ? wanted.slice(dot) : ''

  for (let n = 2; n < 1000; n++) {
    const candidate = `${stem} (${n})${ext}`
    if (!existing.has(candidate)) return candidate
  }
  // A thousand copies of one report in one folder is not a real scenario, but
  // returning something unique beats returning something that overwrites.
  return `${stem} (${Date.now()})${ext}`
}
