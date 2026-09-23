/**
 * The parts of the File System Access API that TypeScript does not ship.
 *
 * `lib.dom.d.ts` has `FileSystemFileHandle`, `FileSystemDirectoryHandle` and
 * `createWritable`, but not the three pickers and not the permission methods —
 * checked against the TypeScript in this repo. CI runs `tsc --noEmit`, so
 * without these the build fails.
 *
 * Deliberately minimal: only what this app calls, so the declarations cannot
 * drift into claiming support for things that were never tested.
 */

interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite'
}

interface FileSystemHandle {
  queryPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  requestPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
}

interface FilePickerAcceptType {
  description?: string
  accept: Record<string, string[]>
}

interface FilePickerOptions {
  suggestedName?: string
  types?: FilePickerAcceptType[]
  excludeAcceptAllOption?: boolean
  /** Reopens the picker where it was last used, per key. */
  id?: string
  startIn?: FileSystemHandle | 'desktop' | 'documents' | 'downloads'
}

interface DirectoryPickerOptions {
  id?: string
  mode?: 'read' | 'readwrite'
  startIn?: FileSystemHandle | 'desktop' | 'documents' | 'downloads'
}

interface FileSystemDirectoryHandle {
  /** Async-iterable over the entry names in this folder. */
  keys(): AsyncIterableIterator<string>
}

interface Window {
  showSaveFilePicker?(options?: FilePickerOptions): Promise<FileSystemFileHandle>
  showOpenFilePicker?(
    options?: FilePickerOptions & { multiple?: boolean },
  ): Promise<FileSystemFileHandle[]>
  showDirectoryPicker?(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>
}
