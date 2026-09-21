import { useMemo, useState } from 'react'
import { PrintTitle } from '../components/PrintTitle'
import { useStore } from '../state/store'
import { useStudentNames } from '../state/names'
import { useSelectedTests } from '../state/useSelectedTests'
import { TestPicker } from '../components/TestPicker'
import { buildReportsAcross, CLASS, getGraphemeTally, type GraphemeRow } from '../reports/aggregate'
import { displayList } from '../data/phonemes'
import { category, type CategoryId } from '../data/categories'
import { scaleColor, scaleInk } from '../components/Legend'
import { CategoryDot } from '../components/CategoryTag'
import { Fraction, percentOf } from '../components/Fraction'
import { toCsv } from '../export/csv'
import { useDownloads } from '../components/DownloadProvider'
import { useFileName } from '../state/filename'
import { OccurrenceModal } from '../components/OccurrenceModal'
import type { Drill } from '../reports/occurrences'

/**
 * Accuracy for the thing the teacher actually marks: the spelling unit. Rows are
 * grouped under the phonics categories so the sheet reads like a scope and
 * sequence, with the sounds each spelling makes shown alongside.
 */
export function ReportGraphemeAccuracy() {
  const { project, dispatch } = useStore()
  const scope = useSelectedTests('active')
  const { requestDownload, requestPrint } = useDownloads()
  const fileName = useFileName()
  const names = useStudentNames()
  const [drill, setDrill] = useState<Drill | null>(null)
  const { notation } = project.settings
  const reports = useMemo(
    () => buildReportsAcross(project, scope.sources),
    [project, scope.sources],
  )

  const groups = useMemo(() => {
    const map = new Map<CategoryId, GraphemeRow[]>()
    for (const g of reports.graphemes) {
      const list = map.get(g.category) ?? []
      list.push(g)
      map.set(g.category, list)
    }
    return [...map.entries()]
  }, [reports.graphemes])

  // Whole class first: the summary is what a teacher reads to decide what to
  // reteach, and putting it left of the students means it needs no scrolling.
  const columns = [
    { id: CLASS, name: 'Whole class' },
    ...project.students.map((s) => ({ id: s.id, name: names(s.id) })),
  ]

  const exportCsv = () => {
    const rows: string[][] = [['Category', 'Spelling', 'Sound(s)', ...columns.map((c) => c.name)]]
    for (const [cat, members] of groups) {
      for (const g of members) {
        rows.push([
          category(cat).label,
          g.patternLabel ?? g.letters,
          displayList(g.phonemes, notation),
          ...columns.map((c) => {
            const t = getGraphemeTally(reports, g.key, c.id)
            const pct = percentOf(t.correct, t.total)
            return pct ? `${t.correct}/${t.total} (${pct})` : `${t.correct}/${t.total}`
          }),
        ])
      }
    }
    requestDownload({
      name: fileName('Accuracy by grapheme', [scope.scopeSlug], scope.scopeDate),
      extension: 'csv',
      mime: 'text/csv',
      build: () => toCsv(rows),
    })
  }

  if (scope.loading || reports.graphemes.length === 0) {
    return (
      <section className="panel">
        <h2>Accuracy by grapheme</h2>

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
        {scope.scopeLabel} · Accuracy by grapheme
      </PrintTitle>
      <h2>Accuracy by grapheme</h2>

      <TestPicker tests={scope.tests} selected={scope.selected} onChange={scope.setSelected} />
      <p className="hint">
        How often each student spelled each unit correctly, out of the times it came up in a word
        they attempted. Rows are grouped by kind, so a whole category can be read at a glance. A unit
        that never came up shows 0/0 in grey rather than counting against anyone.
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
          Count “right sound, different spelling” as correct
        </label>
        <span className="spacer" />
        <button className="btn" onClick={exportCsv}>
          Download CSV
        </button>
        <button className="btn" onClick={() => requestPrint(fileName('Accuracy by grapheme', [scope.scopeSlug], scope.scopeDate))}>
          Print / Save PDF
        </button>
      </div>

      <div className="scroll">
        <table className="grid-sticky report-grid">
          <thead>
            <tr>
              <th className="c1">Spelling</th>
              <th className="c2">Sound(s)</th>
              {columns.map((c) => (
                <th key={c.id} className={`num ${c.id === CLASS ? 'classcol' : ''}`}>
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(([cat, members]) => (
              <>
                <tr key={`h-${cat}`} className="grouphead">
                  <th className="c1 grouplabel" colSpan={2 + columns.length}>
                    <CategoryDot id={cat} />
                    {category(cat).label}
                    <span className="keyword">{members.length} in this test</span>
                  </th>
                </tr>
                {members.map((g) => (
                  <tr key={g.key}>
                    <th className="rowhead phoneme c1">
                      {g.patternLabel ?? g.letters}
                      {/* Only worth repeating the letters when the label differs from them. */}
                      {g.patternLabel && g.patternLabel.replace(/^-/, '') !== g.letters && (
                        <span className="keyword">{g.letters}</span>
                      )}
                    </th>
                    <td className="phoneme c2" style={{ color: 'var(--muted)' }}>
                      {displayList(g.phonemes, notation)}
                    </td>
                    {columns.map((c) => {
                      const t = getGraphemeTally(reports, g.key, c.id)
                      const frac = t.total === 0 ? null : t.correct / t.total
                      return (
                        <td
                          key={c.id}
                          className={`num drillable ${c.id === CLASS ? 'classcol' : ''}`}
                          onClick={() =>
                            setDrill({
                              kind: 'grapheme',
                              key: g.key,
                              label: g.patternLabel ?? g.letters,
                              sounds: g.phonemes,
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
                              ? 'Did not come up'
                              : `${Math.round(frac * 100)}% correct — click to see every example`
                          }
                        >
                          <Fraction correct={t.correct} total={t.total} />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {drill && <OccurrenceModal drill={drill} onClose={() => setDrill(null)} />}
    </section>
  )
}
