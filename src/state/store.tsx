import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import {
  DEFAULT_SETTINGS,
  emptyProject,
  emptyReadingTest,
  emptyTest,
  newId,
  testKind,
  type Project,
  type Settings,
  type SlotOverrideData,
  type Student,
  type Test,
  type TestKind,
} from './types'
import { reconcileWords, tokenizePassage } from './passage'
import { load, save } from './persist'

export type Action =
  | { type: 'replaceProject'; project: Project }
  | { type: 'setClassName'; name: string }
  | { type: 'addStudent'; name: string }
  | { type: 'renameStudent'; id: string; name: string }
  | { type: 'removeStudent'; id: string }
  | { type: 'restoreStudents'; ids: string[] }
  | { type: 'moveStudent'; id: string; delta: number }
  | { type: 'addTest'; kind?: TestKind }
  | { type: 'selectTest'; id: string }
  | { type: 'renameTest'; id: string; name: string }
  | { type: 'setTestDate'; id: string; date: string }
  | { type: 'removeTest'; id: string }
  | { type: 'addWord'; text: string }
  | { type: 'addWords'; texts: string[] }
  | { type: 'updateWord'; id: string; text?: string; nonsense?: boolean }
  | { type: 'removeWord'; id: string }
  | { type: 'moveWord'; id: string; delta: number }
  | { type: 'moveWordTo'; id: string; index: number }
  | { type: 'setResponse'; wordId: string; studentId: string; value: string }
  | { type: 'setPassage'; text: string }
  | { type: 'setOmitted'; wordId: string; studentId: string; omitted: boolean }
  | { type: 'clearStudentResponses'; studentId: string }
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

/**
 * Takes `id` out of the list and puts it back at `index`, where `index` counts
 * positions in the ORIGINAL list — which is what a drop between two rows means.
 */
function moveTo<T extends { id: string }>(list: T[], id: string, index: number): T[] {
  const from = list.findIndex((x) => x.id === id)
  if (from < 0 || index < 0 || index > list.length) return list
  const rest = list.filter((x) => x.id !== id)
  // Removing the item shifts everything after it up one.
  const to = index > from ? index - 1 : index
  if (to === from) return list
  rest.splice(to, 0, list[from])
  return rest
}

/** Drops whole words from a `[wordId]` map, for words the passage no longer has. */
function withoutWords<T>(byWord: Record<string, T>, drop: Set<string>): Record<string, T> {
  if (drop.size === 0) return byWord
  return Object.fromEntries(Object.entries(byWord).filter(([wordId]) => !drop.has(wordId)))
}

/** Empties one cell of a `[wordId][studentId]` map. */
function withoutCell<T>(
  byWord: Record<string, Record<string, T>>,
  wordId: string,
  studentId: string,
): Record<string, Record<string, T>> {
  if (byWord[wordId]?.[studentId] === undefined) return byWord
  const { [studentId]: _gone, ...rest } = byWord[wordId]
  return { ...byWord, [wordId]: rest }
}

/** Drops one student's entry from a `[wordId][studentId]` map, word by word. */
function withoutStudent<T>(
  byWord: Record<string, Record<string, T>>,
  studentId: string,
): Record<string, Record<string, T>> {
  return Object.fromEntries(
    Object.entries(byWord).map(([wordId, byStudent]) => {
      if (!(studentId in byStudent)) return [wordId, byStudent]
      const { [studentId]: _gone, ...rest } = byStudent
      return [wordId, rest]
    }),
  )
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

    case 'setClassName':
      return { ...project, className: action.name }

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
      // Numbered within their own kind, so a class with both does not read
      // "Spelling Test 1, Reading Test 2".
      const kind = action.kind ?? 'spelling'
      const nth = project.tests.filter((t) => testKind(t) === kind).length + 1
      const test =
        kind === 'reading' ? emptyReadingTest(`Reading Test ${nth}`) : emptyTest(`Spelling Test ${nth}`)
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
      /*
       * A test is deleted outright, words, responses and corrections together —
       * unlike a student, whose answers are kept so they can be put back. There
       * is nowhere else for a test's data to live, and the reason to delete one
       * is that it should not exist, so keeping a ghost of it would be worse
       * than useless. The UI confirms first and says so.
       */
      const index = project.tests.findIndex((t) => t.id === action.id)
      const tests = project.tests.filter((t) => t.id !== action.id)
      // Never leave the app with no test at all to type into.
      const fallback = tests.length > 0 ? tests : [emptyTest('Spelling Test 1')]
      // Land on the neighbour rather than jumping to the first test, which is
      // what you want after deleting a stray test from the end of a long term.
      const next = fallback[Math.min(Math.max(index - 1, 0), fallback.length - 1)]
      return {
        ...project,
        tests: fallback,
        activeTestId: project.activeTestId === action.id ? next.id : project.activeTestId,
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
    case 'moveWordTo': {
      // Dropping a word somewhere, as opposed to nudging it one place at a time.
      const active = project.tests.find((t) => t.id === project.activeTestId)
      if (!active) return project
      const words = moveTo(active.words, action.id, action.index)
      // Dropped back where it started: not a change, so not a re-render or a save.
      if (words === active.words) return project
      return withActiveTest(project, (t) => ({ ...t, words }))
    }

    case 'setPassage': {
      /*
       * The passage owns the word list, so editing it re-tokenises.
       *
       * What makes this safe to do more than once is that `reconcileWords` keeps
       * the ids of words the edit did not touch. Everything it reports as
       * changed or dropped loses what was recorded against it: a word that left
       * the passage is unreachable, and a slot that now says something else must
       * not keep a mark that was made about the word it used to say.
       */
      const active = project.tests.find((t) => t.id === project.activeTestId)
      if (!active || (active.passage ?? '') === action.text) return project

      const { words, changedIds, droppedIds } = reconcileWords(
        active.words,
        tokenizePassage(action.text),
      )
      const stale = new Set([...changedIds, ...droppedIds])

      return withActiveTest(project, (t) => ({
        ...t,
        passage: action.text,
        words,
        responses: withoutWords(t.responses, stale),
        overrides: withoutWords(t.overrides, stale),
        wordPhonemes: withoutWords(t.wordPhonemes, stale),
        omissions: t.omissions ? withoutWords(t.omissions, stale) : t.omissions,
      }))
    }

    case 'setOmitted': {
      const active = project.tests.find((t) => t.id === project.activeTestId)
      const already = active?.omissions?.[action.wordId]?.[action.studentId] === true
      if (!active || already === action.omitted) return project

      return withActiveTest(project, (t) => {
        const forWord = { ...(t.omissions?.[action.wordId] ?? {}) }
        if (action.omitted) forWord[action.studentId] = true
        else delete forWord[action.studentId]

        return {
          ...t,
          omissions: { ...(t.omissions ?? {}), [action.wordId]: forWord },
          // Saying nothing and saying something are mutually exclusive, so
          // marking a word skipped clears whatever was typed for it.
          responses: action.omitted
            ? withoutCell(t.responses, action.wordId, action.studentId)
            : t.responses,
          overrides: action.omitted
            ? withoutCell(t.overrides, action.wordId, action.studentId)
            : t.overrides,
        }
      })
    }

    case 'setResponse':
      return withActiveTest(project, (t) => ({
        ...t,
        // Typing what a student said means they did not skip it after all.
        omissions: t.omissions
          ? withoutCell(t.omissions, action.wordId, action.studentId)
          : t.omissions,
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

    case 'clearStudentResponses':
      /*
       * Empties one student's column on the active test, leaving the rest of
       * the class and every other test alone.
       *
       * A whole paper entered against the wrong name used to mean clearing
       * twenty-five cells by hand. This is the roster-safe version of that: the
       * student stays in the class and keeps their work on every other test,
       * which is what separates it from removing them.
       *
       * Their per-cell corrections go with the answers. An override is a
       * judgement about a specific spelling, so keeping one after its answer is
       * gone would silently re-apply it to whatever gets typed next.
       */
      return withActiveTest(project, (t) => ({
        ...t,
        responses: withoutStudent(t.responses, action.studentId),
        overrides: withoutStudent(t.overrides, action.studentId),
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
