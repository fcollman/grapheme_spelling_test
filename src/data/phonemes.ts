// The 45-phoneme display inventory the teacher works in.
//
// Every entry here was chosen against what eSpeak NG's en-us voice actually
// emits (surveyed empirically, not from a reference chart) so that normalize.ts
// can map engine output onto it without gaps. See notes in normalize.ts for the
// cases where eSpeak's output needed merging or folding.

export type PhonemeId = string

export interface ConsonantFeatures {
  kind: 'consonant'
  /** 1 = bilabial … 8 = glottal. Used as a distance axis, not a linguistic claim. */
  place: number
  manner: 'stop' | 'fricative' | 'affricate' | 'nasal' | 'liquid' | 'glide'
  voiced: boolean
}

export interface VowelFeatures {
  kind: 'vowel'
  /** 1 = high … 3 = low */
  height: number
  /** 1 = front … 3 = back */
  back: number
  tense: boolean
  rhotic: boolean
  diphthong: boolean
}

export type Features = ConsonantFeatures | VowelFeatures

export type PhonemeGroup =
  | 'stop'
  | 'fricative'
  | 'affricate'
  | 'nasal'
  | 'liquid'
  | 'glide'
  | 'short vowel'
  | 'long vowel'
  | 'other vowel'
  | 'r-controlled'
  | 'diphthong'
  | 'schwa'

export interface Phoneme {
  id: PhonemeId
  /** Structured-literacy sound spelling, shown as /sh/ */
  label: string
  /** IPA symbol, shown as /ʃ/ when the teacher switches notation */
  ipa: string
  /** Key word that disambiguates the sound for the teacher */
  example: string
  group: PhonemeGroup
  features: Features
}

const c = (
  id: string,
  label: string,
  ipa: string,
  example: string,
  place: number,
  manner: ConsonantFeatures['manner'],
  voiced: boolean,
): Phoneme => ({
  id,
  label,
  ipa,
  example,
  group: manner,
  features: { kind: 'consonant', place, manner, voiced },
})

const v = (
  id: string,
  label: string,
  ipa: string,
  example: string,
  group: PhonemeGroup,
  height: number,
  back: number,
  tense: boolean,
  rhotic = false,
  diphthong = false,
): Phoneme => ({
  id,
  label,
  ipa,
  example,
  group,
  features: { kind: 'vowel', height, back, tense, rhotic, diphthong },
})

export const PHONEMES: Phoneme[] = [
  // ---- consonants (24) ----
  c('P', 'p', 'p', 'pig', 1, 'stop', false),
  c('B', 'b', 'b', 'bat', 1, 'stop', true),
  c('T', 't', 't', 'top', 4, 'stop', false),
  c('D', 'd', 'd', 'dog', 4, 'stop', true),
  c('K', 'k', 'k', 'cat', 7, 'stop', false),
  c('G', 'g', 'ɡ', 'go', 7, 'stop', true),

  c('F', 'f', 'f', 'fan', 2, 'fricative', false),
  c('V', 'v', 'v', 'van', 2, 'fricative', true),
  c('TH', 'th', 'θ', 'thin', 3, 'fricative', false),
  c('DH', 'th', 'ð', 'this', 3, 'fricative', true),
  c('S', 's', 's', 'sun', 4, 'fricative', false),
  c('Z', 'z', 'z', 'zip', 4, 'fricative', true),
  c('SH', 'sh', 'ʃ', 'ship', 5, 'fricative', false),
  c('ZH', 'zh', 'ʒ', 'measure', 5, 'fricative', true),
  c('H', 'h', 'h', 'hat', 8, 'fricative', false),

  c('CH', 'ch', 'tʃ', 'chip', 5, 'affricate', false),
  c('J', 'j', 'dʒ', 'jam', 5, 'affricate', true),

  c('M', 'm', 'm', 'man', 1, 'nasal', true),
  c('N', 'n', 'n', 'net', 4, 'nasal', true),
  c('NG', 'ng', 'ŋ', 'ring', 7, 'nasal', true),

  c('L', 'l', 'l', 'lip', 4, 'liquid', true),
  c('R', 'r', 'ɹ', 'run', 4, 'liquid', true),

  c('W', 'w', 'w', 'win', 1, 'glide', true),
  c('Y', 'y', 'j', 'yes', 6, 'glide', true),

  // ---- short vowels (5) ----
  v('A', 'a', 'æ', 'cat', 'short vowel', 3, 1, false),
  v('E', 'e', 'ɛ', 'bed', 'short vowel', 2, 1, false),
  v('I', 'i', 'ɪ', 'sit', 'short vowel', 1, 1, false),
  v('O', 'o', 'ɑ', 'hot', 'short vowel', 3, 3, false),
  v('U', 'u', 'ʌ', 'cup', 'short vowel', 2, 2, false),

  // ---- long vowels (4) ----
  v('AE', 'ā', 'eɪ', 'cake', 'long vowel', 2, 1, true, false, true),
  v('EE', 'ē', 'i', 'feet', 'long vowel', 1, 1, true),
  v('IE', 'ī', 'aɪ', 'bike', 'long vowel', 3, 2, true, false, true),
  v('OE', 'ō', 'oʊ', 'boat', 'long vowel', 2, 3, true, false, true),

  // ---- other vowels (2) ----
  v('OO', 'oo', 'u', 'moon', 'other vowel', 1, 3, true),
  v('UU', 'ŏŏ', 'ʊ', 'book', 'other vowel', 1, 3, false),

  // ---- r-controlled (6) ----
  v('AR', 'ar', 'ɑɹ', 'car', 'r-controlled', 3, 3, true, true),
  v('OR', 'or', 'ɔɹ', 'for', 'r-controlled', 2, 3, true, true),
  v('ER', 'er', 'ɜɹ', 'her', 'r-controlled', 2, 2, true, true),
  v('AIR', 'air', 'ɛɹ', 'chair', 'r-controlled', 2, 1, true, true),
  v('EER', 'eer', 'ɪɹ', 'deer', 'r-controlled', 1, 1, true, true),
  v('OOR', 'oor', 'ʊɹ', 'cure', 'r-controlled', 1, 3, true, true),

  // ---- diphthongs (3) ----
  v('OW', 'ow', 'aʊ', 'cow', 'diphthong', 3, 2, true, false, true),
  v('OY', 'oy', 'ɔɪ', 'boy', 'diphthong', 2, 3, true, false, true),
  v('AW', 'aw', 'ɔ', 'saw', 'diphthong', 3, 3, true),

  // ---- schwa (1) ----
  v('SCHWA', 'ə', 'ə', 'about', 'schwa', 2, 2, false),
]

export const BY_ID = new Map(PHONEMES.map((p) => [p.id, p]))

export const GROUP_ORDER: PhonemeGroup[] = [
  'stop',
  'fricative',
  'affricate',
  'nasal',
  'liquid',
  'glide',
  'short vowel',
  'long vowel',
  'other vowel',
  'r-controlled',
  'diphthong',
  'schwa',
]

/** Report row order: grouped the way a phonics teacher expects to scan them. */
export const REPORT_ORDER: PhonemeId[] = PHONEMES.map((p) => p.id)

export function get(id: PhonemeId): Phoneme {
  const p = BY_ID.get(id)
  if (!p) throw new Error(`unknown phoneme id: ${id}`)
  return p
}

export function isVowel(id: PhonemeId): boolean {
  return get(id).features.kind === 'vowel'
}

export type Notation = 'sound' | 'ipa'

/** Renders a phoneme the way the teacher has chosen to see it, e.g. /sh/ or /ʃ/. */
export function display(id: PhonemeId, notation: Notation): string {
  const p = BY_ID.get(id)
  if (!p) return `/?/`
  return `/${notation === 'ipa' ? p.ipa : p.label}/`
}

/** Several phonemes in a row, spaced so the slashes do not run together. */
export function displayList(ids: PhonemeId[], notation: Notation): string {
  return ids.map((id) => display(id, notation)).join(' ')
}

/** Bare form without slashes, for CSV columns and compact table headers. */
export function bare(id: PhonemeId, notation: Notation): string {
  const p = BY_ID.get(id)
  if (!p) return '?'
  return notation === 'ipa' ? p.ipa : p.label
}

/**
 * Two phonemes share a display label (/th/ thin vs /th/ this). Disambiguate with
 * the key word wherever the teacher has to pick one.
 */
export function displayWithExample(id: PhonemeId, notation: Notation): string {
  const p = BY_ID.get(id)
  if (!p) return '/?/'
  return `${display(id, notation)} as in ${p.example}`
}
