import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Search } from 'lucide-react'
import { useProjectStore } from '../store/useProjectStore'
import { useReactFlow } from '@xyflow/react'
import type { NodeType } from '../types'
import '../styles/search.css'

const ACCENT_MAP: Record<NodeType, string> = {
  project: 'var(--accent-project)',
  folder: 'var(--accent-folder)',
  file: 'var(--accent-file)',
  note: 'var(--accent-note)',
  package_group: 'var(--accent-package)',
  package: 'var(--accent-package)',
  hidden_connections_group: 'var(--accent-hidden)',
  config_group: 'var(--accent-hidden)',
}

interface SearchResult {
  id: string
  name: string
  path: string
  type: NodeType
}

interface SearchOverlayProps {
  onClose: () => void
}

export function SearchOverlay({ onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const scannedNodes = useProjectStore((s) => s.scanned.nodes)
  const manualNodes = useProjectStore((s) => s.user.manualNodes)
  const revealNodes = useProjectStore((s) => s.revealNodes)
  const setSelectedNode = useProjectStore((s) => s.setSelectedNode)
  const setNodeOverride = useProjectStore((s) => s.setNodeOverride)
  const { setCenter } = useReactFlow()

  // Build search index
  const allResults = useMemo<SearchResult[]>(() => {
    const results: SearchResult[] = []
    for (const node of Object.values(scannedNodes)) {
      results.push({ id: node.id, name: node.name, path: node.path, type: node.type })
    }
    for (const node of Object.values(manualNodes)) {
      results.push({ id: node.id, name: node.name, path: '', type: node.type })
    }
    return results.sort((a, b) => a.name.localeCompare(b.name))
  }, [scannedNodes, manualNodes])

  // Filter by query
  const filtered = useMemo(() => {
    if (!query.trim()) return allResults.slice(0, 20)
    const q = query.toLowerCase()
    return allResults
      .filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.path.toLowerCase().includes(q),
      )
      .slice(0, 15)
  }, [query, allResults])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const jumpToNode = useCallback(
    (result: SearchResult) => {
      const state = useProjectStore.getState()
      // Ensure the node is visible
      if (!state.visibleNodeIds.has(result.id)) {
        // Reveal minimum ancestor chain
        const toReveal: string[] = [result.id]
        let walkId: string | null = result.id
        while (walkId) {
          const n = state.getNode(walkId)
          const pid: string | null = n && 'parentId' in n ? (n.parentId ?? null) : null
          if (pid && !state.visibleNodeIds.has(pid)) {
            toReveal.push(pid)
            if (!state.user.nodeOverrides[pid]?.position) {
              setNodeOverride(pid, { position: { x: -200 * toReveal.length, y: 0 } })
            }
          }
          walkId = pid
        }
        revealNodes(toReveal)
      }

      // Set position if not already set
      const pos = state.user.nodeOverrides[result.id]?.position
      if (pos) {
        setCenter(pos.x + 70, pos.y + 25, { zoom: 1.2, duration: 300 })
      }

      setSelectedNode(result.id)
      onClose()
    },
    [revealNodes, setSelectedNode, setNodeOverride, setCenter, onClose],
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      const result = filtered[activeIndex]
      if (result) jumpToNode(result)
    }
  }

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-container" onClick={(e) => e.stopPropagation()}>
        <div className="search-input-wrapper">
          <Search size={16} color="var(--text-tertiary)" />
          <input
            ref={inputRef}
            className="search-input"
            placeholder="Search nodes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="search-results">
          {filtered.length === 0 ? (
            <div className="search-empty">No results found</div>
          ) : (
            filtered.map((result, i) => (
              <div
                key={result.id}
                className={`search-result ${i === activeIndex ? 'active' : ''}`}
                onClick={() => jumpToNode(result)}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <span
                  className="search-result__dot"
                  style={{ background: ACCENT_MAP[result.type] }}
                />
                <div className="search-result__info">
                  <div className="search-result__name">{result.name}</div>
                  {result.path && (
                    <div className="search-result__path">{result.path}</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="search-hint">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>Enter</kbd> jump</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
