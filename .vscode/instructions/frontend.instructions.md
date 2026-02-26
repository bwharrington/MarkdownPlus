---
applyTo: 'src/renderer/**/*.{ts,tsx,js,jsx,less,css}'
---

# Frontend Best Practices — React / TypeScript

## Overview

This document is the authoritative reference for reviewing and writing frontend code. It covers React 18+ with TypeScript, styled-components / CSS-in-JS, state management, performance, and code quality.

---

## 1. Project Structure

- Organize by **feature or domain** (e.g., `/features/user`, `/features/auth`), not by file type.
- Use **absolute imports** via `tsconfig.json` (e.g., `import { Button } from '@components/Button'`).
- Avoid deep nesting beyond 2–3 levels.
- Standard directories: `/src/components` (reusable UI), `/src/hooks`, `/src/utils`, `/src/types`.

---

## 2. Component Design

Keep components **small, focused, and composable** (Single Responsibility Principle).

### Do

- Break large components into smaller ones (e.g., `UserAvatar`, `UserInfo`, `UserActions` instead of a monolithic `UserProfile`).
- Use **composition over inheritance** — Compound Components, Render Props, or Hooks for reusability.
- Extract logic into **custom hooks** (e.g., `useUserData()`) to keep components declarative.
- Use **early returns** instead of nested ternaries for conditional rendering.
- Wrap pure components in `React.memo()`.
- Use `useCallback` for event handlers and `useMemo` for expensive computations.
- Include proper dependency arrays on `useCallback`, `useMemo`, and `useEffect`.

### Don't

- Directly manipulate the DOM in components.
- Place business logic in presentation components.
- Inline function definitions in JSX (creates new references every render).
- Mutate props or state directly.
- Omit `key` props in lists.

---

## 3. TypeScript & Type Safety

- **Explicit types** for all function parameters, return types, and component props (use interfaces).
- Prefer `unknown` over `any` when the type is truly unknown.
- Leverage **utility types**: `Partial<T>`, `Pick<T, K>`, `Omit<T, K>`, `as const`.
- Let TypeScript **infer** where it's straightforward; annotate complex or ambiguous cases.
- Use typed hooks: `useState<string>('')`, `createContext<MyType | null>(null)`.

---

## 4. Styling

### Styled-Components / CSS-in-JS

- **Define styled components outside the function body** — never inside render.
- Colocate styles with their component; extract shared styles to a global file only when needed.
- Use **`ThemeProvider`** at the app root and define themes in a typed file (`themes.ts` + `styled.d.ts`).
- Use `shouldForwardProp` to filter unnecessary props from the DOM.
- Use `attrs` to attach default attributes (e.g., `styled.input.attrs({ type: 'password' })`).
- Naming convention: prefix with `Styled` (e.g., `StyledButton`) or describe purpose (e.g., `ToolbarContainer`).

### Design System

- Use **design-system tokens** for colors, spacing, and font sizes — no hardcoded values.
- Include responsive breakpoints.
- Ensure accessibility: focus states, sufficient contrast, ARIA attributes.

---

## 5. State Management

### Redux

- Reducers must be **pure functions** with proper typing.
- Actions follow established naming conventions; include error-handling actions.
- Side effects belong in **middleware**, not reducers.
- Navigation logic goes in navigation middleware.

### Local / Context State

- Prefer `useState` / `useReducer` for local component state.
- Use Context API for component-subtree state; avoid prop drilling through many levels.

---

## 6. Performance

- `React.memo()` on pure components.
- `useCallback` for event handlers; `useMemo` for expensive computations.
- Proper `key` props on list items.
- Lazy loading with `React.lazy` + `Suspense`.
- Normalized state structures.
- Batch Redux actions where appropriate.
- Avoid unnecessary re-renders.

---

## 7. Code Quality

### Functions

- Small and focused (< 20 lines ideally).
- Pure where possible.
- Descriptive names.
- Proper error handling.

### Naming

- **camelCase** for variables and utility files.
- **PascalCase** for component files and React components.
- **lowercase-with-hyphens** for style files.
- **UPPER_CASE** for constants.
- Boolean variables prefixed with `is`, `has`, `should`.

### Documentation

- JSDoc for complex functions.
- Inline comments for non-obvious business logic.
- `TODO` comments linked to tickets/issues.
- Type annotations as documentation.

---

## 8. Testing

- Unit tests for component logic.
- Playwright for integration / E2E tests.
- Focus on **behavior over implementation** (test user interactions).

---

## 9. Common Anti-Patterns

### Direct State Mutation

```tsx
// Bad
state.items.push(newItem)

// Good
return { ...state, items: [...state.items, newItem] }
```

### Missing Error Boundaries

```tsx
// Bad
const UserProfile = ({ userId }: { userId: string }) => {
    const userData = fetchUserData(userId)
    return <div>{userData.name}</div>
}

// Good — wrap with an error boundary
<ErrorBoundary fallback={<div>Failed to load user profile</div>}>
    <UserProfile userId={userId} />
</ErrorBoundary>

// Good — handle errors internally
const UserProfile = ({ userId }: { userId: string }) => {
    const [userData, setUserData] = useState(null)
    const [error, setError] = useState(null)

    useEffect(() => {
        fetchUserData(userId).then(setUserData).catch(setError)
    }, [userId])

    if (error) return <ErrorMessage error={error} />
    if (!userData) return <LoadingSpinner />
    return <div>{userData.name}</div>
}
```

### Inline Styles

```tsx
// Bad
<div style={{ color: 'red', fontSize: '14px' }}>

// Good
const StyledDiv = styled.div`
  color: ${({ theme }) => theme.colors.error};
  font-size: ${({ theme }) => theme.fonts.small};
`
```

### Prop Drilling

```tsx
// Bad — passing props through many layers
<App> → <Dashboard> → <Sidebar> → <UserWidget>

// Good — use Redux for global state
const UserWidget = () => {
    const user = useAppSelector((state) => state.user.current)
    const dispatch = useAppDispatch()
    return <div onClick={() => dispatch(updateUser(newData))}>{user?.name}</div>
}

// Good — use Context for subtree state
const UserContext = createContext<UserContextType>(null)

const UserWidget = () => {
    const { user } = useContext(UserContext)
    return <div>{user?.name}</div>
}
```

### Missing Loading States

```tsx
// Always handle loading, error, and success
if (loading) return <Spinner />
if (error) return <ErrorMessage error={error} />
return <MainContent data={data} />
```

---

## 10. Additional Resources

- [React Best Practices](https://react.dev/learn)
- [Redux Style Guide](https://redux.js.org/style-guide)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Styled Components Documentation](https://styled-components.com/docs)
- [PVDS Component Documentation](https://planview-ds.github.io/react-pvds/)
