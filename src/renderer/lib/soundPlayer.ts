import type { SystemSound } from '../types'

const SYSTEM_SOUNDS_PATH = '/System/Library/Sounds'
const CHAT_COMPLETION_SOUND: SystemSound = 'Ping'

const audioCache = new Map<string, HTMLAudioElement>()

function getAudio(sound: SystemSound): HTMLAudioElement {
  let audio = audioCache.get(sound)
  if (!audio) {
    audio = new Audio(`file://${SYSTEM_SOUNDS_PATH}/${sound}.aiff`)
    audioCache.set(sound, audio)
  }
  return audio
}

export function playSystemSound(sound: SystemSound): void {
  try {
    const original = getAudio(sound)
    const clone = original.cloneNode(true) as HTMLAudioElement
    clone.volume = 0.7
    clone.play().catch(() => {
      // Audio play can fail if user hasn't interacted with page yet
    })
  } catch {
    // Ignore audio errors
  }
}

export function playChatCompletionDing(enabled: boolean): void {
  if (!enabled) return
  playSystemSound(CHAT_COMPLETION_SOUND)
}
