import { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { useAllTests } from '../state/useAnalysis'
import { buildProgress, CLASS, testsInOrder, type ProgressLevel, type ProgressRow } from '../reports/aggregate'
import { category } from '../data/categories'
import { displayList } from '../data/phonemes'
import { CategoryDot } from '../components/CategoryTag'
import { scaleColor, scaleInk } from '../components/Legend'
import { download, exportName } from '../state/persist'
import { toCsv } from '../export/csv'

/**
 * Accuracy across every test, for showing growth on an IEP goal rather than a
 * single snapshot.
 *
 * The important rule here is that a row not covered by a test shows a grey dash,
 * never a zero. A teacher reading a gap as regression would be the one way this
 * report could actively mislead.
 */
export function ReportProgress() {
  const { project } = useStore()
  const [who, setWho] = useState<string>(CLASS)
  const [level, setLevel] = useState<ProgressLevel>('category')

  // Only analyses every test while this tab is open.
  const all = useAllTests(project, true)
  const tests = useMemo(() => testsInOrder(project), [project])

  const rows = useMemo(
    () => (all.loading ? [] : buildProgress(project, all.byTest, who, level)),
    [project, all.byTest, all.loading, who, level],
  )

  const whoName = who === CLASS ? 'Whole class' : project.students.find((s) => s.id === who)?.name ?? ''

  const exportCsv = () => {
    const header = ['Category', level === 'category' ? '' : 'Spelling', 'Sounds'].filter(Boolean)
    const out: string[][] = [
      [...header, ...tests.map((t) => `${t.name} (${t.date})`)],
    ]
    for (const r of rows) {
      const lead =
        level === 'category'
          ? [r.label, '']
          : [category(r.category).label, r.label, displayList(r.phonemes, project.settings.notation)]
      out.push([
        ...lead.filter((_, i) => (level === 'category' ? i === 0 : true)),
        ...r.points.map((p) => (p.tally ? `${p.tally.correct}/${p.tally.total}` : 'not assessed')),
      ])
    }
    download(exportName(`progress-${whoName}`, 'over-time'), toCsv(out), 'text/csv')
  }

  if (project.tests.length < 2) {
    return (
      <section className="panel">
        <h2>Progress over time</h2>
        <div className="empty">
          There is only one test so far. Add a second test with a later date and this report will
          compare them.
        </div>
      </section>
    )
  }

  return (
    <section className="panel">
      <span className="print-title">Progress over time · {whoName}</span>
      <h2>Progress over time</h2>
      <p className="hint">
        Accuracy on each test, oldest first, so growth on a goal can be shown rather than a single
        snapshot. A dash means that category was not on that test — it is not a zero, and it does not
        count against anyone.
      </p>

      <div className="group no-print" style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label className="check">
          Showing
          <select value={who} onChange={(e) => setWho(e.target.value)}>
            <option value={CLASS}>Whole class</option>
            {project.students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          Detail
          <select value={level} onChange={(e) => setLevel(e.target.value as ProgressLevel)}>
            <option value="category">By category</option>
            <option value="grapheme">By spelling</option>
          </select>
        </label>
        <span className="spacer" />
        <button className="btn" onClick={exportCsv} disabled={rows.length === 0}>
          Download CSV
        </button>
        <button className="btn" onClick={() => window.print()}>
          Print / Save PDF
        </button>
      </div>

      {all.error && <div className="error">Could not analyse every test: {all.error}</div>}
      {all.loading && <div className="empty">Analysing every test…</div>}

      {!all.loading && rows.length === 0 && (
        <div className="empty">No student spellings have been entered yet.</div>
      )}

      {!all.loading && rows.length > 0 && (
        <div className="scroll">
          <table className="grid-sticky report-grid">
            <thead>
              <tr>
                <th className="c1">{level === 'category' ? 'Category' : 'Spelling'}</th>
                {level === 'grapheme' && <th className="c2">Sounds</th>}
                {tests.map((t) => (
                  <th key={t.id} className="num">
                    {t.name}
                    <br />
                    <span style={{ fontWeight: 400, textTransform: 'none' }}>{t.date}</span>
                  </th>
                ))}
                <th className="num">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <ProgressLine key={r.key} row={r} level={level} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function ProgressLine({ row, level }: { row: ProgressRow; level: ProgressLevel }) {
  const { project } = useStore()
  const { notation } = project.settings

  const assessed = row.points.filter((p) => p.tally !== null)
  const first = assessed[0]?.tally
  const last = assessed[assessed.length - 1]?.tally
  // Needs two assessed points to be a change rather than just a value.
  const change =
    assessed.length >= 2 && first && last
      ? last.correct / last.total - first.correct / first.total
      : null

  return (
    <tr>
      <th className="rowhead c1">
        <CategoryDot id={row.category} />
        {row.label}
      </th>
      {level === 'grapheme' && (
        <td className="phoneme c2" style={{ color: 'var(--muted)' }}>
          {displayList(row.phonemes, notation)}
        </td>
      )}
      {row.points.map((p) => {
        const frac = p.tally ? p.tally.correct / p.tally.total : null
        return (
          <td
            key={p.testId}
            className="num"
            style={{
              background: frac === null ? undefined : scaleColor(frac),
              color: frac === null ? 'var(--none-ink)' : scaleInk(frac),
              fontWeight: 600,
            }}
            title={
              p.tally
                ? `${p.testName}: ${p.tally.correct}/${p.tally.total} (${Math.round(frac! * 100)}%)`
                : `${p.testName}: not assessed`
            }
          >
            {p.tally ? `${p.tally.correct}/${p.tally.total}` : '—'}
          </td>
        )
      })}
      <td
        className="num"
        title={change === null ? 'Needs two tests covering this to show a change' : undefined}
        style={{
          fontWeight: 700,
          color: change === null ? 'var(--muted)' : change > 0 ? 'var(--exact-ink)' : change < 0 ? 'var(--wrong-ink)' : 'var(--muted)',
        }}
      >
        {change === null
          ? '—'
          : change === 0
            ? 'same'
            : `${change > 0 ? '▲' : '▼'} ${Math.abs(Math.round(change * 100))}%`}
      </td>
    </tr>
  )
}
