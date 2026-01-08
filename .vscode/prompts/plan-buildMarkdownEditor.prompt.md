## Plan: Build Multi-Tab Markdown Editor with State Persistence

Build a tabbed Markdown editor Electron app supporting multiple files, dual view modes (Markdown/Plain Text), save state tracking, menu/toolbar operations, and persistent configuration following component-based React architecture with feature organization.

### Steps

1. **Establish project architecture and shared infrastructure** — Create feature-based folder structure in `src/renderer` (`/features`, `/components`, `/hooks`, `/utils`, `/types`, `/contexts`), add absolute import aliases to `tsconfig.json` and `webpack.config.js`, implement configuration utilities for JSON config management (`recentFiles`, `openFiles`), and secure Electron IPC communication with preload script.

2. **Build core state management and file system integration** — Create `EditorContext` (or Zustand store) managing open files array with metadata (path, content, isDirty, viewMode), implement custom hooks (`useFileOperations`, `useConfigPersistence`) for file I/O via Electron IPC, add menu/dialog handlers in `src/main/main.ts` for Open/Save/Close operations with native OS dialogs.

3. **Implement tab bar component with file indicators** — Create `<TabBar>` component displaying file tabs from state, add `<FileTab>` sub-component showing filename with save indicator (MUI floppy icon), editor mode toggle icon, close button, implement tab selection/switching logic, style active tab distinctly per Material-UI theme.

4. **Build Markdown/Plain Text editor toggle** — Integrate markdown rendering library (react-markdown or marked) alongside plain text `<textarea>`, create `<EditorPane>` component switching between modes based on active file's `viewMode`, implement two-way binding to update file content in state on edit, add syntax highlighting for Markdown mode if using plain text view.

5. **Develop menu bar and toolbar with file operations** — Create native Electron menu in `main.ts` (File menu: New, Open, Open in Containing Folder, Close, Close All, recent files section, Exit), build `<Toolbar>` component with MUI icon buttons (New, Open, Close, Close All, Save, Save All), wire actions to `useFileOperations` hooks with unsaved changes prompts on close.

6. **Add configuration persistence and lifecycle management** — Implement config load/save to JSON file via Electron's `app.getPath('userData')`, load `openFiles` on app startup to restore session, update `recentFiles` on file open (max 10), save `openFiles` on window close, handle edge cases (missing files, invalid config).

### Further Considerations

1. **Markdown library choice** — Use `react-markdown` (recommended, component-based) or `marked` + `DOMPurify` for security? React-markdown aligns better with component architecture.

2. **State management approach** — Context API sufficient for this scope, or prefer Zustand for cleaner actions/persistence middleware? Zustand recommended if state logic grows complex.

3. **Editor implementation** — Plain `<textarea>` for simplicity, or use Monaco Editor/CodeMirror for advanced features (line numbers, search)? Monaco adds significant bundle size but provides professional editing experience.

4. **Unsaved changes handling** — Should closing individual tabs prompt separately, or only prompt on Close All/Exit? Also, implement auto-save draft feature in config?
