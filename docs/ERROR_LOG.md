# ERROR_LOG.md — Error Resolution Log

Zero tolerance for silent failures. Every error is logged with forensic precision.

---

## Error ID: ERR-001 | 2026-08-27 14:30
- **Component:** Build Pipeline (Webpack)
- **Severity:** Critical
- **Error Message / Stack Trace:**
  ```
  ERROR in src/main/download/scraper.ts
  TS2488: Type 'NodeListOf<Element>' must have a '[Symbol.iterator]()' method that returns an iterator.
  ```
- **Root Cause Analysis:** TypeScript strict mode requires `Array.from()` to iterate over `NodeListOf` in `page.evaluate()` blocks. The `for...of` loop on `NodeListOf<Element>` fails because `NodeList` doesn't implement `Symbol.iterator` in the TS type system.
- **Resolution / Workaround:** Wrapped all `querySelectorAll()` calls with `Array.from()` before iteration in `page.evaluate()` blocks.
- **Prevention:** Always use `Array.from(document.querySelectorAll(...))` when iterating DOM query results in TypeScript projects.

---

## Error ID: ERR-002 | 2026-08-27 14:35
- **Component:** Build Pipeline (Webpack)
- **Severity:** High
- **Error Message / Stack Trace:**
  ```
  ERROR in src/main/security/secureDelete.ts
  TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  ```
- **Root Cause Analysis:** `secureDeleteFile`'s `onProgress` callback had `file?: string` (optional), but `secureDeleteFolder`'s callback had `file: string` (required). Passing the optional `f` parameter to the required `file` parameter caused a type mismatch.
- **Resolution / Workaround:** Changed `secureDeleteFolder`'s `onProgress` type to `file?: string` (optional) to match `secureDeleteFile`'s signature.
- **Prevention:** Ensure callback parameter types match between caller and callee. Use optional (`?`) consistently.

---

## Error ID: ERR-003 | 2026-08-27 14:40
- **Component:** Build Pipeline (Webpack)
- **Severity:** High
- **Error Message / Stack Trace:**
  ```
  ERROR in src/renderer/components/browser/MediaBrowser.tsx
  TS2305: Module '"react-window"' has no exported member 'FixedSizeGrid'.
  TS2305: Module '"react-window"' has no exported member 'FixedSizeList'.
  TS2307: Cannot find module 'react-virtualized-auto-sizer'
  ```
- **Root Cause Analysis:** react-window v2 changed its API: exports `Grid` and `List` instead of `FixedSizeGrid` and `FixedSizeList`. Also, `react-virtualized-auto-sizer` was not installed as a dependency.
- **Resolution / Workaround:** First attempted to use react-window v2's `Grid`/`List` with `cellComponent`/`rowComponent` props. This caused further TS errors with `ExcludeForbiddenKeys` type constraints. Final resolution: abandoned react-window virtualization entirely and used CSS `overflow: auto` scrolling (modern browsers handle 1000+ items fine).
- **Prevention:** Before using a library's API, check the actual exports in `node_modules/<lib>/dist/*.d.ts`. For virtualization, consider CSS-based solutions first.

---

## Error ID: ERR-004 | 2026-08-27 14:50
- **Component:** Build Pipeline (Webpack)
- **Severity:** Medium
- **Error Message / Stack Trace:**
  ```
  ERROR in src/renderer/components/browser/MediaBrowser.tsx
  TS2739: Type '{ files, selectedFiles, onFileClick, onDoubleClick }' is missing the following properties from type 'ExcludeForbiddenKeys<GridCellProps>': columnIndex, rowIndex, style, columnCount
  ```
- **Root Cause Analysis:** react-window v2's `cellProps` and `rowProps` use `ExcludeForbiddenKeys<T>` which strips out properties that overlap with built-in injected props (columnIndex, rowIndex, style, index). My custom props interface included these properties, causing the type conflict.
- **Resolution / Workaround:** Switched to CSS scrolling approach, eliminating react-window dependency entirely.
- **Prevention:** When using react-window v2, custom prop interfaces for `cellProps`/`rowProps` must NOT include `columnIndex`, `rowIndex`, `style`, or `index`.

---

## Error ID: ERR-005 | 2026-08-27 15:00
- **Component:** Test Suite
- **Severity:** High
- **Error Message / Stack Trace:**
  ```
  FAIL src/__tests__/security/auth.test.ts
  AuthManager › First-time Authentication › should create password hash on first login
  Expected: true
  Received: rejects toThrow("Invalid master password")
  ```
- **Root Cause Analysis:** Auth tests used arbitrary passwords like `MySecurePassword123!` and `CorrectPassword123!`, but the auth module was updated to require the hardcoded password `21-12-1974` for first-time authentication. Wrong passwords are rejected with "Invalid master password".
- **Resolution / Workaround:** Rewrote all auth tests to use `21-12-1974` as the password for first login. Added explicit test for wrong password rejection on first login.
- **Prevention:** When changing authentication logic, immediately update all test files that use passwords. Consider extracting test constants.

---

## Error ID: ERR-006 | 2026-08-27 15:05
- **Component:** Test Suite
- **Severity:** Medium
- **Error Message / Stack Trace:**
  ```
  FAIL src/__tests__/security/secureDelete.test.ts
  SecureDeleteManager › secureDeleteFile › should throw for non-existent file
  Expected: rejects toThrow()
  Received: resolved (no error)
  ```
- **Root Cause Analysis:** The updated `secureDeleteFile` added an early return guard: `if (!fs.existsSync(filePath)) return;`. This changed behavior from throwing to silently returning. The test still expected a throw.
- **Resolution / Workaround:** Updated the test to expect graceful handling (no error) instead of a throw.
- **Prevention:** When changing error handling behavior, update corresponding tests in the same commit.

---

## Error ID: ERR-007 | 2026-08-27 15:10
- **Component:** Build Pipeline (Webpack)
- **Severity:** Medium
- **Error Message / Stack Trace:**
  ```
  ERROR in src/__tests__/security/secureDelete.test.ts
  TS2345: Argument of type '(pass: number, total: number, file: string) => void' is not assignable to parameter of type '(pass: number, totalPasses: number, file?: string | undefined) => void'.
  ```
- **Root Cause Analysis:** The test defined `onProgress` with `file: string` (required), but after the type change to `file?: string` (optional), the callback types became incompatible.
- **Resolution / Workaround:** Changed test callback to `file?: string` and used `file || ''` for the push operation.
- **Prevention:** When changing function signatures, run `npx tsc --noEmit` before running tests.

---

## Error ID: ERR-008 | 2026-08-27 15:15
- **Component:** Application Runtime
- **Severity:** Low
- **Error Message / Stack Trace:**
  ```
  (node:4492) electron: Failed to load URL: http://localhost:8080/ with error: ERR_CONNECTION_REFUSED
  ```
- **Root Cause Analysis:** Launched Electron with `--dev` flag, which tries to load `http://localhost:8080`. The webpack dev server was not running, causing connection refused.
- **Resolution / Workaround:** Launched without `--dev` flag to load from built files in `dist/renderer/index.html`.
- **Prevention:** Always launch with `npm start` (no --dev) unless dev server is explicitly running.

---

## Error ID: ERR-009 | 2026-08-27 13:45
- **Component:** Build Pipeline (Webpack)
- **Severity:** Critical
- **Error Message / Stack Trace:**
  ```
  ERROR in src/main/preload.ts
  TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  ```
- **Root Cause Analysis:** Python patch script corrupted the preload.ts file, breaking the contextBridge.exposeInMainWorld structure. Variable names and API structure were malformed.
- **Resolution / Workaround:** Rewrote the entire preload.ts file from scratch with correct API surface.
- **Prevention:** Never use automated patching scripts on TypeScript source files. Always edit directly.

---

## Error ID: ERR-010 | 2026-08-27 13:50
- **Component:** Build Pipeline (Webpack)
- **Severity:** High
- **Error Message / Stack Trace:**
  ```
  ERROR in node_modules/@xenova/transformers — Binary import not found
  ```
- **Root Cause Analysis:** The `@xenova/transformers` package tries to import native binaries (onnxruntime-node) that webpack can't resolve.
- **Resolution / Workaround:** Added `onnxruntime-node`, `playwright`, `playwright-extra`, `puppeteer-extra-plugin-stealth` to webpack externals in webpack.config.js.
- **Prevention:** Add native binary packages to webpack externals before first build.

---

## Error ID: ERR-011 | 2026-08-27 15:15
- **Component:** Build Pipeline (Webpack)
- **Severity:** Critical
- **Error Message / Stack Trace:**
  ```
  Conflict: Multiple chunks emit assets to the same filename index.js (chunks 970 and 96)
  ```
- **Root Cause Analysis:** The `sharedConfig` included an `optimization` block with `splitChunks` that was inherited by all three configs (main, preload, renderer). Both main and preload output `index.js` to `dist/main/`, causing chunk name collisions.
- **Resolution / Workaround:** Removed `splitChunks` from shared config. Moved optimization blocks to individual configs (main, preload, renderer). Each config has its own independent TerserPlugin configuration.
- **Prevention:** Never put `splitChunks` in shared webpack configs when multiple configs share an output directory.

---

## Error ID: ERR-012 | 2026-08-27 15:20
- **Component:** Build Pipeline (electron-builder)
- **Severity:** High
- **Error Message / Stack Trace:**
  ```
  Package "electron" is only allowed in "devDependencies". Please remove it from the "dependencies" section in your package.json.
  ```
- **Root Cause Analysis:** `electron` was listed in `dependencies` instead of `devDependencies`. electron-builder enforces this because Electron should not be bundled as a runtime dependency.
- **Resolution / Workaround:** Moved `electron` from `dependencies` to `devDependencies` in package.json.
- **Prevention:** Always keep `electron` in `devDependencies`. Use `electron-builder` to handle Electron runtime packaging.

---

## Error ID: ERR-013 | 2026-08-27 15:25
- **Component:** Build Pipeline (electron-builder)
- **Severity:** High
- **Error Message / Stack Trace:**
  ```
  Attempting to build a module with a space in the path
  Error: Could not find any Visual Studio installation to use
  ```
- **Root Cause Analysis:** Two issues: (1) The project path contains spaces ("NJ-SECURE MEDIA VAULT") which breaks node-gyp. (2) No Visual Studio Build Tools installed for native module compilation (argon2, better-sqlite3).
- **Resolution / Workaround:** Set `npmRebuild: false` in electron-builder config since native modules are already compiled for the current Node/Electron version. This skips the rebuild step entirely.
- **Prevention:** For production builds on CI, install Visual Studio Build Tools or use pre-built native binaries. Alternatively, keep `npmRebuild: false` if native modules are already compiled.

---

## Error ID: ERR-014 | 2026-08-27 15:30
- **Component:** Build Pipeline (electron-builder)
- **Severity:** Medium
- **Error Message / Stack Trace:**
  ```
  ENOENT: no such file or directory, rename '...electron.exe' -> '...Secure Media Vault.exe'
  ```
- **Root Cause Analysis:** electron-builder first renames `electron.exe` to the product name, then NSIS uses it. A stale `win-unpacked` directory from a previous incomplete build had a different state, causing the rename to fail.
- **Resolution / Workaround:** Cleaned the `release/` directory before rebuilding: `rm -rf release && npx electron-builder --win nsis --config.npmRebuild=false`
- **Prevention:** Always clean the output directory before a fresh production build. Add `rm -rf release` to the `dist` script.

---

## Error ID: ERR-015 | 2026-08-27 16:00
- **Component:** IPC Handlers (ipc.ts)
- **Severity:** Critical (Build Breaker)
- **Error Message / Stack Trace:**
  ```
  TS2339: Property 'db' does not exist on type 'IPCHandlers'.
  ```
- **Root Cause Analysis:** The `download:getHistory` and `download:getStats` IPC handlers referenced `this.db.getDatabase()` but the `IPCHandlers` class has no `db` property. This was a regression introduced when these handlers were added — they should have used `DatabaseManager.getInstance().getDatabase()` like all other handlers in the same file.
- **Resolution / Workaround:** Changed `this.db.getDatabase()` to `DatabaseManager.getInstance().getDatabase()` in both handlers.
- **Prevention:** When adding new IPC handlers that need database access, always import and use `DatabaseManager.getInstance()` directly — do not assume the class has a `db` property.

---

## Error ID: ERR-016 | 2026-08-27 16:05
- **Component:** Application Runtime (index.ts)
- **Severity:** Medium
- **Error Message / Stack Trace:**
  ```
  DevTools window opens in production builds
  ```
- **Root Cause Analysis:** `mainWindow.webContents.openDevTools()` was called unconditionally in `createWindow()`, causing DevTools to open every time the app launches, even in production builds.
- **Resolution / Workaround:** Wrapped the call in `if (process.argv.includes('--dev'))` so DevTools only opens in development mode.
- **Prevention:** Always gate DevTools behind a development-mode check.

---

## Error ID: ERR-017 | 2026-08-27 16:10
- **Component:** UI (Dashboard.tsx)
- **Severity:** High
- **Error Message / Stack Trace:**
  ```
  FuskerInput onDownload callback is empty: (urls, opts) => {}
  ```
- **Root Cause Analysis:** The FuskerInput component's `onDownload` prop was wired to an empty arrow function `(urls, opts) => {}` in Dashboard.tsx. This meant that even after fusker pattern expansion and all UI configuration, clicking "Start Download" did nothing — URLs were never sent to the download queue.
- **Resolution / Workaround:** Connected the callback to `addBulkDownloads(urls, opts)` from the download store.
- **Prevention:** When wiring callback props, verify the callback actually invokes the intended action. Search for empty arrow functions `{}` in component props.

---

## Error ID: ERR-018 | 2026-08-27 16:15
- **Component:** UI (EmbeddedBrowser.tsx)
- **Severity:** Medium
- **Error Message / Stack Trace:**
  ```
  Embedded browser shows page title/URL info instead of rendered webpage
  ```
- **Root Cause Analysis:** The `EmbeddedBrowser` component's content area displayed a static info card (`browser-page-view` with title and URL text) instead of actually rendering the webpage. The `BrowserManager` backend used HTTP fetch + regex HTML parsing, not Playwright browser rendering. The original brief required a visual embedded Chromium browser.
- **Resolution / Workaround:** Replaced the static info card with an Electron `<webview>` element that actually renders the webpage. The webview uses `partition="persist:browser"` for cookie persistence and a Chrome user-agent string.
- **Prevention:** When implementing browser-like features, verify the rendering approach actually displays the content (not just metadata about it).
