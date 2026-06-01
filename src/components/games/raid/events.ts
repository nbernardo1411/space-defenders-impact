import { ASTEROID_CLUSTER_MAX_SECONDS, ASTEROID_CLUSTER_MIN_SECONDS, RANDOM_EVENT_MAX_SECONDS, RANDOM_EVENT_MIN_SECONDS } from './constants'
import type { AsteroidHazard, RaidRandomEventKind } from './types'

let asteroidId = 1

export function getAsteroidClusterInterval() {
  return ASTEROID_CLUSTER_MIN_SECONDS + Math.random() * (ASTEROID_CLUSTER_MAX_SECONDS - ASTEROID_CLUSTER_MIN_SECONDS)
}

export function getRandomEventInterval() {
  return RANDOM_EVENT_MIN_SECONDS + Math.random() * (RANDOM_EVENT_MAX_SECONDS - RANDOM_EVENT_MIN_SECONDS)
}

export function getRandomEventDuration(kind: RaidRandomEventKind) {
  if (kind === 'meteor') return 6.6
  if (kind === 'solar') return 6.2
  if (kind === 'rift') return 8.2
  if (kind === 'wreck') return 9
  if (kind === 'ambush') return 5.8
  return 6.8
}

export function getRandomEventLabel(kind: RaidRandomEventKind) {
  if (kind === 'meteor') return 'METEOR SHOWER INBOUND'
  if (kind === 'solar') return 'SOLAR FLARE DETECTED'
  if (kind === 'rift') return 'GRAVITY DISTORTION'
  if (kind === 'wreck') return 'DERELICT SHIP AHEAD'
  if (kind === 'ambush') return 'SIGNAL JAMMED. AMBUSH'
  return 'ION STORM WARNING'
}

export function pickRandomRaidEventKind(stage: number, surfaceStage: boolean): RaidRandomEventKind {
  const pool: RaidRandomEventKind[] = stage < 4
    ? ['meteor', 'ion', 'wreck']
    : surfaceStage
      ? ['meteor', 'solar', 'rift', 'ambush', 'ion']
      : ['meteor', 'solar', 'rift', 'wreck', 'ambush', 'ion']
  return pool[Math.floor(Math.random() * pool.length)]
}

export function pickNextRandomRaidEventKind(stage: number, surfaceStage: boolean, previousKind: RaidRandomEventKind | null) {
  let kind = pickRandomRaidEventKind(stage, surfaceStage)
  if (previousKind && kind === previousKind) {
    for (let attempt = 0; attempt < 4 && kind === previousKind; attempt += 1) {
      kind = pickRandomRaidEventKind(stage, surfaceStage)
    }
  }
  return kind
}

export function getAsteroidHp(tier: number, stage: number, powerPressure: number) {
  const tierBase = tier === 2 ? 168 : tier === 1 ? 66 : 22
  const stageScale = tier === 2 ? 15 : tier === 1 ? 6.4 : 2.4
  const powerScale = tier === 2 ? 6.2 : tier === 1 ? 2.5 : 0.85
  return Math.round(tierBase + stage * stageScale + powerPressure * powerScale)
}

export function createAsteroidHazard(tier: number, x: number, y: number, vx: number, vy: number, stage: number, powerPressure: number): AsteroidHazard {
  const hp = getAsteroidHp(tier, stage, powerPressure)
  return {
    id: asteroidId++,
    x,
    y,
    vx,
    vy,
    hp,
    maxHp: hp,
    radius: tier === 2 ? 16.5 : tier === 1 ? 9.2 : 4.8,
    tier,
    spin: Math.random() * 360,
    spinSpeed: (Math.random() < 0.5 ? -1 : 1) * (tier === 2 ? 14 + Math.random() * 18 : 24 + Math.random() * 34),
    phase: Math.random() * Math.PI * 2,
  }
}

export function splitAsteroidHazard(asteroid: AsteroidHazard, stage: number, powerPressure: number) {
  if (asteroid.tier <= 0) return []

  const childTier = asteroid.tier - 1
  const childCount = asteroid.tier === 2 ? 3 : 2
  const spread = asteroid.tier === 2 ? 0.72 : 0.58
  const children: AsteroidHazard[] = []
  for (let index = 0; index < childCount; index += 1) {
    const angle = Math.PI / 2 + (index - (childCount - 1) / 2) * spread + (Math.random() - 0.5) * 0.24
    const speed = asteroid.tier === 2 ? 15 + Math.random() * 8 : 19 + Math.random() * 10
    children.push(createAsteroidHazard(
      childTier,
      asteroid.x + Math.cos(angle) * asteroid.radius * 0.8,
      asteroid.y + Math.sin(angle) * asteroid.radius * 0.5,
      asteroid.vx * 0.42 + Math.cos(angle) * speed,
      Math.max(8, asteroid.vy * 0.62 + Math.sin(angle) * speed),
      stage,
      powerPressure,
    ))
  }

  return children
}
