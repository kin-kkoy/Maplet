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
} from 'lucide-react'
import { DockButton } from './DockButton'
import { useProjectStore } from '../store/useProjectStore'
import { structureScan } from '../scanner/structureScan'
import { relationshipScan } from '../scanner/relationshipScan'
import { useReactFlow } from '@xyflow/react'
import '../styles/dock.css'

interface DockProps {
  onSearchOpen: () => void
  onAddNode: () => void
  onConnectMode: () => void
  onSettingsOpen: () => void
  onDetailOpen: () => void
  onRevealPath: () => void
  onShortcutsOpen: () => void
  isConnecting: boolean
}

export function Dock({
  onSearchOpen,
  onAddNode,
  onConnectMode,
  onSettingsOpen,
  onDetailOpen,
  onRevealPath,
  onShortcutsOpen,
  isConnecting,
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

  const handleCollapse = () => {
    const state = useProjectStore.getState()
    if (!state.selectedNodeId) return
    const allNodes = state.getAllNodes()
    const toHide: string[] = []
    for (const n of Object.values(allNodes)) {
      if ('parentId' in n && n.parentId === state.selectedNodeId) {
        toHide.push(n.id)
      }
      if ('ownerId' in n && n.ownerId === state.selectedNodeId) {
        toHide.push(n.id)
      }
    }
    if (toHide.length > 0) state.hideNodes(toHide)
  }

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
    state.hideNodes([state.selectedNodeId])
    state.setSelectedNode(null)
  }

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
          <div className="dock__divider" />
          <DockButton
            icon={Minimize2}
            tooltip="Collapse"
            onClick={handleCollapse}
          />
          <DockButton
            icon={Crosshair}
            tooltip="Center"
            onClick={handleCenter}
          />
          <DockButton icon={EyeOff} tooltip="Hide" onClick={handleHide} />
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
