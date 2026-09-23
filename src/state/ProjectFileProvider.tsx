import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useStore } from './store'
import { useFileName } from './filename'
import { download } from './persist'
import { useDownloads } from '../components/DownloadProvider'
import type { Project } from './types'
import {
  fileAccessSupported,
  forgetHandle,
  hasPermission,
  isSafeProjectTarget,
  pickProjectFile,
  pickProjectFileToOpen,
  probe,
  readText,
  recallHandle,
  rememberHandle,
  requestWritePermission,
  writeText,
} from './fileAccess'
import {
  classifyError,
  describeLink,
  nextLinkState,
  type LinkLabel,
  type LinkState,
} from './saveMachine'

/**
 * The link between the app and one file on disk.
 *
 * Elizabeth's problem was not that pressing Save is hard, it was that the file
 * went to Downloads and getting it into Drive was a separate errand every
 * time, with nothing on screen ever telling her whether the copy she cared
 * about was current. So: point at the file once — in a Drive-synced folder if
 * she wants — and Save writes back to that same file, with the toolbar always
 * saying whether it matches what is on screen.
 *
 * Saving stays deliberate. An automatic write was considered and rejected: the
 * permission prompt needs a click, a conflict needs a human to resolve it, and
 * a debounced write during data entry would hand the sync client hundreds of
 * uploads — which is the "doesn't quite merge" problem, made worse.
 */

interface ProjectFile {
  supported: boolean
  state: LinkState
  dirty: boolean
  label: LinkLabel
  /** Writes to the linked file, picking one first if there is none. */
  save: () => Promise<void>
  /** Always opens the picker, then links whatever was chosen. */
  saveAs: () => Promise<void>
  open: () => Promise<void>
  /** The old download path, always available as an escape hatch. */
  downloadCopy: () => void
  /** Stops writing to the file without touching the data. */
  disconnect: () => void
  /** The write failed or the file changed; null when there is nothing to say. */
  problem: string | null
  dismissProblem: () => void
}

const ProjectFileContext = createContext<ProjectFile | null>(null)

export function useProjectFile(): ProjectFile {
  const ctx = useContext(ProjectFileContext)
  if (!ctx) throw new Error('useProjectFile outside ProjectFileProvider')
  return ctx
}

const serialize = (project: Project) => JSON.stringify(project, null, 2)

export function ProjectFileProvider({ children }: { children: ReactNode }) {
  const { project, dispatch } = useStore()
  const fileName = useFileName()
  const { requestDownload } = useDownloads()

  const [state, setState] = useState<LinkState>({ kind: 'none' })
  const [problem, setProblem] = useState<string | null>(null)

  const handleRef = useRef<FileSystemFileHandle | null>(null)
  /**
   * The project object that produced the bytes currently on disk.
   *
   * Identity rather than a serialized comparison, because the reducer already
   * returns the *same* object for a no-op — dropping a word where it started,
   * adding a blank student — so identity does not report false changes, and
   * stringifying a term of data on every render would be felt on a school
   * laptop.
   */
  const savedRef = useRef<Project | null>(null)
  const dirty = project !== savedRef.current

  // Restore the link on open. queryPermission never prompts and needs no user
  // gesture, so this is safe here; requesting permission is not, and waits for
  // the first Save.
  useEffect(() => {
    let cancelled = false
    async function restore() {
      if (!fileAccessSupported()) return
      const handle = await recallHandle<FileSystemFileHandle>('project')
      if (cancelled || !handle) return
      handleRef.current = handle
      if (!(await hasPermission(handle)) || cancelled) {
        // The usual case: Chrome re-asks once per session for a restored
        // handle. The first Save carries that prompt.
        if (!cancelled) setState({ kind: 'needsPermission', name: handle.name })
        return
      }

      const stamp = await probe(handle)
      if (cancelled) return
      if (!stamp) {
        setState({ kind: 'missing', name: handle.name })
        return
      }
      setState({ kind: 'linked', name: handle.name, stamp })

      // Still allowed to read, so find out whether the file already matches
      // what we restored from localStorage. Without this the chip would claim
      // "unsaved changes" every time the app opens, and a teacher who is told
      // that when it is not true stops believing the indicator.
      try {
        if ((await readText(handle)) === serialize(project) && !cancelled) {
          savedRef.current = project
        }
      } catch {
        // Not worth surfacing; the chip just stays cautious.
      }
    }
    restore()
    return () => {
      cancelled = true
    }
  }, [])

  const step = (event: Parameters<typeof nextLinkState>[1]) =>
    setState((current) => nextLinkState(current, event))

  /** Straight to the browser's downloads, no questions. The escape hatch. */
  const downloadCopy = () => {
    download(`${fileName('Grapheme Spelling Test')}.json`, serialize(project), 'application/json')
  }

  /**
   * What Save does in a browser with no File System Access API.
   *
   * Goes through the naming dialog rather than downloading silently, so
   * Firefox and Safari keep exactly the behaviour they had before this
   * feature existed — including the chance to correct the name.
   */
  const downloadNamed = () => {
    requestDownload({
      name: fileName('Grapheme Spelling Test'),
      extension: 'json',
      mime: 'application/json',
      build: () => serialize(project),
    })
  }

  /** Writes to `handleRef`, having already checked permission and freshness. */
  async function writeNow(handle: FileSystemFileHandle, force: boolean): Promise<void> {
    const snapshot = project
    const text = serialize(snapshot)

    const current = await probe(handle)
    if (current === null) {
      step({ type: 'probeMissing' })
      setProblem(`${handle.name} is no longer where it was. Nothing has been lost — use “Save a copy” to pick a new file.`)
      return
    }
    if (!force) {
      const decided = nextLinkState(state, { type: 'probed', stamp: current })
      if (decided.kind === 'conflict') {
        setState(decided)
        setProblem(
          `${handle.name} has changed since you last saved it — another tab, another computer, or the sync client. Nothing has been overwritten.`,
        )
        return
      }
    }

    try {
      const stamp = await writeText(handle, text)
      // Captured before the write, so edits made while it was in flight leave
      // the project correctly dirty.
      savedRef.current = snapshot
      step({ type: 'wrote', stamp })
      setProblem(null)
    } catch (e) {
      const kind = classifyError(e)
      step({ type: 'writeFailed', error: kind, message: messageFor(kind) })
      if (kind !== 'cancelled') setProblem(messageFor(kind))
    }
  }

  async function linkTo(handle: FileSystemFileHandle): Promise<boolean> {
    if (!isSafeProjectTarget(handle.name)) {
      setProblem(`“${handle.name}” is not a .json file. Pick a name ending in .json.`)
      return false
    }
    handleRef.current = handle
    await rememberHandle('project', handle)
    const stamp = (await probe(handle)) ?? { lastModified: 0, size: 0 }
    step({ type: 'linked', name: handle.name, stamp })
    return true
  }

  const save = async () => {
    if (!fileAccessSupported()) return downloadNamed()
    const handle = handleRef.current
    if (!handle) return saveAs()

    // The permission prompt rides on this click rather than ambushing her when
    // the page opened.
    if (!(await hasPermission(handle))) {
      try {
        if (!(await requestWritePermission(handle))) {
          step({ type: 'permissionMissing' })
          setProblem(
            `This browser will not let the page write to ${handle.name}. Your work is safe here — allow it and press Save again, or download a copy.`,
          )
          return
        }
      } catch (e) {
        step({ type: 'writeFailed', error: classifyError(e), message: '' })
        return
      }
      step({ type: 'permissionGranted' })
    }
    await writeNow(handle, state.kind === 'conflict')
  }

  const saveAs = async () => {
    if (!fileAccessSupported()) return downloadNamed()
    try {
      const handle = await pickProjectFile(`${fileName('Grapheme Spelling Test')}.json`)
      if (!handle) return
      if (!(await linkTo(handle))) return
      await writeNow(handle, true)
    } catch (e) {
      const kind = classifyError(e)
      if (kind !== 'cancelled') setProblem(messageFor(kind))
    }
  }

  const open = async () => {
    try {
      const handle = await pickProjectFileToOpen()
      if (!handle) return
      const text = await readText(handle)
      const parsed = JSON.parse(text) as Project
      if (!parsed || !Array.isArray(parsed.tests) || !Array.isArray(parsed.students)) {
        setProblem('That file is not a Grapheme Spelling Test project.')
        return
      }
      dispatch({ type: 'replaceProject', project: parsed })
      await linkTo(handle)
      // Opening it means the file and the screen agree, so start clean.
      savedRef.current = null
      setProblem(null)
    } catch (e) {
      const kind = classifyError(e)
      if (kind !== 'cancelled') setProblem('Could not open that file.')
    }
  }

  const disconnect = () => {
    handleRef.current = null
    savedRef.current = null
    forgetHandle('project')
    setState({ kind: 'none' })
    setProblem(null)
  }

  return (
    <ProjectFileContext.Provider
      value={{
        supported: fileAccessSupported(),
        state,
        dirty,
        label: describeLink(state, dirty),
        save,
        saveAs,
        open,
        downloadCopy,
        disconnect,
        problem,
        dismissProblem: () => setProblem(null),
      }}
    >
      {children}
    </ProjectFileContext.Provider>
  )
}

/** Plain words for each way a write can fail. */
function messageFor(kind: ReturnType<typeof classifyError>): string {
  switch (kind) {
    case 'notFound':
      return 'That file is no longer where it was.'
    case 'noPermission':
      return 'This browser will not let the page write to that file.'
    case 'needsGesture':
      return 'Press Save again — the browser needs the request to come from a click.'
    case 'locked':
      return 'Something else has that file open. Google Drive and OneDrive do this while syncing; try again in a moment.'
    case 'quota':
      return 'There is no room left to write the file.'
    case 'cancelled':
      return ''
    default:
      return 'The file could not be written.'
  }
}
