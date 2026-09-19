import { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import type { AnalysisResult } from '../state/useAnalysis'
import { buildReports, CLASS, getGraphemeConfusion, NONE } from '../reports/aggregate'
import { displayList } from '../data/phonemes'
import { category } from '../data/categories'
import { CategoryDot } from '../components/CategoryTag'
import { download, exportName } from '../state/persist'
import { toCsv } from '../export/csv'

/**
 * Which spelling was written where another was needed — "k" for "ck", "a" for
 * "ai". This is where orthographic error patterns show up most directly, since
 * the sound can be right while the spelling is consistently wrong.
 */
export function ReportGraphemeConfusion({ analysis }: { analysis: AnalysisResult }) {
  const { project, test } = useStore()
  const { notation } = project.settings
  const reports = useMemo(() => buildReports(project, test, analysis), [project, test, analysis])
  const [who, setWho] = useState<string>(CLASS)
  const [hideEmpty, setHideEmpty] = useState(true)

  const rowTotal = (key: string) =>
    reports.writtenSpellings.reduce((sum, s) => sum + getGraphemeConfusion(reports, who, key, s), 0)
  const colTotal = (written: string) =>
    reports.graphemes.reduce((sum, g) => sum + getGraphemeConfusion(reports, who, g.key, written), 0)

  const rows = hideEmpty ? reports.graphemes.filter((g) => rowTotal(g.key) > 0) : reports.graphemes
  const cols = hideEmpty ? reports.writtenSpellings.filter((s) => colTotal(s) > 0) : reports.writtenSpellings

  const exportCsv = () => {
    const name = who === CLASS ? 'whole-class' : project.students.find((s) => s.id === who)?.name ?? 'student'
    const out: string[][] = [['Needed \\ Wrote', 'Sound(s)', ...cols]]
    for (const g of rows) {
      out.push([
        g.patternLabel ?? g.letters,
        displayList(g.phonemes, notation),
        ...cols.map((c) => String(getGraphemeConfusion(reports, who, g.key, c))),
      ])
    }
    download(exportName(test.name, `grapheme-confusion-${name}`), toCsv(out), 'text/csv')
  }

  if (rows.length === 0 || cols.length === 0) {
    return (
      <section className="panel">
        <h2>Grapheme confusion</h2>
        <div className="empty">Nothing to report yet — enter some student spellings first.</div>
      </section>
    )
  }

  const whoName = who === CLASS ? 'Whole class' : project.students.find((s) => s.id === who)?.name ?? ''

  return (
    <section className="panel">
      <span className="print-title">
        {test.name} · {test.date} · Grapheme confusion · {whoName}
      </span>
      <h2>Grapheme confusion</h2>
      <p className="hint">
        Rows are the spelling the word needed; columns are what the student actually wrote. The
        shaded diagonal is correct. Everything off it is a specific substitution to teach against —{' '}
        {NONE} means nothing was written for that unit at all.
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
              <th>Sound(s)</th>
              {cols.map((c) => (
                <th key={c} className="num phoneme" title={c === NONE ? 'Nothing written' : `Wrote "${c}"`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.key}>
                <th className="rowhead phoneme" title={category(g.category).label}>
                  <CategoryDot id={g.category} />
                  {g.patternLabel ?? g.letters}
                </th>
                <td className="phoneme" style={{ color: 'var(--muted)' }}>
                  {displayList(g.phonemes, notation)}
                </td>
                {cols.map((c) => {
                  const n = getGraphemeConfusion(reports, who, g.key, c)
                  const diagonal = c === g.letters
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
                          ? `"${g.letters}" spelled correctly ${n} time${n === 1 ? '' : 's'}`
                          : `Wrote "${c}" where "${g.letters}" was needed, ${n} time${n === 1 ? '' : 's'}`
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
