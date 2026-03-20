# Performance Considerations: React + TypeScript + Electron

> A comprehensive guide to performance review for desktop applications built with React, TypeScript, and Electron.

---

## Table of Contents

1. [Electron Architecture & Process Model](#1-electron-architecture--process-model)
2. [Main Process Performance](#2-main-process-performance)
3. [Renderer Process Performance](#3-renderer-process-performance)
4. [IPC Communication](#4-ipc-communication-inter-process-communication)
5. [React Performance](#5-react-performance)
6. [TypeScript Considerations](#6-typescript-considerations)
7. [Memory Management](#7-memory-management)
8. [Bundle Size & Load Time](#8-bundle-size--load-time)
9. [Native Modules & Node.js Integration](#9-native-modules--nodejs-integration)
10. [Rendering & UI Performance](#10-rendering--ui-performance)
11. [Data Handling & State Management](#11-data-handling--state-management)
12. [Disk I/O & File System Operations](#12-disk-io--file-system-operations)
13. [Network Requests](#13-network-requests)
14. [Security vs. Performance Trade-offs](#14-security-vs-performance-trade-offs)
15. [Profiling & Monitoring Tools](#15-profiling--monitoring-tools)
16. [Build & Packaging Optimizations](#16-build--packaging-optimizations)
17. [Platform-Specific Considerations](#17-platform-specific-considerations)
18. [Testing & Benchmarking Strategy](#18-testing--benchmarking-strategy)

---

## 1. Electron Architecture & Process Model

### Overview

Electron runs two distinct process types — the **Main Process** (Node.js) and one or more **Renderer Processes** (Chromium). Understanding the separation is the foundation of every performance decision.

```
┌──────────────────────────────────────────┐
│              Electron App                │
│                                          │
│  ┌──────────────┐   IPC   ┌───────────┐  │
│  │ Main Process │◄───────►│ Renderer  │  │
│  │  (Node.js)   │         │ (Chromium)│  │
│  └──────────────┘         └───────────┘  │
│         │                       │        │
│   OS / Native APIs          React + TS   │
└──────────────────────────────────────────┘
```

### Key Considerations

- **Single Main Process bottleneck**: Blocking the main process freezes the entire app, including all windows. Never run CPU-intensive work synchronously on the main process.
- **Multiple Renderer Processes**: Each `BrowserWindow` creates a new renderer process with its own V8 heap and Chromium memory overhead (~100–150 MB baseline per window).
- **Context Isolation**: Enabling `contextIsolation: true` (the default since Electron 12) introduces a small serialization cost over the `contextBridge`, but is essential for security and should not be disabled for performance reasons alone.

### Recommendations

- Limit the number of open `BrowserWindow` instances; use a single window with in-app routing where possible.
- Use hidden preload windows (background workers) sparingly; each adds memory overhead.
- Consider `BrowserView` or `webContents` partitioning only when process isolation is architecturally required.

---

## 2. Main Process Performance

### Blocking the Event Loop

The main process runs on a single Node.js event loop. Any synchronous operation will block all IPC handling and window management.

**Problem patterns to avoid:**

```typescript
// ❌ Synchronous file read on the main process
import fs from 'fs';
const data = fs.readFileSync('/large/file.json'); // Blocks entire app

// ✅ Async alternative
const data = await fs.promises.readFile('/large/file.json');
```

### Worker Threads for CPU-Intensive Work

Offload CPU-bound tasks (encryption, parsing, compression) to Node.js Worker Threads:

```typescript
// main/workers/heavyTask.worker.ts
import { parentPort, workerData } from 'worker_threads';

const result = performHeavyComputation(workerData.input);
parentPort?.postMessage(result);

// main/index.ts
import { Worker } from 'worker_threads';

function runHeavyTask(input: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./dist/workers/heavyTask.worker.js', {
      workerData: { input },
    });
    worker.on('message', resolve);
    worker.on('error', reject);
  });
}
```

### Checklist

- [ ] No synchronous `fs`, `crypto`, or `child_process` calls on the main process event loop
- [ ] Long-running tasks delegated to Worker Threads or child processes
- [ ] IPC handlers return quickly; heavy logic is awaited asynchronously
- [ ] `app.on('ready')` handler is minimal — defer non-critical initialization
- [ ] Use `setImmediate` / `process.nextTick` to yield the event loop where needed

---

## 3. Renderer Process Performance

### Chromium Overhead

Each renderer process is a full Chromium instance. This comes with:

- V8 JavaScript engine with its own heap
- Blink rendering engine
- ~80–200 MB baseline memory footprint

### Preload Scripts

Preload scripts execute in a privileged context before the renderer loads. Keep them minimal.

```typescript
// preload.ts — keep this lean
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // Expose only what the renderer needs
  readFile: (path: string) => ipcRenderer.invoke('read-file', path),
});
```

**Avoid:**
- Heavy computation inside preload scripts
- Synchronous IPC calls (`ipcRenderer.sendSync`) — these block the renderer until the main process responds

### Web Workers in the Renderer

For CPU-intensive work inside the renderer, use Web Workers:

```typescript
// renderer/workers/dataProcessor.worker.ts
self.onmessage = (event: MessageEvent) => {
  const processed = heavyDataTransformation(event.data);
  self.postMessage(processed);
};

// renderer/hooks/useDataProcessor.ts
const worker = new Worker(new URL('./dataProcessor.worker.ts', import.meta.url));
```

### Checklist

- [ ] Preload script size is minimal (< 20 KB unminified is a good target)
- [ ] No `ipcRenderer.sendSync` in any code path
- [ ] CPU-intensive renderer work is offloaded to Web Workers
- [ ] `nodeIntegration: false` is set (default) — direct Node.js use in renderer is an anti-pattern
- [ ] `webSecurity: true` is set — disabling it can cause unintended resource loading

---

## 4. IPC Communication (Inter-Process Communication)

IPC is a frequent performance bottleneck in Electron apps. Every call crosses a process boundary and involves serialization/deserialization.

### Serialization Cost

All IPC data is serialized using the **Structured Clone Algorithm**. This means:

- Large objects, deeply nested structures, and arrays of objects are expensive to transfer
- Functions, Promises, class instances (non-plain objects), and `undefined` within objects cannot be cloned
- `ArrayBuffer` and typed arrays can be **transferred** (zero-copy) instead of copied

```typescript
// ❌ Sending large plain objects repeatedly
ipcMain.handle('get-records', async () => {
  return await db.fetchAllRecords(); // Could be 10,000+ objects
});

// ✅ Paginate or stream large data
ipcMain.handle('get-records-page', async (_event, { page, pageSize }) => {
  return await db.fetchRecords({ offset: page * pageSize, limit: pageSize });
});

// ✅ Transfer ArrayBuffers (zero-copy) for binary data
ipcMain.handle('get-image-data', async (_event, filePath) => {
  const buffer = await fs.promises.readFile(filePath);
  return buffer.buffer; // ArrayBuffer — transferred, not cloned
});
```

### Batching IPC Calls

Avoid chatty IPC patterns. Batch multiple small calls into one:

```typescript
// ❌ Chatty: 10 round-trips
for (const id of ids) {
  await ipcRenderer.invoke('get-item', id);
}

// ✅ Batched: 1 round-trip
await ipcRenderer.invoke('get-items', ids);
```

### Avoiding IPC for Shared State

For read-heavy shared state, consider:

- **Shared memory via `SharedArrayBuffer`** (requires specific security headers)
- **Storing state in the renderer** and only syncing deltas via IPC
- **SQLite / LevelDB in the main process** with a query-based IPC API

### Checklist

- [ ] No `ipcRenderer.sendSync` usage anywhere
- [ ] Large data transfers are paginated or use `ArrayBuffer` transfer
- [ ] IPC calls are batched where possible
- [ ] IPC channel names are documented and audited for frequency of use
- [ ] Consider debouncing high-frequency IPC calls (e.g., autosave, real-time sync)

---

## 5. React Performance

### Component Re-render Audit

Unnecessary re-renders are the most common React performance issue. In an Electron app, this compounds because the renderer has limited resources.

```typescript
// ❌ Creates a new object reference on every render
function Parent() {
  return <Child config={{ theme: 'dark' }} />; // New object every render
}

// ✅ Memoize stable references
const CONFIG = { theme: 'dark' } as const;
function Parent() {
  return <Child config={CONFIG} />;
}

// ✅ Or use useMemo for dynamic values
function Parent({ userId }: { userId: string }) {
  const config = useMemo(() => ({ theme: 'dark', userId }), [userId]);
  return <Child config={config} />;
}
```

### React.memo and Stable Callbacks

```typescript
// ✅ Prevent child re-renders when props haven't changed
const ExpensiveList = React.memo(({ items }: { items: Item[] }) => {
  return <>{items.map(item => <ListItem key={item.id} item={item} />)}</>;
});

// ✅ Stable callback references with useCallback
function Parent() {
  const handleClick = useCallback((id: string) => {
    dispatch({ type: 'SELECT', id });
  }, [dispatch]);

  return <ExpensiveList onItemClick={handleClick} />;
}
```

### Virtualization for Long Lists

Rendering thousands of DOM nodes tanks performance. Use virtualization:

```typescript
import { FixedSizeList as List } from 'react-window';

function FileExplorer({ files }: { files: File[] }) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <FileRow file={files[index]} />
    </div>
  );

  return (
    <List height={600} itemCount={files.length} itemSize={36} width="100%">
      {Row}
    </List>
  );
}
```

**Libraries to consider:**
- `react-window` — lightweight, fixed/variable size lists and grids
- `react-virtual` (TanStack Virtual) — more flexible, headless
- `react-virtuoso` — easiest API, handles dynamic heights well

### Code Splitting & Lazy Loading

```typescript
// ✅ Lazy-load heavy routes/panels
const SettingsPanel = React.lazy(() => import('./panels/SettingsPanel'));
const ReportViewer = React.lazy(() => import('./panels/ReportViewer'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/settings" element={<SettingsPanel />} />
        <Route path="/reports" element={<ReportViewer />} />
      </Routes>
    </Suspense>
  );
}
```

### Avoiding Reconciliation Pitfalls

```typescript
// ❌ Index as key causes incorrect reconciliation on reorder/delete
items.map((item, index) => <Item key={index} item={item} />)

// ✅ Stable, unique key
items.map(item => <Item key={item.id} item={item} />)
```

### Checklist

- [ ] React DevTools Profiler run; components with unnecessary re-renders identified
- [ ] `React.memo` applied to components that receive stable props
- [ ] `useCallback` / `useMemo` used for expensive computations and stable references
- [ ] Lists > 100 items use a virtualization library
- [ ] Heavy routes / panels are lazy-loaded with `React.lazy`
- [ ] Keys in lists are stable unique IDs, not array indices
- [ ] `useEffect` dependencies are minimized and correct (no infinite loops)

---

## 6. TypeScript Considerations

### Type-Only Imports

TypeScript's `isolatedModules` (required by most bundlers) works best with explicit type imports. Use `import type` to ensure zero runtime cost:

```typescript
// ✅ Type-only import — erased at compile time, no runtime impact
import type { BrowserWindow } from 'electron';
import type { UserRecord } from '../types/database';

// ✅ Mixed import (TS 4.5+)
import { ipcMain, type IpcMainInvokeEvent } from 'electron';
```

### Avoiding Excessive Type Computation

Complex conditional and mapped types can slow down the TypeScript language server and CI build times:

```typescript
// ⚠️ Very deep recursive types can cause tsc to slow significantly
type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

// ✅ Where possible, prefer flat, explicit types for frequently-used interfaces
```

### `tsconfig.json` Performance Flags

```json
{
  "compilerOptions": {
    "incremental": true,            // Cache build info; greatly speeds up rebuilds
    "tsBuildInfoFile": ".tsbuildinfo",
    "skipLibCheck": true,           // Skip type-checking of .d.ts files in node_modules
    "isolatedModules": true,        // Enables single-file transforms (required by esbuild/swc)
    "strict": true,                 // Catches bugs early; keep enabled
    "noEmitOnError": true
  },
  "exclude": ["node_modules", "dist"]
}
```

### Type Assertion vs. Type Guard Cost

Runtime type guards (used for IPC payload validation) have a cost. Keep them lean, especially in hot paths:

```typescript
// ✅ Lightweight guard for IPC payloads
function isValidPayload(data: unknown): data is { id: string; value: number } {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as any).id === 'string' &&
    typeof (data as any).value === 'number'
  );
}
```

For complex validation, consider **zod** with `z.parse` — but cache schemas and avoid re-parsing the same shape repeatedly in tight loops.

### Checklist

- [ ] `incremental: true` enabled in `tsconfig.json`
- [ ] `skipLibCheck: true` set (unless debugging declaration file issues)
- [ ] `import type` used for type-only imports throughout the codebase
- [ ] TypeScript build time benchmarked; investigate if `tsc --diagnostics` shows > 30s for incremental
- [ ] Runtime validation (e.g., zod) is not running in render hot paths

---

## 7. Memory Management

### V8 Heap Management in Electron

Electron's Chromium does not always aggressively garbage collect. Large retained objects can grow memory usage over the lifetime of the app.

### Common Memory Leaks

```typescript
// ❌ Event listener not removed — classic leak
function MyComponent() {
  useEffect(() => {
    window.api.onDataUpdate((data) => setData(data));
    // Missing cleanup! Listener accumulates on every mount
  }, []);
}

// ✅ Clean up on unmount
function MyComponent() {
  useEffect(() => {
    const unsubscribe = window.api.onDataUpdate((data) => setData(data));
    return () => unsubscribe(); // IPC listener removed when component unmounts
  }, []);
}

// ✅ Electron-side: always clean up ipcMain listeners in BrowserWindow close
mainWindow.on('closed', () => {
  ipcMain.removeHandler('get-data');
  mainWindow = null;
});
```

### Large Object Lifecycle

```typescript
// ✅ Null out large objects when no longer needed to aid GC
let largeDataset: Record<string, unknown>[] | null = await loadDataset();
processData(largeDataset);
largeDataset = null; // Eligible for GC
```

### Electron-Specific Memory APIs

```typescript
// Monitor renderer process memory (main process)
const memInfo = await mainWindow.webContents.getProcessMemoryInfo();
console.log(`Private memory: ${memInfo.private} KB`);

// Trigger GC suggestion (V8 may or may not honor this)
// Only use during idle time, not in hot paths
if (global.gc) global.gc(); // Requires --expose-gc flag
```

### Checklist

- [ ] All IPC event listeners removed on component unmount or window close
- [ ] `BrowserWindow` references set to `null` after `closed` event
- [ ] Large in-memory datasets are released after use
- [ ] Memory growth profiled using Chrome DevTools Memory tab over an extended session
- [ ] No closures inadvertently retaining large DOM trees or data arrays
- [ ] `session.clearCache()` called when cache data is no longer needed

---

## 8. Bundle Size & Load Time

### App Startup Time

Electron apps suffer from slow cold start because:
1. Electron itself loads (~200 ms on modern hardware)
2. Node.js modules are loaded for the main process
3. The renderer loads the HTML, CSS, and JS bundle
4. React hydrates and first renders

### Measuring Startup

```typescript
// main/index.ts — measure time to first paint
const startTime = Date.now();
app.on('ready', () => {
  const window = createMainWindow();
  window.webContents.on('did-finish-load', () => {
    console.log(`Time to load: ${Date.now() - startTime}ms`);
  });
});
```

### Bundle Analysis

Use `webpack-bundle-analyzer` or `rollup-plugin-visualizer` to identify large dependencies:

```bash
# With webpack
npx webpack-bundle-analyzer dist/stats.json

# With Vite
npx vite-bundle-visualizer
```

**Common large culprits in Electron apps:**
- `moment.js` — replace with `date-fns` or `dayjs`
- `lodash` (full) — use `lodash-es` with tree-shaking or cherry-pick imports
- Large icon libraries — import only used icons
- Bundling Electron or Node.js built-ins — externalize these

```typescript
// ❌ Imports entire lodash (~70KB)
import _ from 'lodash';

// ✅ Cherry-picked import
import debounce from 'lodash/debounce';

// ✅ Or use lodash-es for proper tree-shaking
import { debounce } from 'lodash-es';
```

### Vite / Webpack Configuration for Electron

```typescript
// vite.config.ts (renderer)
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['electron'], // Never bundle Electron in renderer
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
        },
      },
    },
    minify: 'esbuild', // Fastest; use 'terser' for better compression
    sourcemap: false,  // Disable in production for smaller bundles
  },
});
```

### Checklist

- [ ] Bundle size analyzed; no unintended large packages included
- [ ] `electron` is externalized and never bundled into renderer or main
- [ ] Tree-shaking confirmed working (check for `sideEffects: false` in package.json)
- [ ] Dynamic imports used for non-critical code paths
- [ ] Source maps disabled in production builds
- [ ] `moment.js` replaced with a lighter alternative if present
- [ ] App startup time measured and tracked across releases (target: < 2s to first interactive)

---

## 9. Native Modules & Node.js Integration

### Native Addons (.node files)

Native modules (`.node` files) must be compiled for the exact Electron version and platform. Mismatches cause silent failures or crashes.

```bash
# Rebuild native modules for the current Electron version
npx electron-rebuild

# Or with electron-builder
npx electron-builder install-app-deps
```

### Performance of Native vs. JS

Native modules can be dramatically faster for:
- Cryptographic operations
- Image/video processing
- Database drivers (e.g., `better-sqlite3`)
- File system watching

**Consider native modules when:**
- A pure-JS operation takes > 50ms and runs frequently
- You need streaming access to OS-level APIs

### `better-sqlite3` vs. `sqlite3`

```typescript
// better-sqlite3 is synchronous but runs natively and is very fast
// Use it on the main process or a Worker Thread — never directly in renderer

import Database from 'better-sqlite3';
const db = new Database('app.db');

// Prepare statements once; reuse many times
const getUser = db.prepare('SELECT * FROM users WHERE id = ?');
const user = getUser.get(userId); // Synchronous, but extremely fast
```

### Checklist

- [ ] All native modules rebuilt with `electron-rebuild` after Electron version updates
- [ ] Native module compilation time factored into CI/CD pipeline
- [ ] `better-sqlite3` used over `sqlite3` if SQLite is required
- [ ] Native modules are only loaded in the main process or worker threads, not the renderer

---

## 10. Rendering & UI Performance

### CSS & Animations

Electron uses Chromium's rendering engine. The same CSS performance rules apply:

```css
/* ✅ Use transform and opacity for animations — GPU-accelerated */
.slide-in {
  transform: translateX(-100%);
  transition: transform 200ms ease-out;
}
.slide-in.visible {
  transform: translateX(0);
}

/* ❌ Animating layout properties triggers reflow */
.bad-animation {
  transition: left 200ms ease-out; /* Forces layout recalculation */
}
```

### GPU Acceleration

Electron/Chromium composites layers on the GPU. Promote frequently-animated elements to their own layer:

```css
/* ✅ Create a compositing layer for a frequently updated element */
.live-chart {
  will-change: transform; /* Promotes to own GPU layer */
  /* Use sparingly — too many layers waste GPU memory */
}
```

### Canvas & WebGL

For data-heavy visualizations (charts, maps, graphs), prefer `<canvas>` or WebGL over SVG for large datasets:

```typescript
// react-chartjs-2, PixiJS, or deck.gl for heavy rendering
import { Chart } from 'react-chartjs-2'; // Canvas-based; handles thousands of points
```

### Frame Rate Monitoring

```typescript
// Renderer — monitor frame rate using requestAnimationFrame
let lastTime = performance.now();
let frameCount = 0;

function monitorFPS() {
  const now = performance.now();
  frameCount++;
  if (now - lastTime >= 1000) {
    console.log(`FPS: ${frameCount}`);
    frameCount = 0;
    lastTime = now;
  }
  requestAnimationFrame(monitorFPS);
}
requestAnimationFrame(monitorFPS);
```

### Checklist

- [ ] No CSS animations using `top`, `left`, `width`, `height` on animated elements
- [ ] `will-change` used sparingly only on elements with predictable animation
- [ ] Large data visualizations use canvas/WebGL, not SVG with thousands of nodes
- [ ] Chrome DevTools Performance tab shows consistent 60fps during interactions
- [ ] Long paint times (> 16ms) identified and addressed

---

## 11. Data Handling & State Management

### State Manager Selection

State manager performance varies significantly under load:

| Library | Re-render Strategy | Electron Suitability |
|---|---|---|
| Redux Toolkit | Selector-based (reselect) | Good; predictable |
| Zustand | Subscription-based | Excellent; minimal overhead |
| Jotai | Atomic; fine-grained | Excellent for large apps |
| MobX | Observable/reactive | Good; beware of over-reaction |
| React Context | All consumers re-render | Avoid for high-frequency state |

**React Context is not a performance-friendly global state solution.** Every consumer re-renders on any context value change.

```typescript
// ❌ Single context causes all consumers to re-render on any change
const AppContext = createContext({ user: null, theme: 'light', notifications: [] });

// ✅ Split contexts by update frequency
const UserContext = createContext<User | null>(null);
const ThemeContext = createContext<'light' | 'dark'>('light');
const NotificationContext = createContext<Notification[]>([]);
```

### Selector Memoization

```typescript
// With Redux Toolkit + reselect
import { createSelector } from '@reduxjs/toolkit';

const selectAllItems = (state: RootState) => state.items.list;
const selectFilter = (state: RootState) => state.items.filter;

// ✅ Memoized — only recomputes when inputs change
const selectFilteredItems = createSelector(
  [selectAllItems, selectFilter],
  (items, filter) => items.filter(item => item.status === filter)
);
```

### Normalizing State Shape

```typescript
// ❌ Nested/denormalized — updating one item requires scanning arrays
type State = {
  projects: Array<{
    id: string;
    tasks: Array<{ id: string; title: string }>;
  }>;
};

// ✅ Normalized — O(1) lookups; minimal re-renders with entity adapters
import { createEntityAdapter } from '@reduxjs/toolkit';

const tasksAdapter = createEntityAdapter<Task>();
const projectsAdapter = createEntityAdapter<Project>();
```

### Checklist

- [ ] React Context is not used for high-frequency state updates
- [ ] State updates are batched where possible (React 18 automatic batching helps)
- [ ] Selectors are memoized with `reselect` or equivalent
- [ ] State shape is normalized for entities with relationships
- [ ] Large arrays are not stored as state if only a subset is ever rendered

---

## 12. Disk I/O & File System Operations

### Async First

All file system operations must be asynchronous to avoid blocking the main process event loop.

```typescript
// ❌ Synchronous — blocks the event loop
const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

// ✅ Asynchronous
const config = JSON.parse(await fs.promises.readFile('config.json', 'utf-8'));
```

### Streaming Large Files

```typescript
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';

// ✅ Stream large files instead of loading them entirely into memory
async function compressFile(input: string, output: string) {
  await pipeline(
    createReadStream(input),
    createGzip(),
    createWriteStream(output)
  );
}
```

### File Watching

```typescript
// ✅ Use chokidar for efficient file watching (debounce rapid events)
import chokidar from 'chokidar';

const watcher = chokidar.watch('/path/to/watch', {
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
});

watcher.on('change', debounce((path) => {
  mainWindow?.webContents.send('file-changed', path);
}, 200));
```

### Checklist

- [ ] No synchronous `fs` calls on the main process event loop
- [ ] Large file operations use Node.js streams
- [ ] File watchers are debounced to avoid flooding IPC with change events
- [ ] Temporary files are cleaned up on app exit
- [ ] `app.getPath('userData')` used for user data (not app install directory)

---

## 13. Network Requests

### Node.js `fetch` vs. Renderer `fetch`

In Electron, HTTP requests can be made from both the main process and the renderer:

| Location | API | Considerations |
|---|---|---|
| Main Process | `net.request` / Node `fetch` | Bypasses CORS; use for privileged requests |
| Renderer | Browser `fetch` | Subject to CORS; appropriate for user-facing requests |
| Main Process | `electron.net` | Uses Chromium's network stack; respects proxy settings |

```typescript
// ✅ Use electron's net module for requests that need proxy support
import { net } from 'electron';

const request = net.request('https://api.example.com/data');
request.on('response', (response) => { /* handle */ });
request.end();
```

### Request Caching

```typescript
// ✅ Simple in-memory cache for frequently-requested data
const cache = new Map<string, { data: unknown; expiry: number }>();

async function fetchWithCache(url: string, ttlMs = 60_000): Promise<unknown> {
  const cached = cache.get(url);
  if (cached && Date.now() < cached.expiry) return cached.data;

  const response = await fetch(url);
  const data = await response.json();
  cache.set(url, { data, expiry: Date.now() + ttlMs });
  return data;
}
```

### Checklist

- [ ] Requests are not made redundantly; deduplicate in-flight requests
- [ ] Appropriate caching strategy in place for repeated API calls
- [ ] Network errors handled gracefully with retry logic (exponential backoff)
- [ ] Large response payloads streamed where possible
- [ ] Requests not triggered from hot render paths (move to `useEffect` or event handlers)

---

## 14. Security vs. Performance Trade-offs

Some security settings have a minor performance impact but must never be disabled for performance reasons alone.

| Setting | Performance Impact | Recommendation |
|---|---|---|
| `contextIsolation: true` | Minimal serialization overhead | Always keep enabled |
| `sandbox: true` | ~5–10ms extra IPC overhead | Keep enabled |
| `webSecurity: true` | Enforces CORS checks | Never disable |
| `nodeIntegration: false` | Forces IPC for Node access | Never enable in renderer |
| `Content-Security-Policy` | Blocks inline scripts | Always set; use nonces for dynamic scripts |

### CSP Header for Electron

```typescript
// main/index.ts
mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
      ],
    },
  });
});
```

---

## 15. Profiling & Monitoring Tools

### Chrome DevTools (Renderer)

Open DevTools from the renderer:
```typescript
mainWindow.webContents.openDevTools(); // Development only
```

Key tabs:
- **Performance**: Record and analyze frames, scripting, rendering, painting
- **Memory**: Heap snapshots, allocation timelines; detect leaks
- **Network**: Monitor IPC-over-webSocket or actual network requests
- **Layers**: Visualize compositing layers; identify GPU memory waste

### Node.js Profiling (Main Process)

```bash
# CPU profile of the main process
electron --inspect=9229 .
# Then attach Chrome DevTools to chrome://inspect
```

### React DevTools

Install the standalone React DevTools or the browser extension (works in Electron):

```bash
npm install --save-dev react-devtools
```

```typescript
// main/index.ts (development only)
if (process.env.NODE_ENV === 'development') {
  require('react-devtools');
}
```

Use the **Profiler** tab to record renders and identify components with high render time or unnecessary re-renders.

### Performance Budget Tracking

Define measurable targets and track them in CI:

| Metric | Target |
|---|---|
| App startup (cold) | < 2,000ms |
| App startup (warm) | < 800ms |
| Time to first interactive | < 1,500ms |
| IPC round-trip (simple) | < 5ms |
| Main window memory (idle) | < 300MB |
| Renderer JS heap (idle) | < 100MB |
| Frame rate during interaction | ≥ 60fps |

### Checklist

- [ ] React DevTools Profiler used to audit component render performance
- [ ] Chrome DevTools Performance tab profiled for 60fps compliance
- [ ] Memory heap snapshot taken at startup and after 30 min of use; no significant growth
- [ ] Main process profiled under load with `--inspect`
- [ ] Performance budget defined and tracked in CI

---

## 16. Build & Packaging Optimizations

### Electron Builder / Forge Configuration

```json
// electron-builder.json
{
  "compression": "maximum",       // LZMA compression; slower build, smaller package
  "asar": true,                   // Pack app into asar archive; faster file access
  "asarUnpack": [                 // Extract files that must be accessed by path
    "**/*.node",                  // Native modules must be unpacked
    "**/ffmpeg*"
  ],
  "files": [
    "dist/**/*",
    "!dist/**/*.map",             // Exclude source maps from production
    "!**/*.{ts,tsx}",             // Exclude TypeScript source
    "!node_modules/**"            // node_modules handled separately
  ]
}
```

### Pruning `node_modules`

Ship only production dependencies:

```bash
# electron-builder handles this automatically if configured
# Manual approach:
npm ci --omit=dev
```

### Prebuilt Binaries

Use `electron-prebuilt-compile` or configure `electron-rebuild` in your CI pipeline to avoid native module compilation on end-user machines.

### Checklist

- [ ] `asar: true` enabled; native modules in `asarUnpack`
- [ ] Source maps excluded from production build
- [ ] Only production dependencies included in the package
- [ ] Package size analyzed with `npx asar list app.asar | wc -l`
- [ ] Auto-update strategy in place (electron-updater) to keep app size minimal

---

## 17. Platform-Specific Considerations

### macOS

- **Rosetta 2**: If distributing a universal binary, test performance under both native arm64 and Rosetta 2 emulation
- **App Nap**: macOS may throttle background apps. Use `app.setAppUserModelId` and keep a visible window if the app needs to run tasks in the background
- **Metal rendering**: Chromium uses Metal on macOS 11+; GPU-accelerated rendering is generally excellent

### Windows

- **Startup performance**: Windows Defender scanning can slow cold start. Consider code signing to reduce scan depth
- **DPI scaling**: Test at 100%, 125%, 150%, and 200% scaling. Use `app.commandLine.appendSwitch('high-dpi-support', '1')` correctly
- **NTFS vs. APFS**: File I/O performance characteristics differ; test heavy file operations on Windows explicitly

### Linux

- **Sandbox restrictions**: Some Linux configurations require `--no-sandbox` flag, which has security implications. Use `app.commandLine.appendSwitch('--enable-features', 'VaapiVideoDecoder')` for hardware video decoding
- **Font rendering**: Subpixel rendering differs; test UI on common Linux distros

### Checklist

- [ ] App tested on minimum supported OS version for each platform
- [ ] DPI scaling tested at multiple scale factors on Windows
- [ ] Universal binary (arm64 + x64) provided for macOS if targeting Apple Silicon
- [ ] Performance profiled on the lowest-spec target hardware

---

## 18. Testing & Benchmarking Strategy

### Unit Benchmarks for Critical Paths

```typescript
// Use vitest bench or jest-bench for microbenchmarks
import { bench, describe } from 'vitest';

describe('IPC payload serialization', () => {
  bench('serialize small payload', () => {
    JSON.stringify({ id: '123', value: 42 });
  });

  bench('serialize large payload', () => {
    JSON.stringify(generateLargeDataset(1000));
  });
});
```

### End-to-End Performance with Playwright

```typescript
// e2e/startup.spec.ts
import { test, expect } from '@playwright/test';
import { ElectronApplication, _electron as electron } from 'playwright';

test('app startup time', async () => {
  const start = Date.now();
  const app: ElectronApplication = await electron.launch({ args: ['.'] });
  const window = await app.firstWindow();
  await window.waitForSelector('#app-ready'); // Your "app loaded" indicator
  const duration = Date.now() - start;

  console.log(`Startup time: ${duration}ms`);
  expect(duration).toBeLessThan(3000);

  await app.close();
});
```

### Continuous Performance Regression Tracking

- Integrate performance benchmarks into CI (GitHub Actions, etc.)
- Track startup time, memory, and bundle size as metrics over time
- Fail the build if a metric regresses by more than a defined threshold (e.g., 10%)
- Use tools like **Sentry**, **Datadog**, or custom telemetry (with user consent) for production performance monitoring

### Checklist

- [ ] Critical algorithms have unit benchmarks in version control
- [ ] E2E performance tests cover startup, navigation, and data loading
- [ ] Performance metrics tracked across Git history
- [ ] Production error/performance monitoring configured (with user consent)
- [ ] A performance review is part of the PR checklist for changes to hot paths

---

## Summary: Quick Reference Checklist

### Architecture
- [ ] Process responsibilities clearly separated (main vs. renderer)
- [ ] Window count minimized
- [ ] IPC usage audited for frequency and payload size

### Main Process
- [ ] No synchronous operations on event loop
- [ ] Worker Threads used for CPU-intensive tasks
- [ ] IPC handlers are fast and async

### Renderer / React
- [ ] No unnecessary re-renders (React Profiler verified)
- [ ] Long lists virtualized
- [ ] Heavy routes lazy-loaded
- [ ] Web Workers used for CPU work in renderer

### Build
- [ ] Bundle analyzed; no large unintended dependencies
- [ ] Tree-shaking working
- [ ] Startup time < 2s measured and tracked

### Memory
- [ ] No event listener leaks
- [ ] Memory growth flat over extended sessions
- [ ] Large objects released after use

### Ongoing
- [ ] Performance benchmarks in CI
- [ ] Metrics tracked across releases
- [ ] Profiling done on target hardware

---

*Document version: 1.0 | Technologies: React 18+, TypeScript 5+, Electron 28+*
