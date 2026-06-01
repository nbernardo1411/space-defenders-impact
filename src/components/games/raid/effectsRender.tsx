import { RAID_DERELICT_WRECK_FILTER, RAID_DEVIL_RETICLE_GLOW_STOPS, RAID_SPIEGEL_SHADOW_CLONE_FILTER, RAID_SPIEGEL_SHADOW_CLONE_IMPACT_STOPS, drawCanvasImageContain, drawCanvasSpriteContain, getDerelictWreckCanvasSprite, getDerelictWreckVariantIndex, getGodGundamBarrageCanvasSprite, getRaidOtherCanvasSprite, getShipCanvasSprite } from './assets'
import type { CachedCanvasDrawSource } from './assets'
import { PICKUP_VOICE_SAMPLE_URLS } from './audio'
import { forEachDevilBossBeamLane, forEachFinalBossBeamLane, getDevilBossBeamRadius, getDevilBossChargeDuration, getFinalBossBeamRadius } from './bossAttacks'
import { FINAL_BOSS_BEAM_CHARGE_SECONDS, GOD_GUNDAM_BARRAGE_FRAME_SECONDS, HEIGHT, NUKE_FLASH_SECONDS, SPIEGEL_SHADOW_CLONE_VISUAL_ALPHA_MULTIPLIER, WIDTH } from './constants'
import { getRandomEventLabel } from './events'
import { COMET_ASSET_HEAD_ANGLE, DEG } from './constants'
import { drawPowerPickupIcon, traceRegularPolygon } from './playerRender'
import { getCoreLanderBarrageEnergyColor, getCoreLanderBarrageFilter, getCoreLanderBarrageImpactStops, getCoreLanderBarragePoseScale, getCoreLanderBarrageSequence, getCoreLanderBarrageShadowColor, getGodGundamGameplayRenderSize, powerColor, powerGlyph, shouldMirrorCoreLanderBarragePose } from './state'
import type { AsteroidHazard, DerelictWreck, Enemy, GodGundamBarrage, GodGundamPassiveStrike, IonStrike, MeteorHazard, NukeStrike, PowerKind, PowerUp, RaidRandomEvent } from './types'
import { clamp, drawRadialEllipse, getCanvasCacheScale, traceRoundedRect, trimOldestMapEntry } from './utils'

export const homingMissileSpriteCache = new Map<number, HTMLCanvasElement>()

export const coreBlastSpriteCache = new Map<string, HTMLCanvasElement>()

export const powerPickupMagnetGlowSpriteCache = new Map<string, CachedCanvasDrawSource>()

export const godBarrageDrawTargetsScratch: Enemy[] = []

export const godBarrageDamageTargetsScratch: Enemy[] = []

export function getHomingMissileSprite(visualScale: number) {
  const spriteScale = Math.max(0.75, Math.min(1.55, Math.round(visualScale * 20) / 20))
  const cached = homingMissileSpriteCache.get(spriteScale)
  if (cached) return cached

  const length = 22 * spriteScale
  const widthPx = 8 * spriteScale
  const pad = 18 * spriteScale
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(widthPx * 5 + pad * 2)
  canvas.height = Math.ceil(length * 1.7 + pad * 2)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.shadowBlur = 13 * spriteScale
  ctx.shadowColor = 'rgba(250,204,21,0.9)'
  ctx.fillStyle = 'rgba(20,8,8,0.95)'
  ctx.strokeStyle = 'rgba(250,204,21,0.9)'
  ctx.lineWidth = 1.5 * spriteScale
  ctx.beginPath()
  ctx.moveTo(0, -length * 0.56)
  ctx.lineTo(widthPx * 0.55, length * 0.18)
  ctx.lineTo(widthPx * 0.2, length * 0.48)
  ctx.lineTo(0, length * 0.3)
  ctx.lineTo(-widthPx * 0.2, length * 0.48)
  ctx.lineTo(-widthPx * 0.55, length * 0.18)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  const flame = ctx.createLinearGradient(0, length * 0.22, 0, length * 0.88)
  flame.addColorStop(0, 'rgba(255,255,255,0.9)')
  flame.addColorStop(0.4, 'rgba(239,35,60,0.9)')
  flame.addColorStop(1, 'rgba(249,115,22,0)')
  ctx.shadowBlur = 10 * spriteScale
  ctx.shadowColor = 'rgba(239,35,60,0.72)'
  ctx.strokeStyle = flame
  ctx.lineWidth = 4 * spriteScale
  ctx.beginPath()
  ctx.moveTo(0, length * 0.2)
  ctx.lineTo(0, length * 0.86)
  ctx.stroke()

  homingMissileSpriteCache.set(spriteScale, canvas)
  return canvas
}

export function getNukePathPoint(strike: NukeStrike, progress: number) {
  const lift = 22 + Math.abs(strike.targetX - strike.startX) * 0.16
  const side = strike.targetX >= strike.startX ? 1 : -1
  const controlX = (strike.startX + strike.targetX) / 2 + side * 6
  const controlY = Math.min(strike.startY, strike.targetY) - lift
  const inv = 1 - progress
  return {
    x: inv * inv * strike.startX + 2 * inv * progress * controlX + progress * progress * strike.targetX,
    y: inv * inv * strike.startY + 2 * inv * progress * controlY + progress * progress * strike.targetY,
  }
}

export function getNukePathDerivative(strike: NukeStrike, progress: number) {
  const lift = 22 + Math.abs(strike.targetX - strike.startX) * 0.16
  const side = strike.targetX >= strike.startX ? 1 : -1
  const controlX = (strike.startX + strike.targetX) / 2 + side * 6
  const controlY = Math.min(strike.startY, strike.targetY) - lift
  return {
    x: 2 * (1 - progress) * (controlX - strike.startX) + 2 * progress * (strike.targetX - controlX),
    y: 2 * (1 - progress) * (controlY - strike.startY) + 2 * progress * (strike.targetY - controlY),
  }
}

export function drawNukeMissile(
  ctx: CanvasRenderingContext2D,
  strike: NukeStrike,
  toX: (value: number) => number,
  toY: (value: number) => number,
  viewportWidth: number,
  time: number,
) {
  const rawProgress = clamp(strike.age / strike.duration, 0, 1)
  const progress = 1 - Math.pow(1 - rawProgress, 2.2)
  const point = getNukePathPoint(strike, progress)
  const derivative = getNukePathDerivative(strike, progress)
  const x = toX(point.x)
  const y = toY(point.y)
  const dx = toX(point.x + derivative.x * 0.01) - x
  const dy = toY(point.y + derivative.y * 0.01) - y
  const angle = Math.atan2(dy, dx) + Math.PI / 2
  const missileLength = Math.max(24, Math.min(42, viewportWidth * 0.043))
  const missileWidth = missileLength * 0.34

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  for (let index = 0; index < 10; index += 1) {
    const next = Math.max(0, progress - index * 0.032)
    const prev = Math.max(0, progress - (index + 1) * 0.032)
    if (next <= 0 || next === prev) continue
    const a = getNukePathPoint(strike, prev)
    const b = getNukePathPoint(strike, next)
    const alpha = (1 - index / 10) * (0.5 + rawProgress * 0.35)
    ctx.strokeStyle = index < 4 ? `rgba(255,255,255,${alpha * 0.72})` : `rgba(249,115,22,${alpha * 0.58})`
    ctx.lineWidth = Math.max(1.5, missileWidth * (0.55 - index * 0.035))
    ctx.beginPath()
    ctx.moveTo(toX(a.x), toY(a.y))
    ctx.lineTo(toX(b.x), toY(b.y))
    ctx.stroke()
  }

  const targetX = toX(strike.targetX)
  const targetY = toY(strike.targetY)
  ctx.globalAlpha = Math.max(0, 1 - rawProgress * 0.9)
  ctx.strokeStyle = 'rgba(251,191,36,0.62)'
  ctx.lineWidth = 1.4
  ctx.setLineDash([5, 5])
  ctx.lineDashOffset = -time / 48
  ctx.beginPath()
  ctx.arc(targetX, targetY, 18 + Math.sin(time / 120) * 2, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.globalAlpha = 1

  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.shadowBlur = 18
  ctx.shadowColor = 'rgba(249,115,22,0.85)'

  const flame = ctx.createLinearGradient(0, missileLength * 0.18, 0, missileLength * 0.86)
  flame.addColorStop(0, 'rgba(255,255,255,0.95)')
  flame.addColorStop(0.22, 'rgba(251,191,36,0.9)')
  flame.addColorStop(0.58, 'rgba(239,35,60,0.82)')
  flame.addColorStop(1, 'rgba(239,35,60,0)')
  ctx.fillStyle = flame
  ctx.beginPath()
  ctx.moveTo(-missileWidth * 0.28, missileLength * 0.22)
  ctx.quadraticCurveTo(0, missileLength * (0.72 + Math.sin(time / 70) * 0.08), missileWidth * 0.28, missileLength * 0.22)
  ctx.closePath()
  ctx.fill()

  const body = ctx.createLinearGradient(-missileWidth * 0.6, 0, missileWidth * 0.6, 0)
  body.addColorStop(0, '#7f1d1d')
  body.addColorStop(0.32, '#f8fafc')
  body.addColorStop(0.56, '#fca5a5')
  body.addColorStop(1, '#1f2937')
  ctx.fillStyle = body
  ctx.strokeStyle = 'rgba(255,255,255,0.82)'
  ctx.lineWidth = 1.1
  ctx.beginPath()
  ctx.moveTo(0, -missileLength * 0.56)
  ctx.quadraticCurveTo(missileWidth * 0.48, -missileLength * 0.26, missileWidth * 0.42, missileLength * 0.24)
  ctx.lineTo(missileWidth * 0.2, missileLength * 0.46)
  ctx.lineTo(0, missileLength * 0.34)
  ctx.lineTo(-missileWidth * 0.2, missileLength * 0.46)
  ctx.lineTo(-missileWidth * 0.42, missileLength * 0.24)
  ctx.quadraticCurveTo(-missileWidth * 0.48, -missileLength * 0.26, 0, -missileLength * 0.56)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#ef233c'
  ctx.beginPath()
  ctx.moveTo(-missileWidth * 0.48, missileLength * 0.12)
  ctx.lineTo(-missileWidth * 0.98, missileLength * 0.4)
  ctx.lineTo(-missileWidth * 0.32, missileLength * 0.34)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(missileWidth * 0.48, missileLength * 0.12)
  ctx.lineTo(missileWidth * 0.98, missileLength * 0.4)
  ctx.lineTo(missileWidth * 0.32, missileLength * 0.34)
  ctx.closePath()
  ctx.fill()

  ctx.restore()
}

export function drawNukeBlast(ctx: CanvasRenderingContext2D, width: number, height: number, flashTime: number, time: number, originX?: number, originY?: number) {
  const strength = clamp(flashTime / NUKE_FLASH_SECONDS, 0, 1)
  if (strength <= 0) return

  const expansion = 1 - strength
  const centerX = (originX ?? width * 0.5) + Math.sin(time / 210) * width * 0.015
  const centerY = originY ?? height * 0.46
  const maxRadius = Math.max(width, height)

  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.fillStyle = `rgba(255, 246, 220, ${0.08 + strength * 0.22})`
  ctx.fillRect(0, 0, width, height)

  drawRadialEllipse(ctx, centerX, centerY, maxRadius * (0.18 + expansion * 0.78), maxRadius * (0.14 + expansion * 0.62), [
    [0, `rgba(255, 255, 255, ${0.86 * strength})`],
    [0.18, `rgba(251, 191, 36, ${0.66 * strength})`],
    [0.46, `rgba(239, 35, 60, ${0.36 * strength})`],
    [1, 'rgba(0,0,0,0)'],
  ])

  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  for (let index = 0; index < 3; index += 1) {
    const ringProgress = clamp(expansion * 1.25 - index * 0.16, 0, 1)
    if (ringProgress <= 0) continue
    const radius = maxRadius * (0.12 + ringProgress * (0.42 + index * 0.1))
    ctx.globalAlpha = (1 - ringProgress) * strength * (0.72 - index * 0.16)
    ctx.strokeStyle = index === 0 ? '#ffffff' : index === 1 ? '#fbbf24' : '#fb7185'
    ctx.lineWidth = Math.max(2, width * (0.004 + index * 0.001))
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.globalAlpha = Math.min(0.7, strength * 0.65)
  ctx.strokeStyle = 'rgba(255,255,255,0.72)'
  ctx.lineWidth = Math.max(1.5, width * 0.0025)
  for (let ray = 0; ray < 10; ray += 1) {
    const angle = (ray / 10) * Math.PI * 2 + time / 260
    const inner = maxRadius * (0.05 + expansion * 0.22)
    const outer = maxRadius * (0.34 + expansion * 0.54)
    ctx.beginPath()
    ctx.moveTo(centerX + Math.cos(angle) * inner, centerY + Math.sin(angle) * inner)
    ctx.lineTo(centerX + Math.cos(angle) * outer, centerY + Math.sin(angle) * outer)
    ctx.stroke()
  }
  ctx.restore()
}

export function drawGodGundamBarrage(
  ctx: CanvasRenderingContext2D,
  barrage: GodGundamBarrage,
  enemies: Enemy[],
  toX: (value: number) => number,
  toY: (value: number) => number,
  viewportWidth: number,
  time: number,
) {
  const durationFade = Math.min(1, barrage.age / 0.32, (barrage.duration - barrage.age) / 0.42)
  if (durationFade <= 0) return

  const model = barrage.model ?? 'godGundam'
  const sequence = getCoreLanderBarrageSequence(model)
  const burning = Boolean(barrage.burning)
  const barrageFilter = getCoreLanderBarrageFilter(model, burning)
  const impactStops = getCoreLanderBarrageImpactStops(model, burning)
  const energyColor = getCoreLanderBarrageEnergyColor(model, burning)
  const shadowColor = getCoreLanderBarrageShadowColor(model, burning)
  const visibleTargets = godBarrageDrawTargetsScratch
  visibleTargets.length = 0
  for (let index = 0; index < enemies.length; index += 1) {
    const enemy = enemies[index]
    if (enemy.hp > 0 && enemy.y > -18 && enemy.y < HEIGHT + 16) visibleTargets.push(enemy)
  }
  const visibleTargetCount = visibleTargets.length
  if (visibleTargetCount === 0) return

  const spriteSize = getGodGundamGameplayRenderSize(viewportWidth)
  const dashDuration = 0.46
  const dashProgress = clamp(barrage.age / dashDuration, 0, 1)
  if (dashProgress < 1) {
    const invDash = 1 - dashProgress
    const easedDash = 1 - invDash * invDash * invDash
    const startX = toX(barrage.startX)
    const startY = toY(barrage.startY)
    const endX = toX(barrage.targetX)
    const endY = toY(barrage.targetY)
    const x = startX + (endX - startX) * easedDash
    const y = startY + (endY - startY) * easedDash
    const angle = Math.atan2(endY - startY, endX - startX)
    const dashAlpha = Math.sin(dashProgress * Math.PI)
    const dashSprite = getShipCanvasSprite(model === 'godGundam' && burning ? 'godGundamBurning' : model)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = (model === 'spiegel' ? 0.42 : 0.72) * dashAlpha
    ctx.lineCap = 'round'
    if (model !== 'spiegel') {
      const trail = ctx.createLinearGradient(startX, startY, x, y)
      trail.addColorStop(0, 'rgba(250,204,21,0)')
      trail.addColorStop(0.42, 'rgba(250,204,21,0.28)')
      trail.addColorStop(1, 'rgba(255,255,255,0.78)')
      ctx.strokeStyle = trail
      ctx.lineWidth = Math.max(4, spriteSize * 0.08)
      ctx.beginPath()
      ctx.moveTo(startX, startY)
      ctx.lineTo(x, y)
      ctx.stroke()
    }
    ctx.translate(x, y)
    ctx.rotate(angle + Math.PI / 2)
    drawCanvasSpriteContain(ctx, dashSprite, 0, 0, spriteSize * 0.82, barrageFilter, 0.86 * dashAlpha, 0, 1, energyColor)
    ctx.restore()
  }

  const comboAge = Math.max(0, barrage.age - dashDuration * 0.45)
  let primaryIndex = 0
  for (let index = 0; index < visibleTargetCount; index += 1) {
    if (visibleTargets[index].id === barrage.targetId) {
      primaryIndex = index
      break
    }
  }
  const seedOffset = barrage.seed % 0.09
  const spriteScale = 1 / GOD_GUNDAM_BARRAGE_FRAME_SECONDS
  for (let drawIndex = 0; drawIndex < visibleTargetCount; drawIndex += 1) {
    const targetIndex = drawIndex === 0 ? primaryIndex : drawIndex <= primaryIndex ? drawIndex - 1 : drawIndex
    const target = visibleTargets[targetIndex]
    const targetX = toX(target.x)
    const targetRadiusX = Math.max(28, viewportWidth * (target.radius / WIDTH) * 0.72)
    const layers = target.isBoss ? 4 : target.isMiniBoss ? 3 : 2
    for (let layer = layers - 1; layer >= 0; layer -= 1) {
      const localAge = comboAge - drawIndex * 0.055 - layer * 0.105 + seedOffset
      if (localAge < 0) continue

      const frame = Math.floor(localAge * spriteScale)
      const pose = sequence[(frame + layer + drawIndex) % sequence.length]
      const frameProgress = (localAge % GOD_GUNDAM_BARRAGE_FRAME_SECONDS) * spriteScale
      const approachPrep = 1 - frameProgress / 0.72
      const approach = frameProgress < 0.72
        ? 1 - approachPrep * approachPrep * approachPrep
        : 1 - (frameProgress - 0.72) / 0.28 * 0.16
      const side = pose.side
      const attackSide = side === 0 ? ((frame + drawIndex) % 2 === 0 ? -1 : 1) : side
      const startX = targetX + attackSide * (targetRadiusX + spriteSize * (target.isBoss ? 0.5 : 0.38))
      const hitX = targetX + attackSide * targetRadiusX * 0.22
      const startY = toY(target.y + pose.offsetY) + Math.sin(time / 95 + frame * 1.7 + target.id) * spriteSize * 0.018
      const hitY = toY(target.y + pose.impactY)
      const x = startX + (hitX - startX) * approach
      const y = startY + (hitY - startY) * approach
      const alpha = durationFade * (1 - layer * 0.18) * Math.sin(Math.min(1, frameProgress) * Math.PI)
      if (alpha <= 0.02) continue

      if (frameProgress > 0.42 && frameProgress < 0.72) {
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        ctx.globalAlpha = alpha * 0.68
        drawRadialEllipse(ctx, hitX, hitY, spriteSize * 0.22, spriteSize * 0.14, impactStops)
        ctx.strokeStyle = 'rgba(255,255,255,0.72)'
        ctx.lineWidth = Math.max(1, spriteSize * 0.018)
        ctx.beginPath()
        ctx.moveTo(x + attackSide * spriteSize * 0.22, y - spriteSize * 0.04)
        ctx.lineTo(hitX - attackSide * spriteSize * 0.18, hitY)
        ctx.stroke()
        ctx.restore()
      }

      const sprite = getGodGundamBarrageCanvasSprite(model, pose.pose)
      const poseScale = getCoreLanderBarragePoseScale(model, pose.pose)
      ctx.save()
      ctx.translate(x, y)
      if (shouldMirrorCoreLanderBarragePose(model, attackSide)) ctx.scale(-1, 1)
      ctx.shadowBlur = Math.max(8, spriteSize * 0.08)
      ctx.shadowColor = shadowColor
      drawCanvasSpriteContain(ctx, sprite, 0, 0, spriteSize * (target.isBoss ? 1 : 0.86) * poseScale, barrageFilter, alpha, 0, 1, energyColor)
      ctx.restore()
    }
  }
}

export function drawGodGundamPassiveStrikes(
  ctx: CanvasRenderingContext2D,
  strikes: GodGundamPassiveStrike[],
  toX: (value: number) => number,
  toY: (value: number) => number,
  viewportWidth: number,
) {
  for (const clonePass of [true, false]) {
  for (const strike of strikes) {
    if (Boolean(strike.clone) !== clonePass) continue
    const model = strike.model ?? 'godGundam'
    const sequence = getCoreLanderBarrageSequence(model)
    const burning = Boolean(strike.burning)
    const clone = Boolean(strike.clone)
    const cloneFade = clone ? 0.28 * SPIEGEL_SHADOW_CLONE_VISUAL_ALPHA_MULTIPLIER : 1
    const forcedAttackSide = strike.attackSideOverride
    const strikeFilter = clone && model === 'spiegel' ? RAID_SPIEGEL_SHADOW_CLONE_FILTER : getCoreLanderBarrageFilter(model, burning)
    const impactStops = clone && model === 'spiegel' ? RAID_SPIEGEL_SHADOW_CLONE_IMPACT_STOPS : getCoreLanderBarrageImpactStops(model, burning)
    const energyColor = clone && model === 'spiegel' ? '#020617' : getCoreLanderBarrageEnergyColor(model, burning)
    const shadowColor = clone && model === 'spiegel' ? 'rgba(0,0,0,0.72)' : getCoreLanderBarrageShadowColor(model, burning)
    const spriteSize = getGodGundamGameplayRenderSize(viewportWidth) * Math.max(1, strike.size) * (clone ? 0.94 : 1)
    const targetRadius = Math.max(12, viewportWidth * (strike.targetRadius / WIDTH) * 0.78)
    const progress = clamp(strike.age / strike.duration, 0, 1)
    const fade = Math.sin(progress * Math.PI)
    if (fade <= 0.02) continue

    const startX = toX(strike.sourceX)
    const startY = toY(strike.sourceY)
    const hitX = toX(strike.x)
    const hitY = toY(strike.y)
    const baseSide = strike.side
    const layers = 3

    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = fade * (clone ? 0.14 : 0.48)
    if (model !== 'spiegel') {
      const trail = ctx.createLinearGradient(startX, startY, hitX, hitY)
      trail.addColorStop(0, 'rgba(250,204,21,0)')
      trail.addColorStop(0.38, burning ? 'rgba(251,146,60,0.22)' : 'rgba(250,204,21,0.18)')
      trail.addColorStop(1, 'rgba(255,255,255,0.44)')
      ctx.strokeStyle = trail
      ctx.lineWidth = Math.max(2.4, spriteSize * 0.038)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(startX, startY)
      ctx.quadraticCurveTo((startX + hitX) * 0.5, Math.min(startY, hitY) - spriteSize * 0.18, hitX, hitY)
      ctx.stroke()
    }
    if (progress > 0.18 && progress < 0.9) {
      ctx.save()
      ctx.globalAlpha *= clone ? 0.32 : 0.62
      drawRadialEllipse(ctx, hitX, hitY, targetRadius * (0.88 + progress * 0.18), targetRadius * 0.48, impactStops)
      ctx.restore()
    }
    ctx.restore()

    for (let layer = layers - 1; layer >= 0; layer -= 1) {
      const localProgress = clamp(progress * 1.18 - layer * 0.16, 0, 1)
      if (localProgress <= 0 || localProgress >= 1) continue
      const pose = sequence[((strike.id + layer) % sequence.length + sequence.length) % sequence.length]
      const attackSide = forcedAttackSide ?? (pose.side === 0 ? baseSide : pose.side)
      const prep = 1 - localProgress / 0.72
      const approach = localProgress < 0.72
        ? 1 - prep * prep * prep
        : 1 - (localProgress - 0.72) / 0.28 * 0.14
      const startAttackX = hitX + attackSide * (targetRadius + spriteSize * (0.36 + layer * 0.08))
      const forcedSourceOffsetY = forcedAttackSide && model === 'spiegel' ? clamp(toY(strike.sourceY) - hitY, -spriteSize * 0.42, spriteSize * 0.42) : 0
      const startAttackY = hitY + pose.offsetY * (viewportWidth / WIDTH) + forcedSourceOffsetY - spriteSize * 0.08 * layer
      const impactX = hitX + attackSide * targetRadius * 0.2
      const impactY = hitY + pose.impactY * (viewportWidth / WIDTH)
      const x = startAttackX + (impactX - startAttackX) * approach
      const y = startAttackY + (impactY - startAttackY) * approach
      const alpha = fade * (1 - layer * 0.18) * Math.sin(localProgress * Math.PI)
      if (alpha <= 0.02) continue

      if (localProgress > 0.38 && localProgress < 0.78) {
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        ctx.globalAlpha = alpha * (clone ? 0.16 : 0.32)
        drawRadialEllipse(ctx, impactX, impactY, spriteSize * 0.24, spriteSize * 0.14, impactStops)
        ctx.strokeStyle = 'rgba(255,255,255,0.36)'
        ctx.lineWidth = Math.max(1, spriteSize * 0.018)
        ctx.beginPath()
        ctx.moveTo(x + attackSide * spriteSize * 0.22, y - spriteSize * 0.04)
        ctx.lineTo(impactX - attackSide * spriteSize * 0.16, impactY)
        ctx.stroke()
        ctx.restore()
      }

      const sprite = getGodGundamBarrageCanvasSprite(model, pose.pose)
      const poseScale = getCoreLanderBarragePoseScale(model, pose.pose)
      ctx.save()
      ctx.translate(x, y)
      if (shouldMirrorCoreLanderBarragePose(model, attackSide)) ctx.scale(-1, 1)
      ctx.shadowBlur = Math.max(5, spriteSize * (clone ? 0.045 : 0.08))
      ctx.shadowColor = shadowColor
      drawCanvasSpriteContain(ctx, sprite, 0, 0, spriteSize * (1 + layer * 0.06) * poseScale, strikeFilter, alpha * cloneFade, 0, 1, energyColor)
      ctx.restore()
    }
  }
  }
}

export function drawAsteroidHazard(
  ctx: CanvasRenderingContext2D,
  asteroid: AsteroidHazard,
  toX: (value: number) => number,
  toY: (value: number) => number,
  viewportWidth: number,
  time: number,
) {
  const x = toX(asteroid.x)
  const y = toY(asteroid.y)
  const baseSize = asteroid.tier === 2 ? 280 : asteroid.tier === 1 ? 150 : 78
  const size = Math.max(30, Math.min(viewportWidth * (asteroid.tier === 2 ? 0.29 : asteroid.tier === 1 ? 0.16 : 0.085), baseSize))

  const asteroidSprite = getRaidOtherCanvasSprite('asteroid')
  if (asteroidSprite.loaded && asteroidSprite.image.complete) {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate((asteroid.spin + time * 0.012) * DEG)
    ctx.shadowBlur = asteroid.tier === 2 ? 16 : 8
    ctx.shadowColor = 'rgba(251,146,60,0.22)'
    const drewAsteroidImage = drawCanvasImageContain(ctx, asteroidSprite, 0, 0, size, size * 0.9, 'brightness(0.84) contrast(1.2) saturate(0.92)', 1)
    ctx.shadowBlur = 0
    ctx.restore()
    if (drewAsteroidImage) return
  }

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((asteroid.spin + time * 0.012) * DEG)
  ctx.shadowBlur = asteroid.tier === 2 ? 18 : 9
  ctx.shadowColor = 'rgba(251,146,60,0.22)'
  drawRadialEllipse(ctx, 0, 0, size * 0.46, size * 0.38, [
    [0, '#a8a29e'],
    [0.5, '#57534e'],
    [1, '#120f0d'],
  ])
  ctx.shadowBlur = 0

  ctx.restore()
}

export function drawAsteroidWarning(ctx: CanvasRenderingContext2D, width: number, height: number, warningTime: number, time: number) {
  if (warningTime <= 0) return

  const pulse = 0.72 + Math.sin(time / 120) * 0.18
  const panelWidth = Math.min(width * 0.84, 560)
  const x = (width - panelWidth) / 2
  const y = Math.max(76, height * 0.14)
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = clamp(warningTime / 0.4, 0, 1)
  ctx.fillStyle = 'rgba(24, 8, 8, 0.78)'
  ctx.strokeStyle = `rgba(251, 146, 60, ${pulse})`
  ctx.lineWidth = 2
  traceRoundedRect(ctx, x, y, panelWidth, 54, 8)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = `rgba(251, 191, 36, ${pulse})`
  ctx.font = `800 ${Math.max(14, Math.min(22, width * 0.035))}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('ASTEROID CLUSTER DETECTED. BEWARE!', width / 2, y + 27)
  ctx.restore()
}

export function drawRandomEventWarning(ctx: CanvasRenderingContext2D, width: number, height: number, event: RaidRandomEvent | null, time: number) {
  if (!event || event.warning <= 0) return

  const pulse = 0.68 + Math.sin(time / 105) * 0.2
  const panelWidth = Math.min(width * 0.86, 560)
  const x = (width - panelWidth) / 2
  const y = Math.max(132, height * 0.22)
  const color = event.kind === 'solar' ? 'rgba(251,191,36,' : event.kind === 'rift' ? 'rgba(168,85,247,' : event.kind === 'ion' ? 'rgba(103,232,249,' : 'rgba(251,113,133,'
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = clamp(event.warning / 0.45, 0, 1)
  ctx.fillStyle = 'rgba(2,6,23,0.78)'
  ctx.strokeStyle = `${color}${pulse})`
  ctx.lineWidth = 2
  traceRoundedRect(ctx, x, y, panelWidth, 50, 8)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = `${color}${Math.min(1, pulse + 0.12)})`
  ctx.font = `850 ${Math.max(13, Math.min(21, width * 0.032))}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(getRandomEventLabel(event.kind), width / 2, y + 25)
  ctx.restore()
}

export function drawMeteorHazard(
  ctx: CanvasRenderingContext2D,
  meteor: MeteorHazard,
  toX: (value: number) => number,
  toY: (value: number) => number,
  viewportWidth: number,
) {
  const x = toX(meteor.x)
  const y = toY(meteor.y)
  const size = Math.max(8, viewportWidth * 0.018 * meteor.radius)
  const tail = size * 4.8
  const cometSprite = getRaidOtherCanvasSprite('comet')
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  if (drawCanvasImageContain(ctx, cometSprite, x, y, size * 7.8, size * 3.8, 'brightness(1.2) contrast(1.18) saturate(1.14)', 0.9, Math.atan2(meteor.vy, meteor.vx) - COMET_ASSET_HEAD_ANGLE)) {
    ctx.restore()
    return
  }
  ctx.restore()
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(Math.atan2(meteor.vy, meteor.vx))
  const trail = ctx.createLinearGradient(-tail, 0, size, 0)
  trail.addColorStop(0, 'rgba(251,146,60,0)')
  trail.addColorStop(0.62, 'rgba(251,146,60,0.44)')
  trail.addColorStop(1, 'rgba(255,255,255,0.92)')
  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = trail
  ctx.lineWidth = Math.max(2, size * 0.46)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-tail, 0)
  ctx.lineTo(size * 0.6, 0)
  ctx.stroke()
  ctx.fillStyle = '#fef3c7'
  ctx.beginPath()
  ctx.arc(0, 0, size * 0.44, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function drawIonStrike(ctx: CanvasRenderingContext2D, strike: IonStrike, width: number, height: number, time: number) {
  const x = (strike.x / WIDTH) * width
  const laneWidth = Math.max(20, (strike.width / WIDTH) * width)
  const charging = strike.warmup > 0
  const pulse = 0.55 + Math.sin(time / 80 + strike.id) * 0.24
  ctx.save()
  ctx.globalCompositeOperation = charging ? 'source-over' : 'lighter'
  ctx.globalAlpha = charging ? 0.18 + pulse * 0.12 : 0.34 + pulse * 0.26
  const gradient = ctx.createLinearGradient(x - laneWidth, 0, x + laneWidth, 0)
  gradient.addColorStop(0, 'rgba(103,232,249,0)')
  gradient.addColorStop(0.45, charging ? 'rgba(103,232,249,0.36)' : 'rgba(255,255,255,0.78)')
  gradient.addColorStop(0.55, charging ? 'rgba(103,232,249,0.36)' : 'rgba(103,232,249,0.88)')
  gradient.addColorStop(1, 'rgba(103,232,249,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(x - laneWidth, 0, laneWidth * 2, height)
  ctx.strokeStyle = charging ? 'rgba(103,232,249,0.62)' : 'rgba(255,255,255,0.86)'
  ctx.lineWidth = charging ? 1.5 : 3
  ctx.beginPath()
  ctx.moveTo(x - laneWidth * 0.5, 0)
  ctx.lineTo(x + laneWidth * 0.18 + Math.sin(time / 70) * 14, height * 0.38)
  ctx.lineTo(x - laneWidth * 0.1, height)
  ctx.stroke()
  ctx.restore()
}

export function drawDerelictWreck(
  ctx: CanvasRenderingContext2D,
  wreck: DerelictWreck,
  toX: (value: number) => number,
  toY: (value: number) => number,
  viewportWidth: number,
  time: number,
) {
  const x = toX(wreck.x)
  const y = toY(wreck.y)
  const variant = getDerelictWreckVariantIndex(wreck.variant ?? wreck.id)
  const sprite = getDerelictWreckCanvasSprite(variant)
  const isMobile = viewportWidth <= 640
  const mobileScale = isMobile ? 1.95 : 1
  const w = Math.max(isMobile ? 200 : 90, (wreck.width / WIDTH) * viewportWidth * mobileScale)
  const h = Math.max(isMobile ? 116 : 54, (wreck.height / WIDTH) * viewportWidth * mobileScale)
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((wreck.rotation ?? 0) + Math.sin(time / 1300 + wreck.phase) * 0.08)
  ctx.shadowBlur = 14
  ctx.shadowColor = 'rgba(239,68,68,0.28)'
  const drewSprite = drawCanvasImageContain(ctx, sprite, 0, 0, w, h, RAID_DERELICT_WRECK_FILTER, 0.92)
  if (!drewSprite) {
    const hull = ctx.createLinearGradient(-w * 0.5, -h * 0.5, w * 0.5, h * 0.5)
    hull.addColorStop(0, '#94a3b8')
    hull.addColorStop(0.42, '#334155')
    hull.addColorStop(1, '#020617')
    ctx.fillStyle = hull
    ctx.beginPath()
    ctx.ellipse(0, 0, w * 0.48, h * 0.36, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

export function drawRandomEventOverlay(ctx: CanvasRenderingContext2D, width: number, height: number, event: RaidRandomEvent | null, time: number) {
  if (!event || event.warning > 0) return
  const progress = clamp(event.age / Math.max(0.1, event.duration), 0, 1)
  ctx.save()
  if (event.kind === 'solar') {
    const strength = Math.sin(progress * Math.PI)
    ctx.globalCompositeOperation = 'screen'
    ctx.globalAlpha = 0.1 + strength * 0.26
    ctx.fillStyle = 'rgba(251,191,36,0.58)'
    ctx.fillRect(0, 0, width, height)
    drawRadialEllipse(ctx, width * 0.82, height * 0.12, width * 0.42, height * 0.28, [[0, `rgba(255,255,255,${0.3 * strength})`], [1, 'rgba(0,0,0,0)']])
  } else if (event.kind === 'rift') {
    const wobble = Math.sin(time / 180 + event.seed) * width * 0.04
    const x = width * 0.5 + wobble
    const y = height * 0.38 + Math.cos(time / 260 + event.seed) * height * 0.08
    ctx.globalCompositeOperation = 'screen'
    drawRadialEllipse(ctx, x, y, width * 0.18, height * 0.2, [[0, 'rgba(255,255,255,0.22)'], [0.28, 'rgba(168,85,247,0.36)'], [1, 'rgba(0,0,0,0)']])
    ctx.globalAlpha = 0.42
    ctx.strokeStyle = 'rgba(216,180,254,0.65)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(x, y, width * 0.12, height * 0.045, time / 520, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

export const POWER_PICKUP_SPRITE_FRAMES = 16

export const POWER_PICKUP_SPIN_BUCKETS = 8

export const powerPickupSpriteCache = new Map<string, HTMLCanvasElement>()

export function getPowerPickupSpriteScale() {
  if (typeof window === 'undefined') return 2
  return clamp(window.devicePixelRatio || 1, 1, 2.5)
}

export function getPowerPickupSprite(type: PowerKind, size: number, phaseBucket: number, spinBucket: number) {
  const normalizedSize = Math.round(size)
  const normalizedPhase = ((phaseBucket % POWER_PICKUP_SPRITE_FRAMES) + POWER_PICKUP_SPRITE_FRAMES) % POWER_PICKUP_SPRITE_FRAMES
  const normalizedSpin = ((spinBucket % POWER_PICKUP_SPIN_BUCKETS) + POWER_PICKUP_SPIN_BUCKETS) % POWER_PICKUP_SPIN_BUCKETS
  const spriteScale = getPowerPickupSpriteScale()
  const scaledBucket = Math.round(spriteScale * 10) / 10
  const cacheKey = `${type}|${normalizedSize}|${normalizedPhase}|${normalizedSpin}|${scaledBucket}`
  const cached = powerPickupSpriteCache.get(cacheKey)
  if (cached) return cached

  const color = powerColor(type)
  const phase = (normalizedPhase / POWER_PICKUP_SPRITE_FRAMES) * Math.PI * 2
  const spinRotation = (normalizedSpin / POWER_PICKUP_SPIN_BUCKETS) * Math.PI * 2 * 0.42
  const pulse = 0.92 + Math.sin(phase * 2.62) * 0.08
  const ringRadius = normalizedSize * 0.54 * pulse
  const canvasSize = Math.ceil(normalizedSize * 2.45)
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(canvasSize * spriteScale)
  canvas.height = Math.ceil(canvasSize * spriteScale)
  const spriteCtx = canvas.getContext('2d')
  if (!spriteCtx) return canvas

  spriteCtx.scale(spriteScale, spriteScale)
  spriteCtx.translate(canvasSize / 2, canvasSize / 2)
  spriteCtx.globalCompositeOperation = 'lighter'
  drawRadialEllipse(spriteCtx, 0, 0, normalizedSize * 0.9, normalizedSize * 0.74, [
    [0, 'rgba(255,255,255,0.2)'],
    [0.28, color],
    [1, 'rgba(0,0,0,0)'],
  ])

  for (let index = 0; index < 3; index += 1) {
    const angle = phase * 1.8 + index * Math.PI * 2 / 3
    const dotRadius = normalizedSize * (0.035 + index * 0.004)
    spriteCtx.fillStyle = index === 0 ? '#ffffff' : color
    spriteCtx.globalAlpha = 0.78
    spriteCtx.shadowBlur = 12
    spriteCtx.shadowColor = color
    spriteCtx.beginPath()
    spriteCtx.arc(Math.cos(angle) * normalizedSize * 0.58, Math.sin(angle) * normalizedSize * 0.58, dotRadius, 0, Math.PI * 2)
    spriteCtx.fill()
  }

  spriteCtx.save()
  spriteCtx.rotate(spinRotation)
  spriteCtx.globalCompositeOperation = 'lighter'
  spriteCtx.globalAlpha = 1
  spriteCtx.shadowBlur = 20
  spriteCtx.shadowColor = color

  const shell = spriteCtx.createRadialGradient(-normalizedSize * 0.15, -normalizedSize * 0.22, normalizedSize * 0.04, 0, 0, normalizedSize * 0.55)
  shell.addColorStop(0, 'rgba(255,255,255,0.98)')
  shell.addColorStop(0.16, color)
  shell.addColorStop(0.34, 'rgba(255,255,255,0.16)')
  shell.addColorStop(0.42, 'rgba(5,8,14,0.94)')
  shell.addColorStop(0.74, 'rgba(5,8,14,0.9)')
  shell.addColorStop(0.82, color)
  shell.addColorStop(1, 'rgba(0,0,0,0)')
  spriteCtx.fillStyle = shell
  traceRegularPolygon(spriteCtx, 6, normalizedSize * 0.5, -Math.PI / 2 + Math.sin(phase) * 0.08)
  spriteCtx.fill()

  spriteCtx.strokeStyle = color
  spriteCtx.lineWidth = 1.4
  spriteCtx.globalAlpha = 0.9
  traceRegularPolygon(spriteCtx, 6, normalizedSize * 0.5, -Math.PI / 2 + Math.sin(phase) * 0.08)
  spriteCtx.stroke()
  spriteCtx.restore()

  spriteCtx.lineWidth = Math.max(2, normalizedSize * 0.055)
  spriteCtx.lineCap = 'round'
  for (let index = 0; index < 4; index += 1) {
    const start = phase * 1.25 + index * Math.PI * 0.5
    spriteCtx.strokeStyle = index % 2 === 0 ? color : 'rgba(255,255,255,0.74)'
    spriteCtx.globalAlpha = index % 2 === 0 ? 0.86 : 0.56
    spriteCtx.beginPath()
    spriteCtx.arc(0, 0, ringRadius, start, start + Math.PI * 0.22)
    spriteCtx.stroke()
  }

  spriteCtx.globalCompositeOperation = 'source-over'
  spriteCtx.globalAlpha = 1
  const core = spriteCtx.createRadialGradient(-normalizedSize * 0.1, -normalizedSize * 0.12, 1, 0, 0, normalizedSize * 0.28)
  core.addColorStop(0, 'rgba(255,255,255,0.92)')
  core.addColorStop(0.2, color)
  core.addColorStop(0.52, '#111827')
  core.addColorStop(1, '#03050a')
  spriteCtx.fillStyle = core
  spriteCtx.strokeStyle = color
  spriteCtx.shadowBlur = 10
  spriteCtx.shadowColor = color
  spriteCtx.beginPath()
  spriteCtx.arc(0, 0, normalizedSize * 0.29, 0, Math.PI * 2)
  spriteCtx.fill()
  spriteCtx.stroke()

  spriteCtx.save()
  spriteCtx.globalCompositeOperation = 'lighter'
  drawPowerPickupIcon(spriteCtx, type, normalizedSize, color, phase)
  spriteCtx.restore()

  spriteCtx.fillStyle = '#ffffff'
  spriteCtx.shadowBlur = 8
  spriteCtx.shadowColor = color
  spriteCtx.font = `1000 ${Math.max(13, normalizedSize * 0.32)}px system-ui, sans-serif`
  spriteCtx.textAlign = 'center'
  spriteCtx.textBaseline = 'middle'
  spriteCtx.fillText(powerGlyph(type), 0, normalizedSize * 0.01)

  if (powerPickupSpriteCache.size >= 480) {
    const oldestKey = powerPickupSpriteCache.keys().next().value
    if (oldestKey) powerPickupSpriteCache.delete(oldestKey)
  }
  powerPickupSpriteCache.set(cacheKey, canvas)
  return canvas
}

export function warmPowerPickupSpriteCache() {
  if (typeof document === 'undefined') return
  const types = Object.keys(PICKUP_VOICE_SAMPLE_URLS) as PowerKind[]
  for (const size of [42, 50]) {
    for (const type of types) {
      getPowerPickupMagnetGlowSprite(type, Math.ceil(size * 2.45))
      for (let frame = 0; frame < POWER_PICKUP_SPRITE_FRAMES; frame += 1) {
        getPowerPickupSprite(type, size, frame, 0)
      }
    }
  }
}

export function getPowerPickupMagnetGlowSprite(type: PowerKind, drawSize: number): CachedCanvasDrawSource | null {
  if (typeof document === 'undefined') return null
  const normalizedSize = Math.max(1, Math.round(drawSize))
  const spriteScale = getCanvasCacheScale()
  const scaledBucket = Math.round(spriteScale * 10) / 10
  const cacheKey = `pickup-magnet|${type}|${normalizedSize}|${scaledBucket}`
  const cached = powerPickupMagnetGlowSpriteCache.get(cacheKey)
  if (cached) return cached

  const radius = normalizedSize * 0.72
  const width = Math.ceil(radius * 2)
  const height = width
  const originX = width / 2
  const originY = height / 2
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(width * spriteScale))
  canvas.height = Math.max(1, Math.ceil(height * spriteScale))
  const glowCtx = canvas.getContext('2d')
  if (!glowCtx) return null
  glowCtx.scale(spriteScale, spriteScale)
  const color = powerColor(type)
  const glow = glowCtx.createRadialGradient(originX, originY, normalizedSize * 0.1, originX, originY, radius)
  glow.addColorStop(0, 'rgba(255,255,255,0.72)')
  glow.addColorStop(0.34, color)
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  glowCtx.fillStyle = glow
  glowCtx.beginPath()
  glowCtx.arc(originX, originY, radius, 0, Math.PI * 2)
  glowCtx.fill()

  const entry = { canvas, width, height, originX, originY }
  trimOldestMapEntry(powerPickupMagnetGlowSpriteCache, 40)
  powerPickupMagnetGlowSpriteCache.set(cacheKey, entry)
  return entry
}

export function drawPowerUpCanvas(
  ctx: CanvasRenderingContext2D,
  powerUp: PowerUp,
  toX: (value: number) => number,
  toY: (value: number) => number,
  viewportWidth: number,
  time: number,
) {
  const x = toX(powerUp.x)
  const y = toY(powerUp.y) + Math.sin(time / 620 + powerUp.id) * 3
  const size = viewportWidth < 860 ? 42 : 50
  const phase = time / 1000 + powerUp.id * 0.37
  const phaseBucket = Math.round((((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * POWER_PICKUP_SPRITE_FRAMES)
  const spinBucket = Math.round((((powerUp.spin % 360) + 360) % 360) / 360 * POWER_PICKUP_SPIN_BUCKETS)
  const sprite = getPowerPickupSprite(powerUp.type, size, phaseBucket, spinBucket)
  const drawSize = Math.ceil(size * 2.45)
  const magnetPulse = clamp(powerUp.magnet ?? 0, 0, 1)
  if (magnetPulse > 0.01) {
    const glowSprite = getPowerPickupMagnetGlowSprite(powerUp.type, drawSize)
    if (glowSprite) {
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = (0.18 + Math.sin(time / 130 + powerUp.id) * 0.045) * magnetPulse
      ctx.drawImage(glowSprite.canvas, x - glowSprite.originX, y - glowSprite.originY, glowSprite.width, glowSprite.height)
      ctx.restore()
    } else {
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = (0.18 + Math.sin(time / 130 + powerUp.id) * 0.045) * magnetPulse
      const color = powerColor(powerUp.type)
      const glow = ctx.createRadialGradient(x, y, drawSize * 0.1, x, y, drawSize * 0.72)
      glow.addColorStop(0, 'rgba(255,255,255,0.72)')
      glow.addColorStop(0.34, color)
      glow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(x, y, drawSize * 0.72, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }
  ctx.drawImage(sprite, x - drawSize / 2, y - drawSize / 2, drawSize, drawSize)
}

export function drawFinalChargeLines(
  ctx: CanvasRenderingContext2D,
  enemies: Enemy[],
  toX: (value: number) => number,
  viewportWidth: number,
  viewportHeight: number,
  time: number,
) {
  let hasFinalCharge = false
  for (const enemy of enemies) {
    if (enemy.bossKind === 'final' && enemy.chargeTimer > 0) {
      hasFinalCharge = true
      break
    }
  }
  if (!hasFinalCharge) return

  const toViewportY = (value: number) => (value / HEIGHT) * viewportHeight
  const drawWarningBeam = (x: number, y: number, angle: number, width: number, alpha: number, pulse: number) => {
    const length = Math.sqrt((viewportWidth) * (viewportWidth) + (viewportHeight) * (viewportHeight)) * 1.45
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)

    ctx.globalAlpha = alpha * 0.22
    ctx.fillStyle = 'rgba(34,211,238,1)'
    ctx.fillRect(-length / 2, -width * 0.7, length, width * 1.4)

    ctx.globalAlpha = alpha * 0.42
    ctx.fillStyle = 'rgba(96,165,250,1)'
    ctx.fillRect(-length / 2, -width / 2, length, width)

    ctx.globalAlpha = alpha * 0.72 * pulse
    ctx.fillStyle = 'rgba(255,255,255,1)'
    ctx.fillRect(-length / 2, -2, length, 4)

    ctx.globalAlpha = alpha * 0.86
    ctx.strokeStyle = time % 220 < 110 ? '#7dd3fc' : '#eff6ff'
    ctx.lineWidth = 2.5
    ctx.setLineDash([8, 10])
    ctx.beginPath()
    ctx.moveTo(-length / 2, -width * 0.5)
    ctx.lineTo(length / 2, -width * 0.5)
    ctx.moveTo(-length / 2, width * 0.5)
    ctx.lineTo(length / 2, width * 0.5)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'

  for (const enemy of enemies) {
    if (enemy.bossKind !== 'final' || enemy.chargeTimer <= 0) continue

    const chargeProgress = 1 - clamp(enemy.chargeTimer / FINAL_BOSS_BEAM_CHARGE_SECONDS, 0, 1)
    const alpha = 0.28 + chargeProgress * 0.72
    const radius = getFinalBossBeamRadius(enemy.chargePattern)
    const lineWidth = Math.max(32, Math.min(viewportWidth * 0.15, (radius / WIDTH) * viewportWidth * 2.45))
    const warningPulse = 0.72 + Math.sin(time / 80 + enemy.chargeLane) * 0.2

    if (enemy.chargePattern === 'horizontal') {
      drawWarningBeam(viewportWidth * 0.5, toViewportY(enemy.chargeLane), 0, lineWidth, alpha, warningPulse)
      continue
    }

    if (enemy.chargePattern === 'diagonal' || enemy.chargePattern === 'cross' || enemy.chargePattern === 'rotate') {
      const baseAngle = enemy.chargePattern === 'rotate'
        ? time / 1800 + enemy.phase
        : enemy.chargeLane < 50 ? Math.PI / 4 : -Math.PI / 4
      drawWarningBeam(viewportWidth * 0.5, viewportHeight * 0.5, baseAngle, lineWidth, alpha, warningPulse)
      if (enemy.chargePattern === 'cross' || enemy.chargePattern === 'rotate') {
        drawWarningBeam(viewportWidth * 0.5, viewportHeight * 0.5, baseAngle + Math.PI / 2, lineWidth, alpha * 0.92, warningPulse)
      }
      continue
    }

    forEachFinalBossBeamLane(enemy.chargeLane, enemy.chargePattern, (lane) => {
      drawWarningBeam(toX(lane), viewportHeight * 0.5, Math.PI / 2, lineWidth, alpha, 0.72 + Math.sin(time / 80 + lane) * 0.2)
    })
  }

  ctx.restore()
}

export function drawDevilChargeWarnings(
  ctx: CanvasRenderingContext2D,
  enemies: Enemy[],
  toX: (value: number) => number,
  toY: (value: number) => number,
  viewportWidth: number,
  viewportHeight: number,
  time: number,
) {
  let hasDevilCharge = false
  for (const enemy of enemies) {
    if (enemy.bossKind === 'devil' && enemy.chargeTimer > 0) {
      hasDevilCharge = true
      break
    }
  }
  if (!hasDevilCharge) return

  const drawWarningBeam = (x: number, y: number, angle: number, width: number, alpha: number, pulse: number) => {
    const length = Math.sqrt((viewportWidth) * (viewportWidth) + (viewportHeight) * (viewportHeight)) * 1.45
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)
    ctx.globalCompositeOperation = 'lighter'

    ctx.globalAlpha = alpha * 0.22
    ctx.fillStyle = 'rgba(127,29,29,1)'
    ctx.fillRect(-length / 2, -width * 0.82, length, width * 1.64)

    ctx.globalAlpha = alpha * 0.42
    ctx.fillStyle = 'rgba(239,68,68,1)'
    ctx.fillRect(-length / 2, -width * 0.48, length, width * 0.96)

    ctx.globalAlpha = alpha * 0.72 * pulse
    ctx.fillStyle = 'rgba(254,202,202,1)'
    ctx.fillRect(-length / 2, -2, length, 4)

    ctx.globalAlpha = alpha * 0.82
    ctx.strokeStyle = time % 180 < 90 ? '#fca5a5' : '#fed7aa'
    ctx.lineWidth = 2.5
    ctx.setLineDash([9, 8])
    ctx.beginPath()
    ctx.moveTo(-length / 2, -width * 0.5)
    ctx.lineTo(length / 2, -width * 0.5)
    ctx.moveTo(-length / 2, width * 0.5)
    ctx.lineTo(length / 2, width * 0.5)
    ctx.stroke()
    ctx.restore()
  }

  const drawInfectionReticle = (x: number, y: number, radius: number, alpha: number, pulse: number) => {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = alpha * 0.36
    drawRadialEllipse(ctx, x, y, radius * 1.18, radius * 0.88, RAID_DEVIL_RETICLE_GLOW_STOPS)
    ctx.globalAlpha = alpha
    ctx.strokeStyle = '#fca5a5'
    ctx.lineWidth = Math.max(2, viewportWidth * 0.0015)
    ctx.setLineDash([8, 7])
    ctx.beginPath()
    ctx.ellipse(x, y, radius * pulse, radius * 0.72 * pulse, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(x - radius * 1.15, y)
    ctx.lineTo(x + radius * 1.15, y)
    ctx.moveTo(x, y - radius * 0.9)
    ctx.lineTo(x, y + radius * 0.9)
    ctx.stroke()
    ctx.restore()
  }

  const drawSnakeLungeWarning = (startX: number, startY: number, targetX: number, targetY: number, width: number, alpha: number, pulse: number) => {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalAlpha = alpha * 0.26
    ctx.strokeStyle = 'rgba(132,204,22,1)'
    ctx.lineWidth = width * 1.75
    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.lineTo(targetX, targetY)
    ctx.stroke()
    ctx.globalAlpha = alpha * 0.72
    ctx.strokeStyle = 'rgba(254,240,138,1)'
    ctx.lineWidth = Math.max(4, width * 0.38)
    ctx.setLineDash([14, 10])
    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.lineTo(targetX, targetY)
    ctx.stroke()
    ctx.setLineDash([])
    drawInfectionReticle(targetX, targetY, width * (1.1 + pulse * 0.2), alpha * 0.86, pulse)
    ctx.restore()
  }

  for (const enemy of enemies) {
    if (enemy.bossKind !== 'devil' || enemy.chargeTimer <= 0) continue

    const maxCharge = getDevilBossChargeDuration(enemy.chargePattern, (enemy.beamVolleyLeft ?? 0) > 0)
    const chargeProgress = 1 - clamp(enemy.chargeTimer / maxCharge, 0, 1)
    const alpha = 0.28 + chargeProgress * 0.72
    const radius = getDevilBossBeamRadius(enemy.chargePattern)
    const maxBeamWidth = viewportWidth > 1100 ? viewportWidth * 0.052 : viewportWidth * 0.11
    const minBeamWidth = viewportWidth > 1100 ? 20 : 28
    const lineWidth = Math.max(minBeamWidth, Math.min(maxBeamWidth, (radius / WIDTH) * viewportWidth * 1.9))
    const warningPulse = 0.74 + Math.sin(time / 76 + enemy.phase) * 0.18

    if (enemy.chargePattern === 'horizontal') {
      drawWarningBeam(viewportWidth * 0.5, toY(enemy.chargeTargetY ?? 50), 0, lineWidth, alpha, warningPulse)
      continue
    }

    if (enemy.chargePattern === 'cross') {
      const x = toX(enemy.chargeLane)
      const y = toY(enemy.chargeTargetY ?? 50)
      drawInfectionReticle(x, y, Math.max(42, viewportWidth * 0.045), alpha, warningPulse)
      continue
    }

    if (enemy.chargePattern === 'diagonal') {
      drawSnakeLungeWarning(
        toX(enemy.x),
        toY(enemy.y + 10),
        toX(enemy.chargeLane),
        toY(enemy.chargeTargetY ?? 70),
        Math.max(28, Math.min(viewportWidth * 0.045, 54)),
        alpha,
        warningPulse,
      )
      continue
    }

    if (enemy.chargePattern === 'rotate') {
      const baseAngle = time / 1600 + enemy.phase + Math.PI / 4
      drawWarningBeam(viewportWidth * 0.5, viewportHeight * 0.5, baseAngle, lineWidth, alpha, warningPulse)
      drawWarningBeam(viewportWidth * 0.5, viewportHeight * 0.5, baseAngle + Math.PI / 2, lineWidth, alpha * 0.92, warningPulse)
      continue
    }

    forEachDevilBossBeamLane(enemy.chargeLane, enemy.chargePattern, (lane) => {
      drawWarningBeam(toX(lane), viewportHeight * 0.5, Math.PI / 2, lineWidth, alpha, 0.72 + Math.sin(time / 76 + lane) * 0.2)
    })
  }
}
