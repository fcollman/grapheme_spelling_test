import { describe, expect, it } from 'vitest'
import { compareTallies, MIN_EVIDENCE } from './compare'

/**
 * Spelling against reading, row by row.
 *
 * The arithmetic is small; what matters is what it refuses to say. A row with
 * nothing on one side must not read as a child who performs the same in both
 * directions, and one opportunity each way must not read as a finding.
 */

const t = (correct: number, total: number) => ({ correct, total })

describe('combined accuracy', () => {
  it('weights each direction once, however many chances each offered', () => {
    /*
     * Thirty chances to read `oa` in a passage against two on a spelling list
     * is ordinary. Pooling would make it 31/32 = 97% and let the passage decide
     * the number on its own; the mean says 50% spelled, 100% read, so 75%.
     */
    const { combined } = compareTallies(t(1, 2), t(30, 30), MIN_EVIDENCE)
    expect(combined).toBe(0.75)
  })

  it('keeps the one side it has when only one direction covered the row', () => {
    // Still what the child knows. It is the comparison that cannot be made.
    expect(compareTallies(t(4, 5), t(0, 0), MIN_EVIDENCE).combined).toBe(0.8)
    expect(compareTallies(t(0, 0), t(4, 5), MIN_EVIDENCE).combined).toBe(0.8)
  })

  it('has nothing to say about a row neither direction reached', () => {
    expect(compareTallies(t(0, 0), t(0, 0), MIN_EVIDENCE).combined).toBeNull()
  })

  it('does not mistake a genuine zero for an absence', () => {
    // 0 of 6 is a finding; the row must carry it rather than fall out.
    expect(compareTallies(t(0, 6), t(6, 6), MIN_EVIDENCE).combined).toBe(0.5)
  })
})

describe('divergence', () => {
  it('is positive when they spell it and cannot read it', () => {
    const { divergence, missing } = compareTallies(t(10, 10), t(2, 10), MIN_EVIDENCE)
    expect(divergence).toBeCloseTo(0.8)
    expect(missing).toBeNull()
  })

  it('is negative when they read it and cannot spell it', () => {
    expect(compareTallies(t(2, 10), t(10, 10), MIN_EVIDENCE).divergence).toBeCloseTo(-0.8)
  })

  it('is zero when the two agree, which is a finding of its own', () => {
    expect(compareTallies(t(5, 10), t(3, 6), MIN_EVIDENCE).divergence).toBe(0)
  })

  it('refuses a one-sided row rather than scoring it ±1', () => {
    const spellingOnly = compareTallies(t(6, 6), t(0, 0), MIN_EVIDENCE)
    expect(spellingOnly.divergence).toBeNull()
    expect(spellingOnly.missing).toBe('decoding')

    const readingOnly = compareTallies(t(0, 0), t(6, 6), MIN_EVIDENCE)
    expect(readingOnly.divergence).toBeNull()
    expect(readingOnly.missing).toBe('encoding')
  })

  it('says so when neither side reached the row', () => {
    expect(compareTallies(t(0, 0), t(0, 0), MIN_EVIDENCE).missing).toBe('both')
  })
})

describe('the evidence threshold', () => {
  it('refuses one chance each way, which is a coin toss and reads as ±100%', () => {
    const thin = compareTallies(t(1, 1), t(0, 1), MIN_EVIDENCE)
    expect(thin.divergence).toBeNull()
    expect(thin.missing).toBe('thin')
    // The counts survive, so the row still shows what little there was.
    expect(thin.combined).toBe(0.5)
  })

  it('is enough at exactly the threshold', () => {
    expect(compareTallies(t(3, 3), t(0, 3), 3).missing).toBeNull()
    expect(compareTallies(t(3, 3), t(0, 3), 3).divergence).toBe(1)
  })

  it('counts each side against the threshold separately', () => {
    // Plenty of spelling evidence does not make up for two chances to read it.
    expect(compareTallies(t(20, 40), t(1, 2), 3).missing).toBe('thin')
  })

  it('can be lowered to show everything', () => {
    expect(compareTallies(t(1, 1), t(0, 1), 1).divergence).toBe(1)
  })
})
