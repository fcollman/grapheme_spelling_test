import type { ReactNode } from 'react'

/**
 * Used before anything that would throw away a teacher's data. Everything lives
 * in this browser, so there is no server-side copy to fall back on.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  confirmDisabled = false,
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string
  children: ReactNode
  confirmLabel: string
  /** For a dialog where the action needs a choice made in it first. */
  confirmDisabled?: boolean
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="backdrop" onClick={onCancel}>
      <div
        className="dialog"
        style={{ maxWidth: 480 }}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-label={title}
      >
        <h3>{title}</h3>
        <div className="sub">{children}</div>
        <footer>
          <span className="spacer" />
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={`btn ${danger ? 'danger-solid' : 'primary'}`}
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  )
}
