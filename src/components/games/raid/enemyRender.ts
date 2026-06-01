import { RAID_ALIEN_SPRITE_COUNT, RAID_ELITE_SPRITE_COUNT } from '../RaidShipSprite'
import { drawCanvasSpriteContain, drawSpriteGlow, getEliteAlienCanvasSprite, getEnemyCanvasSize, getNormalAlienCanvasSprite, getNormalAlienImageFilter } from './assets'
import { DEG, STAGE_CLEAR_SECONDS } from './constants'
import type { BossKind, Enemy, MirageBossKind } from './types'
import { clamp } from './utils'
import { drawBossShield, drawCachedBossAura, drawCachedBossBar, drawCachedBossReticle } from './bossHudRender'
import { drawDevilGundamBoss } from './devilBossRender'
import { drawSnakeVenomTelegraph } from './snakeBossRender'
import { drawSquidWhipStrike } from './squidBossRender'
import { drawCachedStageBossBody, drawEnemyHitFlash, drawStageBossIntroEffect, getStageBossIntroProgress, hexToRgba } from './stageBossRender'

export function getBossDefeatFade(enemy: Enemy) {
  if (enemy.hp > 0) return 1
  return clamp((enemy.defeatTimer ?? enemy.devilDefeatedTimer ?? STAGE_CLEAR_SECONDS) / STAGE_CLEAR_SECONDS, 0, 1)
}

export function drawRaidEnemy(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  toX: (value: number) => number,
  toY: (value: number) => number,
  viewportWidth: number,
  time: number,
  normalEnemyFilter: string,
) {
  const x = toX(enemy.x)
  const y = toY(enemy.y)
  const size = getEnemyCanvasSize(enemy, viewportWidth) * (viewportWidth > 1100 ? 0.96 : 1)

  if (enemy.isBoss) {
    const defeatFade = getBossDefeatFade(enemy)
    const floatScale = 1 + Math.sin(time / 1100) * 0.03
    const rotation = Math.sin(time / 1100) * 0.5 * DEG
    const displayBossKind: BossKind | MirageBossKind | null = enemy.bossKind === 'final' && (enemy.mirageTimer ?? 0) > 0 && enemy.mirageKind
      ? enemy.mirageKind
      : enemy.bossKind
    const hasSpecialBossPresentation = displayBossKind === 'squid' || displayBossKind === 'snake' || displayBossKind === 'final' || displayBossKind === 'devil'
    if (hasSpecialBossPresentation && displayBossKind !== 'devil') {
      drawCachedBossAura(ctx, enemy, x, y, size, time)
    }
    if (displayBossKind === 'devil') {
      ctx.save()
      ctx.translate(x, y)
      drawDevilGundamBoss(ctx, enemy, size, time)
      drawEnemyHitFlash(ctx, size, enemy.hitFlash, '#ef4444')
      ctx.restore()
      if (enemy.hp > 0) {
        if (enemy.shieldTime > 0 || enemy.y < 18) drawBossShield(ctx, x, y + size * 0.18, size * 0.86, time, enemy.color)
        drawCachedBossReticle(ctx, x, y, size, time, true)
        drawCachedBossBar(ctx, enemy, x, y + size * 0.16, size)
      }
      return
    }
    if (displayBossKind === 'squid' || displayBossKind === 'snake' || displayBossKind === 'final') {
      const introProgress = getStageBossIntroProgress(enemy, displayBossKind)
      const introScale = 0.74 + introProgress * 0.26
      ctx.save()
      ctx.translate(x, y)
      ctx.globalAlpha *= defeatFade
      drawStageBossIntroEffect(ctx, size, time, displayBossKind, introProgress)
      ctx.rotate(displayBossKind === 'snake' ? 0 : rotation * 0.45)
      ctx.globalAlpha *= 0.58 + introProgress * 0.42
      ctx.scale(floatScale * introScale, floatScale * introScale)
      if (displayBossKind === 'squid') drawCachedStageBossBody(ctx, 'squid', size, time)
      else if (displayBossKind === 'snake') {
        const biteLungeActive = enemy.chargePattern === 'cross' && (enemy.chargeTimer > 0 || (enemy.beamVolleyRecovery ?? 0) > 0)
        drawCachedStageBossBody(ctx, 'snake', size, time, biteLungeActive, biteLungeActive)
      }
      else {
        const finalRage = clamp((0.55 - enemy.hp / Math.max(1, enemy.maxHp)) / 0.55, 0, 1)
        drawCachedStageBossBody(ctx, 'final', size, time, false, false, finalRage)
      }
      drawEnemyHitFlash(ctx, size, enemy.hitFlash, enemy.bossKind === 'final' ? '#fbbf24' : enemy.bossKind === 'squid' ? '#f472b6' : '#f43f5e')
      ctx.restore()
      if (enemy.hp > 0) {
        if (displayBossKind === 'squid' && enemy.chargeTimer > 0 && enemy.chargePattern !== 'rotate') {
          drawSquidWhipStrike(ctx, x, y, toX(enemy.chargeLane), toY(enemy.chargeTargetY ?? enemy.y + 34), size, time, enemy.chargeTimer)
        }
        if (displayBossKind === 'snake' && (enemy.chargeTimer > 0 || (enemy.chargePattern === 'cross' && (enemy.beamVolleyRecovery ?? 0) > 0))) {
          drawSnakeVenomTelegraph(ctx, x, y, toX(enemy.chargeLane), toY(enemy.chargeTargetY ?? enemy.y + 34), size, viewportWidth, time, enemy.chargeTimer, enemy.chargePattern, enemy.beamVolleyRecovery ?? 0)
        }
        if (enemy.shieldTime > 0 || enemy.y < 15) drawBossShield(ctx, x, y, size, time, enemy.color)
        drawCachedBossReticle(ctx, x, y, size, time, enemy.bossKind === 'final')
        drawCachedBossBar(ctx, enemy, x, y, size)
      }
      return
    }
    const bossSpriteVariant = Math.abs(Math.trunc(enemy.id + enemy.variant * 11 + enemy.pattern * 3)) % (RAID_ALIEN_SPRITE_COUNT + RAID_ELITE_SPRITE_COUNT)
    const sprite = bossSpriteVariant < RAID_ALIEN_SPRITE_COUNT
      ? getNormalAlienCanvasSprite(bossSpriteVariant)
      : getEliteAlienCanvasSprite(bossSpriteVariant - RAID_ALIEN_SPRITE_COUNT)
    const bossFilter = enemy.bossKind === 'super'
        ? 'brightness(1.14) contrast(1.18) saturate(1.38)'
        : 'brightness(1.16) contrast(1.18) saturate(1.34)'
    drawCanvasSpriteContain(ctx, sprite, x, y, size * 1.04, bossFilter, defeatFade, rotation, floatScale, enemy.color)
    ctx.save()
    ctx.translate(x, y)
    ctx.globalAlpha *= defeatFade
    drawEnemyHitFlash(ctx, size, enemy.hitFlash, enemy.color)
    ctx.restore()
    if (enemy.hp > 0) {
      if (enemy.shieldTime > 0 || enemy.y < 15) drawBossShield(ctx, x, y, size, time, enemy.color)
      drawCachedBossBar(ctx, enemy, x, y, size)
    }
    return
  }

  if (enemy.isMiniBoss) {
    const sprite = getEliteAlienCanvasSprite(enemy.variant)
    const floatScale = 1 + Math.sin(time / 760 + enemy.phase) * 0.035
    const rotation = Math.sin(time / 900 + enemy.phase) * 1.4 * DEG
    drawSpriteGlow(ctx, x, y, size, hexToRgba(enemy.color, 0.36), 1)
    drawCanvasSpriteContain(ctx, sprite, x, y, size, 'brightness(1.18) contrast(1.2) saturate(1.45)', 1, rotation, floatScale, enemy.color)
    ctx.save()
    ctx.translate(x, y)
    drawEnemyHitFlash(ctx, size, enemy.hitFlash, enemy.color)
    ctx.restore()
    if (enemy.shieldTime > 0 || enemy.y < 8) drawBossShield(ctx, x, y, size * 0.78, time, enemy.color)
    drawCachedBossBar(ctx, enemy, x, y, size * 0.82)
    return
  }

  const sprite = getNormalAlienCanvasSprite(enemy.variant)
  drawSpriteGlow(ctx, x, y, size, 'rgba(239,35,60,0.34)', 1)
  drawCanvasSpriteContain(ctx, sprite, x, y, size, getNormalAlienImageFilter(normalEnemyFilter, enemy), 1, 0, 1, enemy.color, false)
  ctx.save()
  ctx.translate(x, y)
  drawEnemyHitFlash(ctx, size, enemy.hitFlash, enemy.color)
  ctx.restore()
}
