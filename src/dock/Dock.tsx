import {
  Search,
  ScanLine,
  Plus,
  Link,
  Move,
  Maximize2,
  Undo2,
  Redo2,
  Settings,
  Keyboard,
  Info,
  GitBranch,
  Unlink,
  Minimize2,
  Crosshair,
  EyeOff,
  Eye,
  Filter,
  Home,
  Focus,
  FolderPlus,
  Trash2,
  RefreshCw,
} from 'lucide-react'
import { DockButton } from './DockButton'
import { useProjectStore } from '../store/useProjectStore'
import { structureScan } from '../scanner/structureScan'
import { relationshipScan } from '../scanner/relationshipScan'
import { useReactFlow } from '@xyflow/react'
import { calculateChildPositions } from '../canvas/layout'
import '../styles/dock.css'

interface DockProps {
  onSearchOpen: () => void
  onAddNode: () => void
  onConnectMode: () => void
  onSettingsOpen: () => void
  onDetailOpen: () => void
  onRevealPath: () => void
  onShortcutsOpen: () => void
  onFilterToggle: () => void
  onAddToGroup: () => void
  onToggleExpand: () => void
  onRebalance: () => void
  isNodeExpanded: boolean
  isConnecting: boolean
  isFilterOpen: boolean
}

export function Dock({
  onSearchOpen,
  onAddNode,
  onConnectMode,
  onSettingsOpen,
  onDetailOpen,
  onRevealPath,
  onShortcutsOpen,
  onFilterToggle,
  onAddToGroup,
  onToggleExpand,
  onRebalance,
  isNodeExpanded,
  isConnecting,
  isFilterOpen,
}: DockProps) {
  const isScanning = useProjectStore((s) => s.isScanning)
  const selectedNodeId = useProjectStore((s) => s.selectedNodeId)
  const canUndo = useProjectStore((s) => s.canUndo)
  const canRedo = useProjectStore((s) => s.canRedo)
  const { fitView, setCenter, getNode } = useReactFlow()

  const handleScan = async () => {
    // Read fresh from store to avoid stale closures
    const state = useProjectStore.getState()
    if (!state.adapter || state.isScanning) return

    state.setScanning(true)
    try {
      const structResult = await structureScan(state.adapter, state.meta)
      const relResult = await relationshipScan(
        state.adapter,
        structResult.nodes,
        structResult.edges,
      )

      // Store alias config in meta if found
      if (relResult.aliasConfig) {
        useProjectStore.setState((s) => ({
          meta: { ...s.meta, aliasConfig: relResult.aliasConfig ?? undefined },
        }))
      }

      state.setScanResult({
        nodes: { ...structResult.nodes, ...relResult.nodes },
        edges: { ...structResult.edges, ...relResult.edges },
        warnings: [...structResult.warnings, ...relResult.warnings],
      })
    } catch (err) {
      console.error('Scan failed:', err)
    } finally {
      useProjectStore.getState().setScanning(false)
    }
  }

  const handleFitView = () => fitView({ padding: 0.2, duration: 300 })

  const handleCenter = () => {
    if (!selectedNodeId) return
    const node = getNode(selectedNodeId)
    if (node) {
      setCenter(node.position.x + 70, node.position.y + 25, {
        zoom: 1.2,
        duration: 300,
      })
    }
  }

  const handleHide = () => {
    const state = useProjectStore.getState()
    if (!state.selectedNodeId) return
    const allNodes = state.getAllNodes()

    // Collect all visible descendants
    const toHide = [state.selectedNodeId]
    const queue = [state.selectedNodeId]
    const visited = new Set<string>()
    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current)) continue
      visited.add(current)
      for (const n of Object.values(allNodes)) {
        if (('parentId' in n && n.parentId === current) ||
            ('ownerId' in n && (n as { ownerId?: string }).ownerId === current)) {
          if (state.visibleNodeIds.has(n.id) && !visited.has(n.id)) {
            toHide.push(n.id)
            queue.push(n.id)
          }
        }
      }
    }

    // Mark the root as user-hidden (parent), descendants as hidden children
    state.setNodeOverride(state.selectedNodeId, { hidden: true, hiddenIsParent: true })
    for (const id of toHide) {
      if (id !== state.selectedNodeId) {
        state.setNodeOverride(id, { hidden: true, hiddenIsParent: false })
      }
    }

    state.hideNodes(toHide)
    state.setSelectedNode(null)
  }

  const handleCenterRoot = () => {
    const rootNode = getNode('project:root')
    if (rootNode) {
      setCenter(rootNode.position.x + 70, rootNode.position.y + 25, {
        zoom: 1.0,
        duration: 300,
      })
    }
  }

  const handleRecenterCluster = () => {
    if (!selectedNodeId) return
    // Fit view to selected node + visible descendants
    const state = useProjectStore.getState()
    const allNodes = state.getAllNodes()
    const effectiveVisible = state.getFilteredVisibleNodeIds()
    const nodeIds = [selectedNodeId]
    // Collect visible descendants
    const queue = [selectedNodeId]
    const visited = new Set<string>()
    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current)) continue
      visited.add(current)
      for (const n of Object.values(allNodes)) {
        if (('parentId' in n && n.parentId === current || 'ownerId' in n && (n as { ownerId?: string }).ownerId === current)
          && effectiveVisible.has(n.id) && !visited.has(n.id)) {
          nodeIds.push(n.id)
          queue.push(n.id)
        }
      }
    }
    fitView({ nodes: nodeIds.map((id) => ({ id })), padding: 0.3, duration: 400 })
  }

  // Compute children of selected node that were user-hidden (hidden: true)
  const hiddenChildCount = (() => {
    if (!selectedNodeId) return 0
    const state = useProjectStore.getState()
    const allNodes = state.getAllNodes()
    let count = 0
    for (const n of Object.values(allNodes)) {
      if (('parentId' in n && n.parentId === selectedNodeId) ||
          ('ownerId' in n && (n as { ownerId?: string }).ownerId === selectedNodeId)) {
        if (state.user.nodeOverrides[n.id]?.hidden) count++
      }
    }
    return count
  })()

  const handleRevealHidden = () => {
    if (!selectedNodeId) return
    const state = useProjectStore.getState()
    const allNodes = state.getAllNodes()
    // Only reveal direct children that are user-hidden — not their descendants
    const hiddenIds: string[] = []
    for (const n of Object.values(allNodes)) {
      if (('parentId' in n && n.parentId === selectedNodeId) ||
          ('ownerId' in n && (n as { ownerId?: string }).ownerId === selectedNodeId)) {
        if (state.user.nodeOverrides[n.id]?.hidden) hiddenIds.push(n.id)
      }
    }
    if (hiddenIds.length === 0) return

    state.pushUndoSnapshot()

    // Clear hidden flag and position them — reveal only these nodes, no expand
    const parentPos = state.user.nodeOverrides[selectedNodeId]?.position ?? { x: 0, y: 0 }
    const needsLayout: string[] = []
    for (const id of hiddenIds) {
      const relPos = state.user.nodeOverrides[id]?.relativePosition
      if (relPos) {
        state.setNodeOverride(id, {
          hidden: false, hiddenIsParent: undefined,
          position: { x: parentPos.x + relPos.x, y: parentPos.y + relPos.y },
        })
      } else {
        state.setNodeOverride(id, { hidden: false, hiddenIsParent: undefined })
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

    state.revealNodes(hiddenIds)
  }

  const isUserGroup = (() => {
    if (!selectedNodeId) return false
    const node = useProjectStore.getState().getNode(selectedNodeId)
    return node?.type === 'user_group'
  })()

  const handleDeleteGroup = () => {
    if (!selectedNodeId) return
    const state = useProjectStore.getState()
    state.hideNodes([selectedNodeId])
    state.setSelectedNode(null)
    state.removeUserGroup(selectedNodeId)
  }

  const filtersState = useProjectStore((s) => s.filters)
  const hasFilters = !filtersState.showFiles || !filtersState.showFolders || !filtersState.showNotes
    || filtersState.showPinnedOnly || filtersState.hideHelperNodes || filtersState.hidePackageNodes
    || filtersState.filterTags.length > 0

  return (
    <div className="dock">
      {/* Context dock */}
      {selectedNodeId && (
        <div className="dock__context">
          <DockButton icon={Info} tooltip="Details" onClick={onDetailOpen} />
          <DockButton
            icon={GitBranch}
            tooltip="Reveal Path"
            onClick={onRevealPath}
          />
          <DockButton
            icon={Unlink}
            tooltip="Add Connection"
            onClick={onConnectMode}
            emphasized
          />
          <DockButton
            icon={FolderPlus}
            tooltip="Add to Group"
            onClick={onAddToGroup}
          />
          <div className="dock__divider" />
          <DockButton
            icon={isNodeExpanded ? Minimize2 : Maximize2}
            tooltip={isNodeExpanded ? 'Collapse' : 'Expand'}
            onClick={onToggleExpand}
          />
          <DockButton
            icon={RefreshCw}
            tooltip="Rebalance"
            onClick={onRebalance}
          />
          <DockButton
            icon={Crosshair}
            tooltip="Center"
            onClick={handleCenter}
          />
          <DockButton
            icon={Focus}
            tooltip="Recenter Cluster"
            onClick={handleRecenterCluster}
          />
          <DockButton icon={EyeOff} tooltip="Hide" onClick={handleHide} />
          {isUserGroup && (
            <DockButton icon={Trash2} tooltip="Delete Group" onClick={handleDeleteGroup} />
          )}
          {hiddenChildCount > 0 && (
            <DockButton
              icon={Eye}
              tooltip={`Reveal Hidden (${hiddenChildCount})`}
              onClick={handleRevealHidden}
            />
          )}
        </div>
      )}

      {/* Base dock */}
      <div className="dock__bar">
        <DockButton icon={Search} tooltip="Search" onClick={onSearchOpen} />
        <DockButton
          icon={ScanLine}
          tooltip="Scan"
          onClick={handleScan}
          disabled={isScanning}
          className={isScanning ? 'scanning' : ''}
        />

        <div className="dock__divider" />

        <DockButton icon={Plus} tooltip="Add" onClick={onAddNode} />
        <DockButton
          icon={Link}
          tooltip="Connect"
          onClick={onConnectMode}
          active={isConnecting}
        />
        <DockButton icon={Move} tooltip="Pan" onClick={() => {}} />
        <DockButton
          icon={Maximize2}
          tooltip="Fit View"
          onClick={handleFitView}
        />
        <DockButton
          icon={Home}
          tooltip="Center Root"
          onClick={handleCenterRoot}
        />

        <div className="dock__divider" />

        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <DockButton
            icon={Filter}
            tooltip="Filters"
            onClick={onFilterToggle}
            active={isFilterOpen}
          />
          {hasFilters && <span className="filter-active-badge" />}
        </div>

        <div className="dock__divider" />

        <DockButton
          icon={Undo2}
          tooltip="Undo"
          onClick={() => useProjectStore.getState().undo()}
          disabled={!canUndo}
        />
        <DockButton
          icon={Redo2}
          tooltip="Redo"
          onClick={() => useProjectStore.getState().redo()}
          disabled={!canRedo}
        />
        <DockButton
          icon={Keyboard}
          tooltip="Shortcuts"
          onClick={onShortcutsOpen}
        />
        <DockButton
          icon={Settings}
          tooltip="Settings"
          onClick={onSettingsOpen}
        />
      </div>
    </div>
  )
}
