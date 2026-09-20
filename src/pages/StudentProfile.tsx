import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { cellKey, useAllTests } from '../state/useAnalysis'
import type { Mark } from '../engine/align'
import {
  buildReportsAcross,
  getExamples,
  getGraphemeTally,
  NONE,
  testsInOrder,
  type GraphemeRow,
  type ReportSource,
  type Reports,
} from '../reports/aggregate'
import { CATEGORIES, category, type CategoryId } from '../data/categories'
import { displayList, type Notation } from '../data/phonemes'
import { CategoryDot } from '../components/CategoryTag'
import { TestPicker } from '../components/TestPicker'
import { scaleColor, scaleInk } from '../components/Legend'
import { download, exportName } from '../state/persist'
import { toCsv } from '../export/csv'
import type { Student } from '../state/types'

/**
 * Everything about one student on one page, for an IEP meeting or a parent
 * conference. Every other report except progress is class-wide.
 *
 * Which tests it covers is up to the teacher: one lesson's test, the last three,
 * the first three against the last three, or a whole term pooled together.
 */

/**
 * The line between "secure" and "needs work".
 *
 * 80% is the rule of thumb the intervention literature uses for deciding an area
 * needs teaching, and it is the number IEP goals are usually written against.
 * Fixed deliberately — there is no settings UI for it.
 */
const MASTERY = 0.8

interface CategorySummary {
  id: CategoryId
  correct: number
  total: number
}

interface ErrorLine {
  row: GraphemeRow
  wrote: string
  count: number
  words: string[]
  /**
   * 'plausible' means the sounds were right and only the spelling differed. Those
   * belong in a separate list from genuine sound errors — "kat" for "cat" needs
   * orthographic teaching, "cet" for "cat" needs phonological teaching.
   */
  mark: Mark
}

function summarise(reports: Reports, studentId: string): CategorySummary[] {
  const totals = new Map<CategoryId, CategorySummary>()
  for (const g of reports.graphemes) {
    const t = getGraphemeTally(reports, g.key, studentId)
    const acc = totals.get(g.category) ?? { id: g.category, correct: 0, total: 0 }
    acc.correct += t.correct
    acc.total += t.total
    totals.set(g.category, acc)
  }
  const rank = new Map(CATEGORIES.map((c, i) => [c.id, i]))
  return [...totals.values()].sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99))
}

function errorLines(reports: Reports, studentId: string): ErrorLine[] {
  const out: ErrorLine[] = []
  const byUnit = reports.graphemeConfusion.get(studentId)
  if (!byUnit) return out

  for (const g of reports.graphemes) {
    const written = byUnit.get(g.key)
    if (!written) continue
    for (const [wrote, count] of written) {
      if (wrote === g.letters) continue // the diagonal: they got it right
      const examples = getExamples(reports, studentId, g.key, wrote)
      if (examples.length === 0) continue // nothing was actually marked down here
      out.push({
        row: g,
        wrote,
        count,
        words: examples.map((e) => e.word),
        mark: examples[0].mark,
      })
    }
  }

  return out.sort((a, b) => b.count - a.count || a.row.letters.localeCompare(b.row.letters))
}

function ErrorList({
  lines,
  notation,
  plausible = false,
}: {
  lines: ErrorLine[]
  notation: Notation
  plausible?: boolean
}) {
  return (
    <ul className={`errorlist ${plausible ? 'plausible' : ''}`}>
      {lines.map((e, i) => (
        <li key={`${e.row.key}-${e.wrote}-${i}`}>
          <CategoryDot id={e.row.category} />
          <span className="target">{e.row.patternLabel ?? e.row.letters}</span>
          <span className="sounds">{displayList(e.row.phonemes, notation)}</span>
          <span className="arrow">→</span>
          <span className="wrote">{e.wrote === NONE ? 'left it out' : `wrote “${e.wrote}”`}</span>
          {e.words.length > 0 && (
            <span className="in">
              in{' '}
              {e.words
                .map((w, j) => <em key={j}>{w}</em>)
                .reduce((a, b) => (
                  <>
                    {a}, {b}
                  </>
                ))}
            </span>
          )}
          {e.count > e.words.length && <span className="sub"> ({e.count} times)</span>}
        </li>
      ))}
    </ul>
  )
}

export function StudentProfile() {
  const { project } = useStore()
  const { notation } = project.settings
  const [who, setWho] = useState<string>('all')

  const tests = useMemo(() => testsInOrder(project), [project])
  const all = useAllTests(project, true)

  const [selected, setSelected] = useState<Set<string>>(() => new Set(tests.map((t) => t.id)))

  // When the project changes underneath us — a demo loaded, a test added — start
  // from everything again rather than holding on to ids that no longer exist.
  const testIds = tests.map((t) => t.id).join(',')
  useEffect(() => {
    setSelected(new Set(tests.map((t) => t.id)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testIds])

  const sources: ReportSource[] = useMemo(() => {
    if (all.loading) return []
    return tests
      .filter((t) => selected.has(t.id))
      .map((test) => ({ test, analysis: all.byTest.get(test.id)! }))
      .filter((s) => s.analysis)
  }, [tests, selected, all.byTest, all.loading])

  const reports = useMemo(() => buildReportsAcross(project, sources), [project, sources])

  const shown = who === 'all' ? project.students : project.students.filter((s) => s.id === who)

  const exportCsv = () => {
    const rows: string[][] = [
      ['Tests included', sources.map((s) => `${s.test.name} (${s.test.date})`).join('; ')],
      [],
      ['Student', 'Section', 'Item', 'Sounds', 'Detail', 'Correct', 'Total', 'Percent'],
    ]
    for (const s of shown) {
      for (const c of summarise(reports, s.id)) {
        rows.push([
          s.name,
          'Category',
          category(c.id).label,
          '',
          '',
          String(c.correct),
          String(c.total),
          c.total > 0 ? `${Math.round((c.correct / c.total) * 100)}%` : '',
        ])
      }
      for (const e of errorLines(reports, s.id)) {
        rows.push([
          s.name,
          e.mark === 'plausible' ? 'Spelling error' : 'Sound error',
          e.row.patternLabel ?? e.row.letters,
          displayList(e.row.phonemes, notation),
          `wrote "${e.wrote === NONE ? 'nothing' : e.wrote}"${e.words.length ? ` in ${e.words.join(', ')}` : ''}`,
          '',
          String(e.count),
          '',
        ])
      }
    }
    download(exportName('student-profiles', 'summary'), toCsv(rows), 'text/csv')
  }

  if (project.students.length === 0 || tests.every((t) => t.words.length === 0)) {
    return (
      <section className="panel">
        <h2>Student profile</h2>
        <div className="empty">Add words and students on the spelling test tab first.</div>
      </section>
    )
  }

  return (
    <section className="panel">
      <h2>Student profile</h2>
      <p className="hint">
        One page per student, for an IEP meeting or a parent conference. Choose which tests it
        covers — a single test, the last three, or a whole term pooled together. A category counts
        as secure at {Math.round(MASTERY * 100)}% or above, the threshold usually used to decide
        something still needs teaching.
      </p>

      <div className="group no-print" style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label className="check">
          Student
          <select value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="all">All students (one page each)</option>
            {project.students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <span className="spacer" />
        <button className="btn" onClick={exportCsv} disabled={sources.length === 0}>
          Download CSV
        </button>
        <button className="btn" onClick={() => window.print()}>
          Print / Save PDF
        </button>
      </div>

      <TestPicker tests={tests} selected={selected} onChange={setSelected} />

      {all.error && <div className="error">Could not analyse every test: {all.error}</div>}
      {all.loading && <div className="empty">Analysing…</div>}

      {!all.loading && sources.length === 0 && (
        <div className="empty">Choose at least one test to build a profile from.</div>
      )}

      {!all.loading &&
        sources.length > 0 &&
        shown.map((student) => (
          <Profile key={student.id} student={student} reports={reports} sources={sources} />
        ))}
    </section>
  )
}

function Profile({
  student,
  reports,
  sources,
}: {
  student: Student
  reports: Reports
  sources: ReportSource[]
}) {
  const { project } = useStore()
  const { notation } = project.settings

  const summary = summarise(reports, student.id)
  const errors = errorLines(reports, student.id)
  const soundErrors = errors.filter((e) => e.mark !== 'plausible')
  const spellingErrors = errors.filter((e) => e.mark === 'plausible')

  // Per-test scores, which double as the header's overall total.
  const perTest = sources.map(({ test, analysis }) => {
    const attempted = test.words.filter((w) => analysis.byCell.get(cellKey(w.id, student.id))?.attempted)
    const correct = attempted.filter(
      (w) => analysis.byCell.get(cellKey(w.id, student.id))?.spellingCorrect,
    )
    return { test, analysis, attempted: attempted.length, correct: correct.length }
  })

  const totalAttempted = perTest.reduce((n, t) => n + t.attempted, 0)
  const totalCorrect = perTest.reduce((n, t) => n + t.correct, 0)

  const secure = summary.filter((c) => c.total > 0 && c.correct / c.total >= MASTERY)
  const needsWork = summary.filter((c) => c.total > 0 && c.correct / c.total < MASTERY)
  const notAssessed = summary.filter((c) => c.total === 0)

  const single = sources.length === 1
  const span =
    single
      ? `${sources[0].test.name} · ${sources[0].test.date}`
      : `${sources.length} tests · ${sources[0].test.date} to ${sources[sources.length - 1].test.date}`

  return (
    <article className="profile">
      <header>
        <div>
          <h3>{student.name}</h3>
          <p className="sub">{span}</p>
        </div>
        <div className="score">
          <strong>
            {totalCorrect}/{totalAttempted}
          </strong>
          <span>words spelled correctly</span>
        </div>
      </header>

      <div className="profile-columns">
        <section>
          <h4>Secure ({Math.round(MASTERY * 100)}% or above)</h4>
          {secure.length === 0 ? (
            <p className="sub">Nothing reached {Math.round(MASTERY * 100)}% across these tests.</p>
          ) : (
            <ul className="chips">
              {secure.map((c) => (
                <li key={c.id}>
                  <CategoryDot id={c.id} />
                  {category(c.id).label} <span className="frac">{c.correct}/{c.total}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h4>Needs work</h4>
          {needsWork.length === 0 ? (
            <p className="sub">Nothing fell below {Math.round(MASTERY * 100)}%.</p>
          ) : (
            <ul className="chips">
              {needsWork.map((c) => (
                <li key={c.id}>
                  <CategoryDot id={c.id} />
                  {category(c.id).label} <span className="frac">{c.correct}/{c.total}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {notAssessed.length > 0 && (
        <p className="sub">
          Not assessed on these tests: {notAssessed.map((c) => category(c.id).label).join(', ')}.
        </p>
      )}

      <h4>By category</h4>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th className="num">Correct</th>
              <th className="num">Accuracy</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((c) => {
              const frac = c.total === 0 ? null : c.correct / c.total
              return (
                <tr key={c.id}>
                  <th className="rowhead">
                    <CategoryDot id={c.id} />
                    {category(c.id).label}
                  </th>
                  <td className="num">
                    {c.correct}/{c.total}
                  </td>
                  <td
                    className="num"
                    style={{
                      background: frac === null ? 'var(--none-bg)' : scaleColor(frac),
                      color: frac === null ? 'var(--none-ink)' : scaleInk(frac),
                      fontWeight: 600,
                    }}
                  >
                    {frac === null ? 'not assessed' : `${Math.round(frac * 100)}%`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <h4>Wrong sound</h4>
      {soundErrors.length === 0 ? (
        <p className="sub">No sound errors on these tests.</p>
      ) : (
        <ErrorList lines={soundErrors} notation={notation} />
      )}

      {spellingErrors.length > 0 && (
        <>
          <h4>Right sound, different spelling</h4>
          <p className="sub" style={{ marginBottom: 6 }}>
            These sounded correct read aloud. The sound is known; the spelling choice is what needs
            teaching.
          </p>
          <ErrorList lines={spellingErrors} notation={notation} plausible />
        </>
      )}

      {/*
        With one test the word list is the evidence. Across a term it would run to
        a hundred rows and bury everything above it, so the per-test scores stand
        in for it instead.
      */}
      {single ? (
        <>
          <h4>Every word</h4>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Word</th>
                  <th>Wrote</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {sources[0].test.words.map((w) => {
                  const a = sources[0].analysis.byCell.get(cellKey(w.id, student.id))
                  const state = !a?.attempted ? 'omitted' : a.spellingCorrect ? 'exact' : 'wrong'
                  return (
                    <tr key={w.id}>
                      <th className="rowhead">{w.text}</th>
                      <td className={`cell ${state}`} style={{ fontFamily: 'var(--mono)', cursor: 'default' }}>
                        {a?.attempted ? a.attempt : '—'}
                      </td>
                      <td style={{ color: 'var(--muted)' }}>{w.nonsense ? 'nonsense' : 'real'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <h4>Test by test</h4>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Date</th>
                  <th className="num">Words correct</th>
                  <th className="num">Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {perTest.map(({ test, attempted, correct }) => {
                  const frac = attempted === 0 ? null : correct / attempted
                  return (
                    <tr key={test.id}>
                      <th className="rowhead">{test.name}</th>
                      <td style={{ color: 'var(--muted)' }}>{test.date}</td>
                      <td className="num">
                        {correct}/{attempted}
                      </td>
                      <td
                        className="num"
                        style={{
                          background: frac === null ? 'var(--none-bg)' : scaleColor(frac),
                          color: frac === null ? 'var(--none-ink)' : scaleInk(frac),
                          fontWeight: 600,
                        }}
                        title={frac === null ? 'Nothing attempted' : undefined}
                      >
                        {frac === null ? 'not taken' : `${Math.round(frac * 100)}%`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </article>
  )
}
