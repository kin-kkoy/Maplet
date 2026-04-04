import type { DirectoryEntry, FsAdapter } from './fsAdapter'

/**
 * Check if the modern File System Access API is available.
 */
function hasNativeFsAccess(): boolean {
  return typeof window.showDirectoryPicker === 'function'
}

// ─────────────────────────────────────────────
// Native adapter (Chrome/Edge)
// ─────────────────────────────────────────────

class NativeBrowserFsAdapter implements FsAdapter {
  private rootHandle: FileSystemDirectoryHandle | null = null
  private rootName = ''

  async pickProjectDirectory(): Promise<string> {
    this.rootHandle = await window.showDirectoryPicker({ mode: 'read' })
    this.rootName = this.rootHandle.name
    return this.rootName
  }

  async listDirectory(path: string): Promise<DirectoryEntry[]> {
    const dir = await this.resolveDirectory(path)
    const entries: DirectoryEntry[] = []
    for await (const [name, handle] of dir.entries()) {
      entries.push({ name, kind: handle.kind })
    }
    entries.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    return entries
  }

  async readTextFile(path: string): Promise<string> {
    const fileHandle = await this.resolveFile(path)
    const file = await fileHandle.getFile()
    return file.text()
  }

  async writeTextFile(_path: string, _content: string): Promise<void> {
    // Persistence is handled by localStorage, not the scan adapter
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      await this.resolveFile(path)
      return true
    } catch {
      return false
    }
  }

  getProjectName(): string {
    return this.rootName
  }

  getProjectRoot(): string {
    return this.rootName
  }

  private getRootHandle(): FileSystemDirectoryHandle {
    if (!this.rootHandle) throw new Error('No project directory selected.')
    return this.rootHandle
  }

  private async resolveDirectory(path: string): Promise<FileSystemDirectoryHandle> {
    const root = this.getRootHandle()
    if (path === '.' || path === '' || path === '/') return root
    const parts = path.split('/').filter(Boolean)
    let current = root
    for (const part of parts) {
      current = await current.getDirectoryHandle(part)
    }
    return current
  }

  private async resolveFile(path: string): Promise<FileSystemFileHandle> {
    const parts = path.split('/').filter(Boolean)
    const fileName = parts.pop()
    if (!fileName) throw new Error('Invalid file path')
    let dir = this.getRootHandle()
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part)
    }
    return dir.getFileHandle(fileName)
  }
}

// ─────────────────────────────────────────────────────────
// Fallback adapter (Firefox/Safari — read via <input>)
// ─────────────────────────────────────────────────────────

interface InMemoryFile {
  kind: 'file'
  content: string
}
interface InMemoryDir {
  kind: 'directory'
  children: Map<string, InMemoryFile | InMemoryDir>
}

class FallbackBrowserFsAdapter implements FsAdapter {
  private root: InMemoryDir = { kind: 'directory', children: new Map() }
  private rootName = ''

  async pickProjectDirectory(): Promise<string> {
    const files = await this.pickFilesViaInput()
    await this.buildTree(files)
    return this.rootName
  }

  async listDirectory(path: string): Promise<DirectoryEntry[]> {
    const dir = this.resolveDir(path)
    if (!dir) throw new Error(`Directory not found: ${path}`)
    const entries: DirectoryEntry[] = []
    for (const [name, entry] of dir.children) {
      entries.push({ name, kind: entry.kind })
    }
    entries.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    return entries
  }

  async readTextFile(path: string): Promise<string> {
    const node = this.resolveNode(path)
    if (!node || node.kind !== 'file') throw new Error(`File not found: ${path}`)
    return node.content
  }

  async writeTextFile(_path: string, _content: string): Promise<void> {
    // Persistence is handled by localStorage, not the scan adapter
  }

  async fileExists(path: string): Promise<boolean> {
    return this.resolveNode(path) !== null
  }

  getProjectName(): string {
    return this.rootName
  }

  getProjectRoot(): string {
    return this.rootName
  }

  // ─── Private ───

  private pickFilesViaInput(): Promise<FileList> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.setAttribute('webkitdirectory', '')
      input.setAttribute('directory', '')
      input.multiple = true

      input.onchange = () => {
        if (input.files && input.files.length > 0) {
          resolve(input.files)
        } else {
          reject(new Error('No files selected'))
        }
      }
      input.oncancel = () => reject(new DOMException('User cancelled', 'AbortError'))
      input.click()
    })
  }

  private async buildTree(files: FileList) {
    this.root = { kind: 'directory', children: new Map() }

    const firstPath = files[0]?.webkitRelativePath ?? ''
    this.rootName = firstPath.split('/')[0] ?? 'project'

    for (let i = 0; i < files.length; i++) {
      const file = files[i]!
      const relativePath = file.webkitRelativePath
      const parts = relativePath.split('/')
      parts.shift() // remove root folder name
      if (parts.length === 0) continue

      let content = ''
      const isTextLike =
        /\.(js|jsx|ts|tsx|json|md|txt|css|html|yml|yaml|toml|xml|svg|sh|env|gitignore|eslintrc|prettierrc|lock)$/i.test(
          file.name,
        ) || !file.name.includes('.')

      if (isTextLike && file.size < 1_000_000) {
        try {
          content = await file.text()
        } catch {
          content = ''
        }
      }

      let dir = this.root
      for (let j = 0; j < parts.length - 1; j++) {
        const part = parts[j]!
        let child = dir.children.get(part)
        if (!child || child.kind !== 'directory') {
          child = { kind: 'directory', children: new Map() }
          dir.children.set(part, child)
        }
        dir = child
      }

      const fileName = parts[parts.length - 1]!
      dir.children.set(fileName, { kind: 'file', content })
    }
  }

  private resolveDir(path: string): InMemoryDir | null {
    if (path === '.' || path === '' || path === '/') return this.root
    const parts = path.split('/').filter(Boolean)
    let current: InMemoryDir = this.root
    for (const part of parts) {
      const child = current.children.get(part)
      if (!child || child.kind !== 'directory') return null
      current = child
    }
    return current
  }

  private resolveNode(path: string): InMemoryFile | InMemoryDir | null {
    const parts = path.split('/').filter(Boolean)
    if (parts.length === 0) return this.root
    const fileName = parts.pop()!
    let dir = this.root
    for (const part of parts) {
      const child = dir.children.get(part)
      if (!child || child.kind !== 'directory') return null
      dir = child
    }
    return dir.children.get(fileName) ?? null
  }
}

// ─────────────────────────────
// Factory — picks the right one
// ─────────────────────────────

export class BrowserFsAdapter implements FsAdapter {
  private inner: FsAdapter

  constructor() {
    this.inner = hasNativeFsAccess()
      ? new NativeBrowserFsAdapter()
      : new FallbackBrowserFsAdapter()
  }

  pickProjectDirectory() { return this.inner.pickProjectDirectory() }
  listDirectory(path: string) { return this.inner.listDirectory(path) }
  readTextFile(path: string) { return this.inner.readTextFile(path) }
  writeTextFile(path: string, content: string) { return this.inner.writeTextFile(path, content) }
  fileExists(path: string) { return this.inner.fileExists(path) }
  getProjectName() { return this.inner.getProjectName() }
  getProjectRoot() { return this.inner.getProjectRoot() }
}
