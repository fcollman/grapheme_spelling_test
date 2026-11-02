import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fractionOf,
  markNear,
  normalizePeaks,
  placeLabels,
  timeAt,
  type WordMark,
} from '../state/waveform'
import { NUDGE_SECONDS } from '../pages/readingKeys'

/**
 * The recording, drawn, with the passage's words marked along it.
 *
 * Marking a reading means returning to one word again and again, and a bare
 * transport gives nothing to aim at — you scrub, overshoot, and scrub back. Drawn
 * out, the silences between sentences become landmarks, and the words the
 * teacher has already stepped through become targets they can click straight
 * back to.
 *
 * Nothing here re-renders while the audio plays: the playhead is moved by
 * writing a transform on one element, because the passage behind this bar can
 * be three hundred controlled inputs and must not be touched sixty times a
 * second.
 */

/** Click tolerance for landing on a word rather than scrubbing, in pixels. */
const MARK_HIT_PX = 6

const HEIGHT = 64

/** Kept in step with `.wave-label` in the stylesheet, which is what is measured. */
const LABEL_PX = 11

/*
 * One offscreen context, used for nothing but measuring labels. How many words
 * fit on the bar depends on how wide they are, and counting characters thins
 * the wrong ones — "illuminated" and "it" are not the same size.
 */
let ruler: CanvasRenderingContext2D | null | undefined

function textWidth(text: string): number {
  if (ruler === undefined) {
    ruler = document.createElement('canvas').getContext('2d')
    if (ruler) ruler.font = `${LABEL_PX}px ${getComputedStyle(document.body).fontFamily}`
  }
  return ruler ? ruler.measureText(text).width : text.length * LABEL_PX * 0.6
}

export function Waveform({
  peaks,
  duration,
  marks,
  decoding,
  at,
  onScrub,
  onPickWord,
  onNudge,
  onToggle,
}: {
  peaks: Float32Array | null
  duration: number
  marks: WordMark[]
  decoding: boolean
  at: () => number | null
  onScrub: (seconds: number) => void
  onPickWord: (mark: WordMark) => void
  onNudge: (delta: number) => void
  onToggle: () => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const headRef = useRef<HTMLSpanElement>(null)

  /*
   * The one measurement this component keeps in state, because which labels fit
   * is a layout question and has to be answered before the labels are rendered.
   * Everything else that depends on the width is drawn imperatively.
   */
  const [width, setWidth] = useState(0)

  /*
   * Scaled for drawing only, leaving the measured peaks alone. Speech recorded
   * on a phone peaks far below full scale, and drawn literally it is a flat
   * line with none of the landmarks this bar exists to provide.
   */
  const shown = useMemo(() => (peaks ? normalizePeaks(peaks) : null), [peaks])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const box = boxRef.current
    if (!canvas || !box) return
    const width = box.clientWidth
    if (width === 0) return
    setWidth(width)
    /*
     * Backing store in device pixels, CSS box in layout pixels. Without this the
     * trace is soft on every laptop screen made in the last decade.
     */
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(HEIGHT * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${HEIGHT}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, HEIGHT)

    const ink = getComputedStyle(canvas).getPropertyValue('--wave-ink').trim() || '#2f5aa8'
    ctx.fillStyle = ink
    const mid = HEIGHT / 2

    // No peaks: a bare line, so the bar is still a timeline that can be
    // clicked and still carries the word marks.
    if (!shown || shown.length === 0) {
      ctx.globalAlpha = 0.35
      ctx.fillRect(0, mid - 0.5, width, 1)
      ctx.globalAlpha = 1
      return
    }

    for (let x = 0; x < width; x++) {
      const bucket = Math.min(shown.length - 1, Math.floor((x * shown.length) / width))
      // A floor of half a pixel, so silence reads as a line rather than a gap
      // and the bar never looks like it failed to load.
      const amp = Math.max(0.5, shown[bucket] * (mid - 2))
      ctx.fillRect(x, mid - amp, 1, amp * 2)
    }
  }, [shown])

  useEffect(() => {
    draw()
    const box = boxRef.current
    if (!box || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(draw)
    observer.observe(box)
    return () => observer.disconnect()
  }, [draw])

  /*
   * The playhead, moved outside React entirely. An animation frame loop is used
   * rather than the element's own `timeupdate`, which fires about four times a
   * second and makes the head visibly hop.
   */
  useEffect(() => {
    let frame = 0
    const tick = () => {
      const head = headRef.current
      const box = boxRef.current
      if (head && box) {
        const now = at()
        if (now !== null && duration > 0) {
          head.style.transform = `translateX(${fractionOf(now, duration) * box.clientWidth}px)`
          head.style.visibility = 'visible'
        } else {
          head.style.visibility = 'hidden'
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [at, duration])

  /*
   * Which words get their names printed above the bar. Without them the marks
   * are a row of identical ticks and finding one means hovering along the bar
   * reading tooltips, which is the scrubbing this was meant to replace.
   */
  const labels = useMemo(
    () => placeLabels(marks, duration, width, textWidth),
    [marks, duration, width],
  )

  const secondsAtEvent = (clientX: number): { seconds: number; tolerance: number } | null => {
    const box = boxRef.current
    if (!box || duration <= 0) return null
    const rect = box.getBoundingClientRect()
    if (rect.width === 0) return null
    const fraction = (clientX - rect.left) / rect.width
    return {
      seconds: timeAt(fraction, duration),
      tolerance: (MARK_HIT_PX / rect.width) * duration,
    }
  }

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const hit = secondsAtEvent(e.clientX)
    if (!hit) return
    const mark = markNear(marks, hit.seconds, hit.tolerance)
    if (mark) onPickWord(mark)
    else onScrub(hit.seconds)
  }

  /*
   * The hovered word, written straight onto the element's tooltip. Through
   * state this would re-render the bar on every mouse move.
   */
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const box = boxRef.current
    const hit = secondsAtEvent(e.clientX)
    if (!box || !hit) return
    const mark = markNear(marks, hit.seconds, hit.tolerance)
    box.title = mark ? `${mark.text} — ${clock(mark.seconds)}` : clock(hit.seconds)
  }

  /*
   * Inside the bar the bare arrow keys are free — it is not a text box — so
   * they step the audio without the modifier the passage needs. Space plays and
   * pauses here as it does in the passage, so clicking the bar to find a place
   * does not quietly change what the keyboard does.
   */
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') onNudge(-NUDGE_SECONDS)
    else if (e.key === 'ArrowRight') onNudge(NUDGE_SECONDS)
    else if (e.key === 'Home') onScrub(0)
    else if (e.key === ' ') onToggle()
    else return
    e.preventDefault()
  }

  return (
    <div className="wave no-print">
      <div
        ref={boxRef}
        className="wave-box"
        role="group"
        aria-label="Recording. Click to move, arrow keys to step, space to play."
        tabIndex={0}
        onClick={onClick}
        onMouseMove={onMove}
        onKeyDown={onKeyDown}
      >
        <canvas ref={canvasRef} className="wave-canvas" />
        {duration > 0 &&
          marks.map((m) => (
            <span
              key={m.id}
              className="wave-mark"
              style={{ left: `${fractionOf(m.seconds, duration) * 100}%` }}
            />
          ))}
        {labels.map((l) => (
          <span key={l.id} className="wave-label" style={{ left: `${l.left}px` }}>
            {l.text}
          </span>
        ))}
        <span ref={headRef} className="wave-head" />
        {decoding && <span className="wave-note">Reading the recording…</span>}
      </div>
    </div>
  )
}

function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}
