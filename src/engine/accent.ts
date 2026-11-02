import { phonemeDistance } from './distance'
import type { PhonemeId } from '../data/phonemes'

/**
 * Pronunciations that differ from the page by accent rather than by decoding.
 *
 * Only reading needs this. When a student spells a word, the sound they meant is
 * inferred from letters and an accent barely shows; when they read one aloud, it
 * is the whole signal, and a teacher marking a Vermont classroom will hear
 * perfectly good decoding that does not match the dictionary.
 *
 * This is a short, named list rather than a distance threshold on purpose.
 * `phonemeDistance` charges voicing alone at 0.2, so any threshold loose enough
 * to forgive a regional vowel also forgives /th/ for /f/ — "free" for "three" —
 * which is exactly the error a reading teacher is looking for. Every other
 * leniency rule in this engine names the mechanism it forgives, and so does
 * this one.
 *
 * Seeded for northern New England and meant to be argued with: a teacher who
 * disagrees with any single call can override that slot, and a pattern that
 * turns out to be wrong for a class belongs here rather than in the data.
 */
const ACCENT_VARIANTS: ReadonlyArray<readonly [PhonemeId, PhonemeId]> = [
  // The cot-caught merger: much of New England does not distinguish them.
  ['O', 'AW'],
  // "-ing" said as "-in'", which is register rather than decoding.
  ['NG', 'N'],
  /*
   * The r-dropping the region is known for: "car" as "cah", "for" as "faw",
   * "butter" as "buttah". The r-controlled vowels are single phonemes here, so
   * dropping the r lands on the plain vowel beside it.
   */
  ['AR', 'A'],
  ['AR', 'AW'],
  // "cah" lands on the LOT vowel once the r is gone, which is what eSpeak reads.
  ['AR', 'O'],
  ['OR', 'AW'],
  ['ER', 'SCHWA'],
]

/**
 * A guard against the table, not against the student.
 *
 * A pair typed in wrongly — a consonant opposite a vowel, say — would quietly
 * forgive a real decoding error on every word it touched. Requiring the pair to
 * be phonetically close as well means a mistake in the list above costs a
 * leniency rule rather than the report's meaning.
 */
const MAX_VARIANT_DISTANCE = 0.65

const variants = new Set(
  ACCENT_VARIANTS.filter(([a, b]) => phonemeDistance(a, b) <= MAX_VARIANT_DISTANCE).flatMap(
    ([a, b]) => [`${a}|${b}`, `${b}|${a}`],
  ),
)

/** Whether saying `said` where `target` was written is an accent, not an error. */
export function isAccentVariant(target: PhonemeId, said: PhonemeId): boolean {
  return variants.has(`${target}|${said}`)
}
