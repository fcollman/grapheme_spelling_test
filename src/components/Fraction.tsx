/**
 * A score shown as both a fraction and a percentage.
 *
 * The fraction is what a teacher counts and can check; the percentage is what an
 * IEP goal is written against ("80% accuracy"). Showing only one means doing the
 * other in your head, so both appear everywhere a score does.
 *
 * Zero opportunities stays as 0/0 with no percentage — 0% would read as failure
 * when in fact the skill simply never came up.
 */
export function Fraction({
  correct,
  total,
  /** Side by side in parentheses, for running text and chips rather than grids. */
  inline = false,
}: {
  correct: number
  total: number
  inline?: boolean
}) {
  if (total === 0) return <span className="frac-n">0/0</span>

  const percent = Math.round((correct / total) * 100)

  if (inline) {
    return (
      <>
        <span className="frac-n inline">
          {correct}/{total}
        </span>
        <span className="frac-pct inline">({percent}%)</span>
      </>
    )
  }

  return (
    <>
      <span className="frac-n">
        {correct}/{total}
      </span>
      <span className="frac-pct">{percent}%</span>
    </>
  )
}

export function percentOf(correct: number, total: number): string {
  return total === 0 ? '' : `${Math.round((correct / total) * 100)}%`
}
