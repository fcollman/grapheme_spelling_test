import { describe, expect, it } from 'vitest'
import { reconcileWords, tokenizePassage } from './passage'
import type { Word } from './types'

const words = (texts: string[]): Word[] =>
  texts.map((text, i) => ({ id: `w${i}`, text, nonsense: false }))

const retokenize = (prev: Word[], passage: string) => reconcileWords(prev, tokenizePassage(passage))

describe('splitting a passage into words', () => {
  it('keeps the offsets that let the passage render verbatim', () => {
    const passage = 'The cat sat.'
    for (const t of tokenizePassage(passage)) {
      expect(passage.slice(t.start, t.end)).toBe(t.text)
    }
  })

  it('leaves punctuation out of the words and in the gaps', () => {
    expect(tokenizePassage('"Stop!" she said — quietly.').map((t) => t.text)).toEqual([
      'Stop',
      'she',
      'said',
      'quietly',
    ])
  })

  it('keeps a contraction whole', () => {
    expect(tokenizePassage("don't stop").map((t) => t.text)).toEqual(["don't", 'stop'])
  })

  it('straightens a curly apostrophe, which the engine would otherwise drop', () => {
    // cleanWord keeps ' and strips ’, so a passage pasted out of a word processor
    // would phonemize "don’t" as "dont".
    const [token] = tokenizePassage('don’t')
    expect(token.text).toBe("don't")
    // The passage itself is untouched, so it still renders as it was pasted.
    expect(token.end - token.start).toBe(5)
  })

  it('splits a hyphenated word, which the engine reads better in two', () => {
    expect(tokenizePassage('well-known').map((t) => t.text)).toEqual(['well', 'known'])
  })

  it('does not treat digits as words', () => {
    expect(tokenizePassage('in 1953 they left').map((t) => t.text)).toEqual(['in', 'they', 'left'])
  })

  it('gives a repeated word one token each', () => {
    expect(tokenizePassage('the one and the other').filter((t) => t.text === 'the')).toHaveLength(2)
  })
})

/**
 * Re-tokenising must not cost the teacher a morning's marking. Marks hang off
 * word ids, so an edit that mints fresh ids throws them all away — these pin
 * down which ids survive which edit.
 */
describe('re-tokenising a passage that has already been marked', () => {
  it('keeps every id when text is added to the end', () => {
    const before = words(['The', 'cat'])
    const after = retokenize(before, 'The cat sat')

    expect(after.words.map((w) => w.id)).toEqual(['w0', 'w1', after.words[2].id])
    expect(after.droppedIds).toEqual([])
    expect(after.changedIds).toEqual([])
  })

  it('keeps the words either side of an inserted sentence', () => {
    const before = words(['The', 'cat', 'sat'])
    const after = retokenize(before, 'The big cat sat')

    expect(after.words.map((w) => w.text)).toEqual(['The', 'big', 'cat', 'sat'])
    // 'The' anchors the head, 'cat sat' anchors the tail, so only 'big' is new.
    expect(after.words[0].id).toBe('w0')
    expect(after.words[2].id).toBe('w1')
    expect(after.words[3].id).toBe('w2')
    expect(after.droppedIds).toEqual([])
  })

  it('reports the ids of words deleted from the middle', () => {
    const before = words(['The', 'big', 'grey', 'cat'])
    const after = retokenize(before, 'The cat')

    expect(after.words.map((w) => w.id)).toEqual(['w0', 'w3'])
    expect(after.droppedIds.sort()).toEqual(['w1', 'w2'])
  })

  it('keeps the id but reports the change when a word is corrected in place', () => {
    const before = words(['The', 'kat', 'sat'])
    const after = retokenize(before, 'The cat sat')

    expect(after.words[1].id).toBe('w1')
    // Same slot, different word — any confirmed breakdown for it is now wrong.
    expect(after.changedIds).toEqual(['w1'])
    expect(after.droppedIds).toEqual([])
  })

  it('does not treat a capitalisation change as a change', () => {
    const after = retokenize(words(['the']), 'The')
    expect(after.changedIds).toEqual([])
    expect(after.words[0].text).toBe('The')
  })

  it('keeps repeated words in their own slots', () => {
    const before = words(['the', 'one', 'and', 'the', 'other'])
    const after = retokenize(before, 'the one and the other')

    expect(after.words.map((w) => w.id)).toEqual(['w0', 'w1', 'w2', 'w3', 'w4'])
    expect(after.droppedIds).toEqual([])
  })

  it('reports every slot as changed when the passage is replaced wholesale', () => {
    const before = words(['The', 'cat'])
    const after = retokenize(before, 'Completely different words here')

    // The two slots survive positionally, which keeps React keys stable, but they
    // now say something else entirely — so they are reported as changed and the
    // reducer clears what was recorded against them. A mark meaning "read 'The'
    // correctly" must never quietly become a mark about "Completely".
    expect(after.changedIds.sort()).toEqual(['w0', 'w1'])
    expect(after.words).toHaveLength(4)
  })

  it('refreshes offsets on words it keeps', () => {
    const before = words(['The', 'cat'])
    const after = retokenize(before, '  The cat')

    expect(after.words[0].start).toBe(2)
    expect(after.words[1].start).toBe(6)
  })
})
