import { describe, expect, it } from 'vitest'
import { percentOf } from './Fraction'

describe('percentOf', () => {
  it('rounds to a whole percent', () => {
    expect(percentOf(2, 3)).toBe('67%')
    expect(percentOf(1, 3)).toBe('33%')
    expect(percentOf(3, 3)).toBe('100%')
    expect(percentOf(0, 4)).toBe('0%')
  })

  it('gives nothing when there were no opportunities', () => {
    // 0/0 must never render as 0%: the skill did not come up, which is not the
    // same as getting it wrong, and the reports colour those differently.
    expect(percentOf(0, 0)).toBe('')
  })
})
