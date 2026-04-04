/**
 * Regex-based import parser for ES modules and CommonJS require.
 * Extracts import specifier strings from file content.
 *
 * Handles:
 * - import X from 'specifier'
 * - import { X } from 'specifier'
 * - import * as X from 'specifier'
 * - import 'specifier' (side-effect)
 * - export { X } from 'specifier'
 * - export * from 'specifier'
 * - const X = require('specifier')
 * - require('specifier')
 *
 * Does NOT handle:
 * - Dynamic import()
 * - Template literal requires
 * - Re-exports with renaming
 */

// Matches: import ... from 'specifier' and import 'specifier'
const ES_IMPORT_FROM = /import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g

// Matches: export ... from 'specifier'
const ES_EXPORT_FROM = /export\s+(?:[\s\S]*?\s+from\s+)['"]([^'"]+)['"]/g

// Matches: require('specifier') or require("specifier")
const CJS_REQUIRE = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g

export type ImportKind = 'code' | 'css' | 'asset'

export interface ParsedImport {
  specifier: string
  isLocal: boolean // starts with . or /
  importKind: ImportKind
}

export function parseImports(content: string): ParsedImport[] {
  const specifiers = new Set<string>()

  // Strip block comments and single-line comments to avoid false matches
  const stripped = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')

  for (const regex of [ES_IMPORT_FROM, ES_EXPORT_FROM, CJS_REQUIRE]) {
    let match
    // Reset lastIndex since we reuse the regexes
    regex.lastIndex = 0
    while ((match = regex.exec(stripped)) !== null) {
      const spec = match[1]
      if (spec) {
        specifiers.add(spec)
      }
    }
  }

  return Array.from(specifiers).map((specifier) => ({
    specifier,
    isLocal: specifier.startsWith('.') || specifier.startsWith('/'),
    importKind: classifyImport(specifier),
  }))
}

function classifyImport(specifier: string): ImportKind {
  if (/\.css$/.test(specifier)) return 'css'
  if (/\.s[ac]ss$/.test(specifier)) return 'css'
  if (/\.less$/.test(specifier)) return 'css'
  if (/\.(png|jpe?g|gif|svg|webp|ico|avif|bmp|tiff?)$/i.test(specifier)) return 'asset'
  if (/\.(woff2?|ttf|eot|otf)$/i.test(specifier)) return 'asset'
  if (/\.(mp4|webm|ogg|mp3|wav|flac)$/i.test(specifier)) return 'asset'
  if (/\.(pdf|json5?)$/i.test(specifier)) return 'asset'
  return 'code'
}

/**
 * Extract the package name from an import specifier.
 * Handles scoped packages like @org/pkg.
 */
export function extractPackageName(specifier: string): string {
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/')
    return parts.slice(0, 2).join('/')
  }
  return specifier.split('/')[0]!
}
