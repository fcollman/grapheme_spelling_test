import { useMemo } from 'react'
import { useStore } from './store'
import type { Project } from './types'

/**
 * How a student's name is shown, which depends on the privacy toggle.
 *
 * A teacher showing a parent where their child sits relative to the class should
 * not be showing that parent the other children's names. With the toggle on,
 * every name becomes "Student 1", "Student 2" and so on, numbered by their place
 * in the roster so the labels stay stable between tabs and between sessions.
 *
 * This is display only: the real names are never altered, and turning the toggle
 * back off brings them straight back.
 */
export function studentNameMap(project: Project): Map<string, string> {
  return new Map(
    project.students.map((s, i) => [
      s.id,
      project.settings.anonymize ? `Student ${i + 1}` : s.name,
    ]),
  )
}

/** @returns a lookup from student id to the name that should be displayed. */
export function useStudentNames(): (id: string) => string {
  const { project } = useStore()

  return useMemo(() => {
    const map = studentNameMap(project)
    return (id: string) => map.get(id) ?? 'Unknown'
    // The roster itself and the toggle are the only things that change this.
  }, [project.students, project.settings.anonymize])
}
