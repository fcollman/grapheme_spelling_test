/**
 * The axes of a confusion matrix.
 *
 * A grid of targets against what was written only reads as a confusion matrix
 * when a row can meet its own column: the correct answers then run down the
 * diagonal, and everything off it is a substitution to teach against.
 *
 * That needs the column axis to carry every target, not only the ones somebody
 * happened to write. Building it from what was written instead has two
 * consequences, and the grapheme sheet had both: a target nobody spelled
 * correctly has no column, so its row never meets a diagonal; and no column can
 * ever be empty, because a column exists precisely when someone wrote in it —
 * which quietly made "hide empty rows and columns" unable to hide a column.
 */

/**
 * Columns for a confusion matrix: every target in row order, then anything
 * written that was never a target, then the "nothing written" column.
 *
 * Row order rather than alphabetical, so a row meets its own column as the eye
 * travels down the grid instead of the correct answers scattering.
 *
 * @param targets what each row was asking for, in the order the rows appear
 * @param written what students actually produced
 * @param none the column standing for nothing written at all
 */
export function confusionColumns(
  targets: readonly string[],
  written: readonly string[],
  none: string,
): string[] {
  const cols: string[] = []
  const seen = new Set<string>()

  const add = (c: string) => {
    // `none` is appended at the end whether or not it appears in either list;
    // it is not a spelling, so it does not belong among them.
    if (c === '' || c === none || seen.has(c)) return
    seen.add(c)
    cols.push(c)
  }

  for (const t of targets) add(t)
  for (const w of written) add(w)

  return [...cols, none]
}

/**
 * The rows and columns that take part in at least one confusion.
 *
 * "Empty" is the wrong test, and testing for it is why the toggle looked
 * broken: almost every row and column holds *something*, because a spelling
 * that was written correctly lands on the diagonal. On a term of tests that
 * left 71 rows by 82 columns standing with nothing hidden, when only 58 rows
 * and 38 columns were involved in a confusion at all.
 *
 * The diagonal is not a confusion, so it does not keep a row or a column alive
 * here. What is left is the substitutions — the thing the sheet is for. The
 * complete grid, diagonal and all, is what the toggle turns back on.
 */
export function trimToConfusions<R>(
  rows: readonly R[],
  cols: readonly string[],
  count: (row: R, col: string) => number,
  isDiagonal: (row: R, col: string) => boolean,
): { rows: R[]; cols: string[] } {
  const confused = (row: R, col: string) => !isDiagonal(row, col) && count(row, col) > 0

  return {
    rows: rows.filter((r) => cols.some((c) => confused(r, c))),
    // Measured against every row, not just the kept ones: a dropped row has no
    // confusions anywhere, so it cannot be holding a column up.
    cols: cols.filter((c) => rows.some((r) => confused(r, c))),
  }
}
