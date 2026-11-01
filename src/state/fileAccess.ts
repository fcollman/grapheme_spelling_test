import { classifyError, type FileStamp } from './saveMachine'
import { uniqueName } from '../export/folders'

/**
 * The only module in the app that touches the File System Access API.
 *
 * It exists so a teacher can point at one file — including one inside a folder
 * that Google Drive or OneDrive keeps in sync — and have Save write straight
 * back to it, instead of producing a fresh download every time and leaving her
 * to move it out of Downloads by hand.
 *
 * Nothing here makes a network request. The page writes to a local folder; if
 * that folder happens to be synced, the sync client is what uploads it, and
 * that distinction is spelled out in the About page rather than glossed over.
 *
 * Chrome and Edge only. Everything is feature-detected and the existing
 * download path in `persist.ts` stays as the fallback, so Firefox and Safari
 * behave exactly as they always have.
 */

export function fileAccessSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function'
}

const JSON_TYPE: FilePickerAcceptType = {
  description: 'Grapheme Spelling Test project',
  accept: { 'application/json': ['.json'] },
}

/**
 * Refuses anything that is not a `.json`.
 *
 * Without this, a teacher who picks `index.html` in the save dialog overwrites
 * the app with her project file and it looks as though the app deleted itself.
 */
export function isSafeProjectTarget(name: string): boolean {
  return /\.json$/i.test(name)
}

export function stampOf(file: File): FileStamp {
  return { lastModified: file.lastModified, size: file.size }
}

/** null when the teacher closes the picker, which is not an error. */
export async function pickProjectFile(suggestedName: string): Promise<FileSystemFileHandle | null> {
  if (!window.showSaveFilePicker) return null
  try {
    return await window.showSaveFilePicker({
      suggestedName,
      types: [JSON_TYPE],
      // Reopens where she saved last, which after the first time is her Drive
      // folder — half the "where do I put it" problem, solved by the browser.
      id: 'gst-project',
    })
  } catch (e) {
    if (classifyError(e) === 'cancelled') return null
    throw e
  }
}

export async function pickProjectFileToOpen(): Promise<FileSystemFileHandle | null> {
  if (!window.showOpenFilePicker) return null
  try {
    const [handle] = await window.showOpenFilePicker({ types: [JSON_TYPE], id: 'gst-project' })
    return handle ?? null
  } catch (e) {
    if (classifyError(e) === 'cancelled') return null
    throw e
  }
}

export async function pickExportsFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (!window.showDirectoryPicker) return null
  try {
    return await window.showDirectoryPicker({ mode: 'readwrite', id: 'gst-exports' })
  } catch (e) {
    if (classifyError(e) === 'cancelled') return null
    throw e
  }
}

/**
 * Whether we may write, without prompting.
 *
 * Safe to call on mount: `queryPermission` never prompts and never needs a user
 * gesture, unlike `requestPermission`.
 */
export async function hasPermission(handle: FileSystemHandle): Promise<boolean> {
  if (!handle.queryPermission) return true
  return (await handle.queryPermission({ mode: 'readwrite' })) === 'granted'
}

/**
 * Asks for permission. Must be called from a click.
 *
 * Chrome re-asks once per session for a handle restored from storage, so this
 * rides on the Save the teacher was going to press anyway rather than
 * ambushing her with a prompt when the page opens.
 */
export async function requestWritePermission(handle: FileSystemHandle): Promise<boolean> {
  if (!handle.requestPermission) return true
  return (await handle.requestPermission({ mode: 'readwrite' })) === 'granted'
}

/**
 * What the file looks like right now, or null if it is no longer there.
 *
 * One stat answers both "does it still exist" and "has something else changed
 * it", which is why every write probes first.
 */
export async function probe(handle: FileSystemFileHandle): Promise<FileStamp | null> {
  try {
    return stampOf(await handle.getFile())
  } catch (e) {
    if (classifyError(e) === 'notFound') return null
    throw e
  }
}

/**
 * Writes the whole document and returns what the file became.
 *
 * Uses `createWritable()`'s default rather than `keepExistingData: true`.
 * Chromium writes to a `.crswap` file and renames it into place on `close()`,
 * so the original survives a crash mid-write. `keepExistingData` would
 * pre-fill that swap with the old contents, and a shorter document — one
 * deleted test — would leave the tail of the old file past the end of the new
 * one, producing JSON that will not parse.
 */
export async function writeText(handle: FileSystemFileHandle, text: string): Promise<FileStamp> {
  const writable = await handle.createWritable()
  try {
    await writable.write(text)
    await writable.close()
  } catch (e) {
    // Leaves no half-written file: abort discards the swap rather than
    // renaming it over the original.
    await writable.abort().catch(() => {})
    throw e
  }
  return stampOf(await handle.getFile())
}

export async function readText(handle: FileSystemFileHandle): Promise<string> {
  return (await handle.getFile()).text()
}

/**
 * Writes an export into `folder/subfolder/name`, creating folders as needed.
 *
 * @returns the name actually used, which differs from `fileName` when
 * something was already there — `getFileHandle` overwrites silently, with no
 * "replace?" step, so a second export of the same report in one session would
 * otherwise destroy the first without saying so.
 */
export async function writeIntoFolder(
  root: FileSystemDirectoryHandle,
  path: string[],
  text: string,
): Promise<string> {
  const segments = path.slice(0, -1)
  const wanted = path[path.length - 1]

  let dir = root
  for (const segment of segments) {
    dir = await dir.getDirectoryHandle(segment, { create: true })
  }

  const taken: string[] = []
  // `keys()` is async-iterable; a folder of a term's exports is small.
  for await (const key of dir.keys()) taken.push(key)

  const name = uniqueName(taken, wanted)
  const handle = await dir.getFileHandle(name, { create: true })
  await writeText(handle, text)
  return name
}

/* ---------------------------------------------------------------- storage -- */

/**
 * Handles live in IndexedDB because they are structured-cloneable but not
 * JSON-serialisable, so localStorage — where everything else in this app is
 * kept — cannot hold them.
 *
 * Note `file://` and `https://` have separate stores, so a file linked in the
 * downloaded copy is not linked in the hosted one. That is the browser's
 * origin model, not something worth working around.
 */
const DB_NAME = 'graphemespellingtest.handles'
const STORE = 'handles'

export type HandleKey = 'project' | 'exports'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Storage failing must never break saving, so every path here degrades quietly. */
export async function rememberHandle(key: HandleKey, handle: FileSystemHandle): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(handle, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    // The teacher re-picks next session. Worse, but not broken.
  }
}

export async function recallHandle<T extends FileSystemHandle>(key: HandleKey): Promise<T | null> {
  try {
    const db = await openDb()
    const value = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const request = tx.objectStore(STORE).get(key)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    db.close()
    return (value as T) ?? null
  } catch {
    return null
  }
}

export async function forgetHandle(key: HandleKey): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    // Nothing useful to do.
  }
}
