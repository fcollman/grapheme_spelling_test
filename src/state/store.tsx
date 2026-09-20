import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import {
  DEFAULT_SETTINGS,
  emptyProject,
  emptyTest,
  newId,
  type Project,
  type Settings,
  type SlotOverrideData,
  type Student,
  type Test,
} from './types'
import { load, save } from './persist'

export type Action =
  | { type: 'replaceProject'; project: Project }
  | { type: 'addStudent'; name: string }
  | { type: 'renameStudent'; id: string; name: string }
  | { type: 'removeStudent'; id: string }
  | { type: 'restoreStudents'; ids: string[] }
  | { type: 'moveStudent'; id: string; delta: number }
  | { type: 'addTest' }
  | { type: 'selectTest'; id: string }
  | { type: 'renameTest'; id: string; name: string }
  | { type: 'setTestDate'; id: string; date: string }
  | { type: 'removeTest'; id: string }
  | { type: 'addWord'; text: string }
  | { type: 'addWords'; texts: string[] }
  | { type: 'updateWord'; id: string; text?: string; nonsense?: boolean }
  | { type: 'removeWord'; id: string }
  | { type: 'moveWord'; id: string; delta: number }
  | { type: 'setResponse'; wordId: string; studentId: string; value: string }
  | { type: 'setOverride'; wordId: string; studentId: string; slot: number; value: SlotOverrideData | null }
  | { type: 'clearOverridesForWord'; wordId: string }
  | { type: 'setWordPhonemes'; wordId: string; phonemes: string[] | null }
  | { type: 'updateSettings'; settings: Partial<Settings> }

function withActiveTest(project: Project, fn: (test: Test) => Test): Project {
  return {
    ...project,
    tests: project.tests.map((t) => (t.id === project.activeTestId ? fn(t) : t)),
  }
}

function move<T extends { id: string }>(list: T[], id: string, delta: number): T[] {
  const i = list.findIndex((x) => x.id === id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= list.length) return list
  const next = [...list]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

/** Exported for tests: the roster rules are the one part worth pinning down. */
export function reducer(project: Project, action: Action): Project {
  switch (action.type) {
    case 'replaceProject':
      return normalize(action.project)

    case 'addStudent': {
      const name = action.name.trim()
      if (!name) return project
      return { ...project, students: [...project.students, { id: newId('stu'), name }] }
    }
    case 'renameStudent':
      return {
        ...project,
        students: project.students.map((s) => (s.id === action.id ? { ...s, name: action.name } : s)),
      }
    case 'removeStudent': {
      // Responses for a removed student are left in place deliberately: deleting
      // a column by accident should not silently destroy the data behind it.
      // Archiving the name is what makes that recoverable — without it the data
      // stays in the file but nothing can find it again.
      const gone = project.students.find((s) => s.id === action.id)
      const hasData =
        gone !== undefined &&
        project.tests.some((t) =>
          Object.values(t.responses).some((byStudent) => (byStudent[action.id] ?? '').trim() !== ''),
        )
      return {
        ...project,
        students: project.students.filter((s) => s.id !== action.id),
        archivedStudents: hasData ? [...(project.archivedStudents ?? []), gone] : project.archivedStudents,
      }
    }
    case 'restoreStudents': {
      const archived = project.archivedStudents ?? []
      const back = archived.filter((s) => action.ids.includes(s.id))
      if (back.length === 0) return project
      return {
        ...project,
        students: [...project.students, ...back],
        archivedStudents: archived.filter((s) => !action.ids.includes(s.id)),
      }
    }
    case 'moveStudent':
      return { ...project, students: move(project.students, action.id, action.delta) }

    case 'addTest': {
      const test = emptyTest(`Spelling Test ${project.tests.length + 1}`)
      return { ...project, tests: [...project.tests, test], activeTestId: test.id }
    }
    case 'selectTest':
      return { ...project, activeTestId: action.id }
    case 'renameTest':
      return {
        ...project,
        tests: project.tests.map((t) => (t.id === action.id ? { ...t, name: action.name } : t)),
      }
    case 'setTestDate':
      return {
        ...project,
        tests: project.tests.map((t) => (t.id === action.id ? { ...t, date: action.date } : t)),
      }
    case 'removeTest': {
      const tests = project.tests.filter((t) => t.id !== action.id)
      const fallback = tests.length > 0 ? tests : [emptyTest('Spelling Test 1')]
      return {
        ...project,
        tests: fallback,
        activeTestId: project.activeTestId === action.id ? fallback[0].id : project.activeTestId,
      }
    }

    case 'addWord': {
      const text = action.text.trim()
      if (!text) return project
      return withActiveTest(project, (t) => ({
        ...t,
        words: [...t.words, { id: newId('wrd'), text, nonsense: false }],
      }))
    }
    case 'addWords': {
      const fresh = action.texts
        .map((x) => x.trim())
        .filter(Boolean)
        .map((text) => ({ id: newId('wrd'), text, nonsense: false }))
      if (fresh.length === 0) return project
      return withActiveTest(project, (t) => ({ ...t, words: [...t.words, ...fresh] }))
    }
    case 'updateWord':
      return withActiveTest(project, (t) => ({
        ...t,
        words: t.words.map((w) =>
          w.id === action.id
            ? {
                ...w,
                text: action.text ?? w.text,
                nonsense: action.nonsense ?? w.nonsense,
              }
            : w,
        ),
        // Editing the target word invalidates any confirmed breakdown for it.
        wordPhonemes:
          action.text !== undefined
            ? Object.fromEntries(Object.entries(t.wordPhonemes).filter(([k]) => k !== action.id))
            : t.wordPhonemes,
      }))
    case 'removeWord':
      return withActiveTest(project, (t) => ({ ...t, words: t.words.filter((w) => w.id !== action.id) }))
    case 'moveWord':
      return withActiveTest(project, (t) => ({ ...t, words: move(t.words, action.id, action.delta) }))

    case 'setResponse':
      return withActiveTest(project, (t) => ({
        ...t,
        responses: {
          ...t.responses,
          [action.wordId]: { ...(t.responses[action.wordId] ?? {}), [action.studentId]: action.value },
        },
        // A changed response makes the old per-cell corrections meaningless.
        overrides: {
          ...t.overrides,
          [action.wordId]: Object.fromEntries(
            Object.entries(t.overrides[action.wordId] ?? {}).filter(([sid]) => sid !== action.studentId),
          ),
        },
      }))

    case 'setOverride':
      return withActiveTest(project, (t) => {
        const forWord = t.overrides[action.wordId] ?? {}
        const forStudent = { ...(forWord[action.studentId] ?? {}) }
        if (action.value === null) delete forStudent[action.slot]
        else forStudent[action.slot] = action.value
        return {
          ...t,
          overrides: {
            ...t.overrides,
            [action.wordId]: { ...forWord, [action.studentId]: forStudent },
          },
        }
      })

    case 'clearOverridesForWord':
      return withActiveTest(project, (t) => ({
        ...t,
        overrides: Object.fromEntries(Object.entries(t.overrides).filter(([k]) => k !== action.wordId)),
      }))

    case 'setWordPhonemes':
      return withActiveTest(project, (t) => {
        const next = { ...t.wordPhonemes }
        if (action.phonemes === null) delete next[action.wordId]
        else next[action.wordId] = action.phonemes
        // The breakdown changed, so slot indices no longer line up.
        return {
          ...t,
          wordPhonemes: next,
          overrides: Object.fromEntries(Object.entries(t.overrides).filter(([k]) => k !== action.wordId)),
        }
      })

    case 'updateSettings':
      return { ...project, settings: { ...project.settings, ...action.settings } }
  }
}

interface Store {
  project: Project
  test: Test
  dispatch: (a: Action) => void
}

const StoreContext = createContext<Store | null>(null)

/**
 * Fills in any setting a stored project predates.
 *
 * `notation` is forced back to sound spellings: the IPA toggle was removed from
 * the UI, so a project saved while it was switched on would otherwise be stuck
 * in IPA with no control to change it back.
 */
function normalize(stored: Project): Project {
  return {
    ...stored,
    settings: { ...DEFAULT_SETTINGS, ...stored.settings, notation: 'sound' },
  }
}

function init(): Project {
  const stored = load()
  return stored ? normalize(stored) : emptyProject()
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [project, dispatch] = useReducer(reducer, undefined, init)

  useEffect(() => {
    const id = setTimeout(() => save(project), 300)
    return () => clearTimeout(id)
  }, [project])

  const value = useMemo<Store>(() => {
    const test = project.tests.find((t) => t.id === project.activeTestId) ?? project.tests[0]
    return { project, test, dispatch }
  }, [project])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore outside StoreProvider')
  return ctx
}

export type { Student }
