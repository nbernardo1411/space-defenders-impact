import { isGradiusRaidEndlessUnlocked, loadProgress } from '../../../progression'
import { HEIGHT, MULTIPLAYER_ENTITY_MARGIN, MULTIPLAYER_GUEST_SHOT_CONFIRM_MARGIN_MS, MULTIPLAYER_GUEST_SHOT_MAX_TTL_MS, MULTIPLAYER_GUEST_SHOT_MIN_TTL_MS, MULTIPLAYER_MAX_VISUAL_VELOCITY, MULTIPLAYER_OWN_CORRECTION_BLEND, MULTIPLAYER_REMOTE_EXTRAPOLATION_LIMIT_MS, MULTIPLAYER_REMOTE_INTERPOLATION_MAX_DELAY_MS, MULTIPLAYER_REMOTE_INTERPOLATION_MIN_DELAY_MS, MULTIPLAYER_SOFT_CORRECTION_DISTANCE_SQ, WEAPON_KEYS, WIDTH } from './constants'
import { clonePlayer, normalizeMesiahDrones, normalizeMesiahScoutDrones } from './state'
import type { AsteroidHazard, DerelictWreck, Enemy, IonStrike, MeteorHazard, MultiplayerAsteroidSnapshot, MultiplayerConnectionQuality, MultiplayerEnemySnapshot, MultiplayerPlayerSnapshot, Player, PowerKind, RaidRandomEvent, Vec } from './types'
import { clamp, distSq } from './utils'

export function hasClearedRaidInProgress(progress: ReturnType<typeof loadProgress>) {
  return isGradiusRaidEndlessUnlocked(progress)
}

export function cloneVec(value: Vec | null | undefined): Vec | null {
  return value ? { x: value.x, y: value.y } : null
}

export function cloneEnemy(enemy: Enemy): Enemy {
  return { ...enemy }
}

export function cloneAsteroid(asteroid: AsteroidHazard): AsteroidHazard {
  return { ...asteroid }
}

export function cloneRaidRandomEvent(event: RaidRandomEvent | null): RaidRandomEvent | null {
  return event ? { ...event } : null
}

export function cloneMeteor(meteor: MeteorHazard): MeteorHazard {
  return { ...meteor }
}

export function cloneIonStrike(strike: IonStrike): IonStrike {
  return { ...strike }
}

export function cloneDerelictWreck(wreck: DerelictWreck): DerelictWreck {
  return { ...wreck }
}

export function updateDerelictWreckMotion(wreck: DerelictWreck, dt: number, nowSeconds: number) {
  wreck.x += wreck.vx * dt
  wreck.y += wreck.vy * dt
  wreck.vx += Math.sin(nowSeconds * 0.62 + wreck.phase) * dt * 0.18
  wreck.vy += Math.sin(nowSeconds * 0.78 + wreck.phase) * dt * 0.22

  const xPadding = clamp(wreck.width * 0.36, 9, 18)
  const yPadding = clamp(wreck.height * 0.48, 6, 11)
  const minX = xPadding
  const maxX = WIDTH - xPadding
  const minY = 17 + yPadding
  const maxY = 66 - yPadding

  if (wreck.x < minX || wreck.x > maxX) {
    const rebound = Math.max(1.2, Math.abs(wreck.vx) * 0.82)
    wreck.x = clamp(wreck.x, minX, maxX)
    wreck.vx = wreck.x <= minX ? rebound : -rebound
  }
  if (wreck.y < minY || wreck.y > maxY) {
    const rebound = Math.max(0.7, Math.abs(wreck.vy) * 0.78)
    wreck.y = clamp(wreck.y, minY, maxY)
    wreck.vy = wreck.y <= minY ? rebound : -rebound
  }

  wreck.vx = clamp(wreck.vx, -3.4, 3.4)
  wreck.vy = clamp(wreck.vy, -2.2, 2.2)
}

export function roundNetworkNumber(value: number) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0
}

export function compactVec<T extends Vec>(value: T): T {
  return {
    ...value,
    x: roundNetworkNumber(value.x),
    y: roundNetworkNumber(value.y),
  }
}

export function compactPlayer(player: Player): Player {
  return {
    ...clonePlayer(player),
    x: roundNetworkNumber(player.x),
    y: roundNetworkNumber(player.y),
    invuln: roundNetworkNumber(player.invuln),
    optionTimer: roundNetworkNumber(player.optionTimer),
    optionStacks: Math.round(player.optionStacks ?? (player.optionTimer > 0 ? 1 : 0)),
    fireCooldown: roundNetworkNumber(player.fireCooldown),
    specialCooldown: roundNetworkNumber(player.specialCooldown ?? 0),
    engineBoost: roundNetworkNumber(player.engineBoost),
    spiegelAfterimageStrength: roundNetworkNumber(player.spiegelAfterimageStrength ?? 0),
    spiegelAfterimages: (player.spiegelAfterimages ?? []).map((afterimage) => ({
      x: roundNetworkNumber(afterimage.x),
      y: roundNetworkNumber(afterimage.y),
      life: roundNetworkNumber(afterimage.life),
    })),
    mesiahDroneTimer: roundNetworkNumber(player.mesiahDroneTimer ?? 0),
    mesiahDroneCooldown: roundNetworkNumber(player.mesiahDroneCooldown ?? 0),
    mesiahDroneFireCooldown: roundNetworkNumber(player.mesiahDroneFireCooldown ?? 0),
    mesiahRocketCooldown: roundNetworkNumber(player.mesiahRocketCooldown ?? 0),
    burningBlend: roundNetworkNumber(player.burningBlend ?? 0),
    godMeleeHeat: roundNetworkNumber(player.godMeleeHeat ?? 0),
    godMeleeExhaust: roundNetworkNumber(player.godMeleeExhaust ?? 0),
    godMeleeVisualTimer: roundNetworkNumber(player.godMeleeVisualTimer ?? 0),
    godMeleeCloak: roundNetworkNumber(player.godMeleeCloak ?? 0),
    godMeleeChainX: roundNetworkNumber(player.godMeleeChainX ?? player.x),
    godMeleeChainY: roundNetworkNumber(player.godMeleeChainY ?? player.y),
    godMeleeLastTargetKey: player.godMeleeLastTargetKey ?? '',
    mesiahDrones: normalizeMesiahDrones(player).map((drone) => ({
      ...drone,
      x: roundNetworkNumber(drone.x),
      y: roundNetworkNumber(drone.y),
      rotation: roundNetworkNumber(drone.rotation),
    })),
    mesiahScoutDrones: normalizeMesiahScoutDrones(player).map((scout) => ({
      ...scout,
      x: roundNetworkNumber(scout.x),
      y: roundNetworkNumber(scout.y),
      rotation: roundNetworkNumber(scout.rotation),
    })),
  }
}

export function getPlayerPickupAudioKind(previous: Player | null, next: Player | null): PowerKind | null {
  if (!previous || !next || next.hp <= 0) return null
  if (next.rank > previous.rank) return 'levelup'
  if (next.hp > previous.hp) return 'repair'
  if (next.forceField > previous.forceField + 0.25) return 'forcefield'
  if (next.shield > previous.shield + 0.25) return 'shield'
  if (next.optionTimer > previous.optionTimer + 0.25 || (next.optionStacks ?? 0) > (previous.optionStacks ?? 0)) return 'option'

  for (const key of WEAPON_KEYS) {
    if (next.weapons[key] > previous.weapons[key]) return key
  }

  return null
}

export function isNetworkVisible(value: Vec) {
  return value.x > -MULTIPLAYER_ENTITY_MARGIN &&
    value.x < WIDTH + MULTIPLAYER_ENTITY_MARGIN &&
    value.y > -MULTIPLAYER_ENTITY_MARGIN &&
    value.y < HEIGHT + MULTIPLAYER_ENTITY_MARGIN
}

export function clampNetworkVelocity(value: number) {
  return clamp(value, -MULTIPLAYER_MAX_VISUAL_VELOCITY, MULTIPLAYER_MAX_VISUAL_VELOCITY)
}

export function getConnectionLabel(quality: MultiplayerConnectionQuality, rtt: number | null) {
  const latency = rtt === null ? '' : ` ${Math.round(rtt)}ms`
  if (quality === 'good') return `Link good${latency}`
  if (quality === 'ok') return `Link ok${latency}`
  if (quality === 'poor') return `Link unstable${latency}`
  return 'Reconnecting'
}

export function getGuestShotTtlMs(rtt: number | null) {
  return clamp(
    (rtt ?? 80) + MULTIPLAYER_GUEST_SHOT_CONFIRM_MARGIN_MS,
    MULTIPLAYER_GUEST_SHOT_MIN_TTL_MS,
    MULTIPLAYER_GUEST_SHOT_MAX_TTL_MS,
  )
}

export function getRemoteInterpolationDelayMs(rtt: number | null) {
  return clamp(
    90 + (rtt ?? 80) * 0.25,
    MULTIPLAYER_REMOTE_INTERPOLATION_MIN_DELAY_MS,
    MULTIPLAYER_REMOTE_INTERPOLATION_MAX_DELAY_MS,
  )
}

export function getOwnCorrectionBlend(rtt: number | null) {
  if (rtt === null) return MULTIPLAYER_OWN_CORRECTION_BLEND
  return clamp(MULTIPLAYER_OWN_CORRECTION_BLEND * (140 / Math.max(140, rtt)), 0.018, MULTIPLAYER_OWN_CORRECTION_BLEND)
}

export function keepNetworkVisibleInPlace<T extends Vec>(items: T[], keepItem?: (item: T) => boolean) {
  let write = 0
  for (const item of items) {
    if (isNetworkVisible(item) || keepItem?.(item)) {
      items[write] = item
      write += 1
    }
  }
  items.length = write
}

export function reconcilePlayerVisual(current: Player | null, authoritative: Player | null, blend: number) {
  if (!authoritative) return null

  const nextPlayer = clonePlayer(authoritative)
  if (!current || current.hp <= 0 || authoritative.hp <= 0) return nextPlayer

  const correctionDistance = distSq(current, authoritative)
  if (correctionDistance < MULTIPLAYER_SOFT_CORRECTION_DISTANCE_SQ) {
    nextPlayer.x = current.x + (authoritative.x - current.x) * blend
    nextPlayer.y = current.y + (authoritative.y - current.y) * blend
  }

  return nextPlayer
}

export function getBufferedPlayerVisual(buffer: MultiplayerPlayerSnapshot[], renderAt: number) {
  if (buffer.length === 0) return null
  if (buffer.length === 1) return clonePlayer(buffer[0].player)

  if (renderAt <= buffer[0].at) return clonePlayer(buffer[0].player)

  const latest = buffer[buffer.length - 1]
  if (renderAt >= latest.at) {
    const previous = buffer[buffer.length - 2]
    const packetMs = Math.max(16, latest.at - previous.at)
    const extrapolateMs = Math.min(renderAt - latest.at, MULTIPLAYER_REMOTE_EXTRAPOLATION_LIMIT_MS)
    const extrapolateScale = extrapolateMs / packetMs
    const visual = clonePlayer(latest.player)
    visual.x = clamp(latest.player.x + (latest.player.x - previous.player.x) * extrapolateScale, 0, WIDTH)
    visual.y = clamp(latest.player.y + (latest.player.y - previous.player.y) * extrapolateScale, 0, HEIGHT)
    const latestBoost = latest.player.engineBoost ?? 0
    const previousBoost = previous.player.engineBoost ?? 0
    visual.engineBoost = clamp(latestBoost + (latestBoost - previousBoost) * extrapolateScale, 0, 1)
    visual.mesiahDroneTimer = latest.player.mesiahDroneTimer ?? 0
    visual.mesiahDroneCooldown = latest.player.mesiahDroneCooldown ?? 0
    visual.mesiahDroneFireCooldown = latest.player.mesiahDroneFireCooldown ?? 0
    visual.mesiahRocketCooldown = latest.player.mesiahRocketCooldown ?? 0
    visual.mesiahDrones = normalizeMesiahDrones(latest.player).map((drone, droneIndex) => {
      const previousDrone = normalizeMesiahDrones(previous.player)[droneIndex] ?? drone
      return {
        ...drone,
        x: clamp(drone.x + (drone.x - previousDrone.x) * extrapolateScale, 0, WIDTH),
        y: clamp(drone.y + (drone.y - previousDrone.y) * extrapolateScale, 0, HEIGHT),
      }
    })
    return visual
  }

  for (let index = 1; index < buffer.length; index += 1) {
    const next = buffer[index]
    if (next.at < renderAt) continue

    const previous = buffer[index - 1]
    const span = Math.max(1, next.at - previous.at)
    const t = clamp((renderAt - previous.at) / span, 0, 1)
    const visual = clonePlayer(next.player)
    visual.x = previous.player.x + (next.player.x - previous.player.x) * t
    visual.y = previous.player.y + (next.player.y - previous.player.y) * t
    const previousBoost = previous.player.engineBoost ?? 0
    const nextBoost = next.player.engineBoost ?? 0
    visual.engineBoost = previousBoost + (nextBoost - previousBoost) * t
    const previousDroneTimer = previous.player.mesiahDroneTimer ?? 0
    const nextDroneTimer = next.player.mesiahDroneTimer ?? 0
    const previousDroneCooldown = previous.player.mesiahDroneCooldown ?? 0
    const nextDroneCooldown = next.player.mesiahDroneCooldown ?? 0
    const previousDroneFireCooldown = previous.player.mesiahDroneFireCooldown ?? 0
    const nextDroneFireCooldown = next.player.mesiahDroneFireCooldown ?? 0
    const previousMesiahRocketCooldown = previous.player.mesiahRocketCooldown ?? 0
    const nextMesiahRocketCooldown = next.player.mesiahRocketCooldown ?? 0
    visual.mesiahDroneTimer = previousDroneTimer + (nextDroneTimer - previousDroneTimer) * t
    visual.mesiahDroneCooldown = previousDroneCooldown + (nextDroneCooldown - previousDroneCooldown) * t
    visual.mesiahDroneFireCooldown = previousDroneFireCooldown + (nextDroneFireCooldown - previousDroneFireCooldown) * t
    visual.mesiahRocketCooldown = previousMesiahRocketCooldown + (nextMesiahRocketCooldown - previousMesiahRocketCooldown) * t
    visual.mesiahDrones = normalizeMesiahDrones(next.player).map((nextDrone, droneIndex) => {
      const previousDrone = normalizeMesiahDrones(previous.player)[droneIndex] ?? nextDrone
      return {
        ...nextDrone,
        x: previousDrone.x + (nextDrone.x - previousDrone.x) * t,
        y: previousDrone.y + (nextDrone.y - previousDrone.y) * t,
        rotation: previousDrone.rotation + (nextDrone.rotation - previousDrone.rotation) * t,
      }
    })
    return visual
  }

  return clonePlayer(latest.player)
}

export function interpolateEnemyVisual(previous: Enemy, next: Enemy, t: number) {
  const visual = cloneEnemy(next)
  visual.x = previous.x + (next.x - previous.x) * t
  visual.y = previous.y + (next.y - previous.y) * t
  visual.phase = previous.phase + (next.phase - previous.phase) * t
  visual.shieldTime = Math.max(0, previous.shieldTime + (next.shieldTime - previous.shieldTime) * t)
  visual.fireCooldown = Math.max(0, previous.fireCooldown + (next.fireCooldown - previous.fireCooldown) * t)
  visual.chargeCooldown = Math.max(0, previous.chargeCooldown + (next.chargeCooldown - previous.chargeCooldown) * t)
  visual.chargeTimer = Math.max(0, previous.chargeTimer + (next.chargeTimer - previous.chargeTimer) * t)
  visual.chargeLane = previous.chargeLane + (next.chargeLane - previous.chargeLane) * t
  visual.chargeTargetY = (previous.chargeTargetY ?? previous.y) + ((next.chargeTargetY ?? next.y) - (previous.chargeTargetY ?? previous.y)) * t
  visual.hitFlash = Math.max(0, (previous.hitFlash ?? 0) + ((next.hitFlash ?? 0) - (previous.hitFlash ?? 0)) * t)
  return visual
}

const enemyIdMapCache = new WeakMap<Enemy[], Map<number, Enemy>>()
function getEnemyIdMap(list: Enemy[]) {
  let map = enemyIdMapCache.get(list)
  if (!map) {
    map = new Map()
    for (const enemy of list) map.set(enemy.id, enemy)
    enemyIdMapCache.set(list, map)
  }
  return map
}

export function getBufferedEnemyVisuals(buffer: MultiplayerEnemySnapshot[], renderAt: number) {
  if (buffer.length === 0) return null
  if (buffer.length === 1) return buffer[0].enemies.map(cloneEnemy)

  const first = buffer[0]
  if (renderAt <= first.at) return first.enemies.map(cloneEnemy)

  const latest = buffer[buffer.length - 1]
  if (renderAt >= latest.at) {
    const previous = buffer[buffer.length - 2]
    const previousById = getEnemyIdMap(previous.enemies)
    const packetMs = Math.max(16, latest.at - previous.at)
    const extrapolateMs = Math.min(renderAt - latest.at, MULTIPLAYER_REMOTE_EXTRAPOLATION_LIMIT_MS)
    const t = 1 + extrapolateMs / packetMs
    return latest.enemies.map((enemy) => {
      const previousEnemy = previousById.get(enemy.id)
      return previousEnemy ? interpolateEnemyVisual(previousEnemy, enemy, t) : cloneEnemy(enemy)
    })
  }

  for (let index = 1; index < buffer.length; index += 1) {
    const next = buffer[index]
    if (next.at < renderAt) continue

    const previous = buffer[index - 1]
    const previousById = getEnemyIdMap(previous.enemies)
    const span = Math.max(1, next.at - previous.at)
    const t = clamp((renderAt - previous.at) / span, 0, 1)
    return next.enemies.map((enemy) => {
      const previousEnemy = previousById.get(enemy.id)
      return previousEnemy ? interpolateEnemyVisual(previousEnemy, enemy, t) : cloneEnemy(enemy)
    })
  }

  return latest.enemies.map(cloneEnemy)
}

export function interpolateAsteroidVisual(previous: AsteroidHazard, next: AsteroidHazard, t: number) {
  const visual = cloneAsteroid(next)
  visual.x = previous.x + (next.x - previous.x) * t
  visual.y = previous.y + (next.y - previous.y) * t
  visual.spin = previous.spin + (next.spin - previous.spin) * t
  return visual
}

const asteroidIdMapCache = new WeakMap<AsteroidHazard[], Map<number, AsteroidHazard>>()
function getAsteroidIdMap(list: AsteroidHazard[]) {
  let map = asteroidIdMapCache.get(list)
  if (!map) {
    map = new Map()
    for (const asteroid of list) map.set(asteroid.id, asteroid)
    asteroidIdMapCache.set(list, map)
  }
  return map
}

export function getBufferedAsteroidVisuals(buffer: MultiplayerAsteroidSnapshot[], renderAt: number) {
  if (buffer.length === 0) return null
  if (buffer.length === 1) return buffer[0].asteroids.map(cloneAsteroid)

  const first = buffer[0]
  if (renderAt <= first.at) return first.asteroids.map(cloneAsteroid)

  const latest = buffer[buffer.length - 1]
  if (renderAt >= latest.at) {
    const previous = buffer[buffer.length - 2]
    const previousById = getAsteroidIdMap(previous.asteroids)
    const packetMs = Math.max(16, latest.at - previous.at)
    const extrapolateMs = Math.min(renderAt - latest.at, MULTIPLAYER_REMOTE_EXTRAPOLATION_LIMIT_MS)
    const t = 1 + extrapolateMs / packetMs
    return latest.asteroids.map((asteroid) => {
      const previousAsteroid = previousById.get(asteroid.id)
      return previousAsteroid ? interpolateAsteroidVisual(previousAsteroid, asteroid, t) : cloneAsteroid(asteroid)
    })
  }

  for (let index = 1; index < buffer.length; index += 1) {
    const next = buffer[index]
    if (next.at < renderAt) continue

    const previous = buffer[index - 1]
    const previousById = getAsteroidIdMap(previous.asteroids)
    const span = Math.max(1, next.at - previous.at)
    const t = clamp((renderAt - previous.at) / span, 0, 1)
    return next.asteroids.map((asteroid) => {
      const previousAsteroid = previousById.get(asteroid.id)
      return previousAsteroid ? interpolateAsteroidVisual(previousAsteroid, asteroid, t) : cloneAsteroid(asteroid)
    })
  }

  return latest.asteroids.map(cloneAsteroid)
}
