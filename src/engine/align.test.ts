import { describe, expect, it } from 'vitest'
import { analyzePair } from './analyze'
import { syllabify } from './syllabify'
import { segment } from './segment'
import { fallbackRead, isSpelledOut } from './fallback'
import { analyzeWord } from './phonemize'

/** Compact rendering of a result: "PHONEME(target letters)<=STUDENT(letters):mark". */
function render(slots: Array<{ target: string; student: string[]; mark: string }>): string {
  return slots.map((s) => `${s.target}<=${s.student.join('+') || '-'}:${s.mark}`).join(' ')
}

describe('alignment fixtures', () => {
  const cases: Array<[string, string, string]> = [
    // perfect
    ['cat', 'cat', 'K<=K:exact A<=A:exact T<=T:exact'],
    // phonetically plausible: right sounds, different letters
    ['cat', 'kat', 'K<=K:plausible A<=A:exact T<=T:exact'],
    ['phone', 'fone', 'F<=F:plausible OE<=OE:exact N<=N:exact'],
    ['cheap', 'cheep', 'CH<=CH:exact EE<=EE:plausible P<=P:exact'],
    ['said', 'sed', 'S<=S:exact E<=E:plausible D<=D:exact'],
    // single substitutions, error isolated to one slot
    ['cat', 'cet', 'K<=K:exact A<=E:wrong T<=T:exact'],
    ['ship', 'sip', 'SH<=S:wrong I<=I:exact P<=P:exact'],
    ['ship', 'chip', 'SH<=CH:wrong I<=I:exact P<=P:exact'],
    ['zilth', 'zilf', 'Z<=Z:exact I<=I:exact L<=L:exact TH<=F:wrong'],
    ['thrunk', 'frunk', 'TH<=F:wrong R<=R:exact U<=U:exact NG<=NG:exact K<=K:exact'],
    // omissions
    ['stop', 'sop', 'S<=S:exact T<=-:omitted O<=O:exact P<=P:exact'],
    ['jump', 'jup', 'J<=J:exact U<=U:exact M<=-:omitted P<=P:exact'],
    // dropped vowel: eSpeak would spell this out, the fallback must catch it
    ['splash', 'splsh', 'S<=S:exact P<=P:exact L<=L:exact A<=-:omitted SH<=SH:exact'],
    // nonsense target words
    ['blorf', 'blorf', 'B<=B:exact L<=L:exact OR<=OR:exact F<=F:exact'],
    ['blorf', 'blof', 'B<=B:exact L<=L:exact OR<=O:wrong F<=F:exact'],
    ['blorf', 'blurf', 'B<=B:exact L<=L:exact OR<=ER:wrong F<=F:exact'],
    // silent e dropped: the error belongs to the vowel, not the final consonant
    ['bike', 'bik', 'B<=B:exact IE<=I:wrong K<=K:exact'],
    ['cake', 'cak', 'K<=K:exact AE<=A:wrong K<=K:exact'],
    // doubled letters
    ['rabbit', 'rabit', 'R<=R:exact A<=A:exact B<=B:plausible I<=I:exact T<=T:exact'],
    ['umbrella', 'umbrela', 'U<=U:exact M<=M:exact B<=B:exact R<=R:exact E<=E:exact L<=L:plausible SCHWA<=SCHWA:exact'],
  ]

  it.each(cases)('%s -> %s', async (word, attempt, expected) => {
    const a = await analyzePair(word, attempt)
    expect(render(a.slots)).toBe(expected)
  })

  /**
   * Issue #25. A misspelling anywhere changes how the engine reads the letters
   * around it, and a consonant the student got right was being charged for it.
   *
   * The teacher's own examples: in *again*, the `g` is a perfectly good `g` in
   * every one of these attempts, but `g` before `e` reads soft, so it was coming
   * back as a wrong sound. One mistake, counted twice, against a skill they
   * demonstrated.
   */
  describe('a consonant the student spelled right is not charged for a neighbour', () => {
    it.each([
      ['again', 'agen'],
      ['again', 'agian'],
      ['again', 'agenia'],
    ])('%s -> %s keeps the g', async (word, attempt) => {
      const a = await analyzePair(word, attempt)
      const g = a.slots.find((slot) => slot.targetGrapheme === 'g')
      expect(g?.mark, render(a.slots)).toBe('exact')
    })

    it('keeps a th whose voicing the spelling never showed', async () => {
      // "their" is voiced, "thar" is not, and nothing in the letters says which.
      const a = await analyzePair('their', 'thar')
      expect(a.slots[0].mark).toBe('exact')
      // The vowel is the real error and still says so.
      expect(a.slots[1].mark).toBe('wrong')
    })

    it('keeps a c that went soft because the vowel after it changed', async () => {
      const a = await analyzePair('cat', 'cyt')
      expect(a.slots[0].mark).toBe('exact')
      expect(a.slots[1].mark).toBe('wrong')
    })

    it('works in the other direction too', async () => {
      // Here the target is the soft one and the attempt reads hard.
      const a = await analyzePair('giant', 'gant')
      expect(a.slots[0].mark).toBe('exact')
    })

    /**
     * The limit, and the reason this is consonants only. A vowel that changed
     * sound is usually the error itself rather than an echo of one: "hope" for
     * *hop* spells the vowel with the same `o`, and the silent `e` that changed
     * it is precisely what went wrong.
     */
    it('still scores a vowel that changed sound, even with the same letter', async () => {
      const hope = await analyzePair('hop', 'hope')
      expect(hope.slots[1].mark, render(hope.slots)).toBe('wrong')

      const bike = await analyzePair('bike', 'bik')
      expect(bike.slots[1].mark, render(bike.slots)).toBe('wrong')
    })

    it('does not forgive a consonant the student actually spelled differently', async () => {
      // Different letters, wrong sound: a real error, untouched.
      const a = await analyzePair('ship', 'chip')
      expect(a.slots[0].mark).toBe('wrong')
    })

    it('does not forgive letters that produced extra sounds', async () => {
      // "nia" is not the word's `n`; it is three sounds, so the rule stays out.
      const a = await analyzePair('again', 'agenia')
      const n = a.slots[a.slots.length - 1]
      expect(n.mark).toBe('wrong')
    })
  })

  it('produces one slot per target phoneme regardless of attempt', async () => {
    for (const attempt of ['', 'x', 'catcatcat', 'zzzz', 'cat']) {
      const a = await analyzePair('cat', attempt)
      expect(a.slots.length, `attempt "${attempt}"`).toBe(3)
    }
  })

  it('marks an unattempted word as omitted throughout', async () => {
    const a = await analyzePair('cat', '')
    expect(a.attempted).toBe(false)
    expect(a.slots.every((s) => s.mark === 'omitted')).toBe(true)
  })

  it('can place more than one student phoneme in a cell', async () => {
    const a = await analyzePair('cat', 'clat')
    const multi = a.slots.filter((s) => s.student.length > 1)
    expect(multi.length).toBeGreaterThan(0)
  })

  it('flags an exactly correct spelling', async () => {
    const a = await analyzePair('umbrella', 'umbrella')
    expect(a.spellingCorrect).toBe(true)
    expect(a.slots.every((s) => s.mark === 'exact')).toBe(true)
  })

  it('honours a teacher override without re-running the engine over it', async () => {
    const a = await analyzePair('ship', 'sip', { 0: { student: ['SH'], mark: 'exact' } })
    expect(a.slots[0].mark).toBe('exact')
    expect(a.slots[0].student).toEqual(['SH'])
    expect(a.slots[0].overridden).toBe(true)
    expect(a.slots[1].overridden).toBe(false)
  })

  it('lenient schwa forgives eSpeak vowel reduction', async () => {
    const strict = await analyzePair('nation', 'nashun', {}, { lenientSchwa: false })
    const lenient = await analyzePair('nation', 'nashun', {}, { lenientSchwa: true })
    expect(strict.slots[3].mark).toBe('wrong')
    expect(lenient.slots[3].mark).not.toBe('wrong')
  })
})

/**
 * eSpeak guesses stress from the spelling, so a word it knows and a misspelling
 * of that word can reduce different vowels to schwa. "bombastic" is stressed on
 * the second syllable and reduces the first vowel; "bombastick" is unknown to
 * it, gets first-syllable stress, and reduces the second vowel instead. Letters
 * the student copied correctly must not be marked down for that.
 */
describe('vowel reduction caused by the engine, not the student', () => {
  it('accepts a letter the student copied exactly, despite the sound shifting', async () => {
    const a = await analyzePair('bombastic', 'bombastick', {}, { lenientSchwa: true })
    const slots = a.slots.map((s) => `${s.targetGrapheme}→${s.studentGrapheme}:${s.mark}`)

    // The "a" is the stressed vowel in the target and a schwa in their spelling,
    // yet they wrote the same letter the word uses.
    expect(slots).toContain('a→a:exact')
    // And the first vowel, schwa in the target, likewise.
    expect(slots).toContain('o→o:exact')
  })

  it('still marks a genuine vowel change wrong when letters happen to match', async () => {
    // Adding a silent e changes the vowel. No schwa is involved, so matching
    // letters must not excuse it, or "hope" for "hop" would score full marks.
    for (const [target, attempt] of [
      ['hop', 'hope'],
      ['tap', 'tape'],
      ['cat', 'cate'],
    ]) {
      const a = await analyzePair(target, attempt, {}, { lenientSchwa: true })
      const vowel = a.slots.find((s) => s.targetGrapheme === target[1])
      expect(vowel?.mark, `${target} -> ${attempt}`).toBe('wrong')
    }
  })

  it('leaves a different letter as a spelling difference, not a match', async () => {
    // "bumbastic" has the right sound but the wrong letter, which is amber.
    const a = await analyzePair('bombastic', 'bumbastic', {}, { lenientSchwa: true })
    expect(a.slots.find((s) => s.targetGrapheme === 'o')?.mark).toBe('plausible')
  })

  it('does not apply the waiver when lenient schwa is switched off', async () => {
    const a = await analyzePair('bombastic', 'bombastick', {}, { lenientSchwa: false })
    expect(a.slots.find((s) => s.targetGrapheme === 'a')?.mark).toBe('wrong')
  })
})

describe('syllabify', () => {
  const cases: Array<[string, string]> = [
    ['cat', 'K-A-T'],
    ['tablet', 'T-A-B | L-SCHWA-T'],
    ['rabbit', 'R-A-B | I-T'],
    ['napkin', 'N-A-P | K-I-N'],
    ['umbrella', 'U-M | B-R-E-L | SCHWA'],
    ['fantastic', 'F-A-N | T-A-S | T-I-K'],
    ['blorf', 'B-L-OR-F'],
  ]

  it.each(cases)('%s', async (word, expected) => {
    const n = await analyzeWord(word)
    const s = syllabify(n.phonemes, n.stress)
    expect(s.map((x) => x.phonemes.join('-')).join(' | ')).toBe(expected)
  })

  it('handles a word with no vowel without crashing', () => {
    expect(syllabify(['S', 'H'], [0, 0])).toHaveLength(1)
    expect(syllabify([], [])).toHaveLength(0)
  })
})

describe('segment', () => {
  it.each([
    ['cat', ['K', 'A', 'T'], ['c', 'a', 't']],
    ['ship', ['SH', 'I', 'P'], ['sh', 'i', 'p']],
    ['phone', ['F', 'OE', 'N'], ['ph', 'o', 'ne']],
    ['blorf', ['B', 'L', 'OR', 'F'], ['b', 'l', 'or', 'f']],
    ['rabbit', ['R', 'A', 'B', 'I', 'T'], ['r', 'a', 'bb', 'i', 't']],
  ])('%s', (spelling, phonemes, expected) => {
    expect(segment(spelling, phonemes)).toEqual(expected)
  })

  it('always reassembles into the original spelling', () => {
    const inputs: Array<[string, string[]]> = [
      ['strength', ['S', 'T', 'R', 'E', 'NG', 'TH']],
      ['xyzzy', ['Z', 'I']],
      ['a', ['SCHWA']],
      ['aaaaaaaaaa', ['A']],
    ]
    for (const [spelling, phonemes] of inputs) {
      expect(segment(spelling, phonemes).join(''), spelling).toBe(spelling)
    }
  })
})

describe('spelled-out detection', () => {
  it('recognises eSpeak reading letters aloud', () => {
    // "splsh" comes back as ess-pee-ell-ess-aitch
    expect(isSpelledOut('splsh', ['E', 'S', 'P', 'EE', 'E', 'L', 'E', 'S', 'AE', 'CH'])).toBe(true)
  })

  it('does not misfire on ordinary words with more phonemes than letters', () => {
    expect(isSpelledOut('box', ['B', 'O', 'K', 'S'])).toBe(false)
    expect(isSpelledOut('six', ['S', 'I', 'K', 'S'])).toBe(false)
    expect(isSpelledOut('cat', ['K', 'A', 'T'])).toBe(false)
  })

  it('leaves single letters alone, where the letter name is the right reading', () => {
    expect(isSpelledOut('a', ['AE'])).toBe(false)
  })

  it('reads vowel-less strings by grapheme', () => {
    expect(fallbackRead('splsh')).toEqual(['S', 'P', 'L', 'SH'])
    expect(fallbackRead('chrch')).toEqual(['CH', 'R', 'CH'])
  })
})
