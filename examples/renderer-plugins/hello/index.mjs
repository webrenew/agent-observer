export default function register(api) {
  api.log('info', 'hello.loaded', {
    pluginId: api.plugin.id,
    pluginName: api.plugin.name,
  })

  const disposeHook = api.registerHook('session_start', (payload) => {
    api.log('info', 'hello.session_start', {
      chatSessionId: payload.chatSessionId,
      workspaceDirectory: payload.workspaceDirectory,
      profileId: payload.profileId,
    })
  })

  const disposeCommand = api.registerCommand({
    name: 'hello',
    description: 'Respond with a hello message from the example plugin.',
    execute: (context) => {
      const cwd = context.workspaceDirectory ?? 'no workspace'
      return `hello from ${api.plugin.name} (cwd: ${cwd})`
    },
  })

  return () => {
    disposeHook()
    disposeCommand()
  }
}
