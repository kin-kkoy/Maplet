import type { FsAdapter } from '../persistence/fsAdapter'
import type { AliasConfig } from '../types'

/**
 * Load alias configuration from tsconfig.json or jsconfig.json.
 * Reads compilerOptions.baseUrl and compilerOptions.paths.
 */
export async function loadAliasConfig(
  adapter: FsAdapter,
): Promise<AliasConfig | null> {
  for (const configFile of ['tsconfig.json', 'jsconfig.json']) {
    let raw: string
    try {
      raw = await adapter.readTextFile(configFile)
    } catch {
      continue
    }

    try {
      // Strip single-line and block comments (tsconfig allows them)
      const stripped = raw
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        // Strip trailing commas before } or ]
        .replace(/,\s*([\]}])/g, '$1')

      const config = JSON.parse(stripped)
      const compiler = config.compilerOptions
      if (!compiler) continue

      const paths = compiler.paths
      if (!paths || Object.keys(paths).length === 0) continue

      return {
        baseUrl: compiler.baseUrl ?? '.',
        paths,
      }
    } catch {
      continue
    }
  }

  return null
}

/**
 * Try to resolve an import specifier using alias configuration.
 * Returns the resolved file path or null if no alias matches.
 */
export async function resolveAliasImport(
  specifier: string,
  aliasConfig: AliasConfig,
  fileExists: (path: string) => Promise<boolean>,
): Promise<string | null> {
  for (const [pattern, mappings] of Object.entries(aliasConfig.paths)) {
    // Convert pattern like "@/*" to a regex
    const hasWildcard = pattern.includes('*')

    if (hasWildcard) {
      // e.g. "@/*" matches "@/anything"
      const prefix = pattern.slice(0, pattern.indexOf('*'))
      if (!specifier.startsWith(prefix)) continue
      const captured = specifier.slice(prefix.length)

      for (const mapping of mappings) {
        const mappingPrefix = mapping.slice(0, mapping.indexOf('*'))
        // Prepend baseUrl
        const base = aliasConfig.baseUrl === '.' ? '' : aliasConfig.baseUrl + '/'
        const resolved = base + mappingPrefix + captured

        const result = await tryResolveFile(resolved, fileExists)
        if (result) return result
      }
    } else {
      // Exact match (no wildcard)
      if (specifier !== pattern) continue

      for (const mapping of mappings) {
        const base = aliasConfig.baseUrl === '.' ? '' : aliasConfig.baseUrl + '/'
        const resolved = base + mapping

        const result = await tryResolveFile(resolved, fileExists)
        if (result) return result
      }
    }
  }

  return null
}

/**
 * Try to resolve a path to an actual file, trying extensions and index files.
 */
async function tryResolveFile(
  basePath: string,
  fileExists: (path: string) => Promise<boolean>,
): Promise<string | null> {
  // Exact match
  if (await fileExists(basePath)) return basePath

  // Try extensions
  const extensions = ['.ts', '.tsx', '.js', '.jsx']
  for (const ext of extensions) {
    if (await fileExists(basePath + ext)) return basePath + ext
  }

  // Try as directory with index file
  const indexFiles = ['index.ts', 'index.tsx', 'index.js', 'index.jsx']
  for (const idx of indexFiles) {
    const indexPath = basePath + '/' + idx
    if (await fileExists(indexPath)) return indexPath
  }

  return null
}
