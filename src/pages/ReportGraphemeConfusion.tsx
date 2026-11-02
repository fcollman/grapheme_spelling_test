import { useMemo, useState } from 'react'
import { PrintTitle } from '../components/PrintTitle'
import { useStore } from '../state/store'
import { useStudentNames } from '../state/names'
import { useSelectedTests } from '../state/useSelectedTests'
import { TestPicker } from '../components/TestPicker'
import { ModeToggle, noTestsInMode } from '../components/ModeToggle'
import {
  buildReportsAcross,
  CLASS,
  diagonalKey,
  getGraphemeConfusion,
  NONE,
  soundsOf,
  type GraphemeRow,
} from '../reports/aggregate'
import { confusionColumns, trimToConfusions } from '../reports/confusionAxes'
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
 *
 * Read backwards for a reading test: the rows are still the spellings, but the
 * columns become the sounds that came out of them, so the sheet asks "what does
 * this child do with `oa`?" — the mirror of the question it asks about
 * spelling. The axis is chosen by the data, not by this page; see `producedKey`.
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
  /** Ticked, the sheet shows only the substitutions; unticked, the whole grid. */
  const [onlyConfusions, setOnlyConfusions] = useState(true)
  const [drill, setDrill] = useState<Drill | null>(null)

  /*
   * Every target spelling gets a column, in the row order, so each row meets
   * its own column and the correct answers run down the diagonal. Columns used
   * to be only what students actually wrote, which left a target nobody spelled
   * correctly with nowhere to be correct, and meant no column could ever be
   * empty for the toggle below to hide.
   */
  const said = reports.producedIsSound
  const allCols = useMemo(
    () =>
      confusionColumns(
        reports.graphemes.map((g) => diagonalKey(g, said)),
        reports.producedUnits,
        NONE,
      ),
    [reports, said],
  )

  /** A column key is a sound key when the axis is sounds, so it needs spelling out. */
  const colLabel = (c: string) => (said && c !== NONE ? displayList(soundsOf(c), notation) : c)

  const { rows, cols } = useMemo(() => {
    const count = (g: GraphemeRow, c: string) => getGraphemeConfusion(reports, who, g.key, c)
    const isDiagonal = (g: GraphemeRow, c: string) => c === diagonalKey(g, said)
    return onlyConfusions
      ? trimToConfusions(reports.graphemes, allCols, count, isDiagonal)
      : { rows: reports.graphemes, cols: allCols }
  }, [reports, allCols, onlyConfusions, who, said])

  // One label for this view, used in the heading, the file name and the printout.
  const whoName = who === CLASS ? 'Whole class' : names(who)

  const exportCsv = () => {
    const out: string[][] = [
      [said ? 'Letters \\ Said' : 'Needed \\ Wrote', 'Sound(s)', ...cols.map(colLabel)],
    ]
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

      <ModeToggle />
      <TestPicker tests={scope.tests} selected={scope.selected} onChange={scope.setSelected} />
        <div className="empty">
          {scope.loading
            ? 'Analysing every test…'
            : scope.sources.length === 0
              ? scope.tests.length === 0
                ? noTestsInMode(scope.mode)
                : 'Choose at least one test above.'
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

      <ModeToggle />
      <TestPicker tests={scope.tests} selected={scope.selected} onChange={scope.setSelected} />
      <p className="hint">
        {said ? (
          <>
            Rows are the spelling on the page; columns are the sound the student made of it. The
            shaded diagonal is a correct reading. Everything off it is a specific substitution to
            teach against — {NONE} means they said nothing for that unit at all. The columns are
            sounds rather than your respelling on purpose: “shun” and “shn” are one
            mispronunciation typed two ways, and counting them apart would split one error in two.
            Untick the box below to see every reading, right or wrong.
          </>
        ) : (
          <>
            Rows are the spelling the word needed; columns are what the student actually wrote. The
            shaded diagonal is correct. Everything off it is a specific substitution to teach
            against — {NONE} means nothing was written for that unit at all. Untick the box below
            to see every spelling, right or wrong, with the correct answers running down the
            diagonal.
          </>
        )}
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
          <input
            type="checkbox"
            checked={onlyConfusions}
            onChange={(e) => setOnlyConfusions(e.target.checked)}
          />
          <span
            title={
              said
                ? 'Unticked, every spelling gets a row and every sound a column, so the correct readings run down the diagonal'
                : 'Unticked, every spelling gets a row and a column of its own, so the correct answers run down the diagonal'
            }
          >
            Hide rows and columns with no confusions
          </span>
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
              <th className="c1">{said ? 'Letters ↓ / Said →' : 'Needed ↓ / Wrote →'}</th>
              <th className="c2">Sound(s)</th>
              {cols.map((c) => (
                <th
                  key={c}
                  className="num phoneme"
                  title={
                    c === NONE
                      ? said
                        ? 'Said nothing'
                        : 'Nothing written'
                      : said
                        ? `Said ${colLabel(c)}`
                        : `Wrote "${c}"`
                  }
                >
                  {colLabel(c)}
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
                  const diagonal = c === diagonalKey(g, said)
                  return (
                    <td
                      key={c}
                      className={`num ${n > 0 ? 'drillable' : ''}`}
                      onClick={() =>
                        n > 0 &&
                        setDrill({
                          kind: 'grapheme',
                          key: g.key,
                          label: `${g.patternLabel ?? g.letters} → ${c === NONE ? 'nothing' : colLabel(c)}`,
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
                          ? said
                            ? `"${g.letters}" read correctly ${n} time${n === 1 ? '' : 's'}`
                            : `"${g.letters}" spelled correctly ${n} time${n === 1 ? '' : 's'}`
                          : said
                            ? `Said ${colLabel(c)} for "${g.letters}", ${n} time${n === 1 ? '' : 's'}`
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
