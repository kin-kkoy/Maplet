/**
 * Filesystem adapter contract.
 *
 * All scanning and persistence code uses this interface.
 * Browser prototype uses browserFsAdapter; Tauri version will use tauriFsAdapter.
 */

export interface DirectoryEntry {
  name: string
  kind: 'file' | 'directory'
}

export interface FsAdapter {
  /** Prompt the user to pick a project directory. Returns a root identifier. */
  pickProjectDirectory(): Promise<string>

  /** List entries in a directory at the given path (relative to project root). */
  listDirectory(path: string): Promise<DirectoryEntry[]>

  /** Read a text file at the given path (relative to project root). */
  readTextFile(path: string): Promise<string>

  /** Write a text file at the given path (relative to project root). */
  writeTextFile(path: string, content: string): Promise<void>

  /** Check if a file exists at the given path (relative to project root). */
  fileExists(path: string): Promise<boolean>

  /** Get the project root display name (folder name). */
  getProjectName(): string

  /** Get the project root path (for display purposes). */
  getProjectRoot(): string
}
