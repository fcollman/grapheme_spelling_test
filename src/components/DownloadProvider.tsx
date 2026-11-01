import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { download } from '../state/persist'
import { exportPath, type ReportFolder } from '../export/folders'
import {
  fileAccessSupported,
  forgetHandle,
  pickExportsFolder,
  recallHandle,
  rememberHandle,
  writeIntoFolder,
} from '../state/fileAccess'
import { classifyError } from '../state/saveMachine'

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
  /**
   * Which subfolder this export belongs in, when a folder has been chosen.
   *
   * A literal from `REPORT_FOLDERS`, never anything derived from the file name
   * — that name carries the class and often a student, and a folder is a far
   * more visible place for a real child's name than a file is. See the note in
   * `export/folders.ts`.
   */
  folder?: ReportFolder
}

interface Pending {
  name: string
  extension?: string
  folder?: ReportFolder
  onConfirm: (name: string) => void | Promise<void>
}

interface Downloads {
  requestDownload: (request: DownloadRequest) => void
  /** Opens the browser's print dialog with `name` as the suggested PDF name. */
  requestPrint: (name: string) => void
}

/** Where CSVs go: a chosen folder, or the browser's downloads. */
interface Destination {
  folder: FileSystemDirectoryHandle | null
  choose: () => Promise<void>
  clear: () => void
}

const DownloadContext = createContext<Downloads | null>(null)

export function useDownloads(): Downloads {
  const ctx = useContext(DownloadContext)
  if (!ctx) throw new Error('useDownloads outside DownloadProvider')
  return ctx
}

export function DownloadProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)
  const [exportsFolder, setExportsFolder] = useState<FileSystemDirectoryHandle | null>(null)
  const [note, setNote] = useState<string | null>(null)

  // Restored silently; writing to it still needs permission, which is asked
  // for on the first export rather than when the page opens.
  useEffect(() => {
    let cancelled = false
    if (!fileAccessSupported()) return
    recallHandle<FileSystemDirectoryHandle>('exports').then((h) => {
      if (!cancelled && h) setExportsFolder(h)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const destination: Destination = {
    folder: exportsFolder,
    choose: async () => {
      try {
        const handle = await pickExportsFolder()
        if (!handle) return
        await rememberHandle('exports', handle)
        setExportsFolder(handle)
      } catch (e) {
        if (classifyError(e) !== 'cancelled') setNote('Could not use that folder.')
      }
    },
    clear: () => {
      forgetHandle('exports')
      setExportsFolder(null)
    },
  }

  const requestDownload = (request: DownloadRequest) =>
    setPending({
      name: request.name,
      extension: request.extension,
      folder: request.folder,
      onConfirm: async (name) => {
        const fileName = `${name}.${request.extension}`
        const text = request.build()

        if (!exportsFolder || !request.folder) {
          download(fileName, text, request.mime)
          return
        }
        try {
          const written = await writeIntoFolder(
            exportsFolder,
            exportPath(request.folder, fileName),
            text,
          )
          setNote(
            written === fileName
              ? `Saved to ${request.folder} in ${exportsFolder.name}.`
              : `Saved to ${request.folder} in ${exportsFolder.name} as “${written}” — a file of that name was already there.`,
          )
        } catch (e) {
          // Never lose the export because the folder misbehaved.
          if (classifyError(e) !== 'cancelled') {
            download(fileName, text, request.mime)
            setNote('Could not write to your exports folder, so it was downloaded instead.')
          }
        }
      },
    })

  const requestPrint = (name: string) => setPending({ name, onConfirm: printAs })

  return (
    <DownloadContext.Provider value={{ requestDownload, requestPrint }}>
      {children}
      {pending && (
        <NameDialog
          pending={pending}
          destination={destination}
          onClose={() => setPending(null)}
          onConfirm={(name) => {
            const act = pending.onConfirm
            /*
             * The dialog has to be out of the DOM before the action runs, not
             * merely scheduled for removal.
             *
             * window.print() snapshots the page synchronously, so closing the
             * dialog with a plain setState left the backdrop still covering the
             * report and the PDF came out as a picture of this dialog. flushSync
             * commits the unmount first; a plain state update would not have
             * landed until after print() had already read the page.
             */
            flushSync(() => setPending(null))
            act(name)
          }}
        />
      )}
      {note && (
        <div className="savenote no-print" role="status" onClick={() => setNote(null)}>
          {note}
        </div>
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
  destination,
  onConfirm,
  onClose,
}: {
  pending: Pending
  destination: Destination
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

        {/*
          Where it goes, said before it goes there. A teacher who has set a
          folder should not have to guess whether this particular export
          honoured it.
        */}
        {pending.folder && fileAccessSupported() && (
          <p className="sub destination">
            {destination.folder ? (
              <>
                Saves into <strong>{destination.folder.name}</strong> ›{' '}
                <strong>{pending.folder}</strong>.{' '}
                <button className="linkish" onClick={destination.choose}>
                  Change folder
                </button>{' '}
                <button className="linkish" onClick={destination.clear}>
                  Use downloads instead
                </button>
              </>
            ) : (
              <>
                Goes to your downloads.{' '}
                <button className="linkish" onClick={destination.choose}>
                  Choose a folder instead
                </button>{' '}
                — pick one your school's Drive or OneDrive keeps in sync and your
                reports file themselves.
              </>
            )}
          </p>
        )}

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
