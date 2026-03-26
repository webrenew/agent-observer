import { useState } from 'react'
import { StatsBar } from './StatsBar'
import { AgentCard } from './AgentCard'
import { ToastStack } from './Toast'
import { CelebrationDeck } from './CelebrationDeck'
import { SoloOperatorPanel } from './SoloOperatorPanel'
import { useAgentStore } from '../store/agents'

export function HUD() {
  const [digestOpen, setDigestOpen] = useState(true)
  const hasSelectedAgent = useAgentStore((s) => s.selectedAgentId !== null)

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Top bar */}
      <div className="flex justify-center pt-0 pointer-events-auto">
        <StatsBar />
      </div>

      {/* Agent detail card — bottom-left when an agent is selected */}
      <AgentCard />

      {/* Right panel stack — scrollable at small heights */}
      <div
        className="absolute top-4 right-4 pointer-events-auto"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxHeight: 'calc(100% - 56px)',
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(89,86,83,0.3) transparent',
        }}
      >
        <CelebrationDeck />
      </div>

      {/* Bottom-left operator digest — offset right when AgentCard is visible */}
      <div
        className="absolute bottom-4 pointer-events-auto"
        style={{ left: hasSelectedAgent ? 332 : 16 }}
      >
        {digestOpen ? (
          <div
            style={{
              maxHeight: 'calc(100% - 56px)',
              overflowY: 'auto',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(89,86,83,0.3) transparent',
            }}
          >
            <SoloOperatorPanel onClose={() => setDigestOpen(false)} />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setDigestOpen(true)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: '1px solid rgba(89,86,83,0.25)',
              background: 'linear-gradient(180deg, rgba(17,18,17,0.9), rgba(10,10,10,0.85))',
              color: '#9A9692',
              fontSize: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Open operator digest"
          >
            ☰
          </button>
        )}
      </div>

      {/* Toast notifications */}
      <ToastStack />
    </div>
  )
}
