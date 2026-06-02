import { getRaidAlienSpriteUrl, getRaidEliteSpriteUrl, getRaidShipSpriteUrl, RAID_ALIEN_SPRITE_COUNT, RAID_ELITE_SPRITE_COUNT } from '../RaidShipSprite'
import { getPublicAssetUrl } from '../sound'
import { getCobraBossBodyTextureCanvas, getSquidBossTentacleTextureCanvas } from './bossRender'
import { PLAYER_COLOR, SHIP_OPTIONS } from './constants'
import { DEG } from './constants'
import { getCoreLanderBarrageFilter } from './state'
import type { CoreLanderCombatModel, DevilBossPose, Enemy } from './types'
import { clamp, drawRadialEllipse, getCachedSpriteGlow } from './utils'

export type CanvasSpriteEntry = {
  cacheKey: string
  image: HTMLImageElement
  loaded: boolean
  ready: Promise<void>
  processedImage?: HTMLCanvasElement
}

export const FILTERED_CANVAS_SPRITE_CACHE_LIMIT = 256

export const filteredCanvasSpriteCache = new Map<string, HTMLCanvasElement>()

export const canvasPatternCache = new WeakMap<CanvasRenderingContext2D, WeakMap<HTMLCanvasElement, CanvasPattern | null>>()

export type CachedCanvasDrawSource = {
  canvas: HTMLCanvasElement
  width: number
  height: number
  originX: number
  originY: number
}

export type CanvasSpriteProcessor = (image: HTMLImageElement) => HTMLCanvasElement | null

export const canvasSpriteCache = new Map<string, CanvasSpriteEntry>()

export const RAID_OTHER_ASSET_PATHS = {
  asteroid: 'assets/others/asteroid.webp',
  comet: 'assets/others/comet.webp',
  galaxy: 'assets/others/galaxy.webp',
  galaxy2: 'assets/others/galaxy_2.webp',
  galaxy3: 'assets/others/galaxy_3.webp',
  galaxy4: 'assets/others/galaxy_4.webp',
  planet1: 'assets/others/planet_1.webp',
  planet2: 'assets/others/planet_2.webp',
  planet3: 'assets/others/planet_3.webp',
  planet4: 'assets/others/planet_4.webp',
  planet5: 'assets/others/planet_5.webp',
  planetNebula: 'assets/others/planet__3.webp',
  spaceStation: 'assets/others/space_station.webp',
  sun: 'assets/others/sun.webp',
  clouds: 'assets/others/clouds.png',
  clouds2: 'assets/others/clouds_2.png',
  volcanicClouds: 'assets/others/clouds.png',
  volcanicClouds2: 'assets/others/clouds_2.png',
  island: 'assets/others/island.png',
  island2: 'assets/others/island_2.png',
  island3: 'assets/others/island_3.png',
  octiIsland: 'assets/others/octi_island.png',
  volcano: 'assets/others/volcano.png',
  volcano2: 'assets/others/volcano_2.png',
  volcano3: 'assets/others/volcano_3.png',
  snakeVolcano: 'assets/others/snake_volcano.png',
  bgShipMesiahBlack: 'assets/ships/mesiah-black.png',
  bgShipMesiahWhite: 'assets/ships/mesiah-white.png',
  bgShipRaptorWhite: 'assets/ships/mesiah-raptor-white.png',
  bgEnemyScout: 'assets/aliens/alien_v2.png',
  bgEnemySwarm: 'assets/aliens/alien_v5.png',
  bgEnemyElite: 'assets/aliens/elite_2.png',
} as const

export const RAID_DERELICT_WRECK_ASSET_PATH = 'assets/others/space_station.webp'

export const RAID_DERELICT_WRECK_FILTER = 'brightness(0.9) contrast(1.14) saturate(0.94)'

export const RAID_DERELICT_WRECK_BASE_WIDTH = 18

export const RAID_DERELICT_WRECK_BASE_HEIGHT = RAID_DERELICT_WRECK_BASE_WIDTH * (528 / 454)

export const RAID_DERELICT_WRECK_VARIANTS = [
  { width: RAID_DERELICT_WRECK_BASE_WIDTH, height: RAID_DERELICT_WRECK_BASE_HEIGHT, rotation: -6 * DEG },
  { width: RAID_DERELICT_WRECK_BASE_WIDTH, height: RAID_DERELICT_WRECK_BASE_HEIGHT, rotation: 2 * DEG },
  { width: RAID_DERELICT_WRECK_BASE_WIDTH, height: RAID_DERELICT_WRECK_BASE_HEIGHT, rotation: -4 * DEG },
  { width: RAID_DERELICT_WRECK_BASE_WIDTH, height: RAID_DERELICT_WRECK_BASE_HEIGHT, rotation: 7 * DEG },
  { width: RAID_DERELICT_WRECK_BASE_WIDTH, height: RAID_DERELICT_WRECK_BASE_HEIGHT, rotation: -2 * DEG },
  { width: RAID_DERELICT_WRECK_BASE_WIDTH, height: RAID_DERELICT_WRECK_BASE_HEIGHT, rotation: 3 * DEG },
  { width: RAID_DERELICT_WRECK_BASE_WIDTH, height: RAID_DERELICT_WRECK_BASE_HEIGHT, rotation: -3 * DEG },
  { width: RAID_DERELICT_WRECK_BASE_WIDTH, height: RAID_DERELICT_WRECK_BASE_HEIGHT, rotation: 0 },
  { width: RAID_DERELICT_WRECK_BASE_WIDTH, height: RAID_DERELICT_WRECK_BASE_HEIGHT, rotation: 4 * DEG },
] as const

export const RAID_FINAL_BOSS_ASSET_PATH = 'assets/aliens/final_boss.png'

export const RAID_FINAL_BOSS_CORE_OFFSET_X = -0.007

export const RAID_FINAL_BOSS_CORE_OFFSET_Y = -0.039

export const RAID_SQUID_BOSS_ASSET_PATH = 'assets/aliens/squid_boss.png'

export const RAID_COBRA_BOSS_ASSET_PATH = 'assets/aliens/cobra_boss.png'

export const RAID_DEVIL_MASTER_PROJECTILE_ASSET_PATH = 'assets/GundamEnemy/master-gundam.png'

export const RAID_CORE_LANDER_COMBAT_MODELS: CoreLanderCombatModel[] = ['godGundam', 'spiegel']

export const RAID_GOD_GUNDAM_BARRAGE_ASSET_PATHS: Record<string, string> = {
  punch: 'assets/G-gundam-attacks/punch.png',
  kick: 'assets/G-gundam-attacks/kick.png',
  uppercut1: 'assets/G-gundam-attacks/uppercut-1.png',
  uppercut2: 'assets/G-gundam-attacks/uppercut-2.png',
  katana1: 'assets/G-gundam-attacks/katana-1.png',
  katana2: 'assets/G-gundam-attacks/katana-2.png',
} as const

export const RAID_SPIEGEL_BARRAGE_ASSET_PATHS: Record<string, string> = {
  attack: 'assets/G-gundam-attacks/spiegel-attack.png',
  kick: 'assets/G-gundam-attacks/spiegel-kick.png',
  kunaiThrow: 'assets/G-gundam-attacks/spiegel-kunai-throw.png',
  kunaiThrowAbove: 'assets/G-gundam-attacks/spiegel-kunai-throw-above.png',
  punch: 'assets/G-gundam-attacks/spiegel-punch.png',
  shadowAttack: 'assets/G-gundam-attacks/spiegel-shadow-attack.png',
  spin: 'assets/G-gundam-attacks/spiegel-spin.png',
  stop: 'assets/G-gundam-attacks/spiegel-stop.png',
  upperAttack: 'assets/G-gundam-attacks/spiegel-upper-attack.png',
} as const

export const RAID_CORE_LANDER_BARRAGE_ASSET_PATHS: Record<CoreLanderCombatModel, Record<string, string>> = {
  godGundam: RAID_GOD_GUNDAM_BARRAGE_ASSET_PATHS,
  spiegel: RAID_SPIEGEL_BARRAGE_ASSET_PATHS,
}

export type GodGundamBarragePose = string

export type RaidOtherAssetKey = keyof typeof RAID_OTHER_ASSET_PATHS

export type CoreLanderBarrageMove = {
  pose: GodGundamBarragePose
  side: -1 | 0 | 1
  offsetY: number
  impactY: number
}

export const RAID_GOD_GUNDAM_BARRAGE_SEQUENCE: CoreLanderBarrageMove[] = [
  { pose: 'punch', side: -1, offsetY: -6, impactY: -2 },
  { pose: 'katana1', side: -1, offsetY: -2, impactY: -1 },
  { pose: 'katana2', side: -1, offsetY: 1, impactY: 0 },
  { pose: 'kick', side: 1, offsetY: 2, impactY: 0 },
  { pose: 'uppercut1', side: 0, offsetY: 18, impactY: 8 },
  { pose: 'uppercut2', side: 0, offsetY: 12, impactY: 4 },
  { pose: 'punch', side: 1, offsetY: -9, impactY: -3 },
  { pose: 'katana1', side: 1, offsetY: -4, impactY: -2 },
  { pose: 'katana2', side: 1, offsetY: 0, impactY: 0 },
  { pose: 'kick', side: -1, offsetY: 7, impactY: 2 },
  { pose: 'uppercut1', side: -1, offsetY: 17, impactY: 7 },
  { pose: 'uppercut2', side: 1, offsetY: 11, impactY: 4 },
]

export const RAID_SPIEGEL_BARRAGE_SEQUENCE: CoreLanderBarrageMove[] = [
  { pose: 'shadowAttack', side: -1, offsetY: -4, impactY: -2 },
  { pose: 'attack', side: 1, offsetY: -2, impactY: -1 },
  { pose: 'punch', side: -1, offsetY: -5, impactY: -2 },
  { pose: 'kunaiThrow', side: 1, offsetY: 1, impactY: 0 },
  { pose: 'kick', side: 1, offsetY: 4, impactY: 1 },
  { pose: 'spin', side: 0, offsetY: 2, impactY: 0 },
  { pose: 'upperAttack', side: -1, offsetY: 16, impactY: 7 },
  { pose: 'kunaiThrowAbove', side: 0, offsetY: 18, impactY: 8 },
  { pose: 'stop', side: 1, offsetY: 10, impactY: 4 },
  { pose: 'attack', side: -1, offsetY: -6, impactY: -2 },
  { pose: 'kick', side: -1, offsetY: 5, impactY: 2 },
  { pose: 'shadowAttack', side: 1, offsetY: -2, impactY: -1 },
]

export const RAID_CORE_LANDER_BARRAGE_SEQUENCES: Record<CoreLanderCombatModel, CoreLanderBarrageMove[]> = {
  godGundam: RAID_GOD_GUNDAM_BARRAGE_SEQUENCE,
  spiegel: RAID_SPIEGEL_BARRAGE_SEQUENCE,
}

export const RAID_CORE_LANDER_BARRAGE_POSE_SCALES: Record<CoreLanderCombatModel, Record<string, number>> = {
  godGundam: {},
  spiegel: {
    attack: 0.94,
    kick: 0.94,
    kunaiThrow: 0.94,
    kunaiThrowAbove: 0.9,
    punch: 0.94,
    shadowAttack: 0.78,
    spin: 0.84,
    stop: 0.9,
    upperAttack: 1.02,
  },
}

export const RAID_DEVIL_BOSS_ASSET_PATHS: Record<DevilBossPose, string> = {
  idle: 'assets/GundamEnemy/devil-idle-1.png',
  idle2: 'assets/GundamEnemy/devil-idle-2.png',
  attack: 'assets/GundamEnemy/devil-attack.png',
  attack2: 'assets/GundamEnemy/devil-attack-2.png',
  rage: 'assets/GundamEnemy/devil-rage.png',
}

export const RAID_DEVIL_BOSS_POSES: DevilBossPose[] = ['idle', 'idle2', 'attack', 'attack2', 'rage']

export const RAID_SHIP_STATIC_FILTERS = [
  'brightness(1.12) contrast(1.14) saturate(1.26)',
  'brightness(1.28) contrast(1.42) saturate(2.25)',
  'brightness(1.35) saturate(1.9)',
] as const

export const RAID_NORMAL_BOSS_POOL_STATIC_FILTERS = [
  'brightness(1.14) contrast(1.18) saturate(1.38)',
  'brightness(1.16) contrast(1.18) saturate(1.34)',
] as const

export const RAID_ELITE_STATIC_FILTERS = [
  ...RAID_NORMAL_BOSS_POOL_STATIC_FILTERS,
  'brightness(1.12) contrast(1.18) saturate(1.2)',
  'brightness(1.14) contrast(1.18) saturate(1.25)',
  'brightness(1.16) contrast(1.2) saturate(1.35)',
  'brightness(1.18) contrast(1.2) saturate(1.45)',
] as const

export const RAID_SQUID_BOSS_STATIC_FILTERS = [
  'brightness(1.06) contrast(1.12) saturate(1.08)',
] as const

export const RAID_COBRA_BOSS_STATIC_FILTERS = [
  'brightness(1.08) contrast(1.14) saturate(1.08)',
  'brightness(1.16) contrast(1.22) saturate(1.16)',
] as const

export const RAID_FINAL_BOSS_STATIC_FILTERS = [
  'brightness(1.12) contrast(1.14) saturate(1.22)',
] as const

export const RAID_DEVIL_BOSS_BASE_FILTER = 'brightness(1.06) contrast(1.16) saturate(1.12)'

export const RAID_DEVIL_BOSS_ATTACK_FILTER = 'brightness(1.12) contrast(1.24) saturate(1.34)'

export const RAID_DEVIL_BOSS_RED_OVERLAY_FILTER = 'brightness(1.34) contrast(1.34) saturate(2.8) sepia(0.72) hue-rotate(315deg)'

export const RAID_DEVIL_MASTER_PROJECTILE_FILTER = 'brightness(1.1) contrast(1.18) saturate(1.18)'

export const RAID_DEVIL_BOSS_RED_FILTERS: Record<string, string> = {
  '0.5': 'brightness(1.20) contrast(1.31) saturate(1.82) sepia(0.29) hue-rotate(327.0deg)',
  '0.75': 'brightness(1.25) contrast(1.37) saturate(2.10) sepia(0.43) hue-rotate(318.5deg)',
  '1': 'brightness(1.30) contrast(1.42) saturate(2.39) sepia(0.58) hue-rotate(310.0deg)',
}

export const RAID_DEVIL_BOSS_STATIC_FILTERS = [
  RAID_DEVIL_BOSS_BASE_FILTER,
  RAID_DEVIL_BOSS_ATTACK_FILTER,
  RAID_DEVIL_BOSS_RED_OVERLAY_FILTER,
  ...Object.values(RAID_DEVIL_BOSS_RED_FILTERS),
] as const

export const RAID_DEVIL_RETICLE_GLOW_STOPS: Array<[number, string]> = [
  [0, 'rgba(254,202,202,0.36)'],
  [0.4, 'rgba(239,68,68,0.22)'],
  [1, 'rgba(127,29,29,0)'],
]

export const RAID_DEVIL_MASTER_PROJECTILE_GLOW_STOPS: Array<[number, string]> = [
  [0, 'rgba(254,226,226,0.32)'],
  [0.44, 'rgba(248,113,113,0.24)'],
  [1, 'rgba(127,29,29,0)'],
]

export const RAID_GOD_GUNDAM_BARRAGE_FILTER = 'brightness(1.08) contrast(1.14) saturate(1.14)'

export const RAID_SPIEGEL_BARRAGE_FILTER = 'brightness(1.08) contrast(1.18) saturate(1.18)'

export const RAID_SPIEGEL_SHADOW_CLONE_FILTER = 'brightness(0.36) contrast(1.35) saturate(0.36)'

export const RAID_GOD_GUNDAM_BURNING_BARRAGE_FILTER = 'brightness(1.32) contrast(1.32) saturate(2.3) sepia(0.55) hue-rotate(342deg)'

export const RAID_GOD_GUNDAM_BARRAGE_IMPACT_STOPS: Array<[number, string]> = [
  [0, 'rgba(255,255,255,0.46)'],
  [0.36, 'rgba(250,204,21,0.28)'],
  [1, 'rgba(251,146,60,0)'],
]

export const RAID_SPIEGEL_BARRAGE_IMPACT_STOPS: Array<[number, string]> = [
  [0, 'rgba(248,250,252,0.42)'],
  [0.38, 'rgba(248,113,113,0.24)'],
  [1, 'rgba(15,23,42,0)'],
]

export const RAID_SPIEGEL_SHADOW_CLONE_IMPACT_STOPS: Array<[number, string]> = [
  [0, 'rgba(15,23,42,0.42)'],
  [0.46, 'rgba(2,6,23,0.24)'],
  [1, 'rgba(0,0,0,0)'],
]

export const RAID_GOD_GUNDAM_BURNING_BARRAGE_IMPACT_STOPS: Array<[number, string]> = [
  [0, 'rgba(255,255,255,0.56)'],
  [0.28, 'rgba(254,240,138,0.42)'],
  [0.62, 'rgba(251,146,60,0.24)'],
  [1, 'rgba(220,38,38,0)'],
]

export const RAID_PLAYER_LASER_HEAD_STOPS: Array<[number, string]> = [
  [0, 'rgba(255,255,255,0.75)'],
  [0.38, 'rgba(34,211,238,0.52)'],
  [1, 'rgba(34,211,238,0)'],
]

export const RAID_SQUID_BUBBLE_STOPS: Array<[number, string]> = [
  [0, 'rgba(255,255,255,0.72)'],
  [0.22, 'rgba(244,114,182,0.58)'],
  [0.58, 'rgba(168,85,247,0.42)'],
  [1, 'rgba(88,28,135,0)'],
]

export const RAID_SQUID_INK_STOPS: Array<[number, string]> = [
  [0, 'rgba(255,255,255,0.72)'],
  [0.24, 'rgba(244,114,182,0.74)'],
  [0.58, 'rgba(88,28,135,0.72)'],
  [1, 'rgba(31,5,54,0)'],
]

export const RAID_SNAKE_FANG_GLOW_STOPS: Array<[number, string]> = [
  [0, 'rgba(255,255,255,0.55)'],
  [0.42, 'rgba(132,204,22,0.56)'],
  [1, 'rgba(132,204,22,0)'],
]

export const RAID_VENOM_SPIT_STOPS: Array<[number, string]> = [
  [0, 'rgba(255,255,255,0.72)'],
  [0.24, 'rgba(190,242,100,0.82)'],
  [0.58, 'rgba(132,204,22,0.58)'],
  [1, 'rgba(63,98,18,0)'],
]

export const RAID_OTHER_STATIC_FILTERS: Partial<Record<RaidOtherAssetKey, readonly string[]>> = {
  asteroid: [
    'brightness(0.86) contrast(1.16) saturate(0.9)',
    'brightness(0.84) contrast(1.2) saturate(0.92)',
  ],
  comet: ['brightness(1.2) contrast(1.18) saturate(1.14)'],
  galaxy: [
    'brightness(0.72) contrast(1.12) saturate(1.04)',
    'brightness(0.42) contrast(1.08) saturate(0.72)',
  ],
  galaxy2: [
    'brightness(0.58) contrast(1.06) saturate(0.82)',
    'brightness(0.42) contrast(1.08) saturate(0.72)',
  ],
  galaxy3: [
    'brightness(0.64) contrast(1.12) saturate(0.88)',
    'brightness(0.46) contrast(1.08) saturate(0.68)',
  ],
  galaxy4: [
    'brightness(0.62) contrast(1.1) saturate(0.78)',
    'brightness(0.42) contrast(1.08) saturate(0.62)',
  ],
  planet1: ['brightness(0.78) contrast(1.08) saturate(0.86)'],
  planet2: ['brightness(0.8) contrast(1.08) saturate(0.86)'],
  planet3: ['brightness(0.66) contrast(1.12) saturate(0.9)'],
  planet4: ['brightness(0.76) contrast(1.1) saturate(0.82)'],
  planet5: ['brightness(0.72) contrast(1.12) saturate(0.92)'],
  planetNebula: ['brightness(0.62) contrast(1.12) saturate(0.86)'],
  spaceStation: ['brightness(0.78) contrast(1.16) saturate(0.82)'],
  sun: ['brightness(0.9) contrast(1.14) saturate(1.08)'],
  clouds: ['brightness(0.86) contrast(1.1) saturate(1.06)'],
  clouds2: ['brightness(0.86) contrast(1.1) saturate(1.06)'],
  volcanicClouds: ['brightness(0.9) contrast(1.12) saturate(1.06)'],
  volcanicClouds2: ['brightness(0.9) contrast(1.12) saturate(1.06)'],
  island: ['brightness(0.64) contrast(1.1) saturate(0.95)'],
  island2: ['brightness(0.64) contrast(1.1) saturate(0.95)'],
  island3: ['brightness(0.64) contrast(1.1) saturate(0.95)'],
  octiIsland: ['brightness(0.64) contrast(1.1) saturate(0.95)'],
  volcano: ['brightness(0.72) contrast(1.12) saturate(1.05)'],
  volcano2: ['brightness(0.72) contrast(1.12) saturate(1.05)'],
  volcano3: ['brightness(0.72) contrast(1.12) saturate(1.05)'],
  snakeVolcano: ['brightness(0.72) contrast(1.12) saturate(1.05)'],
}

export function makeSpriteProcessingCanvas(image: HTMLImageElement, maxSize: number, crop?: { x: number; y: number; width: number; height: number }) {
  const sourceWidth = crop?.width ?? image.naturalWidth
  const sourceHeight = crop?.height ?? image.naturalHeight
  const scale = Math.min(1, maxSize / Math.max(sourceWidth, sourceHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(sourceWidth * scale))
  canvas.height = Math.max(1, Math.round(sourceHeight * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    image,
    crop?.x ?? 0,
    crop?.y ?? 0,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  )
  return canvas
}

export function trimTransparentCanvas(canvas: HTMLCanvasElement, padding = 2) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const { width, height } = canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3]
      if (alpha <= 8) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }

  if (maxX < minX || maxY < minY) return canvas

  minX = Math.max(0, minX - padding)
  minY = Math.max(0, minY - padding)
  maxX = Math.min(width - 1, maxX + padding)
  maxY = Math.min(height - 1, maxY + padding)
  const trimWidth = maxX - minX + 1
  const trimHeight = maxY - minY + 1
  if (trimWidth >= width && trimHeight >= height) return canvas

  const trimmed = document.createElement('canvas')
  trimmed.width = trimWidth
  trimmed.height = trimHeight
  const trimmedCtx = trimmed.getContext('2d')
  if (!trimmedCtx) return canvas
  trimmedCtx.imageSmoothingEnabled = true
  trimmedCtx.imageSmoothingQuality = 'high'
  trimmedCtx.drawImage(canvas, minX, minY, trimWidth, trimHeight, 0, 0, trimWidth, trimHeight)
  return trimmed
}

export function applyAlphaKey(canvas: HTMLCanvasElement, getAlphaScale: (red: number, green: number, blue: number, alpha: number, x: number, y: number) => number) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  for (let index = 0; index < data.length; index += 4) {
    const x = (index / 4) % canvas.width
    const y = Math.floor(index / 4 / canvas.width)
    const alphaScale = clamp(getAlphaScale(data[index], data[index + 1], data[index + 2], data[index + 3], x, y), 0, 1)
    data[index + 3] = Math.round(data[index + 3] * alphaScale)
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas
}

export function removeConnectedCanvasMatte(canvas: HTMLCanvasElement, isMattePixel: (red: number, green: number, blue: number, alpha: number, x: number, y: number) => boolean) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const { width, height } = canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  const seen = new Uint8Array(width * height)
  const stack: number[] = []

  const pushIfMatte = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const pixel = y * width + x
    if (seen[pixel]) return
    seen[pixel] = 1
    const index = pixel * 4
    if (data[index + 3] <= 0) return
    if (isMattePixel(data[index], data[index + 1], data[index + 2], data[index + 3], x, y)) stack.push(pixel)
  }

  for (let x = 0; x < width; x += 1) {
    pushIfMatte(x, 0)
    pushIfMatte(x, height - 1)
  }
  for (let y = 1; y < height - 1; y += 1) {
    pushIfMatte(0, y)
    pushIfMatte(width - 1, y)
  }

  while (stack.length > 0) {
    const pixel = stack.pop() ?? 0
    const x = pixel % width
    const y = Math.floor(pixel / width)
    data[pixel * 4 + 3] = 0
    pushIfMatte(x + 1, y)
    pushIfMatte(x - 1, y)
    pushIfMatte(x, y + 1)
    pushIfMatte(x, y - 1)
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas
}

export function processAsteroidAsset(image: HTMLImageElement) {
  const canvas = makeSpriteProcessingCanvas(image, 620)
  if (!canvas) return null
  const keyedCanvas = applyAlphaKey(canvas, (red, green, blue) => {
    const min = Math.min(red, green, blue)
    const max = Math.max(red, green, blue)
    if (min > 244 && max - min < 18) return 0
    if (min > 220 && max - min < 24) return (244 - min) / 24
    return 1
  })
  return removeConnectedCanvasMatte(keyedCanvas, (red, green, blue) => {
    const min = Math.min(red, green, blue)
    const max = Math.max(red, green, blue)
    const luma = red * 0.299 + green * 0.587 + blue * 0.114
    const chroma = max - min
    return (luma > 138 && chroma < 38) || (luma > 190 && chroma < 70)
  })
}

export function processCometAsset(image: HTMLImageElement) {
  const cropY = Math.round(image.naturalHeight * 0.18)
  const cropHeight = Math.round(image.naturalHeight * 0.78)
  const canvas = makeSpriteProcessingCanvas(image, 720, { x: 0, y: cropY, width: image.naturalWidth, height: cropHeight })
  if (!canvas) return null
  return applyAlphaKey(canvas, (red, green, blue) => {
    const luma = red * 0.299 + green * 0.587 + blue * 0.114
    if (luma < 18) return 0
    if (luma < 76) return (luma - 18) / 58
    return 1
  })
}

export function processDerelictWreckAsset(image: HTMLImageElement) {
  const canvas = makeSpriteProcessingCanvas(image, 680)
  if (!canvas) return null
  return trimTransparentCanvas(canvas, 3)
}

export function processGalaxyAsset(image: HTMLImageElement) {
  const canvas = makeSpriteProcessingCanvas(image, 920)
  if (!canvas) return null
  return applyAlphaKey(canvas, (red, green, blue) => {
    const luma = red * 0.299 + green * 0.587 + blue * 0.114
    if (luma < 10) return 0
    if (luma < 52) return (luma - 10) / 42
    return 1
  })
}

export function processGalaxy2Asset(image: HTMLImageElement) {
  const crop = {
    x: Math.round(image.naturalWidth * 0.075),
    y: Math.round(image.naturalHeight * 0.035),
    width: Math.round(image.naturalWidth * 0.845),
    height: Math.round(image.naturalHeight * 0.845),
  }
  const canvas = makeSpriteProcessingCanvas(image, 920, crop)
  if (!canvas) return null
  return applyAlphaKey(canvas, (red, green, blue) => {
    const luma = red * 0.299 + green * 0.587 + blue * 0.114
    if (luma < 8) return 0
    if (luma < 44) return (luma - 8) / 36
    return 1
  })
}

export function processPlanetAsset(image: HTMLImageElement) {
  const canvas = makeSpriteProcessingCanvas(image, 900)
  if (!canvas) return null
  return trimTransparentCanvas(canvas, 4)
}

export function processPlanet3Asset(image: HTMLImageElement) {
  const canvas = makeSpriteProcessingCanvas(image, 620)
  if (!canvas) return null
  return trimTransparentCanvas(canvas, 4)
}

export function processPlanetNebulaAsset(image: HTMLImageElement) {
  const canvas = makeSpriteProcessingCanvas(image, 820)
  if (!canvas) return null
  return trimTransparentCanvas(canvas, 4)
}

export function processSunAsset(image: HTMLImageElement) {
  const canvas = makeSpriteProcessingCanvas(image, 760)
  if (!canvas) return null
  const centerX = canvas.width * 0.43
  const centerY = canvas.height * 0.51
  const radius = Math.min(canvas.width, canvas.height) * 0.39
  const feather = Math.max(10, radius * 0.055)
  return applyAlphaKey(canvas, (red, green, blue, _alpha, x, y) => {
    const distance = Math.sqrt((x - centerX) * (x - centerX) + (y - centerY) * (y - centerY))
    if (distance >= radius) return 0
    if (distance > radius - feather) return (radius - distance) / feather
    const luma = red * 0.299 + green * 0.587 + blue * 0.114
    if (luma < 12) return 0
    if (luma < 44) return (luma - 12) / 32
    return 1
  })
}

export function processRingedPlanetAsset(image: HTMLImageElement) {
  const canvas = makeSpriteProcessingCanvas(image, 720)
  if (!canvas) return null
  return trimTransparentCanvas(canvas, 4)
}

export function processSpaceStationAsset(image: HTMLImageElement) {
  const canvas = makeSpriteProcessingCanvas(image, 760)
  if (!canvas) return null
  const keyedCanvas = applyAlphaKey(canvas, (red, green, blue) => {
    const luma = red * 0.299 + green * 0.587 + blue * 0.114
    if (luma < 4) return 0
    if (luma < 20) return (luma - 4) / 16
    return 1
  })
  return trimTransparentCanvas(keyedCanvas, 3)
}

export function processVioletCloudAsset(image: HTMLImageElement) {
  const canvas = makeSpriteProcessingCanvas(image, 820)
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return canvas
  removeConnectedCanvasMatte(canvas, (red, green, blue, alpha) => {
    if (alpha <= 0) return false
    const min = Math.min(red, green, blue)
    const max = Math.max(red, green, blue)
    const luma = red * 0.299 + green * 0.587 + blue * 0.114
    return luma < 158 && max - min < 76 && green > red + 5 && blue > red + 10
  })
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3]
    if (alpha <= 0) continue
    const red = data[index]
    const green = data[index + 1]
    const blue = data[index + 2]
    const luma = red * 0.299 + green * 0.587 + blue * 0.114
    const alphaScale = luma < 82 && blue > red + 8 ? 0.52 : 0.96
    data[index] = Math.round(luma * 0.42 + 44)
    data[index + 1] = Math.round(luma * 0.24 + 18)
    data[index + 2] = Math.round(luma * 0.58 + 78)
    data[index + 3] = Math.round(alpha * alphaScale)
  }
  ctx.putImageData(imageData, 0, 0)
  return trimTransparentCanvas(canvas, 2)
}

export function processVolcanicCloudAsset(image: HTMLImageElement) {
  const canvas = makeSpriteProcessingCanvas(image, 820)
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return canvas
  removeConnectedCanvasMatte(canvas, (red, green, blue, alpha) => {
    if (alpha <= 0) return false
    const min = Math.min(red, green, blue)
    const max = Math.max(red, green, blue)
    const luma = red * 0.299 + green * 0.587 + blue * 0.114
    return luma < 158 && max - min < 76 && green > red + 5 && blue > red + 10
  })
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3]
    if (alpha <= 0) continue
    const red = data[index]
    const green = data[index + 1]
    const blue = data[index + 2]
    const luma = red * 0.299 + green * 0.587 + blue * 0.114
    const alphaScale = luma < 76 && red > blue + 8 ? 0.5 : 0.94
    data[index] = Math.round(luma * 0.7 + 58)
    data[index + 1] = Math.round(luma * 0.24 + 18)
    data[index + 2] = Math.round(luma * 0.18 + 12)
    data[index + 3] = Math.round(alpha * alphaScale)
  }
  ctx.putImageData(imageData, 0, 0)
  return trimTransparentCanvas(canvas, 2)
}

export function processWateryIslandAsset(image: HTMLImageElement) {
  const canvas = makeSpriteProcessingCanvas(image, 760)
  if (!canvas) return null
  return trimTransparentCanvas(canvas, 3)
}

export function processVolcanicIslandAsset(image: HTMLImageElement) {
  const canvas = makeSpriteProcessingCanvas(image, 780)
  if (!canvas) return null
  return trimTransparentCanvas(canvas, 3)
}

export function processSquidBossAsset(image: HTMLImageElement) {
  const alphaCanvas = makeSpriteProcessingCanvas(image, Math.max(image.naturalWidth, image.naturalHeight))
  const ctx = alphaCanvas?.getContext('2d')
  if (!alphaCanvas || !ctx) return null

  const imageData = ctx.getImageData(0, 0, alphaCanvas.width, alphaCanvas.height)
  const data = imageData.data
  let minX = alphaCanvas.width
  let minY = alphaCanvas.height
  let maxX = -1
  let maxY = -1
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] <= 16) continue
    const pixel = index / 4
    const x = pixel % alphaCanvas.width
    const y = Math.floor(pixel / alphaCanvas.width)
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  if (maxX < minX || maxY < minY) return alphaCanvas

  const scaleX = image.naturalWidth / alphaCanvas.width
  const scaleY = image.naturalHeight / alphaCanvas.height
  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.035)
  const cropX = Math.max(0, Math.round((minX - pad) * scaleX))
  const cropY = Math.max(0, Math.round((minY - pad) * scaleY))
  const crop = {
    x: cropX,
    y: cropY,
    width: Math.min(image.naturalWidth - cropX, Math.round((maxX - minX + 1 + pad * 2) * scaleX)),
    height: Math.min(image.naturalHeight - cropY, Math.round((maxY - minY + 1 + pad * 2) * scaleY)),
  }
  return makeSpriteProcessingCanvas(image, 680, crop)
}

export function processCobraBossAsset(image: HTMLImageElement) {
  const alphaCanvas = makeSpriteProcessingCanvas(image, Math.max(image.naturalWidth, image.naturalHeight))
  const ctx = alphaCanvas?.getContext('2d')
  if (!alphaCanvas || !ctx) return null

  const imageData = ctx.getImageData(0, 0, alphaCanvas.width, alphaCanvas.height)
  const data = imageData.data
  let minX = alphaCanvas.width
  let minY = alphaCanvas.height
  let maxX = -1
  let maxY = -1
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] <= 12) continue
    const pixel = index / 4
    const x = pixel % alphaCanvas.width
    const y = Math.floor(pixel / alphaCanvas.width)
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  if (maxX < minX || maxY < minY) return alphaCanvas

  const scaleX = image.naturalWidth / alphaCanvas.width
  const scaleY = image.naturalHeight / alphaCanvas.height
  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.04)
  const cropX = Math.max(0, Math.round((minX - pad) * scaleX))
  const cropY = Math.max(0, Math.round((minY - pad) * scaleY))
  const crop = {
    x: cropX,
    y: cropY,
    width: Math.min(image.naturalWidth - cropX, Math.round((maxX - minX + 1 + pad * 2) * scaleX)),
    height: Math.min(image.naturalHeight - cropY, Math.round((maxY - minY + 1 + pad * 2) * scaleY)),
  }
  const canvas = makeSpriteProcessingCanvas(image, 760, crop)
  const cobraCtx = canvas?.getContext('2d')
  if (!canvas || !cobraCtx) return canvas

  const cobraData = cobraCtx.getImageData(0, 0, canvas.width, canvas.height)
  const cobraPixels = cobraData.data
  for (let index = 0; index < cobraPixels.length; index += 4) {
    if (cobraPixels[index + 3] > 2) continue
    cobraPixels[index] = 0
    cobraPixels[index + 1] = 0
    cobraPixels[index + 2] = 0
    cobraPixels[index + 3] = 0
  }
  cobraCtx.putImageData(cobraData, 0, 0)
  return canvas
}

export function processDevilBossAsset(image: HTMLImageElement) {
  const sourceCanvas = makeSpriteProcessingCanvas(image, Math.max(image.naturalWidth, image.naturalHeight))
  const sourceCtx = sourceCanvas?.getContext('2d')
  if (!sourceCanvas || !sourceCtx) return null

  const imageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height)
  const data = imageData.data
  let minX = sourceCanvas.width
  let minY = sourceCanvas.height
  let maxX = -1
  let maxY = -1
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] <= 8) continue
    const pixel = index / 4
    const x = pixel % sourceCanvas.width
    const y = Math.floor(pixel / sourceCanvas.width)
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  if (maxX < minX || maxY < minY) return sourceCanvas

  const canvasSize = 512
  const targetHeight = 472
  const sourceWidth = maxX - minX + 1
  const sourceHeight = maxY - minY + 1
  const scale = targetHeight / sourceHeight
  const targetWidth = sourceWidth * scale
  const canvas = document.createElement('canvas')
  canvas.width = canvasSize
  canvas.height = canvasSize
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    sourceCanvas,
    minX,
    minY,
    sourceWidth,
    sourceHeight,
    (canvasSize - targetWidth) / 2,
    18,
    targetWidth,
    targetHeight,
  )
  return canvas
}

export function getOtherAssetProcessor(key: RaidOtherAssetKey): CanvasSpriteProcessor | undefined {
  if (key === 'asteroid') return processAsteroidAsset
  if (key === 'comet') return processCometAsset
  if (key === 'galaxy') return processGalaxyAsset
  if (key === 'galaxy2') return processGalaxy2Asset
  if (key === 'galaxy3') return processGalaxyAsset
  if (key === 'galaxy4') return processGalaxyAsset
  if (key === 'planet1') return processPlanetAsset
  if (key === 'planet2') return processRingedPlanetAsset
  if (key === 'planet3') return processPlanet3Asset
  if (key === 'planet4') return processPlanetAsset
  if (key === 'planet5') return processPlanetAsset
  if (key === 'planetNebula') return processPlanetNebulaAsset
  if (key === 'spaceStation') return processSpaceStationAsset
  if (key === 'sun') return processSunAsset
  if (key === 'clouds') return processVioletCloudAsset
  if (key === 'clouds2') return processVioletCloudAsset
  if (key === 'volcanicClouds') return processVolcanicCloudAsset
  if (key === 'volcanicClouds2') return processVolcanicCloudAsset
  if (key === 'island') return processWateryIslandAsset
  if (key === 'island2') return processWateryIslandAsset
  if (key === 'island3') return processWateryIslandAsset
  if (key === 'octiIsland') return processWateryIslandAsset
  if (key === 'volcano') return processVolcanicIslandAsset
  if (key === 'volcano2') return processVolcanicIslandAsset
  if (key === 'volcano3') return processVolcanicIslandAsset
  if (key === 'snakeVolcano') return processVolcanicIslandAsset
  return undefined
}

export function makeImageCanvasSprite(cacheKey: string, src: string, processor?: CanvasSpriteProcessor) {
  const existing = canvasSpriteCache.get(cacheKey)
  if (existing) return existing

  const image = new Image()
  let resolveReady: () => void = () => {}
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve
  })
  const entry: CanvasSpriteEntry = { cacheKey, image, loaded: false, ready }
  image.decoding = 'async'
  image.onload = () => {
    const decodePromise = typeof image.decode === 'function' ? image.decode().catch(() => undefined) : Promise.resolve()
    void decodePromise.then(() => {
      if (processor) {
        try {
          entry.processedImage = processor(image) ?? undefined
        } catch {
          entry.processedImage = undefined
        }
      }
      entry.loaded = true
      resolveReady()
    })
  }
  image.onerror = () => {
    entry.loaded = false
    resolveReady()
  }
  image.src = src
  canvasSpriteCache.set(cacheKey, entry)
  return entry
}

export function getCanvasSpriteSource(sprite: CanvasSpriteEntry) {
  return sprite.processedImage ?? sprite.image
}

export function getCanvasSpriteDimensions(sprite: CanvasSpriteEntry) {
  const source = getCanvasSpriteSource(sprite)
  const width = 'naturalWidth' in source ? source.naturalWidth : source.width
  const height = 'naturalHeight' in source ? source.naturalHeight : source.height
  return { source, width, height }
}

export function shouldCacheCanvasFilter(filter: string) {
  return filter !== 'none' && !filter.includes('blur(')
}

export function getFilteredCanvasSpriteSource(sprite: CanvasSpriteEntry, source: CanvasImageSource, width: number, height: number, filter: string) {
  if (!shouldCacheCanvasFilter(filter) || typeof document === 'undefined' || width <= 0 || height <= 0) return null

  const cacheKey = `${sprite.cacheKey}|${Math.round(width)}x${Math.round(height)}|${filter}`
  const cached = filteredCanvasSpriteCache.get(cacheKey)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.filter = filter
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  ctx.filter = 'none'

  if (filteredCanvasSpriteCache.size >= FILTERED_CANVAS_SPRITE_CACHE_LIMIT) {
    const oldestKey = filteredCanvasSpriteCache.keys().next().value
    if (oldestKey) filteredCanvasSpriteCache.delete(oldestKey)
  }
  filteredCanvasSpriteCache.set(cacheKey, canvas)
  return canvas
}

export function warmCanvasSpriteFilter(sprite: CanvasSpriteEntry, filter: string) {
  if (!sprite.loaded || !sprite.image.complete) return
  const { source, width, height } = getCanvasSpriteDimensions(sprite)
  getFilteredCanvasSpriteSource(sprite, source, width, height, filter)
}

export function warmRaidCanvasFilterVariants() {
  if (typeof document === 'undefined') return

  for (const ship of SHIP_OPTIONS) {
    const sprite = getShipCanvasSprite(ship.key)
    for (const filter of RAID_SHIP_STATIC_FILTERS) warmCanvasSpriteFilter(sprite, filter)
  }
  for (const spriteKey of ['mesiahBlack', 'mesiahWhite', 'mesiahRaptorBlack', 'mesiahRaptorWhite', 'coreLanderBurning', 'godGundam', 'godGundamBurning', 'spiegel']) {
    const sprite = getShipCanvasSprite(spriteKey)
    for (const filter of RAID_SHIP_STATIC_FILTERS) warmCanvasSpriteFilter(sprite, filter)
  }

  RAID_DEVIL_BOSS_POSES.forEach((pose) => {
    const sprite = getDevilBossCanvasSprite(pose)
    for (const filter of RAID_DEVIL_BOSS_STATIC_FILTERS) warmCanvasSpriteFilter(sprite, filter)
  })

  for (let variant = 0; variant < RAID_ALIEN_SPRITE_COUNT; variant += 1) {
    const sprite = getNormalAlienCanvasSprite(variant)
    for (const filter of RAID_NORMAL_BOSS_POOL_STATIC_FILTERS) warmCanvasSpriteFilter(sprite, filter)
  }

  for (let variant = 0; variant < RAID_ELITE_SPRITE_COUNT; variant += 1) {
    const sprite = getEliteAlienCanvasSprite(variant)
    for (const filter of RAID_ELITE_STATIC_FILTERS) warmCanvasSpriteFilter(sprite, filter)
  }

  for (const filter of RAID_SQUID_BOSS_STATIC_FILTERS) warmCanvasSpriteFilter(getSquidBossCanvasSprite(), filter)
  for (const filter of RAID_COBRA_BOSS_STATIC_FILTERS) warmCanvasSpriteFilter(getCobraBossCanvasSprite(), filter)
  warmCanvasSpriteFilter(getDevilMasterProjectileCanvasSprite(), RAID_DEVIL_MASTER_PROJECTILE_FILTER)
  for (const model of RAID_CORE_LANDER_COMBAT_MODELS) {
    for (const pose of Object.keys(RAID_CORE_LANDER_BARRAGE_ASSET_PATHS[model]) as GodGundamBarragePose[]) {
      warmCanvasSpriteFilter(getGodGundamBarrageCanvasSprite(model, pose), getCoreLanderBarrageFilter(model, false))
      warmCanvasSpriteFilter(getGodGundamBarrageCanvasSprite(model, pose), getCoreLanderBarrageFilter(model, true))
    }
  }
  for (const filter of RAID_FINAL_BOSS_STATIC_FILTERS) warmCanvasSpriteFilter(getFinalBossCanvasSprite(), filter)
  getSquidBossTentacleTextureCanvas()
  getCobraBossBodyTextureCanvas()

  for (const key of Object.keys(RAID_OTHER_STATIC_FILTERS) as RaidOtherAssetKey[]) {
    const sprite = getRaidOtherCanvasSprite(key)
    const filters = RAID_OTHER_STATIC_FILTERS[key]
    if (!filters) continue
    for (const filter of filters) warmCanvasSpriteFilter(sprite, filter)
  }

  for (let variant = 0; variant < RAID_DERELICT_WRECK_VARIANTS.length; variant += 1) {
    warmCanvasSpriteFilter(getDerelictWreckCanvasSprite(variant), RAID_DERELICT_WRECK_FILTER)
  }
}

export function getCachedCanvasPattern(ctx: CanvasRenderingContext2D, texture: HTMLCanvasElement) {
  let contextPatterns = canvasPatternCache.get(ctx)
  if (!contextPatterns) {
    contextPatterns = new WeakMap<HTMLCanvasElement, CanvasPattern | null>()
    canvasPatternCache.set(ctx, contextPatterns)
  }
  if (contextPatterns.has(texture)) return contextPatterns.get(texture) ?? null
  const pattern = ctx.createPattern(texture, 'repeat')
  contextPatterns.set(texture, pattern)
  return pattern
}

export function getRaidOtherCanvasSprite(key: RaidOtherAssetKey) {
  const cacheKey = `other-image:${key}`
  const existing = canvasSpriteCache.get(cacheKey)
  if (existing) return existing
  return makeImageCanvasSprite(cacheKey, getPublicAssetUrl(RAID_OTHER_ASSET_PATHS[key]), getOtherAssetProcessor(key))
}

export function getDerelictWreckVariantIndex(variant: number) {
  return Math.abs(Math.trunc(variant)) % RAID_DERELICT_WRECK_VARIANTS.length
}

export function getDerelictWreckVariantData(variant: number) {
  return RAID_DERELICT_WRECK_VARIANTS[getDerelictWreckVariantIndex(variant)]
}

export function getDerelictWreckCanvasSprite(_variant: number) {
  const cacheKey = 'other-image:derelict-space-station-full'
  const existing = canvasSpriteCache.get(cacheKey)
  if (existing) return existing
  return makeImageCanvasSprite(cacheKey, getPublicAssetUrl(RAID_DERELICT_WRECK_ASSET_PATH), processDerelictWreckAsset)
}

export function getShipCanvasSprite(shipKey: string) {
  const key = `ship-image:${shipKey}`
  const existing = canvasSpriteCache.get(key)
  if (existing) return existing
  return makeImageCanvasSprite(key, getRaidShipSpriteUrl(shipKey))
}

export function getNormalAlienCanvasSprite(variant: number) {
  const key = `alien-image:${Math.abs(Math.trunc(variant)) % RAID_ALIEN_SPRITE_COUNT}`
  const existing = canvasSpriteCache.get(key)
  if (existing) return existing
  return makeImageCanvasSprite(key, getRaidAlienSpriteUrl(variant))
}

export function getFinalBossCanvasSprite() {
  const key = 'alien-image:final-boss'
  const existing = canvasSpriteCache.get(key)
  if (existing) return existing
  return makeImageCanvasSprite(key, getPublicAssetUrl(RAID_FINAL_BOSS_ASSET_PATH))
}

export function getSquidBossCanvasSprite() {
  const key = 'boss-image:squid'
  const existing = canvasSpriteCache.get(key)
  if (existing) return existing
  return makeImageCanvasSprite(key, getPublicAssetUrl(RAID_SQUID_BOSS_ASSET_PATH), processSquidBossAsset)
}

export function getCobraBossCanvasSprite() {
  const key = 'boss-image:cobra'
  const existing = canvasSpriteCache.get(key)
  if (existing) return existing
  return makeImageCanvasSprite(key, getPublicAssetUrl(RAID_COBRA_BOSS_ASSET_PATH), processCobraBossAsset)
}

export function getDevilBossCanvasSprite(pose: DevilBossPose) {
  const key = `boss-image:devil-${pose}`
  const existing = canvasSpriteCache.get(key)
  if (existing) return existing
  return makeImageCanvasSprite(key, getPublicAssetUrl(RAID_DEVIL_BOSS_ASSET_PATHS[pose]), processDevilBossAsset)
}

export function getDevilMasterProjectileCanvasSprite() {
  const key = 'boss-image:devil-master-projectile'
  const existing = canvasSpriteCache.get(key)
  if (existing) return existing
  return makeImageCanvasSprite(key, getPublicAssetUrl(RAID_DEVIL_MASTER_PROJECTILE_ASSET_PATH))
}

export function processSpiegelBarrageAsset(image: HTMLImageElement) {
  return makeSpriteProcessingCanvas(image, 760)
}

export function getGodGundamBarrageCanvasSprite(model: CoreLanderCombatModel, pose: GodGundamBarragePose) {
  const key = `ship-image:${model}-barrage-${pose}`
  const existing = canvasSpriteCache.get(key)
  if (existing) return existing
  return makeImageCanvasSprite(key, getPublicAssetUrl(RAID_CORE_LANDER_BARRAGE_ASSET_PATHS[model][pose]), model === 'spiegel' ? processSpiegelBarrageAsset : undefined)
}

export function getEliteAlienCanvasSprite(variant: number) {
  const index = Math.abs(Math.trunc(variant)) % RAID_ELITE_SPRITE_COUNT
  const key = `elite-image:${index}`
  const existing = canvasSpriteCache.get(key)
  if (existing) return existing
  return makeImageCanvasSprite(key, getRaidEliteSpriteUrl(index))
}

export function getNormalAlienImageFilter(baseFilter: string, enemy: Enemy) {
  const hueOffsets = [-18, 24, -8, 36, -30, 12, 44, -40]
  const index = Math.abs(Math.trunc(enemy.variant)) % hueOffsets.length
  const patternShift = (enemy.pattern - 1.5) * 5
  const brightness = 1 + ((enemy.id % 5) - 2) * 0.018
  return `${baseFilter} hue-rotate(${Math.round(hueOffsets[index] + patternShift)}deg) brightness(${brightness.toFixed(2)}) saturate(1.08)`
}

export function drawSpriteFallback(ctx: CanvasRenderingContext2D, size: number, color: string) {
  ctx.fillStyle = color
  ctx.strokeStyle = 'rgba(255,255,255,0.72)'
  ctx.lineWidth = Math.max(1, size * 0.025)
  ctx.beginPath()
  ctx.moveTo(0, -size * 0.42)
  ctx.bezierCurveTo(size * 0.3, -size * 0.34, size * 0.48, -size * 0.08, size * 0.36, size * 0.2)
  ctx.bezierCurveTo(size * 0.3, size * 0.36, size * 0.14, size * 0.42, 0, size * 0.34)
  ctx.bezierCurveTo(-size * 0.14, size * 0.42, -size * 0.3, size * 0.36, -size * 0.36, size * 0.2)
  ctx.bezierCurveTo(-size * 0.48, -size * 0.08, -size * 0.3, -size * 0.34, 0, -size * 0.42)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.strokeStyle = color
  ctx.globalAlpha *= 0.72
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(side * size * 0.18, size * 0.18)
    ctx.bezierCurveTo(side * size * 0.42, size * 0.26, side * size * 0.48, size * 0.42, side * size * 0.36, size * 0.5)
    ctx.stroke()
  }
}

export function drawCanvasSprite(
  ctx: CanvasRenderingContext2D,
  sprite: CanvasSpriteEntry,
  x: number,
  y: number,
  size: number,
  filter: string,
  alpha = 1,
  rotation = 0,
  scale = 1,
  fallbackColor = PLAYER_COLOR,
  cacheFilteredVariant = true,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.scale(scale, scale)
  ctx.globalAlpha *= alpha
  if (sprite.loaded && sprite.image.complete) {
    const { source, width, height } = getCanvasSpriteDimensions(sprite)
    const filteredSource = cacheFilteredVariant ? getFilteredCanvasSpriteSource(sprite, source, width, height, filter) : null
    ctx.filter = filteredSource ? 'none' : filter
    ctx.drawImage(filteredSource ?? source, -size / 2, -size / 2, size, size)
  } else {
    ctx.filter = filter
    drawSpriteFallback(ctx, size, fallbackColor)
  }
  ctx.restore()
}

export function drawCanvasSpriteContain(
  ctx: CanvasRenderingContext2D,
  sprite: CanvasSpriteEntry,
  x: number,
  y: number,
  size: number,
  filter: string,
  alpha = 1,
  rotation = 0,
  scale = 1,
  fallbackColor = PLAYER_COLOR,
  cacheFilteredVariant = true,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.scale(scale, scale)
  ctx.globalAlpha *= alpha
  if (sprite.loaded && sprite.image.complete) {
    const { source, width, height } = getCanvasSpriteDimensions(sprite)
    if (width <= 0 || height <= 0) {
      ctx.filter = filter
      drawSpriteFallback(ctx, size, fallbackColor)
      ctx.restore()
      return
    }
    const aspect = width / height
    const drawWidth = aspect > 1 ? size : size * aspect
    const drawHeight = aspect > 1 ? size / aspect : size
    const filteredSource = cacheFilteredVariant ? getFilteredCanvasSpriteSource(sprite, source, width, height, filter) : null
    ctx.filter = filteredSource ? 'none' : filter
    ctx.drawImage(filteredSource ?? source, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
  } else {
    ctx.filter = filter
    drawSpriteFallback(ctx, size, fallbackColor)
  }
  ctx.restore()
}

export function drawCanvasImageContain(
  ctx: CanvasRenderingContext2D,
  sprite: CanvasSpriteEntry,
  x: number,
  y: number,
  width: number,
  height: number,
  filter = 'none',
  alpha = 1,
  rotation = 0,
  cacheFilteredVariant = true,
) {
  if (!sprite.loaded || !sprite.image.complete) return false
  const { source, width: sourceWidth, height: sourceHeight } = getCanvasSpriteDimensions(sprite)
  if (sourceWidth <= 0 || sourceHeight <= 0) return false
  const aspect = sourceWidth / sourceHeight
  let drawWidth = width
  let drawHeight = width / aspect
  if (drawHeight > height) {
    drawHeight = height
    drawWidth = height * aspect
  }
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.globalAlpha *= alpha
  const filteredSource = cacheFilteredVariant ? getFilteredCanvasSpriteSource(sprite, source, sourceWidth, sourceHeight, filter) : null
  ctx.filter = filteredSource ? 'none' : filter
  ctx.drawImage(filteredSource ?? source, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
  ctx.restore()
  return true
}

export function drawSpriteGlow(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha: number) {
  const sprite = getCachedSpriteGlow(color, size)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  if (sprite) {
    if (alpha < 1) ctx.globalAlpha *= alpha
    ctx.drawImage(sprite.canvas, x - sprite.originX, y - sprite.originY, sprite.width, sprite.height)
  } else {
    drawRadialEllipse(ctx, x, y, size * 0.58, size * 0.5, [
      [0, `rgba(255,255,255,${0.08 * alpha})`],
      [0.34, color],
      [1, 'rgba(0,0,0,0)'],
    ])
  }
  ctx.restore()
}

export function getEnemyCanvasSize(enemy: Enemy, viewportWidth: number) {
  const isMobileView = viewportWidth <= 640
  if (enemy.isMiniBoss) return isMobileView ? Math.min(viewportWidth * 0.18, 150) : Math.min(viewportWidth * 0.15, 132)
  if (!enemy.isBoss) return isMobileView ? Math.min(viewportWidth * 0.125, 92) : Math.min(viewportWidth * 0.105, 82)
  if (enemy.bossKind === 'devil') return Math.min(viewportWidth * (isMobileView ? 0.94 : 0.68), isMobileView ? 520 : 720)
  if (enemy.bossKind === 'final') return Math.min(viewportWidth * 0.64, 620)
  if (enemy.bossKind === 'squid') return isMobileView ? Math.min(viewportWidth * 0.46, 380) : Math.min(viewportWidth * 0.34, 340)
  if (enemy.bossKind === 'snake') return Math.min(viewportWidth * (isMobileView ? 0.66 : 0.62), 600)
  if (enemy.bossKind === 'super') return Math.min(viewportWidth * (isMobileView ? 0.52 : 0.48), 430)
  if (enemy.bossKind === 'gate') return Math.min(viewportWidth * (isMobileView ? 0.44 : 0.4), 360)
  if (enemy.bossKind === 'hydra') return Math.min(viewportWidth * (isMobileView ? 0.39 : 0.35), 305)
  return Math.min(viewportWidth * (isMobileView ? 0.34 : 0.3), 260)
}
