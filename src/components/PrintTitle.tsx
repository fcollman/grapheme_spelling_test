import type { ReactNode } from 'react'
import { useStore } from '../state/store'

/**
 * The heading that appears only on paper, where the toolbar and tab strip are
 * not there to say what you are looking at.
 *
 * The class goes first, so a printout handed round a meeting says whose it is
 * without anyone having to ask — the same order the downloaded file name uses.
 */
export function PrintTitle({ children }: { children: ReactNode }) {
  const { project } = useStore()
  const className = project.className?.trim()

  return (
    <span className="print-title">
      {className && <>{className} · </>}
      {children}
    </span>
  )
}
