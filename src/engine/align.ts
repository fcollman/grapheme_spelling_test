import { isVowel, type PhonemeId } from '../data/phonemes'
import { phonemeDistance } from './distance'
import { segment } from './segment'
import { syllabify, type Syllable } from './syllabify'
import type { NormalizedWord } from './normalize'

/**
 * Aligns a student's attempt to the target word, one cell per target phoneme.
 *
 * Both sides are phonemized first, so the student's spelling is scored as "what
 * this spelling would sound like read aloud". A slot may hold more than one
 * student phoneme when they inserted a sound.
 */

export type Mark = 'exact' | 'plausible' | 'wrong' | 'omitted'

export interface Slot {
  index: number
  target: PhonemeId
  targetGrapheme: string
  student: PhonemeId[]
  studentGrapheme: string
  mark: Mark
  /** True when a teacher edited this cell, so re-analysis must not clobber it. */
  overridden: boolean
}

export interface WordAnalysis {
  word: string
  attempt: string
  attempted: boolean
  targetPhonemes: PhonemeId[]
  targetGraphemes: string[]
  targetStress: number[]
  syllables: Syllable[]
  attemptPhonemes: PhonemeId[]
  slots: Slot[]
  spellingCorrect: boolean
}

export interface AlignOptions {
  /**
   * eSpeak reduces unstressed vowels to schwa (tablet -> tˈæblət), which would
   * otherwise read as a vowel error in every unstressed syllable.
   */
  lenientSchwa?: boolean
}

/** Per-slot teacher corrections, keyed by slot index. */
export interface SlotOverride {
  student?: PhonemeId[]
  mark?: Mark
}

const OMIT_COST = 0.85
const INSERT_COST = 0.85

type Op = 'sub' | 'omit' | 'ins'

/** @returns for each target index, the list of student phoneme indices assigned to it. */
function alignSequences(target: PhonemeId[], student: PhonemeId[]): number[][] {
  const m = target.length
  const n = student.length

  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  const back: Op[][] = Array.from({ length: m + 1 }, () => new Array<Op>(n + 1).fill('sub'))

  for (let i = 1; i <= m; i++) {
    d[i][0] = i * OMIT_COST
    back[i][0] = 'omit'
  }
  for (let j = 1; j <= n; j++) {
    d[0][j] = j * INSERT_COST
    back[0][j] = 'ins'
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const sub = d[i - 1][j - 1] + phonemeDistance(target[i - 1], student[j - 1])
      const omit = d[i - 1][j] + OMIT_COST
      const ins = d[i][j - 1] + INSERT_COST

      let bestOp: Op = 'sub'
      let bestCost = sub
      if (omit < bestCost) {
        bestCost = omit
        bestOp = 'omit'
      }
      if (ins < bestCost) {
        bestCost = ins
        bestOp = 'ins'
      }
      d[i][j] = bestCost
      back[i][j] = bestOp
    }
  }

  const assigned: number[][] = Array.from({ length: m }, () => [])
  let i = m
  let j = n
  while (i > 0 || j > 0) {
    const op: Op = i === 0 ? 'ins' : j === 0 ? 'omit' : back[i][j]
    if (op === 'sub') {
      assigned[i - 1].push(j - 1)
      i -= 1
      j -= 1
    } else if (op === 'omit') {
      i -= 1
    } else {
      // An unattributed student phoneme belongs to the slot most recently
      // consumed, which going forwards is slot i-1.
      const slot = i > 0 ? i - 1 : 0
      if (assigned[slot]) assigned[slot].push(j - 1)
      j -= 1
    }
  }

  for (const list of assigned) list.reverse()
  return assigned
}

/**
 * Sound pairs that English spells one way, with nothing in the spelling to say
 * which of the two you are looking at: `th` is unvoiced in *thin* and voiced in
 * *this*, and no rule tells a speller apart.
 *
 * This matters because the engine decides the voicing from the whole string, not
 * from the letters. A student writing "thar" for *their* wrote the word's own
 * `th`, but "thar" reads with the unvoiced sound while "their" is voiced, so the
 * digraph came out wrong — while "ther" for the same word comes out right. The
 * verdict on a grapheme the student got right was being decided by the vowel
 * beside it, which they got wrong and which is already marked wrong on its own
 * slot. That is one mistake counted twice.
 *
 * Same reasoning as the silent-e accommodation below: forgive a slot whose error
 * is really an echo of the error next door.
 */
const SAME_SPELLING_PAIRS: Array<[PhonemeId, PhonemeId]> = [['TH', 'DH']]

function spelledTheSameWay(a: PhonemeId, b: PhonemeId): boolean {
  return SAME_SPELLING_PAIRS.some(([x, y]) => (a === x && b === y) || (a === y && b === x))
}

/**
 * A silent final 'e' belongs to the vowel slot conceptually, but the segmenter can
 * only take consecutive letters, so it lands on the trailing consonant ('ke' in
 * cake). Ignoring it here stops bike->"bik" scoring the /k/ as a spelling error
 * when the real error is already flagged on the vowel.
 */
function graphemeKey(grapheme: string, phoneme: PhonemeId): string {
  if (grapheme.length >= 2 && grapheme.endsWith('e') && !isVowel(phoneme)) {
    return grapheme.slice(0, -1)
  }
  return grapheme
}

function markOf(
  target: PhonemeId,
  targetGrapheme: string,
  student: PhonemeId[],
  studentGrapheme: string,
  stressed: boolean,
  options: AlignOptions,
): Mark {
  if (student.length === 0) return 'omitted'

  const single = student.length === 1 ? student[0] : null
  const sameLetters = graphemeKey(studentGrapheme, target) === graphemeKey(targetGrapheme, target)

  /**
   * Either side of the comparison can turn out to be a schwa purely because of
   * how eSpeak guessed the stress.
   *
   * It knows "bombastic" and stresses the second syllable, reducing the first
   * vowel to /ə/. It does not know "bombastick", so it falls back to rules,
   * stresses the FIRST syllable, and reduces the second vowel instead. The same
   * letter in the same position then carries a different sound in the target and
   * in the attempt, through no doing of the student's.
   */
  const schwaPair =
    single !== null &&
    ((target === 'SCHWA' && isVowel(single)) || (single === 'SCHWA' && isVowel(target)))

  /**
   * Normally only an unstressed vowel is forgiven. But where the student wrote
   * the very letters the word uses, the difference cannot be a spelling mistake
   * — it is the engine having stressed their spelling differently — so the
   * stress condition is waived. Restricted to schwa pairs on purpose: matching
   * letters alone must not excuse a real vowel error such as "hope" for "hop",
   * where the sounds differ without a schwa being involved.
   */
  const schwaMatch =
    options.lenientSchwa && schwaPair && (!stressed || (sameLetters && studentGrapheme !== ''))

  if (single === target || schwaMatch) {
    return sameLetters ? 'exact' : 'plausible'
  }

  /*
   * They wrote this word's own letters for this sound, and the two sounds are
   * ones those letters never distinguish. Deliberately narrow: it needs the
   * letters to match exactly, so "hope" for *hop* still scores the vowel wrong
   * even though both spell it `o` — that difference IS visible in the spelling.
   */
  if (single !== null && sameLetters && studentGrapheme !== '' && spelledTheSameWay(single, target)) {
    return 'exact'
  }

  return 'wrong'
}

export function analyze(
  word: string,
  attempt: string,
  targetNorm: NormalizedWord,
  attemptNorm: NormalizedWord,
  overrides: Record<number, SlotOverride> = {},
  options: AlignOptions = {},
): WordAnalysis {
  const targetPhonemes = targetNorm.phonemes
  const targetGraphemes = segment(word, targetPhonemes)
  const syllables = syllabify(targetPhonemes, targetNorm.stress)

  const attempted = attempt.length > 0
  const attemptPhonemes = attempted ? attemptNorm.phonemes : []
  const attemptGraphemes = segment(attempt, attemptPhonemes)

  const assigned = alignSequences(targetPhonemes, attemptPhonemes)

  const slots: Slot[] = targetPhonemes.map((target, index) => {
    const override = overrides[index]
    const studentIdx = assigned[index] ?? []
    const autoStudent = studentIdx.map((k) => attemptPhonemes[k])
    const student = override?.student ?? autoStudent
    // Letters follow the automatic alignment even when the phonemes were
    // overridden: the teacher is correcting what sound the letters make, not
    // which letters the student wrote.
    const studentGrapheme = studentIdx.map((k) => attemptGraphemes[k] ?? '').join('')
    const stressed = (targetNorm.stress[index] ?? 0) > 0

    const mark =
      override?.mark ??
      markOf(target, targetGraphemes[index] ?? '', student, studentGrapheme, stressed, options)

    return {
      index,
      target,
      targetGrapheme: targetGraphemes[index] ?? '',
      student,
      studentGrapheme,
      mark,
      overridden: override !== undefined,
    }
  })

  return {
    word,
    attempt,
    attempted,
    targetPhonemes,
    targetGraphemes,
    targetStress: targetNorm.stress,
    syllables,
    attemptPhonemes,
    slots,
    spellingCorrect: attempted && attempt === word,
  }
}
