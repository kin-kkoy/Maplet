import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'

export function SolidEdge(props: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  })

  const isDimmed = (props.data as Record<string, unknown> | undefined)?.isDimmed

  return (
    <BaseEdge
      id={props.id}
      path={edgePath}
      style={{
        stroke: 'var(--edge-structural)',
        strokeWidth: 1.5,
        opacity: isDimmed ? 0.1 : 1,
      }}
    />
  )
}
