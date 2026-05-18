import type { LeaderboardMode } from './leaderboards'

export type RunStatus = 'victory' | 'gameover' | 'exit'

export type RunResult = {
  mode: LeaderboardMode
  status: RunStatus
  playerName: string
  score: number
  stage: number
  wave?: number
  shipKey?: string | null
  durationMs?: number
  enemiesDestroyed?: number
  bossesDefeated?: number
  pickupsCollected?: number
  nukesUsed?: number
}

export type AchievementId =
  | 'first_sortie'
  | 'defense_clear'
  | 'raid_clear'
  | 'boss_breaker'
  | 'endless_survivor'
  | 'coop_wingman'
  | 'nuke_saver'
  | 'ship_specialist'
  | 'squid_hunter'
  | 'serpent_breaker'
  | 'fortress_fall'
  | 'arsenal_runner'
  | 'ace_master'
  | 'all_modes'

export type CodexId =
  | 'earth_defense_grid'
  | 'alien_swarm'
  | 'elite_contacts'
  | 'asteroid_cluster'
  | 'abyss_squid'
  | 'serpent_guardian'
  | 'orbital_fortress'
  | 'endless_swarm'
  | 'ship_hangar'
  | 'pickup_arsenal'
  | 'nuke_protocol'
  | 'raid_events'

export type ShipMasteryRecord = {
  xp: number
  level: number
  runs: number
  bestScore: number
}

export type ShipCosmeticKey = 'trail' | 'aura' | 'frame'
export type ShipCosmeticEquipState = Partial<Record<ShipCosmeticKey, boolean>>

export type ProgressState = {
  version: 1
  totalRuns: number
  totalScore: number
  totalPlaySeconds: number
  enemiesDestroyed: number
  bossesDefeated: number
  pickupsCollected: number
  nukesUsed: number
  victories: number
  bestScoreByMode: Record<LeaderboardMode, number>
  bestStageByMode: Record<LeaderboardMode, number>
  achievements: Partial<Record<AchievementId, string>>
  codex: Partial<Record<CodexId, string>>
  shipMastery: Record<string, ShipMasteryRecord>
  equippedCosmetics: Record<string, ShipCosmeticEquipState>
}

export type ProgressUpdate = {
  progress: ProgressState
  unlockedAchievements: AchievementId[]
  unlockedCodex: CodexId[]
  shipLevelUp: boolean
  shipLevel?: number
}

export const PROGRESS_STORAGE_KEY = 'space-impact-release-progress'

export const ACHIEVEMENT_IDS: AchievementId[] = [
  'first_sortie',
  'defense_clear',
  'raid_clear',
  'boss_breaker',
  'endless_survivor',
  'coop_wingman',
  'nuke_saver',
  'ship_specialist',
  'squid_hunter',
  'serpent_breaker',
  'fortress_fall',
  'arsenal_runner',
  'ace_master',
  'all_modes',
]

export const CODEX_IDS: CodexId[] = [
  'earth_defense_grid',
  'alien_swarm',
  'elite_contacts',
  'asteroid_cluster',
  'abyss_squid',
  'serpent_guardian',
  'orbital_fortress',
  'endless_swarm',
  'ship_hangar',
  'pickup_arsenal',
  'nuke_protocol',
  'raid_events',
]

export const SHIP_MASTERY_LEVEL_XP = 1600
export const SHIP_COSMETIC_LEVELS: Record<ShipCosmeticKey, number> = {
  trail: 2,
  aura: 3,
  frame: 5,
}

const LEADERBOARD_MODES: LeaderboardMode[] = [
  'ship_defense_normal',
  'ship_defense_endless',
  'gradius_solo',
  'gradius_multiplayer',
]

export function createEmptyProgress(): ProgressState {
  return {
    version: 1,
    totalRuns: 0,
    totalScore: 0,
    totalPlaySeconds: 0,
    enemiesDestroyed: 0,
    bossesDefeated: 0,
    pickupsCollected: 0,
    nukesUsed: 0,
    victories: 0,
    bestScoreByMode: {
      ship_defense_normal: 0,
      ship_defense_endless: 0,
      gradius_solo: 0,
      gradius_multiplayer: 0,
    },
    bestStageByMode: {
      ship_defense_normal: 0,
      ship_defense_endless: 0,
      gradius_solo: 0,
      gradius_multiplayer: 0,
    },
    achievements: {},
    codex: {},
    shipMastery: {},
    equippedCosmetics: {},
  }
}

export function loadProgress(): ProgressState {
  if (typeof window === 'undefined') return createEmptyProgress()

  try {
    const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY)
    if (!raw) return createEmptyProgress()
    return normalizeProgress(JSON.parse(raw))
  } catch {
    return createEmptyProgress()
  }
}

export function saveProgress(progress: ProgressState) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress))
}

export function recordRunResult(result: RunResult): ProgressUpdate {
  const progress = loadProgress()
  const unlockedAchievements: AchievementId[] = []
  const unlockedCodex: CodexId[] = []
  const now = new Date().toISOString()

  progress.totalRuns += 1
  progress.totalScore += Math.max(0, Math.floor(result.score))
  progress.totalPlaySeconds += Math.max(0, Math.floor((result.durationMs ?? 0) / 1000))
  progress.enemiesDestroyed += Math.max(0, Math.floor(result.enemiesDestroyed ?? 0))
  progress.bossesDefeated += Math.max(0, Math.floor(result.bossesDefeated ?? 0))
  progress.pickupsCollected += Math.max(0, Math.floor(result.pickupsCollected ?? 0))
  progress.nukesUsed += Math.max(0, Math.floor(result.nukesUsed ?? 0))
  if (result.status === 'victory') progress.victories += 1

  progress.bestScoreByMode[result.mode] = Math.max(progress.bestScoreByMode[result.mode] ?? 0, Math.floor(result.score))
  progress.bestStageByMode[result.mode] = Math.max(progress.bestStageByMode[result.mode] ?? 0, Math.floor(result.stage))

  let shipLevelUp = false
  let shipLevel: number | undefined
  if (result.shipKey) {
    const current = progress.shipMastery[result.shipKey] ?? { xp: 0, level: 1, runs: 0, bestScore: 0 }
    const previousLevel = current.level
    current.runs += 1
    current.bestScore = Math.max(current.bestScore, Math.floor(result.score))
    current.xp += getShipMasteryXp(result)
    current.level = getShipMasteryLevelFromXp(current.xp)
    progress.shipMastery[result.shipKey] = current
    progress.equippedCosmetics[result.shipKey] = autoEquipNewCosmetics(progress.equippedCosmetics[result.shipKey], current.level)
    shipLevelUp = current.level > previousLevel
    shipLevel = current.level
  }

  const unlockAchievement = (id: AchievementId, condition: boolean) => {
    if (!condition || progress.achievements[id]) return
    progress.achievements[id] = now
    unlockedAchievements.push(id)
  }

  unlockAchievement('first_sortie', progress.totalRuns >= 1)
  unlockAchievement('defense_clear', result.mode === 'ship_defense_normal' && result.status === 'victory')
  unlockAchievement('raid_clear', (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && result.status === 'victory')
  unlockAchievement('boss_breaker', progress.bossesDefeated >= 10)
  unlockAchievement('endless_survivor', result.mode === 'ship_defense_endless' && result.stage >= 15)
  unlockAchievement('coop_wingman', result.mode === 'gradius_multiplayer' && result.score > 0)
  unlockAchievement('nuke_saver', (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && result.status === 'victory' && (result.nukesUsed ?? 0) === 0)
  unlockAchievement('ship_specialist', Object.values(progress.shipMastery).some((ship) => ship.level >= 3))
  unlockAchievement('squid_hunter', (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && result.stage >= 5)
  unlockAchievement('serpent_breaker', (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && result.stage >= 10)
  unlockAchievement('fortress_fall', (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && result.status === 'victory')
  unlockAchievement('arsenal_runner', progress.pickupsCollected >= 50)
  unlockAchievement('ace_master', Object.values(progress.shipMastery).some((ship) => ship.level >= 5))
  unlockAchievement('all_modes', LEADERBOARD_MODES.every((mode) => progress.bestScoreByMode[mode] > 0))

  const unlockCodex = (id: CodexId, condition: boolean) => {
    if (!condition || progress.codex[id]) return
    progress.codex[id] = now
    unlockedCodex.push(id)
  }

  unlockCodex('earth_defense_grid', result.mode === 'ship_defense_normal' || result.mode === 'ship_defense_endless')
  unlockCodex('alien_swarm', result.enemiesDestroyed !== undefined && result.enemiesDestroyed > 0)
  unlockCodex('elite_contacts', result.stage >= 2 || progress.bossesDefeated >= 1)
  unlockCodex('asteroid_cluster', result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer')
  unlockCodex('abyss_squid', (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && result.stage >= 5)
  unlockCodex('serpent_guardian', (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && result.stage >= 10)
  unlockCodex('orbital_fortress', (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && (result.stage >= 15 || result.status === 'victory'))
  unlockCodex('endless_swarm', result.mode === 'ship_defense_endless')
  unlockCodex('ship_hangar', Boolean(result.shipKey))
  unlockCodex('pickup_arsenal', (result.pickupsCollected ?? 0) > 0 || progress.pickupsCollected > 0)
  unlockCodex('nuke_protocol', (result.nukesUsed ?? 0) > 0 || progress.nukesUsed > 0)
  unlockCodex('raid_events', (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && result.stage >= 3)

  saveProgress(progress)
  return { progress, unlockedAchievements, unlockedCodex, shipLevelUp, shipLevel }
}

export function getCompletionPercent(progress: ProgressState) {
  const achievements = ACHIEVEMENT_IDS.filter((id) => progress.achievements[id]).length
  const codex = CODEX_IDS.filter((id) => progress.codex[id]).length
  return Math.round(((achievements + codex) / (ACHIEVEMENT_IDS.length + CODEX_IDS.length)) * 100)
}

export function isShipCosmeticUnlocked(level: number, cosmetic: ShipCosmeticKey) {
  return level >= SHIP_COSMETIC_LEVELS[cosmetic]
}

export function getEquippedShipCosmetics(progress: ProgressState, shipKey: string): Required<ShipCosmeticEquipState> {
  const level = progress.shipMastery[shipKey]?.level ?? 1
  const equipped = progress.equippedCosmetics[shipKey] ?? {}
  return {
    trail: isShipCosmeticUnlocked(level, 'trail') && equipped.trail !== false,
    aura: isShipCosmeticUnlocked(level, 'aura') && equipped.aura !== false,
    frame: isShipCosmeticUnlocked(level, 'frame') && equipped.frame !== false,
  }
}

export function setShipCosmeticEquipped(shipKey: string, cosmetic: ShipCosmeticKey, equipped: boolean) {
  const progress = loadProgress()
  const level = progress.shipMastery[shipKey]?.level ?? 1
  const nextEquipped = {
    ...(progress.equippedCosmetics[shipKey] ?? {}),
    [cosmetic]: isShipCosmeticUnlocked(level, cosmetic) ? equipped : false,
  }
  progress.equippedCosmetics = {
    ...progress.equippedCosmetics,
    [shipKey]: nextEquipped,
  }
  saveProgress(progress)
  return progress
}

export function getShipMasteryLevelFromXp(xp: number) {
  let level = 1
  let remainingXp = Math.max(0, Math.floor(xp))
  while (level < 20) {
    const nextLevelCost = getShipMasteryLevelCost(level)
    if (remainingXp < nextLevelCost) break
    remainingXp -= nextLevelCost
    level += 1
  }
  return level
}

function getShipMasteryXp(result: RunResult) {
  return Math.max(140, Math.floor(result.score / 12) + result.stage * 48 + (result.status === 'victory' ? 650 : 0))
}

function getShipMasteryLevelCost(level: number) {
  return SHIP_MASTERY_LEVEL_XP + level * 520 + Math.floor(Math.max(0, level - 1) ** 1.35 * 120)
}

function autoEquipNewCosmetics(current: ShipCosmeticEquipState | undefined, level: number): ShipCosmeticEquipState {
  const next: ShipCosmeticEquipState = {}
  ;(Object.keys(SHIP_COSMETIC_LEVELS) as ShipCosmeticKey[]).forEach((cosmetic) => {
    if (current?.[cosmetic] !== undefined) {
      next[cosmetic] = current[cosmetic]
    }
  })
  ;(Object.keys(SHIP_COSMETIC_LEVELS) as ShipCosmeticKey[]).forEach((cosmetic) => {
    if (isShipCosmeticUnlocked(level, cosmetic) && next[cosmetic] === undefined) {
      next[cosmetic] = true
    }
  })
  return next
}

function normalizeProgress(value: unknown): ProgressState {
  const empty = createEmptyProgress()
  if (!value || typeof value !== 'object') return empty

  const data = value as Partial<ProgressState>
  const shipMastery = normalizeShipMastery(data.shipMastery ?? {})
  return {
    ...empty,
    ...data,
    version: 1,
    totalRuns: Math.max(0, Math.floor(Number(data.totalRuns) || 0)),
    totalScore: Math.max(0, Math.floor(Number(data.totalScore) || 0)),
    totalPlaySeconds: Math.max(0, Math.floor(Number(data.totalPlaySeconds) || 0)),
    enemiesDestroyed: Math.max(0, Math.floor(Number(data.enemiesDestroyed) || 0)),
    bossesDefeated: Math.max(0, Math.floor(Number(data.bossesDefeated) || 0)),
    pickupsCollected: Math.max(0, Math.floor(Number(data.pickupsCollected) || 0)),
    nukesUsed: Math.max(0, Math.floor(Number(data.nukesUsed) || 0)),
    victories: Math.max(0, Math.floor(Number(data.victories) || 0)),
    bestScoreByMode: { ...empty.bestScoreByMode, ...(data.bestScoreByMode ?? {}) },
    bestStageByMode: { ...empty.bestStageByMode, ...(data.bestStageByMode ?? {}) },
    achievements: data.achievements ?? {},
    codex: data.codex ?? {},
    shipMastery,
    equippedCosmetics: normalizeEquippedCosmetics(data.equippedCosmetics ?? {}, shipMastery),
  }
}

function normalizeShipMastery(records: Record<string, ShipMasteryRecord>) {
  return Object.fromEntries(Object.entries(records).map(([shipKey, record]) => {
    const xp = Math.max(0, Math.floor(Number(record?.xp) || 0))
    return [shipKey, {
      xp,
      level: getShipMasteryLevelFromXp(xp),
      runs: Math.max(0, Math.floor(Number(record?.runs) || 0)),
      bestScore: Math.max(0, Math.floor(Number(record?.bestScore) || 0)),
    }]
  }))
}

function normalizeEquippedCosmetics(
  equippedCosmetics: Record<string, ShipCosmeticEquipState>,
  shipMastery: Record<string, ShipMasteryRecord>,
) {
  const normalized: Record<string, ShipCosmeticEquipState> = {}
  Object.entries(shipMastery).forEach(([shipKey, mastery]) => {
    normalized[shipKey] = autoEquipNewCosmetics(equippedCosmetics[shipKey], mastery.level)
  })
  return normalized
}
