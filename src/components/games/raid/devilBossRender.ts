import { drawCanvasSpriteContain, getDevilBossCanvasSprite, RAID_DEVIL_BOSS_ATTACK_FILTER, RAID_DEVIL_BOSS_BASE_FILTER, RAID_DEVIL_BOSS_RED_OVERLAY_FILTER } from './assets'
import { getDevilBossRedFilter } from './bossAttacks'
import type { DevilBossPose, Enemy } from './types'
import { clamp, drawRadialEllipse } from './utils'
import { getBossDefeatFade } from './enemyRender'
import { easeOutCubic } from './stageBossRender'

export function getDevilBossPose(enemy: Enemy, time: number): DevilBossPose {
  if (enemy.hp <= 0) return 'rage'
  const hpRatio = enemy.hp / Math.max(1, enemy.maxHp)
  if ((enemy.beamVolleyRecovery ?? 0) > 0) return 'attack'
  if (enemy.chargeTimer > 0) {
    if (enemy.chargeTimer > 0.55) return 'rage'
    return 'attack'
  }
  if ((enemy.devilNormalAttackTimer ?? 0) > 0) return 'attack2'
  if (hpRatio <= 0.32) {
    const rageCycle = ((time / 1000) + enemy.phase * 0.53) % 2.6
    if (rageCycle < 1.25) return 'rage'
  } else if (hpRatio <= 0.62) {
    const rageCycle = ((time / 1000) + enemy.phase * 0.53) % 4.2
    if (rageCycle < 0.95) return 'rage'
  } else if (hpRatio <= 0.78) {
    const rageCycle = ((time / 1000) + enemy.phase * 0.37) % 6
    if (rageCycle < 0.55) return 'rage'
  }
  const idleCycle = ((time / 1000) + enemy.phase * 0.37) % 3.4
  return idleCycle > 1.7 ? 'idle2' : 'idle'
}

export function drawDevilGundamBoss(ctx: CanvasRenderingContext2D, enemy: Enemy, size: number, time: number) {
  const pose = getDevilBossPose(enemy, time)
  if (enemy.devilVisualPose !== pose) {
    enemy.devilVisualPose = pose
    enemy.devilPoseChangedAt = time
  }
  const hpRatio = enemy.hp / Math.max(1, enemy.maxHp)
  const attackActive = (enemy.beamVolleyRecovery ?? 0) > 0 || (enemy.devilNormalAttackTimer ?? 0) > 0
  const redBlend = enemy.hp <= 0
    ? 1
    : pose === 'rage' && hpRatio <= 0.36
      ? clamp(0.48 + ((0.36 - hpRatio) / 0.36) * 0.52, 0.48, 1)
      : 0
  const redStep = Math.round(redBlend * 4) / 4
  const sprite = getDevilBossCanvasSprite(pose)
  const defeatedFade = enemy.hp <= 0
    ? getBossDefeatFade(enemy)
    : 1
  const defeatedProgress = 1 - defeatedFade
  const transitionAge = time - (enemy.devilPoseChangedAt ?? time)
  const transitionProgress = easeOutCubic(transitionAge / 190)
  const transitionPush = 1 - transitionProgress
  const poseSettleScale = (1 + transitionPush * (pose === 'rage' ? 0.018 : pose === 'attack' || pose === 'attack2' ? 0.026 : 0.012)) * (1 + defeatedProgress * 0.045)
  const poseSettleY = transitionPush * size * (pose === 'attack' || pose === 'attack2' ? 0.014 : pose === 'rage' ? -0.008 : 0.006) + defeatedProgress * size * 0.035
  const pulse = (0.98 + Math.sin(time / 1100 + enemy.phase) * 0.018) * poseSettleScale
  const coreGlow = (enemy.chargeTimer > 0 || attackActive ? 0.22 : pose === 'rage' ? 0.18 : 0.1) + redStep * 0.12
  const filter = redStep > 0
    ? getDevilBossRedFilter(redStep)
    : pose === 'rage' || enemy.chargeTimer > 0 || attackActive
      ? RAID_DEVIL_BOSS_ATTACK_FILTER
    : RAID_DEVIL_BOSS_BASE_FILTER

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha *= defeatedFade
  drawRadialEllipse(ctx, 0, size * 0.26, size * 0.42, size * 0.5, [
    [0, `rgba(239,68,68,${coreGlow})`],
    [0.48, 'rgba(127,29,29,0.07)'],
    [1, 'rgba(0,0,0,0)'],
  ])
  ctx.restore()

  drawCanvasSpriteContain(
    ctx,
    sprite,
    0,
    size * 0.28 + poseSettleY,
    size,
    filter,
    defeatedFade,
    0,
    pulse,
    '#ef4444',
  )

  if (redStep > 0) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    drawCanvasSpriteContain(
      ctx,
      sprite,
      0,
      size * 0.28 + poseSettleY,
      size * 1.01,
      RAID_DEVIL_BOSS_RED_OVERLAY_FILTER,
      defeatedFade * redStep * 0.28,
      0,
      pulse,
      '#ef4444',
    )
    ctx.restore()
  }

}
