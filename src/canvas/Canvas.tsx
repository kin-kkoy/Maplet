import { useCallback, useState, useRef, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  type NodeMouseHandler,
  type OnNodesChange,
  type Node,
  type Edge,
  applyNodeChanges,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { nodeTypes } from './nodeTypes'
import { consumeLongPressFired } from './nodeTypes/BaseNode'
import { edgeTypes } from './edgeTypes'
import { useProjectStore } from '../store/useProjectStore'
import { useReveal } from '../hooks/useReveal'
import { resolveCollisions, calculateChildPositions } from './layout'
import { Dock } from '../dock/Dock'
import { DetailCard } from '../detailCard/DetailCard'
import { AddNodeModal } from '../modals/AddNodeModal'
import { ConnectModeOverlay } from '../modals/ConnectMode'
import { SearchOverlay } from '../search/SearchOverlay'
import { ProjectSettingsModal } from '../modals/ProjectSettingsModal'
import { ShortcutsPanel } from '../modals/ShortcutsPanel'
import { FilterPanel } from '../filters/FilterPanel'
import { GroupModal } from '../modals/GroupModal'
import { ScanLine } from 'lucide-react'
import type { ManualEdge, ProjectNode, ManualNode, ProjectEdge } from '../types'

/**
 * Collect all visible descendants of a node (children, grandchildren, etc.)
 * Follows parentId, ownerId, AND outgoing edges (groups, imports, manual_link).
 */
function collectVisibleDescendants(
  nodeId: string,
  allNodes: Record<string, { id: string; parentId?: string | null; ownerId?: string }>,
  visibleNodeIds: Set<string>,
  allEdges?: Record<string, { source: string; target: string }>,
): Set<string> {
  const result = new Set<string>()
  const queue = [nodeId]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)

    for (const n of Object.values(allNodes)) {
      if ((n.parentId === current || n.ownerId === current) && n.id !== nodeId && visibleNodeIds.has(n.id)) {
        if (!visited.has(n.id)) {
          result.add(n.id)
          queue.push(n.id)
        }
      }
    }

    if (allEdges) {
      for (const edge of Object.values(allEdges)) {
        if (edge.source === current && visibleNodeIds.has(edge.target) && edge.target !== nodeId && !visited.has(edge.target)) {
          result.add(edge.target)
          queue.push(edge.target)
        }
      }
    }
  }
  return result
}

const BOUNDS_SIZE = 5000
const TRANSLATE_EXTENT: [[number, number], [number, number]] = [
  [-BOUNDS_SIZE, -BOUNDS_SIZE],
  [BOUNDS_SIZE, BOUNDS_SIZE],
]

const NODE_TYPE_ACCENT: Record<string, string> = {
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

interface OpenCard {
  nodeId: string
  x: number
  y: number
}

const HELPER_TYPES = new Set(['hidden_connections_group', 'package_group', 'config_group'])

/**
 * Build React Flow nodes from the store state.
 * Called only when structureVersion changes.
 */
function buildFlowNodes(
  scannedNodes: Record<string, ProjectNode>,
  manualNodes: Record<string, ManualNode>,
  nodeOverrides: Record<string, { position?: { x: number; y: number }; alias?: string; pinned?: boolean; tags?: string[] }>,
  visibleNodeIds: Set<string>,
  selectedNodeId: string | null,
  childOrder: Record<string, string[]>,
  scannedEdges: Record<string, ProjectEdge>,
  manualEdgesMap: Record<string, ManualEdge>,
  expandedHelperIds: Set<string>,
): { nodes: Node[]; expandedIds: Set<string>; nodeTypeMap: Record<string, string> } {
  const allNodes = { ...scannedNodes, ...manualNodes }
  const allEdges = { ...scannedEdges, ...manualEdgesMap }

  // Pre-compute expanded set
  // Structural nodes: expanded if any child is visible
  // Helper nodes: expanded only if explicitly in expandedHelperIds
  const expandedIds = new Set<string>()
  for (const id of visibleNodeIds) {
    const node = allNodes[id]
    if (!node) continue
    if ('parentId' in node && node.parentId && visibleNodeIds.has(node.parentId)) {
      const parent = allNodes[node.parentId]
      if (parent && !HELPER_TYPES.has(parent.type)) {
        expandedIds.add(node.parentId)
      }
    }
    if ('ownerId' in node && node.ownerId && visibleNodeIds.has(node.ownerId)) {
      const owner = allNodes[node.ownerId]
      if (owner && !HELPER_TYPES.has(owner.type)) {
        expandedIds.add(node.ownerId)
      }
    }
  }
  // Add explicitly expanded helpers
  for (const hid of expandedHelperIds) {
    expandedIds.add(hid)
  }

  // Pre-compute which nodes have children (for chevron visibility)
  const nodesWithChildren = new Set<string>()
  for (const n of Object.values(allNodes)) {
    if ('parentId' in n && n.parentId) nodesWithChildren.add(n.parentId)
    if ('ownerId' in n && n.ownerId) nodesWithChildren.add(n.ownerId)
  }
  // Also check edges for expandable children.
  // 'groups' edges always indicate children (package_group→package, file→helper).
  // 'imports'/'alias_import' edges only indicate children when the source is a
  // helper node (hidden_connections_group), NOT when source is a regular file.
  // 'manual_link' from user_group indicates the group has children.
  // 'manual_link' TO a user_group indicates the source has the group as a child.
  for (const edge of Object.values(allEdges)) {
    if (edge.type === 'groups') {
      nodesWithChildren.add(edge.source)
    } else if (edge.type === 'imports' || edge.type === 'alias_import') {
      const srcType = allNodes[edge.source]?.type
      if (srcType && HELPER_TYPES.has(srcType)) {
        nodesWithChildren.add(edge.source)
      }
    } else if (edge.type === 'manual_link') {
      const srcNode = allNodes[edge.source]
      const tgtNode = allNodes[edge.target]
      // user_group → child: group has children
      if (srcNode?.type === 'user_group') {
        nodesWithChildren.add(edge.source)
      }
      // parent → user_group: parent has the group as a child
      if (tgtNode?.type === 'user_group') {
        nodesWithChildren.add(edge.source)
      }
    }
  }

  // Pre-compute which user_group nodes are "virtual children" of which parent
  // (connected via manual_link: parent → user_group)
  const groupParentMap = new Map<string, string>() // groupId → parentId
  for (const edge of Object.values(allEdges)) {
    if (edge.type === 'manual_link') {
      const tgt = allNodes[edge.target]
      if (tgt?.type === 'user_group') {
        groupParentMap.set(edge.target, edge.source)
      }
    }
  }

  // Pre-compute sibling orders per parent for reorder arrows (hover-based)
  const siblingOrderByParent = new Map<string, string[]>()
  const parentIds = new Set<string>()
  for (const id of visibleNodeIds) {
    const n = allNodes[id]
    if (n && 'parentId' in n && n.parentId && visibleNodeIds.has(n.parentId)) {
      parentIds.add(n.parentId)
    }
    // user_group virtual children
    const gp = groupParentMap.get(id)
    if (gp && visibleNodeIds.has(gp)) {
      parentIds.add(gp)
    }
  }
  for (const pid of parentIds) {
    const order = childOrder?.[pid]
    if (order) {
      siblingOrderByParent.set(pid, order.filter((id) => visibleNodeIds.has(id)))
    } else {
      // Collect structural children + virtual group children
      const childrenIds: string[] = []
      for (const n of Object.values(allNodes)) {
        if ('parentId' in n && n.parentId === pid && visibleNodeIds.has(n.id)) {
          childrenIds.push(n.id)
        }
      }
      // Add user_groups connected from this parent
      for (const [gid, gpid] of groupParentMap) {
        if (gpid === pid && visibleNodeIds.has(gid) && !childrenIds.includes(gid)) {
          childrenIds.push(gid)
        }
      }
      childrenIds.sort((a, b) => {
        const ay = nodeOverrides[a]?.position?.y ?? 0
        const by = nodeOverrides[b]?.position?.y ?? 0
        return ay - by
      })
      siblingOrderByParent.set(pid, childrenIds)
    }
  }

  const result: Node[] = []
  for (const id of visibleNodeIds) {
    const node = scannedNodes[id] ?? manualNodes[id]
    if (!node) continue
    const ov = nodeOverrides[id]
    const parentId = 'parentId' in node ? node.parentId : null
    // For user_group nodes, use virtual parent from manual_link
    const effectiveParentId = parentId ?? groupParentMap.get(id) ?? null

    // Compute reorder info for this node
    let hasSiblings = false
    let canMoveUp = false
    let canMoveDown = false
    if (effectiveParentId) {
      const siblings = siblingOrderByParent.get(effectiveParentId)
      if (siblings && siblings.length >= 2) {
        const idx = siblings.indexOf(id)
        if (idx !== -1) {
          hasSiblings = true
          canMoveUp = idx > 0
          canMoveDown = idx < siblings.length - 1
        }
      }
    }

    result.push({
      id: node.id,
      type: node.type,
      position: ov?.position ?? { x: 0, y: 0 },
      data: {
        label: ov?.alias ?? node.name,
        nodeData: node,
        isSelected: node.id === selectedNodeId,
        isExpanded: expandedIds.has(node.id),
        accentColor: NODE_TYPE_ACCENT[node.type] ?? 'var(--accent-primary)',
        hasChildren: nodesWithChildren.has(node.id),
        parentId: effectiveParentId,
        hasSiblings,
        canMoveUp,
        canMoveDown,
        isPinned: nodeOverrides[id]?.pinned ?? false,
        tags: nodeOverrides[id]?.tags ?? [],
      },
      selected: node.id === selectedNodeId,
    })
  }

  // Build type map for edge filtering
  const nodeTypeMap: Record<string, string> = {}
  for (const [nid, n] of Object.entries(allNodes)) {
    nodeTypeMap[nid] = n.type
  }

  return { nodes: result, expandedIds, nodeTypeMap }
}

/**
 * Pick which target handle to use based on where the source node's
 * RIGHT edge (where the edge exits) is relative to the target node's CENTER.
 *
 * The source handle is always on the right side, so the actual exit point
 * is at approximately sourcePos.x + NODE_WIDTH.
 */
const APPROX_NODE_WIDTH = 180
const APPROX_NODE_HEIGHT = 50

function pickTargetHandle(
  sourcePos: { x: number; y: number },
  targetPos: { x: number; y: number },
): string {
  // Source exit point (right edge center)
  const srcX = sourcePos.x + APPROX_NODE_WIDTH
  const srcY = sourcePos.y + APPROX_NODE_HEIGHT / 2
  // Target center
  const tgtX = targetPos.x + APPROX_NODE_WIDTH / 2
  const tgtY = targetPos.y + APPROX_NODE_HEIGHT / 2

  const dx = srcX - tgtX // positive = source is to the right of target
  const dy = srcY - tgtY // positive = source is below target

  // If source exit is to the left of target center, connect on left
  if (dx <= 0) return 'target-left'

  // Source is to the right — pick based on vertical relationship
  // Use top/bottom only when the Y difference is significant
  if (Math.abs(dy) > APPROX_NODE_HEIGHT) {
    return dy < 0 ? 'target-top' : 'target-bottom'
  }

  // Default to left even when source is somewhat to the right
  // (this covers the common case of siblings at the same X level)
  return 'target-left'
}

function buildFlowEdges(
  scannedEdges: Record<string, ProjectEdge>,
  manualEdges: Record<string, ManualEdge>,
  visibleNodeIds: Set<string>,
  nodePositions: Record<string, { x: number; y: number } | undefined>,
  expandedIds: Set<string>,
  allNodeTypes: Record<string, string>,
  userGroups?: Record<string, { id: string; memberNodeIds: string[] }>,
  suppressedEdges?: string[],
): Edge[] {
  const suppressedSet = new Set(suppressedEdges ?? [])
  const result: Edge[] = []
  const allEdges = { ...scannedEdges, ...manualEdges }
  for (const edge of Object.values(allEdges)) {
    if (suppressedSet.has(edge.id)) continue
    if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) continue

    // Hide edges FROM helper nodes when the helper is collapsed
    const sourceType = allNodeTypes[edge.source]
    if (sourceType && HELPER_TYPES.has(sourceType) && !expandedIds.has(edge.source)) {
      continue
    }

    const isAlias = edge.type === 'alias_import'
    const isSolid =
      edge.type === 'contains' ||
      (edge.type === 'manual_link' && 'relation' in edge && edge.relation === 'Attached Note')

    const sourcePos = nodePositions[edge.source] ?? { x: 0, y: 0 }
    const targetPos = nodePositions[edge.target] ?? { x: 0, y: 0 }
    const targetHandle = pickTargetHandle(sourcePos, targetPos)

    let edgeType: string
    if (isSolid) edgeType = 'solidEdge'
    else if (isAlias) edgeType = 'curvedDashedEdge'
    else edgeType = 'dashedEdge'

    result.push({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: 'source-right',
      targetHandle,
      type: edgeType,
    })
  }

  // Draw edges for expanded user groups to their members
  if (userGroups) {
    for (const group of Object.values(userGroups)) {
      if (!visibleNodeIds.has(group.id)) continue
      if (!expandedIds.has(group.id)) continue
      for (const memberId of group.memberNodeIds) {
        if (!visibleNodeIds.has(memberId)) continue
        const sourcePos = nodePositions[group.id] ?? { x: 0, y: 0 }
        const targetPos = nodePositions[memberId] ?? { x: 0, y: 0 }
        const targetHandle = pickTargetHandle(sourcePos, targetPos)
        result.push({
          id: `groupedge:${group.id}->${memberId}`,
          source: group.id,
          target: memberId,
          sourceHandle: 'source-right',
          targetHandle,
          type: 'dashedEdge',
        })
      }
    }
  }

  return result
}

export function Canvas() {
  const { expand, collapse, isExpanded: checkExpanded, forceCollapseHelper } = useReveal()
  const isScanning = useProjectStore((s) => s.isScanning)
  const selectedNodeId = useProjectStore((s) => s.selectedNodeId)
  const structureVersion = useProjectStore((s) => s.structureVersion)
  const { screenToFlowPosition, fitView } = useReactFlow()

  // Spacebar-to-pan: track whether spacebar is held
  const [isPanning, setIsPanning] = useState(false)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault()
        setIsPanning(true)
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsPanning(false)
    }
    // Also reset if window loses focus
    const blur = () => setIsPanning(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  // ─── Build nodes/edges only when structure actually changes ───
  const [flowNodes, setFlowNodes] = useState<Node[]>([])
  const [flowEdges, setFlowEdges] = useState<Edge[]>([])
  const prevVersion = useRef(-1)

  useEffect(() => {
    if (structureVersion === prevVersion.current) return
    prevVersion.current = structureVersion

    const state = useProjectStore.getState()
    const effectiveVisible = state.getFilteredVisibleNodeIds()
    const { nodes, expandedIds, nodeTypeMap } = buildFlowNodes(
      state.scanned.nodes,
      state.user.manualNodes,
      state.user.nodeOverrides,
      effectiveVisible,
      state.selectedNodeId,
      state.user.childOrder,
      state.scanned.edges,
      state.user.manualEdges,
      state.expandedHelperIds,
    )
    const posMap: Record<string, { x: number; y: number } | undefined> = {}
    for (const [nid, ov] of Object.entries(state.user.nodeOverrides)) {
      posMap[nid] = ov?.position
    }
    const edges = buildFlowEdges(
      state.scanned.edges,
      state.user.manualEdges,
      effectiveVisible,
      posMap,
      expandedIds,
      nodeTypeMap,
      state.user.userGroups,
      state.user.suppressedEdges,
    )
    setFlowNodes(nodes)
    setFlowEdges(edges)

    // Auto-fit on first nodes appearing
    if (nodes.length > 0 && prevVersion.current <= 2) {
      setTimeout(() => fitView({ padding: 0.3, duration: 400 }), 100)
    }
  }, [structureVersion, fitView])

  // On selection change, update selection styling
  useEffect(() => {
    setFlowNodes((prev) =>
      prev.map((n) => {
        const sel = n.id === selectedNodeId
        if (n.selected === sel) return n
        return { ...n, selected: sel, data: { ...n.data, isSelected: sel } }
      }),
    )
  }, [selectedNodeId])

  const rebuildEdges = useCallback(() => {
    const state = useProjectStore.getState()
    const effectiveVisible = state.getFilteredVisibleNodeIds()
    const allN = { ...state.scanned.nodes, ...state.user.manualNodes }
    // Structural expanded: inferred from visible children
    const expandedSet = new Set<string>()
    for (const id of effectiveVisible) {
      const n = allN[id]
      if (!n) continue
      if ('parentId' in n && n.parentId && effectiveVisible.has(n.parentId)) {
        const p = allN[n.parentId]
        if (p && !HELPER_TYPES.has(p.type)) expandedSet.add(n.parentId)
      }
      if ('ownerId' in n && n.ownerId && effectiveVisible.has(n.ownerId)) {
        const o = allN[n.ownerId]
        if (o && !HELPER_TYPES.has(o.type)) expandedSet.add(n.ownerId)
      }
    }
    // Helpers: only from explicit set
    for (const hid of state.expandedHelperIds) expandedSet.add(hid)

    const typeMap: Record<string, string> = {}
    for (const [nid, n] of Object.entries(allN)) typeMap[nid] = n.type
    const posMap: Record<string, { x: number; y: number } | undefined> = {}
    for (const [nid, ov] of Object.entries(state.user.nodeOverrides)) posMap[nid] = ov?.position
    setFlowEdges(buildFlowEdges(
      state.scanned.edges, state.user.manualEdges,
      effectiveVisible, posMap, expandedSet, typeMap, state.user.userGroups, state.user.suppressedEdges,
    ))
  }, [])

  // ─── React Flow change handler — handles drag live ───
  const isDraggingRef = useRef(false)
  const dragIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draggingNodeId = useRef<string | null>(null)
  const altDragRef = useRef<{
    nodeId: string
    startPos: { x: number; y: number }
    descendantStartPositions: Map<string, { x: number; y: number }>
  } | null>(null)

  // Track Ctrl key state for group drag
  const ctrlKeyRef = useRef(false)
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Control') ctrlKeyRef.current = true }
    const up = (e: KeyboardEvent) => { if (e.key === 'Control') ctrlKeyRef.current = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      // Sync data.isSelected with node.selected for any selection changes
      const hasSelectionChange = changes.some((c) => c.type === 'select')

      setFlowNodes((prev) => {
        let updated = applyNodeChanges(changes, prev)

        // Keep data.isSelected in sync with node.selected
        if (hasSelectionChange) {
          updated = updated.map((n) => {
            const currentSel = !!(n.data as any)?.isSelected
            if (n.selected !== currentSel) {
              return { ...n, data: { ...n.data, isSelected: !!n.selected } }
            }
            return n
          })
        }

        // If Ctrl+dragging, move descendants along with the dragged node
        if (altDragRef.current) {
          const drag = altDragRef.current
          const draggedNode = updated.find((n) => n.id === drag.nodeId)
          if (draggedNode) {
            const deltaX = draggedNode.position.x - drag.startPos.x
            const deltaY = draggedNode.position.y - drag.startPos.y
            updated = updated.map((n) => {
              const startPos = drag.descendantStartPositions.get(n.id)
              if (startPos) {
                return { ...n, position: { x: startPos.x + deltaX, y: startPos.y + deltaY } }
              }
              return n
            })
          }
        }

        return updated
      })

      for (const change of changes) {
        // Snapshot when drag starts (for undo)
        if (change.type === 'position' && change.dragging && !isDraggingRef.current) {
          isDraggingRef.current = true
          draggingNodeId.current = change.id
          useProjectStore.getState().pushUndoSnapshot()

          // If Ctrl is held, set up group drag
          if (ctrlKeyRef.current && change.position) {
            const state = useProjectStore.getState()
            const allNodes = state.getAllNodes()
            const descIds = collectVisibleDescendants(change.id, allNodes, state.visibleNodeIds, state.getAllEdges())
            const startPositions = new Map<string, { x: number; y: number }>()
            // Get current positions from the flowNodes
            setFlowNodes((prev) => {
              for (const n of prev) {
                if (descIds.has(n.id)) {
                  startPositions.set(n.id, { x: n.position.x, y: n.position.y })
                }
              }
              return prev // no changes
            })
            altDragRef.current = {
              nodeId: change.id,
              startPos: { x: change.position.x, y: change.position.y },
              descendantStartPositions: startPositions,
            }
          }
        }

        // While dragging: reset idle timer on every position change
        if (change.type === 'position' && change.dragging) {
          // Movement happened — clear focus if it was active, restart idle timer
          if (focusedRef.current) setFocusedNodeId(null)
          if (dragIdleTimer.current) clearTimeout(dragIdleTimer.current)
          const dragNodeId = draggingNodeId.current ?? change.id
          dragIdleTimer.current = setTimeout(() => {
            setFocusedNodeId(dragNodeId)
            dragIdleTimer.current = null
          }, 500)
        }

        if (change.type === 'position' && !change.dragging && change.position) {
          isDraggingRef.current = false
          draggingNodeId.current = null
          // Clear drag-idle timer and focus
          if (dragIdleTimer.current) { clearTimeout(dragIdleTimer.current); dragIdleTimer.current = null }
          if (focusedRef.current) setFocusedNodeId(null)

          // If this was a Ctrl+drag, persist all descendant positions
          if (altDragRef.current && altDragRef.current.nodeId === change.id) {
            const drag = altDragRef.current
            const deltaX = change.position.x - drag.startPos.x
            const deltaY = change.position.y - drag.startPos.y
            const state = useProjectStore.getState()

            for (const [descId, startPos] of drag.descendantStartPositions) {
              const newPos = { x: startPos.x + deltaX, y: startPos.y + deltaY }
              const descNode = state.getNode(descId)
              const descParentId = descNode && 'parentId' in descNode ? descNode.parentId : null
              const descParentPos = descParentId ? state.user.nodeOverrides[descParentId]?.position : null
              state.setNodeOverride(descId, {
                position: newPos,
                relativePosition: descParentPos
                  ? { x: newPos.x - descParentPos.x, y: newPos.y - descParentPos.y }
                  : undefined,
              })
            }
            altDragRef.current = null
          }

          const state = useProjectStore.getState()
          // Persist final position + relative position to parent
          const nodeData = state.getNode(change.id)
          const parentId = nodeData && 'parentId' in nodeData ? nodeData.parentId : null
          const parentPos = parentId ? state.user.nodeOverrides[parentId]?.position : null
          const relPos = parentPos
            ? { x: change.position.x - parentPos.x, y: change.position.y - parentPos.y }
            : undefined
          state.setNodeOverride(change.id, {
            position: { x: change.position.x, y: change.position.y },
            relativePosition: relPos,
          })

          // Resolve collisions for the moved node and any Ctrl+dragged descendants
          const freshState = useProjectStore.getState()
          const posMap: Record<string, { x: number; y: number } | undefined> = {}
          for (const [nid, ov] of Object.entries(freshState.user.nodeOverrides)) {
            posMap[nid] = ov?.position
          }
          // Check the moved node and all its visible descendants for collisions
          const descIds = collectVisibleDescendants(change.id, freshState.getAllNodes(), freshState.visibleNodeIds, freshState.getAllEdges())
          const movedIds = [change.id, ...descIds]
          let hasCollisionFixes = false
          for (const movedId of movedIds) {
            const fixes = resolveCollisions(
              movedId,
              freshState.getAllNodes(),
              freshState.visibleNodeIds,
              posMap,
              freshState.getAllEdges(),
            )
            for (const fix of fixes) {
              const fixNode = freshState.getNode(fix.nodeId)
              const fixParentId = fixNode && 'parentId' in fixNode ? fixNode.parentId : null
              const fixParentPos = fixParentId ? freshState.user.nodeOverrides[fixParentId]?.position : null
              freshState.setNodeOverride(fix.nodeId, {
                position: { x: fix.x, y: fix.y },
                relativePosition: fixParentPos
                  ? { x: fix.x - fixParentPos.x, y: fix.y - fixParentPos.y }
                  : undefined,
              })
              posMap[fix.nodeId] = { x: fix.x, y: fix.y }
              hasCollisionFixes = true
            }
          }
          if (hasCollisionFixes) {
            useProjectStore.setState((s) => ({ structureVersion: s.structureVersion + 1 }))
          }

          // Rebuild edges with updated positions
          rebuildEdges()
        }
      }
    },
    [],
  )

  // ─── Focus mode (long-press + drag-idle) ───
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)
  const focusedRef = useRef<string | null>(null)
  focusedRef.current = focusedNodeId

  // Listen for long-press / release events dispatched from BaseNode.
  // Also listen for global pointerup to catch releases that happen outside the node
  // (e.g. after dragging the node away from under the pointer).
  useEffect(() => {
    const onPress = (e: Event) => {
      setFocusedNodeId((e as CustomEvent<string>).detail)
    }
    const onRelease = () => {
      setFocusedNodeId(null)
    }
    const onGlobalPointerUp = () => {
      // Only clear if focus is active (avoids unnecessary setState on every click)
      setFocusedNodeId((prev) => prev ? null : prev)
    }
    window.addEventListener('node-long-press', onPress)
    window.addEventListener('node-long-press-release', onRelease)
    window.addEventListener('pointerup', onGlobalPointerUp)
    return () => {
      window.removeEventListener('node-long-press', onPress)
      window.removeEventListener('node-long-press-release', onRelease)
      window.removeEventListener('pointerup', onGlobalPointerUp)
    }
  }, [])

  // Update node/edge dimming when focus changes
  useEffect(() => {
    if (!focusedNodeId) {
      // Clear dimming from all nodes and edges
      setFlowNodes((prev) => prev.map((n) =>
        n.data.isDimmed ? { ...n, data: { ...n.data, isDimmed: false } } : n,
      ))
      setFlowEdges((prev) => prev.map((e) =>
        e.data?.isDimmed ? { ...e, data: { ...e.data, isDimmed: false } } : e,
      ))
      return
    }
    const state = useProjectStore.getState()
    const focusedSet = new Set([focusedNodeId])
    const descendants = collectVisibleDescendants(focusedNodeId, state.getAllNodes(), state.visibleNodeIds, state.getAllEdges())
    for (const id of descendants) focusedSet.add(id)

    setFlowNodes((prev) => prev.map((n) => {
      const dimmed = !focusedSet.has(n.id)
      if ((n.data.isDimmed ?? false) === dimmed) return n
      return { ...n, data: { ...n.data, isDimmed: dimmed } }
    }))
    setFlowEdges((prev) => prev.map((e) => {
      const dimmed = !(focusedSet.has(e.source) && focusedSet.has(e.target))
      if ((e.data?.isDimmed ?? false) === dimmed) return e
      return { ...e, data: { ...e.data, isDimmed: dimmed } }
    }))
  }, [focusedNodeId])

  // ─── Click handling ───
  const [openCards, setOpenCards] = useState<OpenCard[]>([])
  const [showSearch, setShowSearch] = useState(false)
  const [showAddNode, setShowAddNode] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [groupTargetNodeId, setGroupTargetNodeId] = useState<string | null>(null)
  const [connectMode, setConnectMode] = useState<{
    step: 'source' | 'target'
    sourceId?: string
    sourceName?: string
  } | null>(null)

  // ─── Click: select node (+ connect mode). Expand/collapse handled by chevron. ───
  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (consumeLongPressFired()) return

      if (connectMode) {
        if (connectMode.step === 'source') {
          setConnectMode({
            step: 'target',
            sourceId: node.id,
            sourceName: String(node.data?.label ?? node.id),
          })
          return
        }
        if (connectMode.step === 'target' && connectMode.sourceId) {
          const state = useProjectStore.getState()
          const sourceNode = state.getNode(connectMode.sourceId)
          const targetNode = state.getNode(node.id)
          const hasNote = sourceNode?.type === 'note' || targetNode?.type === 'note'
          const edge: ManualEdge = {
            id: `edge:${connectMode.sourceId}->${node.id}:manual_link`,
            type: 'manual_link',
            source: connectMode.sourceId,
            target: node.id,
            relation: hasNote ? 'Attached Note' : 'Related',
          }
          state.pushUndoSnapshot()
          state.addManualEdge(edge)
          setConnectMode(null)
          return
        }
      }

      // Click on node body = select
      useProjectStore.getState().setSelectedNode(node.id)
    },
    [connectMode],
  )

  // ─── Double-click: open detail card + select ───
  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (event, node) => {
      if (connectMode) return
      setOpenCards((prev) => {
        if (prev.some((c) => c.nodeId === node.id)) return prev
        return [...prev, { nodeId: node.id, x: event.clientX + 20, y: event.clientY - 20 }]
      })
      useProjectStore.getState().setSelectedNode(node.id)
    },
    [connectMode],
  )

  // ─── Chevron click: expand/collapse (dispatched from BaseNode) ───
  useEffect(() => {
    const onChevronClick = (e: Event) => {
      const { nodeId, shiftKey } = (e as CustomEvent<{ nodeId: string; shiftKey: boolean }>).detail
      if (checkExpanded(nodeId)) {
        if (shiftKey) {
          forceCollapseHelper(nodeId)
        } else {
          collapse(nodeId)
        }
      } else {
        expand(nodeId)
      }
    }
    window.addEventListener('node-chevron-click', onChevronClick)
    return () => window.removeEventListener('node-chevron-click', onChevronClick)
  }, [expand, collapse, checkExpanded, forceCollapseHelper])

  const handlePaneClick = useCallback(() => {
    useProjectStore.getState().setSelectedNode(null)
    if (connectMode) setConnectMode(null)
    // Clear React Flow's internal selection state too
    setFlowNodes((prev) =>
      prev.map((n) =>
        n.selected ? { ...n, selected: false, data: { ...n.data, isSelected: false } } : n,
      ),
    )
  }, [connectMode])

  const handleCloseCard = useCallback((nodeId: string) => {
    setOpenCards((prev) => prev.filter((c) => c.nodeId !== nodeId))
  }, [])

  const handleDetailOpen = useCallback(() => {
    const sel = useProjectStore.getState().selectedNodeId
    if (!sel) return
    setOpenCards((prev) => {
      if (prev.some((c) => c.nodeId === sel)) return prev
      return [...prev, { nodeId: sel, x: window.innerWidth / 2 - 150, y: window.innerHeight / 2 - 100 }]
    })
  }, [])

  const handleRevealPath = useCallback(() => {
    const state = useProjectStore.getState()
    if (!state.selectedNodeId) return
    const allNodes = state.getAllNodes()
    const node = allNodes[state.selectedNodeId]
    if (!node) return

    const toReveal: string[] = []
    let cur: string | null = 'parentId' in node ? (node.parentId ?? null) : null
    while (cur) {
      if (!state.visibleNodeIds.has(cur)) toReveal.push(cur)
      const p = allNodes[cur]
      cur = p && 'parentId' in p ? (p.parentId ?? null) : null
    }
    if (toReveal.length > 0) {
      for (let i = 0; i < toReveal.length; i++) {
        const aid = toReveal[i]!
        if (!state.user.nodeOverrides[aid]?.position) {
          state.setNodeOverride(aid, { position: { x: -200 * (toReveal.length - i), y: 0 } })
        }
      }
      state.revealNodes(toReveal)
    }
  }, [])

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const notInInput = !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)

      if ((e.key === '/' || (e.ctrlKey && e.key === 'f')) && notInInput) {
        e.preventDefault()
        setShowSearch(true)
      }
      // Ctrl+Z = undo, Ctrl+Shift+Z / Ctrl+Y = redo
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey && notInInput) {
        e.preventDefault()
        useProjectStore.getState().undo()
      }
      if (e.ctrlKey && (e.key === 'Z' || e.key === 'y') && notInInput) {
        e.preventDefault()
        useProjectStore.getState().redo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (connectMode) setConnectMode(null)
        if (showSearch) setShowSearch(false)
        if (showAddNode) setShowAddNode(false)
        if (showSettings) setShowSettings(false)
      }
    },
    [connectMode, showSearch, showAddNode, showSettings],
  )

  const getViewportCenter = useCallback(() => {
    return screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
  }, [screenToFlowPosition])

  return (
    <div style={{ width: '100%', height: '100%' }} onKeyDown={handleKeyDown} tabIndex={-1}>
      <ReactFlow
        className={isPanning ? 'panning' : ''}
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onPaneClick={handlePaneClick}
        translateExtent={TRANSLATE_EXTENT}
        minZoom={0.1}
        maxZoom={2.5}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        fitView={false}
        proOptions={{ hideAttribution: true }}
        panOnDrag={isPanning}
        panOnScroll={false}
        selectNodesOnDrag={false}
        nodesDraggable={true}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="var(--canvas-dot)" />
      </ReactFlow>

      {/* Scanning indicator */}
      {isScanning && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 50,
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px',
          borderRadius: 'var(--radius-lg)', background: 'var(--surface-glass)',
          backdropFilter: 'blur(12px)', border: '1px solid var(--accent-primary)',
          boxShadow: '0 0 16px rgba(96, 165, 250, 0.15)', color: 'var(--accent-primary)',
          fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, fontWeight: 500,
        }}>
          <ScanLine size={14} style={{ animation: 'spin 1.5s linear infinite' }} />
          Scanning project...
        </div>
      )}

      {openCards.map((card) => (
        <DetailCard key={card.nodeId} nodeId={card.nodeId}
          initialPosition={{ x: card.x, y: card.y }}
          onClose={() => handleCloseCard(card.nodeId)} />
      ))}

      {connectMode && (
        <ConnectModeOverlay step={connectMode.step} sourceName={connectMode.sourceName}
          onCancel={() => setConnectMode(null)} />
      )}

      {showSearch && <SearchOverlay onClose={() => setShowSearch(false)} />}

      {showAddNode && (
        <AddNodeModal onClose={() => setShowAddNode(false)} viewportCenter={getViewportCenter()} />
      )}

      {showSettings && <ProjectSettingsModal onClose={() => setShowSettings(false)} />}

      {showShortcuts && (
        <ShortcutsPanel
          initialPosition={{ x: window.innerWidth / 2 - 180, y: window.innerHeight / 2 - 200 }}
          onClose={() => setShowShortcuts(false)}
        />
      )}

      {showFilters && <FilterPanel onClose={() => setShowFilters(false)} />}

      {showGroupModal && groupTargetNodeId && (
        <GroupModal
          onClose={() => { setShowGroupModal(false); setGroupTargetNodeId(null) }}
          targetNodeId={groupTargetNodeId}
        />
      )}

      <Dock
        onSearchOpen={() => setShowSearch(true)}
        onAddNode={() => setShowAddNode(true)}
        onConnectMode={() => {
          if (connectMode) {
            setConnectMode(null)
          } else {
            const selectedId = useProjectStore.getState().selectedNodeId
            if (selectedId) {
              const node = useProjectStore.getState().getNode(selectedId)
              setConnectMode({
                step: 'target',
                sourceId: selectedId,
                sourceName: String((node as any)?.name ?? selectedId),
              })
            } else {
              setConnectMode({ step: 'source' })
            }
          }
        }}
        onSettingsOpen={() => setShowSettings(true)}
        onDetailOpen={handleDetailOpen}
        onRevealPath={handleRevealPath}
        onShortcutsOpen={() => setShowShortcuts(true)}
        onFilterToggle={() => setShowFilters(!showFilters)}
        onAddToGroup={() => {
          if (selectedNodeId) {
            setGroupTargetNodeId(selectedNodeId)
            setShowGroupModal(true)
          }
        }}
        onToggleExpand={() => {
          if (!selectedNodeId) return
          if (checkExpanded(selectedNodeId)) {
            collapse(selectedNodeId)
          } else {
            expand(selectedNodeId)
          }
        }}
        onRebalance={() => {
          if (!selectedNodeId) return
          const state = useProjectStore.getState()
          const allNodes = state.getAllNodes()
          const { visibleNodeIds } = state

          state.pushUndoSnapshot()

          // Clear saved childOrder and relativePositions, then re-layout each expanded node's children
          const queue = [selectedNodeId]
          const visited = new Set<string>()
          while (queue.length > 0) {
            const parentId = queue.shift()!
            if (visited.has(parentId)) continue
            visited.add(parentId)

            const parentPos = state.user.nodeOverrides[parentId]?.position ?? { x: 0, y: 0 }

            // Find visible children of this node
            const children: string[] = []
            for (const n of Object.values(allNodes)) {
              if ('parentId' in n && n.parentId === parentId && visibleNodeIds.has(n.id)) {
                children.push(n.id)
              }
            }
            // Also include user_group children via manual_link
            const allEdges = state.getAllEdges()
            for (const edge of Object.values(allEdges)) {
              if (edge.type === 'manual_link' && edge.source === parentId) {
                const tgt = allNodes[edge.target]
                if (tgt?.type === 'user_group' && visibleNodeIds.has(tgt.id) && !children.includes(tgt.id)) {
                  children.push(tgt.id)
                }
              }
            }

            if (children.length > 0) {
              // Sort by type priority (same as initial expand)
              const TYPE_PRIORITY: Record<string, number> = { folder: 0, user_group: 1, file: 2, note: 3 }
              children.sort((a, b) => {
                const pa = TYPE_PRIORITY[allNodes[a]?.type ?? ''] ?? 4
                const pb = TYPE_PRIORITY[allNodes[b]?.type ?? ''] ?? 4
                if (pa !== pb) return pa - pb
                const na = (allNodes[a] as any)?.name ?? ''
                const nb = (allNodes[b] as any)?.name ?? ''
                return na.localeCompare(nb)
              })

              // Clear saved order and relative positions for these children
              const newChildOrder = { ...state.user.childOrder }
              delete newChildOrder[parentId]
              useProjectStore.setState((s) => ({
                user: { ...s.user, childOrder: newChildOrder },
              }))

              // Recalculate positions
              const typeMap = new Map<string, string>()
              for (const id of children) {
                const n = allNodes[id]
                if (n) typeMap.set(id, n.type)
              }
              const positions = calculateChildPositions(parentPos, children, typeMap)
              for (const pos of positions) {
                state.setNodeOverride(pos.nodeId, {
                  position: { x: pos.x, y: pos.y },
                  relativePosition: { x: pos.x - parentPos.x, y: pos.y - parentPos.y },
                })
              }

              // Queue children for recursive rebalance
              for (const id of children) {
                queue.push(id)
              }
            }
          }

          // Bump structure version to trigger re-render
          useProjectStore.setState((s) => ({ structureVersion: s.structureVersion + 1 }))
        }}
        isNodeExpanded={selectedNodeId ? checkExpanded(selectedNodeId) : false}
        isConnecting={!!connectMode}
        isFilterOpen={showFilters}
      />
    </div>
  )
}
