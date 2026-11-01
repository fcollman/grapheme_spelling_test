import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Recording a student reading, in the page.
 *
 * The microphone stream never leaves the machine: `MediaRecorder` hands back
 * chunks in memory, the page writes them to a file the teacher chooses, and
 * that is the end of it. No part of this makes a network request, which is what
 * lets the recording live under the same promise as everything else here.
 *
 * It exists because the alternative is worse. A teacher records on her phone,
 * mails the file to herself, finds it in Downloads and attaches it — four
 * chances to lose a recording of a child, and a copy of that child's voice in
 * her mail account on the way.
 */

export type RecorderState = 'idle' | 'recording' | 'saving' | 'denied' | 'unsupported'

export interface Recorder {
  state: RecorderState
  /** Seconds elapsed, for the indicator. */
  elapsed: number
  start: () => Promise<void>
  /** Resolves with what was recorded, or null if nothing usable came back. */
  stop: () => Promise<{ blob: Blob; extension: string } | null>
  cancel: () => void
  canRecord: boolean
}

/** Ordered by preference; the first the browser admits to is used. */
const FORMATS: Array<{ mime: string; extension: string }> = [
  { mime: 'audio/webm;codecs=opus', extension: 'webm' },
  { mime: 'audio/webm', extension: 'webm' },
  { mime: 'audio/mp4', extension: 'm4a' },
  { mime: 'audio/ogg;codecs=opus', extension: 'ogg' },
]

function chooseFormat(): { mime: string; extension: string } | null {
  if (typeof MediaRecorder === 'undefined') return null
  for (const f of FORMATS) {
    if (MediaRecorder.isTypeSupported(f.mime)) return f
  }
  // Some builds support recording but admit to no type; let the browser decide.
  return { mime: '', extension: 'webm' }
}

export function useRecorder(): Recorder {
  const [state, setState] = useState<RecorderState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const formatRef = useRef<{ mime: string; extension: string } | null>(null)

  const canRecord =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'

  /**
   * Letting go of the microphone the moment recording stops.
   *
   * An open stream leaves the browser's recording indicator lit, which in a
   * classroom reads as "this page is still listening". It must never be left on
   * by accident, so every exit from recording comes through here.
   */
  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    recorderRef.current = null
  }, [])

  useEffect(() => release, [release])

  useEffect(() => {
    if (state !== 'recording') return
    const started = Date.now()
    setElapsed(0)
    const timer = setInterval(() => setElapsed((Date.now() - started) / 1000), 250)
    return () => clearInterval(timer)
  }, [state])

  const start = useCallback(async () => {
    if (!canRecord) {
      setState('unsupported')
      return
    }
    const format = chooseFormat()
    if (!format) {
      setState('unsupported')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      formatRef.current = format
      chunksRef.current = []

      const recorder = new MediaRecorder(stream, format.mime ? { mimeType: format.mime } : undefined)
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorderRef.current = recorder
      // A timeslice means a long reading is not held as one growing buffer, and
      // a crash loses a second rather than the lot.
      recorder.start(1000)
      setState('recording')
    } catch {
      release()
      setState('denied')
    }
  }, [canRecord, release])

  const stop = useCallback(async () => {
    const recorder = recorderRef.current
    const format = formatRef.current
    if (!recorder || recorder.state === 'inactive') {
      release()
      setState('idle')
      return null
    }
    setState('saving')

    const done = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve()
    })
    recorder.stop()
    await done
    release()

    const chunks = chunksRef.current
    chunksRef.current = []
    if (chunks.length === 0) {
      setState('idle')
      return null
    }
    const blob = new Blob(chunks, { type: format?.mime || 'audio/webm' })
    setState('idle')
    return { blob, extension: format?.extension ?? 'webm' }
  }, [release])

  const cancel = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null
      recorder.stop()
    }
    chunksRef.current = []
    release()
    setState('idle')
  }, [release])

  return { state, elapsed, start, stop, cancel, canRecord }
}
