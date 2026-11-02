import { describe, expect, it } from 'vitest'
import { analyzePair } from './analyze'
import type { AlignOptions } from './align'

/**
 * Scoring a passage read aloud.
 *
 * A spelling test asks which letters the student chose for a sound. A reading
 * test asks which sound they made for letters already printed in front of them,
 * and what the teacher types is a transcription of that sound. So the letters
 * stop being evidence about the student, and the rule that grades on them has
 * to stop applying — which is what these pin down.
 */

const DECODING: AlignOptions = { mode: 'decoding', lenientSchwa: true }
const ENCODING: AlignOptions = { lenientSchwa: true }

const render = (slots: Array<{ target: string; student: string[]; mark: string }>) =>
  slots.map((s) => `${s.target}<=${s.student.join('+') || '-'}:${s.mark}`).join(' ')

const marks = async (word: string, said: string, options: AlignOptions) =>
  render((await analyzePair(word, said, {}, options)).slots)

describe('the letters stop grading the answer', () => {
  it('scores a word read correctly as exact however it was transcribed', async () => {
    // The premise of the whole feature. Spelled "kat" these same sounds are a
    // near miss, because choosing `k` for /k/ is a spelling decision. Read
    // aloud, "kat" is just how the teacher wrote down a correct reading.
    expect(await marks('cat', 'kat', DECODING)).toBe('K<=K:exact A<=A:exact T<=T:exact')
    expect(await marks('cat', 'kat', ENCODING)).toBe('K<=K:plausible A<=A:exact T<=T:exact')
  })

  it('does not care which spelling of a vowel the teacher reached for', async () => {
    expect(await marks('cheap', 'cheep', DECODING)).toBe('CH<=CH:exact EE<=EE:exact P<=P:exact')
    expect(await marks('cheap', 'cheep', ENCODING)).toBe('CH<=CH:exact EE<=EE:plausible P<=P:exact')
  })
})

describe('a real misreading still reads as one', () => {
  it('marks a substituted sound wrong', async () => {
    // "free" for "three" is the error a reading teacher is looking for, and no
    // amount of leniency may hide it.
    const said = await marks('three', 'free', DECODING)
    expect(said).toContain('TH<=F:wrong')
  })

  it('marks a dropped sound omitted', async () => {
    expect(await marks('stop', 'sop', DECODING)).toBe(
      'S<=S:exact T<=-:omitted O<=O:exact P<=P:exact',
    )
  })

  it('marks every sound omitted when nothing was said', async () => {
    const a = await analyzePair('chasm', '', {}, DECODING)
    expect(a.attempted).toBe(false)
    expect(a.slots.every((s) => s.mark === 'omitted')).toBe(true)
  })

  it('catches a silent e ignored, which is what reading tests are for', async () => {
    // Read "made" as "mad": the vowel is the error and it is the vowel that
    // gets marked.
    expect(await marks('made', 'mad', DECODING)).toContain('AE<=A:wrong')
  })
})

describe('accent is not a decoding error', () => {
  // Asserted as the exact mark, not merely "not wrong", so these cannot pass by
  // the two sounds turning out to be identical.
  it.each([
    ['cot', 'caught', 'O<=AW:plausible'],
    ['running', "runnin'", 'NG<=N:plausible'],
    ['butter', 'buttah', 'ER<=SCHWA:plausible'],
    ['for', 'faw', 'OR<=AW:plausible'],
    ['car', 'cah', 'AR<=O:plausible'],
  ])('accepts %s read as %s', async (word, said, expected) => {
    expect(await marks(word, said, DECODING)).toContain(expected)
  })

  it('still refuses a pair that is not an accent', async () => {
    // The whole reason this is a named list and not a distance threshold:
    // anything loose enough to forgive a regional vowel also forgives this.
    expect(await marks('thin', 'fin', DECODING)).toContain('TH<=F:wrong')
    expect(await marks('three', 'free', DECODING)).toContain('TH<=F:wrong')
  })
})

/**
 * Issue #22, on the reading side.
 *
 * The rescue that stops a consonant being charged for a neighbour's mistake is
 * about the round trip through eSpeak, not about spelling — and the teacher's
 * respelling goes through the same round trip. Removing it here would undo the
 * fix for #22 exactly where dropped sounds are commonest.
 */
describe('a consonant is not charged for a neighbour, reading too', () => {
  it.each([
    ['again', 'agen'],
    ['their', 'thar'],
  ])('%s read as %s leaves the consonant alone', async (word, said) => {
    const result = await marks(word, said, DECODING)
    expect(result).not.toContain('G<=J:wrong')
    expect(result).not.toContain('DH<=TH:wrong')
  })
})

describe('the teacher has the last word', () => {
  it('lets an override beat the engine, for an accent it does not know', async () => {
    const wrong = await analyzePair('thin', 'fin', {}, DECODING)
    const slot = wrong.slots.findIndex((s) => s.mark === 'wrong')
    expect(slot).toBeGreaterThanOrEqual(0)

    const fixed = await analyzePair('thin', 'fin', { [slot]: { mark: 'exact' } }, DECODING)
    expect(fixed.slots[slot].mark).toBe('exact')
    expect(fixed.slots[slot].overridden).toBe(true)
  })
})

/**
 * The two modes side by side on the same answers.
 *
 * This is the clearest statement of what changes: a real misreading scores
 * identically either way, while the marks that were only ever about the
 * teacher's choice of letters go green.
 */
describe('the same answer, scored both ways', () => {
  it('keeps the error and drops the transcription artefact', async () => {
    // The vowel is genuinely misread and stays wrong in both. The /ch/ was said
    // perfectly; only spelling it "tch" instead of "ch" was ever a choice, and
    // a reader never made that choice.
    expect(await marks('reached', 'retched', ENCODING)).toBe(
      'R<=R:exact EE<=E:wrong CH<=CH:plausible T<=T:exact',
    )
    expect(await marks('reached', 'retched', DECODING)).toBe(
      'R<=R:exact EE<=E:wrong CH<=CH:exact T<=T:exact',
    )
  })

  it.each([
    ['cliff', 'clif', 'F'],
    ['before', 'befor', 'OR'],
  ])('%s read as %s scores the %s exact, not amber', async (word, said, sound) => {
    expect(await marks(word, said, ENCODING)).toContain(`${sound}:plausible`)
    expect(await marks(word, said, DECODING)).toContain(`${sound}:exact`)
  })

  it('leaves a reading that was genuinely wrong alone', async () => {
    // "shore" read as "sore" is a digraph reduced to its first letter, which is
    // a decoding failure however it is transcribed.
    const both = 'SH<=S:wrong OR<=OR:exact'
    expect(await marks('shore', 'sore', ENCODING)).toBe(both)
    expect(await marks('shore', 'sore', DECODING)).toBe(both)
  })
})

describe('encoding is untouched', () => {
  it.each([
    ['cat', 'kat'],
    ['cheap', 'cheep'],
    ['again', 'agen'],
    ['stop', 'sop'],
  ])('%s -> %s scores the same with the mode absent as with it set', async (word, attempt) => {
    expect(await marks(word, attempt, {})).toBe(await marks(word, attempt, { mode: 'encoding' }))
  })
})
