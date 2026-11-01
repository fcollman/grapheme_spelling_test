import { memo, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useStore } from '../state/store'
import { useStudentNames } from '../state/names'
import { cleanWord } from '../engine/phonemize'
import { toCsv } from '../export/csv'
import { useDownloads } from '../components/DownloadProvider'
import { useFileName } from '../state/filename'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { planKey } from './readingKeys'

/**
 * Marking a passage read aloud.
 *
 * One student at a time, because one recording is one student. The teacher
 * listens and taps through the passage: Tab means "that one was right", typing
 * means "they said this instead". The point is to keep up with speech, so every
 * decision here is about staying on the home keys.
 */
export function ReadingEntry() {
  const { project, test, dispatch } = useStore()
  const names = useStudentNames()
  const { requestDownload } = useDownloads()
  const fileName = useFileName()

  const [who, setWho] = useState<string>(() => project.students[0]?.id ?? '')
  const studentId = project.students.some((s) => s.id === who) ? who : (project.students[0]?.id ?? '')

  /** The passage box is a draft until it is committed, so typing does not re-tokenise. */
  const [draft, setDraft] = useState<string | null>(null)
  const [confirmEdit, setConfirmEdit] = useState(false)

  const passage = test.passage ?? ''
  const words = test.words
  const locked = project.settings.lockWords

  const inputs = useRef(new Map<string, HTMLInputElement | null>())

  /**
   * Moving between words.
   *
   * `select()` is what makes stepping backwards work the way the teacher asked
   * for: the respelling they typed earlier comes back already selected, so Tab
   * re-confirms it and typing replaces it. No separate notion of a suggestion is
   * needed — the stored value is the suggestion.
   */
  const focusWord = (index: number): boolean => {
    const word = words[index]
    const el = word ? inputs.current.get(word.id) : null
    if (!el) return false
    el.focus()
    el.select()
    return true
  }

  const responseFor = (wordId: string) => test.responses[wordId]?.[studentId] ?? ''
  const omittedFor = (wordId: string) => test.omissions?.[wordId]?.[studentId] === true

  const counts = useMemo(() => {
    let read = 0
    let respelled = 0
    let skipped = 0
    for (const w of words) {
      if (test.omissions?.[w.id]?.[studentId]) skipped += 1
      else {
        const value = test.responses[w.id]?.[studentId] ?? ''
        if (value === '') continue
        if (cleanWord(value) === cleanWord(w.text)) read += 1
        else respelled += 1
      }
    }
    return { read, respelled, skipped, left: words.length - read - respelled - skipped }
  }, [words, test.responses, test.omissions, studentId])

  const onWordKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    const word = words[index]
    const plan = planKey({
      key: e.key,
      shiftKey: e.shiftKey,
      value: e.currentTarget.value,
      omitted: omittedFor(word.id),
      index,
      wordCount: words.length,
    })
    if (!plan) return

    if (plan.preventDefault) e.preventDefault()
    if (plan.blur) e.currentTarget.blur()

    // Recorded before moving, and without reference to whether there is
    // anywhere to move to — see readingKeys.ts.
    if (plan.record === 'confirm') {
      dispatch({ type: 'setResponse', wordId: word.id, studentId, value: word.text })
    } else if (plan.record === 'omit') {
      dispatch({ type: 'setOmitted', wordId: word.id, studentId, omitted: true })
    }

    if (plan.move !== null) focusWord(plan.move)
  }

  const commitPassage = (text: string) => {
    dispatch({ type: 'setPassage', text })
    setDraft(null)
  }

  const markedCount = useMemo(() => {
    let n = 0
    for (const byStudent of Object.values(test.responses)) {
      n += Object.values(byStudent).filter((v) => v.trim() !== '').length
    }
    for (const byStudent of Object.values(test.omissions ?? {})) n += Object.keys(byStudent).length
    return n
  }, [test.responses, test.omissions])

  const exportCsv = () => {
    const rows: string[][] = [['Word', ...project.students.map((s) => names(s.id))]]
    for (const w of words) {
      rows.push([
        w.text,
        ...project.students.map((s) => {
          if (test.omissions?.[w.id]?.[s.id]) return 'skipped'
          return test.responses[w.id]?.[s.id] ?? ''
        }),
      ])
    }
    requestDownload({
      name: fileName('Reading passage', [test.name], test.date),
      extension: 'csv',
      mime: 'text/csv',
      build: () => toCsv(rows),
      folder: 'Reading passage',
    })
  }

  if (project.students.length === 0) {
    return (
      <section className="panel">
        <h2>{test.name}</h2>
        <div className="empty">Add students on the spelling test tab first.</div>
      </section>
    )
  }

  const editing = draft !== null || words.length === 0

  return (
    <section className="panel">
      {confirmEdit && (
        <ConfirmDialog
          title="Edit the passage?"
          confirmLabel="Edit passage"
          danger
          onCancel={() => setConfirmEdit(false)}
          onConfirm={() => {
            setDraft(passage)
            setConfirmEdit(false)
          }}
        >
          There {markedCount === 1 ? 'is' : 'are'} <strong>{markedCount}</strong> mark
          {markedCount === 1 ? '' : 's'} on this passage. Marks stay on the words you keep — only
          the ones you remove or change lose them.
        </ConfirmDialog>
      )}

      <h2>{test.name}</h2>

      {editing ? (
        <div className="passage-edit">
          <p className="hint">
            Paste the passage the students will read. Numerals are skipped, since there is no one
            way to read them aloud — spell them out if they matter.
          </p>
          <textarea
            className="passage-box"
            value={draft ?? passage}
            autoFocus
            placeholder="Paste the passage here…"
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="group no-print">
            <button className="btn primary" onClick={() => commitPassage(draft ?? passage)}>
              Use this passage
            </button>
            {words.length > 0 && (
              <button className="btn" onClick={() => setDraft(null)}>
                Cancel
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="group no-print" style={{ marginBottom: 12 }}>
            <label className="check">
              Marking
              <select value={studentId} onChange={(e) => setWho(e.target.value)}>
                {project.students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {names(s.id)}
                  </option>
                ))}
              </select>
            </label>
            <span className="keyword">
              {counts.read} read · {counts.respelled} respelled · {counts.skipped} skipped ·{' '}
              {counts.left} to go
            </span>
            <span className="spacer" />
            {!locked && (
              <button className="btn" onClick={() => (markedCount > 0 ? setConfirmEdit(true) : setDraft(passage))}>
                Edit passage
              </button>
            )}
            <button className="btn" onClick={exportCsv}>
              Download CSV
            </button>
          </div>

          <p className="hint no-print">
            <kbd>Tab</kbd> marks a word read correctly and moves on. Type what the student said
            instead, then <kbd>Tab</kbd>. <kbd>Shift</kbd>+<kbd>Tab</kbd> steps back and offers what
            you typed before. <kbd>-</kbd> marks a word they skipped altogether.
          </p>

          <div className="passage">
            {words.map((w, i) => {
              const gapFrom = i === 0 ? 0 : (words[i - 1].end ?? 0)
              const gap = passage.slice(gapFrom, w.start ?? gapFrom)
              return (
                <PassageWord
                  key={w.id}
                  gap={gap}
                  text={w.text}
                  value={responseFor(w.id)}
                  omitted={omittedFor(w.id)}
                  register={(el) => inputs.current.set(w.id, el)}
                  onKeyDown={(e) => onWordKeyDown(e, i)}
                  onChange={(value) =>
                    dispatch({ type: 'setResponse', wordId: w.id, studentId, value })
                  }
                  onUnskip={() =>
                    dispatch({ type: 'setOmitted', wordId: w.id, studentId, omitted: false })
                  }
                  wordId={w.id}
                />
              )
            })}
            {passage.slice(words[words.length - 1]?.end ?? 0)}
          </div>
        </>
      )}
    </section>
  )
}

/**
 * One word of the passage, with the box the teacher types into.
 *
 * Memoised because a passage is a few hundred controlled inputs and every
 * keystroke would otherwise re-render all of them.
 *
 * The word itself stays on screen whatever is typed. The teacher is reading
 * along with the audio, so a box that replaced the word would take away the
 * thing they are following — and for a respelled word, seeing "chasm" beside
 * "cham" is the whole point.
 */
const PassageWord = memo(function PassageWord({
  gap,
  text,
  value,
  omitted,
  wordId,
  register,
  onKeyDown,
  onChange,
  onUnskip,
}: {
  gap: string
  text: string
  value: string
  omitted: boolean
  wordId: string
  register: (el: HTMLInputElement | null) => void
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void
  onChange: (value: string) => void
  onUnskip: () => void
}) {
  const said = value !== '' && cleanWord(value) !== cleanWord(text)
  const correct = value !== '' && !said

  return (
    <>
      {gap}
      <span className={`pw ${omitted ? 'skipped' : said ? 'said' : correct ? 'read' : ''}`}>
        <span className="pw-word">{text}</span>
        {omitted && (
          <button className="pw-skip" title="They skipped this word — click to undo" onClick={onUnskip}>
            –
          </button>
        )}
        <input
          className="pw-input"
          type="text"
          value={value}
          aria-label={`What was said for ${text}`}
          data-word-id={wordId}
          ref={register}
          style={{ ['--pw-width' as string]: `${Math.max(value.length, 3) + 2}ch` }}
          onKeyDown={onKeyDown}
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
    </>
  )
})
