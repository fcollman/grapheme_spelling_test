import { useRef, useState } from 'react'
import { useStore } from './state/store'
import { useAnalysis } from './state/useAnalysis'
import { readProjectFile, saveProjectFile } from './state/persist'
import { EntryGrid } from './pages/EntryGrid'
import { GraphemeAnalysis } from './pages/GraphemeAnalysis'
import { ReportGraphemeAccuracy } from './pages/ReportGraphemeAccuracy'
import { ReportGraphemeConfusion } from './pages/ReportGraphemeConfusion'
import { ReportAccuracy } from './pages/ReportAccuracy'
import { ReportMisuse } from './pages/ReportMisuse'
import { ReportConfusion } from './pages/ReportConfusion'
import './ui/styles.css'

/** Marking first, then the spelling-level reports, then the sound-level ones. */
const TABS = [
  { id: 'entry', label: 'Spelling test', group: 'Enter' },
  { id: 'analysis', label: 'Grapheme analysis', group: 'Enter' },
  { id: 'g-accuracy', label: 'Accuracy by grapheme', group: 'By spelling' },
  { id: 'g-confusion', label: 'Grapheme confusion', group: 'By spelling' },
  { id: 'accuracy', label: 'Accuracy by phoneme', group: 'By sound' },
  { id: 'misuse', label: 'Phoneme misuse', group: 'By sound' },
  { id: 'confusion', label: 'Phoneme confusion', group: 'By sound' },
] as const

type TabId = (typeof TABS)[number]['id']

export function App() {
  const { project, test, dispatch } = useStore()
  const analysis = useAnalysis(project, test)
  const [tab, setTab] = useState<TabId>('entry')
  const [message, setMessage] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

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
          <h1>Phoneme Analyzer</h1>
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
        </div>

        <div className="group">
          <label className="check">
            Notation
            <select
              value={project.settings.notation}
              onChange={(e) =>
                dispatch({ type: 'updateSettings', settings: { notation: e.target.value as 'sound' | 'ipa' } })
              }
            >
              <option value="sound">/sh/ sound spellings</option>
              <option value="ipa">/ʃ/ IPA</option>
            </select>
          </label>
          <button className="btn" onClick={() => saveProjectFile(project)}>
            Save file
          </button>
          <button className="btn" onClick={() => fileInput.current?.click()}>
            Open file
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

      {tab === 'entry' && <EntryGrid />}
      {tab === 'analysis' && <GraphemeAnalysis analysis={analysis} />}
      {tab === 'g-accuracy' && <ReportGraphemeAccuracy analysis={analysis} />}
      {tab === 'g-confusion' && <ReportGraphemeConfusion analysis={analysis} />}
      {tab === 'accuracy' && <ReportAccuracy analysis={analysis} />}
      {tab === 'misuse' && <ReportMisuse analysis={analysis} />}
      {tab === 'confusion' && <ReportConfusion analysis={analysis} />}
    </div>
  )
}
