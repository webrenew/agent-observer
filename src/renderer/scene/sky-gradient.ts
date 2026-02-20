import { Color } from 'three'

// --- Sky gradient color stops ---

/** Zenith (top of sky dome) */
export const SKY_ZENITH_DAY = new Color('#4A90D9')
export const SKY_ZENITH_NIGHT = new Color('#0B1026')

/** Horizon band */
export const SKY_HORIZON_DAY = new Color('#B0D4F1')
export const SKY_HORIZON_NIGHT = new Color('#141B3D')
export const SKY_HORIZON_GOLDEN = new Color('#E8955A')

/** Ground reflection (below horizon) */
export const SKY_GROUND_DAY = new Color('#8BA4B8')
export const SKY_GROUND_NIGHT = new Color('#0D1225')

// --- Sun / Moon glow on sky ---
export const SUN_GLOW_COLOR = new Color('#FFD080')
export const MOON_GLOW_COLOR = new Color('#8AB4E8')

// --- Fog ---
export const FOG_DAY_COLOR = new Color('#C0D8E8')
export const FOG_GOLDEN_COLOR = new Color('#FFB88C')
export const FOG_NIGHT_COLOR = new Color('#111833')
export const FOG_DENSITY_DAY = 0.005
export const FOG_DENSITY_NIGHT = 0.008

// --- Window tint ---
export const WINDOW_DAY_COLOR = new Color('#93C5FD')
export const WINDOW_DAY_EMISSIVE = new Color('#7DD3FC')
export const WINDOW_NIGHT_COLOR = new Color('#FDE68A')
export const WINDOW_NIGHT_EMISSIVE = new Color('#FDBA74')
export const WINDOW_DAY_EMISSIVE_INTENSITY = 0.25
export const WINDOW_NIGHT_EMISSIVE_INTENSITY = 0.55

/**
 * Golden hour factor: peaks when daylight ≈ 0.3 (sunrise/sunset).
 * Returns 0..1 with a smooth bell around the transition zone.
 */
export function computeGoldenHourFactor(daylight: number): number {
  // Bell curve centered at daylight = 0.3, width ≈ 0.15
  const dist = Math.abs(daylight - 0.3)
  return Math.max(0, 1 - dist / 0.15)
}
