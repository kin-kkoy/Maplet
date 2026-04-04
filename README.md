# RoadMap
- Currently implemented: V1

### V2 FEATURE LIST

==================================================
1) BETTER SCAN INTELLIGENCE
==================================================

Early V2
- Alias import resolution
  - Resolve imports like `@/components/Button`
  - Treat alias-resolved relationships as a visual variant of normal cross-file relationships
  - Use a subtle different edge style, such as a curved dashed line

- Better import parsing
  - Improve parsing beyond only the simplest import forms
  - Support:
    - `import x from "./file"`
    - `import { x } from "./file"`
    - `import * as x from "./file"`
    - `require("module")`
    - side-effect imports like `import "./setup"`
    - re-exports like `export { x } from "./file"` and `export * from "./file"`

- More JS/TS pattern support
  - Barrel files like `index.ts`
  - Re-export patterns
  - CSS imports inside JS/TS
  - Asset imports inside JS/TS
  - Common project structure patterns in JS/TS repos

Mid V2
- Smarter hidden-connection detection
  - Make `Other connections (x)` more meaningful
  - Prefer better prioritization of what gets grouped
  - Avoid grouping everything in a blunt way
  - Surface more relevant nearby or same-feature relationships first

- Basic file-type awareness
  - `.json`
  - `.css`
  - `.module.css`
  - `.scss`
  - `.md`
  - image files:
    - `.png`
    - `.jpg`
    - `.jpeg`
    - `.gif`
    - `.webp`
    - `.svg` (recommended)

  Notes:
  - This is awareness, not deep parsing
  - The app should recognize these files, create proper nodes for them, and understand when JS/TS imports them

Later V2
- Lightweight rename matching
  - Try to detect probable rename instead of always delete + add
  - Goal is to preserve layout, descriptions, aliases, and manual links when possible
  - Keep it heuristic/lightweight, not Git-level rename detection

==================================================
2) BETTER USER MEANING LAYER
==================================================

Early V2
- Manual tags
  - User-defined tags like:
    - `auth`
    - `db`
    - `entrypoint`
    - `critical`
    - `ui`
    - `todo`
    - `refactor`
  - Multi-tag support
  - Manual only

- Pinning / starring important nodes
  - Mark important files/nodes
  - Helps with quick recall and future filtering/navigation

- Manual grouping / cluster nodes
  - User-defined conceptual groups
  - Not the same as scanned folders
  - Examples:
    - `Authentication Area`
    - `Shared Validation`
    - `Frontend Settings Cluster`

Mid V2
- Action Nodes
  - Special node type for flow/action context
  - Examples:
    - `Create Document`
    - `Login Flow`
    - `Upload Image`
  - Manually linked to relevant nodes
  - Double-click:
    - highlight involved nodes and edges
    - optionally play a subtle flow animation
  - Long-click or alternate action:
    - dim unrelated nodes
    - focus only the action-related nodes and edges
  - Add via dock, e.g. `Add Action Node`

- Better note-to-node relationships
  - Notes can be more expressive and connected more intentionally
  - Improve how notes attach to one or more nodes
  - Allow richer relationship meaning without overcomplicating the product

Later V2
- Color labels
  - Small controlled palette only
  - Should not replace node-type colors
  - Should not dominate the outline
  - Apply as a subtle internal tint / gradient-like accent
  - Used as an extra semantic signal, not the main visual identity

==================================================
3) BETTER NAVIGATION AND CLEANUP
==================================================

3) BETTER NAVIGATION AND CLEANUP

Early V2
- Filters
  - show only files
  - show only folders
  - show only notes
  - show only action nodes
  - show only pinned/starred
  - show only specific tags
  - hide helper nodes
  - hide package nodes
  - hide orphaned/unresolved items

- Hide helper nodes temporarily
  - quick toggle for helper nodes
  - includes:
    - Packages (x)
    - Other connections (x)
    - package nodes
    - other helper-style nodes

- Better search
  - search by:
    - name
    - path
    - alias
    - tags
    - note content
    - node type
    - pinned/starred
    - file extension

- Better layout / orientation tools
  - center selected node
  - center root
  - fit visible nodes
  - recenter selected cluster
  - align selected nodes
  - evenly space selected nodes
  - straighten a branch

Mid V2
- Minimap
  - small overview of the full board
  - shows rough node positions and current viewport
  - optional toggle
  - click to jump to another area

- Focus mode
  - persistent emphasis mode
  - dim unrelated nodes
  - highlight only selected context
  - can focus:
    - selected node
    - selected cluster
    - selected action node

- Auto tidy / auto arrange menu
  - tidy selected branch
  - tidy visible nodes
  - tidy children of selected node
  - reset helper node spacing
  - tidy local cluster

- Bulk cleanup actions
  - collapse all
  - collapse all except selected branch
  - hide all helper nodes
  - clear temporary highlights
  - hide orphaned items
  - reset temporary filters

Later V2
- Saved views / saved focus states
  - save current focus/filter/layout state
  - reopen important working contexts later

==================================================
4) Better desktop usability
==================================================

4) BETTER DESKTOP USABILITY

Already partially implemented / continue improving
- Recent projects list
  - currently exists
  - currently limited to 7
  - currently stored locally for browser-hosted testing/QA

- Reopen previous map state
  - currently restores the last opened view for known recent projects
  - opened nodes and prior context already come back

- Keyboard-first quality-of-life
  - already partially implemented
  - current shortcuts include:

  Navigation
  - Space+Drag : Pan the canvas
  - Scroll : Zoom in / out
  - Ctrl+F : Search nodes
  - / : Search nodes

  Nodes
  - Click : Expand or collapse a node
  - Double Click : Open detail card
  - Ctrl+Drag : Group move — drag node with all descendants
  - Hover : Show reorder arrows (if node has siblings)

  Other Connections / Packages / Config
  - Click : Expand — show connected nodes and edges
  - Click again : Collapse — move connected nodes back to their real parent
  - Shift+Click : Force collapse — hide connected nodes everywhere

  General
  - Ctrl+Z : Undo
  - Ctrl+Shift+Z : Redo
  - Esc : Close panel / cancel action

V2 / V2.5 additions
- Better project switching
  - pinned/favorite projects
  - remove from recents
  - project display label
  - better sorting/order

- Smoother reopen behavior
  - restore viewport
  - restore active filters/focus mode
  - stale-map prompt when appropriate

- Better persistence reliability
  - safer JSON writes
  - avoid map corruption
  - graceful recovery from invalid/corrupt JSON

- Better warnings/issues panel
  - grouped issue categories
  - readable issue list
  - unresolved imports
  - unreadable files
  - unsupported file types
  - orphaned manual links
  - click issue to inspect related item when possible

- Export / import map file
  - export current map
  - import map
  - duplicate map as snapshot/backup

- Backup / snapshot behavior
  - keep last good backup
  - optional snapshot before rescan
  - recover previous state if write fails

- Open in editor / reveal in file manager
  - open file in default editor
  - reveal file in file manager
  - copy file path
  - optional later: open project root in terminal

Final step
- Tauri / real desktop host
  - move from browser prototype host to proper desktop app host
  - do this after core features are already working well



### V3 FEATURE LIST

Core V3
- Language expansion
  - C
  - Java
  - GDScript
  - Python
  - C#
  - C++
  - implementation cycle:
    Tackle Language
    → structure support first
    → relationship parsing support
    → language-specific extras only if worth it
    → repeat for the next language

- Data flow / action flow import
  - user-controlled
  - not auto-generated by the app
  - schema-based
  - paste structured input or import JSON/file
  - editable after import
  - validated before apply

- Semantic payload import
  - one uniform structured schema
  - supports:
    - aliases
    - descriptions
    - tags
    - groupings
    - action nodes
    - manual links
    - notes

- Better validation tools
  - missing file references
  - missing node references
  - invalid relation types
  - duplicate IDs
  - outdated imported references
  - invalid flow structure

Important V3 addition
- Import preview / review step
  - show what will be added
  - show what matched
  - show what failed
  - show validation warnings
  - let user confirm before apply

Later / optional V3
- Advanced semantic views
  - show only action flows
  - compare two flows in one board view:
    - shared nodes are highlighted one way
    - nodes unique to Flow A are highlighted another way
    - nodes unique to Flow B are highlighted another way
  - show overlap between flows
  - highlight reused nodes across flows

- Better import/export ecosystem
  - export semantic payload
  - export selected subgraph
  - export single flow definition
  - import reusable semantic templates


### V4 FEATURE LIST

Core V4
- Multi-project workspace view
  - load up to 3 project maps into one whiteboard view
  - intended for related repositories only
  - examples:
    - frontend + backend + shared library
    - app + API + docs/tooling repo
    - game project + backend + tools

- Workspace mode
  - separate mode from single-project view
  - projects are hosted together in one board, not merged into one giant project graph
  - each project remains separately identifiable

- Separate project roots
  - each loaded project appears as its own root cluster
  - each project keeps:
    - its own root node
    - its own visual identity/accent family
    - its own saved state
    - its own map file

- Manual or imported cross-project relationships
  - cross-project links are not auto-generated by the app
  - cross-project relationships must be:
    - manual
    - or imported through semantic payloads / action flows

- Workspace-level action nodes
  - action/flow nodes can connect nodes across multiple project maps
  - examples:
    - `User Login Flow`
    - `Create Document Flow`
    - `Upload Asset Flow`
  - this is one of the main reasons for having multi-project view

Workspace UX rules
- max 3 project maps loaded at once
- each project starts collapsed or at a shallow overview state
- user expands only what matters
- project-level visibility toggles are required
- minimap becomes important
- filters and focus mode become essential

Workspace data model
- each project map file remains separate
- add a workspace file that stores:
  - which project maps are loaded
  - root positions of each project in the workspace
  - workspace-only manual links
  - workspace-level action nodes
  - workspace filters / focus state / saved workspace state

Performance / practicality rules
- keep lazy reveal behavior
- do not auto-expand whole projects
- do not auto-assume cross-project meaning
- preserve readability over completeness
- biggest risk is board overload, so emphasis and filtering must be strong

Summary definition
- V4 = multi-project workspace view for up to 3 related project maps, with workspace-level action flows and manual/imported cross-project relationships