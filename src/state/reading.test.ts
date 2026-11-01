import { describe, expect, it } from 'vitest'
import { reducer } from './store'
import { emptyProject, emptyReadingTest, isReading, testKind, type Project, type Test } from './types'

/**
 * A reading test records decoding, and it shares `responses` with the spelling
 * grid on purpose — `removeStudent` decides whether to archive a student by
 * scanning that map, so reading marks kept anywhere else would make a deleted
 * student unrecoverable. These pin down the rules that protects, plus what
 * happens to marks when the passage underneath them is edited.
 */

function readingProject(): Project {
  const test: Test = { ...emptyReadingTest('Reading Test 1'), id: 'r1' }
  return {
    ...emptyProject(),
    students: [{ id: 'a', name: 'Ada' }],
    tests: [test],
    activeTestId: 'r1',
    // Set the passage through the reducer so the word list is built the real way.
  } as Project
}

const withPassage = (passage: string) =>
  reducer(readingProject(), { type: 'setPassage', text: passage })

const wordIds = (p: Project) => p.tests[0].words.map((w) => w.id)

describe('what counts as a reading test', () => {
  it('treats a test with no kind as a spelling test', () => {
    expect(testKind(emptyProject().tests[0])).toBe('spelling')
    expect(isReading(emptyProject().tests[0])).toBe(false)
  })

  it('numbers each kind in its own sequence', () => {
    let p = emptyProject() // already holds Spelling Test 1
    p = reducer(p, { type: 'addTest', kind: 'reading' })
    expect(p.tests[1].name).toBe('Reading Test 1')

    p = reducer(p, { type: 'addTest' })
    expect(p.tests[2].name).toBe('Spelling Test 2')

    p = reducer(p, { type: 'addTest', kind: 'reading' })
    expect(p.tests[3].name).toBe('Reading Test 2')
  })
})

describe('setting the passage', () => {
  it('builds the word list from the text', () => {
    const after = withPassage('The cat sat.')
    expect(after.tests[0].words.map((w) => w.text)).toEqual(['The', 'cat', 'sat'])
    expect(after.tests[0].passage).toBe('The cat sat.')
  })

  it('returns the same project when the text has not changed', () => {
    const before = withPassage('The cat sat.')
    // No change means no re-render and no save prompt — the dirty flag is
    // object identity, so this has to be the very same object.
    expect(reducer(before, { type: 'setPassage', text: 'The cat sat.' })).toBe(before)
  })

  it('keeps marks on words the edit did not touch', () => {
    let p = withPassage('The cat sat')
    const [, cat] = wordIds(p)
    p = reducer(p, { type: 'setResponse', wordId: cat, studentId: 'a', value: 'kat' })
    p = reducer(p, { type: 'setPassage', text: 'The cat sat down' })

    expect(p.tests[0].responses[cat].a).toBe('kat')
  })

  it('clears marks for a word the edit removed', () => {
    let p = withPassage('The big cat')
    const [, big] = wordIds(p)
    p = reducer(p, { type: 'setResponse', wordId: big, studentId: 'a', value: 'bug' })
    p = reducer(p, { type: 'setPassage', text: 'The cat' })

    expect(p.tests[0].responses[big]).toBeUndefined()
  })

  it('clears marks for a slot that now says a different word', () => {
    let p = withPassage('The kat sat')
    const [, kat] = wordIds(p)
    p = reducer(p, { type: 'setResponse', wordId: kat, studentId: 'a', value: 'kat' })
    p = reducer(p, { type: 'setPassage', text: 'The dog sat' })

    // The slot survives so React keys stay stable, but a mark that meant "read
    // 'kat' correctly" must not become a mark about 'dog'.
    expect(p.tests[0].responses[kat]?.a).toBeUndefined()
  })
})

describe('marking a word as skipped', () => {
  it('records it and clears anything typed for it', () => {
    let p = withPassage('The cat sat')
    const [, cat] = wordIds(p)
    p = reducer(p, { type: 'setResponse', wordId: cat, studentId: 'a', value: 'kat' })
    p = reducer(p, { type: 'setOmitted', wordId: cat, studentId: 'a', omitted: true })

    expect(p.tests[0].omissions?.[cat]?.a).toBe(true)
    // They said nothing, so there is nothing to align.
    expect(p.tests[0].responses[cat]?.a).toBeUndefined()
  })

  it('is undone by typing what they said', () => {
    let p = withPassage('The cat sat')
    const [, cat] = wordIds(p)
    p = reducer(p, { type: 'setOmitted', wordId: cat, studentId: 'a', omitted: true })
    p = reducer(p, { type: 'setResponse', wordId: cat, studentId: 'a', value: 'kat' })

    expect(p.tests[0].omissions?.[cat]?.a).toBeUndefined()
    expect(p.tests[0].responses[cat].a).toBe('kat')
  })

  it('returns the same project when the flag is already as asked', () => {
    const p = withPassage('The cat sat')
    const [the] = wordIds(p)
    expect(reducer(p, { type: 'setOmitted', wordId: the, studentId: 'a', omitted: false })).toBe(p)
  })
})
