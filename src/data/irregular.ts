import type { PhonemeId } from './phonemes'

/**
 * Red words — the letters that have to be memorised.
 *
 * A "red word" (also heart word, trick word) is one where part of the spelling
 * makes a sound it does not usually make, so no amount of sounding out gets you
 * there. What is irregular is almost never the whole word: in *their* the `th`
 * behaves perfectly and only the `eir` is odd, and a student who writes "thar"
 * has the digraph right and the memorised part wrong.
 *
 * So this table lists **graphemes, not words**. That works because a unit's
 * identity in this app is already its letters plus the sounds they make, which
 * means the irregular pair and its regular twin are separate things to begin
 * with: `ai` saying /e/ in *said* is not the same entry as `ai` saying /ā/ in
 * *rain*. Anything listed here is tagged `red-word` instead of the phonics
 * category it would otherwise land in, so a miss on it stops counting against a
 * skill the student may well have.
 *
 * **Not the same table as `graphemes.ts`.** That one exists to split a spelling
 * against a known pronunciation and deliberately mixes regular and irregular
 * correspondences in one flat list — `ai` appears under /e/ there so that *said*
 * can be segmented at all. This one is about classification. An entry here that
 * `graphemes.ts` cannot produce would never fire, which is why the test suite
 * runs every `example` below through the real engine.
 *
 * It does not have to be complete. An irregular pair that is missing simply
 * behaves the way it does today, which is the behaviour this feature improves
 * on rather than replaces.
 */

export interface IrregularEntry {
  /** The letters, as they appear in the word. */
  letters: string
  /** The sound or sounds they make here — the part that has to be memorised. */
  phonemes: PhonemeId[]
  /** A word this pair occurs in. Checked against the real engine in CI. */
  example: string
  /** More words with the same pair, to show the family is worth teaching. */
  also?: string[]
  /** Set when including it is a judgement call worth your review. */
  review?: string
}

export const IRREGULAR: IrregularEntry[] = [
  /* ---------------- vowels saying a short sound ---------------- */
  { letters: 'ai', phonemes: ['E'], example: 'said', also: ['again'] },
  { letters: 'ie', phonemes: ['E'], example: 'friend' },
  { letters: 'a', phonemes: ['E'], example: 'any', also: ['many'] },
  {
    letters: 'ea',
    phonemes: ['E'],
    example: 'head',
    also: ['bread', 'dead', 'breath', 'weather'],
    review:
      'Some programs teach ea/e as a second sound of the ea team rather than as a red word. There are enough of these words that tagging them all red may overstate it — say the word and this line comes out.',
  },
  { letters: 'o', phonemes: ['U'], example: 'come', also: ['some', 'done', 'love', 'front', 'month'] },
  { letters: 'a', phonemes: ['U'], example: 'was', also: ['what'] },
  { letters: 'oe', phonemes: ['U'], example: 'does' },
  { letters: 'ou', phonemes: ['U'], example: 'enough', also: ['country', 'young', 'touch'] },
  { letters: 'ee', phonemes: ['I'], example: 'been' },
  { letters: 'u', phonemes: ['I'], example: 'busy', also: ['build'] },

  /* ---------------- vowels saying a long or other sound ---------------- */
  { letters: 'eo', phonemes: ['EE'], example: 'people' },
  {
    letters: 'ey',
    phonemes: ['AE'],
    example: 'they',
    also: ['grey', 'obey'],
    review:
      'ey/ā is regular enough in they, grey and obey that some programs teach it as a vowel team. Kept because "they" is on every red-word list.',
  },
  { letters: 'ough', phonemes: ['OE'], example: 'though' },
  { letters: 'ough', phonemes: ['OO'], example: 'through' },
  { letters: 'eye', phonemes: ['IE'], example: 'eye' },
  { letters: 'wo', phonemes: ['OO'], example: 'two' },
  { letters: 'o', phonemes: ['OO'], example: 'who', also: ['do', 'to'] },
  { letters: 'ou', phonemes: ['UU'], example: 'could', also: ['would', 'should'] },
  { letters: 'au', phonemes: ['A'], example: 'laugh' },

  /* ---------------- r-controlled ---------------- */
  { letters: 'eir', phonemes: ['AIR'], example: 'their' },
  { letters: 'ere', phonemes: ['AIR'], example: 'there', also: ['where'] },
  {
    letters: 'our',
    phonemes: ['OR'],
    example: 'four',
    also: ['pour', 'court'],
    review:
      'our/or turns up in a whole family (four, pour, court, your), so it could reasonably be taught as an r-controlled team instead of word by word.',
  },

  /* ---------------- consonants ---------------- */
  { letters: 'f', phonemes: ['V'], example: 'of' },
  { letters: 'o', phonemes: ['W'], example: 'one' },
  { letters: 'o', phonemes: ['W', 'U'], example: 'once' },
]

/**
 * Keyed the same way a grapheme unit is, `letters|sounds` — "ai|E", "o|W+U" —
 * so a unit can be tested against it directly without rebuilding the key.
 *
 * Deliberately built here rather than imported from engine/units, which would
 * make a data file depend on the engine.
 */
export const IRREGULAR_UNITS = new Set(
  IRREGULAR.map((e) => `${e.letters || '∅'}|${e.phonemes.join('+')}`),
)

/**
 * Whether this table expects these letters to make this sound.
 *
 * A suggestion, never a verdict. Nothing is treated as a Red Word until the
 * teacher marks the word as one, because "unexpected" is relative to what the
 * class has been taught so far — the same spelling can be unexpected in October
 * and explicitly taught by March. All this does is offer a starting point for
 * which part of a word the teacher probably means.
 */
export function isIrregular(letters: string, phonemes: PhonemeId[]): boolean {
  return IRREGULAR_UNITS.has(`${letters || '∅'}|${phonemes.join('+')}`)
}
