import { useReportMode, type ReportMode } from '../state/useSelectedTests'

/**
 * Which way round every report reads.
 *
 * Encoding and decoding are the same grapheme–phoneme knowledge asked in
 * opposite directions, and a child can be fluent one way and lost the other.
 * Pooling them would average two different questions into one meaningless
 * number, so a report answers one at a time and this is where that is chosen.
 *
 * It sits above the test picker on purpose: the picker lists only this mode's
 * tests, so the question has to be settled before the list below it means
 * anything.
 */
export function ModeToggle() {
  const { mode, setMode } = useReportMode()

  return (
    <div className="modetoggle no-print" role="group" aria-label="Which tests these numbers come from">
      <span className="modetoggle-label">Evidence from</span>
      <button
        className={`btn ${mode === 'encoding' ? 'primary' : ''}`}
        aria-pressed={mode === 'encoding'}
        title="Encoding: the student hears a sound and has to write it"
        onClick={() => setMode('encoding')}
      >
        Spelling tests
      </button>
      <button
        className={`btn ${mode === 'decoding' ? 'primary' : ''}`}
        aria-pressed={mode === 'decoding'}
        title="Decoding: the student sees letters and has to say them"
        onClick={() => setMode('decoding')}
      >
        Reading passages
      </button>
    </div>
  )
}

/**
 * What to say when the project has nothing of the chosen kind.
 *
 * Distinct from "choose at least one test above", which means the teacher
 * cleared the picker. This one means there is nothing to choose, and the way
 * out is the toggle — so it says so rather than leaving an empty page.
 */
export function noTestsInMode(mode: ReportMode): string {
  return mode === 'decoding'
    ? 'No reading passages have been marked yet. Mark one on the Reading passage tab, or switch to Spelling tests above.'
    : 'No spelling tests have been entered yet. Enter one on the Spelling test tab, or switch to Reading passages above.'
}
