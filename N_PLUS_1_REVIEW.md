# N+1 Issue Review — Agent Observer

## Executive Summary

This is an Electron desktop application (not a traditional database-backed web app), so "N+1" patterns manifest as **sequential filesystem I/O**, **sequential IPC calls**, and **repeated per-item operations** rather than database queries. The codebase is generally well-structured, but several areas exhibit N+1-style inefficiencies where batching or parallelization would improve performance.

---

## Issues Found

### 1. 🔴 `readDirectory()` — Sequential `stat()` per directory entry
**File:** `src/main/filesystem.ts` (lines ~52–73)  
**Severity:** High (called on every directory expansion in File Explorer)

```typescript
async function readDirectory(dirPath: string, showHidden: boolean): Promise<FileEntry[]> {
  const entries = await fs.promises.readdir(resolved, { withFileTypes: true })
  const results: FileEntry[] = []
  for (const entry of entries) {
    // ...
    const stat = await fs.promises.stat(fullPath)  // ← N+1: sequential stat per entry
    results.push({ ... })
  }
  return results
}
```

**Problem:** For a directory with N entries, this makes N sequential `stat()` calls. Each `stat()` is an independent syscall that could be parallelized.

**Fix:** Use `Promise.all()` or `Promise.allSettled()` to parallelize stat calls:
```typescript
const statPromises = entries
  .filter(entry => showHidden || !shouldIgnoreFilesystemEntry(entry.name, entry.isDirectory()))
  .map(async (entry) => {
    const fullPath = path.join(resolved, entry.name)
    try {
      const stat = await fs.promises.stat(fullPath)
      return { name: entry.name, path: fullPath, isDirectory: entry.isDirectory(), isSymlink: entry.isSymbolicLink(), size: stat.size, modified: stat.mtimeMs }
    } catch { return null }
  })
const results = (await Promise.all(statPromises)).filter(Boolean)
```

**Alternative:** Node.js 20+ supports `fs.promises.readdir(path, { withFileTypes: true, recursive: false })` which already provides `Dirent` objects. However, `Dirent` doesn't include `size` or `mtimeMs`, so `stat()` is still needed for those fields. The fix is parallelization.

---

### 2. 🔴 `workspace.openFolder()` — Sequential `updateChatSession()` per chat session
**File:** `src/renderer/store/workspace.ts` (lines ~93–103)  
**Severity:** Medium-High (called on every folder open, triggers N store updates + N localStorage writes)

```typescript
openFolder: (path: string) => {
  // ...
  const { chatSessions, updateChatSession } = useAgentStore.getState()
  for (const session of chatSessions) {
    if (session.agentId) continue
    if (session.directoryMode === 'custom') continue
    if (session.workingDirectory === path && session.directoryMode === 'workspace') continue
    updateChatSession(session.id, {  // ← N+1: each call triggers setState + localStorage.setItem
      workingDirectory: path,
      directoryMode: 'workspace',
    })
  }
}
```

**Problem:** Each `updateChatSession()` call triggers:
1. A Zustand `set()` (new state object + re-render)
2. `savePersistedChatState()` which calls `localStorage.setItem()` with JSON serialization

For N chat sessions, this produces N state updates and N localStorage writes.

**Fix:** Batch the update into a single state mutation:
```typescript
openFolder: (path: string) => {
  // ...
  set((state) => {
    const chatSessions = state.chatSessions.map((session) => {
      if (session.agentId) return session
      if (session.directoryMode === 'custom') return session
      if (session.workingDirectory === path && session.directoryMode === 'workspace') return session
      return { ...session, workingDirectory: path, directoryMode: 'workspace' as const }
    })
    savePersistedChatState(chatSessions, state.activeChatSessionId)
    return { chatSessions }
  })
}
```

The same issue exists in `closeFolder()` at lines ~105–113.

---

### 3. 🟡 `workspace-context.ts` — Sequential `fs.existsSync()` for key files
**File:** `src/main/workspace-context.ts` (lines ~93–94)  
**Severity:** Low-Medium (called once per workspace snapshot request)

```typescript
const keyFiles = KNOWN_KEY_FILES.filter((name) => fs.existsSync(path.join(directory, name))).slice(0, 12)
```

**Problem:** Checks up to 18 files sequentially with synchronous `existsSync()`. While each call is fast, this blocks the main process event loop.

**Fix:** Use async `fs.promises.access()` with `Promise.allSettled()`:
```typescript
const keyFileChecks = await Promise.allSettled(
  KNOWN_KEY_FILES.map(async (name) => {
    await fs.promises.access(path.join(directory, name))
    return name
  })
)
const keyFiles = keyFileChecks
  .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
  .map(r => r.value)
  .slice(0, 12)
```

Note: The entire `buildWorkspaceSnapshot()` function uses synchronous I/O (`fs.existsSync`, `fs.readFileSync`, `execFileSync`) which blocks the main process. Converting to async would be a larger refactor but would eliminate main-thread blocking.

---

### 4. 🟡 `detectTechHints()` — Sequential `fs.existsSync()` calls
**File:** `src/main/workspace-context.ts` (lines ~96–107)  
**Severity:** Low-Medium

```typescript
function detectTechHints(directory: string, packageJson: Record<string, unknown> | null): string[] {
  // ...
  if (fs.existsSync(path.join(directory, 'pyproject.toml')) || fs.existsSync(path.join(directory, 'requirements.txt'))) {
    hints.add('python')
  }
  if (fs.existsSync(path.join(directory, 'go.mod'))) hints.add('go')
  if (fs.existsSync(path.join(directory, 'Cargo.toml'))) hints.add('rust')
  if (fs.existsSync(path.join(directory, 'Dockerfile'))) hints.add('docker')
}
```

**Problem:** Up to 5 sequential synchronous filesystem checks on the main process thread.

**Fix:** Same as #3 — batch into parallel async checks.

---

### 5. 🟡 `resolveClaudeBinary()` — Sequential `fs.accessSync()` across candidates
**File:** `src/main/claude-session.ts` (lines ~100–130) and `src/main/agent-namer.ts` (lines ~30–55)  
**Severity:** Low (cached after first resolution, but duplicated logic)

```typescript
function resolveClaudeBinary(): string {
  // ...
  for (const candidate of candidates) {
    try {
      fs.accessSync(candidate, fs.constants.X_OK)  // ← Sequential check per candidate
      return candidate
    } catch { /* continue */ }
  }
}
```

**Problem:** Iterates through ~8+ candidate paths sequentially. This is also **duplicated** between `claude-session.ts` and `agent-namer.ts`.

**Fix:** 
1. The result is cached, so the sequential check only happens once — low severity.
2. However, the duplication should be consolidated. `agent-namer.ts` should import from `claude-session.ts` instead of reimplementing.

---

### 6. 🟡 `resolveMemoriesBinary()` — Sequential `fs.existsSync()` + `fs.accessSync()`
**File:** `src/main/memories.ts` (lines ~40–75)  
**Severity:** Low (called once at startup)

Same pattern as #5 — sequential filesystem probing for binary location. Low impact since it's a one-time startup cost.

---

### 7. 🟡 `claude-profile.ts` — Sequential `fs.existsSync()` for plugin dirs
**File:** `src/main/claude-profile.ts` (lines ~140–155)  
**Severity:** Low-Medium (called per Claude session start)

```typescript
const pluginDirs = profile.pluginDirs
  .map((entry) => expandUserPath(entry))
  .filter((entry) => {
    if (!fs.existsSync(entry)) {  // ← Sequential per plugin dir
      missingPathWarnings.push(...)
      return false
    }
    try {
      return fs.statSync(entry).isDirectory()  // ← Another sequential call
    } catch { ... }
  })
```

**Problem:** For each plugin directory, two sequential synchronous filesystem calls.

---

### 8. 🟡 `broadcastSchedulerUpdate()` / `broadcastTodoRunnerUpdate()` — Iterating all windows
**File:** `src/main/scheduler.ts` and `src/main/todo-runner.ts`  
**Severity:** Low (typically 1-2 windows)

```typescript
function broadcastSchedulerUpdate(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('scheduler:updated')
    }
  }
}
```

**Problem:** Iterates all windows for every scheduler state change. In practice this is 1-2 windows, but the pattern is called very frequently (after every task state change, every tick, etc.).

**Fix:** Track the specific windows that need updates rather than broadcasting to all.

---

### 9. 🟡 `emitEvent()` in `claude-session.ts` — Fallback broadcasts to all windows
**File:** `src/main/claude-session.ts` (lines ~280–295)  
**Severity:** Low (fallback path only)

```typescript
function emitEvent(event: ClaudeEvent): void {
  const targetWebContentsIds = resolveEventTargetWebContentsIds(event.sessionId)
  if (targetWebContentsIds.length === 0) {
    // Compatibility fallback — broadcasts to ALL windows
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed()) {
        w.webContents.send('claude:event', event)
      }
    }
    return
  }
  // ...
}
```

**Problem:** The fallback path sends events to every window. The primary path is targeted, but the fallback could be noisy.

---

### 10. 🟢 `recordTokenSnapshot` / `recordModelTokens` — Full agents array map per update
**File:** `src/renderer/store/agents.ts`  
**Severity:** Low (in-memory, no I/O)

```typescript
recordTokenSnapshot: (id) =>
  set((state) => ({
    agents: state.agents.map((a) => {  // ← Maps entire array to update one agent
      if (a.id !== id) return a
      // ...
    }),
  })),
```

**Problem:** Every token snapshot update maps over the entire agents array. With many agents, this creates unnecessary object allocations. This is a common Zustand pattern and not a true N+1, but worth noting for performance-sensitive paths (called every few seconds per agent).

---

### 11. 🟢 `listTasks()` / `listJobs()` — `computeNextRunAt()` per task on every list call
**File:** `src/main/scheduler.ts`  
**Severity:** Low

```typescript
function toTaskWithRuntime(task: SchedulerTask): SchedulerTaskWithRuntime {
  // ...
  return {
    ...task,
    nextRunAt: computeNextRunAt(task),  // ← Scans up to 527,040 minutes per task
    // ...
  }
}

function listTasks(): SchedulerTaskWithRuntime[] {
  return tasksCache.map(toTaskWithRuntime)  // ← N tasks × expensive computation
}
```

**Problem:** `computeNextRunAt()` iterates up to `SCHEDULER_MAX_SCAN_MINUTES` (527,040) per task. `listTasks()` is called on every IPC `scheduler:list` request. With many tasks, this could be slow.

**Fix:** Cache `nextRunAt` and invalidate only when the task's cron expression or enabled state changes.

---

## Non-Issues (Reviewed and Cleared)

- **Zustand selectors** (`src/renderer/store/selectors.ts`): Uses `useMemo` correctly — no N+1.
- **Search index** (`src/main/filesystem-search-service.ts`): Uses caching with TTL — no N+1 on repeated searches.
- **Chat event handlers** (`src/renderer/components/chat/claudeEventHandlers.ts`): Event-driven, no iteration patterns.
- **File Explorer lazy loading** (`FileExplorerPanel.tsx`): Loads children on-demand per directory expansion — this is the correct pattern for tree views.

---

## Priority Recommendations

| Priority | Issue | Impact | Effort |
|----------|-------|--------|--------|
| **P1** | #1 — `readDirectory()` sequential stats | High — blocks every directory listing | Low — parallelize with `Promise.all` |
| **P1** | #2 — `openFolder()` N store updates | Medium-High — N re-renders + N localStorage writes | Low — batch into single `set()` |
| **P2** | #3/#4 — Sync I/O in workspace context | Medium — blocks main process | Medium — convert to async |
| **P2** | #11 — `computeNextRunAt()` per list call | Medium — expensive computation on every list | Low — cache result |
| **P3** | #5 — Duplicated binary resolution | Low — code duplication | Low — consolidate |
| **P3** | #8 — Broadcast to all windows | Low — typically 1-2 windows | Low — track specific windows |
