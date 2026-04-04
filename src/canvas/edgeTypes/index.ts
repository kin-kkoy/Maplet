import { SolidEdge } from './SolidEdge'
import { DashedEdge } from './DashedEdge'
import { CurvedDashedEdge } from './CurvedDashedEdge'

export const edgeTypes = {
  solidEdge: SolidEdge,
  dashedEdge: DashedEdge,
  curvedDashedEdge: CurvedDashedEdge,
} as const
