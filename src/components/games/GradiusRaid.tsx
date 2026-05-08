import { useCallback, useEffect, useRef, useState } from 'react'
import { playGameSound, stopBGM } from './sound'
import { AlienShip, TowerShip } from './towerDefense/sprites'
import './GradiusRaid.css'

type WeaponKey = 'spread' | 'laser' | 'scatter' | 'rocket'
type PowerKind = WeaponKey | 'option' | 'shield' | 'repair'
type GamePhase = 'select' | 'playing' | 'paused' | 'gameover'
type BossMessage = 'incoming' | 'clear' | null
type BossKind = 'carrier' | 'orb' | 'serpent' | 'super'

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
  optionTimer: number
  fireCooldown: number
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
  kind: WeaponKey | 'pulse' | 'enemy' | 'boss' | 'plasma'
  radius: number
  pierce?: number
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
}

const WIDTH = 100
const HEIGHT = 100
const PLAYER_RADIUS = 3.2
const STORAGE_KEY = 'gradiusRaidHighScore'
const PLAYER_COLOR = '#ef233c'
const DARK_ENEMY_COLORS = ['#4c1d95', '#581c87', '#7f1d1d', '#831843', '#312e81', '#164e63', '#3f1d2e', '#1f2937']
const BOSS_COLORS: Record<BossKind, string> = {
  carrier: '#7f1d1d',
  orb: '#581c87',
  serpent: '#164e63',
  super: '#3f1d2e',
}
const RAID_BGM_THEMES = [
  { bass: 55, mid: 110, lead: 220, gain: 0.045 },
  { bass: 49, mid: 147, lead: 294, gain: 0.047 },
  { bass: 62, mid: 124, lead: 247, gain: 0.046 },
  { bass: 41, mid: 123, lead: 330, gain: 0.043 },
]

const SHIP_OPTIONS: ShipOption[] = [
  { key: 'rocket', name: 'Black Comet', role: 'Balanced missile frame', speed: 1, hp: 6, fireRate: 1 },
  { key: 'fast', name: 'Red Wraith', role: 'Fastest dodge craft', speed: 1.18, hp: 5, fireRate: 1.08 },
  { key: 'gatling', name: 'Crimson Saw', role: 'Rapid assault striker', speed: 0.96, hp: 6, fireRate: 1.18 },
  { key: 'laser', name: 'Night Lance', role: 'Sharper beam control', speed: 1.03, hp: 5, fireRate: 1.12 },
  { key: 'dreadnought', name: 'Obsidian Ark', role: 'Heavy survival hull', speed: 0.82, hp: 8, fireRate: 0.86 },
]

const EMPTY_WEAPONS: Record<WeaponKey, number> = {
  spread: 0,
  laser: 0,
  scatter: 0,
  rocket: 0,
}

const EMPTY_WEAPON_TIMERS: Record<WeaponKey, number> = {
  spread: 0,
  laser: 0,
  scatter: 0,
  rocket: 0,
}

const WEAPON_PICKUP_SECONDS = 36
const WEAPON_PICKUP_MAX_SECONDS = 72
const OPTION_PICKUP_SECONDS = 32
const OPTION_PICKUP_MAX_SECONDS = 58
const BOSS_EFFECT_EXTENSION_SECONDS = 30
const NORMAL_POWER_DROP_COOLDOWN = 5.5
const POWER_PITY_KILLS = 20

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

function getInitialPlayer(ship = SHIP_OPTIONS[0]): Player {
  return {
    x: 50,
    y: 82,
    hp: ship.hp,
    maxHp: ship.hp,
    invuln: 1.8,
    shield: 0,
    optionTimer: 0,
    fireCooldown: 0,
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
  if (type === 'option') return '#e879f9'
  if (type === 'repair') return '#86efac'
  return '#c4b5fd'
}

function powerGlyph(type: PowerKind) {
  if (type === 'laser') return 'L'
  if (type === 'spread') return 'V'
  if (type === 'scatter') return '*'
  if (type === 'rocket') return 'R'
  if (type === 'option') return 'O'
  if (type === 'repair') return '+'
  return 'S'
}

function getPowerScore(player: Player) {
  return Object.values(player.weapons).reduce((sum, value) => sum + value, 0)
}

export function GradiusRaid({ onClose }: { onClose: () => void }) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef(0)
  const lastTimeRef = useRef(0)
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
  const powerDropCooldownRef = useRef(0)
  const killsSincePowerRef = useRef(0)
  const bossAlertRef = useRef(0)
  const bossMessageRef = useRef<BossMessage>(null)
  const highScoreRef = useRef(getHighScore())
  const raidAudioContextRef = useRef<AudioContext | null>(null)
  const raidBgmOscillatorsRef = useRef<OscillatorNode[]>([])
  const raidBgmNodesRef = useRef<AudioNode[]>([])
  const [selectedShipKey, setSelectedShipKey] = useState(SHIP_OPTIONS[0].key)
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
  }))

  const syncSnapshot = useCallback(() => {
    setSnapshot({
      phase: phaseRef.current,
      player: {
        ...playerRef.current,
        weapons: { ...playerRef.current.weapons },
        weaponTimers: { ...playerRef.current.weaponTimers },
      },
      shots: shotsRef.current.map((shot) => ({ ...shot })),
      enemyShots: enemyShotsRef.current.map((shot) => ({ ...shot })),
      enemies: enemiesRef.current.map((enemy) => ({ ...enemy })),
      powerUps: powerUpsRef.current.map((powerUp) => ({ ...powerUp })),
      sparks: sparksRef.current.map((spark) => ({ ...spark })),
      ripples: ripplesRef.current.map((ripple) => ({ ...ripple })),
      wave: waveRef.current,
      stageTheme: stageRef.current,
      bossAlert: bossAlertRef.current,
      bossMessage: bossMessageRef.current,
      highScore: highScoreRef.current,
      selectedShipKey: selectedShipRef.current.key,
      pointer: pointerVisualRef.current ? { ...pointerVisualRef.current } : null,
    })
  }, [])

  const addRipple = useCallback((x: number, y: number, color: string, size: number) => {
    ripplesRef.current.push({ id: rippleId++, x, y, color, size, life: 0.5, maxLife: 0.5 })
  }, [])

  const stopRaidBgm = useCallback(() => {
    raidBgmOscillatorsRef.current.forEach((oscillator) => {
      try {
        oscillator.stop()
      } catch {
        // Already stopped.
      }
    })
    raidBgmNodesRef.current.forEach((node) => node.disconnect())
    raidBgmOscillatorsRef.current = []
    raidBgmNodesRef.current = []
  }, [])

  const startRaidBgm = useCallback((stage: number) => {
    if (typeof window === 'undefined') return
    stopRaidBgm()

    const Context = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Context) return

    const ctx = raidAudioContextRef.current ?? new Context()
    raidAudioContextRef.current = ctx
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }

    const theme = RAID_BGM_THEMES[(stage - 1) % RAID_BGM_THEMES.length]
    const master = ctx.createGain()
    master.gain.setValueAtTime(theme.gain, ctx.currentTime)
    master.connect(ctx.destination)
    raidBgmNodesRef.current.push(master)

    const pulse = ctx.createOscillator()
    const pulseGain = ctx.createGain()
    pulse.frequency.setValueAtTime(0.55 + (stage % 4) * 0.13, ctx.currentTime)
    pulseGain.gain.setValueAtTime(theme.gain * 0.7, ctx.currentTime)
    pulse.connect(pulseGain)
    pulseGain.connect(master.gain)
    pulse.start()

    const makeLayer = (freq: number, type: OscillatorType, gainValue: number, detune = 0) => {
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.type = type
      oscillator.frequency.setValueAtTime(freq, ctx.currentTime)
      oscillator.detune.setValueAtTime(detune, ctx.currentTime)
      gain.gain.setValueAtTime(gainValue, ctx.currentTime)
      oscillator.connect(gain)
      gain.connect(master)
      oscillator.start()
      raidBgmOscillatorsRef.current.push(oscillator)
      raidBgmNodesRef.current.push(gain)
    }

    makeLayer(theme.bass, 'sawtooth', 0.45)
    makeLayer(theme.mid, 'triangle', 0.2, -6)
    makeLayer(theme.mid * 1.01, 'triangle', 0.16, 8)
    makeLayer(theme.lead, 'square', 0.055)

    raidBgmOscillatorsRef.current.push(pulse)
    raidBgmNodesRef.current.push(pulseGain)
  }, [stopRaidBgm])

  const spawnSparks = useCallback((x: number, y: number, color: string, count: number, size = 5) => {
    for (let i = 0; i < count; i += 1) {
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

  const resetGame = useCallback(() => {
    playerRef.current = getInitialPlayer(selectedShipRef.current)
    shotsRef.current = []
    enemyShotsRef.current = []
    enemiesRef.current = []
    powerUpsRef.current = []
    sparksRef.current = []
    ripplesRef.current = []
    phaseRef.current = 'playing'
    stageRef.current = 1
    waveRef.current = 1
    spawnTimerRef.current = 1.25
    formationTimerRef.current = 3.4
    bossTimerRef.current = 36
    powerDropCooldownRef.current = 0
    killsSincePowerRef.current = 0
    bossAlertRef.current = 0
    bossMessageRef.current = null
    highScoreRef.current = getHighScore()
    stopBGM()
    startRaidBgm(stageRef.current)
    syncSnapshot()
  }, [startRaidBgm, syncSnapshot])

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
    startRaidBgm(stageRef.current)
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
    const emitters = [{ x: player.x, y: player.y, scale: 1 }]
    if (player.optionTimer > 0) {
      emitters.push(
        { x: clamp(player.x - 7, 4, 96), y: player.y + 1.4, scale: 0.72 },
        { x: clamp(player.x + 7, 4, 96), y: player.y + 1.4, scale: 0.72 },
      )
    }

    emitters.forEach((emitter) => {
      const damage = Math.max(1, Math.ceil(baseDamage * emitter.scale))
      pushShot({ x: emitter.x, y: emitter.y - 3.6, vx: 0, vy: -96, damage, kind: 'pulse', radius: 1.35 })

      if (stacks.spread > 0) {
        const fan = stacks.spread >= 3 ? [-34, -18, 18, 34] : [-24, 24]
        fan.forEach((vx) => pushShot({ x: emitter.x, y: emitter.y - 2.8, vx, vy: -86, damage, kind: 'spread', radius: 1.35 }))
      }

      if (stacks.laser > 0) {
        const side = stacks.laser >= 2 ? 1.6 : 0
        pushShot({ x: emitter.x - side, y: emitter.y - 5, vx: 0, vy: -132, damage: Math.ceil((baseDamage + 2 + stacks.laser) * emitter.scale), kind: 'laser', radius: 1.85, pierce: 1 + stacks.laser })
        if (stacks.laser >= 3) {
          pushShot({ x: emitter.x + side, y: emitter.y - 5, vx: 0, vy: -132, damage: Math.ceil((baseDamage + 2) * emitter.scale), kind: 'laser', radius: 1.65, pierce: 2 })
        }
      }

      if (stacks.scatter > 0) {
        const count = Math.min(8, 2 + stacks.scatter * 2)
        for (let i = 0; i < count; i += 1) {
          const angle = -Math.PI / 2 + (i - (count - 1) / 2) * 0.18
          pushShot({ x: emitter.x, y: emitter.y - 1.5, vx: Math.cos(angle) * 82, vy: Math.sin(angle) * 82, damage, kind: 'scatter', radius: 1.2 })
        }
      }

      if (stacks.rocket > 0) {
        const offsets = stacks.rocket >= 3 ? [-4.6, 4.6] : [stacks.rocket >= 2 ? -3.5 : 3.5]
        offsets.forEach((offset) => {
          pushShot({ x: emitter.x + offset, y: emitter.y - 1, vx: offset * 1.7, vy: -72, damage: Math.ceil((baseDamage + 4 + stacks.rocket) * emitter.scale), kind: 'rocket', radius: 2.2 })
        })
      }
    })

    if (stacks.rocket > 0 && Math.random() < 0.12) playGameSound('rocket')

    player.fireCooldown = Math.max(0.052, (0.12 - Math.min(0.045, totalStacks * 0.006)) / player.ship.fireRate)
    playGameSound(stacks.laser > 0 ? 'laser' : 'shoot')
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
    const player = playerRef.current
    const powerScore = getPowerScore(playerRef.current)
    const bossKind: BossKind =
      stageRef.current % 4 === 0 ? 'super' :
      stageRef.current % 3 === 0 ? 'serpent' :
      stageRef.current % 2 === 0 ? 'orb' :
      'carrier'
    const hpMultiplier = bossKind === 'super' ? 1.9 : bossKind === 'serpent' ? 1.35 : bossKind === 'orb' ? 1.22 : 1
    const hp = Math.round((260 + wave * 58 + powerScore * 34) * hpMultiplier)
    enemiesRef.current.push({
      id: enemyId++,
      x: 50,
      y: bossKind === 'super' ? -22 : -16,
      vx: 0,
      vy: bossKind === 'super' ? 5.5 : 7,
      hp,
      maxHp: hp,
      radius: bossKind === 'super' ? 15.5 : bossKind === 'serpent' ? 12.8 : 10.8,
      variant: bossKind === 'super' ? 0 : wave % 4,
      isBoss: true,
      fireCooldown: 0.9,
      phase: Math.random() * Math.PI * 2,
      color: BOSS_COLORS[bossKind],
      pattern: bossKind === 'carrier' ? 0 : bossKind === 'orb' ? 1 : bossKind === 'serpent' ? 2 : 3,
      bossKind,
      shieldTime: bossKind === 'super' ? 5 : 3.8,
      originX: 50,
      amplitude: bossKind === 'super' ? 30 : bossKind === 'serpent' ? 26 : 22,
      trainSlot: 0,
      pathSpeed: 0.05,
    })
    ;(Object.keys(player.weaponTimers) as WeaponKey[]).forEach((key) => {
      if (player.weapons[key] > 0) {
        player.weaponTimers[key] = Math.min(WEAPON_PICKUP_MAX_SECONDS, player.weaponTimers[key] + BOSS_EFFECT_EXTENSION_SECONDS)
      }
    })
    if (player.optionTimer > 0) {
      player.optionTimer = Math.min(OPTION_PICKUP_MAX_SECONDS, player.optionTimer + BOSS_EFFECT_EXTENSION_SECONDS)
    }
    if (player.shield > 0) {
      player.shield = Math.min(8, player.shield + BOSS_EFFECT_EXTENSION_SECONDS * 0.16)
    }
    bossAlertRef.current = 2.7
    bossMessageRef.current = 'incoming'
    playGameSound('countdown')
  }, [])

  const spawnPowerUp = useCallback((x: number, y: number, guaranteed = false) => {
    const player = playerRef.current
    const powerScore = getPowerScore(player)

    if (!guaranteed) {
      killsSincePowerRef.current += 1
      if (powerDropCooldownRef.current > 0) return

      const pityBonus =
        killsSincePowerRef.current >= POWER_PITY_KILLS + 8 ? 0.55 :
        killsSincePowerRef.current >= POWER_PITY_KILLS ? 0.22 :
        0
      const lowHullBonus = player.hp <= Math.ceil(player.maxHp * 0.35) ? 0.035 : 0
      const chance = clamp(
        0.065 + waveRef.current * 0.0025 + lowHullBonus + pityBonus - powerScore * 0.009,
        0.035,
        0.34,
      )

      if (Math.random() > chance) return
    }

    const candidates: PowerKind[] = []
    if (player.hp < player.maxHp) candidates.push('repair')
    if (player.shield < 2.5) candidates.push('shield')
    if (player.optionTimer <= 6) candidates.push('option')
    ;(['spread', 'laser', 'scatter', 'rocket'] as WeaponKey[]).forEach((key) => {
      const copies = player.weapons[key] === 0 ? 3 : player.weapons[key] >= 3 ? 1 : 2
      for (let i = 0; i < copies; i += 1) candidates.push(key)
    })

    const type = candidates[Math.floor(Math.random() * candidates.length)] ?? 'spread'
    killsSincePowerRef.current = 0
    powerDropCooldownRef.current = guaranteed ? NORMAL_POWER_DROP_COOLDOWN * 0.7 : NORMAL_POWER_DROP_COOLDOWN + powerScore * 0.8
    powerUpsRef.current.push({ id: powerId++, type, x, y, vy: 11, radius: 3, spin: Math.random() * 360 })
  }, [])

  const damagePlayer = useCallback((amount: number) => {
    const player = playerRef.current
    if (player.invuln > 0) return
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
        const fan = [-34, -22, -10, 0, 10, 22, 34]
        fan.forEach((vx) => enemyShotsRef.current.push({ id: shotId++, x: enemy.x, y: enemy.y + 7, vx, vy: 31, damage: 1, kind: 'boss', radius: 1.7 }))
      }
      if (kind === 'orb') {
        for (let i = 0; i < 12; i += 1) {
          const angle = (i / 12) * Math.PI * 2 + performance.now() / 900
          enemyShotsRef.current.push({ id: shotId++, x: enemy.x, y: enemy.y, vx: Math.cos(angle) * 25, vy: Math.sin(angle) * 25 + 19, damage: 1, kind: 'plasma', radius: 1.45 })
        }
      }
      if (kind === 'serpent') {
        const lane = Math.sin(performance.now() / 280) * 18
        ;[-1, 0, 1].forEach((offset) => {
          enemyShotsRef.current.push({ id: shotId++, x: enemy.x + lane + offset * 8, y: enemy.y + 8, vx: offset * 10, vy: 38, damage: 1, kind: 'plasma', radius: 1.7 })
        })
      }
      if (kind === 'super') {
        const fan = [-42, -28, -14, 0, 14, 28, 42]
        fan.forEach((vx) => enemyShotsRef.current.push({ id: shotId++, x: enemy.x, y: enemy.y + 10, vx, vy: 34, damage: 1, kind: 'boss', radius: 2 }))
        for (let i = 0; i < 10; i += 1) {
          const angle = (i / 10) * Math.PI * 2 - performance.now() / 800
          enemyShotsRef.current.push({ id: shotId++, x: enemy.x, y: enemy.y + 2, vx: Math.cos(angle) * 22, vy: Math.sin(angle) * 22 + 20, damage: 1, kind: 'plasma', radius: 1.7 })
        }
      }
      const aimX = player.x - enemy.x
      const aimY = player.y - enemy.y
      const mag = Math.hypot(aimX, aimY) || 1
      if (kind !== 'orb') {
        enemyShotsRef.current.push({ id: shotId++, x: enemy.x, y: enemy.y + 2, vx: (aimX / mag) * 38, vy: (aimY / mag) * 38, damage: 1, kind: 'boss', radius: 2 })
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
    player.invuln = Math.max(0, player.invuln - dt)
    player.shield = Math.max(0, player.shield - dt * 0.16)
    player.optionTimer = Math.max(0, player.optionTimer - dt)
    ;(Object.keys(player.weaponTimers) as WeaponKey[]).forEach((key) => {
      if (player.weapons[key] <= 0) return
      player.weaponTimers[key] = Math.max(0, player.weaponTimers[key] - dt)
      if (player.weaponTimers[key] <= 0) {
        player.weapons[key] = 0
      }
    })
    firePlayer()

    spawnTimerRef.current -= dt
    formationTimerRef.current -= dt
    bossTimerRef.current -= dt
    powerDropCooldownRef.current = Math.max(0, powerDropCooldownRef.current - dt)
    bossAlertRef.current = Math.max(0, bossAlertRef.current - dt)

    if (bossTimerRef.current <= 0 && enemiesRef.current.every((enemy) => !enemy.isBoss)) {
      spawnBoss()
      bossTimerRef.current = 38 + Math.min(22, waveRef.current * 1.7)
      waveRef.current += 1
      player.rank = Math.min(20, player.rank + 1)
    }
    if (formationTimerRef.current <= 0) {
      spawnFormation()
      formationTimerRef.current = Math.max(1.75, 4.6 - waveRef.current * 0.12)
    }
    if (spawnTimerRef.current <= 0) {
      spawnEnemyAt(10 + Math.random() * 80, -6, waveRef.current, Math.floor(Math.random() * 4))
      spawnTimerRef.current = Math.max(0.42, 1.25 - waveRef.current * 0.045)
    }

    shotsRef.current = shotsRef.current
      .map((shot) => ({ ...shot, x: shot.x + shot.vx * dt, y: shot.y + shot.vy * dt }))
      .filter((shot) => shot.y > -10 && shot.y < HEIGHT + 10 && shot.x > -10 && shot.x < WIDTH + 10)

    enemyShotsRef.current = enemyShotsRef.current
      .map((shot) => ({ ...shot, x: shot.x + shot.vx * dt, y: shot.y + shot.vy * dt }))
      .filter((shot) => shot.y > -12 && shot.y < HEIGHT + 12 && shot.x > -12 && shot.x < WIDTH + 12)

    enemiesRef.current = enemiesRef.current
      .map((enemy) => {
        const t = performance.now() / 1000 + enemy.phase
        const bossKind = enemy.bossKind ?? 'carrier'
        const bossX =
          bossKind === 'carrier' ? 50 + Math.sin(t * 0.7) * 26 :
          bossKind === 'orb' ? 50 + Math.sin(t * 1.4) * 18 :
          bossKind === 'serpent' ? 50 + Math.sin(t * 0.9) * 32 :
          50 + Math.sin(t * 0.42) * 30
        const bossYTarget =
          bossKind === 'super' ? 20 + Math.sin(t * 0.8) * 3 :
          bossKind === 'serpent' ? 20 + Math.cos(t * 1.1) * 5 :
          bossKind === 'orb' ? 17 + Math.sin(t * 1.8) * 4 :
          18
        const trainT = (enemy.y - enemy.trainSlot * 6.2) * enemy.pathSpeed + enemy.phase
        const trainX =
          enemy.pattern === 0 ? enemy.originX + Math.sin(trainT) * enemy.amplitude :
          enemy.pattern === 1 ? enemy.originX + Math.sin(trainT) * enemy.amplitude + Math.sin(trainT * 2.1) * 5 :
          enemy.pattern === 2 ? enemy.originX + Math.sin(trainT * 0.72) * enemy.amplitude * 0.7 :
          enemy.originX + Math.cos(trainT) * enemy.amplitude
        const nextFire = enemy.fireCooldown - dt
        if (nextFire <= 0 && enemy.y > 0) {
          fireEnemy(enemy, player)
        }
        return {
          ...enemy,
          x: enemy.isBoss ? clamp(bossX, bossKind === 'super' ? 20 : 16, bossKind === 'super' ? 80 : 84) : clamp(enemy.x + (trainX - enemy.x) * Math.min(1, dt * 5.8) + enemy.vx * dt, 4, 96),
          y: enemy.isBoss ? (enemy.y < bossYTarget ? Math.min(bossYTarget, enemy.y + enemy.vy * dt) : bossYTarget) : enemy.y + enemy.vy * dt,
          shieldTime: Math.max(0, enemy.shieldTime - dt),
          fireCooldown: nextFire <= 0
            ? (enemy.isBoss ? Math.max(0.55, 1.08 - waveRef.current * 0.025) : Math.max(1.05, 2.4 + Math.random() * 1.9 - waveRef.current * 0.05))
            : nextFire,
        }
      })
      .filter((enemy) => enemy.y < HEIGHT + 14 && enemy.hp > 0)

    powerUpsRef.current = powerUpsRef.current
      .map((powerUp) => ({ ...powerUp, y: powerUp.y + powerUp.vy * dt, spin: powerUp.spin + dt * 180 }))
      .filter((powerUp) => powerUp.y < HEIGHT + 8)

    sparksRef.current = sparksRef.current
      .map((spark) => ({ ...spark, x: spark.x + spark.vx * dt, y: spark.y + spark.vy * dt, life: spark.life - dt }))
      .filter((spark) => spark.life > 0)

    ripplesRef.current = ripplesRef.current
      .map((ripple) => ({ ...ripple, life: ripple.life - dt }))
      .filter((ripple) => ripple.life > 0)

    for (const shot of shotsRef.current) {
      for (const enemy of enemiesRef.current) {
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
          if (enemy.hp <= 0) {
            player.score += enemy.isBoss ? 2800 + waveRef.current * 220 : 95 + waveRef.current * 14
            spawnSparks(enemy.x, enemy.y, enemy.isBoss ? '#fda4af' : '#fb7185', enemy.isBoss ? 60 : 18, enemy.isBoss ? 8 : 5)
            addRipple(enemy.x, enemy.y, enemy.isBoss ? '#fb7185' : '#f97316', enemy.isBoss ? 18 : 9)
            spawnPowerUp(enemy.x, enemy.y, enemy.isBoss)
            if (enemy.isBoss) {
              stageRef.current += 1
              bossAlertRef.current = 2.4
              bossMessageRef.current = 'clear'
              startRaidBgm(stageRef.current)
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

    for (const enemyShot of enemyShotsRef.current) {
      if (distSq(enemyShot, player) <= (enemyShot.radius + PLAYER_RADIUS) ** 2) {
        enemyShot.y = HEIGHT + 99
        damagePlayer(enemyShot.kind === 'boss' || enemyShot.kind === 'plasma' ? 1 : enemyShot.damage)
      }
    }
    enemyShotsRef.current = enemyShotsRef.current.filter((shot) => shot.y < HEIGHT + 30)

    for (const enemy of enemiesRef.current) {
      if (distSq(enemy, player) <= (enemy.radius + PLAYER_RADIUS) ** 2) {
        enemy.hp = 0
        damagePlayer(enemy.isBoss ? 2 : 1)
        spawnSparks(enemy.x, enemy.y, '#fb7185', enemy.isBoss ? 35 : 14, 6)
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
        } else if (powerUp.type === 'option') {
          player.optionTimer = Math.min(OPTION_PICKUP_MAX_SECONDS, Math.max(player.optionTimer, 0) + OPTION_PICKUP_SECONDS)
        } else {
          player.weapons[powerUp.type] = Math.min(4, player.weapons[powerUp.type] + 1)
          player.weaponTimers[powerUp.type] = Math.min(
            WEAPON_PICKUP_MAX_SECONDS,
            Math.max(player.weaponTimers[powerUp.type], 0) + WEAPON_PICKUP_SECONDS,
          )
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
  }, [addRipple, damagePlayer, fireEnemy, firePlayer, spawnBoss, spawnEnemyAt, spawnFormation, spawnPowerUp, spawnSparks, startRaidBgm])

  useEffect(() => {
    const tick = (time: number) => {
      const dt = Math.min(0.033, (time - lastTimeRef.current) / 1000 || 0)
      lastTimeRef.current = time
      updateGame(dt)
      syncSnapshot()
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [syncSnapshot, updateGame])

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (key === 'enter' && phaseRef.current === 'paused') resumeGame()
      else if (key === 'enter' && phaseRef.current !== 'playing') resetGame()
      if (key === 'p') {
        if (phaseRef.current === 'playing') pauseGame()
        else if (phaseRef.current === 'paused') resumeGame()
      }
      if (key === 'escape') {
        if (phaseRef.current === 'playing') pauseGame()
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
  }, [onClose, pauseGame, resetGame, resumeGame])

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
  const weaponEntries = (Object.keys(player.weapons) as WeaponKey[]).filter((key) => player.weapons[key] > 0)

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
              ? weaponEntries.map((key) => `${key[0].toUpperCase()}${player.weapons[key]}:${Math.ceil(player.weaponTimers[key])}`).join(' ')
              : 'BASE'}
          </b>
        </div>
        <div className="raid__hp" aria-label="Hull">
          {hpPips.map((filled, index) => <i key={index} className={filled ? 'raid__pip raid__pip--filled' : 'raid__pip'} />)}
        </div>
        <button className="raid__pause" type="button" onClick={pauseGame}>Pause</button>
        <button className="raid__exit" type="button" onClick={onClose}>Exit</button>
      </div>

      <div className="raid__playfield">
        {snapshot.pointer && snapshot.phase === 'playing' && (
          <div className="raid__finger-guide" style={{ left: `${snapshot.pointer.x}%`, top: `${snapshot.pointer.y}%` }} />
        )}

        {snapshot.ripples.map((ripple) => (
          <div
            key={ripple.id}
            className="raid__ripple"
            style={{
              left: `${ripple.x}%`,
              top: `${ripple.y}%`,
              width: `${ripple.size}vmin`,
              borderColor: ripple.color,
              opacity: Math.max(0, ripple.life / ripple.maxLife),
            }}
          />
        ))}

        {snapshot.shots.map((shot) => (
          <div key={shot.id} className={`raid__shot raid__shot--${shot.kind}`} style={{ left: `${shot.x}%`, top: `${shot.y}%` }} />
        ))}

        {snapshot.enemyShots.map((shot) => (
          <div key={shot.id} className={`raid__enemy-shot raid__enemy-shot--${shot.kind}`} style={{ left: `${shot.x}%`, top: `${shot.y}%` }} />
        ))}

        {snapshot.enemies.map((enemy) => (
          <div
            key={enemy.id}
            className={[
              'raid__enemy',
              enemy.isBoss ? 'raid__enemy--boss' : '',
              enemy.bossKind ? `raid__enemy--boss-${enemy.bossKind}` : '',
            ].join(' ')}
            style={{ left: `${enemy.x}%`, top: `${enemy.y}%`, width: enemy.isBoss ? (enemy.bossKind === 'super' ? 'min(34vw, 310px)' : 'min(24vw, 210px)') : 'min(8vw, 64px)' }}
          >
            <AlienShip variant={enemy.variant} isBoss={enemy.isBoss} isFinalBoss={enemy.bossKind === 'super'} color={enemy.color} size={enemy.isBoss ? (enemy.bossKind === 'super' ? 220 : 156) : 50} />
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
              <div className="raid__boss-bar">
                <span style={{ width: `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%` }} />
              </div>
              </>
            )}
          </div>
        ))}

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

        {snapshot.sparks.map((spark) => (
          <div
            key={spark.id}
            className="raid__spark"
            style={{
              left: `${spark.x}%`,
              top: `${spark.y}%`,
              width: spark.size,
              height: spark.size,
              opacity: Math.max(0, spark.life / spark.maxLife),
              background: spark.color,
            }}
          />
        ))}

        <div
          className={[
            'raid__player',
            player.invuln > 0 || player.shield > 0 ? 'raid__player--shielded' : '',
            snapshot.phase === 'gameover' ? 'raid__player--down' : '',
          ].join(' ')}
          style={{ left: `${player.x}%`, top: `${player.y}%` }}
        >
          <TowerShip tType={player.ship.key} color={PLAYER_COLOR} size={player.ship.key === 'dreadnought' ? 88 : 74} />
          <span className="raid__engine" />
          <span className="raid__wing-glow raid__wing-glow--left" />
          <span className="raid__wing-glow raid__wing-glow--right" />
        </div>
        {player.optionTimer > 0 && (
          <>
            <div className="raid__option raid__option--left" style={{ left: `${clamp(player.x - 7, 4, 96)}%`, top: `${player.y + 1.4}%` }}>
              <TowerShip tType="fast" color="#ef233c" size={34} />
            </div>
            <div className="raid__option raid__option--right" style={{ left: `${clamp(player.x + 7, 4, 96)}%`, top: `${player.y + 1.4}%` }}>
              <TowerShip tType="fast" color="#ef233c" size={34} />
            </div>
          </>
        )}
      </div>

      {snapshot.bossAlert > 0 && (
        <div className="raid__boss-alert">
          {snapshot.bossMessage === 'clear' ? 'Boss Destroyed' : 'Boss Vector Incoming'}
        </div>
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
              <button type="button" className="raid__menu-button" onClick={resetGame}>Restart</button>
              <button type="button" className="raid__menu-button" onClick={onClose}>Exit</button>
            </div>
          </div>
        </div>
      )}

      {snapshot.phase !== 'playing' && snapshot.phase !== 'paused' && (
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
                  <TowerShip tType={ship.key} color={PLAYER_COLOR} size={ship.key === 'dreadnought' ? 76 : 64} />
                  <span>{ship.name}</span>
                  <small>{ship.role}</small>
                </button>
              ))}
            </div>
            <div className="raid__records">
              <span>Best {snapshot.highScore.toLocaleString()}</span>
              <span>PC follows cursor</span>
              <span>Mobile follows above finger</span>
            </div>
            <button type="button" className="raid__start" onClick={resetGame}>
              {snapshot.phase === 'gameover' ? 'Launch Again' : 'Start Raid'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
