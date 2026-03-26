import {
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

export function WorkspaceHome({
  workingDirectory,
  workspaceRoot,
  lastResumableRun,
  lastSuccessfulStarterJobId,
  onChooseFolder,
  onLaunchStarterJob,
  onResumeRun,
}: WorkspaceHomeProps) {
  const workspaceLabel = workingDirectory
    ? workingDirectory.split('/').pop() ?? workingDirectory
    : workspaceRoot
      ? workspaceRoot.split('/').pop() ?? workspaceRoot
      : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520, margin: '0 auto', paddingTop: 24 }}>
      {/* Workspace header */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#74747C', fontSize: 10, fontWeight: 700, letterSpacing: 1.2 }}>
          {workspaceLabel ? 'WORKSPACE' : 'NO WORKSPACE'}
        </div>
        {workspaceLabel ? (
          <div style={{ marginTop: 6, color: '#ECE7DE', fontSize: 18, fontWeight: 700 }}>
            {workspaceLabel}
          </div>
        ) : (
          <button
            type="button"
            onClick={onChooseFolder}
            style={{
              marginTop: 10,
              border: '1px solid rgba(84,140,90,0.45)',
              background: 'rgba(84,140,90,0.1)',
              color: '#D9E6DA',
              borderRadius: 8,
              padding: '6px 14px',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Choose folder
          </button>
        )}
      </div>

      {/* Resume last run */}
      {lastResumableRun ? (
        <button
          type="button"
          onClick={() => onResumeRun(lastResumableRun)}
          className="glass-panel"
          style={{
            borderRadius: 10,
            padding: '10px 14px',
            border: '1px solid rgba(84,140,90,0.35)',
            background: 'rgba(84,140,90,0.08)',
            cursor: 'pointer',
            textAlign: 'left',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ color: '#D9E6DA', fontSize: 12, fontWeight: 700 }}>
              {lastResumableRun.title}
            </div>
            <div style={{ color: '#7D9B82', fontSize: 10, marginTop: 2 }}>
              {formatRelativeTime(lastResumableRun.updatedAt)}
            </div>
          </div>
          <div style={{ color: '#7D9B82', fontSize: 11, fontWeight: 700 }}>
            Resume
          </div>
        </button>
      ) : null}

      {/* Starter jobs — compact single row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {STARTER_JOBS.map((job) => {
          const isLastSuccess = lastSuccessfulStarterJobId === job.id
          return (
            <button
              key={job.id}
              type="button"
              onClick={() => onLaunchStarterJob(job.id)}
              style={{
                border: isLastSuccess
                  ? '1px solid rgba(84,140,90,0.4)'
                  : '1px solid rgba(89,86,83,0.24)',
                background: isLastSuccess
                  ? 'rgba(84,140,90,0.1)'
                  : 'rgba(18,18,17,0.7)',
                color: isLastSuccess ? '#D9E6DA' : '#9A9692',
                borderRadius: 8,
                padding: '6px 12px',
                fontFamily: 'inherit',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
              title={job.description}
            >
              {job.title}
            </button>
          )
        })}
      </div>

      <div style={{ textAlign: 'center', color: '#595653', fontSize: 11 }}>
        or just type a message below
      </div>
    </div>
  )
}
