import type { PhonemeId } from '../data/phonemes'

/**
 * Handles the one case eSpeak cannot: strings it refuses to read as words.
 *
 * Given something unpronounceable, eSpeak reads out the letter names instead —
 * "splsh" comes back as ess-pee-ell-ess-aitch. That matters because dropping the
 * vowels is a common spelling error, so the engine fails exactly where a struggling
 * student needs analysing.
 *
 * Detection is exact rather than heuristic: we predict what the letter-name reading
 * would be and compare. Repair is a small greedy grapheme reader, used only on this
 * path, so an ordinary word never touches it.
 */

/** Phonemes of each letter's *name*, used to recognise a spelled-out reading. */
const LETTER_NAMES: Record<string, PhonemeId[]> = {
  a: ['AE'],
  b: ['B', 'EE'],
  c: ['S', 'EE'],
  d: ['D', 'EE'],
  e: ['EE'],
  f: ['E', 'F'],
  g: ['J', 'EE'],
  h: ['AE', 'CH'],
  i: ['IE'],
  j: ['J', 'AE'],
  k: ['K', 'AE'],
  l: ['E', 'L'],
  m: ['E', 'M'],
  n: ['E', 'N'],
  o: ['OE'],
  p: ['P', 'EE'],
  q: ['K', 'Y', 'OO'],
  r: ['AR'],
  s: ['E', 'S'],
  t: ['T', 'EE'],
  u: ['Y', 'OO'],
  v: ['V', 'EE'],
  w: ['D', 'U', 'B', 'SCHWA', 'L', 'Y', 'OO'],
  x: ['E', 'K', 'S'],
  y: ['W', 'IE'],
  z: ['Z', 'EE'],
}

/** Most common phoneme for each grapheme. Longest match wins. */
const PRIMARY: Array<[string, PhonemeId[]]> = [
  ['eigh', ['AE']],
  ['augh', ['AW']],
  ['ough', ['OE']],
  ['igh', ['IE']],
  ['tch', ['CH']],
  ['dge', ['J']],
  ['air', ['AIR']],
  ['ear', ['EER']],
  ['ch', ['CH']],
  ['sh', ['SH']],
  ['th', ['TH']],
  ['ph', ['F']],
  ['wh', ['W']],
  ['ck', ['K']],
  ['ng', ['NG']],
  ['qu', ['K', 'W']],
  ['kn', ['N']],
  ['wr', ['R']],
  ['ai', ['AE']],
  ['ay', ['AE']],
  ['ea', ['EE']],
  ['ee', ['EE']],
  ['ie', ['EE']],
  ['oa', ['OE']],
  ['oe', ['OE']],
  ['ow', ['OW']],
  ['ou', ['OW']],
  ['oi', ['OY']],
  ['oy', ['OY']],
  ['oo', ['OO']],
  ['au', ['AW']],
  ['aw', ['AW']],
  ['ew', ['OO']],
  ['ue', ['OO']],
  ['ui', ['OO']],
  ['ey', ['EE']],
  ['ei', ['AE']],
  ['ar', ['AR']],
  ['or', ['OR']],
  ['er', ['ER']],
  ['ir', ['ER']],
  ['ur', ['ER']],
  ['bb', ['B']],
  ['cc', ['K']],
  ['dd', ['D']],
  ['ff', ['F']],
  ['gg', ['G']],
  ['ll', ['L']],
  ['mm', ['M']],
  ['nn', ['N']],
  ['pp', ['P']],
  ['rr', ['R']],
  ['ss', ['S']],
  ['tt', ['T']],
  ['zz', ['Z']],
  ['a', ['A']],
  ['b', ['B']],
  ['c', ['K']],
  ['d', ['D']],
  ['e', ['E']],
  ['f', ['F']],
  ['g', ['G']],
  ['h', ['H']],
  ['i', ['I']],
  ['j', ['J']],
  ['k', ['K']],
  ['l', ['L']],
  ['m', ['M']],
  ['n', ['N']],
  ['o', ['O']],
  ['p', ['P']],
  ['q', ['K']],
  ['r', ['R']],
  ['s', ['S']],
  ['t', ['T']],
  ['u', ['U']],
  ['v', ['V']],
  ['w', ['W']],
  ['x', ['K', 'S']],
  ['y', ['I']],
  ['z', ['Z']],
]

/** What eSpeak would produce if it read `word` out letter by letter. */
function predictSpelledOut(word: string): PhonemeId[] {
  const out: PhonemeId[] = []
  for (const ch of word) {
    const name = LETTER_NAMES[ch]
    if (!name) return []
    out.push(...name)
  }
  return out
}

/**
 * True when the engine gave up and read the letters aloud.
 * Single-letter inputs are exempt: there, the letter name IS the correct reading.
 */
export function isSpelledOut(word: string, phonemes: PhonemeId[]): boolean {
  if (word.length < 2) return false
  const predicted = predictSpelledOut(word)
  if (predicted.length === 0 || predicted.length !== phonemes.length) return false
  return predicted.every((p, i) => p === phonemes[i])
}

/** Greedy grapheme reading, used only to repair a spelled-out result. */
export function fallbackRead(word: string): PhonemeId[] {
  const out: PhonemeId[] = []
  let i = 0
  outer: while (i < word.length) {
    for (const [graph, ids] of PRIMARY) {
      if (word.startsWith(graph, i)) {
        out.push(...ids)
        i += graph.length
        continue outer
      }
    }
    i += 1
  }
  return out
}
