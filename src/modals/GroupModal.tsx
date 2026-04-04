import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useProjectStore } from '../store/useProjectStore'
import type { UserGroup } from '../types'
import '../styles/modals.css'

const GROUP_COLORS = [
  '#34d399', '#60a5fa', '#f472b6', '#fbbf24', '#fb923c',
  '#a78bfa', '#f87171', '#38bdf8', '#4ade80', '#e879f9',
]

interface GroupModalProps {
  onClose: () => void
  targetNodeId: string
}

export function GroupModal({ onClose, targetNodeId }: GroupModalProps) {
  const userGroups = useProjectStore((s) => s.user.userGroups)
  const addUserGroup = useProjectStore((s) => s.addUserGroup)
  const addNodeToGroup = useProjectStore((s) => s.addNodeToGroup)
  const removeNodeFromGroup = useProjectStore((s) => s.removeNodeFromGroup)
  const revealNodes = useProjectStore((s) => s.revealNodes)

  const [mode, setMode] = useState<'select' | 'create'>(
    Object.keys(userGroups).length > 0 ? 'select' : 'create',
  )
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(GROUP_COLORS[0]!)

  const handleAddToExisting = (groupId: string) => {
    addNodeToGroup(targetNodeId, groupId)
    // Reveal the group node
    revealNodes([groupId])
    onClose()
  }

  const handleCreateAndAdd = () => {
    if (!name.trim()) return
    const id = `usergroup:${Date.now()}`
    const group: UserGroup = {
      id,
      name: name.trim(),
      description: description.trim() || undefined,
      color,
      memberNodeIds: [targetNodeId],
    }
    addUserGroup(group)
    // Reveal and set position near the target node
    const state = useProjectStore.getState()
    const targetPos = state.user.nodeOverrides[targetNodeId]?.position
    revealNodes([id])
    if (targetPos) {
      state.setNodeOverride(id, {
        position: { x: targetPos.x - 300, y: targetPos.y },
      })
    }
    onClose()
  }

  const existingGroups = Object.values(userGroups)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card--narrow" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card__header">
          <h3 className="modal-card__title">
            {mode === 'select' ? 'Add to Group' : 'Create Group'}
          </h3>
        </div>
        <div className="modal-card__body">
          {mode === 'select' && (
            <>
              <div className="group-modal__list">
                {existingGroups.map((g) => {
                  const isMember = g.memberNodeIds.includes(targetNodeId)
                  if (isMember) {
                    return (
                      <div key={g.id} className="group-modal__item group-modal__item--member">
                        <span
                          className="group-modal__color"
                          style={{ background: g.color ?? 'var(--accent-user-group)' }}
                        />
                        <span className="group-modal__name">{g.name}</span>
                        <span className="group-modal__already">member</span>
                        <button
                          className="group-modal__remove-btn"
                          onClick={() => removeNodeFromGroup(targetNodeId, g.id)}
                          aria-label="Remove from group"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )
                  }
                  return (
                    <button
                      key={g.id}
                      className="group-modal__item"
                      onClick={() => handleAddToExisting(g.id)}
                    >
                      <span
                        className="group-modal__color"
                        style={{ background: g.color ?? 'var(--accent-user-group)' }}
                      />
                      <span className="group-modal__name">{g.name}</span>
                    </button>
                  )
                })}
              </div>
              <button
                className="group-modal__create-btn"
                onClick={() => setMode('create')}
              >
                + Create new group
              </button>
            </>
          )}

          {mode === 'create' && (
            <>
              <div className="group-modal__field">
                <label className="group-modal__label">Name</label>
                <input
                  className="group-modal__input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Authentication Area"
                  autoFocus
                />
              </div>
              <div className="group-modal__field">
                <label className="group-modal__label">Description</label>
                <input
                  className="group-modal__input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="group-modal__field">
                <label className="group-modal__label">Color</label>
                <div className="group-modal__colors">
                  {GROUP_COLORS.map((c) => (
                    <button
                      key={c}
                      className={`group-modal__color-pick ${color === c ? 'active' : ''}`}
                      style={{ background: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </div>
              <div className="group-modal__actions">
                {existingGroups.length > 0 && (
                  <button className="group-modal__back-btn" onClick={() => setMode('select')}>
                    Back
                  </button>
                )}
                <button
                  className="group-modal__submit-btn"
                  onClick={handleCreateAndAdd}
                  disabled={!name.trim()}
                >
                  Create & Add
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
