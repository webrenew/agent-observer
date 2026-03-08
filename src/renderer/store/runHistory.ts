import { create } from 'zustand'
import type {
  OfficeFocusMode,
  RunHistoryListOptions,
  RunRecord,
  StarterJobId,
} from '../../shared/run-history'
import { findLastResumableRun } from '../lib/soloDevCockpit'

const PREFS_KEY = 'agent-observer:solo-cockpit:v1'

interface PendingStarterLaunch {
  jobId: StarterJobId
  requestedAt: number
}

interface CockpitPrefs {
  officeFocusMode: OfficeFocusMode
  lastSuccessfulStarterJobId: StarterJobId | null
  lastResumableRunId: string | null
  onboarding: {
    claudeVerifiedAt: number | null
    workspaceChosenAt: number | null
    starterJobRequestedAt: number | null
    completedAt: number | null
  }
}

interface RunHistoryStore extends CockpitPrefs {
  runs: RunRecord[]
  isLoading: boolean
  isLoaded: boolean
  error: string | null
  pendingStarterLaunch: PendingStarterLaunch | null
  loadRuns: (options?: RunHistoryListOptions) => Promise<void>
  refreshRuns: () => Promise<void>
  setOfficeFocusMode: (mode: OfficeFocusMode) => void
  markClaudeVerified: () => void
  markWorkspaceChosen: () => void
  completeOnboarding: () => void
  queueStarterLaunch: (jobId: StarterJobId) => void
  consumeStarterLaunch: (jobId?: StarterJobId) => void
  markStarterJobSuccess: (jobId: StarterJobId, runId?: string | null) => void
  setLastResumableRunId: (runId: string | null) => void
}

const defaultPrefs: CockpitPrefs = {
  officeFocusMode: 'follow-active',
  lastSuccessfulStarterJobId: null,
  lastResumableRunId: null,
  onboarding: {
    claudeVerifiedAt: null,
    workspaceChosenAt: null,
    starterJobRequestedAt: null,
    completedAt: null,
  },
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function loadPrefs(): CockpitPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return defaultPrefs
    const parsed: unknown = JSON.parse(raw)
    if (!isObject(parsed)) return defaultPrefs
    return {
      officeFocusMode: parsed.officeFocusMode === 'show-errors' || parsed.officeFocusMode === 'changed-files'
        ? parsed.officeFocusMode
        : 'follow-active',
      lastSuccessfulStarterJobId: typeof parsed.lastSuccessfulStarterJobId === 'string'
        ? parsed.lastSuccessfulStarterJobId as StarterJobId
        : null,
      lastResumableRunId: typeof parsed.lastResumableRunId === 'string' ? parsed.lastResumableRunId : null,
      onboarding: isObject(parsed.onboarding)
        ? {
          claudeVerifiedAt: typeof parsed.onboarding.claudeVerifiedAt === 'number'
            ? parsed.onboarding.claudeVerifiedAt
            : null,
          workspaceChosenAt: typeof parsed.onboarding.workspaceChosenAt === 'number'
            ? parsed.onboarding.workspaceChosenAt
            : null,
          starterJobRequestedAt: typeof parsed.onboarding.starterJobRequestedAt === 'number'
            ? parsed.onboarding.starterJobRequestedAt
            : null,
          completedAt: typeof parsed.onboarding.completedAt === 'number'
            ? parsed.onboarding.completedAt
            : null,
        }
        : defaultPrefs.onboarding,
    }
  } catch {
    return defaultPrefs
  }
}

function savePrefs(state: CockpitPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(state))
  } catch (error) {
    console.error('[runHistory] Failed to persist cockpit prefs:', error)
  }
}

const initialPrefs = loadPrefs()

export const useRunHistoryStore = create<RunHistoryStore>((set, get) => ({
  ...initialPrefs,
  runs: [],
  isLoading: false,
  isLoaded: false,
  error: null,
  pendingStarterLaunch: null,

  loadRuns: async (options) => {
    set({ isLoading: true, error: null })
    try {
      const runs = await window.electronAPI.runHistory.list(options)
      const lastResumableRun = findLastResumableRun(runs)
      set((state) => ({
        runs,
        isLoading: false,
        isLoaded: true,
        error: null,
        lastResumableRunId: state.lastResumableRunId
          && runs.some((run) => run.id === state.lastResumableRunId)
          ? state.lastResumableRunId
          : lastResumableRun?.id ?? null,
      }))
      savePrefs({
        officeFocusMode: get().officeFocusMode,
        lastSuccessfulStarterJobId: get().lastSuccessfulStarterJobId,
        lastResumableRunId: get().lastResumableRunId,
        onboarding: get().onboarding,
      })
    } catch (error) {
      set({
        isLoading: false,
        isLoaded: true,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  },

  refreshRuns: async () => {
    await get().loadRuns()
  },

  setOfficeFocusMode: (mode) => {
    set({ officeFocusMode: mode })
    savePrefs({
      officeFocusMode: mode,
      lastSuccessfulStarterJobId: get().lastSuccessfulStarterJobId,
      lastResumableRunId: get().lastResumableRunId,
      onboarding: get().onboarding,
    })
  },

  markClaudeVerified: () => {
    const onboarding = {
      ...get().onboarding,
      claudeVerifiedAt: Date.now(),
    }
    set({ onboarding })
    savePrefs({
      officeFocusMode: get().officeFocusMode,
      lastSuccessfulStarterJobId: get().lastSuccessfulStarterJobId,
      lastResumableRunId: get().lastResumableRunId,
      onboarding,
    })
  },

  markWorkspaceChosen: () => {
    const onboarding = {
      ...get().onboarding,
      workspaceChosenAt: Date.now(),
    }
    set({ onboarding })
    savePrefs({
      officeFocusMode: get().officeFocusMode,
      lastSuccessfulStarterJobId: get().lastSuccessfulStarterJobId,
      lastResumableRunId: get().lastResumableRunId,
      onboarding,
    })
  },

  completeOnboarding: () => {
    const onboarding = {
      ...get().onboarding,
      completedAt: Date.now(),
    }
    set({ onboarding })
    savePrefs({
      officeFocusMode: get().officeFocusMode,
      lastSuccessfulStarterJobId: get().lastSuccessfulStarterJobId,
      lastResumableRunId: get().lastResumableRunId,
      onboarding,
    })
  },

  queueStarterLaunch: (jobId) => {
    const requestedAt = Date.now()
    const onboarding = {
      ...get().onboarding,
      starterJobRequestedAt: requestedAt,
    }
    set({
      pendingStarterLaunch: { jobId, requestedAt },
      onboarding,
    })
    savePrefs({
      officeFocusMode: get().officeFocusMode,
      lastSuccessfulStarterJobId: get().lastSuccessfulStarterJobId,
      lastResumableRunId: get().lastResumableRunId,
      onboarding,
    })
  },

  consumeStarterLaunch: (jobId) => {
    const pending = get().pendingStarterLaunch
    if (!pending) return
    if (jobId && pending.jobId !== jobId) return
    set({ pendingStarterLaunch: null })
  },

  markStarterJobSuccess: (jobId, runId) => {
    set({
      lastSuccessfulStarterJobId: jobId,
      lastResumableRunId: runId ?? get().lastResumableRunId,
    })
    savePrefs({
      officeFocusMode: get().officeFocusMode,
      lastSuccessfulStarterJobId: jobId,
      lastResumableRunId: runId ?? get().lastResumableRunId,
      onboarding: get().onboarding,
    })
  },

  setLastResumableRunId: (runId) => {
    set({ lastResumableRunId: runId })
    savePrefs({
      officeFocusMode: get().officeFocusMode,
      lastSuccessfulStarterJobId: get().lastSuccessfulStarterJobId,
      lastResumableRunId: runId,
      onboarding: get().onboarding,
    })
  },
}))
