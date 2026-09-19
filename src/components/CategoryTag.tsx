import { category, type CategoryId } from '../data/categories'

export function categoryColor(id: CategoryId): string {
  return `hsl(${category(id).hue} 48% 52%)`
}

/**
 * A pill naming one phonics category. Deliberately neutral-backed with only a
 * coloured dot, so it can never be mistaken for the green/amber/red scoring.
 */
export function CategoryTag({
  id,
  label,
  unlisted = false,
  title,
}: {
  id: CategoryId
  /** Defaults to the category name; pattern tags pass their own, e.g. "-ank". */
  label?: string
  /** Marks a cluster detected by shape because no listed pattern covered it. */
  unlisted?: boolean
  title?: string
}) {
  const c = category(id)
  return (
    <span
      className={`cattag ${unlisted ? 'unlisted' : ''}`}
      title={title ?? `${c.label}${unlisted ? ' — not in the pattern list yet' : ''}: ${c.description}`}
    >
      <span className="dot" style={{ background: categoryColor(id) }} />
      {label ?? c.label}
      {unlisted && <span className="unlisted-mark">?</span>}
    </span>
  )
}

/** Just the dot, for tight spots like a column header. */
export function CategoryDot({ id, title }: { id: CategoryId; title?: string }) {
  const c = category(id)
  return <span className="dot" style={{ background: categoryColor(id) }} title={title ?? c.label} />
}
