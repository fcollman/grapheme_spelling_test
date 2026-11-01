import { useEffect, useMemo, useState } from 'react'
import { useStore } from './store'
import { useAllTests } from './useAnalysis'
import { testsInOrder, type ReportSource } from '../reports/aggregate'
import type { Test } from './types'

/**
 * Which tests a report covers, and their analyses.
 *
 * Every report can be widened from one test to a whole term, so the selection
 * state, the reset rules and the wording of the scope all live here rather than
 * being written out once per page.
 */
export interface SelectedTests {
  loading: boolean
  error: string | null
  /** Every test, oldest first — what the picker lists. */
  tests: Test[]
  selected: Set<string>
  setSelected: (next: Set<string>) => void
  /** The selected tests with their analyses, ready for buildReportsAcross. */
  sources: ReportSource[]
  /** "Unit 4 · 2026-01-10", or "3 tests · 2026-01-10 to 2026-03-10". */
  scopeLabel: string
  /** A short form for file names: one test's name, or "3 tests". */
  scopeSlug: string
  /**
   * The date to file this export under: the test's own date when it covers a
   * single test, which is what a teacher will look for it by, otherwise today.
   */
  scopeDate: string
}

/**
 * @param defaultTo 'active' follows the test chosen in the toolbar, which keeps
 *   the report tabs behaving as they always have until the teacher widens them.
 *   'all' starts from everything, which is what a student profile wants.
 */
export function useSelectedTests(defaultTo: 'active' | 'all'): SelectedTests {
  const { project } = useStore()
  const tests = useMemo(() => testsInOrder(project), [project])
  const all = useAllTests(project, true)

  const initial = () =>
    new Set(defaultTo === 'all' ? tests.map((t) => t.id) : [project.activeTestId ?? tests[0]?.id].filter(Boolean) as string[])

  const [selected, setSelected] = useState<Set<string>>(initial)

  // Reset when the tests themselves change — a demo loaded, a test added — and,
  // for report tabs, when the teacher picks a different test in the toolbar.
  const testIds = tests.map((t) => t.id).join(',')
  const follow = defaultTo === 'active' ? project.activeTestId : ''
  useEffect(() => {
    setSelected(initial())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testIds, follow])

  const sources: ReportSource[] = useMemo(() => {
    if (all.loading) return []
    return tests
      .filter((t) => selected.has(t.id))
      .map((test) => ({ test, analysis: all.byTest.get(test.id)! }))
      .filter((s) => s.analysis)
  }, [tests, selected, all.byTest, all.loading])

  const scopeLabel =
    sources.length === 0
      ? 'No tests selected'
      : sources.length === 1
        ? `${sources[0].test.name} · ${sources[0].test.date}`
        : `${sources.length} tests · ${sources[0].test.date} to ${sources[sources.length - 1].test.date}`

  const scopeSlug = sources.length === 1 ? sources[0].test.name : `${sources.length} tests`
  const scopeDate = sources.length === 1 ? sources[0].test.date : new Date().toISOString().slice(0, 10)

  return {
    loading: all.loading,
    error: all.error,
    tests,
    selected,
    setSelected,
    sources,
    scopeLabel,
    scopeSlug,
    scopeDate,
  }
}
