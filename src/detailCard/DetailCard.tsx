import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { X, Copy, Check, Star, Unlink, AlertTriangle } from 'lucide-react'
import { useProjectStore } from '../store/useProjectStore'
import { TagEditor } from '../tags/TagEditor'
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
  user_group: 'Group',
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
  user_group: 'var(--accent-user-group)',
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
  const isPinned = override?.pinned ?? false
  const tags = override?.tags ?? []
  const toggleNodePin = useProjectStore((s) => s.toggleNodePin)

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
        <div className="detail-card__header-actions">
          <button
            className={`detail-card__pin-btn ${isPinned ? 'active' : ''}`}
            onClick={() => toggleNodePin(nodeId)}
            title={isPinned ? 'Unpin' : 'Pin'}
          >
            <Star size={12} />
          </button>
          <button className="detail-card__close" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
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

        <TagEditor nodeId={nodeId} currentTags={tags} />

        <ConnectionsList nodeId={nodeId} />
      </div>
    </div>
  )
}

/** Shows edges connected to this node with disconnect buttons */
function ConnectionsList({ nodeId }: { nodeId: string }) {
  const scannedEdges = useProjectStore((s) => s.scanned.edges)
  const manualEdges = useProjectStore((s) => s.user.manualEdges)
  const suppressedEdges = useProjectStore((s) => s.user.suppressedEdges)
  const allNodesScanned = useProjectStore((s) => s.scanned.nodes)
  const allNodesManual = useProjectStore((s) => s.user.manualNodes)
  const userGroups = useProjectStore((s) => s.user.userGroups)
  const suppressEdge = useProjectStore((s) => s.suppressEdge)
  const restoreEdge = useProjectStore((s) => s.restoreEdge)
  const removeManualEdge = useProjectStore((s) => s.removeManualEdge)
  const [warning, setWarning] = useState<string | null>(null)

  const allNodes = useMemo(() => ({ ...allNodesScanned, ...allNodesManual }), [allNodesScanned, allNodesManual])

  // Collect all edges that touch this node
  const connectedEdges = useMemo(() => {
    const allEdges = { ...scannedEdges, ...manualEdges }
    const result: { id: string; type: string; otherId: string; otherName: string; direction: 'from' | 'to'; isManual: boolean; isSuppressed: boolean }[] = []
    const suppressedSet = new Set(suppressedEdges)

    for (const edge of Object.values(allEdges)) {
      if (edge.source !== nodeId && edge.target !== nodeId) continue
      // Skip groups edges (internal helper wiring)
      if (edge.type === 'groups') continue

      const isFrom = edge.source === nodeId
      const otherId = isFrom ? edge.target : edge.source
      const otherNode = allNodes[otherId]
      const otherName = otherNode?.name ?? otherId

      result.push({
        id: edge.id,
        type: edge.type,
        otherId,
        otherName,
        direction: isFrom ? 'to' : 'from',
        isManual: edge.type === 'manual_link',
        isSuppressed: suppressedSet.has(edge.id),
      })
    }
    return result
  }, [scannedEdges, manualEdges, nodeId, allNodes, suppressedEdges])

  if (connectedEdges.length === 0) return null

  /** Check if there's an alternate path through a user_group between source and target */
  const hasGroupPath = (sourceId: string, targetId: string): boolean => {
    const allEdges = { ...useProjectStore.getState().scanned.edges, ...useProjectStore.getState().user.manualEdges }
    // Check if any user_group connects to both source and target (directly or via edges)
    for (const group of Object.values(userGroups)) {
      let connectsSource = false
      let connectsTarget = false
      for (const edge of Object.values(allEdges)) {
        if (edge.type !== 'manual_link') continue
        if ((edge.source === group.id && edge.target === sourceId) || (edge.target === group.id && edge.source === sourceId)) connectsSource = true
        if ((edge.source === group.id && edge.target === targetId) || (edge.target === group.id && edge.source === targetId)) connectsTarget = true
      }
      // Also check group membership
      if (group.memberNodeIds.includes(sourceId)) connectsSource = true
      if (group.memberNodeIds.includes(targetId)) connectsTarget = true
      if (connectsSource && connectsTarget) return true
    }
    return false
  }

  const handleDisconnect = (edgeId: string, _otherId: string, isManual: boolean) => {
    // Manual edges can always be removed
    if (isManual) {
      useProjectStore.getState().pushUndoSnapshot()
      removeManualEdge(edgeId)
      return
    }

    // Scanned edge — check if there's an alternate group path
    const edge = scannedEdges[edgeId]
    if (!edge) return

    if (hasGroupPath(edge.source, edge.target)) {
      suppressEdge(edgeId)
      setWarning(null)
    } else {
      setWarning(`Cannot disconnect: no group node connects ${allNodes[edge.source]?.name ?? 'source'} and ${allNodes[edge.target]?.name ?? 'target'}`)
      setTimeout(() => setWarning(null), 3000)
    }
  }

  const handleRestore = (edgeId: string) => {
    restoreEdge(edgeId)
  }

  const visibleEdges = connectedEdges.filter((e) => !e.isSuppressed)
  const suppressedList = connectedEdges.filter((e) => e.isSuppressed)

  return (
    <div className="detail-card__connections">
      <div className="detail-card__connections-label">Connections</div>

      {warning && (
        <div className="detail-card__conn-warning">
          <AlertTriangle size={10} />
          {warning}
        </div>
      )}

      {visibleEdges.map((conn) => (
        <div key={conn.id} className="detail-card__conn-row">
          <span className="detail-card__conn-dir">{conn.direction}</span>
          <span className="detail-card__conn-name">{conn.otherName}</span>
          <button
            className="detail-card__conn-disconnect"
            onClick={() => handleDisconnect(conn.id, conn.otherId, conn.isManual)}
            title="Disconnect"
          >
            <Unlink size={10} />
          </button>
        </div>
      ))}

      {suppressedList.length > 0 && (
        <>
          <div className="detail-card__connections-label" style={{ marginTop: 6, opacity: 0.6 }}>
            Suppressed
          </div>
          {suppressedList.map((conn) => (
            <div key={conn.id} className="detail-card__conn-row suppressed">
              <span className="detail-card__conn-dir">{conn.direction}</span>
              <span className="detail-card__conn-name">{conn.otherName}</span>
              <button
                className="detail-card__conn-restore"
                onClick={() => handleRestore(conn.id)}
                title="Restore connection"
              >
                Restore
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
