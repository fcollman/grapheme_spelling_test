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

/**
 * Clearing a column is the middle ground between fixing one cell and removing
 * the student: a whole paper typed against the wrong name. These pin down the
 * two things that make it safe to offer — it reaches no further than the test
 * on screen, and the student stays in the class.
 */
describe('clearing a student\u2019s answers on one test', () => {
  function twoTests(): Project {
    const t1 = {
      ...emptyTest('Test 1'),
      id: 't1',
      words: [{ id: 'w1', text: 'ship', nonsense: false }],
      responses: { w1: { a: 'shp', b: 'ship' } },
      overrides: {
        w1: { a: { 0: { mark: 'exact' as const } }, b: { 0: { mark: 'exact' as const } } },
      },
    }
    const t2 = {
      ...emptyTest('Test 2'),
      id: 't2',
      words: [{ id: 'w2', text: 'chop', nonsense: false }],
      responses: { w2: { a: 'chp' } },
    }
    return {
      ...emptyProject(),
      students: [
        { id: 'a', name: 'Ada' },
        { id: 'b', name: 'Ben' },
      ],
      tests: [t1, t2],
      activeTestId: 't1',
    }
  }

  it('empties only that student, on only the active test', () => {
    const after = reducer(twoTests(), { type: 'clearStudentResponses', studentId: 'a' })

    expect(after.tests[0].responses.w1).toEqual({ b: 'ship' })
    // The rest of the class and the other test carry on untouched.
    expect(after.tests[1].responses.w2).toEqual({ a: 'chp' })
  })

  it('takes the corrections with the answers', () => {
    const after = reducer(twoTests(), { type: 'clearStudentResponses', studentId: 'a' })

    // A stale override would re-apply itself to whatever gets typed next.
    expect(after.tests[0].overrides.w1).toEqual({ b: { 0: { mark: 'exact' } } })
  })

  it('leaves the student on the roster, with nothing archived', () => {
    const after = reducer(twoTests(), { type: 'clearStudentResponses', studentId: 'a' })

    expect(after.students.map((s) => s.id)).toEqual(['a', 'b'])
    expect(after.archivedStudents ?? []).toEqual([])
  })
})
