import { analyze, type AlignOptions, type SlotOverride, type WordAnalysis } from './align'
import { analyzeWords, cleanWord } from './phonemize'

const EMPTY = { phonemes: [], stress: [], unknown: [], raw: '' }

/** Full pipeline for one target/attempt pair: phonemize both sides, then align. */
export async function analyzePair(
  word: string,
  attempt: string,
  overrides: Record<number, SlotOverride> = {},
  options: AlignOptions = {},
): Promise<WordAnalysis> {
  const w = cleanWord(word)
  const a = cleanWord(attempt)
  const map = await analyzeWords([w, a])
  return analyze(w, a, map.get(w) ?? EMPTY, map.get(a) ?? EMPTY, overrides, options)
}

/**
 * Phonemizes every word and attempt in one batched pass, then aligns.
 * Used by the UI so a whole test analyses in a single engine round-trip.
 */
export async function analyzeMany(
  pairs: Array<{ word: string; attempt: string; overrides?: Record<number, SlotOverride> }>,
  options: AlignOptions = {},
): Promise<WordAnalysis[]> {
  const cleaned = pairs.map((p) => ({ ...p, w: cleanWord(p.word), a: cleanWord(p.attempt) }))
  const all = cleaned.flatMap((p) => [p.w, p.a]).filter(Boolean)
  const map = await analyzeWords(all)
  return cleaned.map((p) =>
    analyze(p.w, p.a, map.get(p.w) ?? EMPTY, map.get(p.a) ?? EMPTY, p.overrides ?? {}, options),
  )
}
