import { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { useStudentNames } from '../state/names'
import { useSelectedTests } from '../state/useSelectedTests'
import { TestPicker } from '../components/TestPicker'
import { buildReportsAcross, CLASS, getConfusion, NONE } from '../reports/aggregate'
import { display, get, type PhonemeId } from '../data/phonemes'
import { download, exportName } from '../state/persist'
import { toCsv } from '../export/csv'
import { OccurrenceModal } from '../components/OccurrenceModal'
import type { Drill } from '../reports/occurrences'

/**
 * Target sound down the side, sound actually produced across the top. The diagonal
 * is everything that went right; everything off it is a specific confusion to
 * teach against. An ∅ column counts sounds left out, and an ∅ row counts sounds
 * inserted that the word did not call for.
 */
export function ReportConfusion() {
  const { project } = useStore()
  const scope = useSelectedTests('active')
  const names = useStudentNames()
  const { notation } = project.settings
  const reports = useMemo(
    () => buildReportsAcross(project, scope.sources),
    [project, scope.sources],
  )
  const [who, setWho] = useState<string>(CLASS)
  const [hideEmpty, setHideEmpty] = useState(true)
  const [drill, setDrill] = useState<Drill | null>(null)

  const label = (id: string) => (id === NONE ? NONE : display(id as PhonemeId, notation))

  const allRows: string[] = [...reports.phonemes, NONE]
  const allCols: string[] = [...reports.producedPhonemes, NONE]

  const rowTotal = (r: string) => allCols.reduce((sum, c) => sum + getConfusion(reports, who, r, c), 0)
  const colTotal = (c: string) => allRows.reduce((sum, r) => sum + getConfusion(reports, who, r, c), 0)

  const rows = hideEmpty ? allRows.filter((r) => rowTotal(r) > 0) : allRows
  const cols = hideEmpty ? allCols.filter((c) => colTotal(c) > 0) : allCols

  const exportCsv = () => {
    const name = who === CLASS ? 'whole-class' : names(who)
    const out: string[][] = [['Target sound \\ Sound produced', ...cols.map(label)]]
    for (const r of rows) {
      out.push([label(r), ...cols.map((c) => String(getConfusion(reports, who, r, c)))])
    }
    download(exportName(scope.scopeSlug, `confusion-${name}`), toCsv(out), 'text/csv')
  }

  if (scope.loading || rows.length === 0 || cols.length === 0) {
    return (
      <section className="panel">
        <h2>Confusion matrix</h2>

      <TestPicker tests={scope.tests} selected={scope.selected} onChange={scope.setSelected} />
        <div className="empty">
          {scope.loading
            ? 'Analysing every test…'
            : scope.sources.length === 0
              ? 'Choose at least one test above.'
              : 'Nothing to report yet — enter some student spellings first.'}
        </div>
      </section>
    )
  }

  const whoName = who === CLASS ? 'Whole class' : names(who)

  return (
    <section className="panel">
      <span className="print-title">
        {scope.scopeLabel} · Confusion matrix · {whoName}
      </span>
      <h2>Confusion matrix</h2>

      <TestPicker tests={scope.tests} selected={scope.selected} onChange={scope.setSelected} />
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
                {names(s.id)}
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
        <table className="grid-sticky report-grid">
          <thead>
            <tr>
              <th className="c1">Needed ↓ / Wrote →</th>
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
                <th className="rowhead phoneme c1" title={r === NONE ? 'Sound inserted' : get(r).example}>
                  {label(r)}
                  {r !== NONE && <span className="keyword">{get(r).example}</span>}
                </th>
                {cols.map((c) => {
                  const n = getConfusion(reports, who, r, c)
                  const diagonal = r === c && r !== NONE
                  return (
                    <td
                      key={c}
                      className={`num ${n > 0 ? 'drillable' : ''}`}
                      onClick={() =>
                        n > 0 &&
                        setDrill({
                          kind: 'phoneme',
                          key: r,
                          label:
                            r === NONE
                              ? `added ${label(c)}`
                              : `${label(r)} → ${c === NONE ? 'nothing' : label(c)}`,
                          studentId: who,
                          sources: scope.sources,
                          scopeLabel: scope.scopeLabel,
                          produced: c,
                        })
                      }
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

      {drill && <OccurrenceModal drill={drill} onClose={() => setDrill(null)} />}
    </section>
  )
}
