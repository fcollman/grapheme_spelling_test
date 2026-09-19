import type { PhonemeId } from '../data/phonemes'
import { isVowel } from '../data/phonemes'

/**
 * Turns eSpeak NG's run-together en-us IPA into our display inventory.
 *
 * eSpeak emits a continuous string with no phoneme separators, so we longest-match
 * against a symbol table. Three eSpeak behaviours need explicit handling, each
 * confirmed against real engine output rather than assumed:
 *
 *  - American flapping: water -> wˈɔːɾɚ, city -> sˈɪɾi. The flap ɾ is folded to /t/.
 *    Consequence worth knowing: eSpeak flaps intervocalic /d/ the same way, so a
 *    "ladder"/"latter" style t-d contrast is invisible in that position.
 *  - r-controlled vowels are written as two symbols (car -> kˈɑːɹ) but only when the
 *    /r/ closes the syllable. mergeRControlled below therefore merges V+/r/ only when
 *    no vowel follows, so spirit -> /s/ /p/ /i/ /r/ /i/ /t/ keeps its /r/ while
 *    car -> /k/ /ar/ collapses.
 *  - Stress marks sit immediately before the vowel, not before the syllable onset
 *    (blorf -> blˈoːɹf), so a mark attaches to the phoneme that follows it.
 */

export interface NormalizedWord {
  phonemes: PhonemeId[]
  /** Parallel to phonemes: 0 = unstressed, 1 = primary, 2 = secondary. */
  stress: number[]
  /** IPA fragments we could not map. Should stay empty; asserted in tests. */
  unknown: string[]
  raw: string
}

/** Longest-match wins, so this is sorted by length at module load. */
const SYMBOL_TABLE: Array<[string, PhonemeId[]]> = [
  // diphthong + r-coloured schwa: two phonemes, not one
  ['aɪɚ', ['IE', 'ER']],
  ['aʊɚ', ['OW', 'ER']],

  // affricates before their component parts
  ['tʃ', ['CH']],
  ['dʒ', ['J']],

  // diphthongs before their component vowels
  ['eɪ', ['AE']],
  ['aɪ', ['IE']],
  ['oʊ', ['OE']],
  ['aʊ', ['OW']],
  ['ɔɪ', ['OY']],

  // long/short vowel pairs that differ only by the length mark
  ['ɜː', ['ER']],
  ['iː', ['EE']],
  ['uː', ['OO']],
  ['ɑː', ['O']],
  ['ɔː', ['AW']],
  ['oː', ['AW']],
  ['ɛː', ['AIR']],

  ['ɚ', ['ER']],
  ['ɜ', ['ER']],

  // single-symbol vowels
  ['æ', ['A']],
  ['ɛ', ['E']],
  ['ɪ', ['I']],
  ['ʌ', ['U']],
  ['ʊ', ['UU']],
  ['ə', ['SCHWA']],
  ['ɐ', ['SCHWA']], // eSpeak's unstressed near-open vowel: about -> ɐbˈaʊt
  ['ɑ', ['O']],
  ['ɔ', ['AW']],
  ['a', ['A']],
  ['e', ['E']],
  ['i', ['EE']], // unstressed final: happy -> hˈæpi
  ['o', ['OE']],
  ['u', ['OO']],

  // consonants
  ['ɹ', ['R']],
  ['r', ['R']],
  ['j', ['Y']],
  ['ɡ', ['G']],
  ['g', ['G']],
  ['θ', ['TH']],
  ['ð', ['DH']],
  ['ʃ', ['SH']],
  ['ʒ', ['ZH']],
  ['ŋ', ['NG']],
  ['ɾ', ['T']], // American flap
  ['ɫ', ['L']], // dark l
  ['ʔ', ['T']], // glottal stop realisation of /t/
  ['p', ['P']],
  ['b', ['B']],
  ['t', ['T']],
  ['d', ['D']],
  ['k', ['K']],
  ['f', ['F']],
  ['v', ['V']],
  ['s', ['S']],
  ['z', ['Z']],
  ['m', ['M']],
  ['n', ['N']],
  ['l', ['L']],
  ['w', ['W']],
  ['h', ['H']],
  ['x', ['K']], // loch
]

const SYMBOLS = [...SYMBOL_TABLE].sort((a, b) => b[0].length - a[0].length)

/** Symbols carrying no phonemic content of their own. */
const SKIP = new Set(['ː', 'ˑ', '̩', '̃', '͡', '-', '_', "'", '’', '.', ',', '!', '?', ';', ':', '(', ')'])

/** Vowel + /r/ in the coda becomes one r-controlled phoneme. */
const R_MERGE: Record<string, PhonemeId> = {
  O: 'AR',
  A: 'AR',
  AW: 'OR',
  OE: 'OR',
  E: 'AIR',
  AE: 'AIR',
  I: 'EER',
  EE: 'EER',
  UU: 'OOR',
  OO: 'OOR',
  ER: 'ER',
  SCHWA: 'ER',
  U: 'ER',
}

function tokenize(ipa: string): { phonemes: PhonemeId[]; stress: number[]; unknown: string[] } {
  const phonemes: PhonemeId[] = []
  const stress: number[] = []
  const unknown: string[] = []
  let pendingStress = 0
  let i = 0

  outer: while (i < ipa.length) {
    const ch = ipa[i]

    if (ch === 'ˈ') {
      pendingStress = 1
      i += 1
      continue
    }
    if (ch === 'ˌ') {
      pendingStress = 2
      i += 1
      continue
    }
    if (SKIP.has(ch) || /\s/.test(ch)) {
      i += 1
      continue
    }

    for (const [sym, ids] of SYMBOLS) {
      if (ipa.startsWith(sym, i)) {
        for (const id of ids) {
          phonemes.push(id)
          // A stress mark belongs to the next vowel; consonants in the onset
          // sit between the mark and the vowel only in eSpeak's rare orderings.
          stress.push(pendingStress)
          pendingStress = 0
        }
        i += sym.length
        continue outer
      }
    }

    unknown.push(ch)
    i += 1
  }

  return { phonemes, stress, unknown }
}

function mergeRControlled(phonemes: PhonemeId[], stress: number[]) {
  const outP: PhonemeId[] = []
  const outS: number[] = []

  for (let i = 0; i < phonemes.length; i++) {
    const cur = phonemes[i]
    const next = phonemes[i + 1]
    const afterNext = phonemes[i + 2]

    const mergeable =
      next === 'R' &&
      R_MERGE[cur] !== undefined &&
      isVowel(cur) &&
      // Only when /r/ closes the syllable. If a vowel follows the /r/ it is the
      // onset of the next syllable and must survive: spirit, carrot, mirror.
      (afterNext === undefined || !isVowel(afterNext))

    if (mergeable) {
      outP.push(R_MERGE[cur])
      outS.push(Math.max(stress[i], stress[i + 1] ?? 0))
      i += 1
    } else {
      outP.push(cur)
      outS.push(stress[i])
    }
  }

  return { phonemes: outP, stress: outS }
}

/** eSpeak IPA for one word -> normalized phoneme sequence. */
export function normalize(ipa: string): NormalizedWord {
  const tok = tokenize(ipa)
  const merged = mergeRControlled(tok.phonemes, tok.stress)
  return {
    phonemes: merged.phonemes,
    stress: merged.stress,
    unknown: tok.unknown,
    raw: ipa,
  }
}
