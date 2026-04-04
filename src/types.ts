// ─── Node Types ───

export type NodeType =
  | 'project'
  | 'folder'
  | 'file'
  | 'note'
  | 'package_group'
  | 'package'
  | 'hidden_connections_group'
  | 'config_group'
  | 'user_group'

export interface ProjectNode {
  id: string
  type: NodeType
  name: string
  path: string
  parentId: string | null
  isOpaque?: boolean
  description?: string
  ownerId?: string // for package_group / hidden_connections_group
}

// ─── Edge Types ───

export type EdgeType =
  | 'contains'
  | 'imports'
  | 'alias_import'
  | 'uses_package'
  | 'manual_link'
  | 'groups'

export type ManualRelation = 'Attached Note' | 'Related'

export interface ProjectEdge {
  id: string
  type: EdgeType
  source: string
  target: string
  relation?: ManualRelation
  orphaned?: boolean
}

// ─── Meta ───

export interface AliasConfig {
  baseUrl: string
  paths: Record<string, string[]>
}

export interface ProjectMeta {
  schemaVersion: number
  projectName: string
  projectRoot: string
  createdAt: string
  updatedAt: string
  lastScanAt: string | null
  ignoreRules: string[]
  specialOpaqueFolders: string[]
  aliasConfig?: AliasConfig
}

// ─── Scanned Layer ───

export interface ScannedData {
  nodes: Record<string, ProjectNode>
  edges: Record<string, ProjectEdge>
  warnings: string[]
}

// ─── User Layer ───

export interface NodeOverride {
  alias?: string
  description?: string
  descriptionSource?: 'user' | 'ai'
  position?: { x: number; y: number }
  /** Position relative to parent — saved when user manually drags/reorders a child */
  relativePosition?: { x: number; y: number }
  hidden?: boolean
  /** true = this node was directly hidden by user; false = hidden as a descendant */
  hiddenIsParent?: boolean
  collapsed?: boolean
  tags?: string[]
  pinned?: boolean
}

export interface ManualNode {
  id: string
  type: 'note' | 'user_group'
  name: string
  description?: string
  position?: { x: number; y: number }
  status?: 'active' | 'draft'
  color?: string
}

export interface ManualEdge {
  id: string
  type: 'manual_link'
  source: string
  target: string
  relation: ManualRelation
  orphaned?: boolean
}

export interface FilterState {
  showFiles: boolean
  showFolders: boolean
  showNotes: boolean
  showPinnedOnly: boolean
  filterTags: string[]
  hideHelperNodes: boolean
  hidePackageNodes: boolean
}

export const DEFAULT_FILTERS: FilterState = {
  showFiles: true,
  showFolders: true,
  showNotes: true,
  showPinnedOnly: false,
  filterTags: [],
  hideHelperNodes: false,
  hidePackageNodes: false,
}

export interface UIState {
  selectedNodeId: string | null
  viewport: { x: number; y: number; zoom: number }
  visibleNodeIds: string[]
  filters: FilterState
}

export interface UserGroup {
  id: string
  name: string
  description?: string
  color?: string
  memberNodeIds: string[]
}

export interface UserData {
  nodeOverrides: Record<string, NodeOverride>
  manualNodes: Record<string, ManualNode>
  manualEdges: Record<string, ManualEdge>
  childOrder: Record<string, string[]>
  userGroups: Record<string, UserGroup>
  /** Edge IDs that the user has suppressed (hidden). Only allowed when an alternate group path exists. */
  suppressedEdges: string[]
  uiState: UIState
}

// ─── Full Schema ───

export interface ProjectMapSchema {
  meta: ProjectMeta
  scanned: ScannedData
  user: UserData
}

// ─── Helpers ───

export function createEmptyProjectMap(
  projectName: string,
  projectRoot: string,
): ProjectMapSchema {
  const now = new Date().toISOString()
  return {
    meta: {
      schemaVersion: 2,
      projectName,
      projectRoot,
      createdAt: now,
      updatedAt: now,
      lastScanAt: null,
      ignoreRules: [
        'node_modules',
        'dist',
        'build',
        '.next',
        'coverage',
        '.git',
      ],
      specialOpaqueFolders: [
        'node_modules',
        'dist',
        'build',
        '.next',
        'coverage',
        '.git',
      ],
    },
    scanned: {
      nodes: {},
      edges: {},
      warnings: [],
    },
    user: {
      nodeOverrides: {},
      manualNodes: {},
      manualEdges: {},
      childOrder: {},
      userGroups: {},
      suppressedEdges: [],
      uiState: {
        selectedNodeId: null,
        viewport: { x: 0, y: 0, zoom: 1 },
        visibleNodeIds: [],
        filters: { ...DEFAULT_FILTERS },
      },
    },
  }
}
