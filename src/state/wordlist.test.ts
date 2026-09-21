import { describe, expect, it } from 'vitest'
import { reducer } from './store'
import { emptyProject, emptyTest, type Project } from './types'

/**
 * Dropping a word somewhere, as opposed to nudging it with the arrows.
 *
 * The index a drop reports is a GAP between rows in the list as it looks on
 * screen — 0 above the first word, list.length below the last — so moving a word
 * downwards has to account for the hole it leaves behind. That off-by-one is the
 * whole reason these tests exist.
 */

function words(project: Project): string {
  return project.tests[0].words.map((w) => w.text).join(',')
}

function fourWords(): Project {
  const test = {
    ...emptyTest('Test 1'),
    id: 't1',
    words: ['cat', 'ship', 'splash', 'blorf'].map((text, i) => ({ id: `w${i}`, text, nonsense: false })),
  }
  return { ...emptyProject(), tests: [test], activeTestId: 't1' }
}

describe('dropping a word into a new place', () => {
  it('moves a word up to the gap it was dropped in', () => {
    // splash (index 2) dropped above cat.
    expect(words(reducer(fourWords(), { type: 'moveWordTo', id: 'w2', index: 0 }))).toBe(
      'splash,cat,ship,blorf',
    )
  })

  it('moves a word down, allowing for the hole it leaves', () => {
    // cat (index 0) dropped into the gap after splash, which is index 3.
    expect(words(reducer(fourWords(), { type: 'moveWordTo', id: 'w0', index: 3 }))).toBe(
      'ship,splash,cat,blorf',
    )
  })

  it('moves a word to the very end', () => {
    expect(words(reducer(fourWords(), { type: 'moveWordTo', id: 'w0', index: 4 }))).toBe(
      'ship,splash,blorf,cat',
    )
  })

  it('does nothing when the word is dropped where it already is', () => {
    const before = fourWords()
    // Both gaps either side of ship leave it exactly where it was.
    expect(reducer(before, { type: 'moveWordTo', id: 'w1', index: 1 })).toBe(before)
    expect(reducer(before, { type: 'moveWordTo', id: 'w1', index: 2 })).toBe(before)
  })

  it('ignores a word that is not in the list, or a gap that is not there', () => {
    const before = fourWords()
    expect(reducer(before, { type: 'moveWordTo', id: 'nope', index: 1 })).toBe(before)
    expect(reducer(before, { type: 'moveWordTo', id: 'w0', index: 9 })).toBe(before)
    expect(reducer(before, { type: 'moveWordTo', id: 'w0', index: -1 })).toBe(before)
  })

  it('leaves the spellings attached to their words', () => {
    const before = fourWords()
    before.tests[0].responses = { w2: { a: 'splas' } }
    const after = reducer(before, { type: 'moveWordTo', id: 'w2', index: 0 })

    expect(words(after)).toBe('splash,cat,ship,blorf')
    // Responses are keyed by word id, so reordering cannot shuffle them.
    expect(after.tests[0].responses.w2.a).toBe('splas')
  })
})

describe('locking the word list', () => {
  it('is a setting, so it survives a reload with the rest of them', () => {
    const after = reducer(emptyProject(), { type: 'updateSettings', settings: { lockWords: true } })
    expect(after.settings.lockWords).toBe(true)
    expect(after.settings.anonymize).toBe(false)
  })
})
