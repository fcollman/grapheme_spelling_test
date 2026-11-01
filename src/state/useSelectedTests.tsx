import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
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
/**
 * The one selection every report tab shares.
 *
 * `null` means the teacher has not chosen yet, and each page falls back to its
 * own sensible default — a profile to the whole year, a report tab to the test
 * chosen in the toolbar. The moment any picker is touched, that choice becomes
 * the selection everywhere, because moving between tabs to look at the same
 * span of tests from different angles is the whole point of having the tabs.
 */
const SharedSelection = createContext<{
  explicit: Set<string> | null
  choose: (next: Set<string>) => void
} | null>(null)

export function SelectedTestsProvider({ children }: { children: ReactNode }) {
  const { project } = useStore()
  const [explicit, setExplicit] = useState<Set<string> | null>(null)

  /*
   * A changed test list — a demo loaded, a test added or deleted — can leave a
   * selection pointing at tests that no longer exist. It goes back to the
   * per-page default rather than being quietly repaired, because a selection
   * that silently means something different from what was chosen is worse than
   * one that has visibly reset.
   */
  const testIds = project.tests.map((t) => t.id).join(',')
  useEffect(() => {
    setExplicit(null)
  }, [testIds])

  const value = useMemo(() => ({ explicit, choose: setExplicit }), [explicit])
  return <SharedSelection.Provider value={value}>{children}</SharedSelection.Provider>
}

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
 * @param defaultTo what this page shows before the teacher has chosen anything.
 *   'active' follows the test chosen in the toolbar, which keeps the report tabs
 *   behaving as they always have. 'all' starts from everything, which is what a
 *   student profile wants. Once any picker is touched the shared choice wins and
 *   this no longer applies — see {@link SelectedTestsProvider}.
 */
export function useSelectedTests(defaultTo: 'active' | 'all'): SelectedTests {
  const { project } = useStore()
  const shared = useContext(SharedSelection)
  const tests = useMemo(() => testsInOrder(project), [project])
  const all = useAllTests(project, true)

  // Recomputed rather than stored, so a page still on its default keeps step
  // with the toolbar as the teacher moves between tests to enter data.
  const fallback = useMemo(
    () =>
      new Set(
        defaultTo === 'all'
          ? tests.map((t) => t.id)
          : ([project.activeTestId ?? tests[0]?.id].filter(Boolean) as string[]),
      ),
    [defaultTo, tests, project.activeTestId],
  )

  const selected = shared?.explicit ?? fallback

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

  if (!shared) throw new Error('useSelectedTests outside SelectedTestsProvider')

  return {
    loading: all.loading,
    error: all.error,
    tests,
    selected,
    setSelected: shared.choose,
    sources,
    scopeLabel,
    scopeSlug,
    scopeDate,
  }
}
