/**
 * What a keystroke means while marking a passage.
 *
 * Kept apart from the page, and returning a plan rather than doing anything,
 * because the first bug here was an ordering mistake: the check for "is there a
 * next word" sat in front of the line that recorded the current one, so tapping
 * Tab through a perfect reading left the last word blank. Deciding what should
 * happen is now one pure answer that can be checked at every position,
 * including the end, and carrying it out is somebody else's job.
 */

export interface KeyPlan {
  /** What to store against the word the key was pressed on. */
  record: 'confirm' | 'omit' | null
  /** Which word to focus next, or null to leave focus where the browser puts it. */
  move: number | null
  /** Whether to suppress the browser's own handling of the key. */
  preventDefault: boolean
  /** Escape gets out of the passage without marking anything. */
  blur: boolean
}

export interface KeyContext {
  key: string
  shiftKey: boolean
  /** What is already typed for this word. */
  value: string
  /** Whether this word is already marked as skipped. */
  omitted: boolean
  index: number
  wordCount: number
}

/** `null` for a key this page does not handle, which the browser then gets. */
export function planKey({
  key,
  shiftKey,
  value,
  omitted,
  index,
  wordCount,
}: KeyContext): KeyPlan | null {
  const after = (i: number) => (i >= 0 && i < wordCount ? i : null)

  /*
   * A dash marks a word the student never said. It needs no modifier and
   * cannot collide with a respelling: the tokeniser splits on a hyphen and
   * `cleanWord` strips it, so a dash is never part of what a teacher types.
   */
  if (key === '-' && value === '') {
    return { record: 'omit', move: after(index + 1), preventDefault: true, blur: false }
  }

  if (key === 'Escape') {
    return { record: null, move: null, preventDefault: false, blur: true }
  }

  if (key !== 'Tab' && key !== 'Enter') return null

  const back = shiftKey
  const move = after(back ? index - 1 : index + 1)

  /*
   * Moving forward over a word nothing has been said about means it was read
   * correctly — and that is as true of the last word as of any other, which is
   * why this is decided without reference to whether there is anywhere to go.
   *
   * Moving backwards asserts nothing, so a teacher can return to a word to
   * listen again without marking everything they pass on the way.
   */
  const record = !back && value === '' && !omitted ? 'confirm' : null

  /*
   * Focus is deliberately not trapped: at either end of the passage Tab is left
   * alone so it carries on out to the surrounding controls, as it would
   * anywhere else on a page. Enter has nowhere to go, so it is swallowed rather
   * than submitting something.
   */
  const preventDefault = move !== null || key === 'Enter'

  return { record, move, preventDefault, blur: false }
}
