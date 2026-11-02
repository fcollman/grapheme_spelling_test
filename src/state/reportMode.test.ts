import { describe, expect, it } from 'vitest'
import { inMode, modeNoun } from './useSelectedTests'
import { emptyReadingTest, emptyTest } from './types'

/**
 * Which tests a mode covers.
 *
 * Trivial-looking, and pinned down anyway: the whole feature is one boolean
 * comparison, and inverting it would quietly show every report the wrong way
 * round while still looking like it worked.
 */
describe('inMode', () => {
  const spelling = emptyTest('Test 1')
  const reading = emptyReadingTest('Reading Test 1')

  it('counts a spelling test as encoding and a reading test as decoding', () => {
    expect(inMode(spelling, 'encoding')).toBe(true)
    expect(inMode(reading, 'decoding')).toBe(true)
  })

  it('never counts a test in both directions', () => {
    expect(inMode(spelling, 'decoding')).toBe(false)
    expect(inMode(reading, 'encoding')).toBe(false)
  })

  /* A project written before reading tests existed has no kind at all. */
  it('treats a test with no kind as a spelling test', () => {
    const old = { ...spelling, kind: undefined }
    expect(inMode(old, 'encoding')).toBe(true)
    expect(inMode(old, 'decoding')).toBe(false)
  })
})

describe('modeNoun', () => {
  it('names the tests a mode covers, for labels and file names', () => {
    expect(modeNoun('encoding')).toBe('spelling tests')
    expect(modeNoun('decoding')).toBe('reading tests')
    expect(modeNoun('decoding', false)).toBe('reading test')
  })
})
