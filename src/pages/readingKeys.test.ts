import { describe, expect, it } from 'vitest'
import { NUDGE_SECONDS, planAudioKey, planKey, type KeyContext } from './readingKeys'

const at = (over: Partial<KeyContext> = {}): KeyContext => ({
  key: 'Tab',
  shiftKey: false,
  value: '',
  omitted: false,
  index: 0,
  wordCount: 6,
  ...over,
})

describe('tabbing forward', () => {
  it('marks an untouched word read correctly and moves on', () => {
    expect(planKey(at())).toMatchObject({ record: 'confirm', move: 1, preventDefault: true })
  })

  it('leaves a word alone that already has a respelling', () => {
    expect(planKey(at({ value: 'kat' }))).toMatchObject({ record: null, move: 1 })
  })

  it('leaves a word alone that is marked skipped', () => {
    expect(planKey(at({ omitted: true }))).toMatchObject({ record: null, move: 1 })
  })
})

/**
 * The bug this file exists for: the check for a next word used to sit in front
 * of the line that recorded the current one, so tapping Tab through a passage
 * with nothing wrong in it left the final word blank.
 */
describe('the last word', () => {
  it('is still marked read correctly, even though there is nowhere to go', () => {
    const plan = planKey(at({ index: 5, wordCount: 6 }))
    expect(plan).toMatchObject({ record: 'confirm', move: null })
  })

  it('lets Tab carry focus out of the passage rather than trapping it', () => {
    expect(planKey(at({ index: 5, wordCount: 6 }))?.preventDefault).toBe(false)
  })

  it('swallows Enter, which has nowhere to go', () => {
    expect(planKey(at({ key: 'Enter', index: 5, wordCount: 6 }))).toMatchObject({
      record: 'confirm',
      move: null,
      preventDefault: true,
    })
  })

  it('marks a one-word passage', () => {
    expect(planKey(at({ index: 0, wordCount: 1 }))).toMatchObject({ record: 'confirm', move: null })
  })
})

describe('stepping back', () => {
  it('moves without marking anything', () => {
    // Going back is how you return to a word to listen again; it must not
    // assert that the words you pass were read correctly.
    expect(planKey(at({ shiftKey: true, index: 3 }))).toMatchObject({ record: null, move: 2 })
  })

  it('does not trap focus at the first word', () => {
    expect(planKey(at({ shiftKey: true, index: 0 }))).toMatchObject({
      record: null,
      move: null,
      preventDefault: false,
    })
  })
})

describe('marking a word skipped', () => {
  it('records it and moves on', () => {
    expect(planKey(at({ key: '-' }))).toMatchObject({ record: 'omit', move: 1 })
  })

  it('records it on the last word too', () => {
    expect(planKey(at({ key: '-', index: 5, wordCount: 6 }))).toMatchObject({
      record: 'omit',
      move: null,
    })
  })

  it('is a plain character once something has been typed', () => {
    // Otherwise a teacher could never type a dash inside a respelling.
    expect(planKey(at({ key: '-', value: 'co' }))).toBeNull()
  })
})

describe('keys this page does not claim', () => {
  it('passes letters through to the browser', () => {
    expect(planKey(at({ key: 'a' }))).toBeNull()
  })

  it('gets out of the way on Escape without marking', () => {
    expect(planKey(at({ key: 'Escape' }))).toMatchObject({ record: null, blur: true })
  })
})

describe('planAudioKey', () => {
  const base = { altKey: true, ctrlKey: false, metaKey: false }

  it('steps back and forward', () => {
    expect(planAudioKey({ ...base, key: 'ArrowLeft' })).toBe(-NUDGE_SECONDS)
    expect(planAudioKey({ ...base, key: 'ArrowRight' })).toBe(NUDGE_SECONDS)
  })

  /*
   * The whole point of the modifier: a teacher correcting a respelling uses the
   * arrows to move the caret, and must keep being able to.
   */
  it('leaves the bare arrow keys to the text box', () => {
    expect(planAudioKey({ ...base, altKey: false, key: 'ArrowLeft' })).toBeNull()
    expect(planAudioKey({ ...base, altKey: false, key: 'ArrowRight' })).toBeNull()
  })

  it('leaves system and browser shortcuts alone', () => {
    expect(planAudioKey({ ...base, ctrlKey: true, key: 'ArrowLeft' })).toBeNull()
    expect(planAudioKey({ ...base, metaKey: true, key: 'ArrowRight' })).toBeNull()
  })

  it('ignores the keys the passage already uses', () => {
    for (const key of ['Tab', 'Enter', '-', 'Escape', 'a']) {
      expect(planAudioKey({ ...base, key })).toBeNull()
    }
  })
})
