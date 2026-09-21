import { describe, expect, it } from 'vitest'
import { buildFileName, cleanNamePart } from './filename'

/**
 * A downloaded file has to survive two things: a Downloads folder with a dozen
 * near-identical reports in it, and whatever filesystem the teacher's district
 * puts it on.
 */
describe('export file names', () => {
  it('reads class, scope, report, date in that order', () => {
    expect(buildFileName(['Block 2A', '3 tests', 'Accuracy by grapheme', '2026-09-20'])).toBe(
      'Block 2A - 3 tests - Accuracy by grapheme - 2026-09-20',
    )
  })

  it('drops the parts that are not set', () => {
    // A project with no class name yet should not get a leading separator.
    expect(buildFileName([undefined, 'Test 5', 'Spelling test', '2026-06-01'])).toBe(
      'Test 5 - Spelling test - 2026-06-01',
    )
    expect(buildFileName(['Block 2A', '', null, '2026-09-20'])).toBe('Block 2A - 2026-09-20')
  })

  it('falls back to something rather than an empty name', () => {
    expect(buildFileName([undefined, ''])).toBe('Grapheme Spelling Test')
  })

  it('strips characters a filesystem will not take', () => {
    expect(cleanNamePart('Reading/Writing: block *2*?')).toBe('Reading Writing block 2')
    expect(cleanNamePart('a\\b|c<d>e"f')).toBe('a b c d e f')
  })

  it('keeps the ordinary characters a real class name has in it', () => {
    expect(cleanNamePart("Ms. O'Brien's 3rd period (AM)")).toBe("Ms. O'Brien's 3rd period (AM)")
    expect(cleanNamePart('Bloque 2A — mañana')).toBe('Bloque 2A — mañana')
  })

  it('does not let a part contain the separator and read as two parts', () => {
    // "Test 5 - blends" would otherwise look like a scope and a report.
    expect(buildFileName(['Block 2A', 'Test 5 - blends', 'Spelling test'])).toBe(
      'Block 2A - Test 5 blends - Spelling test',
    )
  })

  it('collapses the whitespace a pasted name brings with it', () => {
    expect(cleanNamePart('  Block   2A \n')).toBe('Block 2A')
  })
})
