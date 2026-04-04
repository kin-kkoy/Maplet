import type { FsAdapter } from '../persistence/fsAdapter'
import type { ProjectMeta, ProjectNode, ProjectEdge } from '../types'
import { isIgnored, isOpaque, isConfigItem, makeNodeId, makeEdgeId } from './helpers'

interface StructureScanResult {
  nodes: Record<string, ProjectNode>
  edges: Record<string, ProjectEdge>
  warnings: string[]
}

interface StackEntry {
  path: string
  parentNodeId: string
}

/**
 * Pass 1: Structure Scan
 *
 * Iterative DFS through the filesystem via the adapter.
 * Config/dot files and opaque folders at each directory level are grouped
 * into a single "Config" group node. package.json stays as a normal node.
 */
export async function structureScan(
  adapter: FsAdapter,
  meta: ProjectMeta,
): Promise<StructureScanResult> {
  const nodes: Record<string, ProjectNode> = {}
  const edges: Record<string, ProjectEdge> = {}
  const warnings: string[] = []

  // Create project root node
  const rootId = makeNodeId('project', '.')
  nodes[rootId] = {
    id: rootId,
    type: 'project',
    name: meta.projectName || adapter.getProjectName(),
    path: '.',
    parentId: null,
  }

  const stack: StackEntry[] = [{ path: '.', parentNodeId: rootId }]

  while (stack.length > 0) {
    const entry = stack.pop()!
    let dirEntries

    try {
      dirEntries = await adapter.listDirectory(entry.path)
    } catch (err) {
      warnings.push(
        `Could not read directory: ${entry.path} — ${err instanceof Error ? err.message : String(err)}`,
      )
      continue
    }

    // Separate config items from regular items at this directory level
    const configItems: { name: string; kind: 'file' | 'directory'; relativePath: string }[] = []
    const regularItems: { name: string; kind: 'file' | 'directory'; relativePath: string }[] = []

    for (const dirEntry of dirEntries) {
      const relativePath =
        entry.path === '.' ? dirEntry.name : `${entry.path}/${dirEntry.name}`

      if (isIgnored(dirEntry.name, meta.ignoreRules)) continue

      // Opaque folders and config files/folders go to the config group
      if (
        (dirEntry.kind === 'directory' && isOpaque(dirEntry.name, meta)) ||
        isConfigItem(dirEntry.name)
      ) {
        configItems.push({ name: dirEntry.name, kind: dirEntry.kind, relativePath })
      } else {
        regularItems.push({ name: dirEntry.name, kind: dirEntry.kind, relativePath })
      }
    }

    // Create the config group if there are config items
    if (configItems.length > 0) {
      const groupId = `configgrp:${entry.path === '.' ? 'root' : entry.path}`
      nodes[groupId] = {
        id: groupId,
        type: 'config_group' as ProjectNode['type'],
        name: `Config (${configItems.length})`,
        path: '',
        parentId: entry.parentNodeId,
        ownerId: entry.parentNodeId,
      }
      const groupEdgeId = makeEdgeId(entry.parentNodeId, groupId, 'contains')
      edges[groupEdgeId] = {
        id: groupEdgeId,
        type: 'contains',
        source: entry.parentNodeId,
        target: groupId,
      }

      // Create individual nodes inside the group
      for (const item of configItems) {
        let itemId: string
        if (item.kind === 'directory') {
          itemId = makeNodeId('special', item.name)
          nodes[itemId] = {
            id: itemId,
            type: 'folder',
            name: item.name,
            path: item.relativePath,
            parentId: groupId,
            isOpaque: true,
          }
        } else {
          itemId = makeNodeId('file', item.relativePath)
          nodes[itemId] = {
            id: itemId,
            type: 'file',
            name: item.name,
            path: item.relativePath,
            parentId: groupId,
          }
        }
        const itemEdgeId = makeEdgeId(groupId, itemId, 'groups')
        edges[itemEdgeId] = {
          id: itemEdgeId,
          type: 'groups',
          source: groupId,
          target: itemId,
        }
      }
    }

    // Process regular items normally
    for (const item of regularItems) {
      if (item.kind === 'directory') {
        const folderId = makeNodeId('folder', item.relativePath)
        nodes[folderId] = {
          id: folderId,
          type: 'folder',
          name: item.name,
          path: item.relativePath,
          parentId: entry.parentNodeId,
        }
        const edgeId = makeEdgeId(entry.parentNodeId, folderId, 'contains')
        edges[edgeId] = {
          id: edgeId,
          type: 'contains',
          source: entry.parentNodeId,
          target: folderId,
        }
        stack.push({ path: item.relativePath, parentNodeId: folderId })
      } else {
        const fileId = makeNodeId('file', item.relativePath)
        nodes[fileId] = {
          id: fileId,
          type: 'file',
          name: item.name,
          path: item.relativePath,
          parentId: entry.parentNodeId,
        }
        const edgeId = makeEdgeId(entry.parentNodeId, fileId, 'contains')
        edges[edgeId] = {
          id: edgeId,
          type: 'contains',
          source: entry.parentNodeId,
          target: fileId,
        }
      }
    }
  }

  return { nodes, edges, warnings }
}
