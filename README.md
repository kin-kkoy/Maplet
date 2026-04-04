# RoadMap

- Currently implemented: V1

---

## V2 Feature List

### 1) Better Scan Intelligence

#### Early V2

- **Alias import resolution**
  - Resolve imports like `@/components/Button`
  - Treat alias-resolved relationships as a visual variant of normal cross-file relationships
  - Use a subtle different edge style, such as a curved dashed line

- **Better import parsing**
  - Improve parsing beyond only the simplest import forms
  - Support:
    - `import x from "./file"`
    - `import { x } from "./file"`
    - `import * as x from "./file"`
    - `require("module")`
    - side-effect imports like `import "./setup"`
    - re-exports like `export { x } from "./file"` and `export * from "./file"`

- **More JS/TS pattern support**
  - Barrel files like `index.ts`
  - Re-export patterns
  - CSS imports inside JS/TS
  - Asset imports inside JS/TS
  - Common project structure patterns in JS/TS repos

#### Mid V2

- **Smarter hidden-connection detection**
  - Make `Other connections (x)` more meaningful
  - Prefer better prioritization of what gets grouped
  - Avoid grouping everything in a blunt way
  - Surface more relevant nearby or same-feature relationships first

- **Basic file-type awareness**
  - `.json`
  - `.css`
  - `.module.css`
  - `.scss`
  - `.md`
  - Image files: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg` (recommended)
  - Notes:
    - This is awareness, not deep parsing
    - The app should recognize these files, create proper nodes for them, and understand when JS/TS imports them

#### Later V2

- **Lightweight rename matching**
  - Try to detect probable rename instead of always delete + add
  - Goal is to preserve layout, descriptions, aliases, and manual links when possible
  - Keep it heuristic/lightweight, not Git-level rename detection

---

### 2) Better User Meaning Layer

#### Early V2

- **Manual tags**
  - User-defined tags like: `auth`, `db`, `entrypoint`, `critical`, `ui`, `todo`, `refactor`
  - Multi-tag support
  - Manual only

- **Pinning / starring important nodes**
  - Mark important files/nodes
  - Helps with quick recall and future filtering/navigation

- **Manual grouping / cluster nodes**
  - User-defined conceptual groups
  - Not the same as scanned folders
  - Examples: `Authentication Area`, `Shared Validation`, `Frontend Settings Cluster`

#### Mid V2

- **Action Nodes**
  - Special node type for flow/action context
  - Examples: `Create Document`, `Login Flow`, `Upload Image`
  - Manually linked to relevant nodes
  - Double-click: highlight involved nodes and edges, optionally play a subtle flow animation
  - Long-click or alternate action: dim unrelated nodes, focus only the action-related nodes and edges
  - Add via dock, e.g. `Add Action Node`

- **Better note-to-node relationships**
  - Notes can be more expressive and connected more intentionally
  - Improve how notes attach to one or more nodes
  - Allow richer relationship meaning without overcomplicating the product

#### Later V2

- **Color labels**
  - Small controlled palette only
  - Should not replace node-type colors
  - Should not dominate the outline
  - Apply as a subtle internal tint / gradient-like accent
  - Used as an extra semantic signal, not the main visual identity

---

### 3) Better Navigation and Cleanup

#### Early V2

- **Filters**
  - Show only files
  - Show only folders
  - Show only notes
  - Show only action nodes
  - Show only pinned/starred
  - Show only specific tags
  - Hide helper nodes
  - Hide package nodes
  - Hide orphaned/unresolved items

- **Hide helper nodes temporarily**
  - Quick toggle for helper nodes
  - Includes: `Packages (x)`, `Other connections (x)`, package nodes, other helper-style nodes

- **Better search**
  - Search by: name, path, alias, tags, note content, node type, pinned/starred, file extension

- **Better layout / orientation tools**
  - Center selected node
  - Center root
  - Fit visible nodes
  - Recenter selected cluster
  - Align selected nodes
  - Evenly space selected nodes
  - Straighten a branch

#### Mid V2

- **Minimap**
  - Small overview of the full board
  - Shows rough node positions and current viewport
  - Optional toggle
  - Click to jump to another area

- **Focus mode**
  - Persistent emphasis mode
  - Dim unrelated nodes
  - Highlight only selected context
  - Can focus: selected node, selected cluster, selected action node

- **Auto tidy / auto arrange menu**
  - Tidy selected branch
  - Tidy visible nodes
  - Tidy children of selected node
  - Reset helper node spacing
  - Tidy local cluster

- **Bulk cleanup actions**
  - Collapse all
  - Collapse all except selected branch
  - Hide all helper nodes
  - Clear temporary highlights
  - Hide orphaned items
  - Reset temporary filters

#### Later V2

- **Saved views / saved focus states**
  - Save current focus/filter/layout state
  - Reopen important working contexts later

---

### 4) Better Desktop Usability

#### Already partially implemented / continue improving

- **Recent projects list**
  - Currently exists
  - Currently limited to 7
  - Currently stored locally for browser-hosted testing/QA

- **Reopen previous map state**
  - Currently restores the last opened view for known recent projects
  - Opened nodes and prior context already come back

- **Keyboard-first quality-of-life**
  - Already partially implemented
  - Current shortcuts include:

  | Category | Shortcut | Action |
  |----------|----------|--------|
  | Navigation | Space+Drag | Pan the canvas |
  | Navigation | Scroll | Zoom in / out |
  | Navigation | Ctrl+F | Search nodes |
  | Navigation | / | Search nodes |
  | Nodes | Click | Expand or collapse a node |
  | Nodes | Double Click | Open detail card |
  | Nodes | Ctrl+Drag | Group move — drag node with all descendants |
  | Nodes | Hover | Show reorder arrows (if node has siblings) |
  | Other Connections / Packages / Config | Click | Expand — show connected nodes and edges |
  | Other Connections / Packages / Config | Click again | Collapse — move connected nodes back to their real parent |
  | Other Connections / Packages / Config | Shift+Click | Force collapse — hide connected nodes everywhere |
  | General | Ctrl+Z | Undo |
  | General | Ctrl+Shift+Z | Redo |
  | General | Esc | Close panel / cancel action |

#### V2 / V2.5 Additions

- **Better project switching**
  - Pinned/favorite projects
  - Remove from recents
  - Project display label
  - Better sorting/order

- **Smoother reopen behavior**
  - Restore viewport
  - Restore active filters/focus mode
  - Stale-map prompt when appropriate

- **Better persistence reliability**
  - Safer JSON writes
  - Avoid map corruption
  - Graceful recovery from invalid/corrupt JSON

- **Better warnings/issues panel**
  - Grouped issue categories
  - Readable issue list
  - Unresolved imports
  - Unreadable files
  - Unsupported file types
  - Orphaned manual links
  - Click issue to inspect related item when possible

- **Export / import map file**
  - Export current map
  - Import map
  - Duplicate map as snapshot/backup

- **Backup / snapshot behavior**
  - Keep last good backup
  - Optional snapshot before rescan
  - Recover previous state if write fails

- **Open in editor / reveal in file manager**
  - Open file in default editor
  - Reveal file in file manager
  - Copy file path
  - Optional later: open project root in terminal

#### Final Step

- **Tauri / real desktop host**
  - Move from browser prototype host to proper desktop app host
  - Do this after core features are already working well

---

## V3 Feature List

### Core V3

- **Language expansion**
  - C
  - Java
  - GDScript
  - Python
  - C#
  - C++
  - Implementation cycle:
    Tackle Language → structure support first → relationship parsing support → language-specific extras only if worth it → repeat for the next language

- **Data flow / action flow import**
  - User-controlled
  - Not auto-generated by the app
  - Schema-based
  - Paste structured input or import JSON/file
  - Editable after import
  - Validated before apply

- **Semantic payload import**
  - One uniform structured schema
  - Supports: aliases, descriptions, tags, groupings, action nodes, manual links, notes

- **Better validation tools**
  - Missing file references
  - Missing node references
  - Invalid relation types
  - Duplicate IDs
  - Outdated imported references
  - Invalid flow structure

### Important V3 Addition

- **Import preview / review step**
  - Show what will be added
  - Show what matched
  - Show what failed
  - Show validation warnings
  - Let user confirm before apply

### Later / Optional V3

- **Advanced semantic views**
  - Show only action flows
  - Compare two flows in one board view:
    - Shared nodes are highlighted one way
    - Nodes unique to Flow A are highlighted another way
    - Nodes unique to Flow B are highlighted another way
  - Show overlap between flows
  - Highlight reused nodes across flows

- **Better import/export ecosystem**
  - Export semantic payload
  - Export selected subgraph
  - Export single flow definition
  - Import reusable semantic templates

---

## V4 Feature List

### Core V4

- **Multi-project workspace view**
  - Load up to 3 project maps into one whiteboard view
  - Intended for related repositories only
  - Examples:
    - Frontend + backend + shared library
    - App + API + docs/tooling repo
    - Game project + backend + tools

- **Workspace mode**
  - Separate mode from single-project view
  - Projects are hosted together in one board, not merged into one giant project graph
  - Each project remains separately identifiable

- **Separate project roots**
  - Each loaded project appears as its own root cluster
  - Each project keeps: its own root node, its own visual identity/accent family, its own saved state, its own map file

- **Manual or imported cross-project relationships**
  - Cross-project links are not auto-generated by the app
  - Cross-project relationships must be: manual, or imported through semantic payloads / action flows

- **Workspace-level action nodes**
  - Action/flow nodes can connect nodes across multiple project maps
  - Examples: `User Login Flow`, `Create Document Flow`, `Upload Asset Flow`
  - This is one of the main reasons for having multi-project view

### Workspace UX Rules

- Max 3 project maps loaded at once
- Each project starts collapsed or at a shallow overview state
- User expands only what matters
- Project-level visibility toggles are required
- Minimap becomes important
- Filters and focus mode become essential

### Workspace Data Model

- Each project map file remains separate
- Add a workspace file that stores:
  - Which project maps are loaded
  - Root positions of each project in the workspace
  - Workspace-only manual links
  - Workspace-level action nodes
  - Workspace filters / focus state / saved workspace state

### Performance / Practicality Rules

- Keep lazy reveal behavior
- Do not auto-expand whole projects
- Do not auto-assume cross-project meaning
- Preserve readability over completeness
- Biggest risk is board overload, so emphasis and filtering must be strong

### Summary

> V4 = multi-project workspace view for up to 3 related project maps, with workspace-level action flows and manual/imported cross-project relationships
