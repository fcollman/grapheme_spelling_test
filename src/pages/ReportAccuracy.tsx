import { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { useStudentNames } from '../state/names'
import type { AnalysisResult } from '../state/useAnalysis'
import { buildReports, CLASS, getTally } from '../reports/aggregate'
import { display, get } from '../data/phonemes'
import { scaleColor, scaleInk } from '../components/Legend'
import { Fraction, percentOf } from '../components/Fraction'
import { download, exportName } from '../state/persist'
import { toCsv } from '../export/csv'
import { OccurrenceModal } from '../components/OccurrenceModal'
import type { Drill } from '../reports/occurrences'

/**
 * Rows are the phonemes this test actually covered, columns are students, plus a
 * class column so the teacher can spot the sounds to reteach to everyone.
 */
export function ReportAccuracy({ analysis }: { analysis: AnalysisResult }) {
  const { project, test, dispatch } = useStore()
  const names = useStudentNames()
  const [drill, setDrill] = useState<Drill | null>(null)
  const { notation } = project.settings
  const reports = useMemo(() => buildReports(project, test, analysis), [project, test, analysis])

  // Whole class first: the summary is what decides what to reteach, so it should
  // not need scrolling past a full roster to reach.
  const columns = [
    { id: CLASS, name: 'Whole class' },
    ...project.students.map((s) => ({ id: s.id, name: names(s.id) })),
  ]

  const exportCsv = () => {
    const rows: string[][] = [['Sound', 'Key word', ...columns.map((c) => c.name)]]
    for (const p of reports.phonemes) {
      const cells = columns.map(({ id: who }) => {
        const t = getTally(reports, p, who)
        const pct = percentOf(t.correct, t.total)
        return pct ? `${t.correct}/${t.total} (${pct})` : `${t.correct}/${t.total}`
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
                <th key={c.id} className={`num ${c.id === CLASS ? 'classcol' : ''}`}>
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
                      className={`num drillable ${c.id === CLASS ? 'classcol' : ''}`}
                      onClick={() =>
                        setDrill({
                          kind: 'phoneme',
                          key: p,
                          label: display(p, notation),
                          sounds: [p],
                          studentId: c.id,
                          sources: [{ test, analysis }],
                          scopeLabel: test.name,
                        })
                      }
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
                      <Fraction correct={t.correct} total={t.total} />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drill && <OccurrenceModal drill={drill} onClose={() => setDrill(null)} />}
    </section>
  )
}
