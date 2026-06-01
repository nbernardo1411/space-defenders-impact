import { getCoreLanderModel, getMesiahShipColor, loadProgress } from '../../../progression'
import { RAID_CORE_LANDER_BARRAGE_POSE_SCALES, RAID_CORE_LANDER_BARRAGE_SEQUENCES, RAID_GOD_GUNDAM_BARRAGE_FILTER, RAID_GOD_GUNDAM_BARRAGE_IMPACT_STOPS, RAID_GOD_GUNDAM_BARRAGE_SEQUENCE, RAID_GOD_GUNDAM_BURNING_BARRAGE_FILTER, RAID_GOD_GUNDAM_BURNING_BARRAGE_IMPACT_STOPS, RAID_SPIEGEL_BARRAGE_FILTER, RAID_SPIEGEL_BARRAGE_IMPACT_STOPS } from './assets'
import type { GodGundamBarragePose } from './assets'
import { EMPTY_WEAPONS, EMPTY_WEAPON_TIMERS, MAX_RAID_STAGE, RAID_CHECKPOINT_STORAGE_KEY, RAID_UNLOCK_STORAGE_KEY, SHIP_OPTIONS, SPACE_ET_PASSIVE_FORCE_FIELD_CHARGES, STORAGE_KEY } from './constants'
import type { CoreLanderCombatModel, MesiahDroneUnit, MesiahScoutUnit, Player, PowerKind, Shot } from './types'
import { clamp } from './utils'

export function getHighScore() {
  if (typeof window === 'undefined') return 0
  return Number(localStorage.getItem(STORAGE_KEY) || 0)
}

export function saveHighScore(score: number) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, String(score))
  }
}

export function getUnlockedStage() {
  if (typeof window === 'undefined') return 1
  return clamp(Number(localStorage.getItem(RAID_UNLOCK_STORAGE_KEY) || 1), 1, MAX_RAID_STAGE)
}

export function saveUnlockedStage(stage: number) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(RAID_UNLOCK_STORAGE_KEY, String(clamp(stage, 1, MAX_RAID_STAGE)))
  }
}

export function getCheckpointStage() {
  if (typeof window === 'undefined') return 1
  return clamp(Number(localStorage.getItem(RAID_CHECKPOINT_STORAGE_KEY) || 1), 1, MAX_RAID_STAGE)
}

export function saveCheckpointStage(stage: number) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(RAID_CHECKPOINT_STORAGE_KEY, String(clamp(stage, 1, MAX_RAID_STAGE)))
  }
}

export function createMesiahDrones(x = 50, y = 82): MesiahDroneUnit[] {
  return [-1, 1].map((side) => ({
    side: side as -1 | 1,
    x: x + side * 7,
    y: y + 1.6,
    targetId: null,
    rotation: 0,
    active: false,
    canFire: false,
  }))
}

export function normalizeMesiahDrones(player: Player) {
  if (Array.isArray(player.mesiahDrones) && player.mesiahDrones.length === 2) return player.mesiahDrones
  player.mesiahDrones = createMesiahDrones(player.x, player.y)
  return player.mesiahDrones
}

export function createMesiahScoutDrones(x = 50, y = 82): MesiahScoutUnit[] {
  const scouts: MesiahScoutUnit[] = []
  for (let stack = 0; stack < 2; stack += 1) {
    for (const side of [-1, 1] as const) {
      scouts.push({
        side,
        stack,
        x: x + side * (7 + stack * 2.4),
        y: y + 7.4 + stack * 4.8,
        targetId: null,
        rotation: 0,
        active: false,
        canFire: false,
      })
    }
  }
  return scouts
}

export function normalizeMesiahScoutDrones(player: Player) {
  if (Array.isArray(player.mesiahScoutDrones) && player.mesiahScoutDrones.length === 4) return player.mesiahScoutDrones
  player.mesiahScoutDrones = createMesiahScoutDrones(player.x, player.y)
  return player.mesiahScoutDrones
}

export function sanitizePlayerVisualShipKey(shipKey: string, visualShipKey?: string | null) {
  if (shipKey === 'mesiah') {
    return visualShipKey === 'mesiahWhite' || visualShipKey === 'mesiahBlack' || visualShipKey === 'mesiah'
      ? visualShipKey
      : 'mesiahBlack'
  }
  if (shipKey === 'coreLander') {
    return visualShipKey === 'godGundam' || visualShipKey === 'godGundamBurning' || visualShipKey === 'spiegel' || visualShipKey === 'coreLanderBurning' || visualShipKey === 'coreLander'
      ? visualShipKey
      : 'coreLander'
  }
  return visualShipKey === shipKey ? visualShipKey : shipKey
}

export function getDefaultPlayerVisualShipKey(shipKey: string, progress: ReturnType<typeof loadProgress>) {
  if (shipKey === 'mesiah') return getMesiahShipColor(progress) === 'white' ? 'mesiahWhite' : 'mesiahBlack'
  if (shipKey === 'coreLander') return getCoreLanderModel(progress)
  return shipKey
}

export function getInitialPlayer(ship = SHIP_OPTIONS[0], visualShipKey?: string): Player {
  const passiveForceField = ship.key === 'spaceEt' ? SPACE_ET_PASSIVE_FORCE_FIELD_CHARGES : 0
  return {
    x: 50,
    y: 82,
    hp: ship.hp,
    maxHp: ship.hp,
    invuln: 1.8,
    shield: 0,
    forceField: passiveForceField,
    passiveForceFieldRegen: 0,
    optionTimer: 0,
    optionStacks: 0,
    fireCooldown: 0,
    specialCooldown: 0,
    weaponCooldowns: { ...EMPTY_WEAPON_TIMERS },
    score: 0,
    rank: 1,
    ship,
    visualShipKey: sanitizePlayerVisualShipKey(ship.key, visualShipKey),
    weapons: { ...EMPTY_WEAPONS },
    weaponTimers: { ...EMPTY_WEAPON_TIMERS },
    engineBoost: 0,
    spiegelAfterimageStrength: 0,
    spiegelAfterimages: [],
    mesiahDroneTimer: ship.key === 'mesiah' ? 0.01 : 0,
    mesiahDroneCooldown: 0,
    mesiahDroneFireCooldown: 0,
    mesiahRocketCooldown: 0,
    mesiahDrones: createMesiahDrones(),
    mesiahScoutDrones: createMesiahScoutDrones(),
    burningBlend: 0,
    godMeleeHeat: 0,
    godMeleeExhaust: 0,
    godMeleeVisualTimer: 0,
    godMeleeCloak: 0,
    godMeleeChainX: 50,
    godMeleeChainY: 82,
    godMeleeLastTargetKey: '',
  }
}

export function powerColor(type: PowerKind) {
  if (type === 'laser') return '#67e8f9'
  if (type === 'spread') return '#fbbf24'
  if (type === 'scatter') return '#fb7185'
  if (type === 'rocket') return '#f97316'
  if (type === 'homing') return '#facc15'
  if (type === 'option') return '#e879f9'
  if (type === 'shield') return '#fcd34d'
  if (type === 'forcefield') return '#22d3ee'
  if (type === 'repair') return '#86efac'
  if (type === 'levelup') return '#a7f3d0'
  return '#c4b5fd'
}

export function powerGlyph(type: PowerKind) {
  if (type === 'laser') return 'L'
  if (type === 'spread') return 'V'
  if (type === 'scatter') return '*'
  if (type === 'rocket') return 'R'
  if (type === 'homing') return 'H'
  if (type === 'option') return 'O'
  if (type === 'forcefield') return 'F'
  if (type === 'repair') return '+'
  if (type === 'levelup') return 'LV'
  return 'S'
}

export function clonePlayer(player: Player): Player {
  return {
    ...player,
    ship: { ...player.ship },
    visualShipKey: sanitizePlayerVisualShipKey(player.ship.key, player.visualShipKey),
    weapons: { ...player.weapons },
    weaponTimers: { ...player.weaponTimers },
    weaponCooldowns: { ...player.weaponCooldowns },
    optionStacks: player.optionStacks ?? (player.optionTimer > 0 ? 1 : 0),
    engineBoost: player.engineBoost ?? 0,
    specialCooldown: player.specialCooldown ?? 0,
    spiegelAfterimageStrength: player.spiegelAfterimageStrength ?? 0,
    spiegelAfterimages: (player.spiegelAfterimages ?? []).map((afterimage) => ({ ...afterimage })),
    mesiahDroneTimer: player.mesiahDroneTimer ?? 0,
    mesiahDroneCooldown: player.mesiahDroneCooldown ?? 0,
    mesiahDroneFireCooldown: player.mesiahDroneFireCooldown ?? 0,
    mesiahRocketCooldown: player.mesiahRocketCooldown ?? 0,
    mesiahDrones: normalizeMesiahDrones(player).map((drone) => ({ ...drone })),
    mesiahScoutDrones: normalizeMesiahScoutDrones(player).map((scout) => ({ ...scout })),
    burningBlend: player.burningBlend ?? 0,
    godMeleeHeat: player.godMeleeHeat ?? 0,
    godMeleeExhaust: player.godMeleeExhaust ?? 0,
    godMeleeVisualTimer: player.godMeleeVisualTimer ?? 0,
    godMeleeCloak: player.godMeleeCloak ?? 0,
    godMeleeChainX: player.godMeleeChainX ?? player.x,
    godMeleeChainY: player.godMeleeChainY ?? player.y,
    godMeleeLastTargetKey: player.godMeleeLastTargetKey ?? '',
  }
}

export function getShipByKey(shipKey: string | undefined, fallback = SHIP_OPTIONS[0]) {
  return SHIP_OPTIONS.find((ship) => ship.key === shipKey) ?? fallback
}

export function getOptionSupportStacks(player: Player) {
  if (player.optionTimer <= 0) return 0
  if (player.ship.key === 'mesiah') return clamp(Math.round(player.optionStacks ?? 1), 0, 2)
  return 1
}

export function getMesiahVisualShipKeyFromProgress(progress: ReturnType<typeof loadProgress>) {
  return getMesiahShipColor(progress) === 'white' ? 'mesiahWhite' : 'mesiahBlack'
}

export function getRaidPlayerVisualShipKey(player: Player, progress: ReturnType<typeof loadProgress>) {
  const visualShipKey = sanitizePlayerVisualShipKey(
    player.ship.key,
    player.visualShipKey ?? getDefaultPlayerVisualShipKey(player.ship.key, progress),
  )
  const coreModel = getCoreLanderCombatModelFromVisualShipKey(visualShipKey)
  if (player.ship.key === 'coreLander' && coreModel) return coreModel
  if (player.ship.key === 'coreLander' && (player.burningBlend ?? 0) >= 0.98) return 'coreLanderBurning'
  return player.ship.key === 'mesiah' ? visualShipKey : player.ship.key
}

export function getCoreLanderCombatModelFromVisualShipKey(visualShipKey?: string | null): CoreLanderCombatModel | null {
  return visualShipKey === 'godGundam' || visualShipKey === 'spiegel' ? visualShipKey : null
}

export function getPlayerCoreLanderCombatModel(player: Player, progress?: ReturnType<typeof loadProgress>): CoreLanderCombatModel | null {
  if (player.ship.key !== 'coreLander') return null
  const fallback = progress ? getDefaultPlayerVisualShipKey(player.ship.key, progress) : player.visualShipKey
  return getCoreLanderCombatModelFromVisualShipKey(sanitizePlayerVisualShipKey(player.ship.key, player.visualShipKey ?? fallback))
}

export function isGodGundamBarragePilot(player: Player, progress: ReturnType<typeof loadProgress>) {
  return player.ship.key === 'coreLander' && Boolean(getPlayerCoreLanderCombatModel(player, progress))
}

export function getGodGundamGameplayRenderSize(viewportWidth: number) {
  const baseSize = viewportWidth < 860 ? 62 : viewportWidth > 1100 ? 86 : 76
  return baseSize * 1.38 * 1.08
}

export function getCoreLanderBarrageSequence(model: CoreLanderCombatModel) {
  return RAID_CORE_LANDER_BARRAGE_SEQUENCES[model] ?? RAID_GOD_GUNDAM_BARRAGE_SEQUENCE
}

export function getCoreLanderBarrageFilter(model: CoreLanderCombatModel, burning: boolean) {
  if (model === 'spiegel') return RAID_SPIEGEL_BARRAGE_FILTER
  if (burning) return RAID_GOD_GUNDAM_BURNING_BARRAGE_FILTER
  return RAID_GOD_GUNDAM_BARRAGE_FILTER
}

export function getCoreLanderBarrageImpactStops(model: CoreLanderCombatModel, burning: boolean) {
  if (model === 'spiegel') return RAID_SPIEGEL_BARRAGE_IMPACT_STOPS
  return burning ? RAID_GOD_GUNDAM_BURNING_BARRAGE_IMPACT_STOPS : RAID_GOD_GUNDAM_BARRAGE_IMPACT_STOPS
}

export function getCoreLanderBarrageEnergyColor(model: CoreLanderCombatModel, burning: boolean) {
  if (model === 'spiegel') return burning ? '#e2e8f0' : '#f87171'
  return burning ? '#f59e0b' : '#facc15'
}

export function getCoreLanderBarrageShadowColor(model: CoreLanderCombatModel, burning: boolean) {
  if (model === 'spiegel') return burning ? 'rgba(226,232,240,0.34)' : 'rgba(248,113,113,0.28)'
  return burning ? 'rgba(251,146,60,0.38)' : 'rgba(250,204,21,0.28)'
}

export function getCoreLanderBarragePoseScale(model: CoreLanderCombatModel, pose: GodGundamBarragePose) {
  return RAID_CORE_LANDER_BARRAGE_POSE_SCALES[model]?.[pose] ?? 1
}

export function shouldMirrorCoreLanderBarragePose(model: CoreLanderCombatModel, attackSide: -1 | 1) {
  return model === 'spiegel' ? attackSide < 0 : attackSide > 0
}

export function isCoreLanderAoeShot(shot: Shot) {
  return shot.kind === 'coreBlast' || shot.kind === 'spiegelKunai'
}
