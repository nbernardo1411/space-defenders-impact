import { useCallback, useEffect, useRef, useState } from 'react'
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
    items: ['Your ship fires automatically.', 'PC follows the mouse cursor.', 'Mobile follows above your finger so your hand does not cover the ship.', 'Stages 5, 10, and 15 are guarded by larger boss threats.'],
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

const FORCE_FIELD_ARMOR = 5
const NORMAL_POWER_DROP_COOLDOWN = 3.8
const POWER_PITY_KILLS = 12
const RENDER_INTERVAL_MS = 16
const BOSS_RESPAWN_SECONDS = 90
const STAGE_CLEAR_SECONDS = 3.15
const MAX_SPARKS = 45
const MAX_RIPPLES = 10

let shotId = 1
let enemyId = 1
let powerId = 1
let sparkId = 1
let rippleId = 1

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function distSq(a: Vec, b: Vec) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
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

export function GradiusRaid({ onClose }: { onClose: () => void }) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const fxCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef(0)
  const lastTimeRef = useRef(0)
  const lastRenderTimeRef = useRef(0)
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
  }))

  const syncSnapshot = useCallback(() => {
    setSnapshot({
      phase: phaseRef.current,
      player: {
        ...playerRef.current,
        weapons: { ...playerRef.current.weapons },
        weaponTimers: { ...playerRef.current.weaponTimers },
        weaponCooldowns: { ...playerRef.current.weaponCooldowns },
      },
      shots: [],
      enemyShots: [],
      enemies: enemiesRef.current.map((enemy) => ({ ...enemy })),
      powerUps: powerUpsRef.current.map((powerUp) => ({ ...powerUp })),
      sparks: [],
      ripples: [],
      wave: waveRef.current,
      stageTheme: stageRef.current,
      bossAlert: bossAlertRef.current,
      bossMessage: bossMessageRef.current,
      highScore: highScoreRef.current,
      selectedShipKey: selectedShipRef.current.key,
      pointer: pointerVisualRef.current ? { ...pointerVisualRef.current } : null,
      stageClear: stageClearRef.current,
      unlockedStage: unlockedStageRef.current,
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

  const drawFxCanvas = useCallback(() => {
    const canvas = fxCanvasRef.current
    const root = rootRef.current
    if (!canvas || !root) return

    const rect = root.getBoundingClientRect()
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

    const toX = (value: number) => (value / WIDTH) * rect.width
    const toY = (value: number) => (value / HEIGHT) * rect.height
    const visualScale = clamp(Math.min(rect.width, rect.height) / 520, 0.8, 1.45)

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
      const length = 22 * visualScale
      const widthPx = 8 * visualScale
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(angle)
      ctx.shadowBlur = 13 * visualScale
      ctx.shadowColor = 'rgba(250,204,21,0.9)'
      ctx.fillStyle = 'rgba(20,8,8,0.95)'
      ctx.strokeStyle = 'rgba(250,204,21,0.9)'
      ctx.lineWidth = 1.5 * visualScale
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
      ctx.strokeStyle = flame
      ctx.lineWidth = 4 * visualScale
      ctx.beginPath()
      ctx.moveTo(0, length * 0.2)
      ctx.lineTo(0, length * 0.86)
      ctx.stroke()
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
      else if (shot.kind === 'scatter') drawTrail(shot, 'rgba(251,113,133,0.8)', 28, 4.5)
      else if (shot.kind === 'rocket') drawOrb(shot, 'rgba(249,115,22,0.9)', 12)
      else if (shot.kind === 'homing') drawMissile(shot)
      else drawTrail(shot, 'rgba(239,35,60,0.86)', 36, 5)
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

  const resetGame = useCallback((startStage = 1, fullyBuffed = false) => {
    const stage = clamp(startStage, 1, MAX_RAID_STAGE)
    playerRef.current = getInitialPlayer(selectedShipRef.current)
    if (fullyBuffed) {
  const p = playerRef.current
  ;(Object.keys(WEAPON_STACK_CAPS) as WeaponKey[]).forEach((key) => {
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
    const totalStacks = Object.values(stacks).reduce((sum, value) => sum + value, 0)
    if (player.fireCooldown > 0) return

    const baseDamage = 1 + Math.floor(player.rank / 3)
    const optionOffset = rootRef.current && rootRef.current.getBoundingClientRect().width < 640 ? 12 : 8.5
    const shipKey = player.ship.key

    const emitters = [{ x: player.x, y: player.y, scale: 1, main: true }]
    if (player.optionTimer > 0) {
      emitters.push(
        { x: clamp(player.x - optionOffset, 4, 96), y: player.y + 1.8, scale: 0.72, main: false },
        { x: clamp(player.x + optionOffset, 4, 96), y: player.y + 1.8, scale: 0.72, main: false },
      )
    }

    const firingWeapons = (Object.keys(WEAPON_FIRE_INTERVALS) as WeaponKey[]).reduce((ready, key) => {
      ready[key] = stacks[key] > 0 && player.weaponCooldowns[key] <= 0
      return ready
    }, { ...EMPTY_WEAPON_FLAGS })

    emitters.forEach((emitter) => {
      const damage = Math.max(1, Math.ceil(baseDamage * emitter.scale))

      // ── BLACK COMET: original default attack ──
      if (shipKey === 'rocket') {
        pushShot({ x: emitter.x, y: emitter.y - 3.6, vx: 0, vy: -96, damage, kind: 'pulse', radius: 1.35 })
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
          vy: -55, // fast moving beam pulse
          damage: Math.ceil((baseDamage + 8 + stacks.laser * 2) * emitter.scale),
          kind: 'laser',
          radius: 7.5,   // thick kamehameha-style beam
          pierce: 4,     // pierces a few enemies only
        })
        const salvoOffsets = [-5.4, 5.4]
          salvoOffsets.forEach((offset, index) => {
            const side = offset < 0 ? -1 : 1
            pushShot({ x: emitter.x + offset, y: emitter.y + (index < 2 ? -1.8 : 0.8), vx: side * (28 + index * 4), vy: -46 - index * 4, damage: Math.ceil((baseDamage + 2) * emitter.scale), kind: 'homing', radius: 2.1, turn: 5.2 })
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

          const count = Math.min(8, 2 + stacks.scatter * 2)
          for (let i = 0; i < count; i++) {
            const angle = -Math.PI / 2 + (i - (count - 1) / 2) * 0.18
            pushShot({ x: emitter.x, y: emitter.y - 1.5, vx: Math.cos(angle) * 82, vy: Math.sin(angle) * 82, damage, kind: 'scatter', radius: 1.2 })
          }

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
        pushShot({ x: emitter.x, y: emitter.y - 3, vx: -Math.sin(spread) * 106, vy: -Math.cos(spread) * 106, damage: Math.ceil((baseDamage + 1) * emitter.scale), kind: 'needle' as any,radius: 0.85})
        pushShot({ x: emitter.x, y: emitter.y - 3, vx: Math.sin(spread) * 106, vy: -Math.cos(spread) * 106, damage: Math.ceil((baseDamage + 1) * emitter.scale), kind: 'needle' as any,radius: 0.85})
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
    ;(Object.keys(WEAPON_FIRE_INTERVALS) as WeaponKey[]).forEach((key) => {
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
      0.12                               // Black Comet — default

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
    bossAlertRef.current = 2.7
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
    ;(['spread', 'laser', 'scatter', 'rocket', 'homing'] as WeaponKey[]).forEach((key) => {
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
      spawnSparks(player.x, player.y, '#c4b5fd', 20, 6)
      addRipple(player.x, player.y, '#c4b5fd', 9)
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

  const fireEnemy = useCallback((enemy: Enemy, player: Player) => {
    if (enemy.isBoss) {
      const kind = enemy.bossKind ?? 'carrier'
      if (kind === 'carrier') {
        const fan = [-28, -14, 0, 14, 28]
        fan.forEach((vx) => enemyShotsRef.current.push({ id: shotId++, x: enemy.x, y: enemy.y + 7, vx, vy: 31, damage: 1, kind: 'boss', radius: 1.7 }))
      }
      if (kind === 'orb') {
        for (let i = 0; i < 8; i += 1) {
          const angle = (i / 8) * Math.PI * 2 + performance.now() / 900
          enemyShotsRef.current.push({ id: shotId++, x: enemy.x, y: enemy.y, vx: Math.cos(angle) * 25, vy: Math.sin(angle) * 25 + 19, damage: 1, kind: 'orbShot', radius: 1.45 })
        }
        for (let i = 0; i < 10; i += 1) {
          if (i === 2 || i === 7) continue
          const angle = -Math.PI * 0.92 + (i / 9) * Math.PI * 0.84
          enemyShotsRef.current.push({ id: shotId++, x: enemy.x, y: enemy.y + 5, vx: Math.cos(angle) * 34, vy: Math.sin(angle) * 14 + 36, damage: 1, kind: 'scatterBoss', radius: 1.35 })
        }
      }
      if (kind === 'serpent') {
        const lane = Math.sin(performance.now() / 280) * 18
        ;[-1, 0, 1].forEach((offset) => {
          enemyShotsRef.current.push({ id: shotId++, x: enemy.x + lane + offset * 8, y: enemy.y + 8, vx: offset * 10, vy: 38, damage: 1, kind: 'blade', radius: 1.9 })
        })
      }
      if (kind === 'mantis') {
        const sweep = Math.sin(performance.now() / 260) * 24
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
        const phase = performance.now() / 380
        ;[-24, -8, 8, 24].forEach((lane, index) => {
          const drift = Math.sin(phase + index) * 4
          enemyShotsRef.current.push({ id: shotId++, x: enemy.x + lane + drift, y: enemy.y + 12, vx: drift * 0.8, vy: 30 + index * 2, damage: 1, kind: index % 2 === 0 ? 'superShot' : 'needle', radius: 1.85 })
        })
        const lane = Math.round((enemy.x + Math.sin(performance.now() / 520) * 16) / 10) * 10
        for (let i = 0; i < 6; i += 1) {
          enemyShotsRef.current.push({ id: shotId++, x: clamp(lane, 12, 88), y: enemy.y + 8 - i * 8, vx: 0, vy: 58, damage: 1, kind: 'beam', radius: 2.35 })
        }
      }
      if (kind === 'super') {
        const fan = [-34, -17, 0, 17, 34]
        fan.forEach((vx) => enemyShotsRef.current.push({ id: shotId++, x: enemy.x, y: enemy.y + 10, vx, vy: 34, damage: 1, kind: 'superShot', radius: 2 }))
        for (let i = 0; i < 6; i += 1) {
          const angle = (i / 6) * Math.PI * 2 - performance.now() / 800
          enemyShotsRef.current.push({ id: shotId++, x: enemy.x, y: enemy.y + 2, vx: Math.cos(angle) * 22, vy: Math.sin(angle) * 22 + 20, damage: 1, kind: 'orbShot', radius: 1.7 })
        }
      }
      if (kind === 'final') {
        const fan = [-42, -28, -14, 0, 14, 28, 42]
        fan.forEach((vx, index) => enemyShotsRef.current.push({ id: shotId++, x: enemy.x + (index - 3) * 1.6, y: enemy.y + 11, vx, vy: 38, damage: 1, kind: 'superShot', radius: 2.15 }))
        for (let i = 0; i < 10; i += 1) {
          const angle = (i / 10) * Math.PI * 2 + performance.now() / 720
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
    if (stageClearRef.current > 0) {
      const before = stageClearRef.current
      stageClearRef.current = Math.max(0, stageClearRef.current - dt)
      const progress = 1 - stageClearRef.current / STAGE_CLEAR_SECONDS
      pointerTargetRef.current = null
      pointerVisualRef.current = null
      player.x += (50 - player.x) * Math.min(1, dt * 4.8)
      player.y = progress < 0.78 ? Math.max(4, player.y - dt * 31) : player.y
      player.invuln = Math.max(player.invuln, 0.45)
      sparksRef.current = sparksRef.current
        .map((spark) => ({ ...spark, x: spark.x + spark.vx * dt, y: spark.y + spark.vy * dt, life: spark.life - dt }))
        .filter((spark) => spark.life > 0)
        .slice(-MAX_SPARKS)
      ripplesRef.current = ripplesRef.current
        .map((ripple) => ({ ...ripple, life: ripple.life - dt }))
        .filter((ripple) => ripple.life > 0)
        .slice(-MAX_RIPPLES)
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
    ;(Object.keys(player.weaponCooldowns) as WeaponKey[]).forEach((key) => {
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
    if (bossActive) {
      startRaidBgm(stageRef.current, 'boss')
    } else if (bossTimerRef.current <= RAID_BOSS_APPROACH_SILENCE_SECONDS) {
      stopRaidBgm()
    } else {
      startRaidBgm(stageRef.current, enemiesRef.current.length > 0 ? 'combat' : 'cruise')
    }
    powerDropCooldownRef.current = Math.max(0, powerDropCooldownRef.current - dt)
    bossAlertRef.current = Math.max(0, bossAlertRef.current - dt)

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

    const liveShots: Shot[] = []
    for (const shot of shotsRef.current) {
      if (shot.kind === 'homing') {
        let target: Enemy | null = null
        let bestScore = Number.POSITIVE_INFINITY
        for (const enemy of enemiesRef.current) {
          if (enemy.hp <= 0 || enemy.y < -10) continue
          const distance = distSq(shot, enemy)
          const forwardBias = enemy.y > shot.y + 18 ? 2400 : 0
          const bossBias = enemy.isBoss ? -1400 : 0
          const score = distance + forwardBias + bossBias
          if (score < bestScore) {
            bestScore = score
            target = enemy
          }
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

    enemiesRef.current = enemiesRef.current
      .map((enemy) => {
        const t = performance.now() / 1000 + enemy.phase
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
        if (enemy.isBoss && bossKind === 'final' && enemy.y >= bossYTarget - 0.5) {
          if (chargeTimer > 0) {
            const beforeCharge = chargeTimer
            chargeTimer = Math.max(0, chargeTimer - dt)
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
const bossCycle = (performance.now() / 1000) % 6
const bossInPause = enemy.isBoss && bossCycle > 3
if (nextFire <= 0 && enemy.y > 0 && chargeTimer <= 0 && !bossInPause) {
  fireEnemy(enemy, player)
}
        return {
          ...enemy,
          x: enemy.isBoss ? clamp(bossX, bossKind === 'final' ? 14 : bossKind === 'super' ? 20 : 16, bossKind === 'final' ? 86 : bossKind === 'super' ? 80 : 84) : clamp(enemy.x + (trainX - enemy.x) * Math.min(1, dt * 5.8) + enemy.vx * dt, 4, 96),
          y: enemy.isBoss ? (enemy.y < bossYTarget ? Math.min(bossYTarget, enemy.y + enemy.vy * dt) : bossYTarget) : enemy.y + enemy.vy * dt,
          shieldTime: Math.max(0, enemy.shieldTime - dt),
          fireCooldown: nextFire <= 0
            ? (enemy.isBoss ? Math.max(bossKind === 'final' ? 0.62 : 0.85, 1.82 - waveRef.current * 0.028 - stageRef.current * 0.035) : Math.max(1.05, 2.4 + Math.random() * 1.9 - waveRef.current * 0.05))
            : nextFire,
          chargeCooldown,
          chargeTimer,
          chargeLane,
          chargePattern,
        }
      })
      .filter((enemy) => enemy.y < HEIGHT + 14 && enemy.hp > 0)

    powerUpsRef.current = powerUpsRef.current
      .map((powerUp) => ({ ...powerUp, y: powerUp.y + powerUp.vy * dt, spin: powerUp.spin + dt * 180 }))
      .filter((powerUp) => powerUp.y < HEIGHT + 8)

    sparksRef.current = sparksRef.current
      .map((spark) => ({ ...spark, x: spark.x + spark.vx * dt, y: spark.y + spark.vy * dt, life: spark.life - dt }))
      .filter((spark) => spark.life > 0)
      .slice(-MAX_SPARKS)

    ripplesRef.current = ripplesRef.current
      .map((ripple) => ({ ...ripple, life: ripple.life - dt }))
      .filter((ripple) => ripple.life > 0)
      .slice(-MAX_RIPPLES)

    let bossDefeatedThisFrame = false
    let preserveLoadoutForSuperBoss = false
    let completedRun = false
    for (const shot of shotsRef.current) {
      for (const enemy of enemiesRef.current) {
        if (enemy.hp <= 0) continue
        if (distSq(shot, enemy) <= (shot.radius + enemy.radius) ** 2) {
          const bossShielded = enemy.isBoss && (enemy.shieldTime > 0 || enemy.y < 15)
          if (!bossShielded) {
            enemy.hp -= shot.damage
          }
          spawnSparks(enemy.x, enemy.y, bossShielded ? '#fbbf24' : enemy.isBoss ? '#fca5a5' : '#ef4444', enemy.isBoss ? 5 : 3, enemy.isBoss ? 5 : 3)
          if (shot.pierce && shot.pierce > 0) {
            shot.pierce -= 1
          } else {
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
      if (distSq(enemyShot, player) <= (enemyShot.radius + PLAYER_RADIUS) ** 2) {
        enemyShot.y = HEIGHT + 99
        damagePlayer(enemyShot.kind === 'boss' || enemyShot.kind === 'plasma' || enemyShot.kind === 'blade' || enemyShot.kind === 'orbShot' || enemyShot.kind === 'superShot' || enemyShot.kind === 'beam' || enemyShot.kind === 'scatterBoss' ? 1 : enemyShot.damage)
      }
    }
    enemyShotsRef.current = enemyShotsRef.current.filter((shot) => shot.y < HEIGHT + 30)

    for (const enemy of enemiesRef.current) {
      if (distSq(enemy, player) <= (enemy.radius + PLAYER_RADIUS) ** 2) {
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
      if (distSq(powerUp, player) <= (powerUp.radius + PLAYER_RADIUS + 1.8) ** 2) {
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
        playGameSound('levelup')
      }
    }
    powerUpsRef.current = powerUpsRef.current.filter((powerUp) => powerUp.y < HEIGHT + 20)

    if (player.score > highScoreRef.current) {
      highScoreRef.current = player.score
    }
  }, [addRipple, damagePlayer, fireEnemy, firePlayer, spawnBoss, spawnEnemyAt, spawnFormation, spawnPowerUp, spawnRepairPowerUp, spawnSparks, startRaidBgm, stopRaidBgm])

  useEffect(() => {
    const tick = (time: number) => {
      const dt = Math.min(0.033, (time - lastTimeRef.current) / 1000 || 0)
      lastTimeRef.current = time
      updateGame(dt)
      drawFxCanvas()
      if (time - lastRenderTimeRef.current >= RENDER_INTERVAL_MS || phaseRef.current !== 'playing') {
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
      keysRef.current.add(key)
    }
    const up = (event: KeyboardEvent) => keysRef.current.delete(event.key.toLowerCase())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [onClose, pauseGame, resetGame, resumeGame, syncSnapshot])

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
  const weaponEntries = (Object.keys(player.weapons) as WeaponKey[]).filter((key) => player.weapons[key] > 0)
  const optionOffset = rootRef.current && rootRef.current.getBoundingClientRect().width < 640 ? 12 : 8.5
  const optionShipSize = getShipSpriteSize(player.ship.key, 'option')
  const briefing = BRIEFING_PANELS[briefingStep] ?? BRIEFING_PANELS[0]
  const stageClearProgress = snapshot.stageClear > 0 ? 1 - snapshot.stageClear / STAGE_CLEAR_SECONDS : 0
  const stageFlashOpacity =
    stageClearProgress > 0.66 && stageClearProgress < 0.9
      ? Math.sin(((stageClearProgress - 0.66) / 0.24) * Math.PI)
      : 0
  const completedCampaign = snapshot.unlockedStage >= MAX_RAID_STAGE
  const checkpointStage = getCheckpointStage()
  const stageSelectButtons = Array.from({ length: MAX_RAID_STAGE }, (_, index) => index + 1)

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
      <div className="raid__nebula" />
      <div className="raid__starfield raid__starfield--far" />
      <div className="raid__starfield raid__starfield--near" />
      <div className="raid__speedlines" />

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
        <button className="raid__pause" type="button" onClick={pauseGame}>Pause</button>
        <button className="raid__exit" type="button" onClick={onClose}>Exit</button>
      </div>

      <div className="raid__playfield">
        <canvas ref={fxCanvasRef} className="raid__fx-canvas" />
        {snapshot.pointer && snapshot.phase === 'playing' && (
          <div className="raid__finger-guide" style={{ left: `${snapshot.pointer.x}%`, top: `${snapshot.pointer.y}%` }} />
        )}

        {snapshot.enemies.map((enemy) => (
          <div
            key={enemy.id}
            className={[
              'raid__enemy',
              enemy.isBoss ? 'raid__enemy--boss' : '',
              enemy.bossKind ? `raid__enemy--boss-${enemy.bossKind}` : '',
            ].join(' ')}
            style={{ left: `${enemy.x}%`, top: `${enemy.y}%`, width: enemy.isBoss ? (enemy.bossKind === 'final' ? 'min(52vw, 470px)' : enemy.bossKind === 'super' ? 'min(42vw, 380px)' : enemy.bossKind === 'gate' ? 'min(34vw, 310px)' : enemy.bossKind === 'hydra' ? 'min(30vw, 260px)' : 'min(24vw, 210px)') : 'min(8vw, 64px)' }}
          >
            <AlienShip variant={enemy.variant} isBoss={enemy.isBoss} isFinalBoss={enemy.bossKind === 'final'} bossKind={enemy.bossKind ?? undefined} color={enemy.color} size={enemy.isBoss ? (enemy.bossKind === 'final' ? 330 : enemy.bossKind === 'super' ? 280 : enemy.bossKind === 'gate' ? 220 : enemy.bossKind === 'hydra' ? 190 : 156) : 50} />
            {enemy.isBoss && (
              <div className="raid__boss-aura">
                <span />
                <span />
                <span />
              </div>
            )}
            {enemy.isBoss && (
              <div className="raid__boss-reticle">
                <span />
                <span />
                <span />
                <span />
              </div>
            )}
            {enemy.isBoss && (
              <>
              {(enemy.shieldTime > 0 || enemy.y < 15) && <div className="raid__boss-shield" />}
              <div className={enemy.bossKind === 'super' || enemy.bossKind === 'final' ? 'raid__boss-bar raid__boss-bar--super' : 'raid__boss-bar'}>
                <span style={{ width: `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%` }} />
              </div>
              </>
            )}
          </div>
        ))}

        {snapshot.enemies
          .filter((enemy) => enemy.bossKind === 'final' && enemy.chargeTimer > 0)
          .flatMap((enemy) => {
            const lanes = enemy.chargePattern === 'scatter'
              ? [-24, -12, 0, 12, 24].map((offset) => clamp(enemy.chargeLane + offset, 8, 92))
              : [clamp(enemy.chargeLane, 10, 90)]
            return lanes.map((lane, index) => (
              <div
                key={`${enemy.id}-${index}`}
                className={enemy.chargePattern === 'scatter' ? 'raid__final-charge-line raid__final-charge-line--scatter' : 'raid__final-charge-line'}
                style={{ left: `${lane}%`, opacity: Math.max(0.28, Math.min(1, enemy.chargeTimer / 1.45)) }}
              />
            ))
          })}

        {snapshot.powerUps.map((powerUp) => (
          <div
            key={powerUp.id}
            className={`raid__power raid__power--${powerUp.type}`}
            style={{
              left: `${powerUp.x}%`,
              top: `${powerUp.y}%`,
              color: powerColor(powerUp.type),
              transform: `translate(-50%, -50%) rotate(${powerUp.spin}deg)`,
            }}
          >
            <span>{powerGlyph(powerUp.type)}</span>
          </div>
        ))}

        <div
          className={[
            'raid__player',
            player.invuln > 0 || player.shield > 0 ? 'raid__player--shielded' : '',
            player.forceField > 0 ? 'raid__player--forcefield' : '',
            snapshot.phase === 'gameover' ? 'raid__player--down' : '',
          ].join(' ')}
          style={{ left: `${player.x}%`, top: `${player.y}%` }}
        >
          <TowerShip tType={player.ship.key} color={PLAYER_COLOR} size={getShipSpriteSize(player.ship.key, 'player')} />
          <span className="raid__engine" />
        </div>
        {player.optionTimer > 0 && (
          <>
            <div className="raid__option raid__option--left" style={{ left: `${clamp(player.x - optionOffset, 4, 96)}%`, top: `${player.y + 1.8}%` }}>
              <TowerShip tType={player.ship.key} color="#ef233c" size={optionShipSize} />
            </div>
            <div className="raid__option raid__option--right" style={{ left: `${clamp(player.x + optionOffset, 4, 96)}%`, top: `${player.y + 1.8}%` }}>
              <TowerShip tType={player.ship.key} color="#ef233c" size={optionShipSize} />
            </div>
          </>
        )}
      </div>

      {snapshot.bossAlert > 0 && (
        <div className="raid__boss-alert">
          {snapshot.bossMessage === 'clear' ? 'Boss Destroyed' : 'Boss Vector Incoming'}
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
              {briefing.items.map((item) => (
                <div key={item} className="raid__briefing-card">
                  {item}
                </div>
              ))}
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
