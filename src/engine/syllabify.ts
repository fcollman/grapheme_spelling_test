import { isVowel, type PhonemeId } from '../data/phonemes'

/**
 * Splits a phoneme sequence into syllables by the maximal onset principle:
 * consonants between two vowels join the following syllable as long as they form
 * a legal English onset, otherwise they close the preceding one.
 */

export interface Syllable {
  /** Indices into the word's phoneme array. */
  start: number
  end: number
  phonemes: PhonemeId[]
  /** Index of the vowel within the word's phoneme array. */
  nucleus: number
  stress: number
  /** Approximate, phoneme-only classification. 'other' when it cannot be told apart. */
  type: 'closed' | 'open' | 'r-controlled' | 'other'
}

const S_CLUSTER_SECOND = new Set(['P', 'T', 'K', 'M', 'N', 'F', 'L', 'W', 'Y'])
const L_FIRST = new Set(['P', 'B', 'K', 'G', 'F', 'S'])
const R_FIRST = new Set(['P', 'B', 'T', 'D', 'K', 'G', 'F', 'TH', 'SH'])
const Y_FIRST = new Set(['P', 'B', 'T', 'D', 'K', 'G', 'F', 'S', 'H', 'M', 'N', 'V', 'L'])
const W_FIRST = new Set(['T', 'D', 'K', 'G', 'S', 'TH', 'H'])
/** Vowels that must be closed by a consonant rather than ending a syllable. */
const LAX_VOWELS = new Set(['A', 'E', 'I', 'O', 'U', 'UU', 'SCHWA'])

function legalOnset(cluster: PhonemeId[]): boolean {
  if (cluster.length === 0) return true
  if (cluster.length === 1) return cluster[0] !== 'NG'
  if (cluster.length === 2) {
    const [a, b] = cluster
    if (a === 'S' && S_CLUSTER_SECOND.has(b)) return true
    if (b === 'L' && L_FIRST.has(a)) return true
    if (b === 'R' && R_FIRST.has(a)) return true
    if (b === 'Y' && Y_FIRST.has(a)) return true
    if (b === 'W' && W_FIRST.has(a)) return true
    return false
  }
  if (cluster.length === 3) {
    const [a, b, c] = cluster
    return a === 'S' && ['P', 'T', 'K'].includes(b) && legalOnset([b, c])
  }
  return false
}

function classify(phonemes: PhonemeId[], nucleusOffset: number): Syllable['type'] {
  const nucleus = phonemes[nucleusOffset]
  const coda = phonemes.slice(nucleusOffset + 1)
  if (nucleus.endsWith('R') && nucleus !== 'R') return 'r-controlled'
  if (['AR', 'OR', 'ER', 'AIR', 'EER', 'OOR'].includes(nucleus)) return 'r-controlled'
  if (coda.length === 0) return 'open'
  if (['A', 'E', 'I', 'O', 'U'].includes(nucleus)) return 'closed'
  return 'other'
}

export function syllabify(phonemes: PhonemeId[], stress: number[]): Syllable[] {
  const nuclei: number[] = []
  phonemes.forEach((p, i) => {
    if (isVowel(p)) nuclei.push(i)
  })

  // No vowel at all (e.g. a single stray consonant): one syllable covering it.
  if (nuclei.length === 0) {
    if (phonemes.length === 0) return []
    return [
      {
        start: 0,
        end: phonemes.length,
        phonemes: [...phonemes],
        nucleus: 0,
        stress: stress[0] ?? 0,
        type: 'other',
      },
    ]
  }

  const boundaries: number[] = [0]
  for (let n = 0; n < nuclei.length - 1; n++) {
    const from = nuclei[n] + 1
    const to = nuclei[n + 1]
    const between = phonemes.slice(from, to)

    // Give the next syllable the longest legal onset it can take.
    let split = to // default: everything closes the previous syllable
    for (let takeCount = between.length; takeCount >= 1; takeCount--) {
      if (legalOnset(between.slice(between.length - takeCount))) {
        split = to - takeCount
        break
      }
    }

    // Maximal onset alone over-applies: it would split tablet as ta-blet and
    // rabbit as ra-bbit. A short vowel has to be closed, so when the onset took
    // every consonant and left the previous syllable open on a lax vowel, give
    // one consonant back to the coda.
    if (between.length > 0 && split === from && LAX_VOWELS.has(phonemes[nuclei[n]])) {
      split = from + 1
    }

    boundaries.push(split)
  }
  boundaries.push(phonemes.length)

  const syllables: Syllable[] = []
  for (let s = 0; s < boundaries.length - 1; s++) {
    const start = boundaries[s]
    const end = boundaries[s + 1]
    const nucleus = nuclei[s]
    const slice = phonemes.slice(start, end)
    syllables.push({
      start,
      end,
      phonemes: slice,
      nucleus,
      stress: stress[nucleus] ?? 0,
      type: classify(slice, nucleus - start),
    })
  }

  return syllables
}
