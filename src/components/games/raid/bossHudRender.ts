import type { Enemy } from './types'
import { clamp, drawRadialEllipse, getOffscreenRenderScale, traceRoundedRect, trimOldestMapEntry } from './utils'
import { hexToRgba } from './stageBossRender'
import type { StageBossRenderCacheEntry } from './stageBossRender'

export const bossAuraSpriteCache = new Map<string, StageBossRenderCacheEntry>()

export const BOSS_AURA_CACHE_LIMIT = 12

export const BOSS_AURA_FRAME_MS = 33

export const bossReticleSpriteCache = new Map<string, StageBossRenderCacheEntry>()

export const BOSS_RETICLE_CACHE_LIMIT = 8

export const BOSS_RETICLE_FRAME_MS = 66

export const bossBarSpriteCache = new Map<string, HTMLCanvasElement>()

export const BOSS_BAR_CACHE_LIMIT = 40

export function drawBossAura(ctx: CanvasRenderingContext2D, enemy: Enemy, x: number, y: number, size: number, time: number) {
  const seconds = time / 1000
  const kind = enemy.bossKind ?? 'carrier'
  ctx.save()
  ctx.translate(x, y)
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = 0.9
  drawRadialEllipse(ctx, 0, 0, size * 0.72, size * 0.72, [
    [0, 'rgba(239,35,60,0.22)'],
    [0.52, 'rgba(239,35,60,0.08)'],
    [1, 'rgba(0,0,0,0)'],
  ])

  ctx.strokeStyle = 'rgba(239,35,60,0.3)'
  ctx.lineWidth = Math.max(1, size * 0.01)
  ctx.shadowBlur = size * 0.08
  ctx.shadowColor = 'rgba(239,35,60,0.42)'

  if (kind === 'carrier') {
    ctx.fillStyle = 'rgba(127,29,29,0.34)'
    ctx.beginPath()
    ctx.moveTo(-size * 0.58, 0)
    ctx.lineTo(-size * 0.14, -size * 0.16)
    ctx.lineTo(-size * 0.24, size * 0.16)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(size * 0.58, 0)
    ctx.lineTo(size * 0.14, -size * 0.16)
    ctx.lineTo(size * 0.24, size * 0.16)
    ctx.closePath()
    ctx.fill()
    drawRadialEllipse(ctx, 0, size * 0.42, size * 0.28, size * 0.08, [[0, 'rgba(239,35,60,0.28)'], [1, 'rgba(0,0,0,0)']])
  } else if (kind === 'orb') {
    for (let i = 0; i < 3; i += 1) {
      ctx.save()
      ctx.rotate(seconds * (i % 2 === 0 ? 0.9 : -0.65) + i * 0.8)
      ctx.strokeStyle = i === 2 ? 'rgba(216,180,254,0.42)' : 'rgba(239,35,60,0.42)'
      ctx.beginPath()
      ctx.ellipse(0, 0, size * (0.3 + i * 0.1), size * (0.22 + i * 0.07), 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
  } else if (kind === 'serpent' || kind === 'mantis') {
    ctx.fillStyle = kind === 'mantis' ? 'rgba(54,83,20,0.38)' : 'rgba(22,78,99,0.38)'
    ctx.strokeStyle = kind === 'mantis' ? 'rgba(190,242,100,0.42)' : 'rgba(103,232,249,0.38)'
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(side * size * 0.42, -size * 0.32)
      ctx.lineTo(side * size * 0.66, 0)
      ctx.lineTo(side * size * 0.42, size * 0.34)
      ctx.lineTo(side * size * 0.26, size * 0.08)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
  } else if (kind === 'hydra') {
    for (const offset of [-0.28, 0, 0.28]) {
      ctx.strokeStyle = 'rgba(168,85,247,0.44)'
      drawRadialEllipse(ctx, size * offset, 0, size * 0.14, size * 0.42, [[0, 'rgba(76,29,149,0.24)'], [1, 'rgba(0,0,0,0)']])
      ctx.beginPath()
      ctx.ellipse(size * offset, 0, size * 0.14, size * 0.42, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
  } else if (kind === 'gate') {
    ctx.save()
    ctx.rotate(Math.PI / 4)
    ctx.strokeStyle = 'rgba(248,113,113,0.46)'
    traceRoundedRect(ctx, -size * 0.42, -size * 0.42, size * 0.84, size * 0.84, size * 0.06)
    ctx.stroke()
    ctx.restore()
  } else {
    const ringCount = kind === 'final' ? 3 : 2
    for (let i = 0; i < ringCount; i += 1) {
      ctx.save()
      ctx.rotate(seconds * (i % 2 ? -0.8 : 0.55) + i * 0.65)
      ctx.strokeStyle = i === 0 ? 'rgba(251,191,36,0.44)' : 'rgba(168,85,247,0.36)'
      traceRoundedRect(ctx, -size * (0.45 + i * 0.06), -size * (0.45 + i * 0.06), size * (0.9 + i * 0.12), size * (0.9 + i * 0.12), kind === 'final' ? size * 0.12 : size * 0.04)
      ctx.stroke()
      ctx.restore()
    }
  }
  ctx.restore()
}

export function drawCachedBossAura(ctx: CanvasRenderingContext2D, enemy: Enemy, x: number, y: number, size: number, time: number) {
  const kind = enemy.bossKind ?? 'carrier'
  if (typeof document === 'undefined' || size <= 0 || (kind !== 'squid' && kind !== 'snake' && kind !== 'final')) {
    drawBossAura(ctx, enemy, x, y, size, time)
    return
  }
  const renderScale = getOffscreenRenderScale(ctx, size)
  const sizeBucket = Math.max(60, Math.min(560, Math.round(size / 8) * 8))
  const frameBucket = Math.floor(time / BOSS_AURA_FRAME_MS)
  const scaleBucket = Math.round(renderScale * 100)
  const key = `aura:${kind}:${sizeBucket}:${scaleBucket}:${frameBucket}`
  let entry = bossAuraSpriteCache.get(key)
  if (!entry) {
    const canvasSize = Math.ceil(sizeBucket * 2.8)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.ceil(canvasSize * renderScale))
    canvas.height = Math.max(1, Math.ceil(canvasSize * renderScale))
    entry = { canvas, frameBucket: Number.NaN }
    trimOldestMapEntry(bossAuraSpriteCache, BOSS_AURA_CACHE_LIMIT)
    bossAuraSpriteCache.set(key, entry)
  }
  if (entry.frameBucket !== frameBucket) {
    const { canvas } = entry
    const cCtx = canvas.getContext('2d')
    if (!cCtx) { drawBossAura(ctx, enemy, x, y, size, time); return }
    const bucketTime = frameBucket * BOSS_AURA_FRAME_MS
    const seconds = bucketTime / 1000
    cCtx.setTransform(1, 0, 0, 1, 0, 0)
    cCtx.clearRect(0, 0, canvas.width, canvas.height)
    cCtx.setTransform(renderScale, 0, 0, renderScale, canvas.width / 2, canvas.height / 2)
    cCtx.globalCompositeOperation = 'lighter'
    cCtx.globalAlpha = 0.9
    drawRadialEllipse(cCtx, 0, 0, sizeBucket * 0.72, sizeBucket * 0.72, [
      [0, 'rgba(239,35,60,0.22)'],
      [0.52, 'rgba(239,35,60,0.08)'],
      [1, 'rgba(0,0,0,0)'],
    ])
    cCtx.strokeStyle = 'rgba(239,35,60,0.3)'
    cCtx.lineWidth = Math.max(1, sizeBucket * 0.01)
    cCtx.shadowBlur = sizeBucket * 0.08
    cCtx.shadowColor = 'rgba(239,35,60,0.42)'
    const ringCount = kind === 'final' ? 3 : 2
    for (let i = 0; i < ringCount; i += 1) {
      cCtx.save()
      cCtx.rotate(seconds * (i % 2 ? -0.8 : 0.55) + i * 0.65)
      cCtx.strokeStyle = i === 0 ? 'rgba(251,191,36,0.44)' : 'rgba(168,85,247,0.36)'
      traceRoundedRect(cCtx, -sizeBucket * (0.45 + i * 0.06), -sizeBucket * (0.45 + i * 0.06), sizeBucket * (0.9 + i * 0.12), sizeBucket * (0.9 + i * 0.12), kind === 'final' ? sizeBucket * 0.12 : sizeBucket * 0.04)
      cCtx.stroke()
      cCtx.restore()
    }
    cCtx.shadowBlur = 0
    entry.frameBucket = frameBucket
  }
  const { canvas } = entry
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = 0.9
  ctx.drawImage(canvas, x - canvas.width / renderScale / 2, y - canvas.height / renderScale / 2, canvas.width / renderScale, canvas.height / renderScale)
  ctx.restore()
}

export function drawBossReticle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, time: number, isFinal: boolean) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(time / 2400)
  ctx.globalAlpha = isFinal ? 0.56 : 0.44
  ctx.strokeStyle = 'rgba(251,191,36,0.72)'
  ctx.shadowBlur = 10
  ctx.shadowColor = 'rgba(251,191,36,0.5)'
  ctx.lineWidth = Math.max(1.5, size * 0.012)
  const extent = size * (isFinal ? 0.74 : 0.64)
  const corner = Math.min(22, size * 0.12)
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(sx * extent, sy * (extent - corner))
      ctx.lineTo(sx * extent, sy * extent)
      ctx.lineTo(sx * (extent - corner), sy * extent)
      ctx.stroke()
    }
  }
  ctx.restore()
}

export function drawCachedBossReticle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, time: number, isFinal: boolean) {
  if (typeof document === 'undefined' || size <= 0) {
    drawBossReticle(ctx, x, y, size, time, isFinal)
    return
  }
  const renderScale = getOffscreenRenderScale(ctx, size)
  const sizeBucket = Math.max(40, Math.min(560, Math.round(size / 8) * 8))
  const rotBucket = Math.floor(time / BOSS_RETICLE_FRAME_MS)
  const scaleBucket = Math.round(renderScale * 100)
  const key = `reticle:${isFinal ? 1 : 0}:${sizeBucket}:${scaleBucket}:${rotBucket}`
  let entry = bossReticleSpriteCache.get(key)
  if (!entry) {
    const extent = sizeBucket * (isFinal ? 0.74 : 0.64)
    const canvasSize = Math.ceil(extent * 2 + 40)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.ceil(canvasSize * renderScale))
    canvas.height = Math.max(1, Math.ceil(canvasSize * renderScale))
    entry = { canvas, frameBucket: Number.NaN }
    trimOldestMapEntry(bossReticleSpriteCache, BOSS_RETICLE_CACHE_LIMIT)
    bossReticleSpriteCache.set(key, entry)
  }
  if (entry.frameBucket !== rotBucket) {
    const { canvas } = entry
    const cCtx = canvas.getContext('2d')
    if (!cCtx) { drawBossReticle(ctx, x, y, size, time, isFinal); return }
    cCtx.setTransform(1, 0, 0, 1, 0, 0)
    cCtx.clearRect(0, 0, canvas.width, canvas.height)
    cCtx.setTransform(renderScale, 0, 0, renderScale, canvas.width / 2, canvas.height / 2)
    cCtx.rotate((rotBucket * BOSS_RETICLE_FRAME_MS) / 2400)
    cCtx.globalAlpha = isFinal ? 0.56 : 0.44
    cCtx.strokeStyle = 'rgba(251,191,36,0.72)'
    cCtx.shadowBlur = 10
    cCtx.shadowColor = 'rgba(251,191,36,0.5)'
    cCtx.lineWidth = Math.max(1.5, sizeBucket * 0.012)
    const extent = sizeBucket * (isFinal ? 0.74 : 0.64)
    const corner = Math.min(22, sizeBucket * 0.12)
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        cCtx.beginPath()
        cCtx.moveTo(sx * extent, sy * (extent - corner))
        cCtx.lineTo(sx * extent, sy * extent)
        cCtx.lineTo(sx * (extent - corner), sy * extent)
        cCtx.stroke()
      }
    }
    cCtx.shadowBlur = 0
    entry.frameBucket = rotBucket
  }
  const { canvas } = entry
  ctx.drawImage(canvas, x - canvas.width / renderScale / 2, y - canvas.height / renderScale / 2, canvas.width / renderScale, canvas.height / renderScale)
}

export function drawBossShield(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, time: number, color = '#38bdf8') {
  const pulse = 0.94 + Math.sin(time / 430) * 0.06
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(pulse, pulse)
  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = hexToRgba(color, 0.52)
  ctx.fillStyle = hexToRgba(color, 0.04)
  ctx.shadowBlur = 18
  ctx.shadowColor = hexToRgba(color, 0.34)
  ctx.lineWidth = Math.max(2, size * 0.012)
  ctx.beginPath()
  ctx.arc(0, 0, size * 0.56, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

export function drawBossBarSkull(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, accent: string, finalBoss = false) {
  ctx.save()
  ctx.translate(x, y)
  ctx.globalCompositeOperation = 'source-over'
  ctx.shadowBlur = finalBoss ? 14 : 9
  ctx.shadowColor = accent
  const skull = ctx.createRadialGradient(-radius * 0.28, -radius * 0.36, 1, 0, 0, radius * 1.25)
  skull.addColorStop(0, finalBoss ? '#fff7ad' : '#f8fafc')
  skull.addColorStop(0.38, finalBoss ? '#d6a84b' : '#cbd5e1')
  skull.addColorStop(0.78, finalBoss ? '#4a2209' : '#334155')
  skull.addColorStop(1, '#020617')
  ctx.fillStyle = skull
  ctx.strokeStyle = finalBoss ? 'rgba(254,243,199,0.92)' : 'rgba(226,232,240,0.72)'
  ctx.lineWidth = Math.max(1, radius * 0.14)
  ctx.beginPath()
  ctx.moveTo(0, -radius * 0.92)
  ctx.bezierCurveTo(radius * 0.72, -radius * 0.86, radius * 0.92, -radius * 0.22, radius * 0.62, radius * 0.28)
  ctx.lineTo(radius * 0.38, radius * 0.84)
  ctx.lineTo(-radius * 0.38, radius * 0.84)
  ctx.lineTo(-radius * 0.62, radius * 0.28)
  ctx.bezierCurveTo(-radius * 0.92, -radius * 0.22, -radius * 0.72, -radius * 0.86, 0, -radius * 0.92)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  ctx.shadowBlur = 0
  ctx.fillStyle = 'rgba(2,6,23,0.95)'
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(side * radius * 0.3, -radius * 0.18, radius * 0.18, radius * 0.24, side * 0.22, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.beginPath()
  ctx.moveTo(0, radius * 0.02)
  ctx.lineTo(radius * 0.14, radius * 0.26)
  ctx.lineTo(-radius * 0.14, radius * 0.26)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = finalBoss ? 'rgba(56,189,248,0.76)' : 'rgba(248,113,113,0.72)'
  ctx.lineWidth = Math.max(0.8, radius * 0.08)
  ctx.beginPath()
  ctx.moveTo(-radius * 0.36, radius * 0.48)
  ctx.lineTo(radius * 0.36, radius * 0.48)
  ctx.stroke()
  for (const tooth of [-0.22, 0, 0.22]) {
    ctx.beginPath()
    ctx.moveTo(radius * tooth, radius * 0.38)
    ctx.lineTo(radius * tooth, radius * 0.68)
    ctx.stroke()
  }

  if (finalBoss) {
    ctx.globalCompositeOperation = 'lighter'
    drawRadialEllipse(ctx, 0, -radius * 0.16, radius * 0.18, radius * 0.12, [
      [0, 'rgba(255,255,255,0.82)'],
      [0.38, 'rgba(56,189,248,0.7)'],
      [1, 'rgba(56,189,248,0)'],
    ])
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = 'rgba(254,243,199,0.8)'
    ctx.beginPath()
    ctx.moveTo(-radius * 0.48, -radius * 0.78)
    ctx.lineTo(-radius * 0.2, -radius * 1.18)
    ctx.lineTo(0, -radius * 0.82)
    ctx.lineTo(radius * 0.2, -radius * 1.18)
    ctx.lineTo(radius * 0.48, -radius * 0.78)
    ctx.stroke()
  }
  ctx.restore()
}

export function drawBossBar(ctx: CanvasRenderingContext2D, enemy: Enemy, x: number, y: number, size: number) {
  if (enemy.hp <= 0) return
  const isStageBoss = enemy.bossKind === 'squid' || enemy.bossKind === 'snake' || enemy.bossKind === 'final'
  const isSuper = enemy.bossKind === 'super' || isStageBoss
  const isFinal = enemy.bossKind === 'final'
  const isDevil = enemy.bossKind === 'devil'
  const devilDesktopBar = isDevil && size > 560
  const maxContainedWidth = Math.max(120, x * 2 - 18)
  const width = Math.min(size * (isDevil ? 1.18 : isFinal ? 1.28 : isStageBoss ? 1.12 : isSuper ? 1.04 : 0.9), isDevil ? maxContainedWidth : Number.POSITIVE_INFINITY)
  const height = isDevil ? 17 : isFinal ? 18 : isStageBoss ? 15 : isSuper ? 13 : 10
  const skullRadius = size * (isFinal ? 0.09 : isStageBoss ? 0.075 : 0)
  const barX = x - width / 2
  const barY = devilDesktopBar ? Math.max(52, y - size * 0.44) : y + size * 0.5 + (isDevil ? 30 : isFinal ? 20 : isSuper ? 16 : 12)
  const fill = clamp(enemy.hp / enemy.maxHp, 0, 1)
  const accent = isDevil ? '#fb7185' : isFinal ? '#38bdf8' : enemy.bossKind === 'snake' ? '#fbbf24' : enemy.bossKind === 'squid' ? '#f472b6' : '#ef233c'

  ctx.save()
  if (isStageBoss || isDevil) {
    const framePadX = skullRadius * (isFinal ? 2.15 : 1.65)
    const devilPadX = isDevil ? Math.min(size * 0.035, Math.max(4, x - width / 2 - 9)) : 0
    const framePadY = isDevil ? 8 : isFinal ? 7 : 5
    const frameX = barX - framePadX - devilPadX
    const frameY = barY - framePadY
    const frameW = width + framePadX * 2 + devilPadX * 2
    const frameH = height + framePadY * 2
    const frame = ctx.createLinearGradient(frameX, frameY, frameX + frameW, frameY + frameH)
    frame.addColorStop(0, 'rgba(2,6,23,0.98)')
    frame.addColorStop(0.26, isDevil ? 'rgba(69,10,10,0.96)' : isFinal ? 'rgba(69,26,3,0.94)' : 'rgba(42,12,42,0.94)')
    frame.addColorStop(0.62, 'rgba(15,23,42,0.96)')
    frame.addColorStop(1, 'rgba(2,6,23,0.98)')
    ctx.fillStyle = frame
    ctx.strokeStyle = isDevil ? 'rgba(254,202,202,0.82)' : isFinal ? 'rgba(254,243,199,0.82)' : 'rgba(248,113,113,0.62)'
    ctx.lineWidth = isDevil ? 1.8 : isFinal ? 2 : 1.4
    ctx.shadowBlur = isDevil ? 16 : isFinal ? 20 : 12
    ctx.shadowColor = isDevil ? 'rgba(239,68,68,0.36)' : isFinal ? 'rgba(56,189,248,0.34)' : 'rgba(248,113,113,0.28)'
    traceRoundedRect(ctx, frameX, frameY, frameW, frameH, isDevil ? 10 : isFinal ? 9 : 7)
    ctx.fill()
    ctx.stroke()
    ctx.shadowBlur = 0

    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = isDevil ? 'rgba(248,113,113,0.32)' : isFinal ? 'rgba(56,189,248,0.42)' : 'rgba(251,191,36,0.26)'
    ctx.lineWidth = Math.max(1, size * 0.003)
    const markCount = isDevil ? 14 : isFinal ? 12 : 8
    for (let mark = 0; mark < markCount; mark += 1) {
      const px = barX + (mark / (markCount - 1)) * width
      ctx.beginPath()
      ctx.moveTo(px, frameY + 3)
      ctx.lineTo(px + (mark % 2 === 0 ? size * 0.018 : -size * 0.018), frameY + frameH - 3)
      ctx.stroke()
    }
    ctx.globalCompositeOperation = 'source-over'
  }

  traceRoundedRect(ctx, barX, barY, width, height, 999)
  ctx.fillStyle = isDevil ? 'rgba(15,3,8,0.98)' : isFinal ? 'rgba(3,7,18,0.98)' : isSuper ? 'rgba(18,8,16,0.95)' : 'rgba(20,10,20,0.92)'
  ctx.strokeStyle = isDevil ? 'rgba(252,165,165,0.78)' : isFinal ? 'rgba(125,249,255,0.72)' : isSuper ? 'rgba(251,191,36,0.65)' : 'rgba(255,255,255,0.2)'
  ctx.lineWidth = isDevil ? 1.6 : isFinal ? 1.5 : 1
  ctx.fill()
  ctx.stroke()

  ctx.save()
  traceRoundedRect(ctx, barX, barY, width, height, 999)
  ctx.clip()
  const gradient = ctx.createLinearGradient(barX, 0, barX + width, 0)
  if (isDevil) {
    gradient.addColorStop(0, '#270509')
    gradient.addColorStop(0.28, '#991b1b')
    gradient.addColorStop(0.58, '#ef4444')
    gradient.addColorStop(0.82, '#fb923c')
    gradient.addColorStop(1, '#fee2e2')
  } else if (isFinal) {
    gradient.addColorStop(0, '#22d3ee')
    gradient.addColorStop(0.28, '#2563eb')
    gradient.addColorStop(0.56, '#ef233c')
    gradient.addColorStop(0.82, '#fbbf24')
    gradient.addColorStop(1, '#fef3c7')
  } else if (isStageBoss) {
    gradient.addColorStop(0, enemy.bossKind === 'snake' ? '#0f172a' : '#581c87')
    gradient.addColorStop(0.42, enemy.bossKind === 'snake' ? '#06b6d4' : '#ef233c')
    gradient.addColorStop(0.74, enemy.bossKind === 'snake' ? '#fbbf24' : '#f472b6')
    gradient.addColorStop(1, '#fef3c7')
  } else if (isSuper) {
    gradient.addColorStop(0, '#581c87')
    gradient.addColorStop(0.46, '#ef233c')
    gradient.addColorStop(1, '#fbbf24')
  } else {
    gradient.addColorStop(0, '#7f1d1d')
    gradient.addColorStop(0.55, '#ef233c')
    gradient.addColorStop(1, '#fca5a5')
  }
  ctx.fillStyle = gradient
  ctx.shadowBlur = isDevil ? 22 : isFinal ? 24 : isSuper ? 18 : 14
  ctx.shadowColor = isDevil ? 'rgba(239,68,68,0.9)' : isFinal ? 'rgba(56,189,248,0.9)' : isSuper ? 'rgba(251,191,36,0.82)' : 'rgba(239,35,60,0.8)'
  ctx.fillRect(barX, barY, width * fill, height)
  ctx.globalCompositeOperation = 'screen'
  ctx.fillStyle = isDevil ? 'rgba(255,255,255,0.18)' : isFinal ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.14)'
  ctx.fillRect(barX, barY, width * fill, Math.max(2, height * 0.32))
  ctx.restore()

  if (isStageBoss) {
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    drawBossBarSkull(ctx, barX - skullRadius * 0.9, barY + height * 0.5, skullRadius, accent, isFinal)
    drawBossBarSkull(ctx, barX + width + skullRadius * 0.9, barY + height * 0.5, skullRadius, accent, isFinal)
    ctx.restore()
  }

  if (isDevil) {
    ctx.save()
    ctx.font = `950 ${Math.max(10, size * 0.027)}px Orbitron, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = 'rgba(254,226,226,0.94)'
    ctx.shadowBlur = 10
    ctx.shadowColor = 'rgba(239,68,68,0.74)'
    ctx.fillText('DEVIL GUNDAM', x, barY - 8)
    ctx.font = `850 ${Math.max(7, size * 0.017)}px Orbitron, system-ui, sans-serif`
    ctx.fillStyle = 'rgba(251,146,60,0.76)'
    ctx.fillText('DG CELL CORE INTEGRITY', x, barY + height + 15)
    ctx.restore()
  } else if (isFinal) {
    ctx.save()
    ctx.font = `900 ${Math.max(10, size * 0.03)}px Orbitron, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = 'rgba(254,243,199,0.94)'
    ctx.shadowBlur = 12
    ctx.shadowColor = 'rgba(56,189,248,0.72)'
    ctx.fillText('MIRAGE MOTHERSHIP', x, barY - 9)
    ctx.font = `800 ${Math.max(7, size * 0.018)}px Orbitron, system-ui, sans-serif`
    ctx.fillStyle = 'rgba(125,249,255,0.72)'
    ctx.fillText('FINAL CORE INTEGRITY', x, barY + height + 15)
    ctx.restore()
  } else if (isStageBoss) {
    ctx.save()
    ctx.font = `850 ${Math.max(8, size * 0.023)}px Orbitron, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = 'rgba(226,232,240,0.86)'
    ctx.shadowBlur = 8
    ctx.shadowColor = accent
    ctx.fillText(enemy.bossKind === 'snake' ? 'SERPENT GUARDIAN' : 'ABYSS SQUID', x, barY - 5)
    ctx.restore()
  }

  ctx.restore()
}

export function drawCachedBossBar(ctx: CanvasRenderingContext2D, enemy: Enemy, x: number, y: number, size: number) {
  if (enemy.hp <= 0) return
  const isStageBoss = enemy.bossKind === 'squid' || enemy.bossKind === 'snake' || enemy.bossKind === 'final'
  if (!isStageBoss || typeof document === 'undefined' || size <= 0) {
    drawBossBar(ctx, enemy, x, y, size)
    return
  }
  const isFinal = enemy.bossKind === 'final'
  const height = isFinal ? 18 : 15
  const barWidth = size * (isFinal ? 1.28 : 1.12)
  const skullRadius = size * (isFinal ? 0.09 : 0.075)
  const framePadX = skullRadius * (isFinal ? 2.15 : 1.65)
  const framePadY = isFinal ? 7 : 5
  const fill = clamp(enemy.hp / Math.max(1, enemy.maxHp), 0, 1)
  const fillBucket = Math.round(fill * 200)
  const renderScale = getOffscreenRenderScale(ctx, size)
  const sizeBucket = Math.round(size / 4) * 4
  const scaleBucket = Math.round(renderScale * 100)
  const key = `bbar:${enemy.bossKind}:${sizeBucket}:${scaleBucket}:${fillBucket}`
  const leftPad = Math.ceil(framePadX + skullRadius * 2 + 6)
  const topPad = Math.ceil(Math.max(10, size * 0.032) + framePadY + 10)
  const bottomPad = isFinal ? 36 : 22
  const canvasW = Math.ceil(barWidth + leftPad * 2)
  const canvasH = Math.ceil(height + topPad + bottomPad)
  let canvas = bossBarSpriteCache.get(key)
  if (!canvas) {
    canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.ceil(canvasW * renderScale))
    canvas.height = Math.max(1, Math.ceil(canvasH * renderScale))
    const bCtx = canvas.getContext('2d')
    if (!bCtx) { drawBossBar(ctx, enemy, x, y, size); return }
    bCtx.setTransform(renderScale, 0, 0, renderScale, 0, 0)
    bCtx.imageSmoothingEnabled = true
    bCtx.imageSmoothingQuality = 'high'
    const barX = leftPad
    const barY = topPad
    const textX = leftPad + barWidth / 2
    const accent = isFinal ? '#38bdf8' : enemy.bossKind === 'snake' ? '#fbbf24' : '#f472b6'
    const frameX = barX - framePadX
    const frameY = barY - framePadY
    const frameW = barWidth + framePadX * 2
    const frameH = height + framePadY * 2
    const frame = bCtx.createLinearGradient(frameX, frameY, frameX + frameW, frameY + frameH)
    frame.addColorStop(0, 'rgba(2,6,23,0.98)')
    frame.addColorStop(0.26, isFinal ? 'rgba(69,26,3,0.94)' : 'rgba(42,12,42,0.94)')
    frame.addColorStop(0.62, 'rgba(15,23,42,0.96)')
    frame.addColorStop(1, 'rgba(2,6,23,0.98)')
    bCtx.fillStyle = frame
    bCtx.strokeStyle = isFinal ? 'rgba(254,243,199,0.82)' : 'rgba(248,113,113,0.62)'
    bCtx.lineWidth = isFinal ? 2 : 1.4
    bCtx.shadowBlur = isFinal ? 20 : 12
    bCtx.shadowColor = isFinal ? 'rgba(56,189,248,0.34)' : 'rgba(248,113,113,0.28)'
    traceRoundedRect(bCtx, frameX, frameY, frameW, frameH, isFinal ? 9 : 7)
    bCtx.fill()
    bCtx.stroke()
    bCtx.shadowBlur = 0
    bCtx.globalCompositeOperation = 'lighter'
    bCtx.strokeStyle = isFinal ? 'rgba(56,189,248,0.42)' : 'rgba(251,191,36,0.26)'
    bCtx.lineWidth = Math.max(1, size * 0.003)
    const markCount = isFinal ? 12 : 8
    for (let mark = 0; mark < markCount; mark += 1) {
      const px = barX + (mark / (markCount - 1)) * barWidth
      bCtx.beginPath()
      bCtx.moveTo(px, frameY + 3)
      bCtx.lineTo(px + (mark % 2 === 0 ? size * 0.018 : -size * 0.018), frameY + frameH - 3)
      bCtx.stroke()
    }
    bCtx.globalCompositeOperation = 'source-over'
    traceRoundedRect(bCtx, barX, barY, barWidth, height, 999)
    bCtx.fillStyle = isFinal ? 'rgba(3,7,18,0.98)' : 'rgba(18,8,16,0.95)'
    bCtx.strokeStyle = isFinal ? 'rgba(125,249,255,0.72)' : 'rgba(251,191,36,0.65)'
    bCtx.lineWidth = isFinal ? 1.5 : 1
    bCtx.fill()
    bCtx.stroke()
    bCtx.save()
    traceRoundedRect(bCtx, barX, barY, barWidth, height, 999)
    bCtx.clip()
    const gradient = bCtx.createLinearGradient(barX, 0, barX + barWidth, 0)
    if (isFinal) {
      gradient.addColorStop(0, '#22d3ee')
      gradient.addColorStop(0.28, '#2563eb')
      gradient.addColorStop(0.56, '#ef233c')
      gradient.addColorStop(0.82, '#fbbf24')
      gradient.addColorStop(1, '#fef3c7')
    } else if (enemy.bossKind === 'snake') {
      gradient.addColorStop(0, '#0f172a')
      gradient.addColorStop(0.42, '#06b6d4')
      gradient.addColorStop(0.74, '#fbbf24')
      gradient.addColorStop(1, '#fef3c7')
    } else {
      gradient.addColorStop(0, '#581c87')
      gradient.addColorStop(0.42, '#ef233c')
      gradient.addColorStop(0.74, '#f472b6')
      gradient.addColorStop(1, '#fef3c7')
    }
    bCtx.fillStyle = gradient
    bCtx.shadowBlur = isFinal ? 24 : 18
    bCtx.shadowColor = isFinal ? 'rgba(56,189,248,0.9)' : 'rgba(251,191,36,0.82)'
    bCtx.fillRect(barX, barY, barWidth * fillBucket / 200, height)
    bCtx.globalCompositeOperation = 'screen'
    bCtx.fillStyle = isFinal ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.14)'
    bCtx.fillRect(barX, barY, barWidth * fillBucket / 200, Math.max(2, height * 0.32))
    bCtx.restore()
    bCtx.save()
    bCtx.globalCompositeOperation = 'source-over'
    drawBossBarSkull(bCtx, barX - skullRadius * 0.9, barY + height * 0.5, skullRadius, accent, isFinal)
    drawBossBarSkull(bCtx, barX + barWidth + skullRadius * 0.9, barY + height * 0.5, skullRadius, accent, isFinal)
    bCtx.restore()
    bCtx.save()
    bCtx.textAlign = 'center'
    bCtx.textBaseline = 'bottom'
    if (isFinal) {
      bCtx.font = `900 ${Math.max(10, size * 0.03)}px Orbitron, system-ui, sans-serif`
      bCtx.fillStyle = 'rgba(254,243,199,0.94)'
      bCtx.shadowBlur = 12
      bCtx.shadowColor = 'rgba(56,189,248,0.72)'
      bCtx.fillText('MIRAGE MOTHERSHIP', textX, barY - 9)
      bCtx.font = `800 ${Math.max(7, size * 0.018)}px Orbitron, system-ui, sans-serif`
      bCtx.fillStyle = 'rgba(125,249,255,0.72)'
      bCtx.fillText('FINAL CORE INTEGRITY', textX, barY + height + 15)
    } else {
      bCtx.font = `850 ${Math.max(8, size * 0.023)}px Orbitron, system-ui, sans-serif`
      bCtx.fillStyle = 'rgba(226,232,240,0.86)'
      bCtx.shadowBlur = 8
      bCtx.shadowColor = accent
      bCtx.fillText(enemy.bossKind === 'snake' ? 'SERPENT GUARDIAN' : 'ABYSS SQUID', textX, barY - 5)
    }
    bCtx.restore()
    trimOldestMapEntry(bossBarSpriteCache, BOSS_BAR_CACHE_LIMIT)
    bossBarSpriteCache.set(key, canvas)
  }
  const screenBarX = x - barWidth / 2
  const screenBarY = y + size * 0.5 + (isFinal ? 20 : 16)
  ctx.drawImage(canvas, screenBarX - leftPad, screenBarY - topPad, canvas.width / renderScale, canvas.height / renderScale)
}

export function getNormalEnemyFilter(time: number) {
  const pulse = 0.88 + ((Math.sin(time / 700) + 1) / 2) * 0.3
  return `brightness(${(1.16 * pulse).toFixed(2)}) contrast(1.12) saturate(1.28)`
}
