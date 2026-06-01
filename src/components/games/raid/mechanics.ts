import type { GodGundamBarragePose } from './assets'
import { CORE_LANDER_BASE_DAMAGE_BONUS, CORE_LANDER_BURNING_DAMAGE_BONUS, CORE_LANDER_BURNING_FIRE_INTERVAL_SECONDS, CORE_LANDER_BURNING_RAGE_DAMAGE_BONUS, CORE_LANDER_BURNING_RAGE_FIRE_INTERVAL_REDUCTION, CORE_LANDER_FIRE_INTERVAL_SECONDS, DEVIL_BOSS_NUKE_DAMAGE_MULTIPLIER, FINAL_BOSS_NUKE_DAMAGE_MULTIPLIER, FORCE_FIELD_ARMOR, GOD_GUNDAM_BARRAGE_BASE_DAMAGE_MULTIPLIER, GOD_GUNDAM_BARRAGE_BURNING_DAMAGE_MULTIPLIER, GOD_GUNDAM_BARRAGE_BURNING_RAGE_DAMAGE_MULTIPLIER, GOD_GUNDAM_MELEE_BOSS_DAMAGE_MULTIPLIER, GOD_GUNDAM_MELEE_BURNING_DAMAGE_MULTIPLIER, GOD_GUNDAM_MELEE_BURNING_RAGE_DAMAGE_MULTIPLIER, GOD_GUNDAM_MELEE_BURNING_RANGE_BONUS, GOD_GUNDAM_MELEE_DAMAGE_PER_SECOND, GOD_GUNDAM_MELEE_MINIBOSS_DAMAGE_MULTIPLIER, GOD_GUNDAM_MELEE_RANGE, GOD_GUNDAM_STAGE_ATTACK_BONUS, LEVEL_UP_HEAL, MAX_RAID_STAGE, NUKE_BOSS_DAMAGE_MAX_FLOOR, NUKE_BOSS_DAMAGE_MAX_RATIO, NUKE_BOSS_DAMAGE_MIN_FLOOR, NUKE_BOSS_DAMAGE_MIN_RATIO, NUKE_MAX_COOLDOWN_SECONDS, NUKE_MIN_COOLDOWN_SECONDS, PLAYER_BASE_ATTACK_PER_LEVEL, PLAYER_MAX_RANK, SPACE_ET_FORCE_FIELD_REGEN_SECONDS, SPACE_ET_PASSIVE_FORCE_FIELD_CHARGES, SPIEGEL_AFTERIMAGE_CAP, SPIEGEL_AFTERIMAGE_LIFE_MULTIPLIER, SPIEGEL_LOW_HP_BARRAGE_DAMAGE_MULTIPLIER, SPIEGEL_LOW_HP_BARRAGE_RAGE_DAMAGE_MULTIPLIER, SPIEGEL_LOW_HP_PASSIVE_DAMAGE_MULTIPLIER, SPIEGEL_LOW_HP_PASSIVE_RAGE_DAMAGE_MULTIPLIER, SPIEGEL_LOW_HP_SHADOW_CLONE_DAMAGE_MULTIPLIER, SPIEGEL_LOW_HP_SHADOW_CLONE_RAGE_DAMAGE_MULTIPLIER, SPIEGEL_PASSIVE_DAMAGE_MULTIPLIER, SPIEGEL_SHADOW_CLONE_DAMAGE_MULTIPLIER, WEAPON_KEYS, WEAPON_STACK_CAPS } from './constants'
import { updateMesiahDrones, updateMesiahScoutDrones } from './playerRender'
import { getCoreLanderBarrageSequence, getPlayerCoreLanderCombatModel } from './state'
import type { CoreLanderCombatModel, Enemy, Player, RaidRandomEvent, Shot, Vec } from './types'
import { clamp, distSq } from './utils'

export function acquireHomingTarget(shot: Shot, enemies: Enemy[]) {
  let target: Enemy | null = null
  let bestScore = Number.POSITIVE_INFINITY

  for (const enemy of enemies) {
    if (enemy.hp <= 0 || enemy.y < -10) continue
    const dx = shot.x - enemy.x
    const dy = shot.y - enemy.y
    const distance = dx * dx + dy * dy
    const forwardBias = enemy.y > shot.y + 18 ? 2400 : 0
    const bossBias = enemy.isBoss ? -1400 : enemy.isMiniBoss ? -700 : 0
    const score = distance + forwardBias + bossBias
    if (score < bestScore) {
      bestScore = score
      target = enemy
    }
  }

  return target
}

export function getNukeStageScale(stage: number) {
  return clamp((stage - 1) / Math.max(1, MAX_RAID_STAGE - 1), 0, 1)
}

export function getNukeCooldownSeconds(stage: number) {
  const scale = getNukeStageScale(stage)
  return Math.round(NUKE_MIN_COOLDOWN_SECONDS + (NUKE_MAX_COOLDOWN_SECONDS - NUKE_MIN_COOLDOWN_SECONDS) * scale)
}

export function getNukeBossDamage(enemy: Enemy, stage: number) {
  const scale = getNukeStageScale(stage)
  const ratio = NUKE_BOSS_DAMAGE_MIN_RATIO + (NUKE_BOSS_DAMAGE_MAX_RATIO - NUKE_BOSS_DAMAGE_MIN_RATIO) * scale
  const floor = NUKE_BOSS_DAMAGE_MIN_FLOOR + (NUKE_BOSS_DAMAGE_MAX_FLOOR - NUKE_BOSS_DAMAGE_MIN_FLOOR) * scale
  const damage = Math.max(Math.round(floor), Math.round(enemy.maxHp * ratio))
  if (enemy.bossKind === 'devil') {
    return Math.max(Math.round(floor * 0.18), Math.round(damage * DEVIL_BOSS_NUKE_DAMAGE_MULTIPLIER))
  }
  return enemy.bossKind === 'final'
    ? Math.max(Math.round(floor * 0.45), Math.round(damage * FINAL_BOSS_NUKE_DAMAGE_MULTIPLIER))
    : damage
}

export function getGodGundamBarrageBossDamage(enemy: Enemy, stage: number, powerScore: number) {
  const pressure = Math.max(0, stage - 1)
  if (enemy.bossKind === 'devil') {
    return Math.max(190 + pressure * 16 + powerScore * 12, Math.round(enemy.maxHp * 0.011))
  }
  if (enemy.bossKind === 'final') {
    return Math.max(175 + pressure * 14 + powerScore * 11, Math.round(enemy.maxHp * 0.015))
  }
  return Math.max(150 + pressure * 12 + powerScore * 10, Math.round(enemy.maxHp * 0.018))
}

export function isSpiegelCombatModel(model?: CoreLanderCombatModel | null) {
  return model === 'spiegel'
}

export function hasSpiegelShadowClones(player: Player, model?: CoreLanderCombatModel | null) {
  return isCoreLanderBurning(player) && isSpiegelCombatModel(model ?? getPlayerCoreLanderCombatModel(player))
}

export function canUseGodGundamBurningDamage(player: Player, model?: CoreLanderCombatModel | null) {
  return isCoreLanderBurning(player) && !isSpiegelCombatModel(model ?? getPlayerCoreLanderCombatModel(player))
}

export function getSpiegelLowHpDamageScale(player: Player, model?: CoreLanderCombatModel | null) {
  if (!hasSpiegelShadowClones(player, model)) return 0
  return getCoreLanderBurningRage(player)
}

export function getSpiegelPassiveDamageMultiplier(player: Player, model?: CoreLanderCombatModel | null) {
  if (!isSpiegelCombatModel(model)) return 1
  const rage = getSpiegelLowHpDamageScale(player, model)
  const lowHpMultiplier = hasSpiegelShadowClones(player, model)
    ? SPIEGEL_LOW_HP_PASSIVE_DAMAGE_MULTIPLIER + SPIEGEL_LOW_HP_PASSIVE_RAGE_DAMAGE_MULTIPLIER * rage
    : 1
  return SPIEGEL_PASSIVE_DAMAGE_MULTIPLIER * lowHpMultiplier
}

export function getSpiegelBarrageDamageMultiplier(player: Player, model?: CoreLanderCombatModel | null) {
  if (!isSpiegelCombatModel(model)) return 1
  const rage = getSpiegelLowHpDamageScale(player, model)
  return hasSpiegelShadowClones(player, model)
    ? SPIEGEL_LOW_HP_BARRAGE_DAMAGE_MULTIPLIER + SPIEGEL_LOW_HP_BARRAGE_RAGE_DAMAGE_MULTIPLIER * rage
    : 1
}

export function getSpiegelShadowCloneDamageMultiplier(player: Player, model?: CoreLanderCombatModel | null) {
  if (!isSpiegelCombatModel(model)) return SPIEGEL_SHADOW_CLONE_DAMAGE_MULTIPLIER
  const rage = getSpiegelLowHpDamageScale(player, model)
  return hasSpiegelShadowClones(player, model)
    ? SPIEGEL_LOW_HP_SHADOW_CLONE_DAMAGE_MULTIPLIER + SPIEGEL_LOW_HP_SHADOW_CLONE_RAGE_DAMAGE_MULTIPLIER * rage
    : SPIEGEL_SHADOW_CLONE_DAMAGE_MULTIPLIER
}

export function getGodGundamBarrageDamageMultiplier(player: Player, model?: CoreLanderCombatModel | null) {
  if (isSpiegelCombatModel(model)) return GOD_GUNDAM_BARRAGE_BASE_DAMAGE_MULTIPLIER * getSpiegelBarrageDamageMultiplier(player, model)
  if (!canUseGodGundamBurningDamage(player, model)) return GOD_GUNDAM_BARRAGE_BASE_DAMAGE_MULTIPLIER
  return GOD_GUNDAM_BARRAGE_BASE_DAMAGE_MULTIPLIER * (
    GOD_GUNDAM_BARRAGE_BURNING_DAMAGE_MULTIPLIER +
    GOD_GUNDAM_BARRAGE_BURNING_RAGE_DAMAGE_MULTIPLIER * getCoreLanderBurningRage(player)
  )
}

export function getGodGundamMeleeRange(player: Player, model?: CoreLanderCombatModel | null) {
  return GOD_GUNDAM_MELEE_RANGE + (canUseGodGundamBurningDamage(player, model) ? GOD_GUNDAM_MELEE_BURNING_RANGE_BONUS : 0)
}

export function getGodGundamStageAttackBonus(stage: number) {
  const pressure = Math.max(0, stage - 1)
  return pressure * GOD_GUNDAM_STAGE_ATTACK_BONUS + Math.max(0, stage - 5) * 0.22
}

export function getGodGundamMeleeDamagePerSecond(player: Player, target: Enemy, stage = 1, model?: CoreLanderCombatModel | null) {
  const burningMultiplier = canUseGodGundamBurningDamage(player, model)
    ? GOD_GUNDAM_MELEE_BURNING_DAMAGE_MULTIPLIER + GOD_GUNDAM_MELEE_BURNING_RAGE_DAMAGE_MULTIPLIER * getCoreLanderBurningRage(player)
    : 1
  const modelMultiplier = getSpiegelPassiveDamageMultiplier(player, model)
  const targetMultiplier = target.isBoss
    ? GOD_GUNDAM_MELEE_BOSS_DAMAGE_MULTIPLIER
    : target.isMiniBoss
      ? GOD_GUNDAM_MELEE_MINIBOSS_DAMAGE_MULTIPLIER
      : 1
  return (getPlayerBaseAttack(player) + getGodGundamStageAttackBonus(stage)) * GOD_GUNDAM_MELEE_DAMAGE_PER_SECOND * burningMultiplier * modelMultiplier * targetMultiplier
}

export function getGodGundamPassivePose(index: number, model: CoreLanderCombatModel): GodGundamBarragePose {
  const sequence = getCoreLanderBarrageSequence(model)
  const safeIndex = ((index % sequence.length) + sequence.length) % sequence.length
  return sequence[safeIndex].pose
}

export function getPlayerBaseAttack(player: Player) {
  const coreLanderModel = getPlayerCoreLanderCombatModel(player)
  const coreLanderBonus = player.ship.key === 'coreLander' ? CORE_LANDER_BASE_DAMAGE_BONUS : 0
  const burningBonus = canUseGodGundamBurningDamage(player, coreLanderModel)
    ? CORE_LANDER_BURNING_DAMAGE_BONUS + CORE_LANDER_BURNING_RAGE_DAMAGE_BONUS * getCoreLanderBurningRage(player)
    : 0
  return 1 + Math.max(0, player.rank - 1) * PLAYER_BASE_ATTACK_PER_LEVEL + coreLanderBonus + burningBonus
}

export function fullyBuffRaidPlayer(player: Player) {
  player.hp = player.maxHp
  player.shield = 8
  player.forceField = FORCE_FIELD_ARMOR
  player.fireCooldown = 0
  for (const key of WEAPON_KEYS) {
    player.weapons[key] = WEAPON_STACK_CAPS[key]
    player.weaponCooldowns[key] = 0
  }
  player.optionTimer = 1
  player.optionStacks = player.ship.key === 'mesiah' ? 2 : 1
  player.mesiahDroneCooldown = 0
  player.mesiahDroneFireCooldown = 0
  player.mesiahRocketCooldown = 0
}

export function isCoreLanderBurning(player: Player) {
  return player.ship.key === 'coreLander' && player.hp > 0 && player.hp <= 3
}

export function getCoreLanderBurningRage(player: Player) {
  if (!isCoreLanderBurning(player)) return 0
  return clamp((3 - player.hp) / 2, 0, 1)
}

export function getCoreLanderFireInterval(player: Player) {
  if (!isCoreLanderBurning(player)) return CORE_LANDER_FIRE_INTERVAL_SECONDS
  return Math.max(
    0.2,
    CORE_LANDER_BURNING_FIRE_INTERVAL_SECONDS - CORE_LANDER_BURNING_RAGE_FIRE_INTERVAL_REDUCTION * getCoreLanderBurningRage(player),
  )
}

export function levelUpPlayer(player: Player) {
  const previousRank = player.rank
  player.rank = Math.min(PLAYER_MAX_RANK, player.rank + 1)
  player.hp = Math.min(player.maxHp, player.hp + LEVEL_UP_HEAL)
  return player.rank > previousRank
}

export function applyStartingStageLevel(player: Player, stage: number) {
  player.rank = clamp(stage, 1, PLAYER_MAX_RANK)
}

export function animateStageClearPlayer(player: Player, dt: number, targetX: number) {
  player.x += (targetX - player.x) * Math.min(1, dt * 4.8)
  player.y = Math.max(-26, player.y - dt * 38)
  player.engineBoost = Math.max(player.engineBoost ?? 0, 1.18)
  player.invuln = Math.max(player.invuln, 0.45)
}

export function movePlayerWithInput(player: Player, dt: number, pointerTarget: Vec | null, keys: Set<string>, coreLanderModel: CoreLanderCombatModel | null = null) {
  let dx = 0
  let dy = 0
  if (keys.has('arrowleft') || keys.has('a')) dx -= 1
  if (keys.has('arrowright') || keys.has('d')) dx += 1
  if (keys.has('arrowup') || keys.has('w')) dy -= 1
  if (keys.has('arrowdown') || keys.has('s')) dy += 1

  const previousX = player.x
  const previousY = player.y

  if (pointerTarget) {
    const pull = Math.min(1, dt * 10.5 * player.ship.speed)
    player.x += (pointerTarget.x - player.x) * pull
    player.y += (pointerTarget.y - player.y) * pull
  } else if (dx !== 0 || dy !== 0) {
    const mag = Math.hypot(dx, dy) || 1
    const speed = (keys.has('shift') ? 36 : 48) * player.ship.speed
    player.x += (dx / mag) * speed * dt
    player.y += (dy / mag) * speed * dt
  }

  player.x = clamp(player.x, 4, 96)
  player.y = clamp(player.y, 13, 93)
  const moveSpeed = dt > 0 ? Math.hypot(player.x - previousX, player.y - previousY) / dt : 0
  const upwardSpeed = dt > 0 ? Math.max(0, previousY - player.y) / dt : 0
  const targetEngineBoost = clamp(upwardSpeed / 46, 0, 1.35)
  const boostEase = targetEngineBoost > (player.engineBoost ?? 0) ? 11.5 : 5.5
  player.engineBoost = (player.engineBoost ?? 0) + (targetEngineBoost - (player.engineBoost ?? 0)) * Math.min(1, dt * boostEase)
  const isSpiegelModel = player.ship.key === 'coreLander' && isSpiegelCombatModel(coreLanderModel)
  const targetAfterimage = clamp(moveSpeed / (isSpiegelModel ? 33 : 38), 0, isSpiegelModel ? 1.12 : 1)
  const afterimageEase = targetAfterimage > (player.spiegelAfterimageStrength ?? 0) ? 16 : 3.2
  player.spiegelAfterimageStrength = (player.spiegelAfterimageStrength ?? 0) + (targetAfterimage - (player.spiegelAfterimageStrength ?? 0)) * Math.min(1, dt * afterimageEase)

  const afterimages = player.spiegelAfterimages ?? []
  let write = 0
  for (const afterimage of afterimages) {
    afterimage.life -= dt * (isSpiegelModel ? 1.55 : 1.85)
    if (afterimage.life <= 0) continue
    afterimages[write] = afterimage
    write += 1
  }
  afterimages.length = write
  if (targetAfterimage > 0.08) {
    const latest = afterimages[0]
    if (!latest || distSq(latest, { x: previousX, y: previousY }) > 0.34) {
      afterimages.unshift({ x: previousX, y: previousY, life: isSpiegelModel ? SPIEGEL_AFTERIMAGE_LIFE_MULTIPLIER : 1 })
    }
  }
  afterimages.length = Math.min(afterimages.length, isSpiegelModel ? SPIEGEL_AFTERIMAGE_CAP : 8)
  player.spiegelAfterimages = afterimages
}

export function getRiftCenter(event: RaidRandomEvent) {
  return {
    x: 50 + Math.sin(event.age * 1.3 + event.seed) * 18,
    y: 38 + Math.cos(event.age * 0.95 + event.seed) * 8,
  }
}

export function applyRiftPullToPlayer(player: Player, event: RaidRandomEvent, dt: number) {
  if (player.hp <= 0 || event.warning > 0) return
  const center = getRiftCenter(event)
  const dx = center.x - player.x
  const dy = center.y - player.y
  const dist = Math.hypot(dx, dy) || 1
  const near = clamp((72 - dist) / 72, 0.14, 1)
  const pulse = 0.68 + Math.sin(event.age * 5.4 + event.seed) * 0.32
  const pull = (4.8 + pulse * 4.6) * near
  const swirl = (2.4 + pulse * 2.2) * near

  player.x += ((dx / dist) * pull + (-dy / dist) * swirl) * dt
  player.y += ((dy / dist) * pull + (dx / dist) * swirl * 0.42) * dt
  player.x = clamp(player.x, 4, 96)
  player.y = clamp(player.y, 13, 93)
}

export function updatePlayerTimers(player: Player, dt: number, enemies: Enemy[], isSmallViewport: boolean) {
  player.fireCooldown = Math.max(0, player.fireCooldown - dt)
  WEAPON_KEYS.forEach((key) => {
    player.weaponCooldowns[key] = Math.max(0, player.weaponCooldowns[key] - dt)
  })
  player.mesiahDroneFireCooldown = Math.max(0, player.mesiahDroneFireCooldown - dt)
  player.mesiahRocketCooldown = Math.max(0, player.mesiahRocketCooldown - dt)
  player.godMeleeExhaust = Math.max(0, (player.godMeleeExhaust ?? 0) - dt)
  player.godMeleeVisualTimer = Math.max(0, (player.godMeleeVisualTimer ?? 0) - dt)
  player.godMeleeCloak = Math.max(0, (player.godMeleeCloak ?? 0) - dt)
  const burningTarget = isCoreLanderBurning(player) ? 1 : 0
  const burningStep = Math.min(1, dt * 4.2)
  player.burningBlend = clamp((player.burningBlend ?? 0) + (burningTarget - (player.burningBlend ?? 0)) * burningStep, 0, 1)
  if (player.ship.key === 'mesiah' && player.hp > 0) {
    player.mesiahDroneTimer += dt
    player.mesiahDroneCooldown = 0
  } else {
    player.mesiahDroneTimer = 0
    player.mesiahDroneCooldown = 0
    player.mesiahDroneFireCooldown = 0
    player.mesiahRocketCooldown = 0
  }
  updateMesiahDrones(player, enemies, dt, isSmallViewport)
  updateMesiahScoutDrones(player, enemies, dt, isSmallViewport)
  player.invuln = Math.max(0, player.invuln - dt)
  player.shield = Math.max(0, player.shield - dt * 0.16)

  if (player.ship.key === 'spaceEt' && player.hp > 0 && player.forceField < SPACE_ET_PASSIVE_FORCE_FIELD_CHARGES) {
    player.passiveForceFieldRegen += dt
    while (player.passiveForceFieldRegen >= SPACE_ET_FORCE_FIELD_REGEN_SECONDS && player.forceField < SPACE_ET_PASSIVE_FORCE_FIELD_CHARGES) {
      player.passiveForceFieldRegen -= SPACE_ET_FORCE_FIELD_REGEN_SECONDS
      player.forceField += 1
    }
  } else {
    player.passiveForceFieldRegen = 0
  }
}

export function restorePassiveForceField(player: Player) {
  if (player.ship.key !== 'spaceEt') {
    player.passiveForceFieldRegen = 0
    return
  }

  player.forceField = Math.max(player.forceField, SPACE_ET_PASSIVE_FORCE_FIELD_CHARGES)
  player.passiveForceFieldRegen = 0
}

export function revivePlayerForBossClear(player: Player, x: number) {
  if (player.hp > 0) return false

  player.hp = Math.max(1, Math.ceil(player.maxHp * 0.5))
  player.x = x
  player.y = 84
  player.invuln = 3.2
  player.shield = Math.max(player.shield, 3)
  player.forceField = 0
  restorePassiveForceField(player)
  player.fireCooldown = 0
  return true
}
