export function Legend() {
  return (
    <div className="legend">
      <span>
        <span className="swatch" style={{ background: 'var(--exact-bg)', border: '1px solid var(--exact-line)' }} />
        Correct sound, correct letters
      </span>
      <span>
        <span
          className="swatch"
          style={{ background: 'var(--plausible-bg)', border: '1px solid var(--plausible-line)' }}
        />
        Correct sound, different letters
      </span>
      <span>
        <span className="swatch" style={{ background: 'var(--wrong-bg)', border: '1px solid var(--wrong-line)' }} />
        Wrong sound
      </span>
      <span>
        <span className="swatch" style={{ background: 'var(--none-bg)', border: '1px solid var(--line-strong)' }} />
        Sound left out
      </span>
      <span>• marks a cell you corrected</span>
    </div>
  )
}

/**
 * Red at 0%, amber in the middle, green at 100%. Kept light enough that the
 * figure printed on top stays readable in a black and white printout too.
 */
export function scaleColor(fraction: number): string {
  const hue = Math.round(fraction * 125)
  return `hsl(${hue} 62% 86%)`
}

export function scaleInk(fraction: number): string {
  const hue = Math.round(fraction * 125)
  return `hsl(${hue} 70% 25%)`
}
