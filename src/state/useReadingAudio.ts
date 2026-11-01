import { useCallback, useEffect, useRef, useState } from 'react'
import {
  hasPermission,
  pickAudioFile,
  rememberHandle,
  recallHandle,
  requestWritePermission,
  stampOf,
} from './fileAccess'
import type { AudioMeta } from './types'

/**
 * A recording to mark against, played from the teacher's own computer.
 *
 * Nothing is uploaded and nothing is stored. The file is read through an object
 * URL, which the browser resolves locally, so the page still makes no network
 * request of any kind — and the recording never enters the project file, which
 * is serialised into localStorage on a timer that fails silently once it runs
 * out of room. What is kept is a pointer to where the file lives, in the same
 * handle store the project file already uses.
 *
 * There is no automatic transcription and there is not going to be one here.
 * The smallest speech model worth having is twice the size of this whole
 * application, and the browser's own speech recognition uploads the audio —
 * which would make a liar of the promise on the About page.
 */

export type AudioStatus =
  | 'none' // nothing attached
  | 'ready'
  | 'reconnect' // a file is remembered, but the browser wants permission again
  | 'missing' // remembered, but no longer where it was
  | 'different' // a file is playing, but not the one the times were made against
  | 'unsupported' // the browser cannot decode it

export interface ReadingAudio {
  status: AudioStatus
  name: string | null
  /** Seconds, or null when nothing is loaded. */
  at: () => number | null
  seek: (seconds: number) => void
  play: () => void
  playing: boolean
  toggle: () => void
  /*
   * Wired to the element as React props rather than listeners attached in an
   * effect: the element does not exist while the passage is still being pasted,
   * so a mount effect would find nothing to listen to and never run again.
   */
  onPlay: () => void
  onPause: () => void
  rate: number
  setRate: (r: number) => void
  attach: () => Promise<void>
  /** For browsers without a file picker, fed from an `<input type="file">`. */
  attachFile: (file: File) => void
  detach: () => void
  /** The element the page renders; audio-only files play through it too. */
  ref: React.RefObject<HTMLVideoElement>
  /** True when the file picker is available, so the page can offer the fallback. */
  canPick: boolean
}

/** How far before a stored time to drop the needle. */
const SEEK_LEAD = 0.6

export function useReadingAudio(
  testId: string,
  studentId: string,
  storedMeta: AudioMeta | undefined,
  onAttached: (meta: AudioMeta) => void,
): ReadingAudio {
  const ref = useRef<HTMLVideoElement>(null)
  const urlRef = useRef<string | null>(null)
  const [status, setStatus] = useState<AudioStatus>('none')
  const [name, setName] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [rate, setRateState] = useState(1)

  const key = `audio:${testId}:${studentId}` as const

  const load = useCallback(
    (file: File, remembered: AudioMeta | undefined) => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      const url = URL.createObjectURL(file)
      urlRef.current = url
      setName(file.name)

      const el = ref.current
      if (el && file.type && el.canPlayType(file.type) === '') {
        setStatus('unsupported')
        return
      }
      if (el) el.src = url

      const stamp = stampOf(file)
      /*
       * A different file is not an error, but the times were measured against
       * the old one and will not line up. Saying so beats silently seeking to
       * the wrong place in a recording the teacher is trying to trust.
       */
      const differs =
        remembered !== undefined &&
        (remembered.size !== stamp.size || remembered.lastModified !== stamp.lastModified)
      setStatus(differs ? 'different' : 'ready')
    },
    [],
  )

  // Reconnect whatever was attached last time, without prompting: queryPermission
  // never asks, so this is safe to run on mount.
  useEffect(() => {
    let cancelled = false
    setStatus('none')
    setName(null)
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
    if (ref.current) ref.current.removeAttribute('src')

    async function restore() {
      const handle = (await recallHandle(key)) as FileSystemFileHandle | null
      if (!handle || cancelled) return
      setName(storedMeta?.name ?? null)
      if (!(await hasPermission(handle, 'read'))) {
        if (!cancelled) setStatus('reconnect')
        return
      }
      try {
        const file = await handle.getFile()
        if (!cancelled) load(file, storedMeta)
      } catch {
        if (!cancelled) setStatus('missing')
      }
    }
    restore()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    [],
  )

  const attach = useCallback(async () => {
    const handle = await pickAudioFile()
    if (!handle) {
      // Either cancelled, or a browser without the picker; the page offers an
      // ordinary file input in that case.
      const stored = (await recallHandle(key)) as FileSystemFileHandle | null
      if (stored && !(await hasPermission(stored, 'read'))) {
        // The click we are inside is the gesture the prompt needs.
        if (await requestWritePermission(stored, 'read')) {
          try {
            load(await stored.getFile(), storedMeta)
          } catch {
            setStatus('missing')
          }
        }
      }
      return
    }
    await rememberHandle(key, handle)
    const file = await handle.getFile()
    load(file, undefined)
    onAttached({ name: file.name, ...stampOf(file) })
  }, [key, load, onAttached, storedMeta])

  const attachFile = useCallback(
    (file: File) => {
      load(file, undefined)
      onAttached({ name: file.name, ...stampOf(file) })
    },
    [load, onAttached],
  )

  const detach = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
    if (ref.current) ref.current.removeAttribute('src')
    setStatus('none')
    setName(null)
  }, [])

  const at = useCallback(() => {
    const el = ref.current
    return el && urlRef.current ? el.currentTime : null
  }, [])

  const seek = useCallback((seconds: number) => {
    const el = ref.current
    if (!el || !urlRef.current) return
    // The teacher taps a moment after the word starts, so landing exactly on
    // the stored time clips its beginning. The lead is applied here rather than
    // when recording, which keeps the stored data honest.
    el.currentTime = Math.max(0, seconds - SEEK_LEAD)
  }, [])

  const play = useCallback(() => {
    void ref.current?.play().catch(() => undefined)
  }, [])

  const toggle = useCallback(() => {
    const el = ref.current
    if (!el || !urlRef.current) return
    if (el.paused) void el.play().catch(() => undefined)
    else el.pause()
  }, [])

  const setRate = useCallback((r: number) => {
    setRateState(r)
    if (ref.current) ref.current.playbackRate = r
  }, [])

  return {
    status,
    name,
    at,
    seek,
    play,
    playing,
    toggle,
    onPlay: useCallback(() => setPlaying(true), []),
    onPause: useCallback(() => setPlaying(false), []),
    rate,
    setRate,
    attach,
    attachFile,
    detach,
    ref,
    canPick: typeof window !== 'undefined' && !!window.showOpenFilePicker,
  }
}
