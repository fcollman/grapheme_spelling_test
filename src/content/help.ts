import { marked } from 'marked'
// Vite inlines all of this at build time — the markdown as text, the screenshots
// as data URIs — so the page still makes no network request. The single-file
// guarantee depends on that.
import aboutMarkdown from '../../content/about.md?raw'

const guideSources = import.meta.glob('../../content/help/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const imageSources = import.meta.glob('../../content/help/images/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>

/** Screenshots by bare filename, which is how the markdown refers to them. */
const images = new Map(
  Object.entries(imageSources).map(([path, url]) => [path.split('/').pop() ?? path, url]),
)

export interface HelpSection {
  id: string
  title: string
  html: string
}

/**
 * Rewrites `![caption](images/thing.png)` to the inlined copy.
 *
 * A reference with no matching file is dropped rather than left alone. Leaving
 * it would emit `<img src="images/thing.png">` into the bundle — a request the
 * page cannot make from file://, and an external reference that the single-file
 * check would (rightly) fail the build over. Dropping it means a guide page with
 * a typo in an image name loses a picture instead of breaking the build.
 */
export function inlineImages(markdown: string, resolve = (file: string) => images.get(file)): string {
  return markdown.replace(/!\[([^\]]*)\]\(images\/([^)\s]+)\)/g, (_match, alt: string, file: string) => {
    const url = resolve(file)
    return url ? `![${alt}](${url})` : ''
  })
}

/**
 * Turns a paragraph holding nothing but an image into a captioned figure, so the
 * alt text does double duty as the caption under the screenshot.
 */
export function captionImages(html: string): string {
  return html.replace(/<p>(<img\b[^>]*>)<\/p>/g, (_match, img: string) => {
    const alt = /alt="([^"]*)"/.exec(img)?.[1] ?? ''
    return `<figure>${img}${alt ? `<figcaption>${alt}</figcaption>` : ''}</figure>`
  })
}

/**
 * The markdown is repository content compiled in at build time, never anything a
 * user of the page supplies, so rendering it as HTML introduces no injection
 * path — a project file someone opens cannot reach this.
 */
function render(markdown: string): string {
  return captionImages(
    marked.parse(inlineImages(markdown), { async: false, gfm: true, breaks: false }) as string,
  )
}

/** The first heading doubles as the label in the sidebar. */
function titleOf(markdown: string, fallback: string): string {
  return /^#\s+(.+)$/m.exec(markdown)?.[1].trim() ?? fallback
}

/** `../../content/help/03-student-profile.md` → `student-profile` */
function idOf(path: string): string {
  return (path.split('/').pop() ?? path).replace(/\.md$/, '').replace(/^\d+[-_]/, '')
}

const guide: HelpSection[] = Object.keys(guideSources)
  // Numeric filename prefixes set the reading order, and never appear in the UI.
  .sort()
  .map((path) => {
    const markdown = guideSources[path]
    return { id: idOf(path), title: titleOf(markdown, idOf(path)), html: render(markdown) }
  })

const about: HelpSection = {
  id: 'about',
  title: titleOf(aboutMarkdown, 'About this tool'),
  html: render(aboutMarkdown),
}

/** The guide in order, then About — which is reference rather than instruction. */
export const HELP_SECTIONS: HelpSection[] = [...guide, about]

/** Where the "About" entry starts, so the sidebar can label the two runs apart. */
export const GUIDE_LENGTH = guide.length
