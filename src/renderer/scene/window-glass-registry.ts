import type { MeshStandardMaterial } from 'three'

/**
 * Module-level shared registry for window glass materials.
 * Room.tsx populates this via registerWindowGlass.
 * Lighting.tsx reads it each frame for tint animation.
 */
const windowGlassMaterials: MeshStandardMaterial[] = []

export function registerWindowGlass(mat: MeshStandardMaterial): void {
  if (!windowGlassMaterials.includes(mat)) {
    windowGlassMaterials.push(mat)
  }
}

export function unregisterWindowGlass(mat: MeshStandardMaterial): void {
  const idx = windowGlassMaterials.indexOf(mat)
  if (idx !== -1) windowGlassMaterials.splice(idx, 1)
}

export function getWindowGlassMaterials(): MeshStandardMaterial[] {
  return windowGlassMaterials
}
