import { create } from 'zustand'
import type { ChatRunReward, WorkspaceContextSnapshot } from '../types'

export interface ChatContextSnapshot {
  chatSessionId: string
  workspaceDirectory: string
  contextFiles: number
  unresolvedMentions: number
  generatedAt: number
  gitBranch: string | null
  gitDirtyFiles: number
}

interface WorkspaceIntelligenceStore {
  snapshots: Record<string, WorkspaceContextSnapshot>
  latestContextByChat: Record<string, ChatContextSnapshot>
  rewards: ChatRunReward[]
  upsertSnapshot: (snapshot: WorkspaceContextSnapshot) => void
  setChatContextSnapshot: (snapshot: ChatContextSnapshot) => void
  addReward: (reward: Omit<ChatRunReward, 'id' | 'timestamp'>) => ChatRunReward
}

let rewardCounter = 0

export const useWorkspaceIntelligenceStore = create<WorkspaceIntelligenceStore>((set) => ({
  snapshots: {},
  latestContextByChat: {},
  rewards: [],

  upsertSnapshot: (snapshot) =>
    set((state) => ({
      snapshots: {
        ...state.snapshots,
        [snapshot.directory]: snapshot,
      },
    })),

  setChatContextSnapshot: (snapshot) =>
    set((state) => ({
      latestContextByChat: {
        ...state.latestContextByChat,
        [snapshot.chatSessionId]: snapshot,
      },
    })),

  addReward: (reward) => {
    const entry: ChatRunReward = {
      ...reward,
      id: `reward-${++rewardCounter}-${Date.now()}`,
      timestamp: Date.now(),
    }
    set((state) => ({
      rewards: [...state.rewards, entry].slice(-200),
    }))
    return entry
  },
}))
