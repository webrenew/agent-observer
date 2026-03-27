import { StatsBar } from './StatsBar'
import { AgentCard } from './AgentCard'
import { ToastStack } from './Toast'
import { CelebrationDeck } from './CelebrationDeck'

export function HUD() {
  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Top bar */}
      <div className="flex justify-center pt-0 pointer-events-auto">
        <StatsBar />
      </div>

      {/* Agent detail card — bottom-left when an agent is selected */}
      <AgentCard />

      {/* Right panel stack — below the StatsBar, scrollable at small heights */}
      <div
        className="absolute right-4 pointer-events-auto"
        style={{
          top: 48,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxHeight: 'calc(100% - 64px)',
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(89,86,83,0.3) transparent',
        }}
      >
        <CelebrationDeck />
      </div>

      {/* Toast notifications */}
      <ToastStack />
    </div>
  )
}
