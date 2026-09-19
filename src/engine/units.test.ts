import { describe, expect, it } from 'vitest'
import { analyzePair } from './analyze'
import { findPatterns } from './patterns'
import { buildUnits, unitResults } from './units'
import { MULTI_SOUND_GRAPHEMES } from '../data/patterns'

async function unitsFor(word: string, attempt = '') {
  const a = await analyzePair(word, attempt)
  const patterns = findPatterns(a.targetPhonemes, a.targetGraphemes, a.syllables, a.word)
  const units = buildUnits(a, patterns)
  return { analysis: a, patterns, units, results: unitResults(a, units) }
}

/** Compact rendering: "letters=/p/+/p/" per unit. */
const render = (units: Awaited<ReturnType<typeof unitsFor>>['units']) =>
  units.map((u) => `${u.letters}=${u.phonemes.join('+')}`).join(' ')

describe('grapheme units', () => {
  it('keeps one unit per grapheme in a plain word', async () => {
    expect(render((await unitsFor('ship')).units)).toBe('sh=SH i=I p=P')
    expect(render((await unitsFor('stop')).units)).toBe('s=S t=T o=O p=P')
  })

  it('never leaves a unit without letters', async () => {
    for (const word of ['box', 'exam', 'cube', 'few', 'little', 'table', 'music', 'nation']) {
      const { units } = await unitsFor(word)
      const blank = units.filter((u) => u.letters === '')
      expect(blank, `"${word}" produced a blank column: ${render(units)}`).toEqual([])
    }
  })

  it('puts both sounds of a single grapheme in one unit', async () => {
    expect(render((await unitsFor('box')).units)).toBe('b=B o=O x=K+S')
    expect(render((await unitsFor('six')).units)).toBe('s=S i=I x=K+S')
    expect(render((await unitsFor('quick')).units)).toBe('qu=K+W i=I ck=K')
    expect(render((await unitsFor('exam')).units)).toBe('e=E x=G+Z a=A m=M')
  })

  it('collapses a velar nasal unit into one column', async () => {
    const { units } = await unitsFor('bank')
    expect(render(units)).toBe('b=B ank=A+NG+K')
    expect(units[1].patternLabel).toBe('-ank')
    expect(units[1].category).toBe('velar-nasal')
  })

  it('collapses consonant-le into one column', async () => {
    const { units } = await unitsFor('little')
    expect(render(units)).toBe('l=L i=I ttle=T+SCHWA+L')
    expect(units[2].category).toBe('consonant-le')
  })

  it('leaves a blend as separate columns so a missed sound is still visible', async () => {
    const { units } = await unitsFor('splash')
    expect(render(units)).toBe('s=S p=P l=L a=A sh=SH')
    // The blend is still known about — it is just a tag, not a merged column.
    const { patterns } = await unitsFor('splash')
    expect(patterns.some((p) => p.id === 'bi-spl')).toBe(true)
  })

  it('tags each unit with a category', async () => {
    const { units } = await unitsFor('ship')
    expect(units.map((u) => u.category)).toEqual(['consonant-digraph', 'short-vowel', 'consonant'])
  })

  it('gives the same spelling with different sounds different keys', async () => {
    const chip = (await unitsFor('chip')).units[0]
    const school = (await unitsFor('school')).units[0]
    expect(chip.letters).toBe('ch')
    expect(chip.key).not.toBe(school.key)
  })

  it('every multi-sound grapheme in the table appears in its example word', async () => {
    for (const entry of MULTI_SOUND_GRAPHEMES) {
      const { units } = await unitsFor(entry.example)
      const found = units.find((u) => u.phonemes.join('+') === entry.phonemes.join('+'))
      expect(
        found,
        `${entry.letters} -> ${entry.phonemes.join('+')} not found in "${entry.example}": ${render(units)}`,
      ).toBeDefined()
    }
  })
})

describe('unit marking', () => {
  it('marks a unit correct only when every sound inside it is correct', async () => {
    const { results } = await unitsFor('bank', 'bak') // dropped the n
    expect(results[0].mark).toBe('exact')
    expect(results[1].mark).toBe('wrong') // -ank as a whole is wrong
  })

  it('marks the whole chunk wrong when part of it is missing', async () => {
    const { results } = await unitsFor('little', 'litle')
    const cle = results[results.length - 1]
    expect(cle.unit.category).toBe('consonant-le')
    expect(['wrong', 'plausible']).toContain(cle.mark)
  })

  it('still shows which sound of a blend was missed', async () => {
    const { results } = await unitsFor('splash', 'spash') // dropped the l
    expect(results.map((r) => r.mark)).toEqual(['exact', 'exact', 'omitted', 'exact', 'exact'])
  })

  it('marks a right sound spelled differently as plausible', async () => {
    const { results } = await unitsFor('cat', 'kat')
    expect(results.map((r) => r.mark)).toEqual(['plausible', 'exact', 'exact'])
  })

  it('keeps the student letters alongside the sounds', async () => {
    const { results } = await unitsFor('ship', 'chip')
    expect(results[0].studentLetters).toBe('ch')
    expect(results[0].studentPhonemes).toEqual(['CH'])
    expect(results[0].mark).toBe('wrong')
  })

  it('reports a unit as omitted when nothing was written for it', async () => {
    const { results } = await unitsFor('cat', '')
    expect(results.every((r) => r.mark === 'omitted')).toBe(true)
  })
})
