import { describe, expect, it } from 'vitest'
// @ts-expect-error — plain .mjs build script, no types needed for this check
import { findExternalReferences } from '../../scripts/check-single-file.mjs'

/**
 * The single-file check is the one gate standing between a change and a build
 * that silently stops working when opened from file://. It has to catch a real
 * external reference, and it has to stay quiet about markup-shaped strings
 * inside the inlined libraries.
 */
describe('single-file guard', () => {
  it('catches assets the browser would fetch', () => {
    expect(findExternalReferences('<script src="app.js"></script>')).toEqual(['app.js'])
    expect(findExternalReferences('<link rel="stylesheet" href="style.css">')).toEqual(['style.css'])
    expect(findExternalReferences('<img src="logo.png">')).toEqual(['logo.png'])
    expect(findExternalReferences("<script src='a.js'></script>")).toEqual(['a.js'])
  })

  it('accepts a page that inlines everything', () => {
    expect(findExternalReferences('<script type="module">const a = 1</script>')).toEqual([])
    expect(findExternalReferences('<style>body{color:red}</style>')).toEqual([])
    expect(findExternalReferences('<link rel="icon" href="data:image/svg+xml;base64,AAA">')).toEqual([])
    expect(findExternalReferences('<a href="https://example.com">a link is not a fetch</a>')).toEqual([])
  })

  it('ignores markup-shaped strings inside inlined code', () => {
    // Regression: marked builds anchors at runtime, and its minified source
    // contains this. Scanning script bodies failed the build over it.
    const page = '<script>function f(u){return `<a href="${u}">x</a>`}</script>'
    expect(findExternalReferences(page)).toEqual([])

    const withImg = '<script>const t = \'<img src="\' + url + \'">\'</script>'
    expect(findExternalReferences(withImg)).toEqual([])
  })

  it('still catches a real reference in a page that also inlines code', () => {
    const page = '<script>const s = `<img src="${x}">`</script><script src="leaked.js"></script>'
    expect(findExternalReferences(page)).toEqual(['leaked.js'])
  })
})
