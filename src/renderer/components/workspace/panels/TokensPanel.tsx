import { ObservabilityPanel } from '../../ObservabilityPanel'

/**
 * Thin wrapper so the existing ObservabilityPanel can be
 * used as a standalone workspace panel.
 */
export function TokensPanel() {
  return (
    <div className="w-full h-full overflow-hidden">
      <ObservabilityPanel />
    </div>
  )
}
