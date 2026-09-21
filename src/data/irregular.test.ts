import { describe, expect, it } from 'vitest'
import { analyzePair } from '../engine/analyze'
import { findPatterns } from '../engine/patterns'
import { buildUnits, unitKey } from '../engine/units'
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

async function unitsFor(word: string) {
  const a = await analyzePair(word, '')
  return buildUnits(a, findPatterns(a.targetPhonemes, a.targetGraphemes, a.syllables, a.word))
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
      const match = units.find((u) => u.key === unitKey(letters, sounds.split('+')))
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

describe('the teacher overrides the table', () => {
  it('can treat a listed spelling as ordinary phonics', async () => {
    // "ea" saying /e/ ships as a red word, but it is a big enough family that a
    // program may well teach it as a second sound of the ea team instead.
    const a = await analyzePair('head', '')
    const units = buildUnits(a, findPatterns(a.targetPhonemes, a.targetGraphemes, a.syllables, a.word), {
      'ea|E': false,
    })
    expect(units.find((u) => u.letters === 'ea')?.category).toBe('short-vowel')
  })

  it('can treat an unlisted spelling as a red word', async () => {
    const a = await analyzePair('ship', '')
    const units = buildUnits(a, findPatterns(a.targetPhonemes, a.targetGraphemes, a.syllables, a.word), {
      'sh|SH': true,
    })
    expect(units.find((u) => u.letters === 'sh')?.category).toBe('red-word')
  })

  it('leaves every other spelling to the table', async () => {
    const a = await analyzePair('said', '')
    const units = buildUnits(a, findPatterns(a.targetPhonemes, a.targetGraphemes, a.syllables, a.word), {
      'ea|E': false,
    })
    expect(units.find((u) => u.letters === 'ai')?.category).toBe('red-word')
  })

  it('reads as the table says when there is no override', () => {
    expect(isIrregular('ea', ['E'])).toBe(true)
    expect(isIrregular('ea', ['E'], {})).toBe(true)
    expect(isIrregular('ea', ['E'], { 'ea|E': false })).toBe(false)
    expect(isIrregular('sh', ['SH'], { 'sh|SH': true })).toBe(true)
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
    expect(units[0].key).toBe('o|W+U')
    expect(units[0].category).toBe('red-word')
  })
})
