import { isCreatorPlayerName } from '../../../leaderboards'
import { isLocalProgressionTestHost } from '../../../progression'
import { getPublicAssetUrl } from '../sound'
import type { BossKind, MiniBossKind, PowerKind, RaidDifficulty, RaidMode, ShipOption, WeaponKey } from './types'

export const DIFFICULTY_CONFIGS: Record<RaidDifficulty, { enemyHpMult: number; damageMult: number; scoreMult: number; playerHpBonus: number; oneHp: boolean }> = {
  easy:   { enemyHpMult: 0.65, damageMult: 1,   scoreMult: 0.6,  playerHpBonus: 2, oneHp: false },
  normal: { enemyHpMult: 1,    damageMult: 1,   scoreMult: 1,    playerHpBonus: 0, oneHp: false },
  hard:   { enemyHpMult: 2,    damageMult: 2,   scoreMult: 1.4,  playerHpBonus: 0, oneHp: false },
  expert: { enemyHpMult: 2,    damageMult: 2,   scoreMult: 2,    playerHpBonus: 0, oneHp: true  },
}

export const WIDTH = 100

export const HEIGHT = 100

export const PLAYER_RADIUS = 3.2

export const MAX_RAID_STAGE = 15

export const RAID_CHECKPOINTS = [5, 10, 14] as const

export const BOSS_RUSH_STAGES = [5, 10, 15] as const

export const BOSS_RUSH_ATTACK_COOLDOWN_SCALE = 0.72

export const BOSS_RUSH_SPECIAL_RECHARGE_SCALE = 1.32

export const BOSS_RUSH_MOTION_SCALE = 1.18

export const BOSS_RUSH_ENTRY_SPEED_SCALE = 1.2

export function getBossRushStage(startStage: number) {
  const requestedStage = Math.floor(startStage)
  return (BOSS_RUSH_STAGES as readonly number[]).includes(requestedStage) ? requestedStage : BOSS_RUSH_STAGES[0]
}

export function getNextBossRushStage(stage: number) {
  return BOSS_RUSH_STAGES.find((bossStage) => bossStage > stage) ?? null
}

export const STORAGE_KEY = 'gradiusRaidHighScore'

export const RAID_UNLOCK_STORAGE_KEY = 'gradiusRaidUnlockedStage'

export const RAID_CHECKPOINT_STORAGE_KEY = 'gradiusRaidCheckpointStage'

export const PLAYER_COLOR = '#ef233c'

export const ALLY_PLAYER_COLOR = '#38bdf8'

export const DARK_ENEMY_COLORS = ['#4c1d95', '#581c87', '#7f1d1d', '#831843', '#312e81', '#164e63', '#3f1d2e', '#1f2937']

export const MINI_BOSS_KINDS: MiniBossKind[] = ['stalker', 'brood', 'lancer']

export const MINI_BOSS_COLORS: Record<MiniBossKind, string> = {
  stalker: '#06b6d4',
  brood: '#a855f7',
  lancer: '#f43f5e',
}

export const ELITE_ENEMY_STAGE_START = 2

export const BOSS_COLORS: Record<BossKind, string> = {
  carrier: '#7f1d1d',
  orb: '#581c87',
  serpent: '#164e63',
  mantis: '#365314',
  hydra: '#4c1d95',
  gate: '#0f172a',
  super: '#3f1d2e',
  squid: '#7c3aed',
  snake: '#e11d48',
  final: '#120617',
  devil: '#450a0a',
}

export const ENDLESS_BOSS_POOL: BossKind[] = ['carrier', 'orb', 'serpent', 'mantis', 'hydra', 'gate', 'super', 'squid', 'snake', 'final']

export const ENDLESS_BOSS_POOL_WITHOUT_FINAL: BossKind[] = ENDLESS_BOSS_POOL.filter((kind) => kind !== 'final')

export const DEVIL_BOSS_RAMP_ENDLESS_STAGE = 10

export const DEVIL_BOSS_MIN_STAGE_GAP = 5

export const DEVIL_BOSS_MAX_STAGE_GAP = 10

export function pickEndlessBossKind(stage: number, wave: number, devilNextEligibleStage: number, creatorDevilBoost = false): BossKind {
  const danger = Math.max(stage, wave)
  if (danger >= devilNextEligibleStage) {
    const rampDepth = Math.max(0, danger - DEVIL_BOSS_RAMP_ENDLESS_STAGE)
    const devilChance = creatorDevilBoost ? 0.5 : danger < DEVIL_BOSS_RAMP_ENDLESS_STAGE ? 0.018 : Math.min(0.46, 0.3 + rampDepth * 0.012)
    if (Math.random() < devilChance) return 'devil'
  }
  if (danger >= 8 && danger % 5 === 0 && Math.random() < 0.42) return 'final'
  if (danger >= 5 && Math.random() < 0.22) return Math.random() < 0.5 ? 'squid' : 'snake'
  if (danger >= 4 && Math.random() < 0.18) return 'super'
  const pool = danger >= 10 ? ENDLESS_BOSS_POOL : ENDLESS_BOSS_POOL_WITHOUT_FINAL
  return pool[Math.floor(Math.random() * pool.length)]
}

export function shouldForceLocalDevilBossTest(stage: number, mode: RaidMode, playerName: string) {
  return mode === 'endless' && stage === 1 && isLocalProgressionTestHost() && !isCreatorPlayerName(playerName)
}

export function shouldForceLocalDerelictWreckTest(stage: number, mode: RaidMode) {
  return mode === 'campaign' && stage === 1 && isLocalProgressionTestHost()
}

export const RAID_DEFAULT_BGM_TRACK = getPublicAssetUrl('audio/bgm_scifi_loop.ogg')

export const RAID_BOSS_BGM_TRACK = getPublicAssetUrl('audio/sfx_boss_battle.wav')

export const RAID_BOSS_SQUID_BGM_TRACK = getPublicAssetUrl('audio/bgm_boss_squid.mp3')

export const RAID_BOSS_SNAKE_BGM_TRACK = getPublicAssetUrl('audio/bgm_boss_snake.mp3')

export const RAID_BOSS_FINAL_BGM_TRACK = getPublicAssetUrl('audio/bgm_boss_final.wav')

export const RAID_ENDING_BGM_TRACK = getPublicAssetUrl('audio/bgm_shelter.wav')

export const RAID_BGM_STAGE_RATES = [0.92, 0.98, 1.04, 1.1]

export const RAID_BOSS_APPROACH_SILENCE_SECONDS = 5.5

export const SHIP_OPTIONS: ShipOption[] = [
  { key: 'rocket', name: 'Black Comet', role: 'Balanced missile frame', speed: 1, hp: 6, fireRate: 1 },
  { key: 'fast', name: 'Red Wraith', role: 'Fastest dodge craft', speed: 1.18, hp: 5, fireRate: 1.08 },
  { key: 'gatling', name: 'Crimson Saw', role: 'Rapid assault striker', speed: 0.96, hp: 6, fireRate: 1.18 },
  { key: 'laser', name: 'Night Lance', role: 'Sharper beam control', speed: 1.03, hp: 5, fireRate: 1.12 },
  { key: 'dreadnought', name: 'Obsidian Ark', role: 'Heavy survival hull', speed: 0.82, hp: 8, fireRate: 0.86 },
  { key: 'xwing', name: 'Crosswing Nova', role: 'Four-cannon S-foil ace', speed: 1.14, hp: 5, fireRate: 1.18 },
  { key: 'spaceEt', name: 'Space Jet', role: 'Comet-tail microfighter', speed: 1.24, hp: 3, fireRate: 1.28 },
  { key: 'mesiah', name: 'Mesiah', role: 'Post-clear command battleship', speed: 1.08, hp: 7, fireRate: 1.16 },
  { key: 'coreLander', name: 'Core Lander', role: 'AOE comet striker. Burning awakens at low HP.', speed: 0.94, hp: 6, fireRate: 1 },
]

export const BRIEFING_PICKUP_TYPES: Record<string, PowerKind> = {
  'V Spread': 'spread',
  'L Laser': 'laser',
  '* Scatter': 'scatter',
  'R Rocket': 'rocket',
  'H Homing': 'homing',
  'O Scouts': 'option',
  'S Shield': 'shield',
  'F Force Field': 'forcefield',
  '+ Repair': 'repair',
  'LV Level Up': 'levelup',
}

export const PICKUP_PREVIEW_SEEDS: Record<PowerKind, number> = {
  spread: 1,
  laser: 2,
  scatter: 3,
  rocket: 4,
  homing: 5,
  option: 6,
  shield: 7,
  forcefield: 8,
  repair: 9,
  levelup: 10,
}

export const EMPTY_WEAPONS: Record<WeaponKey, number> = {
  spread: 0,
  laser: 0,
  scatter: 0,
  rocket: 0,
  homing: 0,
}

export const EMPTY_WEAPON_FLAGS: Record<WeaponKey, boolean> = {
  spread: false,
  laser: false,
  scatter: false,
  rocket: false,
  homing: false,
}

export const EMPTY_WEAPON_TIMERS: Record<WeaponKey, number> = {
  spread: 0,
  laser: 0,
  scatter: 0,
  rocket: 0,
  homing: 0,
}

export function getShipSpriteSize(shipKey: string, context: 'player' | 'option' | 'picker') {
  if (shipKey === 'mesiah') return context === 'player' ? 128 : context === 'option' ? 38 : 112
  if (shipKey === 'mesiahRaptorBlack' || shipKey === 'mesiahRaptorWhite') return context === 'player' ? 74 : context === 'option' ? 36 : 80
  if (shipKey === 'godGundam') return context === 'player' ? 122 : context === 'option' ? 40 : 116
  if (shipKey === 'godGundamBurning') return context === 'player' ? 122 : context === 'option' ? 40 : 116
  if (shipKey === 'spiegel') return context === 'player' ? 122 : context === 'option' ? 40 : 116
  if (shipKey === 'coreLanderBurning') return context === 'player' ? 116 : context === 'option' ? 46 : 112
  if (shipKey === 'coreLander') return context === 'player' ? 110 : context === 'option' ? 44 : 108
  if (shipKey === 'dreadnought') return context === 'player' ? 88 : context === 'option' ? 40 : 88
  if (shipKey === 'spaceEt') return context === 'player' ? 84 : context === 'option' ? 38 : 84
  if (shipKey === 'xwing') return context === 'player' ? 78 : context === 'option' ? 36 : 82
  return context === 'player' ? 74 : context === 'option' ? 34 : 80
}

export const WEAPON_STACK_CAPS: Record<WeaponKey, number> = {
  spread: 2,
  laser: 1,
  scatter: 2,
  rocket: 2,
  homing: 1,
}

export const WEAPON_FIRE_INTERVALS: Record<WeaponKey, number> = {
  spread: 0.34,
  laser: 0.22,
  scatter: 0.48,
  rocket: 0.82,
  homing: 6.5,
}

export const WEAPON_KEYS: WeaponKey[] = ['spread', 'laser', 'scatter', 'rocket', 'homing']

export const CORE_LANDER_FIRE_INTERVAL_SECONDS = 0.5

export const CORE_LANDER_BURNING_FIRE_INTERVAL_SECONDS = 0.32

export const CORE_LANDER_BURNING_RAGE_FIRE_INTERVAL_REDUCTION = 0.1

export const CORE_LANDER_BASE_DAMAGE_BONUS = 4

export const CORE_LANDER_BURNING_DAMAGE_BONUS = 7

export const CORE_LANDER_BURNING_RAGE_DAMAGE_BONUS = 14

export const CORE_LANDER_AOE_RADIUS = 12.5

export const SPIEGEL_KUNAI_DAMAGE_MULTIPLIER = 0.34

export const SPIEGEL_KUNAI_SPLASH_DAMAGE_MULTIPLIER = 0.34

export const FORCE_FIELD_ARMOR = 5

export const PLAYER_MAX_RANK = 20

export const PLAYER_BASE_ATTACK_PER_LEVEL = 0.65

export const LEVEL_UP_HEAL = 1

export const FINAL_BOSS_NUKE_DAMAGE_MULTIPLIER = 0.26

export const DEVIL_BOSS_NUKE_DAMAGE_MULTIPLIER = 0.075

export const SPACE_ET_PASSIVE_FORCE_FIELD_CHARGES = 3

export const SPACE_ET_FORCE_FIELD_REGEN_SECONDS = 20

export const MESIAH_DRONE_FIRE_INTERVAL_SECONDS = 0.1

export const MESIAH_DRONE_MIN_FIRE_RANGE = 7.5

export const MESIAH_DRONE_MAX_FIRE_RANGE = 19

export const MESIAH_ROCKET_FIRE_INTERVAL_SECONDS = 0.36

export const MESIAH_DRONE_HOME_OFFSET = 11.6

export const MESIAH_DRONE_MOBILE_HOME_OFFSET = 18.5

export const GOD_GUNDAM_BURNING_BODY_SCALE = 1.09

export const GOD_GUNDAM_BURNING_BODY_Y_OFFSET = -0.064

export const GOD_GUNDAM_BURNING_HALO_SCALE = 0.86

export const GOD_GUNDAM_BURNING_HALO_Y_OFFSET = -0.15

export const NORMAL_POWER_DROP_COOLDOWN = 3.8

export const POWER_PITY_KILLS = 12

export const GAMEPLAY_SNAPSHOT_INTERVAL_MS = 100

export const GAMEPLAY_ALERT_SNAPSHOT_INTERVAL_MS = 50

export const IDLE_SNAPSHOT_INTERVAL_MS = 120

export const MULTIPLAYER_STATE_INTERVAL_MS = 50

export const MULTIPLAYER_INPUT_INTERVAL_MS = 50

export const MULTIPLAYER_HEARTBEAT_INTERVAL_MS = 1800

export const MULTIPLAYER_HEARTBEAT_TIMEOUT_MS = 5200

export const MULTIPLAYER_CONNECTION_CHECK_MS = 250

export const MULTIPLAYER_STATE_STALE_MS = 1400

export const MULTIPLAYER_STATE_LOST_MS = 3600

export const MULTIPLAYER_GUEST_STALE_MS = 2200

export const MULTIPLAYER_MAX_BUFFERED_BYTES = 512 * 1024

export const MULTIPLAYER_MAX_SHOTS = 120

export const MULTIPLAYER_MAX_ENEMY_SHOTS = 140

export const MULTIPLAYER_MAX_ENEMIES = 40

export const MULTIPLAYER_MAX_ASTEROIDS = 18

export const MULTIPLAYER_MAX_METEORS = 24

export const MULTIPLAYER_MAX_ION_STRIKES = 8

export const MULTIPLAYER_MAX_WRECKS = 3

export const MULTIPLAYER_MAX_POWERUPS = 16

export const MULTIPLAYER_MAX_SPARKS = 16

export const MULTIPLAYER_MAX_RIPPLES = 6

export const MULTIPLAYER_ENTITY_MARGIN = 22

export const MULTIPLAYER_MAX_VISUAL_VELOCITY = 130

export const MULTIPLAYER_SOFT_CORRECTION_DISTANCE_SQ = 900

export const MULTIPLAYER_REMOTE_CORRECTION_BLEND = 0.08

export const MULTIPLAYER_OWN_CORRECTION_BLEND = 0.04

export // Client-side prediction: only snap guest's own position at extreme divergence (50 units)
const MULTIPLAYER_GUEST_SNAP_DISTANCE_SQ = 2500

export // Drain the accumulated position correction at this rate (fraction drained per second)
const MULTIPLAYER_CORRECTION_DRAIN_RATE = 8

export const MULTIPLAYER_MAX_GUEST_CORRECTION = 12

export const MULTIPLAYER_REMOTE_INPUT_BLEND = 0.35

export const MULTIPLAYER_REMOTE_INPUT_SNAP_DISTANCE_SQ = 1600

export const MULTIPLAYER_REMOTE_BUFFER_MAX = 8

export const MULTIPLAYER_REMOTE_INTERPOLATION_MIN_DELAY_MS = 100

export const MULTIPLAYER_REMOTE_INTERPOLATION_MAX_DELAY_MS = 170

export const MULTIPLAYER_REMOTE_EXTRAPOLATION_LIMIT_MS = 140

export const MULTIPLAYER_GUEST_SHOT_MIN_TTL_MS = 180

export const MULTIPLAYER_GUEST_SHOT_MAX_TTL_MS = 520

export const MULTIPLAYER_GUEST_SHOT_CONFIRM_MARGIN_MS = 120

export const HOMING_RETARGET_SECONDS = 0.18

export const HOMING_RETARGET_STAGGER_SECONDS = 0.012

export const NUKE_MIN_COOLDOWN_SECONDS = 25

export const NUKE_MAX_COOLDOWN_SECONDS = 50

export const NUKE_MISSILE_SECONDS = 0.82

export const NUKE_FLASH_SECONDS = 1.15

export const NUKE_BOSS_DAMAGE_MIN_RATIO = 0.16

export const NUKE_BOSS_DAMAGE_MAX_RATIO = 0.38

export const NUKE_BOSS_DAMAGE_MIN_FLOOR = 550

export const NUKE_BOSS_DAMAGE_MAX_FLOOR = 2400

export const GOD_GUNDAM_BARRAGE_DURATION_SECONDS = 8

export const GOD_GUNDAM_BARRAGE_HIT_INTERVAL_SECONDS = 0.32

export const GOD_GUNDAM_BARRAGE_FRAME_SECONDS = 0.42

export const GOD_GUNDAM_BARRAGE_BASE_DAMAGE_MULTIPLIER = 0.55

export const GOD_GUNDAM_BARRAGE_BURNING_DAMAGE_MULTIPLIER = 1.35

export const GOD_GUNDAM_BARRAGE_BURNING_RAGE_DAMAGE_MULTIPLIER = 0.55

export const GOD_GUNDAM_MELEE_RANGE = 29

export const GOD_GUNDAM_MELEE_BURNING_RANGE_BONUS = 4

export const GOD_GUNDAM_MELEE_EXHAUST_LIMIT_SECONDS = 15

export const GOD_GUNDAM_MELEE_EXHAUST_COOLDOWN_SECONDS = 5

export const GOD_GUNDAM_MELEE_HEAT_RECOVERY_PER_SECOND = 1.65

export const GOD_GUNDAM_MELEE_VISUAL_INTERVAL_SECONDS = 0.1

export const GOD_GUNDAM_MELEE_VISUAL_DURATION_SECONDS = 0.34

export const GOD_GUNDAM_DEFEAT_HOLD_SECONDS = 0.22

export const GOD_GUNDAM_MELEE_DAMAGE_PER_SECOND = 7.4

export const GOD_GUNDAM_MELEE_BOSS_DAMAGE_MULTIPLIER = 0.92

export const GOD_GUNDAM_MELEE_MINIBOSS_DAMAGE_MULTIPLIER = 1.08

export const GOD_GUNDAM_MELEE_BURNING_DAMAGE_MULTIPLIER = 1.62

export const GOD_GUNDAM_MELEE_BURNING_RAGE_DAMAGE_MULTIPLIER = 1.15

export const SPIEGEL_SHADOW_CLONE_DAMAGE_MULTIPLIER = 0.38

export const SPIEGEL_PASSIVE_DAMAGE_MULTIPLIER = 1.16

export const SPIEGEL_LOW_HP_PASSIVE_DAMAGE_MULTIPLIER = 1.1

export const SPIEGEL_LOW_HP_PASSIVE_RAGE_DAMAGE_MULTIPLIER = 0.22

export const SPIEGEL_LOW_HP_BARRAGE_DAMAGE_MULTIPLIER = 1.12

export const SPIEGEL_LOW_HP_BARRAGE_RAGE_DAMAGE_MULTIPLIER = 0.18

export const SPIEGEL_LOW_HP_SHADOW_CLONE_DAMAGE_MULTIPLIER = 0.52

export const SPIEGEL_LOW_HP_SHADOW_CLONE_RAGE_DAMAGE_MULTIPLIER = 0.18

export const SPIEGEL_SHADOW_CLONE_VISUAL_ALPHA_MULTIPLIER = 1.28

export const SPIEGEL_AFTERIMAGE_LIFE_MULTIPLIER = 1.18

export const SPIEGEL_AFTERIMAGE_CAP = 10

export const SPIEGEL_SHADOW_CLONE_OFFSET = 12

export const GOD_GUNDAM_STAGE_ATTACK_BONUS = 0.9

export const MULTIPLAYER_BOSS_HP_MULTIPLIER = 2.5

export const BOSS_RESPAWN_SECONDS = 90

export const STAGE_CLEAR_SECONDS = 3.15

export const STAGE_ENTRY_SECONDS = 1.18

export const BOSS_ENTRANCE_SLAM_SECONDS = 0.4

export const BOSS_ENTRANCE_SLOWMO_SCALE = 0.45

export const VICTORY_BLACKOUT_SECONDS = 0.55

export const FINAL_BOSS_BEAM_CHARGE_SECONDS = 1.65

export const FINAL_BOSS_BEAM_LIFE_SECONDS = 0.78

export const FINAL_BOSS_BEAM_SINGLE_RADIUS = 6.4

export const FINAL_BOSS_BEAM_PINCER_RADIUS = 5.4

export const FINAL_BOSS_BEAM_TRIDENT_RADIUS = 4.35

export const FINAL_BOSS_BEAM_SCATTER_RADIUS = 4.7

export const MAX_SPARKS = 45

export const MAX_RIPPLES = 6

export const SPARK_POOL_LIMIT = MAX_SPARKS * 5

export const RIPPLE_POOL_LIMIT = MAX_RIPPLES * 8

export const MAX_ASTEROIDS = 16

export const MAX_METEORS = 18

export const MAX_ION_STRIKES = 8

export const MAX_WRECKS = 3

export const ASTEROID_CLUSTER_WARNING_SECONDS = 3.2

export const ASTEROID_CLUSTER_SPAWN_DELAY_SECONDS = 1.35

export const ASTEROID_CLUSTER_MIN_SECONDS = 42

export const ASTEROID_CLUSTER_MAX_SECONDS = 64

export const RANDOM_EVENT_WARNING_SECONDS = 2.45

export const RANDOM_EVENT_MIN_SECONDS = 34

export const RANDOM_EVENT_MAX_SECONDS = 56

export const RAID_BACKGROUND_THEME_COUNT = 5

export const ENEMY_COLLISION_BUCKET_SIZE = 10

export const ENEMY_COLLISION_BUCKET_PADDING = 28

export const ENEMY_COLLISION_BUCKET_COUNT = Math.ceil((HEIGHT + ENEMY_COLLISION_BUCKET_PADDING * 2) / ENEMY_COLLISION_BUCKET_SIZE)

export const DEG = Math.PI / 180

export const COMET_ASSET_HEAD_ANGLE = 142 * DEG

export const SIDE_VALUES = [-1, 1] as const
