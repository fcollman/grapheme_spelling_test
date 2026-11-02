import { useCallback, useEffect, useRef, useState } from 'react'
import { isDeadAir, isLive, meterScale, peakOf } from './levels'

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
 *
 * Half of this file is about proving sound is arriving. The first real
 * recording made with it was four seconds of perfectly-formed digital silence,
 * because the browser had picked a virtual audio device instead of the
 * microphone. Everything downstream reported success. A recording of a child
 * reading cannot be made twice, so this must fail loudly and immediately or it
 * is worse than not existing.
 */

export type RecorderState = 'idle' | 'recording' | 'saving' | 'denied' | 'unsupported'

export interface Recorder {
  state: RecorderState
  /** Seconds elapsed, for the indicator. */
  elapsed: number
  /** True once the input has been silent long enough to be a fault, not a pause. */
  deadAir: boolean
  /**
   * Attach to the meter's fill. Driven by writing `transform` directly rather
   * than through state: the meter wants ten updates a second and the passage
   * behind it can be three hundred inputs, which must not re-render for it.
   */
  meterRef: React.RefObject<HTMLDivElement>
  /** Microphones to choose between; empty until the browser reveals labels. */
  devices: MediaDeviceInfo[]
  deviceId: string | null
  setDeviceId: (id: string | null) => void
  start: () => Promise<void>
  /** Resolves with what was recorded, or null if nothing usable came back. */
  stop: () => Promise<{ blob: Blob; extension: string; silent: boolean } | null>
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

/**
 * The chosen microphone, remembered across sessions.
 *
 * In localStorage rather than the project file: a device id belongs to this
 * computer, and carrying one into a project that travels to another machine
 * would point at a microphone that does not exist there.
 */
const DEVICE_KEY = 'graphemespellingtest.audioinput.v1'

function rememberedDevice(): string | null {
  try {
    return localStorage.getItem(DEVICE_KEY)
  } catch {
    return null
  }
}

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
  const [deadAir, setDeadAir] = useState(false)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceIdState] = useState<string | null>(rememberedDevice)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const formatRef = useRef<{ mime: string; extension: string } | null>(null)
  const meterRef = useRef<HTMLDivElement>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const monitorRef = useRef<number | null>(null)
  const liveRef = useRef(false)

  const canRecord =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'

  const setDeviceId = useCallback((id: string | null) => {
    setDeviceIdState(id)
    try {
      if (id) localStorage.setItem(DEVICE_KEY, id)
      else localStorage.removeItem(DEVICE_KEY)
    } catch {
      // Private browsing; the choice simply will not be remembered.
    }
  }, [])

  /**
   * Which microphones there are to choose from.
   *
   * Labels are blank until the browser has granted microphone access once, and
   * a list of "Microphone 1, Microphone 2" helps nobody — so an unlabelled list
   * is treated as no list, and the picker stays hidden until after the first
   * recording. Refreshed after every grant, which is when labels appear.
   */
  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      const inputs = all.filter((d) => d.kind === 'audioinput' && d.label !== '')
      setDevices(inputs)
    } catch {
      setDevices([])
    }
  }, [])

  useEffect(() => {
    void refreshDevices()
  }, [refreshDevices])

  /**
   * Letting go of the microphone the moment recording stops.
   *
   * An open stream leaves the browser's recording indicator lit, which in a
   * classroom reads as "this page is still listening". It must never be left on
   * by accident, so every exit from recording comes through here.
   */
  const release = useCallback(() => {
    if (monitorRef.current !== null) {
      clearInterval(monitorRef.current)
      monitorRef.current = null
    }
    void contextRef.current?.close().catch(() => undefined)
    contextRef.current = null
    if (meterRef.current) meterRef.current.style.transform = 'scaleX(0)'
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    recorderRef.current = null
  }, [])

  useEffect(() => release, [release])

  /**
   * Watching the level while it records.
   *
   * Runs on an interval rather than animation frames so it keeps checking when
   * the tab is in the background — a teacher switching windows mid-reading must
   * not be the reason a dead microphone goes unnoticed.
   */
  const monitor = useCallback((stream: MediaStream) => {
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    const context = new Ctor()
    contextRef.current = context
    const analyser = context.createAnalyser()
    analyser.fftSize = 1024
    context.createMediaStreamSource(stream).connect(analyser)
    // Deliberately not connected to the destination: monitoring a microphone
    // through the laptop speakers is a feedback loop.
    const samples = new Float32Array(analyser.fftSize)

    monitorRef.current = window.setInterval(() => {
      analyser.getFloatTimeDomainData(samples)
      const peak = peakOf(samples)
      if (isLive(peak)) liveRef.current = true
      const el = meterRef.current
      if (el) el.style.transform = `scaleX(${meterScale(peak)})`
    }, 100)
  }, [])

  useEffect(() => {
    if (state !== 'recording') return
    const started = Date.now()
    setElapsed(0)
    const timer = setInterval(() => {
      const seconds = (Date.now() - started) / 1000
      setElapsed(seconds)
      // One-way, so a pause between sentences cannot make the warning flicker.
      if (isDeadAir(seconds, liveRef.current)) setDeadAir(true)
    }, 250)
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
      /*
       * `exact` so a remembered microphone that has been unplugged fails here
       * and is cleared, rather than silently falling back to whichever device
       * the browser prefers — which is the fault this is all guarding against.
       */
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        })
      } catch (e) {
        if (!deviceId || (e as DOMException)?.name === 'NotAllowedError') throw e
        setDeviceId(null)
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      }
      streamRef.current = stream
      formatRef.current = format
      chunksRef.current = []
      liveRef.current = false
      setDeadAir(false)

      const recorder = new MediaRecorder(stream, format.mime ? { mimeType: format.mime } : undefined)
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorderRef.current = recorder
      // A timeslice means a long reading is not held as one growing buffer, and
      // a crash loses a second rather than the lot.
      recorder.start(1000)
      monitor(stream)
      setState('recording')
      void refreshDevices()
    } catch {
      release()
      setState('denied')
    }
  }, [canRecord, deviceId, monitor, refreshDevices, release, setDeviceId])

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
    const silent = !liveRef.current
    release()
    // Hand over to the saved-recording message, which says what to do about it.
    setDeadAir(false)

    const chunks = chunksRef.current
    chunksRef.current = []
    if (chunks.length === 0) {
      setState('idle')
      return null
    }
    const blob = new Blob(chunks, { type: format?.mime || 'audio/webm' })
    setState('idle')
    return { blob, extension: format?.extension ?? 'webm', silent }
  }, [release])

  const cancel = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null
      recorder.stop()
    }
    chunksRef.current = []
    release()
    setDeadAir(false)
    setState('idle')
  }, [release])

  return {
    state,
    elapsed,
    deadAir,
    meterRef,
    devices,
    deviceId,
    setDeviceId,
    start,
    stop,
    cancel,
    canRecord,
  }
}
