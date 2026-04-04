import { useMemo } from 'react'
import { useProjectStore } from '../store/useProjectStore'
import { DEFAULT_FILTERS } from '../types'
import '../styles/filters.css'

interface FilterPanelProps {
  onClose: () => void
}

function Toggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <div className={`filter-toggle ${active ? 'active' : ''}`} onClick={onToggle}>
      <div className="filter-toggle__knob" />
    </div>
  )
}

export function FilterPanel({ onClose }: FilterPanelProps) {
  void onClose
  const filters = useProjectStore((s) => s.filters)
  const setFilters = useProjectStore((s) => s.setFilters)
  const resetFilters = useProjectStore((s) => s.resetFilters)
  const nodeOverrides = useProjectStore((s) => s.user.nodeOverrides)

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    for (const override of Object.values(nodeOverrides)) {
      if (override.tags) {
        for (const tag of override.tags) tagSet.add(tag)
      }
    }
    return Array.from(tagSet).sort()
  }, [nodeOverrides])

  // Count nodes explicitly hidden by the user, split by parent vs child
  const { hiddenParentCount, hiddenChildrenCount } = useMemo(() => {
    let parents = 0
    let children = 0
    for (const override of Object.values(nodeOverrides)) {
      if (override.hidden) {
        if (override.hiddenIsParent) parents++
        else children++
      }
    }
    return { hiddenParentCount: parents, hiddenChildrenCount: children }
  }, [nodeOverrides])

  const hiddenTotal = hiddenParentCount + hiddenChildrenCount

  /**
   * Reveal hidden nodes. 'parents' also clears hidden flag on their descendants
   * (so they leave the children count) but only makes the parents visible — not
   * expanded. 'children' reveals only the child nodes. 'all' reveals everything.
   */
  const revealHidden = (which: 'parents' | 'children' | 'all') => {
    const state = useProjectStore.getState()
    const allNodes = state.getAllNodes()
    const overrides = state.user.nodeOverrides

    // Collect the nodes we will actually make visible
    const toReveal: string[] = []
    // Collect all nodes whose hidden flag we need to clear
    const toClearFlag: string[] = []

    if (which === 'parents' || which === 'all') {
      // Find all parent-hidden nodes
      for (const [id, ov] of Object.entries(overrides)) {
        if (ov.hidden && ov.hiddenIsParent && allNodes[id]) {
          toReveal.push(id)
          toClearFlag.push(id)
        }
      }
      // Also clear the hidden flag on their descendants (children entries)
      // so they disappear from the "children" count — but don't reveal them
      for (const [id, ov] of Object.entries(overrides)) {
        if (ov.hidden && !ov.hiddenIsParent && allNodes[id]) {
          toClearFlag.push(id)
        }
      }
    }

    if (which === 'children') {
      for (const [id, ov] of Object.entries(overrides)) {
        if (ov.hidden && !ov.hiddenIsParent && allNodes[id]) {
          toReveal.push(id)
          toClearFlag.push(id)
        }
      }
    }

    if (toClearFlag.length === 0) return

    state.pushUndoSnapshot()

    // Clear hidden flags and reposition nodes we're revealing
    for (const id of toClearFlag) {
      const shouldReveal = toReveal.includes(id)
      const node = allNodes[id]
      const parentId = node && 'parentId' in node ? node.parentId : null
      const parentPos = parentId ? state.user.nodeOverrides[parentId]?.position : null
      const relPos = state.user.nodeOverrides[id]?.relativePosition

      if (shouldReveal && parentPos && relPos) {
        state.setNodeOverride(id, {
          hidden: false, hiddenIsParent: undefined,
          position: { x: parentPos.x + relPos.x, y: parentPos.y + relPos.y },
        })
      } else {
        state.setNodeOverride(id, { hidden: false, hiddenIsParent: undefined })
      }
    }

    // Only make the targeted nodes visible (not descendants when revealing parents)
    if (toReveal.length > 0) {
      state.revealNodes(toReveal)
    }
  }

  const isDefault =
    filters.showFiles === DEFAULT_FILTERS.showFiles &&
    filters.showFolders === DEFAULT_FILTERS.showFolders &&
    filters.showNotes === DEFAULT_FILTERS.showNotes &&
    filters.showPinnedOnly === DEFAULT_FILTERS.showPinnedOnly &&
    filters.hideHelperNodes === DEFAULT_FILTERS.hideHelperNodes &&
    filters.hidePackageNodes === DEFAULT_FILTERS.hidePackageNodes &&
    filters.filterTags.length === 0

  const toggleTag = (tag: string) => {
    const current = filters.filterTags
    if (current.includes(tag)) {
      setFilters({ filterTags: current.filter((t) => t !== tag) })
    } else {
      setFilters({ filterTags: [...current, tag] })
    }
  }

  return (
    <div className="filter-panel" onClick={(e) => e.stopPropagation()}>
      <div className="filter-panel__header">
        <span className="filter-panel__title">Filters</span>
        {!isDefault && (
          <button className="filter-panel__reset" onClick={resetFilters}>
            Reset
          </button>
        )}
      </div>

      <div className="filter-panel__section">
        <div className="filter-panel__section-label">Show / Hide</div>
        <div className="filter-panel__row">
          <span className="filter-panel__label">Files</span>
          <Toggle active={filters.showFiles} onToggle={() => setFilters({ showFiles: !filters.showFiles })} />
        </div>
        <div className="filter-panel__row">
          <span className="filter-panel__label">Folders</span>
          <Toggle active={filters.showFolders} onToggle={() => setFilters({ showFolders: !filters.showFolders })} />
        </div>
        <div className="filter-panel__row">
          <span className="filter-panel__label">Notes</span>
          <Toggle active={filters.showNotes} onToggle={() => setFilters({ showNotes: !filters.showNotes })} />
        </div>
      </div>

      <div className="filter-panel__divider" />

      <div className="filter-panel__section">
        <div className="filter-panel__section-label">Helper Nodes</div>
        <div className="filter-panel__row">
          <span className="filter-panel__label">Hide helpers</span>
          <Toggle active={filters.hideHelperNodes} onToggle={() => setFilters({ hideHelperNodes: !filters.hideHelperNodes })} />
        </div>
        <div className="filter-panel__row">
          <span className="filter-panel__label">Hide packages</span>
          <Toggle active={filters.hidePackageNodes} onToggle={() => setFilters({ hidePackageNodes: !filters.hidePackageNodes })} />
        </div>
      </div>

      <div className="filter-panel__divider" />

      <div className="filter-panel__section">
        <div className="filter-panel__section-label">Pinned</div>
        <div className="filter-panel__row">
          <span className="filter-panel__label">Pinned only</span>
          <Toggle active={filters.showPinnedOnly} onToggle={() => setFilters({ showPinnedOnly: !filters.showPinnedOnly })} />
        </div>
      </div>

      {allTags.length > 0 && (
        <>
          <div className="filter-panel__divider" />
          <div className="filter-panel__section">
            <div className="filter-panel__section-label">Tags</div>
            <div className="filter-panel__tags">
              {allTags.map((tag) => (
                <span
                  key={tag}
                  className={`filter-tag-chip ${filters.filterTags.includes(tag) ? 'active' : ''}`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      {hiddenTotal > 0 && (
        <>
          <div className="filter-panel__divider" />
          <div className="filter-panel__section">
            <div className="filter-panel__section-label">Hidden Nodes</div>
            {hiddenParentCount > 0 && (
              <div className="filter-panel__row">
                <span className="filter-panel__label">
                  {hiddenParentCount} parent{hiddenParentCount !== 1 ? 's' : ''}
                </span>
                <button className="filter-panel__reset" onClick={() => revealHidden('parents')}>
                  Reveal
                </button>
              </div>
            )}
            {hiddenChildrenCount > 0 && (
              <div className="filter-panel__row">
                <span className="filter-panel__label">
                  {hiddenChildrenCount} {hiddenChildrenCount !== 1 ? 'children' : 'child'}
                </span>
                <button className="filter-panel__reset" onClick={() => revealHidden('children')}>
                  Reveal
                </button>
              </div>
            )}
            <div className="filter-panel__row">
              <span className="filter-panel__label" style={{ fontWeight: 500 }}>
                {hiddenTotal} total
              </span>
              <button className="filter-panel__reset" onClick={() => revealHidden('all')}>
                Reveal All
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Check if any filters are active (non-default).
 */
export function hasActiveFilters(filters: typeof DEFAULT_FILTERS): boolean {
  return (
    !filters.showFiles ||
    !filters.showFolders ||
    !filters.showNotes ||
    filters.showPinnedOnly ||
    filters.hideHelperNodes ||
    filters.hidePackageNodes ||
    filters.filterTags.length > 0
  )
}
