import type { PhonemeId } from '../data/phonemes'
import { REPORT_ORDER } from '../data/phonemes'
import {
  byTeachingOrder,
  getGraphemeTally,
  getTally,
  type GraphemeRow,
  type Reports,
  type Tally,
} from './aggregate'

/**
 * The two reports that put spelling and reading side by side.
 *
 * Everywhere else in the app a report answers one question at a time, because
 * encoding and decoding are opposite directions and pooling them would average
 * them into a number that means nothing. These two are the exception, and they
 * earn it by never pooling: each side keeps its own score and the sheet shows
 * what the pair of them says.
 *
 * Combined accuracy asks *how well does this child know `oa` at all*, counting
 * each direction once. Divergence asks *which way round* — and that is the
 * question that changes what you teach, because a child who spells `oa` and
 * cannot read it needs something quite different from one who reads it and
 * cannot spell it.
 */

/**
 * Why a row has no divergence.
 *
 * Kept apart from "zero", which would be a finding — a row with nothing on one
 * side is not a child who performs equally in both directions.
 */
export type Missing =
  /** Nothing on either side. */
  | 'both'
  /** Only the spelling tests cover this. */
  | 'decoding'
  /** Only the reading passages cover this. */
  | 'encoding'
  /** Both sides, but one of them is too thin to draw a line between. */
  | 'thin'

/**
 * Opportunities needed on each side before a difference is reported.
 *
 * One each way yields ±1 whenever the child happened to get one right and one
 * wrong, which says nothing at all; three is enough that a difference is
 * unlikely to be a coin toss, and low enough that a single passage still
 * reports something. The sheet lets the teacher move it.
 */
export const MIN_EVIDENCE = 3

export interface CompareScores {
  /** Both directions weighted equally, or the only one there is. */
  combined: number | null
  /** Encoding minus decoding, in −1..+1. Positive: spells it, cannot read it. */
  divergence: number | null
  missing: Missing | null
}

const fractionOf = (t: Tally) => (t.total === 0 ? null : t.correct / t.total)

/**
 * What one row's two tallies say.
 *
 * The mean of the two fractions, NOT the pooled `(ec + dc) / (et + dt)`:
 * pooling lets whichever side had more opportunities decide the number, and a
 * passage can offer a grapheme thirty times where a spelling list offers it
 * twice. Equal weight per direction is what "normalising for frequency" asks
 * for.
 */
export function compareTallies(encoding: Tally, decoding: Tally, minimum: number): CompareScores {
  const e = fractionOf(encoding)
  const d = fractionOf(decoding)

  const missing: Missing | null =
    e === null && d === null
      ? 'both'
      : d === null
        ? 'decoding'
        : e === null
          ? 'encoding'
          : encoding.total < minimum || decoding.total < minimum
            ? 'thin'
            : null

  return {
    // One-sided rows keep the side they have. It is still what the child knows;
    // it is only the comparison that cannot be made.
    combined: e === null ? d : d === null ? e : (e + d) / 2,
    divergence: missing === null ? e! - d! : null,
    missing,
  }
}

export type CompareUnit =
  | { kind: 'grapheme'; row: GraphemeRow }
  | { kind: 'phoneme'; id: PhonemeId }

export interface CompareRow extends CompareScores {
  key: string
  unit: CompareUnit
  encoding: Tally
  decoding: Tally
}

/**
 * One row per spelling either direction covered.
 *
 * The union, not the intersection: a grapheme that only the passages reached is
 * exactly the kind of thing this sheet exists to surface, and dropping it would
 * hide the one-sidedness rather than report it.
 */
export function compareGraphemes(
  encoding: Reports,
  decoding: Reports,
  who: string,
  minimum: number,
): CompareRow[] {
  const units = new Map<string, GraphemeRow>()
  for (const g of [...encoding.graphemes, ...decoding.graphemes]) {
    if (!units.has(g.key)) units.set(g.key, g)
  }

  return [...units.values()].sort(byTeachingOrder).map((row) => {
    const enc = getGraphemeTally(encoding, row.key, who)
    const dec = getGraphemeTally(decoding, row.key, who)
    return {
      key: row.key,
      unit: { kind: 'grapheme', row },
      encoding: enc,
      decoding: dec,
      ...compareTallies(enc, dec, minimum),
    }
  })
}

/** The same question asked of sounds rather than spellings. */
export function comparePhonemes(
  encoding: Reports,
  decoding: Reports,
  who: string,
  minimum: number,
): CompareRow[] {
  const seen = new Set<PhonemeId>([...encoding.phonemes, ...decoding.phonemes])

  return REPORT_ORDER.filter((p) => seen.has(p)).map((id) => {
    const enc = getTally(encoding, id, who)
    const dec = getTally(decoding, id, who)
    return {
      key: id,
      unit: { kind: 'phoneme', id },
      encoding: enc,
      decoding: dec,
      ...compareTallies(enc, dec, minimum),
    }
  })
}
