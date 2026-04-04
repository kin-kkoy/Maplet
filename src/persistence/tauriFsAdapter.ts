import type { DirectoryEntry, FsAdapter } from './fsAdapter'

/**
 * Tauri filesystem adapter — placeholder for the real local app.
 * Will use Tauri's fs and dialog APIs when integrated.
 */
export class TauriFsAdapter implements FsAdapter {
  private _projectRoot = ''
  private _projectName = ''

  async pickProjectDirectory(): Promise<string> {
    // TODO: Use Tauri's dialog.open({ directory: true })
    throw new Error('TauriFsAdapter not yet implemented. Use BrowserFsAdapter for prototyping.')
  }

  async listDirectory(_path: string): Promise<DirectoryEntry[]> {
    // TODO: Use Tauri's fs.readDir()
    throw new Error('TauriFsAdapter not yet implemented.')
  }

  async readTextFile(_path: string): Promise<string> {
    // TODO: Use Tauri's fs.readTextFile()
    throw new Error('TauriFsAdapter not yet implemented.')
  }

  async writeTextFile(_path: string, _content: string): Promise<void> {
    // TODO: Use Tauri's fs.writeTextFile()
    throw new Error('TauriFsAdapter not yet implemented.')
  }

  async fileExists(_path: string): Promise<boolean> {
    // TODO: Use Tauri's fs.exists()
    throw new Error('TauriFsAdapter not yet implemented.')
  }

  getProjectName(): string {
    return this._projectName
  }

  getProjectRoot(): string {
    return this._projectRoot
  }
}
