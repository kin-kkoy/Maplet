import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'

export function CurvedDashedEdge(props: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
    curvature: 0.4,
  })

  const isDimmed = (props.data as Record<string, unknown> | undefined)?.isDimmed

  return (
    <BaseEdge
      id={props.id}
      path={edgePath}
      style={{
        stroke: 'var(--edge-alias)',
        strokeWidth: 1.3,
        strokeDasharray: '8 4 2 4',
        opacity: isDimmed ? 0.1 : 1,
      }}
    />
  )
}
