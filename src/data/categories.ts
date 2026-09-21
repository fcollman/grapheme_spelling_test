import type { PhonemeId } from './phonemes'

/**
 * The phonics taxonomy the teacher works in.
 *
 * Two different things get categorised, and keeping them apart matters:
 *
 *  - **Slot categories** apply to ONE sound in a word, and can depend on how that
 *    sound was spelled. /sh/ in "ship" is a consonant digraph; /k/ is a plain
 *    consonant in "cat" but a digraph in "duck".
 *  - **Span categories** apply to a RUN of sounds and are a separate layer.
 *    "-ank" in "bank" is /a/ + /ng/ + /k/ — three slots, one teaching unit.
 *
 * A slot can carry several tags at once (the /ng/ and /k/ in "thrunk" are part of
 * both the "-unk" velar nasal unit and a final blend). Tags overlap on purpose.
 */

export type CategoryId =
  | 'consonant'
  | 'consonant-digraph'
  | 'short-vowel'
  | 'long-vowel'
  | 'other-vowel'
  | 'diphthong'
  | 'r-controlled'
  | 'schwa'
  | 'blend-initial'
  | 'blend-final'
  | 'velar-nasal'
  | 'kind-old'
  | 'consonant-le'
  | 'red-word'

export interface Category {
  id: CategoryId
  /** Shown on tags and report groupings. */
  label: string
  /** Does this describe one sound, or a run of sounds? */
  kind: 'slot' | 'span'
  description: string
  /** Hue for the tag dot. Deliberately avoids the green/amber/red of scoring. */
  hue: number
}

export const CATEGORIES: Category[] = [
  {
    id: 'consonant',
    label: 'Consonant',
    kind: 'slot',
    hue: 215,
    description: 'A single consonant sound spelled with one letter, or a doubled letter (bb, ll, ss).',
  },
  {
    id: 'consonant-digraph',
    label: 'Consonant digraph',
    kind: 'slot',
    hue: 255,
    description:
      'Two or more letters making ONE consonant sound: sh, ch, th, wh, ph, ck, ng, plus trigraphs (tch, dge) and silent-letter teams (kn, wr, gn, mb).',
  },
  {
    id: 'short-vowel',
    label: 'Short vowel',
    kind: 'slot',
    hue: 280,
    description: 'The five short vowel sounds: /a/ cat, /e/ bed, /i/ sit, /o/ hot, /u/ cup.',
  },
  {
    id: 'long-vowel',
    label: 'Long vowel',
    kind: 'slot',
    hue: 300,
    description: 'The vowel says its name: /ā/ cake, /ē/ feet, /ī/ bike, /ō/ boat.',
  },
  {
    id: 'other-vowel',
    label: 'Other vowel',
    kind: 'slot',
    hue: 330,
    description:
      'Vowel sounds that are neither short nor long nor diphthongs: /oo/ moon, /ŏŏ/ book, /aw/ saw.',
  },
  {
    id: 'diphthong',
    label: 'Diphthong',
    kind: 'slot',
    hue: 190,
    description: 'The mouth glides from one vowel to another: /ow/ cow, /oy/ boy.',
  },
  {
    id: 'r-controlled',
    label: 'R-controlled (bossy R)',
    kind: 'slot',
    hue: 175,
    description: 'The /r/ takes over the vowel: /ar/ car, /or/ for, /er/ her, /air/ chair, /eer/ deer, /oor/ cure.',
  },
  {
    id: 'schwa',
    label: 'Schwa',
    kind: 'slot',
    hue: 220,
    description: 'The lazy unstressed vowel /ə/ in about, tablet, pencil. Any vowel letter can spell it.',
  },
  {
    id: 'blend-initial',
    label: 'Beginning blend',
    kind: 'span',
    hue: 205,
    description:
      'Two or three consonant sounds together at the start of a syllable, each one still heard: bl, str, thr.',
  },
  {
    id: 'blend-final',
    label: 'Ending blend',
    kind: 'span',
    hue: 160,
    description: 'Two or more consonant sounds together at the end of a syllable: -nd, -mp, -st, -xt.',
  },
  {
    id: 'velar-nasal',
    label: 'Velar nasal unit',
    kind: 'span',
    hue: 265,
    description:
      'The vowel changes before /ng/, so these are taught whole rather than sounded out: -ang, -ing, -ong, -ung, -ank, -ink, -onk, -unk.',
  },
  {
    id: 'kind-old',
    label: 'Kind / old word',
    kind: 'span',
    hue: 30,
    description:
      'The vowel goes long even though the syllable looks closed: -ind, -ild, -old, -olt, -ost, -oll.',
  },
  {
    id: 'consonant-le',
    label: 'Consonant-le',
    kind: 'span',
    hue: 15,
    description: 'A final stable syllable of consonant + le: -ble, -cle, -dle, -fle, -gle, -kle, -ple, -tle, -zle.',
  },
  {
    id: 'red-word',
    label: 'Red word (irregular)',
    kind: 'slot',
    // The one tag that leans toward the scoring colours on purpose: teachers
    // call these red words, so a dot from another family would read as wrong.
    // Kept off pure red so it cannot be mistaken for a "wrong sound" cell.
    hue: 345,
    description:
      'Letters making a sound they do not usually make, so the word has to be remembered rather than sounded out: the ai in said, the eir in their, the o in come.',
  },
]

export const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]))

/**
 * Categories whose patterns become ONE column in the analysis grid, marked right
 * or wrong as a whole, because they are taught as chunks rather than sounded out.
 *
 * Blends are deliberately absent: they are taught as "every sound is heard", so
 * they stay as separate columns with a tag across them, and you can still see
 * which sound of the blend a student missed.
 *
 * REVIEW: 'kind-old' is currently NOT collapsed, so "kind" shows as k-i-n-d with
 * an -ind tag over it. Add 'kind-old' to this set to make it one column instead.
 */
export const COLLAPSING_CATEGORIES = new Set<CategoryId>(['velar-nasal', 'consonant-le'])

export function category(id: CategoryId): Category {
  const c = CATEGORY_BY_ID.get(id)
  if (!c) throw new Error(`unknown category: ${id}`)
  return c
}

/**
 * Base category for each vowel. Consonants are decided by spelling instead, in
 * slotCategory(), because a digraph is an orthographic fact not a phonetic one.
 *
 * REVIEW: /oo/, /ŏŏ/ and /aw/ were not in the original category list. They are
 * parked in 'other-vowel' — move them wherever your scope and sequence puts them.
 */
export const VOWEL_CATEGORY: Record<PhonemeId, CategoryId> = {
  A: 'short-vowel',
  E: 'short-vowel',
  I: 'short-vowel',
  O: 'short-vowel',
  U: 'short-vowel',

  AE: 'long-vowel',
  EE: 'long-vowel',
  IE: 'long-vowel',
  OE: 'long-vowel',

  OO: 'other-vowel',
  UU: 'other-vowel',
  AW: 'other-vowel',

  OW: 'diphthong',
  OY: 'diphthong',

  AR: 'r-controlled',
  OR: 'r-controlled',
  ER: 'r-controlled',
  AIR: 'r-controlled',
  EER: 'r-controlled',
  OOR: 'r-controlled',

  SCHWA: 'schwa',
}
