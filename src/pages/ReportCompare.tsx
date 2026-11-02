import { useMemo, useState, type ReactNode } from 'react'
import { PrintTitle } from '../components/PrintTitle'
import { useStore } from '../state/store'
import { useStudentNames } from '../state/names'
import { useComparedTests } from '../state/useSelectedTests'
import { TestPicker } from '../components/TestPicker'
import { buildReportsAcross, CLASS, type Tally } from '../reports/aggregate'
import {
  compareGraphemes,
  comparePhonemes,
  MIN_EVIDENCE,
  type CompareRow,
  type Missing,
} from '../reports/compare'
import { display, displayList, get } from '../data/phonemes'
import { category } from '../data/categories'
import { CategoryDot } from '../components/CategoryTag'
import { Fraction, percentOf } from '../components/Fraction'
import { divergeColor, divergeInk, scaleColor, scaleInk } from '../components/Legend'
import { SortHeader } from '../components/SortHeader'
import { nextSort, sortRowsByValue, type SortState } from '../reports/sorting'
import { toCsv } from '../export/csv'
import { useDownloads } from '../components/DownloadProvider'
import { useFileName } from '../state/filename'
import type { ReportFolder } from '../export/folders'

/**
 * The two sheets that read spelling and reading together.
 *
 * Every other report answers one direction at a time, and for good reason —
 * pooling encoding with decoding averages two different questions. These two
 * are the exception, and they keep the directions apart to earn it: each side
 * keeps its own score, and the sheet reports what the pair of them says rather
 * than merging them into one count.
 *
 * Both sheets are the same table. Only the last column differs, so they share
 * everything below and differ in what they put under the spotlight.
 */

/** Which way round a row is detailed: the thing marked, or the sound behind it. */
type Level = 'grapheme' | 'phoneme'

const fractionOf = (t: Tally) => (t.total === 0 ? null : t.correct / t.total)

/** What a row with no comparable pair should say in place of a number. */
function missingWord(missing: Missing): string {
  if (missing === 'decoding') return 'spelling only'
  if (missing === 'encoding') return 'reading only'
  if (missing === 'thin') return 'too few'
  return '—'
}

function missingWhy(missing: Missing, minimum: number): string {
  if (missing === 'decoding') return 'Only the spelling tests cover this, so there is nothing to compare it with'
  if (missing === 'encoding') return 'Only the reading passages cover this, so there is nothing to compare it with'
  if (missing === 'thin')
    return `Fewer than ${minimum} chances on one side — too little to call a difference`
  return 'Neither the spelling tests nor the reading passages covered this'
}

/** "+34%", "−21%", "0%" — signed, because neither end is the bad one. */
function gapText(d: number): string {
  const points = Math.abs(Math.round(d * 100))
  return `${d > 0 ? '+' : d < 0 ? '−' : ''}${points}%`
}

function gapWhy(d: number): string {
  const points = Math.abs(Math.round(d * 100))
  if (d === 0) return 'Equally strong in both directions'
  return d > 0
    ? `Spells it ${points} points better than they read it`
    : `Reads it ${points} points better than they spell it`
}

export function ReportCombinedAccuracy() {
  return (
    <CompareSheet
      title="Combined accuracy"
      folder="Combined accuracy"
      showing="combined"
      hint={
        <>
          How well each one is known <em>at all</em>, counting spelling and reading once each. A
          grapheme met thirty times in a passage and twice on a spelling list would otherwise be
          scored almost entirely by the passage, so this is the mean of the two percentages rather
          than one pooled count. A row only one side reached keeps the side it has and says so.
        </>
      }
    />
  )
}

export function ReportDivergence() {
  return (
    <CompareSheet
      title="Spelling vs reading"
      folder="Spelling vs reading"
      showing="gap"
      hint={
        <>
          Which way round each one is known. The same grapheme–phoneme knowledge can be solid in one
          direction and absent in the other, and which it is decides what to teach: a child who
          spells <code>oa</code> but cannot read it needs the opposite lesson from one who reads it
          but cannot spell it.
        </>
      }
    />
  )
}

function CompareSheet({
  title,
  folder,
  showing,
  hint,
}: {
  title: string
  folder: ReportFolder
  /** Which column the sheet is for: the mean, or the difference. */
  showing: 'combined' | 'gap'
  hint: ReactNode
}) {
  const { project } = useStore()
  const names = useStudentNames()
  const { requestDownload, requestPrint } = useDownloads()
  const fileName = useFileName()
  const { notation } = project.settings

  /*
   * Everything, by default. These sheets answer a question about a child rather
   * than about a lesson, and the more evidence each side has the less the
   * threshold below has to throw away.
   */
  const scope = useComparedTests('all')
  const [who, setWho] = useState<string>(CLASS)
  const [level, setLevel] = useState<Level>('grapheme')
  const [minimum, setMinimum] = useState(MIN_EVIDENCE)
  const [sort, setSort] = useState<SortState | null>(null)

  const encoding = useMemo(
    () => buildReportsAcross(project, scope.encoding.sources),
    [project, scope.encoding.sources],
  )
  const decoding = useMemo(
    () => buildReportsAcross(project, scope.decoding.sources),
    [project, scope.decoding.sources],
  )

  const rows = useMemo(
    () =>
      level === 'grapheme'
        ? compareGraphemes(encoding, decoding, who, minimum)
        : comparePhonemes(encoding, decoding, who, minimum),
    [encoding, decoding, who, minimum, level],
  )

  const labelOf = (r: CompareRow) =>
    r.unit.kind === 'grapheme' ? r.unit.row.patternLabel ?? r.unit.row.letters : display(r.unit.id, notation)

  const valueOf = (r: CompareRow, columnId: string) => {
    if (columnId === 'encoding') return fractionOf(r.encoding)
    if (columnId === 'decoding') return fractionOf(r.decoding)
    if (columnId === 'gap') return r.divergence
    return r.combined
  }

  const rowsInOrder = useMemo(
    () => sortRowsByValue(rows, sort, valueOf, labelOf),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, sort, notation],
  )

  const whoName = who === CLASS ? 'Whole class' : names(who)
  const scopeLabel = `${scope.encoding.scopeLabel} against ${scope.decoding.scopeLabel}`
  const nameParts = [whoName, scope.encoding.scopeSlug, scope.decoding.scopeSlug]

  /*
   * Both columns, on both sheets. The two tabs differ in what they put under
   * the spotlight, but a file a teacher keeps should answer the question she
   * asks of it next week as well as the one she opened it with.
   */
  const exportCsv = () => {
    const lead = level === 'grapheme' ? ['Category', 'Spelling', 'Sound(s)'] : ['Sound', 'As in']
    const out: string[][] = [
      [...lead, 'Spelling tests', 'Reading passages', 'Combined', 'Spelling − reading'],
    ]
    for (const r of rowsInOrder) {
      const head =
        r.unit.kind === 'grapheme'
          ? [
              category(r.unit.row.category).label,
              r.unit.row.patternLabel ?? r.unit.row.letters,
              displayList(r.unit.row.phonemes, notation),
            ]
          : [display(r.unit.id, notation), get(r.unit.id).example]
      const tally = (t: Tally) => (t.total === 0 ? 'not covered' : `${t.correct}/${t.total} (${percentOf(t.correct, t.total)})`)
      out.push([
        ...head,
        tally(r.encoding),
        tally(r.decoding),
        r.combined === null ? 'not covered' : `${Math.round(r.combined * 100)}%`,
        r.divergence === null ? missingWord(r.missing!) : gapText(r.divergence),
      ])
    }
    requestDownload({
      name: fileName(title, nameParts, scope.decoding.scopeDate),
      extension: 'csv',
      mime: 'text/csv',
      build: () => toCsv(out),
      folder,
    })
  }

  const pickers = (
    <>
      <TestPicker
        label="Spelling tests"
        tests={scope.encoding.tests}
        selected={scope.encoding.selected}
        onChange={scope.encoding.setSelected}
      />
      <TestPicker
        label="Reading passages"
        tests={scope.decoding.tests}
        selected={scope.decoding.selected}
        onChange={scope.decoding.setSelected}
      />
    </>
  )

  /*
   * Both sides or nothing. A comparison with one side empty is not a thinner
   * version of this report, it is a different report — and the app already has
   * that one on every other tab.
   */
  const missingSide =
    scope.encoding.tests.length === 0
      ? 'No spelling tests have been entered yet, so there is nothing to compare the reading against. Enter one on the Spelling test tab.'
      : scope.decoding.tests.length === 0
        ? 'No reading passages have been marked yet, so there is nothing to compare the spelling against. Mark one on the Reading passage tab.'
        : scope.encoding.sources.length === 0 || scope.decoding.sources.length === 0
          ? 'Choose at least one spelling test and at least one reading passage above.'
          : null

  if (scope.encoding.loading || missingSide || rowsInOrder.length === 0) {
    return (
      <section className="panel">
        <h2>{title}</h2>
        {pickers}
        <div className="empty">
          {scope.encoding.loading
            ? 'Analysing every test…'
            : missingSide ?? 'Nothing to report yet — enter some student answers first.'}
        </div>
      </section>
    )
  }

  return (
    <section className="panel">
      <PrintTitle>
        {scopeLabel} · {title} · {whoName}
      </PrintTitle>
      <h2>{title}</h2>
      <p className="hint">{hint}</p>
      {pickers}

      {showing === 'gap' && (
        <div className="legend">
          <span>
            <span className="swatch" style={{ background: divergeColor(0.8), border: '1px solid var(--line-strong)' }} />
            Spells it, cannot read it
          </span>
          <span>
            <span className="swatch" style={{ background: divergeColor(-0.8), border: '1px solid var(--line-strong)' }} />
            Reads it, cannot spell it
          </span>
          <span>
            <span className="swatch" style={{ background: divergeColor(0), border: '1px solid var(--line-strong)' }} />
            Equally strong both ways
          </span>
        </div>
      )}

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
          Detail
          <select value={level} onChange={(e) => setLevel(e.target.value as Level)}>
            <option value="grapheme">By spelling</option>
            <option value="phoneme">By sound</option>
          </select>
        </label>
        {showing === 'gap' && (
          <label className="check">
            <span title="One chance each way reads as ±100% whichever way it fell, which is not a finding. Rows below this still show their counts; they just do not claim a difference.">
              Needs at least
            </span>
            <select value={minimum} onChange={(e) => setMinimum(Number(e.target.value))}>
              {[1, 2, 3, 5, 10].map((n) => (
                <option key={n} value={n}>
                  {n} each way
                </option>
              ))}
            </select>
          </label>
        )}
        <span className="spacer" />
        <button className="btn" onClick={exportCsv}>
          Download CSV
        </button>
        <button className="btn" onClick={() => requestPrint(fileName(title, nameParts, scope.decoding.scopeDate))}>
          Print / Save PDF
        </button>
      </div>

      <div className="scroll">
        <table className="grid-sticky report-grid">
          <thead>
            <tr>
              <th className="c1">{level === 'grapheme' ? 'Spelling' : 'Sound'}</th>
              <th className="c2">{level === 'grapheme' ? 'Sound(s)' : 'As in'}</th>
              <SortHeader
                columnId="encoding"
                label="Spelling tests"
                sort={sort}
                onSort={(id) => setSort(nextSort(sort, id))}
                naturalOrder={level === 'grapheme' ? 'the scope and sequence order' : 'the sound chart order'}
                className="num"
              />
              <SortHeader
                columnId="decoding"
                label="Reading passages"
                sort={sort}
                onSort={(id) => setSort(nextSort(sort, id))}
                naturalOrder={level === 'grapheme' ? 'the scope and sequence order' : 'the sound chart order'}
                className="num"
              />
              {showing === 'combined' ? (
                <SortHeader
                  columnId="combined"
                  label="Combined"
                  sort={sort}
                  onSort={(id) => setSort(nextSort(sort, id))}
                  naturalOrder={level === 'grapheme' ? 'the scope and sequence order' : 'the sound chart order'}
                  className="num"
                />
              ) : (
                <SortHeader
                  columnId="gap"
                  label="Spelling − reading"
                  sort={sort}
                  onSort={(id) => setSort(nextSort(sort, id))}
                  naturalOrder={level === 'grapheme' ? 'the scope and sequence order' : 'the sound chart order'}
                  ascending="reading ahead first"
                  descending="spelling ahead first"
                  className="num"
                />
              )}
            </tr>
          </thead>
          <tbody>
            {rowsInOrder.map((r) => (
              <tr key={r.key}>
                {r.unit.kind === 'grapheme' ? (
                  <>
                    <th className="rowhead phoneme c1" title={category(r.unit.row.category).label}>
                      <CategoryDot id={r.unit.row.category} />
                      {r.unit.row.patternLabel ?? r.unit.row.letters}
                    </th>
                    <td className="phoneme c2" style={{ color: 'var(--muted)' }}>
                      {displayList(r.unit.row.phonemes, notation)}
                    </td>
                  </>
                ) : (
                  <>
                    <th className="rowhead phoneme c1">{display(r.unit.id, notation)}</th>
                    <td className="c2" style={{ color: 'var(--muted)' }}>
                      {get(r.unit.id).example}
                    </td>
                  </>
                )}

                <TallyCell tally={r.encoding} what="spelled" />
                <TallyCell tally={r.decoding} what="read" />

                {showing === 'combined' ? (
                  <td
                    className="num"
                    style={{
                      background: r.combined === null ? undefined : scaleColor(r.combined),
                      color: r.combined === null ? 'var(--muted)' : scaleInk(r.combined),
                      fontWeight: 650,
                    }}
                    title={
                      r.combined === null
                        ? missingWhy(r.missing!, minimum)
                        : r.missing === 'decoding' || r.missing === 'encoding'
                          ? missingWhy(r.missing, minimum)
                          : 'The two percentages averaged, one weight each'
                    }
                  >
                    <span>{r.combined === null ? '—' : `${Math.round(r.combined * 100)}%`}</span>
                    {(r.missing === 'decoding' || r.missing === 'encoding') && (
                      <span className="onesided">{missingWord(r.missing)}</span>
                    )}
                  </td>
                ) : (
                  <td
                    className="num"
                    style={{
                      background: r.divergence === null ? undefined : divergeColor(r.divergence),
                      color: r.divergence === null ? 'var(--muted)' : divergeInk(r.divergence),
                      fontWeight: 650,
                    }}
                    title={r.divergence === null ? missingWhy(r.missing!, minimum) : gapWhy(r.divergence)}
                  >
                    {r.divergence === null ? (
                      <span className="onesided">{missingWord(r.missing!)}</span>
                    ) : (
                      gapText(r.divergence)
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** One side's score, coloured the way every other accuracy sheet colours one. */
function TallyCell({ tally, what }: { tally: Tally; what: string }) {
  const fraction = fractionOf(tally)
  return (
    <td
      className="num"
      style={{
        background: fraction === null ? undefined : scaleColor(fraction),
        color: fraction === null ? 'var(--muted)' : scaleInk(fraction),
        fontWeight: 600,
      }}
      title={
        fraction === null
          ? 'Not covered on this side'
          : `${tally.correct} of ${tally.total} ${what} correctly`
      }
    >
      {fraction === null ? '—' : <Fraction correct={tally.correct} total={tally.total} />}
    </td>
  )
}
