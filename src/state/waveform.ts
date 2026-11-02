/**
 * Turning a recording into something you can aim at.
 *
 * Marking a passage means going back to one particular word over and over, and
 * a bare transport gives you no way to see where you are — you scrub, overshoot,
 * and scrub again. Drawn as a waveform with the words marked along it, the
 * silences between sentences become landmarks and a click lands where you meant.
 *
 * The decoding happens in the page, through `decodeAudioData`, like everything
 * else here: no part of this sends the audio anywhere.
 */

/**
 * How many columns to reduce a recording to.
 *
 * Fixed rather than matched to the width on screen so that resizing the window
 * never re-decodes a three-minute file. It is comfortably finer than the widest
 * the bar is ever drawn, so the picture stays sharp when it is mapped down.
 */
export const BUCKETS = 1600

/**
 * The loudest sample in each slice of the recording.
 *
 * Peak rather than average: an average flattens speech into a uniform band,
 * while peaks keep the shape of words and — more usefully — the gaps between
 * them, which is what the eye actually navigates by.
 */
export function peaksFrom(samples: Float32Array, buckets: number = BUCKETS): Float32Array {
  const out = new Float32Array(buckets)
  if (samples.length === 0) return out
  const per = samples.length / buckets
  for (let b = 0; b < buckets; b++) {
    const start = Math.floor(b * per)
    const end = Math.min(samples.length, Math.max(start + 1, Math.floor((b + 1) * per)))
    let peak = 0
    for (let i = start; i < end; i++) {
      const v = samples[i] < 0 ? -samples[i] : samples[i]
      if (v > peak) peak = v
    }
    out[b] = peak
  }
  return out
}

/** Where along the bar a moment sits, clamped so a bad time cannot draw off it. */
export function fractionOf(seconds: number, duration: number): number {
  if (!(duration > 0)) return 0
  return Math.min(1, Math.max(0, seconds / duration))
}

/** The moment a click at this fraction of the bar refers to. */
export function timeAt(fraction: number, duration: number): number {
  if (!(duration > 0)) return 0
  return Math.min(duration, Math.max(0, fraction * duration))
}

export interface WordMark {
  id: string
  text: string
  seconds: number
}

/**
 * The word nearest a click, if the click was close enough to mean it.
 *
 * A passage can put three hundred marks on one bar, so they overlap and cannot
 * each be their own button — the hit areas would stack and clicking would
 * become a lottery. Instead the whole bar takes the click and the nearest mark
 * claims it only if it is within `tolerance`, which keeps "jump to that word"
 * and "scrub to roughly here" as two reliably different gestures.
 */
export function markNear(
  marks: WordMark[],
  seconds: number,
  tolerance: number,
): WordMark | null {
  let best: WordMark | null = null
  let bestGap = Infinity
  for (const m of marks) {
    const gap = Math.abs(m.seconds - seconds)
    if (gap < bestGap) {
      bestGap = gap
      best = m
    }
  }
  return best !== null && bestGap <= tolerance ? best : null
}

/**
 * Below this there is nothing worth scaling up.
 *
 * The guard matters more than the number. A recording that came out silent —
 * the wrong microphone, a muted input — must keep *looking* silent. Scaling it
 * to fit the bar would turn a dead file into a convincing picture of speech,
 * which is the one lie this bar must never tell.
 */
export const QUIET_FLOOR = 0.005

/** A limit on how much a quiet recording is opened up, so noise stays noise. */
export const MAX_GAIN = 20

/**
 * Scales the drawing to fill the bar, without touching the data.
 *
 * Speech recorded on a phone or a laptop sits far below full scale — around a
 * tenth of it is ordinary — and drawn literally that is a flat line with no
 * landmarks in it. Since the bar exists to be navigated rather than to measure
 * loudness, it is scaled to the loudest moment in this particular recording.
 */
export function normalizePeaks(peaks: Float32Array): Float32Array {
  let max = 0
  for (let i = 0; i < peaks.length; i++) {
    if (peaks[i] > max) max = peaks[i]
  }
  if (max < QUIET_FLOOR) return peaks
  const gain = Math.min(MAX_GAIN, 0.95 / max)
  if (gain <= 1) return peaks
  const out = new Float32Array(peaks.length)
  for (let i = 0; i < peaks.length; i++) out[i] = peaks[i] * gain
  return out
}
