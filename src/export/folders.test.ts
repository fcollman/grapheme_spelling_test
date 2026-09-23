import { describe, expect, it } from 'vitest'
import { exportPath, REPORT_FOLDERS, ROOT_FOLDER, uniqueName } from './folders'
import { buildFileName } from '../state/filename'

describe('where exports land', () => {
  it('puts everything under one folder of its own', () => {
    expect(exportPath('Accuracy by grapheme', 'x.csv')).toEqual([
      ROOT_FOLDER,
      'Accuracy by grapheme',
      'x.csv',
    ])
  })

  it('has one folder per kind of export, with no duplicates', () => {
    expect(new Set(REPORT_FOLDERS).size).toBe(REPORT_FOLDERS.length)
  })

  /**
   * The one that matters. A folder name derived from project data would put a
   * real child's name on a folder in Google Drive — visible in a folder
   * listing, and still visible with "Hide student names" switched on, because
   * that toggle only rewrites what the app displays.
   */
  it('never lets project data reach a folder name', () => {
    const LEAK = 'LEAKED'
    for (const folder of REPORT_FOLDERS) {
      // A file name built entirely out of the most sensitive things we hold.
      const fileName = buildFileName([LEAK, LEAK, folder, '2026-09-20']) + '.csv'
      const path = exportPath(folder, fileName)
      const segments = path.slice(0, -1)

      expect(segments.join('/'), `folder for ${folder}`).not.toContain(LEAK)
      // And the file name is the one and only place it is allowed to appear.
      expect(path[path.length - 1]).toContain(LEAK)
    }
  })

  it('keeps folder names free of anything a filesystem would reject', () => {
    for (const folder of [...REPORT_FOLDERS, ROOT_FOLDER]) {
      expect(folder, folder).not.toMatch(/[\\/:*?"<>|]/)
      expect(folder.trim()).toBe(folder)
    }
  })
})

describe('not overwriting an export that is already there', () => {
  it('leaves a free name alone', () => {
    expect(uniqueName([], 'report.csv')).toBe('report.csv')
    expect(uniqueName(['other.csv'], 'report.csv')).toBe('report.csv')
  })

  it('suffixes before the extension, not after it', () => {
    // "report.csv (2)" would stop being a CSV as far as the operating system
    // is concerned.
    expect(uniqueName(['report.csv'], 'report.csv')).toBe('report (2).csv')
  })

  it('keeps counting past the first collision', () => {
    expect(uniqueName(['r.csv', 'r (2).csv', 'r (3).csv'], 'r.csv')).toBe('r (4).csv')
  })

  it('copes with a name that has no extension', () => {
    expect(uniqueName(['notes'], 'notes')).toBe('notes (2)')
  })

  it('does not treat a dot in the middle of a name as an extension boundary', () => {
    const taken = ['Block 2A - Test 1.2 - Spelling test - 2026-01-01.csv']
    expect(uniqueName(taken, taken[0])).toBe(
      'Block 2A - Test 1.2 - Spelling test - 2026-01-01 (2).csv',
    )
  })
})
