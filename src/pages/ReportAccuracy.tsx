import { useMemo } from 'react'
import { useStore } from '../state/store'
import type { AnalysisResult } from '../state/useAnalysis'
import { buildReports, CLASS, getTally } from '../reports/aggregate'
import { display, get } from '../data/phonemes'
import { scaleColor, scaleInk } from '../components/Legend'
import { download, exportName } from '../state/persist'
import { toCsv } from '../export/csv'

/**
 * Rows are the phonemes this test actually covered, columns are students, plus a
 * class column so the teacher can spot the sounds to reteach to everyone.
 */
export function ReportAccuracy({ analysis }: { analysis: AnalysisResult }) {
  const { project, test, dispatch } = useStore()
  const { notation } = project.settings
  const reports = useMemo(() => buildReports(project, test, analysis), [project, test, analysis])

  const exportCsv = () => {
    const rows: string[][] = [['Sound', 'Key word', ...project.students.map((s) => s.name), 'Whole class']]
    for (const p of reports.phonemes) {
      const cells = [...project.students.map((s) => s.id), CLASS].map((who) => {
        const t = getTally(reports, p, who)
        return `${t.correct}/${t.total}`
      })
      rows.push([display(p, notation), get(p).example, ...cells])
    }
    download(exportName(test.name, 'accuracy-by-phoneme'), toCsv(rows), 'text/csv')
  }

  if (reports.phonemes.length === 0) {
    return (
      <section className="panel">
        <h2>Accuracy by phoneme</h2>
        <div className="empty">Nothing to report yet — enter some student spellings first.</div>
      </section>
    )
  }

  const columns = [...project.students.map((s) => ({ id: s.id, name: s.name })), { id: CLASS, name: 'Whole class' }]

  return (
    <section className="panel">
      <span className="print-title">
        {test.name} · {test.date} · Accuracy by phoneme
      </span>
      <h2>Accuracy by phoneme</h2>
      <p className="hint">
        How many times each student spelled each sound correctly, out of the times that sound came up
        in a word they attempted. A sound that never came up shows 0/0 in grey rather than counting
        against anyone.
      </p>

      <div className="group no-print" style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label className="check">
          <input
            type="checkbox"
            checked={project.settings.amberCountsCorrect}
            onChange={(e) =>
              dispatch({ type: 'updateSettings', settings: { amberCountsCorrect: e.target.checked } })
            }
          />
          Count “correct sound, different letters” as correct
        </label>
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
            {reports.phonemes.map((p) => (
              <tr key={p}>
                <th className="rowhead phoneme c1">{display(p, notation)}</th>
                <td className="c2" style={{ color: 'var(--muted)' }}>{get(p).example}</td>
                {columns.map((c) => {
                  const t = getTally(reports, p, c.id)
                  const frac = t.total === 0 ? null : t.correct / t.total
                  return (
                    <td
                      key={c.id}
                      className="num"
                      style={{
                        background: frac === null ? 'var(--none-bg)' : scaleColor(frac),
                        color: frac === null ? 'var(--none-ink)' : scaleInk(frac),
                        fontWeight: c.id === CLASS ? 700 : 500,
                      }}
                      title={
                        frac === null
                          ? 'This sound did not come up'
                          : `${Math.round(frac * 100)}% correct`
                      }
                    >
                      {t.correct}/{t.total}
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
