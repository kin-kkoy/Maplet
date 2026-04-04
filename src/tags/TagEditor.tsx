import { useState, useRef, useEffect, useMemo } from 'react'
import { X, Plus } from 'lucide-react'
import { useProjectStore } from '../store/useProjectStore'

const SUGGESTED_TAGS = ['auth', 'db', 'entrypoint', 'critical', 'ui', 'todo', 'refactor']

interface TagEditorProps {
  nodeId: string
  currentTags: string[]
}

export function TagEditor({ nodeId, currentTags }: TagEditorProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const addNodeTag = useProjectStore((s) => s.addNodeTag)
  const removeNodeTag = useProjectStore((s) => s.removeNodeTag)
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

  useEffect(() => {
    if (isAdding) inputRef.current?.focus()
  }, [isAdding])

  const suggestions = [...new Set([...SUGGESTED_TAGS, ...allTags])]
    .filter((t) => !currentTags.includes(t))
    .filter((t) => !input || t.toLowerCase().includes(input.toLowerCase()))
    .slice(0, 6)

  const handleAdd = (tag: string) => {
    const trimmed = tag.trim().toLowerCase()
    if (!trimmed) return
    addNodeTag(nodeId, trimmed)
    setInput('')
    setIsAdding(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd(input)
    } else if (e.key === 'Escape') {
      setIsAdding(false)
      setInput('')
    }
  }

  return (
    <div className="tag-editor">
      <div className="tag-editor__list">
        {currentTags.map((tag) => (
          <span key={tag} className="tag-editor__pill">
            {tag}
            <button
              className="tag-editor__remove"
              onClick={() => removeNodeTag(nodeId, tag)}
            >
              <X size={8} />
            </button>
          </span>
        ))}
        {!isAdding && (
          <button className="tag-editor__add-btn" onClick={() => setIsAdding(true)}>
            <Plus size={10} /> tag
          </button>
        )}
      </div>
      {isAdding && (
        <div className="tag-editor__input-area">
          <input
            ref={inputRef}
            className="tag-editor__input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add tag..."
          />
          {suggestions.length > 0 && (
            <div className="tag-editor__suggestions">
              {suggestions.map((s) => (
                <button key={s} className="tag-editor__suggestion" onClick={() => handleAdd(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
