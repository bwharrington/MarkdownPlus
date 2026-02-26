# Claude Instructions for MarkdownPlus

## Architecture Guidelines

**IMPORTANT**: Always follow the React/TypeScript best practices defined in `.vscode/instructions/frontend.instructions.md`.

Key principles:
- **Small, modular components**: Follow Single Responsibility Principle
- **Styled-components**: Define styles outside render, use theming, colocate with components
- **TypeScript**: Explicit types for props/state, avoid `any`, use utility types
- **Hooks for logic**: Extract logic into custom hooks, keep components declarative
- **Performance**: Use `React.memo`, `useMemo`, `useCallback` appropriately

## Project-Specific Patterns

### State Management
- Global state via `EditorContext.tsx` using `useReducer`
- Config persistence through `window.electronAPI.saveConfig()`

### Component Patterns
- MUI `styled()` components for theming (not styled-components library, but same principles apply)
- Always define styled components outside function body
- Use `useCallback` for event handlers to prevent re-renders

### File Organization
- Components: `src/renderer/components/`
- Hooks: `src/renderer/hooks/`
- Types: `src/renderer/types/`
- Main process: `src/main/`

### Naming Conventions
- Styled components: `const ToolbarContainer = styled(Box)(...)`
- Event handlers: `handleEventName` (e.g., `handleAccept`, `handleCancel`)
- Boolean props/state: `isLoading`, `hasPending`, `showDialog`

### Testing Changes
- Run TypeScript check: `npx tsc --noEmit`
- Build: `npm run build`
