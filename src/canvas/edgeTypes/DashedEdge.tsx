import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'

export function DashedEdge(props: EdgeProps) {
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
        stroke: 'var(--edge-cross)',
        strokeWidth: 1.2,
        strokeDasharray: '6 4',
        opacity: isDimmed ? 0.1 : 1,
      }}
    />
  )
}
