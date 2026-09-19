import { describe, expect, it } from 'vitest'
import { analyzeWord, analyzeWords } from './phonemize'
import { PHONEMES } from '../data/phonemes'

/** Every phoneme in the inventory needs a word that actually produces it. */
const COVERAGE: Record<string, string> = {
  P: 'pig', B: 'bat', T: 'top', D: 'dog', K: 'cat', G: 'go',
  F: 'fan', V: 'van', TH: 'thin', DH: 'this', S: 'sun', Z: 'zip',
  SH: 'ship', ZH: 'measure', H: 'hat', CH: 'chip', J: 'jam',
  M: 'man', N: 'net', NG: 'ring', L: 'lip', R: 'run', W: 'win', Y: 'yes',
  A: 'cat', E: 'bed', I: 'sit', O: 'hot', U: 'cup',
  AE: 'cake', EE: 'feet', IE: 'bike', OE: 'boat',
  OO: 'moon', UU: 'book',
  AR: 'car', OR: 'for', ER: 'her', AIR: 'chair', EER: 'deer', OOR: 'cure',
  OW: 'cow', OY: 'boy', AW: 'saw', SCHWA: 'about',
}

const EXPECTED: Record<string, string[]> = {
  cat: ['K', 'A', 'T'],
  ship: ['SH', 'I', 'P'],
  thin: ['TH', 'I', 'N'],
  this: ['DH', 'I', 'S'],
  ring: ['R', 'I', 'NG'],
  boat: ['B', 'OE', 'T'],
  cake: ['K', 'AE', 'K'],
  bike: ['B', 'IE', 'K'],
  moon: ['M', 'OO', 'N'],
  book: ['B', 'UU', 'K'],
  cow: ['K', 'OW'],
  boy: ['B', 'OY'],
  saw: ['S', 'AW'],
  // r-controlled vowels must collapse to one phoneme in the coda
  car: ['K', 'AR'],
  for: ['F', 'OR'],
  her: ['H', 'ER'],
  chair: ['CH', 'AIR'],
  deer: ['D', 'EER'],
  blorf: ['B', 'L', 'OR', 'F'],
  // ...but /r/ must survive when it opens the next syllable
  spirit: ['S', 'P', 'I', 'R', 'I', 'T'],
  carrot: ['K', 'A', 'R', 'SCHWA', 'T'],
  // nonsense words
  thrunk: ['TH', 'R', 'U', 'NG', 'K'],
  zilth: ['Z', 'I', 'L', 'TH'],
  // irregular real words the engine knows and we would have got wrong by rule
  said: ['S', 'E', 'D'],
  one: ['W', 'U', 'N'],
  though: ['DH', 'OE'],
  nation: ['N', 'AE', 'SH', 'SCHWA', 'N'],
}

describe('normalize', () => {
  it('maps every inventory phoneme from real engine output', async () => {
    const words = [...new Set(Object.values(COVERAGE))]
    const map = await analyzeWords(words)
    const missing: string[] = []

    for (const p of PHONEMES) {
      const word = COVERAGE[p.id]
      const got = map.get(word)?.phonemes ?? []
      if (!got.includes(p.id)) missing.push(`${p.id} (/${p.label}/, expected in "${word}", got ${got.join(' ')})`)
    }

    expect(missing).toEqual([])
  })

  it('produces no unmapped IPA across a broad corpus', async () => {
    const corpus = [
      'cat', 'ship', 'blorf', 'thrunk', 'zilth', 'water', 'butter', 'little', 'apple',
      'happy', 'baby', 'city', 'nation', 'vision', 'measure', 'contradiction',
      'misunderstanding', 'umbrella', 'fantastic', 'rabbit', 'napkin', 'tablet',
      'cure', 'pure', 'sure', 'fire', 'hour', 'bear', 'chair', 'deer', 'spirit',
      'carrot', 'mirror', 'strength', 'twelfth', 'sixths', 'judge', 'church',
      'beautiful', 'through', 'thought', 'laugh', 'cough', 'knight', 'wrist',
      'gnome', 'psalm', 'quick', 'exit', 'box', 'yellow', 'onion', 'million',
    ]
    const map = await analyzeWords(corpus)
    const problems = [...map.entries()]
      .filter(([, n]) => n.unknown.length > 0)
      .map(([w, n]) => `${w}: ${n.unknown.join('')} (raw ${n.raw})`)

    expect(problems).toEqual([])
  })

  it('produces no empty analyses', async () => {
    const map = await analyzeWords(['cat', 'blorf', 'x', 'a', 'strengths'])
    for (const [word, n] of map) {
      expect(n.phonemes.length, `${word} produced no phonemes`).toBeGreaterThan(0)
    }
  })

  it.each(Object.entries(EXPECTED))('%s', async (word, expected) => {
    const n = await analyzeWord(word)
    expect(n.phonemes, `raw: ${n.raw}`).toEqual(expected)
  })

  it('marks stress on a vowel', async () => {
    const n = await analyzeWord('umbrella')
    const stressedIndex = n.stress.findIndex((s) => s === 1)
    expect(stressedIndex).toBeGreaterThanOrEqual(0)
    expect(n.phonemes.length).toBe(n.stress.length)
  })

  it('phonemizes plausible misspellings identically to the target', async () => {
    for (const [target, attempt] of [['cat', 'kat'], ['phone', 'fone'], ['cheap', 'cheep']]) {
      const a = await analyzeWord(target)
      const b = await analyzeWord(attempt)
      expect(b.phonemes, `${attempt} vs ${target}`).toEqual(a.phonemes)
    }
  })
})
