import { useMemo, useState } from 'react'
import { PrintTitle } from '../components/PrintTitle'
import { useStore } from '../state/store'
import { useStudentNames } from '../state/names'
import { cellKey, type AnalysisResult } from '../state/useAnalysis'
import { displayList, type PhonemeId } from '../data/phonemes'
import { CATEGORIES, COLLAPSING_CATEGORIES, category, type CategoryId } from '../data/categories'
import type { Mark, WordAnalysis } from '../engine/align'
import { assignLanes, type PatternMatch } from '../engine/patterns'
import { patternUnitRange, unitResults, type GraphemeUnit, type UnitResult } from '../engine/units'
import { PhonemePicker } from '../components/PhonemePicker'
import { CategoryDot, CategoryTag } from '../components/CategoryTag'
import { toCsv } from '../export/csv'
import { useDownloads } from '../components/DownloadProvider'
import { useFileName } from '../state/filename'
import { Legend } from '../components/Legend'

interface EditTarget {
  wordId: string
  studentId: string
  // No name here on purpose: the editor looks it up from studentId, so it cannot
  // fall out of step with the hide-student-names toggle.
  word: string
  unitIndex: number
}

const CATEGORY_ORDER = new Map(CATEGORIES.map((c, i) => [c.id, i]))

/**
 * The marking grid. Columns are grapheme units — the chunk of letters the teacher
 * marks — with the sound or sounds each one makes shown underneath.
 */
export function GraphemeAnalysis({ analysis }: { analysis: AnalysisResult }) {
  const { requestDownload, requestPrint } = useDownloads()
  const fileName = useFileName()
  const { project, test, dispatch } = useStore()
  const names = useStudentNames()
  const { notation } = project.settings
  const [editing, setEditing] = useState<EditTarget | null>(null)
  const [editingWord, setEditingWord] = useState<string | null>(null)
  const [only, setOnly] = useState<string>('all')
  const [focus, setFocus] = useState<CategoryId | 'all'>('all')
  const [sortBy, setSortBy] = useState<'order' | 'category'>('order')

  const wordCategorySets = useMemo(() => {
    const map = new Map<string, Set<CategoryId>>()
    for (const [wordId, units] of analysis.unitsByWord) {
      const set = new Set<CategoryId>(units.map((u) => u.category))
      for (const p of analysis.patternsByWord.get(wordId) ?? []) set.add(p.category)
      map.set(wordId, set)
    }
    return map
  }, [analysis.unitsByWord, analysis.patternsByWord])

  const presentCategories = useMemo(() => {
    const seen = new Set<CategoryId>()
    for (const set of wordCategorySets.values()) for (const c of set) seen.add(c)
    return CATEGORIES.filter((c) => seen.has(c.id))
  }, [wordCategorySets])

  const words = useMemo(() => {
    let list = only === 'all' ? [...test.words] : test.words.filter((w) => w.id === only)
    if (focus !== 'all') list = list.filter((w) => wordCategorySets.get(w.id)?.has(focus))
    if (sortBy === 'category') {
      const rank = (id: string) =>
        Math.min(...[...(wordCategorySets.get(id) ?? [])].map((c) => CATEGORY_ORDER.get(c) ?? 99), 99)
      list.sort((a, b) => rank(a.id) - rank(b.id) || a.text.localeCompare(b.text))
    }
    return list
  }, [test.words, only, focus, sortBy, wordCategorySets])

  const hiddenCount = test.words.length - words.length

  const exportCsv = () => {
    const rows: string[][] = [
      [
        'Test', 'Date', 'Word', 'Type', 'Student', 'Wrote', 'Spelling correct',
        'Column', 'Syllable', 'Target letters', 'Target sound(s)', 'Category', 'Taught pattern',
        'Patterns covering', 'Student letters', 'Student sound(s)', 'Result', 'Teacher edited',
      ],
    ]
    for (const w of test.words) {
      const units = analysis.unitsByWord.get(w.id) ?? []
      const patterns = analysis.patternsByWord.get(w.id) ?? []
      for (const s of project.students) {
        const a = analysis.byCell.get(cellKey(w.id, s.id))
        if (!a) continue
        for (const r of unitResults(a, units)) {
          const syllable = a.syllables.findIndex(
            (sy) => r.unit.startSlot >= sy.start && r.unit.startSlot < sy.end,
          )
          const covering = patterns
            .filter((p) => p.start < r.unit.endSlot && p.end > r.unit.startSlot)
            .map((p) => `${category(p.category).label}: ${p.label}${p.source === 'structural' ? ' (unlisted)' : ''}`)
          rows.push([
            test.name, test.date, w.text, w.nonsense ? 'nonsense' : 'real',
            names(s.id), a.attempt, a.spellingCorrect ? 'yes' : 'no',
            String(r.unit.index + 1), String(syllable + 1),
            r.unit.letters, displayList(r.unit.phonemes, notation),
            category(r.unit.category).label, r.unit.patternLabel ?? '',
            covering.join('; '),
            r.studentLetters || '—', displayList(r.studentPhonemes, notation) || '—',
            r.mark, r.overridden ? 'yes' : 'no',
          ])
        }
      }
    }
    requestDownload({
      name: fileName('Grapheme analysis', [test.name], test.date),
      extension: 'csv',
      mime: 'text/csv',
      build: () => toCsv(rows),
      folder: 'Grapheme analysis',
    })
  }

  if (test.words.length === 0 || project.students.length === 0) {
    return (
      <section className="panel">
        <h2>Grapheme analysis</h2>
        <div className="empty">Add words and students on the spelling test tab first.</div>
      </section>
    )
  }

  return (
    <section className="panel">
      <PrintTitle>
        {test.name} · {test.date} · Grapheme analysis
        {focus !== 'all' && ` · ${category(focus).label}`}
      </PrintTitle>
      <h2>Grapheme analysis</h2>
      <p className="hint">
        Each column is one spelling unit of the target word — a grapheme, or a chunk taught whole
        like <strong>-ank</strong> and <strong>-ttle</strong> — with the sound or sounds it makes
        underneath. Blends stay as separate columns so you can see which sound was missed. Click any
        cell to correct it.
      </p>

      <div className="group no-print" style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label className="check">
          Show
          <select value={only} onChange={(e) => setOnly(e.target.value)}>
            <option value="all">All words</option>
            {test.words.map((w) => (
              <option key={w.id} value={w.id}>
                {w.text}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          Pattern
          <select value={focus} onChange={(e) => setFocus(e.target.value as CategoryId | 'all')}>
            <option value="all">Every kind</option>
            {presentCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          Order
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'order' | 'category')}>
            <option value="order">As entered</option>
            <option value="category">Grouped by kind</option>
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={project.settings.lenientSchwa}
            onChange={(e) => dispatch({ type: 'updateSettings', settings: { lenientSchwa: e.target.checked } })}
          />
          Accept any unstressed vowel for a schwa
        </label>
        <span className="spacer" />
        <button className="btn" onClick={exportCsv}>
          Download CSV
        </button>
        <button
          className="btn"
          onClick={() => requestPrint(fileName('Grapheme analysis', [test.name], test.date))}
        >
          Print / Save PDF
        </button>
      </div>

      <Legend />

      {presentCategories.length > 0 && (
        <details className="catkey">
          <summary>Sound and pattern kinds in this test ({presentCategories.length})</summary>
          <div className="catkey-list">
            {presentCategories.map((c) => (
              <button
                key={c.id}
                className="catkey-item no-print"
                title={c.description}
                aria-pressed={focus === c.id}
                onClick={() => setFocus(focus === c.id ? 'all' : c.id)}
              >
                <CategoryTag id={c.id} />
                <span className="catkey-desc">{c.description}</span>
              </button>
            ))}
          </div>
        </details>
      )}

      {focus !== 'all' && (
        <p className="hint" style={{ marginTop: -4 }}>
          Showing the {words.length} word{words.length === 1 ? '' : 's'} containing{' '}
          <strong>{category(focus).label.toLowerCase()}</strong>
          {hiddenCount > 0 && `, ${hiddenCount} hidden`}. {category(focus).description}
        </p>
      )}

      {analysis.loading && <div className="empty">Analysing…</div>}
      {!analysis.loading && words.length === 0 && (
        <div className="empty">No words in this test contain that pattern.</div>
      )}

      {!analysis.loading &&
        words.map((word) => {
          const target = analysis.byWord.get(word.id)
          const units = analysis.unitsByWord.get(word.id)
          if (!target || !units) return null
          return (
            <WordBlock
              key={word.id}
              wordId={word.id}
              text={word.text}
              nonsense={word.nonsense}
              target={target}
              units={units}
              patterns={analysis.patternsByWord.get(word.id) ?? []}
              focus={focus}
              analysis={analysis}
              onEditCell={setEditing}
              onEditWord={() => setEditingWord(word.id)}
            />
          )
        })}

      {editing && (
        <CellEditor
          edit={editing}
          analysis={analysis}
          onClose={() => setEditing(null)}
          onApply={(student, mark, slot) => {
            dispatch({
              type: 'setOverride',
              wordId: editing.wordId,
              studentId: editing.studentId,
              slot,
              value: { student, mark },
            })
            setEditing(null)
          }}
          onReset={(slot) => {
            dispatch({
              type: 'setOverride',
              wordId: editing.wordId,
              studentId: editing.studentId,
              slot,
              value: null,
            })
            setEditing(null)
          }}
        />
      )}

      {editingWord && (
        <WordMapEditor wordId={editingWord} analysis={analysis} onClose={() => setEditingWord(null)} />
      )}
    </section>
  )
}

function WordBlock({
  wordId,
  text,
  nonsense,
  target,
  units,
  patterns,
  focus,
  analysis,
  onEditCell,
  onEditWord,
}: {
  wordId: string
  text: string
  nonsense: boolean
  target: WordAnalysis
  units: GraphemeUnit[]
  patterns: PatternMatch[]
  focus: CategoryId | 'all'
  analysis: AnalysisResult
  onEditCell: (t: EditTarget) => void
  onEditWord: () => void
}) {
  const { project, test } = useStore()
  const names = useStudentNames()
  const { notation } = project.settings
  const confirmed = test.wordPhonemes[wordId] !== undefined

  if (units.length === 0) {
    return (
      <div className="wordblock">
        <header>
          <span className="word">{text || '(empty)'}</span>
          <span className="tag">no sounds found</span>
        </header>
      </div>
    )
  }

  // Collapsed patterns are already columns; the band shows the rest.
  const banded = patterns.filter((p) => !COLLAPSING_CATEGORIES.has(p.category))
  const lanes = assignLanes(banded)
  const syllableStartUnits = new Set(
    target.syllables.map((s) => units.findIndex((u) => u.startSlot === s.start)).filter((i) => i > 0),
  )

  return (
    <div className="wordblock">
      <header>
        <span className="word">{text}</span>
        {nonsense && <span className="tag">nonsense</span>}
        <span className="tag">
          {target.syllables.length} syllable{target.syllables.length === 1 ? '' : 's'}
        </span>
        <span style={{ color: 'var(--muted)' }}>
          {target.syllables.map((s) => displayList(s.phonemes, notation)).join('  ·  ')}
        </span>
        {confirmed && <span className="tag">breakdown edited</span>}
        <span className="spacer" />
        <button className="btn no-print" onClick={onEditWord}>
          Edit breakdown
        </button>
      </header>

      {patterns.length > 0 && (
        <div className="patternbar">
          {patterns.map((p, i) => (
            <CategoryTag
              key={`${p.id}-${p.start}-${i}`}
              id={p.category}
              label={`${p.label} · ${category(p.category).label.toLowerCase()}`}
              unlisted={p.source === 'structural'}
            />
          ))}
        </div>
      )}

      <div className="scroll">
        <table className="grid-sticky analysis-grid">
          <thead>
            <tr>
              <th className="c1">Student</th>
              <th className="c2">Wrote</th>
              {units.map((u) => (
                <th
                  key={u.index}
                  className={`num unitheader ${syllableStartUnits.has(u.index) ? 'syllable-group' : ''} ${
                    focus === u.category ? 'focused' : ''
                  }`}
                  title={`${u.letters} spells ${displayList(u.phonemes, notation)} — ${category(u.category).label}`}
                >
                  <span className="unitletters">{u.letters || '—'}</span>
                  <span className="unitsounds">{displayList(u.phonemes, notation)}</span>
                  <CategoryDot id={u.category} title={category(u.category).label} />
                </th>
              ))}
            </tr>

            {lanes.map((lane, laneIndex) => (
              <tr key={laneIndex} className={laneIndex === lanes.length - 1 ? 'band-row' : undefined}>
                <th className="band c1" />
                <th className="band c2" />
                {renderBand(lane, units, focus)}
              </tr>
            ))}
            {lanes.length === 0 && (
              <tr className="band-row">
                <th className="band c1" />
                <th className="band c2" />
                {units.map((u) => (
                  <th key={u.index} className="band" />
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {project.students.map((student) => {
              const a = analysis.byCell.get(cellKey(wordId, student.id))
              if (!a) return null
              const results = unitResults(a, units)
              return (
                <tr key={student.id}>
                  <th className="rowhead c1">{names(student.id)}</th>
                  <td className="c2" style={{ fontFamily: 'var(--mono)' }}>
                    {a.attempted ? a.attempt : <span style={{ color: 'var(--muted)' }}>—</span>}
                  </td>
                  {results.map((r) => (
                    <td
                      key={r.unit.index}
                      className={`cell ${r.mark} ${r.overridden ? 'edited' : ''} ${
                        syllableStartUnits.has(r.unit.index) ? 'syllable-group' : ''
                      } ${focus !== 'all' && isFocused(r, patterns, focus) ? 'focused' : ''}`}
                      title={`${names(student.id)} · ${r.unit.letters} (${displayList(r.unit.phonemes, notation)}) · ${
                        MARK_TEXT[r.mark]
                      }${r.overridden ? ' (edited)' : ''}`}
                      onClick={() =>
                        onEditCell({
                          wordId,
                          studentId: student.id,
                          word: text,
                          unitIndex: r.unit.index,
                        })
                      }
                    >
                      <span className="unitletters">{r.studentLetters || '—'}</span>
                      <span className="unitsounds">
                        {r.studentPhonemes.length > 0 ? displayList(r.studentPhonemes, notation) : ' '}
                      </span>
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function isFocused(r: UnitResult, patterns: PatternMatch[], focus: CategoryId): boolean {
  if (r.unit.category === focus) return true
  return patterns.some(
    (p) => p.category === focus && p.start < r.unit.endSlot && p.end > r.unit.startSlot,
  )
}

/** Draws one lane of patterns as cells spanning the columns they cover. */
function renderBand(lane: PatternMatch[], units: GraphemeUnit[], focus: CategoryId | 'all') {
  const cells: JSX.Element[] = []
  const ranges = lane
    .map((p) => ({ p, range: patternUnitRange(p, units) }))
    .filter((x): x is { p: PatternMatch; range: { start: number; end: number } } => x.range !== null)
    .sort((a, b) => a.range.start - b.range.start)

  let i = 0
  for (const { p, range } of ranges) {
    while (i < range.start) {
      cells.push(<td key={`gap-${i}`} className="band" />)
      i += 1
    }
    cells.push(
      <td
        key={`p-${p.id}-${range.start}`}
        className={`band filled ${focus === p.category ? 'focused' : ''}`}
        colSpan={range.end - range.start}
      >
        <CategoryTag id={p.category} label={p.label} unlisted={p.source === 'structural'} />
      </td>,
    )
    i = range.end
  }
  while (i < units.length) {
    cells.push(<td key={`gap-${i}`} className="band" />)
    i += 1
  }
  return cells
}

const MARK_TEXT: Record<Mark, string> = {
  exact: 'correct spelling for this sound',
  plausible: 'right sound, different spelling',
  wrong: 'wrong sound',
  omitted: 'left out',
}

function CellEditor({
  edit,
  analysis,
  onClose,
  onApply,
  onReset,
}: {
  edit: EditTarget
  analysis: AnalysisResult
  onClose: () => void
  onApply: (student: PhonemeId[], mark: Mark, slot: number) => void
  onReset: (slot: number) => void
}) {
  const names = useStudentNames()
  const { project } = useStore()
  const { notation } = project.settings
  const a = analysis.byCell.get(cellKey(edit.wordId, edit.studentId))
  const units = analysis.unitsByWord.get(edit.wordId) ?? []
  const result = a ? unitResults(a, units)[edit.unitIndex] : undefined

  const [chosen, setChosen] = useState<PhonemeId[]>(result?.studentPhonemes ?? [])
  const [mark, setMark] = useState<Mark>(result?.mark ?? 'wrong')

  if (!a || !result) return null
  const slot = result.unit.startSlot

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Correct this spelling">
        <h3>
          {names(edit.studentId)} · {edit.word} · column {edit.unitIndex + 1} of {units.length}
        </h3>
        <p className="sub">
          This column is <strong>{result.unit.letters}</strong> spelling{' '}
          {displayList(result.unit.phonemes, notation)}
          {result.unit.patternLabel && ` (${result.unit.patternLabel}, taught as one chunk)`}. They wrote “
          {a.attempt || '—'}”, and these letters were matched to this column: “
          {result.studentLetters || '—'}”.
        </p>

        <p className="sub" style={{ margin: '0 0 6px' }}>
          <strong>What sound did the student's letters actually make here?</strong>
        </p>
        <PhonemePicker value={chosen} onChange={setChosen} notation={notation} />

        <footer>
          <label className="check">
            Result
            <select value={mark} onChange={(e) => setMark(e.target.value as Mark)}>
              <option value="exact">Correct spelling for this sound</option>
              <option value="plausible">Right sound, different spelling</option>
              <option value="wrong">Wrong sound</option>
              <option value="omitted">Left out</option>
            </select>
          </label>
          <span className="spacer" />
          {result.overridden && (
            <button className="btn danger" onClick={() => onReset(slot)}>
              Undo my edit
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={() => onApply(chosen, mark, slot)}>
            Save
          </button>
        </footer>
      </div>
    </div>
  )
}

function WordMapEditor({
  wordId,
  analysis,
  onClose,
}: {
  wordId: string
  analysis: AnalysisResult
  onClose: () => void
}) {
  const { project, test, dispatch } = useStore()
  const { notation } = project.settings
  const target = analysis.byWord.get(wordId)
  const word = test.words.find((w) => w.id === wordId)
  const [chosen, setChosen] = useState<PhonemeId[]>(target?.targetPhonemes ?? [])

  if (!target || !word) return null
  const edited = test.wordPhonemes[wordId] !== undefined

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Edit word breakdown">
        <h3>Sounds in “{word.text}”</h3>
        <p className="sub">
          Fix this once and it applies to every student. The columns are worked out from these
          sounds, so changing them clears any cell corrections for this word.
        </p>

        <PhonemePicker value={chosen} onChange={setChosen} notation={notation} emptyLabel="No sounds" />

        <footer>
          {edited && (
            <button
              className="btn danger"
              onClick={() => {
                dispatch({ type: 'setWordPhonemes', wordId, phonemes: null })
                onClose()
              }}
            >
              Back to automatic
            </button>
          )}
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={() => {
              dispatch({ type: 'setWordPhonemes', wordId, phonemes: chosen })
              onClose()
            }}
          >
            Save
          </button>
        </footer>
      </div>
    </div>
  )
}


