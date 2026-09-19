import { GROUP_ORDER, PHONEMES, display, get, type Notation, type PhonemeId } from '../data/phonemes'

/**
 * Chip list plus a grouped keypad. Used both for correcting what a student
 * actually produced and for fixing a target word's breakdown.
 *
 * Grouped by phoneme family rather than alphabetically, because two phonemes
 * share the /th/ label and the key word is what tells them apart.
 */
export function PhonemePicker({
  value,
  onChange,
  notation,
  emptyLabel = 'No sound — the student left this out',
}: {
  value: PhonemeId[]
  onChange: (next: PhonemeId[]) => void
  notation: Notation
  emptyLabel?: string
}) {
  return (
    <>
      <div className="chosen">
        {value.length === 0 ? (
          <span style={{ color: 'var(--muted)', alignSelf: 'center' }}>{emptyLabel}</span>
        ) : (
          value.map((id, i) => (
            <span className="chip" key={`${id}-${i}`}>
              {display(id, notation)}
              <button
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                aria-label={`Remove ${display(id, notation)}`}
                title="Remove"
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      {GROUP_ORDER.map((group) => {
        const members = PHONEMES.filter((p) => p.group === group)
        if (members.length === 0) return null
        return (
          <div className="picker-group" key={group}>
            <h4>{group}</h4>
            <div className="options">
              {members.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onChange([...value, p.id])}
                  title={`${display(p.id, notation)} as in ${p.example}`}
                >
                  {display(p.id, notation)}
                  <span className="keyword">{p.example}</span>
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </>
  )
}

export function phonemeTitle(id: PhonemeId, notation: Notation): string {
  return `${display(id, notation)} as in ${get(id).example}`
}
