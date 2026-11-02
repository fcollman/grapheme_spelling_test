import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type Project, type Test } from '../state/types'
import { analyzeMany, analyzePair } from '../engine/analyze'
import { findPatterns } from '../engine/patterns'
import { buildUnits } from '../engine/units'
import type { AlignOptions } from '../engine/align'
import { cellKey, type AnalysisResult } from '../state/useAnalysis'
import {
  buildReports,
  buildReportsAcross,
  CLASS,
  diagonalKey,
  getGraphemeConfusion,
  NONE,
  soundsKey,
  type Reports,
} from './aggregate'
import { findOccurrences } from './occurrences'

/**
 * What the grapheme confusion sheet counts along its produced axis.
 *
 * Spelling and reading produce different things. The student picked the letters
 * in a spelling test, so the letters are the answer. In a reading test the
 * letters are the teacher's shorthand for a sound she heard, and counting them
 * splits one mispronunciation across as many columns as there are ways to spell
 * it. These pin the axis down in both directions.
 */

const students = [{ id: 's1', name: 'Ava' }]

async function build(
  kind: 'spelling' | 'reading',
  words: Array<{ id: string; text: string }>,
  responses: Record<string, string>,
) {
  const options: AlignOptions = kind === 'reading' ? { mode: 'decoding' } : {}
  const test: Test = {
    id: 't',
    name: 'T',
    date: '2026-01-01',
    kind,
    words: words.map((w) => ({ ...w, nonsense: false })),
    responses: Object.fromEntries(words.map((w) => [w.id, { s1: responses[w.id] }])),
    overrides: {},
    wordPhonemes: {},
  }
  const project: Project = {
    version: 1,
    students,
    tests: [test],
    activeTestId: 't',
    settings: DEFAULT_SETTINGS,
  }

  const results = await analyzeMany(
    words.map((w) => ({ word: w.text, attempt: responses[w.id] })),
    options,
  )
  const byCell = new Map()
  words.forEach((w, i) => byCell.set(cellKey(w.id, 's1'), results[i]))

  const byWord = new Map()
  const unitsByWord = new Map()
  const patternsByWord = new Map()
  for (const w of words) {
    const target = await analyzePair(w.text, '', {}, options)
    const patterns = findPatterns(target.targetPhonemes, target.targetGraphemes, target.syllables, target.word)
    byWord.set(w.id, target)
    patternsByWord.set(w.id, patterns)
    unitsByWord.set(w.id, buildUnits(target, patterns))
  }

  const analysis: AnalysisResult = { loading: false, error: null, byCell, byWord, unitsByWord, patternsByWord }
  const sources = [{ test, analysis }]
  return { reports: buildReports(project, test, analysis), project, sources }
}

const rowFor = (reports: Reports, letters: string) =>
  reports.graphemes.find((g) => g.letters === letters)!

describe('a spelling test still counts letters', () => {
  it('puts the spelling the student chose on the produced axis', async () => {
    // "sip" for "ship": the `s` is the answer, and the sheet exists to show it.
    const { reports } = await build('spelling', [{ id: 'w1', text: 'ship' }], { w1: 'sip' })
    expect(reports.producedIsSound).toBe(false)
    expect(reports.producedUnits).toContain('s')
    const sh = rowFor(reports, 'sh')
    expect(getGraphemeConfusion(reports, CLASS, sh.key, 's')).toBe(1)
    expect(diagonalKey(sh, reports.producedIsSound)).toBe('sh')
  })
})

describe('a reading test counts sounds', () => {
  it('names the column by the sound said, not by how it was written down', async () => {
    // "free" for "three". /f/ is the column whatever the teacher typed.
    const { reports } = await build('reading', [{ id: 'w1', text: 'three' }], { w1: 'free' })
    expect(reports.producedIsSound).toBe(true)
    const th = rowFor(reports, 'th')
    expect(getGraphemeConfusion(reports, CLASS, th.key, soundsKey(['F']))).toBe(1)
    // The letters the teacher happened to use are not a column at all.
    expect(reports.producedUnits).not.toContain('f')
  })

  it('lands one mispronunciation in one column however it was transcribed', async () => {
    /*
     * The whole point of the follow-up. `ea` read as /ē/ twice, written down
     * once as "breed" and once as "trede" — the same misreading typed two ways,
     * which used to be two columns splitting one denominator across an already
     * sparse grid.
     */
    const { reports } = await build(
      'reading',
      [
        { id: 'w1', text: 'bread' },
        { id: 'w2', text: 'tread' },
      ],
      { w1: 'breed', w2: 'trede' },
    )
    const ea = rowFor(reports, 'ea')
    expect(getGraphemeConfusion(reports, CLASS, ea.key, soundsKey(['EE']))).toBe(2)
    // And it is one column, not two: nothing else on the axis is that sound.
    expect(reports.producedUnits.filter((c) => c === soundsKey(['EE']))).toHaveLength(1)
  })

  it('counts a correct reading on the diagonal, which is the target sound', async () => {
    const { reports } = await build('reading', [{ id: 'w1', text: 'cat' }], { w1: 'kat' })
    const c = rowFor(reports, 'c')
    expect(diagonalKey(c, true)).toBe(soundsKey(['K']))
    expect(getGraphemeConfusion(reports, CLASS, c.key, soundsKey(['K']))).toBe(1)
  })

  it('counts a dropped sound as ∅, the same as nothing written', async () => {
    const { reports } = await build('reading', [{ id: 'w1', text: 'stop' }], { w1: 'sop' })
    const t = rowFor(reports, 't')
    expect(getGraphemeConfusion(reports, CLASS, t.key, NONE)).toBe(1)
  })

  it('leaves an accent off the diagonal, where the teacher can see it', async () => {
    /*
     * "cot" read with the caught vowel is `plausible`: close enough not to be a
     * decoding error. It is deliberately NOT folded onto the diagonal the way
     * an exact mark is. The teacher is the authority on her own students'
     * dialect, and she can only exercise that over evidence she can see.
     */
    const { reports } = await build('reading', [{ id: 'w1', text: 'cot' }], { w1: 'caught' })
    const o = rowFor(reports, 'o')
    expect(getGraphemeConfusion(reports, CLASS, o.key, soundsKey(['AW']))).toBe(1)
    expect(getGraphemeConfusion(reports, CLASS, o.key, diagonalKey(o, true))).toBe(0)
  })

  it('keeps an exact mark on the diagonal even when the phonemizer drifted', async () => {
    /*
     * The consonant rescue: "again" respelled "agen" reads its `g` soft, so the
     * engine's phoneme for it is not /g/ at all. That is a round trip through
     * eSpeak, not something the student said, and the accuracy sheet already
     * counts it correct — so the confusion sheet must not invent a substitution
     * that contradicts it.
     */
    const { reports } = await build('reading', [{ id: 'w1', text: 'again' }], { w1: 'agen' })
    const g = rowFor(reports, 'g')
    expect(getGraphemeConfusion(reports, CLASS, g.key, soundsKey(['G']))).toBe(1)
  })
})

describe('one sheet, one axis', () => {
  it('falls back to letters when the selection is not all reading', async () => {
    /*
     * A unit's row key is its letters and its sounds, so the same grapheme from
     * a spelling test and from a reading test is one row — and choosing the
     * axis per word would hand that row a letter column and a sound column and
     * be right in neither. The tabs cannot produce a mixed selection; if one
     * ever arrives it reads the way the sheet did before reading tests existed.
     */
    const spelling = await build('spelling', [{ id: 'w1', text: 'ship' }], { w1: 'sip' })
    const reading = await build('reading', [{ id: 'w1', text: 'three' }], { w1: 'free' })
    const mixed = buildReportsAcross(spelling.project, [...spelling.sources, ...reading.sources])

    expect(mixed.producedIsSound).toBe(false)
    expect(mixed.producedUnits).toContain('s')
    // The reading test's respelling goes on the letters axis with the rest.
    expect(mixed.producedUnits).toContain('f')
    expect(mixed.producedUnits).not.toContain(soundsKey(['F']))
  })
})

describe('the drill-down agrees with the cell that opened it', () => {
  it('matches every cell of a reading test, letters or sounds', async () => {
    const { reports, project, sources } = await build(
      'reading',
      [
        { id: 'w1', text: 'three' },
        { id: 'w2', text: 'stop' },
      ],
      { w1: 'free', w2: 'sop' },
    )

    for (const g of reports.graphemes) {
      for (const produced of reports.producedUnits) {
        const count = getGraphemeConfusion(reports, CLASS, g.key, produced)
        const rows = findOccurrences(project, {
          kind: 'grapheme',
          key: g.key,
          label: g.letters,
          studentId: CLASS,
          sources,
          scopeLabel: 'T',
          produced,
        })
        expect(rows.length, `${g.letters} -> ${produced}`).toBe(count)
      }
    }
  })
})
