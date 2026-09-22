import { useMemo, useState } from 'react'
import { PrintTitle } from '../components/PrintTitle'
import { useStore } from '../state/store'
import { useStudentNames } from '../state/names'
import { useSelectedTests } from '../state/useSelectedTests'
import { TestPicker } from '../components/TestPicker'
import { buildReportsAcross, CLASS, getGraphemeConfusion, NONE } from '../reports/aggregate'
import { displayList } from '../data/phonemes'
import { category } from '../data/categories'
import { CategoryDot } from '../components/CategoryTag'
import { toCsv } from '../export/csv'
import { useDownloads } from '../components/DownloadProvider'
import { useFileName } from '../state/filename'
import { OccurrenceModal } from '../components/OccurrenceModal'
import type { Drill } from '../reports/occurrences'

/**
 * Which spelling was written where another was needed — "k" for "ck", "a" for
 * "ai". This is where orthographic error patterns show up most directly, since
 * the sound can be right while the spelling is consistently wrong.
 */
export function ReportGraphemeConfusion() {
  const { project } = useStore()
  const scope = useSelectedTests('active')
  const names = useStudentNames()
  const { requestDownload, requestPrint } = useDownloads()
  const fileName = useFileName()
  const { notation } = project.settings
  const reports = useMemo(
    () => buildReportsAcross(project, scope.sources),
    [project, scope.sources],
  )
  const [who, setWho] = useState<string>(CLASS)
  const [hideEmpty, setHideEmpty] = useState(true)
  const [drill, setDrill] = useState<Drill | null>(null)

  const rowTotal = (key: string) =>
    reports.writtenSpellings.reduce((sum, s) => sum + getGraphemeConfusion(reports, who, key, s), 0)
  const colTotal = (written: string) =>
    reports.graphemes.reduce((sum, g) => sum + getGraphemeConfusion(reports, who, g.key, written), 0)

  const rows = hideEmpty ? reports.graphemes.filter((g) => rowTotal(g.key) > 0) : reports.graphemes
  const cols = hideEmpty ? reports.writtenSpellings.filter((s) => colTotal(s) > 0) : reports.writtenSpellings

  // One label for this view, used in the heading, the file name and the printout.
  const whoName = who === CLASS ? 'Whole class' : names(who)

  const exportCsv = () => {
    const out: string[][] = [['Needed \\ Wrote', 'Sound(s)', ...cols]]
    for (const g of rows) {
      out.push([
        g.patternLabel ?? g.letters,
        displayList(g.phonemes, notation),
        ...cols.map((c) => String(getGraphemeConfusion(reports, who, g.key, c))),
      ])
    }
    requestDownload({
      name: fileName('Grapheme confusion', [whoName, scope.scopeSlug], scope.scopeDate),
      extension: 'csv',
      mime: 'text/csv',
      build: () => toCsv(out),
      folder: 'Grapheme confusion',
    })
  }

  if (scope.loading || rows.length === 0 || cols.length === 0) {
    return (
      <section className="panel">
        <h2>Grapheme confusion</h2>

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
        {scope.scopeLabel} · Grapheme confusion · {whoName}
      </PrintTitle>
      <h2>Grapheme confusion</h2>

      <TestPicker tests={scope.tests} selected={scope.selected} onChange={scope.setSelected} />
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
        <button
          className="btn"
          onClick={() => requestPrint(fileName('Grapheme confusion', [whoName, scope.scopeSlug], scope.scopeDate))}
        >
          Print / Save PDF
        </button>
      </div>

      <div className="scroll">
        <table className="grid-sticky report-grid">
          <thead>
            <tr>
              <th className="c1">Needed ↓ / Wrote →</th>
              <th className="c2">Sound(s)</th>
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
                <th className="rowhead phoneme c1" title={category(g.category).label}>
                  <CategoryDot id={g.category} />
                  {g.patternLabel ?? g.letters}
                </th>
                <td className="phoneme c2" style={{ color: 'var(--muted)' }}>
                  {displayList(g.phonemes, notation)}
                </td>
                {cols.map((c) => {
                  const n = getGraphemeConfusion(reports, who, g.key, c)
                  const diagonal = c === g.letters
                  return (
                    <td
                      key={c}
                      className={`num ${n > 0 ? 'drillable' : ''}`}
                      onClick={() =>
                        n > 0 &&
                        setDrill({
                          kind: 'grapheme',
                          key: g.key,
                          label: `${g.patternLabel ?? g.letters} → ${c === NONE ? 'nothing' : c}`,
                          sounds: g.phonemes,
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

      {drill && <OccurrenceModal drill={drill} onClose={() => setDrill(null)} />}
    </section>
  )
}
