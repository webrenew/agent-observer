# Agent Observer

3D observability app for AI coding agents. Electron desktop app that embeds real terminal sessions and visualizes Claude Code agents as voxel characters working in an isometric office.

## Quick Start

```bash
pnpm install
pnpm dev          # launches Electron with hot-reload
pnpm build        # production build → out/
```

## Architecture

**Electron app** with three process layers:

```
src/main/          → Electron main process (node-pty terminals, IPC)
src/preload/       → Context bridge (electronAPI)
src/renderer/      → React + Three.js UI (Vite-bundled)
```

### Main Process (`src/main/`)
- `index.ts` — Window creation, lifecycle
- `terminal.ts` — PTY sessions via node-pty, Claude detection polling (1s interval), IPC handlers

### Renderer (`src/renderer/`)

```
components/        → Terminal UI (TerminalPanel, TerminalTab)
scene/             → R3F 3D scene (Office, Desk, AgentCharacter, Room, Lighting, OfficeCat)
scene/effects/     → Status effects (ThoughtBubble, DeskFire, Papers, Confetti, OfficePlant)
hud/               → 2D overlay (HUD, AgentCard, StatsBar, Toast)
services/          → ClaudeDetector (regex-based terminal output parser)
store/             → Zustand store (agents.ts — agents, terminals, toasts)
types.ts           → All shared types (Agent, AgentStatus, CelebrationType, etc.)
```

## Key Data Flow

1. **Terminal → PTY**: User types in xterm.js → `terminal:write` IPC → node-pty
2. **PTY → Terminal + Detection**: node-pty output → `terminal:data` IPC → xterm.js render + `ClaudeDetector.feed()`
3. **Claude Detection**: Main process polls foreground process name + scans output patterns → `terminal:claude-status` IPC
4. **Agent Lifecycle**: Claude starts → `addAgent()` spawns 3D character at desk. Claude exits → `removeAgent()`.
5. **Activity Tracking**: `ClaudeDetector` extracts status, tokens, file edits, commits from terminal output → `updateAgent()` in store
6. **Celebrations**: Git commit detected → confetti burst (4s) + persistent desk plant (max 5) + toast

## Agent State

Agents live in the Zustand store (`store/agents.ts`). Key fields:

| Field | Source | Notes |
|-------|--------|-------|
| `status` | ClaudeDetector | thinking/streaming/tool_calling/error/done |
| `tokens_input/output` | ClaudeDetector | Cumulative, set directly from CLI output |
| `files_modified` | ClaudeDetector | Incremented on Wrote/Created/Updated/Edited |
| `commitCount` | ClaudeDetector | Drives plant count (max 5 rendered) |
| `activeCelebration` | TerminalTab | Set to `'confetti'`, auto-cleared after 4s |
| `appearance` | Random on spawn | Shirt, hair, skin, pants, gender — voxel style |

## ClaudeDetector Patterns

The detector (`services/claudeDetector.ts`) matches terminal output against regex patterns:

- **Status**: spinner chars, box-drawing, tool names, error/done markers
- **Tokens**: `N input ... N output` or `Tokens: N ... N`
- **Files**: `Wrote|Created|Updated|Edited <filename>`
- **Commits**: `[branch hash]` (git commit success line)

## 3D Effects

Each agent status maps to a character animation + optional desk effect:

| Status | Animation | Effect |
|--------|-----------|--------|
| thinking | Pacing, bouncing | ThoughtBubble |
| streaming | Seated, rapid typing | Papers |
| tool_calling | Walking between points | — |
| error | Shaking, arms up | DeskFire |
| done | Arms raised victory | Green glow |
| (commit) | — | Confetti burst + OfficePlant |

## Conventions

- **pnpm** as package manager
- **TypeScript** strict, no `any`
- **Functional React** with hooks, no classes
- **Zustand** for state — direct `getState()` in callbacks, hooks in components
- **R3F** for 3D — instanced meshes for particle effects, `useFrame` for animation
- **Tailwind v4** for 2D styling
- Effects are self-contained in `scene/effects/` — each takes a `position` prop
- Agent appearance is randomized on spawn, not user-configurable
- Main process detection is dual: process name polling + output pattern matching

## Build & Distribution

### Packaging
```bash
pnpm package        # electron-vite build + electron-builder --mac --dir
pnpm package:dmg    # electron-vite build + electron-builder --mac dmg
```
- Output lands in `release/` — DMG, blockmap, and `latest-mac.yml` (for electron-updater)
- Mac config uses `"identity": null` — skips code signing (no Apple Developer account needed)
- Users must **right-click > Open** on first launch to bypass Gatekeeper

### Releasing
1. Bump `version` in `package.json`
2. `pnpm package:dmg` locally (CI doesn't build DMGs)
3. PR → merge to main
4. `gh release create vX.Y.Z release/agent-observer-*.dmg release/*.blockmap release/latest-mac.yml --target main`
5. The `latest-mac.yml` is required for electron-updater auto-update detection

### Gotchas
- **Branch protection** is strict — can't push to main directly or admin-merge past failed checks
- **npm audit endpoint** can go down (500 errors); CI audit step handles this gracefully with `ERR_PNPM_AUDIT_BAD_RESPONSE` detection
- **Transitive dep vulnerabilities** (e.g. `tar`, `minimatch` in electron toolchain) — fix via `pnpm.overrides` in `package.json`, not by upgrading direct deps
- **GitHub release tags**: when recreating a release, use `--target main` if the tag already exists locally

## IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `terminal:create` | renderer → main | Spawn PTY, returns `{ id }` |
| `terminal:write` | renderer → main | Send keystrokes to PTY |
| `terminal:resize` | renderer → main | Sync xterm dimensions |
| `terminal:kill` | renderer → main | Destroy PTY session |
| `terminal:data` | main → renderer | PTY output chunks |
| `terminal:exit` | main → renderer | PTY process exited |
| `terminal:claude-status` | main → renderer | Claude running state change |
