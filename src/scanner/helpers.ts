import type { ProjectMeta } from '../types'

const DEFAULT_OPAQUE = new Set([
  'node_modules',
  'dist',
  'build',
  '.next',
  'coverage',
  '.git',
  '.svn',
  '.hg',
  '__pycache__',
  '.cache',
  '.parcel-cache',
  '.turbo',
])

const PARSEABLE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx'])

/**
 * Config/dot files and folders that should be grouped into a single
 * circular "Config" group node instead of individual nodes.
 * package.json is explicitly excluded — it stays as a normal node.
 */
const CONFIG_FILE_PATTERNS = new Set([
  '.gitignore',
  '.gitattributes',
  '.gitmodules',
  '.editorconfig',
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  '.eslintrc.yml',
  '.eslintignore',
  '.prettierrc',
  '.prettierrc.js',
  '.prettierrc.cjs',
  '.prettierrc.json',
  '.prettierrc.yml',
  '.prettierignore',
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env.test',
  '.env.example',
  '.npmrc',
  '.nvmrc',
  '.node-version',
  '.yarnrc',
  '.yarnrc.yml',
  '.babelrc',
  '.babelrc.js',
  '.browserslistrc',
  '.stylelintrc',
  '.stylelintrc.json',
  '.dockerignore',
  '.huskyrc',
  '.lintstagedrc',
  '.commitlintrc',
  '.commitlintrc.json',
  '.tool-versions',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  '.vscode',
  '.idea',
  'Makefile',
  'Procfile',
  'jest.config.js',
  'jest.config.ts',
  'vitest.config.ts',
  'vitest.config.js',
  'tsconfig.json',
  'tsconfig.node.json',
  'tsconfig.build.json',
  'jsconfig.json',
  'babel.config.js',
  'babel.config.json',
  'webpack.config.js',
  'webpack.config.ts',
  'rollup.config.js',
  'rollup.config.ts',
  'vite.config.ts',
  'vite.config.js',
  'postcss.config.js',
  'postcss.config.cjs',
  'tailwind.config.js',
  'tailwind.config.ts',
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',
  'nuxt.config.ts',
  'turbo.json',
  'nx.json',
  'lerna.json',
  'pnpm-workspace.yaml',
  'pnpm-lock.yaml',
  'yarn.lock',
  'package-lock.json',
  'bun.lockb',
  'LICENSE',
  'LICENSE.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  '.travis.yml',
  'netlify.toml',
  'vercel.json',
  'renovate.json',
])

/**
 * Check if a file/folder should be grouped into the config group.
 * package.json is explicitly kept as a normal node.
 */
export function isConfigItem(name: string): boolean {
  if (name === 'package.json') return false
  // Exact match
  if (CONFIG_FILE_PATTERNS.has(name)) return true
  // Dotfiles / dot-folders not already in the set
  if (name.startsWith('.') && name !== '.') return true
  // Lock files
  if (name.endsWith('.lock') || name.endsWith('.lockb')) return true
  return false
}

export function isIgnored(name: string, ignoreRules: string[]): boolean {
  return ignoreRules.includes(name)
}

export function isOpaque(name: string, meta: ProjectMeta): boolean {
  const custom = new Set(meta.specialOpaqueFolders)
  return custom.has(name) || DEFAULT_OPAQUE.has(name)
}

export function isParseable(fileName: string): boolean {
  const ext = getExtension(fileName)
  return PARSEABLE_EXTENSIONS.has(ext)
}

export function isBarrelFile(fileName: string): boolean {
  return /^index\.(ts|tsx|js|jsx)$/.test(fileName)
}

export function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  if (dot === -1) return ''
  return fileName.slice(dot).toLowerCase()
}

export function makeNodeId(
  type: 'project' | 'folder' | 'file' | 'special' | 'package_group' | 'package' | 'hidden_connections_group',
  path: string,
): string {
  if (type === 'project') return 'project:root'
  if (type === 'special') return `special:${path}`
  if (type === 'package') return `package:${path}`
  if (type === 'package_group') return `pkggrp:${path}`
  if (type === 'hidden_connections_group') return `othergrp:${path}`
  return `${type}:${path}`
}

export function makeEdgeId(
  source: string,
  target: string,
  type: string,
): string {
  return `edge:${source}->${target}:${type}`
}

/**
 * Resolve a relative import specifier to a file path.
 * Tries multiple extensions and index files.
 */
export async function resolveImportPath(
  currentFilePath: string,
  specifier: string,
  fileExists: (path: string) => Promise<boolean>,
): Promise<string | null> {
  // Get directory of the importing file
  const dirParts = currentFilePath.split('/')
  dirParts.pop() // Remove filename
  const dir = dirParts.join('/')

  // Resolve relative path
  const parts = specifier.split('/')
  const resolved: string[] = dir ? dir.split('/') : []

  for (const part of parts) {
    if (part === '.') continue
    if (part === '..') {
      resolved.pop()
    } else {
      resolved.push(part)
    }
  }

  const basePath = resolved.join('/')

  // Try exact match first
  if (await fileExists(basePath)) return basePath

  // Try with extensions
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
