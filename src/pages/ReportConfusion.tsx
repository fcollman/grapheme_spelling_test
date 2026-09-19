import { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import type { AnalysisResult } from '../state/useAnalysis'
import { buildReports, CLASS, getConfusion, NONE } from '../reports/aggregate'
import { display, get, type PhonemeId } from '../data/phonemes'
import { download, exportName } from '../state/persist'
import { toCsv } from '../export/csv'

/**
 * Target sound down the side, sound actually produced across the top. The diagonal
 * is everything that went right; everything off it is a specific confusion to
 * teach against. An ∅ column counts sounds left out, and an ∅ row counts sounds
 * inserted that the word did not call for.
 */
export function ReportConfusion({ analysis }: { analysis: AnalysisResult }) {
  const { project, test } = useStore()
  const { notation } = project.settings
  const reports = useMemo(() => buildReports(project, test, analysis), [project, test, analysis])
  const [who, setWho] = useState<string>(CLASS)
  const [hideEmpty, setHideEmpty] = useState(true)

  const label = (id: string) => (id === NONE ? NONE : display(id as PhonemeId, notation))

  const allRows: string[] = [...reports.phonemes, NONE]
  const allCols: string[] = [...reports.producedPhonemes, NONE]

  const rowTotal = (r: string) => allCols.reduce((sum, c) => sum + getConfusion(reports, who, r, c), 0)
  const colTotal = (c: string) => allRows.reduce((sum, r) => sum + getConfusion(reports, who, r, c), 0)

  const rows = hideEmpty ? allRows.filter((r) => rowTotal(r) > 0) : allRows
  const cols = hideEmpty ? allCols.filter((c) => colTotal(c) > 0) : allCols

  const exportCsv = () => {
    const name = who === CLASS ? 'whole-class' : project.students.find((s) => s.id === who)?.name ?? 'student'
    const out: string[][] = [['Target sound \\ Sound produced', ...cols.map(label)]]
    for (const r of rows) {
      out.push([label(r), ...cols.map((c) => String(getConfusion(reports, who, r, c)))])
    }
    download(exportName(test.name, `confusion-${name}`), toCsv(out), 'text/csv')
  }

  if (rows.length === 0 || cols.length === 0) {
    return (
      <section className="panel">
        <h2>Confusion matrix</h2>
        <div className="empty">Nothing to report yet — enter some student spellings first.</div>
      </section>
    )
  }

  const whoName = who === CLASS ? 'Whole class' : project.students.find((s) => s.id === who)?.name ?? ''

  return (
    <section className="panel">
      <span className="print-title">
        {test.name} · {test.date} · Confusion matrix · {whoName}
      </span>
      <h2>Confusion matrix</h2>
      <p className="hint">
        Rows are the sound the word needed; columns are the sound the student's letters actually
        made. The shaded diagonal is correct. Off-diagonal numbers are the specific swaps to teach
        against — {NONE} in a column means the sound was left out, and the {NONE} row counts sounds
        added that the word did not call for.
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
          <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />
          Hide empty rows and columns
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
        <table>
          <thead>
            <tr>
              <th>Needed ↓ / Wrote →</th>
              {cols.map((c) => (
                <th key={c} className="num phoneme" title={c === NONE ? 'Sound left out' : get(c).example}>
                  {label(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r}>
                <th className="rowhead phoneme" title={r === NONE ? 'Sound inserted' : get(r).example}>
                  {label(r)}
                  {r !== NONE && <span className="keyword">{get(r).example}</span>}
                </th>
                {cols.map((c) => {
                  const n = getConfusion(reports, who, r, c)
                  const diagonal = r === c && r !== NONE
                  return (
                    <td
                      key={c}
                      className="num"
                      style={{
                        background: diagonal
                          ? n > 0
                            ? 'var(--exact-bg)'
                            : 'var(--none-bg)'
                          : n > 0
                            ? `hsl(4 72% ${93 - Math.min(1, n / 6) * 18}%)`
                            : undefined,
                        color: diagonal ? 'var(--exact-ink)' : n > 0 ? 'hsl(4 70% 28%)' : 'var(--muted)',
                        fontWeight: n > 0 ? 650 : 400,
                      }}
                      title={
                        diagonal
                          ? `${label(r)} correct ${n} time${n === 1 ? '' : 's'}`
                          : `Wrote ${label(c)} for ${label(r)} ${n} time${n === 1 ? '' : 's'}`
                      }
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
