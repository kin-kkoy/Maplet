import { useState, useCallback, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import '../styles/detailCard.css'

const SHORTCUTS = [
  { category: 'Navigation', items: [
    { keys: ['Space', 'Drag'], desc: 'Pan the canvas' },
    { keys: ['Scroll'], desc: 'Zoom in / out' },
    { keys: ['Ctrl', 'F'], desc: 'Search nodes' },
    { keys: ['/'], desc: 'Search nodes' },
  ]},
  { category: 'Nodes', items: [
    { keys: ['Click'], desc: 'Expand or collapse a node' },
    { keys: ['Double Click'], desc: 'Open detail card' },
    { keys: ['Ctrl', 'Drag'], desc: 'Group move — drag node with all descendants' },
    { keys: ['Hover'], desc: 'Show reorder arrows (if node has siblings)' },
  ]},
  { category: 'Other Connections / Packages / Config', items: [
    { keys: ['Click'], desc: 'Expand — show connected nodes and edges' },
    { keys: ['Click again'], desc: 'Collapse — move connected nodes back to their real parent' },
    { keys: ['Shift', 'Click'], desc: 'Force collapse — hide connected nodes everywhere' },
  ]},
  { category: 'Search Operators', items: [
    { keys: ['#tag'], desc: 'Filter by tag name' },
    { keys: ['@type:file'], desc: 'Filter by node type' },
    { keys: ['*.tsx'], desc: 'Filter by file extension' },
    { keys: ['!pinned'], desc: 'Show only pinned nodes' },
  ]},
  { category: 'General', items: [
    { keys: ['Ctrl', 'Z'], desc: 'Undo' },
    { keys: ['Ctrl', 'Shift', 'Z'], desc: 'Redo' },
    { keys: ['Esc'], desc: 'Close panel / cancel action' },
  ]},
]

interface ShortcutsPanelProps {
  initialPosition: { x: number; y: number }
  onClose: () => void
}

export function ShortcutsPanel({ initialPosition, onClose }: ShortcutsPanelProps) {
  const [position, setPosition] = useState(initialPosition)
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      setPosition({
        x: dragRef.current.origX + (e.clientX - dragRef.current.startX),
        y: dragRef.current.origY + (e.clientY - dragRef.current.startY),
      })
    }
    const handleMouseUp = () => { dragRef.current = null }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      dragRef.current = { startX: e.clientX, startY: e.clientY, origX: position.x, origY: position.y }
    },
    [position],
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="detail-card"
      style={{ left: position.x, top: position.y, minWidth: 320, maxWidth: 400 }}
    >
      <div className="detail-card__header" onMouseDown={handleDragStart}>
        <div className="detail-card__title">Keyboard Shortcuts</div>
        <button className="detail-card__close" onClick={onClose}>
          <X size={14} />
        </button>
      </div>
      <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 420, overflowY: 'auto' }}>
        {SHORTCUTS.map((section) => (
          <div key={section.category}>
            <div style={{
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-tertiary)',
              marginBottom: 8,
            }}>
              {section.category}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {section.items.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                    {item.keys.map((key, ki) => (
                      <span key={ki}>
                        {ki > 0 && <span style={{ color: 'var(--text-tertiary)', fontSize: 10, marginRight: 3 }}>+</span>}
                        <kbd style={{
                          display: 'inline-block',
                          padding: '2px 6px',
                          borderRadius: 4,
                          border: '1px solid var(--border-default)',
                          background: 'var(--surface-secondary)',
                          fontFamily: "'IBM Plex Mono', monospace",
                          fontSize: 10,
                          color: 'var(--text-secondary)',
                          lineHeight: 1.4,
                        }}>
                          {key}
                        </kbd>
                      </span>
                    ))}
                  </div>
                  <span style={{
                    fontFamily: "'IBM Plex Sans', sans-serif",
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.4,
                  }}>
                    {item.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
