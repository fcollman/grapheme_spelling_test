import { useMemo } from 'react'
import { useStore } from '../state/store'
import type { AnalysisResult } from '../state/useAnalysis'
import { buildReports, CLASS, getMisuse } from '../reports/aggregate'
import { display, get, REPORT_ORDER } from '../data/phonemes'
import { download, exportName } from '../state/persist'
import { toCsv } from '../export/csv'

/**
 * The mirror of the accuracy report: how often a student reached for a sound that
 * was not the one called for. A large number on one row is usually a default the
 * student falls back on when unsure.
 */
export function ReportMisuse({ analysis }: { analysis: AnalysisResult }) {
  const { project, test } = useStore()
  const { notation } = project.settings
  const reports = useMemo(() => buildReports(project, test, analysis), [project, test, analysis])

  const rows = REPORT_ORDER.filter((p) => (reports.misuse.get(p)?.get(CLASS) ?? 0) > 0)
  const columns = [...project.students.map((s) => ({ id: s.id, name: s.name })), { id: CLASS, name: 'Whole class' }]

  const worst = Math.max(1, ...rows.map((p) => getMisuse(reports, p, CLASS)))

  const exportCsv = () => {
    const out: string[][] = [['Sound', 'Key word', ...project.students.map((s) => s.name), 'Whole class']]
    for (const p of rows) {
      out.push([
        display(p, notation),
        get(p).example,
        ...columns.map((c) => String(getMisuse(reports, p, c.id))),
      ])
    }
    download(exportName(test.name, 'phoneme-misuse'), toCsv(out), 'text/csv')
  }

  if (rows.length === 0) {
    return (
      <section className="panel">
        <h2>Phoneme misuse</h2>
        <div className="empty">
          No wrong sounds recorded yet. This report fills in once students substitute or insert sounds.
        </div>
      </section>
    )
  }

  return (
    <section className="panel">
      <span className="print-title">
        {test.name} · {test.date} · Phoneme misuse
      </span>
      <h2>Phoneme misuse</h2>
      <p className="hint">
        How many times each student wrote letters making this sound when a different sound was
        needed. Inserted sounds are counted here too. Read it alongside the accuracy report: a sound
        can be both well known and over-used.
      </p>

      <div className="group no-print" style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        <span className="spacer" />
        <button className="btn" onClick={exportCsv}>
          Download CSV
        </button>
        <button className="btn" onClick={() => window.print()}>
          Print / Save PDF
        </button>
      </div>

      <div className="scroll">
        <table className="grid-sticky report-grid">
          <thead>
            <tr>
              <th className="c1">Sound</th>
              <th className="c2">As in</th>
              {columns.map((c) => (
                <th key={c.id} className="num">
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p}>
                <th className="rowhead phoneme c1">{display(p, notation)}</th>
                <td className="c2" style={{ color: 'var(--muted)' }}>{get(p).example}</td>
                {columns.map((c) => {
                  const n = getMisuse(reports, p, c.id)
                  // Heavier red the closer a count is to the worst on the sheet.
                  const intensity = n === 0 ? 0 : Math.min(1, n / worst)
                  return (
                    <td
                      key={c.id}
                      className="num"
                      style={{
                        background: n === 0 ? undefined : `hsl(4 72% ${92 - intensity * 20}%)`,
                        color: n === 0 ? 'var(--muted)' : 'hsl(4 70% 28%)',
                        fontWeight: c.id === CLASS ? 700 : 500,
                      }}
                    >
                      {n || '·'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
