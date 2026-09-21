import { useRef, useState } from 'react'
import { useStore } from './state/store'
import { useAnalysis } from './state/useAnalysis'
import { readProjectFile } from './state/persist'
import { useFileName } from './state/filename'
import { DownloadProvider, useDownloads } from './components/DownloadProvider'
import { demoProject, DEMO_STUDENT_COUNT } from './state/demo'
import { emptyProject } from './state/types'
import { ConfirmDialog } from './components/ConfirmDialog'
import { EntryGrid } from './pages/EntryGrid'
import { GraphemeAnalysis } from './pages/GraphemeAnalysis'
import { StudentProfile } from './pages/StudentProfile'
import { ReportProgress } from './pages/ReportProgress'
import { ReportGraphemeAccuracy } from './pages/ReportGraphemeAccuracy'
import { ReportGraphemeConfusion } from './pages/ReportGraphemeConfusion'
import { ReportAccuracy } from './pages/ReportAccuracy'
import { ReportMisuse } from './pages/ReportMisuse'
import { ReportConfusion } from './pages/ReportConfusion'
import { Help } from './pages/Help'
import './ui/styles.css'

/** Marking first, then the spelling-level reports, then the sound-level ones. */
const TABS = [
  { id: 'entry', label: 'Spelling test', group: 'Enter' },
  { id: 'analysis', label: 'Grapheme analysis', group: 'Enter' },
  { id: 'profile', label: 'Student profile', group: 'Per student' },
  { id: 'progress', label: 'Progress over time', group: 'Per student' },
  { id: 'g-accuracy', label: 'Accuracy by grapheme', group: 'By spelling' },
  { id: 'g-confusion', label: 'Grapheme confusion', group: 'By spelling' },
  { id: 'accuracy', label: 'Accuracy by phoneme', group: 'By sound' },
  { id: 'misuse', label: 'Phoneme misuse', group: 'By sound' },
  { id: 'confusion', label: 'Phoneme confusion', group: 'By sound' },
] as const

/** 'help' is reached from the toolbar rather than the tab strip, which is for analysis. */
type TabId = (typeof TABS)[number]['id'] | 'help'

export function App() {
  return (
    <DownloadProvider>
      <Workspace />
    </DownloadProvider>
  )
}

function Workspace() {
  const { project, test, dispatch } = useStore()
  const { requestDownload } = useDownloads()
  const fileName = useFileName()
  const analysis = useAnalysis(project, test)
  const [tab, setTab] = useState<TabId>('entry')
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState<'demo' | 'clear' | 'deleteTest' | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const hasData =
    project.students.length > 0 || project.tests.some((t) => t.words.length > 0)

  const loadDemo = () => {
    dispatch({ type: 'replaceProject', project: demoProject() })
    setTab('entry')
    setPending(null)
  }

  /** How much deleting the current test would throw away. */
  const testWords = test.words.length
  const testSpellings = Object.values(test.responses).reduce(
    (n, byStudent) => n + Object.values(byStudent).filter((v) => v.trim() !== '').length,
    0,
  )
  // A test with nothing on it is not worth a dialog — that is the misclick case.
  const testIsEmpty = testWords === 0 && testSpellings === 0

  const deleteTest = () => {
    dispatch({ type: 'removeTest', id: test.id })
    setPending(null)
  }

  const clearAll = () => {
    dispatch({ type: 'replaceProject', project: emptyProject() })
    setTab('entry')
    setPending(null)
  }

  async function onOpenFile(file: File | undefined) {
    if (!file) return
    try {
      const loaded = await readProjectFile(file)
      dispatch({ type: 'replaceProject', project: loaded })
      setMessage(null)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="app">
      <header className="topbar no-print">
        <div className="group">
          <h1>Grapheme Spelling Test</h1>
          {/*
            One project file is one class. Naming it here is what puts "Block 2A"
            at the front of every file this class exports and on every printout.
          */}
          <input
            type="text"
            value={project.className ?? ''}
            placeholder="Class or block"
            aria-label="Class or block"
            title="Goes into the name of every file you download and onto every printout"
            style={{ width: 130 }}
            onChange={(e) => dispatch({ type: 'setClassName', name: e.target.value })}
          />
          <select
            value={test.id}
            onChange={(e) => dispatch({ type: 'selectTest', id: e.target.value })}
            aria-label="Choose a test"
          >
            {project.tests.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.date}
              </option>
            ))}
          </select>
          <button className="btn" onClick={() => dispatch({ type: 'addTest' })}>
            New test
          </button>
          {/*
            Mostly used for a test created by one click too many, or one started
            against the wrong class. Confirmed first, because unlike a student
            there is nothing left behind to recover.
          */}
          <button
            className="btn danger"
            title={`Delete “${test.name}” and everything on it`}
            onClick={() => (testIsEmpty ? deleteTest() : setPending('deleteTest'))}
          >
            Delete test
          </button>
        </div>

        <div className="group">
          <button
            className="btn"
            onClick={() =>
              requestDownload({
                name: fileName('Grapheme Spelling Test'),
                extension: 'json',
                mime: 'application/json',
                build: () => JSON.stringify(project, null, 2),
              })
            }
          >
            Save file
          </button>
          <button className="btn" onClick={() => fileInput.current?.click()}>
            Open file
          </button>
          <button
            className="btn"
            title="Replace everything with a made-up class and six months of tests"
            onClick={() => (hasData ? setPending('demo') : loadDemo())}
          >
            Load demo class
          </button>
          <button className="btn danger" disabled={!hasData} onClick={() => setPending('clear')}>
            Clear data
          </button>
          {/*
            For showing one family where their child sits relative to the class
            without showing them the rest of the class by name. Display only —
            the real names are untouched and come straight back.
          */}
          <label
            className={`check toggle ${project.settings.anonymize ? 'on' : ''}`}
            title="Replace every student name with Student 1, Student 2, … everywhere, including printouts and CSVs"
          >
            <input
              type="checkbox"
              checked={project.settings.anonymize}
              onChange={(e) =>
                dispatch({ type: 'updateSettings', settings: { anonymize: e.target.checked } })
              }
            />
            Hide student names
          </label>
          <button
            className={`btn ${tab === 'help' ? 'primary' : ''}`}
            title="How to use the app, and about it"
            onClick={() => setTab(tab === 'help' ? 'entry' : 'help')}
          >
            Help
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              onOpenFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>
      </header>

      {message && (
        <div className="error no-print" role="alert">
          {message}{' '}
          <button className="icon" onClick={() => setMessage(null)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}

      <nav className="tabs no-print">
        {TABS.map((t, i) => (
          <span key={t.id} style={{ display: 'contents' }}>
            {i > 0 && TABS[i - 1].group !== t.group && <span className="tabgroup">{t.group}</span>}
            <button aria-current={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          </span>
        ))}
      </nav>

      {analysis.error && (
        <div className="error" role="alert">
          The phoneme engine failed: {analysis.error}
        </div>
      )}

      {pending === 'demo' && (
        <ConfirmDialog
          title="Replace your data with the demo class?"
          confirmLabel="Load demo class"
          danger
          onConfirm={loadDemo}
          onCancel={() => setPending(null)}
        >
          This replaces the {project.students.length} student
          {project.students.length === 1 ? '' : 's'} and {project.tests.length} test
          {project.tests.length === 1 ? '' : 's'} you have now with a made-up class of{' '}
          {DEMO_STUDENT_COUNT} tested every two weeks for six months. Nothing is kept anywhere else,
          so use <strong>Save file</strong> first if you want your data back.
        </ConfirmDialog>
      )}

      {pending === 'deleteTest' && (
        <ConfirmDialog
          title={`Delete “${test.name}”?`}
          confirmLabel="Delete test"
          danger
          onConfirm={deleteTest}
          onCancel={() => setPending(null)}
        >
          This removes the test along with its {testWords} word
          {testWords === 1 ? '' : 's'}
          {testSpellings > 0 && (
            <>
              {' '}
              and the {testSpellings} spelling{testSpellings === 1 ? '' : 's'} recorded on it
            </>
          )}
          , and it takes this test out of every report. Unlike removing a student, nothing is kept
          behind to put back — use <strong>Save file</strong> first if you are not sure.
          {project.tests.length === 1 && (
            <>
              {' '}
              This is your only test, so an empty one will be left in its place.
            </>
          )}
        </ConfirmDialog>
      )}

      {pending === 'clear' && (
        <ConfirmDialog
          title="Clear all data?"
          confirmLabel="Clear everything"
          danger
          onConfirm={clearAll}
          onCancel={() => setPending(null)}
        >
          This deletes every student, test and spelling in this browser. It cannot be undone, and
          there is no copy on a server — use <strong>Save file</strong> first if you might want it
          back.
        </ConfirmDialog>
      )}

      {tab === 'help' && <Help />}
      {tab === 'entry' && <EntryGrid />}
      {tab === 'analysis' && <GraphemeAnalysis analysis={analysis} />}
      {/* Both of these span every test, so they analyse lazily on open. */}
      {tab === 'profile' && <StudentProfile />}
      {/* Mounted only when open, so it does not analyse every test in the background. */}
      {tab === 'progress' && <ReportProgress />}
      {tab === 'g-accuracy' && <ReportGraphemeAccuracy />}
      {tab === 'g-confusion' && <ReportGraphemeConfusion />}
      {tab === 'accuracy' && <ReportAccuracy />}
      {tab === 'misuse' && <ReportMisuse />}
      {tab === 'confusion' && <ReportConfusion />}
    </div>
  )
}
