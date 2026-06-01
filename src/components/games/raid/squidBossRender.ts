import { drawCanvasSpriteContain, getCachedCanvasPattern, getCanvasSpriteDimensions, getSquidBossCanvasSprite } from './assets'
import { BOSS_COLORS } from './constants'
import { clamp, drawRadialEllipse } from './utils'

export const squidBossTentacleTextureCache = new Map<string, HTMLCanvasElement>()

export function drawBossDust(ctx: CanvasRenderingContext2D, size: number, color: string, count: number, seed: number, spreadX = 0.7, spreadY = 0.7) {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < count; i += 1) {
    const a = (i + 1) * 12.9898 + seed
    const b = (i + 1) * 78.233 + seed * 0.37
    const x = (Math.sin(a) * 0.5 + Math.sin(a * 0.43) * 0.5) * size * spreadX
    const y = (Math.cos(b) * 0.5 + Math.sin(b * 0.31) * 0.5) * size * spreadY
    const alpha = 0.18 + ((i * 17) % 9) * 0.035
    ctx.fillStyle = color.replace('ALPHA', alpha.toFixed(2))
    ctx.beginPath()
    ctx.arc(x, y, Math.max(0.8, size * (0.0035 + (i % 3) * 0.0018)), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

export function drawEtchedPanelLine(ctx: CanvasRenderingContext2D, points: Array<[number, number]>, size: number, color: string, width = 0.004) {
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(0.8, size * width)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x * size, y * size)
    else ctx.lineTo(x * size, y * size)
  })
  ctx.stroke()
}

export function drawSquidIntegratedFin(ctx: CanvasRenderingContext2D, size: number, side: number) {
  const fin = ctx.createLinearGradient(side * size * 0.12, -size * 0.34, side * size * 0.54, size * 0.04)
  fin.addColorStop(0, 'rgba(76,18,115,0.62)')
  fin.addColorStop(0.32, 'rgba(88,28,135,0.92)')
  fin.addColorStop(0.72, 'rgba(49,12,78,0.94)')
  fin.addColorStop(1, 'rgba(12,3,24,0.98)')

  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = fin
  ctx.strokeStyle = 'rgba(216,180,254,0.78)'
  ctx.lineWidth = Math.max(1.5, size * 0.006)
  ctx.beginPath()
  ctx.moveTo(side * size * 0.13, -size * 0.39)
  ctx.bezierCurveTo(side * size * 0.26, -size * 0.42, side * size * 0.46, -size * 0.29, side * size * 0.55, -size * 0.13)
  ctx.bezierCurveTo(side * size * 0.49, size * 0.02, side * size * 0.36, size * 0.12, side * size * 0.21, size * 0.04)
  ctx.bezierCurveTo(side * size * 0.15, -size * 0.01, side * size * 0.13, -size * 0.22, side * size * 0.13, -size * 0.39)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  const root = ctx.createLinearGradient(side * size * 0.1, -size * 0.34, side * size * 0.24, size * 0.08)
  root.addColorStop(0, 'rgba(5,0,16,0.82)')
  root.addColorStop(0.5, 'rgba(24,4,42,0.5)')
  root.addColorStop(1, 'rgba(5,0,16,0)')
  ctx.fillStyle = root
  ctx.beginPath()
  ctx.moveTo(side * size * 0.12, -size * 0.36)
  ctx.bezierCurveTo(side * size * 0.2, -size * 0.26, side * size * 0.22, -size * 0.05, side * size * 0.18, size * 0.08)
  ctx.bezierCurveTo(side * size * 0.13, size * 0.03, side * size * 0.11, -size * 0.18, side * size * 0.12, -size * 0.36)
  ctx.fill()

  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = 'rgba(244,114,182,0.38)'
  ctx.lineWidth = Math.max(1, size * 0.0035)
  ctx.beginPath()
  ctx.moveTo(side * size * 0.18, -size * 0.34)
  ctx.bezierCurveTo(side * size * 0.32, -size * 0.29, side * size * 0.43, -size * 0.18, side * size * 0.5, -size * 0.06)
  ctx.stroke()
  ctx.restore()
}

export function drawReferenceSquidBossFinishPass(ctx: CanvasRenderingContext2D, size: number, time: number) {
  const seconds = time / 1000
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'

  const outer = ctx.createLinearGradient(0, -size * 0.78, 0, size * 0.28)
  outer.addColorStop(0, '#f0abfc')
  outer.addColorStop(0.18, '#a21caf')
  outer.addColorStop(0.48, '#581c87')
  outer.addColorStop(0.78, '#2e1065')
  outer.addColorStop(1, '#05000a')
  ctx.fillStyle = outer
  ctx.strokeStyle = 'rgba(232,121,249,0.95)'
  ctx.lineWidth = Math.max(2.2, size * 0.01)
  ctx.beginPath()
  ctx.moveTo(0, -size * 0.82)
  ctx.lineTo(size * 0.2, -size * 0.46)
  ctx.bezierCurveTo(size * 0.32, -size * 0.18, size * 0.31, size * 0.16, size * 0.14, size * 0.31)
  ctx.lineTo(0, size * 0.38)
  ctx.lineTo(-size * 0.14, size * 0.31)
  ctx.bezierCurveTo(-size * 0.31, size * 0.16, -size * 0.32, -size * 0.18, -size * 0.2, -size * 0.46)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  for (const side of [-1, 1]) {
    drawSquidIntegratedFin(ctx, size, side)
  }

  ctx.globalCompositeOperation = 'lighter'
  drawRadialEllipse(ctx, 0, -size * 0.08, size * 0.09, size * 0.23, [
    [0, 'rgba(255,255,255,0.98)'],
    [0.2, 'rgba(254,240,138,0.96)'],
    [0.52, 'rgba(249,115,22,0.96)'],
    [1, 'rgba(124,45,18,0.05)'],
  ])
  ctx.strokeStyle = 'rgba(20,6,28,0.96)'
  ctx.lineWidth = Math.max(2.5, size * 0.013)
  ctx.beginPath()
  ctx.moveTo(0, -size * 0.27)
  ctx.lineTo(0, size * 0.1)
  ctx.stroke()

  ctx.fillStyle = 'rgba(163,230,53,0.9)'
  for (let i = 0; i < 96; i += 1) {
    const band = Math.floor(i / 16)
    const col = i % 16
    const x = (col - 7.5) * size * 0.021
    const y = -size * 0.56 + band * size * 0.09 + Math.abs(col - 7.5) * size * 0.012
    if (Math.abs(x) > size * (0.155 + band * 0.012)) continue
    ctx.beginPath()
    ctx.arc(x, y, Math.max(0.9, size * 0.0046), 0, Math.PI * 2)
    ctx.fill()
  }

  for (const side of [-1, 1]) {
    for (let arm = 0; arm < 4; arm += 1) {
      const startX = side * size * (0.06 + arm * 0.045)
      const endX = side * size * (0.16 + arm * 0.075 + Math.sin(seconds * 1.3 + arm) * 0.025)
      const endY = size * (0.4 + arm * 0.09)
      ctx.strokeStyle = arm < 2 ? 'rgba(88,28,135,0.94)' : 'rgba(190,24,93,0.82)'
      ctx.lineWidth = Math.max(2.4, size * (0.021 - arm * 0.0022))
      ctx.beginPath()
      ctx.moveTo(startX, size * 0.2)
      ctx.bezierCurveTo(side * size * 0.16, size * 0.3, side * size * (0.02 + arm * 0.05), size * 0.4, endX, endY)
      ctx.stroke()
      if (arm % 2 === 0) {
        drawRadialEllipse(ctx, endX, endY, size * 0.048, size * 0.048, [
          [0, 'rgba(255,255,255,0.95)'],
          [0.34, 'rgba(244,114,182,0.92)'],
          [1, 'rgba(244,114,182,0)'],
        ])
      }
    }
  }
  ctx.restore()
}

export function drawReferenceSquidBossDetails(ctx: CanvasRenderingContext2D, size: number, time: number) {
  const seconds = time / 1000
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'

  const mantle = ctx.createLinearGradient(0, -size * 0.68, 0, size * 0.28)
  mantle.addColorStop(0, '#f0abfc')
  mantle.addColorStop(0.16, '#8b5cf6')
  mantle.addColorStop(0.48, '#581c87')
  mantle.addColorStop(0.78, '#2e1065')
  mantle.addColorStop(1, '#090211')
  ctx.fillStyle = mantle
  ctx.strokeStyle = 'rgba(232,121,249,0.86)'
  ctx.lineWidth = Math.max(1.8, size * 0.008)
  ctx.beginPath()
  ctx.moveTo(0, -size * 0.73)
  ctx.bezierCurveTo(size * 0.21, -size * 0.55, size * 0.32, -size * 0.1, size * 0.16, size * 0.3)
  ctx.bezierCurveTo(size * 0.06, size * 0.43, -size * 0.06, size * 0.43, -size * 0.16, size * 0.3)
  ctx.bezierCurveTo(-size * 0.32, -size * 0.1, -size * 0.21, -size * 0.55, 0, -size * 0.73)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  for (const side of [-1, 1]) {
    drawSquidIntegratedFin(ctx, size, side)
  }

  ctx.globalCompositeOperation = 'lighter'
  drawRadialEllipse(ctx, 0, -size * 0.1, size * 0.09, size * 0.22, [
    [0, 'rgba(255,255,255,0.96)'],
    [0.22, 'rgba(254,240,138,0.94)'],
    [0.56, 'rgba(249,115,22,0.9)'],
    [1, 'rgba(190,24,93,0.12)'],
  ])
  ctx.strokeStyle = 'rgba(15,23,42,0.9)'
  ctx.lineWidth = Math.max(2, size * 0.012)
  ctx.beginPath()
  ctx.moveTo(0, -size * 0.27)
  ctx.lineTo(0, size * 0.08)
  ctx.stroke()

  ctx.fillStyle = 'rgba(163,230,53,0.86)'
  for (let i = 0; i < 78; i += 1) {
    const row = i % 13
    const col = Math.floor(i / 13)
    const x = (row - 6) * size * 0.024 + Math.sin(col * 0.9 + seconds) * size * 0.006
    const y = -size * 0.5 + col * size * 0.095 + Math.abs(row - 6) * size * 0.012
    if (Math.abs(x) > size * (0.16 + col * 0.012)) continue
    ctx.beginPath()
    ctx.arc(x, y, Math.max(0.8, size * 0.0048), 0, Math.PI * 2)
    ctx.fill()
  }

  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i += 1) {
      const baseX = side * size * (0.12 + i * 0.045)
      const tipX = side * size * (0.26 + i * 0.07 + Math.sin(seconds * 1.7 + i) * 0.025)
      const tipY = size * (0.45 + i * 0.1)
      ctx.strokeStyle = i === 0 ? 'rgba(88,28,135,0.88)' : 'rgba(157,23,77,0.8)'
      ctx.lineWidth = Math.max(3.2, size * (0.018 - i * 0.002))
      ctx.beginPath()
      ctx.moveTo(baseX, size * 0.18)
      ctx.bezierCurveTo(side * size * 0.18, size * 0.3, side * size * 0.08, size * 0.38, tipX, tipY)
      ctx.stroke()
      if (i !== 1) {
        drawRadialEllipse(ctx, tipX, tipY, size * 0.055, size * 0.055, [
          [0, 'rgba(255,255,255,0.92)'],
          [0.32, 'rgba(244,114,182,0.9)'],
          [1, 'rgba(244,114,182,0)'],
        ])
      }
    }
  }
  ctx.restore()
}

export function drawSquidWhipStrike(ctx: CanvasRenderingContext2D, x: number, y: number, targetX: number, targetY: number, size: number, time: number, chargeTimer: number) {
  const chargeDuration = 0.9
  const warm = clamp(1 - chargeTimer / chargeDuration, 0, 1)
  const side = targetX < x ? -1 : 1
  const reachSize = Math.min(size, 380)
  const baseX = x + side * reachSize * 0.22
  const baseY = y + size * 0.08
  const tipY = y + (targetY - y) * (0.62 + warm * 0.38)
  const tipX = x + clamp(targetX - x, -reachSize * 0.78, reachSize * 0.78) + Math.sin(time / 90) * reachSize * 0.025
  const warningPulse = 0.55 + Math.sin(time / 70) * 0.2
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = `rgba(251,113,133,${0.38 + warningPulse * 0.28})`
  ctx.fillStyle = `rgba(251,113,133,${0.08 + warm * 0.1})`
  ctx.lineWidth = Math.max(2, reachSize * 0.01)
  ctx.beginPath()
  ctx.ellipse(targetX, targetY, reachSize * 0.095, reachSize * 0.058, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.strokeStyle = `rgba(255,255,255,${0.18 + warm * 0.36})`
  ctx.beginPath()
  ctx.moveTo(targetX - reachSize * 0.06, targetY)
  ctx.lineTo(targetX + reachSize * 0.06, targetY)
  ctx.moveTo(targetX, targetY - reachSize * 0.045)
  ctx.lineTo(targetX, targetY + reachSize * 0.045)
  ctx.stroke()

  const c1x = x + side * reachSize * 0.42
  const c1y = y + reachSize * 0.18
  const c2x = tipX - side * reachSize * 0.2
  const c2y = y + (targetY - y) * 0.7
  const pointAt = (t: number) => {
    const inv = 1 - t
    return {
      x: inv * inv * inv * baseX + 3 * inv * inv * t * c1x + 3 * inv * t * t * c2x + t * t * t * tipX,
      y: inv * inv * inv * baseY + 3 * inv * inv * t * c1y + 3 * inv * t * t * c2y + t * t * t * tipY,
    }
  }
  const tangentAt = (t: number) => {
    const inv = 1 - t
    const dx =
      3 * inv * inv * (c1x - baseX) +
      6 * inv * t * (c2x - c1x) +
      3 * t * t * (tipX - c2x)
    const dy =
      3 * inv * inv * (c1y - baseY) +
      6 * inv * t * (c2y - c1y) +
      3 * t * t * (tipY - c2y)
    return Math.atan2(dy, dx)
  }

  ctx.globalCompositeOperation = 'source-over'
  for (let i = 0; i <= 26; i += 1) {
    const t = i / 26
    const p = pointAt(t)
    const angle = tangentAt(t)
    const taper = Math.pow(1 - t, 0.74)
    const radius = reachSize * (0.047 * taper + 0.008)
    const pulse = 1 + Math.sin(time / 95 + i * 0.62) * 0.045
    const body = ctx.createRadialGradient(p.x - radius * 0.25, p.y - radius * 0.35, 1, p.x, p.y, radius * 1.35)
    body.addColorStop(0, '#f9a8d4')
    body.addColorStop(0.24, '#be185d')
    body.addColorStop(0.58, '#581c87')
    body.addColorStop(1, '#17051f')
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(angle)
    ctx.fillStyle = body
    ctx.strokeStyle = `rgba(251,113,133,${0.34 + warm * 0.28})`
    ctx.lineWidth = Math.max(0.9, reachSize * 0.0028)
    ctx.beginPath()
    ctx.ellipse(0, 0, radius * 1.38 * pulse, radius * 0.86, 0, 0, Math.PI * 2)
    ctx.fill()
    if (i % 3 === 0) ctx.stroke()
    ctx.restore()
  }

  ctx.globalCompositeOperation = 'lighter'
  for (let i = 2; i <= 23; i += 3) {
    const t = i / 26
    const p = pointAt(t)
    const angle = tangentAt(t)
    const taper = Math.pow(1 - t, 0.8)
    const ringW = reachSize * (0.036 * taper + 0.006)
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(angle)
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(244,114,182,0.56)' : 'rgba(216,180,254,0.42)'
    ctx.lineWidth = Math.max(1, reachSize * 0.003)
    ctx.beginPath()
    ctx.ellipse(0, 0, ringW * 1.22, ringW * 0.46, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  for (let i = 4; i <= 22; i += 3) {
    const t = i / 26
    const p = pointAt(t)
    const angle = tangentAt(t)
    const normal = angle + Math.PI / 2
    const sideOffset = (i % 2 === 0 ? 1 : -1) * reachSize * (0.018 + (1 - t) * 0.012)
    drawRadialEllipse(ctx, p.x + Math.cos(normal) * sideOffset, p.y + Math.sin(normal) * sideOffset, reachSize * (0.012 + (1 - t) * 0.006), reachSize * 0.008, [
      [0, 'rgba(255,255,255,0.78)'],
      [0.42, 'rgba(251,113,133,0.62)'],
      [1, 'rgba(251,113,133,0)'],
    ])
  }

  const tipAngle = tangentAt(0.98)
  const clawLength = reachSize * 0.078
  const clawSpread = reachSize * 0.038
  const clawBaseX = tipX - Math.cos(tipAngle) * reachSize * 0.018
  const clawBaseY = tipY - Math.sin(tipAngle) * reachSize * 0.018
  ctx.save()
  ctx.translate(clawBaseX, clawBaseY)
  ctx.rotate(tipAngle)
  ctx.fillStyle = 'rgba(255,241,242,0.92)'
  ctx.strokeStyle = 'rgba(88,28,135,0.9)'
  ctx.lineWidth = Math.max(1.2, reachSize * 0.004)
  for (const clawSide of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(0, clawSide * clawSpread * 0.18)
    ctx.quadraticCurveTo(clawLength * 0.55, clawSide * clawSpread, clawLength, clawSide * clawSpread * 0.18)
    ctx.quadraticCurveTo(clawLength * 0.5, clawSide * clawSpread * 0.34, clawLength * 0.12, 0)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(0, -clawSpread * 0.22)
  ctx.lineTo(clawLength * 1.12, 0)
  ctx.lineTo(0, clawSpread * 0.22)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()
  ctx.restore()
}

export function drawReferenceSquidBossPaintPass(ctx: CanvasRenderingContext2D, size: number, time: number) {
  const seconds = time / 1000
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'

  ctx.globalCompositeOperation = 'lighter'
  const pulse = 0.65 + Math.sin(seconds * 3.4) * 0.18
  for (let i = 0; i < 38; i += 1) {
    const side = i % 2 === 0 ? -1 : 1
    const row = Math.floor(i / 2)
    const x = side * size * (0.055 + (row % 5) * 0.026)
    const y = -size * 0.46 + row * size * 0.035
    if (Math.abs(x) > size * (0.16 + row * 0.002) || y > size * 0.2) continue
      drawRadialEllipse(ctx, x, y, size * 0.012, size * 0.012, [
        [0, `rgba(255,255,255,${0.58 * pulse})`],
        [0.42, `rgba(253,224,71,${0.56 * pulse})`],
        [0.7, `rgba(217,70,239,${0.44 * pulse})`],
        [1, 'rgba(217,70,239,0)'],
      ])
  }

  ctx.strokeStyle = 'rgba(244,114,182,0.38)'
  ctx.lineWidth = Math.max(0.9, size * 0.003)
  for (const side of [-1, 1]) {
    for (let tentacle = 0; tentacle < 4; tentacle += 1) {
      const baseX = side * size * (0.03 + tentacle * 0.045)
      const startY = size * (0.23 + tentacle * 0.012)
      for (let sucker = 0; sucker < 6; sucker += 1) {
        const p = sucker / 5
        const x = baseX + side * Math.sin(p * Math.PI + tentacle) * size * 0.055 + side * p * size * (0.1 + tentacle * 0.025)
        const y = startY + p * size * (0.48 + tentacle * 0.08)
        ctx.beginPath()
        ctx.ellipse(x, y, size * 0.011, size * 0.006, side * 0.5, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  }
  ctx.restore()
}

export function drawSquidTerrorEye(ctx: CanvasRenderingContext2D, size: number, time: number) {
  const seconds = time / 1000
  const pulse = 0.84 + Math.sin(seconds * 4.8) * 0.12
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = 'rgba(3,0,10,0.94)'
  ctx.strokeStyle = 'rgba(244,114,182,0.9)'
  ctx.lineWidth = Math.max(2.2, size * 0.012)
  ctx.beginPath()
  ctx.ellipse(0, -size * 0.13, size * 0.155, size * 0.25, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  const eye = ctx.createRadialGradient(-size * 0.035, -size * 0.19, 1, 0, -size * 0.13, size * 0.19)
  eye.addColorStop(0, `rgba(255,255,255,${0.95 * pulse})`)
  eye.addColorStop(0.18, `rgba(254,240,138,${0.96 * pulse})`)
  eye.addColorStop(0.46, `rgba(249,115,22,${0.92 * pulse})`)
  eye.addColorStop(0.72, 'rgba(190,24,93,0.78)')
  eye.addColorStop(1, 'rgba(20,2,20,0.98)')
  ctx.fillStyle = eye
  ctx.beginPath()
  ctx.ellipse(0, -size * 0.13, size * 0.115, size * 0.205, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = 'rgba(2,6,23,0.96)'
  ctx.beginPath()
  ctx.ellipse(0, -size * 0.13, size * 0.024, size * 0.17, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.72)'
  ctx.lineWidth = Math.max(1, size * 0.004)
  ctx.beginPath()
  ctx.ellipse(0, -size * 0.13, size * 0.122, size * 0.212, 0, 0, Math.PI * 2)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(244,114,182,0.58)'
  ctx.lineWidth = Math.max(1, size * 0.004)
  for (let vein = 0; vein < 18; vein += 1) {
    const side = vein % 2 === 0 ? -1 : 1
    const startY = -size * (0.28 - (vein % 6) * 0.045)
    ctx.beginPath()
    ctx.moveTo(side * size * 0.04, startY)
    ctx.quadraticCurveTo(side * size * (0.12 + (vein % 4) * 0.028), startY + size * 0.025, side * size * (0.2 + (vein % 3) * 0.028), startY + size * 0.09)
    ctx.stroke()
  }

  ctx.fillStyle = 'rgba(250,232,255,0.86)'
  ctx.strokeStyle = 'rgba(88,28,135,0.8)'
  for (const side of [-1, 1]) {
    for (let fang = 0; fang < 4; fang += 1) {
      const x = side * size * (0.04 + fang * 0.038)
      const y = size * (0.08 + fang * 0.012)
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + side * size * 0.026, y + size * 0.095)
      ctx.lineTo(x - side * size * 0.012, y + size * 0.03)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
  }
  ctx.restore()
}

export function drawSquidBossSpriteBody(ctx: CanvasRenderingContext2D, size: number, time: number) {
  const sprite = getSquidBossCanvasSprite()
  if (!sprite.loaded || !sprite.image.complete) {
    for (const side of [-1, 1]) {
      drawSquidIntegratedFin(ctx, size, side)
    }
    drawReferenceSquidBossDetails(ctx, size, time)
    drawReferenceSquidBossFinishPass(ctx, size, time)
    drawReferenceSquidBossPaintPass(ctx, size, time)
    drawSquidTerrorEye(ctx, size, time)
    return
  }

  const bodySize = size * 0.94
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.72)'
  ctx.shadowBlur = size * 0.026
  drawCanvasSpriteContain(ctx, sprite, 0, -size * 0.055, bodySize, 'brightness(1.06) contrast(1.12) saturate(1.08)', 1, 0, 1, BOSS_COLORS.squid)
  ctx.restore()
}

export function getSquidBossTentacleTextureCanvas() {
  if (typeof document === 'undefined') return null
  const sprite = getSquidBossCanvasSprite()
  if (!sprite.loaded || !sprite.image.complete) return null
  const { source, width, height } = getCanvasSpriteDimensions(sprite)
  if (width <= 0 || height <= 0) return null

  const cacheKey = `${sprite.cacheKey}:tentacle-texture:${Math.round(width)}x${Math.round(height)}`
  const cached = squidBossTentacleTextureCache.get(cacheKey)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = 192
  canvas.height = 192
  const textureCtx = canvas.getContext('2d')
  if (!textureCtx) return null

  textureCtx.fillStyle = '#15051f'
  textureCtx.fillRect(0, 0, canvas.width, canvas.height)
  textureCtx.imageSmoothingEnabled = true
  textureCtx.imageSmoothingQuality = 'high'
  textureCtx.drawImage(source, width * 0.18, height * 0.38, width * 0.64, height * 0.48, 0, 0, canvas.width, canvas.height)
  textureCtx.globalCompositeOperation = 'screen'
  textureCtx.globalAlpha = 0.42
  textureCtx.drawImage(source, width * 0.28, height * 0.5, width * 0.44, height * 0.34, canvas.width * 0.04, canvas.height * 0.08, canvas.width * 0.92, canvas.height * 0.84)
  textureCtx.globalAlpha = 1
  textureCtx.globalCompositeOperation = 'multiply'
  textureCtx.fillStyle = 'rgba(48,8,72,0.18)'
  textureCtx.fillRect(0, 0, canvas.width, canvas.height)
  textureCtx.globalCompositeOperation = 'source-over'

  squidBossTentacleTextureCache.set(cacheKey, canvas)
  return canvas
}

export function drawGalacticSquidBoss(ctx: CanvasRenderingContext2D, size: number, time: number) {
  const seconds = time / 1000
  ctx.save()

  drawRadialEllipse(ctx, 0, size * 0.08, size * 0.62, size * 0.9, [
    [0, 'rgba(168,85,247,0.1)'],
    [0.48, 'rgba(88,28,135,0.08)'],
    [1, 'rgba(0,0,0,0)'],
  ])
  drawBossDust(ctx, size, 'rgba(217,70,239,ALPHA)', 26, 3.7, 0.74, 0.92)

  const tentacleTexture = getSquidBossTentacleTextureCanvas()
  const drawSegmentedTentacle = (baseX: number, baseY: number, tipX: number, tipY: number, side: number, phase: number, thick: number, bulb = false, attackCurl = false, curveScale = 1) => {
    ctx.save()
    const reachSize = Math.min(size, 320)
    const sway = Math.sin(seconds * 2.1 + phase) * reachSize * 0.04
    const c1x = baseX + side * reachSize * 0.16
    const c1y = baseY + reachSize * 0.18
    const c2x = tipX - side * reachSize * 0.14 + sway
    const c2y = attackCurl ? tipY + reachSize * (bulb ? 0.13 : 0.1) : tipY - reachSize * 0.12
    const endX = tipX + sway
    const endY = attackCurl ? tipY - reachSize * (bulb ? 0.2 : 0.16) : tipY + reachSize * 0.04
    const sCurve = side * reachSize * (bulb ? 0.15 : 0.12) * curveScale
    const rawPointAt = (t: number) => {
      const inv = 1 - t
      return {
        x: inv * inv * inv * baseX + 3 * inv * inv * t * c1x + 3 * inv * t * t * c2x + t * t * t * endX,
        y: inv * inv * inv * baseY + 3 * inv * inv * t * c1y + 3 * inv * t * t * c2y + t * t * t * endY,
      }
    }
    const pointAt = (t: number) => {
      const raw = rawPointAt(t)
      const sWave = Math.sin(t * Math.PI * 2) * Math.sin(t * Math.PI) * sCurve
      const lift = -Math.sin(t * Math.PI) * reachSize * (bulb ? 0.055 : 0.045)
      return {
        x: raw.x + sWave,
        y: raw.y + lift,
      }
    }
    const tangentAt = (t: number) => {
      const prev = pointAt(clamp(t - 0.015, 0, 1))
      const next = pointAt(clamp(t + 0.015, 0, 1))
      return Math.atan2(next.y - prev.y, next.x - prev.x)
    }

    ctx.globalCompositeOperation = 'source-over'
    for (let segment = 0; segment <= 22; segment += 1) {
      const p = segment / 22
      const point = pointAt(p)
      const angle = tangentAt(p)
      const taper = Math.pow(1 - p, 0.72)
      const radius = reachSize * (thick * 1.2 * taper + 0.007)
      const pulse = 1 + Math.sin(seconds * 3.2 + phase + segment * 0.44) * 0.04
      const body = ctx.createRadialGradient(point.x - radius * 0.25, point.y - radius * 0.35, 1, point.x, point.y, radius * 1.35)
      body.addColorStop(0, '#f5d0fe')
      body.addColorStop(0.2, '#d946ef')
      body.addColorStop(0.58, '#7e22ce')
      body.addColorStop(1, '#16051f')
      ctx.save()
      ctx.translate(point.x, point.y)
      ctx.rotate(angle)
      ctx.fillStyle = body
      ctx.strokeStyle = 'rgba(232,121,249,0.46)'
      ctx.lineWidth = Math.max(0.9, reachSize * 0.0026)
      ctx.beginPath()
      ctx.ellipse(0, 0, radius * 1.34 * pulse, radius * 0.86, 0, 0, Math.PI * 2)
      ctx.fill()
      if (tentacleTexture) {
        ctx.save()
        ctx.beginPath()
        ctx.ellipse(0, 0, radius * 1.26 * pulse, radius * 0.78, 0, 0, Math.PI * 2)
        ctx.clip()
        const pattern = getCachedCanvasPattern(ctx, tentacleTexture)
        if (pattern) {
          const scrollX = ((phase * 47 + segment * 11 + time / 100) % tentacleTexture.width) - tentacleTexture.width
          const scrollY = ((phase * 31 + segment * 7 + time / 155) % tentacleTexture.height) - tentacleTexture.height
          ctx.globalAlpha *= 0.72
          ctx.translate(scrollX, scrollY)
          ctx.fillStyle = pattern
          ctx.fillRect(-radius * 3 - scrollX, -radius * 3 - scrollY, radius * 6, radius * 6)
        }
        ctx.restore()
      }
      if (segment % 3 === 0) ctx.stroke()
      ctx.restore()
    }

    ctx.globalCompositeOperation = 'lighter'
    for (let ring = 2; ring <= 20; ring += 3) {
      const p = ring / 22
      const point = pointAt(p)
      const angle = tangentAt(p)
      const ringW = reachSize * (thick * 0.92 * Math.pow(1 - p, 0.8) + 0.005)
      ctx.save()
      ctx.translate(point.x, point.y)
      ctx.rotate(angle)
      ctx.strokeStyle = ring % 2 === 0 ? 'rgba(244,114,182,0.54)' : 'rgba(217,70,239,0.42)'
      ctx.lineWidth = Math.max(1, reachSize * 0.0028)
      ctx.beginPath()
      ctx.ellipse(0, 0, ringW * 1.24, ringW * 0.46, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    for (let sucker = 4; sucker <= 19; sucker += 3) {
      const p = sucker / 22
      const point = pointAt(p)
      const normal = tangentAt(p) + Math.PI / 2
      const offset = (sucker % 2 === 0 ? 1 : -1) * reachSize * (0.014 + (1 - p) * 0.012)
      drawRadialEllipse(ctx, point.x + Math.cos(normal) * offset, point.y + Math.sin(normal) * offset, reachSize * (0.01 + (1 - p) * 0.005), reachSize * 0.007, [
        [0, 'rgba(255,255,255,0.78)'],
        [0.36, 'rgba(253,224,71,0.58)'],
        [0.68, 'rgba(244,114,182,0.48)'],
        [1, 'rgba(217,70,239,0)'],
      ])
    }
    if (bulb) {
      drawRadialEllipse(ctx, endX, endY, reachSize * 0.05, reachSize * 0.042, [
        [0, 'rgba(255,255,255,0.94)'],
        [0.25, 'rgba(253,224,71,0.82)'],
        [0.58, 'rgba(217,70,239,0.64)'],
        [1, 'rgba(126,34,206,0)'],
      ])
    }
    const tipAngle = tangentAt(1)
    const clawLength = reachSize * (bulb ? 0.072 : 0.056)
    const clawWidth = reachSize * (bulb ? 0.035 : 0.027)
    ctx.save()
    ctx.translate(endX, endY)
    ctx.rotate(tipAngle)
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = '#fae8ff'
    ctx.strokeStyle = 'rgba(244,114,182,0.78)'
    ctx.lineWidth = Math.max(1, reachSize * 0.0032)
    ctx.beginPath()
    ctx.moveTo(clawLength, 0)
    ctx.quadraticCurveTo(clawLength * 0.16, -clawWidth, -clawLength * 0.34, -clawWidth * 0.46)
    ctx.quadraticCurveTo(clawLength * 0.03, 0, -clawLength * 0.34, clawWidth * 0.46)
    ctx.quadraticCurveTo(clawLength * 0.16, clawWidth, clawLength, 0)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = 'rgba(253,224,71,0.44)'
    ctx.beginPath()
    ctx.moveTo(-clawLength * 0.1, 0)
    ctx.lineTo(clawLength * 0.62, 0)
    ctx.stroke()
    ctx.restore()
    ctx.restore()
  }

  const longTentacles = [
    [-0.24, 0.09, -0.5, -0.12, -1, 0.8, 0.03, true, true, 1.05],
    [0.24, 0.09, 0.5, -0.12, 1, 1.2, 0.03, true, true, 1.05],
    [-0.2, 0.13, -0.43, 0.42, -1, 1.7, 0.024, false, false, 0.72],
    [0.2, 0.13, 0.43, 0.42, 1, 2.2, 0.024, false, false, 0.72],
    [-0.11, 0.16, -0.24, 0.64, -1, 2.8, 0.021, true, false, 0.52],
    [0.11, 0.16, 0.24, 0.64, 1, 3.2, 0.021, true, false, 0.52],
    [-0.035, 0.17, -0.09, 0.78, -1, 3.7, 0.019, false, false, 0.34],
    [0.035, 0.17, 0.09, 0.78, 1, 4.1, 0.019, false, false, 0.34],
  ] as const
  const reachSize = Math.min(size, 320)
  for (const [baseX, baseY, tipX, tipY, side, phase, thick, bulb, attackCurl, curveScale] of longTentacles) {
    drawSegmentedTentacle(baseX * size, baseY * size, tipX * reachSize, tipY * reachSize, side, phase, thick, bulb, attackCurl, curveScale)
  }

  drawSquidBossSpriteBody(ctx, size, time)
  ctx.restore()
}
