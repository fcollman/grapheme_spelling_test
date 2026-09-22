import { describe, expect, it } from 'vitest'
import {
  classifyError,
  describeLink,
  nextLinkState,
  type FileStamp,
  type LinkState,
  type SaveEvent,
} from './saveMachine'

/**
 * The failure branches are the whole point of this module. A teacher's term of
 * work lives in one file, and the ways to lose it are all here: writing over a
 * newer copy that Drive pulled down, clearing the dirty flag after a write that
 * did not happen, or quietly recreating a file she deliberately moved.
 *
 * A browser test would never reach these reliably, so they are pinned here.
 */

const A: FileStamp = { lastModified: 1000, size: 50 }
const B: FileStamp = { lastModified: 2000, size: 60 }

const linked: LinkState = { kind: 'linked', name: 'Block 2A.json', stamp: A }

/** Runs a sequence of events from a starting state. */
function run(start: LinkState, ...events: SaveEvent[]): LinkState {
  return events.reduce(nextLinkState, start)
}

describe('linking a file', () => {
  it('starts from nothing', () => {
    expect(nextLinkState({ kind: 'none' }, { type: 'linked', name: 'x.json', stamp: A })).toEqual({
      kind: 'linked',
      name: 'x.json',
      stamp: A,
    })
  })

  it('records the stamp of what was written', () => {
    expect(run(linked, { type: 'wrote', stamp: B })).toEqual({
      kind: 'linked',
      name: 'Block 2A.json',
      stamp: B,
    })
  })

  it('forgets everything on disconnect', () => {
    expect(run(linked, { type: 'disconnected' })).toEqual({ kind: 'none' })
  })
})

describe('a file that changed underneath us', () => {
  it('refuses to write when the stamp moved', () => {
    const after = run(linked, { type: 'probed', stamp: B })
    expect(after).toEqual({ kind: 'conflict', name: 'Block 2A.json', stamp: A, theirs: B })
    expect(describeLink(after, true).canSaveInPlace).toBe(false)
  })

  it('notices a same-size edit by its timestamp', () => {
    const sameSize: FileStamp = { lastModified: 9999, size: A.size }
    expect(run(linked, { type: 'probed', stamp: sameSize }).kind).toBe('conflict')
  })

  it('notices a same-timestamp edit by its size', () => {
    const sameTime: FileStamp = { lastModified: A.lastModified, size: 999 }
    expect(run(linked, { type: 'probed', stamp: sameTime }).kind).toBe('conflict')
  })

  it('carries on when nothing changed', () => {
    expect(run(linked, { type: 'probed', stamp: A })).toEqual(linked)
  })

  it('takes their version as the baseline once overwriting is confirmed', () => {
    // Otherwise the very next probe reports the same conflict again.
    const after = run(linked, { type: 'probed', stamp: B }, { type: 'overwriteConfirmed' })
    expect(after).toEqual({ kind: 'linked', name: 'Block 2A.json', stamp: B })
  })

  it('does not let anything except a confirmation leave a conflict', () => {
    const conflict = run(linked, { type: 'probed', stamp: B })
    for (const event of [
      { type: 'permissionGranted' },
      { type: 'probed', stamp: B },
    ] as SaveEvent[]) {
      const after = nextLinkState(conflict, event)
      expect(after.kind, `${event.type} escaped the conflict`).not.toBe('linked')
    }
  })
})

describe('a file that is no longer there', () => {
  it('goes missing rather than recreating it', () => {
    // Chrome would happily make a new empty file at the old path, stranding the
    // copy the teacher actually moved into Drive.
    const after = run(linked, { type: 'probeMissing' })
    expect(after).toEqual({ kind: 'missing', name: 'Block 2A.json' })
    expect(describeLink(after, true).canSaveInPlace).toBe(false)
  })

  it('goes missing when the write itself reports it', () => {
    const after = run(linked, { type: 'writeFailed', error: 'notFound', message: 'gone' })
    expect(after.kind).toBe('missing')
  })
})

describe('permission', () => {
  it('asks again rather than failing when the grant lapsed', () => {
    const after = run(linked, { type: 'permissionMissing' })
    expect(after).toEqual({ kind: 'needsPermission', name: 'Block 2A.json' })
    // Save stays usable — it is what carries the permission prompt.
    expect(describeLink(after, true).canSaveInPlace).toBe(true)
  })

  it('does not claim the file is fine just because writing is allowed', () => {
    const asked = run(linked, { type: 'permissionMissing' }, { type: 'permissionGranted' })
    expect(asked.kind).toBe('needsPermission')
    // The probe is what proves the file is still there.
    expect(run(asked, { type: 'probed', stamp: B })).toEqual({
      kind: 'linked',
      name: 'Block 2A.json',
      stamp: B,
    })
  })

  it('treats a missing gesture as something to retry, not a refusal', () => {
    const after = run(linked, { type: 'writeFailed', error: 'needsGesture', message: '' })
    expect(after.kind).toBe('needsPermission')
  })
})

describe('a write that failed', () => {
  it('reports it rather than pretending it saved', () => {
    const after = run(linked, { type: 'writeFailed', error: 'locked', message: 'File is in use.' })
    expect(after).toEqual({ kind: 'failed', name: 'Block 2A.json', message: 'File is in use.' })
    expect(describeLink(after, true).tone).toBe('error')
    // The work is still on screen and in localStorage; say so.
    expect(describeLink(after, true).detail).toContain('still safe')
  })

  it('leaves the state alone when the teacher just closed the picker', () => {
    expect(run(linked, { type: 'writeFailed', error: 'cancelled', message: '' })).toEqual(linked)
  })

  it('never invents a link out of nothing', () => {
    const none: LinkState = { kind: 'none' }
    for (const event of [
      { type: 'wrote', stamp: A },
      { type: 'probed', stamp: A },
      { type: 'probeMissing' },
      { type: 'permissionMissing' },
      { type: 'writeFailed', error: 'locked', message: 'x' },
    ] as SaveEvent[]) {
      expect(nextLinkState(none, event), event.type).toEqual(none)
    }
  })
})

describe('classifying what the browser threw', () => {
  const err = (name: string) => Object.assign(new Error('x'), { name })

  it('tells a declined prompt apart from a missing gesture', () => {
    // Different recoveries: one needs a click, the other means "no".
    expect(classifyError(err('SecurityError'))).toBe('needsGesture')
    expect(classifyError(err('NotAllowedError'))).toBe('noPermission')
  })

  it('recognises the rest of what Chrome actually throws', () => {
    expect(classifyError(err('AbortError'))).toBe('cancelled')
    expect(classifyError(err('NotFoundError'))).toBe('notFound')
    expect(classifyError(err('NoModificationAllowedError'))).toBe('locked')
    expect(classifyError(err('InvalidStateError'))).toBe('locked')
    expect(classifyError(err('QuotaExceededError'))).toBe('quota')
    expect(classifyError(err('SomethingNew'))).toBe('unknown')
    expect(classifyError('not an error at all')).toBe('unknown')
  })
})

describe('what the toolbar says', () => {
  it('distinguishes saved from unsaved', () => {
    expect(describeLink(linked, false).label).toBe('Block 2A.json · saved')
    expect(describeLink(linked, false).tone).toBe('ok')
    expect(describeLink(linked, true).label).toBe('Block 2A.json · unsaved changes')
    expect(describeLink(linked, true).tone).toBe('warn')
  })

  it('says plainly when nothing is linked', () => {
    const d = describeLink({ kind: 'none' }, true)
    expect(d.canSaveInPlace).toBe(false)
    expect(d.detail).toContain('browser only')
  })
})
