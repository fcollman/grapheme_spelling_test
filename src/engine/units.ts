import type { PhonemeId } from '../data/phonemes'
import { isVowel } from '../data/phonemes'
import { COLLAPSING_CATEGORIES, type CategoryId } from '../data/categories'
import { MULTI_SOUND_GRAPHEMES } from '../data/patterns'
import type { Mark, Slot, WordAnalysis } from './align'
import { slotCategory, type PatternMatch } from './patterns'

/**
 * The grapheme layer: what the teacher actually marks.
 *
 * A unit is a chunk of letters with the sound or sounds it makes. Usually that is
 * one grapheme for one sound, but three things change the shape:
 *
 *  - One grapheme, several sounds. "x" in box is /k/ + /s/; "qu" is /k/ + /w/.
 *  - Taught chunks collapse. "-ank" is /a/ + /ng/ + /k/ in one column because it
 *    is taught whole. Blends do NOT collapse — they are taught as separable, so
 *    "spl" stays three columns with a tag across them.
 *  - A sound with no letters of its own joins its neighbour, so no column is
 *    ever blank.
 */

export interface GraphemeUnit {
  index: number
  /** The target word's letters for this unit. */
  letters: string
  phonemes: PhonemeId[]
  /** Half-open range of phoneme slots this unit covers. */
  startSlot: number
  endSlot: number
  category: CategoryId
  /** Set when this unit is a taught pattern collapsed into one column. */
  patternId?: string
  patternLabel?: string
  /** Stable identity for report rows: the same spelling AND the same sounds. */
  key: string
}

export interface UnitResult {
  unit: GraphemeUnit
  studentLetters: string
  studentPhonemes: PhonemeId[]
  mark: Mark
  /** True when the teacher edited any sound inside this unit. */
  overridden: boolean
  slots: Slot[]
}

export function unitKey(letters: string, phonemes: PhonemeId[]): string {
  return `${letters || '∅'}|${phonemes.join('+')}`
}

function matchesMultiSound(graphemes: string[], phonemes: PhonemeId[], start: number) {
  for (const entry of MULTI_SOUND_GRAPHEMES) {
    const end = start + entry.phonemes.length
    if (end > phonemes.length) continue
    if (!entry.phonemes.every((p, i) => phonemes[start + i] === p)) continue
    // The letters may sit on either slot ("q"+"u") or all on one ("" + "x").
    const letters = graphemes.slice(start, end).join('').toLowerCase()
    const wanted = entry.letters.replace('_', '')
    if (letters === entry.letters || letters === wanted) return end
  }
  return 0
}

/**
 * Chooses the category for a unit. A collapsed pattern keeps its own; otherwise
 * the spelling decides, exactly as it does for a single sound.
 */
function unitCategory(letters: string, phonemes: PhonemeId[]): CategoryId {
  const first = phonemes.find((p) => !isVowel(p)) ?? phonemes[0]
  // A vowel unit is categorised by its vowel, not by a consonant beside it.
  const lead = isVowel(phonemes[0]) ? phonemes[0] : first
  return slotCategory(lead, letters).category
}

/**
 * Groups a word's phoneme slots into grapheme units.
 *
 * Works by deciding, for each boundary between adjacent slots, whether the two
 * belong to the same unit — every merge rule is a contiguous range, so a simple
 * join-to-next flag is enough.
 */
export function buildUnits(target: WordAnalysis, patterns: PatternMatch[]): GraphemeUnit[] {
  const phonemes = target.targetPhonemes
  const graphemes = target.targetGraphemes
  const count = phonemes.length
  if (count === 0) return []

  const joinToNext = new Array(Math.max(0, count - 1)).fill(false)
  const join = (from: number, to: number) => {
    for (let i = from; i < to - 1 && i < joinToNext.length; i++) joinToNext[i] = true
  }

  // 1. Taught chunks that are marked as a whole.
  const collapsed = patterns.filter((p) => COLLAPSING_CATEGORIES.has(p.category))
  for (const p of collapsed) join(p.start, p.end)

  // 2. One grapheme carrying several sounds.
  for (let i = 0; i < count; i++) {
    const end = matchesMultiSound(graphemes, phonemes, i)
    if (end > i + 1) join(i, end)
  }

  // 3. A sound with no letters of its own must not become an empty column.
  for (let i = 0; i < count; i++) {
    if (graphemes[i] !== '') continue
    if (i < count - 1) joinToNext[i] = true
    else if (i > 0) joinToNext[i - 1] = true
  }

  const units: GraphemeUnit[] = []
  let start = 0
  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1 || !joinToNext[i]
    if (!isLast) continue

    const end = i + 1
    const letters = graphemes.slice(start, end).join('')
    const slice = phonemes.slice(start, end)
    const pattern = collapsed.find((p) => p.start === start && p.end === end)

    units.push({
      index: units.length,
      letters,
      phonemes: slice,
      startSlot: start,
      endSlot: end,
      category: pattern ? pattern.category : unitCategory(letters, slice),
      patternId: pattern?.id,
      patternLabel: pattern?.label,
      key: unitKey(letters, slice),
    })
    start = end
  }

  return units
}

/** Rolls the per-sound marks inside a unit up into one mark for the unit. */
function combineMarks(marks: Mark[]): Mark {
  if (marks.length === 0) return 'omitted'
  if (marks.every((m) => m === 'omitted')) return 'omitted'
  if (marks.every((m) => m === 'exact')) return 'exact'
  if (marks.every((m) => m === 'exact' || m === 'plausible')) return 'plausible'
  return 'wrong'
}

/** What one student did with each unit of the target word. */
export function unitResults(analysis: WordAnalysis, units: GraphemeUnit[]): UnitResult[] {
  return units.map((unit) => {
    const slots = analysis.slots.slice(unit.startSlot, unit.endSlot)
    const letters = slots.map((s) => s.studentGrapheme).join('')

    // The teacher edits a whole column, so an override on the unit's first sound
    // governs the unit. For a one-sound unit this is the same thing.
    if (slots[0]?.overridden) {
      return {
        unit,
        studentLetters: letters,
        studentPhonemes: slots[0].student,
        mark: slots[0].mark,
        overridden: true,
        slots,
      }
    }

    return {
      unit,
      studentLetters: letters,
      studentPhonemes: slots.flatMap((s) => s.student),
      mark: combineMarks(slots.map((s) => s.mark)),
      overridden: slots.some((s) => s.overridden),
      slots,
    }
  })
}

/** Maps a pattern's slot range onto unit indices, for the band above the grid. */
export function patternUnitRange(
  pattern: PatternMatch,
  units: GraphemeUnit[],
): { start: number; end: number } | null {
  const first = units.findIndex((u) => u.endSlot > pattern.start)
  if (first < 0) return null
  let last = first
  for (let i = first; i < units.length; i++) {
    if (units[i].startSlot < pattern.end) last = i
    else break
  }
  return { start: first, end: last + 1 }
}
