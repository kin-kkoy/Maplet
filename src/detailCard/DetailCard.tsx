import { useState, useCallback, useRef, useEffect } from 'react'
import { X, Copy, Check } from 'lucide-react'
import { useProjectStore } from '../store/useProjectStore'
import type { ProjectNode, ManualNode, NodeType } from '../types'
import '../styles/detailCard.css'

const TYPE_LABELS: Record<NodeType, string> = {
  project: 'Project',
  folder: 'Folder',
  file: 'File',
  note: 'Note',
  package_group: 'Packages',
  package: 'Package',
  hidden_connections_group: 'Connections',
  config_group: 'Config',
}

const ACCENT_COLORS: Record<NodeType, string> = {
  project: 'var(--accent-project)',
  folder: 'var(--accent-folder)',
  file: 'var(--accent-file)',
  note: 'var(--accent-note)',
  package_group: 'var(--accent-package)',
  package: 'var(--accent-package)',
  hidden_connections_group: 'var(--accent-hidden)',
  config_group: 'var(--accent-hidden)',
}

interface DetailCardProps {
  nodeId: string
  initialPosition: { x: number; y: number }
  onClose: () => void
}

export function DetailCard({
  nodeId,
  initialPosition,
  onClose,
}: DetailCardProps) {
  const node = useProjectStore((s) => {
    return s.scanned.nodes[nodeId] ?? s.user.manualNodes[nodeId]
  }) as ProjectNode | ManualNode | undefined

  const override = useProjectStore(
    (s) => s.user.nodeOverrides[nodeId],
  )

  const [position, setPosition] = useState(initialPosition)
  const [showFullPath, setShowFullPath] = useState(false)
  const [copied, setCopied] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      setPosition({
        x: dragRef.current.origX + dx,
        y: dragRef.current.origY + dy,
      })
    }
    const handleMouseUp = () => {
      dragRef.current = null
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: position.x,
        origY: position.y,
      }
    },
    [position],
  )

  if (!node) return null

  const path = 'path' in node ? node.path : ''
  const shortPath = path.length > 35
    ? `.../${path.split('/').slice(-2).join('/')}`
    : path
  const displayName = override?.alias ?? node.name
  const description = override?.description ?? ('description' in node ? node.description : undefined)
  const accentColor = ACCENT_COLORS[node.type]
  const descSource = override?.descriptionSource

  const handleCopyPath = () => {
    if (path) {
      navigator.clipboard.writeText(path)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div
      className="detail-card"
      style={{ left: position.x, top: position.y }}
    >
      <div className="detail-card__header" onMouseDown={handleDragStart}>
        <div className="detail-card__title">{displayName}</div>
        <button className="detail-card__close" onClick={onClose}>
          <X size={14} />
        </button>
      </div>
      <div className="detail-card__body">
        {path && (
          <>
            <div
              className="detail-card__path"
              onClick={() => setShowFullPath(!showFullPath)}
              title="Click to toggle full path"
            >
              {showFullPath ? path : shortPath}
            </div>
            <button className="detail-card__copy-btn" onClick={handleCopyPath}>
              {copied ? <Check size={10} /> : <Copy size={10} />}
              {copied ? 'Copied' : 'Copy path'}
            </button>
          </>
        )}

        {description && (
          <div className="detail-card__description">{description}</div>
        )}

        <div className="detail-card__badges">
          <span className="detail-card__badge">
            <span
              className="detail-card__badge-dot"
              style={{ background: accentColor }}
            />
            {TYPE_LABELS[node.type]}
          </span>
          {descSource && (
            <span className="detail-card__badge">
              {descSource === 'ai' ? 'AI' : 'User'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
