import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { download } from '../state/persist'

/**
 * Every download and every print goes through one dialog that shows the name
 * first and lets it be changed.
 *
 * The name is always filled in, so the common case is a glance and Enter. The
 * point is that a teacher never has to go and rename a file in their Downloads
 * folder afterwards — the chance to get the name right is while they still know
 * what the file is.
 *
 * Printing is here too. A browser's Save-as-PDF takes its suggested file name
 * from the document title, so setting the title before opening the print dialog
 * is the only way to name a PDF from inside the page.
 */

export interface DownloadRequest {
  /** Suggested name, without the extension. */
  name: string
  extension: 'csv' | 'json'
  mime: string
  /** Built only if the teacher goes through with it. */
  build: () => string
}

interface Pending {
  name: string
  extension?: string
  onConfirm: (name: string) => void
}

interface Downloads {
  requestDownload: (request: DownloadRequest) => void
  /** Opens the browser's print dialog with `name` as the suggested PDF name. */
  requestPrint: (name: string) => void
}

const DownloadContext = createContext<Downloads | null>(null)

export function useDownloads(): Downloads {
  const ctx = useContext(DownloadContext)
  if (!ctx) throw new Error('useDownloads outside DownloadProvider')
  return ctx
}

export function DownloadProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)

  const requestDownload = (request: DownloadRequest) =>
    setPending({
      name: request.name,
      extension: request.extension,
      onConfirm: (name) => download(`${name}.${request.extension}`, request.build(), request.mime),
    })

  const requestPrint = (name: string) => setPending({ name, onConfirm: printAs })

  return (
    <DownloadContext.Provider value={{ requestDownload, requestPrint }}>
      {children}
      {pending && (
        <NameDialog
          pending={pending}
          onClose={() => setPending(null)}
          onConfirm={(name) => {
            pending.onConfirm(name)
            setPending(null)
          }}
        />
      )}
    </DownloadContext.Provider>
  )
}

/**
 * Prints with `name` as the document title, which is what the browser offers as
 * the PDF file name, then puts the real title back.
 *
 * `window.print()` blocks until the dialog closes in most browsers, but not all,
 * so the title is restored on `afterprint` as well — whichever happens first.
 */
function printAs(name: string) {
  const original = document.title
  const restore = () => {
    document.title = original
    window.removeEventListener('afterprint', restore)
  }
  document.title = name
  window.addEventListener('afterprint', restore)
  try {
    window.print()
  } finally {
    setTimeout(restore, 1000)
  }
}

function NameDialog({
  pending,
  onConfirm,
  onClose,
}: {
  pending: Pending
  onConfirm: (name: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState(pending.name)
  const input = useRef<HTMLInputElement>(null)

  // Selected, not just focused: typing replaces the suggestion, Enter accepts it.
  useEffect(() => {
    input.current?.focus()
    input.current?.select()
  }, [])

  const trimmed = name.trim()
  const confirm = () => trimmed !== '' && onConfirm(trimmed)

  return (
    <div className="backdrop" onClick={onClose}>
      <div
        className="dialog"
        style={{ maxWidth: 560 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={pending.extension ? 'Name this file' : 'Name this printout'}
      >
        <h3>{pending.extension ? 'Save as' : 'Print as'}</h3>
        <p className="sub" style={{ marginTop: 0 }}>
          {pending.extension
            ? 'Change the name if you want to, then download.'
            : 'This is the name your browser will suggest when you choose Save as PDF.'}
        </p>

        <div className="filename-row">
          <input
            ref={input}
            type="text"
            value={name}
            aria-label="File name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirm()
              if (e.key === 'Escape') onClose()
            }}
          />
          {pending.extension && <span className="filename-ext">.{pending.extension}</span>}
        </div>

        <footer>
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={trimmed === ''} onClick={confirm}>
            {pending.extension ? 'Download' : 'Print'}
          </button>
        </footer>
      </div>
    </div>
  )
}
