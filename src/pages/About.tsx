import { useMemo } from 'react'
import { marked } from 'marked'
// Vite inlines the file contents at build time, so the page still makes no
// network request — the single-file guarantee depends on that.
import aboutMarkdown from '../../content/about.md?raw'

/**
 * The About page, written as Markdown in content/about.md.
 *
 * Kept as a Markdown file so it can be edited and committed without touching
 * any code; pushing to main rebuilds and republishes it.
 *
 * The Markdown is repository content compiled in at build time, never anything
 * a user of the page supplies, so rendering it as HTML introduces no injection
 * path — a project file someone opens cannot reach this.
 */
export function About() {
  const html = useMemo(
    () => marked.parse(aboutMarkdown, { async: false, gfm: true, breaks: false }) as string,
    [],
  )

  return (
    <section className="panel">
      <article className="prose" dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  )
}
