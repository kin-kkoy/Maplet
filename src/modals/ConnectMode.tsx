import { useEffect } from 'react'
import { Link } from 'lucide-react'

interface ConnectModeProps {
  step: 'source' | 'target'
  sourceName?: string
  onCancel: () => void
}

export function ConnectModeOverlay({ step, sourceName, onCancel }: ConnectModeProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 16px',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--surface-glass)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--accent-primary)',
        boxShadow: '0 0 16px rgba(96, 165, 250, 0.15)',
        color: 'var(--accent-primary)',
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontSize: 13,
        fontWeight: 500,
        animation: 'contextDockIn 200ms ease-out',
      }}
    >
      <Link size={14} />
      {step === 'source'
        ? 'Click a node to select source'
        : `Source: ${sourceName} — Click a node to select target`}
      <button
        onClick={onCancel}
        style={{
          marginLeft: 8,
          padding: '2px 8px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-default)',
          background: 'transparent',
          color: 'var(--text-tertiary)',
          fontSize: 11,
          cursor: 'pointer',
        }}
      >
        Esc
      </button>
    </div>
  )
}
