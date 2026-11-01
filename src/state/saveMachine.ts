/**
 * What state the link to the teacher's file is in, and what each outcome does
 * to it.
 *
 * Pure on purpose. Everything that can lose a term's work lives in the failure
 * branches — a write that throws, a file the sync client moved, a newer copy
 * pulled down from Drive — and those are the branches a browser test will never
 * reach reliably. Keeping the decisions here means they can be driven through
 * every outcome in plain Node, and the adapter around them stays thin enough to
 * check by eye.
 *
 * Two invariants hold across every transition below:
 *
 *   1. A failed write never clears the dirty flag, and never touches the
 *      in-memory project or the localStorage copy. Disk trouble must not cost
 *      the teacher the work she can still see on screen.
 *   2. Nothing overwrites a file that changed underneath us without asking.
 */

/** What we knew about the file the last time we wrote it. */
export interface FileStamp {
  lastModified: number
  size: number
}

export type LinkState =
  /** No file chosen; Save behaves like today's download, or opens the picker. */
  | { kind: 'none' }
  /** Linked and writable. */
  | { kind: 'linked'; name: string; stamp: FileStamp }
  /** Linked, but this session has not been granted permission yet. */
  | { kind: 'needsPermission'; name: string }
  /** The file is no longer where it was — moved, renamed or deleted. */
  | { kind: 'missing'; name: string }
  /** Something else wrote to the file since we did. */
  | { kind: 'conflict'; name: string; stamp: FileStamp; theirs: FileStamp }
  /** The last write failed. The work is still safe in the browser. */
  | { kind: 'failed'; name: string; message: string }

/** Why a File System Access call threw, in terms the UI can act on. */
export type ErrorKind =
  /** The teacher said no, or the grant lapsed. Ask again from a click. */
  | 'noPermission'
  /** Needs a user gesture — the call came from a timer or a stale activation. */
  | 'needsGesture'
  /** The file is gone. */
  | 'notFound'
  /** Something else has it open — Drive and OneDrive do this on Windows. */
  | 'locked'
  /** Out of space. */
  | 'quota'
  /** The teacher closed the picker. Not an error; do nothing. */
  | 'cancelled'
  | 'unknown'

export type SaveEvent =
  | { type: 'linked'; name: string; stamp: FileStamp }
  | { type: 'permissionGranted' }
  | { type: 'permissionMissing' }
  | { type: 'probed'; stamp: FileStamp }
  | { type: 'probeMissing' }
  | { type: 'wrote'; stamp: FileStamp }
  | { type: 'writeFailed'; error: ErrorKind; message: string }
  /** The teacher chose to overwrite despite the conflict. */
  | { type: 'overwriteConfirmed' }
  | { type: 'disconnected' }

/** The name we are linked to, whatever state we are in. */
function nameOf(state: LinkState): string {
  return state.kind === 'none' ? '' : state.name
}

export function nextLinkState(state: LinkState, event: SaveEvent): LinkState {
  switch (event.type) {
    case 'linked':
      return { kind: 'linked', name: event.name, stamp: event.stamp }

    case 'disconnected':
      return { kind: 'none' }

    case 'permissionMissing':
      return state.kind === 'none' ? state : { kind: 'needsPermission', name: nameOf(state) }

    case 'permissionGranted':
      // Deliberately a no-op. Being allowed to write says nothing about whether
      // the file still exists or has changed since we last wrote it, so this
      // must not jump to `linked` — the probe that follows decides, and a probe
      // from `needsPermission` with no known stamp lands on `linked` anyway.
      return state

    case 'probeMissing':
      return state.kind === 'none' ? state : { kind: 'missing', name: nameOf(state) }

    case 'probed': {
      if (state.kind === 'none') return state
      const known = state.kind === 'linked' || state.kind === 'conflict' ? state.stamp : null
      // Changed underneath us. Refuse to write and let the teacher decide.
      if (known && changed(known, event.stamp)) {
        return { kind: 'conflict', name: state.name, stamp: known, theirs: event.stamp }
      }
      return { kind: 'linked', name: state.name, stamp: known ?? event.stamp }
    }

    case 'overwriteConfirmed':
      // Adopt their stamp as ours so the next probe compares against what is
      // actually on disk rather than immediately reporting the same conflict.
      return state.kind === 'conflict'
        ? { kind: 'linked', name: state.name, stamp: state.theirs }
        : state

    case 'wrote':
      return state.kind === 'none'
        ? state
        : { kind: 'linked', name: nameOf(state), stamp: event.stamp }

    case 'writeFailed': {
      if (state.kind === 'none') return state
      const name = nameOf(state)
      // Each of these has a different way out, so they are different states
      // rather than one generic failure.
      if (event.error === 'notFound') return { kind: 'missing', name }
      if (event.error === 'noPermission' || event.error === 'needsGesture') {
        return { kind: 'needsPermission', name }
      }
      if (event.error === 'cancelled') return state
      return { kind: 'failed', name, message: event.message }
    }
  }
}

/** True when the file on disk is not the one we last wrote. */
function changed(ours: FileStamp, theirs: FileStamp): boolean {
  return ours.lastModified !== theirs.lastModified || ours.size !== theirs.size
}

/**
 * Maps whatever the browser threw onto something the UI can act on.
 *
 * `SecurityError` and `NotAllowedError` both look like "permission" but need
 * different handling: the first means the call had no user gesture behind it
 * and should be retried from a click, the second means the teacher declined.
 */
export function classifyError(error: unknown): ErrorKind {
  const name = error instanceof Error ? error.name : ''
  switch (name) {
    case 'AbortError':
      return 'cancelled'
    case 'NotAllowedError':
      return 'noPermission'
    case 'SecurityError':
      return 'needsGesture'
    case 'NotFoundError':
      return 'notFound'
    case 'NoModificationAllowedError':
    case 'InvalidStateError':
      return 'locked'
    case 'QuotaExceededError':
      return 'quota'
    default:
      return 'unknown'
  }
}

export interface LinkLabel {
  /** What the chip in the toolbar reads. */
  label: string
  tone: 'ok' | 'warn' | 'error' | 'idle'
  /** Whether Save can write without opening a picker. */
  canSaveInPlace: boolean
  /** Longer explanation for the title attribute. */
  detail: string
}

export function describeLink(state: LinkState, dirty: boolean): LinkLabel {
  switch (state.kind) {
    case 'none':
      return {
        label: 'Not saved to a file',
        tone: 'idle',
        canSaveInPlace: false,
        detail:
          'Your work is in this browser only. Save it to a file to keep it — put that file in a synced folder and it follows you.',
      }
    case 'linked':
      return dirty
        ? {
            label: `${state.name} · unsaved changes`,
            tone: 'warn',
            canSaveInPlace: true,
            detail: 'This file is out of date. Press Save, or Ctrl/Cmd+S.',
          }
        : {
            label: `${state.name} · saved`,
            tone: 'ok',
            canSaveInPlace: true,
            detail: 'The file matches what is on screen.',
          }
    case 'needsPermission':
      return {
        label: `${state.name} · not connected`,
        tone: 'warn',
        canSaveInPlace: true,
        detail:
          'Your browser asks again each session before a page may write to a file. Press Save and allow it.',
      }
    case 'missing':
      return {
        label: `${state.name} · file not found`,
        tone: 'error',
        canSaveInPlace: false,
        detail:
          'That file has been moved, renamed or deleted. Your work is safe here — use Save a copy to pick a new file.',
      }
    case 'conflict':
      return {
        label: `${state.name} · changed elsewhere`,
        tone: 'error',
        canSaveInPlace: false,
        detail:
          'Something else changed this file since you last saved — another tab, another computer, or the sync client. Nothing has been overwritten.',
      }
    case 'failed':
      return {
        label: `${state.name} · could not save`,
        tone: 'error',
        canSaveInPlace: true,
        detail: `${state.message} Your work is still safe in this browser.`,
      }
  }
}
