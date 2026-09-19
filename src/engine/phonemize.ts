import { phonemize as espeak } from 'phonemizer'
import { normalize, type NormalizedWord } from './normalize'
import { fallbackRead, isSpelledOut } from './fallback'

/**
 * Wrapper around the embedded eSpeak NG engine.
 *
 * Both the target word and the student's attempt go through here: a student's
 * spelling is phonemized as "what would this spelling sound like read aloud",
 * which is what makes a nonsense attempt analysable at all.
 */

const VOICE = 'en-us'
const cache = new Map<string, NormalizedWord>()

/** Strip anything eSpeak would read as punctuation or a separate token. */
export function cleanWord(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z']/g, '')
}

async function phonemizeBatch(words: string[]): Promise<string[]> {
  const joined = (await espeak(words.join(' '), VOICE)).join(' ').trim()
  const parts = joined.split(/\s+/).filter(Boolean)
  // eSpeak can expand a token into several words (digits, abbreviations). If the
  // counts disagree the batch is unusable, so fall back to one call per word.
  if (parts.length === words.length) return parts
  return Promise.all(words.map(async (w) => (await espeak(w, VOICE)).join(' ').trim()))
}

/**
 * eSpeak reads unpronounceable strings out as letter names, which is exactly what
 * a vowel-less student attempt like "splsh" produces. Swap in a grapheme reading.
 */
function repairSpelledOut(word: string, norm: NormalizedWord): NormalizedWord {
  if (!isSpelledOut(word, norm.phonemes)) return norm
  const phonemes = fallbackRead(word)
  if (phonemes.length === 0) return norm
  return {
    phonemes,
    stress: phonemes.map(() => 0),
    unknown: norm.unknown,
    raw: `${norm.raw} (letter-name reading replaced by grapheme reading)`,
  }
}

/**
 * Phonemize many words at once, memoized. Batching matters: 160 uncached words
 * take ~130ms batched vs ~250ms one at a time, and a class set is ~160 words.
 */
export async function analyzeWords(rawWords: string[]): Promise<Map<string, NormalizedWord>> {
  const result = new Map<string, NormalizedWord>()
  const needed: string[] = []

  for (const raw of rawWords) {
    const word = cleanWord(raw)
    if (!word) continue
    const hit = cache.get(word)
    if (hit) result.set(word, hit)
    else if (!needed.includes(word)) needed.push(word)
  }

  if (needed.length > 0) {
    const ipas = await phonemizeBatch(needed)
    needed.forEach((word, i) => {
      const norm = repairSpelledOut(word, normalize(ipas[i] ?? ''))
      cache.set(word, norm)
      result.set(word, norm)
    })
  }

  return result
}

export async function analyzeWord(raw: string): Promise<NormalizedWord> {
  const word = cleanWord(raw)
  const empty: NormalizedWord = { phonemes: [], stress: [], unknown: [], raw: '' }
  if (!word) return empty
  const map = await analyzeWords([word])
  return map.get(word) ?? empty
}

/** Exposed for tests that need a deterministic starting point. */
export function clearCache() {
  cache.clear()
}
