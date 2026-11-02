import { useEffect, useMemo } from 'react'
import { useStore } from '../state/store'
import { useStudentNames } from '../state/names'
import { findOccurrences, type Drill } from '../reports/occurrences'
import { displayList } from '../data/phonemes'
import { isReading } from '../state/types'
import type { Mark } from '../engine/align'
import { toCsv } from '../export/csv'
import { useDownloads } from './DownloadProvider'
import { useFileName } from '../state/filename'

const MARK_TEXT: Record<Mark, string> = {
  exact: 'correct',
  plausible: 'right sound, other spelling',
  wrong: 'wrong sound',
  omitted: 'left out',
}

/**
 * The same four marks, said the way they happened.
 *
 * Reading aloud makes no spelling choice, so "other spelling" would describe
 * the teacher's typing rather than the student's answer — and an amber mark
 * here is a reduced vowel or an accent, not an error at all.
 */
const SAID_TEXT: Record<Mark, string> = {
  exact: 'correct',
  plausible: 'close pronunciation',
  wrong: 'wrong sound',
  omitted: 'said nothing',
}

/**
 * Every answer behind one accuracy figure.
 *
 * The count here is the same count the cell showed — it is produced by walking
 * the same answers the report counted, not by a second interpretation of the
 * data — so a teacher can check the number rather than take it on trust.
 */
export function OccurrenceModal({ drill, onClose }: { drill: Drill; onClose: () => void }) {
  const { project } = useStore()
  const names = useStudentNames()
  const { requestDownload } = useDownloads()
  const fileName = useFileName()
  const { notation } = project.settings

  const rows = useMemo(() => findOccurrences(project, drill), [project, drill])
  const sounds = drill.sounds?.length ? displayList(drill.sounds, notation) : ''

  /*
   * Decided from the evidence rather than from the toggle, because these are
   * the very answers the cell counted. The columns below hold the teacher's
   * transcription of a reading, and heading one "They wrote" would credit the
   * student with a spelling they never produced.
   */
  const said = drill.sources.length > 0 && drill.sources.every(({ test }) => isReading(test))
  const markText = said ? SAID_TEXT : MARK_TEXT

  // Escape closes, which a modal opened by a stray click badly needs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const correct = rows.filter((r) => r.mark === 'exact').length
  const plausible = rows.filter((r) => r.mark === 'plausible').length
  /**
   * A confusion or misuse cell already counts one specific outcome, so a
   * "4 of 6 correct" score would be meaningless there — every row is that same
   * outcome. Those show how often it happened instead.
   */
  const countOnly = drill.produced !== undefined || drill.kind === 'misuse'
  const manyTests = new Set(rows.map((r) => r.testId)).size > 1
  const manyStudents = drill.studentId === '__class'

  const exportCsv = () => {
    const out: string[][] = [
      said
        ? ['Test', 'Date', 'Student', 'Word', 'Type', 'Read as', 'Letters', 'You typed', 'Sounds', 'Result']
        : ['Test', 'Date', 'Student', 'Word', 'Type', 'Wrote', 'Needed', 'They wrote', 'Sounds', 'Result'],
      ...rows.map((r) => [
        r.testName,
        r.testDate,
        names(r.studentId),
        r.word,
        r.nonsense ? 'nonsense' : 'real',
        r.attempt,
        r.targetLetters,
        r.wroteLetters || '—',
        displayList(r.sounds, notation),
        markText[r.mark],
      ]),
    ]
    requestDownload({
      name: fileName('Examples', [drill.label]),
      extension: 'csv',
      mime: 'text/csv',
      build: () => toCsv(out),
      folder: 'Examples',
    })
  }

  return (
    <div className="backdrop" onClick={onClose}>
      <div
        className="dialog wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Examples behind ${drill.label}`}
      >
        <header className="drillhead">
          <div>
            <h3>
              <span className="phoneme">{drill.label}</span>
              {/* For a phoneme row the label already IS the sound, so showing it
                  again would read as "/t//t/". */}
              {sounds && sounds !== drill.label && <span className="drillsounds">{sounds}</span>}
            </h3>
            <p className="sub">
              {drill.studentId === '__class' ? 'Whole class' : names(drill.studentId)} ·{' '}
              {drill.scopeLabel}
            </p>
          </div>
          <div className="drillscore">
            {!countOnly ? (
              <>
                <strong>
                  {correct}/{rows.length}
                </strong>
                <span>
                  {said ? 'read correctly' : 'spelled correctly'}
                  {plausible > 0 &&
                    ` · ${plausible} ${said ? 'close pronunciation' : 'right sound, other spelling'}`}
                </span>
              </>
            ) : (
              <>
                <strong>{rows.length}</strong>
                <span>time{rows.length === 1 ? '' : 's'}</span>
              </>
            )}
          </div>
        </header>

        {rows.length === 0 ? (
          <div className="empty">Nothing was attempted here.</div>
        ) : (
          <div className="scroll drilltable">
            <table>
              <thead>
                <tr>
                  {manyTests && <th>Test</th>}
                  {manyStudents && <th>Student</th>}
                  <th>Word</th>
                  <th>{said ? 'Read as' : 'They wrote'}</th>
                  <th>{said ? 'Letters' : 'Needed'}</th>
                  <th>{said ? 'You typed' : 'Wrote here'}</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.testId}-${r.studentId}-${r.word}-${i}`}>
                    {manyTests && <td className="dim">{r.testName}</td>}
                    {manyStudents && <th className="rowhead">{names(r.studentId)}</th>}
                    <td>
                      {r.word}
                      {r.nonsense && <span className="keyword">nonsense</span>}
                    </td>
                    <td className="mono">{r.attempt || '—'}</td>
                    <td className="mono dim">{r.targetLetters || '—'}</td>
                    <td className={`mono cell ${r.mark}`} style={{ cursor: 'default' }}>
                      {r.wroteLetters || '—'}
                    </td>
                    <td className={`cell ${r.mark}`} style={{ cursor: 'default' }}>
                      {markText[r.mark]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer>
          <span className="spacer" />
          <button className="btn" onClick={exportCsv} disabled={rows.length === 0}>
            Download CSV
          </button>
          <button className="btn primary" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  )
}
