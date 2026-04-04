import { useState, useCallback, useMemo } from 'react'
import { FolderOpen, Loader2, Clock, AlertTriangle } from 'lucide-react'
import { BrowserFsAdapter } from '../persistence/browserFsAdapter'
import { useProjectStore } from '../store/useProjectStore'
import { structureScan } from '../scanner/structureScan'
import { relationshipScan } from '../scanner/relationshipScan'
import { listSavedProjects, loadProjectMap } from '../persistence/projectMapStore'
import '../styles/modals.css'

interface RecentProject {
  name: string
  updatedAt: string
  nodeCount: number
}

function getRecentProjects(): RecentProject[] {
  const names = listSavedProjects()
  const projects: RecentProject[] = []

  for (const name of names) {
    const data = loadProjectMap(name)
    projects.push({
      name,
      updatedAt: data.meta.updatedAt,
      nodeCount: Object.keys(data.scanned.nodes).length,
    })
  }

  // Sort by most recently updated, limit to 7
  projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  return projects.slice(0, 7)
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

export function ProjectOpenModal() {
  const openProject = useProjectStore((s) => s.openProject)
  const setScanResult = useProjectStore((s) => s.setScanResult)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [staleWarning, setStaleWarning] = useState<string | null>(null)

  const recentProjects = useMemo(() => getRecentProjects(), [])

  const handleOpenFolder = useCallback(async () => {
    setError(null)
    setStaleWarning(null)
    setLoading(true)
    try {
      setStatus('Selecting folder...')
      const adapter = new BrowserFsAdapter()
      await adapter.pickProjectDirectory()

      setStatus('Loading project...')
      openProject(adapter)

      setStatus('Scanning file structure...')
      const meta = useProjectStore.getState().meta
      const structResult = await structureScan(adapter, meta)

      setStatus('Analyzing imports...')
      const relResult = await relationshipScan(
        adapter,
        structResult.nodes,
        structResult.edges,
      )

      // Store alias config in meta if found
      if (relResult.aliasConfig) {
        useProjectStore.setState((s) => ({
          meta: { ...s.meta, aliasConfig: relResult.aliasConfig ?? undefined },
        }))
      }

      setScanResult({
        nodes: { ...structResult.nodes, ...relResult.nodes },
        edges: { ...structResult.edges, ...relResult.edges },
        warnings: [...structResult.warnings, ...relResult.warnings],
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User cancelled
      } else {
        console.error('Open project failed:', err)
        setError(err instanceof Error ? err.message : 'Failed to open project')
      }
    } finally {
      setLoading(false)
      setStatus('')
    }
  }, [openProject, setScanResult])

  const handleOpenRecent = useCallback(
    (projectName: string) => {
      // Load saved data directly from localStorage (no adapter/scan needed)
      const data = loadProjectMap(projectName)

      // Create a dummy adapter that won't be used for scanning
      // (the user needs to re-open the folder to scan again)
      const state = useProjectStore.getState()
      const visibleIds = new Set(data.user.uiState.visibleNodeIds)
      if (visibleIds.size === 0 && data.scanned.nodes['project:root']) {
        visibleIds.add('project:root')
      }

      // Directly set store state from saved data
      useProjectStore.setState({
        adapter: null, // no filesystem access until they re-open
        projectName,
        isProjectOpen: true,
        meta: data.meta,
        scanned: data.scanned,
        user: data.user,
        visibleNodeIds: visibleIds,
        selectedNodeId: data.user.uiState.selectedNodeId,
        structureVersion: (state.structureVersion ?? 0) + 1,
      })

      setStaleWarning(projectName)
    },
    [],
  )

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 480 }}>
        <div>
          <div className="modal-title">Project Mind Map</div>
          <div className="modal-subtitle">
            Open a project folder to get started
          </div>
        </div>

        <button
          className="modal-open-btn"
          onClick={handleOpenFolder}
          disabled={loading}
        >
          {loading ? (
            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <FolderOpen size={18} />
          )}
          {loading ? status || 'Working...' : 'Open Folder'}
        </button>

        {error && <div className="modal-error">{error}</div>}

        {/* Stale warning banner */}
        {staleWarning && (
          <div className="modal-stale-warning">
            <AlertTriangle size={14} />
            <span>
              Restored from saved data. The map may be outdated — re-open the folder and scan to refresh.
            </span>
            <button
              className="modal-stale-dismiss"
              onClick={() => setStaleWarning(null)}
            >
              Got it
            </button>
          </div>
        )}

        {/* Recent projects */}
        {recentProjects.length > 0 && (
          <>
            <div className="modal-divider">
              <Clock size={10} />
              recent projects
            </div>
            <div className="modal-recent-list">
              {recentProjects.map((p) => (
                <button
                  key={p.name}
                  className="modal-recent-item"
                  onClick={() => handleOpenRecent(p.name)}
                  disabled={loading}
                >
                  <div className="modal-recent-name">{p.name}</div>
                  <div className="modal-recent-meta">
                    <span>{p.nodeCount} nodes</span>
                    <span>{timeAgo(p.updatedAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
