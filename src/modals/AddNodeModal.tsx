import { useState, useRef, useEffect } from 'react'
import { StickyNote, X } from 'lucide-react'
import { useProjectStore } from '../store/useProjectStore'
import type { ManualNode } from '../types'
import '../styles/modals.css'

interface AddNodeModalProps {
  onClose: () => void
  viewportCenter: { x: number; y: number }
}

export function AddNodeModal({ onClose, viewportCenter }: AddNodeModalProps) {
  const [step, setStep] = useState<'type' | 'name'>('type')
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const addManualNode = useProjectStore((s) => s.addManualNode)
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

  const handleSelectType = () => {
    // V1 only supports adding notes manually
    setStep('name')
  }

  const handleSave = () => {
    if (!name.trim()) return

    const id = `note:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const node: ManualNode = {
      id,
      type: 'note',
      name: name.trim(),
      status: 'active',
    }

    useProjectStore.getState().pushUndoSnapshot()
    addManualNode(node)
    setNodeOverride(id, { position: viewportCenter })
    revealNodes([id])
    setSelectedNode(id)
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
            {step === 'type' ? 'Add Node' : 'Name your note'}
          </div>
          <button className="detail-card__close" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        {step === 'type' ? (
          <button className="modal-open-btn" onClick={handleSelectType}>
            <StickyNote size={18} />
            Note
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              ref={inputRef}
              className="modal-path-input"
              placeholder="Enter note name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              className="modal-open-btn"
              onClick={handleSave}
              disabled={!name.trim()}
            >
              Create Note
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
