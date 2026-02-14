import { create } from 'zustand'
import type { Agent } from '@/types'
import { randomAppearance } from '@/types'

interface Toast {
  id: string
  message: string
  type: 'info' | 'error' | 'success'
}

interface DemoState {
  agents: Agent[]
  selectedAgentId: string | null
  toasts: Toast[]

  selectAgent: (id: string | null) => void
  updateAgent: (id: string, updates: Partial<Agent>) => void
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

let toastIdCounter = 0

const DEMO_AGENTS: Agent[] = [
  {
    id: 'agent-1',
    name: 'Claude #1',
    agent_type: 'cli',
    model: 'claude-sonnet-4-5-20250929',
    status: 'streaming',
    currentTask: 'Refactoring auth middleware',
    tokens_input: 12400,
    tokens_output: 3200,
    files_modified: 3,
    commitCount: 1,
    deskIndex: 0,
    started_at: Date.now() - 180000,
    appearance: randomAppearance(),
    activeCelebration: null,
    celebrationStartedAt: null,
  },
  {
    id: 'agent-2',
    name: 'Claude #2',
    agent_type: 'cli',
    model: 'claude-opus-4-6-20250915',
    status: 'thinking',
    currentTask: 'Reviewing pull request #42',
    tokens_input: 45000,
    tokens_output: 8700,
    files_modified: 0,
    commitCount: 0,
    deskIndex: 1,
    started_at: Date.now() - 420000,
    appearance: randomAppearance(),
    activeCelebration: null,
    celebrationStartedAt: null,
  },
  {
    id: 'agent-3',
    name: 'Claude #3',
    agent_type: 'cli',
    model: 'claude-sonnet-4-5-20250929',
    status: 'tool_calling',
    currentTask: 'Adding API rate limiting',
    tokens_input: 8200,
    tokens_output: 2100,
    files_modified: 5,
    commitCount: 2,
    deskIndex: 2,
    started_at: Date.now() - 90000,
    appearance: randomAppearance(),
    activeCelebration: null,
    celebrationStartedAt: null,
  },
  {
    id: 'agent-4',
    name: 'Claude #4',
    agent_type: 'cli',
    model: 'claude-haiku-4-5-20251001',
    status: 'streaming',
    currentTask: 'Writing unit tests for utils',
    tokens_input: 3100,
    tokens_output: 1400,
    files_modified: 2,
    commitCount: 0,
    deskIndex: 3,
    started_at: Date.now() - 60000,
    appearance: randomAppearance(),
    activeCelebration: null,
    celebrationStartedAt: null,
  },
]

export const useDemoStore = create<DemoState>((set) => ({
  agents: DEMO_AGENTS,
  selectedAgentId: null,
  toasts: [],

  selectAgent: (id) => set({ selectedAgentId: id }),

  updateAgent: (id, updates) =>
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    })),

  addToast: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { ...toast, id: `toast-${++toastIdCounter}` },
      ].slice(-5),
    })),

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}))
