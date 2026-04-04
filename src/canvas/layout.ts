/**
 * Layout calculation for node reveal with auto-adjust.
 */

const H_GAP = 280
const V_GAP = 70
const NODE_HEIGHT = 52
const HELPER_H_OFFSET = 200
const HELPER_V_OFFSET_PKG = 40
const HELPER_V_OFFSET_HCG = -40

export interface LayoutPosition {
  nodeId: string
  x: number
  y: number
}

/**
 * Calculate positions for children being revealed from a parent.
 */
export function calculateChildPositions(
  parentPosition: { x: number; y: number },
  childIds: string[],
  nodeTypeMap: Map<string, string>,
): LayoutPosition[] {
  const results: LayoutPosition[] = []

  const regularChildren: string[] = []
  const helpers: string[] = []

  for (const id of childIds) {
    const type = nodeTypeMap.get(id)
    if (type === 'package_group' || type === 'hidden_connections_group' || type === 'config_group') {
      helpers.push(id)
    } else {
      regularChildren.push(id)
    }
  }

  const count = regularChildren.length
  if (count > 0) {
    const totalHeight = (count - 1) * V_GAP
    const startY = parentPosition.y - totalHeight / 2

    for (let i = 0; i < count; i++) {
      results.push({
        nodeId: regularChildren[i]!,
        x: parentPosition.x + H_GAP,
        y: startY + i * V_GAP,
      })
    }
  }

  for (const helperId of helpers) {
    const type = nodeTypeMap.get(helperId)
    const vOffset =
      type === 'package_group' ? HELPER_V_OFFSET_PKG : HELPER_V_OFFSET_HCG

    results.push({
      nodeId: helperId,
      x: parentPosition.x + HELPER_H_OFFSET,
      y:
        parentPosition.y +
        vOffset +
        (count > 0 ? (count * V_GAP) / 2 + 30 : 0),
    })
  }

  return results
}

/**
 * After revealing/collapsing children of a node, adjust sibling positions
 * so subtrees don't overlap.
 *
 * Uses the actual Y-extent (min/max Y) of each sibling's visible subtree
 * rather than estimating from descendant counts.
 */
export function adjustSiblingPositions(
  expandedNodeId: string,
  _newChildCount: number,
  allNodes: Record<string, { id: string; type: string; parentId?: string | null; ownerId?: string }>,
  visibleNodeIds: Set<string>,
  nodePositions: Record<string, { x: number; y: number } | undefined>,
): LayoutPosition[] {
  const expandedNode = allNodes[expandedNodeId]
  if (!expandedNode) return []
  const parentId = expandedNode.parentId
  if (!parentId) return []

  // Find all visible siblings (same parent, non-helper)
  const siblings: string[] = []
  for (const n of Object.values(allNodes)) {
    if (
      n.parentId === parentId &&
      visibleNodeIds.has(n.id) &&
      n.type !== 'package_group' &&
      n.type !== 'hidden_connections_group' &&
      n.type !== 'config_group'
    ) {
      siblings.push(n.id)
    }
  }

  if (siblings.length <= 1) return []

  // Sort siblings by their current Y position
  siblings.sort((a, b) => {
    const ay = nodePositions[a]?.y ?? 0
    const by = nodePositions[b]?.y ?? 0
    return ay - by
  })

  // For each sibling, compute the actual vertical extent of its subtree
  // (the height from its topmost visible descendant to its bottommost)
  // Also compute topOffset: distance from the sibling node to the top of its subtree
  const siblingExtents = new Map<string, { height: number; topOffset: number }>()
  for (const sibId of siblings) {
    const extent = getSubtreeExtent(sibId, allNodes, visibleNodeIds, nodePositions)
    siblingExtents.set(sibId, extent)
  }

  // Re-distribute siblings vertically, centered around the parent
  const parentPos = nodePositions[parentId]
  const centerY = parentPos?.y ?? 0
  const SIBLING_GAP = 40 // gap between sibling subtrees

  let totalHeight = 0
  for (const sibId of siblings) {
    totalHeight += siblingExtents.get(sibId)!.height
  }
  totalHeight += (siblings.length - 1) * SIBLING_GAP

  const adjustments: LayoutPosition[] = []
  let currentY = centerY - totalHeight / 2

  for (const sibId of siblings) {
    const ext = siblingExtents.get(sibId)!
    // Position the sibling so its subtree fits exactly within the allocated slot.
    // topOffset = how far below the subtree top the sibling node sits.
    // This prevents children from spilling above the slot into another sibling's space.
    const newY = currentY + ext.topOffset
    const oldPos = nodePositions[sibId]
    const oldY = oldPos?.y ?? 0
    const oldX = oldPos?.x ?? 0
    const deltaY = newY - oldY

    if (Math.abs(deltaY) > 2) {
      adjustments.push({ nodeId: sibId, x: oldX, y: newY })

      // Shift all descendants by the same delta
      const descShifts = shiftDescendants(sibId, deltaY, allNodes, visibleNodeIds, nodePositions)
      adjustments.push(...descShifts)
    }

    currentY += ext.height + SIBLING_GAP
  }

  return adjustments
}

/**
 * Compute the vertical extent (height) of a node's visible subtree.
 * Returns at least NODE_HEIGHT for a leaf node.
 *
 * Also returns topOffset: the distance from the top of the subtree to the node itself.
 * This is needed so the sibling layout can position the node correctly within its
 * allocated slot (children may extend asymmetrically above/below the node).
 */
function getSubtreeExtent(
  nodeId: string,
  allNodes: Record<string, { id: string; parentId?: string | null; ownerId?: string }>,
  visibleNodeIds: Set<string>,
  nodePositions: Record<string, { x: number; y: number } | undefined>,
): { height: number; topOffset: number } {
  // Collect the Y positions of this node and all its visible descendants
  const ys: number[] = []
  const nodeY = nodePositions[nodeId]?.y ?? 0
  ys.push(nodeY)

  const visited = new Set<string>()
  const queue = [nodeId]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)

    for (const n of Object.values(allNodes)) {
      if (
        (n.parentId === current || n.ownerId === current) &&
        n.id !== nodeId &&
        visibleNodeIds.has(n.id) &&
        !visited.has(n.id)
      ) {
        const y = nodePositions[n.id]?.y ?? 0
        ys.push(y)
        queue.push(n.id)
      }
    }
  }

  if (ys.length <= 1) return { height: NODE_HEIGHT, topOffset: 0 }

  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return {
    height: Math.max(NODE_HEIGHT, maxY - minY + NODE_HEIGHT),
    topOffset: nodeY - minY,
  }
}

/**
 * Shift all visible descendants of a node by a vertical delta.
 */
function shiftDescendants(
  nodeId: string,
  deltaY: number,
  allNodes: Record<string, { id: string; parentId?: string | null; ownerId?: string }>,
  visibleNodeIds: Set<string>,
  nodePositions: Record<string, { x: number; y: number } | undefined>,
): LayoutPosition[] {
  const shifts: LayoutPosition[] = []
  const visited = new Set<string>()
  const queue = [nodeId]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)

    for (const n of Object.values(allNodes)) {
      if (
        (n.parentId === current || n.ownerId === current) &&
        n.id !== nodeId &&
        visibleNodeIds.has(n.id) &&
        !visited.has(n.id)
      ) {
        const pos = nodePositions[n.id]
        shifts.push({
          nodeId: n.id,
          x: pos?.x ?? 0,
          y: (pos?.y ?? 0) + deltaY,
        })
        queue.push(n.id)
      }
    }
  }

  return shifts
}

/**
 * After a node is moved (drag or reorder), resolve any overlapping
 * with ALL other visible nodes. Pushes overlapping nodes down.
 *
 * Returns position adjustments for any nodes that need to move.
 */
const COLLISION_MIN_GAP = 20

export function resolveCollisions(
  movedNodeId: string,
  allNodes: Record<string, { id: string; parentId?: string | null; ownerId?: string }>,
  visibleNodeIds: Set<string>,
  nodePositions: Record<string, { x: number; y: number } | undefined>,
): LayoutPosition[] {
  const allAdjustments: LayoutPosition[] = []
  // Work on a mutable copy of positions so cascading checks see updated values
  const workingPositions: Record<string, { x: number; y: number } | undefined> = { ...nodePositions }

  const MAX_ITERATIONS = 10
  // Start by checking the moved node; subsequent iterations check pushed nodes
  let nodesToCheck = [movedNodeId]

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const iterAdjustments: LayoutPosition[] = []
    const nextNodesToCheck: string[] = []
    const alreadyAdjusted = new Set(allAdjustments.map((a) => a.nodeId))

    for (const checkId of nodesToCheck) {
      const checkPos = workingPositions[checkId]
      if (!checkPos) continue

      for (const id of visibleNodeIds) {
        if (id === checkId || alreadyAdjusted.has(id)) continue
        const pos = workingPositions[id]
        if (!pos) continue
        if (Math.abs(pos.x - checkPos.x) >= APPROX_NODE_W) continue

        const overlap = isOverlapping(checkPos, pos)
        if (overlap > 0) {
          const direction = pos.y >= checkPos.y ? 1 : -1
          const newY = pos.y + direction * (overlap + COLLISION_MIN_GAP)
          const deltaY = newY - pos.y

          iterAdjustments.push({ nodeId: id, x: pos.x, y: newY })
          workingPositions[id] = { x: pos.x, y: newY }
          nextNodesToCheck.push(id)

          // Also shift descendants
          const descShifts = shiftDescendants(id, deltaY, allNodes, visibleNodeIds, workingPositions)
          for (const ds of descShifts) {
            iterAdjustments.push(ds)
            workingPositions[ds.nodeId] = { x: ds.x, y: ds.y }
          }
        }
      }
    }

    if (iterAdjustments.length === 0) break
    allAdjustments.push(...iterAdjustments)
    nodesToCheck = nextNodesToCheck
  }

  return allAdjustments
}

const APPROX_NODE_W = 200
const APPROX_NODE_H = 55

function isOverlapping(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const aTop = a.y
  const aBottom = a.y + APPROX_NODE_H
  const bTop = b.y
  const bBottom = b.y + APPROX_NODE_H

  // Vertical overlap amount
  const overlapY = Math.min(aBottom, bBottom) - Math.max(aTop, bTop)
  if (overlapY <= 0) return 0

  // Also check horizontal overlap
  const aRight = a.x + APPROX_NODE_W
  const bRight = b.x + APPROX_NODE_W
  const overlapX = Math.min(aRight, bRight) - Math.max(a.x, b.x)
  if (overlapX <= 0) return 0

  return overlapY
}
