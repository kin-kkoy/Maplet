import { useCallback } from 'react'
import { useProjectStore } from '../store/useProjectStore'
import { calculateChildPositions, adjustSiblingPositions, resolveCollisions } from '../canvas/layout'

const HELPER_TYPES = new Set(['hidden_connections_group', 'package_group', 'config_group'])

export function useReveal() {
  /**
   * Collapse a helper with Shift: force-hide all targets even if
   * they're visible from their real parent.
   */
  const forceCollapseHelper = useCallback((nodeId: string) => {
    const state = useProjectStore.getState()
    const allNodes = state.getAllNodes()
    const allEdges = state.getAllEdges()
    const manualEdges = state.user.manualEdges
    const node = allNodes[nodeId]
    if (!node || !HELPER_TYPES.has(node.type)) return
    if (!state.expandedHelperIds.has(nodeId)) return

    state.pushUndoSnapshot()

    const suppressedSet = new Set(state.user.suppressedEdges ?? [])
    const candidates = getRevealCandidates(nodeId, node.type, allNodes, allEdges, manualEdges, suppressedSet)
    const toHide = candidates.filter((id) => state.visibleNodeIds.has(id))
    if (toHide.length > 0) {
      state.hideNodes(toHide)
    }
    state.collapseHelper(nodeId)
  }, [])

  const expand = useCallback((nodeId: string) => {
    const state = useProjectStore.getState()
    const allNodes = state.getAllNodes()
    const allEdges = state.getAllEdges()
    const { visibleNodeIds } = state
    const nodeOverrides = state.user.nodeOverrides
    const manualEdges = state.user.manualEdges

    const node = allNodes[nodeId]
    if (!node) return

    const isHelper = HELPER_TYPES.has(node.type)

    if (isHelper) {
      // Helper nodes: explicitly track expansion, only reveal nodes not visible yet
      if (state.expandedHelperIds.has(nodeId)) return // already expanded

      state.pushUndoSnapshot()

      const suppressedSet = new Set(state.user.suppressedEdges ?? [])
    const candidates = getRevealCandidates(nodeId, node.type, allNodes, allEdges, manualEdges, suppressedSet)
      const newNodes = candidates.filter((id) => !visibleNodeIds.has(id))

      if (newNodes.length > 0) {
        const parentPos = nodeOverrides[nodeId]?.position ?? { x: 0, y: 0 }
        const typeMap = new Map<string, string>()
        for (const id of newNodes) {
          const n = allNodes[id]
          if (n) typeMap.set(id, n.type)
        }
        const positions = calculateChildPositions(parentPos, newNodes, typeMap)
        for (const pos of positions) {
          state.setNodeOverride(pos.nodeId, { position: { x: pos.x, y: pos.y } })
        }
        state.revealNodes(newNodes)
      }

      // Mark as explicitly expanded (even if all targets were already visible)
      state.expandHelper(nodeId)
      return
    }

    // Structural nodes: standard expand
    const suppressedSet = new Set(state.user.suppressedEdges ?? [])
    const candidates = getRevealCandidates(nodeId, node.type, allNodes, allEdges, manualEdges, suppressedSet)
    const newNodes = candidates.filter((id) => !visibleNodeIds.has(id))
    if (newNodes.length === 0) return

    state.pushUndoSnapshot()

    // Build typeMap first (needed for both sorting and layout)
    const typeMap = new Map<string, string>()
    for (const id of newNodes) {
      const n = allNodes[id]
      if (n) typeMap.set(id, n.type)
    }

    const savedOrder = state.user.childOrder?.[nodeId]
    if (savedOrder) {
      const orderMap = new Map(savedOrder.map((id, i) => [id, i]))
      newNodes.sort((a, b) => (orderMap.get(a) ?? 999) - (orderMap.get(b) ?? 999))
    } else {
      // Default ordering: folders first, then user_groups, then files, then notes
      const TYPE_PRIORITY: Record<string, number> = {
        folder: 0,
        user_group: 1,
        file: 2,
        note: 3,
      }
      newNodes.sort((a, b) => {
        const pa = TYPE_PRIORITY[typeMap.get(a) ?? ''] ?? 4
        const pb = TYPE_PRIORITY[typeMap.get(b) ?? ''] ?? 4
        if (pa !== pb) return pa - pb
        const na = (allNodes[a] as any)?.name ?? ''
        const nb = (allNodes[b] as any)?.name ?? ''
        return na.localeCompare(nb)
      })
    }

    const parentPos = nodeOverrides[nodeId]?.position ?? { x: 0, y: 0 }

    // Position children: use saved relative offsets from parent if available,
    // otherwise calculate fresh positions
    const needsLayout: string[] = []
    for (const id of newNodes) {
      const relPos = nodeOverrides[id]?.relativePosition
      if (relPos) {
        // Has a saved offset from parent — apply it relative to current parent position
        state.setNodeOverride(id, {
          position: { x: parentPos.x + relPos.x, y: parentPos.y + relPos.y },
        })
      } else {
        needsLayout.push(id)
      }
    }

    if (needsLayout.length > 0) {
      const layoutTypeMap = new Map<string, string>()
      for (const id of needsLayout) {
        const n = allNodes[id]
        if (n) layoutTypeMap.set(id, n.type)
      }
      const positions = calculateChildPositions(parentPos, needsLayout, layoutTypeMap)
      for (const pos of positions) {
        state.setNodeOverride(pos.nodeId, { position: { x: pos.x, y: pos.y } })
      }
    }

    // Re-read overrides since we may have just set new positions
    const freshOverrides = useProjectStore.getState().user.nodeOverrides
    const posMap: Record<string, { x: number; y: number } | undefined> = {}
    for (const [id, ov] of Object.entries(freshOverrides)) posMap[id] = ov?.position

    const regularNewCount = newNodes.filter((id) => {
      const t = typeMap.get(id)
      return !HELPER_TYPES.has(t ?? '')
    }).length
    const expandedVisible = new Set([...visibleNodeIds, ...newNodes])
    const adjustments = adjustSiblingPositions(
      nodeId, regularNewCount, allNodes, expandedVisible, posMap, allEdges,
    )
    for (const adj of adjustments) {
      state.setNodeOverride(adj.nodeId, { position: { x: adj.x, y: adj.y } })
    }

    // Resolve collisions between new children and ALL other visible nodes
    const collisionOverrides = useProjectStore.getState().user.nodeOverrides
    const collisionPosMap: Record<string, { x: number; y: number } | undefined> = {}
    for (const [id, ov] of Object.entries(collisionOverrides)) collisionPosMap[id] = ov?.position
    const batchAdjusted = new Set<string>()
    for (const childId of newNodes) {
      const fixes = resolveCollisions(childId, allNodes, expandedVisible, collisionPosMap, allEdges, batchAdjusted)
      for (const fix of fixes) {
        state.setNodeOverride(fix.nodeId, { position: { x: fix.x, y: fix.y } })
        collisionPosMap[fix.nodeId] = { x: fix.x, y: fix.y }
        batchAdjusted.add(fix.nodeId)
      }
    }

    state.revealNodes(newNodes)
  }, [])

  const collapse = useCallback((nodeId: string) => {
    const state = useProjectStore.getState()
    const allNodes = state.getAllNodes()
    const allEdges = state.getAllEdges()
    const { visibleNodeIds } = state
    const nodeOverrides = state.user.nodeOverrides
    const manualEdges = state.user.manualEdges

    const node = allNodes[nodeId]
    if (!node) return

    const isHelper = HELPER_TYPES.has(node.type)

    if (isHelper) {
      if (!state.expandedHelperIds.has(nodeId)) return // already collapsed

      state.pushUndoSnapshot()

      const suppressedSet = new Set(state.user.suppressedEdges ?? [])
    const candidates = getRevealCandidates(nodeId, node.type, allNodes, allEdges, manualEdges, suppressedSet)

      // For each target: if its real parent folder is not expanded,
      // expand the real parent so the node "goes back" to where it belongs
      const parentsToExpand = new Set<string>()
      const toHide: string[] = []

      for (const id of candidates) {
        if (!visibleNodeIds.has(id)) continue
        const targetNode = allNodes[id]
        if (!targetNode) continue
        const realParentId = 'parentId' in targetNode ? targetNode.parentId : null

        if (!realParentId || realParentId === nodeId) {
          // No real parent, OR parent IS this helper group — always hide
          toHide.push(id)
        } else {
          // Has a different real parent — expand that parent so the node
          // appears in its proper location
          parentsToExpand.add(realParentId)
        }
      }

      if (toHide.length > 0) {
        state.hideNodes(toHide)
      }

      // Collapse the helper first
      state.collapseHelper(nodeId)

      // Expand real parents so nodes appear in their proper location
      for (const pid of parentsToExpand) {
        const freshState = useProjectStore.getState()
        const freshAllNodes = freshState.getAllNodes()
        const pNode = freshAllNodes[pid]
        if (!pNode) continue

        // Make sure the parent itself is visible first
        if (!freshState.visibleNodeIds.has(pid)) {
          // Walk up to find a visible ancestor and expand down
          const chain: string[] = [pid]
          let walkId: string | null = 'parentId' in pNode ? (pNode.parentId ?? null) : null
          while (walkId && !freshState.visibleNodeIds.has(walkId)) {
            chain.push(walkId)
            const w = freshAllNodes[walkId]
            walkId = w && 'parentId' in w ? (w.parentId ?? null) : null
          }
          // Reveal the chain from top to bottom
          for (const cid of chain.reverse()) {
            if (!freshState.visibleNodeIds.has(cid)) {
              freshState.revealNodes([cid])
            }
          }
        }

        // Now expand the parent: get all its children and position them
        const rState = useProjectStore.getState()
        const rAllNodes = rState.getAllNodes()
        const rAllEdges = rState.getAllEdges()
        const rManualEdges = rState.user.manualEdges
        const rNode = rAllNodes[pid]
        if (!rNode) continue
        const rSuppressed = new Set(rState.user.suppressedEdges ?? [])
        const pCandidates = getRevealCandidates(pid, rNode.type, rAllNodes, rAllEdges, rManualEdges, rSuppressed)

        // ALL children get positioned (both new and already-visible ones that need repositioning)
        const pPos = rState.user.nodeOverrides[pid]?.position ?? { x: 0, y: 0 }
        const typeMap = new Map<string, string>()
        for (const cid of pCandidates) {
          const cn = rAllNodes[cid]
          if (cn) typeMap.set(cid, cn.type)
        }
        const positions = calculateChildPositions(pPos, pCandidates, typeMap)
        for (const pos of positions) {
          rState.setNodeOverride(pos.nodeId, { position: { x: pos.x, y: pos.y } })
        }

        // Reveal any that aren't visible yet
        const toReveal = pCandidates.filter((cid) => !rState.visibleNodeIds.has(cid))
        if (toReveal.length > 0) {
          rState.revealNodes(toReveal)
        } else {
          // Force a structure version bump so positions update on screen
          useProjectStore.setState((s) => ({ structureVersion: s.structureVersion + 1 }))
        }
      }
      return
    }

    // Structural nodes: standard collapse
    const suppressedSet = new Set(state.user.suppressedEdges ?? [])
    const candidates = getRevealCandidates(nodeId, node.type, allNodes, allEdges, manualEdges, suppressedSet)
    const visibleChildren = candidates.filter((id) => visibleNodeIds.has(id))
    if (visibleChildren.length === 0) return

    state.pushUndoSnapshot()

    const toHide = collectDescendants(nodeId, allNodes, allEdges, visibleNodeIds)
    if (toHide.length > 0) {
      // Also collapse any helper nodes that were expanded within this subtree
      for (const hiddenId of toHide) {
        if (state.expandedHelperIds.has(hiddenId)) {
          state.collapseHelper(hiddenId)
        }
      }

      state.hideNodes(toHide)

      const posMap: Record<string, { x: number; y: number } | undefined> = {}
      for (const [id, ov] of Object.entries(nodeOverrides)) posMap[id] = ov?.position
      const newVisible = new Set([...visibleNodeIds].filter((id) => !toHide.includes(id)))
      const adjustments = adjustSiblingPositions(nodeId, 0, allNodes, newVisible, posMap, allEdges)
      for (const adj of adjustments) {
        state.setNodeOverride(adj.nodeId, { position: { x: adj.x, y: adj.y } })
      }
    }
  }, [])

  const isExpanded = useCallback((nodeId: string): boolean => {
    const state = useProjectStore.getState()
    const allNodes = state.getAllNodes()
    const node = allNodes[nodeId]
    if (!node) return false

    // Helper nodes use explicit tracking
    if (HELPER_TYPES.has(node.type)) {
      return state.expandedHelperIds.has(nodeId)
    }

    // Structural nodes: check if any children are visible
    const allEdges = state.getAllEdges()
    const manualEdges = state.user.manualEdges
    const suppressedSet = new Set(state.user.suppressedEdges ?? [])
    const candidates = getRevealCandidates(nodeId, node.type, allNodes, allEdges, manualEdges, suppressedSet)
    return candidates.some((id) => state.visibleNodeIds.has(id))
  }, [])

  const hasChildren = useCallback((nodeId: string): boolean => {
    const state = useProjectStore.getState()
    const allNodes = state.getAllNodes()
    const allEdges = state.getAllEdges()
    const manualEdges = state.user.manualEdges
    const node = allNodes[nodeId]
    if (!node) return false
    const suppressedSet = new Set(state.user.suppressedEdges ?? [])
    const candidates = getRevealCandidates(nodeId, node.type, allNodes, allEdges, manualEdges, suppressedSet)
    return candidates.length > 0
  }, [])

  return { expand, collapse, forceCollapseHelper, isExpanded, hasChildren }
}

function getRevealCandidates(
  nodeId: string,
  nodeType: string,
  allNodes: Record<string, { id: string; type: string; parentId?: string | null; ownerId?: string }>,
  allEdges: Record<string, { id: string; type: string; source: string; target: string }>,
  manualEdgesOnly: Record<string, { source: string; target: string }>,
  suppressedEdges?: Set<string>,
): string[] {
  const candidates: string[] = []
  const suppressed = suppressedEdges ?? new Set<string>()

  // Helper: collect user_group nodes connected FROM this node (this node → group)
  const collectGroupChildren = () => {
    for (const edge of Object.values(manualEdgesOnly)) {
      if (edge.source === nodeId) {
        const target = allNodes[edge.target]
        if (target?.type === 'user_group') candidates.push(target.id)
      }
    }
  }

  // Helper: collect structural children, excluding those whose contains edge is suppressed
  const collectStructuralChildren = () => {
    for (const n of Object.values(allNodes)) {
      if (n.parentId !== nodeId) continue
      // Check if the contains edge to this child is suppressed
      const containsEdgeId = `edge:${nodeId}->${n.id}:contains`
      if (suppressed.has(containsEdgeId)) continue
      candidates.push(n.id)
    }
  }

  switch (nodeType) {
    case 'project':
    case 'folder': {
      collectStructuralChildren()
      collectGroupChildren()
      break
    }

    case 'file': {
      for (const edge of Object.values(allEdges)) {
        if (edge.source === nodeId) {
          const target = allNodes[edge.target]
          if (target && (target.type === 'package_group' || target.type === 'hidden_connections_group')) {
            candidates.push(target.id)
          }
        }
      }
      for (const edge of Object.values(manualEdgesOnly)) {
        if (edge.source === nodeId || edge.target === nodeId) {
          const otherId = edge.source === nodeId ? edge.target : edge.source
          const other = allNodes[otherId]
          if (other?.type === 'note') candidates.push(other.id)
        }
      }
      collectStructuralChildren()
      collectGroupChildren()
      break
    }

    case 'package_group':
    case 'config_group': {
      for (const edge of Object.values(allEdges)) {
        if (edge.source === nodeId && edge.type === 'groups') {
          candidates.push(edge.target)
        }
      }
      for (const n of Object.values(allNodes)) {
        if (n.parentId === nodeId) candidates.push(n.id)
      }
      break
    }

    case 'hidden_connections_group': {
      for (const edge of Object.values(allEdges)) {
        if (edge.source === nodeId && (edge.type === 'imports' || edge.type === 'alias_import')) {
          candidates.push(edge.target)
        }
      }
      break
    }

    case 'user_group': {
      // Reveal nodes connected FROM this group (group → target via manual_link)
      for (const edge of Object.values(manualEdgesOnly)) {
        if (edge.source === nodeId) {
          const target = allNodes[edge.target]
          if (target && target.type !== 'user_group') candidates.push(target.id)
        }
      }
      // Also include group membership
      const state = useProjectStore.getState()
      const group = state.user.userGroups[nodeId]
      if (group) {
        for (const memberId of group.memberNodeIds) {
          if (allNodes[memberId]) candidates.push(memberId)
        }
      }
      break
    }

    case 'note': {
      for (const edge of Object.values(allEdges)) {
        if (edge.source === nodeId) candidates.push(edge.target)
        if (edge.target === nodeId) candidates.push(edge.source)
      }
      break
    }
  }

  return [...new Set(candidates)]
}

function collectDescendants(
  nodeId: string,
  allNodes: Record<string, { id: string; type: string; parentId?: string | null; ownerId?: string }>,
  allEdges: Record<string, { id: string; type: string; source: string; target: string }>,
  visibleNodeIds: Set<string>,
): string[] {
  const toHide: string[] = []
  const visited = new Set<string>()
  const queue = [nodeId]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)

    for (const n of Object.values(allNodes)) {
      if ((n.parentId === current || n.ownerId === current) && n.id !== nodeId) {
        if (visibleNodeIds.has(n.id)) {
          toHide.push(n.id)
          queue.push(n.id)
        }
      }
    }

    for (const edge of Object.values(allEdges)) {
      if (edge.source === current && (edge.type === 'groups' || edge.type === 'imports' || edge.type === 'alias_import')) {
        if (visibleNodeIds.has(edge.target) && edge.target !== nodeId) {
          toHide.push(edge.target)
          queue.push(edge.target)
        }
      }
      // Follow manual_link edges FROM user_group nodes (group → child)
      if (edge.source === current && edge.type === 'manual_link') {
        const currentNode = allNodes[current]
        if (currentNode?.type === 'user_group' && visibleNodeIds.has(edge.target) && edge.target !== nodeId) {
          toHide.push(edge.target)
          queue.push(edge.target)
        }
      }
      // Follow manual_link edges TO user_group nodes (parent → group)
      if (edge.source === current && edge.type === 'manual_link') {
        const target = allNodes[edge.target]
        if (target?.type === 'user_group' && visibleNodeIds.has(edge.target) && edge.target !== nodeId && !visited.has(edge.target)) {
          toHide.push(edge.target)
          queue.push(edge.target)
        }
      }
    }

    // Also traverse user_group memberNodeIds from the store
    const currentNode = allNodes[current]
    if (currentNode?.type === 'user_group') {
      const grp = useProjectStore.getState().user.userGroups[current]
      if (grp) {
        for (const memberId of grp.memberNodeIds) {
          if (allNodes[memberId] && visibleNodeIds.has(memberId) && memberId !== nodeId && !visited.has(memberId)) {
            toHide.push(memberId)
            queue.push(memberId)
          }
        }
      }
    }
  }

  return [...new Set(toHide)]
}
