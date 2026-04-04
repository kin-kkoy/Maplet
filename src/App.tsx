import { ReactFlowProvider } from '@xyflow/react'
import { Canvas } from './canvas/Canvas'
import { useTheme } from './hooks/useTheme'
import { useProjectStore } from './store/useProjectStore'
import { ProjectOpenModal } from './modals/ProjectOpenModal'
import { Moon, Sun } from 'lucide-react'

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const isProjectOpen = useProjectStore((s) => s.isProjectOpen)

  return (
    <ReactFlowProvider>
      {isProjectOpen ? (
        <Canvas />
      ) : (
        <>
          <ProjectOpenModal />
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            style={{
              position: 'fixed',
              top: 16,
              right: 16,
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              background: 'var(--surface-glass)',
              backdropFilter: 'blur(12px)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </>
      )}
    </ReactFlowProvider>
  )
}
