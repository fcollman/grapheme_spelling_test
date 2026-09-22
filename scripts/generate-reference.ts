import { writeFileSync } from 'node:fs'
import { CATEGORIES, COLLAPSING_CATEGORIES, VOWEL_CATEGORY, type CategoryId } from '../src/data/categories'
import {
  CONSONANT_DIGRAPHS,
  CONSONANT_LE_EXAMPLES,
  MULTI_SOUND_GRAPHEMES,
  SPAN_PATTERNS,
  type DigraphSubtype,
} from '../src/data/patterns'
import { PHONEMES, display, get } from '../src/data/phonemes'
import { IRREGULAR } from '../src/data/irregular'

/**
 * Regenerates PHONEME-CATEGORIES.md from the data files, so the document a
 * teacher reviews can never drift from what the app actually does.
 *
 * Run with: npm run reference
 */

const lines: string[] = []
const w = (s = '') => lines.push(s)

const sound = (id: string) => display(id, 'sound')
const both = (id: string) => `${display(id, 'sound')} · ${display(id, 'ipa')}`
const sounds = (ids: string[]) => ids.map(sound).join(' + ')

w('# Phoneme and pattern categories')
w()
w('<!-- GENERATED FILE — do not edit by hand. -->')
w('<!-- Source: src/data/categories.ts and src/data/patterns.ts. Regenerate with: npm run reference -->')
w()
w('This is the complete record of how Grapheme Spelling Test classifies every sound and')
w('every multi-sound pattern. It is generated from the data the app actually uses,')
w('so what you read here is what the app does.')
w()
w('**To change something:** edit `src/data/categories.ts` (which category each vowel')
w('belongs to) or `src/data/patterns.ts` (digraph spellings and multi-sound')
w('patterns), then run `npm run reference`. The test suite checks every example word')
w('below against the real pronunciation engine, so a wrong entry fails the tests')
w('rather than quietly mis-tagging student work.')
w()
w('Jump to: [Categories](#categories) · [Every sound](#every-sound-and-its-category) ·')
w('[Consonant digraphs](#consonant-digraphs) · [Multi-sound patterns](#multi-sound-patterns) ·')
w('[Red words](#red-words) ·')
w('[Needs your review](#needs-your-review)')
w()

/* ---------------- categories ---------------- */

w('## Categories')
w()
w('Two different things get categorised, and the distinction matters:')
w()
w('- **Per sound** — applies to one sound in a word. Some depend on spelling: /sh/')
w('  in *ship* is a digraph; /k/ is a plain consonant in *cat* but a digraph in *duck*.')
w('- **Per run of sounds** — a separate layer, covering several sounds that are')
w('  taught as one unit. "-ank" in *bank* is /a/ + /ng/ + /k/: three sounds, one unit.')
w()
w('Tags overlap on purpose. In *thrunk*, the /ng/ and /k/ belong to both the "-unk"')
w('velar nasal unit and the "-nk" ending blend.')
w()
w('| Category | Applies to | One column? | What it covers |')
w('| --- | --- | --- | --- |')
for (const c of CATEGORIES) {
  const collapses = COLLAPSING_CATEGORIES.has(c.id)
    ? 'yes — marked as a chunk'
    : c.kind === 'span'
      ? 'no — tag across columns'
      : '—'
  w(`| **${c.label}** | ${c.kind === 'slot' ? 'one sound' : 'a run of sounds'} | ${collapses} | ${c.description} |`)
}
w()
w('### What becomes one column in the marking grid')
w()
w('The grid is marked per **spelling unit**, not per sound. A unit is normally one')
w('grapheme, but two things change that:')
w()
w('- A category marked "yes" above collapses into a single column, because it is')
w('  taught as a chunk rather than sounded out. Currently that is:')
w(`  **${[...COLLAPSING_CATEGORIES].map((id) => CATEGORIES.find((c) => c.id === id)!.label).join('** and **')}**.`)
w('- A single grapheme that makes more than one sound is one column carrying both')
w('  (see the next section).')
w()
w('Blends stay as separate columns with a tag across them, so you can still see')
w('which sound of a blend a student missed. To change what collapses, edit')
w('`COLLAPSING_CATEGORIES` in `src/data/categories.ts`.')
w()
w('**Not having a column does not mean not being reported.** A pattern that spans')
w('several columns still gets its own row in *Accuracy by grapheme* and *Grapheme')
w('confusion*, counted right only when every column it covers is right. So "dw" in')
w('*dwell* is marked as `d` and `w` separately in the grid, and also reported as one')
w('`dw` row under Beginning blend.')
w()

w('## One grapheme, several sounds')
w()
w('These letter teams make two sounds, so they appear as one column carrying both.')
w('Without them the grid would show a blank column for the first sound.')
w()
w('| Spelling | Sounds | Example | Note |')
w('| --- | --- | --- | --- |')
for (const m of MULTI_SOUND_GRAPHEMES) {
  w(`| \`${m.letters}\` | ${m.phonemes.map(sound).join(' + ')} | ${m.example} | ${m.note ?? ''} |`)
}
w()

/* ---------------- every phoneme ---------------- */

w('## Every sound and its category')
w()
w('All 45 sounds the app recognises. Consonants are listed as plain consonants here;')
w('any of them becomes a **consonant digraph** when spelled with a letter team, which')
w('is decided per word from the spelling (see the next section).')
w()

const vowelsByCategory = new Map<CategoryId, string[]>()
for (const p of PHONEMES) {
  if (p.features.kind !== 'vowel') continue
  const cat = VOWEL_CATEGORY[p.id]
  const list = vowelsByCategory.get(cat) ?? []
  list.push(p.id)
  vowelsByCategory.set(cat, list)
}

w('### Consonants')
w()
w('| Sound | IPA | As in |')
w('| --- | --- | --- |')
for (const p of PHONEMES) {
  if (p.features.kind !== 'consonant') continue
  w(`| ${sound(p.id)} | /${p.ipa}/ | ${p.example} |`)
}
w()
w('> Two consonants share the label /th/: the one in **thin** (unvoiced) and the one')
w('> in **this** (voiced). The app keeps them apart internally and always shows the')
w('> key word when you have to choose between them.')
w()

for (const c of CATEGORIES) {
  const members = vowelsByCategory.get(c.id)
  if (!members || members.length === 0) continue
  w(`### ${c.label}`)
  w()
  w(`${c.description}`)
  w()
  w('| Sound | IPA | As in |')
  w('| --- | --- | --- |')
  for (const id of members) w(`| ${sound(id)} | /${get(id).ipa}/ | ${get(id).example} |`)
  w()
}

/* ---------------- digraphs ---------------- */

const SUBTYPE_LABEL: Record<DigraphSubtype, string> = {
  digraph: 'Digraph — two letters, one sound',
  trigraph: 'Trigraph — three letters, one sound',
  'silent-team': 'Silent-letter team — one letter is silent',
  advanced: 'Advanced /sh/ and /zh/ spelling',
}

w('## Consonant digraphs')
w()
w('All of these are tagged **Consonant digraph**. They are grouped by kind below so')
w('you can split them into separate categories if your scope and sequence does.')
w()
for (const subtype of ['digraph', 'trigraph', 'silent-team', 'advanced'] as DigraphSubtype[]) {
  const members = CONSONANT_DIGRAPHS.filter((d) => d.subtype === subtype)
  if (members.length === 0) continue
  w(`### ${SUBTYPE_LABEL[subtype]}`)
  w()
  w('| Spelling | Sound | Example | Note |')
  w('| --- | --- | --- | --- |')
  for (const d of members) {
    w(`| \`${d.spelling}\` | ${both(d.phoneme)} | ${d.example} | ${d.review ?? ''} |`)
  }
  w()
}
w('> A doubled letter (`bb`, `ll`, `ss`) is **not** treated as a digraph — it is a')
w('> plain consonant. Say if you want those tagged separately as a floss-rule group.')
w()

/* ---------------- span patterns ---------------- */

const POSITION_LABEL: Record<string, string> = {
  onset: 'start of a syllable',
  coda: 'end of a syllable',
  'syllable-end': 'end of a syllable',
  'word-end': 'end of the word',
  any: 'anywhere',
}

w('## Multi-sound patterns')
w()
w('Each of these spans more than one sound. The **Sounds** column is what the app')
w('matches on; the **Spellings** column is what it looks like on paper.')
w()

for (const c of CATEGORIES) {
  if (c.kind !== 'span') continue
  const members = SPAN_PATTERNS.filter((p) => p.category === c.id)
  if (members.length === 0) continue

  w(`### ${c.label}`)
  w()
  w(c.description)
  w()
  w('| Pattern | Sounds | Spellings | Where | Example | Note |')
  w('| --- | --- | --- | --- | --- | --- |')
  for (const p of members) {
    const sounds = [p.phonemes, ...(p.also ?? [])]
      .map((seq) => seq.map(sound).join(' + '))
      .join(' or ')
    const spellings = p.spellings.map((s) => `\`${s}\``).join(', ')
    const strict = p.requireSpelling ? ' (spelling must match)' : ''
    w(
      `| **${p.label}** | ${sounds} | ${spellings}${strict} | ${POSITION_LABEL[p.position]} | ${p.example} | ${p.review ?? ''} |`,
    )
  }
  w()
}

w('### Consonant-le')
w()
w(CATEGORIES.find((c) => c.id === 'consonant-le')!.description)
w()
w('This one is matched by shape rather than from a list: any word whose spelling ends')
w('in `le`, where the final sounds are a consonant (optionally plus a schwa) then /l/.')
w('That covers the whole family without enumerating it:')
w()
for (const e of CONSONANT_LE_EXAMPLES) w(`- ${e}`)
w()
w('> The tag shows the letters actually used, so *little* is labelled `-ttle` rather')
w('> than `-tle`. Say if you would rather see the collapsed form.')
w()
w('> Phonics splits *lit-tle* so that `-tle` is the final syllable, but the')
w('> pronunciation-based syllable splitter puts the /t/ with the first syllable. The')
w('> consonant-le tag is found from the end of the spelling for exactly this reason,')
w('> so it does not depend on where the syllable break lands.')
w()

w('### Clusters not in the list')
w()
w('Any consonant cluster of two or more sounds that no listed blend covers is still')
w('tagged as a blend, marked **unlisted** in the app. Those are the ones worth adding')
w('to the table if they keep turning up in your word lists.')
w()

/* ---------------- red words ---------------- */

w('## Red words')
w()
w('Letters that make a sound they do not usually make, so the word has to be')
w('remembered rather than sounded out.')
w()
w('**This list only suggests.** Nothing is classified as a Red Word until the')
w('teacher ticks the word as one, because whether a spelling counts as unexpected')
w('depends on where the class has reached in its scope and sequence — a pattern')
w('that is unexpected in October may be explicitly taught by March. All this table')
w('does is pre-select which letters the teacher probably means, and they confirm')
w('or change it per word.')
w()
w('Once confirmed, those letters are tagged **Red word (irregular)** instead of the')
w('phonics category they would otherwise fall in, so a student who misses one does')
w('not lose credit for a skill they may well have: in *their*, a miss on the `eir`')
w('no longer counts against r-controlled vowels, and the `th` beside it still')
w('counts as a consonant digraph.')
w()
w('What is listed is a **grapheme, not a word**, which is why `ai` appears here for')
w('*said* while the `ai` in *rain* is an ordinary long vowel — they make different')
w('sounds, so they were already different entries.')
w()
w('The list does not have to be complete. A spelling that is missing just means the')
w('teacher picks the column themselves, so add to it as words come up in real tests.')
w()
w('| Letters | Sound(s) | As in | Also |')
w('| --- | --- | --- | --- |')
for (const e of IRREGULAR) {
  w(`| \`${e.letters}\` | ${sounds(e.phonemes)} | *${e.example}* | ${(e.also ?? []).map((x) => `*${x}*`).join(', ')} |`)
}
w()

/* ---------------- review ---------------- */

w('## Needs your review')
w()
w('Judgement calls made while building this. Each one is a one-line change to fix.')
w()

const reviews: Array<[string, string]> = []
reviews.push([
  '/oo/ moon, /ŏŏ/ book, /aw/ saw',
  'These three were not in the category list you gave, and they are neither short nor long nor diphthongs. They are parked under **Other vowel**. Tell me where they belong.',
])
reviews.push([
  '/ā/ /ī/ /ō/ are phonetically diphthongs',
  'They glide, but they are tagged **Long vowel** because that is how they are taught. Only /ow/ cow and /oy/ boy are tagged **Diphthong**.',
])
reviews.push([
  '-ong and -onk use /aw/, not short /o/',
  'The vowel genuinely shifts before /ng/ — *song* is /sawng/, not /song/ — which is the whole reason these are taught as units. Short /o/ is accepted as an alternative for merged dialects.',
])
reviews.push([
  'No -rd, -rk, -rm, -rn, -rt ending blends',
  'In American English the /r/ merges into the vowel, so *card* is /k/ + /ar/ + /d/ and no /r/ sound is left to blend. Those words tag as **R-controlled** instead.',
])
reviews.push([
  'Doubled letters are not digraphs',
  '`bb`, `ll`, `ss` tag as plain consonants. They could become their own floss-rule category if you want.',
])
reviews.push([
  'Kind/old words do NOT collapse into one column',
  'Velar nasal units and consonant-le are marked as single chunks, but "kind" still shows as k-i-n-d with an -ind tag over it. Add `kind-old` to COLLAPSING_CATEGORIES to make it one column.',
])
reviews.push([
  'Consonant-le shows the doubled letters',
  '*little* is labelled `-ttle` rather than `-tle`, because the tag shows the letters actually used. Say if you want the collapsed form instead.',
])
for (const d of CONSONANT_DIGRAPHS) {
  if (d.review) reviews.push([`\`${d.spelling}\` → ${sound(d.phoneme)} (${d.example})`, d.review])
}
for (const p of SPAN_PATTERNS) {
  if (p.review) reviews.push([`${p.label} (${p.example})`, p.review])
}
for (const e of IRREGULAR) {
  if (e.review) reviews.push([`\`${e.letters}\` → ${sounds(e.phonemes)} (${e.example}) as a red word`, e.review])
}

w('| Item | Why it is a judgement call |')
w('| --- | --- |')
for (const [item, why] of reviews) w(`| ${item} | ${why} |`)
w()

w('---')
w()
w(
  `_${PHONEMES.length} sounds · ${CONSONANT_DIGRAPHS.length} digraph spellings · ${SPAN_PATTERNS.length} listed multi-sound patterns · ${IRREGULAR.length} red-word spellings · ${CATEGORIES.length} categories._`,
)

writeFileSync('PHONEME-CATEGORIES.md', lines.join('\n') + '\n')
console.log(`Wrote PHONEME-CATEGORIES.md (${lines.length} lines)`)
