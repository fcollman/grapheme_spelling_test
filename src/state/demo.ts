import type { Project, Student, Test, Word } from './types'
import { DEFAULT_SETTINGS } from './types'

/**
 * A made-up class and six months of fortnightly tests, so the app can be
 * explored without anyone typing a word in.
 *
 * Everything is generated from a fixed seed, so the demo looks the same every
 * time it is loaded — screenshots, documentation and tests all stay valid. Only
 * the dates move, so the data always looks current.
 */

/* ---------------- deterministic randomness ---------------- */

/** mulberry32: small, fast, and repeatable, which is the only property we need. */
function makeRng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ---------------- what each test covers ---------------- */

type Skill =
  | 'short-vowel'
  | 'digraph'
  | 'blend'
  | 'velar-nasal'
  | 'long-vowel'
  | 'r-controlled'
  | 'consonant-le'
  | 'red-word'

interface BankWord {
  text: string
  nonsense?: boolean
  /** Taught as a word to be remembered, not sounded out. */
  redWord?: boolean
  skills: Skill[]
}

/**
 * A scope and sequence: short vowels first, consonant-le last, with review
 * folded in later so early skills keep appearing and the progress report has
 * something to compare across tests.
 */
const UNITS: Array<{ name: string; words: BankWord[] }> = [
  {
    name: 'Short vowels',
    words: [
      { text: 'cat', skills: ['short-vowel'] },
      { text: 'bed', skills: ['short-vowel'] },
      { text: 'hit', skills: ['short-vowel'] },
      { text: 'dog', skills: ['short-vowel'] },
      { text: 'sun', skills: ['short-vowel'] },
      { text: 'map', skills: ['short-vowel'] },
      { text: 'pen', skills: ['short-vowel'] },
      { text: 'vun', nonsense: true, skills: ['short-vowel'] },
      { text: 'zep', nonsense: true, skills: ['short-vowel'] },
    ],
  },
  {
    name: 'Consonant digraphs',
    words: [
      { text: 'ship', skills: ['digraph'] },
      { text: 'chin', skills: ['digraph'] },
      { text: 'thin', skills: ['digraph'] },
      { text: 'when', skills: ['digraph'] },
      { text: 'duck', skills: ['digraph'] },
      { text: 'rush', skills: ['digraph'] },
      { text: 'path', skills: ['digraph'] },
      { text: 'chask', nonsense: true, skills: ['digraph', 'blend'] },
      { text: 'zilth', nonsense: true, skills: ['digraph'] },
    ],
  },
  {
    name: 'Beginning blends',
    words: [
      { text: 'stop', skills: ['blend'] },
      { text: 'flag', skills: ['blend'] },
      { text: 'grin', skills: ['blend'] },
      { text: 'swim', skills: ['blend'] },
      { text: 'plan', skills: ['blend'] },
      { text: 'drum', skills: ['blend'] },
      { text: 'splash', skills: ['blend', 'digraph'] },
      { text: 'blorf', nonsense: true, skills: ['blend', 'r-controlled'] },
      { text: 'glim', nonsense: true, skills: ['blend'] },
    ],
  },
  {
    name: 'Ending blends and -nk',
    words: [
      { text: 'hand', skills: ['blend'] },
      { text: 'jump', skills: ['blend'] },
      { text: 'milk', skills: ['blend'] },
      { text: 'bank', skills: ['velar-nasal'] },
      { text: 'pink', skills: ['velar-nasal'] },
      { text: 'sung', skills: ['velar-nasal'] },
      { text: 'tent', skills: ['blend'] },
      { text: 'thrunk', nonsense: true, skills: ['velar-nasal', 'blend', 'digraph'] },
      { text: 'drept', nonsense: true, skills: ['blend'] },
    ],
  },
  {
    name: 'Long vowels and silent e',
    words: [
      { text: 'cake', skills: ['long-vowel'] },
      { text: 'bike', skills: ['long-vowel'] },
      { text: 'home', skills: ['long-vowel'] },
      { text: 'made', skills: ['long-vowel'] },
      { text: 'ride', skills: ['long-vowel'] },
      { text: 'note', skills: ['long-vowel'] },
      { text: 'shine', skills: ['long-vowel', 'digraph'] },
      { text: 'blafe', nonsense: true, skills: ['long-vowel', 'blend'] },
      { text: 'zode', nonsense: true, skills: ['long-vowel'] },
    ],
  },
  {
    name: 'R-controlled vowels',
    words: [
      { text: 'car', skills: ['r-controlled'] },
      { text: 'bird', skills: ['r-controlled'] },
      { text: 'fork', skills: ['r-controlled'] },
      { text: 'turn', skills: ['r-controlled'] },
      { text: 'park', skills: ['r-controlled'] },
      { text: 'shirt', skills: ['r-controlled', 'digraph'] },
      { text: 'storm', skills: ['r-controlled', 'blend'] },
      { text: 'plurt', nonsense: true, skills: ['r-controlled', 'blend'] },
      { text: 'gorn', nonsense: true, skills: ['r-controlled'] },
    ],
  },
  {
    name: 'Consonant-le',
    words: [
      { text: 'little', skills: ['consonant-le'] },
      { text: 'apple', skills: ['consonant-le'] },
      { text: 'table', skills: ['consonant-le', 'long-vowel'] },
      { text: 'puzzle', skills: ['consonant-le'] },
      { text: 'candle', skills: ['consonant-le', 'blend'] },
      { text: 'bundle', skills: ['consonant-le', 'blend'] },
      { text: 'simple', skills: ['consonant-le'] },
      { text: 'skable', nonsense: true, skills: ['consonant-le', 'blend'] },
      { text: 'frittle', nonsense: true, skills: ['consonant-le', 'blend'] },
    ],
  },
  {
    // Red words, so the demo shows what an irregular spelling does to the
    // reports: the regular parts of these words still count for their own
    // skills, and only the memorised part lands under Red word.
    name: 'Red words',
    words: [
      { text: 'said', redWord: true, skills: ['red-word'] },
      { text: 'their', redWord: true, skills: ['red-word', 'digraph'] },
      { text: 'come', redWord: true, skills: ['red-word'] },
      { text: 'friend', redWord: true, skills: ['red-word', 'blend'] },
      { text: 'one', redWord: true, skills: ['red-word'] },
      { text: 'was', redWord: true, skills: ['red-word'] },
      { text: 'been', redWord: true, skills: ['red-word'] },
      { text: 'shed', skills: ['digraph', 'short-vowel'] },
      { text: 'thrim', nonsense: true, skills: ['blend', 'digraph'] },
    ],
  },
]

/** Which unit each of the 13 tests draws from, with review woven back in. */
const SCHEDULE: number[] = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 6, 7]

/* ---------------- the class ---------------- */

interface Profile {
  name: string
  /** Chance of spelling a word correctly at the start of the six months. */
  start: number
  /** How much that improves by the end. Zero or negative means no progress. */
  growth: number
  /** Skills that run behind the student's general level. */
  weak?: Partial<Record<Skill, number>>
  /** Skills that run ahead of it. */
  strong?: Partial<Record<Skill, number>>
  /** Chance of missing a test entirely. */
  absent?: number
}

/**
 * Eight students chosen to show different things the reports can surface: a
 * ceiling, a clear success story, a plateau, a specific skill deficit, and a
 * student whose data is patchy because they miss sessions.
 */
const CLASS: Profile[] = [
  { name: 'Maya R.', start: 0.88, growth: 0.08, strong: { digraph: 0.05 } },
  { name: 'Tyler B.', start: 0.42, growth: 0.4 },
  // Jordan is the one to notice: steady work, no movement.
  { name: 'Jordan P.', start: 0.55, growth: 0.02 },
  // Aisha sounds words out well and has not memorised the red words, which is a
  // real profile and the one the red-word report exists to separate out.
  { name: 'Aisha K.', start: 0.3, growth: 0.22, weak: { 'red-word': 0.3 } },
  { name: 'Diego M.', start: 0.25, growth: 0.04, weak: { 'short-vowel': 0.12 } },
  // Sam can hear vowels but not consonant teams, and only starts to shift late.
  { name: 'Sam W.', start: 0.6, growth: 0.15, weak: { digraph: 0.38, blend: 0.25 } },
  // Lena starts well then drifts — the report should show the dip.
  { name: 'Lena F.', start: 0.75, growth: -0.12 },
  { name: 'Omar H.', start: 0.45, growth: 0.3, absent: 0.18 },
]

/* ---------------- realistic misspellings ---------------- */

/**
 * Error patterns a struggling speller actually produces, tried in order until
 * one applies. Random letters would make the reports meaningless.
 */
const ERRORS: Array<{ skill: Skill | 'any'; apply: (w: string) => string | null }> = [
  // Digraph collapsed to a single letter.
  { skill: 'digraph', apply: (w) => (w.includes('sh') ? w.replace('sh', 's') : null) },
  { skill: 'digraph', apply: (w) => (w.includes('ch') ? w.replace('ch', 'c') : null) },
  { skill: 'digraph', apply: (w) => (w.includes('th') ? w.replace('th', 'f') : null) },
  { skill: 'digraph', apply: (w) => (w.includes('wh') ? w.replace('wh', 'w') : null) },
  { skill: 'digraph', apply: (w) => (w.includes('ck') ? w.replace('ck', 'k') : null) },

  // A sound dropped out of a cluster.
  {
    skill: 'blend',
    apply: (w) => {
      const m = w.match(/^([bcdfgklpstw])([lrw])/)
      return m ? w.slice(0, 1) + w.slice(2) : null
    },
  },
  { skill: 'blend', apply: (w) => (/nd$/.test(w) ? w.slice(0, -1) : null) },
  { skill: 'blend', apply: (w) => (/mp$/.test(w) ? w.replace(/mp$/, 'p') : null) },
  { skill: 'blend', apply: (w) => (/st$/.test(w) ? w.replace(/st$/, 's') : null) },

  // The velar nasal units, where the /ng/ goes missing.
  { skill: 'velar-nasal', apply: (w) => (w.includes('ank') ? w.replace('ank', 'ak') : null) },
  { skill: 'velar-nasal', apply: (w) => (w.includes('ink') ? w.replace('ink', 'ik') : null) },
  { skill: 'velar-nasal', apply: (w) => (w.includes('unk') ? w.replace('unk', 'uk') : null) },
  { skill: 'velar-nasal', apply: (w) => (w.includes('ung') ? w.replace('ung', 'un') : null) },

  // Silent e dropped, so the vowel goes short.
  { skill: 'long-vowel', apply: (w) => (/e$/.test(w) && w.length > 3 ? w.slice(0, -1) : null) },

  // Bossy r flattened to the commonest spelling.
  { skill: 'r-controlled', apply: (w) => (w.includes('ir') ? w.replace('ir', 'er') : null) },
  { skill: 'r-controlled', apply: (w) => (w.includes('ur') ? w.replace('ur', 'er') : null) },
  { skill: 'r-controlled', apply: (w) => (w.includes('or') ? w.replace('or', 'er') : null) },
  { skill: 'r-controlled', apply: (w) => (w.includes('ar') ? w.replace('ar', 'er') : null) },

  // Consonant-le reversed, the classic -el error.
  { skill: 'consonant-le', apply: (w) => (/le$/.test(w) ? w.replace(/le$/, 'el') : null) },

  // Vowel substituted for a near neighbour.
  {
    skill: 'short-vowel',
    apply: (w) => {
      const swap: Record<string, string> = { a: 'e', e: 'i', i: 'e', o: 'u', u: 'o' }
      const i = w.split('').findIndex((c) => swap[c])
      return i >= 0 ? w.slice(0, i) + swap[w[i]] + w.slice(i + 1) : null
    },
  },

  // Last resort: drop the final consonant.
  { skill: 'any', apply: (w) => (/[^aeiou]$/.test(w) ? w.slice(0, -1) : null) },
]

/** A phonetically fair spelling of the same word — an error, but not a sound error. */
const PLAUSIBLE: Array<(w: string) => string | null> = [
  (w) => (w.startsWith('c') && 'aou'.includes(w[1]) ? 'k' + w.slice(1) : null),
  (w) => (w.includes('ck') ? w.replace('ck', 'k') : null),
  (w) => (w.includes('ph') ? w.replace('ph', 'f') : null),
  (w) => (/ea/.test(w) ? w.replace('ea', 'ee') : null),
]

function misspell(word: BankWord, rng: () => number): string {
  // One error in six is a fair spelling of the right sounds, which is what the
  // amber marking and the profile page's second list exist to show.
  if (rng() < 0.17) {
    const options = PLAUSIBLE.map((f) => f(word.text)).filter((x): x is string => !!x)
    if (options.length > 0) return options[Math.floor(rng() * options.length)]
  }

  const targeted = ERRORS.filter(
    (e) => e.skill !== 'any' && word.skills.includes(e.skill as Skill),
  )
  const pool = [...targeted, ...ERRORS.filter((e) => e.skill === 'any')]

  for (const candidate of shuffle(pool, rng)) {
    const out = candidate.apply(word.text)
    if (out && out !== word.text) return out
  }
  return word.text.slice(0, -1) || word.text
}

function shuffle<T>(list: T[], rng: () => number): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/* ---------------- assembly ---------------- */

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export const DEMO_TEST_COUNT = SCHEDULE.length
export const DEMO_STUDENT_COUNT = CLASS.length

/**
 * Builds the whole demo project: a class of eight, tested every two weeks for
 * six months, ending today.
 */
export function demoProject(): Project {
  const rng = makeRng(20260919)

  const students: Student[] = CLASS.map((p, i) => ({ id: `demo_s${i}`, name: p.name }))

  // Work backwards from today so the newest test is always current.
  const last = new Date()
  const tests: Test[] = SCHEDULE.map((unitIndex, t) => {
    const unit = UNITS[unitIndex]
    const date = new Date(last)
    date.setDate(date.getDate() - (SCHEDULE.length - 1 - t) * 14)

    // Nine words a test, rotated so repeated units are not identical.
    const words: Word[] = unit.words.map((w, i) => ({
      id: `demo_t${t}_w${i}`,
      text: w.text,
      nonsense: !!w.nonsense,
      redWord: !!w.redWord,
    }))

    const responses: Record<string, Record<string, string>> = {}
    // How far through the six months we are, 0 to 1.
    const progress = SCHEDULE.length > 1 ? t / (SCHEDULE.length - 1) : 1

    for (const [i, profile] of CLASS.entries()) {
      const student = students[i]
      const absent = profile.absent !== undefined && rng() < profile.absent

      for (const [wi, bankWord] of unit.words.entries()) {
        const word = words[wi]
        responses[word.id] = responses[word.id] ?? {}
        if (absent) {
          responses[word.id][student.id] = ''
          continue
        }

        let ability = profile.start + profile.growth * progress
        for (const skill of bankWord.skills) {
          ability -= profile.weak?.[skill] ?? 0
          ability += profile.strong?.[skill] ?? 0
        }
        // A nonsense word has no sight-word memory to fall back on.
        if (bankWord.nonsense) ability -= 0.1
        ability = Math.max(0.04, Math.min(0.97, ability))

        responses[word.id][student.id] =
          rng() < ability ? bankWord.text : misspell(bankWord, rng)
      }
    }

    return {
      id: `demo_t${t}`,
      // The date is shown beside the name everywhere, so it is not repeated here.
      name: `Test ${t + 1} · ${unit.name}`,
      date: isoDate(date),
      words,
      responses,
      overrides: {},
      wordPhonemes: {},
    }
  })

  return {
    version: 1,
    // Named, so the demo also shows what a class name does to file names and printouts.
    className: 'Block 2A',
    students,
    tests,
    activeTestId: tests[tests.length - 1].id,
    settings: { ...DEFAULT_SETTINGS },
  }
}
