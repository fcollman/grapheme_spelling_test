import type { Project } from './types'

/**
 * Autosave to localStorage, plus explicit .json save/load so a teacher's data
 * survives a cleared cache and can move between computers. Nothing is ever sent
 * anywhere — the whole point of shipping this as a local file.
 */

const KEY = 'phonemeanalyzer.project.v1'

export function save(project: Project) {
  try {
    localStorage.setItem(KEY, JSON.stringify(project))
  } catch {
    // Private browsing or a full quota. Explicit file save is the backstop.
  }
}

export function load(): Project | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Project
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.tests)) return null
    return parsed
  } catch {
    return null
  }
}

function slug(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project'
}

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function saveProjectFile(project: Project) {
  const date = new Date().toISOString().slice(0, 10)
  download(`phoneme-analyzer-${date}.json`, JSON.stringify(project, null, 2), 'application/json')
}

export function exportName(testName: string, suffix: string): string {
  return `${slug(testName)}-${suffix}.csv`
}

/** Reads a .json project the teacher picks. Rejects anything not shaped like a project. */
export function readProjectFile(file: File): Promise<Project> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Project
        if (!parsed || !Array.isArray(parsed.tests) || !Array.isArray(parsed.students)) {
          reject(new Error('That file is not a Phoneme Analyzer project.'))
          return
        }
        resolve(parsed)
      } catch {
        reject(new Error('That file is not valid JSON.'))
      }
    }
    reader.readAsText(file)
  })
}
