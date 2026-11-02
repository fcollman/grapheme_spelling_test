import { describe, expect, it } from 'vitest'
import {
  MAX_GAIN,
  QUIET_FLOOR,
  fractionOf,
  markNear,
  normalizePeaks,
  peaksFrom,
  placeLabels,
  timeAt,
} from './waveform'

describe('peaksFrom', () => {
  it('reduces to the requested number of columns', () => {
    expect(peaksFrom(new Float32Array(48000), 100)).toHaveLength(100)
  })

  it('is flat for silence', () => {
    expect([...peaksFrom(new Float32Array(1000), 4)]).toEqual([0, 0, 0, 0])
  })

  it('keeps the loudest sample in each slice, in either direction', () => {
    const samples = new Float32Array([0.1, 0.2, -0.9, 0.3])
    const peaks = peaksFrom(samples, 2)
    expect(peaks[0]).toBeCloseTo(0.2)
    expect(peaks[1]).toBeCloseTo(0.9)
  })

  // The gaps between sentences are what the eye navigates by, so a loud word
  // next to a silence must not be averaged into it.
  it('keeps a quiet slice quiet next to a loud one', () => {
    const samples = new Float32Array(200)
    for (let i = 0; i < 100; i++) samples[i] = 0.8
    const peaks = peaksFrom(samples, 2)
    expect(peaks[0]).toBeCloseTo(0.8)
    expect(peaks[1]).toBe(0)
  })

  it('survives an empty recording', () => {
    expect([...peaksFrom(new Float32Array(0), 3)]).toEqual([0, 0, 0])
  })

  it('handles more columns than samples', () => {
    expect(peaksFrom(new Float32Array([1]), 8)).toHaveLength(8)
  })
})

describe('fractionOf and timeAt', () => {
  it('maps a moment onto the bar', () => {
    expect(fractionOf(30, 120)).toBeCloseTo(0.25)
    expect(timeAt(0.25, 120)).toBeCloseTo(30)
  })

  it('clamps rather than drawing off the end', () => {
    expect(fractionOf(500, 120)).toBe(1)
    expect(fractionOf(-5, 120)).toBe(0)
    expect(timeAt(2, 120)).toBe(120)
    expect(timeAt(-1, 120)).toBe(0)
  })

  // A file we recorded ourselves reports Infinity until it has been repaired.
  it('refuses to divide by an unknown duration', () => {
    expect(fractionOf(10, 0)).toBe(0)
    expect(fractionOf(10, Infinity)).toBe(0)
    expect(timeAt(0.5, 0)).toBe(0)
  })
})

describe('markNear', () => {
  const marks = [
    { id: 'a', text: 'The', seconds: 1 },
    { id: 'b', text: 'boat', seconds: 5 },
    { id: 'c', text: 'shore', seconds: 9 },
  ]

  it('claims a click that landed on a word', () => {
    expect(markNear(marks, 5.2, 0.5)?.id).toBe('b')
  })

  it('leaves a click between words alone, so scrubbing still works', () => {
    expect(markNear(marks, 7, 0.5)).toBeNull()
  })

  it('takes the nearer of two close words', () => {
    expect(markNear(marks, 8.6, 1)?.id).toBe('c')
  })

  it('has nothing to claim when the passage has no times yet', () => {
    expect(markNear([], 3, 1)).toBeNull()
  })
})

describe('normalizePeaks', () => {
  it('opens a quiet recording up to fill the bar', () => {
    const scaled = normalizePeaks(new Float32Array([0.05, 0.1, 0.025]))
    expect(scaled[1]).toBeCloseTo(0.95)
    // the shape is kept; only the scale changes
    expect(scaled[0] / scaled[1]).toBeCloseTo(0.5)
    expect(scaled[2] / scaled[1]).toBeCloseTo(0.25)
  })

  it('leaves a recording that already fills the bar alone', () => {
    const peaks = new Float32Array([0.2, 0.98, 0.5])
    expect(normalizePeaks(peaks)).toBe(peaks)
  })

  /*
   * The one lie this bar must never tell: a recording that came out silent has
   * to keep looking silent, or a dead microphone is drawn as speech.
   */
  it('refuses to amplify silence into a picture of speech', () => {
    const silent = new Float32Array([0, 0, 0, 0])
    expect(normalizePeaks(silent)).toBe(silent)
    const nearlySilent = new Float32Array([0.0001, 0.0002])
    expect(normalizePeaks(nearlySilent)).toBe(nearlySilent)
  })

  it('will not amplify a very quiet recording without limit', () => {
    // Just loud enough to be scaled at all, so the cap is what decides the gain.
    const faint = QUIET_FLOOR + 0.0001
    const scaled = normalizePeaks(new Float32Array([faint]))
    expect(scaled[0] / faint).toBeCloseTo(MAX_GAIN)
    expect(scaled[0]).toBeLessThan(1)
  })

  it('survives an empty array', () => {
    expect(normalizePeaks(new Float32Array(0))).toHaveLength(0)
  })
})

describe('placing the word labels', () => {
  const mark = (id: string, seconds: number, text = id) => ({ id, text, seconds })
  /** Every word six pixels wide, so the arithmetic in the tests is visible. */
  const six = () => 6

  it('labels a mark with the word that was heard there', () => {
    const placed = placeLabels([mark('w1', 5, 'boat')], 10, 100, six)
    expect(placed).toHaveLength(1)
    expect(placed[0]).toMatchObject({ id: 'w1', text: 'boat', left: 50 })
  })

  it('drops the labels there is no room for rather than overlapping them', () => {
    const marks = [mark('a', 1), mark('b', 1.1), mark('c', 5)]
    expect(placeLabels(marks, 10, 100, six).map((l) => l.id)).toEqual(['a', 'c'])
  })

  /*
   * The bar is the same picture at every size; only how much of it can be
   * named changes. A wider bar must never show *fewer* words.
   */
  it('names more words as the bar grows, and never fewer', () => {
    const marks = [mark('a', 1), mark('b', 2), mark('c', 3), mark('d', 4)]
    const narrow = placeLabels(marks, 10, 60, six).map((l) => l.id)
    const wide = placeLabels(marks, 10, 600, six).map((l) => l.id)
    expect(wide.length).toBeGreaterThan(narrow.length)
    for (const id of narrow) expect(wide).toContain(id)
  })

  it('keeps the last word inside the bar instead of clipping it', () => {
    const placed = placeLabels([mark('end', 10, 'finish')], 10, 100, () => 40)
    expect(placed[0].left).toBe(60)
  })

  /*
   * Times are stamped as the teacher taps through, so a word marked after
   * seeking backwards can arrive out of order. Left unsorted it would hide
   * every label after it.
   */
  it('reads the bar left to right whatever order the marks arrive in', () => {
    const marks = [mark('late', 9), mark('early', 1), mark('mid', 5)]
    expect(placeLabels(marks, 10, 300, six).map((l) => l.id)).toEqual(['early', 'mid', 'late'])
  })

  it('has nothing to place before the recording has been measured', () => {
    expect(placeLabels([mark('a', 1)], 0, 100, six)).toEqual([])
    expect(placeLabels([mark('a', 1)], 10, 0, six)).toEqual([])
  })
})
