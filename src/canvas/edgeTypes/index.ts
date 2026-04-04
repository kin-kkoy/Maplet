import { SolidEdge } from './SolidEdge'
import { DashedEdge } from './DashedEdge'

export const edgeTypes = {
  solidEdge: SolidEdge,
  dashedEdge: DashedEdge,
} as const
