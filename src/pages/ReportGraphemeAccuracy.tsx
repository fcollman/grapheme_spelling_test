import { useMemo } from 'react'
import { useStore } from '../state/store'
import type { AnalysisResult } from '../state/useAnalysis'
import { buildReports, CLASS, getGraphemeTally, type GraphemeRow } from '../reports/aggregate'
import { displayList } from '../data/phonemes'
import { category, type CategoryId } from '../data/categories'
import { scaleColor, scaleInk } from '../components/Legend'
import { CategoryDot } from '../components/CategoryTag'
import { download, exportName } from '../state/persist'
import { toCsv } from '../export/csv'

/**
 * Accuracy for the thing the teacher actually marks: the spelling unit. Rows are
 * grouped under the phonics categories so the sheet reads like a scope and
 * sequence, with the sounds each spelling makes shown alongside.
 */
export function ReportGraphemeAccuracy({ analysis }: { analysis: AnalysisResult }) {
  const { project, test, dispatch } = useStore()
  const { notation } = project.settings
  const reports = useMemo(() => buildReports(project, test, analysis), [project, test, analysis])

  const groups = useMemo(() => {
    const map = new Map<CategoryId, GraphemeRow[]>()
    for (const g of reports.graphemes) {
      const list = map.get(g.category) ?? []
      list.push(g)
      map.set(g.category, list)
    }
    return [...map.entries()]
  }, [reports.graphemes])

  const columns = [...project.students.map((s) => ({ id: s.id, name: s.name })), { id: CLASS, name: 'Whole class' }]

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
            return `${t.correct}/${t.total}`
          }),
        ])
      }
    }
    download(exportName(test.name, 'accuracy-by-grapheme'), toCsv(rows), 'text/csv')
  }

  if (reports.graphemes.length === 0) {
    return (
      <section className="panel">
        <h2>Accuracy by grapheme</h2>
        <div className="empty">Nothing to report yet — enter some student spellings first.</div>
      </section>
    )
  }

  return (
    <section className="panel">
      <span className="print-title">
        {test.name} · {test.date} · Accuracy by grapheme
      </span>
      <h2>Accuracy by grapheme</h2>
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
        <button className="btn" onClick={() => window.print()}>
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
                <th key={c.id} className="num">
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
                          className="num"
                          style={{
                            background: frac === null ? 'var(--none-bg)' : scaleColor(frac),
                            color: frac === null ? 'var(--none-ink)' : scaleInk(frac),
                            fontWeight: c.id === CLASS ? 700 : 500,
                          }}
                          title={frac === null ? 'Did not come up' : `${Math.round(frac * 100)}% correct`}
                        >
                          {t.correct}/{t.total}
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
    </section>
  )
}
