import type { CachedCanvasDrawSource } from './assets'
import { DEFAULT_RAID_PALETTE } from './background'
import type { RaidPalette } from './background'
import { ELITE_ENEMY_STAGE_START, ENEMY_COLLISION_BUCKET_PADDING, ENEMY_COLLISION_BUCKET_SIZE, MAX_RIPPLES, MAX_SPARKS, MINI_BOSS_KINDS, RIPPLE_POOL_LIMIT, SPARK_POOL_LIMIT } from './constants'
import { ENEMY_COLLISION_BUCKET_COUNT } from './constants'
import type { Enemy, MiniBossKind, Ripple, Shot, Spark, Vec } from './types'

export let sparkId = 1

export let rippleId = 1

export const sparkPool: Spark[] = []

export const ripplePool: Ripple[] = []

export const projectileTrailSpriteCache = new Map<string, CachedCanvasDrawSource>()

export const projectileOrbSpriteCache = new Map<string, CachedCanvasDrawSource>()

export function getOffscreenRenderScale(ctx: CanvasRenderingContext2D, size: number) {
  const transformScale = Math.max(1, Math.abs(ctx.getTransform?.().a || 1))
  const dpr = typeof window === 'undefined' ? transformScale : Math.max(transformScale, window.devicePixelRatio || 1)
  const cap = size >= 520 ? 1.35 : size >= 360 ? 1.5 : 1.75
  return Math.max(1, Math.min(cap, dpr))
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function getCanvasCacheScale() {
  if (typeof window === 'undefined') return 2
  return clamp(window.devicePixelRatio || 1, 1, 2.5)
}

export function trimOldestMapEntry<K, V>(map: Map<K, V>, limit: number) {
  if (map.size < limit) return
  const oldestKey = map.keys().next().value
  if (oldestKey !== undefined) map.delete(oldestKey)
}

export function getCachedProjectileTrailSprite(color: string, length: number, widthPx: number): CachedCanvasDrawSource | null {
  if (typeof document === 'undefined') return null
  const normalizedLength = Math.max(1, Math.round(length * 2) / 2)
  const normalizedWidth = Math.max(0.5, Math.round(widthPx * 2) / 2)
  const spriteScale = getCanvasCacheScale()
  const scaledBucket = Math.round(spriteScale * 10) / 10
  const cacheKey = `trail|${color}|${normalizedLength}|${normalizedWidth}|${scaledBucket}`
  const cached = projectileTrailSpriteCache.get(cacheKey)
  if (cached) return cached

  const pad = Math.ceil(normalizedWidth * 2.2)
  const minX = -normalizedLength * 0.5 - pad
  const maxX = normalizedLength * 0.32 + pad
  const width = Math.ceil(maxX - minX)
  const height = Math.ceil(pad * 2)
  const originX = -minX
  const originY = pad
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(width * spriteScale))
  canvas.height = Math.max(1, Math.ceil(height * spriteScale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(spriteScale, spriteScale)
  ctx.lineCap = 'round'
  const headX = originX + normalizedLength * 0.32
  const tailX = originX - normalizedLength * 0.5
  const gradient = ctx.createLinearGradient(headX, originY, tailX, originY)
  gradient.addColorStop(0, 'rgba(255,255,255,0.95)')
  gradient.addColorStop(0.35, color)
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.strokeStyle = gradient
  ctx.lineWidth = normalizedWidth
  ctx.beginPath()
  ctx.moveTo(headX, originY)
  ctx.lineTo(tailX, originY)
  ctx.stroke()

  const entry = { canvas, width, height, originX, originY }
  trimOldestMapEntry(projectileTrailSpriteCache, 160)
  projectileTrailSpriteCache.set(cacheKey, entry)
  return entry
}

export function getCachedProjectileOrbSprite(color: string, radius: number): CachedCanvasDrawSource | null {
  if (typeof document === 'undefined') return null
  const normalizedRadius = Math.max(1, Math.round(radius * 2) / 2)
  const spriteScale = getCanvasCacheScale()
  const scaledBucket = Math.round(spriteScale * 10) / 10
  const cacheKey = `orb|${color}|${normalizedRadius}|${scaledBucket}`
  const cached = projectileOrbSpriteCache.get(cacheKey)
  if (cached) return cached

  const width = Math.ceil(normalizedRadius * 2.25)
  const height = width
  const originX = width / 2
  const originY = height / 2
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(width * spriteScale))
  canvas.height = Math.max(1, Math.ceil(height * spriteScale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(spriteScale, spriteScale)
  const gradient = ctx.createRadialGradient(originX, originY, 1, originX, originY, normalizedRadius)
  gradient.addColorStop(0, 'rgba(255,255,255,0.95)')
  gradient.addColorStop(0.35, color)
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(originX, originY, normalizedRadius, 0, Math.PI * 2)
  ctx.fill()

  const entry = { canvas, width, height, originX, originY }
  trimOldestMapEntry(projectileOrbSpriteCache, 120)
  projectileOrbSpriteCache.set(cacheKey, entry)
  return entry
}

export const speedLineSpriteCache = new Map<string, CachedCanvasDrawSource>()

export function getCachedSpeedLineSprite(color: string, length: number, strokeWidth: number): CachedCanvasDrawSource | null {  if (typeof document === 'undefined') return null
  const spriteScale = getCanvasCacheScale()
  const scaledBucket = Math.round(spriteScale * 10) / 10
  const cacheKey = `speedline|${color}|${Math.round(length)}|${Math.round(strokeWidth * 2) / 2}|${scaledBucket}`
  const cached = speedLineSpriteCache.get(cacheKey)
  if (cached) return cached

  const pad = Math.ceil(strokeWidth * 2)
  const width = Math.ceil(strokeWidth + pad * 2)
  const height = Math.ceil(length + pad * 2)
  const originX = width / 2
  const originY = pad
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(width * spriteScale))
  canvas.height = Math.max(1, Math.ceil(height * spriteScale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(spriteScale, spriteScale)
  const gradient = ctx.createLinearGradient(originX, originY, originX, originY + length)
  gradient.addColorStop(0, 'rgba(255,255,255,0)')
  gradient.addColorStop(0.46, color)
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.strokeStyle = gradient
  ctx.lineWidth = strokeWidth
  ctx.lineCap = 'butt'
  ctx.beginPath()
  ctx.moveTo(originX, originY)
  ctx.lineTo(originX, originY + length)
  ctx.stroke()

  const entry: CachedCanvasDrawSource = { canvas, width, height, originX, originY }
  trimOldestMapEntry(speedLineSpriteCache, 32)
  speedLineSpriteCache.set(cacheKey, entry)
  return entry
}

export const spriteGlowCache = new Map<string, CachedCanvasDrawSource>()

export function getCachedSpriteGlow(color: string, size: number): CachedCanvasDrawSource | null {
  if (typeof document === 'undefined') return null
  const quantizedSize = Math.round(size)
  const cacheKey = `sglow|${color}|${quantizedSize}`
  const cached = spriteGlowCache.get(cacheKey)
  if (cached) return cached

  const radiusX = quantizedSize * 0.58
  const radiusY = quantizedSize * 0.5
  const pad = 2
  const spriteW = Math.ceil(radiusX * 2 + pad * 2)
  const spriteH = Math.ceil(radiusY * 2 + pad * 2)
  const cx = spriteW / 2
  const cy = spriteH / 2
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, spriteW)
  canvas.height = Math.max(1, spriteH)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(radiusX / radiusY, 1)
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radiusY)
  gradient.addColorStop(0, 'rgba(255,255,255,0.08)')
  gradient.addColorStop(0.34, color)
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(0, 0, radiusY, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  const entry: CachedCanvasDrawSource = { canvas, width: spriteW, height: spriteH, originX: cx, originY: cy }
  trimOldestMapEntry(spriteGlowCache, 48)
  spriteGlowCache.set(cacheKey, entry)
  return entry
}

export function compactInPlace<T>(items: T[], keep: (item: T) => boolean) {
  let liveCount = 0
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    if (!keep(item)) continue
    items[liveCount] = item
    liveCount += 1
  }
  items.length = liveCount
  return items
}

export type EnemyCollisionBuckets = Enemy[][]

export function createEnemyCollisionBuckets(): EnemyCollisionBuckets {
  return Array.from({ length: ENEMY_COLLISION_BUCKET_COUNT }, () => [])
}

export function getEnemyCollisionBucketIndex(y: number) {
  return clamp(Math.floor((y + ENEMY_COLLISION_BUCKET_PADDING) / ENEMY_COLLISION_BUCKET_SIZE), 0, ENEMY_COLLISION_BUCKET_COUNT - 1)
}

export function resetEnemyCollisionBuckets(buckets: EnemyCollisionBuckets) {
  for (let index = 0; index < buckets.length; index += 1) buckets[index].length = 0
}

export function buildEnemyCollisionBuckets(enemies: Enemy[], buckets: EnemyCollisionBuckets, largeEnemies: Enemy[]) {
  resetEnemyCollisionBuckets(buckets)
  largeEnemies.length = 0
  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue
    if (enemy.isBoss || enemy.isMiniBoss || enemy.radius > 8) {
      largeEnemies.push(enemy)
      continue
    }
    const startBucket = getEnemyCollisionBucketIndex(enemy.y - enemy.radius)
    const endBucket = getEnemyCollisionBucketIndex(enemy.y + enemy.radius)
    for (let bucket = startBucket; bucket <= endBucket; bucket += 1) buckets[bucket].push(enemy)
  }
}

export function collectShotCollisionCandidates(shot: Shot, buckets: EnemyCollisionBuckets, largeEnemies: Enemy[], candidates: Enemy[]) {
  candidates.length = 0
  for (const enemy of largeEnemies) candidates.push(enemy)
  const startBucket = getEnemyCollisionBucketIndex(shot.y - shot.radius)
  const endBucket = getEnemyCollisionBucketIndex(shot.y + shot.radius)
  for (let bucket = startBucket; bucket <= endBucket; bucket += 1) {
    const bucketEnemies = buckets[bucket]
    for (const enemy of bucketEnemies) candidates.push(enemy)
  }
  return candidates
}

export function getMaxActiveEliteEnemies(stage: number, isMultiplayer: boolean) {
  return Math.round(clamp(1 + Math.floor(Math.max(0, stage - ELITE_ENEMY_STAGE_START) / 7) + (isMultiplayer ? 1 : 0), 1, isMultiplayer ? 3 : 2))
}

export function getEliteEnemyChance(stage: number, wave: number, trainSlot: number, hasFormationStyle: boolean) {
  if (stage < ELITE_ENEMY_STAGE_START) return 0
  const formationPenalty = hasFormationStyle ? 0.34 : 1
  const slotPenalty = trainSlot > 0 ? 0.52 : 1
  return clamp((0.038 + stage * 0.0035 + wave * 0.0015) * formationPenalty * slotPenalty, 0.02, 0.11)
}

export function pickEliteEnemyKind(stage: number, wave: number, trainSlot: number): MiniBossKind {
  return MINI_BOSS_KINDS[(stage + wave + trainSlot + Math.floor(Math.random() * MINI_BOSS_KINDS.length)) % MINI_BOSS_KINDS.length]
}

export function seededNoise(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453123
  return value - Math.floor(value)
}

export function getCssVar(root: HTMLElement, name: string, fallback: string) {
  return getComputedStyle(root).getPropertyValue(name).trim() || fallback
}

export function readRaidPalette(root: HTMLElement): RaidPalette {
  return {
    baseTop: getCssVar(root, '--raid-base-top', DEFAULT_RAID_PALETTE.baseTop),
    baseMid: getCssVar(root, '--raid-base-mid', DEFAULT_RAID_PALETTE.baseMid),
    baseBottom: getCssVar(root, '--raid-base-bottom', DEFAULT_RAID_PALETTE.baseBottom),
    surfaceMode: getCssVar(root, '--raid-surface-mode', DEFAULT_RAID_PALETTE.surfaceMode),
    surfaceA: getCssVar(root, '--raid-surface-a', DEFAULT_RAID_PALETTE.surfaceA),
    surfaceB: getCssVar(root, '--raid-surface-b', DEFAULT_RAID_PALETTE.surfaceB),
    surfaceC: getCssVar(root, '--raid-surface-c', DEFAULT_RAID_PALETTE.surfaceC),
    bgA: getCssVar(root, '--raid-bg-a', DEFAULT_RAID_PALETTE.bgA),
    bgB: getCssVar(root, '--raid-bg-b', DEFAULT_RAID_PALETTE.bgB),
    nebulaA: getCssVar(root, '--raid-nebula-a', DEFAULT_RAID_PALETTE.nebulaA),
    nebulaB: getCssVar(root, '--raid-nebula-b', DEFAULT_RAID_PALETTE.nebulaB),
    starTint: getCssVar(root, '--raid-star-tint', DEFAULT_RAID_PALETTE.starTint),
    streak: getCssVar(root, '--raid-streak', DEFAULT_RAID_PALETTE.streak),
    planetA: getCssVar(root, '--raid-planet-a', DEFAULT_RAID_PALETTE.planetA),
    planetB: getCssVar(root, '--raid-planet-b', DEFAULT_RAID_PALETTE.planetB),
    planetC: getCssVar(root, '--raid-planet-c', DEFAULT_RAID_PALETTE.planetC),
  }
}

export function recycleSpark(spark: Spark) {
  if (sparkPool.length < SPARK_POOL_LIMIT) sparkPool.push(spark)
}

export function recycleSparkList(sparks: Spark[]) {
  for (const spark of sparks) recycleSpark(spark)
  sparks.length = 0
}

export function acquireSpark(x: number, y: number, vx: number, vy: number, life: number, color: string, size: number): Spark {
  const spark = sparkPool.pop()
  if (spark) {
    spark.id = sparkId++
    spark.x = x
    spark.y = y
    spark.vx = vx
    spark.vy = vy
    spark.life = life
    spark.maxLife = 0.9
    spark.color = color
    spark.size = size
    return spark
  }
  return { id: sparkId++, x, y, vx, vy, life, maxLife: 0.9, color, size }
}

export function recycleRipple(ripple: Ripple) {
  if (ripplePool.length < RIPPLE_POOL_LIMIT) ripplePool.push(ripple)
}

export function recycleRippleList(ripples: Ripple[]) {
  for (const ripple of ripples) recycleRipple(ripple)
  ripples.length = 0
}

export function acquireRipple(x: number, y: number, color: string, size: number, life: number): Ripple {
  const ripple = ripplePool.pop()
  if (ripple) {
    ripple.id = rippleId++
    ripple.x = x
    ripple.y = y
    ripple.color = color
    ripple.size = size
    ripple.life = life
    ripple.maxLife = life
    return ripple
  }
  return { id: rippleId++, x, y, color, size, life, maxLife: life }
}

export function updateSparksInPlace(sparks: Spark[], dt: number) {
  const start = Math.max(0, sparks.length - MAX_SPARKS)
  for (let index = 0; index < start; index += 1) recycleSpark(sparks[index])
  let write = 0
  for (let index = start; index < sparks.length; index += 1) {
    const spark = sparks[index]
    spark.x += spark.vx * dt
    spark.y += spark.vy * dt
    spark.life -= dt
    if (spark.life > 0) {
      sparks[write] = spark
      write += 1
    } else {
      recycleSpark(spark)
    }
  }
  sparks.length = write
}

export function updateRipplesInPlace(ripples: Ripple[], dt: number) {
  const start = Math.max(0, ripples.length - MAX_RIPPLES)
  for (let index = 0; index < start; index += 1) recycleRipple(ripples[index])
  let write = 0
  for (let index = start; index < ripples.length; index += 1) {
    const ripple = ripples[index]
    ripple.life -= dt
    if (ripple.life > 0) {
      ripples[write] = ripple
      write += 1
    } else {
      recycleRipple(ripple)
    }
  }
  ripples.length = write
}

export function traceRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export function drawRadialEllipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  stops: ReadonlyArray<readonly [number, string]>,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(radiusX / radiusY, 1)
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radiusY)
  for (const [offset, color] of stops) gradient.addColorStop(offset, color)
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(0, 0, radiusY, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function drawRadialEllipse2Stop(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  startColor: string,
  endColor: string,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(radiusX / radiusY, 1)
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radiusY)
  gradient.addColorStop(0, startColor)
  gradient.addColorStop(1, endColor)
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(0, 0, radiusY, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function distSq(a: Vec, b: Vec) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

export function takeLastFilteredMapped<T, U>(
  source: readonly T[],
  limit: number,
  predicate: (item: T) => boolean,
  mapper: (item: T) => U,
): U[] {
  const out: U[] = []
  for (let i = source.length - 1; i >= 0 && out.length < limit; i -= 1) {
    const item = source[i]
    if (predicate(item)) out.push(mapper(item))
  }
  out.reverse()
  return out
}
