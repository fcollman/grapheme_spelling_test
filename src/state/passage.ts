import { cleanWord } from '../engine/phonemize'
import { newId, type Word } from './types'

/**
 * Turning a pasted passage into the word list a reading test marks against.
 *
 * Pure and separate from React so the two rules worth arguing about — what
 * counts as a word, and what happens to marks already made when the passage is
 * edited — can be pinned down in tests.
 */

export interface PassageToken {
  text: string
  /** Offsets into the passage, so the page can render the gaps between words. */
  start: number
  end: number
}

/**
 * A word is letters, optionally joined by an apostrophe.
 *
 * Hyphens are deliberately outside the class, so "well-known" becomes two words:
 * the engine reads a hyphen as nothing at all and would otherwise be handed
 * "wellknown", which it pronounces badly. Digits are not words either — "1953"
 * is read aloud half a dozen different ways and there is nothing to align
 * against, so the page asks for numerals to be spelled out.
 */
const WORD = /[A-Za-z]+(?:['’][A-Za-z]+)*/g

export function tokenizePassage(passage: string): PassageToken[] {
  return [...passage.matchAll(WORD)].map((m) => ({
    /*
     * A curly apostrophe is straightened here but left alone in the passage.
     * `cleanWord` keeps `'` and strips `’`, so a passage pasted out of a word
     * processor would otherwise phonemize "don’t" as "dont".
     */
    text: m[0].replace(/’/g, "'"),
    start: m.index,
    end: m.index + m[0].length,
  }))
}

export interface Reconciled {
  words: Word[]
  /**
   * Kept their slot but now say something else.
   *
   * Everything recorded against these has to go, not just a confirmed breakdown:
   * a mark meaning "read 'The' correctly" must not quietly become a mark about
   * whatever word took that slot.
   */
  changedIds: string[]
  /** Gone from the passage, so anything recorded against them is unreachable. */
  droppedIds: string[]
}

/**
 * Re-tokenising a passage without throwing away the marks already made.
 *
 * Minting a fresh id for every word on every edit would mean a teacher who fixes
 * one typo loses a morning's marking. Anchoring the unchanged run at each end
 * and reusing ids positionally through the middle covers what actually happens —
 * pasting more text on, inserting or deleting a sentence, correcting a word in
 * place — without the cost of a full longest-common-subsequence.
 *
 * Repeated words need no special handling: matching is positional, so the third
 * "the" keeps being the third "the".
 */
export function reconcileWords(prev: Word[], tokens: PassageToken[]): Reconciled {
  const same = (a: string, b: string) => cleanWord(a) === cleanWord(b)

  let head = 0
  while (head < prev.length && head < tokens.length && same(prev[head].text, tokens[head].text)) {
    head += 1
  }

  let tail = 0
  while (
    tail < prev.length - head &&
    tail < tokens.length - head &&
    same(prev[prev.length - 1 - tail].text, tokens[tokens.length - 1 - tail].text)
  ) {
    tail += 1
  }

  const changedIds: string[] = []
  const words = tokens.map((token, i) => {
    const previous =
      i < head
        ? prev[i] // in the unchanged run at the start
        : i >= tokens.length - tail
          ? prev[prev.length - (tokens.length - i)] // in the unchanged run at the end
          : i < prev.length - tail
            ? prev[i] // somewhere in the middle that still has a word to reuse
            : undefined // the passage grew here, so this one is new

    if (!previous) {
      return { id: newId('wrd'), text: token.text, nonsense: false, start: token.start, end: token.end }
    }
    if (!same(previous.text, token.text)) changedIds.push(previous.id)
    return { ...previous, text: token.text, start: token.start, end: token.end }
  })

  const kept = new Set(words.map((w) => w.id))
  const droppedIds = prev.filter((w) => !kept.has(w.id)).map((w) => w.id)

  return { words, changedIds, droppedIds }
}
