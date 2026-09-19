import { get, type PhonemeId } from '../data/phonemes'

/**
 * Phonetic distance in [0,1], used to rank candidate alignments.
 *
 * The point is not linguistic precision but keeping near-miss alignments ahead of
 * wild ones: /b/~/p/ must be cheap and /b/~/ē/ expensive, so that a student who
 * wrote "bat" for "pat" is scored as one voicing error rather than as a deletion
 * plus an insertion.
 */

type Manner = 'stop' | 'fricative' | 'affricate' | 'nasal' | 'liquid' | 'glide'

const MANNER_DISTANCE: Record<string, number> = {
  'stop|affricate': 0.35,
  'fricative|affricate': 0.3,
  'stop|fricative': 0.5,
  'nasal|stop': 0.5,
  'fricative|nasal': 0.7,
  'affricate|nasal': 0.7,
  'glide|liquid': 0.35,
  'liquid|nasal': 0.5,
  'glide|nasal': 0.7,
  'liquid|stop': 0.8,
  'fricative|liquid': 0.8,
  'affricate|liquid': 0.85,
  'glide|stop': 0.8,
  'fricative|glide': 0.8,
  'affricate|glide': 0.85,
}

function mannerDistance(a: Manner, b: Manner): number {
  if (a === b) return 0
  return MANNER_DISTANCE[[a, b].sort().join('|')] ?? 0.9
}

const MIN_SUBSTITUTION = 0.15

/** 0 when identical, otherwise at least MIN_SUBSTITUTION. */
export function phonemeDistance(a: PhonemeId, b: PhonemeId): number {
  if (a === b) return 0

  const fa = get(a).features
  const fb = get(b).features

  if (fa.kind !== fb.kind) return 1

  let d: number
  if (fa.kind === 'consonant' && fb.kind === 'consonant') {
    d =
      0.45 * mannerDistance(fa.manner, fb.manner) +
      0.35 * (Math.abs(fa.place - fb.place) / 7) +
      0.2 * (fa.voiced === fb.voiced ? 0 : 1)
  } else if (fa.kind === 'vowel' && fb.kind === 'vowel') {
    d =
      0.36 * (Math.abs(fa.height - fb.height) / 2) +
      0.27 * (Math.abs(fa.back - fb.back) / 2) +
      0.14 * (fa.tense === fb.tense ? 0 : 1) +
      0.18 * (fa.rhotic === fb.rhotic ? 0 : 1) +
      0.05 * (fa.diphthong === fb.diphthong ? 0 : 1)
  } else {
    d = 1
  }

  return Math.min(1, Math.max(MIN_SUBSTITUTION, d))
}
