import { getRaidAlienSpriteUrl, getRaidEliteSpriteUrl, getRaidShipSpriteUrl, RAID_ALIEN_SPRITE_COUNT, RAID_ELITE_SPRITE_COUNT } from '../RaidShipSprite'
import { getPublicAssetUrl } from '../sound'
import { Assets } from 'pixi.js'
import { RAID_COBRA_BOSS_ASSET_PATH, RAID_CORE_LANDER_BARRAGE_ASSET_PATHS, RAID_CORE_LANDER_COMBAT_MODELS, RAID_DERELICT_WRECK_ASSET_PATH, RAID_DERELICT_WRECK_VARIANTS, RAID_DEVIL_BOSS_ASSET_PATHS, RAID_DEVIL_BOSS_POSES, RAID_DEVIL_MASTER_PROJECTILE_ASSET_PATH, RAID_FINAL_BOSS_ASSET_PATH, RAID_OTHER_ASSET_PATHS, RAID_SQUID_BOSS_ASSET_PATH, getCobraBossCanvasSprite, getDerelictWreckCanvasSprite, getDevilBossCanvasSprite, getDevilMasterProjectileCanvasSprite, getEliteAlienCanvasSprite, getFinalBossCanvasSprite, getGodGundamBarrageCanvasSprite, getNormalAlienCanvasSprite, getRaidOtherCanvasSprite, getShipCanvasSprite, getSquidBossCanvasSprite, warmRaidCanvasFilterVariants } from './assets'
import type { CanvasSpriteEntry, GodGundamBarragePose, RaidOtherAssetKey } from './assets'
import { DEFAULT_PICKUP_VOICE_SAMPLE_URL, PICKUP_VOICE_SAMPLE_URLS } from './audio'
import { RAID_BOSS_BGM_TRACK, RAID_BOSS_FINAL_BGM_TRACK, RAID_BOSS_SNAKE_BGM_TRACK, RAID_BOSS_SQUID_BGM_TRACK, RAID_DEFAULT_BGM_TRACK, RAID_ENDING_BGM_TRACK, SHIP_OPTIONS } from './constants'
import { getHomingMissileSprite, warmPowerPickupSpriteCache } from './effectsRender'
import { getCoreBlastSprite, getHoneycombShieldSprite } from './playerRender'
import type { RaidAssetPreloadState } from './types'
import { getCachedProjectileOrbSprite, getCachedProjectileTrailSprite } from './utils'

export const RAID_IMAGE_CACHE_NAME = 'space-defender-raid-images-v1'

export const RAID_AUDIO_CACHE_NAME = 'space-defender-audio-v1'

export const RAID_PERSISTENT_CACHE_VERSION = 'gradius-raid-assets-v3'

export const RAID_PERSISTENT_CACHE_STORAGE_KEY = 'gradiusRaidPersistentAssetCache'

export let raidPersistentAssetCachePromise: Promise<void> | null = null

export let raidPersistentAssetCacheComplete = false

export let raidCanvasAssetWarmPromise: Promise<void> | null = null

export let raidCanvasAssetWarmComplete = false

export let raidPixiAssetWarmPromise: Promise<void> | null = null

export let raidPixiAssetWarmComplete = false

export function warmRaidCanvasAssets() {
  const entries: CanvasSpriteEntry[] = []
  entries.push(getFinalBossCanvasSprite())
  entries.push(getSquidBossCanvasSprite())
  entries.push(getCobraBossCanvasSprite())
  RAID_DEVIL_BOSS_POSES.forEach((pose) => entries.push(getDevilBossCanvasSprite(pose)))
  entries.push(getDevilMasterProjectileCanvasSprite())
  for (const model of RAID_CORE_LANDER_COMBAT_MODELS) {
    for (const pose of Object.keys(RAID_CORE_LANDER_BARRAGE_ASSET_PATHS[model]) as GodGundamBarragePose[]) entries.push(getGodGundamBarrageCanvasSprite(model, pose))
  }
  for (const ship of SHIP_OPTIONS) entries.push(getShipCanvasSprite(ship.key))
  entries.push(getShipCanvasSprite('mesiahBlack'))
  entries.push(getShipCanvasSprite('mesiahWhite'))
  entries.push(getShipCanvasSprite('mesiahRaptorBlack'))
  entries.push(getShipCanvasSprite('mesiahRaptorWhite'))
  entries.push(getShipCanvasSprite('coreLanderBurning'))
  entries.push(getShipCanvasSprite('godGundam'))
  entries.push(getShipCanvasSprite('godGundamBurning'))
  entries.push(getShipCanvasSprite('spiegel'))
  for (let variant = 0; variant < RAID_ALIEN_SPRITE_COUNT; variant += 1) entries.push(getNormalAlienCanvasSprite(variant))
  for (let variant = 0; variant < RAID_ELITE_SPRITE_COUNT; variant += 1) entries.push(getEliteAlienCanvasSprite(variant))
  for (const key of Object.keys(RAID_OTHER_ASSET_PATHS) as RaidOtherAssetKey[]) entries.push(getRaidOtherCanvasSprite(key))
  for (let variant = 0; variant < RAID_DERELICT_WRECK_VARIANTS.length; variant += 1) entries.push(getDerelictWreckCanvasSprite(variant))
  return entries
}

export function getRaidPersistentImageUrls() {
  const urls = new Set<string>()
  urls.add(getPublicAssetUrl(RAID_FINAL_BOSS_ASSET_PATH))
  urls.add(getPublicAssetUrl(RAID_SQUID_BOSS_ASSET_PATH))
  urls.add(getPublicAssetUrl(RAID_COBRA_BOSS_ASSET_PATH))
  RAID_DEVIL_BOSS_POSES.forEach((pose) => urls.add(getPublicAssetUrl(RAID_DEVIL_BOSS_ASSET_PATHS[pose])))
  urls.add(getPublicAssetUrl(RAID_DEVIL_MASTER_PROJECTILE_ASSET_PATH))
  for (const model of RAID_CORE_LANDER_COMBAT_MODELS) {
    for (const pose of Object.keys(RAID_CORE_LANDER_BARRAGE_ASSET_PATHS[model]) as GodGundamBarragePose[]) urls.add(getPublicAssetUrl(RAID_CORE_LANDER_BARRAGE_ASSET_PATHS[model][pose]))
  }
  for (const ship of SHIP_OPTIONS) urls.add(getRaidShipSpriteUrl(ship.key))
  urls.add(getRaidShipSpriteUrl('mesiahBlack'))
  urls.add(getRaidShipSpriteUrl('mesiahWhite'))
  urls.add(getRaidShipSpriteUrl('mesiahRaptorBlack'))
  urls.add(getRaidShipSpriteUrl('mesiahRaptorWhite'))
  urls.add(getRaidShipSpriteUrl('coreLanderBurning'))
  urls.add(getRaidShipSpriteUrl('godGundam'))
  urls.add(getRaidShipSpriteUrl('godGundamBurning'))
  urls.add(getRaidShipSpriteUrl('spiegel'))
  for (let variant = 0; variant < RAID_ALIEN_SPRITE_COUNT; variant += 1) urls.add(getRaidAlienSpriteUrl(variant))
  for (let variant = 0; variant < RAID_ELITE_SPRITE_COUNT; variant += 1) urls.add(getRaidEliteSpriteUrl(variant))
  for (const key of Object.keys(RAID_OTHER_ASSET_PATHS) as RaidOtherAssetKey[]) urls.add(getPublicAssetUrl(RAID_OTHER_ASSET_PATHS[key]))
  urls.add(getPublicAssetUrl(RAID_DERELICT_WRECK_ASSET_PATH))
  return [...urls]
}

export function getRaidPersistentAudioUrls() {
  return [
    RAID_DEFAULT_BGM_TRACK,
    RAID_BOSS_BGM_TRACK,
    RAID_BOSS_SQUID_BGM_TRACK,
    RAID_BOSS_SNAKE_BGM_TRACK,
    RAID_BOSS_FINAL_BGM_TRACK,
    RAID_ENDING_BGM_TRACK,
    DEFAULT_PICKUP_VOICE_SAMPLE_URL,
    ...Object.values(PICKUP_VOICE_SAMPLE_URLS),
    getPublicAssetUrl('audio/sfx_laser.wav'),
    getPublicAssetUrl('audio/sfx_rocket.wav'),
    getPublicAssetUrl('audio/sfx_cannon.wav'),
    getPublicAssetUrl('audio/sfx_explosion_small.wav'),
    getPublicAssetUrl('audio/sfx_explosion_big.wav'),
    getPublicAssetUrl('audio/sfx_nuke.mp3'),
    getPublicAssetUrl('audio/sfx_destroyed_explosion.mp3'),
    getPublicAssetUrl('audio/sfx_shoot.wav'),
    getPublicAssetUrl('audio/sfx_hit.wav'),
    getPublicAssetUrl('audio/sfx_combo.wav'),
    getPublicAssetUrl('audio/sfx_levelup.wav'),
    getPublicAssetUrl('audio/sfx_gameover.wav'),
    getPublicAssetUrl('audio/sfx_damage.wav'),
    getPublicAssetUrl('audio/sfx_ui_select.wav'),
    getPublicAssetUrl('audio/sfx_ui_tower_select.wav'),
    getPublicAssetUrl('audio/sfx_ui_swap.wav'),
    getPublicAssetUrl('audio/sfx_ui_clear.wav'),
    getPublicAssetUrl('audio/sfx_countdown.wav'),
    getPublicAssetUrl('audio/sfx_stinger.mp3'),
    getPublicAssetUrl('audio/sfx_stinger_2.mp3'),
    getPublicAssetUrl('audio/sfx_score.wav'),
    getPublicAssetUrl('audio/G-Atk/punch-1.mp3'),
    getPublicAssetUrl('audio/G-Atk/punch-2.mp3'),
    getPublicAssetUrl('audio/G-Atk/kick.mp3'),
  ]
}

export function warmRaidGeneratedEffectSprites() {
  if (typeof document === 'undefined') return

  for (const size of [58, 76, 96, 124, 156]) {
    getHoneycombShieldSprite(size)
  }
  for (const radius of [8, 10.5, 13.5, 17.5, 22]) {
    for (const burning of [false, true]) {
      for (const frameBucket of [0, 0.25, 0.5, 0.75]) {
        getCoreBlastSprite(radius, burning, frameBucket)
      }
    }
  }
  for (const visualScale of [0.85, 1, 1.18, 1.36]) {
    getHomingMissileSprite(visualScale)
    for (const [color, length, width] of [
      ['rgba(125,249,255,0.86)', 36, 3],
      ['rgba(125,249,255,0.9)', 42, 3.2],
      ['rgba(56,189,248,0.88)', 82, 9],
      ['rgba(56,189,248,0.96)', 112, 14],
      ['rgba(34,211,238,0.9)', 46, 7],
      ['rgba(190,242,100,0.92)', 42, 5],
      ['rgba(251,146,60,0.88)', 36, 3],
      ['rgba(251,146,60,0.9)', 34, 5],
    ] as const) {
      getCachedProjectileTrailSprite(color, length * visualScale, width * visualScale)
    }
    for (const [color, radius] of [
      ['rgba(34,197,94,0.86)', 6],
      ['rgba(251,113,133,0.9)', 10],
      ['rgba(168,85,247,0.92)', 12],
      ['rgba(251,191,36,0.95)', 14],
      ['rgba(192,132,252,0.95)', 15],
      ['rgba(244,114,182,0.78)', 12],
      ['rgba(132,204,22,0.68)', 8],
    ] as const) {
      getCachedProjectileOrbSprite(color, radius * visualScale)
    }
  }
  warmPowerPickupSpriteCache()
}

export async function cacheRaidPersistentUrl(cache: Cache | null, url: string) {
  try {
    const request = new Request(url, { cache: 'force-cache' })
    if (cache && await cache.match(request)) return
    const response = await fetch(request)
    if (cache && response.ok) await cache.put(request, response.clone())
  } catch {
    // Missing optional assets should never block the game boot.
  }
}

export async function cacheRaidPersistentGroup(cacheName: string, urls: string[], onProgress?: () => void) {
  const cache = typeof caches === 'undefined' ? null : await caches.open(cacheName)
  const queue = [...new Set(urls)]
  const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (queue.length > 0) {
      const url = queue.shift()
      if (url) {
        await cacheRaidPersistentUrl(cache, url)
        onProgress?.()
      }
    }
  })
  await Promise.all(workers)
}

export function getRaidPersistentAssetGroups() {
  return [
    { cacheName: RAID_IMAGE_CACHE_NAME, urls: getRaidPersistentImageUrls() },
    { cacheName: RAID_AUDIO_CACHE_NAME, urls: getRaidPersistentAudioUrls() },
  ]
}

export function getRaidPersistentAssetCount() {
  return getRaidPersistentAssetGroups().reduce((total, group) => total + new Set(group.urls).size, 0)
}

export function warmRaidPersistentAssetCache(onProgress?: (loaded: number, total: number) => void) {
  const groups = getRaidPersistentAssetGroups()
  const total = getRaidPersistentAssetCount()

  if (typeof window === 'undefined' || typeof fetch === 'undefined') {
    onProgress?.(total, total)
    return Promise.resolve()
  }

  if (raidPersistentAssetCacheComplete) {
    onProgress?.(total, total)
    return Promise.resolve()
  }

  if (!onProgress && raidPersistentAssetCachePromise) return raidPersistentAssetCachePromise

  let loaded = 0
  onProgress?.(loaded, total)
  const warmPromise = Promise.all(groups.map((group) => cacheRaidPersistentGroup(group.cacheName, group.urls, () => {
    loaded += 1
    onProgress?.(Math.min(loaded, total), total)
  }))).then(() => {
    raidPersistentAssetCacheComplete = true
    try {
      window.localStorage.setItem(RAID_PERSISTENT_CACHE_STORAGE_KEY, RAID_PERSISTENT_CACHE_VERSION)
    } catch {
      // Cache API and HTTP cache are the source of truth; localStorage is just a warm marker.
    }
  }).catch(() => undefined)

  if (!raidPersistentAssetCachePromise) raidPersistentAssetCachePromise = warmPromise
  return warmPromise
}

export function preloadRaidCanvasAssets(onProgress?: (loaded: number, total: number) => void) {
  const entries = warmRaidCanvasAssets()
  const total = entries.length

  if (raidCanvasAssetWarmComplete) {
    onProgress?.(total, total)
    return Promise.resolve()
  }

  if (!onProgress && raidCanvasAssetWarmPromise) return raidCanvasAssetWarmPromise

  let loaded = 0
  onProgress?.(loaded, total)
  const warmPromise = Promise.all(entries.map((entry) => entry.ready.then(() => {
    loaded += 1
    onProgress?.(Math.min(loaded, total), total)
  }))).then(() => {
    if (!raidCanvasAssetWarmComplete) {
      warmRaidCanvasFilterVariants()
      warmRaidGeneratedEffectSprites()
      raidCanvasAssetWarmComplete = true
    }
  })

  if (!raidCanvasAssetWarmPromise) raidCanvasAssetWarmPromise = warmPromise
  return warmPromise
}

export function getRaidPixiBackgroundAssetCount() {
  return Object.keys(RAID_OTHER_ASSET_PATHS).length
}

export function preloadRaidPixiBackgroundAssets(onProgress?: (loaded: number, total: number) => void) {
  const entries = Object.values(RAID_OTHER_ASSET_PATHS)
  const total = entries.length

  if (typeof window === 'undefined') {
    onProgress?.(total, total)
    return Promise.resolve()
  }

  if (raidPixiAssetWarmComplete) {
    onProgress?.(total, total)
    return Promise.resolve()
  }

  if (!onProgress && raidPixiAssetWarmPromise) return raidPixiAssetWarmPromise

  let loaded = 0
  onProgress?.(loaded, total)
  const warmPromise = Promise.all(entries.map(async (path) => {
    try {
      await Assets.load(getPublicAssetUrl(path))
    } catch {
      // Pixi background assets are optional because the canvas fallback can still draw.
    } finally {
      loaded += 1
      onProgress?.(Math.min(loaded, total), total)
    }
  })).then(() => {
    raidPixiAssetWarmComplete = true
  })

  if (!raidPixiAssetWarmPromise) raidPixiAssetWarmPromise = warmPromise
  return warmPromise
}

export function preloadGradiusRaidAssets(onProgress?: (loaded: number, total: number) => void) {
  const canvasTotal = warmRaidCanvasAssets().length
  const persistentTotal = getRaidPersistentAssetCount()
  const pixiTotal = getRaidPixiBackgroundAssetCount()
  const total = Math.max(1, canvasTotal + persistentTotal + pixiTotal)
  let canvasLoaded = raidCanvasAssetWarmComplete ? canvasTotal : 0
  let persistentLoaded = raidPersistentAssetCacheComplete ? persistentTotal : 0
  let pixiLoaded = raidPixiAssetWarmComplete ? pixiTotal : 0
  const report = () => onProgress?.(Math.min(canvasLoaded + persistentLoaded + pixiLoaded, total), total)

  report()
  return Promise.all([
    preloadRaidCanvasAssets((loaded) => {
      canvasLoaded = loaded
      report()
    }),
    warmRaidPersistentAssetCache((loaded) => {
      persistentLoaded = loaded
      report()
    }),
    preloadRaidPixiBackgroundAssets((loaded) => {
      pixiLoaded = loaded
      report()
    }),
  ]).then(() => {
    canvasLoaded = canvasTotal
    persistentLoaded = persistentTotal
    pixiLoaded = pixiTotal
    report()
  })
}

export function getRaidAssetPreloadInitialState(): RaidAssetPreloadState {
  const total = Math.max(1, warmRaidCanvasAssets().length + getRaidPersistentAssetCount() + getRaidPixiBackgroundAssetCount())
  const ready = raidCanvasAssetWarmComplete && raidPersistentAssetCacheComplete && raidPixiAssetWarmComplete
  return { status: ready ? 'ready' : 'idle', loaded: ready ? total : 0, total }
}
