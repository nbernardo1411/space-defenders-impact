let audioContext: AudioContext | null = null
let soundEnabledCache: boolean | null = null
const SOUND_ENABLED_STORAGE_KEY = 'gameSoundEnabled'
const AUDIO_PACK_STORAGE_KEY = 'spaceImpactAudioPack'

export type GameSoundKind =
  | 'flap'
  | 'score'
  | 'hit'
  | 'select'
  | 'swap'
  | 'clear'
  | 'shoot'
  | 'pop'
  | 'gameover'
  | 'combo'
  | 'levelup'
  | 'countdown'
  | 'whoosh'
  | 'laser'
  | 'rocket'
  | 'artillery'
  | 'explosion'
  | 'explosion_big'
  | 'select_tower'

type SoundPackConfig = {
  sfx?: Partial<Record<GameSoundKind, string>>
  bgm?: string
  sfxVolume?: number
  bgmVolume?: number
}

const DEFAULT_AUDIO_PACK: SoundPackConfig = {
  // Bundled production assets served from public/audio.
  bgm: '/audio/bgm_scifi_loop.ogg',
  bgmVolume: 0.3,
  sfxVolume: 0.72,
  sfx: {
    laser: '/audio/sfx_laser.wav',
    rocket: '/audio/sfx_rocket.wav',
    artillery: '/audio/sfx_cannon.wav',
    explosion: '/audio/sfx_explosion_small.wav',
    explosion_big: '/audio/sfx_explosion_big.wav',
    shoot: '/audio/sfx_shoot.wav',
    pop: '/audio/sfx_hit.wav',
    combo: '/audio/sfx_combo.wav',
    levelup: '/audio/sfx_levelup.wav',
    gameover: '/audio/sfx_gameover.wav',
    hit: '/audio/sfx_damage.wav',
    select: '/audio/sfx_ui_select.wav',
    select_tower: '/audio/sfx_ui_tower_select.wav',
    swap: '/audio/sfx_ui_swap.wav',
    clear: '/audio/sfx_ui_clear.wav',
    countdown: '/audio/sfx_countdown.wav',
    whoosh: '/audio/sfx_whoosh.wav',
    score: '/audio/sfx_score.wav',
  },
}

declare global {
  interface Window {
    spaceImpactSetSoundPack?: (config: SoundPackConfig | null) => void
    spaceImpactGetSoundPack?: () => SoundPackConfig
  }
}

let soundPackCache: SoundPackConfig | null = null
let bgmElement: HTMLAudioElement | null = null

function mergeSoundPack(base: SoundPackConfig, override?: SoundPackConfig): SoundPackConfig {
  return {
    ...base,
    ...override,
    sfx: {
      ...(base.sfx ?? {}),
      ...(override?.sfx ?? {}),
    },
  }
}

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
  if (!enabled) {
    stopBGM()
  }
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

function loadSoundPackConfig(): SoundPackConfig {
  if (soundPackCache) return soundPackCache
  if (typeof window === 'undefined') {
    soundPackCache = DEFAULT_AUDIO_PACK
    return soundPackCache
  }
  try {
    const raw = localStorage.getItem(AUDIO_PACK_STORAGE_KEY)
    if (!raw) {
      soundPackCache = DEFAULT_AUDIO_PACK
      return soundPackCache
    }
    const parsed = JSON.parse(raw) as SoundPackConfig
    soundPackCache = mergeSoundPack(DEFAULT_AUDIO_PACK, parsed ?? undefined)
    return soundPackCache
  } catch {
    soundPackCache = DEFAULT_AUDIO_PACK
    return soundPackCache
  }
}

function getSoundPackConfig() {
  return loadSoundPackConfig()
}

export function setGameSoundPack(config: SoundPackConfig | null) {
  soundPackCache = mergeSoundPack(DEFAULT_AUDIO_PACK, config ?? undefined)
  if (typeof window !== 'undefined') {
    if (!config) {
      localStorage.removeItem(AUDIO_PACK_STORAGE_KEY)
    } else {
      localStorage.setItem(AUDIO_PACK_STORAGE_KEY, JSON.stringify(config))
    }
  }
}

if (typeof window !== 'undefined') {
  window.spaceImpactSetSoundPack = (config: SoundPackConfig | null) => {
    setGameSoundPack(config)
    // Apply changes immediately to active BGM.
    stopBGM()
    if (getGameSoundEnabled()) {
      startBGM()
    }
  }
  window.spaceImpactGetSoundPack = () => getSoundPackConfig()
}

function tryPlaySample(kind: GameSoundKind) {
  if (typeof window === 'undefined') return false
  const pack = getSoundPackConfig()
  const sampleUrl = pack.sfx?.[kind]
  if (!sampleUrl) return false
  try {
    const a = new Audio(sampleUrl)
    a.preload = 'auto'
    a.volume = clamp01((pack.sfxVolume ?? 0.7))
    void a.play().catch(() => {
      // Ignore playback errors; synth fallback handles the event.
    })
    return true
  } catch {
    return false
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

let bgmOscillators: OscillatorNode[] = []

function stopSynthBGM() {
  bgmOscillators.forEach(osc => {
    try { osc.stop() } catch { /* noop */ }
  })
  bgmOscillators = []
}

function startSynthBGM() {
  const ctx = getAudioContext()
  if (!ctx) return
  stopSynthBGM()

  // Layered sci-fi ambient: deep bass, mid drone, high shimmer.
  const createBgmLayer = (freq: number, waveType: OscillatorType, volumeStart: number) => {
    const osc = ctx.createOscillator()
    osc.type = waveType
    osc.frequency.setValueAtTime(freq, ctx.currentTime)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(volumeStart * 0.12, ctx.currentTime)

    // Pulsing effect with slow LFO for a more cinematic ambience.
    const lfo = ctx.createOscillator()
    lfo.frequency.setValueAtTime(0.43, ctx.currentTime)
    const lfoGain = ctx.createGain()
    lfoGain.gain.setValueAtTime(volumeStart * 0.075, ctx.currentTime)

    lfo.connect(lfoGain)
    lfoGain.connect(gain.gain)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start()
    lfo.start()

    bgmOscillators.push(osc, lfo)
  }

  createBgmLayer(55, 'sine', 0.8)
  createBgmLayer(110, 'triangle', 0.6)
  createBgmLayer(220, 'sine', 0.5)
  createBgmLayer(440, 'sine', 0.34)
}

export function startBGM() {
  if (!getGameSoundEnabled()) return
  try {
    stopBGM()
    const pack = getSoundPackConfig()
    if (pack.bgm) {
      const audio = new Audio(pack.bgm)
      audio.loop = true
      audio.preload = 'auto'
      audio.volume = clamp01(pack.bgmVolume ?? 0.32)
      bgmElement = audio
      void audio.play().catch(() => {
        // If remote/local BGM fails, fall back to synth BGM.
        startSynthBGM()
      })
      return
    }
    startSynthBGM()
  } catch {
    // BGM should never break gameplay
  }
}

export function stopBGM() {
  try {
    if (bgmElement) {
      bgmElement.pause()
      bgmElement.currentTime = 0
      bgmElement = null
    }
    stopSynthBGM()
  } catch {
    // Cleanup should never break gameplay
  }
}

export function playGameSound(
  kind: GameSoundKind
) {
  try {
    if (!getGameSoundEnabled()) return
    if (tryPlaySample(kind)) return

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
    if (kind === 'select_tower') {
      // Distinct tower selection chirp
      tone(320, 45, 'square', 0.05)
      tone(480, 65, 'square', 0.04, 30)
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
    if (kind === 'laser') {
      // Sci-fi laser zap - high frequency descending sweep
      tone(1200, 40, 'sine', 0.07)
      tone(900, 50, 'sine', 0.055, 15)
      tone(600, 35, 'sine', 0.04, 35)
      return
    }
    if (kind === 'rocket') {
      // Deep whoosh with resonance
      tone(280, 120, 'sawtooth', 0.08)
      tone(150, 150, 'sine', 0.07, 20)
      return
    }
    if (kind === 'artillery') {
      // Heavy orbital strike - deep bass boom with metallic ring
      tone(80, 180, 'sine', 0.1)
      tone(320, 90, 'square', 0.065, 40)
      tone(200, 200, 'sine', 0.08, 50)
      return
    }
    if (kind === 'pop') {
      tone(760, 65, 'triangle', 0.05)
      tone(980, 80, 'triangle', 0.04, 20)
      return
    }
    if (kind === 'explosion') {
      // Enemy explosion - chaotic burst
      tone(400, 150, 'sawtooth', 0.09)
      tone(200, 180, 'sawtooth', 0.08, 30)
      tone(600, 120, 'square', 0.07, 60)
      return
    }
    if (kind === 'explosion_big') {
      // Boss explosion - massive boom with sustained ring
      tone(100, 200, 'sine', 0.12)
      tone(250, 250, 'sawtooth', 0.1, 50)
      tone(500, 180, 'sine', 0.08, 100)
      tone(150, 300, 'sine', 0.09, 120)
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
