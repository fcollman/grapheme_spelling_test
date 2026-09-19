import { describe, expect, it } from 'vitest'
import { analyzePair } from './analyze'
import { findPatterns, slotCategory } from './patterns'
import { CONSONANT_DIGRAPHS, SPAN_PATTERNS } from '../data/patterns'
import { CATEGORIES, VOWEL_CATEGORY } from '../data/categories'
import { PHONEMES } from '../data/phonemes'

/** Runs a target word through the real pipeline and finds its patterns. */
async function patternsFor(word: string) {
  const a = await analyzePair(word, '')
  return {
    ...a,
    patterns: findPatterns(a.targetPhonemes, a.targetGraphemes, a.syllables, a.word),
  }
}

describe('category data integrity', () => {
  it('gives every vowel a category', () => {
    const missing = PHONEMES.filter((p) => p.features.kind === 'vowel' && !VOWEL_CATEGORY[p.id])
    expect(missing.map((p) => p.id)).toEqual([])
  })

  it('uses only declared category ids', () => {
    const ids = new Set(CATEGORIES.map((c) => c.id))
    for (const p of SPAN_PATTERNS) expect(ids.has(p.category), `${p.id} -> ${p.category}`).toBe(true)
    for (const c of Object.values(VOWEL_CATEGORY)) expect(ids.has(c)).toBe(true)
  })

  it('has no duplicate pattern ids', () => {
    const ids = SPAN_PATTERNS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('span patterns match their own example words', () => {
  // This is the real validation of data/patterns.ts: if a phoneme sequence in the
  // table is wrong, the engine disagrees and this fails.
  it.each(SPAN_PATTERNS.map((p) => [p.id, p.label, p.example] as const))(
    '%s (%s) is found in "%s"',
    async (id, _label, example) => {
      const { patterns, targetPhonemes } = await patternsFor(example)
      const found = patterns.find((m) => m.id === id)
      expect(
        found,
        `expected ${id} in "${example}", which analyses as ${targetPhonemes.join(' ')} — found: ${patterns
          .map((m) => m.id)
          .join(', ')}`,
      ).toBeDefined()
    },
  )
})

describe('consonant digraphs match their own example words', () => {
  it.each(CONSONANT_DIGRAPHS.map((d) => [d.spelling, d.phoneme, d.example] as const))(
    '"%s" spells %s in "%s"',
    async (spelling, phoneme, example) => {
      const a = await analyzePair(example, '')
      const slot = a.slots.find((s) => s.targetGrapheme.toLowerCase() === spelling && s.target === phoneme)
      expect(
        slot,
        `expected "${spelling}" -> ${phoneme} in "${example}", segmented as ${a.slots
          .map((s) => `${s.targetGrapheme}=${s.target}`)
          .join(' ')}`,
      ).toBeDefined()
      expect(slotCategory(phoneme, spelling).category).toBe('consonant-digraph')
    },
  )
})

describe('slot categories', () => {
  it('separates a digraph spelling from a plain one for the same sound', () => {
    expect(slotCategory('K', 'c').category).toBe('consonant')
    expect(slotCategory('K', 'k').category).toBe('consonant')
    expect(slotCategory('K', 'ck').category).toBe('consonant-digraph')
    expect(slotCategory('F', 'f').category).toBe('consonant')
    expect(slotCategory('F', 'ph').category).toBe('consonant-digraph')
  })

  it('does not treat a doubled letter as a digraph', () => {
    expect(slotCategory('B', 'bb').category).toBe('consonant')
    expect(slotCategory('L', 'll').category).toBe('consonant')
    expect(slotCategory('S', 'ss').category).toBe('consonant')
  })

  it('categorises vowels by type', () => {
    expect(slotCategory('A', 'a').category).toBe('short-vowel')
    expect(slotCategory('AE', 'a').category).toBe('long-vowel')
    expect(slotCategory('OW', 'ow').category).toBe('diphthong')
    expect(slotCategory('AR', 'ar').category).toBe('r-controlled')
    expect(slotCategory('SCHWA', 'a').category).toBe('schwa')
  })
})

describe('pattern matching in words', () => {
  it('tags a beginning blend but not a digraph as a blend', async () => {
    const stop = await patternsFor('stop')
    expect(stop.patterns.map((p) => p.id)).toContain('bi-st')

    // "ship" starts with one sound, so there is nothing to blend.
    const ship = await patternsFor('ship')
    expect(ship.patterns.filter((p) => p.category === 'blend-initial')).toEqual([])
  })

  it('prefers the full three-sound onset over a contained two-sound one', async () => {
    const { patterns } = await patternsFor('splash')
    const initial = patterns.filter((p) => p.category === 'blend-initial')
    expect(initial).toHaveLength(1)
    expect(initial[0].id).toBe('bi-spl')
  })

  it('finds an ending blend that is only part of the coda', async () => {
    const { patterns } = await patternsFor('hands')
    expect(patterns.map((p) => p.id)).toContain('bf-nd')
  })

  it('tags a velar nasal unit and its overlapping ending blend', async () => {
    const { patterns } = await patternsFor('thrunk')
    const ids = patterns.map((p) => p.id)
    expect(ids).toContain('vn-unk')
    expect(ids).toContain('bf-nk')
    expect(ids).toContain('bi-thr')
  })

  it('finds kind/old words but not lookalikes spelled differently', async () => {
    expect((await patternsFor('kind')).patterns.map((p) => p.id)).toContain('ko-ind')
    expect((await patternsFor('cold')).patterns.map((p) => p.id)).toContain('ko-old')
    // "signed" sounds like /ī/ /n/ /d/ but is not spelled -ind.
    expect((await patternsFor('signed')).patterns.map((p) => p.id)).not.toContain('ko-ind')
  })

  it('finds consonant-le at the end of a word', async () => {
    for (const word of ['little', 'table', 'apple', 'candle', 'puzzle']) {
      const { patterns } = await patternsFor(word)
      const cle = patterns.find((p) => p.category === 'consonant-le')
      expect(cle, `no consonant-le in "${word}"`).toBeDefined()
      expect(cle!.label.endsWith('le')).toBe(true)
    }
  })

  it('does not see consonant-le in a word that merely ends in l', async () => {
    const { patterns } = await patternsFor('bell')
    expect(patterns.filter((p) => p.category === 'consonant-le')).toEqual([])
  })

  it('reports an unlisted cluster structurally rather than silently dropping it', async () => {
    // "sphere" opens with /s/ /f/, which is not a taught blend.
    const { patterns } = await patternsFor('sphere')
    const structural = patterns.filter((p) => p.source === 'structural')
    expect(structural.length).toBeGreaterThan(0)
  })

  it('does not call two sounds from one letter a blend', async () => {
    // "x" is /k/ + /s/ from a single grapheme, not a cluster of two graphemes.
    const box = await patternsFor('box')
    expect(box.patterns.filter((p) => p.category === 'blend-final')).toEqual([])

    // But a real cluster around it still counts: "next" is /k/ /s/ /t/ = -xt.
    const next = await patternsFor('next')
    expect(next.patterns.map((p) => p.id)).toContain('bf-xt')
  })

  it('keeps r-controlled endings out of the ending blends', async () => {
    // "card" is /k/ /ar/ /d/ — no /r/ sound remains, so there is no -rd blend.
    const { patterns, targetPhonemes } = await patternsFor('card')
    expect(targetPhonemes).toEqual(['K', 'AR', 'D'])
    expect(patterns.filter((p) => p.category === 'blend-final')).toEqual([])
  })
})
