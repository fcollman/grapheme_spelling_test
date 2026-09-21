import type { Mark } from '../engine/align'
import type { Notation, PhonemeId } from '../data/phonemes'

export interface Student {
  id: string
  name: string
}

export interface Word {
  id: string
  text: string
  /** Nonsense words test encoding without letting sight-word memory help. */
  nonsense: boolean
}

export interface SlotOverrideData {
  student?: PhonemeId[]
  mark?: Mark
}

export interface Test {
  id: string
  name: string
  /** ISO date, so a later progress-over-time report can order tests. */
  date: string
  words: Word[]
  /** responses[wordId][studentId] = what the student wrote */
  responses: Record<string, Record<string, string>>
  /** overrides[wordId][studentId][slotIndex] = teacher correction of one cell */
  overrides: Record<string, Record<string, Record<number, SlotOverrideData>>>
  /** Teacher-confirmed phoneme breakdown for a target word, replacing the engine's. */
  wordPhonemes: Record<string, PhonemeId[]>
}

export interface Settings {
  /**
   * Always 'sound' for now. The IPA toggle was removed from the UI, but the
   * plumbing is left in place so it can be switched back on in one component.
   */
  notation: Notation
  /**
   * eSpeak reduces unstressed vowels to schwa, which otherwise reads as a vowel
   * error in every unstressed syllable.
   */
  lenientSchwa: boolean
  /** Whether "right sound, different letters" counts as correct in the reports. */
  amberCountsCorrect: boolean
  /**
   * Replaces every student name with "Student 1", "Student 2" and so on, for
   * showing one family where their child sits relative to the class without
   * showing them the rest of the class by name. Display only.
   */
  anonymize: boolean
}

export interface Project {
  version: 1
  /**
   * What the teacher calls this group — "Block 2A", "Period 4", "Reading group".
   *
   * One project file is one class, so this is the label that makes a downloaded
   * report mean something in a Downloads folder full of them. It goes into every
   * exported file name and onto every printout. Optional, so project files
   * written before it existed still load.
   */
  className?: string
  students: Student[]
  /**
   * Students taken off the roster whose spellings are still sitting in a test.
   *
   * Removing a student deliberately leaves their answers behind rather than
   * destroying them, but without the name there was no way to reach that data
   * again. Keeping it here is what lets an earlier test's students be added
   * back. Optional so project files written before this existed still load.
   */
  archivedStudents?: Student[]
  tests: Test[]
  activeTestId: string | null
  settings: Settings
}

export const DEFAULT_SETTINGS: Settings = {
  notation: 'sound',
  lenientSchwa: true,
  amberCountsCorrect: false,
  anonymize: false,
}

/** crypto.randomUUID needs a secure context; file:// qualifies in Chrome but not everywhere. */
export function newId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now().toString(36)}${rand}`
}

export function emptyTest(name: string): Test {
  return {
    id: newId('test'),
    name,
    date: new Date().toISOString().slice(0, 10),
    words: [],
    responses: {},
    overrides: {},
    wordPhonemes: {},
  }
}

export function emptyProject(): Project {
  const test = emptyTest('Spelling Test 1')
  return {
    version: 1,
    students: [],
    tests: [test],
    activeTestId: test.id,
    settings: { ...DEFAULT_SETTINGS },
  }
}
