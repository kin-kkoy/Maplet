import { memo, useCallback, useRef } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ChevronRight, ChevronUp, ChevronDown, Settings, Star } from 'lucide-react'
import type { ProjectNode, ManualNode } from '../../types'
import { useProjectStore } from '../../store/useProjectStore'
import '../../styles/nodes.css'

const LONG_PRESS_MS = 600

// Set when long-press fires; consumed by Canvas click handler to suppress expand/collapse
let _longPressFired = false
export function consumeLongPressFired(): boolean {
  if (_longPressFired) { _longPressFired = false; return true }
  return false
}

/** Chevron panel — the entire right-side section is the clickable button */
function ExpandChevron({ nodeId, isExpanded }: { nodeId: string; isExpanded: boolean }) {
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    window.dispatchEvent(new CustomEvent('node-chevron-click', {
      detail: { nodeId, shiftKey: false },
    }))
  }, [nodeId])

  return (
    <button
      className={`node-chevron-panel ${isExpanded ? 'open' : ''}`}
      onClick={handleClick}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      aria-label={isExpanded ? 'Collapse' : 'Expand'}
    >
      <ChevronRight size={14} />
    </button>
  )
}

interface BaseNodeData {
  label: string
  nodeData: ProjectNode | ManualNode
  isSelected: boolean
  isExpanded: boolean
  accentColor: string
  hasChildren?: boolean
  hasSiblings?: boolean
  canMoveUp?: boolean
  canMoveDown?: boolean
  parentId?: string | null
  [key: string]: unknown
}

/**
 * Target handles on Left, Top, Bottom (never Right).
 * Source handle always on Right.
 */
function NodeHandles() {
  return (
    <>
      {/* Incoming — any side except right */}
      <Handle type="target" position={Position.Left} id="target-left" />
      <Handle type="target" position={Position.Top} id="target-top" />
      <Handle type="target" position={Position.Bottom} id="target-bottom" />
      {/* Outgoing — always right */}
      <Handle type="source" position={Position.Right} id="source-right" />
    </>
  )
}

export const BaseNode = memo(function BaseNode({ data, id }: NodeProps) {
  const {
    label,
    nodeData,
    isSelected,
    isExpanded,
    hasChildren: nodeHasChildren,
    hasSiblings,
    canMoveUp,
    canMoveDown,
    parentId,
  } = data as BaseNodeData
  const isDimmed = (data as BaseNodeData).isDimmed as boolean | undefined
  const isPinned = (data as BaseNodeData).isPinned as boolean | undefined
  const tags = ((data as BaseNodeData).tags as string[] | undefined) ?? []
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onPointerDown = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      _longPressFired = true
      window.dispatchEvent(new CustomEvent('node-long-press', { detail: id }))
      longPressTimer.current = null
    }, LONG_PRESS_MS)
  }, [id])

  // pointerUp = deliberate release → clear focus
  const onPointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    window.dispatchEvent(new CustomEvent('node-long-press-release'))
  }, [])

  // pointerLeave = pointer left the node (e.g. during drag) → only cancel timer, keep focus
  const onPointerLeave = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const nodeType = nodeData.type
  const isOpaque = 'isOpaque' in nodeData && nodeData.isOpaque
  const path = 'path' in nodeData && nodeData.path !== '.' ? nodeData.path : ''
  const shortenedPath =
    path && path.length > 30
      ? `.../${path.split('/').slice(-2).join('/')}`
      : path

  const handleMoveUp = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      if (parentId) {
        const store = useProjectStore.getState()
        store.pushUndoSnapshot()
        store.reorderChild(parentId, id, 'up')
      }
    },
    [id, parentId],
  )

  const handleMoveDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      if (parentId) {
        const store = useProjectStore.getState()
        store.pushUndoSnapshot()
        store.reorderChild(parentId, id, 'down')
      }
    },
    [id, parentId],
  )

  const reorderArrows = hasSiblings ? (
    <div
      className="node-reorder"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="node-reorder__btn"
        disabled={!canMoveUp}
        onClick={handleMoveUp}
        onMouseDown={(e) => e.stopPropagation()}
        aria-label="Move up"
      >
        <ChevronUp size={10} />
      </button>
      <button
        className="node-reorder__btn"
        disabled={!canMoveDown}
        onClick={handleMoveDown}
        onMouseDown={(e) => e.stopPropagation()}
        aria-label="Move down"
      >
        <ChevronDown size={10} />
      </button>
    </div>
  ) : null

  const pinIndicator = isPinned ? (
    <span className="node-pin"><Star size={10} /></span>
  ) : null

  const tagPills = tags.length > 0 ? (
    <div className="node-tags">
      {tags.slice(0, 3).map((t) => (
        <span key={t} className="node-tag">{t}</span>
      ))}
      {tags.length > 3 && <span className="node-tag">+{tags.length - 3}</span>}
    </div>
  ) : null

  // ─── Config group: circular ───
  if (nodeType === 'config_group') {
    return (
      <>
        <NodeHandles />
        <div className="node-outer">
          <div className={`map-node-circle ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''} ${isDimmed ? 'dimmed' : ''}`}
            onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerLeave={onPointerLeave}>
            <div className="map-node-circle__icon"><Settings size={18} /></div>
            <div className="map-node-circle__label">{label}</div>
          </div>
          {nodeHasChildren && <ExpandChevron nodeId={id} isExpanded={isExpanded} />}
        </div>
      </>
    )
  }

  // ─── Helper nodes ───
  if (nodeType === 'package_group' || nodeType === 'hidden_connections_group') {
    return (
      <>
        <NodeHandles />
        <div className="node-outer">
          <div className={`node-helper ${isSelected ? 'selected' : ''} ${isDimmed ? 'dimmed' : ''}`}
            onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerLeave={onPointerLeave}>
            <div className="node-helper__name">{label}</div>
          </div>
          {nodeHasChildren && <ExpandChevron nodeId={id} isExpanded={isExpanded} />}
        </div>
      </>
    )
  }

  // ─── Project node ───
  if (nodeType === 'project') {
    return (
      <>
        <NodeHandles />
        <div className="node-outer">
          <div className={`node-project ${isSelected ? 'selected' : ''} ${isDimmed ? 'dimmed' : ''}`}
            onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerLeave={onPointerLeave}>
            {pinIndicator}
            <div className="node-project__accent" />
            <div className="node-project__body">
              <div className="node-project__content">
                <div className="node-project__name">{label}</div>
                {shortenedPath && <div className="node-project__path">{shortenedPath}</div>}
                {tagPills}
              </div>
              {nodeHasChildren && <ExpandChevron nodeId={id} isExpanded={isExpanded} />}
            </div>
          </div>
        </div>
      </>
    )
  }

  // ─── Folder node ───
  if (nodeType === 'folder') {
    const wrapClasses = [
      'node-folder-wrap',
      isSelected && 'selected',
      isExpanded && 'expanded',
      isOpaque && 'opaque',
      isDimmed && 'dimmed',
    ].filter(Boolean).join(' ')

    return (
      <>
        <NodeHandles />
        <div className="node-outer">
          <div className={wrapClasses}
            onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerLeave={onPointerLeave}>
            {reorderArrows}
            {pinIndicator}
            <div className="node-folder__tab" />
            <div className="node-folder__body">
              <div className="node-folder__content">
                <div className="node-folder__name">{label}</div>
                {shortenedPath && <div className="node-folder__path">{shortenedPath}</div>}
                {tagPills}
              </div>
              {nodeHasChildren && <ExpandChevron nodeId={id} isExpanded={isExpanded} />}
            </div>
          </div>
        </div>
      </>
    )
  }

  // ─── File node ───
  if (nodeType === 'file') {
    const wrapClasses = [
      'node-file-wrap',
      isSelected && 'selected',
      isDimmed && 'dimmed',
    ].filter(Boolean).join(' ')

    return (
      <>
        <NodeHandles />
        <div className="node-outer">
          <div className={wrapClasses}
            onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerLeave={onPointerLeave}>
            {reorderArrows}
            {pinIndicator}
            <div className="node-file__body">
              <div className="node-file__fold" />
              <div className="node-file__content">
                <div className="node-file__name">{label}</div>
                {shortenedPath && <div className="node-file__path">{shortenedPath}</div>}
                {tagPills}
              </div>
              {nodeHasChildren && <ExpandChevron nodeId={id} isExpanded={isExpanded} />}
            </div>
          </div>
        </div>
      </>
    )
  }

  // ─── User group node ───
  if (nodeType === 'user_group') {
    const groupColor = ('color' in nodeData && nodeData.color) || 'var(--accent-user-group)'
    return (
      <>
        <NodeHandles />
        <div className="node-outer">
          <div className={`node-user-group ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''} ${isDimmed ? 'dimmed' : ''}`}
            onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerLeave={onPointerLeave}>
            {reorderArrows}
            {pinIndicator}
            <div className="node-user-group__accent" style={{ background: groupColor }} />
            <div className="node-user-group__body">
              <div className="node-user-group__content">
                <div className="node-user-group__name">{label}</div>
                {tagPills}
              </div>
              {nodeHasChildren && <ExpandChevron nodeId={id} isExpanded={isExpanded} />}
            </div>
          </div>
        </div>
      </>
    )
  }

  // ─── Fallback (note + other) ───
  return (
    <>
      <NodeHandles />
      <div className="node-outer">
        <div className={`node-helper ${isSelected ? 'selected' : ''} ${isDimmed ? 'dimmed' : ''}`}
          onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerLeave={onPointerLeave}>
          {pinIndicator}
          <div className="node-helper__name">{label}</div>
          {tagPills}
        </div>
        {nodeHasChildren && <ExpandChevron nodeId={id} isExpanded={isExpanded} />}
        {reorderArrows}
      </div>
    </>
  )
})
