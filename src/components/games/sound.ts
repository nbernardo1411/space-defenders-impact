let audioContext: AudioContext | null = null
let soundEnabledCache: boolean | null = null
const SOUND_ENABLED_STORAGE_KEY = 'gameSoundEnabled'
const AUDIO_PACK_STORAGE_KEY = 'spaceImpactAudioPack'
const AUDIO_MIX_STORAGE_KEY = 'spaceImpactAudioMix'

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

export type AudioMixSettings = {
  master: number
  bgm: number
  explosion: number
  beam: number
  ui: number
}

const DEFAULT_AUDIO_MIX: AudioMixSettings = {
  master: 1,
  bgm: 0.8,
  explosion: 0.62,
  beam: 0.48,
  ui: 0.8,
}

export function getPublicAssetUrl(path: string) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(path)) {
    return path
  }

  return `${import.meta.env.BASE_URL}${path.replace(/^\.?\//, '')}`
}

const DEFAULT_AUDIO_PACK: SoundPackConfig = {
  // Bundled production assets served from public/audio.
  bgm: getPublicAssetUrl('audio/bgm_scifi_loop.ogg'),
  bgmVolume: 0.3,
  sfxVolume: 0.72,
  sfx: {
    laser: getPublicAssetUrl('audio/sfx_laser.wav'),
    rocket: getPublicAssetUrl('audio/sfx_rocket.wav'),
    artillery: getPublicAssetUrl('audio/sfx_cannon.wav'),
    explosion: getPublicAssetUrl('audio/sfx_explosion_small.wav'),
    explosion_big: getPublicAssetUrl('audio/sfx_explosion_big.wav'),
    shoot: getPublicAssetUrl('audio/sfx_shoot.wav'),
    pop: getPublicAssetUrl('audio/sfx_hit.wav'),
    combo: getPublicAssetUrl('audio/sfx_combo.wav'),
    levelup: getPublicAssetUrl('audio/sfx_levelup.wav'),
    gameover: getPublicAssetUrl('audio/sfx_gameover.wav'),
    hit: getPublicAssetUrl('audio/sfx_damage.wav'),
    select: getPublicAssetUrl('audio/sfx_ui_select.wav'),
    select_tower: getPublicAssetUrl('audio/sfx_ui_tower_select.wav'),
    swap: getPublicAssetUrl('audio/sfx_ui_swap.wav'),
    clear: getPublicAssetUrl('audio/sfx_ui_clear.wav'),
    countdown: getPublicAssetUrl('audio/sfx_countdown.wav'),
    whoosh: getPublicAssetUrl('audio/sfx_whoosh.wav'),
    score: getPublicAssetUrl('audio/sfx_score.wav'),
  },
}

declare global {
  interface Window {
    spaceImpactSetSoundPack?: (config: SoundPackConfig | null) => void
    spaceImpactGetSoundPack?: () => SoundPackConfig
  }
}

let soundPackCache: SoundPackConfig | null = null
let audioMixCache: AudioMixSettings | null = null
let bgmElement: HTMLAudioElement | null = null
let noiseBuffer: AudioBuffer | null = null
const recentSfxTimesMs: number[] = []
const lastKindPlayMs: Partial<Record<GameSoundKind, number>> = {}

const MAX_SFX_OUTPUT = 0.78
const KIND_OUTPUT_GAIN: Partial<Record<GameSoundKind, number>> = {
  laser: 0.45,
  rocket: 0.58,
  artillery: 0.5,
  explosion: 0.68,
  explosion_big: 0.6,
  shoot: 0.78,
}
const RECENT_SFX_WINDOW_MS = 240
const RAPID_FIRE_MIN_INTERVAL_MS: Partial<Record<GameSoundKind, number>> = {
  laser: 32,
  shoot: 26,
  pop: 30,
  hit: 28,
  explosion: 40,
  explosion_big: 55,
}

function mergeAudioMix(base: AudioMixSettings, override?: Partial<AudioMixSettings>): AudioMixSettings {
  return {
    ...base,
    ...(override ?? {}),
    master: clamp01(override?.master ?? base.master),
    bgm: clamp01(override?.bgm ?? base.bgm),
    explosion: clamp01(override?.explosion ?? base.explosion),
    beam: clamp01(override?.beam ?? base.beam),
    ui: clamp01(override?.ui ?? base.ui),
  }
}

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

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}

function getSfxEventGain(kind: GameSoundKind) {
  const t = nowMs()
  const minInterval = RAPID_FIRE_MIN_INTERVAL_MS[kind] ?? 0
  const last = lastKindPlayMs[kind]
  if (minInterval > 0 && typeof last === 'number' && t - last < minInterval) {
    return 0
  }
  lastKindPlayMs[kind] = t

  while (recentSfxTimesMs.length > 0 && t - recentSfxTimesMs[0] > RECENT_SFX_WINDOW_MS) {
    recentSfxTimesMs.shift()
  }
  recentSfxTimesMs.push(t)

  const overlap = Math.max(0, recentSfxTimesMs.length - 4)
  const attenuation = 1 / (1 + overlap * 0.18)
  return clamp01(attenuation)
}

function loadAudioMixSettings(): AudioMixSettings {
  if (audioMixCache) return audioMixCache
  if (typeof window === 'undefined') {
    audioMixCache = DEFAULT_AUDIO_MIX
    return audioMixCache
  }
  try {
    const raw = localStorage.getItem(AUDIO_MIX_STORAGE_KEY)
    if (!raw) {
      audioMixCache = DEFAULT_AUDIO_MIX
      return audioMixCache
    }
    const parsed = JSON.parse(raw) as Partial<AudioMixSettings>
    audioMixCache = mergeAudioMix(DEFAULT_AUDIO_MIX, parsed)
    return audioMixCache
  } catch {
    audioMixCache = DEFAULT_AUDIO_MIX
    return audioMixCache
  }
}

export function getGameAudioMixSettings() {
  return loadAudioMixSettings()
}

export function setGameAudioMixSettings(settings: Partial<AudioMixSettings>) {
  audioMixCache = mergeAudioMix(DEFAULT_AUDIO_MIX, settings)
  if (typeof window !== 'undefined') {
    localStorage.setItem(AUDIO_MIX_STORAGE_KEY, JSON.stringify(audioMixCache))
  }
}

function getKindBusGain(kind: GameSoundKind) {
  const mix = getGameAudioMixSettings()
  const kindGain = KIND_OUTPUT_GAIN[kind] ?? 1
  if (kind === 'explosion' || kind === 'explosion_big' || kind === 'rocket' || kind === 'artillery') {
    return mix.master * mix.explosion * kindGain
  }
  if (kind === 'laser') {
    return mix.master * mix.beam * kindGain
  }
  if (
    kind === 'select' ||
    kind === 'select_tower' ||
    kind === 'swap' ||
    kind === 'clear' ||
    kind === 'countdown' ||
    kind === 'score' ||
    kind === 'levelup' ||
    kind === 'gameover'
  ) {
    return mix.master * mix.ui * kindGain
  }
  return mix.master * kindGain
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

function tryPlaySample(kind: GameSoundKind, eventGain = 1) {
  if (typeof window === 'undefined') return false
  const pack = getSoundPackConfig()
  const sampleUrl = pack.sfx?.[kind]
  if (!sampleUrl) return false
  try {
    const a = new Audio(sampleUrl)
    a.preload = 'auto'
    a.volume = clamp01((pack.sfxVolume ?? 0.7) * getKindBusGain(kind) * eventGain * MAX_SFX_OUTPUT)
    void a.play().catch(() => {
      // Ignore playback errors; synth fallback handles the event.
    })
    return true
  } catch {
    return false
  }
}

function getNoiseBuffer(ctx: AudioContext) {
  if (noiseBuffer) return noiseBuffer
  const durationSec = 0.35
  const frameCount = Math.floor(ctx.sampleRate * durationSec)
  const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate)
  const channel = buffer.getChannelData(0)
  for (let i = 0; i < frameCount; i++) {
    channel[i] = (Math.random() * 2 - 1) * 0.9
  }
  noiseBuffer = buffer
  return buffer
}

function playExplosionBoom(big: boolean, eventGain = 1) {
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  const dur = big ? 0.22 : 0.14
  const busGain = getKindBusGain(big ? 'explosion_big' : 'explosion') * eventGain * MAX_SFX_OUTPUT

  // Body: short low-end thump with a steep downward pitch sweep.
  const bodyOsc = ctx.createOscillator()
  bodyOsc.type = 'triangle'
  bodyOsc.frequency.setValueAtTime(big ? 170 : 210, now)
  bodyOsc.frequency.exponentialRampToValueAtTime(big ? 42 : 58, now + dur)

  const bodyGain = ctx.createGain()
  bodyGain.gain.setValueAtTime(0.0001, now)
  bodyGain.gain.exponentialRampToValueAtTime((big ? 0.35 : 0.25) * busGain, now + 0.006)
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + dur)

  const bodyLowpass = ctx.createBiquadFilter()
  bodyLowpass.type = 'lowpass'
  bodyLowpass.frequency.setValueAtTime(big ? 240 : 300, now)

  bodyOsc.connect(bodyLowpass)
  bodyLowpass.connect(bodyGain)
  bodyGain.connect(ctx.destination)
  bodyOsc.start(now)
  bodyOsc.stop(now + dur)

  // Crack: very short high-passed noise burst for impact definition.
  const crack = ctx.createBufferSource()
  crack.buffer = getNoiseBuffer(ctx)
  const crackHP = ctx.createBiquadFilter()
  crackHP.type = 'highpass'
  crackHP.frequency.setValueAtTime(1400, now)

  const crackGain = ctx.createGain()
  crackGain.gain.setValueAtTime((big ? 0.17 : 0.14) * busGain, now)
  crackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.038)

  crack.connect(crackHP)
  crackHP.connect(crackGain)
  crackGain.connect(ctx.destination)
  crack.start(now)
  crack.stop(now + 0.04)

  // Debris tail: short band-passed noise to mimic brittle crash fragments.
  const debris = ctx.createBufferSource()
  debris.buffer = getNoiseBuffer(ctx)
  const debrisBP = ctx.createBiquadFilter()
  debrisBP.type = 'bandpass'
  debrisBP.frequency.setValueAtTime(big ? 520 : 680, now)
  debrisBP.Q.value = 0.65

  const debrisGain = ctx.createGain()
  debrisGain.gain.setValueAtTime((big ? 0.08 : 0.06) * busGain, now + 0.015)
  debrisGain.gain.exponentialRampToValueAtTime(0.0001, now + (big ? 0.16 : 0.11))

  debris.connect(debrisBP)
  debrisBP.connect(debrisGain)
  debrisGain.connect(ctx.destination)
  debris.start(now + 0.012)
  debris.stop(now + (big ? 0.17 : 0.12))
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
  startDelayMs = 0,
  gainScale = 1
) {
  const ctx = getAudioContext()
  if (!ctx) return

  const startAt = ctx.currentTime + startDelayMs / 1000
  const endAt = startAt + durationMs / 1000

  const oscillator = ctx.createOscillator()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, startAt)

  const gain = ctx.createGain()
  const finalVolume = clamp01(volume * gainScale * MAX_SFX_OUTPUT)
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(finalVolume, startAt + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, endAt)

  if (type === 'square' || type === 'sawtooth') {
    // Tame upper harmonics so stacked shots stay punchy rather than shrill.
    const mellow = ctx.createBiquadFilter()
    mellow.type = 'lowpass'
    mellow.frequency.setValueAtTime(3600, startAt)
    oscillator.connect(mellow)
    mellow.connect(gain)
  } else {
    oscillator.connect(gain)
  }
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

export function startBGM() {
  if (!getGameSoundEnabled()) return
  try {
    stopBGM()
    const pack = getSoundPackConfig()
    if (!pack.bgm) return

    const audio = new Audio(pack.bgm)
    audio.loop = true
    audio.preload = 'auto'
    const mix = getGameAudioMixSettings()
    audio.volume = clamp01((pack.bgmVolume ?? 0.32) * mix.master * mix.bgm)
    bgmElement = audio
    void audio.play().catch(() => {
      // If BGM cannot play, stay silent instead of using the synth fallback.
    })
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
    const eventGain = getSfxEventGain(kind)
    if (eventGain <= 0) return
    const kindGain = eventGain * getKindBusGain(kind)

    if (kind === 'explosion') {
      playExplosionBoom(false, eventGain)
      return
    }
    if (kind === 'explosion_big') {
      playExplosionBoom(true, eventGain)
      return
    }

    const hasSample = tryPlaySample(kind, eventGain)
    if (hasSample) return

    if (kind === 'flap') {
      tone(440, 70, 'triangle', 0.06, 0, kindGain)
      return
    }
    if (kind === 'score') {
      tone(660, 60, 'sine', 0.06, 0, kindGain)
      tone(980, 90, 'sine', 0.045, 42, kindGain)
      return
    }
    if (kind === 'hit') {
      tone(180, 180, 'sawtooth', 0.08, 0, kindGain)
      return
    }
    if (kind === 'select') {
      tone(520, 55, 'square', 0.04, 0, kindGain)
      return
    }
    if (kind === 'select_tower') {
      // Distinct tower selection chirp
      tone(320, 45, 'square', 0.05, 0, kindGain)
      tone(480, 65, 'square', 0.04, 30, kindGain)
      return
    }
    if (kind === 'swap') {
      tone(280, 85, 'triangle', 0.055, 0, kindGain)
      return
    }
    if (kind === 'clear') {
      tone(620, 70, 'triangle', 0.05, 0, kindGain)
      tone(860, 110, 'triangle', 0.05, 35, kindGain)
      tone(1120, 130, 'triangle', 0.045, 75, kindGain)
      return
    }
    if (kind === 'shoot') {
      tone(420, 85, 'square', 0.05, 0, kindGain)
      return
    }
    if (kind === 'laser') {
      // Sci-fi laser zap - high frequency descending sweep
      tone(1200, 40, 'sine', 0.07, 0, kindGain)
      tone(900, 50, 'sine', 0.055, 15, kindGain)
      tone(600, 35, 'sine', 0.04, 35, kindGain)
      return
    }
    if (kind === 'rocket') {
      // Deep whoosh with resonance
      tone(280, 120, 'sawtooth', 0.08, 0, kindGain)
      tone(150, 150, 'sine', 0.07, 20, kindGain)
      return
    }
    if (kind === 'artillery') {
      // Heavy orbital strike - deep bass boom with metallic ring
      tone(80, 180, 'sine', 0.1, 0, kindGain)
      tone(320, 90, 'square', 0.065, 40, kindGain)
      tone(200, 200, 'sine', 0.08, 50, kindGain)
      return
    }
    if (kind === 'pop') {
      tone(760, 65, 'triangle', 0.05, 0, kindGain)
      tone(980, 80, 'triangle', 0.04, 20, kindGain)
      return
    }
    if (kind === 'combo') {
      tone(520, 50, 'sine', 0.05, 0, kindGain)
      tone(720, 60, 'sine', 0.05, 35, kindGain)
      tone(960, 70, 'sine', 0.045, 75, kindGain)
      tone(1200, 100, 'sine', 0.04, 120, kindGain)
      return
    }
    if (kind === 'levelup') {
      tone(440, 80, 'triangle', 0.06, 0, kindGain)
      tone(660, 80, 'triangle', 0.055, 70, kindGain)
      tone(880, 100, 'triangle', 0.05, 150, kindGain)
      tone(1100, 130, 'sine', 0.045, 240, kindGain)
      return
    }
    if (kind === 'countdown') {
      tone(660, 100, 'square', 0.035, 0, kindGain)
      return
    }
    if (kind === 'whoosh') {
      tone(300, 120, 'sawtooth', 0.03, 0, kindGain)
      tone(600, 80, 'sawtooth', 0.025, 30, kindGain)
      return
    }
    if (kind === 'gameover') {
      tone(240, 130, 'sawtooth', 0.06, 0, kindGain)
      tone(180, 180, 'sawtooth', 0.055, 95, kindGain)
    }
  } catch {
    // Sound should never break gameplay.
  }
}
