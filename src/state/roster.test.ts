import { describe, expect, it } from 'vitest'
import { reducer } from './store'
import { emptyProject, emptyTest, type Project } from './types'

/**
 * The roster is project-wide: every test shows every student, so a new test
 * already starts with the whole class on it. The only way a student goes
 * missing is being removed — and removing them leaves their spellings behind on
 * purpose. These tests pin down the part that makes that recoverable.
 */

function projectWith(responses: Record<string, Record<string, string>>): Project {
  const test = { ...emptyTest('Test 1'), id: 't1', words: [{ id: 'w1', text: 'ship', nonsense: false }], responses }
  return {
    ...emptyProject(),
    students: [
      { id: 'a', name: 'Ada' },
      { id: 'b', name: 'Ben' },
    ],
    tests: [test],
    activeTestId: 't1',
  }
}

describe('removing a student', () => {
  it('archives one who has spellings, so they can be put back', () => {
    const before = projectWith({ w1: { a: 'shp', b: 'ship' } })
    const after = reducer(before, { type: 'removeStudent', id: 'a' })

    expect(after.students.map((s) => s.id)).toEqual(['b'])
    expect(after.archivedStudents).toEqual([{ id: 'a', name: 'Ada' }])
    // The answers themselves are untouched — that is what there is to restore.
    expect(after.tests[0].responses.w1.a).toBe('shp')
  })

  it('does not archive one who never wrote anything', () => {
    const before = projectWith({ w1: { b: 'ship' } })
    const after = reducer(before, { type: 'removeStudent', id: 'a' })

    expect(after.students.map((s) => s.id)).toEqual(['b'])
    expect(after.archivedStudents ?? []).toEqual([])
  })

  it('treats a blank answer as nothing written', () => {
    const before = projectWith({ w1: { a: '   ', b: 'ship' } })
    const after = reducer(before, { type: 'removeStudent', id: 'a' })

    expect(after.archivedStudents ?? []).toEqual([])
  })
})

describe('adding students back from an earlier test', () => {
  it('returns them to the roster and clears them from the archive', () => {
    const start = projectWith({ w1: { a: 'shp', b: 'ship' } })
    const removed = reducer(reducer(start, { type: 'removeStudent', id: 'a' }), {
      type: 'removeStudent',
      id: 'b',
    })
    expect(removed.students).toEqual([])

    const restored = reducer(removed, { type: 'restoreStudents', ids: ['a'] })
    expect(restored.students).toEqual([{ id: 'a', name: 'Ada' }])
    expect(restored.archivedStudents).toEqual([{ id: 'b', name: 'Ben' }])
    // Their old work is still keyed to the same id, so it comes back with them.
    expect(restored.tests[0].responses.w1.a).toBe('shp')
  })

  it('leaves the project alone when nothing matches', () => {
    const before = projectWith({ w1: { a: 'shp' } })
    expect(reducer(before, { type: 'restoreStudents', ids: ['nobody'] })).toBe(before)
  })
})
