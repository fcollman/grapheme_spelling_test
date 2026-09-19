import type { CategoryId } from './categories'
import type { PhonemeId } from './phonemes'

/**
 * The editable record of every multi-letter spelling and multi-sound pattern the
 * app recognises, and which category each one falls in.
 *
 * This file is the single source of truth. `npm run reference` regenerates
 * PHONEME-CATEGORIES.md from it, and the test suite checks every `example` word
 * against the real phoneme engine — so a wrong `phonemes` list here fails CI
 * rather than quietly mis-tagging a student's work.
 *
 * To adjust: change `category`, edit `phonemes`/`spellings`, or add a row.
 */

/* ------------------------------------------------------------------ *
 * Consonant digraphs — several letters, ONE sound. Slot-level.
 * ------------------------------------------------------------------ */

export type DigraphSubtype =
  /** The classic seven taught early. */
  | 'digraph'
  /** Three letters, one sound. */
  | 'trigraph'
  /** One letter of the team is silent. */
  | 'silent-team'
  /** Later-grade spellings of /sh/ and /zh/ inside words like nation, vision. */
  | 'advanced'

export interface DigraphEntry {
  spelling: string
  phoneme: PhonemeId
  subtype: DigraphSubtype
  example: string
  /** Set when the classification is a judgement call worth your review. */
  review?: string
}

export const CONSONANT_DIGRAPHS: DigraphEntry[] = [
  // --- the classic digraphs ---
  { spelling: 'sh', phoneme: 'SH', subtype: 'digraph', example: 'ship' },
  { spelling: 'ch', phoneme: 'CH', subtype: 'digraph', example: 'chip' },
  { spelling: 'ch', phoneme: 'K', subtype: 'digraph', example: 'school' },
  { spelling: 'ch', phoneme: 'SH', subtype: 'digraph', example: 'chef' },
  { spelling: 'th', phoneme: 'TH', subtype: 'digraph', example: 'thin' },
  { spelling: 'th', phoneme: 'DH', subtype: 'digraph', example: 'this' },
  { spelling: 'wh', phoneme: 'W', subtype: 'digraph', example: 'when' },
  { spelling: 'wh', phoneme: 'H', subtype: 'digraph', example: 'who' },
  { spelling: 'ph', phoneme: 'F', subtype: 'digraph', example: 'phone' },
  { spelling: 'ck', phoneme: 'K', subtype: 'digraph', example: 'duck' },
  { spelling: 'ng', phoneme: 'NG', subtype: 'digraph', example: 'ring' },
  { spelling: 'gh', phoneme: 'F', subtype: 'digraph', example: 'laugh' },

  // --- three letters, one sound ---
  { spelling: 'tch', phoneme: 'CH', subtype: 'trigraph', example: 'catch' },
  { spelling: 'dge', phoneme: 'J', subtype: 'trigraph', example: 'bridge' },

  // --- silent-letter teams ---
  { spelling: 'kn', phoneme: 'N', subtype: 'silent-team', example: 'knee' },
  { spelling: 'gn', phoneme: 'N', subtype: 'silent-team', example: 'gnat' },
  { spelling: 'wr', phoneme: 'R', subtype: 'silent-team', example: 'wrist' },
  { spelling: 'mb', phoneme: 'M', subtype: 'silent-team', example: 'thumb' },
  { spelling: 'mn', phoneme: 'M', subtype: 'silent-team', example: 'column' },
  { spelling: 'lk', phoneme: 'K', subtype: 'silent-team', example: 'walk' },
  { spelling: 'lf', phoneme: 'F', subtype: 'silent-team', example: 'half' },
  { spelling: 'lm', phoneme: 'M', subtype: 'silent-team', example: 'calm' },
  { spelling: 'ps', phoneme: 'S', subtype: 'silent-team', example: 'psalm' },
  { spelling: 'bt', phoneme: 'T', subtype: 'silent-team', example: 'debt' },
  { spelling: 'st', phoneme: 'S', subtype: 'silent-team', example: 'listen' },

  // --- advanced /sh/ and /zh/ spellings ---
  {
    spelling: 'ti',
    phoneme: 'SH',
    subtype: 'advanced',
    example: 'nation',
    review: 'Usually taught as a suffix spelling (-tion), not as a consonant digraph.',
  },
  {
    spelling: 'ci',
    phoneme: 'SH',
    subtype: 'advanced',
    example: 'special',
    review: 'Usually taught as a suffix spelling (-cial), not as a consonant digraph.',
  },
  {
    spelling: 'si',
    phoneme: 'ZH',
    subtype: 'advanced',
    example: 'vision',
    review: 'Usually taught as a suffix spelling (-sion), not as a consonant digraph.',
  },
  {
    spelling: 'ssi',
    phoneme: 'SH',
    subtype: 'advanced',
    example: 'mission',
    review: 'Usually taught as a suffix spelling (-ssion), not as a consonant digraph.',
  },
]

/* ------------------------------------------------------------------ *
 * Span patterns — one teaching unit spread over several sounds.
 * ------------------------------------------------------------------ */

export interface SpanPattern {
  id: string
  category: CategoryId
  /** What the teacher calls it, e.g. "-ank" or "cl / kl". */
  label: string
  /** The sounds that must appear consecutively, in order. */
  phonemes: PhonemeId[]
  /** Additional accepted sound sequences, for dialect or engine variation. */
  also?: PhonemeId[][]
  /** Common spellings. Informational unless `requireSpelling` is set. */
  spellings: string[]
  /** When true, the letters the student's word actually uses must match. */
  requireSpelling?: boolean
  /** Where in the syllable this pattern must sit. */
  position: 'onset' | 'coda' | 'syllable-end' | 'word-end' | 'any'
  example: string
  review?: string
}

/** -ang, -ing, -ong, -ung, -ank, -ink, -onk, -unk. */
const VELAR_NASAL: SpanPattern[] = [
  { id: 'vn-ang', category: 'velar-nasal', label: '-ang', phonemes: ['A', 'NG'], spellings: ['ang'], position: 'syllable-end', example: 'bang' },
  { id: 'vn-ing', category: 'velar-nasal', label: '-ing', phonemes: ['I', 'NG'], spellings: ['ing'], position: 'syllable-end', example: 'sing' },
  // The whole reason these are taught as units is that the vowel shifts before
  // /ng/. It really does: "song" is /sɔŋ/, not /sɑŋ/ — the engine confirms it.
  // The short-o variant is accepted too, for cot-caught merged speakers.
  { id: 'vn-ong', category: 'velar-nasal', label: '-ong', phonemes: ['AW', 'NG'], also: [['O', 'NG']], spellings: ['ong'], position: 'syllable-end', example: 'song' },
  { id: 'vn-ung', category: 'velar-nasal', label: '-ung', phonemes: ['U', 'NG'], spellings: ['ung'], position: 'syllable-end', example: 'sung' },
  { id: 'vn-ank', category: 'velar-nasal', label: '-ank', phonemes: ['A', 'NG', 'K'], spellings: ['ank'], position: 'syllable-end', example: 'bank' },
  { id: 'vn-ink', category: 'velar-nasal', label: '-ink', phonemes: ['I', 'NG', 'K'], spellings: ['ink'], position: 'syllable-end', example: 'pink' },
  { id: 'vn-onk', category: 'velar-nasal', label: '-onk', phonemes: ['AW', 'NG', 'K'], also: [['O', 'NG', 'K']], spellings: ['onk'], position: 'syllable-end', example: 'honk' },
  { id: 'vn-unk', category: 'velar-nasal', label: '-unk', phonemes: ['U', 'NG', 'K'], spellings: ['unk'], position: 'syllable-end', example: 'junk' },
]

/** The "kind old" family: vowel goes long in a syllable that looks closed. */
const KIND_OLD: SpanPattern[] = [
  { id: 'ko-ind', category: 'kind-old', label: '-ind', phonemes: ['IE', 'N', 'D'], spellings: ['ind'], requireSpelling: true, position: 'syllable-end', example: 'kind' },
  { id: 'ko-ild', category: 'kind-old', label: '-ild', phonemes: ['IE', 'L', 'D'], spellings: ['ild'], requireSpelling: true, position: 'syllable-end', example: 'wild' },
  { id: 'ko-old', category: 'kind-old', label: '-old', phonemes: ['OE', 'L', 'D'], spellings: ['old'], requireSpelling: true, position: 'syllable-end', example: 'cold' },
  { id: 'ko-olt', category: 'kind-old', label: '-olt', phonemes: ['OE', 'L', 'T'], spellings: ['olt'], requireSpelling: true, position: 'syllable-end', example: 'colt' },
  { id: 'ko-ost', category: 'kind-old', label: '-ost', phonemes: ['OE', 'S', 'T'], spellings: ['ost'], requireSpelling: true, position: 'syllable-end', example: 'most' },
  {
    id: 'ko-oll',
    category: 'kind-old',
    label: '-oll',
    phonemes: ['OE', 'L'],
    spellings: ['oll'],
    requireSpelling: true,
    position: 'syllable-end',
    example: 'roll',
    review: 'Some programs teach -oll with the kind/old family, others with the floss rule. Included here.',
  },
]

/**
 * Beginning blends. Keyed on SOUNDS, so "cl" and "kl" are the same pattern and
 * share a row — the label lists the spellings a teacher would recognise.
 */
const BLENDS_INITIAL: SpanPattern[] = [
  // l-blends
  { id: 'bi-bl', category: 'blend-initial', label: 'bl', phonemes: ['B', 'L'], spellings: ['bl'], position: 'onset', example: 'black' },
  { id: 'bi-kl', category: 'blend-initial', label: 'cl / kl', phonemes: ['K', 'L'], spellings: ['cl', 'kl'], position: 'onset', example: 'clap' },
  { id: 'bi-fl', category: 'blend-initial', label: 'fl', phonemes: ['F', 'L'], spellings: ['fl'], position: 'onset', example: 'flag' },
  { id: 'bi-gl', category: 'blend-initial', label: 'gl', phonemes: ['G', 'L'], spellings: ['gl'], position: 'onset', example: 'glad' },
  { id: 'bi-pl', category: 'blend-initial', label: 'pl', phonemes: ['P', 'L'], spellings: ['pl'], position: 'onset', example: 'plan' },
  { id: 'bi-sl', category: 'blend-initial', label: 'sl', phonemes: ['S', 'L'], spellings: ['sl'], position: 'onset', example: 'slip' },

  // r-blends
  { id: 'bi-br', category: 'blend-initial', label: 'br', phonemes: ['B', 'R'], spellings: ['br'], position: 'onset', example: 'brag' },
  { id: 'bi-kr', category: 'blend-initial', label: 'cr / kr', phonemes: ['K', 'R'], spellings: ['cr', 'kr'], position: 'onset', example: 'crab' },
  { id: 'bi-dr', category: 'blend-initial', label: 'dr', phonemes: ['D', 'R'], spellings: ['dr'], position: 'onset', example: 'drum' },
  { id: 'bi-fr', category: 'blend-initial', label: 'fr', phonemes: ['F', 'R'], spellings: ['fr'], position: 'onset', example: 'frog' },
  { id: 'bi-gr', category: 'blend-initial', label: 'gr', phonemes: ['G', 'R'], spellings: ['gr'], position: 'onset', example: 'grab' },
  { id: 'bi-pr', category: 'blend-initial', label: 'pr', phonemes: ['P', 'R'], spellings: ['pr'], position: 'onset', example: 'prop' },
  { id: 'bi-tr', category: 'blend-initial', label: 'tr', phonemes: ['T', 'R'], spellings: ['tr'], position: 'onset', example: 'trip' },

  // s-blends
  { id: 'bi-sk', category: 'blend-initial', label: 'sc / sk', phonemes: ['S', 'K'], spellings: ['sc', 'sk'], position: 'onset', example: 'skip' },
  { id: 'bi-sm', category: 'blend-initial', label: 'sm', phonemes: ['S', 'M'], spellings: ['sm'], position: 'onset', example: 'smell' },
  { id: 'bi-sn', category: 'blend-initial', label: 'sn', phonemes: ['S', 'N'], spellings: ['sn'], position: 'onset', example: 'snap' },
  { id: 'bi-sp', category: 'blend-initial', label: 'sp', phonemes: ['S', 'P'], spellings: ['sp'], position: 'onset', example: 'spin' },
  { id: 'bi-st', category: 'blend-initial', label: 'st', phonemes: ['S', 'T'], spellings: ['st'], position: 'onset', example: 'stop' },
  { id: 'bi-sw', category: 'blend-initial', label: 'sw', phonemes: ['S', 'W'], spellings: ['sw'], position: 'onset', example: 'swim' },

  // w-blends
  { id: 'bi-tw', category: 'blend-initial', label: 'tw', phonemes: ['T', 'W'], spellings: ['tw'], position: 'onset', example: 'twin' },
  { id: 'bi-dw', category: 'blend-initial', label: 'dw', phonemes: ['D', 'W'], spellings: ['dw'], position: 'onset', example: 'dwell' },
  { id: 'bi-kw', category: 'blend-initial', label: 'qu', phonemes: ['K', 'W'], spellings: ['qu'], position: 'onset', example: 'quick' },

  // blends built on a digraph
  { id: 'bi-shr', category: 'blend-initial', label: 'shr', phonemes: ['SH', 'R'], spellings: ['shr'], position: 'onset', example: 'shrub' },
  { id: 'bi-thr', category: 'blend-initial', label: 'thr', phonemes: ['TH', 'R'], spellings: ['thr'], position: 'onset', example: 'three' },

  // three-sound onsets
  { id: 'bi-skr', category: 'blend-initial', label: 'scr', phonemes: ['S', 'K', 'R'], spellings: ['scr'], position: 'onset', example: 'scrap' },
  { id: 'bi-spl', category: 'blend-initial', label: 'spl', phonemes: ['S', 'P', 'L'], spellings: ['spl'], position: 'onset', example: 'splash' },
  { id: 'bi-spr', category: 'blend-initial', label: 'spr', phonemes: ['S', 'P', 'R'], spellings: ['spr'], position: 'onset', example: 'spring' },
  { id: 'bi-str', category: 'blend-initial', label: 'str', phonemes: ['S', 'T', 'R'], spellings: ['str'], position: 'onset', example: 'strap' },
  { id: 'bi-skw', category: 'blend-initial', label: 'squ', phonemes: ['S', 'K', 'W'], spellings: ['squ'], position: 'onset', example: 'squish' },
]

/**
 * Ending blends.
 *
 * NOTE: -rd, -rk, -rm, -rn, -rt are deliberately absent. In American English the
 * /r/ merges into the vowel, so "card" is /k/ /ar/ /d/ — there is no /r/ sound
 * left to blend. Those are tagged r-controlled instead.
 */
const BLENDS_FINAL: SpanPattern[] = [
  { id: 'bf-ct', category: 'blend-final', label: '-ct', phonemes: ['K', 'T'], spellings: ['ct'], position: 'coda', example: 'act' },
  { id: 'bf-ft', category: 'blend-final', label: '-ft', phonemes: ['F', 'T'], spellings: ['ft'], position: 'coda', example: 'left' },
  { id: 'bf-ld', category: 'blend-final', label: '-ld', phonemes: ['L', 'D'], spellings: ['ld'], position: 'coda', example: 'held' },
  { id: 'bf-lf', category: 'blend-final', label: '-lf', phonemes: ['L', 'F'], spellings: ['lf'], position: 'coda', example: 'elf' },
  { id: 'bf-lk', category: 'blend-final', label: '-lk', phonemes: ['L', 'K'], spellings: ['lk'], position: 'coda', example: 'milk' },
  { id: 'bf-lp', category: 'blend-final', label: '-lp', phonemes: ['L', 'P'], spellings: ['lp'], position: 'coda', example: 'help' },
  { id: 'bf-lt', category: 'blend-final', label: '-lt', phonemes: ['L', 'T'], spellings: ['lt'], position: 'coda', example: 'belt' },
  { id: 'bf-mp', category: 'blend-final', label: '-mp', phonemes: ['M', 'P'], spellings: ['mp'], position: 'coda', example: 'jump' },
  { id: 'bf-nd', category: 'blend-final', label: '-nd', phonemes: ['N', 'D'], spellings: ['nd'], position: 'coda', example: 'hand' },
  { id: 'bf-nk', category: 'blend-final', label: '-nk', phonemes: ['NG', 'K'], spellings: ['nk'], position: 'coda', example: 'pink', review: 'Also covered by the velar nasal units; both tags apply.' },
  { id: 'bf-nt', category: 'blend-final', label: '-nt', phonemes: ['N', 'T'], spellings: ['nt'], position: 'coda', example: 'tent' },
  { id: 'bf-pt', category: 'blend-final', label: '-pt', phonemes: ['P', 'T'], spellings: ['pt'], position: 'coda', example: 'kept' },
  { id: 'bf-sk', category: 'blend-final', label: '-sk', phonemes: ['S', 'K'], spellings: ['sk'], position: 'coda', example: 'desk' },
  { id: 'bf-sp', category: 'blend-final', label: '-sp', phonemes: ['S', 'P'], spellings: ['sp'], position: 'coda', example: 'wasp' },
  { id: 'bf-st', category: 'blend-final', label: '-st', phonemes: ['S', 'T'], spellings: ['st'], position: 'coda', example: 'best' },
  { id: 'bf-nch', category: 'blend-final', label: '-nch', phonemes: ['N', 'CH'], spellings: ['nch'], position: 'coda', example: 'lunch' },
  { id: 'bf-lch', category: 'blend-final', label: '-lch', phonemes: ['L', 'CH'], spellings: ['lch'], position: 'coda', example: 'belch' },
  { id: 'bf-xt', category: 'blend-final', label: '-xt', phonemes: ['K', 'S', 'T'], spellings: ['xt'], position: 'coda', example: 'next' },
]

export const SPAN_PATTERNS: SpanPattern[] = [
  ...VELAR_NASAL,
  ...KIND_OLD,
  ...BLENDS_INITIAL,
  ...BLENDS_FINAL,
]

/**
 * Consonant-le is matched structurally rather than listed, because the pattern is
 * "any consonant + le as the final syllable" and enumerating it adds nothing. The
 * consonants that actually occur are listed here for the reference document.
 */
export const CONSONANT_LE_EXAMPLES = [
  '-ble (table)', '-cle (uncle)', '-dle (candle)', '-fle (waffle)', '-gle (bugle)',
  '-kle (pickle)', '-ple (apple)', '-sle (measles)', '-tle (little)', '-zle (puzzle)',
]

/* ------------------------------------------------------------------ *
 * One grapheme, more than one sound.
 * ------------------------------------------------------------------ */

export interface MultiSoundGrapheme {
  letters: string
  phonemes: PhonemeId[]
  example: string
  note?: string
}

/**
 * Spellings where a single letter team makes two sounds, so the grid shows one
 * column carrying both. Without these, "box" would show an empty column for the
 * /k/ and put the whole "x" on the /s/.
 */
export const MULTI_SOUND_GRAPHEMES: MultiSoundGrapheme[] = [
  { letters: 'x', phonemes: ['K', 'S'], example: 'box' },
  { letters: 'x', phonemes: ['G', 'Z'], example: 'exam', note: 'The voiced reading of x, as in exam and exact.' },
  { letters: 'qu', phonemes: ['K', 'W'], example: 'quick' },
  { letters: 'u', phonemes: ['Y', 'OO'], example: 'music', note: 'The "long u" that really says /y/ + /oo/.' },
  { letters: 'u_e', phonemes: ['Y', 'OO'], example: 'cube' },
  { letters: 'ew', phonemes: ['Y', 'OO'], example: 'few' },
  { letters: 'ue', phonemes: ['Y', 'OO'], example: 'cue' },
  { letters: 'eu', phonemes: ['Y', 'OO'], example: 'feud' },
]

export const DIGRAPH_LOOKUP = new Map<string, DigraphEntry[]>()
for (const d of CONSONANT_DIGRAPHS) {
  const list = DIGRAPH_LOOKUP.get(d.spelling) ?? []
  list.push(d)
  DIGRAPH_LOOKUP.set(d.spelling, list)
}
