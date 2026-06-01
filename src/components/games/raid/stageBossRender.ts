import { drawCanvasSpriteContain, drawSpriteGlow, getEliteAlienCanvasSprite, getFinalBossCanvasSprite, RAID_FINAL_BOSS_CORE_OFFSET_X, RAID_FINAL_BOSS_CORE_OFFSET_Y } from './assets'
import type { BossKind, BriefingBossKind, Enemy, MirageBossKind } from './types'
import { clamp, drawRadialEllipse, getOffscreenRenderScale, trimOldestMapEntry } from './utils'
import { drawGalacticSnakeBoss } from './snakeBossRender'
import { drawBossDust, drawGalacticSquidBoss } from './squidBossRender'

export type StageBossRenderCacheEntry = {
  canvas: HTMLCanvasElement
  frameBucket: number
}

export const stageBossRenderCache = new Map<string, StageBossRenderCacheEntry>()

export const STAGE_BOSS_RENDER_CACHE_LIMIT = 10

export const STAGE_BOSS_RENDER_FRAME_MS = 50

export const STAGE_BOSS_RENDER_SIZE_CAP = 680

export function drawFinalBossSpriteBody(ctx: CanvasRenderingContext2D, size: number, time: number, rage = 0) {
  const sprite = getFinalBossCanvasSprite()
  if (!sprite.loaded || !sprite.image.complete) {
    return
  }

  const seconds = time / 1000
  const coreRage = clamp(rage, 0, 1)
  const pulse = 0.78 + Math.sin(seconds * (2.8 + coreRage * 1.1)) * 0.16
  const slowPulse = 0.7 + Math.sin(seconds * 1.2) * 0.16
  const spriteSize = size * 1.08
  const spin = seconds * (0.055 + coreRage * 0.018)
  const coreLocalX = size * RAID_FINAL_BOSS_CORE_OFFSET_X
  const coreLocalY = size * RAID_FINAL_BOSS_CORE_OFFSET_Y
  const coreX = coreLocalX * Math.cos(spin) - coreLocalY * Math.sin(spin)
  const coreY = coreLocalX * Math.sin(spin) + coreLocalY * Math.cos(spin)
  const coreColor = coreRage > 0.08 ? '#f87171' : '#38bdf8'
  const coreGlow = coreRage > 0.08 ? 'rgba(248,113,113,ALPHA)' : 'rgba(56,189,248,ALPHA)'

  ctx.save()
  drawRadialEllipse(ctx, 0, 0, size * (0.48 + coreRage * 0.035), size * (0.5 + coreRage * 0.035), [
    [0, `rgba(255,255,255,${0.035 + pulse * 0.025})`],
    [0.42, coreRage > 0.08 ? 'rgba(248,113,113,0.15)' : 'rgba(56,189,248,0.11)'],
    [0.72, 'rgba(251,191,36,0.055)'],
    [1, 'rgba(0,0,0,0)'],
  ])
  drawBossDust(ctx, size, coreGlow, 10, 13.4, 0.5, 0.5)

  drawSpriteGlow(ctx, 0, 0, spriteSize, coreRage > 0.08 ? 'rgba(248,113,113,0.34)' : 'rgba(56,189,248,0.28)', 1)
  ctx.shadowColor = coreRage > 0.08 ? 'rgba(248,113,113,0.62)' : 'rgba(56,189,248,0.58)'
  ctx.shadowBlur = size * (0.055 + coreRage * 0.025)
  drawCanvasSpriteContain(ctx, sprite, 0, 0, spriteSize, 'brightness(1.12) contrast(1.14) saturate(1.22)', 1, spin, 1, coreColor)
  ctx.shadowBlur = 0

  ctx.globalCompositeOperation = 'lighter'
  drawRadialEllipse(ctx, coreX, coreY, size * (0.078 + coreRage * 0.026), size * (0.078 + coreRage * 0.026), [
    [0, `rgba(255,255,255,${0.72 + pulse * 0.18})`],
    [0.22, coreRage > 0.08 ? `rgba(248,113,113,${0.62 + pulse * 0.2})` : `rgba(56,189,248,${0.6 + pulse * 0.18})`],
    [0.64, coreRage > 0.08 ? `rgba(185,28,28,${0.28 + pulse * 0.2})` : `rgba(14,165,233,${0.25 + pulse * 0.18})`],
    [1, coreRage > 0.08 ? 'rgba(127,29,29,0)' : 'rgba(14,165,233,0)'],
  ])
  ctx.strokeStyle = coreRage > 0.08 ? `rgba(252,165,165,${0.36 + pulse * 0.28})` : `rgba(125,249,255,${0.34 + pulse * 0.26})`
  ctx.lineWidth = Math.max(1.4, size * 0.005)
  for (let ring = 0; ring < 4; ring += 1) {
    ctx.beginPath()
    ctx.ellipse(coreX, coreY, size * (0.072 + ring * 0.032), size * (0.026 + ring * 0.013), seconds * (0.25 + ring * 0.05), 0, Math.PI * 2)
    ctx.stroke()
  }

  const orbitalSprite = getEliteAlienCanvasSprite(4)
  for (let drone = 0; drone < 10; drone += 1) {
    const angle = drone / 10 * Math.PI * 2 + seconds * 0.28
    const dx = Math.cos(angle) * size * (0.62 + Math.sin(drone) * 0.035)
    const dy = size * 0.02 + Math.sin(angle) * size * 0.46
    ctx.save()
    ctx.translate(dx, dy)
    ctx.rotate(angle + Math.PI / 2)
    if (orbitalSprite.loaded && orbitalSprite.image.complete) {
      ctx.globalCompositeOperation = 'source-over'
      ctx.shadowColor = coreRage > 0.08 ? 'rgba(248,113,113,0.54)' : 'rgba(56,189,248,0.5)'
      ctx.shadowBlur = size * 0.018
      drawCanvasSpriteContain(
        ctx,
        orbitalSprite,
        0,
        0,
        size * 0.082,
        coreRage > 0.08 ? 'brightness(1.16) contrast(1.2) saturate(1.35)' : 'brightness(1.12) contrast(1.18) saturate(1.2)',
        0.88 + slowPulse * 0.08,
        0,
        1,
        coreColor,
      )
      ctx.shadowBlur = 0
    } else {
      ctx.fillStyle = `rgba(14,165,233,${0.28 + slowPulse * 0.1})`
      ctx.strokeStyle = coreRage > 0.08 ? 'rgba(252,165,165,0.76)' : 'rgba(125,249,255,0.78)'
      ctx.lineWidth = Math.max(0.8, size * 0.003)
      ctx.beginPath()
      ctx.ellipse(0, 0, size * 0.04, size * 0.01, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
    ctx.restore()
  }

  ctx.restore()
}

export type CachedStageBossKind = Extract<BossKind, 'squid' | 'snake' | 'final'>

export function drawStageBossBodyDirect(
  ctx: CanvasRenderingContext2D,
  kind: CachedStageBossKind,
  size: number,
  time: number,
  redEyeWarning = false,
  hideHead = false,
  rage = 0,
) {
  if (kind === 'squid') drawGalacticSquidBoss(ctx, size, time)
  else if (kind === 'snake') drawGalacticSnakeBoss(ctx, size, time, redEyeWarning, hideHead)
  else drawFinalBossSpriteBody(ctx, size, time, rage)
}

export function drawCachedStageBossBody(
  ctx: CanvasRenderingContext2D,
  kind: CachedStageBossKind,
  size: number,
  time: number,
  redEyeWarning = false,
  hideHead = false,
  rage = 0,
) {
  if (typeof document === 'undefined' || size <= 0) {
    drawStageBossBodyDirect(ctx, kind, size, time, redEyeWarning, hideHead, rage)
    return
  }

  const renderScale = getOffscreenRenderScale(ctx, size)
  const renderSize = Math.max(180, Math.min(STAGE_BOSS_RENDER_SIZE_CAP, Math.ceil(size / 8) * 8))
  const frameBucket = Math.floor(time / STAGE_BOSS_RENDER_FRAME_MS)
  const rageBucket = kind === 'final' ? Math.round(clamp(rage, 0, 1) * 14) : 0
  const scaleBucket = Math.round(renderScale * 100)
  const cacheKey = `${kind}:${renderSize}:${scaleBucket}:${redEyeWarning ? 1 : 0}:${hideHead ? 1 : 0}:${rageBucket}`
  let entry = stageBossRenderCache.get(cacheKey)
  if (!entry) {
    const canvasSize = Math.ceil(renderSize * 2.55)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.ceil(canvasSize * renderScale))
    canvas.height = Math.max(1, Math.ceil(canvasSize * renderScale))
    entry = { canvas, frameBucket: Number.NaN }
    trimOldestMapEntry(stageBossRenderCache, STAGE_BOSS_RENDER_CACHE_LIMIT)
    stageBossRenderCache.set(cacheKey, entry)
  }

  if (entry.frameBucket !== frameBucket) {
    const { canvas } = entry
    const cachedCtx = canvas.getContext('2d')
    if (!cachedCtx) {
      drawStageBossBodyDirect(ctx, kind, size, time, redEyeWarning, hideHead, rage)
      return
    }
    cachedCtx.setTransform(1, 0, 0, 1, 0, 0)
    cachedCtx.clearRect(0, 0, canvas.width, canvas.height)
    cachedCtx.imageSmoothingEnabled = true
    cachedCtx.imageSmoothingQuality = 'high'
    cachedCtx.setTransform(renderScale, 0, 0, renderScale, canvas.width * 0.5, canvas.height * 0.5)
    drawStageBossBodyDirect(cachedCtx, kind, renderSize, frameBucket * STAGE_BOSS_RENDER_FRAME_MS, redEyeWarning, hideHead, rageBucket / 14)
    entry.frameBucket = frameBucket
  }

  const { canvas } = entry
  const drawScale = size / renderSize
  const drawWidth = (canvas.width / renderScale) * drawScale
  const drawHeight = (canvas.height / renderScale) * drawScale
  ctx.drawImage(canvas, -drawWidth * 0.5, -drawHeight * 0.5, drawWidth, drawHeight)
}

export function hexToRgba(hex: string, alpha: number) {
  const clean = hex.startsWith('#') ? hex.slice(1) : hex
  if (clean.length !== 6) return `rgba(244,114,182,${alpha})`
  const value = Number.parseInt(clean, 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return `rgba(${r},${g},${b},${alpha})`
}

export function easeOutCubic(value: number) {
  const t = clamp(value, 0, 1)
  return 1 - Math.pow(1 - t, 3)
}

export function getStageBossIntroProgress(enemy: Enemy, kind: BossKind | MirageBossKind | null) {
  if (kind !== 'squid' && kind !== 'snake' && kind !== 'final') return 1
  const startY = kind === 'final' ? -30 : -27
  const targetY = kind === 'final' ? 17 : kind === 'snake' ? 19 : 18
  return easeOutCubic((enemy.y - startY) / (targetY - startY))
}

export function drawStageBossIntroEffect(ctx: CanvasRenderingContext2D, size: number, time: number, kind: BriefingBossKind, progress: number) {
  const reveal = 1 - clamp(progress, 0, 1)
  if (reveal <= 0.02) return

  const seconds = time / 1000
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = clamp(reveal * 1.15, 0, 1)
  if (kind === 'squid') {
    ctx.strokeStyle = 'rgba(244,114,182,0.52)'
    ctx.lineWidth = Math.max(1.2, size * 0.005)
    for (const side of [-1, 1]) {
      for (let limb = 0; limb < 4; limb += 1) {
        const spread = side * size * (0.1 + limb * 0.055)
        const lift = size * (0.32 + limb * 0.04) * (0.35 + progress * 0.65)
        ctx.beginPath()
        ctx.moveTo(side * size * 0.04, size * 0.1)
        ctx.bezierCurveTo(spread * 0.45, size * (0.15 + limb * 0.025), spread * 0.82, lift * 0.58, spread, lift)
        ctx.stroke()
      }
    }
    drawRadialEllipse(ctx, 0, size * 0.12, size * (0.5 + reveal * 0.18), size * (0.18 + reveal * 0.08), [
      [0, 'rgba(255,255,255,0.22)'],
      [0.38, 'rgba(217,70,239,0.18)'],
      [1, 'rgba(217,70,239,0)'],
    ])
  } else if (kind === 'snake') {
    ctx.strokeStyle = 'rgba(251,113,133,0.48)'
    ctx.lineWidth = Math.max(1.4, size * 0.006)
    for (let coil = 0; coil < 5; coil += 1) {
      ctx.beginPath()
      ctx.ellipse(
        Math.sin(seconds * 2 + coil) * size * 0.025,
        size * (0.24 - coil * 0.075),
        size * (0.26 - coil * 0.02) * (0.45 + progress * 0.55),
        size * (0.06 + coil * 0.006),
        seconds * 0.35 + coil * 0.48,
        0,
        Math.PI * 2,
      )
      ctx.stroke()
    }
    drawRadialEllipse(ctx, 0, -size * 0.16, size * (0.22 + reveal * 0.16), size * (0.1 + reveal * 0.08), [
      [0, 'rgba(255,255,255,0.28)'],
      [0.42, 'rgba(225,29,72,0.22)'],
      [1, 'rgba(225,29,72,0)'],
    ])
  } else {
    const orbitalSprite = getEliteAlienCanvasSprite(4)
    ctx.strokeStyle = 'rgba(56,189,248,0.38)'
    ctx.lineWidth = Math.max(1.2, size * 0.0045)
    for (let ring = 0; ring < 3; ring += 1) {
      ctx.beginPath()
      ctx.ellipse(0, 0, size * (0.34 + ring * 0.12) * (1 + reveal * 0.42), size * (0.22 + ring * 0.08) * (1 + reveal * 0.38), seconds * (0.2 + ring * 0.09), 0, Math.PI * 2)
      ctx.stroke()
    }
    for (let node = 0; node < 8; node += 1) {
      const angle = node / 8 * Math.PI * 2 + seconds * 0.42
      const radius = size * (0.42 + reveal * 0.28)
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius * 0.68
      drawCanvasSpriteContain(ctx, orbitalSprite, x, y, size * 0.06, 'brightness(1.14) contrast(1.18) saturate(1.25)', 0.72, angle + Math.PI / 2, 1, '#38bdf8')
    }
  }
  ctx.restore()
}

export function drawEnemyHitFlash(ctx: CanvasRenderingContext2D, size: number, flash = 0, color = '#fca5a5') {
  const strength = clamp(flash / 0.18, 0, 1)
  if (strength <= 0.02) return

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = strength * 0.42
  ctx.strokeStyle = hexToRgba(color, 0.34)
  ctx.lineWidth = Math.max(0.8, size * 0.0022)
  const slash = size * 0.09
  ctx.beginPath()
  ctx.moveTo(-slash, -slash * 0.22)
  ctx.lineTo(slash, slash * 0.22)
  ctx.moveTo(-slash * 0.26, slash)
  ctx.lineTo(slash * 0.26, -slash)
  ctx.stroke()
  ctx.restore()
}
