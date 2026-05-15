import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getGameAudioMixSettings, getGameSoundEnabled, getGraphicsQuality, getPublicAssetUrl, playGameSound, setGraphicsQuality, stopBGM } from './sound'
import type { GraphicsQuality } from './sound'
import { AlienShip, TowerShip } from './towerDefense/sprites'
import { submitLeaderboardScore } from '../../leaderboards'
import './GradiusRaid.css'

type WeaponKey = 'spread' | 'laser' | 'scatter' | 'rocket' | 'homing'
type PowerKind = WeaponKey | 'option' | 'shield' | 'forcefield' | 'repair' | 'levelup'
type GamePhase = 'select' | 'briefing' | 'playing' | 'paused' | 'gameover' | 'victory'
type BossMessage = 'incoming' | 'clear' | null
type BossKind = 'carrier' | 'orb' | 'serpent' | 'mantis' | 'hydra' | 'gate' | 'super' | 'squid' | 'snake' | 'final'
type MiniBossKind = 'stalker' | 'brood' | 'lancer'
type RaidBgmMode = 'cruise' | 'combat' | 'boss' | 'ending'
type MultiplayerConnectionQuality = 'good' | 'ok' | 'poor' | 'offline'
type RaidRandomEventKind = 'meteor' | 'solar' | 'rift' | 'wreck' | 'ambush' | 'ion'

type Vec = { x: number; y: number }

type ShipOption = {
  key: string
  name: string
  role: string
  speed: number
  hp: number
  fireRate: number
}

type Player = Vec & {
  hp: number
  maxHp: number
  invuln: number
  shield: number
  forceField: number
  passiveForceFieldRegen: number
  optionTimer: number
  fireCooldown: number
  weaponCooldowns: Record<WeaponKey, number>
  score: number
  rank: number
  ship: ShipOption
  weapons: Record<WeaponKey, number>
  weaponTimers: Record<WeaponKey, number>
}

type Shot = Vec & {
  id: number
  vx: number
  vy: number
  damage: number
  kind: WeaponKey | 'pulse' | 'enemy' | 'boss' | 'plasma' | 'blade' | 'orbShot' | 'superShot' | 'needle' | 'voidShot' | 'beam' | 'scatterBoss'
  radius: number
  pierce?: number
  turn?: number
  homingTargetId?: number
  retargetTime?: number
  life?: number
  maxLife?: number
}

type Enemy = Vec & {
  id: number
  vx: number
  vy: number
  hp: number
  maxHp: number
  radius: number
  variant: number
  isBoss: boolean
  isMiniBoss: boolean
  fireCooldown: number
  phase: number
  color: string
  pattern: number
  bossKind: BossKind | null
  miniBossKind: MiniBossKind | null
  shieldTime: number
  originX: number
  amplitude: number
  trainSlot: number
  pathSpeed: number
  chargeCooldown: number
  chargeTimer: number
  chargeLane: number
  chargePattern: 'single' | 'pincer' | 'trident' | 'scatter'
}

type FormationStyle = {
  color: string
  pattern: number
  originX: number
  amplitude: number
  pathSpeed: number
}

type PowerUp = Vec & {
  id: number
  type: PowerKind
  vy: number
  radius: number
  spin: number
}

type Spark = Vec & {
  id: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

type Ripple = Vec & {
  id: number
  life: number
  maxLife: number
  color: string
  size: number
}

type NukeStrike = {
  startX: number
  startY: number
  targetX: number
  targetY: number
  age: number
  duration: number
}

type AsteroidHazard = Vec & {
  id: number
  vx: number
  vy: number
  hp: number
  maxHp: number
  radius: number
  tier: number
  spin: number
  spinSpeed: number
  phase: number
}

type RaidRandomEvent = {
  kind: RaidRandomEventKind
  age: number
  duration: number
  warning: number
  seed: number
}

type MeteorHazard = Vec & {
  id: number
  vx: number
  vy: number
  radius: number
  life: number
  phase: number
}

type IonStrike = {
  id: number
  x: number
  width: number
  warmup: number
  life: number
  duration: number
}

type DerelictWreck = Vec & {
  id: number
  vx: number
  vy: number
  width: number
  height: number
  hp: number
  maxHp: number
  phase: number
}

type Snapshot = {
  phase: GamePhase
  player: Player
  allyPlayer: Player | null
  shots: Shot[]
  enemyShots: Shot[]
  enemies: Enemy[]
  powerUps: PowerUp[]
  sparks: Spark[]
  ripples: Ripple[]
  wave: number
  stageTheme: number
  bossAlert: number
  bossMessage: BossMessage
  highScore: number
  selectedShipKey: string
  pointer: Vec | null
  stageClear: number
  unlockedStage: number
  nukeCooldown: number
  nukeFlash: number
  asteroidWarning: number
  randomEvent: RaidRandomEvent | null
}

type MultiplayerInput = {
  target: Vec | null
  pointer: Vec | null
  position: Vec | null
  keys: string[]
  nuke: number
  at: number
}

type MultiplayerHostState = {
  seq: number
  phase: GamePhase
  hostPlayer: Player
  guestPlayer: Player | null
  shots: Shot[]
  enemyShots: Shot[]
  enemies: Enemy[]
  powerUps: PowerUp[]
  sparks: Spark[]
  ripples: Ripple[]
  wave: number
  stageTheme: number
  bossAlert: number
  bossMessage: BossMessage
  highScore: number
  selectedShipKey: string
  hostPointer: Vec | null
  guestPointer: Vec | null
  stageClear: number
  unlockedStage: number
  nukeCooldown: number
  nukeFlash: number
  nukeStrike: NukeStrike | null
  nukeBlastOrigin: Vec
  asteroids: AsteroidHazard[]
  asteroidWarning: number
  randomEvent: RaidRandomEvent | null
  meteors: MeteorHazard[]
  ionStrikes: IonStrike[]
  wrecks: DerelictWreck[]
}

type MultiplayerPlayerSnapshot = {
  at: number
  player: Player
}

type MultiplayerEnemySnapshot = {
  at: number
  enemies: Enemy[]
}

type MultiplayerAsteroidSnapshot = {
  at: number
  asteroids: AsteroidHazard[]
}

type RelayGameMessage =
  | { type: 'game-message'; from: string; payload: { type: 'input'; input: MultiplayerInput } }
  | { type: 'game-message'; from: string; payload: { type: 'state'; state: MultiplayerHostState } }
  | { type: 'room-update'; room: { players: RaidMultiplayerSession['players'] } | null }
  | { type: 'pong'; at: number }
  | { type: 'left-room' }
  | { type: string; [key: string]: unknown }

const WIDTH = 100
const HEIGHT = 100
const PLAYER_RADIUS = 3.2
const MAX_RAID_STAGE = 15
const RAID_CHECKPOINTS = [5, 10, 14] as const
const STORAGE_KEY = 'gradiusRaidHighScore'
const RAID_UNLOCK_STORAGE_KEY = 'gradiusRaidUnlockedStage'
const RAID_CHECKPOINT_STORAGE_KEY = 'gradiusRaidCheckpointStage'
const PLAYER_COLOR = '#ef233c'
const ALLY_PLAYER_COLOR = '#38bdf8'
const DARK_ENEMY_COLORS = ['#4c1d95', '#581c87', '#7f1d1d', '#831843', '#312e81', '#164e63', '#3f1d2e', '#1f2937']
const MINI_BOSS_KINDS: MiniBossKind[] = ['stalker', 'brood', 'lancer']
const MINI_BOSS_COLORS: Record<MiniBossKind, string> = {
  stalker: '#06b6d4',
  brood: '#a855f7',
  lancer: '#f43f5e',
}
const ELITE_ENEMY_STAGE_START = 2
const BOSS_COLORS: Record<BossKind, string> = {
  carrier: '#7f1d1d',
  orb: '#581c87',
  serpent: '#164e63',
  mantis: '#365314',
  hydra: '#4c1d95',
  gate: '#0f172a',
  super: '#3f1d2e',
  squid: '#7c3aed',
  snake: '#06b6d4',
  final: '#120617',
}
const RAID_DEFAULT_BGM_TRACK = getPublicAssetUrl('audio/bgm_scifi_loop.ogg')
const RAID_BOSS_BGM_TRACK = getPublicAssetUrl('audio/sfx_boss_battle.wav')
const RAID_ENDING_BGM_TRACK = getPublicAssetUrl('audio/bgm_shelter.wav')
const RAID_BGM_STAGE_RATES = [0.92, 0.98, 1.04, 1.1]
const RAID_BOSS_APPROACH_SILENCE_SECONDS = 5.5

const SHIP_OPTIONS: ShipOption[] = [
  { key: 'rocket', name: 'Black Comet', role: 'Balanced missile frame', speed: 1, hp: 6, fireRate: 1 },
  { key: 'fast', name: 'Red Wraith', role: 'Fastest dodge craft', speed: 1.18, hp: 5, fireRate: 1.08 },
  { key: 'gatling', name: 'Crimson Saw', role: 'Rapid assault striker', speed: 0.96, hp: 6, fireRate: 1.18 },
  { key: 'laser', name: 'Night Lance', role: 'Sharper beam control', speed: 1.03, hp: 5, fireRate: 1.12 },
  { key: 'dreadnought', name: 'Obsidian Ark', role: 'Heavy survival hull', speed: 0.82, hp: 8, fireRate: 0.86 },
  { key: 'xwing', name: 'Crosswing Nova', role: 'Four-cannon S-foil ace', speed: 1.14, hp: 5, fireRate: 1.18 },
  { key: 'spaceEt', name: 'Space Jet', role: 'Comet-tail microfighter', speed: 1.24, hp: 3, fireRate: 1.28 },
]

const BRIEFING_PANELS = [
  {
    title: 'Mission',
    body: 'Break through the alien blockade, survive all 15 stages, and destroy the final fortress guarding Earth orbit.',
    items: ['Your ship fires automatically.', 'PC follows the mouse cursor.', 'Space or the NUKE icon launches a nuclear strike with a 60 second cooldown.', 'Mobile follows above your finger so your hand does not cover the ship.', 'Stages 5, 10, and 15 are guarded by larger boss threats.'],
  },
  {
    title: 'Weapon Drops',
    body: 'Weapon pickups stack within balanced limits and last for the whole stage, then reset after a boss clear.',
    items: ['V Spread: max 2 stacks for wider fan shots.', 'L Laser: max 1 stack for piercing beam damage.', '* Scatter: max 2 stacks for angled burst coverage.', 'R Rocket: max 2 stacks for heavy side missiles.', 'H Homing: max 1 stack for seeker missiles.'],
  },
  {
    title: 'Support Buffs',
    body: 'Support pickups keep a run alive when the screen gets busy. Normal boss clears reset buffs, but the stage before a super boss preserves them.',
    items: ['O Scouts: two side escorts copy your selected ship and fire with you.', 'S Shield: absorbs hits before hull damage.', 'F Force Field: five temporary armor bars and safe enemy ramming.', '+ Repair: restores hull by one bar.', 'LV Level Up: boss-only pickup that raises ship level and base ATK, then repairs 1 hull.'],
  },
]

const BRIEFING_PICKUP_TYPES: Record<string, PowerKind> = {
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

const ENDING_DEBRIEF_LINES = [
  'You broke the alien blockade across fifteen combat zones.',
  'The final fortress is gone, and Earth orbit is open again.',
  'Survivors below watched your signal return through the atmosphere.',
]

const PICKUP_PREVIEW_SEEDS: Record<PowerKind, number> = {
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

const EMPTY_WEAPONS: Record<WeaponKey, number> = {
  spread: 0,
  laser: 0,
  scatter: 0,
  rocket: 0,
  homing: 0,
}

const EMPTY_WEAPON_FLAGS: Record<WeaponKey, boolean> = {
  spread: false,
  laser: false,
  scatter: false,
  rocket: false,
  homing: false,
}

const EMPTY_WEAPON_TIMERS: Record<WeaponKey, number> = {
  spread: 0,
  laser: 0,
  scatter: 0,
  rocket: 0,
  homing: 0,
}

function getShipSpriteSize(shipKey: string, context: 'player' | 'option' | 'picker') {
  if (shipKey === 'dreadnought') return context === 'player' ? 88 : context === 'option' ? 40 : 88
  if (shipKey === 'spaceEt') return context === 'player' ? 84 : context === 'option' ? 38 : 84
  if (shipKey === 'xwing') return context === 'player' ? 78 : context === 'option' ? 36 : 82
  return context === 'player' ? 74 : context === 'option' ? 34 : 80
}

const WEAPON_STACK_CAPS: Record<WeaponKey, number> = {
  spread: 2,
  laser: 1,
  scatter: 2,
  rocket: 2,
  homing: 1,
}

const WEAPON_FIRE_INTERVALS: Record<WeaponKey, number> = {
  spread: 0.34,
  laser: 0.22,
  scatter: 0.48,
  rocket: 0.82,
  homing: 6.5,
}

const WEAPON_KEYS: WeaponKey[] = ['spread', 'laser', 'scatter', 'rocket', 'homing']
const FORCE_FIELD_ARMOR = 5
const PLAYER_MAX_RANK = 20
const PLAYER_BASE_ATTACK_PER_LEVEL = 0.65
const LEVEL_UP_HEAL = 1
const FINAL_BOSS_NUKE_DAMAGE_MULTIPLIER = 0.68
const SPACE_ET_PASSIVE_FORCE_FIELD_CHARGES = 3
const SPACE_ET_FORCE_FIELD_REGEN_SECONDS = 20
const NORMAL_POWER_DROP_COOLDOWN = 3.8
const POWER_PITY_KILLS = 12
const GAMEPLAY_SNAPSHOT_INTERVAL_MS = 100
const GAMEPLAY_ALERT_SNAPSHOT_INTERVAL_MS = 50
const IDLE_SNAPSHOT_INTERVAL_MS = 120
const MULTIPLAYER_STATE_INTERVAL_MS = 50
const MULTIPLAYER_INPUT_INTERVAL_MS = 50
const MULTIPLAYER_HEARTBEAT_INTERVAL_MS = 1800
const MULTIPLAYER_HEARTBEAT_TIMEOUT_MS = 5200
const MULTIPLAYER_CONNECTION_CHECK_MS = 250
const MULTIPLAYER_STATE_STALE_MS = 1400
const MULTIPLAYER_STATE_LOST_MS = 3600
const MULTIPLAYER_GUEST_STALE_MS = 2200
const MULTIPLAYER_MAX_BUFFERED_BYTES = 512 * 1024
const MULTIPLAYER_MAX_SHOTS = 120
const MULTIPLAYER_MAX_ENEMY_SHOTS = 140
const MULTIPLAYER_MAX_ENEMIES = 40
const MULTIPLAYER_MAX_ASTEROIDS = 18
const MULTIPLAYER_MAX_METEORS = 24
const MULTIPLAYER_MAX_ION_STRIKES = 8
const MULTIPLAYER_MAX_WRECKS = 3
const MULTIPLAYER_MAX_POWERUPS = 16
const MULTIPLAYER_MAX_SPARKS = 16
const MULTIPLAYER_MAX_RIPPLES = 12
const MULTIPLAYER_ENTITY_MARGIN = 22
const MULTIPLAYER_MAX_VISUAL_VELOCITY = 130
const MULTIPLAYER_SOFT_CORRECTION_DISTANCE_SQ = 900
const MULTIPLAYER_REMOTE_CORRECTION_BLEND = 0.08
const MULTIPLAYER_OWN_CORRECTION_BLEND = 0.04
// Client-side prediction: only snap guest's own position at extreme divergence (50 units)
const MULTIPLAYER_GUEST_SNAP_DISTANCE_SQ = 2500
// Drain the accumulated position correction at this rate (fraction drained per second)
const MULTIPLAYER_CORRECTION_DRAIN_RATE = 8
const MULTIPLAYER_MAX_GUEST_CORRECTION = 12
const MULTIPLAYER_REMOTE_INPUT_BLEND = 0.35
const MULTIPLAYER_REMOTE_INPUT_SNAP_DISTANCE_SQ = 1600
const MULTIPLAYER_REMOTE_BUFFER_MAX = 8
const MULTIPLAYER_REMOTE_INTERPOLATION_MIN_DELAY_MS = 100
const MULTIPLAYER_REMOTE_INTERPOLATION_MAX_DELAY_MS = 170
const MULTIPLAYER_REMOTE_EXTRAPOLATION_LIMIT_MS = 140
const MULTIPLAYER_GUEST_SHOT_MIN_TTL_MS = 180
const MULTIPLAYER_GUEST_SHOT_MAX_TTL_MS = 520
const MULTIPLAYER_GUEST_SHOT_CONFIRM_MARGIN_MS = 120
const HOMING_RETARGET_SECONDS = 0.18
const HOMING_RETARGET_STAGGER_SECONDS = 0.012
const NUKE_MIN_COOLDOWN_SECONDS = 25
const NUKE_MAX_COOLDOWN_SECONDS = 50
const NUKE_MISSILE_SECONDS = 0.82
const NUKE_FLASH_SECONDS = 1.15
const NUKE_BOSS_DAMAGE_MIN_RATIO = 0.16
const NUKE_BOSS_DAMAGE_MAX_RATIO = 0.38
const NUKE_BOSS_DAMAGE_MIN_FLOOR = 550
const NUKE_BOSS_DAMAGE_MAX_FLOOR = 2400
const MULTIPLAYER_BOSS_HP_MULTIPLIER = 4
const BOSS_RESPAWN_SECONDS = 90
const STAGE_CLEAR_SECONDS = 3.15
const STAGE_ENTRY_SECONDS = 1.18
const VICTORY_BLACKOUT_SECONDS = 0.55
const FINAL_BOSS_BEAM_CHARGE_SECONDS = 1.65
const FINAL_BOSS_BEAM_LIFE_SECONDS = 0.78
const FINAL_BOSS_BEAM_SINGLE_RADIUS = 6.4
const FINAL_BOSS_BEAM_PINCER_RADIUS = 5.4
const FINAL_BOSS_BEAM_TRIDENT_RADIUS = 4.35
const FINAL_BOSS_BEAM_SCATTER_RADIUS = 4.7
const MAX_SPARKS = 45
const MAX_RIPPLES = 10
const MAX_ASTEROIDS = 16
const MAX_METEORS = 26
const MAX_ION_STRIKES = 8
const MAX_WRECKS = 3
const ASTEROID_CLUSTER_WARNING_SECONDS = 3.2
const ASTEROID_CLUSTER_SPAWN_DELAY_SECONDS = 1.35
const ASTEROID_CLUSTER_MIN_SECONDS = 42
const ASTEROID_CLUSTER_MAX_SECONDS = 64
const RANDOM_EVENT_WARNING_SECONDS = 2.45
const RANDOM_EVENT_MIN_SECONDS = 34
const RANDOM_EVENT_MAX_SECONDS = 56
const RAID_BACKGROUND_THEME_COUNT = 5

let shotId = 1
let enemyId = 1
let asteroidId = 1
let meteorId = 1
let ionStrikeId = 1
let wreckId = 1
let powerId = 1
let sparkId = 1
let rippleId = 1
let lastPickupVoiceMs = 0

const DEG = Math.PI / 180

type CanvasSpriteEntry = {
  image: HTMLImageElement
  loaded: boolean
  objectUrl?: string
}

type RaidPalette = {
  baseTop: string
  baseMid: string
  baseBottom: string
  surfaceMode: string
  surfaceA: string
  surfaceB: string
  surfaceC: string
  bgA: string
  bgB: string
  nebulaA: string
  nebulaB: string
  starTint: string
  streak: string
  planetA: string
  planetB: string
  planetC: string
}

const canvasSpriteCache = new Map<string, CanvasSpriteEntry>()
const homingMissileSpriteCache = new Map<number, HTMLCanvasElement>()
const honeycombShieldSpriteCache = new Map<number, HTMLCanvasElement>()

const DEFAULT_RAID_PALETTE: RaidPalette = {
  baseTop: '#020307',
  baseMid: '#060812',
  baseBottom: '#070a10',
  surfaceMode: 'ruins',
  surfaceA: '#172033',
  surfaceB: '#243447',
  surfaceC: '#64748b',
  bgA: 'rgba(239, 35, 60, 0.16)',
  bgB: 'rgba(14, 165, 233, 0.13)',
  nebulaA: 'rgba(127, 29, 29, 0.3)',
  nebulaB: 'rgba(8, 47, 73, 0.32)',
  starTint: 'rgba(248, 113, 113, 0.64)',
  streak: 'rgba(239, 35, 60, 0.5)',
  planetA: '#7c3aed',
  planetB: '#7f1d1d',
  planetC: '#164e63',
}

const BACKGROUND_STARS = Array.from({ length: 220 }, (_, index) => ({
  x: seededNoise(index, 1),
  y: seededNoise(index, 2),
  size: 0.75 + seededNoise(index, 3) * 1.35,
  alpha: 0.34 + seededNoise(index, 4) * 0.56,
  tint: seededNoise(index, 5),
}))

const BACKGROUND_ASTEROIDS = [
  { x: 0.34, width: 22, height: 18, speed: 0.128, delay: -2, alpha: 0.52, spin: 180 },
  { x: 0.62, width: 14, height: 11, speed: 0.082, delay: -6, alpha: 0.38, spin: -240 },
  { x: 0.78, width: 32, height: 26, speed: 0.064, delay: -10, alpha: 0.44, spin: 120 },
  { x: 0.18, width: 10, height: 8, speed: 0.105, delay: -4, alpha: 0.3, spin: 300 },
  { x: 0.5, width: 18, height: 14, speed: 0.052, delay: -14, alpha: 0.35, spin: -160 },
]

const BACKGROUND_DEBRIS = [
  { x: 0.28, width: 38, height: 28, speed: 0.034, delay: -12, alpha: 0.12, spin: 220 },
  { x: 0.58, width: 24, height: 18, speed: 0.024, delay: -28, alpha: 0.12, spin: -180 },
  { x: 0.82, width: 18, height: 14, speed: 0.03, delay: -8, alpha: 0.12, spin: 140 },
]

const BACKGROUND_SPEED_LINES = [
  { x: 0.11, length: 170, width: 2, delay: -0.2, color: 'streak' },
  { x: 0.32, length: 120, width: 1, delay: -0.42, color: 'white' },
  { x: 0.63, length: 150, width: 2, delay: -0.16, color: 'red' },
  { x: 0.88, length: 135, width: 1, delay: -0.34, color: 'cyan' },
] as const

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function getMaxActiveEliteEnemies(stage: number, isMultiplayer: boolean) {
  return Math.round(clamp(1 + Math.floor(Math.max(0, stage - ELITE_ENEMY_STAGE_START) / 7) + (isMultiplayer ? 1 : 0), 1, isMultiplayer ? 3 : 2))
}

function getEliteEnemyChance(stage: number, wave: number, trainSlot: number, hasFormationStyle: boolean) {
  if (stage < ELITE_ENEMY_STAGE_START) return 0
  const formationPenalty = hasFormationStyle ? 0.34 : 1
  const slotPenalty = trainSlot > 0 ? 0.52 : 1
  return clamp((0.038 + stage * 0.0035 + wave * 0.0015) * formationPenalty * slotPenalty, 0.02, 0.11)
}

function pickEliteEnemyKind(stage: number, wave: number, trainSlot: number): MiniBossKind {
  return MINI_BOSS_KINDS[(stage + wave + trainSlot + Math.floor(Math.random() * MINI_BOSS_KINDS.length)) % MINI_BOSS_KINDS.length]
}

function seededNoise(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453123
  return value - Math.floor(value)
}

function getCssVar(root: HTMLElement, name: string, fallback: string) {
  return getComputedStyle(root).getPropertyValue(name).trim() || fallback
}

function readRaidPalette(root: HTMLElement): RaidPalette {
  return {
    baseTop: getCssVar(root, '--raid-base-top', DEFAULT_RAID_PALETTE.baseTop),
    baseMid: getCssVar(root, '--raid-base-mid', DEFAULT_RAID_PALETTE.baseMid),
    baseBottom: getCssVar(root, '--raid-base-bottom', DEFAULT_RAID_PALETTE.baseBottom),
    surfaceMode: getCssVar(root, '--raid-surface-mode', DEFAULT_RAID_PALETTE.surfaceMode),
    surfaceA: getCssVar(root, '--raid-surface-a', DEFAULT_RAID_PALETTE.surfaceA),
    surfaceB: getCssVar(root, '--raid-surface-b', DEFAULT_RAID_PALETTE.surfaceB),
    surfaceC: getCssVar(root, '--raid-surface-c', DEFAULT_RAID_PALETTE.surfaceC),
    bgA: getCssVar(root, '--raid-bg-a', DEFAULT_RAID_PALETTE.bgA),
    bgB: getCssVar(root, '--raid-bg-b', DEFAULT_RAID_PALETTE.bgB),
    nebulaA: getCssVar(root, '--raid-nebula-a', DEFAULT_RAID_PALETTE.nebulaA),
    nebulaB: getCssVar(root, '--raid-nebula-b', DEFAULT_RAID_PALETTE.nebulaB),
    starTint: getCssVar(root, '--raid-star-tint', DEFAULT_RAID_PALETTE.starTint),
    streak: getCssVar(root, '--raid-streak', DEFAULT_RAID_PALETTE.streak),
    planetA: getCssVar(root, '--raid-planet-a', DEFAULT_RAID_PALETTE.planetA),
    planetB: getCssVar(root, '--raid-planet-b', DEFAULT_RAID_PALETTE.planetB),
    planetC: getCssVar(root, '--raid-planet-c', DEFAULT_RAID_PALETTE.planetC),
  }
}

function updateSparksInPlace(sparks: Spark[], dt: number) {
  const start = Math.max(0, sparks.length - MAX_SPARKS)
  let write = 0
  for (let index = start; index < sparks.length; index += 1) {
    const spark = sparks[index]
    spark.x += spark.vx * dt
    spark.y += spark.vy * dt
    spark.life -= dt
    if (spark.life > 0) {
      sparks[write] = spark
      write += 1
    }
  }
  sparks.length = write
}

function updateRipplesInPlace(ripples: Ripple[], dt: number) {
  const start = Math.max(0, ripples.length - MAX_RIPPLES)
  let write = 0
  for (let index = start; index < ripples.length; index += 1) {
    const ripple = ripples[index]
    ripple.life -= dt
    if (ripple.life > 0) {
      ripples[write] = ripple
      write += 1
    }
  }
  ripples.length = write
}

function traceRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawRadialEllipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  stops: Array<[number, string]>,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(radiusX / radiusY, 1)
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radiusY)
  stops.forEach(([offset, color]) => gradient.addColorStop(offset, color))
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(0, 0, radiusY, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function makeCanvasSprite(cacheKey: string, markup: string) {
  const existing = canvasSpriteCache.get(cacheKey)
  if (existing) return existing

  const image = new Image()
  const entry: CanvasSpriteEntry = { image, loaded: false }
  const markupWithoutSvgFilter = markup
    .replace(/\sstyle="filter:[^"]*"/g, '')
    .replace(/filter:\s*drop-shadow\([^)]*\);?/g, '')
  const svgMarkup = markupWithoutSvgFilter.startsWith('<svg') && !markupWithoutSvgFilter.includes('xmlns=')
    ? markupWithoutSvgFilter.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
    : markupWithoutSvgFilter
  image.decoding = 'async'
  image.onload = () => {
    entry.loaded = true
    if (entry.objectUrl) URL.revokeObjectURL(entry.objectUrl)
  }
  image.onerror = () => {
    entry.loaded = false
    if (entry.objectUrl) URL.revokeObjectURL(entry.objectUrl)
  }
  const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' })
  entry.objectUrl = URL.createObjectURL(blob)
  image.src = entry.objectUrl
  canvasSpriteCache.set(cacheKey, entry)
  return entry
}

function getTowerCanvasSprite(shipKey: string, color: string, size: number) {
  const key = `tower:${shipKey}:${color}:${size}`
  const existing = canvasSpriteCache.get(key)
  if (existing) return existing
  return makeCanvasSprite(key, renderToStaticMarkup(<TowerShip tType={shipKey} color={color} size={size} />))
}

function getEnemySpriteMarkupSize(enemy: Enemy) {
  if (enemy.isMiniBoss) return 128
  if (!enemy.isBoss) return 64
  if (enemy.bossKind === 'final') return 360
  if (enemy.bossKind === 'squid') return 340
  if (enemy.bossKind === 'snake') return 320
  if (enemy.bossKind === 'super') return 310
  if (enemy.bossKind === 'gate') return 250
  if (enemy.bossKind === 'hydra') return 215
  return 184
}

function getEnemyCanvasSprite(enemy: Enemy) {
  const size = getEnemySpriteMarkupSize(enemy)
  const bossKind = enemy.bossKind ?? 'none'
  const miniBossKind = enemy.miniBossKind ?? 'none'
  const key = `alien:${enemy.variant % 6}:${enemy.isBoss ? 1 : 0}:${enemy.isMiniBoss ? 1 : 0}:${bossKind}:${miniBossKind}:${enemy.color}:${size}`
  const existing = canvasSpriteCache.get(key)
  if (existing) return existing
  return makeCanvasSprite(
    key,
    renderToStaticMarkup(
      <AlienShip
        variant={enemy.variant}
        isBoss={enemy.isBoss}
        isMiniBoss={enemy.isMiniBoss}
        isFinalBoss={enemy.bossKind === 'final'}
        bossKind={enemy.bossKind ?? undefined}
        miniBossKind={enemy.miniBossKind ?? undefined}
        color={enemy.color}
        size={size}
      />,
    ),
  )
}

function drawSpriteFallback(ctx: CanvasRenderingContext2D, size: number, color: string) {
  ctx.fillStyle = color
  ctx.strokeStyle = 'rgba(255,255,255,0.72)'
  ctx.lineWidth = Math.max(1, size * 0.025)
  ctx.beginPath()
  ctx.moveTo(0, -size * 0.42)
  ctx.bezierCurveTo(size * 0.3, -size * 0.34, size * 0.48, -size * 0.08, size * 0.36, size * 0.2)
  ctx.bezierCurveTo(size * 0.3, size * 0.36, size * 0.14, size * 0.42, 0, size * 0.34)
  ctx.bezierCurveTo(-size * 0.14, size * 0.42, -size * 0.3, size * 0.36, -size * 0.36, size * 0.2)
  ctx.bezierCurveTo(-size * 0.48, -size * 0.08, -size * 0.3, -size * 0.34, 0, -size * 0.42)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.strokeStyle = color
  ctx.globalAlpha *= 0.72
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(side * size * 0.18, size * 0.18)
    ctx.bezierCurveTo(side * size * 0.42, size * 0.26, side * size * 0.48, size * 0.42, side * size * 0.36, size * 0.5)
    ctx.stroke()
  }
}

function drawCanvasSprite(
  ctx: CanvasRenderingContext2D,
  sprite: CanvasSpriteEntry,
  x: number,
  y: number,
  size: number,
  filter: string,
  alpha = 1,
  rotation = 0,
  scale = 1,
  fallbackColor = PLAYER_COLOR,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.scale(scale, scale)
  ctx.globalAlpha *= alpha
  ctx.filter = filter
  if (sprite.loaded && sprite.image.complete) {
    ctx.drawImage(sprite.image, -size / 2, -size / 2, size, size)
  } else {
    drawSpriteFallback(ctx, size, fallbackColor)
  }
  ctx.restore()
}

function drawSpriteGlow(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha: number) {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  drawRadialEllipse(ctx, x, y, size * 0.72, size * 0.62, [
    [0, `rgba(255,255,255,${0.18 * alpha})`],
    [0.34, color],
    [1, 'rgba(0,0,0,0)'],
  ])
  ctx.restore()
}

function getEnemyCanvasSize(enemy: Enemy, viewportWidth: number) {
  if (enemy.isMiniBoss) return Math.min(viewportWidth * 0.15, 132)
  if (!enemy.isBoss) return Math.min(viewportWidth * 0.105, 82)
  if (enemy.bossKind === 'final') return Math.min(viewportWidth * 0.74, 680)
  if (enemy.bossKind === 'squid') return Math.min(viewportWidth * 0.62, 600)
  if (enemy.bossKind === 'snake') return Math.min(viewportWidth * 0.62, 600)
  if (enemy.bossKind === 'super') return Math.min(viewportWidth * 0.48, 430)
  if (enemy.bossKind === 'gate') return Math.min(viewportWidth * 0.4, 360)
  if (enemy.bossKind === 'hydra') return Math.min(viewportWidth * 0.35, 305)
  return Math.min(viewportWidth * 0.3, 260)
}

function distSq(a: Vec, b: Vec) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

function acquireHomingTarget(shot: Shot, enemies: Enemy[]) {
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

function getHighScore() {
  if (typeof window === 'undefined') return 0
  return Number(localStorage.getItem(STORAGE_KEY) || 0)
}

function saveHighScore(score: number) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, String(score))
  }
}

function getUnlockedStage() {
  if (typeof window === 'undefined') return 1
  return clamp(Number(localStorage.getItem(RAID_UNLOCK_STORAGE_KEY) || 1), 1, MAX_RAID_STAGE)
}

function saveUnlockedStage(stage: number) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(RAID_UNLOCK_STORAGE_KEY, String(clamp(stage, 1, MAX_RAID_STAGE)))
  }
}

function getCheckpointStage() {
  if (typeof window === 'undefined') return 1
  return clamp(Number(localStorage.getItem(RAID_CHECKPOINT_STORAGE_KEY) || 1), 1, MAX_RAID_STAGE)
}

function saveCheckpointStage(stage: number) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(RAID_CHECKPOINT_STORAGE_KEY, String(clamp(stage, 1, MAX_RAID_STAGE)))
  }
}

function getInitialPlayer(ship = SHIP_OPTIONS[0]): Player {
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
    fireCooldown: 0,
    weaponCooldowns: { ...EMPTY_WEAPON_TIMERS },
    score: 0,
    rank: 1,
    ship,
    weapons: { ...EMPTY_WEAPONS },
    weaponTimers: { ...EMPTY_WEAPON_TIMERS },
  }
}

function powerColor(type: PowerKind) {
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

function powerGlyph(type: PowerKind) {
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

//
// ARCADE ANNOUNCER STYLE WEB SPEECH
// This pushes browser TTS close to arcade energy.
// Still limited by speechSynthesis itself,
// but MUCH better than plain robotic speech.
//

let cachedPickupVoices: SpeechSynthesisVoice[] = []
let pickupSampleAudio: HTMLAudioElement | null = null

const PICKUP_VOICE_SAMPLE_URLS: Record<PowerKind, string> = {
  rocket: getPublicAssetUrl('audio/pickups/pickup_rocket.wav'),
  laser: getPublicAssetUrl('audio/pickups/pickup_laser.wav'),
  spread: getPublicAssetUrl('audio/pickups/pickup_spread.wav'),
  scatter: getPublicAssetUrl('audio/pickups/pickup_scatter.wav'),
  homing: getPublicAssetUrl('audio/pickups/pickup_homing.wav'),
  option: getPublicAssetUrl('audio/pickups/pickup_option.wav'),
  shield: getPublicAssetUrl('audio/pickups/pickup_shield.wav'),
  forcefield: getPublicAssetUrl('audio/pickups/pickup_forcefield.wav'),
  repair: getPublicAssetUrl('audio/pickups/pickup_repair.wav'),
  levelup: getPublicAssetUrl('audio/pickups/pickup_levelup.wav'),
}

const DEFAULT_PICKUP_VOICE_SAMPLE_URL = getPublicAssetUrl('audio/pickups/pickup_default.wav')

function getPickupSpeechSynthesis() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  return window.speechSynthesis
}

function refreshPickupVoices() {
  const synth = getPickupSpeechSynthesis()
  if (!synth) return []

  try {
    const voices = synth.getVoices()
    if (voices.length > 0) cachedPickupVoices = voices
    return voices.length > 0 ? voices : cachedPickupVoices
  } catch {
    return cachedPickupVoices
  }
}

function clonePlayer(player: Player): Player {
  return {
    ...player,
    ship: { ...player.ship },
    weapons: { ...player.weapons },
    weaponTimers: { ...player.weaponTimers },
    weaponCooldowns: { ...player.weaponCooldowns },
  }
}

function getShipByKey(shipKey: string | undefined, fallback = SHIP_OPTIONS[0]) {
  return SHIP_OPTIONS.find((ship) => ship.key === shipKey) ?? fallback
}

function cloneVec(value: Vec | null | undefined): Vec | null {
  return value ? { x: value.x, y: value.y } : null
}

function cloneEnemy(enemy: Enemy): Enemy {
  return { ...enemy }
}

function cloneAsteroid(asteroid: AsteroidHazard): AsteroidHazard {
  return { ...asteroid }
}

function cloneRaidRandomEvent(event: RaidRandomEvent | null): RaidRandomEvent | null {
  return event ? { ...event } : null
}

function cloneMeteor(meteor: MeteorHazard): MeteorHazard {
  return { ...meteor }
}

function cloneIonStrike(strike: IonStrike): IonStrike {
  return { ...strike }
}

function cloneDerelictWreck(wreck: DerelictWreck): DerelictWreck {
  return { ...wreck }
}

function roundNetworkNumber(value: number) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0
}

function compactVec<T extends Vec>(value: T): T {
  return {
    ...value,
    x: roundNetworkNumber(value.x),
    y: roundNetworkNumber(value.y),
  }
}

function compactPlayer(player: Player): Player {
  return {
    ...clonePlayer(player),
    x: roundNetworkNumber(player.x),
    y: roundNetworkNumber(player.y),
    invuln: roundNetworkNumber(player.invuln),
    optionTimer: roundNetworkNumber(player.optionTimer),
    fireCooldown: roundNetworkNumber(player.fireCooldown),
  }
}

function isNetworkVisible(value: Vec) {
  return value.x > -MULTIPLAYER_ENTITY_MARGIN &&
    value.x < WIDTH + MULTIPLAYER_ENTITY_MARGIN &&
    value.y > -MULTIPLAYER_ENTITY_MARGIN &&
    value.y < HEIGHT + MULTIPLAYER_ENTITY_MARGIN
}

function clampNetworkVelocity(value: number) {
  return clamp(value, -MULTIPLAYER_MAX_VISUAL_VELOCITY, MULTIPLAYER_MAX_VISUAL_VELOCITY)
}

function getConnectionLabel(quality: MultiplayerConnectionQuality, rtt: number | null) {
  const latency = rtt === null ? '' : ` ${Math.round(rtt)}ms`
  if (quality === 'good') return `Link good${latency}`
  if (quality === 'ok') return `Link ok${latency}`
  if (quality === 'poor') return `Link unstable${latency}`
  return 'Reconnecting'
}

function getGuestShotTtlMs(rtt: number | null) {
  return clamp(
    (rtt ?? 80) + MULTIPLAYER_GUEST_SHOT_CONFIRM_MARGIN_MS,
    MULTIPLAYER_GUEST_SHOT_MIN_TTL_MS,
    MULTIPLAYER_GUEST_SHOT_MAX_TTL_MS,
  )
}

function getRemoteInterpolationDelayMs(rtt: number | null) {
  return clamp(
    90 + (rtt ?? 80) * 0.25,
    MULTIPLAYER_REMOTE_INTERPOLATION_MIN_DELAY_MS,
    MULTIPLAYER_REMOTE_INTERPOLATION_MAX_DELAY_MS,
  )
}

function getOwnCorrectionBlend(rtt: number | null) {
  if (rtt === null) return MULTIPLAYER_OWN_CORRECTION_BLEND
  return clamp(MULTIPLAYER_OWN_CORRECTION_BLEND * (140 / Math.max(140, rtt)), 0.018, MULTIPLAYER_OWN_CORRECTION_BLEND)
}

function keepNetworkVisibleInPlace<T extends Vec>(items: T[], keepItem?: (item: T) => boolean) {
  let write = 0
  for (const item of items) {
    if (isNetworkVisible(item) || keepItem?.(item)) {
      items[write] = item
      write += 1
    }
  }
  items.length = write
}

function reconcilePlayerVisual(current: Player | null, authoritative: Player | null, blend: number) {
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

function getBufferedPlayerVisual(buffer: MultiplayerPlayerSnapshot[], renderAt: number) {
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
    return visual
  }

  return clonePlayer(latest.player)
}

function interpolateEnemyVisual(previous: Enemy, next: Enemy, t: number) {
  const visual = cloneEnemy(next)
  visual.x = previous.x + (next.x - previous.x) * t
  visual.y = previous.y + (next.y - previous.y) * t
  visual.phase = previous.phase + (next.phase - previous.phase) * t
  visual.shieldTime = Math.max(0, previous.shieldTime + (next.shieldTime - previous.shieldTime) * t)
  visual.fireCooldown = Math.max(0, previous.fireCooldown + (next.fireCooldown - previous.fireCooldown) * t)
  visual.chargeCooldown = Math.max(0, previous.chargeCooldown + (next.chargeCooldown - previous.chargeCooldown) * t)
  visual.chargeTimer = Math.max(0, previous.chargeTimer + (next.chargeTimer - previous.chargeTimer) * t)
  visual.chargeLane = previous.chargeLane + (next.chargeLane - previous.chargeLane) * t
  return visual
}

function getBufferedEnemyVisuals(buffer: MultiplayerEnemySnapshot[], renderAt: number) {
  if (buffer.length === 0) return null
  if (buffer.length === 1) return buffer[0].enemies.map(cloneEnemy)

  const first = buffer[0]
  if (renderAt <= first.at) return first.enemies.map(cloneEnemy)

  const latest = buffer[buffer.length - 1]
  if (renderAt >= latest.at) {
    const previous = buffer[buffer.length - 2]
    const previousById = new Map(previous.enemies.map((enemy) => [enemy.id, enemy]))
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
    const previousById = new Map(previous.enemies.map((enemy) => [enemy.id, enemy]))
    const span = Math.max(1, next.at - previous.at)
    const t = clamp((renderAt - previous.at) / span, 0, 1)
    return next.enemies.map((enemy) => {
      const previousEnemy = previousById.get(enemy.id)
      return previousEnemy ? interpolateEnemyVisual(previousEnemy, enemy, t) : cloneEnemy(enemy)
    })
  }

  return latest.enemies.map(cloneEnemy)
}

function interpolateAsteroidVisual(previous: AsteroidHazard, next: AsteroidHazard, t: number) {
  const visual = cloneAsteroid(next)
  visual.x = previous.x + (next.x - previous.x) * t
  visual.y = previous.y + (next.y - previous.y) * t
  visual.spin = previous.spin + (next.spin - previous.spin) * t
  return visual
}

function getBufferedAsteroidVisuals(buffer: MultiplayerAsteroidSnapshot[], renderAt: number) {
  if (buffer.length === 0) return null
  if (buffer.length === 1) return buffer[0].asteroids.map(cloneAsteroid)

  const first = buffer[0]
  if (renderAt <= first.at) return first.asteroids.map(cloneAsteroid)

  const latest = buffer[buffer.length - 1]
  if (renderAt >= latest.at) {
    const previous = buffer[buffer.length - 2]
    const previousById = new Map(previous.asteroids.map((asteroid) => [asteroid.id, asteroid]))
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
    const previousById = new Map(previous.asteroids.map((asteroid) => [asteroid.id, asteroid]))
    const span = Math.max(1, next.at - previous.at)
    const t = clamp((renderAt - previous.at) / span, 0, 1)
    return next.asteroids.map((asteroid) => {
      const previousAsteroid = previousById.get(asteroid.id)
      return previousAsteroid ? interpolateAsteroidVisual(previousAsteroid, asteroid, t) : cloneAsteroid(asteroid)
    })
  }

  return latest.asteroids.map(cloneAsteroid)
}

function getAsteroidClusterInterval() {
  return ASTEROID_CLUSTER_MIN_SECONDS + Math.random() * (ASTEROID_CLUSTER_MAX_SECONDS - ASTEROID_CLUSTER_MIN_SECONDS)
}

function getRandomEventInterval() {
  return RANDOM_EVENT_MIN_SECONDS + Math.random() * (RANDOM_EVENT_MAX_SECONDS - RANDOM_EVENT_MIN_SECONDS)
}

function getRandomEventDuration(kind: RaidRandomEventKind) {
  if (kind === 'meteor') return 7.4
  if (kind === 'solar') return 6.2
  if (kind === 'rift') return 8.2
  if (kind === 'wreck') return 9
  if (kind === 'ambush') return 5.8
  return 6.8
}

function getRandomEventLabel(kind: RaidRandomEventKind) {
  if (kind === 'meteor') return 'METEOR SHOWER INBOUND'
  if (kind === 'solar') return 'SOLAR FLARE DETECTED'
  if (kind === 'rift') return 'GRAVITY DISTORTION'
  if (kind === 'wreck') return 'DERELICT SHIP AHEAD'
  if (kind === 'ambush') return 'SIGNAL JAMMED. AMBUSH'
  return 'ION STORM WARNING'
}

function pickRandomRaidEventKind(stage: number, surfaceStage: boolean): RaidRandomEventKind {
  const pool: RaidRandomEventKind[] = stage < 4
    ? ['meteor', 'ion', 'wreck']
    : surfaceStage
      ? ['meteor', 'solar', 'rift', 'ambush', 'ion']
      : ['meteor', 'solar', 'rift', 'wreck', 'ambush', 'ion']
  return pool[Math.floor(Math.random() * pool.length)]
}

function pickNextRandomRaidEventKind(stage: number, surfaceStage: boolean, previousKind: RaidRandomEventKind | null) {
  let kind = pickRandomRaidEventKind(stage, surfaceStage)
  if (previousKind && kind === previousKind) {
    for (let attempt = 0; attempt < 4 && kind === previousKind; attempt += 1) {
      kind = pickRandomRaidEventKind(stage, surfaceStage)
    }
  }
  return kind
}

function getAsteroidHp(tier: number, stage: number, powerPressure: number) {
  const tierBase = tier === 2 ? 168 : tier === 1 ? 66 : 22
  const stageScale = tier === 2 ? 15 : tier === 1 ? 6.4 : 2.4
  const powerScale = tier === 2 ? 6.2 : tier === 1 ? 2.5 : 0.85
  return Math.round(tierBase + stage * stageScale + powerPressure * powerScale)
}

function createAsteroidHazard(tier: number, x: number, y: number, vx: number, vy: number, stage: number, powerPressure: number): AsteroidHazard {
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

function splitAsteroidHazard(asteroid: AsteroidHazard, stage: number, powerPressure: number) {
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

function getNukeStageScale(stage: number) {
  return clamp((stage - 1) / Math.max(1, MAX_RAID_STAGE - 1), 0, 1)
}

function getNukeCooldownSeconds(stage: number) {
  const scale = getNukeStageScale(stage)
  return Math.round(NUKE_MIN_COOLDOWN_SECONDS + (NUKE_MAX_COOLDOWN_SECONDS - NUKE_MIN_COOLDOWN_SECONDS) * scale)
}

function getNukeBossDamage(enemy: Enemy, stage: number) {
  const scale = getNukeStageScale(stage)
  const ratio = NUKE_BOSS_DAMAGE_MIN_RATIO + (NUKE_BOSS_DAMAGE_MAX_RATIO - NUKE_BOSS_DAMAGE_MIN_RATIO) * scale
  const floor = NUKE_BOSS_DAMAGE_MIN_FLOOR + (NUKE_BOSS_DAMAGE_MAX_FLOOR - NUKE_BOSS_DAMAGE_MIN_FLOOR) * scale
  const damage = Math.max(Math.round(floor), Math.round(enemy.maxHp * ratio))
  return enemy.bossKind === 'final'
    ? Math.max(Math.round(floor), Math.round(damage * FINAL_BOSS_NUKE_DAMAGE_MULTIPLIER))
    : damage
}

function getFinalBossBeamLanes(chargeLane: number, chargePattern: Enemy['chargePattern']) {
  if (chargePattern === 'scatter') {
    return [-31, -13, 13, 31].map((offset) => clamp(chargeLane + offset, 7, 93))
  }
  if (chargePattern === 'trident') {
    return [-22, 0, 22].map((offset) => clamp(chargeLane + offset, 8, 92))
  }
  if (chargePattern === 'pincer') {
    return [-24, 24].map((offset) => clamp(chargeLane + offset, 8, 92))
  }
  return [clamp(chargeLane, 9, 91)]
}

function getFinalBossBeamRadius(chargePattern: Enemy['chargePattern']) {
  if (chargePattern === 'scatter') return FINAL_BOSS_BEAM_SCATTER_RADIUS
  if (chargePattern === 'trident') return FINAL_BOSS_BEAM_TRIDENT_RADIUS
  if (chargePattern === 'pincer') return FINAL_BOSS_BEAM_PINCER_RADIUS
  return FINAL_BOSS_BEAM_SINGLE_RADIUS
}

function getPlayerBaseAttack(player: Player) {
  return 1 + Math.max(0, player.rank - 1) * PLAYER_BASE_ATTACK_PER_LEVEL
}

function levelUpPlayer(player: Player) {
  const previousRank = player.rank
  player.rank = Math.min(PLAYER_MAX_RANK, player.rank + 1)
  player.hp = Math.min(player.maxHp, player.hp + LEVEL_UP_HEAL)
  return player.rank > previousRank
}

function applyStartingStageLevel(player: Player, stage: number) {
  player.rank = clamp(stage, 1, PLAYER_MAX_RANK)
}

function movePlayerWithInput(player: Player, dt: number, pointerTarget: Vec | null, keys: Set<string>) {
  let dx = 0
  let dy = 0
  if (keys.has('arrowleft') || keys.has('a')) dx -= 1
  if (keys.has('arrowright') || keys.has('d')) dx += 1
  if (keys.has('arrowup') || keys.has('w')) dy -= 1
  if (keys.has('arrowdown') || keys.has('s')) dy += 1

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
}

function updatePlayerTimers(player: Player, dt: number) {
  player.fireCooldown = Math.max(0, player.fireCooldown - dt)
  WEAPON_KEYS.forEach((key) => {
    player.weaponCooldowns[key] = Math.max(0, player.weaponCooldowns[key] - dt)
  })
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

function restorePassiveForceField(player: Player) {
  if (player.ship.key !== 'spaceEt') {
    player.passiveForceFieldRegen = 0
    return
  }

  player.forceField = Math.max(player.forceField, SPACE_ET_PASSIVE_FORCE_FIELD_CHARGES)
  player.passiveForceFieldRegen = 0
}

function revivePlayerForBossClear(player: Player, x: number) {
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

const pickupSpeechSynthesis = getPickupSpeechSynthesis()
if (pickupSpeechSynthesis) {
  pickupSpeechSynthesis.onvoiceschanged = () => {
    refreshPickupVoices()
  }
  refreshPickupVoices()
}

function pickupVoiceLine(type: PowerKind) {
  if (type === 'rocket') return 'ROCKET ARMED!!!'
  if (type === 'laser') return 'LAAASER UNLEASHED!!!'
  if (type === 'spread') return 'SPREAD SHOT!!!'
  if (type === 'scatter') return 'SCATTER BURST!!!'
  if (type === 'homing') return 'HOMING LOCKED!!!'
  if (type === 'option') return 'SCOUT SUPPORT!!!'
  if (type === 'shield') return 'SHIELD UP!!!'
  if (type === 'forcefield') return 'FORCE FIELD ONLINE!!!'
  if (type === 'repair') return 'REPAIR BOOST!!!'
  if (type === 'levelup') return 'LEVEL UP!!!'

  return 'POWER UUUUP!!!'
}

function getPickupVoice() {
  const voices = refreshPickupVoices()

  // ONLY female voices
  return (
    voices.find(
      (voice) =>
        voice.lang.toLowerCase().startsWith('en') &&
        /aria|zira|jenny|samantha|female|woman|google us english female/i.test(
          voice.name.toLowerCase(),
        ),
    ) ??

    // fallback: any english voice containing female keywords
    voices.find(
      (voice) =>
        voice.lang.toLowerCase().startsWith('en') &&
        /female|woman|zira|aria|jenny|samantha/i.test(
          voice.name.toLowerCase(),
        ),
    ) ??

    // final fallback: first english voice
    voices.find((voice) =>
      voice.lang.toLowerCase().startsWith('en'),
    ) ??

    null
  )
}

function getPickupVoiceTuning(type: PowerKind) {
  // Aggressive arcade tuning

  if (type === 'rocket') {
    return {
      rate: 1.55,
      pitch: 0.96,
      emphasis: 'strong',
    }
  }

  if (type === 'laser') {
    return {
      rate: 1.62,
      pitch: 1.25,
      emphasis: 'strong',
    }
  }

  if (type === 'spread') {
    return {
      rate: 1.56,
      pitch: 1.12,
      emphasis: 'strong',
    }
  }

  if (type === 'scatter') {
    return {
      rate: 1.58,
      pitch: 1.16,
      emphasis: 'strong',
    }
  }

  if (type === 'homing') {
    return {
      rate: 1.48,
      pitch: 1.02,
      emphasis: 'moderate',
    }
  }

  if (type === 'shield') {
    return {
      rate: 1.4,
      pitch: 0.88,
      emphasis: 'moderate',
    }
  }

  if (type === 'levelup') {
    return {
      rate: 1.42,
      pitch: 1.2,
      emphasis: 'strong',
    }
  }

  return {
    rate: 1.52,
    pitch: 1.08,
    emphasis: 'strong',
  }
}

function createUtterance(
  text: string,
  volume: number,
  rate: number,
  pitch: number,
) {
  const utterance = new SpeechSynthesisUtterance(text)

  utterance.volume = volume
  utterance.rate = rate
  utterance.pitch = pitch

  const voice = getPickupVoice()

  if (voice) {
    utterance.voice = voice
  }

  return utterance
}

function playPickupSpeechSynthesisLine(type: PowerKind, volume: number) {
  const synth = getPickupSpeechSynthesis()

  if (
    typeof window === 'undefined' ||
    !synth ||
    typeof SpeechSynthesisUtterance === 'undefined'
  ) {
    return false
  }

  try {
    const tuning = getPickupVoiceTuning(type)

    // stronger phrasing
    const line = pickupVoiceLine(type)
      .replace(/ROCKET/g, 'RRRROCKET')
      .replace(/LASER/g, 'LAAAASERRR')
      .replace(/POWER/g, 'POWERRRR')
      .replace(/SPREAD/g, 'SPREEEAD')
      .replace(/SCATTER/g, 'SCATTTERRR')

    synth.cancel()

    //
    // MAIN VOICE
    //

    const main = createUtterance(
      line,
      volume,
      tuning.rate * 0.75,
      tuning.pitch * 1.1,
    )
    // make it punchier
    main.pitch *= 1.08
    main.rate *= 1.06

    synth.speak(main)
    return true
  } catch {
    return false
  }
}

function getPickupVoiceSampleUrl(type: PowerKind) {
  return PICKUP_VOICE_SAMPLE_URLS[type] ?? DEFAULT_PICKUP_VOICE_SAMPLE_URL
}

function tryPlayPickupVoiceSample(type: PowerKind, volume: number) {
  if (typeof window === 'undefined') return false
  try {
    if (pickupSampleAudio) {
      pickupSampleAudio.pause()
      pickupSampleAudio.currentTime = 0
    }

    const audio = new Audio(getPickupVoiceSampleUrl(type))
    audio.preload = 'auto'
    audio.volume = volume
    pickupSampleAudio = audio

    audio.onended = () => {
      if (pickupSampleAudio === audio) {
        pickupSampleAudio = null
      }
    }

    void audio.play().catch(() => {
      if (pickupSampleAudio === audio) {
        pickupSampleAudio = null
      }
      playPickupSpeechSynthesisLine(type, volume)
    })

    return true
  } catch {
    return false
  }
}

function playPickupVoiceLine(type: PowerKind) {
  if (!getGameSoundEnabled()) {
    return
  }

  const now =
    typeof performance !== 'undefined'
      ? performance.now()
      : Date.now()

  if (now - lastPickupVoiceMs < 60) {
    return
  }

  lastPickupVoiceMs = now

  const mix = getGameAudioMixSettings()
  const volume = clamp(
    mix.master * mix.ui * 1.25,
    0,
    1,
  )

  if (!tryPlayPickupVoiceSample(type, volume)) {
    playPickupSpeechSynthesisLine(type, volume)
  }
}

function getPowerScore(player: Player) {
  return Object.values(player.weapons).reduce((sum, value) => sum + value, 0)
}

function resetStageLoadout(player: Player) {
  player.weapons = { ...EMPTY_WEAPONS }
  player.weaponTimers = { ...EMPTY_WEAPON_TIMERS }
  player.optionTimer = 0
  player.shield = 0
  player.forceField = 0
  restorePassiveForceField(player)
  player.weaponCooldowns = { ...EMPTY_WEAPON_TIMERS }
}

function getFormationEnemyCount(wave: number) {
  const lateStageTrim = wave > 10 ? Math.ceil((wave - 10) / 2) : 0
  return Math.min(8, Math.max(4, 3 + Math.floor(wave / 2) - lateStageTrim))
}

function getFormationSpawnSeconds(wave: number) {
  const lateStageBreathingRoom = Math.max(0, wave - 10) * 0.16
  return Math.max(2.15, 4.6 - wave * 0.12 + lateStageBreathingRoom)
}

function getSingleEnemySpawnSeconds(wave: number) {
  const lateStageBreathingRoom = Math.max(0, wave - 10) * 0.05
  return Math.max(0.62, 1.25 - wave * 0.045 + lateStageBreathingRoom)
}

function extendLoadoutForSuperBoss(player: Player) {
  if (player.shield > 0) {
    player.shield = Math.min(8, player.shield + 3)
  }
}

function drawAsteroidShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number,
  alpha: number,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.globalAlpha *= alpha
  const gradient = ctx.createLinearGradient(-width / 2, -height / 2, width / 2, height / 2)
  gradient.addColorStop(0, '#78716c')
  gradient.addColorStop(0.52, '#292524')
  gradient.addColorStop(1, '#1c1917')
  ctx.fillStyle = gradient
  ctx.strokeStyle = 'rgba(0,0,0,0.46)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(-width * 0.42, -height * 0.16)
  ctx.quadraticCurveTo(-width * 0.28, -height * 0.58, width * 0.1, -height * 0.48)
  ctx.quadraticCurveTo(width * 0.54, -height * 0.36, width * 0.44, height * 0.08)
  ctx.quadraticCurveTo(width * 0.32, height * 0.58, -width * 0.12, height * 0.44)
  ctx.quadraticCurveTo(-width * 0.56, height * 0.28, -width * 0.42, -height * 0.16)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function drawDebrisShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number,
  alpha: number,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.globalAlpha *= alpha
  ctx.fillStyle = '#475569'
  ctx.strokeStyle = 'rgba(239,35,60,0.46)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(-width * 0.5, -height * 0.12)
  ctx.lineTo(-width * 0.12, -height * 0.48)
  ctx.lineTo(width * 0.5, height * 0.08)
  ctx.lineTo(width * 0.12, height * 0.48)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.strokeStyle = 'rgba(125,211,252,0.36)'
  ctx.beginPath()
  ctx.moveTo(-width * 0.26, -height * 0.24)
  ctx.lineTo(width * 0.24, height * 0.28)
  ctx.stroke()
  ctx.restore()
}

function drawPlanetSurface(ctx: CanvasRenderingContext2D, palette: RaidPalette, width: number, height: number, seconds: number, quality: GraphicsQuality) {
  if (quality === 'low') return

  const scroll = (seconds * (quality === 'medium' ? 34 : 48)) % height
  const featureCount = quality === 'medium' ? 7 : 11
  const { surfaceMode, surfaceA, surfaceB, surfaceC } = palette
  ctx.save()

  const ground = ctx.createLinearGradient(0, 0, width, height)
  if (surfaceMode === 'sea') {
    ground.addColorStop(0, 'rgba(3, 57, 70, 0.96)')
    ground.addColorStop(0.48, 'rgba(8, 96, 116, 0.9)')
    ground.addColorStop(1, 'rgba(2, 16, 28, 0.98)')
  } else if (surfaceMode === 'lava') {
    ground.addColorStop(0, 'rgba(43, 14, 7, 0.98)')
    ground.addColorStop(0.5, 'rgba(94, 25, 13, 0.92)')
    ground.addColorStop(1, 'rgba(9, 4, 3, 0.98)')
  } else if (surfaceMode === 'ice') {
    ground.addColorStop(0, 'rgba(8, 47, 73, 0.98)')
    ground.addColorStop(0.48, 'rgba(69, 146, 170, 0.84)')
    ground.addColorStop(1, 'rgba(3, 13, 24, 0.98)')
  } else if (surfaceMode === 'alien') {
    ground.addColorStop(0, 'rgba(19, 5, 45, 0.98)')
    ground.addColorStop(0.52, 'rgba(60, 18, 105, 0.9)')
    ground.addColorStop(1, 'rgba(5, 2, 15, 0.98)')
  } else {
    ground.addColorStop(0, 'rgba(12, 18, 28, 0.96)')
    ground.addColorStop(0.52, 'rgba(34, 42, 57, 0.86)')
    ground.addColorStop(1, 'rgba(5, 8, 14, 0.98)')
  }
  ctx.fillStyle = ground
  ctx.globalAlpha = 0.92
  ctx.fillRect(0, 0, width, height)

  ctx.globalCompositeOperation = 'screen'
  const glow = ctx.createRadialGradient(width * 0.5, height * 0.46, 0, width * 0.5, height * 0.46, Math.max(width, height) * 0.62)
  glow.addColorStop(0, surfaceA)
  glow.addColorStop(0.5, surfaceB)
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.globalAlpha = 0.28
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)
  ctx.globalCompositeOperation = 'source-over'

  const tileHeight = height / (quality === 'medium' ? 3.4 : 4.2)
  for (let index = -1; index < featureCount; index += 1) {
    const seed = index + Math.floor(seconds * 0.18) * 19
    const y = ((index * tileHeight + scroll) % (height + tileHeight)) - tileHeight
    const x = seededNoise(seed, 2) * width
    const w = width * (0.12 + seededNoise(seed, 3) * 0.22)
    const h = height * (0.055 + seededNoise(seed, 4) * 0.12)

    if (surfaceMode === 'sea') {
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = 0.12 + seededNoise(seed, 5) * 0.08
      ctx.strokeStyle = seededNoise(seed, 6) > 0.45 ? 'rgba(125,211,252,0.72)' : 'rgba(255,255,255,0.34)'
      ctx.lineWidth = Math.max(1, width * 0.0014)
      ctx.beginPath()
      ctx.ellipse(x, y, w, h * 0.32, seededNoise(seed, 7) * 0.6 - 0.3, 0, Math.PI * 2)
      ctx.stroke()
      if (seededNoise(seed, 8) > 0.62) {
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = 0.18
        ctx.fillStyle = 'rgba(11, 70, 64, 0.72)'
        ctx.beginPath()
        ctx.ellipse(x + w * 0.15, y + h * 0.12, w * 0.28, h * 0.42, 0.4, 0, Math.PI * 2)
        ctx.fill()
      }
    } else if (surfaceMode === 'lava') {
      ctx.globalCompositeOperation = seededNoise(seed, 8) > 0.42 ? 'lighter' : 'source-over'
      ctx.globalAlpha = seededNoise(seed, 8) > 0.42 ? 0.38 : 0.26
      ctx.fillStyle = seededNoise(seed, 8) > 0.42 ? 'rgba(249, 115, 22, 0.86)' : 'rgba(24, 10, 8, 0.72)'
      ctx.beginPath()
      ctx.moveTo(x - w * 0.5, y - h * 0.15)
      ctx.lineTo(x - w * 0.12, y - h * 0.48)
      ctx.lineTo(x + w * 0.48, y - h * 0.18)
      ctx.lineTo(x + w * 0.28, y + h * 0.44)
      ctx.lineTo(x - w * 0.34, y + h * 0.36)
      ctx.closePath()
      ctx.fill()
    } else if (surfaceMode === 'ice') {
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = 0.16 + seededNoise(seed, 8) * 0.12
      ctx.fillStyle = 'rgba(224,242,254,0.62)'
      ctx.beginPath()
      ctx.moveTo(x, y - h)
      ctx.lineTo(x + w * 0.42, y - h * 0.08)
      ctx.lineTo(x + w * 0.18, y + h * 0.62)
      ctx.lineTo(x - w * 0.46, y + h * 0.12)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = 'rgba(186,230,253,0.36)'
      ctx.lineWidth = Math.max(1, width * 0.001)
      ctx.beginPath()
      ctx.moveTo(x - w * 0.24, y + h * 0.12)
      ctx.lineTo(x + w * 0.2, y - h * 0.18)
      ctx.lineTo(x + w * 0.34, y + h * 0.22)
      ctx.stroke()
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = surfaceMode === 'alien' ? 0.24 : 0.18
      ctx.fillStyle = surfaceMode === 'alien' ? 'rgba(31, 9, 62, 0.72)' : 'rgba(15, 23, 42, 0.72)'
      ctx.beginPath()
      ctx.moveTo(x - w * 0.56, y - h * 0.18)
      ctx.lineTo(x - w * 0.2, y - h * 0.5)
      ctx.lineTo(x + w * 0.52, y - h * 0.2)
      ctx.lineTo(x + w * 0.22, y + h * 0.48)
      ctx.lineTo(x - w * 0.44, y + h * 0.36)
      ctx.closePath()
      ctx.fill()
      if (surfaceMode === 'alien') {
        ctx.globalCompositeOperation = 'screen'
        ctx.globalAlpha = 0.16
        ctx.strokeStyle = surfaceC
        ctx.lineWidth = Math.max(1, width * 0.001)
        ctx.beginPath()
        ctx.moveTo(x - w * 0.28, y)
        ctx.lineTo(x + w * 0.24, y - h * 0.1)
        ctx.stroke()
      }
    }
  }

  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 0.18
  ctx.fillStyle = 'rgba(0,0,0,0.42)'
  ctx.fillRect(0, 0, width, height)

  ctx.restore()
}

function drawRaidBackground(ctx: CanvasRenderingContext2D, palette: RaidPalette, width: number, height: number, time: number, quality: GraphicsQuality = 'max', stageTheme = 1) {
  const seconds = time / 1000
  const { baseTop, baseMid, baseBottom, bgA, bgB, nebulaA, nebulaB, starTint, streak, planetA, planetB, planetC } = palette
  const isLow = quality === 'low'
  const isMedium = quality === 'medium'
  const isHigh = quality === 'high'
  const isSurfaceStage = stageTheme % 2 === 0

  const base = ctx.createLinearGradient(0, 0, 0, height)
  base.addColorStop(0, baseTop)
  base.addColorStop(0.45, baseMid)
  base.addColorStop(1, baseBottom)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, width, height)

  if (!isLow) {
    drawRadialEllipse(ctx, width * 0.18, height * 0.16, width * 0.24, height * 0.24, [[0, bgA], [1, 'rgba(0,0,0,0)']])
    drawRadialEllipse(ctx, width * 0.76, height * 0.38, width * 0.26, height * 0.26, [[0, bgB], [1, 'rgba(0,0,0,0)']])
  }

  if (!isLow) {
    ctx.save()
    const nebulaDrift = Math.sin(seconds / 10)
    ctx.translate(width * 0.012 * nebulaDrift, height * 0.006 * Math.cos(seconds / 8))
    ctx.scale(1 + 0.035 * (0.5 + Math.sin(seconds / 7) * 0.5), 1 + 0.025 * (0.5 + Math.cos(seconds / 9) * 0.5))
    drawRadialEllipse(ctx, width * 0.2, height * 0.72, width * 0.36, height * 0.24, [[0, nebulaA], [1, 'rgba(0,0,0,0)']])
    drawRadialEllipse(ctx, width * 0.82, height * 0.24, width * 0.32, height * 0.22, [[0, nebulaB], [1, 'rgba(0,0,0,0)']])
    ctx.restore()
  }

  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  if (!isLow) {
    drawRadialEllipse(ctx, width * 0.78, height * 0.18, width * 0.48, height * 0.25, [[0, 'rgba(139,92,246,0.2)'], [1, 'rgba(0,0,0,0)']])
    drawRadialEllipse(ctx, width * 0.14, height * 0.68, width * 0.36, height * 0.42, [[0, 'rgba(59,130,246,0.16)'], [1, 'rgba(0,0,0,0)']])
    if (!isMedium) {
      drawRadialEllipse(ctx, width * 0.48, height * 0.42, width * 0.22, height * 0.18, [[0, 'rgba(236,72,153,0.11)'], [1, 'rgba(0,0,0,0)']])
      drawRadialEllipse(ctx, width * 0.22, height * 0.22, width * 0.26, height * 0.15, [[0, 'rgba(251,191,36,0.05)'], [1, 'rgba(0,0,0,0)']])
      drawRadialEllipse(ctx, width * 0.88, height * 0.72, width * 0.18, height * 0.32, [[0, 'rgba(34,211,238,0.06)'], [1, 'rgba(0,0,0,0)']])
    }
  }
  ctx.restore()

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const starLimit = isLow ? 40 : isMedium ? 100 : isHigh ? 160 : BACKGROUND_STARS.length
  for (let index = 0; index < starLimit; index += 1) {
    const star = BACKGROUND_STARS[index]
    const farY = ((star.y * height * 1.26 + seconds * 15) % (height * 1.26)) - height * 0.13
    const nearY = ((star.y * height * 1.38 + seconds * 72) % (height * 1.38)) - height * 0.19
    const x = star.x * width
    ctx.globalAlpha = star.alpha * 0.52
    ctx.fillStyle = star.tint > 0.66 ? starTint : star.tint > 0.33 ? 'rgba(125,211,252,0.55)' : 'rgba(255,255,255,0.76)'
    ctx.beginPath()
    ctx.arc(x, farY, star.size * 0.62, 0, Math.PI * 2)
    ctx.fill()

    if (!isLow && !isMedium && star.tint > 0.58) {
      ctx.globalAlpha = star.alpha * 0.42
      const trail = ctx.createLinearGradient(x, nearY - 18, x, nearY + 28)
      trail.addColorStop(0, 'rgba(255,255,255,0)')
      trail.addColorStop(0.46, star.tint > 0.78 ? streak : 'rgba(255,255,255,0.42)')
      trail.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.strokeStyle = trail
      ctx.lineWidth = Math.max(1, star.size * 0.8)
      ctx.beginPath()
      ctx.moveTo(x, nearY - 18)
      ctx.lineTo(x, nearY + 28)
      ctx.stroke()
    }
  }

  if (!isLow) {
    const speedLineLimit = isMedium ? 2 : BACKGROUND_SPEED_LINES.length
    for (let index = 0; index < speedLineLimit; index += 1) {
      const line = BACKGROUND_SPEED_LINES[index]
      const lineColor =
        line.color === 'streak' ? streak :
          line.color === 'red' ? 'rgba(239,35,60,0.42)' :
            line.color === 'cyan' ? 'rgba(125,211,252,0.28)' :
              'rgba(255,255,255,0.26)'
      const y = (((seconds + line.delay) / 0.75) % 1) * height * 1.5 - height * 0.2
      const x = line.x * width
      const gradient = ctx.createLinearGradient(x, y, x, y + line.length)
      gradient.addColorStop(0, 'rgba(255,255,255,0)')
      gradient.addColorStop(0.46, lineColor)
      gradient.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.globalAlpha = 0.58
      ctx.strokeStyle = gradient
      ctx.lineWidth = line.width
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x, y + line.length)
      ctx.stroke()
    }
  }
  ctx.restore()

  const planetBase = height * 1.3
  const planet1Y = ((seconds / 28 + 0.9) % 1) * planetBase - height * 0.1
  const planet2Y = ((seconds / 42 + 0.64) % 1) * planetBase - height * 0.08
  const planet3Y = ((seconds / 58 + 0.42) % 1) * planetBase - height * 0.06
  const planet1R = Math.min(width * 0.09, 70)
  const planet2R = Math.min(width * 0.045, 36)
  const planet3R = Math.min(width * 0.03, 26)

  if (!isLow) {
    if (isSurfaceStage) {
      drawPlanetSurface(ctx, palette, width, height, seconds, quality)
    }
    ctx.save()
    ctx.globalAlpha = 1
    drawRadialEllipse(ctx, width * 0.92, planet1Y, planet1R, planet1R, [[0, '#f9fafb'], [0.5, planetA], [1, baseTop]])
    if (!isMedium) {
      ctx.strokeStyle = 'rgba(167,139,250,0.28)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(width * 0.92, planet1Y, planet1R * 1.28, planet1R * 0.28, -8 * DEG, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 0.82
    drawRadialEllipse(ctx, width * 0.05, planet2Y, planet2R, planet2R, [[0, '#f8fafc'], [0.55, planetB], [1, baseBottom]])
    if (!isMedium) {
      drawRadialEllipse(ctx, width * 0.24, planet3Y, planet3R, planet3R, [[0, '#e0f2fe'], [0.55, planetC], [1, baseMid]])
    }
    ctx.restore()
  }

  if (!isLow) {
    const asteroidLimit = isMedium ? 3 : BACKGROUND_ASTEROIDS.length
    const debrisLimit = isMedium ? 3 : BACKGROUND_DEBRIS.length
    for (let index = 0; index < asteroidLimit; index += 1) {
      const asteroid = BACKGROUND_ASTEROIDS[index]
      const y = ((seconds * asteroid.speed + asteroid.delay / 22 + 1) % 1) * height * 1.15 - height * 0.05
      drawAsteroidShape(ctx, width * asteroid.x, y, asteroid.width, asteroid.height, seconds * asteroid.spin * DEG / 10, asteroid.alpha)
    }
    for (let index = 0; index < debrisLimit; index += 1) {
      const debris = BACKGROUND_DEBRIS[index]
      const y = ((seconds * debris.speed + debris.delay / 48 + 1) % 1) * height * 1.2 - height * 0.05
      drawDebrisShape(ctx, width * debris.x, y, debris.width, debris.height, seconds * debris.spin * DEG / 12, debris.alpha)
    }

    if (!isMedium) {
      const clusterY1 = ((seconds / 16 + 0.56) % 1) * height * 1.15 - height * 0.04
      const clusterY2 = ((seconds / 24 + 0.25) % 1) * height * 1.15 - height * 0.04
      drawAsteroidShape(ctx, width * 0.44, clusterY1, 16, 12, seconds * 0.3, 0.24)
      drawAsteroidShape(ctx, width * 0.44 + 22, clusterY1 + 14, 10, 8, -seconds * 0.2, 0.2)
      drawAsteroidShape(ctx, width * 0.72, clusterY2, 20, 16, -seconds * 0.18, 0.22)
      drawAsteroidShape(ctx, width * 0.72 + 24, clusterY2 + 18, 12, 9, seconds * 0.18, 0.18)
    }
  }

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  if (!isLow && !isMedium) {
    const laserY1 = ((seconds / 6 + 0.67) % 1) * height * 1.15 - height * 0.08
    const laserY2 = ((seconds / 9 + 0.32) % 1) * height * 1.15 - height * 0.06
    const drawLaser = (x: number, y: number, length: number, rotation: number, color: string, widthPx: number) => {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rotation)
      const gradient = ctx.createLinearGradient(0, -length / 2, 0, length / 2)
      gradient.addColorStop(0, 'rgba(255,255,255,0)')
      gradient.addColorStop(0.5, color)
      gradient.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.strokeStyle = gradient
      ctx.lineWidth = widthPx
      ctx.shadowBlur = 10
      ctx.shadowColor = color
      ctx.beginPath()
      ctx.moveTo(0, -length / 2)
      ctx.lineTo(0, length / 2)
      ctx.stroke()
      ctx.restore()
    }
    drawLaser(width * 0.38, laserY1, 80, -4 * DEG, 'rgba(239,35,60,0.72)', 2)
    drawLaser(width * 0.66, laserY2, 56, 12 * DEG, 'rgba(34,211,238,0.52)', 1.5)

    const drawExplosion = (x: number, y: number, period: number, offset: number, radius: number, alpha: number) => {
      const cycle = ((seconds + offset) % period) / period
      const pulse = cycle < 0.42 ? Math.sin((cycle / 0.42) * Math.PI) : 0
      if (pulse <= 0) return
      drawRadialEllipse(ctx, x, y, radius * (0.6 + pulse * 1.4), radius * (0.6 + pulse * 1.4), [
        [0, `rgba(255,255,255,${0.45 * pulse * alpha})`],
        [0.32, `rgba(251,191,36,${0.48 * pulse * alpha})`],
        [0.64, `rgba(239,35,60,${0.32 * pulse * alpha})`],
        [1, 'rgba(0,0,0,0)'],
      ])
    }
    drawExplosion(width * 0.08, height * 0.18, 7, 4, 32, 0.9)
    drawExplosion(width * 0.9, height * 0.44, 11, 2, 24, 0.75)
  }
  ctx.restore()
}

function drawBossAura(ctx: CanvasRenderingContext2D, enemy: Enemy, x: number, y: number, size: number, time: number) {
  const seconds = time / 1000
  const kind = enemy.bossKind ?? 'carrier'
  ctx.save()
  ctx.translate(x, y)
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = 0.9
  drawRadialEllipse(ctx, 0, 0, size * 0.72, size * 0.72, [
    [0, 'rgba(239,35,60,0.22)'],
    [0.52, 'rgba(239,35,60,0.08)'],
    [1, 'rgba(0,0,0,0)'],
  ])

  ctx.strokeStyle = 'rgba(239,35,60,0.3)'
  ctx.lineWidth = Math.max(1, size * 0.01)
  ctx.shadowBlur = size * 0.08
  ctx.shadowColor = 'rgba(239,35,60,0.42)'

  if (kind === 'carrier') {
    ctx.fillStyle = 'rgba(127,29,29,0.34)'
    ctx.beginPath()
    ctx.moveTo(-size * 0.58, 0)
    ctx.lineTo(-size * 0.14, -size * 0.16)
    ctx.lineTo(-size * 0.24, size * 0.16)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(size * 0.58, 0)
    ctx.lineTo(size * 0.14, -size * 0.16)
    ctx.lineTo(size * 0.24, size * 0.16)
    ctx.closePath()
    ctx.fill()
    drawRadialEllipse(ctx, 0, size * 0.42, size * 0.28, size * 0.08, [[0, 'rgba(239,35,60,0.28)'], [1, 'rgba(0,0,0,0)']])
  } else if (kind === 'orb') {
    for (let i = 0; i < 3; i += 1) {
      ctx.save()
      ctx.rotate(seconds * (i % 2 === 0 ? 0.9 : -0.65) + i * 0.8)
      ctx.strokeStyle = i === 2 ? 'rgba(216,180,254,0.42)' : 'rgba(239,35,60,0.42)'
      ctx.beginPath()
      ctx.ellipse(0, 0, size * (0.3 + i * 0.1), size * (0.22 + i * 0.07), 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
  } else if (kind === 'serpent' || kind === 'mantis') {
    ctx.fillStyle = kind === 'mantis' ? 'rgba(54,83,20,0.38)' : 'rgba(22,78,99,0.38)'
    ctx.strokeStyle = kind === 'mantis' ? 'rgba(190,242,100,0.42)' : 'rgba(103,232,249,0.38)'
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(side * size * 0.42, -size * 0.32)
      ctx.lineTo(side * size * 0.66, 0)
      ctx.lineTo(side * size * 0.42, size * 0.34)
      ctx.lineTo(side * size * 0.26, size * 0.08)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
  } else if (kind === 'hydra') {
    for (const offset of [-0.28, 0, 0.28]) {
      ctx.strokeStyle = 'rgba(168,85,247,0.44)'
      drawRadialEllipse(ctx, size * offset, 0, size * 0.14, size * 0.42, [[0, 'rgba(76,29,149,0.24)'], [1, 'rgba(0,0,0,0)']])
      ctx.beginPath()
      ctx.ellipse(size * offset, 0, size * 0.14, size * 0.42, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
  } else if (kind === 'gate') {
    ctx.save()
    ctx.rotate(Math.PI / 4)
    ctx.strokeStyle = 'rgba(248,113,113,0.46)'
    traceRoundedRect(ctx, -size * 0.42, -size * 0.42, size * 0.84, size * 0.84, size * 0.06)
    ctx.stroke()
    ctx.restore()
  } else {
    const ringCount = kind === 'final' ? 3 : 2
    for (let i = 0; i < ringCount; i += 1) {
      ctx.save()
      ctx.rotate(seconds * (i % 2 ? -0.8 : 0.55) + i * 0.65)
      ctx.strokeStyle = i === 0 ? 'rgba(251,191,36,0.44)' : 'rgba(168,85,247,0.36)'
      traceRoundedRect(ctx, -size * (0.45 + i * 0.06), -size * (0.45 + i * 0.06), size * (0.9 + i * 0.12), size * (0.9 + i * 0.12), kind === 'final' ? size * 0.12 : size * 0.04)
      ctx.stroke()
      ctx.restore()
    }
  }
  ctx.restore()
}

function drawBossReticle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, time: number, isFinal: boolean) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(time / 2400)
  ctx.globalAlpha = isFinal ? 0.56 : 0.44
  ctx.strokeStyle = 'rgba(251,191,36,0.72)'
  ctx.shadowBlur = 10
  ctx.shadowColor = 'rgba(251,191,36,0.5)'
  ctx.lineWidth = Math.max(1.5, size * 0.012)
  const extent = size * (isFinal ? 0.74 : 0.64)
  const corner = Math.min(22, size * 0.12)
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(sx * extent, sy * (extent - corner))
      ctx.lineTo(sx * extent, sy * extent)
      ctx.lineTo(sx * (extent - corner), sy * extent)
      ctx.stroke()
    }
  }
  ctx.restore()
}

function drawBossShield(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, time: number) {
  const pulse = 0.94 + Math.sin(time / 430) * 0.06
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(pulse, pulse)
  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = 'rgba(251,191,36,0.72)'
  ctx.fillStyle = 'rgba(251,191,36,0.08)'
  ctx.shadowBlur = 26
  ctx.shadowColor = 'rgba(251,191,36,0.48)'
  ctx.lineWidth = Math.max(2, size * 0.012)
  ctx.beginPath()
  ctx.arc(0, 0, size * 0.56, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function drawBossBar(ctx: CanvasRenderingContext2D, enemy: Enemy, x: number, y: number, size: number) {
  const isSuper = enemy.bossKind === 'super' || enemy.bossKind === 'squid' || enemy.bossKind === 'snake' || enemy.bossKind === 'final'
  const width = size * (isSuper ? 1.04 : 0.9)
  const height = isSuper ? 13 : 10
  const barX = x - width / 2
  const barY = y + size * 0.5 + (isSuper ? 16 : 12)
  const fill = clamp(enemy.hp / enemy.maxHp, 0, 1)

  ctx.save()
  traceRoundedRect(ctx, barX, barY, width, height, 999)
  ctx.fillStyle = isSuper ? 'rgba(18,8,16,0.95)' : 'rgba(20,10,20,0.92)'
  ctx.strokeStyle = isSuper ? 'rgba(251,191,36,0.65)' : 'rgba(255,255,255,0.2)'
  ctx.lineWidth = 1
  ctx.fill()
  ctx.stroke()
  ctx.clip()
  const gradient = ctx.createLinearGradient(barX, 0, barX + width, 0)
  if (isSuper) {
    gradient.addColorStop(0, '#581c87')
    gradient.addColorStop(0.46, '#ef233c')
    gradient.addColorStop(1, '#fbbf24')
  } else {
    gradient.addColorStop(0, '#7f1d1d')
    gradient.addColorStop(0.55, '#ef233c')
    gradient.addColorStop(1, '#fca5a5')
  }
  ctx.fillStyle = gradient
  ctx.shadowBlur = isSuper ? 18 : 14
  ctx.shadowColor = isSuper ? 'rgba(251,191,36,0.82)' : 'rgba(239,35,60,0.8)'
  ctx.fillRect(barX, barY, width * fill, height)
  ctx.restore()
}

function getNormalEnemyFilter(time: number) {
  const pulse = 0.88 + ((Math.sin(time / 700) + 1) / 2) * 0.3
  return `brightness(${1.16 * pulse}) contrast(1.12) saturate(1.28)`
}

function drawBossDust(ctx: CanvasRenderingContext2D, size: number, color: string, count: number, seed: number, spreadX = 0.7, spreadY = 0.7) {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < count; i += 1) {
    const a = (i + 1) * 12.9898 + seed
    const b = (i + 1) * 78.233 + seed * 0.37
    const x = (Math.sin(a) * 0.5 + Math.sin(a * 0.43) * 0.5) * size * spreadX
    const y = (Math.cos(b) * 0.5 + Math.sin(b * 0.31) * 0.5) * size * spreadY
    const alpha = 0.18 + ((i * 17) % 9) * 0.035
    ctx.fillStyle = color.replace('ALPHA', alpha.toFixed(2))
    ctx.beginPath()
    ctx.arc(x, y, Math.max(0.8, size * (0.0035 + (i % 3) * 0.0018)), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawEtchedPanelLine(ctx: CanvasRenderingContext2D, points: Array<[number, number]>, size: number, color: string, width = 0.004) {
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(0.8, size * width)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x * size, y * size)
    else ctx.lineTo(x * size, y * size)
  })
  ctx.stroke()
}

function drawReferenceSquidBossFinishPass(ctx: CanvasRenderingContext2D, size: number, time: number) {
  const seconds = time / 1000
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'

  const outer = ctx.createLinearGradient(0, -size * 0.78, 0, size * 0.28)
  outer.addColorStop(0, '#f0abfc')
  outer.addColorStop(0.18, '#a21caf')
  outer.addColorStop(0.48, '#581c87')
  outer.addColorStop(0.78, '#2e1065')
  outer.addColorStop(1, '#05000a')
  ctx.fillStyle = outer
  ctx.strokeStyle = 'rgba(232,121,249,0.95)'
  ctx.lineWidth = Math.max(2.2, size * 0.01)
  ctx.beginPath()
  ctx.moveTo(0, -size * 0.82)
  ctx.lineTo(size * 0.2, -size * 0.46)
  ctx.bezierCurveTo(size * 0.32, -size * 0.18, size * 0.31, size * 0.16, size * 0.14, size * 0.31)
  ctx.lineTo(0, size * 0.38)
  ctx.lineTo(-size * 0.14, size * 0.31)
  ctx.bezierCurveTo(-size * 0.31, size * 0.16, -size * 0.32, -size * 0.18, -size * 0.2, -size * 0.46)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  for (const side of [-1, 1]) {
    ctx.fillStyle = 'rgba(40,6,74,0.96)'
    ctx.strokeStyle = 'rgba(168,85,247,0.9)'
    ctx.beginPath()
    ctx.moveTo(side * size * 0.16, -size * 0.42)
    ctx.lineTo(side * size * 0.52, -size * 0.24)
    ctx.lineTo(side * size * 0.39, size * 0.02)
    ctx.lineTo(side * size * 0.19, -size * 0.02)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  ctx.globalCompositeOperation = 'lighter'
  drawRadialEllipse(ctx, 0, -size * 0.08, size * 0.09, size * 0.23, [
    [0, 'rgba(255,255,255,0.98)'],
    [0.2, 'rgba(254,240,138,0.96)'],
    [0.52, 'rgba(249,115,22,0.96)'],
    [1, 'rgba(124,45,18,0.05)'],
  ])
  ctx.strokeStyle = 'rgba(20,6,28,0.96)'
  ctx.lineWidth = Math.max(2.5, size * 0.013)
  ctx.beginPath()
  ctx.moveTo(0, -size * 0.27)
  ctx.lineTo(0, size * 0.1)
  ctx.stroke()

  ctx.fillStyle = 'rgba(163,230,53,0.9)'
  for (let i = 0; i < 96; i += 1) {
    const band = Math.floor(i / 16)
    const col = i % 16
    const x = (col - 7.5) * size * 0.021
    const y = -size * 0.56 + band * size * 0.09 + Math.abs(col - 7.5) * size * 0.012
    if (Math.abs(x) > size * (0.155 + band * 0.012)) continue
    ctx.beginPath()
    ctx.arc(x, y, Math.max(0.9, size * 0.0046), 0, Math.PI * 2)
    ctx.fill()
  }

  for (const side of [-1, 1]) {
    for (let arm = 0; arm < 4; arm += 1) {
      const startX = side * size * (0.06 + arm * 0.045)
      const endX = side * size * (0.2 + arm * 0.13 + Math.sin(seconds * 1.3 + arm) * 0.045)
      const endY = size * (0.48 + arm * 0.14)
      ctx.strokeStyle = arm < 2 ? 'rgba(88,28,135,0.94)' : 'rgba(190,24,93,0.82)'
      ctx.lineWidth = Math.max(2.4, size * (0.021 - arm * 0.0022))
      ctx.beginPath()
      ctx.moveTo(startX, size * 0.2)
      ctx.bezierCurveTo(side * size * 0.2, size * 0.34, side * size * (0.02 + arm * 0.08), size * 0.48, endX, endY)
      ctx.stroke()
      if (arm % 2 === 0) {
        drawRadialEllipse(ctx, endX, endY, size * 0.048, size * 0.048, [
          [0, 'rgba(255,255,255,0.95)'],
          [0.34, 'rgba(244,114,182,0.92)'],
          [1, 'rgba(244,114,182,0)'],
        ])
      }
    }
  }
  ctx.restore()
}

function drawReferenceSnakeBossFinishPass(ctx: CanvasRenderingContext2D, size: number, time: number) {
  const seconds = time / 1000
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'

  for (const side of [-1, 1]) {
    const hood = ctx.createLinearGradient(0, -size * 0.56, side * size * 0.48, size * 0.08)
    hood.addColorStop(0, '#fef3c7')
    hood.addColorStop(0.22, '#b7832f')
    hood.addColorStop(0.58, '#1f2937')
    hood.addColorStop(1, '#020617')
    ctx.fillStyle = hood
    ctx.strokeStyle = 'rgba(253,230,138,0.9)'
    ctx.lineWidth = Math.max(2.2, size * 0.009)
    ctx.beginPath()
    ctx.moveTo(side * size * 0.03, -size * 0.5)
    ctx.bezierCurveTo(side * size * 0.46, -size * 0.48, side * size * 0.5, -size * 0.1, side * size * 0.2, size * 0.13)
    ctx.lineTo(side * size * 0.04, size * 0.03)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = 'rgba(2,6,23,0.58)'
    ctx.beginPath()
    ctx.moveTo(side * size * 0.09, -size * 0.34)
    ctx.lineTo(side * size * 0.29, -size * 0.18)
    ctx.lineTo(side * size * 0.1, size * 0.04)
    ctx.closePath()
    ctx.fill()
  }

  const head = ctx.createRadialGradient(-size * 0.04, -size * 0.42, size * 0.02, 0, -size * 0.22, size * 0.32)
  head.addColorStop(0, '#fff7ad')
  head.addColorStop(0.28, '#b6a27c')
  head.addColorStop(0.62, '#1f2937')
  head.addColorStop(1, '#020617')
  ctx.fillStyle = head
  ctx.strokeStyle = 'rgba(253,230,138,0.94)'
  ctx.lineWidth = Math.max(2, size * 0.01)
  ctx.beginPath()
  ctx.moveTo(0, -size * 0.56)
  ctx.bezierCurveTo(size * 0.17, -size * 0.5, size * 0.22, -size * 0.22, size * 0.1, size * 0.08)
  ctx.bezierCurveTo(size * 0.04, size * 0.2, -size * 0.04, size * 0.2, -size * 0.1, size * 0.08)
  ctx.bezierCurveTo(-size * 0.22, -size * 0.22, -size * 0.17, -size * 0.5, 0, -size * 0.56)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  ctx.globalCompositeOperation = 'lighter'
  for (const side of [-1, 1]) {
    drawRadialEllipse(ctx, side * size * 0.07, -size * 0.18, size * 0.04, size * 0.05, [
      [0, 'rgba(255,255,255,0.98)'],
      [0.32, 'rgba(251,191,36,0.98)'],
      [1, 'rgba(249,115,22,0)'],
    ])
    for (let dot = 0; dot < 9; dot += 1) {
      drawRadialEllipse(ctx, side * size * (0.12 + (dot % 3) * 0.045), -size * (0.42 - dot * 0.07), size * 0.017, size * 0.017, [
        [0, 'rgba(255,255,255,0.85)'],
        [0.45, 'rgba(34,211,238,0.78)'],
        [1, 'rgba(34,211,238,0)'],
      ])
    }
  }

  ctx.strokeStyle = 'rgba(253,230,138,0.82)'
  ctx.lineWidth = Math.max(1.3, size * 0.0055)
  for (let i = 0; i < 20; i += 1) {
    const y = size * (0.55 - i * 0.055)
    const x = Math.sin(i * 0.75 + seconds * 0.7) * size * 0.18
    ctx.beginPath()
    ctx.ellipse(x, y, size * (0.085 - i * 0.0016), size * 0.025, Math.sin(i) * 0.6, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.globalCompositeOperation = 'source-over'
  const tailX = Math.sin(seconds * 0.7 + 2.8) * size * 0.2
  ctx.fillStyle = '#111827'
  ctx.strokeStyle = 'rgba(253,230,138,0.86)'
  ctx.lineWidth = Math.max(1.4, size * 0.006)
  ctx.beginPath()
  ctx.moveTo(tailX - size * 0.035, size * 0.56)
  ctx.quadraticCurveTo(tailX + size * 0.1, size * 0.67, tailX + size * 0.23, size * 0.8)
  ctx.quadraticCurveTo(tailX + size * 0.06, size * 0.76, tailX - size * 0.03, size * 0.67)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.globalCompositeOperation = 'lighter'
  drawRadialEllipse(ctx, tailX + size * 0.17, size * 0.77, size * 0.025, size * 0.018, [
    [0, 'rgba(255,255,255,0.78)'],
    [0.45, 'rgba(34,211,238,0.55)'],
    [1, 'rgba(34,211,238,0)'],
  ])
  ctx.restore()
}

function drawReferenceDreadshipBossFinishPass(ctx: CanvasRenderingContext2D, size: number, time: number) {
  const seconds = time / 1000
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'

  const gold = ctx.createLinearGradient(0, -size * 0.7, 0, size * 0.68)
  gold.addColorStop(0, '#fff7ad')
  gold.addColorStop(0.22, '#d69e2e')
  gold.addColorStop(0.55, '#7c3f0f')
  gold.addColorStop(0.82, '#22140b')
  gold.addColorStop(1, '#050506')
  ctx.fillStyle = gold
  ctx.strokeStyle = 'rgba(254,243,199,0.95)'
  ctx.lineWidth = Math.max(2, size * 0.008)
  ctx.beginPath()
  ctx.moveTo(0, -size * 0.75)
  ctx.lineTo(size * 0.17, -size * 0.42)
  ctx.lineTo(size * 0.13, size * 0.45)
  ctx.lineTo(0, size * 0.7)
  ctx.lineTo(-size * 0.13, size * 0.45)
  ctx.lineTo(-size * 0.17, -size * 0.42)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  for (const side of [-1, 1]) {
    ctx.fillStyle = gold
    ctx.strokeStyle = 'rgba(251,191,36,0.88)'
    ctx.beginPath()
    ctx.moveTo(side * size * 0.18, -size * 0.5)
    ctx.lineTo(side * size * 0.43, -size * 0.62)
    ctx.lineTo(side * size * 0.32, -size * 0.24)
    ctx.lineTo(side * size * 0.66, -size * 0.08)
    ctx.lineTo(side * size * 0.42, size * 0.2)
    ctx.lineTo(side * size * 0.2, size * 0.08)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = 'rgba(8,47,73,0.96)'
    ctx.strokeStyle = 'rgba(125,249,255,0.9)'
    ctx.beginPath()
    ctx.moveTo(side * size * 0.28, -size * 0.22)
    ctx.lineTo(side * size * 0.5, -size * 0.08)
    ctx.lineTo(side * size * 0.34, size * 0.34)
    ctx.lineTo(side * size * 0.18, size * 0.18)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  ctx.globalCompositeOperation = 'lighter'
  drawRadialEllipse(ctx, 0, size * 0.2, size * 0.17, size * 0.18, [
    [0, 'rgba(255,255,255,0.98)'],
    [0.26, 'rgba(125,249,255,0.96)'],
    [0.64, 'rgba(14,165,233,0.62)'],
    [1, 'rgba(14,165,233,0)'],
  ])
  for (let drone = 0; drone < 8; drone += 1) {
    const angle = drone / 8 * Math.PI * 2 + seconds * 0.42
    const dx = Math.cos(angle) * size * 0.79
    const dy = size * 0.08 + Math.sin(angle) * size * 0.52
    ctx.save()
    ctx.translate(dx, dy)
    ctx.rotate(angle)
    ctx.fillStyle = 'rgba(14,165,233,0.46)'
    ctx.strokeStyle = 'rgba(125,249,255,0.92)'
    ctx.beginPath()
    ctx.ellipse(0, 0, size * 0.052, size * 0.014, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  ctx.strokeStyle = 'rgba(125,249,255,0.86)'
  ctx.lineWidth = Math.max(2.2, size * 0.009)
  ctx.beginPath()
  ctx.moveTo(0, size * 0.56)
  ctx.lineTo(0, size * 0.82)
  ctx.stroke()
  drawRadialEllipse(ctx, 0, size * 0.72, size * 0.055, size * 0.18, [
    [0, 'rgba(255,255,255,0.7)'],
    [0.3, 'rgba(34,211,238,0.74)'],
    [1, 'rgba(34,211,238,0)'],
  ])
  ctx.restore()
}
function drawReferenceSquidBossDetails(ctx: CanvasRenderingContext2D, size: number, time: number) {
  const seconds = time / 1000
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'

  const mantle = ctx.createLinearGradient(0, -size * 0.68, 0, size * 0.28)
  mantle.addColorStop(0, '#f0abfc')
  mantle.addColorStop(0.16, '#8b5cf6')
  mantle.addColorStop(0.48, '#581c87')
  mantle.addColorStop(0.78, '#2e1065')
  mantle.addColorStop(1, '#090211')
  ctx.fillStyle = mantle
  ctx.strokeStyle = 'rgba(232,121,249,0.86)'
  ctx.lineWidth = Math.max(1.8, size * 0.008)
  ctx.beginPath()
  ctx.moveTo(0, -size * 0.73)
  ctx.bezierCurveTo(size * 0.21, -size * 0.55, size * 0.32, -size * 0.1, size * 0.16, size * 0.3)
  ctx.bezierCurveTo(size * 0.06, size * 0.43, -size * 0.06, size * 0.43, -size * 0.16, size * 0.3)
  ctx.bezierCurveTo(-size * 0.32, -size * 0.1, -size * 0.21, -size * 0.55, 0, -size * 0.73)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  for (const side of [-1, 1]) {
    ctx.fillStyle = 'rgba(43,7,71,0.92)'
    ctx.strokeStyle = 'rgba(168,85,247,0.82)'
    ctx.beginPath()
    ctx.moveTo(side * size * 0.18, -size * 0.38)
    ctx.lineTo(side * size * 0.48, -size * 0.22)
    ctx.lineTo(side * size * 0.34, size * 0.08)
    ctx.lineTo(side * size * 0.16, size * 0.02)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  ctx.globalCompositeOperation = 'lighter'
  drawRadialEllipse(ctx, 0, -size * 0.1, size * 0.09, size * 0.22, [
    [0, 'rgba(255,255,255,0.96)'],
    [0.22, 'rgba(254,240,138,0.94)'],
    [0.56, 'rgba(249,115,22,0.9)'],
    [1, 'rgba(190,24,93,0.12)'],
  ])
  ctx.strokeStyle = 'rgba(15,23,42,0.9)'
  ctx.lineWidth = Math.max(2, size * 0.012)
  ctx.beginPath()
  ctx.moveTo(0, -size * 0.27)
  ctx.lineTo(0, size * 0.08)
  ctx.stroke()

  ctx.fillStyle = 'rgba(163,230,53,0.86)'
  for (let i = 0; i < 78; i += 1) {
    const row = i % 13
    const col = Math.floor(i / 13)
    const x = (row - 6) * size * 0.024 + Math.sin(col * 0.9 + seconds) * size * 0.006
    const y = -size * 0.5 + col * size * 0.095 + Math.abs(row - 6) * size * 0.012
    if (Math.abs(x) > size * (0.16 + col * 0.012)) continue
    ctx.beginPath()
    ctx.arc(x, y, Math.max(0.8, size * 0.0048), 0, Math.PI * 2)
    ctx.fill()
  }

  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i += 1) {
      const baseX = side * size * (0.12 + i * 0.045)
      const tipX = side * size * (0.36 + i * 0.11 + Math.sin(seconds * 1.7 + i) * 0.04)
      const tipY = size * (0.55 + i * 0.17)
      ctx.strokeStyle = i === 0 ? 'rgba(88,28,135,0.88)' : 'rgba(157,23,77,0.8)'
      ctx.lineWidth = Math.max(3.2, size * (0.018 - i * 0.002))
      ctx.beginPath()
      ctx.moveTo(baseX, size * 0.18)
      ctx.bezierCurveTo(side * size * 0.22, size * 0.34, side * size * 0.1, size * 0.46, tipX, tipY)
      ctx.stroke()
      if (i !== 1) {
        drawRadialEllipse(ctx, tipX, tipY, size * 0.055, size * 0.055, [
          [0, 'rgba(255,255,255,0.92)'],
          [0.32, 'rgba(244,114,182,0.9)'],
          [1, 'rgba(244,114,182,0)'],
        ])
      }
    }
  }
  ctx.restore()
}

function drawReferenceSnakeBossDetails(ctx: CanvasRenderingContext2D, size: number, time: number) {
  const seconds = time / 1000
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'

  for (const side of [-1, 1]) {
    const hood = ctx.createLinearGradient(side * size * 0.04, -size * 0.45, side * size * 0.5, size * 0.08)
    hood.addColorStop(0, '#fef3c7')
    hood.addColorStop(0.28, '#a16207')
    hood.addColorStop(0.62, '#1f2937')
    hood.addColorStop(1, '#020617')
    ctx.fillStyle = hood
    ctx.strokeStyle = 'rgba(253,230,138,0.78)'
    ctx.lineWidth = Math.max(2, size * 0.008)
    ctx.beginPath()
    ctx.moveTo(side * size * 0.04, -size * 0.44)
    ctx.bezierCurveTo(side * size * 0.43, -size * 0.42, side * size * 0.48, -size * 0.1, side * size * 0.2, size * 0.12)
    ctx.lineTo(side * size * 0.05, size * 0.02)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    for (let rib = 0; rib < 7; rib += 1) {
      ctx.strokeStyle = rib % 2 === 0 ? 'rgba(34,211,238,0.42)' : 'rgba(253,230,138,0.34)'
      ctx.beginPath()
      ctx.moveTo(side * size * (0.08 + rib * 0.035), -size * (0.34 - rib * 0.045))
      ctx.lineTo(side * size * (0.34 - rib * 0.018), -size * (0.2 - rib * 0.035))
      ctx.stroke()
    }
  }

  ctx.globalCompositeOperation = 'lighter'
  for (const side of [-1, 1]) {
    drawRadialEllipse(ctx, side * size * 0.08, -size * 0.18, size * 0.045, size * 0.05, [
      [0, 'rgba(255,255,255,0.96)'],
      [0.34, 'rgba(251,191,36,0.95)'],
      [1, 'rgba(249,115,22,0)'],
    ])
    for (let dot = 0; dot < 8; dot += 1) {
      const y = -size * 0.43 + dot * size * 0.08
      drawRadialEllipse(ctx, side * size * (0.16 + (dot % 3) * 0.045), y, size * 0.018, size * 0.018, [
        [0, 'rgba(255,255,255,0.84)'],
        [0.45, 'rgba(34,211,238,0.74)'],
        [1, 'rgba(34,211,238,0)'],
      ])
    }
  }

  ctx.strokeStyle = 'rgba(253,230,138,0.72)'
  ctx.lineWidth = Math.max(1.4, size * 0.006)
  for (let i = 0; i < 16; i += 1) {
    const y = size * (0.48 - i * 0.06)
    const w = size * (0.08 + (i % 5) * 0.012)
    ctx.beginPath()
    ctx.ellipse(Math.sin(i * 0.7 + seconds) * size * 0.12, y, w, size * 0.025, Math.sin(i) * 0.6, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

function drawReferenceDreadshipBossDetails(ctx: CanvasRenderingContext2D, size: number, time: number) {
  const seconds = time / 1000
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'

  ctx.fillStyle = 'rgba(251,191,36,0.72)'
  ctx.strokeStyle = 'rgba(254,243,199,0.82)'
  ctx.lineWidth = Math.max(1.2, size * 0.005)
  for (let plate = 0; plate < 12; plate += 1) {
    const y = -size * 0.58 + plate * size * 0.095
    const w = size * (0.055 + plate * 0.01)
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y + size * 0.04)
    ctx.lineTo(0, y + size * 0.078)
    ctx.lineTo(-w, y + size * 0.04)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  for (const side of [-1, 1]) {
    ctx.fillStyle = 'rgba(8,47,73,0.92)'
    ctx.strokeStyle = 'rgba(125,249,255,0.86)'
    ctx.beginPath()
    ctx.moveTo(side * size * 0.28, -size * 0.25)
    ctx.lineTo(side * size * 0.51, -size * 0.1)
    ctx.lineTo(side * size * 0.34, size * 0.33)
    ctx.lineTo(side * size * 0.18, size * 0.18)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    for (let bar = 0; bar < 7; bar += 1) {
      ctx.strokeStyle = 'rgba(125,249,255,0.64)'
      ctx.lineWidth = Math.max(1.4, size * 0.005)
      ctx.beginPath()
      ctx.moveTo(side * size * (0.27 + bar * 0.016), -size * (0.16 - bar * 0.052))
      ctx.lineTo(side * size * (0.42 + bar * 0.006), -size * (0.08 - bar * 0.044))
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(251,191,36,0.88)'
    ctx.lineWidth = Math.max(2, size * 0.007)
    ctx.beginPath()
    ctx.moveTo(side * size * 0.18, -size * 0.52)
    ctx.lineTo(side * size * 0.42, -size * 0.66)
    ctx.lineTo(side * size * 0.32, -size * 0.32)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(side * size * 0.48, -size * 0.26)
    ctx.lineTo(side * size * 0.72, -size * 0.14)
    ctx.lineTo(side * size * 0.52, size * 0.06)
    ctx.stroke()
  }

  ctx.globalCompositeOperation = 'lighter'
  drawRadialEllipse(ctx, 0, size * 0.18, size * 0.16, size * 0.17, [
    [0, 'rgba(255,255,255,0.95)'],
    [0.25, 'rgba(125,249,255,0.9)'],
    [0.62, 'rgba(14,165,233,0.54)'],
    [1, 'rgba(14,165,233,0)'],
  ])
  for (let drone = 0; drone < 8; drone += 1) {
    const angle = drone / 8 * Math.PI * 2 + seconds * 0.34
    const dx = Math.cos(angle) * size * 0.78
    const dy = size * 0.08 + Math.sin(angle) * size * 0.5
    ctx.save()
    ctx.translate(dx, dy)
    ctx.rotate(angle)
    ctx.fillStyle = 'rgba(14,165,233,0.42)'
    ctx.strokeStyle = 'rgba(125,249,255,0.86)'
    ctx.beginPath()
    ctx.ellipse(0, 0, size * 0.052, size * 0.014, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }
  ctx.restore()
}
function drawReferenceSquidBossPaintPass(ctx: CanvasRenderingContext2D, size: number, time: number) {
  const seconds = time / 1000
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'

  ctx.strokeStyle = 'rgba(250,232,255,0.42)'
  ctx.lineWidth = Math.max(0.8, size * 0.0032)
  for (let row = 0; row < 9; row += 1) {
    const y = -size * 0.56 + row * size * 0.074
    const width = size * (0.042 + row * 0.014)
    ctx.beginPath()
    ctx.moveTo(-width, y)
    ctx.quadraticCurveTo(0, y + size * 0.026, width, y)
    ctx.stroke()
  }

  for (const side of [-1, 1]) {
    ctx.strokeStyle = 'rgba(244,114,182,0.52)'
    ctx.lineWidth = Math.max(1, size * 0.004)
    for (let rib = 0; rib < 8; rib += 1) {
      const y = -size * (0.38 - rib * 0.055)
      ctx.beginPath()
      ctx.moveTo(side * size * 0.07, y)
      ctx.lineTo(side * size * (0.19 + rib * 0.018), y + size * 0.035)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(190,242,100,0.35)'
    ctx.lineWidth = Math.max(0.8, size * 0.0028)
    for (let vein = 0; vein < 5; vein += 1) {
      ctx.beginPath()
      ctx.moveTo(side * size * 0.18, -size * (0.28 - vein * 0.055))
      ctx.quadraticCurveTo(side * size * 0.31, -size * (0.2 - vein * 0.042), side * size * 0.43, -size * (0.13 - vein * 0.03))
      ctx.stroke()
    }
  }

  ctx.globalCompositeOperation = 'lighter'
  const pulse = 0.65 + Math.sin(seconds * 3.4) * 0.18
  for (let i = 0; i < 38; i += 1) {
    const side = i % 2 === 0 ? -1 : 1
    const row = Math.floor(i / 2)
    const x = side * size * (0.055 + (row % 5) * 0.026)
    const y = -size * 0.46 + row * size * 0.035
    if (Math.abs(x) > size * (0.16 + row * 0.002) || y > size * 0.2) continue
    drawRadialEllipse(ctx, x, y, size * 0.012, size * 0.012, [
      [0, `rgba(255,255,255,${0.58 * pulse})`],
      [0.45, `rgba(163,230,53,${0.68 * pulse})`],
      [1, 'rgba(163,230,53,0)'],
    ])
  }

  ctx.strokeStyle = 'rgba(244,114,182,0.38)'
  ctx.lineWidth = Math.max(0.9, size * 0.003)
  for (const side of [-1, 1]) {
    for (let tentacle = 0; tentacle < 4; tentacle += 1) {
      const baseX = side * size * (0.03 + tentacle * 0.045)
      const startY = size * (0.23 + tentacle * 0.012)
      for (let sucker = 0; sucker < 6; sucker += 1) {
        const p = sucker / 5
        const x = baseX + side * Math.sin(p * Math.PI + tentacle) * size * 0.055 + side * p * size * (0.1 + tentacle * 0.025)
        const y = startY + p * size * (0.48 + tentacle * 0.08)
        ctx.beginPath()
        ctx.ellipse(x, y, size * 0.011, size * 0.006, side * 0.5, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  }
  ctx.restore()
}

function drawReferenceSnakeBossPaintPass(ctx: CanvasRenderingContext2D, size: number, time: number) {
  const seconds = time / 1000
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'

  ctx.strokeStyle = 'rgba(251,191,36,0.58)'
  ctx.lineWidth = Math.max(0.9, size * 0.0036)
  for (let plate = 0; plate < 22; plate += 1) {
    const p = plate / 21
    const angle = p * Math.PI * 3.25 + seconds * 0.05
    const radius = size * (0.29 - p * 0.11)
    const x = Math.sin(angle) * radius + Math.sin(p * Math.PI * 5 + seconds * 0.45) * size * 0.018
    const y = size * 0.58 - p * size * 0.9 + Math.cos(angle) * size * (0.075 - p * 0.02)
    ctx.beginPath()
    ctx.ellipse(x, y, size * (0.036 - p * 0.008), size * 0.012, angle, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.globalCompositeOperation = 'lighter'
  for (let node = 0; node < 18; node += 1) {
    const p = node / 17
    const angle = p * Math.PI * 3.25 + seconds * 0.05
    const radius = size * (0.3 - p * 0.12)
    const side = node % 2 === 0 ? -1 : 1
    const x = Math.sin(angle) * radius + side * size * 0.032
    const y = size * 0.58 - p * size * 0.9 + Math.cos(angle) * size * (0.075 - p * 0.02)
    drawRadialEllipse(ctx, x, y, size * 0.016, size * 0.016, [
      [0, 'rgba(255,255,255,0.82)'],
      [0.45, 'rgba(34,211,238,0.76)'],
      [1, 'rgba(34,211,238,0)'],
    ])
  }

  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = 'rgba(254,243,199,0.82)'
  ctx.strokeStyle = 'rgba(15,23,42,0.62)'
  ctx.lineWidth = Math.max(0.8, size * 0.003)
  for (let crown = 0; crown < 5; crown += 1) {
    const x = (crown - 2) * size * 0.04
    const y = -size * (0.46 - Math.abs(crown - 2) * 0.035)
    ctx.beginPath()
    ctx.moveTo(x, y - size * 0.035)
    ctx.lineTo(x + size * 0.026, y + size * 0.018)
    ctx.lineTo(x, y + size * 0.04)
    ctx.lineTo(x - size * 0.026, y + size * 0.018)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  ctx.strokeStyle = 'rgba(236,254,255,0.58)'
  ctx.lineWidth = Math.max(1, size * 0.004)
  ctx.beginPath()
  ctx.moveTo(-size * 0.16, -size * 0.34)
  ctx.quadraticCurveTo(-size * 0.3, -size * 0.13, -size * 0.12, size * 0.08)
  ctx.moveTo(size * 0.16, -size * 0.34)
  ctx.quadraticCurveTo(size * 0.3, -size * 0.13, size * 0.12, size * 0.08)
  ctx.stroke()
  ctx.restore()
}

function drawReferenceDreadshipBossPaintPass(ctx: CanvasRenderingContext2D, size: number, time: number) {
  const seconds = time / 1000
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'

  const shards = [
    [-0.09, -0.55, -0.02, -0.49, -0.07, -0.37], [0.09, -0.55, 0.02, -0.49, 0.07, -0.37],
    [-0.16, -0.34, -0.05, -0.27, -0.14, -0.12], [0.16, -0.34, 0.05, -0.27, 0.14, -0.12],
    [-0.2, -0.06, -0.08, 0.02, -0.18, 0.18], [0.2, -0.06, 0.08, 0.02, 0.18, 0.18],
    [-0.13, 0.24, -0.02, 0.31, -0.1, 0.48], [0.13, 0.24, 0.02, 0.31, 0.1, 0.48],
  ] as const
  ctx.strokeStyle = 'rgba(254,243,199,0.76)'
  ctx.lineWidth = Math.max(0.85, size * 0.0034)
  for (const [x1, y1, x2, y2, x3, y3] of shards) {
    const grad = ctx.createLinearGradient(x1 * size, y1 * size, x3 * size, y3 * size)
    grad.addColorStop(0, '#fff7ad')
    grad.addColorStop(0.42, '#b45309')
    grad.addColorStop(1, '#1c1008')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(x1 * size, y1 * size)
    ctx.lineTo(x2 * size, y2 * size)
    ctx.lineTo(x3 * size, y3 * size)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  ctx.globalCompositeOperation = 'lighter'
  const pulse = 0.72 + Math.sin(seconds * 4.2) * 0.2
  for (const side of [-1, 1]) {
    for (let light = 0; light < 9; light += 1) {
      drawRadialEllipse(ctx, side * size * (0.25 + (light % 3) * 0.07), -size * (0.36 - light * 0.086), size * 0.015, size * 0.026, [
        [0, `rgba(255,255,255,${0.8 * pulse})`],
        [0.42, `rgba(34,211,238,${0.72 * pulse})`],
        [1, 'rgba(34,211,238,0)'],
      ])
    }
  }

  ctx.strokeStyle = 'rgba(255,247,173,0.42)'
  ctx.lineWidth = Math.max(0.8, size * 0.003)
  ctx.globalCompositeOperation = 'source-over'
  for (let seam = 0; seam < 12; seam += 1) {
    const y = -size * 0.57 + seam * size * 0.092
    ctx.beginPath()
    ctx.moveTo(-size * (0.05 + seam * 0.006), y)
    ctx.lineTo(0, y + size * 0.035)
    ctx.lineTo(size * (0.05 + seam * 0.006), y)
    ctx.stroke()
  }
  ctx.restore()
}
function drawGalacticSquidBoss(ctx: CanvasRenderingContext2D, size: number, time: number) {
  const seconds = time / 1000
  ctx.save()

  drawRadialEllipse(ctx, 0, size * 0.08, size * 0.62, size * 0.9, [
    [0, 'rgba(168,85,247,0.1)'],
    [0.48, 'rgba(88,28,135,0.08)'],
    [1, 'rgba(0,0,0,0)'],
  ])
  drawBossDust(ctx, size, 'rgba(217,70,239,ALPHA)', 26, 3.7, 0.74, 0.92)

  const drawSegmentedTentacle = (baseX: number, baseY: number, tipX: number, tipY: number, side: number, phase: number, thick: number, bulb = false) => {
    const sway = Math.sin(seconds * 2.1 + phase) * size * 0.055
    const c1x = baseX + side * size * (0.18 + Math.abs(baseX) * 0.12)
    const c1y = baseY + size * 0.22
    const c2x = tipX - side * size * 0.18 + sway
    const c2y = tipY - size * 0.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = 'rgba(56,12,78,0.98)'
    ctx.lineWidth = Math.max(7, size * thick)
    ctx.beginPath()
    ctx.moveTo(baseX, baseY)
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, tipX + sway, tipY)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(201,52,190,0.58)'
    ctx.lineWidth = Math.max(2, size * thick * 0.28)
    ctx.beginPath()
    ctx.moveTo(baseX, baseY)
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, tipX + sway, tipY)
    ctx.stroke()
    for (let ring = 1; ring <= 9; ring += 1) {
      const p = ring / 10
      const inv = 1 - p
      const x = inv * inv * inv * baseX + 3 * inv * inv * p * c1x + 3 * inv * p * p * c2x + p * p * p * (tipX + sway)
      const y = inv * inv * inv * baseY + 3 * inv * inv * p * c1y + 3 * inv * p * p * c2y + p * p * p * tipY
      ctx.strokeStyle = ring % 2 === 0 ? 'rgba(244,114,182,0.45)' : 'rgba(147,51,234,0.42)'
      ctx.lineWidth = Math.max(1, size * 0.005)
      ctx.beginPath()
      ctx.arc(x, y, size * thick * (0.34 - p * 0.12), 0, Math.PI * 2)
      ctx.stroke()
    }
    if (bulb) {
      drawRadialEllipse(ctx, tipX + sway, tipY, size * 0.08, size * 0.07, [
        [0, 'rgba(255,255,255,0.94)'],
        [0.25, 'rgba(244,114,182,0.88)'],
        [0.65, 'rgba(190,24,93,0.48)'],
        [1, 'rgba(190,24,93,0)'],
      ])
    }
  }

  const longTentacles = [
    [-0.28, 0.1, -0.72, 0.84, -1, 0.8, 0.036, true],
    [0.28, 0.1, 0.72, 0.84, 1, 1.2, 0.036, true],
    [-0.2, 0.14, -0.44, 0.96, -1, 1.7, 0.028, false],
    [0.2, 0.14, 0.44, 0.96, 1, 2.2, 0.028, false],
    [-0.1, 0.16, -0.2, 1.06, -1, 2.8, 0.024, true],
    [0.1, 0.16, 0.2, 1.06, 1, 3.2, 0.024, true],
    [-0.02, 0.17, -0.08, 0.92, -1, 3.7, 0.022, false],
    [0.02, 0.17, 0.08, 0.92, 1, 4.1, 0.022, false],
  ] as const
  for (const [baseX, baseY, tipX, tipY, side, phase, thick, bulb] of longTentacles) {
    drawSegmentedTentacle(baseX * size, baseY * size, tipX * size, tipY * size, side, phase, thick, bulb)
  }

  for (const side of [-1, 1]) {
    ctx.fillStyle = 'rgba(51,12,75,0.92)'
    ctx.strokeStyle = 'rgba(168,85,247,0.72)'
    ctx.lineWidth = Math.max(1.5, size * 0.006)
    ctx.beginPath()
    ctx.moveTo(side * size * 0.17, -size * 0.34)
    ctx.bezierCurveTo(side * size * 0.4, -size * 0.3, side * size * 0.54, -size * 0.06, side * size * 0.38, size * 0.06)
    ctx.lineTo(side * size * 0.21, size * 0.02)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    for (let rib = 0; rib < 5; rib += 1) {
      ctx.strokeStyle = 'rgba(190,242,100,0.22)'
      ctx.beginPath()
      ctx.moveTo(side * size * 0.2, -size * (0.26 - rib * 0.052))
      ctx.lineTo(side * size * (0.42 - rib * 0.032), -size * (0.18 - rib * 0.035))
      ctx.stroke()
    }
  }

  const mantleGradient = ctx.createRadialGradient(-size * 0.1, -size * 0.3, size * 0.02, 0, -size * 0.08, size * 0.52)
  mantleGradient.addColorStop(0, '#d9f99d')
  mantleGradient.addColorStop(0.16, '#a21caf')
  mantleGradient.addColorStop(0.43, '#5b21b6')
  mantleGradient.addColorStop(0.72, '#2e1065')
  mantleGradient.addColorStop(1, '#070312')
  ctx.fillStyle = mantleGradient
  ctx.strokeStyle = 'rgba(216,180,254,0.82)'
  ctx.lineWidth = Math.max(2, size * 0.012)
  ctx.shadowColor = 'rgba(0,0,0,0.68)'
  ctx.shadowBlur = size * 0.03
  ctx.beginPath()
  ctx.moveTo(0, -size * 0.62)
  ctx.bezierCurveTo(size * 0.32, -size * 0.48, size * 0.34, -size * 0.16, size * 0.2, size * 0.2)
  ctx.bezierCurveTo(size * 0.1, size * 0.36, -size * 0.1, size * 0.36, -size * 0.2, size * 0.2)
  ctx.bezierCurveTo(-size * 0.34, -size * 0.16, -size * 0.32, -size * 0.48, 0, -size * 0.62)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.shadowBlur = 0

  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = 'rgba(244,114,182,0.42)'
  ctx.lineWidth = Math.max(1, size * 0.005)
  for (let rib = 0; rib < 10; rib += 1) {
    const y = -size * 0.49 + rib * size * 0.066
    ctx.beginPath()
    ctx.ellipse(0, y, size * (0.055 + rib * 0.018), size * 0.016, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(216,180,254,0.5)'
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(0, -size * 0.58)
    ctx.bezierCurveTo(side * size * 0.1, -size * 0.36, side * size * 0.16, -size * 0.1, side * size * 0.11, size * 0.23)
    ctx.stroke()
  }
  drawEtchedPanelLine(ctx, [[0, -0.6], [-0.04, -0.42], [-0.025, -0.2], [-0.05, 0.08], [-0.02, 0.24]], size, 'rgba(250,232,255,0.32)', 0.0045)
  drawEtchedPanelLine(ctx, [[0, -0.6], [0.04, -0.42], [0.025, -0.2], [0.05, 0.08], [0.02, 0.24]], size, 'rgba(250,232,255,0.32)', 0.0045)
  drawEtchedPanelLine(ctx, [[-0.16, -0.38], [-0.07, -0.32], [-0.13, -0.18], [-0.06, -0.06], [-0.12, 0.08]], size, 'rgba(15,23,42,0.65)', 0.006)
  drawEtchedPanelLine(ctx, [[0.16, -0.38], [0.07, -0.32], [0.13, -0.18], [0.06, -0.06], [0.12, 0.08]], size, 'rgba(15,23,42,0.65)', 0.006)

  ctx.fillStyle = '#020617'
  ctx.beginPath()
  ctx.ellipse(0, -size * 0.08, size * 0.15, size * 0.22, 0, 0, Math.PI * 2)
  ctx.fill()
  const eyePulse = 0.8 + Math.sin(seconds * 4.4) * 0.12
  drawRadialEllipse(ctx, 0, -size * 0.08, size * 0.105, size * 0.185, [
    [0, `rgba(255,255,255,${0.9 * eyePulse})`],
    [0.22, `rgba(254,240,138,${0.9 * eyePulse})`],
    [0.58, `rgba(249,115,22,${0.84 * eyePulse})`],
    [1, 'rgba(127,29,29,0.18)'],
  ])
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.lineWidth = Math.max(1.5, size * 0.009)
  ctx.beginPath()
  ctx.ellipse(0, -size * 0.08, size * 0.11, size * 0.19, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(30,10,10,0.8)'
  ctx.lineWidth = Math.max(2, size * 0.012)
  ctx.beginPath()
  ctx.moveTo(0, -size * 0.22)
  ctx.lineTo(0, size * 0.06)
  ctx.stroke()

  ctx.fillStyle = 'rgba(163,230,53,0.72)'
  for (let i = 0; i < 88; i += 1) {
    const a = i * 2.399
    const r = size * (0.04 + (i % 14) * 0.014)
    const x = Math.cos(a) * r
    const y = -size * 0.28 + Math.sin(a) * r * 1.4 + (i % 7) * size * 0.033
    if (Math.abs(x) > size * 0.19 || y > size * 0.22) continue
    ctx.beginPath()
    ctx.arc(x, y, Math.max(0.9, size * 0.0045), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = Math.max(0.7, size * 0.0028)
  for (let scratch = 0; scratch < 22; scratch += 1) {
    const side = scratch % 2 === 0 ? -1 : 1
    const y = -size * (0.48 - scratch * 0.027)
    const x = side * size * (0.05 + (scratch % 5) * 0.025)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + side * size * (0.025 + (scratch % 3) * 0.01), y + size * 0.025)
    ctx.stroke()
  }
  drawReferenceSquidBossDetails(ctx, size, time)
  drawReferenceSquidBossFinishPass(ctx, size, time)
  drawReferenceSquidBossPaintPass(ctx, size, time)
  ctx.restore()
}

function drawSquidWhipStrike(ctx: CanvasRenderingContext2D, x: number, y: number, targetX: number, size: number, time: number, chargeTimer: number) {
  const warm = clamp(1 - chargeTimer / 0.62, 0, 1)
  const side = targetX < x ? -1 : 1
  const baseX = x + side * size * 0.24
  const baseY = y + size * 0.08
  const tipY = y + size * (0.34 + warm * 0.22)
  const tipX = targetX + Math.sin(time / 90) * size * 0.03
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = `rgba(251,113,133,${0.2 + warm * 0.5})`
  ctx.lineWidth = Math.max(10, size * (0.035 + warm * 0.025))
  ctx.beginPath()
  ctx.moveTo(baseX, baseY)
  ctx.bezierCurveTo(x + side * size * 0.55, y + size * 0.2, tipX - side * size * 0.28, y + size * 0.45, tipX, tipY)
  ctx.stroke()
  ctx.strokeStyle = `rgba(255,255,255,${0.22 + warm * 0.45})`
  ctx.lineWidth = Math.max(2, size * 0.012)
  ctx.beginPath()
  ctx.moveTo(baseX, baseY)
  ctx.bezierCurveTo(x + side * size * 0.48, y + size * 0.24, tipX - side * size * 0.2, y + size * 0.5, tipX, tipY)
  ctx.stroke()
  drawRadialEllipse(ctx, tipX, tipY, size * 0.055, size * 0.035, [
    [0, 'rgba(255,255,255,0.85)'],
    [0.4, 'rgba(251,113,133,0.6)'],
    [1, 'rgba(251,113,133,0)'],
  ])
  ctx.restore()
}

function drawGalacticSnakeBoss(ctx: CanvasRenderingContext2D, size: number, time: number) {
  const seconds = time / 1000
  ctx.save()

  drawRadialEllipse(ctx, 0, size * 0.03, size * 0.64, size * 0.88, [
    [0, 'rgba(14,165,233,0.09)'],
    [0.42, 'rgba(30,64,175,0.07)'],
    [1, 'rgba(0,0,0,0)'],
  ])
  drawBossDust(ctx, size, 'rgba(34,211,238,ALPHA)', 34, 8.2, 0.68, 0.96)

  const bodyPoints: Vec[] = []
  for (let i = 0; i < 70; i += 1) {
    const p = i / 69
    const angle = p * Math.PI * 3.3 + seconds * 0.1
    const radius = size * (0.32 - p * 0.12)
    bodyPoints.push({
      x: Math.sin(angle) * radius + Math.sin(p * Math.PI * 5 + seconds * 0.5) * size * 0.025,
      y: size * 0.58 - p * size * 0.92 + Math.cos(angle) * size * (0.08 - p * 0.02),
    })
  }

  for (let i = 0; i < bodyPoints.length - 1; i += 1) {
    const point = bodyPoints[i]
    const next = bodyPoints[i + 1]
    const p = i / (bodyPoints.length - 1)
    const angle = Math.atan2(next.y - point.y, next.x - point.x)
    const segmentSize = size * (0.092 - p * 0.034)
    const scale = 1 + Math.sin(seconds * 2.1 + i * 0.4) * 0.06
    const gradient = ctx.createRadialGradient(point.x - segmentSize * 0.28, point.y - segmentSize * 0.35, 1, point.x, point.y, segmentSize * 1.25)
    gradient.addColorStop(0, '#fde68a')
    gradient.addColorStop(0.2, '#94a3b8')
    gradient.addColorStop(0.5, '#334155')
    gradient.addColorStop(0.82, '#111827')
    gradient.addColorStop(1, '#020617')
    ctx.fillStyle = gradient
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(251,191,36,0.42)' : 'rgba(148,163,184,0.28)'
    ctx.lineWidth = Math.max(0.9, size * 0.0038)
    ctx.beginPath()
    ctx.ellipse(point.x, point.y, segmentSize * 1.12 * scale, segmentSize * 0.66 * scale, angle + Math.PI / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    if (i % 2 === 0) {
      ctx.strokeStyle = 'rgba(226,232,240,0.48)'
      ctx.beginPath()
      ctx.ellipse(point.x, point.y, segmentSize * 0.44, segmentSize * 0.26, angle + Math.PI / 2, 0, Math.PI * 2)
      ctx.stroke()
    }
    if (i % 5 === 0) {
      drawRadialEllipse(ctx, point.x + Math.cos(angle + Math.PI / 2) * segmentSize * 0.48, point.y + Math.sin(angle + Math.PI / 2) * segmentSize * 0.48, segmentSize * 0.18, segmentSize * 0.18, [
        [0, 'rgba(255,255,255,0.7)'],
        [0.34, 'rgba(34,211,238,0.7)'],
        [1, 'rgba(34,211,238,0)'],
      ])
    }
    if (i % 4 === 1) {
      ctx.strokeStyle = 'rgba(2,6,23,0.52)'
      ctx.lineWidth = Math.max(0.8, size * 0.003)
      ctx.beginPath()
      ctx.moveTo(point.x - Math.cos(angle) * segmentSize * 0.45, point.y - Math.sin(angle) * segmentSize * 0.45)
      ctx.lineTo(point.x + Math.cos(angle) * segmentSize * 0.45, point.y + Math.sin(angle) * segmentSize * 0.45)
      ctx.stroke()
    }
  }

  ctx.strokeStyle = 'rgba(34,211,238,0.2)'
  ctx.lineWidth = Math.max(1, size * 0.004)
  for (let i = 8; i < 58; i += 5) {
    const point = bodyPoints[i]
    ctx.beginPath()
    ctx.arc(point.x, point.y, size * 0.032, 0, Math.PI * 2)
    ctx.stroke()
  }

  for (const side of [-1, 1]) {
    const hood = ctx.createLinearGradient(side * size * 0.02, -size * 0.42, side * size * 0.42, size * 0.02)
    hood.addColorStop(0, '#fef3c7')
    hood.addColorStop(0.34, '#6b7280')
    hood.addColorStop(0.7, '#172033')
    hood.addColorStop(1, '#020617')
    ctx.fillStyle = hood
    ctx.strokeStyle = 'rgba(254,243,199,0.64)'
    ctx.lineWidth = Math.max(1.8, size * 0.007)
    ctx.beginPath()
    ctx.moveTo(side * size * 0.07, -size * 0.39)
    ctx.bezierCurveTo(side * size * 0.42, -size * 0.34, side * size * 0.46, -size * 0.05, side * size * 0.24, size * 0.13)
    ctx.lineTo(side * size * 0.08, size * 0.04)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = 'rgba(0,0,0,0.38)'
    ctx.beginPath()
    ctx.moveTo(side * size * 0.08, -size * 0.33)
    ctx.lineTo(side * size * 0.24, -size * 0.2)
    ctx.lineTo(side * size * 0.1, size * 0.02)
    ctx.closePath()
    ctx.fill()
    for (let rib = 0; rib < 6; rib += 1) {
      ctx.strokeStyle = 'rgba(34,211,238,0.26)'
      ctx.beginPath()
      ctx.moveTo(side * size * (0.1 + rib * 0.035), -size * (0.31 - rib * 0.04))
      ctx.lineTo(side * size * (0.33 - rib * 0.018), -size * (0.18 - rib * 0.038))
      ctx.stroke()
    }
  }

  const hoodGradient = ctx.createRadialGradient(-size * 0.04, -size * 0.36, 1, 0, -size * 0.2, size * 0.34)
  hoodGradient.addColorStop(0, '#fff7ad')
  hoodGradient.addColorStop(0.26, '#a3a3a3')
  hoodGradient.addColorStop(0.58, '#1f2937')
  hoodGradient.addColorStop(1, '#030712')
  ctx.fillStyle = hoodGradient
  ctx.strokeStyle = 'rgba(254,243,199,0.86)'
  ctx.lineWidth = Math.max(2, size * 0.011)
  ctx.shadowColor = 'rgba(0,0,0,0.76)'
  ctx.shadowBlur = size * 0.024
  ctx.beginPath()
  ctx.moveTo(0, -size * 0.52)
  ctx.bezierCurveTo(size * 0.2, -size * 0.47, size * 0.24, -size * 0.22, size * 0.12, size * 0.08)
  ctx.bezierCurveTo(size * 0.06, size * 0.2, -size * 0.06, size * 0.2, -size * 0.12, size * 0.08)
  ctx.bezierCurveTo(-size * 0.24, -size * 0.22, -size * 0.2, -size * 0.47, 0, -size * 0.52)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.shadowBlur = 0

  ctx.fillStyle = 'rgba(2,6,23,0.72)'
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(side * size * 0.06, -size * 0.35)
    ctx.lineTo(side * size * 0.19, -size * 0.22)
    ctx.lineTo(side * size * 0.08, -size * 0.04)
    ctx.closePath()
    ctx.fill()
  }

  for (let row = 0; row < 10; row += 1) {
    const y = -size * 0.4 + row * size * 0.045
    const count = 1 + Math.min(row + 1, 5)
    for (let i = 0; i < count; i += 1) {
      const x = (i - (count - 1) / 2) * size * 0.042
      ctx.strokeStyle = row % 2 === 0 ? 'rgba(254,243,199,0.58)' : 'rgba(34,211,238,0.35)'
      ctx.lineWidth = Math.max(0.8, size * 0.0035)
      ctx.beginPath()
      ctx.ellipse(x, y, size * 0.019, size * 0.014, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  drawEtchedPanelLine(ctx, [[0, -0.5], [-0.04, -0.39], [0.03, -0.28], [-0.02, -0.16], [0.04, -0.04]], size, 'rgba(254,243,199,0.35)', 0.004)
  drawEtchedPanelLine(ctx, [[0, -0.5], [0.04, -0.39], [-0.03, -0.28], [0.02, -0.16], [-0.04, -0.04]], size, 'rgba(2,6,23,0.55)', 0.0045)
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'
  ctx.lineWidth = Math.max(0.7, size * 0.0027)
  for (let scratch = 0; scratch < 20; scratch += 1) {
    const side = scratch % 2 === 0 ? -1 : 1
    const y = -size * (0.38 - scratch * 0.018)
    const x = side * size * (0.04 + (scratch % 6) * 0.022)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + side * size * 0.025, y + size * 0.018)
    ctx.stroke()
  }

  ctx.globalCompositeOperation = 'lighter'
  for (const side of [-1, 1]) {
    drawRadialEllipse(ctx, side * size * 0.07, -size * 0.16, size * 0.048, size * 0.052, [
      [0, 'rgba(255,255,255,0.95)'],
      [0.3, 'rgba(251,191,36,0.95)'],
      [0.62, 'rgba(249,115,22,0.62)'],
      [1, 'rgba(249,115,22,0)'],
    ])
    ctx.fillStyle = '#0f172a'
    ctx.beginPath()
    ctx.ellipse(side * size * 0.07, -size * 0.16, size * 0.009, size * 0.026, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.strokeStyle = 'rgba(254,243,199,0.75)'
  ctx.lineWidth = Math.max(1.5, size * 0.008)
  ctx.beginPath()
  ctx.moveTo(-size * 0.05, size * 0.05)
  ctx.quadraticCurveTo(-size * 0.04, size * 0.16, -size * 0.12, size * 0.26)
  ctx.moveTo(size * 0.05, size * 0.05)
  ctx.quadraticCurveTo(size * 0.04, size * 0.16, size * 0.12, size * 0.26)
  ctx.moveTo(-size * 0.035, size * 0.04)
  ctx.lineTo(-size * 0.07, size * 0.16)
  ctx.moveTo(size * 0.035, size * 0.04)
  ctx.lineTo(size * 0.07, size * 0.16)
  ctx.stroke()
  drawReferenceSnakeBossDetails(ctx, size, time)
  drawReferenceSnakeBossFinishPass(ctx, size, time)
  drawReferenceSnakeBossPaintPass(ctx, size, time)
  ctx.restore()
}

function drawInterstellarDreadshipBoss(ctx: CanvasRenderingContext2D, size: number, time: number) {
  const seconds = time / 1000
  ctx.save()

  drawRadialEllipse(ctx, 0, size * 0.04, size * 0.72, size * 0.9, [
    [0, 'rgba(14,165,233,0.11)'],
    [0.34, 'rgba(180,83,9,0.08)'],
    [1, 'rgba(0,0,0,0)'],
  ])
  drawBossDust(ctx, size, 'rgba(56,189,248,ALPHA)', 30, 13.4, 0.86, 0.94)

  const bronze = ctx.createLinearGradient(0, -size * 0.42, 0, size * 0.48)
  bronze.addColorStop(0, '#fff7ad')
  bronze.addColorStop(0.18, '#c47b16')
  bronze.addColorStop(0.52, '#5b2f0d')
  bronze.addColorStop(0.82, '#1e1410')
  bronze.addColorStop(1, '#07080d')

  const darkBronze = ctx.createLinearGradient(0, -size * 0.34, 0, size * 0.36)
  darkBronze.addColorStop(0, '#8a4f14')
  darkBronze.addColorStop(0.55, '#2f1a0b')
  darkBronze.addColorStop(1, '#09080b')

  ctx.fillStyle = 'rgba(36,20,10,0.98)'
  ctx.strokeStyle = 'rgba(253,230,138,0.82)'
  ctx.lineWidth = Math.max(2.2, size * 0.009)
  ctx.shadowColor = 'rgba(0,0,0,0.8)'
  ctx.shadowBlur = size * 0.026
  ctx.beginPath()
  ctx.moveTo(0, -size * 0.68)
  ctx.lineTo(size * 0.12, -size * 0.45)
  ctx.lineTo(size * 0.28, -size * 0.53)
  ctx.lineTo(size * 0.47, -size * 0.38)
  ctx.lineTo(size * 0.35, -size * 0.2)
  ctx.lineTo(size * 0.66, -size * 0.09)
  ctx.lineTo(size * 0.5, size * 0.14)
  ctx.lineTo(size * 0.32, size * 0.16)
  ctx.lineTo(size * 0.38, size * 0.36)
  ctx.lineTo(size * 0.2, size * 0.56)
  ctx.lineTo(size * 0.08, size * 0.5)
  ctx.lineTo(0, size * 0.68)
  ctx.lineTo(-size * 0.08, size * 0.5)
  ctx.lineTo(-size * 0.2, size * 0.56)
  ctx.lineTo(-size * 0.38, size * 0.36)
  ctx.lineTo(-size * 0.32, size * 0.16)
  ctx.lineTo(-size * 0.5, size * 0.14)
  ctx.lineTo(-size * 0.66, -size * 0.09)
  ctx.lineTo(-size * 0.35, -size * 0.2)
  ctx.lineTo(-size * 0.47, -size * 0.38)
  ctx.lineTo(-size * 0.28, -size * 0.53)
  ctx.lineTo(-size * 0.12, -size * 0.45)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.shadowBlur = 0

  for (const side of [-1, 1]) {
    ctx.fillStyle = darkBronze
    ctx.strokeStyle = 'rgba(251,191,36,0.62)'
    ctx.beginPath()
    ctx.moveTo(side * size * 0.16, -size * 0.42)
    ctx.lineTo(side * size * 0.38, -size * 0.5)
    ctx.lineTo(side * size * 0.26, -size * 0.2)
    ctx.lineTo(side * size * 0.48, -size * 0.08)
    ctx.lineTo(side * size * 0.25, size * 0.07)
    ctx.lineTo(side * size * 0.13, -size * 0.06)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.beginPath()
    ctx.moveTo(side * size * 0.17, -size * 0.28)
    ctx.lineTo(side * size * 0.31, -size * 0.21)
    ctx.lineTo(side * size * 0.18, size * 0.06)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(side * size * 0.2, size * 0.1)
    ctx.lineTo(side * size * 0.44, size * 0.2)
    ctx.lineTo(side * size * 0.26, size * 0.42)
    ctx.lineTo(side * size * 0.1, size * 0.36)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  ctx.fillStyle = bronze
  ctx.strokeStyle = 'rgba(254,243,199,0.9)'
  ctx.lineWidth = Math.max(2, size * 0.0085)
  ctx.beginPath()
  ctx.moveTo(0, -size * 0.64)
  ctx.lineTo(size * 0.14, -size * 0.2)
  ctx.lineTo(size * 0.17, size * 0.35)
  ctx.lineTo(0, size * 0.62)
  ctx.lineTo(-size * 0.17, size * 0.35)
  ctx.lineTo(-size * 0.14, -size * 0.2)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = 'rgba(255,247,173,0.9)'
  ctx.strokeStyle = 'rgba(17,24,39,0.42)'
  ctx.lineWidth = Math.max(1, size * 0.004)
  for (let plate = 0; plate < 9; plate += 1) {
    const y = -size * 0.5 + plate * size * 0.105
    const w = size * (0.08 + plate * 0.012)
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y + size * 0.05)
    ctx.lineTo(0, y + size * 0.095)
    ctx.lineTo(-w, y + size * 0.05)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(17,24,39,0.58)'
  ctx.lineWidth = Math.max(0.8, size * 0.0032)
  for (let plate = 0; plate < 12; plate += 1) {
    const y = -size * 0.56 + plate * size * 0.082
    drawEtchedPanelLine(ctx, [[-0.08, y / size], [0, y / size + 0.035], [0.08, y / size]], size, 'rgba(17,24,39,0.58)', 0.0032)
  }

  ctx.globalCompositeOperation = 'lighter'
  const corePulse = 0.78 + Math.sin(seconds * 3.8) * 0.18
  for (const side of [-1, 1]) {
    const panelX = side * size * 0.34
    ctx.fillStyle = `rgba(34,211,238,${0.28 + corePulse * 0.22})`
    ctx.strokeStyle = 'rgba(125,249,255,0.72)'
    ctx.lineWidth = Math.max(1.5, size * 0.006)
    ctx.beginPath()
    ctx.moveTo(panelX - side * size * 0.1, -size * 0.2)
    ctx.lineTo(panelX + side * size * 0.15, -size * 0.1)
    ctx.lineTo(panelX + side * size * 0.11, size * 0.17)
    ctx.lineTo(panelX - side * size * 0.13, size * 0.22)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    for (let i = 0; i < 7; i += 1) {
      ctx.beginPath()
      ctx.moveTo(panelX - side * size * 0.07, -size * (0.15 - i * 0.05))
      ctx.lineTo(panelX + side * size * (0.1 - i * 0.011), -size * (0.1 - i * 0.04))
      ctx.stroke()
    }
    for (let pod = 0; pod < 4; pod += 1) {
      const podY = -size * 0.46 + pod * size * 0.24
      drawRadialEllipse(ctx, side * size * (0.62 + pod * 0.03), podY, size * 0.045, size * 0.018, [
        [0, 'rgba(255,255,255,0.9)'],
        [0.34, 'rgba(125,249,255,0.7)'],
        [1, 'rgba(125,249,255,0)'],
      ])
      ctx.strokeStyle = 'rgba(34,211,238,0.7)'
      ctx.beginPath()
      ctx.ellipse(side * size * (0.62 + pod * 0.03), podY, size * 0.08, size * 0.026, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    drawRadialEllipse(ctx, side * size * 0.27, size * 0.46, size * 0.045, size * 0.09, [
      [0, 'rgba(255,255,255,0.9)'],
      [0.34, 'rgba(125,249,255,0.7)'],
      [1, 'rgba(125,249,255,0)'],
    ])
  }
  drawRadialEllipse(ctx, 0, size * 0.23, size * 0.17, size * 0.18, [
    [0, `rgba(255,255,255,${0.9 * corePulse})`],
    [0.3, `rgba(34,211,238,${0.78 * corePulse})`],
    [0.62, 'rgba(14,165,233,0.46)'],
    [1, 'rgba(34,211,238,0)'],
  ])

  ctx.fillStyle = 'rgba(125,249,255,0.38)'
  ctx.strokeStyle = 'rgba(125,249,255,0.56)'
  ctx.lineWidth = Math.max(1, size * 0.004)
  for (let i = 0; i < 8; i += 1) {
    const y = -size * 0.46 + i * size * 0.1
    ctx.beginPath()
    ctx.ellipse(0, y, size * (0.032 + i * 0.006), size * 0.014, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'
  ctx.lineWidth = Math.max(0.7, size * 0.0026)
  for (let scratch = 0; scratch < 30; scratch += 1) {
    const side = scratch % 2 === 0 ? -1 : 1
    const y = -size * (0.54 - scratch * 0.036)
    const x = side * size * (0.07 + (scratch % 8) * 0.027)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + side * size * 0.026, y + size * 0.026)
    ctx.stroke()
  }

  ctx.strokeStyle = 'rgba(253,230,138,0.5)'
  ctx.lineWidth = Math.max(1, size * 0.004)
  ctx.globalCompositeOperation = 'source-over'
  for (const side of [-1, 1]) {
    for (let rib = 0; rib < 10; rib += 1) {
      ctx.beginPath()
      ctx.moveTo(side * size * 0.13, -size * (0.5 - rib * 0.085))
      ctx.lineTo(side * size * (0.48 - rib * 0.032), -size * (0.42 - rib * 0.068))
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(10,10,12,0.58)'
    for (let seam = 0; seam < 6; seam += 1) {
      ctx.beginPath()
      ctx.moveTo(side * size * (0.22 + seam * 0.055), -size * 0.36)
      ctx.lineTo(side * size * (0.14 + seam * 0.04), size * 0.24)
      ctx.stroke()
    }
  }

  ctx.globalCompositeOperation = 'lighter'
  drawRadialEllipse(ctx, 0, size * 0.66, size * 0.08, size * 0.32, [
    [0, 'rgba(255,255,255,0.42)'],
    [0.22, 'rgba(34,211,238,0.5)'],
    [1, 'rgba(34,211,238,0)'],
  ])
  ctx.fillStyle = 'rgba(56,189,248,0.52)'
  for (let burst = 0; burst < 10; burst += 1) {
    const angle = burst / 10 * Math.PI * 2 + seconds * 0.5
    ctx.beginPath()
    ctx.ellipse(Math.cos(angle) * size * 0.72, size * 0.58 + Math.sin(angle) * size * 0.08, size * 0.035, size * 0.01, angle, 0, Math.PI * 2)
    ctx.fill()
  }
  drawReferenceDreadshipBossDetails(ctx, size, time)
  drawReferenceDreadshipBossFinishPass(ctx, size, time)
  drawReferenceDreadshipBossPaintPass(ctx, size, time)
  ctx.restore()
}

function drawRaidEnemy(
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
  const size = getEnemyCanvasSize(enemy, viewportWidth)

  if (enemy.isBoss) {
    const floatScale = 1 + Math.sin(time / 1100) * 0.03
    const rotation = Math.sin(time / 1100) * 0.5 * DEG
    drawBossAura(ctx, enemy, x, y, size, time)
    if (enemy.bossKind === 'squid' || enemy.bossKind === 'snake' || enemy.bossKind === 'final') {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(enemy.bossKind === 'snake' ? Math.sin(time / 850 + enemy.phase) * 0.08 : rotation * 0.45)
      ctx.scale(floatScale, floatScale)
      if (enemy.bossKind === 'squid') drawGalacticSquidBoss(ctx, size, time)
      else if (enemy.bossKind === 'snake') drawGalacticSnakeBoss(ctx, size, time)
      else drawInterstellarDreadshipBoss(ctx, size, time)
      ctx.restore()
      if (enemy.bossKind === 'squid' && enemy.chargeTimer > 0) {
        drawSquidWhipStrike(ctx, x, y, toX(enemy.chargeLane), size, time, enemy.chargeTimer)
      }
      if (enemy.shieldTime > 0 || enemy.y < 15) drawBossShield(ctx, x, y, size, time)
      drawBossReticle(ctx, x, y, size, time, enemy.bossKind === 'final')
      drawBossBar(ctx, enemy, x, y, size)
      return
    }
    const sprite = getEnemyCanvasSprite(enemy)
    const bossFilter = enemy.bossKind === 'super'
        ? 'brightness(1.12) contrast(1.16) saturate(1.32)'
        : 'brightness(1.16) contrast(1.16) saturate(1.32)'
    drawCanvasSprite(ctx, sprite, x, y, size, bossFilter, 1, rotation, floatScale, enemy.color)
    if (enemy.shieldTime > 0 || enemy.y < 15) drawBossShield(ctx, x, y, size, time)
    drawBossReticle(ctx, x, y, size, time, false)
    drawBossBar(ctx, enemy, x, y, size)
    return
  }

  if (enemy.isMiniBoss) {
    const sprite = getEnemyCanvasSprite(enemy)
    const floatScale = 1 + Math.sin(time / 760 + enemy.phase) * 0.035
    const rotation = Math.sin(time / 900 + enemy.phase) * 1.4 * DEG
    drawSpriteGlow(ctx, x, y, size, 'rgba(168,85,247,0.36)', 1)
    drawCanvasSprite(ctx, sprite, x, y, size, 'brightness(1.18) contrast(1.2) saturate(1.45)', 1, rotation, floatScale, enemy.color)
    if (enemy.shieldTime > 0 || enemy.y < 8) drawBossShield(ctx, x, y, size * 0.78, time)
    drawBossBar(ctx, enemy, x, y, size * 0.82)
    return
  }

  const sprite = getEnemyCanvasSprite(enemy)
  drawSpriteGlow(ctx, x, y, size, 'rgba(239,35,60,0.34)', 1)
  drawCanvasSprite(ctx, sprite, x, y, size, normalEnemyFilter, 1, 0, 1, enemy.color)
}

function drawRaidOptions(
  ctx: CanvasRenderingContext2D,
  player: Player,
  toX: (value: number) => number,
  toY: (value: number) => number,
  viewportWidth: number,
  time: number,
  color = PLAYER_COLOR,
) {
  if (player.optionTimer <= 0) return
  const optionOffset = viewportWidth < 640 ? 12 : 8.5
  const optionShipSize = getShipSpriteSize(player.ship.key, 'option')
  const optionBox = viewportWidth < 860 ? 30 : 38
  const drawSize = Math.min(optionShipSize, optionBox)
  const sprite = getTowerCanvasSprite(player.ship.key, color, optionShipSize)

  for (const side of [-1, 1]) {
    const x = toX(clamp(player.x + optionOffset * side, 4, 96))
    const y = toY(player.y + 1.8) + Math.sin(time / 900 + (side > 0 ? 0.18 : 0)) * 2.5
    drawCanvasSprite(
      ctx,
      sprite,
      x,
      y,
      drawSize,
      'brightness(1.12) contrast(1.12) saturate(1.24)',
      1,
      0,
      1,
      color,
    )
  }
}

function drawPlayerEngine(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, time: number) {
  const flameHeight = size * (0.36 + Math.sin(time / 130) * 0.035)
  const flameWidth = size * 0.18
  const top = y + size * 0.32
  const gradient = ctx.createRadialGradient(x, top, 1, x, top + flameHeight * 0.35, flameHeight)
  gradient.addColorStop(0, 'rgba(255,255,255,0.95)')
  gradient.addColorStop(0.16, 'rgba(103,232,249,0.84)')
  gradient.addColorStop(0.42, 'rgba(239,35,60,0.42)')
  gradient.addColorStop(1, 'rgba(239,35,60,0)')
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = gradient
  ctx.shadowBlur = 12
  ctx.shadowColor = 'rgba(239,35,60,0.36)'
  ctx.beginPath()
  ctx.moveTo(x - flameWidth * 0.5, top)
  ctx.lineTo(x + flameWidth * 0.5, top)
  ctx.lineTo(x, top + flameHeight)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawPlayerOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number, scale: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.scale(scale, scale)
  ctx.globalAlpha = 0.24
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = 'rgba(0,0,0,0.7)'
  ctx.beginPath()
  ctx.moveTo(0, -size * 0.38)
  ctx.lineTo(size * 0.32, -size * 0.1)
  ctx.lineTo(size * 0.24, size * 0.34)
  ctx.lineTo(0, size * 0.43)
  ctx.lineTo(-size * 0.24, size * 0.34)
  ctx.lineTo(-size * 0.32, -size * 0.1)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawInvulnerabilityShimmer(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, time: number) {
  const pulse = 0.96 + Math.sin(time / 520) * 0.045
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(pulse, pulse)
  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = 'rgba(226,232,240,0.34)'
  ctx.fillStyle = 'rgba(226,232,240,0.035)'
  ctx.shadowBlur = 12
  ctx.shadowColor = 'rgba(226,232,240,0.24)'
  ctx.lineWidth = 1
  ctx.setLineDash([size * 0.075, size * 0.055])
  ctx.lineDashOffset = -time / 72
  ctx.beginPath()
  ctx.arc(0, 0, size * 0.48, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function getHoneycombShieldSprite(size: number) {
  const spriteSize = Math.max(48, Math.round(size))
  const cached = honeycombShieldSpriteCache.get(spriteSize)
  if (cached) return cached

  const radius = spriteSize * 0.53
  const pad = Math.ceil(spriteSize * 0.18)
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(radius * 2 + pad * 2)
  canvas.height = canvas.width
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.globalCompositeOperation = 'lighter'

  const shell = ctx.createRadialGradient(0, 0, radius * 0.16, 0, 0, radius * 1.08)
  shell.addColorStop(0, 'rgba(255,251,235,0.12)')
  shell.addColorStop(0.54, 'rgba(252,211,77,0.11)')
  shell.addColorStop(0.9, 'rgba(245,158,11,0.22)')
  shell.addColorStop(1, 'rgba(245,158,11,0)')
  ctx.fillStyle = shell
  ctx.beginPath()
  ctx.arc(0, 0, radius * 1.08, 0, Math.PI * 2)
  ctx.fill()

  const cell = spriteSize * 0.145
  const hexRadius = cell * 0.54
  const hexHeight = Math.sqrt(3) * cell
  const cols = Math.ceil(radius / (cell * 1.5)) + 1
  const rows = Math.ceil(radius / hexHeight) + 1
  ctx.save()
  ctx.beginPath()
  ctx.arc(0, 0, radius, 0, Math.PI * 2)
  ctx.clip()
  ctx.strokeStyle = 'rgba(252,211,77,0.52)'
  ctx.lineWidth = Math.max(0.8, spriteSize * 0.011)
  for (let col = -cols; col <= cols; col += 1) {
    for (let row = -rows; row <= rows; row += 1) {
      const hx = col * cell * 1.5
      const hy = (row + (Math.abs(col) % 2) * 0.5) * hexHeight
      if (Math.hypot(hx, hy) > radius - hexRadius * 0.2) continue
      ctx.save()
      ctx.translate(hx, hy)
      traceRegularPolygon(ctx, 6, hexRadius, Math.PI / 6)
      ctx.stroke()
      ctx.restore()
    }
  }
  ctx.restore()

  ctx.strokeStyle = 'rgba(255,251,235,0.68)'
  ctx.lineWidth = Math.max(1.3, spriteSize * 0.018)
  ctx.shadowBlur = 8
  ctx.shadowColor = 'rgba(252,211,77,0.45)'
  ctx.beginPath()
  ctx.arc(0, 0, radius, 0, Math.PI * 2)
  ctx.stroke()

  honeycombShieldSpriteCache.set(spriteSize, canvas)
  return canvas
}

function drawHoneycombShield(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, time: number, strength: number) {
  const pulse = 0.985 + Math.sin(time / 620) * 0.025
  const radius = size * 0.53
  const sprite = getHoneycombShieldSprite(size)

  ctx.save()
  ctx.translate(x, y)
  ctx.scale(pulse, pulse)
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = 0.66 + strength * 0.34
  ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2)
  ctx.globalAlpha = 1

  ctx.lineCap = 'round'
  ctx.lineWidth = Math.max(1.1, size * 0.016)
  ctx.shadowBlur = 4
  ctx.shadowColor = 'rgba(252,211,77,0.36)'
  for (let index = 0; index < 3; index += 1) {
    const angle = time / 740 + index * Math.PI * 0.42
    ctx.strokeStyle = index % 2 === 0 ? 'rgba(255,255,255,0.5)' : 'rgba(251,191,36,0.58)'
    ctx.beginPath()
    ctx.arc(0, 0, radius * (0.88 + (index % 2) * 0.08), angle, angle + Math.PI * 0.16)
    ctx.stroke()
  }
  ctx.restore()
}

function tracePlasmaLoop(ctx: CanvasRenderingContext2D, radius: number, phase: number, wobble: number, segments = 48) {
  ctx.beginPath()
  for (let index = 0; index <= segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2
    const wave =
      Math.sin(angle * 5 + phase) * wobble +
      Math.sin(angle * 9 - phase * 1.28) * wobble * 0.45 +
      Math.sin(angle * 3 + phase * 0.72) * wobble * 0.32
    const r = radius + wave
    const px = Math.cos(angle) * r
    const py = Math.sin(angle) * r
    if (index === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

function drawPlasmaForceField(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, time: number, charge: number) {
  const phase = time / 310
  const pulse = 0.96 + Math.sin(time / 260) * 0.055
  const radius = size * (0.64 + charge * 0.035) * pulse
  const wobble = size * (0.02 + charge * 0.007)

  ctx.save()
  ctx.translate(x, y)
  ctx.globalCompositeOperation = 'lighter'

  const core = ctx.createRadialGradient(0, 0, radius * 0.14, 0, 0, radius * 1.24)
  core.addColorStop(0, 'rgba(255,255,255,0.03)')
  core.addColorStop(0.48, 'rgba(34,211,238,0.06)')
  core.addColorStop(0.76, 'rgba(217,70,239,0.13)')
  core.addColorStop(1, 'rgba(34,211,238,0)')
  ctx.fillStyle = core
  tracePlasmaLoop(ctx, radius * 1.08, phase * 0.8, wobble * 0.5, 40)
  ctx.fill()

  const colors = ['rgba(165,243,252,0.84)', 'rgba(217,70,239,0.5)']
  for (let layer = 0; layer < 2; layer += 1) {
    ctx.shadowBlur = 13 - layer * 3
    ctx.shadowColor = layer === 1 ? 'rgba(217,70,239,0.52)' : 'rgba(34,211,238,0.72)'
    ctx.strokeStyle = colors[layer]
    ctx.lineWidth = Math.max(1, size * (0.024 - layer * 0.004))
    tracePlasmaLoop(ctx, radius * (1 + layer * 0.075), phase * (layer % 2 ? -1.15 : 1), wobble * (1.1 - layer * 0.24), layer === 0 ? 46 : 38)
    ctx.stroke()
  }

  ctx.lineCap = 'round'
  ctx.shadowBlur = 6
  for (let arc = 0; arc < 4; arc += 1) {
    const angle = phase * 0.7 + arc * Math.PI * 0.58
    const arcRadius = radius * (0.86 + (arc % 3) * 0.055)
    ctx.strokeStyle = arc % 2 === 0 ? 'rgba(34,211,238,0.66)' : 'rgba(244,114,182,0.48)'
    ctx.lineWidth = Math.max(1.2, size * 0.013)
    ctx.beginPath()
    ctx.arc(0, 0, arcRadius, angle, angle + Math.PI * (0.12 + (arc % 2) * 0.08))
    ctx.stroke()
  }

  ctx.shadowBlur = 5
  for (let spark = 0; spark < 4; spark += 1) {
    const angle = phase * 1.35 + spark * Math.PI * 0.5
    const sparkRadius = radius * (0.92 + Math.sin(phase + spark) * 0.08)
    ctx.fillStyle = spark % 2 === 0 ? 'rgba(255,255,255,0.82)' : 'rgba(34,211,238,0.78)'
    ctx.shadowColor = 'rgba(34,211,238,0.82)'
    ctx.beginPath()
    ctx.arc(Math.cos(angle) * sparkRadius, Math.sin(angle) * sparkRadius, Math.max(1.2, size * 0.018), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawCometForceField(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, time: number, charge: number) {
  const energy = clamp(charge, 0.35, 1)
  const pulse = 0.98 + Math.sin(time / 165) * 0.055
  const radiusX = size * (0.41 + energy * 0.045) * pulse
  const radiusY = size * (0.58 + energy * 0.05) * pulse
  const tail = size * (1.12 + energy * 0.34)
  const streakPhase = time / 82

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(Math.sin(time / 260) * 0.018)
  ctx.globalCompositeOperation = 'lighter'

  const tailGradient = ctx.createLinearGradient(0, tail * 1.08, 0, -radiusY * 0.9)
  tailGradient.addColorStop(0, 'rgba(34,211,238,0)')
  tailGradient.addColorStop(0.2, 'rgba(34,211,238,0.12)')
  tailGradient.addColorStop(0.48, 'rgba(74,222,128,0.24)')
  tailGradient.addColorStop(0.72, 'rgba(250,204,21,0.14)')
  tailGradient.addColorStop(1, 'rgba(240,253,244,0.08)')
  ctx.fillStyle = tailGradient
  ctx.shadowBlur = 18
  ctx.shadowColor = 'rgba(45,212,191,0.55)'
  ctx.beginPath()
  ctx.moveTo(-radiusX * 0.5, -radiusY * 0.04)
  ctx.bezierCurveTo(-radiusX * 0.78, tail * 0.24, -radiusX * 0.28, tail * 0.94, 0, tail * 1.02)
  ctx.bezierCurveTo(radiusX * 0.28, tail * 0.94, radiusX * 0.78, tail * 0.24, radiusX * 0.5, -radiusY * 0.04)
  ctx.closePath()
  ctx.fill()

  const coreGradient = ctx.createLinearGradient(0, tail * 0.86, 0, -radiusY * 0.25)
  coreGradient.addColorStop(0, 'rgba(45,212,191,0)')
  coreGradient.addColorStop(0.34, 'rgba(134,239,172,0.24)')
  coreGradient.addColorStop(0.64, 'rgba(255,255,255,0.44)')
  coreGradient.addColorStop(1, 'rgba(103,232,249,0.12)')
  ctx.fillStyle = coreGradient
  ctx.shadowBlur = 12
  ctx.shadowColor = 'rgba(187,247,208,0.66)'
  ctx.beginPath()
  ctx.ellipse(0, tail * 0.32, radiusX * 0.22, tail * 0.54, 0, 0, Math.PI * 2)
  ctx.fill()

  const shell = ctx.createRadialGradient(0, -radiusY * 0.12, radiusX * 0.16, 0, 0, radiusY * 1.12)
  shell.addColorStop(0, 'rgba(255,255,255,0.2)')
  shell.addColorStop(0.38, 'rgba(103,232,249,0.2)')
  shell.addColorStop(0.7, 'rgba(74,222,128,0.24)')
  shell.addColorStop(1, 'rgba(21,128,61,0)')
  ctx.fillStyle = shell
  ctx.beginPath()
  ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.lineCap = 'round'
  for (let index = 0; index < 7; index += 1) {
    const offset = ((streakPhase + index * 0.17) % 1) * tail
    const xOffset = Math.sin(streakPhase * 1.4 + index * 1.85) * radiusX * (0.14 + (index % 3) * 0.06)
    const yOffset = tail * 0.9 - offset
    const alpha = 0.24 + (index % 2) * 0.16
    ctx.strokeStyle = index % 3 === 0 ? `rgba(255,255,255,${alpha})` : index % 2 === 0 ? `rgba(125,249,255,${alpha})` : `rgba(134,239,172,${alpha})`
    ctx.lineWidth = Math.max(1.15, size * (0.011 + index * 0.0009))
    ctx.beginPath()
    ctx.moveTo(xOffset, yOffset + tail * 0.16)
    ctx.bezierCurveTo(xOffset * 0.7, yOffset - tail * 0.02, xOffset * 0.24, yOffset - tail * 0.2, 0, yOffset - tail * 0.34)
    ctx.stroke()
  }

  ctx.strokeStyle = 'rgba(240,253,250,0.64)'
  ctx.lineWidth = Math.max(1.1, size * 0.014)
  ctx.shadowBlur = 8
  ctx.shadowColor = 'rgba(125,249,255,0.62)'
  ctx.beginPath()
  ctx.ellipse(0, 0, radiusX * 0.9, radiusY * 0.9, 0, Math.PI * 1.12, Math.PI * 1.88)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(250,204,21,0.22)'
  ctx.lineWidth = Math.max(0.9, size * 0.01)
  ctx.beginPath()
  ctx.ellipse(0, radiusY * 0.04, radiusX * 0.58, radiusY * 0.76, 0, Math.PI * 1.08, Math.PI * 1.92)
  ctx.stroke()

  ctx.restore()
}

function drawRaidPlayer(
  ctx: CanvasRenderingContext2D,
  player: Player,
  phase: GamePhase,
  toX: (value: number) => number,
  toY: (value: number) => number,
  viewportWidth: number,
  time: number,
  color = PLAYER_COLOR,
) {
  const x = toX(player.x)
  const y = toY(player.y)
  const size = viewportWidth < 860 ? 62 : 82
  const isDown = phase === 'gameover' || player.hp <= 0
  const rotation = isDown ? 28 * DEG : 0
  const scale = isDown ? 0.88 : 1
  const alpha = isDown ? 0.3 : 1

  if (!isDown) drawPlayerEngine(ctx, x, y, size, time)

  if (player.shield > 0) drawHoneycombShield(ctx, x, y, size, time, clamp(player.shield / 8, 0, 1))
  else if (player.invuln > 0) drawInvulnerabilityShimmer(ctx, x, y, size, time)

  if (player.forceField > 0) {
    const forceCharge = player.ship.key === 'spaceEt'
      ? clamp(player.forceField / SPACE_ET_PASSIVE_FORCE_FIELD_CHARGES, 0.42, 1)
      : clamp(player.forceField / FORCE_FIELD_ARMOR, 0, 1)
    if (player.ship.key === 'spaceEt') drawCometForceField(ctx, x, y, size, time, forceCharge)
    else drawPlasmaForceField(ctx, x, y, size, time, forceCharge)
  }

  const sprite = getTowerCanvasSprite(player.ship.key, color, getShipSpriteSize(player.ship.key, 'player'))
  const spriteGlow = player.forceField > 0
    ? player.ship.key === 'spaceEt' ? 'rgba(125,249,255,0.46)' : 'rgba(34,211,238,0.34)'
    : player.shield > 0 ? 'rgba(252,211,77,0.24)' : player.invuln > 0 ? 'rgba(226,232,240,0.16)' : null
  if (spriteGlow) drawSpriteGlow(ctx, x, y, size, spriteGlow, 1)
  drawCanvasSprite(
    ctx,
    sprite,
    x,
    y,
    size,
    'brightness(1.12) contrast(1.14) saturate(1.26)',
    alpha,
    rotation,
    scale,
    color,
  )
  drawPlayerOverlay(ctx, x, y, size, rotation, scale)
}

function traceRegularPolygon(ctx: CanvasRenderingContext2D, sides: number, radius: number, rotation = -Math.PI / 2) {
  ctx.beginPath()
  for (let index = 0; index < sides; index += 1) {
    const angle = rotation + (index / sides) * Math.PI * 2
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    if (index === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

function drawPowerPickupIcon(ctx: CanvasRenderingContext2D, type: PowerKind, size: number, color: string, phase = 0) {
  const r = size * 0.19
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = Math.max(1.5, size * 0.045)
  ctx.globalAlpha = 0.62

  if (type === 'laser') {
    ctx.beginPath()
    ctx.moveTo(0, -r * 1.15)
    ctx.lineTo(0, r * 1.15)
    ctx.moveTo(-r * 0.45, -r * 0.45)
    ctx.lineTo(r * 0.45, -r * 0.45)
    ctx.moveTo(-r * 0.45, r * 0.45)
    ctx.lineTo(r * 0.45, r * 0.45)
    ctx.stroke()
  } else if (type === 'spread') {
    ctx.beginPath()
    ctx.moveTo(0, r * 0.85)
    ctx.lineTo(-r, -r * 0.9)
    ctx.moveTo(0, r * 0.85)
    ctx.lineTo(0, -r * 1.1)
    ctx.moveTo(0, r * 0.85)
    ctx.lineTo(r, -r * 0.9)
    ctx.stroke()
  } else if (type === 'scatter') {
    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(Math.cos(angle) * r * 0.35, Math.sin(angle) * r * 0.35)
      ctx.lineTo(Math.cos(angle) * r * 1.05, Math.sin(angle) * r * 1.05)
      ctx.stroke()
    }
  } else if (type === 'rocket') {
    ctx.beginPath()
    ctx.moveTo(0, -r * 1.15)
    ctx.lineTo(r * 0.72, r * 0.45)
    ctx.lineTo(r * 0.24, r * 0.9)
    ctx.lineTo(0, r * 0.62)
    ctx.lineTo(-r * 0.24, r * 0.9)
    ctx.lineTo(-r * 0.72, r * 0.45)
    ctx.closePath()
    ctx.stroke()
  } else if (type === 'homing') {
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.9, -0.25, Math.PI * 1.55)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(r * 0.55, -r * 0.95)
    ctx.lineTo(r * 1.08, -r * 1)
    ctx.lineTo(r * 0.86, -r * 0.5)
    ctx.stroke()
  } else if (type === 'option') {
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(side * r * 0.62, 0, r * 0.34, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.moveTo(-r * 0.24, 0)
    ctx.lineTo(r * 0.24, 0)
    ctx.stroke()
  } else if (type === 'shield') {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = 'rgba(252,211,77,0.08)'
    ctx.strokeStyle = 'rgba(252,211,77,0.96)'
    ctx.lineWidth = Math.max(1.3, size * 0.038)
    ctx.beginPath()
    ctx.arc(0, 0, r * 1.16, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.lineWidth = Math.max(1, size * 0.026)
    const cells: Array<[number, number, number]> = [
      [0, 0, 0.52],
      [-r * 0.46, -r * 0.28, 0.42],
      [r * 0.46, -r * 0.28, 0.42],
      [-r * 0.46, r * 0.28, 0.42],
      [r * 0.46, r * 0.28, 0.42],
      [0, -r * 0.58, 0.36],
      [0, r * 0.58, 0.36],
    ]
    for (const [hx, hy, scale] of cells) {
      ctx.save()
      ctx.translate(hx, hy)
      traceRegularPolygon(ctx, 6, r * scale, Math.PI / 6)
      ctx.stroke()
      ctx.restore()
    }
    ctx.restore()
  } else if (type === 'forcefield') {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.lineWidth = Math.max(1.2, size * 0.033)
    ctx.shadowBlur = 10
    ctx.shadowColor = 'rgba(34,211,238,0.72)'
    ctx.strokeStyle = 'rgba(165,243,252,0.92)'
    tracePlasmaLoop(ctx, r * 1.08, phase * 1.35, r * 0.12, 52)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(244,114,182,0.62)'
    ctx.lineWidth = Math.max(1, size * 0.023)
    tracePlasmaLoop(ctx, r * 0.72, -phase * 1.7, r * 0.08, 44)
    ctx.stroke()
    for (let index = 0; index < 3; index += 1) {
      const angle = phase + index * Math.PI * 0.72
      ctx.beginPath()
      ctx.arc(0, 0, r * (0.82 + index * 0.08), angle, angle + Math.PI * 0.22)
      ctx.stroke()
    }
    ctx.restore()
  } else if (type === 'repair') {
    ctx.beginPath()
    ctx.moveTo(-r, 0)
    ctx.lineTo(r, 0)
    ctx.moveTo(0, -r)
    ctx.lineTo(0, r)
    ctx.stroke()
  } else if (type === 'levelup') {
    ctx.beginPath()
    ctx.moveTo(0, -r * 1.15)
    ctx.lineTo(r * 0.82, -r * 0.18)
    ctx.lineTo(r * 0.32, -r * 0.18)
    ctx.lineTo(r * 0.32, r * 0.86)
    ctx.lineTo(-r * 0.32, r * 0.86)
    ctx.lineTo(-r * 0.32, -r * 0.18)
    ctx.lineTo(-r * 0.82, -r * 0.18)
    ctx.closePath()
    ctx.stroke()
  }

  ctx.restore()
}

function getHomingMissileSprite(visualScale: number) {
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

function getNukePathPoint(strike: NukeStrike, progress: number) {
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

function getNukePathDerivative(strike: NukeStrike, progress: number) {
  const lift = 22 + Math.abs(strike.targetX - strike.startX) * 0.16
  const side = strike.targetX >= strike.startX ? 1 : -1
  const controlX = (strike.startX + strike.targetX) / 2 + side * 6
  const controlY = Math.min(strike.startY, strike.targetY) - lift
  return {
    x: 2 * (1 - progress) * (controlX - strike.startX) + 2 * progress * (strike.targetX - controlX),
    y: 2 * (1 - progress) * (controlY - strike.startY) + 2 * progress * (strike.targetY - controlY),
  }
}

function drawNukeMissile(
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

function drawNukeBlast(ctx: CanvasRenderingContext2D, width: number, height: number, flashTime: number, time: number, originX?: number, originY?: number) {
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

function drawAsteroidHazard(
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
  const healthGlow = clamp(asteroid.hp / asteroid.maxHp, 0, 1)
  const points = asteroid.tier === 2 ? 12 : 9

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((asteroid.spin + time * 0.012) * DEG)
  ctx.shadowBlur = asteroid.tier === 2 ? 18 : 9
  ctx.shadowColor = 'rgba(251,146,60,0.22)'

  const gradient = ctx.createLinearGradient(-size * 0.5, -size * 0.55, size * 0.48, size * 0.5)
  gradient.addColorStop(0, '#a8a29e')
  gradient.addColorStop(0.32, '#57534e')
  gradient.addColorStop(0.72, '#292524')
  gradient.addColorStop(1, '#120f0d')
  ctx.fillStyle = gradient
  ctx.strokeStyle = asteroid.tier === 2 ? 'rgba(251,191,36,0.62)' : 'rgba(214,211,209,0.34)'
  ctx.lineWidth = Math.max(1, size * 0.035)
  ctx.beginPath()
  for (let index = 0; index < points; index += 1) {
    const angle = (index / points) * Math.PI * 2
    const wobble = 0.78 + seededNoise(asteroid.id + index * 13, asteroid.phase) * 0.34
    const rx = Math.cos(angle) * size * 0.5 * wobble
    const ry = Math.sin(angle) * size * 0.42 * (0.86 + seededNoise(asteroid.id, index + 4) * 0.25)
    if (index === 0) ctx.moveTo(rx, ry)
    else ctx.lineTo(rx, ry)
  }
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  ctx.shadowBlur = 0
  const innerShade = ctx.createRadialGradient(-size * 0.2, -size * 0.24, size * 0.08, size * 0.1, size * 0.1, size * 0.64)
  innerShade.addColorStop(0, 'rgba(255,255,255,0.18)')
  innerShade.addColorStop(0.46, 'rgba(68,64,60,0)')
  innerShade.addColorStop(1, 'rgba(0,0,0,0.42)')
  ctx.fillStyle = innerShade
  ctx.globalAlpha = 0.78
  ctx.beginPath()
  for (let index = 0; index < points; index += 1) {
    const angle = (index / points) * Math.PI * 2
    const wobble = 0.74 + seededNoise(asteroid.id + index * 17, asteroid.phase + 3) * 0.28
    const rx = Math.cos(angle) * size * 0.46 * wobble
    const ry = Math.sin(angle) * size * 0.39 * (0.88 + seededNoise(asteroid.id + 6, index) * 0.18)
    if (index === 0) ctx.moveTo(rx, ry)
    else ctx.lineTo(rx, ry)
  }
  ctx.closePath()
  ctx.fill()

  const craterCount = asteroid.tier === 2 ? 6 : asteroid.tier === 1 ? 4 : 2
  for (let index = 0; index < craterCount; index += 1) {
    const seed = asteroid.id * 11 + index * 19
    const angle = seededNoise(seed, 1) * Math.PI * 2
    const distance = size * (0.1 + seededNoise(seed, 2) * 0.28)
    const craterX = Math.cos(angle) * distance
    const craterY = Math.sin(angle) * distance * 0.78
    const craterW = size * (0.055 + seededNoise(seed, 3) * 0.07)
    const craterH = craterW * (0.55 + seededNoise(seed, 4) * 0.35)
    ctx.save()
    ctx.translate(craterX, craterY)
    ctx.rotate((seededNoise(seed, 5) - 0.5) * 1.2)
    ctx.globalAlpha = 0.45
    ctx.fillStyle = 'rgba(12,10,9,0.72)'
    ctx.beginPath()
    ctx.ellipse(0, 0, craterW, craterH, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 0.28
    ctx.strokeStyle = 'rgba(214,211,209,0.72)'
    ctx.lineWidth = Math.max(1, size * 0.012)
    ctx.beginPath()
    ctx.ellipse(-craterW * 0.08, -craterH * 0.12, craterW, craterH, 0, Math.PI * 0.95, Math.PI * 1.85)
    ctx.stroke()
    ctx.restore()
  }

  ctx.globalAlpha = 0.52
  ctx.strokeStyle = 'rgba(15,23,42,0.72)'
  ctx.lineWidth = Math.max(1, size * 0.018)
  for (let index = 0; index < (asteroid.tier === 2 ? 7 : 4); index += 1) {
    const offset = (index - 1.5) * size * 0.12
    ctx.beginPath()
    ctx.moveTo(-size * (0.3 - index * 0.018), offset)
    ctx.lineTo(-size * 0.05 + seededNoise(asteroid.id, index) * size * 0.18, -offset * 0.2)
    ctx.lineTo(size * (0.18 + index * 0.025), -offset * 0.48)
    ctx.stroke()
  }

  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = asteroid.tier === 2 ? 0.2 : 0.12
  ctx.fillStyle = asteroid.tier === 2 ? 'rgba(251,146,60,0.8)' : 'rgba(214,211,209,0.52)'
  const fleckCount = asteroid.tier === 2 ? 10 : asteroid.tier === 1 ? 6 : 3
  for (let index = 0; index < fleckCount; index += 1) {
    const seed = asteroid.id * 23 + index * 7
    const fx = (seededNoise(seed, 6) - 0.5) * size * 0.62
    const fy = (seededNoise(seed, 7) - 0.5) * size * 0.46
    ctx.beginPath()
    ctx.arc(fx, fy, Math.max(0.8, size * (0.008 + seededNoise(seed, 8) * 0.01)), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalCompositeOperation = 'source-over'

  if (healthGlow < 0.6) {
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = (0.62 - healthGlow) * 1.1
    ctx.strokeStyle = asteroid.tier === 2 ? 'rgba(251,146,60,0.9)' : 'rgba(251,191,36,0.74)'
    ctx.lineWidth = Math.max(1, size * 0.024)
    ctx.beginPath()
    ctx.moveTo(-size * 0.24, -size * 0.18)
    ctx.lineTo(size * 0.08, size * 0.02)
    ctx.lineTo(size * 0.28, -size * 0.12)
    ctx.stroke()
  }

  ctx.restore()
}

function drawAsteroidWarning(ctx: CanvasRenderingContext2D, width: number, height: number, warningTime: number, time: number) {
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

function drawRandomEventWarning(ctx: CanvasRenderingContext2D, width: number, height: number, event: RaidRandomEvent | null, time: number) {
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

function drawMeteorHazard(
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

function drawIonStrike(ctx: CanvasRenderingContext2D, strike: IonStrike, width: number, height: number, time: number) {
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

function drawDerelictWreck(
  ctx: CanvasRenderingContext2D,
  wreck: DerelictWreck,
  toX: (value: number) => number,
  toY: (value: number) => number,
  viewportWidth: number,
  time: number,
) {
  const x = toX(wreck.x)
  const y = toY(wreck.y)
  const w = Math.max(90, (wreck.width / WIDTH) * viewportWidth)
  const h = w * 0.34
  const damage = clamp(1 - wreck.hp / Math.max(1, wreck.maxHp), 0, 1)
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(Math.sin(time / 1300 + wreck.phase) * 0.08)
  ctx.shadowBlur = 14
  ctx.shadowColor = 'rgba(239,68,68,0.28)'
  const hull = ctx.createLinearGradient(-w * 0.5, -h * 0.5, w * 0.5, h * 0.5)
  hull.addColorStop(0, '#94a3b8')
  hull.addColorStop(0.42, '#334155')
  hull.addColorStop(1, '#020617')
  ctx.fillStyle = hull
  ctx.strokeStyle = 'rgba(226,232,240,0.52)'
  ctx.lineWidth = Math.max(1, w * 0.01)
  ctx.beginPath()
  ctx.moveTo(-w * 0.52, -h * 0.12)
  ctx.lineTo(-w * 0.2, -h * 0.42)
  ctx.lineTo(w * 0.46, -h * 0.2)
  ctx.lineTo(w * 0.36, h * 0.22)
  ctx.lineTo(-w * 0.36, h * 0.42)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = 0.26 + damage * 0.42
  ctx.strokeStyle = 'rgba(251,113,133,0.9)'
  ctx.lineWidth = Math.max(1, w * 0.008)
  for (let index = 0; index < 4; index += 1) {
    const ox = -w * 0.3 + index * w * 0.18
    ctx.beginPath()
    ctx.moveTo(ox, -h * 0.22)
    ctx.lineTo(ox + w * 0.1, h * 0.18)
    ctx.stroke()
  }
  ctx.restore()
}

function drawRandomEventOverlay(ctx: CanvasRenderingContext2D, width: number, height: number, event: RaidRandomEvent | null, time: number) {
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

function drawPowerUpCanvas(
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
  const color = powerColor(powerUp.type)
  const phase = time / 1000 + powerUp.id * 0.37
  const pulse = 0.92 + Math.sin(time / 240 + powerUp.id) * 0.08
  const ringRadius = size * 0.54 * pulse

  ctx.save()
  ctx.translate(x, y)

  ctx.globalCompositeOperation = 'lighter'
  drawRadialEllipse(ctx, 0, 0, size * 0.9, size * 0.74, [
    [0, 'rgba(255,255,255,0.2)'],
    [0.28, color],
    [1, 'rgba(0,0,0,0)'],
  ])

  for (let index = 0; index < 3; index += 1) {
    const angle = phase * 1.8 + index * Math.PI * 2 / 3
    const dotRadius = size * (0.035 + index * 0.004)
    ctx.fillStyle = index === 0 ? '#ffffff' : color
    ctx.globalAlpha = 0.78
    ctx.shadowBlur = 12
    ctx.shadowColor = color
    ctx.beginPath()
    ctx.arc(Math.cos(angle) * size * 0.58, Math.sin(angle) * size * 0.58, dotRadius, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.rotate(powerUp.spin * DEG * 0.42)
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = 1
  ctx.shadowBlur = 20
  ctx.shadowColor = color

  const shell = ctx.createRadialGradient(-size * 0.15, -size * 0.22, size * 0.04, 0, 0, size * 0.55)
  shell.addColorStop(0, 'rgba(255,255,255,0.98)')
  shell.addColorStop(0.16, color)
  shell.addColorStop(0.34, 'rgba(255,255,255,0.16)')
  shell.addColorStop(0.42, 'rgba(5,8,14,0.94)')
  shell.addColorStop(0.74, 'rgba(5,8,14,0.9)')
  shell.addColorStop(0.82, color)
  shell.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = shell
  traceRegularPolygon(ctx, 6, size * 0.5, -Math.PI / 2 + Math.sin(phase) * 0.08)
  ctx.fill()

  ctx.strokeStyle = color
  ctx.lineWidth = 1.4
  ctx.globalAlpha = 0.9
  traceRegularPolygon(ctx, 6, size * 0.5, -Math.PI / 2 + Math.sin(phase) * 0.08)
  ctx.stroke()

  ctx.lineWidth = Math.max(2, size * 0.055)
  ctx.lineCap = 'round'
  for (let index = 0; index < 4; index += 1) {
    const start = phase * 1.25 + index * Math.PI * 0.5
    ctx.strokeStyle = index % 2 === 0 ? color : 'rgba(255,255,255,0.74)'
    ctx.globalAlpha = index % 2 === 0 ? 0.86 : 0.56
    ctx.beginPath()
    ctx.arc(0, 0, ringRadius, start, start + Math.PI * 0.22)
    ctx.stroke()
  }

  ctx.rotate(-powerUp.spin * DEG * 0.42)
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  const core = ctx.createRadialGradient(-size * 0.1, -size * 0.12, 1, 0, 0, size * 0.28)
  core.addColorStop(0, 'rgba(255,255,255,0.92)')
  core.addColorStop(0.2, color)
  core.addColorStop(0.52, '#111827')
  core.addColorStop(1, '#03050a')
  ctx.fillStyle = core
  ctx.strokeStyle = color
  ctx.shadowBlur = 10
  ctx.shadowColor = color
  ctx.beginPath()
  ctx.arc(0, 0, size * 0.29, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  drawPowerPickupIcon(ctx, powerUp.type, size, color, phase)
  ctx.restore()

  ctx.fillStyle = '#ffffff'
  ctx.shadowBlur = 8
  ctx.shadowColor = color
  ctx.font = `1000 ${Math.max(13, size * 0.32)}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(powerGlyph(powerUp.type), 0, size * 0.01)
  ctx.restore()
}

function drawFinalChargeLines(
  ctx: CanvasRenderingContext2D,
  enemies: Enemy[],
  toX: (value: number) => number,
  viewportWidth: number,
  viewportHeight: number,
  time: number,
) {
  // Performance: batch all lines in a single save/restore, no shadow, single path for dashes
  const chargingEnemies = enemies.filter((e) => e.bossKind === 'final' && e.chargeTimer > 0)
  if (chargingEnemies.length === 0) return

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'

  for (const enemy of chargingEnemies) {
    const lanes = getFinalBossBeamLanes(enemy.chargeLane, enemy.chargePattern)
    const chargeProgress = 1 - clamp(enemy.chargeTimer / FINAL_BOSS_BEAM_CHARGE_SECONDS, 0, 1)
    const alpha = 0.28 + chargeProgress * 0.72
    const radius = getFinalBossBeamRadius(enemy.chargePattern)
    const lineWidth = Math.max(32, Math.min(viewportWidth * 0.15, (radius / WIDTH) * viewportWidth * 2.45))

    for (const lane of lanes) {
      const x = toX(lane)
      const warningPulse = 0.72 + Math.sin(time / 80 + lane) * 0.2

      // Glow rect — no shadowBlur, use a narrower solid fill instead (much cheaper)
      ctx.globalAlpha = alpha * 0.22
      ctx.fillStyle = 'rgba(34,211,238,1)'
      ctx.fillRect(x - lineWidth * 0.7, 0, lineWidth * 1.4, viewportHeight)

      // Soft halo — single wide translucent rect, no gradient object allocation
      ctx.globalAlpha = alpha * 0.42
      ctx.fillStyle = 'rgba(96,165,250,1)'
      ctx.fillRect(x - lineWidth / 2, 0, lineWidth, viewportHeight)

      ctx.globalAlpha = alpha * 0.72 * warningPulse
      ctx.fillStyle = 'rgba(255,255,255,1)'
      ctx.fillRect(x - 2, 0, 4, viewportHeight)

      // Dashes — batch into a single path instead of one stroke per dash
      ctx.globalAlpha = alpha * 0.86
      ctx.strokeStyle = time % 220 < 110 ? '#7dd3fc' : '#eff6ff'
      ctx.lineWidth = 2.5
      ctx.setLineDash([8, 10])
      ctx.beginPath()
      ctx.moveTo(x - lineWidth * 0.5, 0)
      ctx.lineTo(x - lineWidth * 0.5, viewportHeight)
      ctx.moveTo(x + lineWidth * 0.5, 0)
      ctx.lineTo(x + lineWidth * 0.5, viewportHeight)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  ctx.restore()
}

function drawFingerGuide(ctx: CanvasRenderingContext2D, pointer: Vec | null, toX: (value: number) => number, toY: (value: number) => number) {
  if (!pointer) return
  const x = toX(pointer.x)
  const y = toY(pointer.y)
  ctx.save()
  ctx.strokeStyle = 'rgba(248,113,113,0.28)'
  ctx.fillStyle = 'rgba(248,113,113,0.16)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x, y, 29, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  const gradient = ctx.createLinearGradient(x, y - 86, x, y - 8)
  gradient.addColorStop(0, 'rgba(248,113,113,0.5)')
  gradient.addColorStop(1, 'rgba(248,113,113,0)')
  ctx.strokeStyle = gradient
  ctx.beginPath()
  ctx.moveTo(x, y - 86)
  ctx.lineTo(x, y - 8)
  ctx.stroke()
  ctx.restore()
}

function getBriefingPickupType(item: string) {
  const label = item.split(':')[0]
  return BRIEFING_PICKUP_TYPES[label] ?? null
}

function PickupPreviewCanvas({ type }: { type: PowerKind }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    let raf = 0
    const seed = PICKUP_PREVIEW_SEEDS[type]
    const draw = (time: number) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const width = Math.max(1, Math.floor(rect.width * dpr))
      const height = Math.max(1, Math.floor(rect.height * dpr))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, rect.width, rect.height)
      drawPowerUpCanvas(
        ctx,
        {
          id: seed,
          type,
          x: 50,
          y: 50,
          vy: 0,
          radius: 3,
          spin: (time / 18 + seed * 28) % 360,
        },
        (value) => (value / WIDTH) * rect.width,
        (value) => (value / HEIGHT) * rect.height,
        rect.width < 70 ? 640 : 1000,
        time,
      )
      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [type])

  return <canvas className="raid__pickup-preview" ref={canvasRef} aria-hidden="true" />
}

type RaidMultiplayerSession = {
  socket: WebSocket
  peerId: string
  roomCode: string
  isHost: boolean
  players: Array<{
    id: string
    name: string
    ready: boolean
    host: boolean
    shipKey: string
  }>
}

export function GradiusRaid({
  onClose,
  multiplayerSession,
  playerName,
}: {
  onClose: () => void
  multiplayerSession?: RaidMultiplayerSession | null
  playerName: string
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const fxCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const fxCanvasContextRef = useRef<CanvasRenderingContext2D | null>(null)
  const rafRef = useRef(0)
  const lastTimeRef = useRef(0)
  const lastRenderTimeRef = useRef(0)
  const graphicsQualityRef = useRef<GraphicsQuality>(getGraphicsQuality())
  const snapshotKeyRef = useRef('')
  const paletteRef = useRef<RaidPalette>(DEFAULT_RAID_PALETTE)
  const paletteClassRef = useRef('')
  const keysRef = useRef(new Set<string>())
  const pointerTargetRef = useRef<Vec | null>(null)
  const pointerVisualRef = useRef<Vec | null>(null)
  const touchPointerActiveRef = useRef(false)
  const selectedShipRef = useRef<ShipOption>(SHIP_OPTIONS[0])
  const multiplayerSessionRef = useRef<RaidMultiplayerSession | null>(multiplayerSession ?? null)
  const multiplayerStartedRef = useRef(false)
  const multiplayerStateSeqRef = useRef(0)
  const multiplayerLastAppliedSeqRef = useRef(0)
  const multiplayerLastSendRef = useRef(0)
  const multiplayerLastSnapshotApplyRef = useRef(0)
  const multiplayerLastHostStateRef = useRef<Player | null>(null)
  const multiplayerLastHostPacketTimeRef = useRef(0)
  const multiplayerHostVisualVelocityRef = useRef<Vec>({ x: 0, y: 0 })
  const multiplayerHostSnapshotBufferRef = useRef<MultiplayerPlayerSnapshot[]>([])
  const multiplayerEnemySnapshotBufferRef = useRef<MultiplayerEnemySnapshot[]>([])
  const multiplayerAsteroidSnapshotBufferRef = useRef<MultiplayerAsteroidSnapshot[]>([])
  const multiplayerLastHeartbeatRef = useRef(0)
  const multiplayerHeartbeatSentAtRef = useRef(0)
  const multiplayerLastConnectionCheckRef = useRef(0)
  const multiplayerRttRef = useRef<number | null>(null)
  const multiplayerLastGuestInputAtRef = useRef(0)
  const multiplayerConnectionQualityRef = useRef<MultiplayerConnectionQuality>('good')
  const multiplayerLocalNukeRef = useRef(0)
  const multiplayerRemoteNukeRef = useRef(0)
  const multiplayerHandledRemoteNukeRef = useRef(0)
  const coOpRunRef = useRef(Boolean(multiplayerSession))
  const remoteKeysRef = useRef(new Set<string>())
  const remotePointerTargetRef = useRef<Vec | null>(null)
  const remotePointerVisualRef = useRef<Vec | null>(null)
  const remotePlayerRef = useRef<Player | null>(null)
  // Accumulated position error between local prediction and host state — drained gradually each frame
  const guestPositionCorrectionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  // Locally predicted shots for the guest (shown immediately, cleared when host confirms them)
  const guestLocalShotsRef = useRef<Array<Shot & { spawnedAt: number }>>([])
  // When non-null, pushShot writes to this array instead of shotsRef (used for local prediction capture)
  const fireCaptureRef = useRef<Shot[] | null>(null)
  const victoryPendingRef = useRef(false)
  const victoryBlackoutRef = useRef(0)
  // Local fire cooldowns for guest prediction — independent from network-synced player cooldowns
  const guestLocalFireCooldownRef = useRef(0)
  const guestLocalWeaponCooldownsRef = useRef<Record<WeaponKey, number>>({ ...EMPTY_WEAPON_TIMERS })
  // Stable ref to firePlayer so predictGuestPlayer can call it without a forward-declaration issue
  const firePlayerRef = useRef<(player: Player) => void>((_p: Player) => {})
  const playerRef = useRef<Player>(getInitialPlayer())
  const leaderboardSubmittedRef = useRef(false)
  const shotsRef = useRef<Shot[]>([])
  const enemyShotsRef = useRef<Shot[]>([])
  const enemiesRef = useRef<Enemy[]>([])
  const asteroidsRef = useRef<AsteroidHazard[]>([])
  const meteorsRef = useRef<MeteorHazard[]>([])
  const ionStrikesRef = useRef<IonStrike[]>([])
  const wrecksRef = useRef<DerelictWreck[]>([])
  const powerUpsRef = useRef<PowerUp[]>([])
  const sparksRef = useRef<Spark[]>([])
  const ripplesRef = useRef<Ripple[]>([])
  const phaseRef = useRef<GamePhase>('select')
  const stageRef = useRef(1)
  const waveRef = useRef(1)
  const spawnTimerRef = useRef(0.5)
  const formationTimerRef = useRef(2.1)
  const bossTimerRef = useRef(28)
  const spawnLockRef = useRef(0)
  const powerDropCooldownRef = useRef(0)
  const killsSincePowerRef = useRef(0)
  const bossAlertRef = useRef(0)
  const bossMessageRef = useRef<BossMessage>(null)
  const stageClearRef = useRef(0)
  const stageEntryRef = useRef(0)
  const pendingNextStageRef = useRef<number | null>(null)
  const nukeCooldownRef = useRef(0)
  const nukeFlashRef = useRef(0)
  const nukeStrikeRef = useRef<NukeStrike | null>(null)
  const nukeBlastOriginRef = useRef<Vec>({ x: 50, y: 46 })
  const asteroidClusterTimerRef = useRef(34 + Math.random() * 18)
  const asteroidSpawnDelayRef = useRef(0)
  const asteroidWarningRef = useRef(0)
  const randomEventRef = useRef<RaidRandomEvent | null>(null)
  const randomEventTimerRef = useRef(24 + Math.random() * 18)
  const randomEventSpawnTimerRef = useRef(0)
  const lastRandomEventKindRef = useRef<RaidRandomEventKind | null>(null)
  const highScoreRef = useRef(getHighScore())
  const unlockedStageRef = useRef(getUnlockedStage())
  const raidBgmElementRef = useRef<HTMLAudioElement | null>(null)
  const raidBgmModeRef = useRef<RaidBgmMode | null>(null)
  const raidBgmStageRef = useRef(0)
  const raidBgmTrackRef = useRef<string | null>(null)
  const [selectedShipKey, setSelectedShipKey] = useState(SHIP_OPTIONS[0].key)
  const [briefingStep, setBriefingStep] = useState(0)
  const [snapshot, setSnapshot] = useState<Snapshot>(() => ({
    phase: 'select',
    player: getInitialPlayer(),
    allyPlayer: null,
    shots: [],
    enemyShots: [],
    enemies: [],
    powerUps: [],
    sparks: [],
    ripples: [],
    wave: 1,
    stageTheme: 1,
    bossAlert: 0,
    bossMessage: null,
    highScore: highScoreRef.current,
    selectedShipKey: SHIP_OPTIONS[0].key,
    pointer: null,
    stageClear: 0,
    unlockedStage: unlockedStageRef.current,
    nukeCooldown: 0,
    nukeFlash: 0,
    asteroidWarning: 0,
    randomEvent: null,
  }))
  const [multiplayerConnection, setMultiplayerConnection] = useState<{
    quality: MultiplayerConnectionQuality
    label: string
    rtt: number | null
  }>({ quality: 'good', label: 'Link good', rtt: null })

  useEffect(() => {
    multiplayerSessionRef.current = multiplayerSession ?? null
    if (multiplayerSession) coOpRunRef.current = true
  }, [multiplayerSession])

  const resetGuestPredictionState = useCallback(() => {
    guestPositionCorrectionRef.current = { x: 0, y: 0 }
    guestLocalShotsRef.current = []
    fireCaptureRef.current = null
    guestLocalFireCooldownRef.current = 0
    guestLocalWeaponCooldownsRef.current = { ...EMPTY_WEAPON_TIMERS }
    multiplayerHostSnapshotBufferRef.current = []
    multiplayerEnemySnapshotBufferRef.current = []
    multiplayerAsteroidSnapshotBufferRef.current = []
  }, [])

  const syncSnapshot = useCallback(() => {
    const player = playerRef.current
    const remotePlayer = remotePlayerRef.current
    const bossAlertBucket = bossAlertRef.current > 0 ? Math.ceil(bossAlertRef.current * 4) : 0
    const stageClearBucket = stageClearRef.current > 0 ? Math.ceil(stageClearRef.current * 30) : 0
    const nukeCooldownBucket = nukeCooldownRef.current > 0 ? Math.ceil(nukeCooldownRef.current) : 0
    const nukeFlashBucket = nukeFlashRef.current > 0 ? Math.ceil(nukeFlashRef.current * 10) : 0
    const asteroidWarningBucket = asteroidWarningRef.current > 0 ? Math.ceil(asteroidWarningRef.current * 4) : 0
    const randomEvent = randomEventRef.current
    const randomEventBucket = randomEvent ? `${randomEvent.kind}:${Math.ceil(randomEvent.warning * 4)}:${Math.ceil(randomEvent.age * 2)}` : ''
    const snapshotKey = [
      phaseRef.current,
      stageRef.current,
      waveRef.current,
      bossAlertBucket,
      bossMessageRef.current ?? '',
      highScoreRef.current,
      selectedShipRef.current.key,
      stageClearBucket,
      nukeCooldownBucket,
      nukeFlashBucket,
      asteroidWarningBucket,
      randomEventBucket,
      unlockedStageRef.current,
      player.hp,
      player.maxHp,
      Math.ceil(player.shield * 10),
      player.forceField,
      player.score,
      player.rank,
      remotePlayer?.ship.key ?? '',
      remotePlayer?.score ?? 0,
      remotePlayer?.hp ?? 0,
      ...WEAPON_KEYS.map((key) => player.weapons[key]),
    ].join('|')

    if (snapshotKeyRef.current === snapshotKey) return
    snapshotKeyRef.current = snapshotKey

    setSnapshot({
      phase: phaseRef.current,
      player: {
        ...player,
        weapons: { ...player.weapons },
        weaponTimers: { ...player.weaponTimers },
        weaponCooldowns: { ...player.weaponCooldowns },
      },
      allyPlayer: remotePlayer ? clonePlayer(remotePlayer) : null,
      shots: [],
      enemyShots: [],
      enemies: [],
      powerUps: [],
      sparks: [],
      ripples: [],
      wave: waveRef.current,
      stageTheme: stageRef.current,
      bossAlert: bossAlertRef.current,
      bossMessage: bossMessageRef.current,
      highScore: highScoreRef.current,
      selectedShipKey: selectedShipRef.current.key,
      pointer: null,
      stageClear: stageClearRef.current,
      unlockedStage: unlockedStageRef.current,
      nukeCooldown: nukeCooldownRef.current,
      nukeFlash: nukeFlashRef.current,
      asteroidWarning: asteroidWarningRef.current,
      randomEvent: cloneRaidRandomEvent(randomEventRef.current),
    })
  }, [])

  const getLivingPlayers = useCallback(() => {
    const players = [playerRef.current]
    const remotePlayer = remotePlayerRef.current
    if (remotePlayer) players.push(remotePlayer)
    return players.filter((player) => player.hp > 0)
  }, [])

  const getNearestLivingPlayer = useCallback((origin: Vec) => {
    const livingPlayers = getLivingPlayers()
    if (livingPlayers.length === 0) return playerRef.current

    let nearest = livingPlayers[0]
    let nearestDistance = distSq(origin, nearest)
    for (const player of livingPlayers.slice(1)) {
      const distance = distSq(origin, player)
      if (distance < nearestDistance) {
        nearest = player
        nearestDistance = distance
      }
    }

    return nearest
  }, [getLivingPlayers])

  const sendGamePayload = useCallback((payload: Record<string, unknown>) => {
    const session = multiplayerSessionRef.current
    if (!session || session.socket.readyState !== WebSocket.OPEN) return

    try {
      session.socket.send(JSON.stringify({ type: 'game-message', payload }))
    } catch {
      multiplayerSessionRef.current = null
    }
  }, [])

  const buildMultiplayerState = useCallback((): MultiplayerHostState => ({
    seq: ++multiplayerStateSeqRef.current,
    phase: phaseRef.current,
    hostPlayer: compactPlayer(playerRef.current),
    guestPlayer: remotePlayerRef.current ? compactPlayer(remotePlayerRef.current) : null,
    shots: shotsRef.current
      .filter(isNetworkVisible)
      .slice(-MULTIPLAYER_MAX_SHOTS)
      .map((shot) => compactVec(shot)),
    enemyShots: enemyShotsRef.current
      .filter(isNetworkVisible)
      .slice(-MULTIPLAYER_MAX_ENEMY_SHOTS)
      .map((shot) => compactVec(shot)),
    enemies: enemiesRef.current
      .filter((enemy) => enemy.isBoss || isNetworkVisible(enemy))
      .slice(-MULTIPLAYER_MAX_ENEMIES)
      .map((enemy) => compactVec(enemy)),
    asteroids: asteroidsRef.current
      .filter(isNetworkVisible)
      .slice(-MULTIPLAYER_MAX_ASTEROIDS)
      .map((asteroid) => compactVec(asteroid)),
    meteors: meteorsRef.current
      .filter(isNetworkVisible)
      .slice(-MULTIPLAYER_MAX_METEORS)
      .map((meteor) => compactVec(meteor)),
    ionStrikes: ionStrikesRef.current
      .slice(-MULTIPLAYER_MAX_ION_STRIKES)
      .map(cloneIonStrike),
    wrecks: wrecksRef.current
      .filter(isNetworkVisible)
      .slice(-MULTIPLAYER_MAX_WRECKS)
      .map((wreck) => compactVec(wreck)),
    powerUps: powerUpsRef.current
      .filter(isNetworkVisible)
      .slice(-MULTIPLAYER_MAX_POWERUPS)
      .map((powerUp) => compactVec(powerUp)),
    sparks: sparksRef.current
      .filter(isNetworkVisible)
      .slice(-MULTIPLAYER_MAX_SPARKS)
      .map((spark) => compactVec(spark)),
    ripples: ripplesRef.current
      .filter(isNetworkVisible)
      .slice(-MULTIPLAYER_MAX_RIPPLES)
      .map((ripple) => compactVec(ripple)),
    wave: waveRef.current,
    stageTheme: stageRef.current,
    bossAlert: bossAlertRef.current,
    bossMessage: bossMessageRef.current,
    highScore: highScoreRef.current,
    selectedShipKey: selectedShipRef.current.key,
    hostPointer: cloneVec(pointerVisualRef.current),
    guestPointer: cloneVec(remotePointerVisualRef.current),
    stageClear: stageClearRef.current,
    unlockedStage: unlockedStageRef.current,
    nukeCooldown: nukeCooldownRef.current,
    nukeFlash: nukeFlashRef.current,
    nukeStrike: nukeStrikeRef.current ? { ...nukeStrikeRef.current } : null,
    nukeBlastOrigin: { ...nukeBlastOriginRef.current },
    asteroidWarning: asteroidWarningRef.current,
    randomEvent: cloneRaidRandomEvent(randomEventRef.current),
  }), [])

  const applyMultiplayerState = useCallback((state: MultiplayerHostState) => {
    if (state.seq <= multiplayerLastAppliedSeqRef.current) return
    multiplayerLastAppliedSeqRef.current = state.seq

    const session = multiplayerSessionRef.current
    const now = performance.now()
    if (session && !session.isHost) {
      const hostBuffer = multiplayerHostSnapshotBufferRef.current
      hostBuffer.push({ at: now, player: clonePlayer(state.hostPlayer) })
      if (hostBuffer.length > MULTIPLAYER_REMOTE_BUFFER_MAX) {
        hostBuffer.splice(0, hostBuffer.length - MULTIPLAYER_REMOTE_BUFFER_MAX)
      }

      const enemyBuffer = multiplayerEnemySnapshotBufferRef.current
      enemyBuffer.push({ at: now, enemies: state.enemies.map(cloneEnemy) })
      if (enemyBuffer.length > MULTIPLAYER_REMOTE_BUFFER_MAX) {
        enemyBuffer.splice(0, enemyBuffer.length - MULTIPLAYER_REMOTE_BUFFER_MAX)
      }

      const asteroidBuffer = multiplayerAsteroidSnapshotBufferRef.current
      asteroidBuffer.push({ at: now, asteroids: (state.asteroids ?? []).map(cloneAsteroid) })
      if (asteroidBuffer.length > MULTIPLAYER_REMOTE_BUFFER_MAX) {
        asteroidBuffer.splice(0, asteroidBuffer.length - MULTIPLAYER_REMOTE_BUFFER_MAX)
      }

      const previousHost = multiplayerLastHostStateRef.current
      const previousTime = multiplayerLastHostPacketTimeRef.current
      if (previousHost && previousTime > 0) {
        const packetDt = clamp((now - previousTime) / 1000, 0.016, 0.18)
        multiplayerHostVisualVelocityRef.current = {
          x: clampNetworkVelocity((state.hostPlayer.x - previousHost.x) / packetDt),
          y: clampNetworkVelocity((state.hostPlayer.y - previousHost.y) / packetDt),
        }
      } else {
        multiplayerHostVisualVelocityRef.current = { x: 0, y: 0 }
      }
      multiplayerLastHostStateRef.current = clonePlayer(state.hostPlayer)
      multiplayerLastHostPacketTimeRef.current = now
    }

    playerRef.current = session && !session.isHost
      ? reconcilePlayerVisual(playerRef.current, state.hostPlayer, MULTIPLAYER_REMOTE_CORRECTION_BLEND) ?? clonePlayer(state.hostPlayer)
      : clonePlayer(state.hostPlayer)
    const nextGuestPlayer = state.guestPlayer ? clonePlayer(state.guestPlayer) : null
    if (session && !session.isHost) {
      const current = remotePlayerRef.current
      if (!nextGuestPlayer) {
        remotePlayerRef.current = null
        resetGuestPredictionState()
      } else if (!current || current.hp <= 0 || nextGuestPlayer.hp <= 0) {
        // Death / respawn: accept the authoritative position immediately
        remotePlayerRef.current = clonePlayer(nextGuestPlayer)
        resetGuestPredictionState()
      } else {
        // ── Client-side prediction reconciliation ──────────────────────────────────
        // Do NOT pull position toward the host's stale value every packet —
        // that would create a constant backward drag proportional to ping.
        // Instead, measure the error and drain it invisibly over ~125 ms.
        const errX = nextGuestPlayer.x - current.x
        const errY = nextGuestPlayer.y - current.y
        const errSq = errX * errX + errY * errY
        const ownCorrectionBlend = getOwnCorrectionBlend(multiplayerRttRef.current)
        if (errSq > MULTIPLAYER_GUEST_SNAP_DISTANCE_SQ) {
          // Extreme divergence only: snap immediately
          current.x = nextGuestPlayer.x
          current.y = nextGuestPlayer.y
          guestPositionCorrectionRef.current = { x: 0, y: 0 }
        } else {
          // Accumulate a small fraction of the error; predictGuestPlayer drains it
          guestPositionCorrectionRef.current.x = clamp(
            guestPositionCorrectionRef.current.x + errX * ownCorrectionBlend,
            -MULTIPLAYER_MAX_GUEST_CORRECTION,
            MULTIPLAYER_MAX_GUEST_CORRECTION,
          )
          guestPositionCorrectionRef.current.y = clamp(
            guestPositionCorrectionRef.current.y + errY * ownCorrectionBlend,
            -MULTIPLAYER_MAX_GUEST_CORRECTION,
            MULTIPLAYER_MAX_GUEST_CORRECTION,
          )
        }
        // Apply all non-positional attributes authoritatively and immediately
        current.hp = nextGuestPlayer.hp
        current.maxHp = nextGuestPlayer.maxHp
        current.invuln = Math.max(current.invuln, nextGuestPlayer.invuln)
        current.shield = nextGuestPlayer.shield
        current.forceField = nextGuestPlayer.forceField
        current.passiveForceFieldRegen = nextGuestPlayer.passiveForceFieldRegen
        current.optionTimer = nextGuestPlayer.optionTimer
        current.score = nextGuestPlayer.score
        current.rank = nextGuestPlayer.rank
        current.ship = nextGuestPlayer.ship
        current.weapons = { ...nextGuestPlayer.weapons }
        current.weaponTimers = { ...nextGuestPlayer.weaponTimers }
        // fireCooldown and weaponCooldowns are kept local so prediction timing is unaffected
      }
      // Expire locally predicted shots — confirmed shots from host have arrived
      if (guestLocalShotsRef.current.length > 0) {
        const expiry = now - getGuestShotTtlMs(multiplayerRttRef.current)
        guestLocalShotsRef.current = guestLocalShotsRef.current.filter((s) => s.spawnedAt > expiry)
      }
    } else {
      remotePlayerRef.current = nextGuestPlayer
    }
    shotsRef.current = state.shots.map((shot) => ({ ...shot }))
    enemyShotsRef.current = state.enemyShots.map((shot) => ({ ...shot }))
    enemiesRef.current = state.enemies.map((enemy) => ({ ...enemy }))
    asteroidsRef.current = (state.asteroids ?? []).map(cloneAsteroid)
    meteorsRef.current = (state.meteors ?? []).map(cloneMeteor)
    ionStrikesRef.current = (state.ionStrikes ?? []).map(cloneIonStrike)
    wrecksRef.current = (state.wrecks ?? []).map(cloneDerelictWreck)
    powerUpsRef.current = state.powerUps.map((powerUp) => ({ ...powerUp }))
    sparksRef.current = state.sparks.map((spark) => ({ ...spark }))
    ripplesRef.current = state.ripples.map((ripple) => ({ ...ripple }))
    const prevPhase = phaseRef.current
    const prevStageTheme = stageRef.current
    phaseRef.current = state.phase
    // Guest: when host transitions to victory, trigger the local blackout fade so the
    // cutscene fades in smoothly rather than appearing instantly.
    if (!multiplayerSessionRef.current?.isHost && prevPhase !== 'victory' && state.phase === 'victory') {
      victoryBlackoutRef.current = VICTORY_BLACKOUT_SECONDS
    }
    waveRef.current = state.wave
    stageRef.current = state.stageTheme
    bossAlertRef.current = state.bossAlert
    bossMessageRef.current = state.bossMessage
    highScoreRef.current = state.highScore
    const nextShip = SHIP_OPTIONS.find((ship) => ship.key === state.selectedShipKey) ?? selectedShipRef.current
    if (selectedShipRef.current.key !== nextShip.key) {
      selectedShipRef.current = nextShip
      setSelectedShipKey(nextShip.key)
    } else {
      selectedShipRef.current = nextShip
    }
    stageClearRef.current = state.stageClear
    if (state.stageClear > 0) {
      stageEntryRef.current = 0
    } else if (!session?.isHost && prevPhase === 'playing' && state.phase === 'playing' && prevStageTheme !== state.stageTheme) {
      stageEntryRef.current = STAGE_ENTRY_SECONDS
      resetGuestPredictionState()
    }
    unlockedStageRef.current = state.unlockedStage
    nukeCooldownRef.current = state.nukeCooldown
    nukeFlashRef.current = state.nukeFlash
    nukeStrikeRef.current = state.nukeStrike ? { ...state.nukeStrike } : null
    nukeBlastOriginRef.current = { ...state.nukeBlastOrigin }
    asteroidWarningRef.current = state.asteroidWarning ?? 0
    randomEventRef.current = cloneRaidRandomEvent(state.randomEvent ?? null)
    remotePointerVisualRef.current = cloneVec(state.guestPointer)

    const ownPlayer = session?.isHost ? state.hostPlayer : state.guestPlayer ?? state.hostPlayer
    const allyPlayer = session?.isHost ? state.guestPlayer : state.hostPlayer
    if (now - multiplayerLastSnapshotApplyRef.current < GAMEPLAY_SNAPSHOT_INTERVAL_MS && state.phase === 'playing') return
    multiplayerLastSnapshotApplyRef.current = now

    setSnapshot({
      phase: state.phase,
      player: clonePlayer(ownPlayer),
      allyPlayer: allyPlayer ? clonePlayer(allyPlayer) : null,
      shots: [],
      enemyShots: [],
      enemies: [],
      powerUps: [],
      sparks: [],
      ripples: [],
      wave: state.wave,
      stageTheme: state.stageTheme,
      bossAlert: state.bossAlert,
      bossMessage: state.bossMessage,
      highScore: state.highScore,
      selectedShipKey: ownPlayer.ship.key,
      pointer: null,
      stageClear: state.stageClear,
      unlockedStage: state.unlockedStage,
      nukeCooldown: state.nukeCooldown,
      nukeFlash: state.nukeFlash,
      asteroidWarning: state.asteroidWarning ?? 0,
      randomEvent: cloneRaidRandomEvent(state.randomEvent ?? null),
    })
  }, [resetGuestPredictionState])

  const sendMultiplayerInput = useCallback((time: number) => {
    const session = multiplayerSessionRef.current
    if (!session || session.isHost || time - multiplayerLastSendRef.current < MULTIPLAYER_INPUT_INTERVAL_MS) return
    if (session.socket.bufferedAmount > MULTIPLAYER_MAX_BUFFERED_BYTES) return
    multiplayerLastSendRef.current = time

    sendGamePayload({
      type: 'input',
      input: {
        target: cloneVec(pointerTargetRef.current),
        pointer: cloneVec(pointerVisualRef.current),
        position: remotePlayerRef.current ? compactVec(remotePlayerRef.current) : null,
        keys: [...keysRef.current],
        nuke: multiplayerLocalNukeRef.current,
        at: time,
      },
    })
  }, [sendGamePayload])

  const sendMultiplayerState = useCallback((time: number) => {
    const session = multiplayerSessionRef.current
    if (!session || !session.isHost || time - multiplayerLastSendRef.current < MULTIPLAYER_STATE_INTERVAL_MS) return
    if (session.socket.bufferedAmount > MULTIPLAYER_MAX_BUFFERED_BYTES) return
    multiplayerLastSendRef.current = time
    sendGamePayload({ type: 'state', state: buildMultiplayerState() })
  }, [buildMultiplayerState, sendGamePayload])

  const predictGuestPlayer = useCallback((dt: number) => {
    const session = multiplayerSessionRef.current
    if (!session || session.isHost || phaseRef.current !== 'playing') return

    const guestPlayer = remotePlayerRef.current
    if (!guestPlayer || guestPlayer.hp <= 0) return

    // Move own ship locally — never wait for the network
    movePlayerWithInput(guestPlayer, dt, pointerTargetRef.current, keysRef.current)

    // Drain accumulated position correction gradually so the fix is invisible
    const corr = guestPositionCorrectionRef.current
    if (corr.x !== 0 || corr.y !== 0) {
      const rate = Math.min(1, dt * MULTIPLAYER_CORRECTION_DRAIN_RATE)
      const applyX = corr.x * rate
      const applyY = corr.y * rate
      guestPlayer.x = clamp(guestPlayer.x + applyX, 4, 96)
      guestPlayer.y = clamp(guestPlayer.y + applyY, 13, 93)
      corr.x -= applyX
      corr.y -= applyY
      if (Math.abs(corr.x) < 0.001) corr.x = 0
      if (Math.abs(corr.y) < 0.001) corr.y = 0
    }

    // Local bullet prediction: fire using local cooldowns so P2 sees bullets immediately
    // This also plays the correct fire sound locally.
    guestLocalFireCooldownRef.current = Math.max(0, guestLocalFireCooldownRef.current - dt)
    const localWepCooldowns = guestLocalWeaponCooldownsRef.current
    for (const key of WEAPON_KEYS) {
      localWepCooldowns[key] = Math.max(0, localWepCooldowns[key] - dt)
    }
    // Temporarily swap player cooldowns so firePlayer uses local timing
    const savedFireCooldown = guestPlayer.fireCooldown
    const savedWeaponCooldowns = guestPlayer.weaponCooldowns
    guestPlayer.fireCooldown = guestLocalFireCooldownRef.current
    guestPlayer.weaponCooldowns = localWepCooldowns
    const capturedShots: Shot[] = []
    fireCaptureRef.current = capturedShots
    try {
      firePlayerRef.current(guestPlayer)
    } finally {
      fireCaptureRef.current = null
    }
    // Read back updated cooldowns, then restore the network-authoritative values
    guestLocalFireCooldownRef.current = guestPlayer.fireCooldown
    guestPlayer.fireCooldown = savedFireCooldown
    guestPlayer.weaponCooldowns = savedWeaponCooldowns
    if (capturedShots.length > 0) {
      const now = performance.now()
      for (const shot of capturedShots) {
        guestLocalShotsRef.current.push({ ...shot, spawnedAt: now })
      }
    }

    remotePointerVisualRef.current = cloneVec(pointerVisualRef.current)
  }, [])

  const advanceGuestVisuals = useCallback((dt: number) => {
    const session = multiplayerSessionRef.current
    if (!session || session.isHost || phaseRef.current !== 'playing') return

    const hostPlayer = playerRef.current
    const bufferedHost = getBufferedPlayerVisual(
      multiplayerHostSnapshotBufferRef.current,
      performance.now() - getRemoteInterpolationDelayMs(multiplayerRttRef.current),
    )
    if (bufferedHost) {
      playerRef.current = bufferedHost
    } else if (hostPlayer.hp > 0) {
      const velocity = multiplayerHostVisualVelocityRef.current
      hostPlayer.x = clamp(hostPlayer.x + velocity.x * dt, 0, WIDTH)
      hostPlayer.y = clamp(hostPlayer.y + velocity.y * dt, 0, HEIGHT)
    }

    for (const shot of shotsRef.current) {
      shot.x += shot.vx * dt
      shot.y += shot.vy * dt
    }
    keepNetworkVisibleInPlace(shotsRef.current)

    for (const shot of enemyShotsRef.current) {
      shot.x += shot.vx * dt
      shot.y += shot.vy * dt
    }
    keepNetworkVisibleInPlace(enemyShotsRef.current)

    const bufferedEnemies = getBufferedEnemyVisuals(
      multiplayerEnemySnapshotBufferRef.current,
      performance.now() - getRemoteInterpolationDelayMs(multiplayerRttRef.current),
    )
    if (bufferedEnemies) {
      enemiesRef.current = bufferedEnemies
    } else {
      for (const enemy of enemiesRef.current) {
        enemy.phase += dt
        enemy.shieldTime = Math.max(0, enemy.shieldTime - dt)
        enemy.chargeTimer = Math.max(0, enemy.chargeTimer - dt)
        if (enemy.isBoss) {
          enemy.y = Math.min(enemy.y + Math.max(0, enemy.vy) * dt, 42)
        } else {
          enemy.x = clamp(enemy.x + enemy.vx * dt, -MULTIPLAYER_ENTITY_MARGIN, WIDTH + MULTIPLAYER_ENTITY_MARGIN)
          enemy.y += enemy.vy * dt
        }
      }
    }
    keepNetworkVisibleInPlace(enemiesRef.current, (enemy) => enemy.isBoss)

    const bufferedAsteroids = getBufferedAsteroidVisuals(
      multiplayerAsteroidSnapshotBufferRef.current,
      performance.now() - getRemoteInterpolationDelayMs(multiplayerRttRef.current),
    )
    if (bufferedAsteroids) {
      asteroidsRef.current = bufferedAsteroids
    } else {
      for (const asteroid of asteroidsRef.current) {
        asteroid.x += asteroid.vx * dt
        asteroid.y += asteroid.vy * dt
        asteroid.spin += asteroid.spinSpeed * dt
      }
    }
    keepNetworkVisibleInPlace(asteroidsRef.current)

    for (const meteor of meteorsRef.current) {
      meteor.x += meteor.vx * dt
      meteor.y += meteor.vy * dt
      meteor.life -= dt
    }
    keepNetworkVisibleInPlace(meteorsRef.current)

    for (const wreck of wrecksRef.current) {
      wreck.x += wreck.vx * dt
      wreck.y += wreck.vy * dt
    }
    keepNetworkVisibleInPlace(wrecksRef.current)

    let ionWrite = 0
    for (const strike of ionStrikesRef.current) {
      if (strike.warmup > 0) strike.warmup = Math.max(0, strike.warmup - dt)
      else strike.life -= dt
      if (strike.life > 0) {
        ionStrikesRef.current[ionWrite] = strike
        ionWrite += 1
      }
    }
    ionStrikesRef.current.length = ionWrite

    for (const powerUp of powerUpsRef.current) {
      powerUp.y += powerUp.vy * dt
      powerUp.spin += dt * 180
    }
    keepNetworkVisibleInPlace(powerUpsRef.current)

    updateSparksInPlace(sparksRef.current, dt)
    updateRipplesInPlace(ripplesRef.current, dt)

    if (nukeStrikeRef.current) {
      nukeStrikeRef.current.age += dt
      if (nukeStrikeRef.current.age >= nukeStrikeRef.current.duration) nukeStrikeRef.current = null
    }
    nukeFlashRef.current = Math.max(0, nukeFlashRef.current - dt)
    bossAlertRef.current = Math.max(0, bossAlertRef.current - dt)
    asteroidWarningRef.current = Math.max(0, asteroidWarningRef.current - dt)
    if (randomEventRef.current) {
      randomEventRef.current.warning = Math.max(0, randomEventRef.current.warning - dt)
      if (randomEventRef.current.warning <= 0) {
        randomEventRef.current.age += dt
      }
    }

    // Advance locally predicted shots and expire stale ones
    const nowMs = performance.now()
    const expiry = nowMs - getGuestShotTtlMs(multiplayerRttRef.current)
    let localWrite = 0
    for (const shot of guestLocalShotsRef.current) {
      if (shot.spawnedAt > expiry) {
        shot.x += shot.vx * dt
        shot.y += shot.vy * dt
        guestLocalShotsRef.current[localWrite] = shot
        localWrite++
      }
    }
    guestLocalShotsRef.current.length = localWrite
  }, [])

  const updateMultiplayerConnection = useCallback((time: number) => {
    const session = multiplayerSessionRef.current
    if (!session) return
    if (time - multiplayerLastConnectionCheckRef.current < MULTIPLAYER_CONNECTION_CHECK_MS) return
    multiplayerLastConnectionCheckRef.current = time

    const socket = session.socket
    let quality: MultiplayerConnectionQuality = 'good'

    if (socket.readyState !== WebSocket.OPEN) {
      quality = 'offline'
    } else {
      if (
        time - multiplayerLastHeartbeatRef.current >= MULTIPLAYER_HEARTBEAT_INTERVAL_MS &&
        multiplayerHeartbeatSentAtRef.current === 0
      ) {
        multiplayerLastHeartbeatRef.current = time
        multiplayerHeartbeatSentAtRef.current = time
        try {
          socket.send(JSON.stringify({ type: 'ping' }))
        } catch {
          quality = 'offline'
        }
      }

      const heartbeatAge = multiplayerHeartbeatSentAtRef.current > 0
        ? time - multiplayerHeartbeatSentAtRef.current
        : 0
      if (heartbeatAge > MULTIPLAYER_HEARTBEAT_TIMEOUT_MS) {
        quality = 'offline'
        multiplayerHeartbeatSentAtRef.current = 0
      }

      const rtt = multiplayerRttRef.current
      if (quality !== 'offline' && rtt !== null) {
        if (rtt > 520) quality = 'poor'
        else if (rtt > 240) quality = 'ok'
      }

      if (quality !== 'offline' && socket.bufferedAmount > MULTIPLAYER_MAX_BUFFERED_BYTES * 0.65) {
        quality = 'poor'
      }

      if (!session.isHost) {
        const hostPacketAge = multiplayerLastHostPacketTimeRef.current > 0
          ? time - multiplayerLastHostPacketTimeRef.current
          : 0
        if (hostPacketAge > MULTIPLAYER_STATE_LOST_MS) quality = 'offline'
        else if (hostPacketAge > MULTIPLAYER_STATE_STALE_MS && quality === 'good') quality = 'poor'
      } else if (remotePlayerRef.current && multiplayerLastGuestInputAtRef.current > 0) {
        const guestInputAge = time - multiplayerLastGuestInputAtRef.current
        if (guestInputAge > MULTIPLAYER_GUEST_STALE_MS && quality === 'good') quality = 'poor'
      }
    }

    multiplayerConnectionQualityRef.current = quality
    const rtt = multiplayerRttRef.current
    const label = getConnectionLabel(quality, rtt)
    setMultiplayerConnection((current) => {
      const currentBucket = current.rtt === null ? null : Math.round(current.rtt / 50)
      const nextBucket = rtt === null ? null : Math.round(rtt / 50)
      if (current.quality === quality && current.label === label && currentBucket === nextBucket) return current
      return { quality, label, rtt }
    })
  }, [])

  useEffect(() => {
    const session = multiplayerSession
    if (!session) return

    multiplayerSessionRef.current = session
    const socket = session.socket

    socket.onmessage = null

    const handleSocketMessage = (event: MessageEvent) => {
      let message: RelayGameMessage
      try {
        message = JSON.parse(event.data) as RelayGameMessage
      } catch {
        return
      }

      if (message.type === 'room-update') {
        const room = 'room' in message
          ? message.room as { players?: RaidMultiplayerSession['players'] } | null
          : null
        const players = room?.players ?? []
        const otherPlayerStillConnected = players.some((player) => player.id !== session.peerId)
        if (!otherPlayerStillConnected) {
          if (session.isHost) {
            remotePlayerRef.current = null
            remotePointerTargetRef.current = null
            remotePointerVisualRef.current = null
            remoteKeysRef.current = new Set()
            multiplayerSessionRef.current = null
            syncSnapshot()
          } else {
            multiplayerSessionRef.current = null
            socket.close()
            if (raidBgmElementRef.current) {
              raidBgmElementRef.current.pause()
              raidBgmElementRef.current.currentTime = 0
              raidBgmElementRef.current = null
            }
            stopBGM()
            onClose()
          }
        } else {
          session.players = players
        }
        return
      }

      if (message.type === 'pong') {
        const sentAt = multiplayerHeartbeatSentAtRef.current
        if (sentAt > 0) {
          const rtt = performance.now() - sentAt
          multiplayerRttRef.current = multiplayerRttRef.current === null
            ? rtt
            : (multiplayerRttRef.current * 0.7) + (rtt * 0.3)
          multiplayerHeartbeatSentAtRef.current = 0
        }
        return
      }

      if (message.type !== 'game-message') return
      if (message.from === session.peerId) return

      const payload = 'payload' in message
        ? message.payload as { type?: unknown; input?: MultiplayerInput; state?: MultiplayerHostState }
        : null
      if (!payload || typeof payload !== 'object') return

      if (session.isHost && payload.type === 'input' && payload.input) {
        const input = payload.input
        multiplayerLastGuestInputAtRef.current = performance.now()
        remotePointerTargetRef.current = cloneVec(input.target)
        remotePointerVisualRef.current = cloneVec(input.pointer)
        remoteKeysRef.current = new Set(input.keys.map((key: string) => key.toLowerCase()))
        multiplayerRemoteNukeRef.current = input.nuke
        const remotePlayer = remotePlayerRef.current
        if (remotePlayer && remotePlayer.hp > 0 && input.position) {
          const targetX = clamp(input.position.x, 4, 96)
          const targetY = clamp(input.position.y, 13, 93)
          const dx = targetX - remotePlayer.x
          const dy = targetY - remotePlayer.y
          if (dx * dx + dy * dy > MULTIPLAYER_REMOTE_INPUT_SNAP_DISTANCE_SQ) {
            remotePlayer.x = targetX
            remotePlayer.y = targetY
          } else {
            remotePlayer.x += dx * MULTIPLAYER_REMOTE_INPUT_BLEND
            remotePlayer.y += dy * MULTIPLAYER_REMOTE_INPUT_BLEND
          }
        }
      } else if (!session.isHost && payload.type === 'state' && payload.state) {
        applyMultiplayerState(payload.state)
      }
    }

    socket.onclose = () => {
      multiplayerSessionRef.current = null
      multiplayerConnectionQualityRef.current = 'offline'
      setMultiplayerConnection({ quality: 'offline', label: 'Reconnecting', rtt: multiplayerRttRef.current })
    }

    socket.addEventListener('message', handleSocketMessage)

    return () => {
      socket.removeEventListener('message', handleSocketMessage)
    }
  }, [applyMultiplayerState, multiplayerSession, onClose, syncSnapshot])

  const addRipple = useCallback((x: number, y: number, color: string, size: number) => {
    ripplesRef.current.push({ id: rippleId++, x, y, color, size, life: 0.5, maxLife: 0.5 })
  }, [])

  const stopRaidBgm = useCallback(() => {
    if (raidBgmElementRef.current) {
      raidBgmElementRef.current.pause()
      raidBgmElementRef.current.currentTime = 0
      raidBgmElementRef.current = null
    }
    raidBgmModeRef.current = null
    raidBgmStageRef.current = 0
    raidBgmTrackRef.current = null
  }, [])

  const startRaidBgm = useCallback((stage: number, mode: RaidBgmMode = 'cruise') => {
    if (typeof window === 'undefined') return
    if (!getGameSoundEnabled()) {
      stopRaidBgm()
      return
    }

    const track =
      mode === 'ending' ? RAID_ENDING_BGM_TRACK :
        mode === 'boss' ? RAID_BOSS_BGM_TRACK :
          RAID_DEFAULT_BGM_TRACK
    const trackChanged = raidBgmTrackRef.current !== track
    if (raidBgmModeRef.current === mode && raidBgmStageRef.current === stage && raidBgmElementRef.current && !trackChanged) return

    if (trackChanged && raidBgmElementRef.current) {
      raidBgmElementRef.current.pause()
      raidBgmElementRef.current.currentTime = 0
      raidBgmElementRef.current = null
    }

    const existing = raidBgmElementRef.current
    const audio = existing ?? new Audio(track)
    audio.loop = true
    audio.preload = 'auto'

    const mix = getGameAudioMixSettings()
    const modeVolume = mode === 'ending' ? 0.42 : mode === 'boss' ? 0.58 : mode === 'combat' ? 0.34 : 0.22
    const stageRate = RAID_BGM_STAGE_RATES[(stage - 1) % RAID_BGM_STAGE_RATES.length]
    audio.volume = Math.max(0, Math.min(1, modeVolume * mix.master * mix.bgm))
    audio.playbackRate = mode === 'ending'
      ? 1
      : mode === 'boss'
      ? Math.max(0.95, Math.min(1.18, 1.02 + (stage % 5) * 0.025))
      : Math.max(0.75, Math.min(1.25, stageRate + (mode === 'combat' ? 0.03 : -0.04)))

    if (!existing) {
      audio.currentTime = mode === 'boss' || mode === 'ending' ? 0 : ((stage - 1) % 4) * 18
      raidBgmElementRef.current = audio
    } else if (raidBgmStageRef.current !== stage) {
      audio.currentTime = mode === 'boss' || mode === 'ending' ? 0 : ((stage - 1) % 4) * 18
    }
    raidBgmModeRef.current = mode
    raidBgmStageRef.current = stage
    raidBgmTrackRef.current = track

    void audio.play().catch(() => {
      raidBgmModeRef.current = null
      raidBgmStageRef.current = 0
      raidBgmTrackRef.current = null
    })
  }, [stopRaidBgm])

  const drawFxCanvas = useCallback((time = performance.now()) => {
    const canvas = fxCanvasRef.current
    const root = rootRef.current
    if (!canvas || !root) return

    const cssWidth = Math.max(1, root.clientWidth || window.innerWidth || 1)
    const cssHeight = Math.max(1, root.clientHeight || window.innerHeight || 1)
    const maxDpr = multiplayerSessionRef.current ? 1.35 : 2
    const gfxQuality = graphicsQualityRef.current
    const dprCap = gfxQuality === 'low' ? 1 : gfxQuality === 'medium' ? 1.25 : gfxQuality === 'high' ? 1.5 : maxDpr
    const dpr = Math.min(dprCap, window.devicePixelRatio || 1)
    const width = Math.max(1, Math.floor(cssWidth * dpr))
    const height = Math.max(1, Math.floor(cssHeight * dpr))

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
      fxCanvasContextRef.current = null
    }

    const ctx = fxCanvasContextRef.current ?? canvas.getContext('2d')
    if (!ctx) return
    fxCanvasContextRef.current = ctx
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = gfxQuality === 'low' || gfxQuality === 'medium' ? 'medium' : 'high'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssWidth, cssHeight)

    const toX = (value: number) => (value / WIDTH) * cssWidth
    const toY = (value: number) => (value / HEIGHT) * cssHeight
    const visualScale = clamp(Math.min(cssWidth, cssHeight) / 520, 0.8, 1.45)

    if (paletteClassRef.current !== root.className) {
      paletteClassRef.current = root.className
      paletteRef.current = readRaidPalette(root)
    }

    drawRaidBackground(ctx, paletteRef.current, cssWidth, cssHeight, time, gfxQuality, stageRef.current)

    const drawTrail = (shot: Shot, color: string, length: number, widthPx: number) => {
      const x = toX(shot.x)
      const y = toY(shot.y)
      const scaledLength = length * visualScale
      const scaledWidth = widthPx * visualScale
      const mag = Math.hypot(shot.vx, shot.vy) || 1
      const ux = shot.vx / mag
      const uy = shot.vy / mag
      const headX = x + ux * scaledLength * 0.32
      const headY = y + uy * scaledLength * 0.32
      const tailX = x - ux * scaledLength * 0.5
      const tailY = y - uy * scaledLength * 0.5
      const gradient = ctx.createLinearGradient(headX, headY, tailX, tailY)
      gradient.addColorStop(0, 'rgba(255,255,255,0.95)')
      gradient.addColorStop(0.35, color)
      gradient.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.strokeStyle = gradient
      ctx.lineWidth = scaledWidth
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(headX, headY)
      ctx.lineTo(tailX, tailY)
      ctx.stroke()
    }

    const drawOrb = (shot: Shot, color: string, radius: number) => {
      const x = toX(shot.x)
      const y = toY(shot.y)
      const scaledRadius = radius * visualScale
      const gradient = ctx.createRadialGradient(x, y, 1, x, y, scaledRadius)
      gradient.addColorStop(0, 'rgba(255,255,255,0.95)')
      gradient.addColorStop(0.35, color)
      gradient.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(x, y, scaledRadius, 0, Math.PI * 2)
      ctx.fill()
    }

    const drawEnemyBeamColumn = (shot: Shot) => {
      const x = toX(shot.x)
      const life = shot.life ?? FINAL_BOSS_BEAM_LIFE_SECONDS
      const maxLife = shot.maxLife ?? FINAL_BOSS_BEAM_LIFE_SECONDS
      const lifeRatio = clamp(life / Math.max(0.01, maxLife), 0, 1)
      const alpha = Math.min(1, Math.sin(lifeRatio * Math.PI) * 1.25)
      const width = Math.max(42, (shot.radius / WIDTH) * cssWidth * 2.2)
      const coreWidth = Math.max(8, width * 0.22)

      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = 0.24 * alpha
      ctx.fillStyle = 'rgba(14,165,233,1)'
      ctx.fillRect(x - width * 0.72, 0, width * 1.44, cssHeight)
      ctx.globalAlpha = 0.48 * alpha
      ctx.fillStyle = 'rgba(56,189,248,1)'
      ctx.fillRect(x - width * 0.5, 0, width, cssHeight)
      ctx.globalAlpha = 0.86 * alpha
      ctx.fillStyle = 'rgba(224,242,254,1)'
      ctx.fillRect(x - coreWidth * 0.5, 0, coreWidth, cssHeight)
      ctx.globalAlpha = 0.55 * alpha
      ctx.strokeStyle = 'rgba(125,249,255,1)'
      ctx.lineWidth = Math.max(2, visualScale * 2.4)
      ctx.beginPath()
      ctx.moveTo(x - width * 0.47, 0)
      ctx.lineTo(x - width * 0.47, cssHeight)
      ctx.moveTo(x + width * 0.47, 0)
      ctx.lineTo(x + width * 0.47, cssHeight)
      ctx.stroke()
      ctx.restore()
    }

    const drawMissile = (shot: Shot) => {
      const x = toX(shot.x)
      const y = toY(shot.y)
      const angle = Math.atan2(shot.vy, shot.vx) + Math.PI / 2
      const sprite = getHomingMissileSprite(visualScale)
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(angle)
      ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2)
      ctx.restore()
    }

    ctx.globalCompositeOperation = 'lighter'

    for (const ripple of ripplesRef.current) {
      const progress = 1 - ripple.life / ripple.maxLife
      const radius = (ripple.size * 4) * (0.45 + progress * 1.6)
      ctx.globalAlpha = Math.max(0, ripple.life / ripple.maxLife) * 0.8
      ctx.strokeStyle = ripple.color
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(toX(ripple.x), toY(ripple.y), radius, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    const drawPlayerShot = (shot: Shot) => {
      if (shot.kind === 'laser') drawTrail(shot, 'rgba(103,232,249,0.9)', 70, 7)
      else if (shot.kind === 'spread') drawTrail(shot, 'rgba(251,191,36,0.85)', 36, 5)
      else if (shot.kind === 'scatter') drawTrail(shot, 'rgba(0, 255, 191, 0.8)', 28, 4.5)
      else if (shot.kind === 'rocket') drawOrb(shot, 'rgb(249, 116, 22)', 12)
      else if (shot.kind === 'homing') drawMissile(shot)
      else drawTrail(shot, 'rgba(34,197,94,0.86)', 36, 5)
    }
    for (const shot of shotsRef.current) drawPlayerShot(shot)
    // Guest client-side prediction: draw locally fired shots immediately without waiting for network
    for (const shot of guestLocalShotsRef.current) drawPlayerShot(shot)

    for (const shot of enemyShotsRef.current) {
      if (shot.kind === 'orbShot') drawOrb(shot, 'rgba(168,85,247,0.92)', 12)
      else if (shot.kind === 'blade') drawTrail(shot, 'rgba(34,211,238,0.9)', 46, 7)
      else if (shot.kind === 'needle') drawTrail(shot, 'rgba(190,242,100,0.92)', 42, 5)
      else if (shot.kind === 'voidShot') drawOrb(shot, 'rgba(192,132,252,0.95)', 15)
      else if (shot.kind === 'beam' && shot.life !== undefined) drawEnemyBeamColumn(shot)
      else if (shot.kind === 'beam') drawTrail(shot, 'rgba(56,189,248,0.96)', 112, 14)
      else if (shot.kind === 'scatterBoss') drawTrail(shot, 'rgba(251,146,60,0.9)', 34, 5)
      else if (shot.kind === 'superShot') drawOrb(shot, 'rgba(251,191,36,0.95)', 14)
      else drawOrb(shot, 'rgba(251,113,133,0.9)', 10)
    }

    for (const spark of sparksRef.current) {
      ctx.globalAlpha = Math.max(0, spark.life / spark.maxLife)
      ctx.fillStyle = spark.color
      ctx.beginPath()
      ctx.arc(toX(spark.x), toY(spark.y), Math.max(1, spark.size * 0.42), 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.filter = 'none'

    drawRandomEventOverlay(ctx, cssWidth, cssHeight, randomEventRef.current, time)

    for (const asteroid of asteroidsRef.current) {
      drawAsteroidHazard(ctx, asteroid, toX, toY, cssWidth, time)
    }

    for (const wreck of wrecksRef.current) {
      drawDerelictWreck(ctx, wreck, toX, toY, cssWidth, time)
    }

    const normalEnemyFilter = getNormalEnemyFilter(time)
    for (const enemy of enemiesRef.current) {
      drawRaidEnemy(ctx, enemy, toX, toY, cssWidth, time, normalEnemyFilter)
    }

    // On the guest's screen playerRef = interpolated host, remotePlayerRef = own (guest) ship.
    // Always draw the player's OWN ship in PLAYER_COLOR (red) and the ally in ALLY_PLAYER_COLOR (cyan).
    const isGuestView = Boolean(multiplayerSessionRef.current && !multiplayerSessionRef.current.isHost)
    const ownShipRef = isGuestView ? remotePlayerRef.current : playerRef.current
    const allyShipRef = isGuestView ? playerRef.current : remotePlayerRef.current
    if (ownShipRef) drawRaidOptions(ctx, ownShipRef, toX, toY, cssWidth, time, PLAYER_COLOR)
    if (allyShipRef) drawRaidOptions(ctx, allyShipRef, toX, toY, cssWidth, time, ALLY_PLAYER_COLOR)
    if (ownShipRef) drawRaidPlayer(ctx, ownShipRef, phaseRef.current, toX, toY, cssWidth, time, PLAYER_COLOR)
    if (allyShipRef) drawRaidPlayer(ctx, allyShipRef, phaseRef.current, toX, toY, cssWidth, time, ALLY_PLAYER_COLOR)

    for (const powerUp of powerUpsRef.current) {
      drawPowerUpCanvas(ctx, powerUp, toX, toY, cssWidth, time)
    }

    drawFinalChargeLines(ctx, enemiesRef.current, toX, cssWidth, cssHeight, time)

    if (phaseRef.current === 'playing') {
      drawFingerGuide(ctx, pointerVisualRef.current, toX, toY)
    }

    for (const meteor of meteorsRef.current) {
      drawMeteorHazard(ctx, meteor, toX, toY, cssWidth)
    }

    for (const strike of ionStrikesRef.current) {
      drawIonStrike(ctx, strike, cssWidth, cssHeight, time)
    }

    if (nukeStrikeRef.current) {
      drawNukeMissile(ctx, nukeStrikeRef.current, toX, toY, cssWidth, time)
    }

    if (nukeFlashRef.current > 0) {
      drawNukeBlast(
        ctx,
        cssWidth,
        cssHeight,
        nukeFlashRef.current,
        time,
        toX(nukeBlastOriginRef.current.x),
        toY(nukeBlastOriginRef.current.y),
      )
    }

    drawAsteroidWarning(ctx, cssWidth, cssHeight, asteroidWarningRef.current, time)
    drawRandomEventWarning(ctx, cssWidth, cssHeight, randomEventRef.current, time)

    // Victory blackout: black full-screen fade-out after the fly-forward, before/during cutscene
    if (victoryBlackoutRef.current > 0) {
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = victoryBlackoutRef.current / VICTORY_BLACKOUT_SECONDS
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, cssWidth, cssHeight)
      ctx.globalAlpha = 1
    }
  }, [])

  const spawnSparks = useCallback((x: number, y: number, color: string, count: number, size = 5) => {
    const budget = Math.max(0, MAX_SPARKS - sparksRef.current.length)
    const spawnCount = Math.min(Math.ceil(count * 0.45), budget)
    for (let i = 0; i < spawnCount; i += 1) {
      const angle = Math.random() * Math.PI * 2
      const speed = 10 + Math.random() * 32
      sparksRef.current.push({
        id: sparkId++,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.3 + Math.random() * 0.6,
        maxLife: 0.9,
        color,
        size: size * (0.55 + Math.random() * 0.8),
      })
    }
  }, [])

  const spawnAsteroidCluster = useCallback(() => {
    if (asteroidsRef.current.length >= MAX_ASTEROIDS) return

    const stage = stageRef.current
    const remotePlayer = remotePlayerRef.current
    const powerPressure = getPowerScore(playerRef.current) + (remotePlayer ? getPowerScore(remotePlayer) * 0.7 : 0)
    const availableSlots = Math.max(0, MAX_ASTEROIDS - asteroidsRef.current.length)
    const centerLane = clamp(50 + (Math.random() - 0.5) * 54, 20, 80)
    const clusterPlan = [2]
    const companionCount = Math.min(availableSlots - 1, stage >= 9 ? 4 : 3)
    for (let index = 0; index < companionCount; index += 1) {
      clusterPlan.push(index === 0 || (stage >= 7 && Math.random() < 0.56) ? 1 : 0)
    }

    clusterPlan.slice(0, availableSlots).forEach((tier, index) => {
      const side = index % 2 === 0 ? 1 : -1
      const spread = index === 0 ? 0 : 9 + index * 5 + Math.random() * 7
      const lane = centerLane + side * spread + (Math.random() - 0.5) * 5
      const entryY = tier === 2 ? -18 : -10 - index * 3
      const driftSpeed = tier === 2 ? 7 : tier === 1 ? 14 : 20
      asteroidsRef.current.push(createAsteroidHazard(
        tier,
        clamp(lane, 12, 88),
        entryY,
        side * (3 + Math.random() * driftSpeed) + (Math.random() - 0.5) * 5,
        11 + Math.random() * 7 + stage * 0.16 + index * 0.8,
        stage,
        powerPressure,
      ))
    })
    spawnSparks(50, -4, '#fbbf24', 24, 7)
    addRipple(50, 7, '#fb923c', 13)
    playGameSound('countdown')
  }, [addRipple, spawnSparks])

  const startRandomRaidEvent = useCallback((kind: RaidRandomEventKind) => {
    randomEventRef.current = {
      kind,
      age: 0,
      duration: getRandomEventDuration(kind),
      warning: RANDOM_EVENT_WARNING_SECONDS,
      seed: Math.random() * 1000,
    }
    lastRandomEventKindRef.current = kind
    randomEventSpawnTimerRef.current = 0
    playGameSound('countdown')
    const x = kind === 'rift' ? 50 : kind === 'wreck' ? 16 : 50
    const color = kind === 'solar' ? '#fbbf24' : kind === 'ion' ? '#67e8f9' : kind === 'rift' ? '#a855f7' : '#fb7185'
    addRipple(x, kind === 'wreck' ? 24 : 38, color, kind === 'wreck' ? 18 : 14)
  }, [addRipple])

  const detonateNuke = useCallback((targetX = 50, targetY = 46) => {
    if (phaseRef.current !== 'playing') return
    const player = playerRef.current
    nukeBlastOriginRef.current = { x: targetX, y: targetY }
    nukeFlashRef.current = NUKE_FLASH_SECONDS
    player.invuln = Math.max(player.invuln, 0.75)
    enemyShotsRef.current = []

    let destroyed = 0
    let markedExplosions = 0
    const survivors: Enemy[] = []
    for (const enemy of enemiesRef.current) {
      if (enemy.hp <= 0) continue

      const inBlast = enemy.y > -18 && enemy.y < HEIGHT + 16
      if (!inBlast) {
        survivors.push(enemy)
        continue
      }

      if (enemy.isBoss) {
        const damage = getNukeBossDamage(enemy, stageRef.current)
        enemy.shieldTime = 0
        enemy.chargeTimer = 0
        enemy.hp = Math.max(1, enemy.hp - damage)
        survivors.push(enemy)
        addRipple(enemy.x, enemy.y, '#fbbf24', enemy.bossKind === 'final' ? 26 : 20)
        spawnSparks(enemy.x, enemy.y, '#fbbf24', 48, 9)
        continue
      }
      if (enemy.isMiniBoss) {
        const damage = Math.max(110, Math.round(enemy.maxHp * 0.48))
        enemy.shieldTime = 0
        enemy.hp = Math.max(1, enemy.hp - damage)
        survivors.push(enemy)
        addRipple(enemy.x, enemy.y, '#a855f7', 16)
        spawnSparks(enemy.x, enemy.y, '#c084fc', 34, 7)
        continue
      }

      destroyed += 1
      const scoreValue = 95 + waveRef.current * 14
      player.score += scoreValue
      if (remotePlayerRef.current) {
        remotePlayerRef.current.score += scoreValue
      }
      if (markedExplosions < 10) {
        markedExplosions += 1
        addRipple(enemy.x, enemy.y, '#fb923c', 12)
        spawnSparks(enemy.x, enemy.y, '#fb7185', 24, 6)
      }
    }

    enemiesRef.current = survivors
    const asteroidSurvivors: AsteroidHazard[] = []
    let vaporizedAsteroids = 0
    for (const asteroid of asteroidsRef.current) {
      const inBlast = asteroid.y > -18 && asteroid.y < HEIGHT + 16
      if (!inBlast) {
        asteroidSurvivors.push(asteroid)
        continue
      }

      vaporizedAsteroids += 1
      player.score += asteroid.tier === 2 ? 140 : asteroid.tier === 1 ? 65 : 24
      if (remotePlayerRef.current) {
        remotePlayerRef.current.score += asteroid.tier === 2 ? 140 : asteroid.tier === 1 ? 65 : 24
      }
      if (markedExplosions < 10) {
        markedExplosions += 1
        addRipple(asteroid.x, asteroid.y, asteroid.tier === 2 ? '#fb923c' : '#fbbf24', asteroid.tier === 2 ? 13 : 8)
        spawnSparks(asteroid.x, asteroid.y, '#fbbf24', asteroid.tier === 2 ? 28 : 14, asteroid.tier === 2 ? 7 : 5)
      }
    }
    asteroidsRef.current = asteroidSurvivors
    const vaporizedMeteors = meteorsRef.current.length
    meteorsRef.current = []
    ionStrikesRef.current = []
    for (const wreck of wrecksRef.current) {
      wreck.hp -= 260 + stageRef.current * 22
      addRipple(wreck.x, wreck.y, '#fbbf24', 16)
      spawnSparks(wreck.x, wreck.y, '#fbbf24', 32, 7)
    }
    wrecksRef.current = wrecksRef.current.filter((wreck) => wreck.hp > 0)
    killsSincePowerRef.current += destroyed
    if (player.score > highScoreRef.current) {
      highScoreRef.current = player.score
    }

    addRipple(targetX, targetY, '#fbbf24', 30)
    addRipple(player.x, player.y, '#fef3c7', 14)
    spawnSparks(targetX, targetY, '#fbbf24', 80, 9)
    playGameSound('explosion_big')
    if (destroyed >= 5) window.setTimeout(() => playGameSound('combo'), 120)
    if (vaporizedAsteroids >= 2 || vaporizedMeteors >= 4) window.setTimeout(() => playGameSound('score'), 180)
    syncSnapshot()
  }, [addRipple, spawnSparks, syncSnapshot])

  const activateNuke = useCallback((sourcePlayer = playerRef.current) => {
    const session = multiplayerSessionRef.current
    if (session && !session.isHost) {
      multiplayerLocalNukeRef.current += 1
      return
    }

    if (phaseRef.current !== 'playing' || stageClearRef.current > 0 || nukeCooldownRef.current > 0 || nukeStrikeRef.current) return
    if (sourcePlayer.hp <= 0) return

    const visibleEnemies = enemiesRef.current.filter((enemy) => (
      enemy.hp > 0 && enemy.y > -18 && enemy.y < HEIGHT + 16
    ))
    const visibleAsteroids = asteroidsRef.current.filter((asteroid) => (
      asteroid.hp > 0 && asteroid.y > -18 && asteroid.y < HEIGHT + 16
    ))
    const hasTargets = enemyShotsRef.current.length > 0 || visibleEnemies.length > 0 || visibleAsteroids.length > 0
    if (!hasTargets) return

    const player = sourcePlayer
    nukeCooldownRef.current = getNukeCooldownSeconds(stageRef.current)
    player.invuln = Math.max(player.invuln, 1.15)

    let targetX = 50
    let targetY = 46
    const priorityTarget = visibleEnemies.find((enemy) => enemy.isBoss) ?? visibleEnemies.find((enemy) => enemy.isMiniBoss)
    if (priorityTarget) {
      targetX = clamp(priorityTarget.x, 18, 82)
      targetY = clamp(priorityTarget.y + 5, 18, 58)
    } else if (visibleEnemies.length > 0) {
      targetX = clamp(visibleEnemies.reduce((sum, enemy) => sum + enemy.x, 0) / visibleEnemies.length, 18, 82)
      targetY = clamp(visibleEnemies.reduce((sum, enemy) => sum + enemy.y, 0) / visibleEnemies.length, 22, 58)
    } else if (enemyShotsRef.current.length > 0) {
      targetX = clamp(enemyShotsRef.current.reduce((sum, shot) => sum + shot.x, 0) / enemyShotsRef.current.length, 18, 82)
      targetY = clamp(enemyShotsRef.current.reduce((sum, shot) => sum + shot.y, 0) / enemyShotsRef.current.length, 22, 58)
    } else if (visibleAsteroids.length > 0) {
      targetX = clamp(visibleAsteroids.reduce((sum, asteroid) => sum + asteroid.x, 0) / visibleAsteroids.length, 18, 82)
      targetY = clamp(visibleAsteroids.reduce((sum, asteroid) => sum + asteroid.y, 0) / visibleAsteroids.length, 22, 58)
    }

    nukeBlastOriginRef.current = { x: targetX, y: targetY }
    nukeStrikeRef.current = {
      startX: player.x,
      startY: player.y - 2.4,
      targetX,
      targetY,
      age: 0,
      duration: NUKE_MISSILE_SECONDS,
    }
    addRipple(player.x, player.y, '#fef3c7', 13)
    spawnSparks(player.x, player.y, '#fb923c', 26, 6)
    playGameSound('rocket')
    syncSnapshot()
  }, [addRipple, spawnSparks, syncSnapshot])

  const resetGame = useCallback((startStage = 1, fullyBuffed = false) => {
    const session = multiplayerSessionRef.current
    if (session && !session.isHost) return

    const stage = clamp(startStage, 1, MAX_RAID_STAGE)
    const hostRoomPlayer = session?.players.find((roomPlayer) => roomPlayer.host)
    const guestRoomPlayer = session?.players.find((roomPlayer) => !roomPlayer.host)
    const hostShip = getShipByKey(hostRoomPlayer?.shipKey, selectedShipRef.current)
    const guestShip = getShipByKey(guestRoomPlayer?.shipKey, SHIP_OPTIONS[1])

    if (session?.isHost) {
      selectedShipRef.current = hostShip
      setSelectedShipKey(hostShip.key)
    }

    playerRef.current = getInitialPlayer(session?.isHost ? hostShip : selectedShipRef.current)
    applyStartingStageLevel(playerRef.current, stage)
    if (session?.isHost) {
      remotePlayerRef.current = getInitialPlayer(guestShip)
      applyStartingStageLevel(remotePlayerRef.current, stage)
      remotePlayerRef.current.x = 58
      remotePlayerRef.current.y = 84
    }
    if (fullyBuffed) {
      const p = playerRef.current
        ; WEAPON_KEYS.forEach((key) => {
          p.weapons[key] = WEAPON_STACK_CAPS[key]
        })
      p.optionTimer = 1
      p.shield = 8
      p.forceField = FORCE_FIELD_ARMOR
      p.hp = p.maxHp
    }
    shotsRef.current = []
    enemyShotsRef.current = []
    enemiesRef.current = []
    asteroidsRef.current = []
    meteorsRef.current = []
    ionStrikesRef.current = []
    wrecksRef.current = []
    powerUpsRef.current = []
    sparksRef.current = []
    ripplesRef.current = []
    phaseRef.current = 'playing'
    stageRef.current = stage
    waveRef.current = stage
    spawnTimerRef.current = 1.25
    formationTimerRef.current = 3.4
    bossTimerRef.current = stage === MAX_RAID_STAGE ? 24 : 36
    spawnLockRef.current = 0
    powerDropCooldownRef.current = 0
    killsSincePowerRef.current = 0
    bossAlertRef.current = 0
    bossMessageRef.current = null
    stageClearRef.current = 0
    stageEntryRef.current = 0
    pendingNextStageRef.current = null
    asteroidClusterTimerRef.current = stage >= 2 ? 30 + Math.random() * 24 : getAsteroidClusterInterval()
    asteroidSpawnDelayRef.current = 0
    asteroidWarningRef.current = 0
    randomEventRef.current = null
    randomEventTimerRef.current = 20 + Math.random() * 18
    randomEventSpawnTimerRef.current = 0
    lastRandomEventKindRef.current = null
    nukeCooldownRef.current = 0
    nukeFlashRef.current = 0
    nukeStrikeRef.current = null
    nukeBlastOriginRef.current = { x: 50, y: 46 }
    leaderboardSubmittedRef.current = false
    remotePointerTargetRef.current = null
    remotePointerVisualRef.current = null
    remoteKeysRef.current = new Set()
    resetGuestPredictionState()
    victoryPendingRef.current = false
    victoryBlackoutRef.current = 0
    // Do NOT reset multiplayerStateSeqRef here — the guest rejects packets with seq <= its last seen.
    // Keeping seq monotonically increasing ensures the guest accepts the first post-restart packet.
    multiplayerLastAppliedSeqRef.current = 0
    multiplayerLastSnapshotApplyRef.current = 0
    multiplayerLastHostStateRef.current = null
    multiplayerLastHostPacketTimeRef.current = 0
    multiplayerHostVisualVelocityRef.current = { x: 0, y: 0 }
    multiplayerLastHeartbeatRef.current = 0
    multiplayerHeartbeatSentAtRef.current = 0
    multiplayerLastConnectionCheckRef.current = 0
    multiplayerRttRef.current = null
    multiplayerLastGuestInputAtRef.current = 0
    multiplayerConnectionQualityRef.current = 'good'
    setMultiplayerConnection({ quality: 'good', label: 'Link good', rtt: null })
    multiplayerHandledRemoteNukeRef.current = 0
    multiplayerRemoteNukeRef.current = 0
    highScoreRef.current = getHighScore()
    unlockedStageRef.current = getUnlockedStage()
    stopBGM()
    startRaidBgm(stageRef.current, 'cruise')
    syncSnapshot()
  }, [resetGuestPredictionState, startRaidBgm, syncSnapshot])

  useEffect(() => {
    const session = multiplayerSessionRef.current
    if (!session || multiplayerStartedRef.current) return

    multiplayerStartedRef.current = true
    if (session.isHost) {
      const hostShip = getShipByKey(session.players.find((roomPlayer) => roomPlayer.host)?.shipKey)
      selectedShipRef.current = hostShip
      setSelectedShipKey(hostShip.key)
      resetGame(1)
    } else {
      multiplayerLastAppliedSeqRef.current = 0
      multiplayerLastSnapshotApplyRef.current = 0
      multiplayerLastHostStateRef.current = null
      multiplayerLastHostPacketTimeRef.current = 0
      multiplayerHostVisualVelocityRef.current = { x: 0, y: 0 }
      multiplayerLastHeartbeatRef.current = 0
      multiplayerHeartbeatSentAtRef.current = 0
      multiplayerLastConnectionCheckRef.current = 0
      multiplayerRttRef.current = null
      multiplayerLastGuestInputAtRef.current = 0
      multiplayerConnectionQualityRef.current = 'good'
      setMultiplayerConnection({ quality: 'good', label: 'Link good', rtt: null })
      resetGuestPredictionState()
      phaseRef.current = 'playing'
      stopBGM()
      syncSnapshot()
    }
  }, [multiplayerSession, resetGame, resetGuestPredictionState, syncSnapshot])

  const openBriefing = useCallback(() => {
    const session = multiplayerSessionRef.current
    if (session && !session.isHost) return
    phaseRef.current = 'briefing'
    setBriefingStep(0)
    playGameSound('select')
    syncSnapshot()
  }, [syncSnapshot])

  const chooseShip = useCallback((ship: ShipOption) => {
    const session = multiplayerSessionRef.current
    if (session && !session.isHost) return
    selectedShipRef.current = ship
    setSelectedShipKey(ship.key)
    playerRef.current = getInitialPlayer(ship)
    playGameSound('select')
    syncSnapshot()
  }, [syncSnapshot])

  const pauseGame = useCallback(() => {
    const session = multiplayerSessionRef.current
    if (session && !session.isHost) return
    if (phaseRef.current !== 'playing') return
    phaseRef.current = 'paused'
    stopRaidBgm()
    syncSnapshot()
  }, [stopRaidBgm, syncSnapshot])

  const resumeGame = useCallback(() => {
    const session = multiplayerSessionRef.current
    if (session && !session.isHost) return
    if (phaseRef.current !== 'paused') return
    phaseRef.current = 'playing'
    lastTimeRef.current = performance.now()
    startRaidBgm(
      stageRef.current,
      enemiesRef.current.some((enemy) => enemy.isBoss) ? 'boss' : enemiesRef.current.length > 0 ? 'combat' : 'cruise',
    )
    syncSnapshot()
  }, [startRaidBgm, syncSnapshot])

  const pushShot = useCallback((shot: Omit<Shot, 'id'>) => {
    // In capture mode (local prediction), redirect to the capture buffer instead of the shared shot list
    const target = fireCaptureRef.current ?? shotsRef.current
    target.push({ ...shot, id: shotId++ })
  }, [])

  const firePlayer = useCallback((sourcePlayer = playerRef.current) => {
    const player = sourcePlayer
    const stacks = player.weapons
    let totalStacks = 0
    for (const key of WEAPON_KEYS) totalStacks += stacks[key]
    if (player.fireCooldown > 0) return

    const baseDamage = getPlayerBaseAttack(player)
    const optionOffset = rootRef.current && rootRef.current.clientWidth < 640 ? 12 : 8.5
    const shipKey = player.ship.key

    const emitters = [{ x: player.x, y: player.y, scale: 1, main: true }]
    if (player.optionTimer > 0) {
      emitters.push(
        { x: clamp(player.x - optionOffset, 4, 96), y: player.y + 1.8, scale: 0.72, main: false },
        { x: clamp(player.x + optionOffset, 4, 96), y: player.y + 1.8, scale: 0.72, main: false },
      )
    }

    const firingWeapons = { ...EMPTY_WEAPON_FLAGS }
    for (const key of WEAPON_KEYS) {
      firingWeapons[key] = stacks[key] > 0 && player.weaponCooldowns[key] <= 0
    }

    emitters.forEach((emitter) => {
      const damage = Math.max(1, Math.ceil(baseDamage * emitter.scale))

      // ── BLACK COMET: original default attack ──
      if (shipKey === 'rocket') {
        pushShot({ x: emitter.x, y: emitter.y - 3.6, vx: 0, vy: -108, damage: Math.ceil((baseDamage + 3) * emitter.scale), kind: 'pulse', radius: 1.8 })
        if (firingWeapons.spread) {
          const fan = stacks.spread >= 2 ? [-34, -18, 18, 34] : [-24, 24]
          fan.forEach((vx) => pushShot({ x: emitter.x, y: emitter.y - 2.8, vx, vy: -86, damage, kind: 'spread', radius: 1.35 }))
        }
        if (firingWeapons.laser) {
          const side = stacks.laser >= 2 ? 1.6 : 0
          pushShot({ x: emitter.x - side, y: emitter.y - 5, vx: 0, vy: -132, damage: Math.ceil((baseDamage + 2 + stacks.laser) * emitter.scale), kind: 'laser', radius: 1.85, pierce: 1 + stacks.laser })
          if (stacks.laser >= 3) {
            pushShot({ x: emitter.x + side, y: emitter.y - 5, vx: 0, vy: -132, damage: Math.ceil((baseDamage + 2) * emitter.scale), kind: 'laser', radius: 1.65, pierce: 2 })
          }
        }
        if (firingWeapons.scatter) {
          const count = Math.min(8, 2 + stacks.scatter * 2)
          for (let i = 0; i < count; i++) {
            const angle = -Math.PI / 2 + (i - (count - 1) / 2) * 0.18
            pushShot({ x: emitter.x, y: emitter.y - 1.5, vx: Math.cos(angle) * 82, vy: Math.sin(angle) * 82, damage, kind: 'scatter', radius: 1.2 })
          }
        }
        if (firingWeapons.rocket) {
          const offsets = stacks.rocket >= 2 ? [-4.2, 4.2] : [0]
          offsets.forEach((offset) => {
            pushShot({ x: emitter.x + offset, y: emitter.y - 1, vx: offset * 1.7, vy: -72, damage: Math.ceil((baseDamage + 4 + stacks.rocket) * emitter.scale), kind: 'rocket', radius: 2.2 })
          })
        }
        if (emitter.main && firingWeapons.homing) {
          const salvoOffsets = [-5.4, 5.4, -7.2, 7.2]
          salvoOffsets.forEach((offset, index) => {
            const side = offset < 0 ? -1 : 1
            pushShot({ x: emitter.x + offset, y: emitter.y + (index < 2 ? -1.8 : 0.8), vx: side * (28 + index * 4), vy: -46 - index * 4, damage: Math.ceil((baseDamage + 4) * emitter.scale), kind: 'homing', radius: 2.1, turn: 5.2 })
          })
        }
      }

      // ── RED WRAITH: rapid twin needle streams ──
      else if (shipKey === 'fast') {
        pushShot({ x: emitter.x - 1.2, y: emitter.y - 3, vx: -3, vy: -110, damage, kind: 'needle' as any, radius: 1.1 })
        pushShot({ x: emitter.x + 1.2, y: emitter.y - 3, vx: 3, vy: -110, damage, kind: 'needle' as any, radius: 1.1 })
        if (firingWeapons.spread) {
          const fan = stacks.spread >= 2 ? [-34, -18, 18, 34] : [-24, 24]
          fan.forEach((vx) => pushShot({ x: emitter.x, y: emitter.y - 2.8, vx, vy: -86, damage, kind: 'spread', radius: 1.35 }))
        }
        if (firingWeapons.laser) {
          const side = stacks.laser >= 2 ? 1.6 : 0
          pushShot({ x: emitter.x - side, y: emitter.y - 5, vx: 0, vy: -132, damage: Math.ceil((baseDamage + 2 + stacks.laser) * emitter.scale), kind: 'laser', radius: 1.85, pierce: 1 + stacks.laser })
          if (stacks.laser >= 3) {
            pushShot({ x: emitter.x + side, y: emitter.y - 5, vx: 0, vy: -132, damage: Math.ceil((baseDamage + 2) * emitter.scale), kind: 'laser', radius: 1.65, pierce: 2 })
          }
        }
        if (firingWeapons.scatter) {
          const count = Math.min(8, 2 + stacks.scatter * 2)
          for (let i = 0; i < count; i++) {
            const angle = -Math.PI / 2 + (i - (count - 1) / 2) * 0.18
            pushShot({ x: emitter.x, y: emitter.y - 1.5, vx: Math.cos(angle) * 82, vy: Math.sin(angle) * 82, damage, kind: 'scatter', radius: 1.2 })
          }
        }
        if (firingWeapons.rocket) {
          const offsets = stacks.rocket >= 2 ? [-4.2, 4.2] : [0]
          offsets.forEach((offset) => {
            pushShot({ x: emitter.x + offset, y: emitter.y - 1, vx: offset * 1.7, vy: -72, damage: Math.ceil((baseDamage + 4 + stacks.rocket) * emitter.scale), kind: 'rocket', radius: 2.2 })
          })
        }
        if (emitter.main && firingWeapons.homing) {
          const salvoOffsets = [-5.4, 5.4, -7.2, 7.2]
          salvoOffsets.forEach((offset, index) => {
            const side = offset < 0 ? -1 : 1
            pushShot({ x: emitter.x + offset, y: emitter.y + (index < 2 ? -1.8 : 0.8), vx: side * (28 + index * 4), vy: -46 - index * 4, damage: Math.ceil((baseDamage + 4) * emitter.scale), kind: 'homing', radius: 2.1, turn: 5.2 })
          })
        }
      }

      // ── CRIMSON SAW: dual side-by-side gatling cannons ──
      else if (shipKey === 'gatling') {
        // left cannon
        pushShot({ x: emitter.x - 3.2, y: emitter.y - 3, vx: -2, vy: -98, damage, kind: 'pulse', radius: 1.25 })
        // right cannon
        pushShot({ x: emitter.x + 3.2, y: emitter.y - 3, vx: 2, vy: -98, damage, kind: 'pulse', radius: 1.25 })
        if (firingWeapons.spread) {
          const fan = stacks.spread >= 2 ? [-34, -18, 18, 34] : [-24, 24]
          fan.forEach((vx) => pushShot({ x: emitter.x, y: emitter.y - 2.8, vx, vy: -86, damage, kind: 'spread', radius: 1.35 }))
        }
        if (firingWeapons.laser) {
          const side = stacks.laser >= 2 ? 1.6 : 0
          pushShot({ x: emitter.x - side, y: emitter.y - 5, vx: 0, vy: -132, damage: Math.ceil((baseDamage + 2 + stacks.laser) * emitter.scale), kind: 'laser', radius: 1.85, pierce: 1 + stacks.laser })
          if (stacks.laser >= 3) {
            pushShot({ x: emitter.x + side, y: emitter.y - 5, vx: 0, vy: -132, damage: Math.ceil((baseDamage + 2) * emitter.scale), kind: 'laser', radius: 1.65, pierce: 2 })
          }
        }
        if (firingWeapons.scatter) {
          const count = Math.min(8, 2 + stacks.scatter * 2)
          for (let i = 0; i < count; i++) {
            const angle = -Math.PI / 2 + (i - (count - 1) / 2) * 0.18
            pushShot({ x: emitter.x, y: emitter.y - 1.5, vx: Math.cos(angle) * 82, vy: Math.sin(angle) * 82, damage, kind: 'scatter', radius: 1.2 })
          }
        }
        if (firingWeapons.rocket) {
          const offsets = stacks.rocket >= 2 ? [-4.2, 4.2] : [0]
          offsets.forEach((offset) => {
            pushShot({ x: emitter.x + offset, y: emitter.y - 1, vx: offset * 1.7, vy: -72, damage: Math.ceil((baseDamage + 4 + stacks.rocket) * emitter.scale), kind: 'rocket', radius: 2.2 })
          })
        }
        if (emitter.main && firingWeapons.homing) {
          const salvoOffsets = [-5.4, 5.4, -7.2, 7.2]
          salvoOffsets.forEach((offset, index) => {
            const side = offset < 0 ? -1 : 1
            pushShot({ x: emitter.x + offset, y: emitter.y + (index < 2 ? -1.8 : 0.8), vx: side * (28 + index * 4), vy: -46 - index * 4, damage: Math.ceil((baseDamage + 4) * emitter.scale), kind: 'homing', radius: 2.1, turn: 5.2 })
          })
        }
      }

      // ── NIGHT LANCE: single thick slow piercing laser ray ──
      else if (shipKey === 'laser') {
        pushShot({
          x: emitter.x,
          y: emitter.y - 4,
          vx: 0,
          vy: -95, // was -55, now actually reaches enemies
          damage: Math.ceil((baseDamage + 10 + stacks.laser * 3) * emitter.scale),
          kind: 'laser',
          radius: 7.5,
          pierce: 6, // was 4
        })
        // always fires homing salvo — signature ability
        // default 2 salvo — all emitters including scouts
        const defaultSalvo = [-5.4, 5.4]
        defaultSalvo.forEach((offset, index) => {
          const side = offset < 0 ? -1 : 1
          pushShot({ x: emitter.x + offset, y: emitter.y + (index < 2 ? -1.8 : 0.8), vx: side * (28 + index * 4), vy: -46 - index * 4, damage: Math.ceil((baseDamage + 3) * emitter.scale), kind: 'homing', radius: 2.1, turn: 5.2 })
        })

        // pickup bonus — 4 extra salvos, main ship only, fires every shot like the default
        if (emitter.main && stacks.homing > 0) {
          const bonusSalvo = [-5.4, 5.4, -7.2, 7.2]
          bonusSalvo.forEach((offset, index) => {
            const side = offset < 0 ? -1 : 1
            pushShot({ x: emitter.x + offset, y: emitter.y + (index < 2 ? -1.8 : 0.8), vx: side * (28 + index * 4), vy: -46 - index * 4, damage: Math.ceil((baseDamage + 4) * emitter.scale), kind: 'homing', radius: 2.1, turn: 5.2 })
          })
        }
        if (firingWeapons.spread) {
          const fan = stacks.spread >= 2 ? [-34, -18, 18, 34] : [-24, 24]
          fan.forEach((vx) => pushShot({ x: emitter.x, y: emitter.y - 2.8, vx, vy: -86, damage, kind: 'spread', radius: 1.35 }))
        }
        if (firingWeapons.laser) {
          const side = stacks.laser >= 2 ? 1.6 : 0
          pushShot({ x: emitter.x - side, y: emitter.y - 5, vx: 0, vy: -132, damage: Math.ceil((baseDamage + 2 + stacks.laser) * emitter.scale), kind: 'laser', radius: 1.85, pierce: 1 + stacks.laser })
          if (stacks.laser >= 3) {
            pushShot({ x: emitter.x + side, y: emitter.y - 5, vx: 0, vy: -132, damage: Math.ceil((baseDamage + 2) * emitter.scale), kind: 'laser', radius: 1.65, pierce: 2 })
          }
        }
        if (firingWeapons.scatter) {
          const count = Math.min(8, 2 + stacks.scatter * 2)
          for (let i = 0; i < count; i++) {
            const angle = -Math.PI / 2 + (i - (count - 1) / 2) * 0.18
            pushShot({ x: emitter.x, y: emitter.y - 1.5, vx: Math.cos(angle) * 82, vy: Math.sin(angle) * 82, damage, kind: 'scatter', radius: 1.2 })
          }
        }
        if (firingWeapons.rocket) {
          const offsets = stacks.rocket >= 2 ? [-4.2, 4.2] : [0]
          offsets.forEach((offset) => {
            pushShot({ x: emitter.x + offset, y: emitter.y - 1, vx: offset * 1.7, vy: -72, damage: Math.ceil((baseDamage + 4 + stacks.rocket) * emitter.scale), kind: 'rocket', radius: 2.2 })
          })
        }
      }

      // ── OBSIDIAN ARK: slow heavy rocket core ──
      else if (shipKey === 'dreadnought') {
        // CORE WEAPON (this was missing)
        pushShot({
          x: emitter.x,
          y: emitter.y - 4,
          vx: 0,
          vy: -72, // slow heavy missile feel
          damage: Math.ceil((baseDamage + 6) * emitter.scale),
          kind: 'rocket',
          radius: 3.2,
        })

        if (firingWeapons.spread) {
          const fan = stacks.spread >= 2 ? [-34, -18, 18, 34] : [-24, 24]
          fan.forEach((vx) =>
            pushShot({
              x: emitter.x,
              y: emitter.y - 2.8,
              vx,
              vy: -86,
              damage,
              kind: 'spread',
              radius: 1.35
            })
          )
        }

        if (firingWeapons.laser) {
          const side = stacks.laser >= 2 ? 1.6 : 0
          pushShot({
            x: emitter.x - side,
            y: emitter.y - 5,
            vx: 0,
            vy: -132,
            damage: Math.ceil((baseDamage + 2 + stacks.laser) * emitter.scale),
            kind: 'laser',
            radius: 1.85,
            pierce: 1 + stacks.laser
          })

          if (stacks.laser >= 3) {
            pushShot({
              x: emitter.x + side,
              y: emitter.y - 5,
              vx: 0,
              vy: -132,
              damage: Math.ceil((baseDamage + 2) * emitter.scale),
              kind: 'laser',
              radius: 1.65,
              pierce: 2
            })
          }
        }

        if (firingWeapons.scatter) {
          const count = Math.min(8, 2 + stacks.scatter * 2)

          for (let i = 0; i < count; i++) {
            const angle = -Math.PI / 2 + (i - (count - 1) / 2) * 0.18

            pushShot({
              x: emitter.x,
              y: emitter.y - 1.5,
              vx: Math.cos(angle) * 82,
              vy: Math.sin(angle) * 82,
              damage,
              kind: 'scatter',
              radius: 1.2
            })
          }
        }

        if (firingWeapons.rocket) {
          const offsets = stacks.rocket >= 2 ? [-4.2, 4.2] : [0]

          offsets.forEach((offset) => {
            pushShot({
              x: emitter.x + offset,
              y: emitter.y - 1,
              vx: offset * 1.2,
              vy: -62,
              damage: Math.ceil((baseDamage + 8 + stacks.rocket * 2) * emitter.scale),
              kind: 'rocket',
              radius: 3.8
            })
          })
        }

        if (emitter.main && firingWeapons.homing) {
          const salvoOffsets = [-5.4, 5.4, -7.2, 7.2]

          salvoOffsets.forEach((offset, index) => {
            const side = offset < 0 ? -1 : 1

            pushShot({
              x: emitter.x + offset,
              y: emitter.y + (index < 2 ? -1.8 : 0.8),
              vx: side * (22 + index * 3),
              vy: -40 - index * 3,
              damage: Math.ceil((baseDamage + 4) * emitter.scale),
              kind: 'homing',
              radius: 2.1,
              turn: 5.2
            })
          })
        }
      }

      // ── CROSSWING NOVA: tri-beam shotgun ──
      else if (shipKey === 'xwing') {
        const spread = stacks.spread >= 2 ? 0.34 : stacks.spread >= 1 ? 0.24 : 0.16
        const wingOffset = emitter.main ? 3.4 : 2.2
        // three wide beams per shot
        pushShot({ x: emitter.x - wingOffset, y: emitter.y - 3.7, vx: -Math.sin(spread) * 112, vy: -Math.cos(spread) * 112, damage: Math.ceil((baseDamage + 2) * emitter.scale), kind: 'laser', radius: 1.35, pierce: 1 + Math.floor(stacks.laser / 2) })
        pushShot({ x: emitter.x + wingOffset, y: emitter.y - 3.7, vx: Math.sin(spread) * 112, vy: -Math.cos(spread) * 112, damage: Math.ceil((baseDamage + 2) * emitter.scale), kind: 'laser', radius: 1.35, pierce: 1 + Math.floor(stacks.laser / 2) })
        pushShot({ x: emitter.x - wingOffset * 0.5, y: emitter.y - 5, vx: -5, vy: -126, damage: Math.ceil((baseDamage + 1) * emitter.scale), kind: 'needle' as any, radius: 0.95 })
        pushShot({ x: emitter.x + wingOffset * 0.5, y: emitter.y - 5, vx: 5, vy: -126, damage: Math.ceil((baseDamage + 1) * emitter.scale), kind: 'needle' as any, radius: 0.95 })
        if (firingWeapons.spread) {
          const fan = stacks.spread >= 2 ? [-34, -18, 18, 34] : [-24, 24]
          fan.forEach((vx) => pushShot({ x: emitter.x, y: emitter.y - 2.8, vx, vy: -86, damage, kind: 'spread', radius: 1.35 }))
        }
        if (firingWeapons.laser) {
          const side = stacks.laser >= 2 ? 1.6 : 0
          pushShot({ x: emitter.x - side, y: emitter.y - 5, vx: 0, vy: -132, damage: Math.ceil((baseDamage + 2 + stacks.laser) * emitter.scale), kind: 'laser', radius: 1.85, pierce: 1 + stacks.laser })
          if (stacks.laser >= 3) {
            pushShot({ x: emitter.x + side, y: emitter.y - 5, vx: 0, vy: -132, damage: Math.ceil((baseDamage + 2) * emitter.scale), kind: 'laser', radius: 1.65, pierce: 2 })
          }
        }
        if (firingWeapons.scatter) {
          const count = Math.min(8, 2 + stacks.scatter * 2)
          for (let i = 0; i < count; i++) {
            const angle = -Math.PI / 2 + (i - (count - 1) / 2) * 0.18
            pushShot({ x: emitter.x, y: emitter.y - 1.5, vx: Math.cos(angle) * 82, vy: Math.sin(angle) * 82, damage, kind: 'scatter', radius: 1.2 })
          }
        }
        if (firingWeapons.rocket) {
          const offsets = stacks.rocket >= 2 ? [-4.2, 4.2] : [0]
          offsets.forEach((offset) => {
            pushShot({ x: emitter.x + offset, y: emitter.y - 1, vx: offset * 1.7, vy: -72, damage: Math.ceil((baseDamage + 4 + stacks.rocket) * emitter.scale), kind: 'rocket', radius: 2.2 })
          })
        }
        if (emitter.main && firingWeapons.homing) {
          const salvoOffsets = [-5.4, 5.4, -7.2, 7.2]
          salvoOffsets.forEach((offset, index) => {
            const side = offset < 0 ? -1 : 1
            pushShot({ x: emitter.x + offset, y: emitter.y + (index < 2 ? -1.8 : 0.8), vx: side * (28 + index * 4), vy: -46 - index * 4, damage: Math.ceil((baseDamage + 4) * emitter.scale), kind: 'homing', radius: 2.1, turn: 5.2 })
          })
        }
      }

      // ── SPACE JET: single thin fast green laser line ──
      else if (shipKey === 'spaceEt') {
        const phaseDrift = (shotId % 3) - 1
        pushShot({
          x: emitter.x + phaseDrift * 0.55,
          y: emitter.y - 3.6,
          vx: phaseDrift * 3.2,
          vy: -188,  // fastest shot in the game
          damage,
          kind: 'needle' as any,
          radius: 0.72,  // thin
        })
        if (firingWeapons.spread) {
          const fan = stacks.spread >= 2 ? [-34, -18, 18, 34] : [-24, 24]
          fan.forEach((vx) => pushShot({ x: emitter.x, y: emitter.y - 2.8, vx, vy: -86, damage, kind: 'spread', radius: 1.35 }))
        }
        if (firingWeapons.laser) {
          const side = stacks.laser >= 2 ? 1.6 : 0
          pushShot({ x: emitter.x - side, y: emitter.y - 5, vx: 0, vy: -132, damage: Math.ceil((baseDamage + 2 + stacks.laser) * emitter.scale), kind: 'laser', radius: 1.85, pierce: 1 + stacks.laser })
          if (stacks.laser >= 3) {
            pushShot({ x: emitter.x + side, y: emitter.y - 5, vx: 0, vy: -132, damage: Math.ceil((baseDamage + 2) * emitter.scale), kind: 'laser', radius: 1.65, pierce: 2 })
          }
        }
        if (firingWeapons.scatter) {
          const count = Math.min(8, 2 + stacks.scatter * 2)
          for (let i = 0; i < count; i++) {
            const angle = -Math.PI / 2 + (i - (count - 1) / 2) * 0.18
            pushShot({ x: emitter.x, y: emitter.y - 1.5, vx: Math.cos(angle) * 82, vy: Math.sin(angle) * 82, damage, kind: 'scatter', radius: 1.2 })
          }
        }
        if (firingWeapons.rocket) {
          const offsets = stacks.rocket >= 2 ? [-4.2, 4.2] : [0]
          offsets.forEach((offset) => {
            pushShot({ x: emitter.x + offset, y: emitter.y - 1, vx: offset * 1.7, vy: -72, damage: Math.ceil((baseDamage + 4 + stacks.rocket) * emitter.scale), kind: 'rocket', radius: 2.2 })
          })
        }
        if (emitter.main && firingWeapons.homing) {
          const salvoOffsets = [-5.4, 5.4, -7.2, 7.2]
          salvoOffsets.forEach((offset, index) => {
            const side = offset < 0 ? -1 : 1
            pushShot({ x: emitter.x + offset, y: emitter.y + (index < 2 ? -1.8 : 0.8), vx: side * (28 + index * 4), vy: -46 - index * 4, damage: Math.ceil((baseDamage + 4) * emitter.scale), kind: 'homing', radius: 2.1, turn: 5.2 })
          })
        }
      }
      // ── FALLBACK ──
      else {
        pushShot({ x: emitter.x, y: emitter.y - 3.6, vx: 0, vy: -96, damage, kind: 'pulse', radius: 1.35 })
      }
    })

    if ((stacks.rocket > 0 || stacks.homing > 0) && Math.random() < 0.12) playGameSound('rocket')
      ; WEAPON_KEYS.forEach((key) => {
        if (firingWeapons[key]) {
          player.weaponCooldowns[key] = WEAPON_FIRE_INTERVALS[key]
        }
      })

    const baseInterval =
      shipKey === 'fast' ? 0.072 :       // Red Wraith — very rapid
        shipKey === 'gatling' ? 0.088 :    // Crimson Saw — dual gatling rhythm
          shipKey === 'dreadnought' ? 0.32 : // Obsidian Ark — slow heavy
            shipKey === 'laser' ? 1.0 :        // Night Lance — slow thick ray
              shipKey === 'spaceEt' ? 0.001 :    // Space Jet — fastest
                shipKey === 'xwing' ? 0.5 :       // Crosswing — shotgun pump rhythm
                  0.10                              // Black Comet — default

    const tunedBaseInterval = shipKey === 'spaceEt' ? 0.002 : shipKey === 'xwing' ? 0.34 : baseInterval
    const minFireCooldown = shipKey === 'spaceEt' ? 0.032 : 0.042
    player.fireCooldown = Math.max(minFireCooldown, (tunedBaseInterval - Math.min(0.045, totalStacks * 0.006)) / player.ship.fireRate)
    playGameSound(stacks.laser > 0 || shipKey === 'laser' || shipKey === 'xwing' ? 'laser' : 'shoot')
  }, [pushShot])
  // Keep the stable ref current so predictGuestPlayer can call firePlayer without a forward-reference issue
  firePlayerRef.current = firePlayer

  const spawnEnemyAt = useCallback((x: number, y: number, wave: number, pattern: number, trainSlot = 0, style?: FormationStyle, eliteKind?: MiniBossKind | null) => {
    const powerPressure = getPowerScore(playerRef.current)
    const stage = stageRef.current
    let activeEliteCount = 0
    for (const enemy of enemiesRef.current) {
      if (enemy.isMiniBoss && enemy.hp > 0) activeEliteCount += 1
    }
    const eliteCap = getMaxActiveEliteEnemies(stage, Boolean(multiplayerSessionRef.current))
    const randomEliteKind = eliteKind === undefined && activeEliteCount < eliteCap && Math.random() < getEliteEnemyChance(stage, wave, trainSlot, Boolean(style))
      ? pickEliteEnemyKind(stage, wave, trainSlot)
      : null
    const kind = eliteKind === undefined ? randomEliteKind : eliteKind
    const isElite = Boolean(kind)
    const color = style?.color ?? DARK_ENEMY_COLORS[Math.floor(Math.random() * DARK_ENEMY_COLORS.length)]
    const eliteX = clamp(Math.random() < 0.62 ? x + (Math.random() - 0.5) * 32 : 8 + Math.random() * 84, 8, 92)
    const originX = isElite ? clamp(eliteX + (Math.random() - 0.5) * 18, 12, 88) : style?.originX ?? x
    const hp = 2 + Math.floor(wave / 2) + Math.floor(powerPressure / 4)
    const eliteHpMultiplier = kind === 'brood' ? 12 : kind === 'lancer' ? 9.2 : 10.4
    const eliteStagePressure = Math.max(0, stage - 1)
    const eliteHp = Math.round((38 + hp * eliteHpMultiplier + eliteStagePressure * 11.5 + wave * 3.4 + powerPressure * 4.2) * (multiplayerSessionRef.current ? 1.36 : 1))
    enemiesRef.current.push({
      id: enemyId++,
      x: isElite ? eliteX : x,
      y: isElite ? Math.min(y, -7 - Math.random() * 16) : y,
      vx: kind === 'lancer' ? (Math.random() < 0.5 ? -1 : 1) * 10 : (Math.random() - 0.5) * (isElite ? 7 : 4),
      vy: isElite ? kind === 'brood' ? 10.4 : kind === 'lancer' ? 13.2 : 11.8 : 14 + Math.random() * 7 + wave * 0.38,
      hp: isElite ? eliteHp : hp,
      maxHp: isElite ? eliteHp : hp,
      radius: isElite ? kind === 'brood' ? 6.4 : kind === 'lancer' ? 5.7 : 6 : 3.7,
      variant: enemyId % 6,
      isBoss: false,
      isMiniBoss: isElite,
      fireCooldown: isElite ? kind === 'lancer' ? 0.95 : kind === 'brood' ? 1.28 : 1.08 : Math.max(1.25, 2.1 + Math.random() * 2.1 - wave * 0.04 - powerPressure * 0.025),
      phase: Math.random() * Math.PI * 2,
      color: isElite ? MINI_BOSS_COLORS[kind ?? 'stalker'] : color,
      pattern: isElite ? kind === 'brood' ? 7 : kind === 'lancer' ? 8 : 5 : style?.pattern ?? pattern,
      bossKind: null,
      miniBossKind: kind,
      shieldTime: isElite ? 0.45 : 0,
      originX,
      amplitude: isElite ? kind === 'brood' ? 12 + Math.random() * 8 : kind === 'lancer' ? 24 + Math.random() * 14 : 18 + Math.random() * 10 : style?.amplitude ?? (8 + Math.random() * 14),
      trainSlot,
      pathSpeed: isElite ? kind === 'lancer' ? 0.105 : 0.076 : style?.pathSpeed ?? (0.06 + Math.random() * 0.035),
      chargeCooldown: isElite ? kind === 'lancer' ? 3.4 : kind === 'brood' ? 4.8 : 4 : 999,
      chargeTimer: 0,
      chargeLane: 50,
      chargePattern: 'single',
    })
  }, [])

  const spawnFormation = useCallback(() => {
    const wave = waveRef.current
    const pattern = Math.floor(Math.random() * 4)
    const count = getFormationEnemyCount(wave)
    const originX = 18 + Math.random() * 64
    const formationStyle: FormationStyle = {
      color: DARK_ENEMY_COLORS[Math.floor(Math.random() * DARK_ENEMY_COLORS.length)],
      pattern,
      originX,
      amplitude: 10 + Math.random() * 18,
      pathSpeed: 0.06 + Math.random() * 0.035,
    }
    for (let i = 0; i < count; i += 1) {
      const x =
        pattern === 0 ? originX :
          pattern === 1 ? originX + Math.sin(i * 0.42) * 5 :
            pattern === 2 ? originX + (i % 2 === 0 ? -3 : 3) :
              originX + Math.cos(i * 0.35) * 4
      const y = -6 - i * 6.2
      spawnEnemyAt(clamp(x, 6, 94), y, wave, pattern, i, formationStyle)
    }
  }, [spawnEnemyAt])

  const spawnBoss = useCallback(() => {
    const wave = waveRef.current
    const stage = stageRef.current
    const player = playerRef.current
    const powerScore = getPowerScore(playerRef.current)
    const bossCycle: BossKind[] = ['carrier', 'orb', 'mantis', 'serpent', 'hydra', 'gate']
    const bossKind: BossKind = stage === MAX_RAID_STAGE ? 'final' : stage === 10 ? 'snake' : stage === 5 ? 'squid' : stage % 5 === 0 ? 'super' : bossCycle[(stage - 1) % bossCycle.length]
    const hpMultiplier =
      bossKind === 'final' ? 9.8 :
        bossKind === 'snake' ? 4.9 :
          bossKind === 'squid' ? 4.1 :
        bossKind === 'super' ? 3.45 :
          bossKind === 'gate' ? 1.75 :
            bossKind === 'hydra' ? 1.62 :
              bossKind === 'serpent' ? 1.48 :
                bossKind === 'mantis' ? 1.38 :
                  bossKind === 'orb' ? 1.3 :
                    1.16
    const stagePressure = Math.max(0, stage - 1)
    const multiplayerBossMultiplier = multiplayerSessionRef.current ? MULTIPLAYER_BOSS_HP_MULTIPLIER : 1
    const hp = Math.round((1450 + wave * 180 + stagePressure * 320 + powerScore * 90) * hpMultiplier * multiplayerBossMultiplier)
    const radius =
      bossKind === 'final' ? 27 :
        bossKind === 'squid' ? 22 :
          bossKind === 'snake' ? 11.8 :
            bossKind === 'super' ? 21 :
              bossKind === 'gate' ? 15 :
                bossKind === 'hydra' ? 14 :
                  bossKind === 'serpent' ? 13.4 :
                    bossKind === 'mantis' ? 12.8 :
                      11.4
    enemiesRef.current.push({
      id: enemyId++,
      x: 50,
      y: bossKind === 'final' ? -30 : bossKind === 'squid' || bossKind === 'snake' ? -27 : bossKind === 'super' || bossKind === 'gate' ? -24 : -16,
      vx: 0,
      vy: bossKind === 'final' ? 4.4 : bossKind === 'squid' || bossKind === 'snake' ? 4.9 : bossKind === 'super' || bossKind === 'gate' ? 5.3 : 7,
      hp,
      maxHp: hp,
      radius,
      variant: bossKind === 'squid' ? 4 : bossKind === 'snake' ? 5 : stage % 4,
      isBoss: true,
      isMiniBoss: false,
      fireCooldown: Math.max(0.75, 1 - stagePressure * 0.025),
      phase: Math.random() * Math.PI * 2,
      color: BOSS_COLORS[bossKind],
      pattern: bossKind === 'final' ? 9 : bossKind === 'snake' ? 8 : bossKind === 'squid' ? 7 : bossKind === 'super' ? 6 : bossCycle.indexOf(bossKind),
      bossKind,
      miniBossKind: null,
      shieldTime: (bossKind === 'final' ? 7.4 : bossKind === 'squid' || bossKind === 'snake' ? 5.8 : bossKind === 'super' || bossKind === 'gate' ? 5.4 : 3.8) + Math.min(2.2, stagePressure * 0.18),
      originX: 50,
      amplitude: bossKind === 'final' ? 34 : bossKind === 'snake' ? 36 : bossKind === 'squid' ? 24 : bossKind === 'super' ? 30 : bossKind === 'serpent' ? 28 : bossKind === 'gate' ? 18 : 23,
      trainSlot: 0,
      pathSpeed: 0.05,
      chargeCooldown: bossKind === 'final' ? 3.2 : bossKind === 'snake' ? 3.4 : bossKind === 'squid' ? 1.4 : 999,
      chargeTimer: 0,
      chargeLane: 50,
      chargePattern: 'single',
    })
    if (player.forceField > 0) {
      player.forceField = Math.min(FORCE_FIELD_ARMOR, player.forceField + 1)
    }
    bossAlertRef.current = 1
    bossMessageRef.current = 'incoming'
    startRaidBgm(stage, 'boss')
    playGameSound('countdown')
  }, [startRaidBgm])

  const spawnPowerUp = useCallback((x: number, y: number, guaranteed = false) => {
    const player = playerRef.current
    const powerScore = getPowerScore(player)

    if (!guaranteed) {
      killsSincePowerRef.current += 1
      if (powerDropCooldownRef.current > 0) return

      const pityBonus =
        killsSincePowerRef.current >= POWER_PITY_KILLS + 6 ? 0.5 :
          killsSincePowerRef.current >= POWER_PITY_KILLS ? 0.25 :
            0
      const lowHullBonus = player.hp <= Math.ceil(player.maxHp * 0.35) ? 0.06 : 0
      const chance = clamp(
        0.115 + waveRef.current * 0.004 + lowHullBonus + pityBonus - powerScore * 0.006,
        0.055,
        0.42,
      )

      if (Math.random() > chance) return
    }

    const candidates: PowerKind[] = []
    if (player.hp < player.maxHp) candidates.push('repair')
    if (player.forceField <= 1) candidates.push('forcefield', 'forcefield')
    if (player.shield < 2.5) candidates.push('shield')
    if (player.optionTimer <= 0) candidates.push('option')
      ; WEAPON_KEYS.forEach((key) => {
        const maxStack = WEAPON_STACK_CAPS[key]
        const copies = player.weapons[key] === 0 ? 3 : player.weapons[key] >= maxStack ? 1 : 2
        for (let i = 0; i < copies; i += 1) candidates.push(key)
      })

    const type = candidates[Math.floor(Math.random() * candidates.length)] ?? 'spread'
    killsSincePowerRef.current = 0
    powerDropCooldownRef.current = guaranteed ? NORMAL_POWER_DROP_COOLDOWN * 0.7 : NORMAL_POWER_DROP_COOLDOWN + powerScore * 0.55
    powerUpsRef.current.push({ id: powerId++, type, x, y, vy: 11, radius: 3, spin: Math.random() * 360 })
  }, [])

  const spawnLevelUpPowerUp = useCallback((x: number, y: number) => {
    killsSincePowerRef.current = 0
    powerDropCooldownRef.current = NORMAL_POWER_DROP_COOLDOWN * 0.45
    powerUpsRef.current.push({ id: powerId++, type: 'levelup', x, y, vy: 8.5, radius: 4.2, spin: Math.random() * 360 })
  }, [])

  const submitRaidLeaderboardScore = useCallback((score: number) => {
    const session = multiplayerSessionRef.current
    if (session && !session.isHost) return
    if (leaderboardSubmittedRef.current || score <= 0) return

    const leaderboardName = session
      ? session.players.map((roomPlayer) => roomPlayer.name).join(' + ')
      : playerName

    leaderboardSubmittedRef.current = true
    void submitLeaderboardScore({
      mode: session ? 'gradius_multiplayer' : 'gradius_solo',
      playerName: leaderboardName,
      score,
      shipKey: selectedShipRef.current.key,
      stage: stageRef.current,
    })
  }, [playerName])

  const damagePlayer = useCallback((amount: number, targetPlayer = playerRef.current) => {
    const player = targetPlayer
    if (player.hp <= 0 || player.invuln > 0) return
    if (player.forceField > 0) {
      player.forceField = Math.max(0, player.forceField - amount)
      player.invuln = 0.22
      spawnSparks(player.x, player.y, '#22d3ee', 24, 7)
      addRipple(player.x, player.y, '#22d3ee', player.forceField > 0 ? 12 : 17)
      playGameSound(player.forceField > 0 ? 'hit' : 'explosion')
      return
    }
    if (player.shield > 0) {
      player.shield = Math.max(0, player.shield - 1.2)
      player.invuln = 0.35
      spawnSparks(player.x, player.y, '#fcd34d', 20, 6)
      addRipple(player.x, player.y, '#fcd34d', 9)
      playGameSound('hit')
      return
    }
    player.hp -= amount
    player.invuln = 1.05
    spawnSparks(player.x, player.y, '#fca5a5', 22, 6)
    addRipple(player.x, player.y, '#ef4444', 10)
    playGameSound('hit')
    if (player.hp <= 0) {
      player.hp = 0
      playGameSound('gameover')
      spawnSparks(player.x, player.y, '#fb7185', 62, 8)
      addRipple(player.x, player.y, '#fb7185', 18)
      const session = multiplayerSessionRef.current
      const ally = player === playerRef.current ? remotePlayerRef.current : playerRef.current
      const allyAlive = Boolean(session && ally && ally.hp > 0)
      if (allyAlive) {
        player.hp = 0
        player.invuln = 2.2
        return
      }

      phaseRef.current = 'gameover'
      stopBGM()
      stopRaidBgm()
      if (!coOpRunRef.current && player.score > highScoreRef.current) {
        highScoreRef.current = player.score
        saveHighScore(player.score)
      }
      submitRaidLeaderboardScore(Math.max(playerRef.current.score, remotePlayerRef.current?.score ?? 0))
    }
  }, [addRipple, spawnSparks, stopRaidBgm, submitRaidLeaderboardScore])

  const destroyPlayerByBossCollision = useCallback((targetPlayer: Player) => {
    const player = targetPlayer
    if (player.hp <= 0) return
    player.hp = 0
    player.forceField = 0
    player.shield = 0
    player.invuln = 2.2
    playGameSound('gameover')
    spawnSparks(player.x, player.y, '#fb7185', 76, 9)
    addRipple(player.x, player.y, '#fb7185', 21)

    const session = multiplayerSessionRef.current
    const ally = player === playerRef.current ? remotePlayerRef.current : playerRef.current
    const allyAlive = Boolean(session && ally && ally.hp > 0)
    if (allyAlive) return

    phaseRef.current = 'gameover'
    stopBGM()
    stopRaidBgm()
    const finalScore = Math.max(playerRef.current.score, remotePlayerRef.current?.score ?? 0)
    if (!coOpRunRef.current && finalScore > highScoreRef.current) {
      highScoreRef.current = finalScore
      saveHighScore(finalScore)
    }
    submitRaidLeaderboardScore(finalScore)
  }, [addRipple, spawnSparks, stopRaidBgm, submitRaidLeaderboardScore])

  const fireEnemy = useCallback((enemy: Enemy, player: Player, time = performance.now()) => {
    if (enemy.isBoss) {
      const kind = enemy.bossKind ?? 'carrier'
      if (kind === 'squid') {
        const sweep = Math.sin(time / 320) * 18
        ;[-24, -12, 0, 12, 24].forEach((offset, index) => {
          enemyShotsRef.current.push({
            id: shotId++,
            x: enemy.x + offset + sweep * (index % 2 === 0 ? 0.18 : -0.18),
            y: enemy.y + 12,
            vx: sweep * 0.18 + offset * 0.24,
            vy: 38 + Math.abs(offset) * 0.22,
            damage: 1,
            kind: 'blade',
            radius: 2.25,
          })
        })
        ;[-15, 15].forEach((offset) => {
          const aimX = player.x - (enemy.x + offset)
          const aimY = player.y - enemy.y
          const mag = Math.hypot(aimX, aimY) || 1
          enemyShotsRef.current.push({ id: shotId++, x: enemy.x + offset, y: enemy.y + 2, vx: (aimX / mag) * 34, vy: (aimY / mag) * 34, damage: 1, kind: 'voidShot', radius: 1.9 })
        })
      }
      if (kind === 'snake') {
        const fangSpread = Math.sin(time / 260) * 7
        ;[-1, 0, 1].forEach((offset) => {
          const aimX = player.x + offset * 5 - enemy.x
          const aimY = player.y - enemy.y
          const mag = Math.hypot(aimX, aimY) || 1
          enemyShotsRef.current.push({ id: shotId++, x: enemy.x + offset * 4, y: enemy.y + 4, vx: (aimX / mag) * 42 + offset * fangSpread, vy: (aimY / mag) * 42, damage: 1, kind: 'needle', radius: 1.55 })
        })
        ;[-18, 18].forEach((offset) => {
          enemyShotsRef.current.push({ id: shotId++, x: enemy.x + offset, y: enemy.y + 10, vx: -offset * 0.55, vy: 32, damage: 1, kind: 'orbShot', radius: 1.65 })
        })
      }
      if (kind === 'carrier') {
        const fan = [-28, -14, 0, 14, 28]
        fan.forEach((vx) => enemyShotsRef.current.push({ id: shotId++, x: enemy.x, y: enemy.y + 7, vx, vy: 31, damage: 1, kind: 'boss', radius: 1.7 }))
      }
      if (kind === 'orb') {
        for (let i = 0; i < 8; i += 1) {
          const angle = (i / 8) * Math.PI * 2 + time / 900
          enemyShotsRef.current.push({ id: shotId++, x: enemy.x, y: enemy.y, vx: Math.cos(angle) * 25, vy: Math.sin(angle) * 25 + 19, damage: 1, kind: 'orbShot', radius: 1.45 })
        }
        for (let i = 0; i < 10; i += 1) {
          if (i === 2 || i === 7) continue
          const angle = -Math.PI * 0.92 + (i / 9) * Math.PI * 0.84
          enemyShotsRef.current.push({ id: shotId++, x: enemy.x, y: enemy.y + 5, vx: Math.cos(angle) * 34, vy: Math.sin(angle) * 14 + 36, damage: 1, kind: 'scatterBoss', radius: 1.35 })
        }
      }
      if (kind === 'serpent') {
        const lane = Math.sin(time / 280) * 18
          ;[-1, 0, 1].forEach((offset) => {
            enemyShotsRef.current.push({ id: shotId++, x: enemy.x + lane + offset * 8, y: enemy.y + 8, vx: offset * 10, vy: 38, damage: 1, kind: 'blade', radius: 1.9 })
          })
      }
      if (kind === 'mantis') {
        const sweep = Math.sin(time / 260) * 24
          ;[-1, 1].forEach((side) => {
            enemyShotsRef.current.push({ id: shotId++, x: enemy.x + side * 13, y: enemy.y + 5, vx: side * 24 + sweep * 0.24, vy: 40, damage: 1, kind: 'needle', radius: 1.55 })
            enemyShotsRef.current.push({ id: shotId++, x: enemy.x + side * 6, y: enemy.y + 10, vx: side * -10, vy: 35, damage: 1, kind: 'blade', radius: 1.9 })
          })
      }
      if (kind === 'hydra') {
        ;[-16, 0, 16].forEach((head, index) => {
          const aimX = player.x - (enemy.x + head)
          const aimY = player.y - enemy.y
          const mag = Math.hypot(aimX, aimY) || 1
          enemyShotsRef.current.push({ id: shotId++, x: enemy.x + head, y: enemy.y + 8, vx: (aimX / mag) * (28 + index * 3), vy: (aimY / mag) * 30, damage: 1, kind: index === 1 ? 'voidShot' : 'orbShot', radius: index === 1 ? 2 : 1.55 })
        })
      }
      if (kind === 'gate') {
        const phase = time / 380
          ;[-24, -8, 8, 24].forEach((lane, index) => {
            const drift = Math.sin(phase + index) * 4
            enemyShotsRef.current.push({ id: shotId++, x: enemy.x + lane + drift, y: enemy.y + 12, vx: drift * 0.8, vy: 30 + index * 2, damage: 1, kind: index % 2 === 0 ? 'superShot' : 'needle', radius: 1.85 })
          })
        const lane = Math.round((enemy.x + Math.sin(time / 520) * 16) / 10) * 10
        for (let i = 0; i < 6; i += 1) {
          enemyShotsRef.current.push({ id: shotId++, x: clamp(lane, 12, 88), y: enemy.y + 8 - i * 8, vx: 0, vy: 58, damage: 1, kind: 'beam', radius: 2.35 })
        }
      }
      if (kind === 'super') {
        const fan = [-34, -17, 0, 17, 34]
        fan.forEach((vx) => enemyShotsRef.current.push({ id: shotId++, x: enemy.x, y: enemy.y + 10, vx, vy: 34, damage: 1, kind: 'superShot', radius: 2 }))
        for (let i = 0; i < 6; i += 1) {
          const angle = (i / 6) * Math.PI * 2 - time / 800
          enemyShotsRef.current.push({ id: shotId++, x: enemy.x, y: enemy.y + 2, vx: Math.cos(angle) * 22, vy: Math.sin(angle) * 22 + 20, damage: 1, kind: 'orbShot', radius: 1.7 })
        }
      }
      if (kind === 'final') {
        playGameSound('laser')
        return
      }
      const aimX = player.x - enemy.x
      const aimY = player.y - enemy.y
      const mag = Math.hypot(aimX, aimY) || 1
      if (kind !== 'orb' && kind !== 'gate' && kind !== 'snake' && kind !== 'squid') {
        enemyShotsRef.current.push({ id: shotId++, x: enemy.x, y: enemy.y + 2, vx: (aimX / mag) * 38, vy: (aimY / mag) * 38, damage: 1, kind: kind === 'serpent' || kind === 'mantis' ? 'blade' : kind === 'super' ? 'superShot' : kind === 'hydra' ? 'voidShot' : 'boss', radius: 2 })
      }
      playGameSound('rocket')
      return
    }

    if (enemy.isMiniBoss) {
      const kind = enemy.miniBossKind ?? 'stalker'
      if (kind === 'brood') {
        for (let i = 0; i < 5; i += 1) {
          const angle = -Math.PI * 0.88 + (i / 4) * Math.PI * 0.76
          enemyShotsRef.current.push({ id: shotId++, x: enemy.x, y: enemy.y + 5, vx: Math.cos(angle) * 22, vy: Math.sin(angle) * 10 + 32, damage: 1, kind: i % 2 === 0 ? 'orbShot' : 'enemy', radius: 1.35 })
        }
        ;[-7, 7].forEach((offset) => {
          const aimX = player.x - (enemy.x + offset)
          const aimY = player.y - enemy.y
          const mag = Math.hypot(aimX, aimY) || 1
          enemyShotsRef.current.push({ id: shotId++, x: enemy.x + offset, y: enemy.y + 8, vx: (aimX / mag) * 28, vy: (aimY / mag) * 28, damage: 1, kind: 'voidShot', radius: 1.55 })
        })
      } else if (kind === 'lancer') {
        const aimX = player.x - enemy.x
        const aimY = player.y - enemy.y
        const mag = Math.hypot(aimX, aimY) || 1
        ;[-4, 4].forEach((offset, index) => {
          enemyShotsRef.current.push({ id: shotId++, x: enemy.x + offset, y: enemy.y + 7, vx: (aimX / mag) * 39 + offset * 1.7, vy: (aimY / mag) * 39 + index * 2, damage: 1, kind: 'needle', radius: 1.25 })
        })
        ;[-15, 15].forEach((vx) => {
          enemyShotsRef.current.push({ id: shotId++, x: enemy.x, y: enemy.y + 10, vx, vy: 34, damage: 1, kind: 'blade', radius: 1.45 })
        })
      } else {
        const sweep = Math.sin(time / 230) * 18
        ;[-1, 1].forEach((offset) => {
          enemyShotsRef.current.push({ id: shotId++, x: enemy.x + offset * 9, y: enemy.y + 8, vx: offset * 13 + sweep * 0.28, vy: 34 + Math.abs(offset) * 4, damage: 1, kind: offset === 0 ? 'boss' : 'blade', radius: offset === 0 ? 1.9 : 1.45 })
        })
        enemyShotsRef.current.push({ id: shotId++, x: enemy.x, y: enemy.y + 6, vx: sweep * 0.18, vy: 36, damage: 1, kind: 'boss', radius: 1.65 })
      }
      playGameSound(kind === 'lancer' ? 'laser' : 'rocket')
      return
    }

    if (Math.random() < 0.76) {
      const aimX = player.x - enemy.x
      const aimY = player.y - enemy.y
      const mag = Math.hypot(aimX, aimY) || 1
      enemyShotsRef.current.push({ id: shotId++, x: enemy.x, y: enemy.y + 2, vx: (aimX / mag) * 29, vy: (aimY / mag) * 29, damage: 1, kind: 'enemy', radius: 1.25 })
    }
  }, [])

  const updateGame = useCallback((dt: number) => {
    if (phaseRef.current !== 'playing') return

    const player = playerRef.current
    nukeCooldownRef.current = Math.max(0, nukeCooldownRef.current - dt)
    nukeFlashRef.current = Math.max(0, nukeFlashRef.current - dt)
    asteroidWarningRef.current = Math.max(0, asteroidWarningRef.current - dt)
    if (nukeStrikeRef.current) {
      const strike = nukeStrikeRef.current
      strike.age = Math.min(strike.duration, strike.age + dt)
      if (strike.age >= strike.duration) {
        nukeStrikeRef.current = null
        detonateNuke(strike.targetX, strike.targetY)
      }
    }
    if (stageClearRef.current > 0) {
      const before = stageClearRef.current
      stageClearRef.current = Math.max(0, stageClearRef.current - dt)
      const remotePlayer = remotePlayerRef.current
      pointerTargetRef.current = null
      pointerVisualRef.current = null
      asteroidWarningRef.current = 0
      asteroidSpawnDelayRef.current = 0
      randomEventRef.current = null
      randomEventSpawnTimerRef.current = 0
      player.x += (50 - player.x) * Math.min(1, dt * 4.8)
      player.y = Math.max(-26, player.y - dt * 38)
      player.invuln = Math.max(player.invuln, 0.45)
      if (remotePlayer) {
        remotePlayer.x += (58 - remotePlayer.x) * Math.min(1, dt * 4.8)
        remotePlayer.y = Math.max(-26, remotePlayer.y - dt * 38)
        remotePlayer.invuln = Math.max(remotePlayer.invuln, 0.45)
      }
      updateSparksInPlace(sparksRef.current, dt)
      updateRipplesInPlace(ripplesRef.current, dt)
      if (before > 0 && stageClearRef.current <= 0) {
        if (victoryPendingRef.current) {
          // Victory transition: fly-forward done — fade to black then show cutscene
          victoryPendingRef.current = false
          phaseRef.current = 'victory'
          victoryBlackoutRef.current = VICTORY_BLACKOUT_SECONDS
          startRaidBgm(MAX_RAID_STAGE, 'ending')
          return
        }
        const pendingNextStage = pendingNextStageRef.current
        if (pendingNextStage !== null) {
          stageRef.current = pendingNextStage
          waveRef.current = pendingNextStage
          pendingNextStageRef.current = null
          startRaidBgm(stageRef.current, 'cruise')
        }
        player.x = 50
        player.y = HEIGHT + 12
        player.invuln = Math.max(player.invuln, STAGE_ENTRY_SECONDS + 0.35)
        enemiesRef.current = []
        asteroidsRef.current = []
        meteorsRef.current = []
        ionStrikesRef.current = []
        wrecksRef.current = []
        shotsRef.current = []
        enemyShotsRef.current = []
        asteroidClusterTimerRef.current = getAsteroidClusterInterval()
        randomEventTimerRef.current = getRandomEventInterval()
        spawnLockRef.current = 1.2
        spawnTimerRef.current = 1.1
        formationTimerRef.current = 2.2
        stageEntryRef.current = STAGE_ENTRY_SECONDS
        pointerTargetRef.current = null
        pointerVisualRef.current = null
        if (remotePlayer) {
          remotePlayer.x = 58
          remotePlayer.y = HEIGHT + 14
          remotePlayer.invuln = Math.max(remotePlayer.invuln, STAGE_ENTRY_SECONDS + 0.35)
        }
        remotePointerTargetRef.current = null
        remotePointerVisualRef.current = null
      }
      return
    }

    if (stageEntryRef.current > 0) {
      stageEntryRef.current = Math.max(0, stageEntryRef.current - dt)
      const entryProgress = 1 - stageEntryRef.current / STAGE_ENTRY_SECONDS
      const easedEntry = 1 - Math.pow(1 - clamp(entryProgress, 0, 1), 3)
      player.x += (50 - player.x) * Math.min(1, dt * 6.4)
      player.y = HEIGHT + 12 + (82 - (HEIGHT + 12)) * easedEntry
      player.invuln = Math.max(player.invuln, 0.4)
      const remotePlayer = remotePlayerRef.current
      if (remotePlayer) {
        remotePlayer.x += (58 - remotePlayer.x) * Math.min(1, dt * 6.4)
        remotePlayer.y = HEIGHT + 14 + (84 - (HEIGHT + 14)) * easedEntry
        remotePlayer.invuln = Math.max(remotePlayer.invuln, 0.4)
      }
      pointerTargetRef.current = null
      pointerVisualRef.current = null
      remotePointerTargetRef.current = null
      remotePointerVisualRef.current = null
      updateSparksInPlace(sparksRef.current, dt)
      updateRipplesInPlace(ripplesRef.current, dt)
      return
    }

    if (player.hp > 0) {
      movePlayerWithInput(player, dt, pointerTargetRef.current, keysRef.current)
    }
    const remotePlayer = remotePlayerRef.current
    if (remotePlayer && remotePlayer.hp > 0) {
      movePlayerWithInput(remotePlayer, dt, remotePointerTargetRef.current, remoteKeysRef.current)
    }

    if (player.hp > 0) updatePlayerTimers(player, dt)
    if (remotePlayer && remotePlayer.hp > 0) updatePlayerTimers(remotePlayer, dt)
    if (player.hp > 0) firePlayer(player)
    if (remotePlayer && remotePlayer.hp > 0) firePlayer(remotePlayer)

    if (remotePlayer && multiplayerRemoteNukeRef.current > multiplayerHandledRemoteNukeRef.current) {
      multiplayerHandledRemoteNukeRef.current = multiplayerRemoteNukeRef.current
      activateNuke(remotePlayer)
    }

    spawnLockRef.current = Math.max(0, spawnLockRef.current - dt)
    const canSpawnStageEnemies = spawnLockRef.current <= 0 && stageClearRef.current <= 0
    spawnTimerRef.current -= dt
    formationTimerRef.current -= dt
    let bossActive = enemiesRef.current.some((enemy) => enemy.isBoss)
    if (!bossActive) {
      bossTimerRef.current = Math.max(0, bossTimerRef.current - dt)
    }
    const desiredBgmMode: RaidBgmMode | null = bossActive
      ? 'boss'
      : bossTimerRef.current <= RAID_BOSS_APPROACH_SILENCE_SECONDS
        ? null
        : enemiesRef.current.length > 0 ? 'combat' : 'cruise'
    if (!getGameSoundEnabled()) {
      if (raidBgmElementRef.current) stopRaidBgm()
    } else if (desiredBgmMode === null) {
      if (raidBgmElementRef.current) stopRaidBgm()
    } else if (raidBgmModeRef.current !== desiredBgmMode || raidBgmStageRef.current !== stageRef.current) {
      startRaidBgm(stageRef.current, desiredBgmMode)
    }
    powerDropCooldownRef.current = Math.max(0, powerDropCooldownRef.current - dt)
    if (bossMessageRef.current !== 'incoming') {
      bossAlertRef.current = Math.max(0, bossAlertRef.current - dt)
    }

    if (bossTimerRef.current <= 0 && !bossActive) {
      spawnBoss()
      bossActive = true
      bossTimerRef.current = 0
      waveRef.current += 1
    }
    if (canSpawnStageEnemies && !bossActive && formationTimerRef.current <= 0) {
      spawnFormation()
      formationTimerRef.current = getFormationSpawnSeconds(waveRef.current)
    }
    if (canSpawnStageEnemies && !bossActive && spawnTimerRef.current <= 0) {
      spawnEnemyAt(10 + Math.random() * 80, -6, waveRef.current, Math.floor(Math.random() * 4))
      spawnTimerRef.current = getSingleEnemySpawnSeconds(waveRef.current)
    }
    const anyRandomEventActive = Boolean(randomEventRef.current) || meteorsRef.current.length > 0 || ionStrikesRef.current.length > 0 || wrecksRef.current.length > 0
    const anyAsteroidEventActive = asteroidWarningRef.current > 0 || asteroidSpawnDelayRef.current > 0 || asteroidsRef.current.length > 0
    if (canSpawnStageEnemies && !bossActive && stageRef.current >= 2 && !anyRandomEventActive) {
      if (asteroidSpawnDelayRef.current > 0) {
        asteroidSpawnDelayRef.current = Math.max(0, asteroidSpawnDelayRef.current - dt)
        if (asteroidSpawnDelayRef.current <= 0) {
          spawnAsteroidCluster()
          asteroidClusterTimerRef.current = getAsteroidClusterInterval()
        }
      } else if (asteroidsRef.current.length === 0) {
        asteroidClusterTimerRef.current = Math.max(0, asteroidClusterTimerRef.current - dt)
        if (asteroidClusterTimerRef.current <= 0) {
          asteroidWarningRef.current = ASTEROID_CLUSTER_WARNING_SECONDS
          asteroidSpawnDelayRef.current = ASTEROID_CLUSTER_SPAWN_DELAY_SECONDS
          playGameSound('countdown')
        }
      }
    } else {
      asteroidSpawnDelayRef.current = 0
    }

    const activeRandomEvent = randomEventRef.current
    if (activeRandomEvent) {
      activeRandomEvent.warning = Math.max(0, activeRandomEvent.warning - dt)
      if (activeRandomEvent.warning <= 0) {
        activeRandomEvent.age += dt
        randomEventSpawnTimerRef.current = Math.max(0, randomEventSpawnTimerRef.current - dt)

        if (activeRandomEvent.kind === 'meteor' && randomEventSpawnTimerRef.current <= 0) {
          const spawnCount = Math.min(MAX_METEORS - meteorsRef.current.length, stageRef.current >= 8 ? 3 : 2)
          for (let index = 0; index < spawnCount; index += 1) {
            const x = 8 + Math.random() * 84
            meteorsRef.current.push({
              id: meteorId++,
              x,
              y: -8 - index * 4,
              vx: (Math.random() - 0.5) * 22,
              vy: 58 + Math.random() * 30 + stageRef.current * 0.6,
              radius: 1.35 + Math.random() * 1.3,
              life: 5,
              phase: Math.random() * Math.PI * 2,
            })
          }
          randomEventSpawnTimerRef.current = 0.28
        } else if (activeRandomEvent.kind === 'ion' && randomEventSpawnTimerRef.current <= 0) {
          if (ionStrikesRef.current.length < MAX_ION_STRIKES) {
            ionStrikesRef.current.push({
              id: ionStrikeId++,
              x: 12 + Math.random() * 76,
              width: 5.4 + Math.random() * 4.2,
              warmup: 0.95,
              life: 1.05,
              duration: 1.05,
            })
          }
          randomEventSpawnTimerRef.current = 1.15 + Math.random() * 0.35
        } else if (activeRandomEvent.kind === 'wreck' && randomEventSpawnTimerRef.current <= 0 && wrecksRef.current.length < MAX_WRECKS) {
          const leftEntry = Math.random() < 0.5
          const hp = 170 + stageRef.current * 18 + getPowerScore(player) * 5
          wrecksRef.current.push({
            id: wreckId++,
            x: leftEntry ? -18 : 118,
            y: 24 + Math.random() * 34,
            vx: leftEntry ? 9 + Math.random() * 4 : -9 - Math.random() * 4,
            vy: 3 + Math.random() * 5,
            width: 34 + Math.random() * 10,
            height: 11,
            hp,
            maxHp: hp,
            phase: Math.random() * Math.PI * 2,
          })
          randomEventSpawnTimerRef.current = 999
        } else if (activeRandomEvent.kind === 'ambush' && randomEventSpawnTimerRef.current <= 0) {
          const eliteCap = getMaxActiveEliteEnemies(stageRef.current, Boolean(multiplayerSessionRef.current))
          const activeEliteCount = enemiesRef.current.filter((enemy) => enemy.isMiniBoss).length
          if (activeEliteCount < eliteCap) {
            const side = Math.random() < 0.5 ? 8 : 92
            const kind = pickEliteEnemyKind(stageRef.current, waveRef.current, 0)
            spawnEnemyAt(side, 10 + Math.random() * 18, waveRef.current + 1, Math.floor(Math.random() * 4), 0, undefined, kind)
          }
          randomEventSpawnTimerRef.current = stageRef.current >= 10 ? 2.65 : 2.1
        } else if (activeRandomEvent.kind === 'solar' && randomEventSpawnTimerRef.current <= 0) {
          spawnSparks(70 + Math.random() * 20, 6 + Math.random() * 16, '#fbbf24', 10, 7)
          randomEventSpawnTimerRef.current = 0.8
        }

        if (activeRandomEvent.kind === 'rift') {
          const riftX = 50 + Math.sin(activeRandomEvent.age * 1.3 + activeRandomEvent.seed) * 18
          const pull = dt * 7.5
          for (const shot of enemyShotsRef.current) {
            shot.vx += clamp(riftX - shot.x, -18, 18) * pull * 0.06
          }
          for (const shot of shotsRef.current) {
            shot.vx += clamp(riftX - shot.x, -18, 18) * pull * 0.025
          }
          for (const powerUp of powerUpsRef.current) {
            powerUp.x += clamp(riftX - powerUp.x, -12, 12) * dt * 0.42
          }
          for (const asteroid of asteroidsRef.current) {
            asteroid.vx += clamp(riftX - asteroid.x, -18, 18) * pull * 0.018
          }
        }
      }

      if (activeRandomEvent.age >= activeRandomEvent.duration) {
        randomEventRef.current = null
        randomEventSpawnTimerRef.current = 0
        randomEventTimerRef.current = getRandomEventInterval()
      }
    } else if (canSpawnStageEnemies && !bossActive && stageRef.current >= 2 && !anyAsteroidEventActive) {
      randomEventTimerRef.current = Math.max(0, randomEventTimerRef.current - dt)
      if (randomEventTimerRef.current <= 0) {
        startRandomRaidEvent(pickNextRandomRaidEventKind(stageRef.current, stageRef.current % 2 === 0, lastRandomEventKindRef.current))
      }
    }

    let homingTargets: Map<number, Enemy> | null = null
    if (shotsRef.current.some((shot) => shot.kind === 'homing')) {
      homingTargets = new Map()
      for (const enemy of enemiesRef.current) {
        if (enemy.hp > 0 && enemy.y >= -10) homingTargets.set(enemy.id, enemy)
      }
    }

    const liveShots: Shot[] = []
    for (const shot of shotsRef.current) {
      if (shot.kind === 'homing') {
        shot.retargetTime = Math.max(0, (shot.retargetTime ?? 0) - dt)
        let target = shot.homingTargetId && homingTargets ? homingTargets.get(shot.homingTargetId) ?? null : null

        if (!target || shot.retargetTime <= 0) {
          target = acquireHomingTarget(shot, enemiesRef.current)
          shot.homingTargetId = target?.id
          shot.retargetTime = HOMING_RETARGET_SECONDS + (shot.id % 7) * HOMING_RETARGET_STAGGER_SECONDS
        }

        if (target) {
          const aimX = target.x - shot.x
          const aimY = target.y - shot.y
          const mag = Math.hypot(aimX, aimY) || 1
          const speed = Math.max(62, Math.hypot(shot.vx, shot.vy))
          const turn = Math.min(1, (shot.turn ?? 8) * dt)
          shot.vx += ((aimX / mag) * speed - shot.vx) * turn
          shot.vy += ((aimY / mag) * speed - shot.vy) * turn
        }
      }
      shot.x += shot.vx * dt
      shot.y += shot.vy * dt
      if (shot.y > -10 && shot.y < HEIGHT + 10 && shot.x > -10 && shot.x < WIDTH + 10) {
        liveShots.push(shot)
      }
    }
    shotsRef.current = liveShots

    const liveEnemyShots: Shot[] = []
    for (const shot of enemyShotsRef.current) {
      if (shot.life !== undefined) {
        shot.life = Math.max(0, shot.life - dt)
        if (shot.life <= 0) continue
      }
      shot.x += shot.vx * dt
      shot.y += shot.vy * dt
      const beamMargin = shot.kind === 'beam' && shot.life !== undefined ? 120 : 12
      if (shot.y > -beamMargin && shot.y < HEIGHT + beamMargin && shot.x > -12 && shot.x < WIDTH + 12) {
        liveEnemyShots.push(shot)
      }
    }
    enemyShotsRef.current = liveEnemyShots

    const now = performance.now()
    const nowSeconds = now / 1000
    const asteroidDriftTime = now / 900
    const asteroids = asteroidsRef.current
    let liveAsteroidCount = 0
    for (const asteroid of asteroids) {
      asteroid.x += asteroid.vx * dt
      asteroid.y += asteroid.vy * dt
      asteroid.spin += asteroid.spinSpeed * dt
      asteroid.vx += Math.sin(asteroidDriftTime + asteroid.phase) * dt * (asteroid.tier === 2 ? 1.1 : 1.8)
      const xPadding = Math.max(5, asteroid.radius * 0.72)
      const yPadding = Math.max(7, asteroid.radius * 0.5)
      const minX = xPadding
      const maxX = WIDTH - xPadding
      const minY = yPadding
      const maxY = HEIGHT - yPadding
      if (asteroid.x < minX || asteroid.x > maxX) {
        const rebound = Math.max(6, Math.abs(asteroid.vx) * 0.78)
        asteroid.x = clamp(asteroid.x, minX, maxX)
        asteroid.vx = asteroid.x <= minX ? rebound : -rebound
      }
      if (asteroid.y > maxY) {
        asteroid.y = maxY
        asteroid.vy = -Math.max(8, Math.abs(asteroid.vy) * 0.76)
      } else if (asteroid.y < minY && asteroid.vy < 0) {
        asteroid.y = minY
        asteroid.vy = Math.max(8, Math.abs(asteroid.vy) * 0.76)
      }
      if (asteroid.hp > 0 && asteroid.y > -asteroid.radius - 20) {
        asteroids[liveAsteroidCount] = asteroid
        liveAsteroidCount += 1
      }
    }
    asteroids.length = liveAsteroidCount

    const meteors = meteorsRef.current
    let liveMeteorCount = 0
    for (const meteor of meteors) {
      meteor.x += meteor.vx * dt
      meteor.y += meteor.vy * dt
      meteor.life -= dt
      meteor.vx += Math.sin(nowSeconds * 2.2 + meteor.phase) * dt * 3
      if (meteor.life > 0 && meteor.y < HEIGHT + 18 && meteor.x > -18 && meteor.x < WIDTH + 18) {
        meteors[liveMeteorCount] = meteor
        liveMeteorCount += 1
      }
    }
    meteors.length = liveMeteorCount

    const ionStrikes = ionStrikesRef.current
    let liveIonStrikeCount = 0
    for (const strike of ionStrikes) {
      if (strike.warmup > 0) {
        strike.warmup = Math.max(0, strike.warmup - dt)
      } else {
        strike.life -= dt
      }
      if (strike.life > 0) {
        ionStrikes[liveIonStrikeCount] = strike
        liveIonStrikeCount += 1
      }
    }
    ionStrikes.length = liveIonStrikeCount

    const wrecks = wrecksRef.current
    let liveWreckCount = 0
    for (const wreck of wrecks) {
      wreck.x += wreck.vx * dt
      wreck.y += wreck.vy * dt
      wreck.vy += Math.sin(nowSeconds + wreck.phase) * dt * 1.5
      if (wreck.hp > 0 && wreck.x > -28 && wreck.x < WIDTH + 28 && wreck.y > -14 && wreck.y < HEIGHT + 18) {
        wrecks[liveWreckCount] = wreck
        liveWreckCount += 1
      }
    }
    wrecks.length = liveWreckCount

    const enemies = enemiesRef.current
    let liveEnemyCount = 0
    for (const enemy of enemies) {
      const t = nowSeconds + enemy.phase
      const bossKind = enemy.bossKind ?? 'carrier'
      const bossX =
        bossKind === 'carrier' ? 50 + Math.sin(t * 0.7) * 26 :
          bossKind === 'orb' ? 50 + Math.sin(t * 1.4) * 18 :
            bossKind === 'squid' ? 50 + Math.sin(t * 0.58) * 23 + Math.sin(t * 1.4) * 4 :
              bossKind === 'snake' ? 50 + Math.sin(t * 1.05) * 34 + Math.sin(t * 2.1) * 6 :
                bossKind === 'serpent' ? 50 + Math.sin(t * 0.9) * 32 :
                  bossKind === 'mantis' ? 50 + Math.sin(t * 1.7) * 24 :
                    bossKind === 'hydra' ? 50 + Math.sin(t * 0.62) * 26 + Math.sin(t * 1.8) * 5 :
                      bossKind === 'gate' ? 50 + Math.sin(t * 0.38) * 14 :
                        bossKind === 'final' ? 50 + Math.sin(t * 0.36) * 31 + Math.sin(t * 1.45) * 7 :
                          50 + Math.sin(t * 0.42) * 30
      const bossYTarget =
        bossKind === 'final' ? 17 + Math.sin(t * 0.72) * 3 :
          bossKind === 'squid' ? 18 + Math.sin(t * 0.75) * 3 :
            bossKind === 'snake' ? 19 + Math.sin(t * 1.3) * 4 :
              bossKind === 'super' ? 20 + Math.sin(t * 0.8) * 3 :
                bossKind === 'gate' ? 18 + Math.sin(t * 0.65) * 2 :
                  bossKind === 'hydra' ? 19 + Math.cos(t * 0.9) * 4 :
                    bossKind === 'mantis' ? 19 + Math.sin(t * 1.4) * 5 :
                      bossKind === 'serpent' ? 20 + Math.cos(t * 1.1) * 5 :
                        bossKind === 'orb' ? 17 + Math.sin(t * 1.8) * 4 :
                          18
      const trainT = (enemy.y - enemy.trainSlot * 6.2) * enemy.pathSpeed + enemy.phase
      const trainX =
        enemy.pattern === 0 ? enemy.originX + Math.sin(trainT) * enemy.amplitude :
          enemy.pattern === 1 ? enemy.originX + Math.sin(trainT) * enemy.amplitude + Math.sin(trainT * 2.1) * 5 :
            enemy.pattern === 2 ? enemy.originX + Math.sin(trainT * 0.72) * enemy.amplitude * 0.7 :
              enemy.originX + Math.cos(trainT) * enemy.amplitude
      const miniKind = enemy.miniBossKind ?? 'stalker'
      const eliteTarget = enemy.isMiniBoss ? getNearestLivingPlayer(enemy) : player
      const miniBossX =
        miniKind === 'brood' ? enemy.originX + Math.sin(t * 0.72) * enemy.amplitude + Math.sin(t * 1.9) * 4 + (eliteTarget.x - enemy.originX) * 0.1 :
          miniKind === 'lancer' ? eliteTarget.x + Math.sin(t * 1.55) * enemy.amplitude :
            eliteTarget.x + Math.sin(t * 1.05) * enemy.amplitude
      const miniBossYTarget =
        miniKind === 'brood' ? clamp(eliteTarget.y - 58 + Math.sin(t * 0.8) * 4, 18, 34) :
          miniKind === 'lancer' ? clamp(eliteTarget.y - 50 + Math.cos(t * 1.35) * 5, 20, 40) :
            clamp(eliteTarget.y - 54 + Math.sin(t * 1.2) * 5, 18, 36)
      let chargeCooldown = enemy.chargeCooldown
      let chargeTimer = enemy.chargeTimer
      let chargeLane = enemy.chargeLane
      let chargePattern = enemy.chargePattern
      let fireCooldown = enemy.fireCooldown
      if (enemy.isBoss && bossKind === 'final' && enemy.y >= bossYTarget - 0.5) {
        if (chargeTimer > 0) {
          const beforeCharge = chargeTimer
          chargeTimer = Math.max(0, chargeTimer - dt)
          if (beforeCharge > 0 && chargeTimer <= 0) {
            const lanes = getFinalBossBeamLanes(chargeLane, chargePattern)
            const beamRadius = getFinalBossBeamRadius(chargePattern)
            lanes.forEach((lane) => {
              enemyShotsRef.current.push({
                id: shotId++,
                x: lane,
                y: 50,
                vx: 0,
                vy: 0,
                damage: 2,
                kind: 'beam',
                radius: beamRadius,
                life: FINAL_BOSS_BEAM_LIFE_SECONDS,
                maxLife: FINAL_BOSS_BEAM_LIFE_SECONDS,
              })
              addRipple(lane, 50, '#38bdf8', chargePattern === 'scatter' ? 14 : 22)
            })
            spawnSparks(enemy.x, enemy.y + 8, '#38bdf8', 84, 9)
            playGameSound('laser')
            chargeCooldown =
              chargePattern === 'scatter' ? 3.45 + Math.random() * 1.1 :
                chargePattern === 'trident' ? 3.05 + Math.random() * 1 :
                  chargePattern === 'pincer' ? 2.85 + Math.random() * 0.9 :
                    2.45 + Math.random() * 0.85
            fireCooldown = Math.max(fireCooldown, 4.8)
          }
        } else {
          chargeCooldown = Math.max(0, chargeCooldown - dt)
          if (chargeCooldown <= 0) {
            chargeTimer = FINAL_BOSS_BEAM_CHARGE_SECONDS
            const hpRatio = enemy.hp / enemy.maxHp
            const roll = Math.random()
            chargePattern =
              hpRatio < 0.34
                ? roll < 0.34 ? 'single' : roll < 0.62 ? 'pincer' : roll < 0.84 ? 'trident' : 'scatter'
                : hpRatio < 0.68
                  ? roll < 0.42 ? 'single' : roll < 0.72 ? 'pincer' : roll < 0.9 ? 'trident' : 'scatter'
                  : roll < 0.58 ? 'single' : roll < 0.86 ? 'pincer' : 'trident'
            chargeLane =
              chargePattern === 'scatter'
                ? clamp(player.x + (Math.random() - 0.5) * 20, 31, 69)
                : chargePattern === 'trident'
                  ? clamp(player.x + (Math.random() - 0.5) * 18, 23, 77)
                  : chargePattern === 'pincer'
                    ? clamp(player.x + (Math.random() - 0.5) * 22, 28, 72)
                    : clamp(player.x + (Math.random() - 0.5) * 12, 10, 90)
            chargeCooldown = 999
            const laneCount = getFinalBossBeamLanes(chargeLane, chargePattern).length
            addRipple(chargeLane, 84, '#38bdf8', laneCount >= 4 ? 16 : laneCount === 3 ? 18 : laneCount === 2 ? 20 : 24)
            spawnSparks(enemy.x, enemy.y + 6, '#38bdf8', 52, 8)
            playGameSound('countdown')
          }
        }
      }
      if (enemy.isBoss && bossKind === 'squid' && enemy.y >= bossYTarget - 0.5) {
        if (chargeTimer > 0) {
          const beforeCharge = chargeTimer
          chargeTimer = Math.max(0, chargeTimer - dt)
          if (beforeCharge > 0 && chargeTimer <= 0) {
            for (const target of getLivingPlayers()) {
              const inReachY = target.y > enemy.y + 8 && target.y < enemy.y + 48
              const inStrikeLane = Math.abs(target.x - chargeLane) < 8.5
              if (inReachY && inStrikeLane) {
                damagePlayer(2, target)
                spawnSparks(target.x, target.y, '#fb7185', 34, 8)
                addRipple(target.x, target.y, '#fb7185', 16)
              }
            }
            spawnSparks(chargeLane, enemy.y + 42, '#f472b6', 44, 8)
            addRipple(chargeLane, enemy.y + 42, '#f472b6', 18)
            playGameSound('hit')
            chargeCooldown = 2.45 + Math.random() * 1.35
            fireCooldown = Math.max(fireCooldown, 1.05)
          }
        } else {
          chargeCooldown = Math.max(0, chargeCooldown - dt)
          const closeTarget = getLivingPlayers().find((target) => (
            target.y > enemy.y + 12 &&
            target.y < enemy.y + 44 &&
            Math.abs(target.x - enemy.x) < 34
          ))
          if (closeTarget && chargeCooldown <= 0) {
            chargeTimer = 0.62
            chargeLane = clamp(closeTarget.x + (Math.random() - 0.5) * 4, 8, 92)
            chargeCooldown = 999
            addRipple(chargeLane, Math.min(92, closeTarget.y), '#f472b6', 15)
            spawnSparks(enemy.x, enemy.y + 10, '#a855f7', 28, 7)
            playGameSound('countdown')
          }
        }
      }
      if (enemy.isBoss && bossKind === 'snake' && enemy.y >= bossYTarget - 0.5) {
        if (chargeTimer > 0) {
          const beforeCharge = chargeTimer
          chargeTimer = Math.max(0, chargeTimer - dt)
          if (beforeCharge > 0 && chargeTimer <= 0) {
            const lane = clamp(chargeLane, 16, 84)
            for (let row = 0; row < 5; row += 1) {
              const gapSide = row % 2 === 0 ? -1 : 1
              const spread = 9 + row * 4
              ;[-1, 1].forEach((side) => {
                enemyShotsRef.current.push({
                  id: shotId++,
                  x: lane + side * spread,
                  y: enemy.y + 5 + row * 2,
                  vx: side * (10 + row * 2.2) + gapSide * 3,
                  vy: 29 + row * 3.2,
                  damage: 1,
                  kind: row % 2 === 0 ? 'orbShot' : 'needle',
                  radius: row % 2 === 0 ? 1.65 : 1.35,
                })
              })
            }
            ;[-1, 0, 1].forEach((offset) => {
              const aimX = lane + offset * 9 - enemy.x
              const aimY = Math.max(28, player.y - enemy.y)
              const mag = Math.hypot(aimX, aimY) || 1
              enemyShotsRef.current.push({ id: shotId++, x: enemy.x + offset * 5, y: enemy.y + 4, vx: (aimX / mag) * 34, vy: (aimY / mag) * 34, damage: 1, kind: 'needle', radius: 1.4 })
            })
            spawnSparks(enemy.x, enemy.y + 4, '#22d3ee', 36, 7)
            addRipple(lane, enemy.y + 28, '#22d3ee', 16)
            playGameSound('laser')
            chargeCooldown = 5.2 + Math.random() * 1.4
            fireCooldown = Math.max(fireCooldown, 1.45)
          }
        } else {
          chargeCooldown = Math.max(0, chargeCooldown - dt)
          if (chargeCooldown <= 0) {
            const target = getNearestLivingPlayer(enemy)
            chargeTimer = 0.78
            chargeLane = clamp(target.x + (Math.random() - 0.5) * 14, 16, 84)
            chargeCooldown = 999
            addRipple(chargeLane, enemy.y + 32, '#22d3ee', 18)
            spawnSparks(enemy.x, enemy.y + 3, '#38bdf8', 32, 7)
            playGameSound('countdown')
          }
        }
      }
      const nextFire = enemy.fireCooldown - dt
      const bossInPause = enemy.isBoss && nowSeconds % 6 > 3
      if (nextFire <= 0 && enemy.y > 0 && chargeTimer <= 0 && !bossInPause && bossKind !== 'final') {
        fireEnemy(enemy, getNearestLivingPlayer(enemy), now)
      }

      enemy.x = enemy.isBoss
        ? clamp(bossX, bossKind === 'final' ? 14 : bossKind === 'snake' ? 15 : bossKind === 'super' ? 20 : 16, bossKind === 'final' ? 86 : bossKind === 'snake' ? 85 : bossKind === 'super' ? 80 : 84)
        : enemy.isMiniBoss
          ? clamp(enemy.x + (miniBossX - enemy.x) * Math.min(1, dt * 3.6) + enemy.vx * dt * 0.24, 10, 90)
          : clamp(enemy.x + (trainX - enemy.x) * Math.min(1, dt * 5.8) + enemy.vx * dt, 4, 96)
      enemy.y = enemy.isBoss
        ? (enemy.y < bossYTarget ? Math.min(bossYTarget, enemy.y + enemy.vy * dt) : bossYTarget)
        : enemy.isMiniBoss
          ? (enemy.y < miniBossYTarget ? Math.min(miniBossYTarget, enemy.y + enemy.vy * dt) : miniBossYTarget)
          : enemy.y + enemy.vy * dt
      if (enemy.isBoss && bossMessageRef.current === 'incoming') {
        if (enemy.y >= Math.min(5, bossYTarget - 6)) {
          bossAlertRef.current = 0
          bossMessageRef.current = null
        } else {
          bossAlertRef.current = Math.max(bossAlertRef.current, 1)
        }
      }
      enemy.shieldTime = Math.max(0, enemy.shieldTime - dt)
      enemy.fireCooldown = fireCooldown !== enemy.fireCooldown ? fireCooldown : nextFire <= 0
        ? (enemy.isBoss
          ? Math.max(bossKind === 'final' ? 0.62 : bossKind === 'snake' ? 1.05 : bossKind === 'squid' ? 1.08 : 0.85, 1.82 - waveRef.current * 0.028 - stageRef.current * 0.035)
          : enemy.isMiniBoss
            ? Math.max(miniKind === 'lancer' ? 1.12 : 1.28, 1.84 - stageRef.current * 0.018 + Math.random() * 0.5)
            : Math.max(1.05, 2.4 + Math.random() * 1.9 - waveRef.current * 0.05))
        : nextFire
      enemy.chargeCooldown = chargeCooldown
      enemy.chargeTimer = chargeTimer
      enemy.chargeLane = chargeLane
      enemy.chargePattern = chargePattern

      if ((enemy.isMiniBoss || enemy.y < HEIGHT + 14) && enemy.hp > 0) {
        enemies[liveEnemyCount] = enemy
        liveEnemyCount += 1
      }
    }
    enemies.length = liveEnemyCount

    const powerUps = powerUpsRef.current
    let livePowerUpCount = 0
    for (const powerUp of powerUps) {
      if (powerUp.type === 'levelup') {
        const targetPlayer = getNearestLivingPlayer(powerUp)
        powerUp.x += (targetPlayer.x - powerUp.x) * Math.min(1, dt * 3.2)
        powerUp.y += powerUp.vy * dt + (targetPlayer.y - powerUp.y) * Math.min(1, dt * 0.8)
      } else {
        powerUp.y += powerUp.vy * dt
      }
      powerUp.spin += dt * 180
      if (powerUp.y < HEIGHT + 8) {
        powerUps[livePowerUpCount] = powerUp
        livePowerUpCount += 1
      }
    }
    powerUps.length = livePowerUpCount

    updateSparksInPlace(sparksRef.current, dt)
    updateRipplesInPlace(ripplesRef.current, dt)

    const spawnedAsteroids: AsteroidHazard[] = []
    const breakAsteroid = (asteroid: AsteroidHazard, awardScore: boolean) => {
      asteroid.hp = 0
      spawnedAsteroids.push(...splitAsteroidHazard(
        asteroid,
        stageRef.current,
        getPowerScore(playerRef.current) + (remotePlayerRef.current ? getPowerScore(remotePlayerRef.current) * 0.7 : 0),
      ))
      const scoreValue = asteroid.tier === 2 ? 190 : asteroid.tier === 1 ? 82 : 26
      if (awardScore) {
        player.score += scoreValue + stageRef.current * 4
        if (remotePlayerRef.current) {
          remotePlayerRef.current.score += scoreValue + stageRef.current * 4
        }
      }
      spawnSparks(asteroid.x, asteroid.y, asteroid.tier === 2 ? '#fb923c' : '#fbbf24', asteroid.tier === 2 ? 38 : 22, asteroid.tier === 2 ? 8 : 5)
      addRipple(asteroid.x, asteroid.y, asteroid.tier === 2 ? '#fb923c' : '#fbbf24', asteroid.tier === 2 ? 15 : 9)
      playGameSound(asteroid.tier === 2 ? 'explosion_big' : 'explosion')
    }

    for (const shot of shotsRef.current) {
      if (shot.y <= -50) continue
      for (const asteroid of asteroidsRef.current) {
        if (asteroid.hp <= 0) continue
        const hitRange = shot.radius + asteroid.radius
        if (
          Math.abs(shot.x - asteroid.x) <= hitRange &&
          Math.abs(shot.y - asteroid.y) <= hitRange &&
          distSq(shot, asteroid) <= hitRange * hitRange
        ) {
          asteroid.hp -= shot.damage
          spawnSparks(shot.x, shot.y, '#fbbf24', asteroid.tier === 2 ? 5 : 3, asteroid.tier === 2 ? 5 : 3)
          if (shot.kind === 'rocket') {
            addRipple(shot.x, shot.y, '#fb923c', 8)
            playGameSound('explosion')
          }
          if (shot.pierce && shot.pierce > 0) {
            shot.pierce -= 1
          } else {
            shot.y = -999
          }
          if (asteroid.hp <= 0) {
            breakAsteroid(asteroid, true)
          }
          break
        }
      }
    }

    for (const shot of shotsRef.current) {
      if (shot.y <= -50) continue
      for (const wreck of wrecksRef.current) {
        if (wreck.hp <= 0) continue
        const hitX = wreck.width * 0.5 + shot.radius
        const hitY = wreck.height * 0.55 + shot.radius
        if (Math.abs(shot.x - wreck.x) <= hitX && Math.abs(shot.y - wreck.y) <= hitY) {
          wreck.hp -= shot.damage
          spawnSparks(shot.x, shot.y, '#94a3b8', 5, 5)
          if (shot.pierce && shot.pierce > 0) {
            shot.pierce -= 1
          } else {
            shot.y = -999
          }
          if (wreck.hp <= 0) {
            player.score += 240 + stageRef.current * 18
            if (remotePlayerRef.current) remotePlayerRef.current.score += 240 + stageRef.current * 18
            spawnSparks(wreck.x, wreck.y, '#fb7185', 44, 8)
            addRipple(wreck.x, wreck.y, '#fb7185', 17)
            playGameSound('explosion_big')
          }
          break
        }
      }
    }

    let bossDefeatedThisFrame = false
    let preserveLoadoutForSuperBoss = false
    let completedRun = false
    for (const shot of shotsRef.current) {
      for (const enemy of enemiesRef.current) {
        if (enemy.hp <= 0) continue
        const hitRange = shot.radius + enemy.radius
        if (
          Math.abs(shot.x - enemy.x) <= hitRange &&
          Math.abs(shot.y - enemy.y) <= hitRange &&
          distSq(shot, enemy) <= hitRange * hitRange
        ) {
          const bossShielded = (enemy.isBoss && (enemy.shieldTime > 0 || enemy.y < 15)) || (enemy.isMiniBoss && (enemy.shieldTime > 0 || enemy.y < 8))
          if (!bossShielded) {
            enemy.hp -= shot.damage
          }
          spawnSparks(enemy.x, enemy.y, bossShielded ? '#fbbf24' : enemy.isBoss ? '#fca5a5' : enemy.isMiniBoss ? '#c084fc' : '#ef4444', enemy.isBoss || enemy.isMiniBoss ? 5 : 3, enemy.isBoss || enemy.isMiniBoss ? 5 : 3)
          if (shot.pierce && shot.pierce > 0) {
            shot.pierce -= 1
          } else {
            // rocket explosion + shrapnel
          if (shot.kind === 'rocket') {
            if (playerRef.current.ship.key === 'dreadnought') {
              const shrapnelCount = 8
              for (let s = 0; s < shrapnelCount; s++) {
                const angle = (s / shrapnelCount) * Math.PI * 2
                const speed = 38 + Math.random() * 28
                shotsRef.current.push({
                  id: shotId++,
                  x: shot.x,
                  y: shot.y,
                  vx: Math.cos(angle) * speed,
                  vy: Math.sin(angle) * speed,
                  damage: Math.ceil(shot.damage * 0.45),
                  kind: 'scatter',
                  radius: 1.1,
                })
              }
            }
            spawnSparks(shot.x, shot.y, '#f97316', 28, 6)
            addRipple(shot.x, shot.y, '#fb923c', 10)
            playGameSound('explosion')
          }
            shot.y = -999
          }
          if (bossShielded) {
            addRipple(enemy.x, enemy.y, '#fbbf24', 12)
            break
          }
          if (shot.kind === 'rocket') {
            addRipple(enemy.x, enemy.y, '#fb923c', 8)
          }
          if (shot.kind === 'homing') {
            addRipple(enemy.x, enemy.y, '#facc15', 7)
          }
          if (enemy.hp <= 0) {
            const scoreValue = enemy.isBoss ? 2800 + waveRef.current * 220 : enemy.isMiniBoss ? 260 + waveRef.current * 32 : 95 + waveRef.current * 14
            player.score += scoreValue
            if (remotePlayerRef.current) {
              remotePlayerRef.current.score += scoreValue
            }
            spawnSparks(enemy.x, enemy.y, enemy.isBoss ? '#fda4af' : enemy.isMiniBoss ? '#c084fc' : '#fb7185', enemy.isBoss ? 60 : enemy.isMiniBoss ? 42 : 18, enemy.isBoss ? 8 : enemy.isMiniBoss ? 7 : 5)
            addRipple(enemy.x, enemy.y, enemy.isBoss ? '#fb7185' : enemy.isMiniBoss ? '#a855f7' : '#f97316', enemy.isBoss ? 18 : enemy.isMiniBoss ? 14 : 9)
            if (enemy.isMiniBoss) {
              spawnPowerUp(enemy.x, enemy.y, Math.random() < 0.55)
            } else if (!enemy.isBoss) spawnPowerUp(enemy.x, enemy.y)
            if (enemy.isBoss) {
              bossDefeatedThisFrame = true
              const clearedStage = stageRef.current
              if (clearedStage >= MAX_RAID_STAGE) {
                completedRun = true
                victoryPendingRef.current = true
                unlockedStageRef.current = MAX_RAID_STAGE
                if (!coOpRunRef.current) {
                  saveUnlockedStage(MAX_RAID_STAGE)
                  saveCheckpointStage(14)
                }
                bossAlertRef.current = 2.4
                bossMessageRef.current = 'clear'
              } else {
                const nextStage = clearedStage + 1
                preserveLoadoutForSuperBoss = nextStage % 5 === 0
                pendingNextStageRef.current = nextStage
                unlockedStageRef.current = Math.max(unlockedStageRef.current, nextStage)
                if (!coOpRunRef.current) saveUnlockedStage(unlockedStageRef.current)
                if (!coOpRunRef.current && (RAID_CHECKPOINTS as readonly number[]).includes(nextStage)) {
                  saveCheckpointStage(nextStage)
                }
                bossAlertRef.current = 2.4
                bossMessageRef.current = 'clear'
              }
              playGameSound('levelup')
              playGameSound('combo')
              window.setTimeout(() => playGameSound('score'), 180)
            }
            playGameSound(enemy.isBoss || enemy.isMiniBoss ? 'explosion_big' : 'explosion')
          }
          break
        }
      }
    }
    shotsRef.current = shotsRef.current.filter((shot) => shot.y > -50)
    if (bossDefeatedThisFrame) {
      const defeatedBoss = enemiesRef.current.find((enemy) => enemy.isBoss && enemy.hp <= 0)
      if (completedRun) {
        shotsRef.current = []
        enemyShotsRef.current = []
        enemiesRef.current = []
        asteroidsRef.current = []
        meteorsRef.current = []
        ionStrikesRef.current = []
        wrecksRef.current = []
        asteroidWarningRef.current = 0
        asteroidSpawnDelayRef.current = 0
        randomEventRef.current = null
        randomEventSpawnTimerRef.current = 0
        powerUpsRef.current = []
        // Start the fly-forward animation like a normal stage clear
        stageClearRef.current = STAGE_CLEAR_SECONDS
        spawnLockRef.current = STAGE_CLEAR_SECONDS + 1.2
        if (!coOpRunRef.current && player.score > highScoreRef.current) {
          highScoreRef.current = player.score
          saveHighScore(player.score)
        }
        submitRaidLeaderboardScore(Math.max(player.score, remotePlayerRef.current?.score ?? 0))
        return
      }
      if (preserveLoadoutForSuperBoss) {
        extendLoadoutForSuperBoss(player)
        if (remotePlayerRef.current) extendLoadoutForSuperBoss(remotePlayerRef.current)
      } else {
        resetStageLoadout(player)
        if (remotePlayerRef.current) resetStageLoadout(remotePlayerRef.current)
      }
      const revivedHost = revivePlayerForBossClear(player, 42)
      const revivedGuest = remotePlayerRef.current ? revivePlayerForBossClear(remotePlayerRef.current, 58) : false
      if (revivedHost) {
        spawnSparks(player.x, player.y, '#86efac', 34, 7)
        addRipple(player.x, player.y, '#86efac', 15)
      }
      if (revivedGuest && remotePlayerRef.current) {
        spawnSparks(remotePlayerRef.current.x, remotePlayerRef.current.y, '#86efac', 34, 7)
        addRipple(remotePlayerRef.current.x, remotePlayerRef.current.y, '#86efac', 15)
      }
      bossTimerRef.current = BOSS_RESPAWN_SECONDS
      stageClearRef.current = STAGE_CLEAR_SECONDS
      spawnLockRef.current = STAGE_CLEAR_SECONDS + 1.2
      shotsRef.current = []
      enemyShotsRef.current = []
      enemiesRef.current = enemiesRef.current.filter((enemy) => enemy.isBoss && enemy.hp <= 0)
      asteroidsRef.current = []
      meteorsRef.current = []
      ionStrikesRef.current = []
      wrecksRef.current = []
      asteroidWarningRef.current = 0
      asteroidSpawnDelayRef.current = 0
      randomEventRef.current = null
      randomEventSpawnTimerRef.current = 0
      asteroidClusterTimerRef.current = getAsteroidClusterInterval()
      randomEventTimerRef.current = getRandomEventInterval()
      powerUpsRef.current = []
      if (defeatedBoss) {
        ;[120, 320, 540, 780].forEach((delay, index) => {
          window.setTimeout(() => {
            spawnSparks(defeatedBoss.x + (Math.random() - 0.5) * 12, defeatedBoss.y + (Math.random() - 0.5) * 9, index % 2 === 0 ? '#fda4af' : '#fbbf24', 32, 7)
            addRipple(defeatedBoss.x, defeatedBoss.y, index % 2 === 0 ? '#fb7185' : '#fbbf24', 12 + index * 2)
          }, delay)
        })
        spawnLevelUpPowerUp(defeatedBoss.x, defeatedBoss.y)
      }
      addRipple(player.x, player.y, '#fca5a5', 12)
    }

    for (const enemyShot of enemyShotsRef.current) {
      const hitRange = enemyShot.radius + PLAYER_RADIUS
      for (const targetPlayer of getLivingPlayers()) {
        if (enemyShot.kind === 'beam' && enemyShot.life !== undefined) {
          if (Math.abs(enemyShot.x - targetPlayer.x) <= hitRange) {
            damagePlayer(enemyShot.damage, targetPlayer)
          }
          continue
        }
        if (
          Math.abs(enemyShot.x - targetPlayer.x) <= hitRange &&
          Math.abs(enemyShot.y - targetPlayer.y) <= hitRange &&
          distSq(enemyShot, targetPlayer) <= hitRange * hitRange
        ) {
          enemyShot.y = HEIGHT + 99
          damagePlayer(enemyShot.kind === 'boss' || enemyShot.kind === 'plasma' || enemyShot.kind === 'blade' || enemyShot.kind === 'orbShot' || enemyShot.kind === 'superShot' || enemyShot.kind === 'beam' || enemyShot.kind === 'scatterBoss' ? 1 : enemyShot.damage, targetPlayer)
          break
        }
      }
    }
    enemyShotsRef.current = enemyShotsRef.current.filter((shot) => shot.y < HEIGHT + 30)

    for (const enemy of enemiesRef.current) {
      const hitRange = enemy.radius + PLAYER_RADIUS
      for (const targetPlayer of getLivingPlayers()) {
        if (
          Math.abs(enemy.x - targetPlayer.x) <= hitRange &&
          Math.abs(enemy.y - targetPlayer.y) <= hitRange &&
          distSq(enemy, targetPlayer) <= hitRange * hitRange
        ) {
          if (enemy.isBoss) {
            destroyPlayerByBossCollision(targetPlayer)
            spawnSparks(enemy.x, enemy.y, '#fb7185', 42, 7)
            addRipple(targetPlayer.x, targetPlayer.y, '#fb7185', 16)
          } else if (targetPlayer.forceField > 0) {
            if ((enemy.isBoss || enemy.isMiniBoss) && targetPlayer.invuln > 0) continue
            const armorCost = enemy.isBoss ? 2 : 1
            targetPlayer.forceField = Math.max(0, targetPlayer.forceField - armorCost)
            targetPlayer.invuln = 0.16
            if (enemy.isBoss || enemy.isMiniBoss) {
              enemy.hp = Math.max(1, enemy.hp - (enemy.isBoss ? 28 + waveRef.current * 8 : 34 + waveRef.current * 7))
            } else {
              enemy.hp = 0
              targetPlayer.score += 70 + waveRef.current * 10
              spawnPowerUp(enemy.x, enemy.y)
            }
            spawnSparks(enemy.x, enemy.y, '#22d3ee', enemy.isBoss || enemy.isMiniBoss ? 40 : 18, 7)
            addRipple(enemy.x, enemy.y, '#22d3ee', enemy.isBoss || enemy.isMiniBoss ? 15 : 10)
            playGameSound(enemy.isBoss || enemy.isMiniBoss ? 'hit' : 'explosion')
          } else {
            if (enemy.isBoss || enemy.isMiniBoss) {
              enemy.hp = Math.max(1, enemy.hp - (enemy.isBoss ? 22 + waveRef.current * 6 : 30 + waveRef.current * 6))
            } else {
              enemy.hp = 0
            }
            damagePlayer(enemy.isBoss ? 2 : 1, targetPlayer)
            spawnSparks(enemy.x, enemy.y, '#fb7185', enemy.isBoss || enemy.isMiniBoss ? 35 : 14, 6)
          }
          break
        }
      }
    }

    for (const asteroid of asteroidsRef.current) {
      if (asteroid.hp <= 0) continue
      const hitRange = asteroid.radius + PLAYER_RADIUS
      for (const targetPlayer of getLivingPlayers()) {
        if (
          Math.abs(asteroid.x - targetPlayer.x) <= hitRange &&
          Math.abs(asteroid.y - targetPlayer.y) <= hitRange &&
          distSq(asteroid, targetPlayer) <= hitRange * hitRange
        ) {
          damagePlayer(asteroid.tier === 2 ? 2 : 1, targetPlayer)
          breakAsteroid(asteroid, false)
          break
        }
      }
    }

    for (const meteor of meteorsRef.current) {
      const hitRange = meteor.radius + PLAYER_RADIUS
      for (const targetPlayer of getLivingPlayers()) {
        if (
          Math.abs(meteor.x - targetPlayer.x) <= hitRange &&
          Math.abs(meteor.y - targetPlayer.y) <= hitRange &&
          distSq(meteor, targetPlayer) <= hitRange * hitRange
        ) {
          meteor.life = 0
          damagePlayer(1, targetPlayer)
          spawnSparks(meteor.x, meteor.y, '#fbbf24', 18, 6)
          addRipple(meteor.x, meteor.y, '#fb923c', 9)
          break
        }
      }
    }
    meteorsRef.current = meteorsRef.current.filter((meteor) => meteor.life > 0)

    for (const strike of ionStrikesRef.current) {
      if (strike.warmup > 0) continue
      for (const targetPlayer of getLivingPlayers()) {
        if (Math.abs(targetPlayer.x - strike.x) <= strike.width * 0.62 + PLAYER_RADIUS) {
          damagePlayer(1, targetPlayer)
        }
      }
    }

    for (const wreck of wrecksRef.current) {
      if (wreck.hp <= 0) continue
      for (const targetPlayer of getLivingPlayers()) {
        if (
          Math.abs(wreck.x - targetPlayer.x) <= wreck.width * 0.5 + PLAYER_RADIUS &&
          Math.abs(wreck.y - targetPlayer.y) <= wreck.height * 0.58 + PLAYER_RADIUS
        ) {
          damagePlayer(2, targetPlayer)
          wreck.hp = Math.max(0, wreck.hp - 70)
          spawnSparks(wreck.x, wreck.y, '#94a3b8', 18, 6)
          break
        }
      }
    }
    wrecksRef.current = wrecksRef.current.filter((wreck) => wreck.hp > 0)

    const survivingAsteroids = asteroidsRef.current.filter((asteroid) => asteroid.hp > 0)
    if (spawnedAsteroids.length > 0) {
      survivingAsteroids.push(...spawnedAsteroids.slice(0, Math.max(0, MAX_ASTEROIDS - survivingAsteroids.length)))
    }
    asteroidsRef.current = survivingAsteroids

    for (const powerUp of powerUpsRef.current) {
      const pickupAssist = powerUp.type === 'levelup' ? 4.2 : 1.8
      const hitRange = powerUp.radius + PLAYER_RADIUS + pickupAssist
      for (const targetPlayer of getLivingPlayers()) {
        if (
          Math.abs(powerUp.x - targetPlayer.x) <= hitRange &&
          Math.abs(powerUp.y - targetPlayer.y) <= hitRange &&
          distSq(powerUp, targetPlayer) <= hitRange * hitRange
        ) {
          powerUp.y = HEIGHT + 99
          if (powerUp.type === 'levelup') {
            levelUpPlayer(targetPlayer)
          } else if (powerUp.type === 'repair') {
            targetPlayer.hp = Math.min(targetPlayer.maxHp, targetPlayer.hp + 1)
          } else if (powerUp.type === 'shield') {
            targetPlayer.shield = Math.min(8, targetPlayer.shield + 3)
            targetPlayer.invuln = Math.max(targetPlayer.invuln, 0.8)
          } else if (powerUp.type === 'forcefield') {
            targetPlayer.forceField = targetPlayer.ship.key === 'spaceEt'
              ? Math.min(SPACE_ET_PASSIVE_FORCE_FIELD_CHARGES + FORCE_FIELD_ARMOR, targetPlayer.forceField + FORCE_FIELD_ARMOR)
              : FORCE_FIELD_ARMOR
            targetPlayer.invuln = Math.max(targetPlayer.invuln, 0.9)
          } else if (powerUp.type === 'option') {
            targetPlayer.optionTimer = 1
          } else {
            targetPlayer.weapons[powerUp.type] = Math.min(WEAPON_STACK_CAPS[powerUp.type], targetPlayer.weapons[powerUp.type] + 1)
            targetPlayer.weaponTimers[powerUp.type] = 1
          }
          targetPlayer.score += 120
          spawnSparks(powerUp.x, powerUp.y, powerColor(powerUp.type), 24, 6)
          addRipple(powerUp.x, powerUp.y, powerColor(powerUp.type), 11)
          playPickupVoiceLine(powerUp.type)
          playGameSound('levelup')
          break
        }
      }
    }
    powerUpsRef.current = powerUpsRef.current.filter((powerUp) => powerUp.y < HEIGHT + 20)

    if (player.score > highScoreRef.current) {
      highScoreRef.current = player.score
    }
    if (remotePlayerRef.current && remotePlayerRef.current.score > highScoreRef.current) {
      highScoreRef.current = remotePlayerRef.current.score
    }
  }, [activateNuke, addRipple, damagePlayer, destroyPlayerByBossCollision, detonateNuke, fireEnemy, firePlayer, getLivingPlayers, getNearestLivingPlayer, spawnAsteroidCluster, spawnBoss, spawnEnemyAt, spawnFormation, spawnPowerUp, spawnLevelUpPowerUp, spawnSparks, startRaidBgm, startRandomRaidEvent, stopRaidBgm, submitRaidLeaderboardScore])

  useEffect(() => {
    const tick = (time: number) => {
      const dt = Math.min(0.033, (time - lastTimeRef.current) / 1000 || 0)
      lastTimeRef.current = time
      const session = multiplayerSessionRef.current
      if (!session || session.isHost) updateGame(dt)
      // Tick the victory blackout on every client (host sets it in updateGame, guest in applyMultiplayerState)
      if (victoryBlackoutRef.current > 0) {
        victoryBlackoutRef.current = Math.max(0, victoryBlackoutRef.current - dt)
      }
      if (session?.isHost) sendMultiplayerState(time)
      else if (session) {
        predictGuestPlayer(dt)
        advanceGuestVisuals(dt)
        sendMultiplayerInput(time)
      }
      if (session) updateMultiplayerConnection(time)
      drawFxCanvas(time)
      const renderInterval = phaseRef.current === 'playing'
        ? (stageClearRef.current > 0 || bossAlertRef.current > 0 ? GAMEPLAY_ALERT_SNAPSHOT_INTERVAL_MS : GAMEPLAY_SNAPSHOT_INTERVAL_MS)
        : IDLE_SNAPSHOT_INTERVAL_MS
      if (time - lastRenderTimeRef.current >= renderInterval) {
        lastRenderTimeRef.current = time
        if (!session || session.isHost) syncSnapshot()
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [advanceGuestVisuals, drawFxCanvas, predictGuestPlayer, sendMultiplayerInput, sendMultiplayerState, syncSnapshot, updateGame, updateMultiplayerConnection])

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (key === 'enter' && phaseRef.current === 'paused') resumeGame()
      else if (key === 'enter' && phaseRef.current === 'briefing') resetGame()
      else if (key === 'enter' && phaseRef.current !== 'playing' && phaseRef.current !== 'victory') resetGame()
      if (key === 'p') {
        if (phaseRef.current === 'playing') pauseGame()
        else if (phaseRef.current === 'paused') resumeGame()
      }
      if (key === 'escape') {
        if (phaseRef.current === 'playing') pauseGame()
        else if (phaseRef.current === 'paused') resumeGame()
        else if (phaseRef.current === 'briefing') {
          phaseRef.current = 'select'
          syncSnapshot()
        }
        else onClose()
      }
      if (event.code === 'Space' && phaseRef.current === 'playing') {
        event.preventDefault()
        if (!event.repeat) activateNuke()
        return
      }
      keysRef.current.add(key)
    }
    const up = (event: KeyboardEvent) => keysRef.current.delete(event.key.toLowerCase())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [activateNuke, onClose, pauseGame, resetGame, resumeGame, syncSnapshot])

  useEffect(() => () => {
    stopBGM()
    stopRaidBgm()
  }, [stopRaidBgm])

  const updatePointer = (clientX: number, clientY: number, pointerType: string) => {
    const root = rootRef.current
    if (!root) return
    const rect = root.getBoundingClientRect()
    const isMouse = pointerType === 'mouse'
    const offsetPx = isMouse ? 0 : Math.min(112, Math.max(72, rect.height * 0.12))
    const visualY = ((clientY - rect.top) / rect.height) * HEIGHT
    pointerVisualRef.current = {
      x: clamp(((clientX - rect.left) / rect.width) * WIDTH, 3, 97),
      y: clamp(visualY, 5, 97),
    }
    pointerTargetRef.current = {
      x: pointerVisualRef.current.x,
      y: clamp(((clientY - rect.top - offsetPx) / rect.height) * HEIGHT, 12, 93),
    }
  }

  const clearPointer = () => {
    pointerTargetRef.current = null
    pointerVisualRef.current = null
    touchPointerActiveRef.current = false
  }

  const isUiPointerTarget = (target: EventTarget | null) => (
    target instanceof HTMLElement && Boolean(target.closest('button'))
  )

  const player = snapshot.player
  const playerBaseAttack = getPlayerBaseAttack(player)
  const hpPips = Array.from({ length: player.maxHp }, (_, index) => index < player.hp)
  const forcePips = Array.from({ length: Math.max(FORCE_FIELD_ARMOR, Math.ceil(player.forceField)) }, (_, index) => index < player.forceField)
  const weaponEntries = WEAPON_KEYS.filter((key) => player.weapons[key] > 0)
  const briefing = BRIEFING_PANELS[briefingStep] ?? BRIEFING_PANELS[0]
  const stageClearProgress = snapshot.stageClear > 0 ? 1 - snapshot.stageClear / STAGE_CLEAR_SECONDS : 0
  const stageFlashOpacity =
    stageClearProgress > 0.66 && stageClearProgress < 0.9
      ? Math.sin(((stageClearProgress - 0.66) / 0.24) * Math.PI)
      : 0
  const completedCampaign = snapshot.unlockedStage >= MAX_RAID_STAGE
  const checkpointStage = getCheckpointStage()
  const stageSelectButtons = Array.from({ length: MAX_RAID_STAGE }, (_, index) => index + 1)
  const nukeCooldown = Math.ceil(snapshot.nukeCooldown)
  const nukeStageLocked = snapshot.phase === 'playing' && snapshot.stageClear > 0
  const nukeReady = snapshot.phase === 'playing' && !nukeStageLocked && snapshot.nukeCooldown <= 0
  const nukeDisplay = snapshot.phase === 'playing' && snapshot.nukeCooldown > 0 ? `${nukeCooldown}s` : 'Nuke'
  const nukeHint = snapshot.phase === 'playing' && snapshot.nukeCooldown > 0 ? 'Cooldown' : 'Space'
  const bossIncoming = snapshot.bossAlert > 0 && snapshot.bossMessage === 'incoming'
  const bossClear = snapshot.bossAlert > 0 && snapshot.bossMessage === 'clear'
  const isMultiplayer = Boolean(multiplayerSession)
  const canControlOverlay = !isMultiplayer || Boolean(multiplayerSession?.isHost)
  const [graphicsQuality, setGraphicsQualityState] = useState<GraphicsQuality>(() => getGraphicsQuality())
  const applyGraphicsQuality = (q: GraphicsQuality) => {
    graphicsQualityRef.current = q
    setGraphicsQuality(q)
    setGraphicsQualityState(q)
  }
  const connectionClass = `raid__connection raid__connection--${multiplayerConnection.quality}`
  const finalScore = Math.max(player.score, snapshot.allyPlayer?.score ?? 0)
  const finaleShipSize = getShipSpriteSize(player.ship.key, 'picker') + 22
  const finaleAllyShipSize = snapshot.allyPlayer ? getShipSpriteSize(snapshot.allyPlayer.ship.key, 'picker') + 10 : 0

  return (
    <div
      className={`raid raid--theme-${((snapshot.stageTheme - 1) % RAID_BACKGROUND_THEME_COUNT) + 1}`}
      ref={rootRef}
      onPointerDown={(event) => {
        if (isUiPointerTarget(event.target) || phaseRef.current !== 'playing') return
        updatePointer(event.clientX, event.clientY, event.pointerType)
        if (event.pointerType !== 'mouse') {
          touchPointerActiveRef.current = true
          event.currentTarget.setPointerCapture(event.pointerId)
        }
      }}
      onPointerMove={(event) => {
        if (phaseRef.current !== 'playing') return
        if (event.pointerType === 'mouse' || touchPointerActiveRef.current) {
          updatePointer(event.clientX, event.clientY, event.pointerType)
        }
      }}
      onPointerUp={(event) => {
        if (event.pointerType !== 'mouse') clearPointer()
      }}
      onPointerCancel={clearPointer}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') clearPointer()
      }}
    >
      <div className="raid__hud">
        <div className="raid__stat">
          <span>Score</span>
          <b>{player.score.toLocaleString()}</b>
        </div>
        <div className="raid__stat">
          <span>Stage</span>
          <b>{snapshot.stageTheme}</b>
        </div>
        <div className="raid__stat raid__stat--level">
          <span>Level</span>
          <b>LV {player.rank} ATK {playerBaseAttack.toFixed(1)}</b>
        </div>
        <div className="raid__stat raid__stat--weapon">
          <span>Stack</span>
          <b>
            {weaponEntries.length
              ? weaponEntries.map((key) => `${key[0].toUpperCase()}${player.weapons[key]}`).join(' ')
              : 'BASE'}
          </b>
        </div>
        <div className="raid__hp" aria-label="Hull and force field">
          {hpPips.map((filled, index) => <i key={index} className={filled ? 'raid__pip raid__pip--filled' : 'raid__pip'} />)}
          {player.forceField > 0 && forcePips.map((filled, index) => (
            <i key={`force-${index}`} className={filled ? 'raid__pip raid__pip--force raid__pip--filled' : 'raid__pip raid__pip--force'} />
          ))}
        </div>
        <button
          className={nukeReady ? 'raid__nuke raid__nuke--ready' : 'raid__nuke'}
          type="button"
          onClick={() => activateNuke()}
          disabled={!nukeReady}
          aria-label={nukeReady ? 'Launch nuclear strike' : nukeStageLocked ? 'Nuclear strike unavailable during stage clear' : snapshot.phase === 'playing' ? `Nuclear strike cooling down ${nukeCooldown} seconds` : 'Nuclear strike available during combat'}
        >
          <span className="raid__nuke-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="raid__nuke-text">
            <b>{nukeDisplay}</b>
            <small>{nukeHint}</small>
          </span>
        </button>
        <button className="raid__pause" type="button" onClick={pauseGame}>Pause</button>
        <button className="raid__exit" type="button" onClick={onClose}>Exit</button>
      </div>

      {isMultiplayer && (
        <div className={connectionClass} aria-live="polite">
          <i aria-hidden="true" />
          <span>{multiplayerConnection.label}</span>
        </div>
      )}

      <div className="raid__playfield">
        <canvas ref={fxCanvasRef} className="raid__fx-canvas" />
      </div>

      {nukeReady && (
        <button
          className="raid__nuke-quick"
          type="button"
          onClick={() => activateNuke()}
          aria-label="Launch nuclear strike"
        >
          <span className="raid__nuke-quick-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="raid__nuke-quick-text">Nuke</span>
        </button>
      )}

      {bossIncoming && (
        <div className="raid__boss-warning" role="alert" aria-live="assertive">
          <div className="raid__boss-warning-panel raid__boss-warning-panel--top">
            <span>Attention</span>
          </div>
          <div className="raid__boss-warning-panel raid__boss-warning-panel--main">
            <i aria-hidden="true" />
            <span>Security Alert</span>
            <i aria-hidden="true" />
          </div>
          <div className="raid__boss-warning-stripes" aria-hidden="true" />
          <small>Boss vector incoming</small>
        </div>
      )}

      {bossClear && snapshot.phase !== 'victory' && (
        <div className="raid__boss-alert raid__boss-alert--clear">
          Boss Destroyed
        </div>
      )}

      {snapshot.stageClear > 0 && (
        snapshot.stageTheme >= MAX_RAID_STAGE
          // Final-stage fly-through: black fade instead of white flash — leads into ending cutscene
          ? <div className="raid__stage-flash" style={{
              opacity: stageClearProgress > 0.58 ? Math.min(1, (stageClearProgress - 0.58) / 0.32) : 0,
              background: '#000',
            }} />
          : <div className="raid__stage-flash" style={{ opacity: stageFlashOpacity }} />
      )}

      {snapshot.phase !== 'playing' && snapshot.phase === 'paused' && (
        <div className="raid__overlay">
          <div className="raid__panel raid__panel--pause">
            <div className="raid__kicker">Combat Hold</div>
            <h2>Paused</h2>
            <div className="raid__records">
              <span>Stage {snapshot.stageTheme}</span>
              <span>Score {player.score.toLocaleString()}</span>
            </div>
            <div className="raid__gfx-row">
              <span className="raid__gfx-label">Graphics</span>
              {(['low', 'medium', 'high', 'max'] as GraphicsQuality[]).map((q) => (
                <button
                  key={q}
                  type="button"
                  className={graphicsQuality === q ? 'raid__gfx-btn raid__gfx-btn--active' : 'raid__gfx-btn'}
                  onClick={() => applyGraphicsQuality(q)}
                >
                  {q[0].toUpperCase() + q.slice(1)}
                </button>
              ))}
            </div>
            <div className="raid__pause-actions">
              {canControlOverlay ? <button type="button" className="raid__start" onClick={resumeGame}>Continue</button> : null}
              {canControlOverlay ? <button type="button" className="raid__menu-button" onClick={() => resetGame()}>Restart</button> : null}
              <button type="button" className="raid__menu-button" onClick={onClose}>Exit</button>
            </div>
          </div>
        </div>
      )}

      {snapshot.phase === 'briefing' && (
        <div className="raid__overlay">
          <div className="raid__panel raid__panel--briefing">
            <div className="raid__kicker">Launch Briefing</div>
            <h2>{briefing.title}</h2>
            <p className="raid__briefing-copy">{briefing.body}</p>
            <div className="raid__briefing-grid">
              {briefing.items.map((item) => {
                const pickupType = getBriefingPickupType(item)
                const [label, ...descriptionParts] = item.split(':')
                const description = descriptionParts.join(':').trim()
                return (
                  <div key={item} className={pickupType ? 'raid__briefing-card raid__briefing-card--pickup' : 'raid__briefing-card'}>
                    {pickupType && <PickupPreviewCanvas type={pickupType} />}
                    <span className="raid__briefing-card-copy">
                      {pickupType ? (
                        <>
                          <b>{label}</b>
                          <span>{description}</span>
                        </>
                      ) : item}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="raid__briefing-progress" aria-label="Briefing progress">
              {BRIEFING_PANELS.map((panel, index) => (
                <button
                  key={panel.title}
                  type="button"
                  className={index === briefingStep ? 'raid__briefing-dot raid__briefing-dot--active' : 'raid__briefing-dot'}
                  onClick={() => setBriefingStep(index)}
                  aria-label={`Show ${panel.title}`}
                />
              ))}
            </div>
            <div className="raid__pause-actions">
              <button
                type="button"
                className="raid__menu-button"
                onClick={() => {
                  phaseRef.current = 'select'
                  syncSnapshot()
                }}
              >
                Back
              </button>
              <button type="button" className="raid__menu-button" onClick={() => resetGame()}>Skip</button>
              <button
                type="button"
                className="raid__start"
                onClick={() => {
                  if (briefingStep < BRIEFING_PANELS.length - 1) {
                    setBriefingStep((step) => Math.min(BRIEFING_PANELS.length - 1, step + 1))
                    playGameSound('select')
                  } else {
                    resetGame()
                  }
                }}
              >
                {briefingStep < BRIEFING_PANELS.length - 1 ? 'Next' : 'Launch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {snapshot.phase === 'victory' && (
        <div className="raid__ending" role="dialog" aria-modal="true" aria-labelledby="raid-ending-title">
          <div className="raid__ending-scene" aria-hidden="true">
            <div className="raid__ending-stars raid__ending-stars--far" />
            <div className="raid__ending-stars raid__ending-stars--near" />
            <div className="raid__ending-sun" />
            <div className="raid__ending-earth">
              <span />
            </div>
            <div className="raid__ending-wake raid__ending-wake--host" />
            <div className="raid__ending-ship raid__ending-ship--host">
              <TowerShip tType={player.ship.key} color={PLAYER_COLOR} size={finaleShipSize} />
            </div>
            {snapshot.allyPlayer ? (
              <>
                <div className="raid__ending-wake raid__ending-wake--ally" />
                <div className="raid__ending-ship raid__ending-ship--ally">
                  <TowerShip tType={snapshot.allyPlayer.ship.key} color={ALLY_PLAYER_COLOR} size={finaleAllyShipSize} />
                </div>
              </>
            ) : null}
          </div>

          <div className="raid__ending-panel">
            <div className="raid__kicker">Mission Complete</div>
            <h2 id="raid-ending-title">Earth Line Secured</h2>
            <p>
              Your ship burns through the quiet after the final blast, carrying the last combat signal home.
            </p>
            <div className="raid__ending-log" aria-label="Mission debrief">
              {ENDING_DEBRIEF_LINES.map((line, index) => (
                <span key={line} style={{ '--ending-line': index } as CSSProperties}>
                  {line}
                </span>
              ))}
            </div>
            <div className="raid__ending-score">
              <span>Final Score</span>
              <strong>{finalScore.toLocaleString()}</strong>
            </div>
            <div className="raid__pause-actions raid__ending-actions">
              {canControlOverlay ? (
                <button type="button" className="raid__start" onClick={() => resetGame(1)}>
                  Start New Launch
                </button>
              ) : null}
              <button type="button" className="raid__menu-button" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {snapshot.phase !== 'playing' && snapshot.phase !== 'paused' && snapshot.phase !== 'briefing' && snapshot.phase !== 'victory' && (
        <div className="raid__overlay">
          <div className="raid__panel">
            <div className="raid__kicker">{snapshot.phase === 'gameover' ? 'Run Ended' : 'Choose Your Ship'}</div>
            <h2>{snapshot.phase === 'gameover' ? 'Ship Destroyed' : 'Rocket Raid'}</h2>
            <div className="raid__ship-grid">
              {SHIP_OPTIONS.map((ship) => (
                <button
                  key={ship.key}
                  type="button"
                  className={selectedShipKey === ship.key ? 'raid__ship-card raid__ship-card--active' : 'raid__ship-card'}
                  onClick={() => chooseShip(ship)}
                >
                  <TowerShip tType={ship.key} color={PLAYER_COLOR} size={getShipSpriteSize(ship.key, 'picker')} />
                  <span>{ship.name}</span>
                  <small>{ship.role}</small>
                </button>
              ))}
            </div>
            {!isMultiplayer && completedCampaign && (
              <div className="raid__stage-select">
                {stageSelectButtons.map((stage) => (
                  <button
                    key={stage}
                    type="button"
                    className={stage === MAX_RAID_STAGE ? 'raid__stage-button raid__stage-button--final' : 'raid__stage-button'}
                    onClick={() => resetGame(stage)}
                  >
                    {stage}
                  </button>
                ))}
              </div>
            )}
            <div className="raid__records">
              <span>Best {snapshot.highScore.toLocaleString()}</span>
              {!isMultiplayer && snapshot.phase === 'gameover' && checkpointStage > 1 ? <span>Checkpoint Stage {checkpointStage}</span> : <span>{isMultiplayer ? 'Co-op run' : 'PC follows cursor'}</span>}
              <span>{isMultiplayer ? 'Both pilots must fall' : completedCampaign ? 'Stages 1-15 unlocked' : 'Mobile follows above finger'}</span>
            </div>
            <div className="raid__gfx-row">
              <span className="raid__gfx-label">Graphics</span>
              {(['low', 'medium', 'high', 'max'] as GraphicsQuality[]).map((q) => (
                <button
                  key={q}
                  type="button"
                  className={graphicsQuality === q ? 'raid__gfx-btn raid__gfx-btn--active' : 'raid__gfx-btn'}
                  onClick={() => applyGraphicsQuality(q)}
                >
                  {q[0].toUpperCase() + q.slice(1)}
                </button>
              ))}
            </div>
            <div className="raid__pause-actions">
              {!isMultiplayer && (snapshot.phase === 'gameover' || snapshot.phase === 'select') && checkpointStage > 1 && (
                <button type="button" className="raid__start" onClick={() => resetGame(checkpointStage, true)}>
                  Continue Stage {checkpointStage}
                </button>
              )}
              {canControlOverlay ? (
                <button
                  type="button"
                  className={!isMultiplayer && (snapshot.phase === 'gameover' || snapshot.phase === 'select') && checkpointStage > 1 ? 'raid__menu-button' : 'raid__start'}
                  onClick={snapshot.phase === 'gameover' ? () => resetGame(1) : openBriefing}
                >
                  {snapshot.phase === 'gameover' ? isMultiplayer ? 'Restart Co-op' : 'Restart Stage 1' : 'Start Raid'}
                </button>
              ) : (
                <button type="button" className="raid__start" onClick={onClose}>Exit Co-op</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

