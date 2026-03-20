import { StatsBar } from './StatsBar'
import { AgentCard } from './AgentCard'
import { ToastStack } from './Toast'
import { CelebrationDeck } from './CelebrationDeck'
import { SoloOperatorPanel } from './SoloOperatorPanel'

export function HUD() {
  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Top bar */}
      <div className="flex justify-center pt-0 pointer-events-auto">
        <StatsBar />
      </div>

      {/* Agent detail card */}
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
        <SoloOperatorPanel />
        <CelebrationDeck />
      </div>

      {/* Toast notifications */}
      <ToastStack />
    </div>
  )
}
