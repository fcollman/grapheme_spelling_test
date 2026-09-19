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
  notation: Notation
  /**
   * eSpeak reduces unstressed vowels to schwa, which otherwise reads as a vowel
   * error in every unstressed syllable.
   */
  lenientSchwa: boolean
  /** Whether "right sound, different letters" counts as correct in the reports. */
  amberCountsCorrect: boolean
}

export interface Project {
  version: 1
  students: Student[]
  tests: Test[]
  activeTestId: string | null
  settings: Settings
}

export const DEFAULT_SETTINGS: Settings = {
  notation: 'sound',
  lenientSchwa: true,
  amberCountsCorrect: false,
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
