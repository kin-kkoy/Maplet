import { useState } from 'react'
import { X, Moon, Sun } from 'lucide-react'
import { useProjectStore } from '../store/useProjectStore'
import { useTheme } from '../hooks/useTheme'
import '../styles/modals.css'

interface ProjectSettingsModalProps {
  onClose: () => void
}

export function ProjectSettingsModal({ onClose }: ProjectSettingsModalProps) {
  const meta = useProjectStore((s) => s.meta)
  const scanned = useProjectStore((s) => s.scanned)
  const closeProject = useProjectStore((s) => s.closeProject)
  const { theme, toggleTheme } = useTheme()

  const nodeCount = Object.keys(scanned.nodes).length
  const edgeCount = Object.keys(scanned.edges).length
  const warningCount = scanned.warnings.length
  const [showWarnings, setShowWarnings] = useState(false)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 500 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="modal-title">Project Settings</div>
          <button className="detail-card__close" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        {/* Project info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Project
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, color: 'var(--text-primary)' }}>
              {meta.projectName}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Root
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'var(--text-secondary)' }}>
              {meta.projectRoot}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 24 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>Nodes</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14 }}>{nodeCount}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>Edges</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14 }}>{edgeCount}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>Last Scan</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
                {meta.lastScanAt ? new Date(meta.lastScanAt).toLocaleString() : 'Never'}
              </div>
            </div>
          </div>
        </div>

        {/* Warnings */}
        {warningCount > 0 && (
          <div>
            <button
              onClick={() => setShowWarnings(!showWarnings)}
              style={{
                background: 'transparent',
                border: '1px solid rgba(251, 146, 60, 0.3)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 10px',
                color: '#fb923c',
                fontSize: 12,
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
              }}
            >
              {warningCount} scan warning{warningCount !== 1 ? 's' : ''}{' '}
              {showWarnings ? '▾' : '▸'}
            </button>
            {showWarnings && (
              <div
                style={{
                  marginTop: 6,
                  maxHeight: 150,
                  overflowY: 'auto',
                  fontSize: 11,
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: 'var(--text-tertiary)',
                  lineHeight: 1.6,
                  padding: '8px 10px',
                  background: 'var(--surface-secondary)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {scanned.warnings.map((w, i) => (
                  <div key={i}>{w}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Theme toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Theme</span>
          <button
            onClick={toggleTheme}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              background: 'var(--surface-secondary)',
              color: 'var(--text-primary)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>

        {/* Ignore rules */}
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Ignore Rules
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            {meta.ignoreRules.join(', ')}
          </div>
        </div>

        {/* Close project */}
        <button
          onClick={() => { closeProject(); onClose() }}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-default)',
            background: 'transparent',
            color: 'var(--text-tertiary)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Close Project
        </button>
      </div>
    </div>
  )
}
