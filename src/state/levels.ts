/**
 * Is any sound actually reaching the page?
 *
 * This exists because of a recording that looked perfect and contained
 * nothing. The microphone opened, the browser lit its recording indicator, the
 * file was written where the teacher asked for it — and every frame in it was
 * digital silence, because Chrome had chosen a virtual audio device (BlackHole,
 * Zoom, Teams, an aggregate) instead of the real microphone. Those devices open
 * happily and deliver zeros forever.
 *
 * Nothing downstream can tell the difference: Opus compresses silence to about
 * two bytes a frame, so the file is well-formed, just empty. The only place it
 * can be caught is here, while the student is still in the room.
 */

/**
 * Below this, the input is indistinguishable from a disconnected device.
 *
 * A dead device reads exactly 0. A real microphone in a quiet room still
 * carries a noise floor well above this, so the threshold separates "nothing is
 * connected" from "nobody is talking yet" — which are very different problems
 * and only the first is worth interrupting someone about.
 */
export const SILENCE_FLOOR = 0.0002

/** How long to wait before saying so, so a quiet lead-in is not an alarm. */
export const DEAD_AIR_AFTER = 2.5

/** Loudest sample in the buffer, which tracks speech better than an average. */
export function peakOf(samples: Float32Array | number[]): number {
  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i] < 0 ? -samples[i] : samples[i]
    if (v > peak) peak = v
  }
  return peak
}

/** Whether this buffer is evidence that something is plugged in and working. */
export function isLive(peak: number): boolean {
  return peak > SILENCE_FLOOR
}

/**
 * Whether to tell the teacher the microphone is dead.
 *
 * Deliberately one-way: once a sound has been heard the warning can never come
 * back, so a pause between sentences cannot make it flicker.
 */
export function isDeadAir(elapsed: number, everLive: boolean): boolean {
  return !everLive && elapsed >= DEAD_AIR_AFTER
}

/**
 * Meter position, 0..1.
 *
 * Square-rooted because loudness is perceptual: a linear bar spends its whole
 * length flat and then spikes, which reads as a broken meter.
 */
export function meterScale(peak: number): number {
  return Math.min(1, Math.sqrt(peak) * 1.4)
}
