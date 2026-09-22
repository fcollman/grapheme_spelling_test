import { describe, expect, it } from 'vitest'
import { analyzePair } from '../engine/analyze'
import { findPatterns } from '../engine/patterns'
import { buildUnits, redUnitKey, suggestRedUnits } from '../engine/units'
import { IRREGULAR, isIrregular } from './irregular'
import { CATEGORIES } from './categories'

/**
 * The red-word table is only worth anything if the pairs in it are pairs the
 * engine actually produces. A row whose letters never come out of the segmenter
 * — because `graphemes.ts` cannot split the word that way — would sit in the
 * file looking correct and never fire on a single student's work.
 *
 * So every entry is run through the real pipeline against its own example word.
 */

/** As the app builds them for a word the teacher is assessing as a Red Word. */
async function unitsFor(word: string, red: { units?: number[] } | undefined = {}) {
  const a = await analyzePair(word, '')
  return buildUnits(a, findPatterns(a.targetPhonemes, a.targetGraphemes, a.syllables, a.word), red)
}

describe('the red-word table', () => {
  it('uses a declared category id', () => {
    expect(CATEGORIES.some((c) => c.id === 'red-word')).toBe(true)
  })

  it('has no duplicate pairs', () => {
    const keys = IRREGULAR.map((e) => `${e.letters}|${e.phonemes.join('+')}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('never lists a pair that is not actually irregular', () => {
    // A sanity floor: a single letter making its own commonest sound is regular
    // by definition, and listing one would quietly drain a phonics category.
    const obviouslyRegular = [
      ['a', ['A']], ['e', ['E']], ['i', ['I']], ['o', ['O']], ['u', ['U']],
      ['sh', ['SH']], ['th', ['TH']], ['ck', ['K']], ['ai', ['AE']], ['ea', ['EE']],
    ] as const
    for (const [letters, phonemes] of obviouslyRegular) {
      expect(isIrregular(letters, [...phonemes]), `${letters} -> ${phonemes}`).toBe(false)
    }
  })

  it.each(IRREGULAR.map((e) => [e.example, e.letters, e.phonemes.join('+')] as const))(
    '%s really does spell %s as /%s/',
    async (example, letters, sounds) => {
      const units = await unitsFor(example)
      const match = units.find(
        (u) => u.key === redUnitKey(example, letters, sounds.split('+')),
      )
      expect(
        match,
        `${example} came out as ${units.map((u) => u.key).join(' ')}`,
      ).toBeDefined()
      // And having found it, the classification must have taken effect.
      expect(match?.category).toBe('red-word')
    },
    30_000,
  )
})

describe('the table only suggests', () => {
  it('classifies nothing until the word is marked as a Red Word', async () => {
    // The whole point: whether a spelling is "unexpected" depends on where the
    // class has got to, so the app does not get to decide on its own.
    const a = await analyzePair('said', '')
    const patterns = findPatterns(a.targetPhonemes, a.targetGraphemes, a.syllables, a.word)

    const untouched = buildUnits(a, patterns)
    expect(untouched.find((u) => u.letters === 'ai')?.category).toBe('short-vowel')

    const assessed = buildUnits(a, patterns, {})
    expect(assessed.find((u) => u.letters === 'ai')?.category).toBe('red-word')
  })

  it('suggests the columns the table recognises', async () => {
    const a = await analyzePair('their', '')
    const units = buildUnits(a, findPatterns(a.targetPhonemes, a.targetGraphemes, a.syllables, a.word))
    // `eir` is index 1; the `th` is ordinary and is not suggested.
    expect(suggestRedUnits(units)).toEqual([1])
  })

  it('suggests nothing for a word it does not recognise', async () => {
    const a = await analyzePair('ship', '')
    const units = buildUnits(a, findPatterns(a.targetPhonemes, a.targetGraphemes, a.syllables, a.word))
    expect(suggestRedUnits(units)).toEqual([])
  })
})

describe('the teacher confirms or changes the suggestion', () => {
  async function unitsWith(word: string, red?: { units?: number[] }) {
    const a = await analyzePair(word, '')
    return buildUnits(a, findPatterns(a.targetPhonemes, a.targetGraphemes, a.syllables, a.word), red)
  }

  it('takes their choice over the suggestion', async () => {
    // "head" would be suggested at the `ea`; the teacher says it is the `h`.
    const units = await unitsWith('head', { units: [0] })
    expect(units.map((u) => `${u.letters}:${u.category}`)).toEqual([
      'h:red-word',
      'ea:short-vowel',
      'd:consonant',
    ])
  })

  it('accepts "none of these" as an answer', async () => {
    // A spelling that was unexpected in October may be taught by March, and then
    // the word is still a Red Word but nothing in it is unexpected any more.
    const units = await unitsWith('head', { units: [] })
    expect(units.every((u) => u.category !== 'red-word')).toBe(true)
  })

  it('gives a red column a row key of its own, per word', async () => {
    const said = await unitsWith('said', {})
    const again = await unitsWith('again', {})
    const saidAi = said.find((u) => u.category === 'red-word')
    const againAi = again.find((u) => u.category === 'red-word')

    // Same spelling, same sound, but the remediation is "practise said" and
    // "practise again" separately — and one may be taught before the other.
    expect(saidAi?.key).toBe('red:said:ai|E')
    expect(againAi?.key).toBe('red:again:ai|E')
    expect(saidAi?.key).not.toBe(againAi?.key)
    expect(saidAi?.patternLabel).toBe('said')
  })

  it('leaves an unmarked word using the same spelling on its phonics row', async () => {
    const marked = await unitsWith('said', {})
    const unmarked = await unitsWith('again')
    expect(marked.find((u) => u.letters === 'ai')?.key).toBe('red:said:ai|E')
    expect(unmarked.find((u) => u.letters === 'ai')?.key).toBe('ai|E')
  })
})

describe('red words in a word', () => {
  it('leaves the regular parts of the word alone', async () => {
    const units = await unitsFor('their')
    // The digraph is untouched: this is the whole point of tagging graphemes
    // rather than whole words.
    expect(units.map((u) => `${u.letters}:${u.category}`)).toEqual([
      'th:consonant-digraph',
      'eir:red-word',
    ])
  })

  it('does not tag the regular twin of an irregular spelling', async () => {
    // `ai` saying /ā/ is an ordinary vowel team, and only the /e/ reading is red.
    const rain = await unitsFor('rain')
    expect(rain.find((u) => u.letters === 'ai')?.category).toBe('long-vowel')

    const said = await unitsFor('said')
    expect(said.find((u) => u.letters === 'ai')?.category).toBe('red-word')
  })

  it('handles a grapheme that carries two sounds', async () => {
    const units = await unitsFor('once')
    expect(units[0].key).toBe('red:once:o|W+U')
    expect(units[0].category).toBe('red-word')
  })
})
