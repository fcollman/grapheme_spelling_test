import { memo, useCallback, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useStore } from '../state/store'
import { useStudentNames } from '../state/names'
import { cleanWord } from '../engine/phonemize'
import { toCsv } from '../export/csv'
import { useDownloads } from '../components/DownloadProvider'
import { useFileName } from '../state/filename'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { planKey } from './readingKeys'
import { useReadingAudio } from '../state/useReadingAudio'
import { useRecorder } from '../state/useRecorder'
import { pickRecordingTarget, writeBlob } from '../state/fileAccess'
import { buildFileName } from '../state/filename'
import { download } from '../state/persist'
import type { AudioMeta } from '../state/types'

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
  const filePicker = useRef<HTMLInputElement>(null)

  const onAttached = useCallback(
    (meta: AudioMeta) => dispatch({ type: 'setAudioMeta', studentId, meta }),
    [dispatch, studentId],
  )
  const audio = useReadingAudio(test.id, studentId, test.audioFiles?.[studentId], onAttached)
  const recorder = useRecorder()
  const [recordNote, setRecordNote] = useState<string | null>(null)

  /**
   * Record here, write it to the teacher's own disk, then mark against it.
   *
   * The file is chosen and written straight away rather than held in the page:
   * a recording that exists only in a tab is one refresh from gone, and this
   * one cannot be made again.
   */
  const stopRecording = async () => {
    const made = await recorder.stop()
    if (!made) {
      setRecordNote('Nothing was recorded.')
      return
    }
    const name = buildFileName([project.className, names(studentId), test.name, test.date])
    try {
      const handle = await pickRecordingTarget(`${name}.${made.extension}`, made.extension)
      if (handle) {
        await writeBlob(handle, made.blob)
        await audio.adopt(handle)
        setRecordNote(null)
        return
      }
      /*
       * No file picker, or the teacher closed it. The recording is too costly
       * to throw away either way, so it goes to the browser's downloads and
       * plays from memory; only the link back to it is lost.
       */
      download(`${name}.${made.extension}`, made.blob, made.blob.type)
      audio.adoptBlob(made.blob, `${name}.${made.extension}`)
      setRecordNote('Saved to your downloads. Attach it to link the project to the file.')
    } catch {
      download(`${name}.${made.extension}`, made.blob, made.blob.type)
      audio.adoptBlob(made.blob, `${name}.${made.extension}`)
      setRecordNote('Could not write that file, so it went to your downloads instead.')
    }
  }

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

    /*
     * The recording is stamped only here, when the teacher moves on — never
     * from the media element's own progress events, which fire several times a
     * second and would flood the reducer and the autosave with them.
     *
     * Moving forward records where the word being moved *to* begins, because
     * the tap lands as that word is being said. Moving back seeks to the word
     * being returned to, which is the whole point of keeping the times.
     */
    if (plan.move !== null) {
      const target = words[plan.move]
      const now = audio.at()
      const forward = plan.move > index

      if (forward && now !== null && audio.playing) {
        dispatch({ type: 'setAudioTime', wordId: target.id, studentId, seconds: now })
      } else if (!forward) {
        const mark = test.audioTimes?.[target.id]?.[studentId]
        if (mark !== undefined) {
          audio.seek(mark)
          audio.play()
        }
      }
      focusWord(plan.move)
    }
  }

  /*
   * The first word is stamped when playback starts rather than on a Tab,
   * because the teacher is already sitting on it when they press play — every
   * other word is stamped by the keystroke that arrives at it.
   */
  const onPlaybackStart = () => {
    audio.onPlay()
    const first = words[0]
    const now = audio.at()
    if (first && now !== null && test.audioTimes?.[first.id]?.[studentId] === undefined) {
      dispatch({ type: 'setAudioTime', wordId: first.id, studentId, seconds: now })
    }
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

          <AudioBar
            audio={audio}
            picker={filePicker}
            onPick={(file) => audio.attachFile(file)}
            recorder={recorder}
            note={recordNote}
            onRecord={() => {
              setRecordNote(null)
              void recorder.start()
            }}
            onStopRecording={() => void stopRecording()}
            onPlayStart={onPlaybackStart}
            onClearTimes={() => dispatch({ type: 'clearAudioTimes', studentId })}
          />

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

const STATUS_TEXT: Record<string, string> = {
  none: 'No recording attached',
  ready: 'Recording attached',
  reconnect: 'Click to reconnect the recording',
  missing: 'That recording is no longer where it was',
  different: 'This is not the file the times were made against',
  unsupported: 'This browser cannot play that file — try .m4a or .mp3',
}

function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Playing a recording while marking.
 *
 * The media element is a `<video>` rather than an `<audio>`: a teacher records
 * on a phone and gets a `.mov`, which `<audio>` will not decode even though
 * there is nothing to watch. It is kept at zero size and driven entirely by
 * these buttons.
 */
function AudioBar({
  audio,
  picker,
  recorder,
  note,
  onPick,
  onRecord,
  onStopRecording,
  onPlayStart,
  onClearTimes,
}: {
  audio: ReturnType<typeof useReadingAudio>
  picker: React.RefObject<HTMLInputElement>
  recorder: ReturnType<typeof useRecorder>
  note: string | null
  onPick: (file: File) => void
  onRecord: () => void
  onStopRecording: () => void
  onPlayStart: () => void
  onClearTimes: () => void
}) {
  const [now, setNow] = useState(0)
  const recording = recorder.state === 'recording'

  return (
    <div className="group no-print audiobar">
      {/* Zero-sized on purpose: audio-only files play through it just the same. */}
      <video
        ref={audio.ref}
        playsInline
        style={{ width: 0, height: 0, position: 'absolute' }}
        onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
        onLoadedMetadata={audio.onLoadedMetadata}
        onPlay={onPlayStart}
        onPause={audio.onPause}
      />

      {recorder.canRecord &&
        (recording ? (
          <>
            <button className="btn danger" onClick={onStopRecording}>
              ■ Stop and save
            </button>
            <span className="recording-dot" aria-live="polite">
              ● Recording {clock(recorder.elapsed)}
            </span>
            <button className="btn" onClick={recorder.cancel} title="Throw this recording away">
              Discard
            </button>
          </>
        ) : (
          <button className="btn" onClick={onRecord} disabled={recorder.state === 'saving'}>
            {recorder.state === 'saving' ? 'Saving…' : '● Record'}
          </button>
        ))}

      {!recording && (
        <button
          className="btn"
          onClick={() => (audio.canPick ? void audio.attach() : picker.current?.click())}
        >
          {audio.status === 'none' ? 'Attach recording' : 'Change recording'}
        </button>
      )}
      <input
        ref={picker}
        type="file"
        accept="audio/*,video/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onPick(file)
          e.target.value = ''
        }}
      />

      {audio.status !== 'none' && !recording && (
        <>
          <button className="btn" onClick={audio.toggle} title="Play or pause">
            {audio.playing ? '❚❚' : '▶'}
          </button>
          <button
            className="btn"
            onClick={() => audio.seek(Math.max(0, now - 5 + 0.6))}
            title="Back five seconds"
          >
            ↺ 5s
          </button>
          <label className="check">
            Speed
            <select value={audio.rate} onChange={(e) => audio.setRate(Number(e.target.value))}>
              {[0.5, 0.75, 1, 1.25, 1.5].map((r) => (
                <option key={r} value={r}>
                  {r}×
                </option>
              ))}
            </select>
          </label>
          <span className="keyword">{clock(now)}</span>
        </>
      )}

      {/* While recording, the pulsing indicator is the status; anything else
          here would contradict it. */}
      <span
        className={`keyword audiostatus ${audio.status === 'ready' && !note ? '' : 'warn'}`}
        title={audio.name ?? undefined}
      >
        {recording
          ? ''
          : recorder.state === 'denied'
          ? 'The microphone was not allowed'
            : recorder.state === 'unsupported'
              ? 'This browser cannot record'
              : (note ??
                (audio.name && audio.status === 'ready' ? audio.name : STATUS_TEXT[audio.status]))}
      </span>

      {audio.status === 'different' && (
        <button className="btn danger" onClick={onClearTimes}>
          Clear the old times
        </button>
      )}
    </div>
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
