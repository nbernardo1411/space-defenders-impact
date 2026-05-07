let audioContext: AudioContext | null = null
let soundEnabledCache: boolean | null = null
const SOUND_ENABLED_STORAGE_KEY = 'gameSoundEnabled'

export function getGameSoundEnabled() {
  if (soundEnabledCache !== null) {
    return soundEnabledCache
  }
  if (typeof window === 'undefined') {
    soundEnabledCache = true
    return soundEnabledCache
  }
  const raw = localStorage.getItem(SOUND_ENABLED_STORAGE_KEY)
  soundEnabledCache = raw === null ? true : raw === '1'
  return soundEnabledCache
}

export function setGameSoundEnabled(enabled: boolean) {
  soundEnabledCache = enabled
  if (typeof window !== 'undefined') {
    localStorage.setItem(SOUND_ENABLED_STORAGE_KEY, enabled ? '1' : '0')
  }
}

function getAudioContext() {
  if (typeof window === 'undefined') return null
  const Context = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Context) return null
  if (!audioContext) {
    audioContext = new Context()
  }
  if (audioContext.state === 'suspended') {
    void audioContext.resume()
  }
  return audioContext
}

function tone(
  frequency: number,
  durationMs: number,
  type: OscillatorType,
  volume: number,
  startDelayMs = 0
) {
  const ctx = getAudioContext()
  if (!ctx) return

  const startAt = ctx.currentTime + startDelayMs / 1000
  const endAt = startAt + durationMs / 1000

  const oscillator = ctx.createOscillator()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, startAt)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, endAt)

  oscillator.connect(gain)
  gain.connect(ctx.destination)

  oscillator.start(startAt)
  oscillator.stop(endAt)
}

export function playGameSound(
  kind: 'flap' | 'score' | 'hit' | 'select' | 'swap' | 'clear' | 'shoot' | 'pop' | 'gameover' | 'combo' | 'levelup' | 'countdown' | 'whoosh'
) {
  try {
    if (!getGameSoundEnabled()) return

    if (kind === 'flap') {
      tone(440, 70, 'triangle', 0.06)
      return
    }
    if (kind === 'score') {
      tone(660, 60, 'sine', 0.06)
      tone(980, 90, 'sine', 0.045, 42)
      return
    }
    if (kind === 'hit') {
      tone(180, 180, 'sawtooth', 0.08)
      return
    }
    if (kind === 'select') {
      tone(520, 55, 'square', 0.04)
      return
    }
    if (kind === 'swap') {
      tone(280, 85, 'triangle', 0.055)
      return
    }
    if (kind === 'clear') {
      tone(620, 70, 'triangle', 0.05)
      tone(860, 110, 'triangle', 0.05, 35)
      tone(1120, 130, 'triangle', 0.045, 75)
      return
    }
    if (kind === 'shoot') {
      tone(420, 85, 'square', 0.05)
      return
    }
    if (kind === 'pop') {
      tone(760, 65, 'triangle', 0.05)
      tone(980, 80, 'triangle', 0.04, 20)
      return
    }
    if (kind === 'combo') {
      tone(520, 50, 'sine', 0.05)
      tone(720, 60, 'sine', 0.05, 35)
      tone(960, 70, 'sine', 0.045, 75)
      tone(1200, 100, 'sine', 0.04, 120)
      return
    }
    if (kind === 'levelup') {
      tone(440, 80, 'triangle', 0.06)
      tone(660, 80, 'triangle', 0.055, 70)
      tone(880, 100, 'triangle', 0.05, 150)
      tone(1100, 130, 'sine', 0.045, 240)
      return
    }
    if (kind === 'countdown') {
      tone(660, 100, 'square', 0.035)
      return
    }
    if (kind === 'whoosh') {
      tone(300, 120, 'sawtooth', 0.03)
      tone(600, 80, 'sawtooth', 0.025, 30)
      return
    }
    if (kind === 'gameover') {
      tone(240, 130, 'sawtooth', 0.06)
      tone(180, 180, 'sawtooth', 0.055, 95)
    }
  } catch {
    // Sound should never break gameplay.
  }
}
