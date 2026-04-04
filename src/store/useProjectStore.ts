import { create } from 'zustand'
import type {
  ProjectMapSchema,
  ProjectMeta,
  ScannedData,
  UserData,
  ProjectNode,
  ProjectEdge,
  ManualNode,
  ManualEdge,
  NodeOverride,
  FilterState,
  UserGroup,
} from '../types'
import { createEmptyProjectMap, DEFAULT_FILTERS } from '../types'
import type { FsAdapter } from '../persistence/fsAdapter'
import { loadProjectMap, saveProjectMap } from '../persistence/projectMapStore'

interface ProjectStore {
  // ─── State ───
  adapter: FsAdapter | null
  projectName: string
  isProjectOpen: boolean
  isScanning: boolean
  meta: ProjectMeta
  scanned: ScannedData
  user: UserData
  visibleNodeIds: Set<string>
  selectedNodeId: string | null
  draftNodeId: string | null

  /** Increments on structural changes (scan, reveal, collapse, add/remove).
   *  Does NOT increment on position/selection changes. */
  structureVersion: number

  /** Helper nodes (Other connections, Packages, Config) that have been
   *  explicitly expanded by clicking them. Edges from these only show
   *  when they're in this set — NOT inferred from target visibility. */
  expandedHelperIds: Set<string>

  /** V2: Active filter configuration */
  filters: FilterState

  // ─── Undo/Redo ───
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean

  // ─── Actions ───
  pushUndoSnapshot: () => void
  openProject: (adapter: FsAdapter) => void
  closeProject: () => void
  setScanResult: (scanned: ScannedData) => void
  setScanning: (scanning: boolean) => void

  revealNodes: (nodeIds: string[]) => void
  hideNodes: (nodeIds: string[]) => void
  setSelectedNode: (nodeId: string | null) => void
  expandHelper: (helperId: string) => void
  collapseHelper: (helperId: string) => void

  setNodeOverride: (nodeId: string, override: Partial<NodeOverride>) => void
  addManualNode: (node: ManualNode) => void
  removeManualNode: (nodeId: string) => void
  addManualEdge: (edge: ManualEdge) => void
  removeManualEdge: (edgeId: string) => void
  setDraftNode: (nodeId: string | null) => void
  reorderChild: (parentId: string, childId: string, direction: 'up' | 'down') => void

  setViewport: (viewport: { x: number; y: number; zoom: number }) => void

  // V2: Filters
  setFilters: (updates: Partial<FilterState>) => void
  resetFilters: () => void

  // V2: Tags & Pins
  toggleNodePin: (nodeId: string) => void
  addNodeTag: (nodeId: string, tag: string) => void
  removeNodeTag: (nodeId: string, tag: string) => void

  // V2: User Groups
  addUserGroup: (group: UserGroup) => void
  removeUserGroup: (groupId: string) => void
  updateUserGroup: (groupId: string, updates: Partial<UserGroup>) => void
  addNodeToGroup: (nodeId: string, groupId: string) => void
  removeNodeFromGroup: (nodeId: string, groupId: string) => void

  // V2: Edge suppression
  suppressEdge: (edgeId: string) => void
  restoreEdge: (edgeId: string) => void

  // V2: Computed
  getFilteredVisibleNodeIds: () => Set<string>
  getAllTags: () => string[]

  save: () => void

  getAllNodes: () => Record<string, ProjectNode | ManualNode>
  getAllEdges: () => Record<string, ProjectEdge | ManualEdge>
  getNode: (id: string) => ProjectNode | ManualNode | undefined
}

const EMPTY = createEmptyProjectMap('', '')

let saveTimeout: ReturnType<typeof setTimeout> | null = null

function debouncedSave(store: ProjectStore) {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    store.save()
  }, 2000)
}

// ─── Undo/Redo snapshot system ───

interface Snapshot {
  visibleNodeIds: string[]
  expandedHelperIds: string[]
  nodeOverrides: Record<string, NodeOverride>
  manualNodes: Record<string, ManualNode>
  manualEdges: Record<string, ManualEdge>
  childOrder: Record<string, string[]>
  userGroups: Record<string, UserGroup>
  suppressedEdges: string[]
}

const MAX_UNDO = 50
const undoStack: Snapshot[] = []
const redoStack: Snapshot[] = []

function takeSnapshot(state: ProjectStore): Snapshot {
  return {
    visibleNodeIds: Array.from(state.visibleNodeIds),
    expandedHelperIds: Array.from(state.expandedHelperIds),
    nodeOverrides: JSON.parse(JSON.stringify(state.user.nodeOverrides)),
    manualNodes: JSON.parse(JSON.stringify(state.user.manualNodes)),
    manualEdges: JSON.parse(JSON.stringify(state.user.manualEdges)),
    childOrder: JSON.parse(JSON.stringify(state.user.childOrder ?? {})),
    userGroups: JSON.parse(JSON.stringify(state.user.userGroups ?? {})),
    suppressedEdges: [...(state.user.suppressedEdges ?? [])],
  }
}

function pushUndo(state: ProjectStore) {
  undoStack.push(takeSnapshot(state))
  if (undoStack.length > MAX_UNDO) undoStack.shift()
  // Clear redo on new action
  redoStack.length = 0
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  adapter: null,
  projectName: '',
  isProjectOpen: false,
  isScanning: false,
  meta: EMPTY.meta,
  scanned: EMPTY.scanned,
  user: EMPTY.user,
  visibleNodeIds: new Set<string>(),
  selectedNodeId: null,
  draftNodeId: null,
  structureVersion: 0,
  expandedHelperIds: new Set<string>(),
  filters: { ...DEFAULT_FILTERS },
  canUndo: false,
  canRedo: false,

  undo: () => {
    if (undoStack.length === 0) return
    const state = get()
    // Push current state to redo
    redoStack.push(takeSnapshot(state))
    // Pop from undo
    const snapshot = undoStack.pop()!
    set((s) => ({
      visibleNodeIds: new Set(snapshot.visibleNodeIds),
      expandedHelperIds: new Set(snapshot.expandedHelperIds),
      user: {
        ...s.user,
        nodeOverrides: snapshot.nodeOverrides,
        manualNodes: snapshot.manualNodes,
        manualEdges: snapshot.manualEdges,
        childOrder: snapshot.childOrder,
        userGroups: snapshot.userGroups,
        suppressedEdges: snapshot.suppressedEdges,
      },
      structureVersion: s.structureVersion + 1,
      canUndo: undoStack.length > 0,
      canRedo: true,
    }))
    debouncedSave(get())
  },

  redo: () => {
    if (redoStack.length === 0) return
    const state = get()
    // Push current state to undo
    undoStack.push(takeSnapshot(state))
    // Pop from redo
    const snapshot = redoStack.pop()!
    set((s) => ({
      visibleNodeIds: new Set(snapshot.visibleNodeIds),
      expandedHelperIds: new Set(snapshot.expandedHelperIds),
      user: {
        ...s.user,
        nodeOverrides: snapshot.nodeOverrides,
        manualNodes: snapshot.manualNodes,
        manualEdges: snapshot.manualEdges,
        childOrder: snapshot.childOrder,
        userGroups: snapshot.userGroups,
        suppressedEdges: snapshot.suppressedEdges,
      },
      structureVersion: s.structureVersion + 1,
      canUndo: true,
      canRedo: redoStack.length > 0,
    }))
    debouncedSave(get())
  },

  openProject: (adapter: FsAdapter) => {
    const name = adapter.getProjectName()
    const data = loadProjectMap(name)
    const visibleIds = new Set(data.user.uiState.visibleNodeIds)

    if (visibleIds.size === 0 && data.scanned.nodes['project:root']) {
      visibleIds.add('project:root')
    }

    set((s) => ({
      adapter,
      projectName: name,
      isProjectOpen: true,
      meta: data.meta,
      scanned: data.scanned,
      user: data.user,
      visibleNodeIds: visibleIds,
      selectedNodeId: data.user.uiState.selectedNodeId,
      filters: data.user.uiState.filters ?? { ...DEFAULT_FILTERS },
      structureVersion: s.structureVersion + 1,
    }))
  },

  closeProject: () => {
    const state = get()
    if (state.isProjectOpen && state.projectName) state.save()
    set((s) => ({
      adapter: null,
      projectName: '',
      isProjectOpen: false,
      meta: EMPTY.meta,
      scanned: EMPTY.scanned,
      user: EMPTY.user,
      visibleNodeIds: new Set(),
      selectedNodeId: null,
      draftNodeId: null,
      structureVersion: s.structureVersion + 1,
    }))
  },

  setScanResult: (scanned: ScannedData) => {
    const state = get()
    const visibleIds = new Set(state.visibleNodeIds)
    if (scanned.nodes['project:root'] && visibleIds.size === 0) {
      visibleIds.add('project:root')
    }
    set((s) => ({
      scanned,
      visibleNodeIds: visibleIds,
      meta: { ...state.meta, lastScanAt: new Date().toISOString() },
      structureVersion: s.structureVersion + 1,
    }))
    debouncedSave(get())
  },

  setScanning: (scanning: boolean) => set({ isScanning: scanning }),

  pushUndoSnapshot: () => {
    pushUndo(get())
  },

  revealNodes: (nodeIds: string[]) => {
    const current = get().visibleNodeIds
    const next = new Set(current)
    for (const id of nodeIds) next.add(id)
    set((s) => ({ visibleNodeIds: next, structureVersion: s.structureVersion + 1, canUndo: true, canRedo: false }))
    debouncedSave(get())
  },

  hideNodes: (nodeIds: string[]) => {

    const current = get().visibleNodeIds
    const next = new Set(current)
    for (const id of nodeIds) next.delete(id)
    const state = get()
    const updates: Partial<ProjectStore> = { visibleNodeIds: next }
    if (state.selectedNodeId && nodeIds.includes(state.selectedNodeId)) {
      updates.selectedNodeId = null
    }
    set((s) => ({ ...updates, structureVersion: s.structureVersion + 1, canUndo: true, canRedo: false }))
    debouncedSave(get())
  },

  setSelectedNode: (nodeId: string | null) => set({ selectedNodeId: nodeId }),

  expandHelper: (helperId: string) => {
    const next = new Set(get().expandedHelperIds)
    next.add(helperId)
    set((s) => ({ expandedHelperIds: next, structureVersion: s.structureVersion + 1 }))
  },

  collapseHelper: (helperId: string) => {
    const next = new Set(get().expandedHelperIds)
    next.delete(helperId)
    set((s) => ({ expandedHelperIds: next, structureVersion: s.structureVersion + 1 }))
  },

  setNodeOverride: (nodeId: string, override: Partial<NodeOverride>) => {
    const state = get()
    const existing = state.user.nodeOverrides[nodeId] ?? {}
    set({
      user: {
        ...state.user,
        nodeOverrides: {
          ...state.user.nodeOverrides,
          [nodeId]: { ...existing, ...override },
        },
      },
    })
    debouncedSave(get())
  },

  addManualNode: (node: ManualNode) => {

    const state = get()
    set((s) => ({
      user: { ...state.user, manualNodes: { ...state.user.manualNodes, [node.id]: node } },
      structureVersion: s.structureVersion + 1, canUndo: true, canRedo: false,
    }))
    debouncedSave(get())
  },

  removeManualNode: (nodeId: string) => {

    const state = get()
    const { [nodeId]: _, ...rest } = state.user.manualNodes
    set((s) => ({
      user: { ...state.user, manualNodes: rest },
      structureVersion: s.structureVersion + 1, canUndo: true, canRedo: false,
    }))
    debouncedSave(get())
  },

  addManualEdge: (edge: ManualEdge) => {

    const state = get()
    set((s) => ({
      user: { ...state.user, manualEdges: { ...state.user.manualEdges, [edge.id]: edge } },
      structureVersion: s.structureVersion + 1, canUndo: true, canRedo: false,
    }))
    debouncedSave(get())
  },

  removeManualEdge: (edgeId: string) => {

    const state = get()
    const { [edgeId]: _, ...rest } = state.user.manualEdges
    set((s) => ({
      user: { ...state.user, manualEdges: rest },
      structureVersion: s.structureVersion + 1, canUndo: true, canRedo: false,
    }))
    debouncedSave(get())
  },

  setDraftNode: (nodeId: string | null) => set({ draftNodeId: nodeId }),

  reorderChild: (parentId: string, childId: string, direction: 'up' | 'down') => {

    const state = get()
    const allNodes = state.getAllNodes()

    let order = state.user.childOrder?.[parentId]
    if (!order) {
      order = Object.values(allNodes)
        .filter((n) => 'parentId' in n && n.parentId === parentId && state.visibleNodeIds.has(n.id))
        .sort((a, b) => {
          const ay = state.user.nodeOverrides[a.id]?.position?.y ?? 0
          const by = state.user.nodeOverrides[b.id]?.position?.y ?? 0
          return ay - by
        })
        .map((n) => n.id)
    }

    const idx = order.indexOf(childId)
    if (idx === -1) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= order.length) return

    const newOrder = [...order]
    const swapId = newOrder[swapIdx]!
    newOrder[swapIdx] = childId
    newOrder[idx] = swapId

    const overrides = { ...state.user.nodeOverrides }
    const posA = overrides[childId]?.position
    const posB = overrides[swapId]?.position
    if (posA && posB) {
      const deltaY = posB.y - posA.y

      // Move node A to B's Y, and B to A's Y, save relative positions
      const parentPos = overrides[parentId]?.position ?? { x: 0, y: 0 }
      overrides[childId] = {
        ...overrides[childId],
        position: { x: posA.x, y: posB.y },
        relativePosition: { x: posA.x - parentPos.x, y: posB.y - parentPos.y },
      }
      overrides[swapId] = {
        ...overrides[swapId],
        position: { x: posB.x, y: posA.y },
        relativePosition: { x: posB.x - parentPos.x, y: posA.y - parentPos.y },
      }

      // Collect all visible descendants of A and shift them by deltaY
      const descA = collectAllDescendants(childId, allNodes, state.visibleNodeIds)
      for (const dId of descA) {
        const dPos = overrides[dId]?.position
        if (dPos) {
          overrides[dId] = { ...overrides[dId], position: { x: dPos.x, y: dPos.y + deltaY } }
        }
      }

      // Collect all visible descendants of B and shift them by -deltaY
      const descB = collectAllDescendants(swapId, allNodes, state.visibleNodeIds)
      for (const dId of descB) {
        const dPos = overrides[dId]?.position
        if (dPos) {
          overrides[dId] = { ...overrides[dId], position: { x: dPos.x, y: dPos.y - deltaY } }
        }
      }
    }

    set((s) => ({
      user: {
        ...s.user,
        nodeOverrides: overrides,
        childOrder: { ...(s.user.childOrder ?? {}), [parentId]: newOrder },
      },
      structureVersion: s.structureVersion + 1, canUndo: true, canRedo: false,
    }))
    debouncedSave(get())
  },

  setViewport: (viewport) => {
    const state = get()
    set({ user: { ...state.user, uiState: { ...state.user.uiState, viewport } } })
  },

  // ─── V2: Filters ───

  setFilters: (updates) => {
    set((s) => ({
      filters: { ...s.filters, ...updates },
      structureVersion: s.structureVersion + 1,
    }))
    debouncedSave(get())
  },

  resetFilters: () => {
    set((s) => ({
      filters: { ...DEFAULT_FILTERS },
      structureVersion: s.structureVersion + 1,
    }))
    debouncedSave(get())
  },

  // ─── V2: Tags & Pins ───

  toggleNodePin: (nodeId) => {
    const state = get()
    const existing = state.user.nodeOverrides[nodeId] ?? {}
    set({
      user: {
        ...state.user,
        nodeOverrides: {
          ...state.user.nodeOverrides,
          [nodeId]: { ...existing, pinned: !existing.pinned },
        },
      },
    })
    debouncedSave(get())
  },

  addNodeTag: (nodeId, tag) => {
    const state = get()
    const existing = state.user.nodeOverrides[nodeId] ?? {}
    const currentTags = existing.tags ?? []
    if (currentTags.includes(tag)) return
    set({
      user: {
        ...state.user,
        nodeOverrides: {
          ...state.user.nodeOverrides,
          [nodeId]: { ...existing, tags: [...currentTags, tag] },
        },
      },
    })
    debouncedSave(get())
  },

  removeNodeTag: (nodeId, tag) => {
    const state = get()
    const existing = state.user.nodeOverrides[nodeId] ?? {}
    const currentTags = existing.tags ?? []
    set({
      user: {
        ...state.user,
        nodeOverrides: {
          ...state.user.nodeOverrides,
          [nodeId]: { ...existing, tags: currentTags.filter((t) => t !== tag) },
        },
      },
    })
    debouncedSave(get())
  },

  // ─── V2: User Groups ───

  addUserGroup: (group) => {
    const state = get()
    pushUndo(state)
    // Also create a ManualNode so it renders on canvas
    const groupNode: ManualNode = {
      id: group.id,
      type: 'user_group',
      name: group.name,
      description: group.description,
      color: group.color,
    }
    set((s) => ({
      user: {
        ...state.user,
        userGroups: { ...state.user.userGroups, [group.id]: group },
        manualNodes: { ...state.user.manualNodes, [group.id]: groupNode },
      },
      structureVersion: s.structureVersion + 1,
      canUndo: true,
      canRedo: false,
    }))
    debouncedSave(get())
  },

  removeUserGroup: (groupId) => {
    const state = get()
    pushUndo(state)
    const { [groupId]: _, ...restGroups } = state.user.userGroups
    const { [groupId]: __, ...restNodes } = state.user.manualNodes
    set((s) => ({
      user: {
        ...state.user,
        userGroups: restGroups,
        manualNodes: restNodes,
      },
      structureVersion: s.structureVersion + 1,
      canUndo: true,
      canRedo: false,
    }))
    debouncedSave(get())
  },

  updateUserGroup: (groupId, updates) => {
    const state = get()
    const existing = state.user.userGroups[groupId]
    if (!existing) return
    const updated = { ...existing, ...updates }
    // Also update the ManualNode
    const existingNode = state.user.manualNodes[groupId]
    const updatedNode = existingNode
      ? { ...existingNode, name: updated.name, description: updated.description, color: updated.color }
      : undefined
    set((s) => ({
      user: {
        ...state.user,
        userGroups: { ...state.user.userGroups, [groupId]: updated },
        ...(updatedNode ? { manualNodes: { ...state.user.manualNodes, [groupId]: updatedNode } } : {}),
      },
      structureVersion: s.structureVersion + 1,
    }))
    debouncedSave(get())
  },

  addNodeToGroup: (nodeId, groupId) => {
    const state = get()
    const group = state.user.userGroups[groupId]
    if (!group || group.memberNodeIds.includes(nodeId)) return
    pushUndo(state)
    set((s) => ({
      user: {
        ...state.user,
        userGroups: {
          ...state.user.userGroups,
          [groupId]: { ...group, memberNodeIds: [...group.memberNodeIds, nodeId] },
        },
      },
      structureVersion: s.structureVersion + 1,
      canUndo: true,
      canRedo: false,
    }))
    debouncedSave(get())
  },

  removeNodeFromGroup: (nodeId, groupId) => {
    const state = get()
    const group = state.user.userGroups[groupId]
    if (!group) return
    pushUndo(state)
    set((s) => ({
      user: {
        ...state.user,
        userGroups: {
          ...state.user.userGroups,
          [groupId]: { ...group, memberNodeIds: group.memberNodeIds.filter((id) => id !== nodeId) },
        },
      },
      structureVersion: s.structureVersion + 1,
      canUndo: true,
      canRedo: false,
    }))
    debouncedSave(get())
  },

  // ─── V2: Computed ───

  getFilteredVisibleNodeIds: () => {
    const state = get()
    const { filters } = state
    const allNodes = state.getAllNodes()
    const result = new Set<string>()
    const helperTypes = new Set(['hidden_connections_group', 'package_group', 'config_group'])

    for (const id of state.visibleNodeIds) {
      const node = allNodes[id]
      if (!node) continue

      if (!filters.showFiles && node.type === 'file') continue
      if (!filters.showFolders && node.type === 'folder') continue
      if (!filters.showNotes && node.type === 'note') continue
      if (filters.hideHelperNodes && helperTypes.has(node.type)) continue
      if (filters.hidePackageNodes && node.type === 'package') continue

      if (filters.showPinnedOnly) {
        const override = state.user.nodeOverrides[id]
        if (!override?.pinned) continue
      }

      if (filters.filterTags.length > 0) {
        const override = state.user.nodeOverrides[id]
        const nodeTags = override?.tags ?? []
        if (!filters.filterTags.some((t) => nodeTags.includes(t))) continue
      }

      result.add(id)
    }

    return result
  },

  getAllTags: () => {
    const state = get()
    const tagSet = new Set<string>()
    for (const override of Object.values(state.user.nodeOverrides)) {
      if (override.tags) {
        for (const tag of override.tags) tagSet.add(tag)
      }
    }
    return Array.from(tagSet).sort()
  },

  // ─── V2: Edge suppression ───

  suppressEdge: (edgeId) => {
    const state = get()
    if (state.user.suppressedEdges.includes(edgeId)) return
    pushUndo(state)
    set((s) => ({
      user: {
        ...s.user,
        suppressedEdges: [...s.user.suppressedEdges, edgeId],
      },
      structureVersion: s.structureVersion + 1,
      canUndo: true,
      canRedo: false,
    }))
    debouncedSave(get())
  },

  restoreEdge: (edgeId) => {
    const state = get()
    if (!state.user.suppressedEdges.includes(edgeId)) return
    pushUndo(state)
    set((s) => ({
      user: {
        ...s.user,
        suppressedEdges: s.user.suppressedEdges.filter((id) => id !== edgeId),
      },
      structureVersion: s.structureVersion + 1,
      canUndo: true,
      canRedo: false,
    }))
    debouncedSave(get())
  },

  save: () => {
    const state = get()
    if (!state.isProjectOpen || !state.projectName) return
    const schema: ProjectMapSchema = {
      meta: state.meta,
      scanned: state.scanned,
      user: {
        ...state.user,
        uiState: {
          ...state.user.uiState,
          selectedNodeId: state.selectedNodeId,
          visibleNodeIds: Array.from(state.visibleNodeIds),
          filters: state.filters,
        },
      },
    }
    saveProjectMap(state.projectName, schema)
  },

  getAllNodes: () => {
    const state = get()
    return { ...state.scanned.nodes, ...state.user.manualNodes } as Record<string, ProjectNode | ManualNode>
  },

  getAllEdges: () => {
    const state = get()
    return { ...state.scanned.edges, ...state.user.manualEdges } as Record<string, ProjectEdge | ManualEdge>
  },

  getNode: (id: string) => {
    const state = get()
    return state.scanned.nodes[id] ?? state.user.manualNodes[id]
  },
}))

/**
 * Recursively collect all visible descendants of a node (children, grandchildren, etc.)
 */
function collectAllDescendants(
  nodeId: string,
  allNodes: Record<string, { id: string; parentId?: string | null; ownerId?: string }>,
  visibleNodeIds: Set<string>,
): string[] {
  const result: string[] = []
  const visited = new Set<string>()
  const queue = [nodeId]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)

    for (const n of Object.values(allNodes)) {
      if (n.id !== nodeId && (n.parentId === current || n.ownerId === current) && visibleNodeIds.has(n.id)) {
        if (!visited.has(n.id)) {
          result.push(n.id)
          queue.push(n.id)
        }
      }
    }
  }
  return result
}
