## Plan: Build Multi-Tab Markdown Editor with State Persistence

Build a tabbed Markdown editor Electron app supporting multiple files, dual view modes (Markdown/Plain Text), save state tracking, menu/toolbar operations, and persistent configuration following component-based React architecture with feature organization.

## Technology Stack & Architecture

### Electron Architecture (v36.2.0)
**Process Model**: Electron uses multi-process architecture with Main Process (Node.js) and Renderer Process (Chromium/React).

**Current Security Issue**: [main.ts](src/main/main.ts) has `nodeIntegration: true` and `contextIsolation: false` which exposes Node.js APIs directly to renderer—**must be fixed** for production.

**Key Electron Modules Required**:

**Main Process** ([src/main/main.ts](src/main/main.ts)):
- `app` — Application lifecycle (`app.getPath('userData')` for config storage, `app.quit()`, `whenReady()`, window management)
- `BrowserWindow` — Window creation/management with secure `webPreferences`, `setTitle()` for dynamic window title
- `dialog` — Native OS dialogs (`dialog.showOpenDialog()` for file picker, `dialog.showSaveDialog()` for save as, `dialog.showMessageBox()` for confirmations)
- `Menu` / `MenuItem` — Native application menu bar with keyboard accelerators (File menu with dynamic recent files list)
- `ipcMain` — Inter-Process Communication listener for renderer requests (file operations, config management)
- `shell` — OS integration (`shell.showItemInFolder()` for "Open in Containing Folder" feature)
- Node.js `fs` / `fs.promises` — File system operations (read/write markdown files, config.json, detect line endings)
- `fs.watch()` or `chokidar` — File system watching for external change detection

**Renderer Process** ([src/renderer](src/renderer)):
- `ipcRenderer` (via preload script) — Send requests to main process, receive responses
- React 19.1.0 with TypeScript for UI
- Material-UI 7.3.6 (@mui/material, @mui/icons-material) for components/icons
- `react-markdown` + `remark-gfm` — Markdown rendering with GitHub Flavored Markdown

**IPC Communication Pattern**:
```
Renderer → ipcRenderer.invoke('channel-name', data) → Main Process
Main Process → ipcMain.handle('channel-name', async (event, data) => { ... }) → Return result
```

**Required IPC Channels**:
- `file:new` — Create new untitled file in memory
- `file:open` — Trigger file picker, return file path + content + line ending format
- `file:save` — Save content to existing file path, preserve line endings
- `file:save-as` — Trigger save dialog, save to new path
- `file:read` — Read file content by path
- `file:watch` — Start watching file for external changes
- `file:unwatch` — Stop watching file
- `config:load` — Load config.json from userData directory
- `config:save` — Save config.json to userData directory
- `menu:recent-file-clicked` — Handle recent file selection from menu
- `dialog:confirm-close` — Show confirmation dialog for unsaved changes
- `dialog:external-change` — Notify user of external file modification
- `window:set-title` — Update window title with filename

### Required Dependencies
**To Install**:
```bash
npm install react-markdown remark-gfm
npm install --save-dev @types/node
```

**Optional**:
- `react-split` — Split-pane editing (edit + preview side-by-side)
- `chokidar` — Robust file watching (better than fs.watch)

## Steps

### 1. Fix security and establish Electron preload architecture
Create `src/main/preload.ts` with `contextBridge.exposeInMainWorld()` to safely expose IPC methods to renderer, update [main.ts](src/main/main.ts) BrowserWindow to enable `contextIsolation: true`, `nodeIntegration: false`, and `preload` script path, add webpack config entry for preload script compilation with `target: 'electron-preload'`, define TypeScript global interface in `src/renderer/types/global.d.ts` declaring `window.electronAPI` methods with proper signatures.

### 2. Implement Main Process IPC handlers and native integrations
In [main.ts](src/main/main.ts), import `dialog`, `Menu`, `ipcMain`, `shell`, `fs.promises`, create `ipcMain.handle()` handlers for all file operations:
- Use `dialog.showOpenDialog({ filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }], properties: ['openFile'] })` for file picker
- Implement `fs.promises.readFile()` with UTF-8 encoding, detect line endings (CRLF vs LF) using regex on content
- Implement `fs.promises.writeFile()` preserving original line ending format
- Build config manager using `app.getPath('userData')` + `/config.json` with JSON read/write
- Create dynamic Menu template with `Menu.buildFromTemplate()`:
  - File submenu with keyboard accelerators (`accelerator: 'CmdOrCtrl+N'` for New, `CmdOrCtrl+O` for Open, `CmdOrCtrl+S` for Save, `CmdOrCtrl+Shift+S` for Save As, `CmdOrCtrl+W` for Close)
  - Platform-specific app menu for macOS using `process.platform === 'darwin'` check
  - Dynamic recent files section (max 10) that rebuilds on config updates
- Implement duplicate file detection—check if path already open before adding tab
- Add file watcher using `fs.watch()` or `chokidar` to detect external modifications

### 3. Create project structure and TypeScript infrastructure
Establish folders: `src/renderer/components` (TabBar, FileTab, Toolbar, EditorPane, EmptyState, NotificationSnackbar), `src/renderer/hooks` (useFileOperations, useConfigPersistence, useWindowTitle, useFileWatcher), `src/renderer/contexts` (EditorContext), `src/renderer/types` (IFile, IConfig, ViewMode, LineEnding, global.d.ts), `src/renderer/utils` (fileHelpers, lineEndingDetector), add absolute import aliases to [tsconfig.json](tsconfig.json):
```json
"paths": {
  "@components/*": ["src/renderer/components/*"],
  "@hooks/*": ["src/renderer/hooks/*"],
  "@contexts/*": ["src/renderer/contexts/*"],
  "@types/*": ["src/renderer/types/*"],
  "@utils/*": ["src/renderer/utils/*"]
}
```
Update [webpack.config.js](webpack.config.js) resolve.alias to match, define TypeScript interfaces:
```typescript
interface IFile {
  id: string;
  path: string | null; // null for untitled files
  name: string; // "Untitled-1", "README.md"
  content: string;
  isDirty: boolean;
  viewMode: 'markdown' | 'plaintext';
  lineEnding: 'CRLF' | 'LF';
  isWatching?: boolean;
}
interface IConfig {
  recentFiles: string[];
  openFiles: string[];
  windowBounds?: { width: number; height: number; x: number; y: number };
  defaultLineEnding: 'CRLF' | 'LF';
}
```

### 4. Build state management with EditorContext
Create EditorContext in `src/renderer/contexts/EditorContext.tsx` using `createContext` + `useReducer` managing state:
- `openFiles: IFile[]`
- `activeFileId: string | null`
- `untitledCounter: number` (for Untitled-1, Untitled-2 naming)
- `config: IConfig`

Define actions: NEW_FILE, OPEN_FILE, CLOSE_FILE, UPDATE_CONTENT, SET_DIRTY, TOGGLE_VIEW_MODE, SELECT_TAB, EXTERNAL_CHANGE_DETECTED, SET_CONFIG

Implement context provider wrapping [App.tsx](src/renderer/App.tsx), create custom hooks:
- `useEditorState()` — Access state
- `useFileOperations()` — File CRUD operations calling `window.electronAPI`
- `useWindowTitle()` — Update window title when active file changes
- `useFileWatcher()` — Subscribe to external file change events

In NEW_FILE action, generate unique untitled name (`Untitled-${untitledCounter}`), increment counter, add file with `path: null` and `isDirty: true`.

### 5. Implement tab bar with file status indicators and overflow handling
Build `<TabBar>` in `src/renderer/components/TabBar.tsx` mapping `openFiles` from context:
- Use MUI `<Tabs>` component with `scrollButtons="auto"` and `variant="scrollable"` for tab overflow
- Create `<FileTab>` component displaying filename
- Show MUI `<SaveIcon>` (floppy disk) with opacity change when `isDirty: true`
- Add MUI `<CodeIcon>` or `<DescriptionIcon>` for view mode toggle button (onClick calls TOGGLE_VIEW_MODE action)
- Add MUI `<CloseIcon>` button triggering close confirmation if dirty via `window.electronAPI.confirmClose()`
- Apply MUI theme styling with active tab highlighting using `selected` prop
- Handle tab click to SELECT_TAB action
- Show tooltip on hover with full file path (or "Unsaved" for untitled files)
- Limit visible tab width with ellipsis for long filenames

### 6. Create dual-mode editor component with split-pane option
Build `<EditorPane>` in `src/renderer/components/EditorPane.tsx` receiving active file from context:
- For plain text mode: Render `<textarea>` as controlled component with `value={content}`, `onChange` dispatching UPDATE_CONTENT + SET_DIRTY actions
- For markdown mode: Render `<ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>` for preview
- Add split-pane toggle using `react-split` library showing both `<textarea>` (left) and `<ReactMarkdown>` (right) simultaneously
- Style textarea with monospace font, line numbers optional (use pre-wrapped div with line counter)
- Handle keyboard shortcuts within textarea (Tab for indentation, Ctrl+/ for comment toggle)
- Debounce onChange updates (300ms) to improve performance during typing

### 7. Develop toolbar with operation buttons and state-aware enabling
Create `<Toolbar>` component in `src/renderer/components/Toolbar.tsx` using MUI `<AppBar>` and `<IconButton>` components:
- Add icons from `@mui/icons-material`: `<NoteAddIcon>` (New), `<FolderOpenIcon>` (Open), `<CloseIcon>` (Close), `<SaveIcon>` (Save), `<SaveAltIcon>` (Save All)
- Wire onClick handlers to `useFileOperations` hook methods
- Disable Save button when active file has `isDirty: false`
- Disable Save All when no files have `isDirty: true`
- Disable Close when no files open
- Show loading spinner on Save All during multi-file saves
- Add tooltips with keyboard shortcuts (e.g., "Save (Ctrl+S)")

### 8. Wire native menu to renderer actions with keyboard accelerators
In [main.ts](src/main/main.ts), create Menu template:
```typescript
const template = [
  ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
  {
    label: 'File',
    submenu: [
      { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => mainWindow.webContents.send('menu:new') },
      { label: 'Open', accelerator: 'CmdOrCtrl+O', click: () => mainWindow.webContents.send('menu:open') },
      { type: 'separator' },
      { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => mainWindow.webContents.send('menu:save') },
      { label: 'Save As', accelerator: 'CmdOrCtrl+Shift+S', click: () => mainWindow.webContents.send('menu:save-as') },
      { label: 'Save All', click: () => mainWindow.webContents.send('menu:save-all') },
      { type: 'separator' },
      { label: 'Close', accelerator: 'CmdOrCtrl+W', click: () => mainWindow.webContents.send('menu:close') },
      { label: 'Close All', click: () => mainWindow.webContents.send('menu:close-all') },
      { type: 'separator' },
      { label: 'Open in Containing Folder', click: () => mainWindow.webContents.send('menu:show-in-folder') },
      { type: 'separator' },
      ...recentFilesMenuItems, // Dynamic section
      { type: 'separator' },
      { label: 'Exit', accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4', role: 'quit' }
    ]
  }
];
```

In renderer, add `useEffect` in EditorContext provider listening for menu events via `window.electronAPI.on('menu:new', callback)` that dispatches appropriate actions, implement "Open in Containing Folder" using `window.electronAPI.showInFolder(activePath)` which calls `shell.showItemInFolder(filepath)`.

### 9. Implement configuration persistence with window state
Create `useConfigPersistence` hook that:
- Loads config via `window.electronAPI.loadConfig()` on mount
- Updates `recentFiles` array when file opens: prepend new path, remove duplicates, limit to 10, filter out null paths
- Saves `openFiles` paths array (excluding untitled files with `path: null`) to config when files open/close
- Saves window bounds to config using `window.electronAPI.getWindowBounds()` IPC calling `BrowserWindow.getBounds()`
- Restores window bounds on app initialization in [main.ts](src/main/main.ts) using saved config
- Adds window `beforeunload` event listener in [App.tsx](src/renderer/App.tsx) calling `window.electronAPI.saveConfig(config)` and checking for unsaved changes
- Restores session by loading `openFiles` on app initialization, reading each file's content via IPC, handles missing files gracefully (show notification, skip file)

### 10. Build notification system for errors and alerts
Create `<NotificationSnackbar>` component in `src/renderer/components/NotificationSnackbar.tsx` using MUI `<Snackbar>` and `<Alert>` components:
- Add notification context or state in EditorContext with `notifications: Array<{ id: string; message: string; severity: 'error' | 'warning' | 'info' | 'success' }>`
- Display auto-dismissing notifications (5 second duration) at bottom-right
- Show notifications for: file save success, file open error (permissions, not found), config load failure, external file change detected
- Queue multiple notifications with stacking
- Add SHOW_NOTIFICATION and DISMISS_NOTIFICATION actions to reducer

### 11. Handle file operation edge cases and user confirmations
Implement robust error handling and edge cases:
- **Unsaved changes dialog**: Use `window.electronAPI.confirmClose()` IPC calling `dialog.showMessageBox()` with buttons `['Save', 'Don't Save', 'Cancel']`, return user choice
- **Close behavior**: 
  - Individual tab close: prompt only if `isDirty: true`
  - Close All: if any files dirty, show batch dialog: "Save all, discard all, or review each?" then loop through dirty files
  - App exit: intercept window close event, prompt if any unsaved changes
- **Duplicate file prevention**: Before opening file, check if `openFiles` includes path, if yes switch to existing tab instead of opening duplicate
- **Missing files in config**: On session restore, catch file read errors, show notification "Could not open [filename]", remove from recent list
- **File I/O failures**: Catch errors for permissions, disk full, network drives disconnected, show specific error messages via notification system
- **External file changes**: 
  - When `fs.watch()` detects change, send IPC to renderer
  - Show dialog: "File has been modified externally. Reload or keep current version?"
  - If user has unsaved changes, show warning: "You have unsaved changes. Reloading will discard them."
- **Line ending preservation**: Detect CRLF vs LF on file open, store in file state, preserve on save to avoid git diffs
- **Empty state**: When `openFiles.length === 0`, show `<EmptyState>` component with welcome message, "New File" and "Open File" buttons, recent files list

### 12. Implement dynamic window title management
Create `useWindowTitle` hook in `src/renderer/hooks/useWindowTitle.tsx`:
- Subscribe to `activeFileId` and `openFiles` from EditorContext
- On change, construct title string:
  - If no active file: "MarkdownPlus"
  - If active file clean: `{filename} - MarkdownPlus`
  - If active file dirty: `*{filename} - MarkdownPlus`
  - If untitled: `*Untitled-{n} - MarkdownPlus`
- Call `window.electronAPI.setWindowTitle(title)` IPC which invokes `mainWindow.setTitle(title)`
- Update on tab switch, content edit (dirty state change), or file save (clean state)

### 13. Add "New File" functionality with untitled file management
In `useFileOperations` hook, implement `createNewFile()`:
- Dispatch NEW_FILE action generating `{ id: uuid(), path: null, name: 'Untitled-${counter}', content: '', isDirty: true, viewMode: 'markdown', lineEnding: config.defaultLineEnding }`
- Increment `untitledCounter` in state
- Set as active file
- On first save of untitled file, trigger "Save As" dialog via `window.electronAPI.saveAs()`, update file state with new path and name
- Handle "Save" on untitled file: always trigger "Save As" dialog

### 14. Implement Save vs Save As logic
Add clear distinction:
- **Save** (`CmdOrCtrl+S`):
  - If active file has `path: null` → trigger Save As dialog
  - If active file has path → directly save to existing path, set `isDirty: false`
- **Save As** (`CmdOrCtrl+Shift+S`):
  - Always show `dialog.showSaveDialog()` with default filename and filters
  - Save to new path, update file state with new path/name
  - Remove old path from `openFiles` config if path changed
- **Save All**:
  - Loop through all files with `isDirty: true`
  - For untitled files, show Save As dialog for each
  - For saved files, directly save to path
  - Show progress indicator (e.g., "Saving 3 of 5 files...")

## Further Considerations

1. **Markdown library choice** — Use `react-markdown` (recommended, component-based) with `remark-gfm` for GitHub Flavored Markdown support (tables, strikethrough, task lists)? Or `marked` + `DOMPurify` for smaller bundle? React-markdown has better TypeScript support and plugin ecosystem.

2. **State management approach** — Context API with useReducer sufficient for this scope (recommended for simplicity and React best practices), or prefer Zustand (~1KB) for cleaner actions/persistence middleware and better DevTools integration? Zustand simplifies complex async logic.

3. **Editor implementation** — Plain `<textarea>` for simplicity and performance, or integrate Monaco Editor (VS Code's editor, ~3MB bundle, syntax highlighting, IntelliSense, minimap, find/replace) or CodeMirror 6 (~500KB, lighter but professional features)? Textarea recommended initially, upgrade later if needed.

4. **File watcher library** — Use Node.js `fs.watch()` (built-in but platform inconsistencies) or `chokidar` (robust, cross-platform, 100KB, handles edge cases)? Chokidar recommended for production reliability.

5. **Tab overflow strategy** — MUI `scrollButtons="auto"` (scroll horizontally with arrows) vs. dropdown menu for hidden tabs vs. compress tab width dynamically? Scrollable tabs most intuitive for Notepad++ users.

6. **Auto-save implementation** — Should implement auto-save to temp directory every 30 seconds? Restore on crash? Add preference in config (`autoSaveInterval: number | null`)? Prevents data loss but adds complexity.

7. **Split-pane default** — Should markdown mode default to split-pane (edit + preview) or preview-only? Add toggle button to switch between modes? Split-pane provides best UX for markdown editing.

8. **Recent files limit** — 10 recent files sufficient, or make configurable? Add "Clear Recent Files" menu item?

9. **Line ending preference** — Should add Settings dialog with default line ending preference (CRLF/LF/Auto) and "Convert line endings" feature? Important for cross-platform development teams.

10. **Search and Replace** — Not in original spec, but essential for text editor. Add Ctrl+F for find, Ctrl+H for replace using browser native `document.execCommand('find')` or custom overlay?

11. **Markdown preview styling** — Use GitHub Markdown CSS, custom theme, or let user customize? Should match GitHub, VS Code, or be unique to MarkdownPlus?

12. **Performance optimization** — For large files (>10K lines), implement virtualization for textarea and markdown preview using `react-window` or `react-virtualized`? Add file size warning (e.g., ">1MB may cause performance issues")?
