import { useMemo, useState } from 'react'
import { PrintTitle } from '../components/PrintTitle'
import { useStore } from '../state/store'
import { useStudentNames } from '../state/names'
import { useSelectedTests } from '../state/useSelectedTests'
import { TestPicker } from '../components/TestPicker'
import { buildReportsAcross, CLASS, getTally } from '../reports/aggregate'
import { display, get } from '../data/phonemes'
import { scaleColor, scaleInk } from '../components/Legend'
import { Fraction, percentOf } from '../components/Fraction'
import { toCsv } from '../export/csv'
import { useDownloads } from '../components/DownloadProvider'
import { useFileName } from '../state/filename'
import { OccurrenceModal } from '../components/OccurrenceModal'
import type { Drill } from '../reports/occurrences'
import { SortHeader } from '../components/SortHeader'
import { nextSort, sortRows, type SortState } from '../reports/sorting'

/**
 * Rows are the phonemes this test actually covered, columns are students, plus a
 * class column so the teacher can spot the sounds to reteach to everyone.
 */
export function ReportAccuracy() {
  const { project, dispatch } = useStore()
  const scope = useSelectedTests('active')
  const { requestDownload, requestPrint } = useDownloads()
  const fileName = useFileName()
  const names = useStudentNames()
  const [drill, setDrill] = useState<Drill | null>(null)
  const [sort, setSort] = useState<SortState | null>(null)
  const { notation } = project.settings
  const reports = useMemo(
    () => buildReportsAcross(project, scope.sources),
    [project, scope.sources],
  )

  // The sheet's own order is the sound chart; sorting reorders it by whichever
  // column was clicked. Everything downstream reads this, so the CSV and the
  // printout come out in the order on screen.
  const phonemes = useMemo(
    () => sortRows(reports.phonemes, sort, (ph, col) => getTally(reports, ph, col), (ph) => display(ph, notation)),
    [reports, sort, notation],
  )

  // Whole class first: the summary is what decides what to reteach, so it should
  // not need scrolling past a full roster to reach.
  const columns = [
    { id: CLASS, name: 'Whole class' },
    ...project.students.map((s) => ({ id: s.id, name: names(s.id) })),
  ]

  const exportCsv = () => {
    const rows: string[][] = [['Sound', 'Key word', ...columns.map((c) => c.name)]]
    for (const p of phonemes) {
      const cells = columns.map(({ id: who }) => {
        const t = getTally(reports, p, who)
        const pct = percentOf(t.correct, t.total)
        return pct ? `${t.correct}/${t.total} (${pct})` : `${t.correct}/${t.total}`
      })
      rows.push([display(p, notation), get(p).example, ...cells])
    }
    requestDownload({
      name: fileName('Accuracy by phoneme', [scope.scopeSlug], scope.scopeDate),
      extension: 'csv',
      mime: 'text/csv',
      build: () => toCsv(rows),
      folder: 'Accuracy by phoneme',
    })
  }

  if (scope.loading || reports.phonemes.length === 0) {
    return (
      <section className="panel">
        <h2>Accuracy by phoneme</h2>

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
      <PrintTitle>
        {scope.scopeLabel} · Accuracy by phoneme
      </PrintTitle>
      <h2>Accuracy by phoneme</h2>

      <TestPicker tests={scope.tests} selected={scope.selected} onChange={scope.setSelected} />
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
        <button className="btn" onClick={() => requestPrint(fileName('Accuracy by phoneme', [scope.scopeSlug], scope.scopeDate))}>
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
                <SortHeader
                  key={c.id}
                  columnId={c.id}
                  label={c.name}
                  sort={sort}
                  onSort={(id) => setSort((prev) => nextSort(prev, id))}
                  naturalOrder="the sound chart order"
                  className={`num ${c.id === CLASS ? 'classcol' : ''}`}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {phonemes.map((p) => (
              <tr key={p}>
                <th className="rowhead phoneme c1">{display(p, notation)}</th>
                <td className="c2" style={{ color: 'var(--muted)' }}>{get(p).example}</td>
                {columns.map((c) => {
                  const t = getTally(reports, p, c.id)
                  const frac = t.total === 0 ? null : t.correct / t.total
                  return (
                    <td
                      key={c.id}
                      className={`num drillable ${c.id === CLASS ? 'classcol' : ''} ${
                        sort?.columnId === c.id ? 'sortedcol' : ''
                      }`}
                      onClick={() =>
                        setDrill({
                          kind: 'phoneme',
                          key: p,
                          label: display(p, notation),
                          sounds: [p],
                          studentId: c.id,
                          sources: scope.sources,
                          scopeLabel: scope.scopeLabel,
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
