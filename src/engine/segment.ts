import type { PhonemeId } from '../data/phonemes'
import { GRAPHEME_SETS, MAX_GRAPHEME_LEN } from '../data/graphemes'
import { DIGRAPH_LOOKUP } from '../data/patterns'

/**
 * Splits a spelling into one letter-chunk per phoneme.
 *
 * Both sides of a comparison go through this: the target word and the student's
 * attempt, each against its own phoneme sequence. That is what lets the scorer
 * tell "right sound, right letters" (green) from "right sound, other letters"
 * (amber) — cat/c-a-t against kat/k-a-t differs only in slot 0.
 *
 * Because the phonemes are already known, this is a segmentation problem, not a
 * prediction problem, so an unlisted spelling still lands somewhere sensible via
 * the fallback cost instead of failing.
 */

const SILENT_COST = 0.9
const LISTED_COST = 0
const FALLBACK_BASE = 0.6
const FALLBACK_PER_LETTER = 0.1
/** Nudges the search toward one letter per phoneme when nothing else decides it. */
const LENGTH_BIAS = 0.02

/** Breaks ties toward a recognised consonant team, so "vision" splits vi-si-on. */
const TEAM_BONUS = 0.02

function chunkCost(letters: string, phoneme: PhonemeId): number {
  if (letters === '') return SILENT_COST
  if (GRAPHEME_SETS[phoneme]?.has(letters)) {
    // Prefer the longest listed match: 'sh' for /sh/ should beat 's' + stray 'h'.
    let cost = LISTED_COST - letters.length * 0.01
    if (DIGRAPH_LOOKUP.get(letters)?.some((d) => d.phoneme === phoneme)) cost -= TEAM_BONUS
    return cost
  }
  return FALLBACK_BASE + FALLBACK_PER_LETTER * letters.length + LENGTH_BIAS * letters.length
}

/**
 * @returns one chunk per phoneme, concatenating to exactly `spelling`.
 */
export function segment(spelling: string, phonemes: PhonemeId[]): string[] {
  const letters = spelling
  const n = letters.length
  const m = phonemes.length

  if (m === 0) return []
  if (n === 0) return phonemes.map(() => '')

  // best[i][j] = min cost of spelling phonemes[i..] with letters[j..]
  const INF = Infinity
  const best: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(INF))
  const take: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))

  best[m][n] = 0

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n; j >= 0; j--) {
      const remainingPhonemes = m - i
      const remainingLetters = n - j
      // Every later phoneme may take zero letters, but letters must all be used.
      if (remainingLetters > remainingPhonemes * MAX_GRAPHEME_LEN) continue

      const maxTake = Math.min(MAX_GRAPHEME_LEN, remainingLetters)
      for (let k = 0; k <= maxTake; k++) {
        const rest = best[i + 1][j + k]
        if (rest === INF) continue
        const cost = chunkCost(letters.slice(j, j + k), phonemes[i]) + rest
        if (cost < best[i][j]) {
          best[i][j] = cost
          take[i][j] = k
        }
      }
    }
  }

  if (best[0][0] === INF) {
    // Cannot distribute the letters (a very long spelling for very few phonemes).
    // Give everything to the first slot rather than losing the student's letters.
    return phonemes.map((_, i) => (i === 0 ? letters : ''))
  }

  const out: string[] = []
  let j = 0
  for (let i = 0; i < m; i++) {
    const k = take[i][j]
    out.push(letters.slice(j, j + k))
    j += k
  }
  // Any tail the search could not place (shouldn't happen) joins the last chunk.
  if (j < n) out[out.length - 1] += letters.slice(j)

  return out
}
