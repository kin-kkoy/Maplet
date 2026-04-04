import type { FsAdapter } from '../persistence/fsAdapter'
import type { ProjectNode, ProjectEdge, AliasConfig } from '../types'
import { isParseable, makeNodeId, makeEdgeId, resolveImportPath } from './helpers'
import { parseImports, extractPackageName } from './importParser'
import { loadAliasConfig, resolveAliasImport } from './aliasResolver'

interface RelationshipScanResult {
  nodes: Record<string, ProjectNode>
  edges: Record<string, ProjectEdge>
  warnings: string[]
  aliasConfig: AliasConfig | null
}

/**
 * Pass 2: Relationship Scan
 *
 * For parseable files (.js/.jsx/.ts/.tsx), extracts imports to build:
 * - `imports` edges for local file-to-file dependencies
 * - `alias_import` edges for alias-resolved imports (tsconfig paths)
 * - `package_group` + `package` nodes with `groups` edges
 * - `hidden_connections_group` for distant cross-file imports
 */
export async function relationshipScan(
  adapter: FsAdapter,
  existingNodes: Record<string, ProjectNode>,
  existingEdges: Record<string, ProjectEdge>,
): Promise<RelationshipScanResult> {
  const nodes: Record<string, ProjectNode> = {}
  const edges: Record<string, ProjectEdge> = {}
  const warnings: string[] = []

  // Load alias config from tsconfig.json / jsconfig.json
  const aliasConfig = await loadAliasConfig(adapter)

  // Build a lookup: path -> nodeId for resolving imports
  const pathToNodeId = new Map<string, string>()
  for (const node of Object.values(existingNodes)) {
    if (node.type === 'file') {
      pathToNodeId.set(node.path, node.id)
    }
  }

  // Collect all file paths for fileExists checks
  const allFilePaths = new Set(pathToNodeId.keys())
  const fileExistsCheck = async (path: string) => allFilePaths.has(path)

  // Global package nodes (shared across files)
  const packageNodes: Record<string, ProjectNode> = {}

  // Process each parseable file
  const fileNodes = Object.values(existingNodes).filter(
    (n) => n.type === 'file' && isParseable(n.name),
  )

  for (const fileNode of fileNodes) {
    let content: string
    try {
      content = await adapter.readTextFile(fileNode.path)
    } catch (err) {
      warnings.push(
        `Could not read file: ${fileNode.path} — ${err instanceof Error ? err.message : String(err)}`,
      )
      continue
    }

    const imports = parseImports(content)
    const localImportTargets: string[] = []
    const packageNames: string[] = []

    for (const imp of imports) {
      if (imp.isLocal) {
        // Resolve local import
        const resolved = await resolveImportPath(
          fileNode.path,
          imp.specifier,
          fileExistsCheck,
        )
        if (resolved) {
          const targetNodeId = pathToNodeId.get(resolved)
          if (targetNodeId) {
            localImportTargets.push(targetNodeId)
            const edgeId = makeEdgeId(fileNode.id, targetNodeId, 'imports')
            if (!existingEdges[edgeId] && !edges[edgeId]) {
              edges[edgeId] = {
                id: edgeId,
                type: 'imports',
                source: fileNode.id,
                target: targetNodeId,
              }
            }
          }
        } else {
          warnings.push(
            `Unresolved import: "${imp.specifier}" in ${fileNode.path}`,
          )
        }
      } else {
        // Try alias resolution before treating as package
        let resolvedAsAlias = false
        if (aliasConfig) {
          const aliasResolved = await resolveAliasImport(
            imp.specifier,
            aliasConfig,
            fileExistsCheck,
          )
          if (aliasResolved) {
            const targetNodeId = pathToNodeId.get(aliasResolved)
            if (targetNodeId) {
              localImportTargets.push(targetNodeId)
              const edgeId = makeEdgeId(fileNode.id, targetNodeId, 'alias_import')
              if (!existingEdges[edgeId] && !edges[edgeId]) {
                edges[edgeId] = {
                  id: edgeId,
                  type: 'alias_import',
                  source: fileNode.id,
                  target: targetNodeId,
                }
              }
              resolvedAsAlias = true
            }
          }
        }

        if (!resolvedAsAlias) {
          // Package import
          const pkgName = extractPackageName(imp.specifier)
          packageNames.push(pkgName)
        }
      }
    }

    // Create package group if packages are used
    const uniquePackages = [...new Set(packageNames)]
    if (uniquePackages.length > 0) {
      const pgId = makeNodeId('package_group', fileNode.id)
      nodes[pgId] = {
        id: pgId,
        type: 'package_group',
        name: `Packages (${uniquePackages.length})`,
        path: '',
        parentId: null,
        ownerId: fileNode.id,
      }

      // Edge from file to package group
      const fileToGroupEdge = makeEdgeId(fileNode.id, pgId, 'groups')
      edges[fileToGroupEdge] = {
        id: fileToGroupEdge,
        type: 'groups',
        source: fileNode.id,
        target: pgId,
      }

      // Create individual package nodes and group edges
      for (const pkgName of uniquePackages) {
        const pkgId = makeNodeId('package', pkgName)
        if (!packageNodes[pkgId]) {
          packageNodes[pkgId] = {
            id: pkgId,
            type: 'package',
            name: pkgName,
            path: '',
            parentId: null,
          }
        }
        const groupEdge = makeEdgeId(pgId, pkgId, 'groups')
        edges[groupEdge] = {
          id: groupEdge,
          type: 'groups',
          source: pgId,
          target: pkgId,
        }
      }
    }

    // Create hidden connections group for distant imports
    // Edges route through the group: file → hcg → target (not file → target directly)
    const distantConnections = localImportTargets.filter((targetId) => {
      const targetNode = existingNodes[targetId]
      if (!targetNode) return false
      return targetNode.parentId !== fileNode.parentId
    })

    if (distantConnections.length > 0) {
      const hcgId = makeNodeId('hidden_connections_group', fileNode.id)
      nodes[hcgId] = {
        id: hcgId,
        type: 'hidden_connections_group',
        name: `Other connections (${distantConnections.length})`,
        path: '',
        parentId: null,
        ownerId: fileNode.id,
      }

      // Edge from file to the group node
      const fileToHcg = makeEdgeId(fileNode.id, hcgId, 'groups')
      edges[fileToHcg] = {
        id: fileToHcg,
        type: 'groups',
        source: fileNode.id,
        target: hcgId,
      }

      // Edges from the group node to each distant target (routed through the group)
      for (const targetId of distantConnections) {
        const hcgToTarget = makeEdgeId(hcgId, targetId, 'imports')
        edges[hcgToTarget] = {
          id: hcgToTarget,
          type: 'imports',
          source: hcgId,
          target: targetId,
        }
        // Remove the direct file→target edge so it doesn't show as a duplicate
        const directEdgeId = makeEdgeId(fileNode.id, targetId, 'imports')
        delete edges[directEdgeId]
      }
    }
  }

  // Merge package nodes into the result
  Object.assign(nodes, packageNodes)

  return { nodes, edges, warnings, aliasConfig }
}
