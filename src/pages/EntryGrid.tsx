import { useRef, useState, type KeyboardEvent } from 'react'
import { useStore } from '../state/store'
import { cleanWord } from '../engine/phonemize'
import { download, exportName } from '../state/persist'
import { toCsv } from '../export/csv'
import { exampleProject } from '../state/example'

/**
 * The spreadsheet the teacher fills in during or after the test: words down the
 * side, students across the top. Green/red here is whole-word correctness only;
 * the sound-by-sound breakdown lives on the analysis tab.
 */
export function EntryGrid() {
  const { project, test, dispatch } = useStore()
  const [wordDraft, setWordDraft] = useState('')
  const [studentDraft, setStudentDraft] = useState('')

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

  const exportCsv = () => {
    const rows: string[][] = [['Word', 'Type', ...project.students.map((s) => s.name)]]
    for (const w of test.words) {
      rows.push([
        w.text,
        w.nonsense ? 'nonsense' : 'real',
        ...project.students.map((s) => test.responses[w.id]?.[s.id] ?? ''),
      ])
    }
    download(exportName(test.name, 'responses'), toCsv(rows), 'text/csv')
  }

  return (
    <section className="panel">
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
                      <input
                        type="text"
                        value={s.name}
                        aria-label={`Name for ${s.name}`}
                        style={{ width: 110, padding: '2px 5px' }}
                        onChange={(e) => dispatch({ type: 'renameStudent', id: s.id, name: e.target.value })}
                      />
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
                          title={`Remove ${s.name}`}
                          onClick={() => dispatch({ type: 'removeStudent', id: s.id })}
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
                          onClick={() => dispatch({ type: 'removeWord', id: w.id })}
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
                          aria-label={`${s.name} wrote for ${w.text}`}
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
          </table>
        </div>
      )}
    </section>
  )
}
