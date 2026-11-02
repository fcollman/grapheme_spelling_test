import { describe, expect, it } from 'vitest'
import { DEAD_AIR_AFTER, isDeadAir, isLive, meterScale, peakOf } from './levels'

describe('peakOf', () => {
  it('is zero for digital silence', () => {
    expect(peakOf(new Float32Array(128))).toBe(0)
  })

  it('takes the loudest sample, in either direction', () => {
    expect(peakOf([0.01, -0.4, 0.2])).toBeCloseTo(0.4)
  })
})

describe('isLive', () => {
  /*
   * The case this whole module exists for: a virtual audio device that opens
   * cleanly and returns nothing but zeros.
   */
  it('rejects a dead device', () => {
    expect(isLive(peakOf(new Float32Array(1024)))).toBe(false)
  })

  it('accepts the noise floor of a real microphone in a quiet room', () => {
    expect(isLive(0.004)).toBe(true)
  })

  it('accepts speech', () => {
    expect(isLive(0.3)).toBe(true)
  })
})

describe('isDeadAir', () => {
  it('says nothing during a quiet lead-in', () => {
    expect(isDeadAir(1, false)).toBe(false)
  })

  it('warns once silence has gone on long enough to be a fault', () => {
    expect(isDeadAir(DEAD_AIR_AFTER, false)).toBe(true)
  })

  // One-way, so a pause between sentences cannot make the warning flicker.
  it('never warns again once sound has been heard', () => {
    expect(isDeadAir(600, true)).toBe(false)
  })
})

describe('meterScale', () => {
  it('stays inside the bar', () => {
    expect(meterScale(0)).toBe(0)
    expect(meterScale(1)).toBe(1)
    expect(meterScale(99)).toBe(1)
  })

  it('gives quiet speech a visible deflection', () => {
    expect(meterScale(0.05)).toBeGreaterThan(0.25)
  })
})
