import { describe, expect, it } from 'vitest'
import { reducer } from './store'
import { emptyProject, emptyTest, type Project, type Test } from './types'

/**
 * Deleting a test is the one destructive action in the app that keeps nothing
 * back, so it is worth pinning down exactly what it takes with it and what it
 * leaves behind.
 */

function testWith(id: string, name: string): Test {
  return {
    ...emptyTest(name),
    id,
    words: [{ id: `${id}_w`, text: 'ship', nonsense: false }],
    responses: { [`${id}_w`]: { a: 'shp' } },
    overrides: { [`${id}_w`]: { a: { 0: { mark: 'wrong' } } } },
  }
}

function threeTests(active: string): Project {
  return {
    ...emptyProject(),
    students: [{ id: 'a', name: 'Ada' }],
    tests: [testWith('t1', 'Test 1'), testWith('t2', 'Test 2'), testWith('t3', 'Test 3')],
    activeTestId: active,
  }
}

describe('deleting a test', () => {
  it('takes its words, responses and corrections with it', () => {
    const after = reducer(threeTests('t2'), { type: 'removeTest', id: 't2' })

    expect(after.tests.map((t) => t.id)).toEqual(['t1', 't3'])
    // Nothing is archived the way a removed student is: it is gone from the file.
    expect(JSON.stringify(after)).not.toContain('t2_w')
  })

  it('lands on the neighbour, not back at the first test', () => {
    const after = reducer(threeTests('t3'), { type: 'removeTest', id: 't3' })
    expect(after.activeTestId).toBe('t2')
  })

  it('stays where it is when another test is deleted', () => {
    const after = reducer(threeTests('t3'), { type: 'removeTest', id: 't1' })
    expect(after.activeTestId).toBe('t3')
    expect(after.tests.map((t) => t.id)).toEqual(['t2', 't3'])
  })

  it('leaves an empty test behind rather than no test at all', () => {
    const one: Project = { ...emptyProject(), tests: [testWith('t1', 'Test 1')], activeTestId: 't1' }
    const after = reducer(one, { type: 'removeTest', id: 't1' })

    expect(after.tests).toHaveLength(1)
    expect(after.tests[0].id).not.toBe('t1')
    expect(after.tests[0].words).toEqual([])
    expect(after.activeTestId).toBe(after.tests[0].id)
  })

  it('leaves the class alone', () => {
    const after = reducer(threeTests('t1'), { type: 'removeTest', id: 't1' })
    expect(after.students).toEqual([{ id: 'a', name: 'Ada' }])
  })
})
