import type { PhonemeId } from '../data/phonemes'
import { get, isVowel } from '../data/phonemes'
import { VOWEL_CATEGORY, type CategoryId } from '../data/categories'
import {
  DIGRAPH_LOOKUP,
  MULTI_SOUND_GRAPHEMES,
  SPAN_PATTERNS,
  type DigraphEntry,
  type SpanPattern,
} from '../data/patterns'
import type { Syllable } from './syllabify'

/**
 * The second analysis layer: phonics patterns that live above individual sounds.
 *
 * A slot tag describes one sound (and depends on its spelling — /sh/ is a digraph,
 * /s/ is not). A span match describes a run of sounds that is taught as one unit,
 * like "-ank" or "str". Tags overlap deliberately: the /ng/ and /k/ in "thrunk"
 * belong to both the "-unk" velar nasal unit and the "-nk" ending blend.
 */

export interface SlotTag {
  category: CategoryId
  /** Present when the sound was spelled with a multi-letter team. */
  digraph?: DigraphEntry
}

export interface PatternMatch {
  id: string
  category: CategoryId
  label: string
  /** Slot indices, half-open [start, end). */
  start: number
  end: number
  /**
   * 'listed' came from the reviewed table in data/patterns.ts.
   * 'structural' was detected by shape because no listed pattern fit — these are
   * the ones worth adding to the table if they keep appearing.
   */
  source: 'listed' | 'structural'
}

/** True for a doubled single letter (bb, ll, ss), which is not a digraph. */
function isDoubledLetter(grapheme: string): boolean {
  return grapheme.length === 2 && grapheme[0] === grapheme[1]
}

/**
 * Category of one sound. Consonants depend on spelling, because "digraph" is a
 * fact about letters rather than about the sound itself.
 */
export function slotCategory(phoneme: PhonemeId, grapheme: string): SlotTag {
  if (isVowel(phoneme)) {
    return { category: VOWEL_CATEGORY[phoneme] ?? 'other-vowel' }
  }

  const letters = grapheme.toLowerCase()
  if (letters.length >= 2 && !isDoubledLetter(letters)) {
    const entry = DIGRAPH_LOOKUP.get(letters)?.find((d) => d.phoneme === phoneme)
    if (entry) return { category: 'consonant-digraph', digraph: entry }

    // An unlisted multi-letter spelling of a consonant is still a team of letters
    // making one sound, so it belongs with the digraphs even though the exact
    // spelling is not in the table yet.
    return { category: 'consonant-digraph' }
  }

  return { category: 'consonant' }
}

function spanGrapheme(graphemes: string[], start: number, end: number): string {
  return graphemes.slice(start, end).join('').toLowerCase()
}

/** @returns the length of the matched sequence, or 0 if none matched. */
function matchesAt(pattern: SpanPattern, phonemes: PhonemeId[], start: number): number {
  for (const sequence of [pattern.phonemes, ...(pattern.also ?? [])]) {
    if (start + sequence.length > phonemes.length) continue
    if (sequence.every((p, i) => phonemes[start + i] === p)) return sequence.length
  }
  return 0
}

function positionAllows(
  pattern: SpanPattern,
  start: number,
  end: number,
  syllables: Syllable[],
  totalSlots: number,
): boolean {
  const syllable = syllables.find((s) => start >= s.start && end <= s.end)

  switch (pattern.position) {
    case 'onset':
      // The whole onset, not part of it: "st" must not match inside "str".
      return !!syllable && start === syllable.start && end === syllable.nucleus
    case 'coda':
      // Any run inside the coda, so "-nd" is still found in "hands".
      return !!syllable && start > syllable.nucleus && end <= syllable.end
    case 'syllable-end':
      return !!syllable && end === syllable.end
    case 'word-end':
      return end === totalSlots
    case 'any':
      return true
  }
}

/** Drops a match entirely inside a longer match of the same category. */
function dropContained(matches: PatternMatch[]): PatternMatch[] {
  return matches.filter(
    (m) =>
      !matches.some(
        (other) =>
          other !== m &&
          other.category === m.category &&
          other.start <= m.start &&
          other.end >= m.end &&
          other.end - other.start > m.end - m.start,
      ),
  )
}

/**
 * Consonant-le is found from the end of the spelling rather than from the
 * syllable boundaries, because phonics divides "lit-tle" where the phonetic
 * syllabifier puts the /t/ with the first syllable.
 */
function findConsonantLe(
  phonemes: PhonemeId[],
  graphemes: string[],
  spelling: string,
): PatternMatch | null {
  const last = phonemes.length - 1
  if (last < 1) return null
  if (phonemes[last] !== 'L') return null
  if (!spelling.toLowerCase().endsWith('le')) return null

  // The /l/ may be preceded by a schwa that carries no letters of its own.
  const hasSchwa = phonemes[last - 1] === 'SCHWA'
  const consonantIndex = hasSchwa ? last - 2 : last - 1
  if (consonantIndex < 0) return null

  const consonant = phonemes[consonantIndex]
  if (isVowel(consonant) || consonant === 'L') return null

  const start = consonantIndex
  const end = last + 1
  return {
    id: 'cle',
    category: 'consonant-le',
    label: '-' + spanGrapheme(graphemes, start, end),
    start,
    end,
    source: 'listed',
  }
}

/**
 * True when a run of sounds is really just one letter team, like the /k/ + /s/
 * of "x". Two sounds from one grapheme is not a blend.
 */
function isOneGrapheme(graphemes: string[], phonemes: PhonemeId[], start: number, end: number): boolean {
  const letters = spanGrapheme(graphemes, start, end)
  return MULTI_SOUND_GRAPHEMES.some(
    (m) =>
      m.phonemes.length === end - start &&
      m.phonemes.every((p, i) => phonemes[start + i] === p) &&
      (letters === m.letters || letters === m.letters.replace('_', '')),
  )
}

/**
 * Any consonant cluster that no listed blend covered. These are reported so an
 * unusual but real blend still gets tagged, and so gaps in the table are visible.
 */
function findStructuralBlends(
  graphemes: string[],
  phonemes: PhonemeId[],
  syllables: Syllable[],
  listed: PatternMatch[],
): PatternMatch[] {
  const out: PatternMatch[] = []

  const covered = (category: CategoryId, start: number, end: number) =>
    listed.some((m) => m.category === category && m.start < end && m.end > start)

  for (const syllable of syllables) {
    const onsetStart = syllable.start
    const onsetEnd = syllable.nucleus
    if (
      onsetEnd - onsetStart >= 2 &&
      !covered('blend-initial', onsetStart, onsetEnd) &&
      !isOneGrapheme(graphemes, phonemes, onsetStart, onsetEnd)
    ) {
      out.push({
        id: 'structural-onset',
        category: 'blend-initial',
        label: spanGrapheme(graphemes, onsetStart, onsetEnd) || '?',
        start: onsetStart,
        end: onsetEnd,
        source: 'structural',
      })
    }

    const codaStart = syllable.nucleus + 1
    const codaEnd = syllable.end
    if (
      codaEnd - codaStart >= 2 &&
      !covered('blend-final', codaStart, codaEnd) &&
      !isOneGrapheme(graphemes, phonemes, codaStart, codaEnd)
    ) {
      out.push({
        id: 'structural-coda',
        category: 'blend-final',
        label: '-' + (spanGrapheme(graphemes, codaStart, codaEnd) || '?'),
        start: codaStart,
        end: codaEnd,
        source: 'structural',
      })
    }
  }

  return out
}

/** Every pattern in one target word, in slot order. */
export function findPatterns(
  phonemes: PhonemeId[],
  graphemes: string[],
  syllables: Syllable[],
  spelling: string,
): PatternMatch[] {
  const listed: PatternMatch[] = []

  for (const pattern of SPAN_PATTERNS) {
    for (let start = 0; start < phonemes.length; start++) {
      const length = matchesAt(pattern, phonemes, start)
      if (length === 0) continue
      const end = start + length
      if (!positionAllows(pattern, start, end, syllables, phonemes.length)) continue
      if (pattern.requireSpelling && !pattern.spellings.includes(spanGrapheme(graphemes, start, end))) {
        continue
      }
      listed.push({
        id: pattern.id,
        category: pattern.category,
        label: pattern.label,
        start,
        end,
        source: 'listed',
      })
    }
  }

  const deduped = dropContained(listed)
  const cle = findConsonantLe(phonemes, graphemes, spelling)
  if (cle) deduped.push(cle)
  deduped.push(...findStructuralBlends(graphemes, phonemes, syllables, deduped))

  return deduped.sort((a, b) => a.start - b.start || a.end - b.end)
}

/**
 * Packs overlapping patterns into rows that can each be drawn as one band of
 * table cells. "-unk" and "-nk" overlap in "thrunk", so they need separate rows.
 */
export function assignLanes(patterns: PatternMatch[]): PatternMatch[][] {
  const lanes: PatternMatch[][] = []
  for (const p of [...patterns].sort((a, b) => a.start - b.start || b.end - a.end)) {
    const lane = lanes.find((l) => l.every((other) => p.start >= other.end || p.end <= other.start))
    if (lane) lane.push(p)
    else lanes.push([p])
  }
  return lanes
}

/** Categories present in a word, for filtering and sorting the analysis view. */
export function wordCategories(
  phonemes: PhonemeId[],
  graphemes: string[],
  patterns: PatternMatch[],
): Set<CategoryId> {
  const out = new Set<CategoryId>()
  phonemes.forEach((p, i) => out.add(slotCategory(p, graphemes[i] ?? '').category))
  for (const m of patterns) out.add(m.category)
  return out
}

/** Human-readable name for a phoneme, used in the generated reference. */
export function phonemeName(id: PhonemeId): string {
  const p = get(id)
  return `/${p.label}/ as in ${p.example}`
}
