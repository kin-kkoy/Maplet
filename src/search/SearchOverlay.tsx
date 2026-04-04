import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Search, Star } from 'lucide-react'
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
  user_group: 'var(--accent-user-group)',
}

interface SearchResult {
  id: string
  name: string
  path: string
  type: NodeType
  alias?: string
  tags: string[]
  description?: string
  pinned: boolean
}

interface ParsedQuery {
  text: string
  tagFilter?: string
  typeFilter?: string
  extFilter?: string
  pinnedOnly: boolean
}

function parseQuery(raw: string): ParsedQuery {
  let text = raw
  let tagFilter: string | undefined
  let typeFilter: string | undefined
  let extFilter: string | undefined
  let pinnedOnly = false

  // Extract #tag
  const tagMatch = text.match(/#(\S+)/)
  if (tagMatch) {
    tagFilter = tagMatch[1]
    text = text.replace(tagMatch[0], '')
  }

  // Extract @type:X
  const typeMatch = text.match(/@type:(\S+)/)
  if (typeMatch) {
    typeFilter = typeMatch[1]
    text = text.replace(typeMatch[0], '')
  }

  // Extract *.ext
  const extMatch = text.match(/\*\.(\S+)/)
  if (extMatch) {
    extFilter = '.' + extMatch[1]
    text = text.replace(extMatch[0], '')
  }

  // Extract !pinned
  if (text.includes('!pinned')) {
    pinnedOnly = true
    text = text.replace('!pinned', '')
  }

  return { text: text.trim(), tagFilter, typeFilter, extFilter, pinnedOnly }
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
  const nodeOverrides = useProjectStore((s) => s.user.nodeOverrides)
  const revealNodes = useProjectStore((s) => s.revealNodes)
  const setSelectedNode = useProjectStore((s) => s.setSelectedNode)
  const setNodeOverride = useProjectStore((s) => s.setNodeOverride)
  const { setCenter } = useReactFlow()

  // Build search index with V2 fields
  const allResults = useMemo<SearchResult[]>(() => {
    const results: SearchResult[] = []
    for (const node of Object.values(scannedNodes)) {
      const ov = nodeOverrides[node.id]
      results.push({
        id: node.id,
        name: node.name,
        path: node.path,
        type: node.type,
        alias: ov?.alias,
        tags: ov?.tags ?? [],
        description: ov?.description ?? node.description,
        pinned: ov?.pinned ?? false,
      })
    }
    for (const node of Object.values(manualNodes)) {
      const ov = nodeOverrides[node.id]
      results.push({
        id: node.id,
        name: node.name,
        path: '',
        type: node.type,
        alias: ov?.alias,
        tags: ov?.tags ?? [],
        description: ov?.description ?? node.description,
        pinned: ov?.pinned ?? false,
      })
    }
    return results.sort((a, b) => a.name.localeCompare(b.name))
  }, [scannedNodes, manualNodes, nodeOverrides])

  // Filter by query with prefix operators
  const filtered = useMemo(() => {
    if (!query.trim()) return allResults.slice(0, 25)

    const parsed = parseQuery(query)
    const q = parsed.text.toLowerCase()

    return allResults
      .filter((r) => {
        // Prefix filters
        if (parsed.pinnedOnly && !r.pinned) return false
        if (parsed.tagFilter && !r.tags.some((t) => t.toLowerCase().includes(parsed.tagFilter!.toLowerCase()))) return false
        if (parsed.typeFilter && r.type !== parsed.typeFilter) return false
        if (parsed.extFilter && r.type === 'file' && !r.name.endsWith(parsed.extFilter)) return false
        if (parsed.extFilter && r.type !== 'file') return false

        // Text search across all fields
        if (!q) return true
        return (
          r.name.toLowerCase().includes(q) ||
          r.path.toLowerCase().includes(q) ||
          (r.alias?.toLowerCase().includes(q) ?? false) ||
          (r.description?.toLowerCase().includes(q) ?? false) ||
          r.tags.some((t) => t.toLowerCase().includes(q))
        )
      })
      .slice(0, 25)
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
                  <div className="search-result__name">
                    {result.alias ? (
                      <><span>{result.alias}</span> <span className="search-result__original">({result.name})</span></>
                    ) : (
                      result.name
                    )}
                    {result.pinned && (
                      <Star size={10} className="search-result__pin" />
                    )}
                  </div>
                  {result.path && (
                    <div className="search-result__path">{result.path}</div>
                  )}
                  {result.tags.length > 0 && (
                    <div className="search-result__tags">
                      {result.tags.map((t) => (
                        <span key={t} className="search-result__tag">{t}</span>
                      ))}
                    </div>
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
          <span className="search-hint__sep">|</span>
          <span><kbd>#tag</kbd></span>
          <span><kbd>@type:</kbd></span>
          <span><kbd>*.ext</kbd></span>
          <span><kbd>!pinned</kbd></span>
        </div>
      </div>
    </div>
  )
}
