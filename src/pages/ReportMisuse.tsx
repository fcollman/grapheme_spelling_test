import { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { useStudentNames } from '../state/names'
import { useSelectedTests } from '../state/useSelectedTests'
import { TestPicker } from '../components/TestPicker'
import { buildReportsAcross, CLASS, getMisuse } from '../reports/aggregate'
import { display, get, REPORT_ORDER } from '../data/phonemes'
import { download, exportName } from '../state/persist'
import { toCsv } from '../export/csv'
import { OccurrenceModal } from '../components/OccurrenceModal'
import type { Drill } from '../reports/occurrences'

/**
 * The mirror of the accuracy report: how often a student reached for a sound that
 * was not the one called for. A large number on one row is usually a default the
 * student falls back on when unsure.
 */
export function ReportMisuse() {
  const { project } = useStore()
  const scope = useSelectedTests('active')
  const names = useStudentNames()
  const [drill, setDrill] = useState<Drill | null>(null)
  const { notation } = project.settings
  const reports = useMemo(
    () => buildReportsAcross(project, scope.sources),
    [project, scope.sources],
  )

  const rows = REPORT_ORDER.filter((p) => (reports.misuse.get(p)?.get(CLASS) ?? 0) > 0)
  // Whole class first, and the CSV header derives from the same list — otherwise
  // reordering here would silently shift every column in the export out of line.
  const columns = [
    { id: CLASS, name: 'Whole class' },
    ...project.students.map((s) => ({ id: s.id, name: names(s.id) })),
  ]

  const worst = Math.max(1, ...rows.map((p) => getMisuse(reports, p, CLASS)))

  const exportCsv = () => {
    const out: string[][] = [['Sound', 'Key word', ...columns.map((c) => c.name)]]
    for (const p of rows) {
      out.push([
        display(p, notation),
        get(p).example,
        ...columns.map((c) => String(getMisuse(reports, p, c.id))),
      ])
    }
    download(exportName(scope.scopeSlug, 'phoneme-misuse'), toCsv(out), 'text/csv')
  }

  if (scope.loading || rows.length === 0) {
    return (
      <section className="panel">
        <h2>Phoneme misuse</h2>

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

  return (
    <section className="panel">
      <span className="print-title">
        {scope.scopeLabel} · Phoneme misuse
      </span>
      <h2>Phoneme misuse</h2>

      <TestPicker tests={scope.tests} selected={scope.selected} onChange={scope.setSelected} />
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
                <th key={c.id} className={`num ${c.id === CLASS ? 'classcol' : ''}`}>
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
                      className={`num ${n > 0 ? 'drillable' : ''} ${c.id === CLASS ? 'classcol' : ''}`}
                      title={n > 0 ? 'Click to see every example' : undefined}
                      onClick={() =>
                        n > 0 &&
                        setDrill({
                          kind: 'misuse',
                          key: p,
                          label: `${display(p, notation)} used where it was not needed`,
                          studentId: c.id,
                          sources: scope.sources,
                          scopeLabel: scope.scopeLabel,
                        })
                      }
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

      {drill && <OccurrenceModal drill={drill} onClose={() => setDrill(null)} />}
    </section>
  )
}
