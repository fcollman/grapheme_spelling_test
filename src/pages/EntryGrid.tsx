import { useRef, useState, type KeyboardEvent } from 'react'
import { useStore } from '../state/store'
import { useStudentNames } from '../state/names'
import { cleanWord } from '../engine/phonemize'
import { download, exportName } from '../state/persist'
import { toCsv } from '../export/csv'
import { exampleProject } from '../state/example'
import { Fraction, percentOf } from '../components/Fraction'
import { ConfirmDialog } from '../components/ConfirmDialog'

/**
 * The spreadsheet the teacher fills in during or after the test: words down the
 * side, students across the top. Green/red here is whole-word correctness only;
 * the sound-by-sound breakdown lives on the analysis tab.
 */
export function EntryGrid() {
  const { project, test, dispatch } = useStore()
  const names = useStudentNames()
  const [wordDraft, setWordDraft] = useState('')
  const [studentDraft, setStudentDraft] = useState('')
  const [pendingDelete, setPendingDelete] = useState<{
    kind: 'student' | 'word'
    id: string
    name: string
    count: number
  } | null>(null)
  /** Which archived students are ticked in the "add from an earlier test" dialog; null = closed. */
  const [restoring, setRestoring] = useState<Set<string> | null>(null)

  /**
   * Keyboard navigation for the grid. Teachers work through one student's paper
   * at a time, so Enter moves DOWN the column to the next word, and running off
   * the bottom wraps to the top of the next student's column. Tab still moves
   * across the row, which the browser gives us for free.
   */
  const inputs = useRef(new Map<string, HTMLInputElement | null>())
  const cellId = (wordIndex: number, studentIndex: number) => `${wordIndex}:${studentIndex}`

  const focusCell = (wordIndex: number, studentIndex: number): boolean => {
    const el = inputs.current.get(cellId(wordIndex, studentIndex))
    if (!el) return false
    el.focus()
    // Select what is there so a correction can just be typed over.
    el.select()
    return true
  }

  const moveBy = (wordIndex: number, studentIndex: number, delta: number) => {
    let nextWord = wordIndex + delta
    let nextStudent = studentIndex

    if (nextWord >= test.words.length) {
      nextWord = 0
      nextStudent += 1
    } else if (nextWord < 0) {
      nextWord = test.words.length - 1
      nextStudent -= 1
    }

    if (nextStudent < 0 || nextStudent >= project.students.length) return
    focusCell(nextWord, nextStudent)
  }

  const onCellKeyDown = (e: KeyboardEvent<HTMLInputElement>, wordIndex: number, studentIndex: number) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const up = e.key === 'ArrowUp' || (e.key === 'Enter' && e.shiftKey)
      moveBy(wordIndex, studentIndex, up ? -1 : 1)
    }
  }

  const addWords = () => {
    // Accept a whole list at once: "cat, dog, blorf" or one per line.
    const parts = wordDraft.split(/[\n,;\t]+/)
    dispatch({ type: 'addWords', texts: parts })
    setWordDraft('')
  }

  const addStudent = () => {
    dispatch({ type: 'addStudent', name: studentDraft })
    setStudentDraft('')
  }

  /**
   * A plain word score per student, for grading.
   *
   * Counted out of every word on the test, not just the ones attempted: a word
   * left blank is a word not spelled correctly. The blank count is shown beside
   * it so a low score for an absent student is not mistaken for a low score for
   * a struggling one.
   */
  const scoreFor = (studentId: string) => {
    let correct = 0
    let blank = 0
    for (const w of test.words) {
      const written = test.responses[w.id]?.[studentId] ?? ''
      if (written.trim() === '') blank += 1
      else if (cleanWord(written) === cleanWord(w.text)) correct += 1
    }
    return { correct, blank, total: test.words.length }
  }

  /**
   * How much a delete would take with it.
   *
   * A student's spellings span every test, not just the one on screen, so the
   * count has to look project-wide or the warning understates the damage.
   */
  const spellingsByStudent = (studentId: string) =>
    project.tests.reduce(
      (n, t) =>
        n + Object.values(t.responses).filter((byStudent) => (byStudent[studentId] ?? '').trim() !== '').length,
      0,
    )

  const spellingsForWord = (wordId: string) =>
    Object.values(test.responses[wordId] ?? {}).filter((v) => v.trim() !== '').length

  const removeStudent = (s: { id: string; name: string }) => {
    const count = spellingsByStudent(s.id)
    if (count === 0) dispatch({ type: 'removeStudent', id: s.id })
    else setPendingDelete({ kind: 'student', id: s.id, name: names(s.id), count })
  }

  const removeWord = (w: { id: string; text: string }) => {
    const count = spellingsForWord(w.id)
    if (count === 0) dispatch({ type: 'removeWord', id: w.id })
    else setPendingDelete({ kind: 'word', id: w.id, name: w.text, count })
  }

  /**
   * Students who are no longer on the roster but still have spellings in a test.
   *
   * The roster is project-wide, so a new test already starts with everyone on
   * it — the only students "missing" from a test are ones that were removed.
   * This is what puts them back, along with the analysis of their old work.
   */
  const archived = project.archivedStudents ?? []

  const testsWithDataFor = (studentId: string) =>
    project.tests.filter((t) =>
      Object.values(t.responses).some((byStudent) => (byStudent[studentId] ?? '').trim() !== ''),
    )

  /**
   * Archived names go through the privacy toggle too. They are not in the roster,
   * so `names()` cannot number them; they get their own numbering instead.
   */
  const archivedName = (id: string) => {
    const index = archived.findIndex((s) => s.id === id)
    if (project.settings.anonymize) return `Former student ${index + 1}`
    return archived[index]?.name ?? 'Unknown'
  }

  const openRestore = () => setRestoring(new Set(archived.map((s) => s.id)))

  const toggleRestore = (id: string) => {
    setRestoring((current) => {
      const next = new Set(current ?? [])
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exportCsv = () => {
    const rows: string[][] = [['Word', 'Type', ...project.students.map((s) => names(s.id))]]
    for (const w of test.words) {
      rows.push([
        w.text,
        w.nonsense ? 'nonsense' : 'real',
        ...project.students.map((s) => test.responses[w.id]?.[s.id] ?? ''),
      ])
    }
    // The same grading row that closes the grid on screen.
    rows.push([
      'Words correct',
      '',
      ...project.students.map((s) => {
        const { correct, total } = scoreFor(s.id)
        const pct = percentOf(correct, total)
        return pct ? `${correct}/${total} (${pct})` : `${correct}/${total}`
      }),
    ])
    download(exportName(test.name, 'responses'), toCsv(rows), 'text/csv')
  }

  return (
    <section className="panel">
      {/* The ✕ buttons sit next to the reorder arrows, so a misclick is easy. */}
      {pendingDelete && (
        <ConfirmDialog
          title={
            pendingDelete.kind === 'student'
              ? `Remove ${pendingDelete.name} from the class?`
              : `Remove the word “${pendingDelete.name}”?`
          }
          confirmLabel={pendingDelete.kind === 'student' ? 'Remove student' : 'Remove word'}
          danger
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            dispatch(
              pendingDelete.kind === 'student'
                ? { type: 'removeStudent', id: pendingDelete.id }
                : { type: 'removeWord', id: pendingDelete.id },
            )
            setPendingDelete(null)
          }}
        >
          {pendingDelete.kind === 'student' ? (
            <>
              <strong>{pendingDelete.name}</strong> has {pendingDelete.count} spelling
              {pendingDelete.count === 1 ? '' : 's'} recorded across{' '}
              {project.tests.length === 1 ? 'this test' : `your ${project.tests.length} tests`}. The
              roster is shared, so removing them takes their column out of <em>every</em> test, not
              just this one.
              <br />
              Their answers are kept, so <strong>Add from an earlier test</strong> can put them back
              with their work intact.
            </>
          ) : (
            <>
              <strong>{pendingDelete.name}</strong> has {pendingDelete.count} spelling
              {pendingDelete.count === 1 ? '' : 's'} recorded against it on this test. Removing the
              word removes those too.
            </>
          )}
        </ConfirmDialog>
      )}

      {restoring && (
        <ConfirmDialog
          title="Add students from an earlier test"
          confirmLabel={restoring.size === 1 ? 'Add 1 student' : `Add ${restoring.size} students`}
          confirmDisabled={restoring.size === 0}
          onCancel={() => setRestoring(null)}
          onConfirm={() => {
            dispatch({ type: 'restoreStudents', ids: [...restoring] })
            setRestoring(null)
          }}
        >
          <p style={{ marginTop: 0 }}>
            These students were removed from the class but their spellings are still in the file.
            Adding one back puts their column on every test again, with their old work and its
            analysis intact.
          </p>
          <div className="testpicker-list">
            {archived.map((s) => {
              const on = restoring.has(s.id)
              const tests = testsWithDataFor(s.id)
              const spellings = spellingsByStudent(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`testchip ${on ? 'on' : ''}`}
                  aria-pressed={on}
                  onClick={() => toggleRestore(s.id)}
                >
                  <span className="mark">{on ? '✓' : '+'}</span>
                  <span className="name">{archivedName(s.id)}</span>
                  <span className="date">
                    {spellings} spelling{spellings === 1 ? '' : 's'} in {tests.length} test
                    {tests.length === 1 ? '' : 's'}
                  </span>
                </button>
              )
            })}
          </div>
        </ConfirmDialog>
      )}

      <h2>Spelling test</h2>
      <p className="hint">
        Add the words you dictated and the students who took the test, then type what each student
        actually wrote. A cell turns green when the spelling matches the word exactly. Mark a word as
        nonsense if it was made up to test encoding without sight-word memory.
        <br />
        Working from one student's paper: press <kbd>Enter</kbd> to drop to the next word down the
        column, and again at the bottom to jump to the top of the next student. <kbd>Shift</kbd>+
        <kbd>Enter</kbd> goes back up, and <kbd>Tab</kbd> moves across the row.
      </p>

      <div className="group no-print" style={{ marginBottom: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Add words (comma or newline separated)"
          value={wordDraft}
          style={{ minWidth: 280 }}
          onChange={(e) => setWordDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addWords()}
        />
        <button className="btn primary" onClick={addWords}>
          Add words
        </button>

        <input
          type="text"
          placeholder="Add a student"
          value={studentDraft}
          onChange={(e) => setStudentDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addStudent()}
        />
        <button className="btn primary" onClick={addStudent}>
          Add student
        </button>
        {/*
          Only shown when there is something to put back. The roster carries over
          to every new test on its own, so with nobody archived this button would
          be an offer to do nothing.
        */}
        {archived.length > 0 && (
          <button className="btn" onClick={openRestore}>
            Add from an earlier test ({archived.length})
          </button>
        )}

        <span className="spacer" />

        <input
          type="text"
          value={test.name}
          aria-label="Test name"
          onChange={(e) => dispatch({ type: 'renameTest', id: test.id, name: e.target.value })}
        />
        <input
          type="date"
          value={test.date}
          aria-label="Test date"
          onChange={(e) => dispatch({ type: 'setTestDate', id: test.id, date: e.target.value })}
        />
        <button className="btn" onClick={exportCsv} disabled={test.words.length === 0}>
          Download CSV
        </button>
      </div>

      {test.words.length === 0 || project.students.length === 0 ? (
        <div className="empty">
          {test.words.length === 0 && project.students.length === 0 ? (
            <>
              <p style={{ marginTop: 0 }}>Add some words and students to get started.</p>
              <button
                className="btn"
                onClick={() => dispatch({ type: 'replaceProject', project: exampleProject() })}
              >
                Or load an example test to look around
              </button>
            </>
          ) : test.words.length === 0 ? (
            'Add the words from the test.'
          ) : (
            'Add the students who took the test.'
          )}
        </div>
      ) : (
        <div className="scroll">
          <table className="grid-sticky entry-grid">
            <thead>
              <tr>
                <th className="c1">Word</th>
                <th className="num no-print c2">Nonsense</th>
                {project.students.map((s) => (
                  <th key={s.id}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {project.settings.anonymize ? (
                        <span style={{ width: 110, display: 'inline-block' }}>{names(s.id)}</span>
                      ) : (
                        <input
                          type="text"
                          value={s.name}
                          aria-label={`Name for ${s.name}`}
                          style={{ width: 110, padding: '2px 5px' }}
                          onChange={(e) => dispatch({ type: 'renameStudent', id: s.id, name: e.target.value })}
                        />
                      )}
                      <span className="no-print" style={{ whiteSpace: 'nowrap' }}>
                        <button
                          className="icon"
                          title="Move left"
                          onClick={() => dispatch({ type: 'moveStudent', id: s.id, delta: -1 })}
                        >
                          ◀
                        </button>
                        <button
                          className="icon"
                          title="Move right"
                          onClick={() => dispatch({ type: 'moveStudent', id: s.id, delta: 1 })}
                        >
                          ▶
                        </button>
                        <button
                          className="icon"
                          title={`Remove ${names(s.id)}`}
                          onClick={() => removeStudent(s)}
                        >
                          ✕
                        </button>
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {test.words.map((w, wordIndex) => (
                <tr key={w.id}>
                  <th className="rowhead c1">
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input
                        type="text"
                        value={w.text}
                        aria-label={`Word ${w.text}`}
                        style={{ width: 130, padding: '2px 5px' }}
                        onChange={(e) => dispatch({ type: 'updateWord', id: w.id, text: e.target.value })}
                      />
                      <span className="no-print" style={{ whiteSpace: 'nowrap' }}>
                        <button
                          className="icon"
                          title="Move up"
                          onClick={() => dispatch({ type: 'moveWord', id: w.id, delta: -1 })}
                        >
                          ▲
                        </button>
                        <button
                          className="icon"
                          title="Move down"
                          onClick={() => dispatch({ type: 'moveWord', id: w.id, delta: 1 })}
                        >
                          ▼
                        </button>
                        <button
                          className="icon"
                          title={`Remove ${w.text}`}
                          onClick={() => removeWord(w)}
                        >
                          ✕
                        </button>
                      </span>
                    </div>
                  </th>
                  <td className="num no-print c2">
                    <input
                      type="checkbox"
                      checked={w.nonsense}
                      aria-label={`${w.text} is a nonsense word`}
                      onChange={(e) => dispatch({ type: 'updateWord', id: w.id, nonsense: e.target.checked })}
                    />
                  </td>
                  {project.students.map((s, studentIndex) => {
                    const value = test.responses[w.id]?.[s.id] ?? ''
                    const state =
                      value.trim() === '' ? '' : cleanWord(value) === cleanWord(w.text) ? 'correct' : 'incorrect'
                    return (
                      <td key={s.id} className={`entry-cell ${state}`}>
                        <input
                          type="text"
                          value={value}
                          aria-label={`${names(s.id)} wrote for ${w.text}`}
                          autoComplete="off"
                          autoCapitalize="off"
                          autoCorrect="off"
                          spellCheck={false}
                          ref={(el) => {
                            inputs.current.set(cellId(wordIndex, studentIndex), el)
                          }}
                          onKeyDown={(e) => onCellKeyDown(e, wordIndex, studentIndex)}
                          onChange={(e) =>
                            dispatch({
                              type: 'setResponse',
                              wordId: w.id,
                              studentId: s.id,
                              value: e.target.value,
                            })
                          }
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th className="rowhead c1">Words correct</th>
                <td className="num no-print c2" />
                {project.students.map((s) => {
                  const { correct, blank, total } = scoreFor(s.id)
                  return (
                    <td key={s.id} className="num score">
                      <Fraction correct={correct} total={total} />
                      {blank > 0 && <span className="blanks">{blank} blank</span>}
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  )
}
