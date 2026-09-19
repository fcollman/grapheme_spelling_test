import type { PhonemeId } from './phonemes'

/**
 * Common spellings for each phoneme.
 *
 * This is deliberately NOT a full grapheme-phoneme-correspondence engine. The
 * phoneme sequence is already known (eSpeak gives it), so this table only has to
 * *segment* a known spelling against a known pronunciation. Gaps degrade to the
 * permissive fallback in segment.ts rather than producing a wrong answer, which is
 * why it can stay small.
 */
export const GRAPHEMES: Record<PhonemeId, string[]> = {
  P: ['p', 'pp'],
  B: ['b', 'bb'],
  T: ['t', 'tt', 'ed', 'bt'],
  D: ['d', 'dd', 'ed'],
  K: ['c', 'k', 'ck', 'ch', 'cc', 'que', 'q', 'lk'],
  G: ['g', 'gg', 'gu', 'gh'],

  F: ['f', 'ff', 'ph', 'gh', 'lf'],
  V: ['v', 'vv', 've', 'f'],
  TH: ['th'],
  DH: ['th', 'the'],
  S: ['s', 'ss', 'c', 'ce', 'se', 'sc', 'ps', 'st'],
  Z: ['z', 'zz', 's', 'se', 'ss', 'ze', 'x'],
  SH: ['sh', 'ti', 'ci', 'ssi', 'si', 'ch', 'ce', 's'],
  ZH: ['s', 'si', 'g', 'ge', 'z'],
  H: ['h', 'wh'],

  CH: ['ch', 'tch', 't', 'tu', 'te'],
  J: ['j', 'g', 'dge', 'ge', 'dg', 'd', 'di'],

  M: ['m', 'mm', 'mb', 'mn', 'lm'],
  N: ['n', 'nn', 'kn', 'gn', 'pn'],
  NG: ['ng', 'n', 'ngue'],

  L: ['l', 'll', 'le', 'el', 'al', 'il'],
  R: ['r', 'rr', 'wr', 'rh'],

  W: ['w', 'wh', 'u', 'o'],
  Y: ['y', 'i', 'j', 'll'],

  A: ['a', 'au', 'ai'],
  E: ['e', 'ea', 'ai', 'ie', 'a', 'ue', 'eo'],
  I: ['i', 'y', 'e', 'u', 'ui', 'ee', 'ie', 'a'],
  O: ['o', 'a', 'ho', 'ow', 'ach'],
  U: ['u', 'o', 'ou', 'oo', 'oe'],

  AE: ['a', 'ai', 'ay', 'a_e', 'ea', 'ei', 'eigh', 'ey', 'et', 'aigh'],
  EE: ['e', 'ee', 'ea', 'y', 'ie', 'ey', 'i', 'e_e', 'ei', 'eo'],
  IE: ['i', 'igh', 'y', 'i_e', 'ie', 'uy', 'eigh', 'ye', 'ai'],
  OE: ['o', 'oa', 'ow', 'o_e', 'oe', 'ough', 'eau', 'ou', 'ew'],

  OO: ['oo', 'u', 'ou', 'ew', 'ue', 'o', 'ui', 'ough', 'oe', 'u_e', 'o_e'],
  UU: ['oo', 'u', 'ou', 'o'],

  AR: ['ar', 'a', 'ear', 'er', 'uar'],
  OR: ['or', 'ore', 'oar', 'our', 'aw', 'au', 'ar', 'oor', 'oure', 'ough'],
  ER: ['er', 'ir', 'ur', 'ear', 'or', 'ar', 'our', 'yr', 're', 'ure', 'ere'],
  AIR: ['air', 'are', 'ear', 'ere', 'eir', 'ar', 'er', 'a'],
  EER: ['eer', 'ear', 'ere', 'ier', 'er', 'ir', 'eir'],
  OOR: ['oor', 'ure', 'our', 'ur', 'ou'],

  OW: ['ow', 'ou', 'ough'],
  OY: ['oi', 'oy'],
  AW: ['aw', 'au', 'augh', 'ough', 'a', 'al', 'o', 'ough', 'oa'],

  SCHWA: ['a', 'e', 'i', 'o', 'u', 'ou', 'io', 'ai', 'ea', 'ar', 'er', 'or', 'ure', 'le'],
}

/** Lookup set per phoneme, for O(1) membership tests during segmentation. */
export const GRAPHEME_SETS: Record<PhonemeId, Set<string>> = Object.fromEntries(
  Object.entries(GRAPHEMES).map(([id, list]) => [id, new Set(list)]),
) as Record<PhonemeId, Set<string>>

/** Longest listed grapheme, which bounds how many letters one slot may take. */
export const MAX_GRAPHEME_LEN = 4
