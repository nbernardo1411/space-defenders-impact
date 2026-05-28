import { ENDLESS_UNLOCK_STORAGE_KEY } from './components/games/towerDefense/config'
import { isCreatorPlayerName, PLAYER_NAME_STORAGE_KEY, type LeaderboardMode } from './leaderboards'

export type RunStatus = 'victory' | 'gameover' | 'exit'
export type RaidDifficultyKey = 'easy' | 'normal' | 'hard' | 'expert'

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
  devilBossEncountered?: boolean
  devilBossDefeated?: boolean
  pickupsCollected?: number
  nukesUsed?: number
  raidMode?: 'campaign' | 'endless'
  difficulty?: RaidDifficultyKey
}

export type AchievementId =
  | 'first_sortie'
  | 'defense_clear'
  | 'raid_clear'
  | 'boss_breaker'
  | 'defense_veteran'
  | 'defense_legend'
  | 'defense_score_elite'
  | 'endless_survivor'
  | 'endless_warden'
  | 'endless_legend'
  | 'defense_overwatch'
  | 'defense_endless_commander'
  | 'raid_endless_launch'
  | 'raid_endless_survivor'
  | 'raid_endless_vanguard'
  | 'raid_endless_legend'
  | 'raid_endless_boss_reaper'
  | 'raid_endless_score_ace'
  | 'raid_endless_super_junkie'
  | 'raid_endless_ultimate_junkie'
  | 'raid_endless_deep_space'
  | 'raid_endless_void_cartographer'
  | 'raid_endless_boss_hunter'
  | 'raid_hard_clear'
  | 'raid_expert_clear'
  | 'expert_clean_reactor'
  | 'raid_score_vanguard'
  | 'raid_score_overlord'
  | 'raid_expert_ace'
  | 'devil_contact'
  | 'devil_breaker'
  | 'devil_clean_break'
  | 'swarm_reaper'
  | 'swarm_extinction'
  | 'boss_executioner'
  | 'boss_annihilator'
  | 'supply_magnet'
  | 'supply_chain_master'
  | 'battle_hardened'
  | 'run_centurion'
  | 'score_chaser'
  | 'score_legend'
  | 'score_mythic'
  | 'score_transcendent'
  | 'coop_wingman'
  | 'coop_clear'
  | 'coop_veteran'
  | 'nuke_saver'
  | 'nuke_commander'
  | 'restraint_protocol'
  | 'ship_specialist'
  | 'ship_adept'
  | 'ship_elite'
  | 'ship_legend'
  | 'fleet_captain'
  | 'fleet_legend'
  | 'fleet_paragon'
  | 'all_ships_sortie'
  | 'fleet_mastery_circle'
  | 'mesiah_commander'
  | 'mesiah_ace'
  | 'core_lander_awakening'
  | 'god_frame_unlocked'
  | 'core_lander_devotee'
  | 'squid_hunter'
  | 'squid_breaker'
  | 'serpent_breaker'
  | 'serpent_slayer'
  | 'fortress_fall'
  | 'fortress_ace'
  | 'campaign_marathon'
  | 'arsenal_runner'
  | 'ace_master'
  | 'all_modes'

export type CodexId =
  | 'earth_defense_grid'
  | 'tower_command'
  | 'alien_swarm'
  | 'boss_anatomy'
  | 'supply_routes'
  | 'commander_records'
  | 'weapon_lab'
  | 'difficulty_protocols'
  | 'score_multiplier_table'
  | 'expert_ops_manual'
  | 'elite_contacts'
  | 'elite_hunter_cells'
  | 'asteroid_cluster'
  | 'asteroid_debris'
  | 'rift_weather'
  | 'derelict_wrecks'
  | 'planetary_routes'
  | 'abyss_squid'
  | 'squid_biology'
  | 'serpent_guardian'
  | 'serpent_scales'
  | 'orbital_fortress'
  | 'devil_gundam'
  | 'devil_cells'
  | 'master_projectile_trace'
  | 'devil_break_report'
  | 'fortress_beam_core'
  | 'final_gauntlet'
  | 'endless_swarm'
  | 'ship_hangar'
  | 'fleet_registry'
  | 'mastery_lab'
  | 'pilot_academy'
  | 'boss_defeat_chain'
  | 'mesiah_battleship'
  | 'mesiah_command_log'
  | 'comet_drone_protocol'
  | 'core_lander_frame'
  | 'core_frame_variants'
  | 'burning_mode'
  | 'god_barrage_art'
  | 'spiegel_mirage_system'
  | 'deep_endless_chart'
  | 'pickup_arsenal'
  | 'nuke_protocol'
  | 'nuke_failsafe'
  | 'coop_link'
  | 'raid_events'

export type ShipMasteryRecord = {
  xp: number
  level: number
  runs: number
  bestScore: number
  totalScore: number
  victories: number
}

export type ShipCosmeticKey = 'trail' | 'aura' | 'frame'
export type ShipCosmeticEquipState = Partial<Record<ShipCosmeticKey, boolean>>
export type MesiahShipColor = 'black' | 'white'
export type CoreLanderModel = 'coreLander' | 'godGundam' | 'spiegel'

export type ProgressState = {
  version: 1
  towerDefenseEndlessUnlocked: boolean
  gradiusRaidEndlessUnlocked: boolean
  mesiahShipColor: MesiahShipColor
  coreLanderModel: CoreLanderModel
  gradiusEndlessTotalScore: number
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
  'defense_veteran',
  'defense_legend',
  'defense_score_elite',
  'endless_survivor',
  'endless_warden',
  'endless_legend',
  'defense_overwatch',
  'defense_endless_commander',
  'raid_endless_launch',
  'raid_endless_survivor',
  'raid_endless_vanguard',
  'raid_endless_legend',
  'raid_endless_boss_reaper',
  'raid_endless_score_ace',
  'raid_endless_super_junkie',
  'raid_endless_ultimate_junkie',
  'raid_endless_deep_space',
  'raid_endless_void_cartographer',
  'raid_endless_boss_hunter',
  'raid_hard_clear',
  'raid_expert_clear',
  'expert_clean_reactor',
  'raid_score_vanguard',
  'raid_score_overlord',
  'raid_expert_ace',
  'devil_contact',
  'devil_breaker',
  'devil_clean_break',
  'swarm_reaper',
  'swarm_extinction',
  'boss_executioner',
  'boss_annihilator',
  'supply_magnet',
  'supply_chain_master',
  'battle_hardened',
  'run_centurion',
  'score_chaser',
  'score_legend',
  'score_mythic',
  'score_transcendent',
  'coop_wingman',
  'coop_clear',
  'coop_veteran',
  'nuke_saver',
  'nuke_commander',
  'restraint_protocol',
  'ship_specialist',
  'ship_adept',
  'ship_elite',
  'ship_legend',
  'fleet_captain',
  'fleet_legend',
  'fleet_paragon',
  'all_ships_sortie',
  'fleet_mastery_circle',
  'mesiah_commander',
  'mesiah_ace',
  'core_lander_awakening',
  'god_frame_unlocked',
  'core_lander_devotee',
  'squid_hunter',
  'squid_breaker',
  'serpent_breaker',
  'serpent_slayer',
  'fortress_fall',
  'fortress_ace',
  'campaign_marathon',
  'arsenal_runner',
  'ace_master',
  'all_modes',
]

export const CODEX_IDS: CodexId[] = [
  'earth_defense_grid',
  'tower_command',
  'alien_swarm',
  'boss_anatomy',
  'supply_routes',
  'commander_records',
  'weapon_lab',
  'difficulty_protocols',
  'score_multiplier_table',
  'expert_ops_manual',
  'elite_contacts',
  'elite_hunter_cells',
  'asteroid_cluster',
  'asteroid_debris',
  'rift_weather',
  'derelict_wrecks',
  'planetary_routes',
  'abyss_squid',
  'squid_biology',
  'serpent_guardian',
  'serpent_scales',
  'orbital_fortress',
  'devil_gundam',
  'devil_cells',
  'master_projectile_trace',
  'devil_break_report',
  'fortress_beam_core',
  'final_gauntlet',
  'endless_swarm',
  'ship_hangar',
  'fleet_registry',
  'mastery_lab',
  'pilot_academy',
  'boss_defeat_chain',
  'mesiah_battleship',
  'mesiah_command_log',
  'comet_drone_protocol',
  'core_lander_frame',
  'core_frame_variants',
  'burning_mode',
  'god_barrage_art',
  'spiegel_mirage_system',
  'deep_endless_chart',
  'pickup_arsenal',
  'nuke_protocol',
  'nuke_failsafe',
  'coop_link',
  'raid_events',
]

export const SHIP_MASTERY_LEVEL_XP = 1600
export const SHIP_COSMETIC_SINGLE_RUN_SCORE = 500000
export const SHIP_COSMETIC_TOTAL_SCORE = 5000000
export const CORE_LANDER_UNLOCK_GRADIUS_ENDLESS_SCORE = 5000000
export const CORE_LANDER_GOD_GUNDAM_UNLOCK_SCORE = 1000000

const LEADERBOARD_MODES: LeaderboardMode[] = [
  'ship_defense_normal',
  'ship_defense_endless',
  'gradius_solo',
  'gradius_endless',
  'gradius_multiplayer',
]

export function createEmptyProgress(): ProgressState {
  return {
    version: 1,
    towerDefenseEndlessUnlocked: getStoredTowerDefenseEndlessUnlock(),
    gradiusRaidEndlessUnlocked: false,
    mesiahShipColor: 'black',
    coreLanderModel: 'coreLander',
    gradiusEndlessTotalScore: 0,
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
      gradius_endless: 0,
      gradius_multiplayer: 0,
    },
    bestStageByMode: {
      ship_defense_normal: 0,
      ship_defense_endless: 0,
      gradius_solo: 0,
      gradius_endless: 0,
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
  const normalized = normalizeProgress(progress)
  syncTowerDefenseEndlessUnlockStorage(normalized.towerDefenseEndlessUnlocked)
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(normalized))
}

export function resetProgressForNewAccount(): ProgressState {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(ENDLESS_UNLOCK_STORAGE_KEY)
  }
  const progress = {
    ...createEmptyProgress(),
    towerDefenseEndlessUnlocked: false,
  }
  saveProgress(progress)
  return progress
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
  if (result.mode === 'ship_defense_normal' && result.status === 'victory') {
    progress.towerDefenseEndlessUnlocked = true
  }
  if ((result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && result.status === 'victory') {
    progress.gradiusRaidEndlessUnlocked = true
  }

  progress.bestScoreByMode[result.mode] = Math.max(progress.bestScoreByMode[result.mode] ?? 0, Math.floor(result.score))
  progress.bestStageByMode[result.mode] = Math.max(progress.bestStageByMode[result.mode] ?? 0, Math.floor(result.stage))

  let shipLevelUp = false
  let shipLevel: number | undefined
  if (result.shipKey) {
    const current = progress.shipMastery[result.shipKey] ?? { xp: 0, level: 1, runs: 0, bestScore: 0, totalScore: 0, victories: 0 }
    const previousLevel = current.level
    const runScore = Math.max(0, Math.floor(result.score))
    current.runs += 1
    current.bestScore = Math.max(current.bestScore, runScore)
    current.totalScore += runScore
    if ((result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && result.status === 'victory') {
      current.victories += 1
    }
    current.xp += getShipMasteryXp(result)
    current.level = getShipMasteryLevelFromXp(current.xp)
    progress.shipMastery[result.shipKey] = current
    progress.equippedCosmetics[result.shipKey] = autoEquipNewCosmetics(progress.equippedCosmetics[result.shipKey], current)
    shipLevelUp = current.level > previousLevel
    shipLevel = current.level
  }

  const isGradiusRun = result.mode === 'gradius_solo' || result.mode === 'gradius_endless' || result.mode === 'gradius_multiplayer'
  const isGradiusEndlessRun = result.mode === 'gradius_endless' || (isGradiusRun && result.raidMode === 'endless')
  const isGradiusCampaignRun = (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && result.raidMode !== 'endless'
  if (isGradiusEndlessRun) {
    progress.gradiusEndlessTotalScore += Math.max(0, Math.floor(result.score))
  }

  const shipMasteries = Object.values(progress.shipMastery)
  const coreLanderMastery = progress.shipMastery.coreLander
  const mesiahMastery = progress.shipMastery.mesiah
  const coreLanderAwakened = progress.gradiusEndlessTotalScore >= CORE_LANDER_UNLOCK_GRADIUS_ENDLESS_SCORE || (coreLanderMastery?.runs ?? 0) > 0
  const godFrameUnlocked = (coreLanderMastery?.totalScore ?? 0) >= CORE_LANDER_GOD_GUNDAM_UNLOCK_SCORE
  const gradiusCampaignCleared = isGradiusCampaignRun && result.status === 'victory'
  const hardOrExpertClear = result.difficulty === 'hard' || result.difficulty === 'expert'
  const allShipsSortied = shipMasteries.filter((ship) => ship.runs > 0).length >= 9

  const unlockAchievement = (id: AchievementId, condition: boolean) => {
    if (!condition || progress.achievements[id]) return
    progress.achievements[id] = now
    unlockedAchievements.push(id)
  }

  unlockAchievement('first_sortie', progress.totalRuns >= 1)
  unlockAchievement('defense_clear', result.mode === 'ship_defense_normal' && result.status === 'victory')
  unlockAchievement('raid_clear', isGradiusRun && result.status === 'victory')
  unlockAchievement('boss_breaker', progress.bossesDefeated >= 10)
  unlockAchievement('defense_veteran', progress.bestStageByMode.ship_defense_normal >= 10)
  unlockAchievement('defense_legend', result.mode === 'ship_defense_normal' && result.status === 'victory' && result.score >= 15000)
  unlockAchievement('defense_score_elite', result.mode === 'ship_defense_normal' && result.status === 'victory' && result.score >= 30000)
  unlockAchievement('endless_survivor', result.mode === 'ship_defense_endless' && result.stage >= 15)
  unlockAchievement('endless_warden', result.mode === 'ship_defense_endless' && result.stage >= 25)
  unlockAchievement('endless_legend', result.mode === 'ship_defense_endless' && result.stage >= 40)
  unlockAchievement('defense_overwatch', result.mode === 'ship_defense_endless' && result.stage >= 60)
  unlockAchievement('defense_endless_commander', result.mode === 'ship_defense_endless' && result.stage >= 80)
  unlockAchievement('raid_endless_launch', isGradiusEndlessRun && result.score > 0)
  unlockAchievement('raid_endless_survivor', isGradiusEndlessRun && result.stage >= 10)
  unlockAchievement('raid_endless_vanguard', isGradiusEndlessRun && result.stage >= 20)
  unlockAchievement('raid_endless_legend', isGradiusEndlessRun && result.stage >= 30)
  unlockAchievement('raid_endless_boss_reaper', isGradiusEndlessRun && (result.bossesDefeated ?? 0) >= 10)
  unlockAchievement('raid_endless_score_ace', isGradiusEndlessRun && result.score >= 150000)
  unlockAchievement('raid_endless_super_junkie', isGradiusEndlessRun && result.score >= 5000000)
  unlockAchievement('raid_endless_ultimate_junkie', isGradiusEndlessRun && result.score >= 10000000)
  unlockAchievement('raid_endless_deep_space', isGradiusEndlessRun && result.stage >= 50)
  unlockAchievement('raid_endless_void_cartographer', isGradiusEndlessRun && result.stage >= 75)
  unlockAchievement('raid_endless_boss_hunter', isGradiusEndlessRun && (result.bossesDefeated ?? 0) >= 25)
  unlockAchievement('raid_hard_clear', gradiusCampaignCleared && hardOrExpertClear)
  unlockAchievement('raid_expert_clear', gradiusCampaignCleared && result.difficulty === 'expert')
  unlockAchievement('expert_clean_reactor', gradiusCampaignCleared && result.difficulty === 'expert' && (result.nukesUsed ?? 0) === 0)
  unlockAchievement('raid_score_vanguard', gradiusCampaignCleared && result.score >= 75000)
  unlockAchievement('raid_score_overlord', gradiusCampaignCleared && result.score >= 150000)
  unlockAchievement('raid_expert_ace', gradiusCampaignCleared && result.difficulty === 'expert' && result.score >= 100000)
  unlockAchievement('devil_contact', isGradiusEndlessRun && Boolean(result.devilBossEncountered))
  unlockAchievement('devil_breaker', isGradiusEndlessRun && Boolean(result.devilBossDefeated))
  unlockAchievement('devil_clean_break', isGradiusEndlessRun && Boolean(result.devilBossDefeated) && (result.nukesUsed ?? 0) === 0)
  unlockAchievement('swarm_reaper', progress.enemiesDestroyed >= 500)
  unlockAchievement('swarm_extinction', progress.enemiesDestroyed >= 2500)
  unlockAchievement('boss_executioner', progress.bossesDefeated >= 50)
  unlockAchievement('boss_annihilator', progress.bossesDefeated >= 150)
  unlockAchievement('supply_magnet', progress.pickupsCollected >= 150)
  unlockAchievement('supply_chain_master', progress.pickupsCollected >= 500)
  unlockAchievement('battle_hardened', progress.totalRuns >= 25)
  unlockAchievement('run_centurion', progress.totalRuns >= 100)
  unlockAchievement('score_chaser', progress.totalScore >= 100000)
  unlockAchievement('score_legend', progress.totalScore >= 500000)
  unlockAchievement('score_mythic', progress.totalScore >= 2500000)
  unlockAchievement('score_transcendent', progress.totalScore >= 10000000)
  unlockAchievement('coop_wingman', result.mode === 'gradius_multiplayer' && result.score > 0)
  unlockAchievement('coop_clear', result.mode === 'gradius_multiplayer' && result.status === 'victory')
  unlockAchievement('coop_veteran', result.mode === 'gradius_multiplayer' && result.stage >= 10)
  unlockAchievement('nuke_saver', (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && result.status === 'victory' && (result.nukesUsed ?? 0) === 0)
  unlockAchievement('nuke_commander', progress.nukesUsed >= 20)
  unlockAchievement('restraint_protocol', (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && result.stage >= 10 && (result.nukesUsed ?? 0) === 0)
  unlockAchievement('ship_specialist', shipMasteries.some((ship) => ship.level >= 3))
  unlockAchievement('ship_adept', shipMasteries.some((ship) => ship.level >= 8))
  unlockAchievement('ship_elite', shipMasteries.some((ship) => ship.level >= 12))
  unlockAchievement('ship_legend', shipMasteries.some((ship) => ship.level >= 16))
  unlockAchievement('fleet_captain', shipMasteries.filter((ship) => ship.runs > 0).length >= 4)
  unlockAchievement('fleet_legend', shipMasteries.filter((ship) => ship.level >= 5).length >= 3)
  unlockAchievement('fleet_paragon', shipMasteries.filter((ship) => ship.level >= 8).length >= 5)
  unlockAchievement('all_ships_sortie', allShipsSortied)
  unlockAchievement('fleet_mastery_circle', shipMasteries.filter((ship) => ship.level >= 12).length >= 5)
  unlockAchievement('mesiah_commander', (mesiahMastery?.runs ?? 0) > 0)
  unlockAchievement('mesiah_ace', (mesiahMastery?.totalScore ?? 0) >= 1000000)
  unlockAchievement('core_lander_awakening', coreLanderAwakened)
  unlockAchievement('god_frame_unlocked', godFrameUnlocked)
  unlockAchievement('core_lander_devotee', (coreLanderMastery?.totalScore ?? 0) >= 5000000)
  unlockAchievement('squid_hunter', (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && result.stage >= 5)
  unlockAchievement('squid_breaker', (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && result.stage >= 6)
  unlockAchievement('serpent_breaker', (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && result.stage >= 10)
  unlockAchievement('serpent_slayer', (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && result.stage >= 11)
  unlockAchievement('fortress_fall', (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && result.status === 'victory')
  unlockAchievement('fortress_ace', (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && result.status === 'victory' && result.score >= 30000)
  unlockAchievement('campaign_marathon', (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && result.stage >= 12 && (result.durationMs ?? 0) >= 600000)
  unlockAchievement('arsenal_runner', progress.pickupsCollected >= 50)
  unlockAchievement('ace_master', Object.values(progress.shipMastery).some((ship) => ship.level >= 5))
  unlockAchievement('all_modes', LEADERBOARD_MODES.every((mode) => progress.bestScoreByMode[mode] > 0))

  const unlockCodex = (id: CodexId, condition: boolean) => {
    if (!condition || progress.codex[id]) return
    progress.codex[id] = now
    unlockedCodex.push(id)
  }

  unlockCodex('earth_defense_grid', result.mode === 'ship_defense_normal' || result.mode === 'ship_defense_endless')
  unlockCodex('tower_command', result.mode === 'ship_defense_normal' && result.stage >= 3)
  unlockCodex('alien_swarm', result.enemiesDestroyed !== undefined && result.enemiesDestroyed > 0)
  unlockCodex('boss_anatomy', progress.bossesDefeated >= 5)
  unlockCodex('supply_routes', progress.pickupsCollected >= 10)
  unlockCodex('commander_records', progress.totalRuns >= 5)
  unlockCodex('weapon_lab', progress.bestScoreByMode.gradius_solo > 0 || progress.bestScoreByMode.gradius_endless > 0 || progress.bestScoreByMode.gradius_multiplayer > 0)
  unlockCodex('difficulty_protocols', isGradiusRun)
  unlockCodex('score_multiplier_table', isGradiusRun && Boolean(result.difficulty))
  unlockCodex('expert_ops_manual', isGradiusRun && result.difficulty === 'expert')
  unlockCodex('elite_contacts', result.stage >= 2 || progress.bossesDefeated >= 1)
  unlockCodex('elite_hunter_cells', (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && result.stage >= 4)
  unlockCodex('asteroid_cluster', result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer')
  unlockCodex('asteroid_debris', (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && result.stage >= 3)
  unlockCodex('rift_weather', (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && result.stage >= 5)
  unlockCodex('derelict_wrecks', (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && result.stage >= 6)
  unlockCodex('planetary_routes', (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && result.stage >= 8)
  unlockCodex('abyss_squid', (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && result.stage >= 5)
  unlockCodex('squid_biology', (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && result.stage >= 6)
  unlockCodex('serpent_guardian', (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && result.stage >= 10)
  unlockCodex('serpent_scales', (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && result.stage >= 11)
  unlockCodex('orbital_fortress', (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && (result.stage >= 15 || result.status === 'victory'))
  unlockCodex('devil_gundam', isGradiusEndlessRun && Boolean(result.devilBossEncountered))
  unlockCodex('devil_cells', isGradiusEndlessRun && Boolean(result.devilBossEncountered))
  unlockCodex('master_projectile_trace', isGradiusEndlessRun && Boolean(result.devilBossEncountered))
  unlockCodex('devil_break_report', isGradiusEndlessRun && Boolean(result.devilBossDefeated))
  unlockCodex('fortress_beam_core', (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && (result.stage >= 15 || result.status === 'victory'))
  unlockCodex('final_gauntlet', (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && result.status === 'victory')
  unlockCodex('endless_swarm', result.mode === 'ship_defense_endless')
  unlockCodex('ship_hangar', Boolean(result.shipKey))
  unlockCodex('fleet_registry', shipMasteries.filter((ship) => ship.runs > 0).length >= 4)
  unlockCodex('mastery_lab', shipMasteries.some((ship) => ship.level >= 3))
  unlockCodex('pilot_academy', shipMasteries.some((ship) => ship.runs >= 3))
  unlockCodex('boss_defeat_chain', progress.bossesDefeated >= 25)
  unlockCodex('mesiah_battleship', (mesiahMastery?.runs ?? 0) > 0 || Boolean(progress.achievements.fortress_fall))
  unlockCodex('mesiah_command_log', (mesiahMastery?.totalScore ?? 0) >= 500000)
  unlockCodex('comet_drone_protocol', (mesiahMastery?.runs ?? 0) > 0)
  unlockCodex('core_lander_frame', coreLanderAwakened)
  unlockCodex('core_frame_variants', godFrameUnlocked)
  unlockCodex('burning_mode', coreLanderAwakened || (coreLanderMastery?.runs ?? 0) > 0)
  unlockCodex('god_barrage_art', godFrameUnlocked)
  unlockCodex('spiegel_mirage_system', godFrameUnlocked)
  unlockCodex('deep_endless_chart', isGradiusEndlessRun && result.stage >= 50)
  unlockCodex('pickup_arsenal', (result.pickupsCollected ?? 0) > 0 || progress.pickupsCollected > 0)
  unlockCodex('nuke_protocol', (result.nukesUsed ?? 0) > 0 || progress.nukesUsed > 0)
  unlockCodex('nuke_failsafe', progress.nukesUsed >= 5)
  unlockCodex('coop_link', result.mode === 'gradius_multiplayer' && result.score > 0)
  unlockCodex('raid_events', (result.mode === 'gradius_solo' || result.mode === 'gradius_multiplayer') && result.stage >= 3)

  saveProgress(progress)
  return { progress, unlockedAchievements, unlockedCodex, shipLevelUp, shipLevel }
}

export function getCompletionPercent(progress: ProgressState) {
  if (hasProgressionUnlockOverride()) return 100
  const achievements = ACHIEVEMENT_IDS.filter((id) => progress.achievements[id]).length
  const codex = CODEX_IDS.filter((id) => progress.codex[id]).length
  return Math.round(((achievements + codex) / (ACHIEVEMENT_IDS.length + CODEX_IDS.length)) * 100)
}

export function isLocalProgressionTestHost() {
  if (typeof window === 'undefined') return false
  return ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(window.location.hostname)
}

export function isCreatorProgressionUser() {
  if (typeof window === 'undefined') return false
  return isCreatorPlayerName(window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY) || '')
}

export function hasProgressionUnlockOverride() {
  return isLocalProgressionTestHost() || isCreatorProgressionUser()
}

export function isGradiusRaidEndlessUnlocked(progress: ProgressState) {
  if (hasProgressionUnlockOverride()) return true
  return Boolean(
    progress.gradiusRaidEndlessUnlocked ||
    progress.achievements.raid_clear ||
    progress.achievements.fortress_fall ||
    (progress.bestStageByMode.gradius_solo ?? 0) >= 15 ||
    (progress.bestStageByMode.gradius_multiplayer ?? 0) >= 15
  )
}

export function isCoreLanderUnlocked(progress: ProgressState) {
  if (hasProgressionUnlockOverride()) return true
  return (progress.gradiusEndlessTotalScore ?? 0) >= CORE_LANDER_UNLOCK_GRADIUS_ENDLESS_SCORE
}

export function isCoreLanderGodGundamUnlocked(progress: ProgressState) {
  if (hasProgressionUnlockOverride()) return true
  return (progress.shipMastery.coreLander?.totalScore ?? 0) >= CORE_LANDER_GOD_GUNDAM_UNLOCK_SCORE
}

export function getStoredTowerDefenseEndlessUnlock() {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(ENDLESS_UNLOCK_STORAGE_KEY) === 'true'
}

export function markTowerDefenseEndlessUnlocked() {
  const progress = loadProgress()
  progress.towerDefenseEndlessUnlocked = true
  saveProgress(progress)
  return progress
}

export function isShipCosmeticUnlocked(mastery: ShipMasteryRecord | undefined, cosmetic: ShipCosmeticKey) {
  if (hasProgressionUnlockOverride()) return true
  if (!mastery) return false
  if (cosmetic === 'trail') return mastery.bestScore >= SHIP_COSMETIC_SINGLE_RUN_SCORE
  if (cosmetic === 'aura') return mastery.victories > 0
  return mastery.totalScore >= SHIP_COSMETIC_TOTAL_SCORE
}

export function getEquippedShipCosmetics(progress: ProgressState, shipKey: string): Required<ShipCosmeticEquipState> {
  const mastery = progress.shipMastery[shipKey]
  const equipped = progress.equippedCosmetics[shipKey] ?? {}
  return {
    trail: isShipCosmeticUnlocked(mastery, 'trail') && equipped.trail !== false,
    aura: isShipCosmeticUnlocked(mastery, 'aura') && equipped.aura !== false,
    frame: isShipCosmeticUnlocked(mastery, 'frame') && equipped.frame !== false,
  }
}

export function setShipCosmeticEquipped(shipKey: string, cosmetic: ShipCosmeticKey, equipped: boolean) {
  const progress = loadProgress()
  const mastery = progress.shipMastery[shipKey]
  const nextEquipped = {
    ...(progress.equippedCosmetics[shipKey] ?? {}),
    [cosmetic]: isShipCosmeticUnlocked(mastery, cosmetic) ? equipped : false,
  }
  progress.equippedCosmetics = {
    ...progress.equippedCosmetics,
    [shipKey]: nextEquipped,
  }
  saveProgress(progress)
  return progress
}

export function getMesiahShipColor(progress: ProgressState): MesiahShipColor {
  return progress.mesiahShipColor === 'white' ? 'white' : 'black'
}

export function setMesiahShipColor(color: MesiahShipColor) {
  const progress = loadProgress()
  progress.mesiahShipColor = color
  saveProgress(progress)
  return progress
}

export function getCoreLanderModel(progress: ProgressState): CoreLanderModel {
  return (progress.coreLanderModel === 'godGundam' || progress.coreLanderModel === 'spiegel') && isCoreLanderGodGundamUnlocked(progress) ? progress.coreLanderModel : 'coreLander'
}

export function setCoreLanderModel(model: CoreLanderModel) {
  const progress = loadProgress()
  progress.coreLanderModel = (model === 'godGundam' || model === 'spiegel') && isCoreLanderGodGundamUnlocked(progress) ? model : 'coreLander'
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

function autoEquipNewCosmetics(current: ShipCosmeticEquipState | undefined, mastery: ShipMasteryRecord): ShipCosmeticEquipState {
  const next: ShipCosmeticEquipState = {}
  ;(['trail', 'aura', 'frame'] as ShipCosmeticKey[]).forEach((cosmetic) => {
    if (current?.[cosmetic] !== undefined) {
      next[cosmetic] = current[cosmetic]
    }
  })
  ;(['trail', 'aura', 'frame'] as ShipCosmeticKey[]).forEach((cosmetic) => {
    if (isShipCosmeticUnlocked(mastery, cosmetic) && next[cosmetic] === undefined) {
      next[cosmetic] = true
    }
  })
  return next
}

export function normalizeProgress(value: unknown): ProgressState {
  const empty = createEmptyProgress()
  if (!value || typeof value !== 'object') return empty

  const data = value as Partial<ProgressState>
  const shipMastery = normalizeShipMastery(data.shipMastery ?? {})
  return {
    ...empty,
    ...data,
    version: 1,
    towerDefenseEndlessUnlocked: Boolean(data.towerDefenseEndlessUnlocked || getStoredTowerDefenseEndlessUnlock()),
    gradiusRaidEndlessUnlocked: Boolean(data.gradiusRaidEndlessUnlocked || data.achievements?.raid_clear || data.achievements?.fortress_fall || (data.bestStageByMode?.gradius_solo ?? 0) >= 15 || (data.bestStageByMode?.gradius_multiplayer ?? 0) >= 15),
    mesiahShipColor: data.mesiahShipColor === 'white' ? 'white' : 'black',
    coreLanderModel: (data.coreLanderModel === 'godGundam' || data.coreLanderModel === 'spiegel') && isCoreLanderGodGundamUnlocked({ ...empty, ...data, shipMastery } as ProgressState) ? data.coreLanderModel : 'coreLander',
    gradiusEndlessTotalScore: Math.max(
      Math.floor(Number(data.bestScoreByMode?.gradius_endless) || 0),
      Math.floor(Number(data.gradiusEndlessTotalScore) || 0),
    ),
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

function syncTowerDefenseEndlessUnlockStorage(unlocked: boolean) {
  if (typeof window === 'undefined') return
  if (unlocked) window.localStorage.setItem(ENDLESS_UNLOCK_STORAGE_KEY, 'true')
  else window.localStorage.removeItem(ENDLESS_UNLOCK_STORAGE_KEY)
}

function normalizeShipMastery(records: Record<string, ShipMasteryRecord>) {
  return Object.fromEntries(Object.entries(records).map(([shipKey, record]) => {
    const xp = Math.max(0, Math.floor(Number(record?.xp) || 0))
    const bestScore = Math.max(0, Math.floor(Number(record?.bestScore) || 0))
    const totalScore = Math.max(bestScore, Math.floor(Number(record?.totalScore) || 0))
    return [shipKey, {
      xp,
      level: getShipMasteryLevelFromXp(xp),
      runs: Math.max(0, Math.floor(Number(record?.runs) || 0)),
      bestScore,
      totalScore,
      victories: Math.max(0, Math.floor(Number(record?.victories) || 0)),
    }]
  }))
}

function normalizeEquippedCosmetics(
  equippedCosmetics: Record<string, ShipCosmeticEquipState>,
  shipMastery: Record<string, ShipMasteryRecord>,
) {
  const normalized: Record<string, ShipCosmeticEquipState> = {}
  Object.entries(shipMastery).forEach(([shipKey, mastery]) => {
    normalized[shipKey] = autoEquipNewCosmetics(equippedCosmetics[shipKey], mastery)
  })
  return normalized
}
