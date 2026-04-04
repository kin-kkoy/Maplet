import type { LucideIcon } from 'lucide-react'

interface DockButtonProps {
  icon: LucideIcon
  tooltip: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  emphasized?: boolean
  className?: string
}

export function DockButton({
  icon: Icon,
  tooltip,
  onClick,
  disabled = false,
  active = false,
  emphasized = false,
  className = '',
}: DockButtonProps) {
  const classes = [
    'dock__btn',
    active && 'active',
    emphasized && 'emphasized',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      className={classes}
      onClick={onClick}
      disabled={disabled}
      data-tooltip={tooltip}
      aria-label={tooltip}
    >
      <Icon size={16} />
    </button>
  )
}
