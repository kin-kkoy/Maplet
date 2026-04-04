import { BaseNode } from './BaseNode'

// All node types use the same BaseNode component,
// which adapts its display based on the node type data.
export const nodeTypes = {
  project: BaseNode,
  folder: BaseNode,
  file: BaseNode,
  note: BaseNode,
  package_group: BaseNode,
  package: BaseNode,
  hidden_connections_group: BaseNode,
  config_group: BaseNode,
  user_group: BaseNode,
} as const
