import {
  BUILT_IN_AUTOMATIONS,
  STARTER_JOBS,
  type BuiltInAutomationId,
  type RunRecord,
  type StarterJobId,
} from '../../../shared/run-history'

interface WorkspaceHomeProps {
  workingDirectory: string | null
  workspaceRoot: string | null
  recentFolders: string[]
  recentRuns: RunRecord[]
  lastResumableRun: RunRecord | null
  lastSuccessfulStarterJobId: StarterJobId | null
  onChooseFolder: () => void
  onOpenRecentFolder: (path: string) => void
  onLaunchStarterJob: (jobId: StarterJobId) => void
  onResumeRun: (run: RunRecord) => void
  onForkRun: (run: RunRecord) => void
  onInstallAutomation: (automationId: BuiltInAutomationId) => void
}

function formatRelativeTime(timestamp: number): string {
  const deltaMs = Date.now() - timestamp
  const deltaMinutes = Math.max(1, Math.round(deltaMs / 60_000))
  if (deltaMinutes < 60) return `${deltaMinutes}m ago`
  const deltaHours = Math.round(deltaMinutes / 60)
  if (deltaHours < 24) return `${deltaHours}h ago`
  return `${Math.round(deltaHours / 24)}d ago`
}

function statusColor(status: RunRecord['status']): string {
  switch (status) {
    case 'success':
      return '#548C5A'
    case 'error':
      return '#c45050'
    case 'stopped':
      return '#d4a040'
    default:
      return '#4C89D9'
  }
}

export function WorkspaceHome({
  workingDirectory,
  workspaceRoot,
  recentFolders,
  recentRuns,
  lastResumableRun,
  lastSuccessfulStarterJobId,
  onChooseFolder,
  onOpenRecentFolder,
  onLaunchStarterJob,
  onResumeRun,
  onForkRun,
  onInstallAutomation,
}: WorkspaceHomeProps) {
  const workspaceLabel = workingDirectory
    ? workingDirectory.split('/').pop() ?? workingDirectory
    : workspaceRoot
      ? workspaceRoot.split('/').pop() ?? workspaceRoot
      : 'No workspace'
  const visibleRecentFolders = recentFolders.slice(0, 5)
  const visibleRuns = recentRuns.slice(0, 5)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.4fr) minmax(260px, 0.9fr)',
        gap: 14,
        minHeight: '100%',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <section
          className="glass-panel"
          style={{
            borderRadius: 14,
            padding: 18,
            background:
              'linear-gradient(145deg, rgba(17,23,21,0.96), rgba(10,12,11,0.84))',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 12px 30px rgba(0,0,0,0.24)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: '#7D9B82', fontSize: 11, fontWeight: 700, letterSpacing: 1.2 }}>
                SOLO DEV COCKPIT
              </div>
              <h2 style={{ margin: '6px 0 4px', fontSize: 22, lineHeight: 1.1, color: '#ECE7DE' }}>
                Start meaningful work in one move.
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: '#8F8B87', maxWidth: 520 }}>
                Pick a starter job, resume the last interrupted run, or install one opinionated automation loop.
              </p>
            </div>
            <div
              style={{
                minWidth: 160,
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid rgba(84,140,90,0.22)',
                background: 'rgba(84,140,90,0.08)',
              }}
            >
              <div style={{ color: '#74747C', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>
                WORKSPACE
              </div>
              <div style={{ marginTop: 6, color: '#ECE7DE', fontSize: 15, fontWeight: 700 }}>
                {workspaceLabel}
              </div>
              <div style={{ marginTop: 4, color: '#7D9B82', fontSize: 11 }}>
                {workingDirectory ? 'Ready to launch' : 'Choose a folder to anchor runs'}
              </div>
            </div>
          </div>

          {!workingDirectory ? (
            <button
              type="button"
              onClick={onChooseFolder}
              style={{
                marginTop: 16,
                border: '1px solid rgba(84,140,90,0.45)',
                background: 'linear-gradient(180deg, rgba(27,41,31,0.95), rgba(17,27,20,0.95))',
                color: '#D9E6DA',
                borderRadius: 10,
                padding: '8px 12px',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Choose workspace
            </button>
          ) : null}
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 12,
          }}
        >
          {STARTER_JOBS.map((job) => {
            const isLastSuccess = lastSuccessfulStarterJobId === job.id
            return (
              <button
                key={job.id}
                type="button"
                onClick={() => onLaunchStarterJob(job.id)}
                className="glass-panel"
                style={{
                  borderRadius: 14,
                  padding: 16,
                  textAlign: 'left',
                  cursor: 'pointer',
                  border: isLastSuccess
                    ? '1px solid rgba(84,140,90,0.45)'
                    : '1px solid rgba(89,86,83,0.24)',
                  background: isLastSuccess
                    ? 'linear-gradient(180deg, rgba(19,31,23,0.94), rgba(11,15,13,0.92))'
                    : 'linear-gradient(180deg, rgba(18,18,17,0.92), rgba(12,12,11,0.92))',
                }}
              >
                <div style={{ color: isLastSuccess ? '#7D9B82' : '#74747C', fontSize: 10, fontWeight: 700, letterSpacing: 1.1 }}>
                  {job.eyebrow}
                </div>
                <div style={{ marginTop: 7, color: '#ECE7DE', fontSize: 16, fontWeight: 700 }}>
                  {job.title}
                </div>
                <div style={{ marginTop: 8, color: '#8F8B87', fontSize: 12, lineHeight: 1.55 }}>
                  {job.description}
                </div>
                <div style={{ marginTop: 12, color: isLastSuccess ? '#7D9B82' : '#9A9692', fontSize: 11, fontWeight: 700 }}>
                  {isLastSuccess ? 'Last successful starter' : 'Launch starter'}
                </div>
              </button>
            )
          })}
        </section>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <section className="glass-panel" style={{ borderRadius: 14, padding: 14 }}>
          <div style={{ color: '#74747C', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>
            RUN RECOVERY
          </div>
          {lastResumableRun ? (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ color: '#ECE7DE', fontSize: 14, fontWeight: 700 }}>
                  {lastResumableRun.title}
                </div>
                <div style={{ marginTop: 4, color: '#8F8B87', fontSize: 11 }}>
                  {lastResumableRun.workspaceDirectory ?? 'No workspace'} • {formatRelativeTime(lastResumableRun.updatedAt)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => onResumeRun(lastResumableRun)}
                  style={{
                    flex: 1,
                    border: '1px solid rgba(84,140,90,0.4)',
                    background: 'rgba(84,140,90,0.12)',
                    color: '#D9E6DA',
                    borderRadius: 9,
                    padding: '7px 10px',
                    fontFamily: 'inherit',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Resume
                </button>
                <button
                  type="button"
                  onClick={() => onForkRun(lastResumableRun)}
                  style={{
                    flex: 1,
                    border: '1px solid rgba(76,137,217,0.35)',
                    background: 'rgba(76,137,217,0.1)',
                    color: '#C7D9F2',
                    borderRadius: 9,
                    padding: '7px 10px',
                    fontFamily: 'inherit',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Fork
                </button>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 10, color: '#8F8B87', fontSize: 12, lineHeight: 1.5 }}>
              No resumable conversation yet. Starter jobs and scheduled runs will show up here once you launch them.
            </div>
          )}
        </section>

        <section className="glass-panel" style={{ borderRadius: 14, padding: 14 }}>
          <div style={{ color: '#74747C', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>
            RECENT RUNS
          </div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {visibleRuns.length > 0 ? visibleRuns.map((run) => (
              <div
                key={run.id}
                style={{
                  padding: '10px 11px',
                  borderRadius: 11,
                  border: '1px solid rgba(89,86,83,0.18)',
                  background: 'rgba(12,12,11,0.55)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: statusColor(run.status),
                      boxShadow: `0 0 10px ${statusColor(run.status)}55`,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#ECE7DE', fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {run.title}
                    </div>
                    <div style={{ color: '#8F8B87', fontSize: 10, marginTop: 2 }}>
                      {run.source} • {formatRelativeTime(run.updatedAt)}
                    </div>
                  </div>
                </div>
                {run.changedFiles.length > 0 ? (
                  <div style={{ marginTop: 8, color: '#7D9B82', fontSize: 10 }}>
                    {run.changedFiles.slice(0, 3).join(', ')}
                  </div>
                ) : null}
              </div>
            )) : (
              <div style={{ color: '#8F8B87', fontSize: 12, lineHeight: 1.5 }}>
                No runs recorded yet.
              </div>
            )}
          </div>
        </section>

        <section className="glass-panel" style={{ borderRadius: 14, padding: 14 }}>
          <div style={{ color: '#74747C', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>
            BUILT-IN AUTOMATIONS
          </div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {BUILT_IN_AUTOMATIONS.map((automation) => (
              <div
                key={automation.id}
                style={{
                  padding: '11px 12px',
                  borderRadius: 11,
                  border: '1px solid rgba(89,86,83,0.18)',
                  background: 'rgba(12,12,11,0.55)',
                }}
              >
                <div style={{ color: '#ECE7DE', fontSize: 12, fontWeight: 700 }}>
                  {automation.name}
                </div>
                <div style={{ marginTop: 5, color: '#8F8B87', fontSize: 11, lineHeight: 1.45 }}>
                  {automation.description}
                </div>
                <button
                  type="button"
                  onClick={() => onInstallAutomation(automation.id)}
                  style={{
                    marginTop: 10,
                    border: '1px solid rgba(212,160,64,0.38)',
                    background: 'rgba(212,160,64,0.08)',
                    color: '#E4D0A3',
                    borderRadius: 8,
                    padding: '6px 10px',
                    fontFamily: 'inherit',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Install
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-panel" style={{ borderRadius: 14, padding: 14 }}>
          <div style={{ color: '#74747C', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>
            RECENT REPOS
          </div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visibleRecentFolders.length > 0 ? visibleRecentFolders.map((folder) => (
              <button
                key={folder}
                type="button"
                onClick={() => onOpenRecentFolder(folder)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  padding: '9px 10px',
                  borderRadius: 10,
                  border: '1px solid rgba(89,86,83,0.18)',
                  background: 'rgba(12,12,11,0.55)',
                  color: '#9A9692',
                  fontFamily: 'inherit',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
                  {folder}
                </span>
                <span style={{ color: folder === workingDirectory ? '#7D9B82' : '#595653', fontWeight: 700 }}>
                  {folder === workingDirectory ? 'LIVE' : 'OPEN'}
                </span>
              </button>
            )) : (
              <div style={{ color: '#8F8B87', fontSize: 12 }}>
                Recent repos will appear here after you switch workspaces.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
