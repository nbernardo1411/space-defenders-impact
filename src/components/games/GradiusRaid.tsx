import { useCallback, useEffect, useRef, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getGameAudioMixSettings, getGameSoundEnabled, playGameSound, stopBGM } from './sound'
import { AlienShip, TowerShip } from './towerDefense/sprites'
import './GradiusRaid.css'

type WeaponKey = 'spread' | 'laser' | 'scatter' | 'rocket' | 'homing'
type PowerKind = WeaponKey | 'option' | 'shield' | 'forcefield' | 'repair'
type GamePhase = 'select' | 'briefing' | 'playing' | 'paused' | 'gameover' | 'victory'
type BossMessage = 'incoming' | 'clear' | null
type BossKind = 'carrier' | 'orb' | 'serpent' | 'mantis' | 'hydra' | 'gate' | 'super' | 'final'
type RaidBgmMode = 'cruise' | 'combat' | 'boss'

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
  fireCooldown: number
  phase: number
  color: string
  pattern: number
  bossKind: BossKind | null
  shieldTime: number
  originX: number
  amplitude: number
  trainSlot: number
  pathSpeed: number
  chargeCooldown: number
  chargeTimer: number
  chargeLane: number
  chargePattern: 'single' | 'scatter'
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

type Snapshot = {
  phase: GamePhase
  player: Player
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
}

const WIDTH = 100
const HEIGHT = 100
const PLAYER_RADIUS = 3.2
const MAX_RAID_STAGE = 15
const RAID_CHECKPOINTS = [5, 10, 14] as const
const STORAGE_KEY = 'gradiusRaidHighScore'
const RAID_UNLOCK_STORAGE_KEY = 'gradiusRaidUnlockedStage'
const RAID_CHECKPOINT_STORAGE_KEY = 'gradiusRaidCheckpointStage'
const PLAYER_COLOR = '#ef233c'
const DARK_ENEMY_COLORS = ['#4c1d95', '#581c87', '#7f1d1d', '#831843', '#312e81', '#164e63', '#3f1d2e', '#1f2937']
const BOSS_COLORS: Record<BossKind, string> = {
  carrier: '#7f1d1d',
  orb: '#581c87',
  serpent: '#164e63',
  mantis: '#365314',
  hydra: '#4c1d95',
  gate: '#0f172a',
  super: '#3f1d2e',
  final: '#120617',
}
const RAID_DEFAULT_BGM_TRACK = '/audio/bgm_scifi_loop.ogg'
const RAID_BOSS_BGM_TRACK = '/audio/sfx_boss_battle.wav'
const RAID_BGM_STAGE_RATES = [0.92, 0.98, 1.04, 1.1]
const RAID_BOSS_APPROACH_SILENCE_SECONDS = 5.5

const SHIP_OPTIONS: ShipOption[] = [
  { key: 'rocket', name: 'Black Comet', role: 'Balanced missile frame', speed: 1, hp: 6, fireRate: 1 },
  { key: 'fast', name: 'Red Wraith', role: 'Fastest dodge craft', speed: 1.18, hp: 5, fireRate: 1.08 },
  { key: 'gatling', name: 'Crimson Saw', role: 'Rapid assault striker', speed: 0.96, hp: 6, fireRate: 1.18 },
  { key: 'laser', name: 'Night Lance', role: 'Sharper beam control', speed: 1.03, hp: 5, fireRate: 1.12 },
  { key: 'dreadnought', name: 'Obsidian Ark', role: 'Heavy survival hull', speed: 0.82, hp: 8, fireRate: 0.86 },
  { key: 'xwing', name: 'Crosswing Nova', role: 'Four-cannon S-foil ace', speed: 1.12, hp: 5, fireRate: 1.14 },
  { key: 'spaceEt', name: 'Space ET', role: 'Stealth raptor spacefighter', speed: 1.08, hp: 5, fireRate: 1.1 },
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
    items: ['O Scouts: two side escorts copy your selected ship and fire with you.', 'S Shield: absorbs hits before hull damage.', 'F Force Field: five temporary armor bars and safe enemy ramming.', '+ Repair: restores hull by one bar.'],
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
}

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
  if (shipKey === 'dreadnought') return context === 'player' ? 88 : context === 'option' ? 40 : 76
  if (shipKey === 'spaceEt') return context === 'player' ? 84 : context === 'option' ? 38 : 72
  if (shipKey === 'xwing') return context === 'player' ? 78 : context === 'option' ? 36 : 68
  return context === 'player' ? 74 : context === 'option' ? 34 : 64
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
const NORMAL_POWER_DROP_COOLDOWN = 3.8
const POWER_PITY_KILLS = 12
const GAMEPLAY_SNAPSHOT_INTERVAL_MS = 100
const GAMEPLAY_ALERT_SNAPSHOT_INTERVAL_MS = 50
const IDLE_SNAPSHOT_INTERVAL_MS = 120
const HOMING_RETARGET_SECONDS = 0.18
const HOMING_RETARGET_STAGGER_SECONDS = 0.012
const NUKE_COOLDOWN_SECONDS = 60
const NUKE_MISSILE_SECONDS = 0.82
const NUKE_FLASH_SECONDS = 1.15
const NUKE_BOSS_DAMAGE_RATIO = 0.32
const NUKE_BOSS_DAMAGE_FLOOR = 3200
const BOSS_RESPAWN_SECONDS = 90
const STAGE_CLEAR_SECONDS = 3.15
const MAX_SPARKS = 45
const MAX_RIPPLES = 10

let shotId = 1
let enemyId = 1
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
  bgA: string
  bgB: string
  nebulaA: string
  nebulaB: string
  starTint: string
  streak: string
}

const canvasSpriteCache = new Map<string, CanvasSpriteEntry>()
const homingMissileSpriteCache = new Map<number, HTMLCanvasElement>()
const honeycombShieldSpriteCache = new Map<number, HTMLCanvasElement>()

const DEFAULT_RAID_PALETTE: RaidPalette = {
  bgA: 'rgba(239, 35, 60, 0.16)',
  bgB: 'rgba(14, 165, 233, 0.13)',
  nebulaA: 'rgba(127, 29, 29, 0.3)',
  nebulaB: 'rgba(8, 47, 73, 0.32)',
  starTint: 'rgba(248, 113, 113, 0.64)',
  streak: 'rgba(239, 35, 60, 0.5)',
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
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
    bgA: getCssVar(root, '--raid-bg-a', DEFAULT_RAID_PALETTE.bgA),
    bgB: getCssVar(root, '--raid-bg-b', DEFAULT_RAID_PALETTE.bgB),
    nebulaA: getCssVar(root, '--raid-nebula-a', DEFAULT_RAID_PALETTE.nebulaA),
    nebulaB: getCssVar(root, '--raid-nebula-b', DEFAULT_RAID_PALETTE.nebulaB),
    starTint: getCssVar(root, '--raid-star-tint', DEFAULT_RAID_PALETTE.starTint),
    streak: getCssVar(root, '--raid-streak', DEFAULT_RAID_PALETTE.streak),
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
  if (!enemy.isBoss) return 50
  if (enemy.bossKind === 'final') return 330
  if (enemy.bossKind === 'super') return 280
  if (enemy.bossKind === 'gate') return 220
  if (enemy.bossKind === 'hydra') return 190
  return 156
}

function getEnemyCanvasSprite(enemy: Enemy) {
  const size = getEnemySpriteMarkupSize(enemy)
  const bossKind = enemy.bossKind ?? 'none'
  const key = `alien:${enemy.variant % 4}:${enemy.isBoss ? 1 : 0}:${bossKind}:${enemy.color}:${size}`
  const existing = canvasSpriteCache.get(key)
  if (existing) return existing
  return makeCanvasSprite(
    key,
    renderToStaticMarkup(
      <AlienShip
        variant={enemy.variant}
        isBoss={enemy.isBoss}
        isFinalBoss={enemy.bossKind === 'final'}
        bossKind={enemy.bossKind ?? undefined}
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
  ctx.moveTo(0, -size * 0.46)
  ctx.lineTo(size * 0.34, size * 0.34)
  ctx.lineTo(0, size * 0.18)
  ctx.lineTo(-size * 0.34, size * 0.34)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
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
  if (!enemy.isBoss) return Math.min(viewportWidth * 0.08, 64)
  if (enemy.bossKind === 'final') return Math.min(viewportWidth * 0.52, 470)
  if (enemy.bossKind === 'super') return Math.min(viewportWidth * 0.42, 380)
  if (enemy.bossKind === 'gate') return Math.min(viewportWidth * 0.34, 310)
  if (enemy.bossKind === 'hydra') return Math.min(viewportWidth * 0.3, 260)
  return Math.min(viewportWidth * 0.24, 210)
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
    const bossBias = enemy.isBoss ? -1400 : 0
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
  return {
    x: 50,
    y: 82,
    hp: ship.hp,
    maxHp: ship.hp,
    invuln: 1.8,
    shield: 0,
    forceField: 0,
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
  return 'S'
}

//
// ARCADE ANNOUNCER STYLE WEB SPEECH
// This pushes browser TTS close to arcade energy.
// Still limited by speechSynthesis itself,
// but MUCH better than plain robotic speech.
//

window.speechSynthesis.onvoiceschanged = () => {
  window.speechSynthesis.getVoices()
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

  return 'POWER UUUUP!!!'
}

function getPickupVoice() {
  const voices = window.speechSynthesis.getVoices()

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

function playPickupVoiceLine(type: PowerKind) {
  if (
    typeof window === 'undefined' ||
    !window.speechSynthesis ||
    typeof SpeechSynthesisUtterance === 'undefined'
  ) {
    return
  }

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

  try {
    const tuning = getPickupVoiceTuning(type)

    const mix = getGameAudioMixSettings()

    const volume = clamp(
      mix.master * mix.ui * 1.25,
      0,
      1,
    )

    // stronger phrasing
    const line = pickupVoiceLine(type)
      .replace(/ROCKET/g, 'RRRROCKET')
      .replace(/LASER/g, 'LAAAASERRR')
      .replace(/POWER/g, 'POWERRRR')
      .replace(/SPREAD/g, 'SPREEEAD')
      .replace(/SCATTER/g, 'SCATTTERRR')

    window.speechSynthesis.cancel()

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

    window.speechSynthesis.speak(main)

  } catch {
    // flavor only
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
  player.weaponCooldowns = { ...EMPTY_WEAPON_TIMERS }
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

function drawRaidBackground(ctx: CanvasRenderingContext2D, palette: RaidPalette, width: number, height: number, time: number) {
  const seconds = time / 1000
  const { bgA, bgB, nebulaA, nebulaB, starTint, streak } = palette

  const base = ctx.createLinearGradient(0, 0, 0, height)
  base.addColorStop(0, '#020307')
  base.addColorStop(0.45, '#060812')
  base.addColorStop(1, '#070a10')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, width, height)

  drawRadialEllipse(ctx, width * 0.18, height * 0.16, width * 0.24, height * 0.24, [[0, bgA], [1, 'rgba(0,0,0,0)']])
  drawRadialEllipse(ctx, width * 0.76, height * 0.38, width * 0.26, height * 0.26, [[0, bgB], [1, 'rgba(0,0,0,0)']])

  ctx.save()
  const nebulaDrift = Math.sin(seconds / 10)
  ctx.translate(width * 0.012 * nebulaDrift, height * 0.006 * Math.cos(seconds / 8))
  ctx.scale(1 + 0.035 * (0.5 + Math.sin(seconds / 7) * 0.5), 1 + 0.025 * (0.5 + Math.cos(seconds / 9) * 0.5))
  drawRadialEllipse(ctx, width * 0.2, height * 0.72, width * 0.36, height * 0.24, [[0, nebulaA], [1, 'rgba(0,0,0,0)']])
  drawRadialEllipse(ctx, width * 0.82, height * 0.24, width * 0.32, height * 0.22, [[0, nebulaB], [1, 'rgba(0,0,0,0)']])
  ctx.restore()

  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  drawRadialEllipse(ctx, width * 0.78, height * 0.18, width * 0.48, height * 0.25, [[0, 'rgba(139,92,246,0.2)'], [1, 'rgba(0,0,0,0)']])
  drawRadialEllipse(ctx, width * 0.14, height * 0.68, width * 0.36, height * 0.42, [[0, 'rgba(59,130,246,0.16)'], [1, 'rgba(0,0,0,0)']])
  drawRadialEllipse(ctx, width * 0.48, height * 0.42, width * 0.22, height * 0.18, [[0, 'rgba(236,72,153,0.11)'], [1, 'rgba(0,0,0,0)']])
  drawRadialEllipse(ctx, width * 0.22, height * 0.22, width * 0.26, height * 0.15, [[0, 'rgba(251,191,36,0.05)'], [1, 'rgba(0,0,0,0)']])
  drawRadialEllipse(ctx, width * 0.88, height * 0.72, width * 0.18, height * 0.32, [[0, 'rgba(34,211,238,0.06)'], [1, 'rgba(0,0,0,0)']])
  ctx.restore()

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (const star of BACKGROUND_STARS) {
    const farY = ((star.y * height * 1.26 + seconds * 15) % (height * 1.26)) - height * 0.13
    const nearY = ((star.y * height * 1.38 + seconds * 72) % (height * 1.38)) - height * 0.19
    const x = star.x * width
    ctx.globalAlpha = star.alpha * 0.52
    ctx.fillStyle = star.tint > 0.66 ? starTint : star.tint > 0.33 ? 'rgba(125,211,252,0.55)' : 'rgba(255,255,255,0.76)'
    ctx.beginPath()
    ctx.arc(x, farY, star.size * 0.62, 0, Math.PI * 2)
    ctx.fill()

    if (star.tint > 0.58) {
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

  const speedLines = [
    { x: 0.11, length: 170, width: 2, delay: -0.2, color: streak },
    { x: 0.32, length: 120, width: 1, delay: -0.42, color: 'rgba(255,255,255,0.26)' },
    { x: 0.63, length: 150, width: 2, delay: -0.16, color: 'rgba(239,35,60,0.42)' },
    { x: 0.88, length: 135, width: 1, delay: -0.34, color: 'rgba(125,211,252,0.28)' },
  ]
  for (const line of speedLines) {
    const y = (((seconds + line.delay) / 0.75) % 1) * height * 1.5 - height * 0.2
    const x = line.x * width
    const gradient = ctx.createLinearGradient(x, y, x, y + line.length)
    gradient.addColorStop(0, 'rgba(255,255,255,0)')
    gradient.addColorStop(0.46, line.color)
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.globalAlpha = 0.58
    ctx.strokeStyle = gradient
    ctx.lineWidth = line.width
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x, y + line.length)
    ctx.stroke()
  }
  ctx.restore()

  const planetBase = height * 1.3
  const planet1Y = ((seconds / 28 + 0.9) % 1) * planetBase - height * 0.1
  const planet2Y = ((seconds / 42 + 0.64) % 1) * planetBase - height * 0.08
  const planet3Y = ((seconds / 58 + 0.42) % 1) * planetBase - height * 0.06
  const planet1R = Math.min(width * 0.09, 70)
  const planet2R = Math.min(width * 0.045, 36)
  const planet3R = Math.min(width * 0.03, 26)

  ctx.save()
  ctx.globalAlpha = 1
  drawRadialEllipse(ctx, width * 0.92, planet1Y, planet1R, planet1R, [[0, '#f9a8d4'], [0.5, '#7c3aed'], [1, '#120617']])
  ctx.strokeStyle = 'rgba(167,139,250,0.28)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(width * 0.92, planet1Y, planet1R * 1.28, planet1R * 0.28, -8 * DEG, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 0.82
  drawRadialEllipse(ctx, width * 0.05, planet2Y, planet2R, planet2R, [[0, '#fecaca'], [0.55, '#7f1d1d'], [1, '#1f0909']])
  drawRadialEllipse(ctx, width * 0.24, planet3Y, planet3R, planet3R, [[0, '#a5f3fc'], [0.55, '#164e63'], [1, '#06151b']])
  ctx.restore()

  for (const asteroid of BACKGROUND_ASTEROIDS) {
    const y = ((seconds * asteroid.speed + asteroid.delay / 22 + 1) % 1) * height * 1.15 - height * 0.05
    drawAsteroidShape(ctx, width * asteroid.x, y, asteroid.width, asteroid.height, seconds * asteroid.spin * DEG / 10, asteroid.alpha)
  }
  for (const debris of BACKGROUND_DEBRIS) {
    const y = ((seconds * debris.speed + debris.delay / 48 + 1) % 1) * height * 1.2 - height * 0.05
    drawDebrisShape(ctx, width * debris.x, y, debris.width, debris.height, seconds * debris.spin * DEG / 12, debris.alpha)
  }

  const clusterY1 = ((seconds / 16 + 0.56) % 1) * height * 1.15 - height * 0.04
  const clusterY2 = ((seconds / 24 + 0.25) % 1) * height * 1.15 - height * 0.04
  drawAsteroidShape(ctx, width * 0.44, clusterY1, 16, 12, seconds * 0.3, 0.24)
  drawAsteroidShape(ctx, width * 0.44 + 22, clusterY1 + 14, 10, 8, -seconds * 0.2, 0.2)
  drawAsteroidShape(ctx, width * 0.72, clusterY2, 20, 16, -seconds * 0.18, 0.22)
  drawAsteroidShape(ctx, width * 0.72 + 24, clusterY2 + 18, 12, 9, seconds * 0.18, 0.18)

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
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
  const isSuper = enemy.bossKind === 'super' || enemy.bossKind === 'final'
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
  const sprite = getEnemyCanvasSprite(enemy)

  if (enemy.isBoss) {
    const floatScale = 1 + Math.sin(time / 1100) * 0.03
    const rotation = Math.sin(time / 1100) * 0.5 * DEG
    drawBossAura(ctx, enemy, x, y, size, time)
    const bossFilter = enemy.bossKind === 'final'
      ? 'brightness(1.14) contrast(1.18) saturate(1.34)'
      : enemy.bossKind === 'super'
        ? 'brightness(1.12) contrast(1.16) saturate(1.32)'
        : 'brightness(1.16) contrast(1.16) saturate(1.32)'
    drawCanvasSprite(ctx, sprite, x, y, size, bossFilter, 1, rotation, floatScale, enemy.color)
    if (enemy.shieldTime > 0 || enemy.y < 15) drawBossShield(ctx, x, y, size, time)
    drawBossReticle(ctx, x, y, size, time, enemy.bossKind === 'final')
    drawBossBar(ctx, enemy, x, y, size)
    return
  }

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
) {
  if (player.optionTimer <= 0) return
  const optionOffset = viewportWidth < 640 ? 12 : 8.5
  const optionShipSize = getShipSpriteSize(player.ship.key, 'option')
  const optionBox = viewportWidth < 860 ? 30 : 38
  const drawSize = Math.min(optionShipSize, optionBox)
  const sprite = getTowerCanvasSprite(player.ship.key, PLAYER_COLOR, optionShipSize)

  for (const side of [-1, 1]) {
    const x = toX(clamp(player.x + optionOffset * side, 4, 96))
    const y = toY(player.y + 1.8) + Math.sin(time / 900 + (side > 0 ? 0.18 : 0)) * 2.5
    ctx.save()
    ctx.translate(x, y)
    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = 'rgba(239,35,60,0.48)'
    ctx.shadowBlur = 14
    ctx.shadowColor = 'rgba(239,35,60,0.55)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(0, 0, optionBox * 0.4, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
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
      PLAYER_COLOR,
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

function drawRaidPlayer(
  ctx: CanvasRenderingContext2D,
  player: Player,
  phase: GamePhase,
  toX: (value: number) => number,
  toY: (value: number) => number,
  viewportWidth: number,
  time: number,
) {
  const x = toX(player.x)
  const y = toY(player.y)
  const size = viewportWidth < 860 ? 62 : 82
  const isDown = phase === 'gameover'
  const rotation = isDown ? 28 * DEG : 0
  const scale = isDown ? 0.88 : 1
  const alpha = isDown ? 0.3 : 1

  drawPlayerEngine(ctx, x, y, size, time)

  if (player.shield > 0) drawHoneycombShield(ctx, x, y, size, time, clamp(player.shield / 8, 0, 1))
  else if (player.invuln > 0) drawInvulnerabilityShimmer(ctx, x, y, size, time)

  if (player.forceField > 0) drawPlasmaForceField(ctx, x, y, size, time, clamp(player.forceField / FORCE_FIELD_ARMOR, 0, 1))

  const sprite = getTowerCanvasSprite(player.ship.key, PLAYER_COLOR, getShipSpriteSize(player.ship.key, 'player'))
  drawSpriteGlow(
    ctx,
    x,
    y,
    size,
    player.forceField > 0 ? 'rgba(34,211,238,0.34)' : player.shield > 0 ? 'rgba(252,211,77,0.24)' : player.invuln > 0 ? 'rgba(226,232,240,0.16)' : 'rgba(239,35,60,0.22)',
    1,
  )
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
    PLAYER_COLOR,
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
  for (const enemy of enemies) {
    if (enemy.bossKind !== 'final' || enemy.chargeTimer <= 0) continue
    const lanes = enemy.chargePattern === 'scatter'
      ? [-24, -12, 0, 12, 24].map((offset) => clamp(enemy.chargeLane + offset, 8, 92))
      : [clamp(enemy.chargeLane, 10, 90)]
    const alpha = Math.max(0.28, Math.min(1, enemy.chargeTimer / 1.45))
    const lineWidth = enemy.chargePattern === 'scatter' ? Math.min(viewportWidth * 0.045, 42) : Math.min(viewportWidth * 0.08, 72)

    for (const lane of lanes) {
      const x = toX(lane)
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.globalCompositeOperation = 'lighter'
      const gradient = ctx.createLinearGradient(x - lineWidth / 2, 0, x + lineWidth / 2, 0)
      gradient.addColorStop(0, 'rgba(0,0,0,0)')
      gradient.addColorStop(0.35, 'rgba(251,191,36,0.24)')
      gradient.addColorStop(0.5, 'rgba(255,255,255,0.5)')
      gradient.addColorStop(0.65, 'rgba(251,191,36,0.24)')
      gradient.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = gradient
      ctx.shadowBlur = 26
      ctx.shadowColor = 'rgba(251,191,36,0.48)'
      ctx.fillRect(x - lineWidth / 2, 0, lineWidth, viewportHeight)

      ctx.strokeStyle = time % 360 < 180 ? 'rgba(251,191,36,0.72)' : 'rgba(255,255,255,0.58)'
      ctx.lineWidth = 2
      for (let y = -18; y < viewportHeight; y += 18) {
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x, y + 8)
        ctx.stroke()
      }
      ctx.restore()
    }
  }
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

export function GradiusRaid({ onClose }: { onClose: () => void }) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const fxCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef(0)
  const lastTimeRef = useRef(0)
  const lastRenderTimeRef = useRef(0)
  const snapshotKeyRef = useRef('')
  const paletteRef = useRef<RaidPalette>(DEFAULT_RAID_PALETTE)
  const paletteClassRef = useRef('')
  const keysRef = useRef(new Set<string>())
  const pointerTargetRef = useRef<Vec | null>(null)
  const pointerVisualRef = useRef<Vec | null>(null)
  const touchPointerActiveRef = useRef(false)
  const selectedShipRef = useRef<ShipOption>(SHIP_OPTIONS[0])
  const playerRef = useRef<Player>(getInitialPlayer())
  const shotsRef = useRef<Shot[]>([])
  const enemyShotsRef = useRef<Shot[]>([])
  const enemiesRef = useRef<Enemy[]>([])
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
  const nukeCooldownRef = useRef(0)
  const nukeFlashRef = useRef(0)
  const nukeStrikeRef = useRef<NukeStrike | null>(null)
  const nukeBlastOriginRef = useRef<Vec>({ x: 50, y: 46 })
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
  }))

  const syncSnapshot = useCallback(() => {
    const player = playerRef.current
    const bossAlertBucket = bossAlertRef.current > 0 ? Math.ceil(bossAlertRef.current * 4) : 0
    const stageClearBucket = stageClearRef.current > 0 ? Math.ceil(stageClearRef.current * 30) : 0
    const nukeCooldownBucket = nukeCooldownRef.current > 0 ? Math.ceil(nukeCooldownRef.current) : 0
    const nukeFlashBucket = nukeFlashRef.current > 0 ? Math.ceil(nukeFlashRef.current * 10) : 0
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
      unlockedStageRef.current,
      player.hp,
      player.maxHp,
      Math.ceil(player.shield * 10),
      player.forceField,
      player.score,
      player.rank,
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
    })
  }, [])

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

    const track = mode === 'boss' ? RAID_BOSS_BGM_TRACK : RAID_DEFAULT_BGM_TRACK
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
    const modeVolume = mode === 'boss' ? 0.58 : mode === 'combat' ? 0.34 : 0.22
    const stageRate = RAID_BGM_STAGE_RATES[(stage - 1) % RAID_BGM_STAGE_RATES.length]
    audio.volume = Math.max(0, Math.min(1, modeVolume * mix.master * mix.bgm))
    audio.playbackRate = mode === 'boss'
      ? Math.max(0.95, Math.min(1.18, 1.02 + (stage % 5) * 0.025))
      : Math.max(0.75, Math.min(1.25, stageRate + (mode === 'combat' ? 0.03 : -0.04)))

    if (!existing) {
      audio.currentTime = mode === 'boss' ? 0 : ((stage - 1) % 4) * 18
      raidBgmElementRef.current = audio
    } else if (raidBgmStageRef.current !== stage) {
      audio.currentTime = mode === 'boss' ? 0 : ((stage - 1) % 4) * 18
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
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const width = Math.max(1, Math.floor(cssWidth * dpr))
    const height = Math.max(1, Math.floor(cssHeight * dpr))

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssWidth, cssHeight)

    const toX = (value: number) => (value / WIDTH) * cssWidth
    const toY = (value: number) => (value / HEIGHT) * cssHeight
    const visualScale = clamp(Math.min(cssWidth, cssHeight) / 520, 0.8, 1.45)

    if (paletteClassRef.current !== root.className) {
      paletteClassRef.current = root.className
      paletteRef.current = readRaidPalette(root)
    }

    drawRaidBackground(ctx, paletteRef.current, cssWidth, cssHeight, time)

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

    for (const shot of shotsRef.current) {
      if (shot.kind === 'laser') drawTrail(shot, 'rgba(103,232,249,0.9)', 70, 7)
      else if (shot.kind === 'spread') drawTrail(shot, 'rgba(251,191,36,0.85)', 36, 5)
      else if (shot.kind === 'scatter') drawTrail(shot, 'rgba(0, 255, 191, 0.8)', 28, 4.5)
      else if (shot.kind === 'rocket') drawOrb(shot, 'rgb(249, 116, 22)', 12)
      else if (shot.kind === 'homing') drawMissile(shot)
      else drawTrail(shot, 'rgba(34,197,94,0.86)', 36, 5)
    }

    for (const shot of enemyShotsRef.current) {
      if (shot.kind === 'orbShot') drawOrb(shot, 'rgba(168,85,247,0.92)', 12)
      else if (shot.kind === 'blade') drawTrail(shot, 'rgba(34,211,238,0.9)', 46, 7)
      else if (shot.kind === 'needle') drawTrail(shot, 'rgba(190,242,100,0.92)', 42, 5)
      else if (shot.kind === 'voidShot') drawOrb(shot, 'rgba(192,132,252,0.95)', 15)
      else if (shot.kind === 'beam') drawTrail(shot, 'rgba(248,113,113,0.96)', 92, 11)
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

    const normalEnemyFilter = getNormalEnemyFilter(time)
    for (const enemy of enemiesRef.current) {
      drawRaidEnemy(ctx, enemy, toX, toY, cssWidth, time, normalEnemyFilter)
    }

    drawRaidOptions(ctx, playerRef.current, toX, toY, cssWidth, time)
    drawRaidPlayer(ctx, playerRef.current, phaseRef.current, toX, toY, cssWidth, time)

    for (const powerUp of powerUpsRef.current) {
      drawPowerUpCanvas(ctx, powerUp, toX, toY, cssWidth, time)
    }

    drawFinalChargeLines(ctx, enemiesRef.current, toX, cssWidth, cssHeight, time)

    if (phaseRef.current === 'playing') {
      drawFingerGuide(ctx, pointerVisualRef.current, toX, toY)
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
        const damage = Math.max(NUKE_BOSS_DAMAGE_FLOOR, Math.round(enemy.maxHp * NUKE_BOSS_DAMAGE_RATIO))
        enemy.shieldTime = 0
        enemy.chargeTimer = 0
        enemy.hp = Math.max(1, enemy.hp - damage)
        survivors.push(enemy)
        addRipple(enemy.x, enemy.y, '#fbbf24', enemy.bossKind === 'final' ? 26 : 20)
        spawnSparks(enemy.x, enemy.y, '#fbbf24', 48, 9)
        continue
      }

      destroyed += 1
      player.score += 95 + waveRef.current * 14
      if (markedExplosions < 10) {
        markedExplosions += 1
        addRipple(enemy.x, enemy.y, '#fb923c', 12)
        spawnSparks(enemy.x, enemy.y, '#fb7185', 24, 6)
      }
    }

    enemiesRef.current = survivors
    killsSincePowerRef.current += destroyed
    if (player.score > highScoreRef.current) {
      highScoreRef.current = player.score
    }

    addRipple(targetX, targetY, '#fbbf24', 30)
    addRipple(player.x, player.y, '#fef3c7', 14)
    spawnSparks(targetX, targetY, '#fbbf24', 80, 9)
    playGameSound('explosion_big')
    if (destroyed >= 5) window.setTimeout(() => playGameSound('combo'), 120)
    syncSnapshot()
  }, [addRipple, spawnSparks, syncSnapshot])

  const activateNuke = useCallback(() => {
    if (phaseRef.current !== 'playing' || stageClearRef.current > 0 || nukeCooldownRef.current > 0 || nukeStrikeRef.current) return

    const visibleEnemies = enemiesRef.current.filter((enemy) => (
      enemy.hp > 0 && enemy.y > -18 && enemy.y < HEIGHT + 16
    ))
    const hasTargets = enemyShotsRef.current.length > 0 || visibleEnemies.length > 0
    if (!hasTargets) return

    const player = playerRef.current
    nukeCooldownRef.current = NUKE_COOLDOWN_SECONDS
    player.invuln = Math.max(player.invuln, 1.15)

    let targetX = 50
    let targetY = 46
    const priorityTarget = visibleEnemies.find((enemy) => enemy.isBoss)
    if (priorityTarget) {
      targetX = clamp(priorityTarget.x, 18, 82)
      targetY = clamp(priorityTarget.y + 5, 18, 58)
    } else if (visibleEnemies.length > 0) {
      targetX = clamp(visibleEnemies.reduce((sum, enemy) => sum + enemy.x, 0) / visibleEnemies.length, 18, 82)
      targetY = clamp(visibleEnemies.reduce((sum, enemy) => sum + enemy.y, 0) / visibleEnemies.length, 22, 58)
    } else if (enemyShotsRef.current.length > 0) {
      targetX = clamp(enemyShotsRef.current.reduce((sum, shot) => sum + shot.x, 0) / enemyShotsRef.current.length, 18, 82)
      targetY = clamp(enemyShotsRef.current.reduce((sum, shot) => sum + shot.y, 0) / enemyShotsRef.current.length, 22, 58)
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
    const stage = clamp(startStage, 1, MAX_RAID_STAGE)
    playerRef.current = getInitialPlayer(selectedShipRef.current)
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
    nukeCooldownRef.current = 0
    nukeFlashRef.current = 0
    nukeStrikeRef.current = null
    nukeBlastOriginRef.current = { x: 50, y: 46 }
    highScoreRef.current = getHighScore()
    unlockedStageRef.current = getUnlockedStage()
    stopBGM()
    startRaidBgm(stageRef.current, 'cruise')
    syncSnapshot()
  }, [startRaidBgm, syncSnapshot])

  const openBriefing = useCallback(() => {
    phaseRef.current = 'briefing'
    setBriefingStep(0)
    playGameSound('select')
    syncSnapshot()
  }, [syncSnapshot])

  const chooseShip = useCallback((ship: ShipOption) => {
    selectedShipRef.current = ship
    setSelectedShipKey(ship.key)
    playerRef.current = getInitialPlayer(ship)
    playGameSound('select')
    syncSnapshot()
  }, [syncSnapshot])

  const pauseGame = useCallback(() => {
    if (phaseRef.current !== 'playing') return
    phaseRef.current = 'paused'
    stopRaidBgm()
    syncSnapshot()
  }, [stopRaidBgm, syncSnapshot])

  const resumeGame = useCallback(() => {
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
    shotsRef.current.push({ ...shot, id: shotId++ })
  }, [])

  const firePlayer = useCallback(() => {
    const player = playerRef.current
    const stacks = player.weapons
    let totalStacks = 0
    for (const key of WEAPON_KEYS) totalStacks += stacks[key]
    if (player.fireCooldown > 0) return

    const baseDamage = 1 + Math.floor(player.rank / 3)
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
        const spread = stacks.spread >= 2 ? 0.32 : stacks.spread >= 1 ? 0.22 : 0.14
        // three wide beams per shot
        pushShot({ x: emitter.x, y: emitter.y - 4, vx: 0, vy: -106, damage: Math.ceil((baseDamage + 2) * emitter.scale), kind: 'laser', radius: 1.2, pierce: 1 + stacks.laser })
        pushShot({ x: emitter.x, y: emitter.y - 3, vx: -Math.sin(spread) * 106, vy: -Math.cos(spread) * 106, damage: Math.ceil((baseDamage + 1) * emitter.scale), kind: 'needle' as any, radius: 0.85 })
        pushShot({ x: emitter.x, y: emitter.y - 3, vx: Math.sin(spread) * 106, vy: -Math.cos(spread) * 106, damage: Math.ceil((baseDamage + 1) * emitter.scale), kind: 'needle' as any, radius: 0.85 })
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

      // ── SPACE ET: single thin fast green laser line ──
      else if (shipKey === 'spaceEt') {
        pushShot({
          x: emitter.x,
          y: emitter.y - 3.6,
          vx: 0,
          vy: -168,  // fastest shot in the game
          damage,
          kind: 'needle' as any,
          radius: 0.85,  // thin
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
              shipKey === 'spaceEt' ? 0.005 :    // Space ET — fastest
                shipKey === 'xwing' ? 0.5 :       // Crosswing — shotgun pump rhythm
                  0.10                              // Black Comet — default

    player.fireCooldown = Math.max(0.042, (baseInterval - Math.min(0.045, totalStacks * 0.006)) / player.ship.fireRate)
    playGameSound(stacks.laser > 0 || shipKey === 'laser' || shipKey === 'xwing' ? 'laser' : 'shoot')
  }, [pushShot])

  const spawnEnemyAt = useCallback((x: number, y: number, wave: number, pattern: number, trainSlot = 0, style?: FormationStyle) => {
    const powerPressure = getPowerScore(playerRef.current)
    const color = style?.color ?? DARK_ENEMY_COLORS[Math.floor(Math.random() * DARK_ENEMY_COLORS.length)]
    const originX = style?.originX ?? x
    const hp = 2 + Math.floor(wave / 2) + Math.floor(powerPressure / 4)
    enemiesRef.current.push({
      id: enemyId++,
      x,
      y,
      vx: (Math.random() - 0.5) * 4,
      vy: 14 + Math.random() * 7 + wave * 0.38,
      hp,
      maxHp: hp,
      radius: 3.7,
      variant: enemyId % 4,
      isBoss: false,
      fireCooldown: Math.max(1.25, 2.1 + Math.random() * 2.1 - wave * 0.04 - powerPressure * 0.025),
      phase: Math.random() * Math.PI * 2,
      color,
      pattern: style?.pattern ?? pattern,
      bossKind: null,
      shieldTime: 0,
      originX,
      amplitude: style?.amplitude ?? (8 + Math.random() * 14),
      trainSlot,
      pathSpeed: style?.pathSpeed ?? (0.06 + Math.random() * 0.035),
      chargeCooldown: 999,
      chargeTimer: 0,
      chargeLane: 50,
      chargePattern: 'single',
    })
  }, [])

  const spawnFormation = useCallback(() => {
    const wave = waveRef.current
    const pattern = Math.floor(Math.random() * 4)
    const count = Math.min(10, 3 + Math.floor(wave / 2))
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
    const bossKind: BossKind = stage === MAX_RAID_STAGE ? 'final' : stage % 5 === 0 ? 'super' : bossCycle[(stage - 1) % bossCycle.length]
    const hpMultiplier =
      bossKind === 'final' ? 8.8 :
        bossKind === 'super' ? 3.45 :
          bossKind === 'gate' ? 1.75 :
            bossKind === 'hydra' ? 1.62 :
              bossKind === 'serpent' ? 1.48 :
                bossKind === 'mantis' ? 1.38 :
                  bossKind === 'orb' ? 1.3 :
                    1.16
    const stagePressure = Math.max(0, stage - 1)
    const hp = Math.round((1450 + wave * 180 + stagePressure * 320 + powerScore * 90) * hpMultiplier)
    const radius =
      bossKind === 'final' ? 25 :
        bossKind === 'super' ? 21 :
          bossKind === 'gate' ? 15 :
            bossKind === 'hydra' ? 14 :
              bossKind === 'serpent' ? 13.4 :
                bossKind === 'mantis' ? 12.8 :
                  11.4
    enemiesRef.current.push({
      id: enemyId++,
      x: 50,
      y: bossKind === 'final' ? -30 : bossKind === 'super' || bossKind === 'gate' ? -24 : -16,
      vx: 0,
      vy: bossKind === 'final' ? 4.4 : bossKind === 'super' || bossKind === 'gate' ? 5.3 : 7,
      hp,
      maxHp: hp,
      radius,
      variant: stage % 4,
      isBoss: true,
      fireCooldown: Math.max(0.75, 1 - stagePressure * 0.025),
      phase: Math.random() * Math.PI * 2,
      color: BOSS_COLORS[bossKind],
      pattern: bossKind === 'final' ? 9 : bossKind === 'super' ? 6 : bossCycle.indexOf(bossKind),
      bossKind,
      shieldTime: (bossKind === 'final' ? 7.4 : bossKind === 'super' || bossKind === 'gate' ? 5.4 : 3.8) + Math.min(2.2, stagePressure * 0.18),
      originX: 50,
      amplitude: bossKind === 'final' ? 34 : bossKind === 'super' ? 30 : bossKind === 'serpent' ? 28 : bossKind === 'gate' ? 18 : 23,
      trainSlot: 0,
      pathSpeed: 0.05,
      chargeCooldown: bossKind === 'final' ? 3.2 : 999,
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

  const spawnRepairPowerUp = useCallback((x: number, y: number) => {
    killsSincePowerRef.current = 0
    powerDropCooldownRef.current = NORMAL_POWER_DROP_COOLDOWN * 0.45
    powerUpsRef.current.push({ id: powerId++, type: 'repair', x, y, vy: 11, radius: 3, spin: Math.random() * 360 })
  }, [])

  const damagePlayer = useCallback((amount: number) => {
    const player = playerRef.current
    if (player.invuln > 0) return
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
      phaseRef.current = 'gameover'
      stopBGM()
      stopRaidBgm()
      playGameSound('gameover')
      spawnSparks(player.x, player.y, '#fb7185', 62, 8)
      addRipple(player.x, player.y, '#fb7185', 18)
      if (player.score > highScoreRef.current) {
        highScoreRef.current = player.score
        saveHighScore(player.score)
      }
    }
  }, [addRipple, spawnSparks, stopRaidBgm])

  const fireEnemy = useCallback((enemy: Enemy, player: Player, time = performance.now()) => {
    if (enemy.isBoss) {
      const kind = enemy.bossKind ?? 'carrier'
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
        const fan = [-42, -28, -14, 0, 14, 28, 42]
        fan.forEach((vx, index) => enemyShotsRef.current.push({ id: shotId++, x: enemy.x + (index - 3) * 1.6, y: enemy.y + 11, vx, vy: 38, damage: 1, kind: 'superShot', radius: 2.15 }))
        for (let i = 0; i < 10; i += 1) {
          const angle = (i / 10) * Math.PI * 2 + time / 720
          enemyShotsRef.current.push({ id: shotId++, x: enemy.x, y: enemy.y + 2, vx: Math.cos(angle) * 28, vy: Math.sin(angle) * 24 + 24, damage: 1, kind: i % 3 === 0 ? 'voidShot' : 'orbShot', radius: 1.9 })
        }
      }
      const aimX = player.x - enemy.x
      const aimY = player.y - enemy.y
      const mag = Math.hypot(aimX, aimY) || 1
      if (kind !== 'orb' && kind !== 'gate') {
        enemyShotsRef.current.push({ id: shotId++, x: enemy.x, y: enemy.y + 2, vx: (aimX / mag) * (kind === 'final' ? 44 : 38), vy: (aimY / mag) * (kind === 'final' ? 44 : 38), damage: 1, kind: kind === 'serpent' || kind === 'mantis' ? 'blade' : kind === 'super' || kind === 'final' ? 'superShot' : kind === 'hydra' ? 'voidShot' : 'boss', radius: kind === 'final' ? 2.35 : 2 })
      }
      playGameSound('rocket')
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
      const progress = 1 - stageClearRef.current / STAGE_CLEAR_SECONDS
      pointerTargetRef.current = null
      pointerVisualRef.current = null
      player.x += (50 - player.x) * Math.min(1, dt * 4.8)
      player.y = progress < 0.78 ? Math.max(4, player.y - dt * 31) : player.y
      player.invuln = Math.max(player.invuln, 0.45)
      updateSparksInPlace(sparksRef.current, dt)
      updateRipplesInPlace(ripplesRef.current, dt)
      if (before > 0 && stageClearRef.current <= 0) {
        player.x = 50
        player.y = 82
        enemiesRef.current = []
        shotsRef.current = []
        enemyShotsRef.current = []
        spawnLockRef.current = 1.2
        spawnTimerRef.current = 1.1
        formationTimerRef.current = 2.2
        pointerTargetRef.current = null
        pointerVisualRef.current = null
      }
      return
    }

    const keys = keysRef.current
    let dx = 0
    let dy = 0
    if (keys.has('arrowleft') || keys.has('a')) dx -= 1
    if (keys.has('arrowright') || keys.has('d')) dx += 1
    if (keys.has('arrowup') || keys.has('w')) dy -= 1
    if (keys.has('arrowdown') || keys.has('s')) dy += 1

    if (pointerTargetRef.current) {
      const target = pointerTargetRef.current
      const pull = Math.min(1, dt * 10.5 * player.ship.speed)
      player.x += (target.x - player.x) * pull
      player.y += (target.y - player.y) * pull
    } else if (dx !== 0 || dy !== 0) {
      const mag = Math.hypot(dx, dy) || 1
      const speed = (keys.has('shift') ? 36 : 48) * player.ship.speed
      player.x += (dx / mag) * speed * dt
      player.y += (dy / mag) * speed * dt
    }

    player.x = clamp(player.x, 4, 96)
    player.y = clamp(player.y, 13, 93)
    player.fireCooldown = Math.max(0, player.fireCooldown - dt)
      ; WEAPON_KEYS.forEach((key) => {
        player.weaponCooldowns[key] = Math.max(0, player.weaponCooldowns[key] - dt)
      })
    player.invuln = Math.max(0, player.invuln - dt)
    player.shield = Math.max(0, player.shield - dt * 0.16)
    firePlayer()

    spawnLockRef.current = Math.max(0, spawnLockRef.current - dt)
    const canSpawnStageEnemies = spawnLockRef.current <= 0 && stageClearRef.current <= 0
    spawnTimerRef.current -= dt
    formationTimerRef.current -= dt
    const bossActive = enemiesRef.current.some((enemy) => enemy.isBoss)
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
      bossTimerRef.current = 0
      waveRef.current += 1
      player.rank = Math.min(20, player.rank + 1)
    }
    if (canSpawnStageEnemies && !bossActive && formationTimerRef.current <= 0) {
      spawnFormation()
      formationTimerRef.current = Math.max(1.75, 4.6 - waveRef.current * 0.12)
    }
    if (canSpawnStageEnemies && !bossActive && spawnTimerRef.current <= 0) {
      spawnEnemyAt(10 + Math.random() * 80, -6, waveRef.current, Math.floor(Math.random() * 4))
      spawnTimerRef.current = Math.max(0.42, 1.25 - waveRef.current * 0.045)
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
      shot.x += shot.vx * dt
      shot.y += shot.vy * dt
      if (shot.y > -12 && shot.y < HEIGHT + 12 && shot.x > -12 && shot.x < WIDTH + 12) {
        liveEnemyShots.push(shot)
      }
    }
    enemyShotsRef.current = liveEnemyShots

    const now = performance.now()
    const nowSeconds = now / 1000
    const enemies = enemiesRef.current
    let liveEnemyCount = 0
    for (const enemy of enemies) {
      const t = nowSeconds + enemy.phase
      const bossKind = enemy.bossKind ?? 'carrier'
      const bossX =
        bossKind === 'carrier' ? 50 + Math.sin(t * 0.7) * 26 :
          bossKind === 'orb' ? 50 + Math.sin(t * 1.4) * 18 :
            bossKind === 'serpent' ? 50 + Math.sin(t * 0.9) * 32 :
              bossKind === 'mantis' ? 50 + Math.sin(t * 1.7) * 24 :
                bossKind === 'hydra' ? 50 + Math.sin(t * 0.62) * 26 + Math.sin(t * 1.8) * 5 :
                  bossKind === 'gate' ? 50 + Math.sin(t * 0.38) * 14 :
                    bossKind === 'final' ? 50 + Math.sin(t * 0.36) * 31 + Math.sin(t * 1.45) * 7 :
                      50 + Math.sin(t * 0.42) * 30
      const bossYTarget =
        bossKind === 'final' ? 17 + Math.sin(t * 0.72) * 3 :
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
      let chargeCooldown = enemy.chargeCooldown
      let chargeTimer = enemy.chargeTimer
      let chargeLane = enemy.chargeLane
      let chargePattern = enemy.chargePattern
      let fireCooldown = enemy.fireCooldown
      if (enemy.isBoss && bossKind === 'final' && enemy.y >= bossYTarget - 0.5) {
        if (chargeTimer > 0) {
          const beforeCharge = chargeTimer
          chargeTimer = Math.max(0, chargeTimer - dt)
          if (enemy.bossKind === 'final' && chargeTimer > 0) {
            const lanes = chargePattern === 'scatter'
              ? [-24, -12, 0, 12, 24].map((offset) => clamp(chargeLane + offset, 8, 92))
              : [clamp(chargeLane, 10, 90)]
            const warningWidth = chargePattern === 'scatter' ? 5 : 7
            if (lanes.some((lane) => Math.abs(player.x - lane) < warningWidth)) {
              damagePlayer(1)
            }
          }
          if (beforeCharge > 0 && chargeTimer <= 0) {
            const lanes = chargePattern === 'scatter'
              ? [-24, -12, 0, 12, 24].map((offset) => clamp(chargeLane + offset, 8, 92))
              : [clamp(chargeLane, 10, 90)]
            lanes.forEach((lane) => {
              for (let i = 0; i < 7; i += 1) {
                enemyShotsRef.current.push({ id: shotId++, x: lane, y: enemy.y + 10 - i * 8, vx: 0, vy: 72, damage: 1, kind: 'beam', radius: chargePattern === 'scatter' ? 2.9 : 4.2 })
              }
              addRipple(lane, Math.max(18, enemy.y + 14), '#fbbf24', chargePattern === 'scatter' ? 11 : 18)
            })
            spawnSparks(enemy.x, enemy.y + 8, '#fbbf24', 70, 9)
            playGameSound('laser')
            chargeCooldown = 3.8 + Math.random() * 1.2
            fireCooldown = 4.5
          }
        } else {
          chargeCooldown = Math.max(0, chargeCooldown - dt)
          if (chargeCooldown <= 0) {
            chargeTimer = 1.45
            chargeLane = clamp(player.x + (Math.random() - 0.5) * 12, 10, 90)
            chargePattern = Math.random() < 0.42 ? 'scatter' : 'single'
            chargeCooldown = 999
            addRipple(chargeLane, 84, '#fbbf24', chargePattern === 'scatter' ? 14 : 20)
            spawnSparks(enemy.x, enemy.y + 6, '#fbbf24', 46, 8)
            playGameSound('countdown')
          }
        }
      }
      const nextFire = enemy.fireCooldown - dt
      const bossInPause = enemy.isBoss && nowSeconds % 6 > 3
      if (nextFire <= 0 && enemy.y > 0 && chargeTimer <= 0 && !bossInPause) {
        fireEnemy(enemy, player, now)
      }

      enemy.x = enemy.isBoss
        ? clamp(bossX, bossKind === 'final' ? 14 : bossKind === 'super' ? 20 : 16, bossKind === 'final' ? 86 : bossKind === 'super' ? 80 : 84)
        : clamp(enemy.x + (trainX - enemy.x) * Math.min(1, dt * 5.8) + enemy.vx * dt, 4, 96)
      enemy.y = enemy.isBoss
        ? (enemy.y < bossYTarget ? Math.min(bossYTarget, enemy.y + enemy.vy * dt) : bossYTarget)
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
        ? (enemy.isBoss ? Math.max(bossKind === 'final' ? 0.62 : 0.85, 1.82 - waveRef.current * 0.028 - stageRef.current * 0.035) : Math.max(1.05, 2.4 + Math.random() * 1.9 - waveRef.current * 0.05))
        : nextFire
      enemy.chargeCooldown = chargeCooldown
      enemy.chargeTimer = chargeTimer
      enemy.chargeLane = chargeLane
      enemy.chargePattern = chargePattern

      if (enemy.y < HEIGHT + 14 && enemy.hp > 0) {
        enemies[liveEnemyCount] = enemy
        liveEnemyCount += 1
      }
    }
    enemies.length = liveEnemyCount

    const powerUps = powerUpsRef.current
    let livePowerUpCount = 0
    for (const powerUp of powerUps) {
      powerUp.y += powerUp.vy * dt
      powerUp.spin += dt * 180
      if (powerUp.y < HEIGHT + 8) {
        powerUps[livePowerUpCount] = powerUp
        livePowerUpCount += 1
      }
    }
    powerUps.length = livePowerUpCount

    updateSparksInPlace(sparksRef.current, dt)
    updateRipplesInPlace(ripplesRef.current, dt)

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
          const bossShielded = enemy.isBoss && (enemy.shieldTime > 0 || enemy.y < 15)
          if (!bossShielded) {
            enemy.hp -= shot.damage
          }
          spawnSparks(enemy.x, enemy.y, bossShielded ? '#fbbf24' : enemy.isBoss ? '#fca5a5' : '#ef4444', enemy.isBoss ? 5 : 3, enemy.isBoss ? 5 : 3)
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
            player.score += enemy.isBoss ? 2800 + waveRef.current * 220 : 95 + waveRef.current * 14
            spawnSparks(enemy.x, enemy.y, enemy.isBoss ? '#fda4af' : '#fb7185', enemy.isBoss ? 60 : 18, enemy.isBoss ? 8 : 5)
            addRipple(enemy.x, enemy.y, enemy.isBoss ? '#fb7185' : '#f97316', enemy.isBoss ? 18 : 9)
            if (!enemy.isBoss) spawnPowerUp(enemy.x, enemy.y)
            if (enemy.isBoss) {
              bossDefeatedThisFrame = true
              const clearedStage = stageRef.current
              if (clearedStage >= MAX_RAID_STAGE) {
                completedRun = true
                phaseRef.current = 'victory'
                unlockedStageRef.current = MAX_RAID_STAGE
                saveUnlockedStage(MAX_RAID_STAGE)
                saveCheckpointStage(14)
                stopRaidBgm()
              } else {
                const nextStage = clearedStage + 1
                preserveLoadoutForSuperBoss = nextStage % 5 === 0
                stageRef.current = nextStage
                unlockedStageRef.current = Math.max(unlockedStageRef.current, nextStage)
                saveUnlockedStage(unlockedStageRef.current)
                if ((RAID_CHECKPOINTS as readonly number[]).includes(nextStage)) {
                  saveCheckpointStage(nextStage)
                }
                bossAlertRef.current = 2.4
                bossMessageRef.current = 'clear'
                startRaidBgm(stageRef.current)
              }
              playGameSound('levelup')
              playGameSound('combo')
              window.setTimeout(() => playGameSound('score'), 180)
            }
            playGameSound(enemy.isBoss ? 'explosion_big' : 'explosion')
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
        powerUpsRef.current = []
        bossAlertRef.current = 3.4
        bossMessageRef.current = 'clear'
        if (player.score > highScoreRef.current) {
          highScoreRef.current = player.score
          saveHighScore(player.score)
        }
        return
      }
      if (preserveLoadoutForSuperBoss) {
        extendLoadoutForSuperBoss(player)
      } else {
        resetStageLoadout(player)
      }
      bossTimerRef.current = BOSS_RESPAWN_SECONDS
      stageClearRef.current = STAGE_CLEAR_SECONDS
      spawnLockRef.current = STAGE_CLEAR_SECONDS + 1.2
      shotsRef.current = []
      enemyShotsRef.current = []
      enemiesRef.current = enemiesRef.current.filter((enemy) => enemy.isBoss && enemy.hp <= 0)
      powerUpsRef.current = []
      if (defeatedBoss) {
        ;[120, 320, 540, 780].forEach((delay, index) => {
          window.setTimeout(() => {
            spawnSparks(defeatedBoss.x + (Math.random() - 0.5) * 12, defeatedBoss.y + (Math.random() - 0.5) * 9, index % 2 === 0 ? '#fda4af' : '#fbbf24', 32, 7)
            addRipple(defeatedBoss.x, defeatedBoss.y, index % 2 === 0 ? '#fb7185' : '#fbbf24', 12 + index * 2)
          }, delay)
        })
        spawnRepairPowerUp(defeatedBoss.x, defeatedBoss.y)
      }
      addRipple(player.x, player.y, '#fca5a5', 12)
    }

    for (const enemyShot of enemyShotsRef.current) {
      const hitRange = enemyShot.radius + PLAYER_RADIUS
      if (
        Math.abs(enemyShot.x - player.x) <= hitRange &&
        Math.abs(enemyShot.y - player.y) <= hitRange &&
        distSq(enemyShot, player) <= hitRange * hitRange
      ) {
        enemyShot.y = HEIGHT + 99
        damagePlayer(enemyShot.kind === 'boss' || enemyShot.kind === 'plasma' || enemyShot.kind === 'blade' || enemyShot.kind === 'orbShot' || enemyShot.kind === 'superShot' || enemyShot.kind === 'beam' || enemyShot.kind === 'scatterBoss' ? 1 : enemyShot.damage)
      }
    }
    enemyShotsRef.current = enemyShotsRef.current.filter((shot) => shot.y < HEIGHT + 30)

    for (const enemy of enemiesRef.current) {
      const hitRange = enemy.radius + PLAYER_RADIUS
      if (
        Math.abs(enemy.x - player.x) <= hitRange &&
        Math.abs(enemy.y - player.y) <= hitRange &&
        distSq(enemy, player) <= hitRange * hitRange
      ) {
        if (player.forceField > 0) {
          if (enemy.isBoss && player.invuln > 0) continue
          const armorCost = enemy.isBoss ? 2 : 1
          player.forceField = Math.max(0, player.forceField - armorCost)
          player.invuln = 0.16
          if (enemy.isBoss) {
            enemy.hp = Math.max(1, enemy.hp - (28 + waveRef.current * 8))
          } else {
            enemy.hp = 0
            player.score += 70 + waveRef.current * 10
            spawnPowerUp(enemy.x, enemy.y)
          }
          spawnSparks(enemy.x, enemy.y, '#22d3ee', enemy.isBoss ? 40 : 18, 7)
          addRipple(enemy.x, enemy.y, '#22d3ee', enemy.isBoss ? 15 : 10)
          playGameSound(enemy.isBoss ? 'hit' : 'explosion')
        } else {
          enemy.hp = 0
          damagePlayer(enemy.isBoss ? 2 : 1)
          spawnSparks(enemy.x, enemy.y, '#fb7185', enemy.isBoss ? 35 : 14, 6)
        }
      }
    }

    for (const powerUp of powerUpsRef.current) {
      const hitRange = powerUp.radius + PLAYER_RADIUS + 1.8
      if (
        Math.abs(powerUp.x - player.x) <= hitRange &&
        Math.abs(powerUp.y - player.y) <= hitRange &&
        distSq(powerUp, player) <= hitRange * hitRange
      ) {
        powerUp.y = HEIGHT + 99
        if (powerUp.type === 'repair') {
          player.hp = Math.min(player.maxHp, player.hp + 1)
        } else if (powerUp.type === 'shield') {
          player.shield = Math.min(8, player.shield + 3)
          player.invuln = Math.max(player.invuln, 0.8)
        } else if (powerUp.type === 'forcefield') {
          player.forceField = FORCE_FIELD_ARMOR
          player.invuln = Math.max(player.invuln, 0.9)
        } else if (powerUp.type === 'option') {
          player.optionTimer = 1
        } else {
          player.weapons[powerUp.type] = Math.min(WEAPON_STACK_CAPS[powerUp.type], player.weapons[powerUp.type] + 1)
          player.weaponTimers[powerUp.type] = 1
        }
        player.score += 120
        spawnSparks(powerUp.x, powerUp.y, powerColor(powerUp.type), 24, 6)
        addRipple(powerUp.x, powerUp.y, powerColor(powerUp.type), 11)
        playPickupVoiceLine(powerUp.type)
        playGameSound('levelup')
      }
    }
    powerUpsRef.current = powerUpsRef.current.filter((powerUp) => powerUp.y < HEIGHT + 20)

    if (player.score > highScoreRef.current) {
      highScoreRef.current = player.score
    }
  }, [addRipple, damagePlayer, detonateNuke, fireEnemy, firePlayer, spawnBoss, spawnEnemyAt, spawnFormation, spawnPowerUp, spawnRepairPowerUp, spawnSparks, startRaidBgm, stopRaidBgm])

  useEffect(() => {
    const tick = (time: number) => {
      const dt = Math.min(0.033, (time - lastTimeRef.current) / 1000 || 0)
      lastTimeRef.current = time
      updateGame(dt)
      drawFxCanvas(time)
      const renderInterval = phaseRef.current === 'playing'
        ? (stageClearRef.current > 0 || bossAlertRef.current > 0 ? GAMEPLAY_ALERT_SNAPSHOT_INTERVAL_MS : GAMEPLAY_SNAPSHOT_INTERVAL_MS)
        : IDLE_SNAPSHOT_INTERVAL_MS
      if (time - lastRenderTimeRef.current >= renderInterval) {
        lastRenderTimeRef.current = time
        syncSnapshot()
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [drawFxCanvas, syncSnapshot, updateGame])

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (key === 'enter' && phaseRef.current === 'paused') resumeGame()
      else if (key === 'enter' && phaseRef.current === 'briefing') resetGame()
      else if (key === 'enter' && phaseRef.current !== 'playing') resetGame()
      if (key === 'p') {
        if (phaseRef.current === 'playing') pauseGame()
        else if (phaseRef.current === 'paused') resumeGame()
      }
      if (key === 'escape') {
        if (phaseRef.current === 'playing') pauseGame()
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
  const hpPips = Array.from({ length: player.maxHp }, (_, index) => index < player.hp)
  const forcePips = Array.from({ length: FORCE_FIELD_ARMOR }, (_, index) => index < player.forceField)
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

  return (
    <div
      className={`raid raid--theme-${((snapshot.stageTheme - 1) % 4) + 1}`}
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
          onClick={activateNuke}
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

      <div className="raid__playfield">
        <canvas ref={fxCanvasRef} className="raid__fx-canvas" />
      </div>

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

      {bossClear && (
        <div className="raid__boss-alert raid__boss-alert--clear">
          Boss Destroyed
        </div>
      )}

      {snapshot.stageClear > 0 && (
        <div className="raid__stage-flash" style={{ opacity: stageFlashOpacity }} />
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
            <div className="raid__pause-actions">
              <button type="button" className="raid__start" onClick={resumeGame}>Continue</button>
              <button type="button" className="raid__menu-button" onClick={() => resetGame()}>Restart</button>
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

      {snapshot.phase !== 'playing' && snapshot.phase !== 'paused' && snapshot.phase !== 'briefing' && (
        <div className="raid__overlay">
          <div className="raid__panel">
            <div className="raid__kicker">{snapshot.phase === 'victory' ? 'Campaign Complete' : snapshot.phase === 'gameover' ? 'Run Ended' : 'Choose Your Ship'}</div>
            <h2>{snapshot.phase === 'victory' ? 'Earth Line Secured' : snapshot.phase === 'gameover' ? 'Ship Destroyed' : 'Rocket Raid'}</h2>
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
            {completedCampaign && (
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
              {snapshot.phase === 'gameover' && checkpointStage > 1 ? <span>Checkpoint Stage {checkpointStage}</span> : <span>PC follows cursor</span>}
              <span>{completedCampaign ? 'Stages 1-15 unlocked' : 'Mobile follows above finger'}</span>
            </div>
            <div className="raid__pause-actions">
              {(snapshot.phase === 'gameover' || snapshot.phase === 'select') && checkpointStage > 1 && (
                <button type="button" className="raid__start" onClick={() => resetGame(checkpointStage, true)}>
                  Continue Stage {checkpointStage}
                </button>
              )}
              <button
                type="button"
                className={(snapshot.phase === 'gameover' || snapshot.phase === 'select') && checkpointStage > 1 ? 'raid__menu-button' : 'raid__start'}
                onClick={snapshot.phase === 'gameover' || snapshot.phase === 'victory' ? () => resetGame(1) : openBriefing}
              >
                {snapshot.phase === 'gameover' ? 'Restart Stage 1' : snapshot.phase === 'victory' ? 'New Run' : 'Start Raid'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
