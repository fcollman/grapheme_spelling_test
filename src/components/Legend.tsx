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

/*
 * The two ends of a divergence.
 *
 * Deliberately not the red-to-green scale above. That one runs from bad to
 * good, and neither end of this one is bad: a child who spells `oa` but cannot
 * read it and a child who reads it but cannot spell it are equally stuck, and
 * they need opposite lessons. So the scale runs out from a neutral middle to
 * two hues that carry no verdict — and purple against teal stays two different
 * colours for a red-green colour-blind reader, which red against green does
 * not.
 */
const SPELLS_IT_HUE = 288
const READS_IT_HUE = 190

/**
 * Grey at no difference, deepening towards purple as spelling pulls ahead and
 * towards teal as reading does.
 *
 * Light background, dark ink, same as `scaleColor`: the figure printed on top
 * has to stay readable, including in a black and white printout where the two
 * hues become two greys.
 *
 * The square root is what makes the colour useful. Straight, a 12-point
 * difference tints a cell by so little that it reads as the neutral middle, and
 * the one thing the eye should get from this column for free — which direction
 * — is exactly what is lost. Curved, the hue appears as soon as there is a
 * direction at all and the depth still says roughly how far. Over-reading a
 * small tint is guarded against before the colour: a difference is only shown
 * at all once both sides clear the evidence threshold.
 */
function strengthOf(d: number): number {
  return Math.sqrt(Math.min(1, Math.abs(d)))
}

export function divergeColor(d: number): string {
  const strength = strengthOf(d)
  const hue = d >= 0 ? SPELLS_IT_HUE : READS_IT_HUE
  return `hsl(${hue} ${Math.round(strength * 58)}% ${92 - strength * 6}%)`
}

export function divergeInk(d: number): string {
  const strength = strengthOf(d)
  const hue = d >= 0 ? SPELLS_IT_HUE : READS_IT_HUE
  return `hsl(${hue} ${Math.round(18 + strength * 52)}% ${30 - strength * 4}%)`
}
