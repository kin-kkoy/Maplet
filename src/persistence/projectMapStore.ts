import type { ProjectMapSchema } from '../types'
import { createEmptyProjectMap, DEFAULT_FILTERS } from '../types'

const STORAGE_PREFIX = 'projectmap:'

/**
 * Sanitize a project name for use as a localStorage key.
 */
function storageKey(projectName: string): string {
  return `${STORAGE_PREFIX}${projectName}`
}

/**
 * Load a project map from localStorage.
 * Returns a fresh empty schema if none exists.
 */
export function loadProjectMap(projectName: string): ProjectMapSchema {
  const key = storageKey(projectName)
  const raw = localStorage.getItem(key)
  if (!raw) {
    return createEmptyProjectMap(projectName, projectName)
  }
  try {
    const data = JSON.parse(raw) as ProjectMapSchema
    // Backfill fields added after initial schema
    if (!data.user.childOrder) data.user.childOrder = {}
    // V2 backfills
    if (!data.user.userGroups) data.user.userGroups = {}
    if (!data.user.suppressedEdges) data.user.suppressedEdges = []
    if (!data.user.uiState.filters) {
      data.user.uiState.filters = { ...DEFAULT_FILTERS }
    }
    return data
  } catch {
    console.warn(`Corrupt project map for "${projectName}", starting fresh`)
    return createEmptyProjectMap(projectName, projectName)
  }
}

/**
 * Save a project map to localStorage.
 */
export function saveProjectMap(
  projectName: string,
  data: ProjectMapSchema,
): void {
  const key = storageKey(projectName)
  const updated: ProjectMapSchema = {
    ...data,
    meta: {
      ...data.meta,
      updatedAt: new Date().toISOString(),
    },
  }
  localStorage.setItem(key, JSON.stringify(updated))
}

/**
 * List all saved project map names from localStorage.
 */
export function listSavedProjects(): string[] {
  const names: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(STORAGE_PREFIX)) {
      names.push(key.slice(STORAGE_PREFIX.length))
    }
  }
  return names
}
