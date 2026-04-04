import { useState, useRef, useEffect } from 'react'
import { StickyNote, FolderPlus, X } from 'lucide-react'
import { useProjectStore } from '../store/useProjectStore'
import type { ManualNode, UserGroup } from '../types'
import '../styles/modals.css'

const GROUP_COLORS = [
  '#34d399', '#60a5fa', '#f472b6', '#fbbf24', '#fb923c',
  '#a78bfa', '#f87171', '#38bdf8', '#4ade80', '#e879f9',
]

interface AddNodeModalProps {
  onClose: () => void
  viewportCenter: { x: number; y: number }
}

export function AddNodeModal({ onClose, viewportCenter }: AddNodeModalProps) {
  const [step, setStep] = useState<'type' | 'name'>('type')
  const [selectedType, setSelectedType] = useState<'note' | 'user_group'>('note')
  const [name, setName] = useState('')
  const [color, setColor] = useState(GROUP_COLORS[0]!)
  const inputRef = useRef<HTMLInputElement>(null)
  const addManualNode = useProjectStore((s) => s.addManualNode)
  const addUserGroup = useProjectStore((s) => s.addUserGroup)
  const revealNodes = useProjectStore((s) => s.revealNodes)
  const setNodeOverride = useProjectStore((s) => s.setNodeOverride)
  const setSelectedNode = useProjectStore((s) => s.setSelectedNode)

  useEffect(() => {
    if (step === 'name' && inputRef.current) {
      inputRef.current.focus()
    }
  }, [step])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSelectType = (type: 'note' | 'user_group') => {
    setSelectedType(type)
    setStep('name')
  }

  const handleSave = () => {
    if (!name.trim()) return

    useProjectStore.getState().pushUndoSnapshot()

    if (selectedType === 'note') {
      const id = `note:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const node: ManualNode = {
        id,
        type: 'note',
        name: name.trim(),
        status: 'active',
      }
      addManualNode(node)
      setNodeOverride(id, { position: viewportCenter })
      revealNodes([id])
      setSelectedNode(id)
    } else {
      const id = `usergroup:${Date.now()}`
      const group: UserGroup = {
        id,
        name: name.trim(),
        color,
        memberNodeIds: [],
      }
      addUserGroup(group)
      setNodeOverride(id, { position: viewportCenter })
      revealNodes([id])
      setSelectedNode(id)
    }

    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="modal-title">
            {step === 'type' ? 'Add Node' : selectedType === 'note' ? 'Name your note' : 'Name your group'}
          </div>
          <button className="detail-card__close" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        {step === 'type' ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="modal-open-btn" onClick={() => handleSelectType('note')}>
              <StickyNote size={18} />
              Note
            </button>
            <button className="modal-open-btn" onClick={() => handleSelectType('user_group')}>
              <FolderPlus size={18} />
              Group
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              ref={inputRef}
              className="modal-path-input"
              placeholder={selectedType === 'note' ? 'Enter note name...' : 'Enter group name...'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {selectedType === 'user_group' && (
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
            )}
            <button
              className="modal-open-btn"
              onClick={handleSave}
              disabled={!name.trim()}
            >
              {selectedType === 'note' ? 'Create Note' : 'Create Group'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
