import { getGameAudioMixSettings, getGameSoundEnabled, getPublicAssetUrl, playGameSound } from '../sound'
import type { GameSoundKind } from '../sound'
import type { PowerKind } from './types'
import { clamp } from './utils'

export let lastCoreLanderPhysicalSoundAt = 0

export const CORE_LANDER_PHYSICAL_ATTACK_SOUNDS: readonly GameSoundKind[] = ['g_atk_punch_1', 'g_atk_punch_2', 'g_atk_kick']

export function playCoreLanderPhysicalAttackSound(seed = Math.random()) {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  if (now - lastCoreLanderPhysicalSoundAt < 76) return
  lastCoreLanderPhysicalSoundAt = now
  const noise = Math.abs(Math.sin(seed * 12.9898) * 43758.5453)
  const index = Math.floor(noise) % CORE_LANDER_PHYSICAL_ATTACK_SOUNDS.length
  playGameSound(CORE_LANDER_PHYSICAL_ATTACK_SOUNDS[index])
}

export let lastPickupVoiceMs = 0

export //
// ARCADE ANNOUNCER STYLE WEB SPEECH
// This pushes browser TTS close to arcade energy.
// Still limited by speechSynthesis itself,
// but MUCH better than plain robotic speech.
//

let cachedPickupVoices: SpeechSynthesisVoice[] = []

export let pickupSampleAudio: HTMLAudioElement | null = null

export const pickupSampleAudioCache = new Map<PowerKind, HTMLAudioElement>()

export const PICKUP_VOICE_SAMPLE_URLS: Record<PowerKind, string> = {
  rocket: getPublicAssetUrl('audio/pickups/pickup_rocket.wav'),
  laser: getPublicAssetUrl('audio/pickups/pickup_laser.wav'),
  spread: getPublicAssetUrl('audio/pickups/pickup_spread.wav'),
  scatter: getPublicAssetUrl('audio/pickups/pickup_scatter.wav'),
  homing: getPublicAssetUrl('audio/pickups/pickup_homing.wav'),
  option: getPublicAssetUrl('audio/pickups/pickup_option.wav'),
  shield: getPublicAssetUrl('audio/pickups/pickup_shield.wav'),
  forcefield: getPublicAssetUrl('audio/pickups/pickup_forcefield.wav'),
  repair: getPublicAssetUrl('audio/pickups/pickup_repair.wav'),
  levelup: getPublicAssetUrl('audio/pickups/pickup_levelup.wav'),
}

export const DEFAULT_PICKUP_VOICE_SAMPLE_URL = getPublicAssetUrl('audio/pickups/pickup_default.wav')

export function getPickupSpeechSynthesis() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  return window.speechSynthesis
}

export function refreshPickupVoices() {
  const synth = getPickupSpeechSynthesis()
  if (!synth) return []

  try {
    const voices = synth.getVoices()
    if (voices.length > 0) cachedPickupVoices = voices
    return voices.length > 0 ? voices : cachedPickupVoices
  } catch {
    return cachedPickupVoices
  }
}

export const pickupSpeechSynthesis = getPickupSpeechSynthesis()

if (pickupSpeechSynthesis) {
  pickupSpeechSynthesis.onvoiceschanged = () => {
    refreshPickupVoices()
  }
  refreshPickupVoices()
}

export function pickupVoiceLine(type: PowerKind) {
  if (type === 'rocket') return 'ROCKET ARMED!!!'
  if (type === 'laser') return 'LAAASER UNLEASHED!!!'
  if (type === 'spread') return 'SPREAD SHOT!!!'
  if (type === 'scatter') return 'SCATTER BURST!!!'
  if (type === 'homing') return 'HOMING LOCKED!!!'
  if (type === 'option') return 'SCOUT SUPPORT!!!'
  if (type === 'shield') return 'SHIELD UP!!!'
  if (type === 'forcefield') return 'FORCE FIELD ONLINE!!!'
  if (type === 'repair') return 'REPAIR BOOST!!!'
  if (type === 'levelup') return 'LEVEL UP!!!'

  return 'POWER UUUUP!!!'
}

export function getPickupVoice() {
  const voices = refreshPickupVoices()

  // ONLY female voices
  return (
    voices.find(
      (voice) =>
        voice.lang.toLowerCase().startsWith('en') &&
        /aria|zira|jenny|samantha|female|woman|google us english female/i.test(
          voice.name.toLowerCase(),
        ),
    ) ??

    // fallback: any english voice containing female keywords
    voices.find(
      (voice) =>
        voice.lang.toLowerCase().startsWith('en') &&
        /female|woman|zira|aria|jenny|samantha/i.test(
          voice.name.toLowerCase(),
        ),
    ) ??

    // final fallback: first english voice
    voices.find((voice) =>
      voice.lang.toLowerCase().startsWith('en'),
    ) ??

    null
  )
}

export function getPickupVoiceTuning(type: PowerKind) {
  // Aggressive arcade tuning

  if (type === 'rocket') {
    return {
      rate: 1.55,
      pitch: 0.96,
      emphasis: 'strong',
    }
  }

  if (type === 'laser') {
    return {
      rate: 1.62,
      pitch: 1.25,
      emphasis: 'strong',
    }
  }

  if (type === 'spread') {
    return {
      rate: 1.56,
      pitch: 1.12,
      emphasis: 'strong',
    }
  }

  if (type === 'scatter') {
    return {
      rate: 1.58,
      pitch: 1.16,
      emphasis: 'strong',
    }
  }

  if (type === 'homing') {
    return {
      rate: 1.48,
      pitch: 1.02,
      emphasis: 'moderate',
    }
  }

  if (type === 'shield') {
    return {
      rate: 1.4,
      pitch: 0.88,
      emphasis: 'moderate',
    }
  }

  if (type === 'levelup') {
    return {
      rate: 1.42,
      pitch: 1.2,
      emphasis: 'strong',
    }
  }

  return {
    rate: 1.52,
    pitch: 1.08,
    emphasis: 'strong',
  }
}

export function createUtterance(
  text: string,
  volume: number,
  rate: number,
  pitch: number,
) {
  const utterance = new SpeechSynthesisUtterance(text)

  utterance.volume = volume
  utterance.rate = rate
  utterance.pitch = pitch

  const voice = getPickupVoice()

  if (voice) {
    utterance.voice = voice
  }

  return utterance
}

export function playPickupSpeechSynthesisLine(type: PowerKind, volume: number) {
  const synth = getPickupSpeechSynthesis()

  if (
    typeof window === 'undefined' ||
    !synth ||
    typeof SpeechSynthesisUtterance === 'undefined'
  ) {
    return false
  }

  try {
    const tuning = getPickupVoiceTuning(type)

    // stronger phrasing
    const line = pickupVoiceLine(type)
      .replace(/ROCKET/g, 'RRRROCKET')
      .replace(/LASER/g, 'LAAAASERRR')
      .replace(/POWER/g, 'POWERRRR')
      .replace(/SPREAD/g, 'SPREEEAD')
      .replace(/SCATTER/g, 'SCATTTERRR')

    synth.cancel()

    //
    // MAIN VOICE
    //

    const main = createUtterance(
      line,
      volume,
      tuning.rate * 0.75,
      tuning.pitch * 1.1,
    )
    // make it punchier
    main.pitch *= 1.08
    main.rate *= 1.06

    synth.speak(main)
    return true
  } catch {
    return false
  }
}

export function getPickupVoiceSampleUrl(type: PowerKind) {
  return PICKUP_VOICE_SAMPLE_URLS[type] ?? DEFAULT_PICKUP_VOICE_SAMPLE_URL
}

export function getPickupVoiceSampleAudio(type: PowerKind) {
  if (typeof window === 'undefined') return null
  let audio = pickupSampleAudioCache.get(type)
  if (!audio) {
    audio = new Audio(getPickupVoiceSampleUrl(type))
    audio.preload = 'auto'
    pickupSampleAudioCache.set(type, audio)
  }
  return audio
}

export function warmPickupVoiceSamples() {
  if (typeof window === 'undefined') return
  ;(Object.keys(PICKUP_VOICE_SAMPLE_URLS) as PowerKind[]).forEach((type) => {
    try {
      const audio = getPickupVoiceSampleAudio(type)
      audio?.load()
    } catch {
      // Audio preload is opportunistic; WebView may defer it until first gesture.
    }
  })
}

export function tryPlayPickupVoiceSample(type: PowerKind, volume: number) {
  if (typeof window === 'undefined') return false
  try {
    if (pickupSampleAudio) {
      pickupSampleAudio.pause()
      pickupSampleAudio.currentTime = 0
    }

    const audio = getPickupVoiceSampleAudio(type)
    if (!audio) return false
    audio.currentTime = 0
    audio.volume = volume
    pickupSampleAudio = audio

    audio.onended = () => {
      if (pickupSampleAudio === audio) {
        pickupSampleAudio = null
      }
    }

    void audio.play().catch(() => {
      if (pickupSampleAudio === audio) {
        pickupSampleAudio = null
      }
      playPickupSpeechSynthesisLine(type, volume)
    })

    return true
  } catch {
    return false
  }
}

export function playPickupVoiceLine(type: PowerKind) {
  if (!getGameSoundEnabled()) {
    return
  }

  const now =
    typeof performance !== 'undefined'
      ? performance.now()
      : Date.now()

  if (now - lastPickupVoiceMs < 60) {
    return
  }

  lastPickupVoiceMs = now

  const mix = getGameAudioMixSettings()
  const volume = clamp(
    mix.master * mix.ui * 1.25,
    0,
    1,
  )

  if (!tryPlayPickupVoiceSample(type, volume)) {
    playPickupSpeechSynthesisLine(type, volume)
  }
}
