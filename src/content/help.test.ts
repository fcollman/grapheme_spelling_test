import { describe, expect, it } from 'vitest'
import { captionImages, inlineImages } from './help'

/**
 * The guide's pictures are the one place the single-file build could spring a
 * leak: a reference the bundler does not resolve would become a real
 * `<img src="images/…">` in dist/index.html, which cannot load from file://.
 */
describe('guide images', () => {
  const resolve = (file: string) => (file === 'known.webp' ? 'data:image/webp;base64,AAA' : undefined)

  it('rewrites a reference to the inlined copy', () => {
    expect(inlineImages('![The toolbar](images/known.webp)', resolve)).toBe(
      '![The toolbar](data:image/webp;base64,AAA)',
    )
  })

  it('drops a reference with no matching file rather than leaving it', () => {
    expect(inlineImages('before\n\n![Gone](images/missing.webp)\n\nafter', resolve)).toBe(
      'before\n\n\n\nafter',
    )
  })

  it('leaves ordinary links and text alone', () => {
    const md = 'See [the rules](PHONEME-CATEGORIES.md) and `images/known.webp`.'
    expect(inlineImages(md, resolve)).toBe(md)
  })

  it('turns a lone image into a captioned figure', () => {
    expect(captionImages('<p><img src="data:x" alt="The toolbar"></p>')).toBe(
      '<figure><img src="data:x" alt="The toolbar"><figcaption>The toolbar</figcaption></figure>',
    )
  })

  it('leaves an image with text around it as a paragraph', () => {
    const html = '<p>look: <img src="data:x" alt="a"></p>'
    expect(captionImages(html)).toBe(html)
  })
})
