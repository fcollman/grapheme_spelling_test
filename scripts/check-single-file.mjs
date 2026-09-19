import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Guards the property the whole project rests on: dist/ must be ONE file that
 * references nothing outside itself.
 *
 * Chrome blocks fetch, ES modules and JSON over file://, so the moment the build
 * emits a separate asset, opening index.html by double-click breaks — silently,
 * and only for the teacher, never on a dev server. This check makes that a build
 * failure instead.
 */

const DIST = 'dist'
const problems = []

let entries = []
try {
  entries = readdirSync(DIST)
} catch {
  problems.push(`No ${DIST}/ directory — run "npm run build" first.`)
}

if (entries.length > 0) {
  const extra = entries.filter((f) => f !== 'index.html')
  if (extra.length > 0) {
    problems.push(
      `${DIST}/ should contain only index.html, but also has: ${extra.join(', ')}. ` +
        'Something escaped inlining, so the page will not work from file://.',
    )
  }
}

if (entries.includes('index.html')) {
  const path = join(DIST, 'index.html')
  const html = readFileSync(path, 'utf8')

  // Any src/href that is not inline data is a request the browser will make.
  const external = [...html.matchAll(/<(?:script|link|img|iframe|source)\b[^>]*?\s(?:src|href)\s*=\s*"([^"]+)"/gi)]
    .map((m) => m[1])
    .filter((url) => !url.startsWith('data:') && !url.startsWith('#'))

  if (external.length > 0) {
    problems.push(`index.html references external files: ${[...new Set(external)].join(', ')}`)
  }

  const bytes = statSync(path).size
  const mb = (bytes / 1024 / 1024).toFixed(2)
  if (bytes > 20 * 1024 * 1024) {
    problems.push(`index.html is ${mb}MB, which is too large to hand to a teacher.`)
  }

  if (problems.length === 0) {
    console.log(`OK: dist/index.html is self-contained (${mb}MB, no external references).`)
  }
}

if (problems.length > 0) {
  console.error('Single-file check failed:\n' + problems.map((p) => `  - ${p}`).join('\n'))
  process.exit(1)
}
