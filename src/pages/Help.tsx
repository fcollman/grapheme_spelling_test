import { useEffect, useRef, useState } from 'react'
import { GUIDE_LENGTH, HELP_SECTIONS } from '../content/help'
import { useDownloads } from '../components/DownloadProvider'
import { buildFileName } from '../state/filename'

/**
 * Help: a how-to guide plus the About page, both written as Markdown in
 * `content/` so they can be edited and committed without touching any code.
 *
 * Two ways through it, because teachers arrive in two different states. Someone
 * setting up for the first time reads it front to back with Next; someone stuck
 * on one report jumps straight to that section from the list on the left.
 */
export function Help() {
  const { requestPrint } = useDownloads()
  const [index, setIndex] = useState(0)
  const top = useRef<HTMLDivElement>(null)
  const section = HELP_SECTIONS[index]

  // A new page should start at its own beginning, not wherever the last one was
  // scrolled to — the guide pages are long enough for that to be disorienting.
  useEffect(() => {
    top.current?.scrollIntoView({ block: 'start' })
  }, [index])

  const previous = index > 0 ? HELP_SECTIONS[index - 1] : null
  const next = index < HELP_SECTIONS.length - 1 ? HELP_SECTIONS[index + 1] : null

  return (
    <section className="panel help">
      <div ref={top} className="help-anchor" />

      <aside className="help-nav no-print">
        <h3>How to use it</h3>
        <ol>
          {HELP_SECTIONS.slice(0, GUIDE_LENGTH).map((s, i) => (
            <li key={s.id}>
              <button aria-current={i === index} onClick={() => setIndex(i)}>
                {s.title}
              </button>
            </li>
          ))}
        </ol>

        <h3>Reference</h3>
        <ul>
          {HELP_SECTIONS.slice(GUIDE_LENGTH).map((s, i) => (
            <li key={s.id}>
              <button
                aria-current={GUIDE_LENGTH + i === index}
                onClick={() => setIndex(GUIDE_LENGTH + i)}
              >
                {s.title}
              </button>
            </li>
          ))}
        </ul>

        {/* The guide is the same for everyone, so no class name here. */}
        <button
          className="btn no-print"
          onClick={() => requestPrint(buildFileName(['Grapheme Spelling Test', section.title]))}
        >
          Print / Save PDF
        </button>
      </aside>

      <div className="help-body">
        <article className="prose" dangerouslySetInnerHTML={{ __html: section.html }} />

        <nav className="help-pager no-print">
          <button className="btn" disabled={!previous} onClick={() => setIndex(index - 1)}>
            {previous ? `← ${previous.title}` : '←'}
          </button>
          <span className="help-count">
            {index + 1} of {HELP_SECTIONS.length}
          </span>
          <button className="btn" disabled={!next} onClick={() => setIndex(index + 1)}>
            {next ? `${next.title} →` : '→'}
          </button>
        </nav>
      </div>
    </section>
  )
}
