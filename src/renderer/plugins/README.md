# Renderer Plugin SDK

Agent Space can load renderer plugins from the `pluginDirs` configured in **Settings > General > Claude Profiles**.

## Discovery

Each directory is scanned for plugin manifests in this order:

1. `agent-space.plugin.json`
2. `openclaw.plugin.json`
3. `package.json` (with plugin hints like `agentSpace.rendererEntry`, `openclaw.rendererEntry`, `openclaw.extensions`, or plugin keywords)

## Minimal Manifest

```json
{
  "id": "hello-plugin",
  "name": "Hello Plugin",
  "version": "0.1.0",
  "rendererEntry": "./index.mjs"
}
```

## Plugin Entry API

Your `rendererEntry` module must export `default register(api)` (or named `register(api)`).

```js
export default function register(api) {
  const disposeHook = api.registerHook('session_start', (payload) => {
    api.log('info', 'session_start', payload)
  })

  const disposeCommand = api.registerCommand({
    name: 'hello',
    description: 'Reply from plugin',
    execute: (context) => `hello from ${context.workspaceDirectory ?? 'no-dir'}`,
  })

  return () => {
    disposeHook()
    disposeCommand()
  }
}
```

### `api.registerHook(event, handler, options?)`

Supported events:
- `session_start`
- `session_end`
- `message_received`
- `message_sent`
- `before_tool_call`
- `after_tool_call`

### `api.registerCommand({ name, description?, execute })`

Registers slash commands in chat input, for example `/hello`.

### `api.log(level, event, payload?)`

Writes plugin-scoped renderer diagnostics.

## Built-in Runtime Commands

- `/plugins` shows loaded plugins and commands.
- `/plugins reload` rescans plugin dirs.
- `/plugins-reload` rescans plugin dirs.
