import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useStore } from './store'
import { useAllTests } from './useAnalysis'
import { testsInOrder, type ReportSource } from '../reports/aggregate'
import { isReading, type Test } from './types'

/**
 * Which way round a report is reading the evidence.
 *
 * Encoding is the question the app was built for — you can hear /ā/, can you
 * write `ai`? Decoding is the same knowledge asked backwards — you can see
 * `ai`, can you say /ā/? A child can be fluent one way and lost the other, so
 * the two must never be pooled into one number; every report answers one
 * question at a time, and this says which.
 */
export type ReportMode = 'encoding' | 'decoding'

export function inMode(test: Test, mode: ReportMode): boolean {
  return isReading(test) === (mode === 'decoding')
}

/** What to call this mode's tests in a sentence. */
export function modeNoun(mode: ReportMode, plural = true): string {
  const one = mode === 'decoding' ? 'reading test' : 'spelling test'
  return plural ? `${one}s` : one
}

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
 *
 * Each mode keeps its own choice. A spelling selection means nothing in
 * decoding, and merging them would make "Clear" in one mode quietly empty the
 * other; kept apart, flipping the toggle and flipping back is lossless.
 */
const NO_CHOICE: Record<ReportMode, Set<string> | null> = { encoding: null, decoding: null }

const SharedSelection = createContext<{
  mode: ReportMode
  setMode: (mode: ReportMode) => void
  explicit: Record<ReportMode, Set<string> | null>
  choose: (mode: ReportMode, next: Set<string>) => void
} | null>(null)

export function SelectedTestsProvider({ children }: { children: ReactNode }) {
  const { project } = useStore()
  const [mode, setMode] = useState<ReportMode>('encoding')
  const [explicit, setExplicit] = useState(NO_CHOICE)

  /*
   * A changed test list — a demo loaded, a test added or deleted — can leave a
   * selection pointing at tests that no longer exist. It goes back to the
   * per-page default rather than being quietly repaired, because a selection
   * that silently means something different from what was chosen is worse than
   * one that has visibly reset.
   */
  const testIds = project.tests.map((t) => t.id).join(',')
  useEffect(() => {
    setExplicit(NO_CHOICE)
  }, [testIds])

  const choose = useCallback((forMode: ReportMode, next: Set<string>) => {
    setExplicit((prev) => ({ ...prev, [forMode]: next }))
  }, [])

  const value = useMemo(
    () => ({ mode, setMode, explicit, choose }),
    [mode, explicit, choose],
  )
  return <SharedSelection.Provider value={value}>{children}</SharedSelection.Provider>
}

/**
 * The encode/decode choice on its own.
 *
 * For the toggle itself, and for Progress over time, which walks the test list
 * directly instead of going through a selection.
 */
export function useReportMode(): { mode: ReportMode; setMode: (mode: ReportMode) => void } {
  const shared = useContext(SharedSelection)
  if (!shared) throw new Error('useReportMode outside SelectedTestsProvider')
  return { mode: shared.mode, setMode: shared.setMode }
}

export interface SelectedTests {
  loading: boolean
  error: string | null
  mode: ReportMode
  setMode: (mode: ReportMode) => void
  /** Every test of this mode, oldest first — what the picker lists. */
  tests: Test[]
  selected: Set<string>
  setSelected: (next: Set<string>) => void
  /** The selected tests with their analyses, ready for buildReportsAcross. */
  sources: ReportSource[]
  /** "Unit 4 · 2026-01-10", or "3 spelling tests · 2026-01-10 to 2026-03-10". */
  scopeLabel: string
  /** A short form for file names: one test's name, or "3 reading tests". */
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
  if (!shared) throw new Error('useSelectedTests outside SelectedTestsProvider')
  const { mode } = shared

  /*
   * One mode at a time, and the filter is here rather than in the aggregation
   * for a reason: `buildReportsAcross` is a pure function of the sources it is
   * handed, so choosing which way round a report reads costs exactly this line
   * and nothing downstream changes.
   */
  const tests = useMemo(
    () => testsInOrder(project).filter((t) => inMode(t, mode)),
    [project, mode],
  )
  const all = useAllTests(project, true)

  // Recomputed rather than stored, so a page still on its default keeps step
  // with the toolbar as the teacher moves between tests to enter data.
  const fallback = useMemo(() => {
    if (defaultTo === 'all') return new Set(tests.map((t) => t.id))
    /*
     * The toolbar's test when this mode covers it, and otherwise the most
     * recent one it does: flipping the toggle should show the newest reading
     * test, not an empty page under a picker nobody has touched.
     */
    const pick = tests.find((t) => t.id === project.activeTestId) ?? tests[tests.length - 1]
    return new Set(pick ? [pick.id] : [])
  }, [defaultTo, tests, project.activeTestId])

  const selected = shared.explicit[mode] ?? fallback
  const setSelected = useCallback(
    (next: Set<string>) => shared.choose(mode, next),
    [shared, mode],
  )

  const sources: ReportSource[] = useMemo(() => {
    if (all.loading) return []
    return tests
      .filter((t) => selected.has(t.id))
      .map((test) => ({ test, analysis: all.byTest.get(test.id)! }))
      .filter((s) => s.analysis)
  }, [tests, selected, all.byTest, all.loading])

  // Named in the label and the file name, so a printout or a download says
  // which question it answers without anyone having to remember.
  const noun = modeNoun(mode)

  const scopeLabel =
    sources.length === 0
      ? 'No tests selected'
      : sources.length === 1
        ? `${sources[0].test.name} · ${sources[0].test.date}`
        : `${sources.length} ${noun} · ${sources[0].test.date} to ${sources[sources.length - 1].test.date}`

  const scopeSlug = sources.length === 1 ? sources[0].test.name : `${sources.length} ${noun}`
  const scopeDate = sources.length === 1 ? sources[0].test.date : new Date().toISOString().slice(0, 10)

  return {
    loading: all.loading,
    error: all.error,
    mode,
    setMode: shared.setMode,
    tests,
    selected,
    setSelected,
    sources,
    scopeLabel,
    scopeSlug,
    scopeDate,
  }
}
