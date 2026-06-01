import { drawCanvasSpriteContain, getCachedCanvasPattern, getCanvasSpriteDimensions, getCobraBossCanvasSprite } from './assets'
import { BOSS_COLORS } from './constants'
import type { Enemy, Vec } from './types'
import { clamp, drawRadialEllipse } from './utils'
import { drawBossDust, drawEtchedPanelLine } from './squidBossRender'

export const cobraBossBodyTextureCache = new Map<string, HTMLCanvasElement>()

export function drawReferenceSnakeBossFinishPass(ctx: CanvasRenderingContext2D, size: number, time: number) {
  const seconds = time / 1000
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'

  for (const side of [-1, 1]) {
    const hood = ctx.createLinearGradient(0, -size * 0.56, side * size * 0.48, size * 0.08)
    hood.addColorStop(0, '#fef3c7')
    hood.addColorStop(0.22, '#b7832f')
    hood.addColorStop(0.58, '#1f2937')
    hood.addColorStop(1, '#020617')
    ctx.fillStyle = hood
    ctx.strokeStyle = 'rgba(253,230,138,0.9)'
    ctx.lineWidth = Math.max(2.2, size * 0.009)
    ctx.beginPath()
    ctx.moveTo(side * size * 0.03, -size * 0.5)
    ctx.bezierCurveTo(side * size * 0.46, -size * 0.48, side * size * 0.5, -size * 0.1, side * size * 0.2, size * 0.13)
    ctx.lineTo(side * size * 0.04, size * 0.03)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = 'rgba(2,6,23,0.58)'
    ctx.beginPath()
    ctx.moveTo(side * size * 0.09, -size * 0.34)
    ctx.lineTo(side * size * 0.29, -size * 0.18)
    ctx.lineTo(side * size * 0.1, size * 0.04)
    ctx.closePath()
    ctx.fill()
  }

  const head = ctx.createRadialGradient(-size * 0.04, -size * 0.42, size * 0.02, 0, -size * 0.22, size * 0.32)
  head.addColorStop(0, '#fff7ad')
  head.addColorStop(0.28, '#b6a27c')
  head.addColorStop(0.62, '#1f2937')
  head.addColorStop(1, '#020617')
  ctx.fillStyle = head
  ctx.strokeStyle = 'rgba(253,230,138,0.94)'
  ctx.lineWidth = Math.max(2, size * 0.01)
  ctx.beginPath()
  ctx.moveTo(0, -size * 0.56)
  ctx.bezierCurveTo(size * 0.17, -size * 0.5, size * 0.22, -size * 0.22, size * 0.1, size * 0.08)
  ctx.bezierCurveTo(size * 0.04, size * 0.2, -size * 0.04, size * 0.2, -size * 0.1, size * 0.08)
  ctx.bezierCurveTo(-size * 0.22, -size * 0.22, -size * 0.17, -size * 0.5, 0, -size * 0.56)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  ctx.globalCompositeOperation = 'lighter'
  for (const side of [-1, 1]) {
    drawRadialEllipse(ctx, side * size * 0.07, -size * 0.18, size * 0.04, size * 0.05, [
      [0, 'rgba(255,255,255,0.98)'],
      [0.32, 'rgba(251,191,36,0.98)'],
      [1, 'rgba(249,115,22,0)'],
    ])
    for (let dot = 0; dot < 9; dot += 1) {
      drawRadialEllipse(ctx, side * size * (0.12 + (dot % 3) * 0.045), -size * (0.42 - dot * 0.07), size * 0.017, size * 0.017, [
        [0, 'rgba(255,255,255,0.85)'],
        [0.45, 'rgba(34,211,238,0.78)'],
        [1, 'rgba(34,211,238,0)'],
      ])
    }
  }

  ctx.globalCompositeOperation = 'source-over'
  const tailX = Math.sin(seconds * 0.7 + 2.8) * size * 0.2
  ctx.fillStyle = '#111827'
  ctx.strokeStyle = 'rgba(253,230,138,0.86)'
  ctx.lineWidth = Math.max(1.4, size * 0.006)
  ctx.beginPath()
  ctx.moveTo(tailX - size * 0.035, size * 0.56)
  ctx.quadraticCurveTo(tailX + size * 0.1, size * 0.67, tailX + size * 0.23, size * 0.8)
  ctx.quadraticCurveTo(tailX + size * 0.06, size * 0.76, tailX - size * 0.03, size * 0.67)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.globalCompositeOperation = 'lighter'
  drawRadialEllipse(ctx, tailX + size * 0.17, size * 0.77, size * 0.025, size * 0.018, [
    [0, 'rgba(255,255,255,0.78)'],
    [0.45, 'rgba(34,211,238,0.55)'],
    [1, 'rgba(34,211,238,0)'],
  ])
  ctx.restore()
}

export function drawReferenceSnakeBossDetails(ctx: CanvasRenderingContext2D, size: number, _time: number) {
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'

  for (const side of [-1, 1]) {
    const hood = ctx.createLinearGradient(side * size * 0.04, -size * 0.45, side * size * 0.5, size * 0.08)
    hood.addColorStop(0, '#fef3c7')
    hood.addColorStop(0.28, '#a16207')
    hood.addColorStop(0.62, '#1f2937')
    hood.addColorStop(1, '#020617')
    ctx.fillStyle = hood
    ctx.strokeStyle = 'rgba(253,230,138,0.78)'
    ctx.lineWidth = Math.max(2, size * 0.008)
    ctx.beginPath()
    ctx.moveTo(side * size * 0.04, -size * 0.44)
    ctx.bezierCurveTo(side * size * 0.43, -size * 0.42, side * size * 0.48, -size * 0.1, side * size * 0.2, size * 0.12)
    ctx.lineTo(side * size * 0.05, size * 0.02)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    for (let rib = 0; rib < 7; rib += 1) {
      ctx.strokeStyle = rib % 2 === 0 ? 'rgba(244,63,94,0.38)' : 'rgba(251,146,60,0.34)'
      ctx.beginPath()
      ctx.moveTo(side * size * (0.08 + rib * 0.035), -size * (0.34 - rib * 0.045))
      ctx.lineTo(side * size * (0.34 - rib * 0.018), -size * (0.2 - rib * 0.035))
      ctx.stroke()
    }
  }

  ctx.globalCompositeOperation = 'lighter'
  for (const side of [-1, 1]) {
    drawRadialEllipse(ctx, side * size * 0.08, -size * 0.18, size * 0.045, size * 0.05, [
      [0, 'rgba(255,255,255,0.96)'],
      [0.34, 'rgba(251,191,36,0.95)'],
      [1, 'rgba(249,115,22,0)'],
    ])
    for (let dot = 0; dot < 8; dot += 1) {
      const y = -size * 0.43 + dot * size * 0.08
      drawRadialEllipse(ctx, side * size * (0.16 + (dot % 3) * 0.045), y, size * 0.018, size * 0.018, [
        [0, 'rgba(255,255,255,0.84)'],
        [0.45, 'rgba(248,113,113,0.7)'],
        [1, 'rgba(248,113,113,0)'],
      ])
    }
  }

  ctx.restore()
}

export function drawSnakeBiteLungeModel(ctx: CanvasRenderingContext2D, x: number, y: number, targetX: number, targetY: number, size: number, time: number, warm: number, pulse: number) {
  const seconds = time / 1000
  const reach = Math.min(size, 380)
  const startX = x
  const startY = y - size * 0.14
  const lunge = 0.16 + warm * 0.84
  const endX = startX + (targetX - startX) * lunge
  const endY = startY + (targetY - startY) * lunge
  const c1x = x + Math.sin(seconds * 2.3) * reach * 0.12
  const c1y = y + size * 0.3
  const c2x = targetX + Math.sin(seconds * 3.1) * reach * 0.08
  const c2y = targetY - reach * 0.24
  const pointAt = (t: number) => {
    const inv = 1 - t
    return {
      x: inv * inv * inv * startX + 3 * inv * inv * t * c1x + 3 * inv * t * t * c2x + t * t * t * endX,
      y: inv * inv * inv * startY + 3 * inv * inv * t * c1y + 3 * inv * t * t * c2y + t * t * t * endY,
    }
  }
  const tangentAt = (t: number) => {
    const inv = 1 - t
    const dx = 3 * inv * inv * (c1x - startX) + 6 * inv * t * (c2x - c1x) + 3 * t * t * (endX - c2x)
    const dy = 3 * inv * inv * (c1y - startY) + 6 * inv * t * (c2y - c1y) + 3 * t * t * (endY - c2y)
    return Math.atan2(dy, dx)
  }

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = `rgba(225,29,72,${0.05 + warm * 0.08})`
  ctx.strokeStyle = `rgba(251,146,60,${0.3 + pulse * 0.22})`
  ctx.lineWidth = Math.max(2, size * 0.01)
  ctx.beginPath()
  ctx.ellipse(targetX, targetY, reach * 0.12, reach * 0.075, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  ctx.globalCompositeOperation = 'source-over'
  const cobraTexture = getCobraBossBodyTextureCanvas()
  for (let segment = 0; segment <= 22; segment += 1) {
    const p = segment / 22
    const point = pointAt(p)
    const angle = tangentAt(p)
    const neckBulk = 0.72 + p * 0.5
    const segmentSize = reach * (0.046 * neckBulk + 0.017)
    const scale = 1 + Math.sin(seconds * 4.2 + segment * 0.5) * 0.06
    drawCobraTexturedBodySegment(ctx, cobraTexture, point.x, point.y, segmentSize * 1.28 * scale, segmentSize * 0.72 * scale, angle + Math.PI / 2, time, segment, true)
  }

  ctx.globalCompositeOperation = 'lighter'
  for (let node = 4; node <= 20; node += 4) {
    const point = pointAt(node / 22)
    drawRadialEllipse(ctx, point.x, point.y, reach * 0.014, reach * 0.014, [
      [0, 'rgba(255,255,255,0.75)'],
      [0.34, 'rgba(248,113,113,0.7)'],
      [1, 'rgba(248,113,113,0)'],
    ])
  }

  ctx.save()
  ctx.translate(endX, endY)
  drawCobraBossHead(ctx, size * 0.72, time, true)
  ctx.restore()
  ctx.restore()
}

export function drawSnakeVenomTelegraph(ctx: CanvasRenderingContext2D, x: number, y: number, targetX: number, targetY: number, size: number, viewportWidth: number, time: number, chargeTimer: number, pattern: Enemy['chargePattern'], retractTimer = 0) {
  const chargeWarm = clamp(1 - chargeTimer / (pattern === 'horizontal' ? 1.18 : pattern === 'cross' ? 1.08 : 0.95), 0, 1)
  const warm = pattern === 'cross' && chargeTimer <= 0 && retractTimer > 0
    ? clamp(retractTimer / 0.42, 0, 1)
    : chargeWarm
  const pulse = 0.45 + Math.sin(time / 85) * 0.18
  const laneX = targetX
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (pattern === 'horizontal') {
    const bandHeight = Math.max(18, size * 0.12)
    const wave = Math.sin(time / 130) * size * 0.018
    const bandX = viewportWidth * 0.08
    const bandWidth = viewportWidth * 0.84
    ctx.strokeStyle = `rgba(244,63,94,${0.24 + warm * 0.36})`
    ctx.fillStyle = `rgba(225,29,72,${0.04 + warm * 0.08})`
    ctx.lineWidth = Math.max(3, size * 0.012)
    ctx.beginPath()
    ctx.roundRect?.(bandX, targetY - bandHeight * 0.5, bandWidth, bandHeight, bandHeight * 0.42)
    if (!ctx.roundRect) {
      ctx.rect(bandX, targetY - bandHeight * 0.5, bandWidth, bandHeight)
    }
    ctx.fill()
    ctx.stroke()
    for (let coil = 0; coil < 3; coil += 1) {
      ctx.beginPath()
      const offsetY = targetY + (coil - 1) * bandHeight * 0.22 + wave
      ctx.moveTo(bandX + bandWidth * 0.03, offsetY)
      for (let segment = 0; segment <= 10; segment += 1) {
        const px = bandX + bandWidth * (0.03 + (segment / 10) * 0.94)
        const py = offsetY + Math.sin(segment * 1.1 + time / 120 + coil) * bandHeight * 0.18
        ctx.lineTo(px, py)
      }
      ctx.stroke()
    }
    ctx.restore()
    return
  }

  if (pattern === 'cross') {
    drawSnakeBiteLungeModel(ctx, x, y, laneX, targetY, size, time, warm, pulse)
    ctx.restore()
    return
  }

  ctx.strokeStyle = `rgba(244,63,94,${0.18 + warm * 0.42})`
  ctx.lineWidth = Math.max(3, size * 0.014)
  const laneOffsets = pattern === 'scatter' ? [-26, -10, 10, 26] : pattern === 'trident' ? [-18, 0, 18] : pattern === 'pincer' ? [-24, 24] : [0]
  laneOffsets.forEach((offset, index) => {
    const tx = laneX + offset * (size / Math.max(280, size))
    ctx.beginPath()
    ctx.moveTo(x + (index - (laneOffsets.length - 1) / 2) * size * 0.07, y - size * 0.08)
    ctx.bezierCurveTo(x + offset * 0.8, y + size * 0.1, tx, y + size * 0.32, tx, y + size * (0.48 + warm * 0.18))
    ctx.stroke()
    drawRadialEllipse(ctx, tx, y + size * (0.52 + warm * 0.2), size * (0.026 + pulse * 0.01), size * 0.018, [
      [0, 'rgba(255,255,255,0.72)'],
      [0.42, 'rgba(248,113,113,0.56)'],
      [1, 'rgba(248,113,113,0)'],
    ])
  })
  ctx.restore()
}

export function drawSnakeTerrorHead(ctx: CanvasRenderingContext2D, size: number, time: number, redEyeWarning = false) {
  const seconds = time / 1000
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'

  const skull = ctx.createLinearGradient(0, -size * 0.62, 0, size * 0.12)
  skull.addColorStop(0, '#fff1a3')
  skull.addColorStop(0.2, '#b7832f')
  skull.addColorStop(0.54, '#273244')
  skull.addColorStop(1, '#020617')
  ctx.fillStyle = skull
  ctx.strokeStyle = 'rgba(254,243,199,0.98)'
  ctx.lineWidth = Math.max(2.2, size * 0.011)
  ctx.beginPath()
  ctx.moveTo(0, -size * 0.64)
  ctx.lineTo(size * 0.16, -size * 0.42)
  ctx.lineTo(size * 0.135, -size * 0.1)
  ctx.lineTo(size * 0.055, size * 0.12)
  ctx.lineTo(0, size * 0.19)
  ctx.lineTo(-size * 0.055, size * 0.12)
  ctx.lineTo(-size * 0.135, -size * 0.1)
  ctx.lineTo(-size * 0.16, -size * 0.42)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  for (const side of [-1, 1]) {
    ctx.fillStyle = 'rgba(3,7,18,0.92)'
    ctx.beginPath()
    ctx.moveTo(side * size * 0.07, -size * 0.36)
    ctx.lineTo(side * size * 0.22, -size * 0.25)
    ctx.lineTo(side * size * 0.09, -size * 0.045)
    ctx.closePath()
    ctx.fill()

    ctx.globalCompositeOperation = 'lighter'
    drawRadialEllipse(ctx, side * size * 0.085, -size * 0.18, size * 0.05, size * 0.058, [
      [0, 'rgba(255,255,255,0.96)'],
      [0.2, redEyeWarning ? 'rgba(254,202,202,1)' : 'rgba(251,191,36,0.96)'],
      [0.48, redEyeWarning ? 'rgba(239,68,68,1)' : 'rgba(249,115,22,0.68)'],
      [1, redEyeWarning ? 'rgba(153,27,27,0)' : 'rgba(249,115,22,0)'],
    ])
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = redEyeWarning ? 'rgba(127,29,29,0.98)' : 'rgba(2,6,23,0.95)'
    ctx.beginPath()
    ctx.ellipse(side * size * 0.085, -size * 0.18, size * 0.01, size * 0.037, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#fef3c7'
    ctx.strokeStyle = 'rgba(15,23,42,0.9)'
    ctx.lineWidth = Math.max(1, size * 0.004)
    for (let fang = 0; fang < 2; fang += 1) {
      const x = side * size * (0.035 + fang * 0.035)
      const y = size * (0.055 + fang * 0.01)
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + side * size * 0.018, size * 0.235)
      ctx.lineTo(x - side * size * 0.014, y + size * 0.035)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
  }

  ctx.strokeStyle = 'rgba(2,6,23,0.78)'
  ctx.lineWidth = Math.max(1.1, size * 0.005)
  for (let ridge = 0; ridge < 7; ridge += 1) {
    const y = -size * 0.48 + ridge * size * 0.075
    ctx.beginPath()
    ctx.moveTo(-size * (0.035 + ridge * 0.007), y)
    ctx.lineTo(0, y + size * 0.038)
    ctx.lineTo(size * (0.035 + ridge * 0.007), y)
    ctx.stroke()
  }

  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = 'rgba(244,63,94,0.48)'
  ctx.lineWidth = Math.max(1.2, size * 0.004)
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(side * size * 0.02, -size * 0.54)
    ctx.bezierCurveTo(side * size * 0.09, -size * 0.36, side * size * 0.03, -size * 0.1, side * size * 0.075, size * 0.08)
    ctx.stroke()
  }
  drawRadialEllipse(ctx, 0, -size * 0.5 + Math.sin(seconds * 3.6) * size * 0.004, size * 0.025, size * 0.04, [
    [0, 'rgba(255,255,255,0.72)'],
    [0.45, 'rgba(251,146,60,0.54)'],
    [1, 'rgba(251,146,60,0)'],
  ])
  ctx.restore()
}

export function drawCobraBossHead(ctx: CanvasRenderingContext2D, size: number, time: number, redEyeWarning = false) {
  const sprite = getCobraBossCanvasSprite()
  if (!sprite.loaded || !sprite.image.complete) {
    drawSnakeHoodFlaps(ctx, size)
    drawSnakeTerrorHead(ctx, size, time, redEyeWarning)
    return
  }

  const pulse = 0.72 + Math.sin(time / 150) * 0.16
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  ctx.shadowColor = redEyeWarning ? 'rgba(248,113,113,0.68)' : 'rgba(225,29,72,0.46)'
  ctx.shadowBlur = size * (redEyeWarning ? 0.11 : 0.075) * pulse
  drawCanvasSpriteContain(
    ctx,
    sprite,
    0,
    -size * 0.1,
    size * 0.98,
    redEyeWarning ? 'brightness(1.16) contrast(1.22) saturate(1.16)' : 'brightness(1.08) contrast(1.14) saturate(1.08)',
    1,
    0,
    1,
    BOSS_COLORS.snake,
  )
  ctx.shadowBlur = 0
  ctx.restore()
}

export function getCobraBossBodyTextureCanvas() {
  if (typeof document === 'undefined') return null
  const sprite = getCobraBossCanvasSprite()
  if (!sprite.loaded || !sprite.image.complete) return null
  const { source, width, height } = getCanvasSpriteDimensions(sprite)
  if (width <= 0 || height <= 0) return null

  const cacheKey = `${sprite.cacheKey}:body-texture:${Math.round(width)}x${Math.round(height)}`
  const cached = cobraBossBodyTextureCache.get(cacheKey)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = 192
  canvas.height = 192
  const textureCtx = canvas.getContext('2d')
  if (!textureCtx) return null

  textureCtx.fillStyle = '#050108'
  textureCtx.fillRect(0, 0, canvas.width, canvas.height)
  textureCtx.imageSmoothingEnabled = true
  textureCtx.imageSmoothingQuality = 'high'
  textureCtx.drawImage(source, width * 0.16, height * 0.12, width * 0.68, height * 0.64, 0, 0, canvas.width, canvas.height)
  textureCtx.globalCompositeOperation = 'multiply'
  textureCtx.fillStyle = 'rgba(24,2,10,0.18)'
  textureCtx.fillRect(0, 0, canvas.width, canvas.height)
  textureCtx.globalCompositeOperation = 'source-over'
  textureCtx.globalAlpha = 0.82
  textureCtx.drawImage(source, width * 0.34, height * 0.24, width * 0.32, height * 0.54, canvas.width * 0.22, 0, canvas.width * 0.56, canvas.height)
  textureCtx.globalAlpha = 0.58
  textureCtx.save()
  textureCtx.scale(-1, 1)
  textureCtx.drawImage(source, width * 0.08, height * 0.2, width * 0.36, height * 0.54, -canvas.width, 0, canvas.width * 0.52, canvas.height)
  textureCtx.restore()
  textureCtx.globalAlpha = 1

  cobraBossBodyTextureCache.set(cacheKey, canvas)
  return canvas
}

export function drawCobraTexturedBodySegment(
  ctx: CanvasRenderingContext2D,
  texture: HTMLCanvasElement | null,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  rotation: number,
  time: number,
  phase: number,
  warning = false,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)

  const base = ctx.createRadialGradient(-radiusX * 0.36, -radiusY * 0.55, 1, 0, 0, radiusX * 1.35)
  base.addColorStop(0, '#ffd0df')
  base.addColorStop(0.1, '#fb7185')
  base.addColorStop(0.26, '#be123c')
  base.addColorStop(0.58, '#3b0615')
  base.addColorStop(1, '#050108')
  ctx.fillStyle = base
  ctx.beginPath()
  ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2)
  ctx.fill()

  if (texture) {
    ctx.save()
    ctx.beginPath()
    ctx.ellipse(0, 0, radiusX * 0.96, radiusY * 0.92, 0, 0, Math.PI * 2)
    ctx.clip()
    const pattern = getCachedCanvasPattern(ctx, texture)
    if (pattern) {
      const scrollX = ((phase * 43 + time / 85) % texture.width) - texture.width
      const scrollY = ((phase * 29 + time / 130) % texture.height) - texture.height
      ctx.globalAlpha *= 0.96
      ctx.translate(scrollX, scrollY)
      ctx.fillStyle = pattern
      ctx.fillRect(-radiusX * 2.5 - scrollX, -radiusY * 2.5 - scrollY, radiusX * 5, radiusY * 5)
    }
    ctx.restore()
  }

  ctx.globalCompositeOperation = 'source-over'
  ctx.strokeStyle = 'rgba(255,205,218,0.56)'
  ctx.lineWidth = Math.max(0.7, radiusY * 0.1)
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(side * radiusX * 0.12, -radiusY * 0.58)
    ctx.quadraticCurveTo(side * radiusX * 0.4, -radiusY * 0.08, side * radiusX * 0.18, radiusY * 0.55)
    ctx.stroke()
  }

  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = warning ? 'rgba(255,42,86,0.82)' : 'rgba(244,63,94,0.58)'
  ctx.lineWidth = Math.max(0.8, radiusY * 0.16)
  ctx.beginPath()
  ctx.moveTo(-radiusX * 0.18, -radiusY * 0.1)
  ctx.quadraticCurveTo(0, radiusY * 0.24, radiusX * 0.18, -radiusY * 0.1)
  ctx.stroke()

  ctx.globalCompositeOperation = 'source-over'
  ctx.strokeStyle = 'rgba(251,146,60,0.58)'
  ctx.lineWidth = Math.max(0.9, radiusY * 0.11)
  ctx.beginPath()
  ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

export function drawCobraPointedTail(ctx: CanvasRenderingContext2D, tail: Vec, next: Vec, size: number, warning = false) {
  const angle = Math.atan2(tail.y - next.y, tail.x - next.x)
  const length = size * 0.155
  const width = size * 0.052
  ctx.save()
  ctx.translate(tail.x, tail.y)
  ctx.rotate(angle)

  const tailGradient = ctx.createLinearGradient(-length * 0.32, -width, length, width)
  tailGradient.addColorStop(0, '#050108')
  tailGradient.addColorStop(0.28, '#3b0615')
  tailGradient.addColorStop(0.58, '#be123c')
  tailGradient.addColorStop(0.84, '#fb7185')
  tailGradient.addColorStop(1, '#ffd0df')
  ctx.fillStyle = tailGradient
  ctx.strokeStyle = warning ? 'rgba(255,42,86,0.78)' : 'rgba(251,146,60,0.58)'
  ctx.lineWidth = Math.max(0.9, size * 0.004)
  ctx.beginPath()
  ctx.moveTo(length, 0)
  ctx.quadraticCurveTo(length * 0.26, -width, -length * 0.38, -width * 0.42)
  ctx.quadraticCurveTo(-length * 0.12, 0, -length * 0.38, width * 0.42)
  ctx.quadraticCurveTo(length * 0.26, width, length, 0)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = warning ? 'rgba(255,205,218,0.62)' : 'rgba(255,205,218,0.42)'
  ctx.lineWidth = Math.max(0.8, size * 0.003)
  ctx.beginPath()
  ctx.moveTo(-length * 0.12, 0)
  ctx.lineTo(length * 0.66, 0)
  ctx.stroke()
  ctx.restore()
}

export function drawCobraBodyConnector(ctx: CanvasRenderingContext2D, bodyPoints: Vec[], size: number, warning = false) {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (let i = 0; i < bodyPoints.length - 1; i += 1) {
    const point = bodyPoints[i]
    const next = bodyPoints[i + 1]
    const p = i / (bodyPoints.length - 1)
    const segmentSize = size * (0.04 + p * 0.066 + Math.sin(p * Math.PI) * 0.012)
    ctx.strokeStyle = '#12020a'
    ctx.lineWidth = segmentSize * 1.52
    ctx.beginPath()
    ctx.moveTo(point.x, point.y)
    ctx.lineTo(next.x, next.y)
    ctx.stroke()

    const coreGradient = ctx.createLinearGradient(point.x, point.y, next.x, next.y)
    coreGradient.addColorStop(0, '#3b0615')
    coreGradient.addColorStop(0.42, '#be123c')
    coreGradient.addColorStop(0.72, '#fb7185')
    coreGradient.addColorStop(1, '#3b0615')
    ctx.strokeStyle = coreGradient
    ctx.lineWidth = segmentSize * 1.08
    ctx.beginPath()
    ctx.moveTo(point.x, point.y)
    ctx.lineTo(next.x, next.y)
    ctx.stroke()
  }
  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = warning ? 'rgba(255,205,218,0.2)' : 'rgba(251,146,60,0.12)'
  ctx.lineWidth = Math.max(1, size * 0.006)
  ctx.beginPath()
  for (let i = 0; i < bodyPoints.length; i += 1) {
    const point = bodyPoints[i]
    if (i === 0) ctx.moveTo(point.x, point.y)
    else ctx.lineTo(point.x, point.y)
  }
  ctx.stroke()
  ctx.restore()
}

export function drawSnakeHoodFlaps(ctx: CanvasRenderingContext2D, size: number) {
  for (const side of [-1, 1]) {
    const hood = ctx.createLinearGradient(side * size * 0.02, -size * 0.42, side * size * 0.42, size * 0.02)
    hood.addColorStop(0, '#fef3c7')
    hood.addColorStop(0.34, '#6b7280')
    hood.addColorStop(0.7, '#172033')
    hood.addColorStop(1, '#020617')
    ctx.fillStyle = hood
    ctx.strokeStyle = 'rgba(254,243,199,0.64)'
    ctx.lineWidth = Math.max(1.8, size * 0.007)
    ctx.beginPath()
    ctx.moveTo(side * size * 0.07, -size * 0.39)
    ctx.bezierCurveTo(side * size * 0.42, -size * 0.34, side * size * 0.46, -size * 0.05, side * size * 0.24, size * 0.13)
    ctx.lineTo(side * size * 0.08, size * 0.04)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = 'rgba(0,0,0,0.38)'
    ctx.beginPath()
    ctx.moveTo(side * size * 0.08, -size * 0.33)
    ctx.lineTo(side * size * 0.24, -size * 0.2)
    ctx.lineTo(side * size * 0.1, size * 0.02)
    ctx.closePath()
    ctx.fill()
    for (let rib = 0; rib < 6; rib += 1) {
      ctx.strokeStyle = 'rgba(244,63,94,0.26)'
      ctx.beginPath()
      ctx.moveTo(side * size * (0.1 + rib * 0.035), -size * (0.31 - rib * 0.04))
      ctx.lineTo(side * size * (0.33 - rib * 0.018), -size * (0.18 - rib * 0.038))
      ctx.stroke()
    }
  }
}

export function drawGalacticSnakeBoss(ctx: CanvasRenderingContext2D, size: number, time: number, redEyeWarning = false, hideHead = false) {
  const seconds = time / 1000
  ctx.save()

  drawRadialEllipse(ctx, 0, size * 0.03, size * 0.64, size * 0.88, [
    [0, 'rgba(225,29,72,0.11)'],
    [0.42, 'rgba(251,146,60,0.07)'],
    [1, 'rgba(0,0,0,0)'],
  ])
  drawBossDust(ctx, size, 'rgba(244,63,94,ALPHA)', 34, 8.2, 0.68, 0.96)

  const bodyPoints: Vec[] = []
  for (let i = 0; i < 88; i += 1) {
    const p = i / 87
    const travel = seconds * 4.05
    const tailBlend = Math.pow(1 - p, 0.54)
    const neckTether = 1 - Math.pow(p, 3.1) * 0.88
    const waveA = Math.sin(p * Math.PI * 5.8 - travel)
    const waveB = Math.sin(p * Math.PI * 11.4 - travel * 1.38) * 0.32
    const waveC = Math.sin(seconds * 1.5 + p * Math.PI * 2.2) * 0.16
    const slitherAmplitude = size * (0.17 * tailBlend + Math.sin(p * Math.PI) * 0.035)
    bodyPoints.push({
      x: (waveA + waveB + waveC) * slitherAmplitude * neckTether,
      y: size * 0.9 - p * size * 1.1 + Math.cos(p * Math.PI * 5.8 - travel) * size * (0.032 * tailBlend + 0.008),
    })
  }

  const cobraTexture = getCobraBossBodyTextureCanvas()
  if (hideHead) {
    ctx.globalCompositeOperation = 'source-over'
    for (let coil = 0; coil < 5; coil += 1) {
      const p = coil / 4
      const coilSize = size * (0.24 - p * 0.028)
      const y = size * (0.16 - p * 0.085)
      drawCobraTexturedBodySegment(
        ctx,
        cobraTexture,
        Math.sin(seconds * 2.6 + coil) * size * 0.018,
        y,
        coilSize,
        coilSize * 0.44,
        Math.sin(seconds + coil) * 0.18,
        time,
        coil,
        true,
      )
    }
    ctx.globalCompositeOperation = 'lighter'
    drawRadialEllipse(ctx, 0, -size * 0.09, size * 0.2, size * 0.12, [
      [0, 'rgba(244,63,94,0.34)'],
      [0.48, 'rgba(251,146,60,0.18)'],
      [1, 'rgba(251,146,60,0)'],
    ])
    ctx.restore()
    return
  }

  drawCobraBodyConnector(ctx, bodyPoints, size, redEyeWarning)
  for (let i = 0; i < bodyPoints.length - 1; i += 1) {
    const point = bodyPoints[i]
    const next = bodyPoints[i + 1]
    const p = i / (bodyPoints.length - 1)
    const angle = Math.atan2(next.y - point.y, next.x - point.x)
    const segmentSize = size * (0.036 + p * 0.062 + Math.sin(p * Math.PI) * 0.012)
    const scale = 1 + Math.sin(seconds * 4.4 + i * 0.55) * 0.095
    drawCobraTexturedBodySegment(ctx, cobraTexture, point.x, point.y, segmentSize * 1.3 * scale, segmentSize * 0.74 * scale, angle + Math.PI / 2, time, i, redEyeWarning)
    if (i % 2 === 0) {
      ctx.strokeStyle = 'rgba(255,205,218,0.42)'
      ctx.beginPath()
      ctx.ellipse(point.x, point.y, segmentSize * 0.44, segmentSize * 0.26, angle + Math.PI / 2, 0, Math.PI * 2)
      ctx.stroke()
    }
    if (i % 5 === 0) {
      drawRadialEllipse(ctx, point.x + Math.cos(angle + Math.PI / 2) * segmentSize * 0.48, point.y + Math.sin(angle + Math.PI / 2) * segmentSize * 0.48, segmentSize * 0.18, segmentSize * 0.18, [
        [0, 'rgba(255,255,255,0.7)'],
        [0.34, 'rgba(244,63,94,0.72)'],
        [1, 'rgba(244,63,94,0)'],
      ])
    }
    if (i % 4 === 1) {
      ctx.strokeStyle = 'rgba(2,6,23,0.52)'
      ctx.lineWidth = Math.max(0.8, size * 0.003)
      ctx.beginPath()
      ctx.moveTo(point.x - Math.cos(angle) * segmentSize * 0.45, point.y - Math.sin(angle) * segmentSize * 0.45)
      ctx.lineTo(point.x + Math.cos(angle) * segmentSize * 0.45, point.y + Math.sin(angle) * segmentSize * 0.45)
      ctx.stroke()
    }
  }
  drawCobraPointedTail(ctx, bodyPoints[0], bodyPoints[1], size, redEyeWarning)

  ctx.strokeStyle = 'rgba(251,146,60,0.2)'
  ctx.lineWidth = Math.max(1, size * 0.004)
  for (let i = 8; i < 58; i += 5) {
    const point = bodyPoints[i]
    ctx.beginPath()
    ctx.arc(point.x, point.y, size * 0.032, 0, Math.PI * 2)
    ctx.stroke()
  }

  if (!hideHead) {
  const cobraHead = getCobraBossCanvasSprite()
  if (cobraHead.loaded && cobraHead.image.complete) {
    drawCobraBossHead(ctx, size * 0.88, time, redEyeWarning)
  } else {
  drawSnakeHoodFlaps(ctx, size)
  const hoodGradient = ctx.createRadialGradient(-size * 0.04, -size * 0.36, 1, 0, -size * 0.2, size * 0.34)
  hoodGradient.addColorStop(0, '#fff7ad')
  hoodGradient.addColorStop(0.26, '#a3a3a3')
  hoodGradient.addColorStop(0.58, '#1f2937')
  hoodGradient.addColorStop(1, '#030712')
  ctx.fillStyle = hoodGradient
  ctx.strokeStyle = 'rgba(254,243,199,0.86)'
  ctx.lineWidth = Math.max(2, size * 0.011)
  ctx.shadowColor = 'rgba(0,0,0,0.76)'
  ctx.shadowBlur = size * 0.024
  ctx.beginPath()
  ctx.moveTo(0, -size * 0.52)
  ctx.bezierCurveTo(size * 0.2, -size * 0.47, size * 0.24, -size * 0.22, size * 0.12, size * 0.08)
  ctx.bezierCurveTo(size * 0.06, size * 0.2, -size * 0.06, size * 0.2, -size * 0.12, size * 0.08)
  ctx.bezierCurveTo(-size * 0.24, -size * 0.22, -size * 0.2, -size * 0.47, 0, -size * 0.52)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.shadowBlur = 0

  ctx.fillStyle = 'rgba(2,6,23,0.72)'
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(side * size * 0.06, -size * 0.35)
    ctx.lineTo(side * size * 0.19, -size * 0.22)
    ctx.lineTo(side * size * 0.08, -size * 0.04)
    ctx.closePath()
    ctx.fill()
  }

  for (let row = 0; row < 10; row += 1) {
    const y = -size * 0.4 + row * size * 0.045
    const count = 1 + Math.min(row + 1, 5)
    for (let i = 0; i < count; i += 1) {
      const x = (i - (count - 1) / 2) * size * 0.042
      ctx.strokeStyle = row % 2 === 0 ? 'rgba(255,205,218,0.58)' : 'rgba(244,63,94,0.35)'
      ctx.lineWidth = Math.max(0.8, size * 0.0035)
      ctx.beginPath()
      ctx.ellipse(x, y, size * 0.019, size * 0.014, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  drawEtchedPanelLine(ctx, [[0, -0.5], [-0.04, -0.39], [0.03, -0.28], [-0.02, -0.16], [0.04, -0.04]], size, 'rgba(254,243,199,0.35)', 0.004)
  drawEtchedPanelLine(ctx, [[0, -0.5], [0.04, -0.39], [-0.03, -0.28], [0.02, -0.16], [-0.04, -0.04]], size, 'rgba(2,6,23,0.55)', 0.0045)


  ctx.globalCompositeOperation = 'source-over'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (let scale = 5; scale < bodyPoints.length - 8; scale += 4) {
    const point = bodyPoints[scale]
    const next = bodyPoints[Math.min(bodyPoints.length - 1, scale + 1)]
    const p = scale / (bodyPoints.length - 1)
    const angle = Math.atan2(next.y - point.y, next.x - point.x) + Math.PI / 2
    const w = size * (0.052 - p * 0.018)
    const h = size * (0.018 - p * 0.004)
    const scalePlate = ctx.createRadialGradient(point.x - w * 0.3, point.y - h * 0.5, 1, point.x, point.y, w)
    scalePlate.addColorStop(0, '#fef3c7')
    scalePlate.addColorStop(0.34, '#7c4a18')
    scalePlate.addColorStop(0.74, '#111827')
    scalePlate.addColorStop(1, '#020617')
    ctx.fillStyle = scalePlate
    ctx.strokeStyle = scale % 8 === 1 ? 'rgba(251,191,36,0.64)' : 'rgba(148,163,184,0.34)'
    ctx.lineWidth = Math.max(0.8, size * 0.0029)
    ctx.beginPath()
    ctx.ellipse(point.x, point.y, w, h, angle, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }

  for (const side of [-1, 1]) {
    const hoodTrim = ctx.createLinearGradient(side * size * 0.08, -size * 0.46, side * size * 0.45, size * 0.1)
    hoodTrim.addColorStop(0, 'rgba(254,243,199,0.72)')
    hoodTrim.addColorStop(0.48, 'rgba(244,63,94,0.28)')
    hoodTrim.addColorStop(1, 'rgba(2,6,23,0.66)')
    ctx.strokeStyle = hoodTrim
    ctx.lineWidth = Math.max(1.4, size * 0.005)
    ctx.beginPath()
    ctx.moveTo(side * size * 0.1, -size * 0.38)
    ctx.bezierCurveTo(side * size * 0.34, -size * 0.26, side * size * 0.33, -size * 0.02, side * size * 0.15, size * 0.12)
    ctx.stroke()
    for (let node = 0; node < 4; node += 1) {
      drawRadialEllipse(ctx, side * size * (0.15 + node * 0.045), -size * (0.34 - node * 0.105), size * 0.014, size * 0.014, [
        [0, 'rgba(255,255,255,0.84)'],
        [0.42, 'rgba(248,113,113,0.68)'],
        [1, 'rgba(248,113,113,0)'],
      ])
    }
  }

  ctx.strokeStyle = 'rgba(254,243,199,0.92)'
  ctx.lineWidth = Math.max(1.7, size * 0.007)
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(side * size * 0.052, size * 0.06)
    ctx.lineTo(side * size * 0.08, size * 0.28)
    ctx.lineTo(side * size * 0.022, size * 0.115)
    ctx.stroke()
  }

  ctx.globalCompositeOperation = 'lighter'
  for (const side of [-1, 1]) {
    drawRadialEllipse(ctx, side * size * 0.07, -size * 0.16, size * (redEyeWarning ? 0.066 : 0.048), size * (redEyeWarning ? 0.07 : 0.052), [
      [0, 'rgba(255,255,255,0.95)'],
      [0.18, redEyeWarning ? 'rgba(254,202,202,1)' : 'rgba(251,191,36,0.95)'],
      [0.5, redEyeWarning ? 'rgba(239,68,68,1)' : 'rgba(249,115,22,0.62)'],
      [1, redEyeWarning ? 'rgba(153,27,27,0)' : 'rgba(249,115,22,0)'],
    ])
    ctx.fillStyle = redEyeWarning ? '#7f1d1d' : '#0f172a'
    ctx.beginPath()
    ctx.ellipse(side * size * 0.07, -size * 0.16, size * 0.009, size * 0.026, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.strokeStyle = 'rgba(254,243,199,0.75)'
  ctx.lineWidth = Math.max(1.5, size * 0.008)
  ctx.beginPath()
  ctx.moveTo(-size * 0.05, size * 0.05)
  ctx.quadraticCurveTo(-size * 0.04, size * 0.16, -size * 0.12, size * 0.26)
  ctx.moveTo(size * 0.05, size * 0.05)
  ctx.quadraticCurveTo(size * 0.04, size * 0.16, size * 0.12, size * 0.26)
  ctx.moveTo(-size * 0.035, size * 0.04)
  ctx.lineTo(-size * 0.07, size * 0.16)
  ctx.moveTo(size * 0.035, size * 0.04)
  ctx.lineTo(size * 0.07, size * 0.16)
  ctx.stroke()
  drawReferenceSnakeBossDetails(ctx, size, time)
  drawReferenceSnakeBossFinishPass(ctx, size, time)
  drawSnakeTerrorHead(ctx, size, time, redEyeWarning)
  }
  } else {
    ctx.globalCompositeOperation = 'source-over'
    const neck = ctx.createRadialGradient(0, -size * 0.12, 1, 0, -size * 0.04, size * 0.28)
    neck.addColorStop(0, '#fde68a')
    neck.addColorStop(0.24, '#be123c')
    neck.addColorStop(0.62, '#3b0615')
    neck.addColorStop(1, '#050108')
    ctx.fillStyle = neck
    ctx.strokeStyle = 'rgba(244,63,94,0.52)'
    ctx.lineWidth = Math.max(1.5, size * 0.006)
    ctx.beginPath()
    ctx.ellipse(0, -size * 0.08, size * 0.18, size * 0.13, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.globalCompositeOperation = 'lighter'
    drawRadialEllipse(ctx, 0, -size * 0.08, size * 0.12, size * 0.07, [
      [0, 'rgba(244,63,94,0.34)'],
      [0.55, 'rgba(251,146,60,0.18)'],
      [1, 'rgba(251,146,60,0)'],
    ])
  }
  ctx.restore()
}
