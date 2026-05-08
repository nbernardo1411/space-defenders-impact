import { useCallback, useEffect, useRef, useState } from 'react'
import type * as React from 'react'
import { getGameAudioMixSettings, getGameSoundEnabled, playGameSound, setGameAudioMixSettings, setGameSoundEnabled, startBGM, stopBGM } from './sound'
import type { AudioMixSettings } from './sound'
import type { CoinOption } from './types'
import {
  COLS,
  ENEMY_COLORS,
  MAX_STAGES,
  MAX_TOWER_LEVEL,
  MOBILE_LAYOUT_STORAGE_KEY,
  ROWS,
  STORAGE_KEY,
  TOWER_TYPES,
  WAVES_PER_STAGE,
  calcCell,
  generatePaths,
  getIsCompactLayout,
  getTowerFootprint,
  getNormalWaveCfg,
  getWaveCfg,
  isHeavyBossStage,
  xpNeededForNextLevel,
} from './towerDefense/config'
import type { MobileLayoutMode, TowerKey } from './towerDefense/config'
import type { Bullet, Enemy, EnemyTrait, GameState, ParticleType, ScoutDrone, Tower } from './towerDefense/model'
import { angleToDeg, lerp, spawnImpactParticles, triggerEnemyDeath } from './towerDefense/effects'
import { AlienShip, EarthHQIcon, MothershipSpawnIcon, TowerShip } from './towerDefense/sprites'
import { StatPill, btnStyle } from './towerDefense/ui'

let _eid = 1
let _tid = 1
let _bid = 1
let _sid = 1

const DREADNOUGHT_SCOUT_COUNT = 3
const DREADNOUGHT_SCOUT_INTERVAL = 16
const DREADNOUGHT_SCOUT_ATTACK_TIME = 5
const DREADNOUGHT_SCOUT_RATE = 0.5
const DREADNOUGHT_SCOUT_DAMAGE = 8
const DREADNOUGHT_SCOUT_COLOR = '#f43f5e'
const DREADNOUGHT_SCOUT_DOCK_RADIUS = 0.85
const DREADNOUGHT_SCOUT_APPROACH_RADIUS = 1.65
const DREADNOUGHT_SCOUT_ATTACK_RADIUS = 1.45
const DREADNOUGHT_FIELD_LIMIT = 4
const DESKTOP_TOWER_SHIP_SCALE: Record<TowerKey, number> = {
  fast: 0.58,
  sniper: 0.63,
  aoe: 0.66,
  slow: 0.60,
  burst: 0.68,
  gatling: 0.64,
  rocket: 0.74,
  laser: 0.72,
  artillery: 0.76,
  dreadnought: 1.55,
}

type CommanderAbilityKey = 'ion' | 'freeze' | 'repair'
type CommanderCooldowns = Record<CommanderAbilityKey, number>

const COMMANDER_COOLDOWNS: CommanderCooldowns = { ion: 28, freeze: 34, repair: 46 }
const HQ_MAX_LEVEL = 4




// ─── Main Component ───────────────────────────────────────────────────────────
export function SpaceImpactDefense({ availableCoins, onClose, initialMode = 'normal' }: { availableCoins: CoinOption[]; onClose: () => void; initialMode?: 'normal' | 'endless' }) {
  const [mobileLayoutMode, setMobileLayoutMode] = useState<MobileLayoutMode>(() => {
    if (typeof window === 'undefined') return 'auto'
    const raw = localStorage.getItem(MOBILE_LAYOUT_STORAGE_KEY)
    return raw === 'portrait' || raw === 'landscape' || raw === 'auto' ? raw : 'auto'
  })
  const [cell, setCell] = useState(() => calcCell(mobileLayoutMode))
  const [soundOn, setSoundOn] = useState(getGameSoundEnabled)
  const [audioMix, setAudioMix] = useState<AudioMixSettings>(getGameAudioMixSettings)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [isCompact, setIsCompact] = useState(() => getIsCompactLayout(mobileLayoutMode))

  // Game data refs (avoid re-render on every frame)
  const enemiesRef = useRef<Enemy[]>([])
  const towersRef = useRef<Tower[]>([])
  const bulletsRef = useRef<Bullet[]>([])
  const scoutDronesRef = useRef<ScoutDrone[]>([])
  const goldRef = useRef(400)
  const livesRef = useRef(20)
  const hqLevelRef = useRef(1)
  const waveRef = useRef(0)
  const scoreRef = useRef(0)
  const stateRef = useRef<GameState>('idle')
  const stageRef = useRef(1)
  const spawnQueueRef = useRef(0)
  const bossQueueRef = useRef(0)
  const normalEscortQueueRef = useRef(0)
  const spawnTimerRef = useRef(0)
  const spawnRRRef = useRef(0)  // round-robin spawn point index
  const frameRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)

  // Per-stage dynamic path refs (updated when stage changes)
  const pathsRef = useRef<[number, number][][]>(generatePaths(1))
  const pathRef = useRef<[number, number][]>(pathsRef.current[0])  // kept for compat
  const pathSetRef = useRef<Set<string>>(new Set(pathsRef.current.flat().map(([c, r]) => `${c},${r}`)))

  // Reactive UI state (polled from refs)
  const [uiGold, setUiGold] = useState(400)
  const [uiLives, setUiLives] = useState(20)
  const [uiHqLevel, setUiHqLevel] = useState(1)
  const [uiWave, setUiWave] = useState(0)
  const [uiStage, setUiStage] = useState(1)
  const [uiScore, setUiScore] = useState(0)
  const [uiState, setUiState] = useState<GameState>('idle')
  const [uiPaths, setUiPaths] = useState<[number, number][][]>(() => generatePaths(1))
  const uiPath = uiPaths[0] ?? []  // kept for single-path compat (finish marker etc.)
  const [uiEnemies, setUiEnemies] = useState<Enemy[]>([])
  const [uiBullets, setUiBullets] = useState<Bullet[]>([])
  const [uiScoutDrones, setUiScoutDrones] = useState<ScoutDrone[]>([])
  const [uiTowers, setUiTowers] = useState<Tower[]>([])
  const [uiHighScore, setUiHighScore] = useState(() => Number(localStorage.getItem(STORAGE_KEY) || 0))

  const [selectedTowerKey, setSelectedTowerKey] = useState<TowerKey | null>(null)
  const [hoveredCell, setHoveredCell] = useState<[number,number]|null>(null)
  const [selectedTowerOnGrid, setSelectedTowerOnGrid] = useState<Tower|null>(null)
  const [destroyFlash, setDestroyFlash] = useState<string | null>(null)  // 'col,row' of smashed tower
  const [firingTowers, setFiringTowers] = useState<Set<number>>(new Set())  // tower ids currently flashing
  const [draggedTower, setDraggedTower] = useState<Tower|null>(null)
  const draggedTowerRef = useRef<Tower | null>(null)
  const dragOffsetRef = useRef<[number, number]>([0, 0])
  const dragTouchPointRef = useRef<{x: number; y: number} | null>(null)
  const dragMousePointRef = useRef<{x: number; y: number} | null>(null)
  const gameRootRef = useRef<HTMLDivElement | null>(null)
  const boardRef = useRef<HTMLDivElement | null>(null)
  const spaceCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const spaceAnimRef = useRef<number>(0)
  const explosionsRef = useRef<{x: number; y: number; radius: number; time: number; type: 'aoe'|'rocket'|'heavy'|'dreadnought'; maxTime: number}[]>([])
  const [uiExplosions, setUiExplosions] = useState<{x: number; y: number; radius: number; time: number; type: 'aoe'|'rocket'|'heavy'|'dreadnought'; maxTime: number}[]>([])
  const shockwavesRef = useRef<{x: number; y: number; radius: number; time: number; maxTime: number; intensity: number}[]>([])
  const [uiShockwaves, setUiShockwaves] = useState<{x: number; y: number; radius: number; time: number; maxTime: number; intensity: number}[]>([])
  const particlesRef = useRef<{x: number; y: number; type: ParticleType; vx: number; vy: number; life: number; maxLife: number}[]>([])
  const [uiParticles, setUiParticles] = useState<{x: number; y: number; type: ParticleType; vx: number; vy: number; life: number; maxLife: number}[]>([])
  const floatingTextRef = useRef<{x: number; y: number; text: string; time: number; maxTime: number; color: string}[]>([])
  const [uiFloatingText, setUiFloatingText] = useState<{x: number; y: number; text: string; time: number; maxTime: number; color: string}[]>([])
  const endlessRef = useRef(false)
  const [uiEndless, setUiEndless] = useState(false)

  const [uiLaserBeams, setUiLaserBeams] = useState<{towerId:number;x1:number;y1:number;x2:number;y2:number}[]>([])
  const [autoPlayWave, setAutoPlayWave] = useState(false)

  // ── Polish animations state ────────────────────────────────────────────────
  // Phase 1
  const towerCreationTimeRef = useRef<Map<number, number>>(new Map())  // tower id -> creation time
  const [waveAnnouncement, setWaveAnnouncement] = useState<{wave: number; time: number; maxTime: number} | null>(null)
  const screenFlashRef = useRef<{time: number; maxTime: number; intensity: number} | null>(null)
  const [screenFlashState, setScreenFlashState] = useState(0)
  const stageTransitionRef = useRef<{phase: 'fade' | 'show' | 'in' | 'out'; time: number; maxTime: number} | null>(null)
  const [stageTransitionState, setStageTransitionState] = useState<{phase: 'fade' | 'show' | 'in' | 'out'; progress: number} | null>(null)
  
  // Phase 2
  const spawnPortalRef = useRef<{x: number; y: number; time: number; maxTime: number; pathIdx: number}[]>([])
  const [spawnPortals, setSpawnPortals] = useState<{x: number; y: number; time: number; maxTime: number; pathIdx: number}[]>([])
  const towerActionBurstRef = useRef<{x: number; y: number; type: 'upgrade' | 'sell'; time: number; maxTime: number}[]>([])
  const [towerActionBursts, setTowerActionBursts] = useState<{x: number; y: number; type: 'upgrade' | 'sell'; time: number; maxTime: number}[]>([])
  const healthTweenRef = useRef<Map<number, {from: number; to: number; duration: number; elapsed: number}>>(new Map())
  const [enemyHealthDisplay, setEnemyHealthDisplay] = useState<Map<number, number>>(new Map())
  
  // Phase 3
  const coinFlowRef = useRef<{fromX: number; fromY: number; toX: number; toY: number; amount: number; time: number; maxTime: number}[]>([])
  const [coinFlows, setCoinFlows] = useState<{fromX: number; fromY: number; toX: number; toY: number; amount: number; time: number; maxTime: number}[]>([])
  const [victoryEffect, setVictoryEffect] = useState<{time: number; maxTime: number} | null>(null)
  
  // Boss attack effects
  const bossLightningRef = useRef<{fromX: number; fromY: number; toX: number; toY: number; time: number; maxTime: number}[]>([])
  const [uiBossLightning, setUiBossLightning] = useState<{fromX: number; fromY: number; toX: number; toY: number; time: number; maxTime: number}[]>([])
  const bossScreenFlashRef = useRef<{time: number; maxTime: number; intensity: number} | null>(null)
  const [bossScreenFlashState, setBossScreenFlashState] = useState(0)
  const commanderCooldownsRef = useRef<CommanderCooldowns>({ ion: 0, freeze: 0, repair: 0 })
  const [uiCommanderCooldowns, setUiCommanderCooldowns] = useState<CommanderCooldowns>({ ion: 0, freeze: 0, repair: 0 })
  const prevUiStateRef = useRef<GameState>('gameover')

  const coinsRef = useRef(availableCoins)
  useEffect(() => { coinsRef.current = availableCoins }, [availableCoins])

  // ── Resize ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => {
      setCell(calcCell(mobileLayoutMode))
      setIsCompact(getIsCompactLayout(mobileLayoutMode))
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [mobileLayoutMode])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(MOBILE_LAYOUT_STORAGE_KEY, mobileLayoutMode)
      setCell(calcCell(mobileLayoutMode))
      setIsCompact(getIsCompactLayout(mobileLayoutMode))
    }
  }, [mobileLayoutMode])

  // ── Global drag release handlers (mouse + touch) ──────────────────────────
  useEffect(() => {
    if (!draggedTower) return

    const handleMouseMove = (e: MouseEvent) => {
      const boardEl = boardRef.current
      if (!boardEl) return
      dragMousePointRef.current = { x: e.clientX, y: e.clientY }
      tryDropTower(e.clientX, e.clientY, boardEl)
    }

    const handleMouseUp = (e: MouseEvent) => {
      const boardEl = boardRef.current
      if (boardEl) tryDropTower(e.clientX, e.clientY, boardEl)
      draggedTowerRef.current = null
      dragMousePointRef.current = null
      dragTouchPointRef.current = null
      setDraggedTower(null)
    }

    const handleTouchEnd = (e: TouchEvent) => {
      const boardEl = boardRef.current
      const touch = e.changedTouches[0]
      const point = touch ? { x: touch.clientX, y: touch.clientY } : dragTouchPointRef.current
      if (boardEl && point) tryDropTower(point.x, point.y, boardEl)
      draggedTowerRef.current = null
      dragMousePointRef.current = null
      dragTouchPointRef.current = null
      setDraggedTower(null)
    }

    const handleTouchMove = (e: TouchEvent) => {
      const boardEl = boardRef.current
      const touch = e.touches[0]
      if (!boardEl || !touch) return
      dragTouchPointRef.current = { x: touch.clientX, y: touch.clientY }
      tryDropTower(touch.clientX, touch.clientY, boardEl)
      e.preventDefault()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd)
    window.addEventListener('touchcancel', handleTouchEnd)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [draggedTower, cell])

  // ── Close popup when clicking outside board ──────────────────────────────
  useEffect(() => {
    function handleOutsideClick(e: PointerEvent) {
      if (boardRef.current && !boardRef.current.contains(e.target as Node)) {
        setSelectedTowerOnGrid(null)
      }
    }
    document.addEventListener('pointerdown', handleOutsideClick)
    return () => document.removeEventListener('pointerdown', handleOutsideClick)
  }, [])

  // ── Sound toggle ──────────────────────────────────────────────────────────
  function toggleSound() {
    const next = !soundOn
    setGameSoundEnabled(next)
    setSoundOn(next)
    if (next) {
      startBGM()
      playGameSound('select')
    } else {
      stopBGM()
    }
  }

  function updateAudioMixSetting(key: keyof AudioMixSettings, value: number) {
    const nextMix: AudioMixSettings = {
      ...audioMix,
      [key]: Math.max(0, Math.min(1, value)),
    }
    setAudioMix(nextMix)
    setGameAudioMixSettings(nextMix)
    if (soundOn && (key === 'bgm' || key === 'master')) {
      startBGM()
    }
  }

  async function applyMobileLayoutMode(mode: MobileLayoutMode) {
    setMobileLayoutMode(mode)
    if (typeof window === 'undefined' || window.innerWidth > 900) return

    try {
      const orientationApi = (screen as Screen & { orientation?: { lock?: (mode: string) => Promise<void>; unlock?: () => void } }).orientation
      if (!orientationApi) return

      if (mode === 'auto') {
        orientationApi.unlock?.()
        return
      }

      // Most browsers require fullscreen + user gesture before orientation lock.
      const docEl = document.documentElement as HTMLElement & { requestFullscreen?: () => Promise<void> }
      if (!document.fullscreenElement && docEl.requestFullscreen) {
        await docEl.requestFullscreen().catch(() => undefined)
      }

      const lockTarget = mode === 'landscape' ? 'landscape' : 'portrait'
      if (orientationApi.lock) {
        await orientationApi.lock(lockTarget).catch(() => undefined)
      }
    } catch {
      // Best-effort only; some browsers (especially iOS) block programmatic orientation lock.
    }
  }

  useEffect(() => {
    if (soundOn) {
      startBGM()
    } else {
      stopBGM()
    }
  }, [soundOn])

  useEffect(() => {
    if (!soundOn) {
      prevUiStateRef.current = uiState
      return
    }
    const prevState = prevUiStateRef.current
    if (uiState === 'idle' && prevState !== 'idle') {
      playGameSound('explosion_big')
      startBGM()
    }
    prevUiStateRef.current = uiState
  }, [uiState, soundOn])

  useEffect(() => {
    function handleButtonClickSfx(e: MouseEvent) {
      if (!soundOn) return
      const target = e.target as HTMLElement | null
      const root = gameRootRef.current
      if (!target || !root || !root.contains(target)) return
      if (target.closest('button')) {
        playGameSound('select')
      }
    }
    document.addEventListener('click', handleButtonClickSfx, true)
    return () => document.removeEventListener('click', handleButtonClickSfx, true)
  }, [soundOn])

  // ── Auto-play next wave ────────────────────────────────────────────────────
  useEffect(() => {
    if (!autoPlayWave || uiState !== 'playing') return
    startWave()
  }, [autoPlayWave, uiState])

  // ── Get enemy position along its assigned path ─────────────────────────────
  function getEnemyPos(pathIdx: number, pathIndex: number, progress: number): {x: number, y: number} {
    const path = pathsRef.current[pathIdx] ?? pathsRef.current[0]
    const [c0, r0] = path[Math.min(pathIndex, path.length - 1)]
    const [c1, r1] = path[Math.min(pathIndex + 1, path.length - 1)]
    return {
      x: lerp(c0, c1, progress),
      y: lerp(r0, r1, progress),
    }
  }

  // ── Game Loop ─────────────────────────────────────────────────────────────
  function getTowerCells(col: number, row: number, footprint: number) {
    const cells: string[] = []
    for (let r = row; r < row + footprint; r++) {
      for (let c = col; c < col + footprint; c++) {
        cells.push(`${c},${r}`)
      }
    }
    return cells
  }

  function getTowerCenter(tower: Tower) {
    const footprint = getTowerFootprint(tower.type)
    return { x: tower.col + footprint / 2, y: tower.row + footprint / 2 }
  }

  function towerOccupiesCell(tower: Tower, col: number, row: number) {
    const footprint = getTowerFootprint(tower.type)
    return col >= tower.col && col < tower.col + footprint && row >= tower.row && row < tower.row + footprint
  }

  function findTowerAtCell(col: number, row: number) {
    return towersRef.current.find(t => towerOccupiesCell(t, col, row)) ?? null
  }

  function isEnemyActive(e: Enemy) {
    return !e.dead && !e.leaked && e.hp > 0
  }

  function canPlaceTowerAt(col: number, row: number, footprint: number, ignoreTowerId?: number) {
    if (col < 0 || row < 0 || col + footprint > COLS || row + footprint > ROWS) return false
    return getTowerCells(col, row, footprint).every((key) => {
      if (pathSetRef.current.has(key)) return false
      const [cellCol, cellRow] = key.split(',').map(Number)
      return !towersRef.current.some(t => t.id !== ignoreTowerId && towerOccupiesCell(t, cellCol, cellRow))
    })
  }

  function getBestScoutTarget(seed: number, enemies: Enemy[]) {
    const activeEnemies = enemies.filter(isEnemyActive)
    if (activeEnemies.length === 0) return null
    const sorted = [...activeEnemies].sort((a, b) => (b.pathIndex + b.progress) - (a.pathIndex + a.progress))
    return sorted[seed % Math.min(3, sorted.length)] ?? sorted[0]
  }

  function getDreadnoughtFieldCount() {
    return towersRef.current.filter(t => t.type === 'dreadnought').length
  }

  function spawnDreadnoughtScouts(tower: Tower, enemies: Enemy[], count: number) {
    const center = getTowerCenter(tower)
    for (let i = 0; i < count; i++) {
      const orbit = (Math.PI * 2 * i) / Math.max(1, count)
      const target = getBestScoutTarget(i, enemies)
      scoutDronesRef.current.push({
        id: _sid++,
        towerId: tower.id,
        x: center.x + Math.cos(orbit) * 0.35,
        y: center.y + Math.sin(orbit) * 0.35,
        angle: tower.aimAngle,
        orbit,
        timer: getDreadnoughtScoutAttackTime(tower),
        cooldown: 0,
        targetId: target?.id ?? null,
        state: 'launch',
        dead: false,
      })
    }
  }

  function getHqMaxLives(level = hqLevelRef.current) {
    return 20 + (level - 1) * 5
  }

  function resetCommanderCooldowns() {
    commanderCooldownsRef.current = { ion: 0, freeze: 0, repair: 0 }
    setUiCommanderCooldowns({ ...commanderCooldownsRef.current })
  }

  function getDreadnoughtScoutCount(tower: Tower) {
    return DREADNOUGHT_SCOUT_COUNT + Math.floor((tower.level - 1) / 2)
  }

  function getDreadnoughtScoutAttackTime(tower: Tower) {
    return DREADNOUGHT_SCOUT_ATTACK_TIME + (tower.level - 1) * 0.5
  }

  function rollEnemyTrait(isBoss: boolean, hp: number): { trait: EnemyTrait; shield: number; maxShield: number; blinkUsed: boolean } {
    if (isBoss) return { trait: 'none', shield: 0, maxShield: 0, blinkUsed: false }
    const chance = Math.min(0.36, 0.08 + stageRef.current * 0.018 + waveRef.current * 0.012 + (endlessRef.current ? 0.08 : 0))
    if (Math.random() > chance) return { trait: 'none', shield: 0, maxShield: 0, blinkUsed: false }
    const traits: EnemyTrait[] = ['shielded', 'armored', 'phase', 'splitter', 'blink']
    const trait = traits[Math.floor(Math.random() * traits.length)]
    const maxShield = trait === 'shielded' ? Math.ceil(hp * 0.34) : 0
    return { trait, shield: maxShield, maxShield, blinkUsed: false }
  }

  function getTowerSynergy(tower: Tower) {
    const center = getTowerCenter(tower)
    const near = (type: TowerKey, radius = 2.35) => towersRef.current.some(other => {
      if (other.id === tower.id || other.type !== type) return false
      const oc = getTowerCenter(other)
      return Math.hypot(oc.x - center.x, oc.y - center.y) <= radius
    })
    const bonus = { rateMult: 1, dmgMult: 1, rangeBonus: 0, barrageDelayMult: 1, active: false }
    if (tower.type === 'gatling' && near('laser')) { bonus.rateMult *= 0.75; bonus.active = true }
    if (tower.type === 'rocket' && near('slow')) { bonus.dmgMult *= 1.15; bonus.active = true }
    if (tower.type === 'laser' && near('slow')) { bonus.rangeBonus += 0.8; bonus.active = true }
    if (tower.type === 'artillery' && near('dreadnought', 3.2)) { bonus.rateMult *= 0.85; bonus.active = true }
    if (tower.type === 'dreadnought' && near('artillery', 3.2)) { bonus.barrageDelayMult *= 0.65; bonus.active = true }
    return bonus
  }

  function applyEnemyDamage(e: Enemy, rawDamage: number, damageType: string) {
    if (e.dead || e.leaked || rawDamage <= 0) return 0
    if (e.trait === 'phase' && damageType !== 'laser' && Math.random() < 0.16) {
      e.hitFlash = 0.08
      floatingTextRef.current.push({ x: e.x + 0.5, y: e.y + 0.2, text: 'PHASE', time: 0, maxTime: 0.45, color: '#a78bfa' })
      return 0
    }
    let amount = rawDamage
    if (e.trait === 'armored') amount *= damageType === 'laser' ? 0.9 : 0.72
    let applied = 0
    if (e.shield > 0) {
      const absorbed = Math.min(e.shield, amount)
      e.shield -= absorbed
      amount -= absorbed
      applied += absorbed * 0.45
      if (e.shield <= 0) {
        floatingTextRef.current.push({ x: e.x + 0.5, y: e.y + 0.18, text: 'SHIELD BREAK', time: 0, maxTime: 0.55, color: '#7dd3fc' })
      }
    }
    if (amount > 0) {
      e.hp -= amount
      applied += amount
    }
    e.hitFlash = 0.1
    return applied
  }

  function spawnSplitterChildren(e: Enemy) {
    if (e.trait !== 'splitter' || e.isBoss) return
    const ePath = pathsRef.current[e.pathIdx] ?? pathsRef.current[0]
    const pathIndex = Math.min(e.pathIndex, Math.max(0, ePath.length - 2))
    const childHp = Math.max(12, e.maxHp * 0.28)
    for (let i = 0; i < 2; i++) {
      enemiesRef.current.push({
        id: _eid++,
        pathIdx: e.pathIdx,
        pathIndex,
        progress: Math.min(0.95, e.progress + i * 0.08),
        x: e.x + (i === 0 ? -0.12 : 0.12),
        y: e.y,
        hp: childHp,
        maxHp: childHp,
        speed: e.baseSpeed * 1.18,
        baseSpeed: e.baseSpeed * 1.18,
        slowTimer: 0,
        reward: Math.max(1, Math.floor(e.reward * 0.25)),
        coinImg: e.coinImg,
        tint: '#ff74d4',
        isBoss: false,
        trait: 'none',
        shield: 0,
        maxShield: 0,
        blinkUsed: false,
        destroyCooldown: 9999,
        summonCooldown: 9999,
        hitFlash: 0,
        dead: false,
        leaked: false,
      })
    }
  }

  function handleEnemyDeath(e: Enemy, towerType: string, sourceTower: Tower | undefined, comboSound = false) {
    if (e.hp > 0 || e.dead) return
    if (sourceTower) grantTowerXp(sourceTower, e.isBoss ? 40 : 1.5)
    spawnSplitterChildren(e)
    triggerEnemyDeath(e, towerType, e.isBoss, goldRef, scoreRef, particlesRef.current, floatingTextRef.current, screenFlashRef, coinFlowRef, setScreenFlashState, shockwavesRef.current)
    if (soundOn) playGameSound(comboSound ? 'combo' : 'pop')
  }

  const gameLoop = useCallback((ts: number) => {
    const dt = Math.min((ts - (lastTimeRef.current || ts)) / 1000, 0.1)
    lastTimeRef.current = ts

    const state = stateRef.current
    if (state !== 'playing' && state !== 'wave') {
      frameRef.current = requestAnimationFrame(gameLoop)
      return
    }

    for (const key of Object.keys(commanderCooldownsRef.current) as CommanderAbilityKey[]) {
      commanderCooldownsRef.current[key] = Math.max(0, commanderCooldownsRef.current[key] - dt)
    }

    const coins = coinsRef.current
    const waveCfg = getWaveCfg(stageRef.current, waveRef.current, endlessRef.current)

    // ── Spawn enemies ──────────────────────────────────────────────────────
    if (state === 'wave' && spawnQueueRef.current > 0) {
      spawnTimerRef.current -= dt
      if (spawnTimerRef.current <= 0) {
        const normalCfg = getNormalWaveCfg(stageRef.current, waveRef.current)
        const numSpawns = Math.max(1, pathsRef.current.length)
        const spawnBoss = waveCfg.isBoss && bossQueueRef.current > 0 && (
          normalEscortQueueRef.current === 0 || Math.random() < (bossQueueRef.current / Math.max(1, bossQueueRef.current + normalEscortQueueRef.current))
        )
        const enemyCfg = spawnBoss ? waveCfg : normalCfg
        const isHeavyBoss = spawnBoss && isHeavyBossStage(stageRef.current, endlessRef.current)
        const baseInterval = spawnBoss ? 1.1 : 0.65
        spawnTimerRef.current = baseInterval / numSpawns
        const coin = coins[Math.floor(Math.random() * coins.length)]
        const pidx = spawnBoss ? Math.floor(Math.random() * numSpawns) : (spawnRRRef.current % numSpawns)
        if (!spawnBoss) spawnRRRef.current++
        const pos = getEnemyPos(pidx, 0, 0)
        // 30% chance a normal enemy gets a random 10-30% speed surge
        const spdMult = (!spawnBoss && Math.random() < 0.30) ? 1.1 + Math.random() * 0.20 : 1
        const tint = ENEMY_COLORS[Math.floor(Math.random() * ENEMY_COLORS.length)]
        const traitState = rollEnemyTrait(spawnBoss, enemyCfg.hp)
        enemiesRef.current.push({
          id: _eid++,
          pathIdx: pidx,
          pathIndex: 0, progress: 0,
          x: pos.x, y: pos.y,
          hp: enemyCfg.hp, maxHp: enemyCfg.hp,
          speed: enemyCfg.speed * spdMult, baseSpeed: enemyCfg.speed * spdMult,
          slowTimer: 0,
          reward: enemyCfg.reward,
          coinImg: coin?.image || '',
          tint,
          isBoss: spawnBoss,
          ...traitState,
          destroyCooldown: isHeavyBoss ? 6.5 : 9999,
          summonCooldown: isHeavyBoss ? 8 : 9999,
          hitFlash: 0,
          dead: false, leaked: false,
        })
        if (spawnBoss) bossQueueRef.current--
        else normalEscortQueueRef.current--
        spawnQueueRef.current--
      }
    }

    // If no spawns left and no enemies, wave ends
    if (state === 'wave' && spawnQueueRef.current === 0 && enemiesRef.current.filter(isEnemyActive).length === 0) {
      if (waveRef.current >= WAVES_PER_STAGE) {
        // All waves in stage done
        if (stageRef.current >= MAX_STAGES && !endlessRef.current) {
          stateRef.current = 'victory'
          setUiState('victory')
          if (soundOn) playGameSound('levelup')
          const s = scoreRef.current
          if (s > (Number(localStorage.getItem(STORAGE_KEY) || 0))) {
            localStorage.setItem(STORAGE_KEY, String(s))
            setUiHighScore(s)
          }
          // Trigger victory effect
          setVictoryEffect({time: 0, maxTime: 2.0})
        } else {
          stateRef.current = 'stage_complete'
          setUiState('stage_complete')
          if (soundOn) playGameSound('levelup')
        }
      } else {
        stateRef.current = 'playing'
        setUiState('playing')
        if (soundOn) playGameSound('score')
      }
    }

    // ── Move enemies ───────────────────────────────────────────────────────
    for (const e of enemiesRef.current) {
      if (e.dead || e.leaked) continue
      if (e.slowTimer > 0) e.slowTimer -= dt
      if (e.hitFlash > 0) e.hitFlash -= dt
      const spd = e.slowTimer > 0 ? e.baseSpeed * 0.5 : e.baseSpeed
      e.progress += (spd * dt) / 1
      const ePath = pathsRef.current[e.pathIdx] ?? pathsRef.current[0]
      while (e.progress >= 1) {
        e.pathIndex++
        e.progress -= 1
        if (e.pathIndex >= ePath.length - 1) {
          e.leaked = true
          const livesLost = e.isBoss ? 3 : 1
          livesRef.current = Math.max(0, livesRef.current - livesLost)
          if (soundOn) playGameSound('hit')
          if (livesRef.current <= 0) {
            stateRef.current = 'gameover'
            setUiState('gameover')
            if (soundOn) playGameSound('gameover')
            const s = scoreRef.current
            if (s > (Number(localStorage.getItem(STORAGE_KEY) || 0))) {
              localStorage.setItem(STORAGE_KEY, String(s))
              setUiHighScore(s)
            }
          }
          break
        }
      }
      if (!e.leaked && e.trait === 'blink' && !e.blinkUsed && e.pathIndex >= Math.floor(ePath.length * 0.45)) {
        e.pathIndex = Math.min(e.pathIndex + 1, Math.max(0, ePath.length - 2))
        e.progress = Math.min(0.85, e.progress + 0.15)
        e.blinkUsed = true
        floatingTextRef.current.push({ x: e.x + 0.5, y: e.y + 0.2, text: 'BLINK', time: 0, maxTime: 0.5, color: '#c084fc' })
        spawnPortalRef.current.push({ x: e.x + 0.5, y: e.y + 0.5, time: 0, maxTime: 0.28, pathIdx: e.pathIdx })
      }
      if (!e.leaked) {
        const pos = getEnemyPos(e.pathIdx, e.pathIndex, e.progress)
        e.x = pos.x; e.y = pos.y
      }
    }
    enemiesRef.current = enemiesRef.current.filter(e => !e.leaked && !e.dead)

    // ── Stage-10 boss: smash nearby towers ────────────────────────────────
    if (isHeavyBossStage(stageRef.current, endlessRef.current)) {
      for (const e of enemiesRef.current) {
        if (!e.isBoss || e.dead || e.leaked) continue
        e.summonCooldown -= dt
        if (e.summonCooldown <= 0) {
          e.summonCooldown = 8
          const normalCfg = getNormalWaveCfg(stageRef.current, waveRef.current)
          const numSpawns = Math.max(1, pathsRef.current.length)
          for (let i = 0; i < 5; i++) {
            const coin = coins[Math.floor(Math.random() * coins.length)]
            const pidx = Math.floor(Math.random() * numSpawns)
            const pos = getEnemyPos(pidx, 0, 0)
            const spdMult = Math.random() < 0.30 ? 1.1 + Math.random() * 0.20 : 1
            const tint = ENEMY_COLORS[Math.floor(Math.random() * ENEMY_COLORS.length)]
            enemiesRef.current.push({
              id: _eid++,
              pathIdx: pidx,
              pathIndex: 0, progress: 0,
              x: pos.x, y: pos.y,
              hp: normalCfg.hp, maxHp: normalCfg.hp,
              speed: normalCfg.speed * spdMult, baseSpeed: normalCfg.speed * spdMult,
              slowTimer: 0,
              reward: normalCfg.reward,
              coinImg: coin?.image || '',
              tint,
              isBoss: false,
              trait: 'none',
              shield: 0,
              maxShield: 0,
              blinkUsed: false,
              destroyCooldown: 9999,
              summonCooldown: 9999,
              hitFlash: 0,
              dead: false, leaked: false,
            })
          }
          if (soundOn) playGameSound('whoosh')
        }
        e.destroyCooldown -= dt
        if (e.destroyCooldown > 0) continue
        // Find nearest tower within 1.8 cells
        let nearest: Tower | null = null
        let nearDist = 1.8
        for (const t of towersRef.current) {
          const center = getTowerCenter(t)
          const dx = center.x - (e.x + 0.5)
          const dy = center.y - (e.y + 0.5)
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < nearDist) { nearDist = d; nearest = t }
        }
        if (nearest) {
          const key = `${nearest.col},${nearest.row}`
          goldRef.current += Math.floor(nearest.towerDef.cost * 0.3)
          towersRef.current = towersRef.current.filter(t => t.id !== nearest!.id)
          e.destroyCooldown = 7.5
          if (soundOn) playGameSound('hit')
          setDestroyFlash(key)
          setTimeout(() => setDestroyFlash(null), 1000)
          // Add lightning effect from boss to tower
          bossLightningRef.current.push({
            fromX: e.x + 0.5,
            fromY: e.y + 0.5,
            toX: getTowerCenter(nearest).x,
            toY: getTowerCenter(nearest).y,
            time: 0,
            maxTime: 0.15
          })
          // Add blue screen flash for boss attack
          bossScreenFlashRef.current = {time: 0, maxTime: 0.08, intensity: 0.8}
          setBossScreenFlashState(0.8)
        } else {
          e.destroyCooldown = 2.8 // retry sooner if no tower nearby
        }
      }
    }

    // ── Tower shooting ────────────────────────────────────────────────────
    const aliveEnemies = enemiesRef.current.filter(isEnemyActive)

    for (const tower of towersRef.current) {
      if (tower.type !== 'dreadnought') continue
      if (!Number.isFinite(tower.scoutCooldown)) tower.scoutCooldown = DREADNOUGHT_SCOUT_INTERVAL
      tower.scoutCooldown -= dt
      if (tower.scoutCooldown <= 0) {
        const activeCount = scoutDronesRef.current.filter(d => d.towerId === tower.id && !d.dead).length
        const spawnCount = Math.max(0, getDreadnoughtScoutCount(tower) - activeCount)
        if (spawnCount > 0 && aliveEnemies.length > 0) {
          spawnDreadnoughtScouts(tower, aliveEnemies, spawnCount)
          tower.scoutCooldown = DREADNOUGHT_SCOUT_INTERVAL
        } else {
          tower.scoutCooldown = aliveEnemies.length > 0 ? DREADNOUGHT_SCOUT_INTERVAL : 1
        }
      }
    }

    for (const drone of scoutDronesRef.current) {
      const homeTower = towersRef.current.find(t => t.id === drone.towerId)
      if (!homeTower) { drone.dead = true; continue }
      const home = getTowerCenter(homeTower)
      const moveToward = (tx: number, ty: number, speed: number) => {
        const dx = tx - drone.x
        const dy = ty - drone.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        drone.angle = angleToDeg(drone.x, drone.y, tx, ty)
        const step = Math.min(dist, speed * dt)
        drone.x += (dx / dist) * step
        drone.y += (dy / dist) * step
        return dist
      }

      if (drone.state === 'return') {
        if (moveToward(home.x, home.y, 7.5) < DREADNOUGHT_SCOUT_DOCK_RADIUS) drone.dead = true
        continue
      }

      const target = aliveEnemies.find(e => e.id === drone.targetId && isEnemyActive(e)) ?? getBestScoutTarget(drone.id, aliveEnemies)
      if (!target) { drone.state = 'return'; continue }
      drone.targetId = target.id

      if (drone.state === 'launch') {
        const tx = target.x + 0.5 + Math.cos(drone.orbit) * DREADNOUGHT_SCOUT_APPROACH_RADIUS
        const ty = target.y + 0.5 + Math.sin(drone.orbit) * DREADNOUGHT_SCOUT_APPROACH_RADIUS
        if (moveToward(tx, ty, 8) < 0.25) {
          drone.state = 'attack'
          drone.timer = getDreadnoughtScoutAttackTime(homeTower)
          drone.cooldown = 0
        }
        continue
      }

      drone.timer -= dt
      drone.orbit += dt * (drone.id % 2 === 0 ? 3.2 : -3.2)
      moveToward(target.x + 0.5 + Math.cos(drone.orbit) * DREADNOUGHT_SCOUT_ATTACK_RADIUS, target.y + 0.5 + Math.sin(drone.orbit) * DREADNOUGHT_SCOUT_ATTACK_RADIUS, 6.5)
      drone.cooldown -= dt
      if (drone.cooldown <= 0) {
        drone.cooldown = DREADNOUGHT_SCOUT_RATE
        bulletsRef.current.push({
          id: _bid++,
          x: drone.x, y: drone.y,
          tx: target.x + 0.5, ty: target.y + 0.5,
          speed: 12,
          color: DREADNOUGHT_SCOUT_COLOR,
          targetId: target.id,
          towerId: homeTower.id,
          dmg: DREADNOUGHT_SCOUT_DAMAGE * (1 + (homeTower.level - 1) * 0.5),
          isAoe: false, isSlow: false, isRocket: false, isHeavy: false, isHoming: false,
          towerType: 'gatling',
          dead: false,
        })
      }
      if (drone.timer <= 0) drone.state = 'return'
    }
    scoutDronesRef.current = scoutDronesRef.current.filter(d => !d.dead)

    // Drain burst queues (artillery 1s interval between rockets)
    for (const tower of towersRef.current) {
      if (tower.burstQueue.length === 0) continue
      if (aliveEnemies.length === 0) {
        tower.burstQueue = []
        continue
      }
      tower.burstQueue[0].delay -= dt
      if (tower.burstQueue[0].delay <= 0) {
        const shot = tower.burstQueue.shift()!
        const currentTargets = enemiesRef.current.filter(isEnemyActive)
        const tracked = currentTargets.find(e => e.id === shot.targetId) ?? getBestScoutTarget(0, currentTargets)
        if (!tracked) continue
        const towerCenter = getTowerCenter(tower)
        const tx = tracked.x + 0.5
        const ty = tracked.y + 0.5
        tower.aimAngle = angleToDeg(towerCenter.x, towerCenter.y, tx, ty)
        bulletsRef.current.push({
          id: _bid++,
          x: towerCenter.x, y: towerCenter.y,
          tx, ty,
          speed: tower.type === 'dreadnought' ? 8 : 7,
          color: tower.type === 'dreadnought' ? '#f43f5e' : '#ff8800',
          targetId: tracked.id,
          towerId: tower.id,
          dmg: shot.dmg,
          isAoe: false, isSlow: false, isRocket: false, isHeavy: true, isHoming: true,
          towerType: tower.type,
          dead: false,
        })
        if (soundOn) playGameSound('artillery')
      }
    }

    // ── Laser beam logic (10s fire, 5s exhaust) ─────────────────────────────────
    const laserBeams: {towerId:number;x1:number;y1:number;x2:number;y2:number}[] = []
    for (const tower of towersRef.current) {
      if (tower.type !== 'laser') continue
      if (tower.laserExhaust > 0) { tower.laserExhaust -= dt; continue }
      // Find all enemies in range — furthest-along is primary, rest take pierce dmg
      const td = tower.towerDef
      const synergy = getTowerSynergy(tower)
      const towerCenter = getTowerCenter(tower)
      const inRange: Enemy[] = []
      for (const e of aliveEnemies) {
        if (!isEnemyActive(e)) continue
        const dx = e.x - towerCenter.x, dy = e.y - towerCenter.y
        if (Math.sqrt(dx*dx+dy*dy) <= td.range + synergy.rangeBonus) inRange.push(e)
      }
      // Sort by path progress descending so index 0 = primary target
      inRange.sort((a, b) => (b.pathIndex + b.progress) - (a.pathIndex + a.progress))
      const laserTarget = inRange[0] ?? null
      if (!laserTarget) {
        if (tower.laserActive > 0) { tower.laserActive = 0; tower.laserExhaust = 5 }
        continue
      }
      tower.aimAngle = angleToDeg(towerCenter.x, towerCenter.y, laserTarget.x + 0.5, laserTarget.y + 0.5)
      // Only pierce enemies that lie along the beam line (tower → primary target)
      const bx = laserTarget.x - towerCenter.x, by = laserTarget.y - towerCenter.y
      const bLen = Math.sqrt(bx*bx + by*by) || 1
      const laserHits: Enemy[] = [laserTarget]
      for (let i = 1; i < inRange.length; i++) {
        const e = inRange[i]
        const ex = e.x - towerCenter.x, ey = e.y - towerCenter.y
        // Project enemy position onto beam direction
        const proj = (ex*bx + ey*by) / bLen
        if (proj <= 0) continue  // behind the tower, skip
        // Perpendicular distance from beam line
        const perpDist = Math.abs(ex*(by/bLen) - ey*(bx/bLen))
        if (perpDist < 0.75) laserHits.push(e)  // within ~0.75 cells of beam line
      }
      if (tower.laserActive <= 0) { tower.laserActive = 10; tower.cooldown = 0 }
      tower.laserActive -= dt
      // Tick-based damage: fires every td.rate seconds (0.01s = 100 ticks/s × 3 dmg = 300 DPS)
      tower.cooldown -= dt
      if (tower.cooldown <= 0) {
        tower.cooldown = td.rate
        const tickDmg = td.dmg * (1 + (tower.level - 1) * 0.5) * synergy.dmgMult
        const pierceDmg = 1.5  // flat damage per tick to secondary targets
        for (let hi = 0; hi < laserHits.length; hi++) {
          const e = laserHits[hi]
          const applied = hi === 0 ? tickDmg : pierceDmg
          const dealt = applyEnemyDamage(e, applied, 'laser')
          grantTowerXp(tower, Math.max(0.01, Math.min(0.06, dealt * 0.0015)))
          if (Math.random() < 0.18) {
            spawnImpactParticles(particlesRef.current, e.x + 0.5, e.y + 0.5, 'impact', hi === 0 ? 3 : 2, 0.85, 0.18)
          }
          handleEnemyDeath(e, 'laser', tower)
        }
      }
      // Beam endpoint: furthest enemy in range for full visual pierce
      const beamEnd = laserHits[laserHits.length - 1]
      laserBeams.push({ towerId: tower.id, x1: towerCenter.x, y1: towerCenter.y, x2: beamEnd.x + 0.5, y2: beamEnd.y + 0.5 })
      if (tower.laserActive <= 0) { tower.laserActive = 0; tower.laserExhaust = 5 }
    }
    setUiLaserBeams(laserBeams)

    // ── Tower shooting (non-laser) ───────────────────────────────────────────
    for (const tower of towersRef.current) {
      if (tower.type === 'laser') continue  // handled above
      tower.cooldown -= dt
      if (tower.cooldown > 0) continue
      const td = tower.towerDef
      const synergy = getTowerSynergy(tower)
      const towerCenter = getTowerCenter(tower)
      let target: Enemy | null = null
      let bestProgress = -1
      for (const e of aliveEnemies) {
        if (!isEnemyActive(e)) continue
        const dx = e.x - towerCenter.x
        const dy = e.y - towerCenter.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist <= td.range + synergy.rangeBonus) {
          const ep = e.pathIndex + e.progress
          if (ep > bestProgress) { bestProgress = ep; target = e }
        }
      }
      if (target) {
        tower.aimAngle = angleToDeg(towerCenter.x, towerCenter.y, target.x + 0.5, target.y + 0.5)
        tower.cooldown = Math.max(0.04, td.rate * synergy.rateMult)
        if (td.key === 'artillery' || td.key === 'dreadnought') {
          const barrageCount = td.key === 'dreadnought' ? 5 : 3
          const barrageDelay = (td.key === 'dreadnought' ? 0.45 : 1.0) * synergy.barrageDelayMult
          const topTargets = [...aliveEnemies]
            .filter(isEnemyActive)
            .sort((a, b) => (b.pathIndex + b.progress) - (a.pathIndex + a.progress))
            .slice(0, barrageCount)
          const dmg = td.dmg * (1 + (tower.level - 1) * 0.5) * synergy.dmgMult
          topTargets.forEach((t, i) => {
            tower.burstQueue.push({
              tx: t.x + 0.5, ty: t.y + 0.5,
              targetId: t.id,
              delay: i * barrageDelay,
              dmg,
            })
          })
        } else {
          bulletsRef.current.push({
            id: _bid++,
            x: towerCenter.x, y: towerCenter.y,
            tx: target.x + 0.5, ty: target.y + 0.5,
            speed: td.key === 'rocket' ? 6 : 12,
            color: td.color,
            targetId: target.id,
            towerId: tower.id,
            dmg: td.dmg * (1 + (tower.level - 1) * 0.5) * synergy.dmgMult,
            isAoe: td.key === 'aoe',
            isSlow: td.key === 'slow',
            isRocket: td.key === 'rocket',
            isHeavy: false,
            isHoming: false,
            towerType: td.key,
            dead: false,
          })
        }
        // Tower-specific sounds
        if (soundOn) {
          if (td.key === 'laser') playGameSound('laser')
          else if (td.key === 'rocket') playGameSound('rocket')
          else if (td.key === 'artillery' || td.key === 'dreadnought') playGameSound('artillery')
          else playGameSound('shoot')
        }
        // Muzzle flash
        setFiringTowers(prev => { const s = new Set(prev); s.add(tower.id); return s })
        setTimeout(() => setFiringTowers(prev => { const s = new Set(prev); s.delete(tower.id); return s }), 80)
      }
    }

    // ── Move bullets ──────────────────────────────────────────────────────
    for (const b of bulletsRef.current) {
      if (b.dead) continue
      if (b.isHoming) {
        const tracked = aliveEnemies.find(e => e.id === b.targetId && isEnemyActive(e))
        if (tracked) {
          b.tx = tracked.x + 0.5
          b.ty = tracked.y + 0.5
        }
      }
      const dx = b.tx - b.x, dy = b.ty - b.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 0.4) {
        b.dead = true
        // apply damage
        const target = aliveEnemies.find(e => e.id === b.targetId && isEnemyActive(e))
        const sourceTower = towersRef.current.find(t => t.id === b.towerId)
        if (b.isRocket) {
          // Huge AOE: 3.0 cell radius, shockwave
          explosionsRef.current.push({ x: b.tx, y: b.ty, radius: 3.0, time: 0, type: 'rocket', maxTime: 0.5 })
          for (const e of aliveEnemies) {
            if (!isEnemyActive(e)) continue
            const edx = e.x - b.tx, edy = e.y - b.ty
            const dist2 = Math.sqrt(edx * edx + edy * edy)
            if (dist2 <= 3.0) {
              // falloff: full damage in centre, 50% at edge
              const falloff = 1 - (dist2 / 3.0) * 0.5
              const applied = b.dmg * falloff
              const dealt = applyEnemyDamage(e, applied, 'rocket')
              if (sourceTower) grantTowerXp(sourceTower, Math.max(0.08, Math.min(0.4, dealt * 0.006)))
              spawnImpactParticles(particlesRef.current, e.x + 0.5, e.y + 0.5, 'impact', 5, 1.6, 0.22)
              handleEnemyDeath(e, 'rocket', sourceTower, true)
            }
          }
        } else if (b.isAoe) {
          // AoE: 1.5 cell radius
          explosionsRef.current.push({ x: b.tx, y: b.ty, radius: 1.5, time: 0, type: 'aoe', maxTime: 0.4 })
          for (const e of aliveEnemies) {
            if (!isEnemyActive(e)) continue
            const edx = e.x - b.tx, edy = e.y - b.ty
            if (Math.sqrt(edx*edx+edy*edy) <= 1.5) {
              const dealt = applyEnemyDamage(e, b.dmg, 'aoe')
              if (sourceTower) grantTowerXp(sourceTower, Math.max(0.08, Math.min(0.35, dealt * 0.006)))
              spawnImpactParticles(particlesRef.current, e.x + 0.5, e.y + 0.5, 'impact', 4, 1.3, 0.18)
              handleEnemyDeath(e, 'aoe', sourceTower)
            }
          }
        } else if (b.isHeavy) {
          const heavyRadius = b.towerType === 'dreadnought' ? 1.75 : 1.0
          explosionsRef.current.push({
            x: b.tx,
            y: b.ty,
            radius: heavyRadius,
            time: 0,
            type: b.towerType === 'dreadnought' ? 'dreadnought' : 'heavy',
            maxTime: b.towerType === 'dreadnought' ? 0.48 : 0.35,
          })
          for (const e of aliveEnemies) {
            if (!isEnemyActive(e)) continue
            const edx = e.x - b.tx, edy = e.y - b.ty
            if (Math.sqrt(edx*edx+edy*edy) <= heavyRadius) {
              const dealt = applyEnemyDamage(e, b.dmg, b.towerType)
              if (sourceTower) grantTowerXp(sourceTower, Math.max(0.08, Math.min(0.4, dealt * 0.006)))
              spawnImpactParticles(particlesRef.current, e.x + 0.5, e.y + 0.5, 'impact', 5, 1.45, 0.2)
              handleEnemyDeath(e, b.towerType, sourceTower, true)
            }
          }
        } else if (target) {
          if (b.isSlow) target.slowTimer = 2.5
          const dealt = applyEnemyDamage(target, b.dmg, b.towerType)
          if (sourceTower) grantTowerXp(sourceTower, Math.max(0.08, Math.min(0.35, dealt * 0.006)))
          spawnImpactParticles(
            particlesRef.current,
            target.x + 0.5,
            target.y + 0.5,
            b.isSlow ? 'freeze' : 'impact',
            b.isSlow ? 6 : (b.towerType === 'gatling' ? 4 : 3),
            b.isSlow ? 1.1 : 1.25,
            b.isSlow ? 0.32 : 0.18,
          )
          handleEnemyDeath(target, b.towerType, sourceTower)
        }
      } else {
        const ratio = Math.min(b.speed * dt / dist, 1)
        b.x += dx * ratio; b.y += dy * ratio
      }
    }
    bulletsRef.current = bulletsRef.current.filter(b => !b.dead)
    enemiesRef.current = enemiesRef.current.filter(e => !e.dead)

    // ── Update explosions ──────────────────────────────────────────────────
    for (const exp of explosionsRef.current) {
      exp.time += dt
    }
    explosionsRef.current = explosionsRef.current.filter(e => e.time < e.maxTime)

    // ── Update shockwaves ──────────────────────────────────────────────────
    for (const wave of shockwavesRef.current) {
      wave.time += dt
      wave.intensity = Math.max(0, 1 - wave.time / wave.maxTime)
    }
    shockwavesRef.current = shockwavesRef.current.filter(w => w.time < w.maxTime)

    // ── Update particles ────────────────────────────────────────────────────
    for (const p of particlesRef.current) {
      p.life += dt
      p.vy += 0.8 * dt  // gravity
      p.x += p.vx * dt
      p.y += p.vy * dt
    }
    particlesRef.current = particlesRef.current.filter(p => p.life < p.maxLife)

    // ── Update floating text ────────────────────────────────────────────────
    for (const t of floatingTextRef.current) {
      t.time += dt
    }
    floatingTextRef.current = floatingTextRef.current.filter(t => t.time < t.maxTime)

    // ── Update Polish Animations ───────────────────────────────────────────
    // Wave announcement
    setWaveAnnouncement(prev => {
      if (!prev) return prev
      const nextTime = prev.time + dt
      if (nextTime >= prev.maxTime) return null
      return { ...prev, time: nextTime }
    })

    // Screen flash
    if (screenFlashRef.current) {
      screenFlashRef.current.time += dt
      if (screenFlashRef.current.time >= screenFlashRef.current.maxTime) {
        screenFlashRef.current = null
        setScreenFlashState(0)
      } else {
        const progress = screenFlashRef.current.time / screenFlashRef.current.maxTime
        setScreenFlashState(Math.max(0, 1 - progress))
      }
    }

    // Boss screen flash (blue tint)
    if (bossScreenFlashRef.current) {
      bossScreenFlashRef.current.time += dt
      if (bossScreenFlashRef.current.time >= bossScreenFlashRef.current.maxTime) {
        bossScreenFlashRef.current = null
        setBossScreenFlashState(0)
      } else {
        const progress = bossScreenFlashRef.current.time / bossScreenFlashRef.current.maxTime
        setBossScreenFlashState(Math.max(0, bossScreenFlashRef.current.intensity * (1 - progress)))
      }
    }

    // Boss lightning effect
    for (const lightning of bossLightningRef.current) {
      lightning.time += dt
    }
    bossLightningRef.current = bossLightningRef.current.filter(l => l.time < l.maxTime)

    // Stage transition
    if (stageTransitionRef.current) {
      stageTransitionRef.current.time += dt
      const progress = stageTransitionRef.current.time / stageTransitionRef.current.maxTime
      if (stageTransitionRef.current.phase === 'fade' && progress >= 1) {
        stageTransitionRef.current.phase = 'show'
        stageTransitionRef.current.time = 0
      } else if (stageTransitionRef.current.phase === 'show' && progress >= 1) {
        stageTransitionRef.current.phase = 'in'
        stageTransitionRef.current.time = 0
      } else if (stageTransitionRef.current.phase === 'in' && progress >= 1) {
        stageTransitionRef.current = null
        setStageTransitionState(null)
      } else {
        setStageTransitionState({
          phase: stageTransitionRef.current.phase,
          progress: stageTransitionRef.current.phase === 'show' ? 1 : Math.min(1, progress)
        })
      }
    }

    // Spawn portals
    for (const portal of spawnPortalRef.current) {
      portal.time += dt
    }
    spawnPortalRef.current = spawnPortalRef.current.filter(p => p.time < p.maxTime)
    setSpawnPortals([...spawnPortalRef.current])

    // Tower action bursts
    for (const burst of towerActionBurstRef.current) {
      burst.time += dt
    }
    towerActionBurstRef.current = towerActionBurstRef.current.filter(b => b.time < b.maxTime)
    setTowerActionBursts([...towerActionBurstRef.current])

    // Health tween
    for (const [enemyId, tween] of healthTweenRef.current.entries()) {
      tween.elapsed += dt
      if (tween.elapsed >= tween.duration) {
        healthTweenRef.current.delete(enemyId)
      } else {
        const progress = tween.elapsed / tween.duration
        const easeProgress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2  // ease-in-out
        const tweenedHp = tween.from + (tween.to - tween.from) * easeProgress
        enemyHealthDisplay.set(enemyId, tweenedHp)
      }
    }
    setEnemyHealthDisplay(new Map(enemyHealthDisplay))

    // Coin flows
    for (const flow of coinFlowRef.current) {
      flow.time += dt
    }
    coinFlowRef.current = coinFlowRef.current.filter(f => f.time < f.maxTime)
    setCoinFlows([...coinFlowRef.current])

    // Tower creation time animation
    for (const [towerId, creationTime] of towerCreationTimeRef.current.entries()) {
      if (creationTime < 0.3) {
        towerCreationTimeRef.current.set(towerId, creationTime + dt)
      }
    }

    // Victory effect
    setVictoryEffect(prev => {
      if (!prev) return prev
      const nextTime = prev.time + dt
      if (nextTime >= prev.maxTime) return null
      return { ...prev, time: nextTime }
    })

    // ── Update UI ─────────────────────────────────────────────────────────
    setUiGold(goldRef.current)
    setUiLives(livesRef.current)
    setUiHqLevel(hqLevelRef.current)
    setUiScore(scoreRef.current)
    setUiEnemies([...enemiesRef.current])
    setUiBullets([...bulletsRef.current])
    setUiScoutDrones([...scoutDronesRef.current])
    setUiTowers([...towersRef.current])
    setUiExplosions([...explosionsRef.current])
    setUiShockwaves([...shockwavesRef.current])
    setUiParticles([...particlesRef.current])
    setUiFloatingText([...floatingTextRef.current])
    setUiBossLightning([...bossLightningRef.current])
    setUiCommanderCooldowns({ ...commanderCooldownsRef.current })

    frameRef.current = requestAnimationFrame(gameLoop)
  }, [soundOn])

  useEffect(() => {
    frameRef.current = requestAnimationFrame(gameLoop)
    return () => {
      cancelAnimationFrame(frameRef.current)
      stopBGM()
    }
  }, [gameLoop])

  // ── Enter Endless Mode ─────────────────────────────────────────────────────
  function enterEndless() {
    const ps = generatePaths(MAX_STAGES + 1)
    enemiesRef.current = []
    towersRef.current = []
    bulletsRef.current = []
    scoutDronesRef.current = []
    goldRef.current = 50000
    hqLevelRef.current = 1
    livesRef.current = 20
    waveRef.current = 0
    stageRef.current = MAX_STAGES
    pathsRef.current = ps
    pathRef.current = ps[0]
    pathSetRef.current = new Set(ps.flat().map(([c, r]) => `${c},${r}`))
    scoreRef.current = 0
    spawnQueueRef.current = 0
    bossQueueRef.current = 0
    normalEscortQueueRef.current = 0
    spawnTimerRef.current = 0
    spawnRRRef.current = 0
    explosionsRef.current = []
    resetCommanderCooldowns()
    endlessRef.current = true
    setUiEndless(true)
    setUiStage(MAX_STAGES)
    setUiWave(0)
    setUiPaths(ps)
    setUiGold(50000)
    setUiHqLevel(1)
    setUiLives(20)
    setUiScore(0)
    setUiEnemies([])
    setUiBullets([])
    setUiScoutDrones([])
    setUiTowers([])
    setSelectedTowerOnGrid(null)
    stateRef.current = 'playing'
    setUiState('playing')
    startBGM()
  }

  useEffect(() => {
    if (initialMode === 'endless') enterEndless()
  }, [])

  // ── Start wave ─────────────────────────────────────────────────────────────
  function startWave() {
    if (stateRef.current !== 'playing' && stateRef.current !== 'idle') return
    const nextWave = waveRef.current + 1
    waveRef.current = nextWave
    setUiWave(nextWave)
    const cfg = getWaveCfg(stageRef.current, nextWave, endlessRef.current)
    const numSpawns = Math.max(1, pathsRef.current.length)
    if (cfg.isBoss) {
      const normalCfg = getNormalWaveCfg(stageRef.current, nextWave)
      // Boss waves also include a reduced escort of normal enemies.
      bossQueueRef.current = cfg.count
      normalEscortQueueRef.current = Math.max(numSpawns, Math.floor(normalCfg.count * numSpawns * 0.45))
      spawnQueueRef.current = bossQueueRef.current + normalEscortQueueRef.current
    } else {
      bossQueueRef.current = 0
      normalEscortQueueRef.current = cfg.count * numSpawns
      spawnQueueRef.current = normalEscortQueueRef.current
    }
    spawnTimerRef.current = 0
    spawnRRRef.current = 0
    stateRef.current = 'wave'
    setUiState('wave')
    playGameSound('countdown')
    // Wave announcement
    setWaveAnnouncement({wave: nextWave, time: 0, maxTime: 0.8})
  }

  // ── Advance stage ──────────────────────────────────────────────────────────
  function advanceStage() {
    const nextStage = stageRef.current + 1
    stageRef.current = nextStage
    const newPaths = generatePaths(nextStage)
    const newPathSet = new Set(newPaths.flat().map(([c, r]) => `${c},${r}`))
    pathsRef.current = newPaths
    pathRef.current = newPaths[0]
    pathSetRef.current = newPathSet
    // Remove towers that are now on the new paths (70% refund)
    const removedGold = towersRef.current
      .filter(t => getTowerCells(t.col, t.row, getTowerFootprint(t.type)).some(key => newPathSet.has(key)))
      .reduce((sum, t) => sum + Math.floor(t.towerDef.cost * 0.7), 0)
    towersRef.current = towersRef.current.filter(t => !getTowerCells(t.col, t.row, getTowerFootprint(t.type)).some(key => newPathSet.has(key)))
    goldRef.current += removedGold
    enemiesRef.current = []
    bulletsRef.current = []
    scoutDronesRef.current = []
    waveRef.current = 0
    spawnRRRef.current = 0
    stateRef.current = 'playing'
    setUiStage(nextStage)
    setUiWave(0)
    setUiPaths(newPaths)
    setUiState('playing')
    setUiGold(goldRef.current)
    setUiEnemies([])
    setUiBullets([])
    setUiScoutDrones([])
    setUiTowers([...towersRef.current])
    setSelectedTowerOnGrid(null)
    startBGM()
    // Stage transition animation
    stageTransitionRef.current = {phase: 'fade', time: 0, maxTime: 0.3}
    setStageTransitionState({phase: 'fade', progress: 0})
  }

  // ── Place tower ────────────────────────────────────────────────────────────
  // ── Tower drag-and-drop handlers ───────────────────────────────────────────
  function tryDropTower(clientX: number, clientY: number, boardEl: HTMLElement) {
    const movingTower = draggedTowerRef.current
    if (!movingTower) return
    const [offsetX, offsetY] = dragOffsetRef.current
    const boardRect = boardEl.getBoundingClientRect()
    const x = clientX - boardRect.left - offsetX
    const y = clientY - boardRect.top - offsetY
    const newCol = Math.round(x / cell)
    const newRow = Math.round(y / cell)

    if (canPlaceTowerAt(newCol, newRow, getTowerFootprint(movingTower.type), movingTower.id)) {
      movingTower.col = newCol
      movingTower.row = newRow
      setUiTowers([...towersRef.current])
      setSelectedTowerOnGrid({ ...movingTower })
    }
  }

  function handleTowerMouseDown(e: React.MouseEvent, tower: Tower) {
    e.preventDefault()
    e.stopPropagation()
    const boardRect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect()
    const offsetX = e.clientX - boardRect.left - tower.col * cell
    const offsetY = e.clientY - boardRect.top - tower.row * cell
    dragMousePointRef.current = { x: e.clientX, y: e.clientY }
    dragOffsetRef.current = [offsetX, offsetY]
    draggedTowerRef.current = tower
    setDraggedTower(tower)
  }

  function handleBoardMouseMove(e: React.MouseEvent) {
    if (!draggedTowerRef.current) return
    dragMousePointRef.current = { x: e.clientX, y: e.clientY }
    tryDropTower(e.clientX, e.clientY, e.currentTarget as HTMLElement)
  }

  function handleBoardMouseUp(e: React.MouseEvent) {
    if (!draggedTowerRef.current) return
    tryDropTower(e.clientX, e.clientY, e.currentTarget as HTMLElement)
    draggedTowerRef.current = null
    setDraggedTower(null)
  }

  function handleTowerTouchStart(e: React.TouchEvent, tower: Tower) {
    const touch = e.touches[0]
    if (!touch) return
    e.preventDefault()
    e.stopPropagation()
    const boardRect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect()
    const offsetX = touch.clientX - boardRect.left - tower.col * cell
    const offsetY = touch.clientY - boardRect.top - tower.row * cell
    dragTouchPointRef.current = { x: touch.clientX, y: touch.clientY }
    dragOffsetRef.current = [offsetX, offsetY]
    draggedTowerRef.current = tower
    setDraggedTower(tower)
  }

  function handleBoardTouchMove(e: React.TouchEvent) {
    if (!draggedTowerRef.current) return
    const touch = e.touches[0]
    if (!touch) return
    dragTouchPointRef.current = { x: touch.clientX, y: touch.clientY }
    e.preventDefault()
  }

  function handleBoardTouchEnd(e: React.TouchEvent) {
    if (!draggedTowerRef.current) return
    const touch = e.changedTouches[0]
    const point = touch ? { x: touch.clientX, y: touch.clientY } : dragTouchPointRef.current
    if (point) tryDropTower(point.x, point.y, e.currentTarget as HTMLElement)
    draggedTowerRef.current = null
    dragTouchPointRef.current = null
    dragMousePointRef.current = null
    setDraggedTower(null)
  }

  function handleCellClick(col: number, row: number) {
    if (stateRef.current === 'gameover' || stateRef.current === 'victory') return
    if (draggedTower) return  // Don't build while dragging
    const key = `${col},${row}`
    if (pathSetRef.current.has(key)) return

    // Check existing tower
    const existing = findTowerAtCell(col, row)
    if (existing) {
      setSelectedTowerOnGrid(existing)
      return
    }
    setSelectedTowerOnGrid(null)
    if (!selectedTowerKey) return

    const tDef = TOWER_TYPES.find(t => t.key === selectedTowerKey)!
    const footprint = getTowerFootprint(selectedTowerKey)
    if (selectedTowerKey === 'dreadnought' && getDreadnoughtFieldCount() >= DREADNOUGHT_FIELD_LIMIT) {
      playGameSound('hit')
      floatingTextRef.current.push({ x: COLS / 2, y: 1.2, text: `DREADNOUGHT ${DREADNOUGHT_FIELD_LIMIT}/${DREADNOUGHT_FIELD_LIMIT}`, time: 0, maxTime: 0.75, color: '#fda4af' })
      return
    }
    if (!canPlaceTowerAt(col, row, footprint)) {
      playGameSound('hit')
      return
    }
    const cost = tDef.cost
    if (goldRef.current < cost) {
      playGameSound('hit')
      return
    }
    goldRef.current -= cost
    const coin = coinsRef.current[Math.floor(Math.random() * coinsRef.current.length)]
    const newTower: Tower = {
      id: _tid++,
      col, row,
      type: selectedTowerKey,
      towerDef: tDef,
      coin,
      cooldown: 0,
      level: 1,
      xp: 0,
      aimAngle: -90,
      burstQueue: [],
      laserActive: 0,
      laserExhaust: 0,
      scoutCooldown: selectedTowerKey === 'dreadnought' ? DREADNOUGHT_SCOUT_INTERVAL : 0,
    }
    towersRef.current.push(newTower)
    towerCreationTimeRef.current.set(newTower.id, 0)
    setUiTowers([...towersRef.current])
    setUiGold(goldRef.current)
    playGameSound('select')
    const towerCenter = getTowerCenter(newTower)
    // Spawn portal effect
    spawnPortalRef.current.push({x: towerCenter.x, y: towerCenter.y, time: 0, maxTime: 0.4, pathIdx: 0})
    // Build particles
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8
      particlesRef.current.push({
        x: towerCenter.x, y: towerCenter.y,
        type: 'build',
        vx: Math.cos(angle) * 1.8, vy: Math.sin(angle) * 1.8,
        life: 0, maxLife: 0.35
      })
    }
  }

  // ── Upgrade tower ──────────────────────────────────────────────────────────
  function castCommanderAbility(kind: CommanderAbilityKey) {
    if (commanderCooldownsRef.current[kind] > 0) { playGameSound('hit'); return }
    if (kind === 'repair') {
      const maxLives = getHqMaxLives()
      if (livesRef.current >= maxLives) { playGameSound('hit'); return }
      livesRef.current = Math.min(maxLives, livesRef.current + 4 + hqLevelRef.current * 2)
      setUiLives(livesRef.current)
      floatingTextRef.current.push({ x: COLS - 1.2, y: ROWS - 1.2, text: '+REPAIR', time: 0, maxTime: 0.65, color: '#7dd3fc' })
      playGameSound('levelup')
    } else {
      const targets = enemiesRef.current.filter(isEnemyActive)
      if (targets.length === 0) { playGameSound('hit'); return }
      if (kind === 'freeze') {
        for (const e of targets) e.slowTimer = Math.max(e.slowTimer, 3.8 + hqLevelRef.current * 0.35)
        floatingTextRef.current.push({ x: COLS / 2, y: 1.2, text: 'ORBITAL FREEZE', time: 0, maxTime: 0.75, color: '#7dd3fc' })
        playGameSound('laser')
      } else {
        const dmg = 70 + uiStage * 12 + hqLevelRef.current * 22
        for (const e of targets) {
          const applied = applyEnemyDamage(e, dmg, 'ion')
          if (applied > 0) spawnImpactParticles(particlesRef.current, e.x + 0.5, e.y + 0.5, 'impact', 4, 1.3, 0.18)
          handleEnemyDeath(e, 'ion', undefined, true)
        }
        screenFlashRef.current = { time: 0, maxTime: 0.25, intensity: 0.75 }
        floatingTextRef.current.push({ x: COLS / 2, y: 1.2, text: 'ION STORM', time: 0, maxTime: 0.75, color: '#f0abfc' })
        playGameSound('explosion_big')
      }
    }
    commanderCooldownsRef.current[kind] = COMMANDER_COOLDOWNS[kind]
    setUiCommanderCooldowns({ ...commanderCooldownsRef.current })
  }

  function upgradeHq() {
    if (hqLevelRef.current >= HQ_MAX_LEVEL) { playGameSound('hit'); return }
    const cost = 800 + hqLevelRef.current * 650
    if (goldRef.current < cost) { playGameSound('hit'); return }
    goldRef.current -= cost
    hqLevelRef.current += 1
    livesRef.current = Math.min(getHqMaxLives(), livesRef.current + 5)
    setUiGold(goldRef.current)
    setUiHqLevel(hqLevelRef.current)
    setUiLives(livesRef.current)
    floatingTextRef.current.push({ x: COLS - 1.2, y: ROWS - 1.2, text: `HQ LV ${hqLevelRef.current}`, time: 0, maxTime: 0.8, color: '#ffd666' })
    playGameSound('levelup')
  }

  function grantTowerXp(tower: Tower, amount: number) {
    if (amount <= 0 || tower.level >= MAX_TOWER_LEVEL) return
    tower.xp += amount
    let leveled = false
    while (tower.level < MAX_TOWER_LEVEL) {
      const need = xpNeededForNextLevel(tower.level)
      if (tower.xp < need) break
      tower.xp -= need
      tower.level += 1
      leveled = true
      const center = getTowerCenter(tower)
      towerActionBurstRef.current.push({ x: center.x, y: center.y, type: 'upgrade', time: 0, maxTime: 0.4 })
    }
    if (tower.level >= MAX_TOWER_LEVEL) tower.xp = 0
    if (leveled) {
      if (selectedTowerOnGrid?.id === tower.id) setSelectedTowerOnGrid({ ...tower })
      if (soundOn) playGameSound('levelup')
    }
  }

  function upgradeTower(tower: Tower) {
    // Always operate on the authoritative ref object, not a potentially stale copy from selectedTowerOnGrid
    const refTower = towersRef.current.find(t => t.id === tower.id)
    if (!refTower) return
    if (refTower.level >= MAX_TOWER_LEVEL) { playGameSound('hit'); return }
    const cost = Math.floor(refTower.towerDef.cost * refTower.level * 1.2)
    if (goldRef.current < cost) { playGameSound('hit'); return }
    goldRef.current -= cost
    refTower.level = Math.min(refTower.level + 1, MAX_TOWER_LEVEL)
    if (refTower.level >= MAX_TOWER_LEVEL) refTower.xp = 0
    setUiTowers([...towersRef.current])
    setUiGold(goldRef.current)
    setSelectedTowerOnGrid({...refTower})
    playGameSound('levelup')
    // Upgrade burst effect
    const refCenter = getTowerCenter(refTower)
    towerActionBurstRef.current.push({x: refCenter.x, y: refCenter.y, type: 'upgrade', time: 0, maxTime: 0.5})
    // Upgrade particles
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6
      particlesRef.current.push({
        x: refCenter.x, y: refCenter.y,
        type: 'build',
        vx: Math.cos(angle) * 1.5, vy: (Math.sin(angle) - 1.2) * 1.5,
        life: 0, maxLife: 0.4
      })
    }
  }

  // ── Sell tower ─────────────────────────────────────────────────────────────
  function sellTower(tower: Tower) {
    const sellValue = Math.floor(tower.towerDef.cost * 0.5)
    goldRef.current += sellValue
    const center = getTowerCenter(tower)
    // Sell burst effect
    towerActionBurstRef.current.push({x: center.x, y: center.y, type: 'sell', time: 0, maxTime: 0.5})
    // Gold particles from tower to top-right
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8
      particlesRef.current.push({
        x: center.x, y: center.y,
        type: 'gold',
        vx: Math.cos(angle) * 2.0, vy: Math.sin(angle) * 2.0,
        life: 0, maxLife: 0.5
      })
    }
    towersRef.current = towersRef.current.filter(t => t.id !== tower.id)
    scoutDronesRef.current = scoutDronesRef.current.filter(d => d.towerId !== tower.id)
    towerCreationTimeRef.current.delete(tower.id)
    setUiTowers([...towersRef.current])
    setUiGold(goldRef.current)
    setSelectedTowerOnGrid(null)
    playGameSound('swap')
  }

  // ── Restart ────────────────────────────────────────────────────────────────
  function restart() {
    if (endlessRef.current) {
      enterEndless()
      return
    }

    const ps = generatePaths(1)
    enemiesRef.current = []
    towersRef.current = []
    bulletsRef.current = []
    scoutDronesRef.current = []
    goldRef.current = 400
    hqLevelRef.current = 1
    livesRef.current = 20
    waveRef.current = 0
    stageRef.current = 1
    pathsRef.current = ps
    pathRef.current = ps[0]
    pathSetRef.current = new Set(ps.flat().map(([c, r]) => `${c},${r}`))
    scoreRef.current = 0
    spawnQueueRef.current = 0
    bossQueueRef.current = 0
    normalEscortQueueRef.current = 0
    spawnTimerRef.current = 0
    spawnRRRef.current = 0
    explosionsRef.current = []
    resetCommanderCooldowns()
    endlessRef.current = false
    setUiEndless(false)
    stateRef.current = 'idle'
    setUiState('idle')
    setUiWave(0)
    setUiStage(1)
    setUiPaths(ps)
    setUiGold(400)
    setUiHqLevel(1)
    setUiLives(20)
    setUiScore(0)
    setUiEnemies([])
    setUiBullets([])
    setUiScoutDrones([])
    setUiTowers([])
    setSelectedTowerOnGrid(null)
  }

  const boardW = cell * COLS
  const boardH = cell * ROWS
  // On any mobile (portrait or landscape phones), use full screen width so sidebar fills the space.
  const isMobileChromeWidth = typeof window !== 'undefined' ? (window.innerWidth <= 900 || window.innerHeight <= 550) : false
  const chromeMaxW = isMobileChromeWidth
    ? (typeof window !== 'undefined' ? window.innerWidth - 10 : 1200)
    : Math.min(typeof window !== 'undefined' ? window.innerWidth - 10 : 1200, boardW + 280)

  useEffect(() => {
    const canvas = spaceCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = boardW
    canvas.height = boardH

    const stars = Array.from({ length: Math.max(80, Math.floor((boardW * boardH) / 1800)) }, () => ({
      x: Math.random() * boardW,
      y: Math.random() * boardH,
      r: 0.5 + Math.random() * 1.8,
      v: 6 + Math.random() * 20,
      a: 0.25 + Math.random() * 0.6,
    }))

    const asteroids = Array.from({ length: 7 }, () => ({
      x: Math.random() * boardW,
      y: Math.random() * boardH,
      r: 8 + Math.random() * 15,
      vx: -6 - Math.random() * 12,
      vy: -2 + Math.random() * 4,
      rot: Math.random() * Math.PI * 2,
      vr: -0.25 + Math.random() * 0.5,
    }))

    let last = performance.now()
    const draw = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000)
      last = t

      ctx.clearRect(0, 0, boardW, boardH)
      const bg = ctx.createLinearGradient(0, 0, 0, boardH)
      bg.addColorStop(0, '#050912')
      bg.addColorStop(0.45, '#070d1a')
      bg.addColorStop(1, '#03060c')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, boardW, boardH)

      for (const s of stars) {
        s.y += s.v * dt
        if (s.y > boardH + 3) {
          s.y = -3
          s.x = Math.random() * boardW
        }
        ctx.beginPath()
        ctx.fillStyle = `rgba(225,238,255,${s.a})`
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
      }

      for (const a of asteroids) {
        a.x += a.vx * dt
        a.y += a.vy * dt
        a.rot += a.vr * dt
        if (a.x < -a.r * 2) {
          a.x = boardW + a.r * 2
          a.y = Math.random() * boardH
        }

        ctx.save()
        ctx.translate(a.x, a.y)
        ctx.rotate(a.rot)
        ctx.beginPath()
        for (let i = 0; i < 8; i++) {
          const ang = (Math.PI * 2 * i) / 8
          const rr = a.r * (0.75 + Math.sin(i * 1.9) * 0.15)
          const px = Math.cos(ang) * rr
          const py = Math.sin(ang) * rr
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.closePath()
        ctx.fillStyle = '#4f5c66'
        ctx.fill()
        ctx.strokeStyle = '#7e8c97'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.restore()
      }

      spaceAnimRef.current = requestAnimationFrame(draw)
    }

    spaceAnimRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(spaceAnimRef.current)
  }, [boardW, boardH])

  const nextWaveNum = uiWave + 1
  const nextWaveCfg = getWaveCfg(uiStage, nextWaveNum, uiEndless)
  const isBossNextWave = nextWaveCfg.isBoss
  const canStartWave = uiState === 'idle' || uiState === 'playing'
  const isOver = uiState === 'gameover' || uiState === 'victory'
  // True for any phone/tablet (portrait or landscape) — wide landscape phones have small innerHeight.
  const isMobileViewport = typeof window !== 'undefined' ? (window.innerWidth <= 900 || window.innerHeight <= 550) : false
  // isLandscapeMobile: sidebar is on the right side but screen is small — needs compact items + own scroll.
  const isLandscapeMobile = isMobileViewport && !isCompact
  const activeOverlay = isOver || uiState === 'stage_complete'
  const renderedLaserBeams = isMobileViewport ? uiLaserBeams.slice(0, 3) : uiLaserBeams
  const renderedParticles = isMobileViewport ? uiParticles.slice(-80) : uiParticles
  const renderedExplosions = isMobileViewport ? uiExplosions.slice(-8) : uiExplosions
  const renderedShockwaves = isMobileViewport ? uiShockwaves.slice(-6) : uiShockwaves
  const renderedPortals = isMobileViewport ? spawnPortals.slice(-6) : spawnPortals
  const renderedActionBursts = isMobileViewport ? towerActionBursts.slice(-5) : towerActionBursts
  const renderedCoinFlows = isMobileViewport ? coinFlows.slice(-10) : coinFlows
  const victoryConfettiCount = isMobileViewport ? 8 : 20
  const uiPathSet = new Set(uiPaths.flatMap(p => p.map(([c, r]) => `${c},${r}`)))
  // Collect all spawn starts and single finish
  const uiSpawnCells = new Set(uiPaths.map(p => p.length > 0 ? `${p[0][0]},${p[0][1]}` : ''))
  const uiFinishCell = uiPath.length > 0 ? `${uiPath[uiPath.length - 1][0]},${uiPath[uiPath.length - 1][1]}` : ''
  const hqMaxLives = getHqMaxLives(uiHqLevel)
  const hqUpgradeCost = uiHqLevel >= HQ_MAX_LEVEL ? 0 : 800 + uiHqLevel * 650
  const bossIntel = isBossNextWave
    ? isHeavyBossStage(uiStage, uiEndless)
      ? 'INTEL: SIEGE BOSS'
      : 'INTEL: BOSS WAVE'
    : nextWaveNum >= 3
      ? 'INTEL: ELITE CONTACTS'
      : 'INTEL: CLEAR'
  const commandButtonStyle = (bg: string, color: string, disabled = false): React.CSSProperties => ({
    ...btnStyle(disabled ? '#303642' : bg, color, true),
    ...(isCompact
      ? { minWidth: 112, minHeight: 32, padding: '7px 8px', fontSize: '0.66rem', flex: '0 0 auto' }
      : isLandscapeMobile
        ? { minHeight: 32, padding: '7px 8px', fontSize: '0.7rem' }
        : {}),
  })
  const compactTowerShop = isCompact
  const selectedTowerDef = selectedTowerKey ? TOWER_TYPES.find(t => t.key === selectedTowerKey) ?? null : null
  const dreadnoughtFieldCount = uiTowers.filter(t => t.type === 'dreadnought').length
  const dreadnoughtLimitReached = dreadnoughtFieldCount >= DREADNOUGHT_FIELD_LIMIT


  return (
    <>
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes scanline {
          from { background-position: 0 0; }
          to { background-position: 0 12px; }
        }

        @keyframes firingWave {
          0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0.82; }
          100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; }
        }
      `}</style>
      <div ref={gameRootRef} style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'radial-gradient(120% 180% at 10% 0%, #203228 0%, #0c1411 42%, #070b09 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', overflowY: 'auto',
      padding: isCompact ? '4px 6px 6px' : isLandscapeMobile ? '4px 6px' : '12px 8px 24px',
      fontFamily: "'Orbitron','Rajdhani','Segoe UI',sans-serif",
      fontVariantNumeric: 'tabular-nums',
    }}>
      <div style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        background: 'repeating-linear-gradient(0deg, #00000000 0 10px, #00ff7a0a 10px 12px)',
        animation: 'scanline 4s linear infinite',
        zIndex: 0,
      }} />
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: (isCompact || isLandscapeMobile) ? 3 : 6, width: '100%', maxWidth: chromeMaxW, position: 'relative', zIndex: 1, flexShrink: 0 }}>
        <button onClick={onClose} style={btnStyle('#3a120f', '#f9d7bf')} aria-label="Close">X</button>
        <div style={{ flex: 1, textAlign: 'center', fontWeight: 900, fontSize: isCompact ? '0.9rem' : '1.05rem', color: '#ffcf86', letterSpacing: 1.6, whiteSpace: 'nowrap', textTransform: 'uppercase', textShadow: '0 0 12px #ff7b2f66' }}>
          SPACE IMPACT DEFENSE
        </div>
        <button onClick={() => setShowSettingsModal(true)} style={btnStyle('#2d2148', '#d3c6ff')} aria-label="Settings">SETTINGS</button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: isCompact ? 'repeat(2,minmax(0,1fr))' : 'repeat(4,minmax(0,1fr))', gap: (isCompact || isLandscapeMobile) ? 4 : 8, alignItems: 'stretch', width: '100%', maxWidth: chromeMaxW, marginBottom: (isCompact || isLandscapeMobile) ? 4 : 8, position: 'relative', zIndex: 1, flexShrink: 0 }}>
        <StatPill icon="CR" val={uiGold} color="#ffd666" />
        <StatPill icon="HP" val={uiLives} color="#fb7185" />
        <StatPill icon="SC" val={uiScore} color="#18e6c4" />
        <StatPill icon="HI" val={uiHighScore} color="#7c5dff" />
      </div>

      {/* Wave bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: (isCompact || isLandscapeMobile) ? 4 : 8, width: '100%', maxWidth: chromeMaxW, flexWrap: isCompact ? 'wrap' : 'nowrap', position: 'relative', zIndex: 1, background: '#101714', border: '1px solid #335545', borderRadius: 6, padding: (isCompact || isLandscapeMobile) ? '4px 6px' : '6px 8px', boxShadow: 'inset 0 0 0 1px #00000088', flexShrink: 0 }}>
        <span style={{ color: '#b9d7c8', fontSize: isCompact ? '0.75rem' : '0.86rem', whiteSpace: 'nowrap' }}>
          {uiEndless
            ? <><b style={{ color: '#ff8800' }}>ENDLESS</b> | STAGE <b style={{ color: '#ff8800' }}>{uiStage}</b> | WAVE <b style={{ color: '#ffd666' }}>{uiWave}</b>/{WAVES_PER_STAGE}</>
            : <>STAGE <b style={{ color: '#18e6c4' }}>{uiStage}</b>/{MAX_STAGES} | WAVE <b style={{ color: '#ffd666' }}>{uiWave}</b>/{WAVES_PER_STAGE}</>}
        </span>
        <div style={{ flex: 1, minWidth: isCompact ? 130 : 220, height: 8, background: '#222', borderRadius: 2, border: '1px solid #3b5c4d' }}>
          <div style={{ width: `${((uiStage - 1) * WAVES_PER_STAGE + uiWave) / (MAX_STAGES * WAVES_PER_STAGE) * 100}%`, height: '100%', background: 'linear-gradient(90deg,#0feaa9,#7bffcb)', borderRadius: 2, transition: 'width 0.2s linear' }} />
        </div>
        {canStartWave && !isOver && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={startWave} style={btnStyle(isBossNextWave ? '#8a1f1f' : '#194a34', '#f8ffe7', true)}>
              {isBossNextWave ? `BOSS WAVE ${nextWaveNum}` : uiState === 'idle' ? 'START WAVE 1' : `START WAVE ${nextWaveNum}`}
            </button>
            <button onClick={() => setAutoPlayWave(!autoPlayWave)} title={autoPlayWave ? 'Disable auto-play' : 'Enable auto-play (auto-start waves)'} style={btnStyle(autoPlayWave ? '#6f5b2d' : '#3b3f45', '#fff', true)}>
              {autoPlayWave ? 'AUTO' : 'MANUAL'}
            </button>
          </div>
        )}
        {uiState === 'wave' && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ color: '#ffd666', fontWeight: 700 }}>WAVE IN PROGRESS</span>
            <button onClick={() => setAutoPlayWave(!autoPlayWave)} title={autoPlayWave ? 'Disable auto-play' : 'Enable auto-play (auto-start waves)'} style={btnStyle(autoPlayWave ? '#6f5b2d' : '#3b3f45', '#fff', true)}>
              {autoPlayWave ? 'AUTO' : 'MANUAL'}
            </button>
          </div>
        )}
      </div>

      <div style={{
        display: isCompact ? 'flex' : 'grid',
        gridTemplateColumns: isCompact ? undefined : 'repeat(5,minmax(0,1fr))',
        gap: isCompact ? 5 : 6,
        width: '100%',
        maxWidth: chromeMaxW,
        marginBottom: (isCompact || isLandscapeMobile) ? 4 : 8,
        position: 'relative',
        zIndex: 1,
        flexShrink: 0,
        overflowX: isCompact ? 'auto' : undefined,
        paddingBottom: isCompact ? 2 : undefined,
        scrollbarWidth: isCompact ? 'thin' : undefined,
      }}>
        <button type="button" onClick={() => castCommanderAbility('ion')} disabled={uiCommanderCooldowns.ion > 0} style={commandButtonStyle('#5b1b68', '#fce7ff', uiCommanderCooldowns.ion > 0)}>
          {uiCommanderCooldowns.ion > 0 ? `ION ${Math.ceil(uiCommanderCooldowns.ion)}` : 'ION STORM'}
        </button>
        <button type="button" onClick={() => castCommanderAbility('freeze')} disabled={uiCommanderCooldowns.freeze > 0} style={commandButtonStyle('#164e63', '#e0f7ff', uiCommanderCooldowns.freeze > 0)}>
          {uiCommanderCooldowns.freeze > 0 ? `FREEZE ${Math.ceil(uiCommanderCooldowns.freeze)}` : 'FREEZE'}
        </button>
        <button type="button" onClick={() => castCommanderAbility('repair')} disabled={uiCommanderCooldowns.repair > 0 || uiLives >= hqMaxLives} style={commandButtonStyle('#1d4d35', '#dfffea', uiCommanderCooldowns.repair > 0 || uiLives >= hqMaxLives)}>
          {uiCommanderCooldowns.repair > 0 ? `REPAIR ${Math.ceil(uiCommanderCooldowns.repair)}` : `REPAIR ${uiLives}/${hqMaxLives}`}
        </button>
        <button type="button" onClick={upgradeHq} disabled={uiHqLevel >= HQ_MAX_LEVEL || uiGold < hqUpgradeCost} style={commandButtonStyle('#6b4d12', '#fff5c2', uiHqLevel >= HQ_MAX_LEVEL || uiGold < hqUpgradeCost)}>
          {uiHqLevel >= HQ_MAX_LEVEL ? `HQ LV ${HQ_MAX_LEVEL}` : `HQ LV ${uiHqLevel} CR ${hqUpgradeCost}`}
        </button>
        <div style={{ border: '1px solid #385264', borderRadius: 6, padding: isCompact ? '8px 9px' : '7px 8px', background: '#0d1520', color: isBossNextWave ? '#ffb4b4' : '#c6d1dd', fontSize: isCompact ? '0.66rem' : '0.76rem', fontWeight: 900, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: isCompact ? 132 : undefined, flex: isCompact ? '0 0 auto' : undefined }}>
          {bossIntel}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: isCompact ? 'column' : 'row', alignItems: isCompact ? 'center' : 'flex-start', gap: isCompact ? 4 : 8, width: '100%', maxWidth: chromeMaxW, position: 'relative', zIndex: 1, flex: isCompact ? 1 : undefined, minHeight: isCompact ? 0 : undefined, overflow: (isCompact || isLandscapeMobile) ? 'hidden' : undefined, flexShrink: isLandscapeMobile ? 0 : undefined }}>
        {/* Board */}
        <div
          ref={boardRef}
          style={{
            position: 'relative', width: boardW, height: boardH, flexShrink: 0, border: '2px solid #4c6f5c', borderRadius: 4, overflow: 'hidden', userSelect: 'none',
            boxShadow: '0 0 0 1px #0b0f0d inset, 0 0 0 3px #1a241f inset, 0 10px 30px #00000088',
            touchAction: draggedTower ? 'none' : 'pan-y',
            pointerEvents: activeOverlay ? 'none' : 'auto',
            transition: 'none'
          }}
          onMouseMove={handleBoardMouseMove}
          onMouseUp={handleBoardMouseUp}
          onMouseLeave={() => { dragMousePointRef.current = null }}
          onTouchMove={handleBoardTouchMove}
          onTouchEnd={handleBoardTouchEnd}
          onTouchCancel={() => { dragTouchPointRef.current = null; dragMousePointRef.current = null; setDraggedTower(null) }}
        >
          <canvas
            ref={spaceCanvasRef}
            width={boardW}
            height={boardH}
            style={{ position: 'absolute', inset: 0, width: boardW, height: boardH, zIndex: 0, pointerEvents: 'none' }}
          />

          {/* Grid cells */}
          {Array.from({ length: ROWS }, (_, r) =>
            Array.from({ length: COLS }, (_, c) => {
              const key = `${c},${r}`
              const isPath = uiPathSet.has(key)
              const isStart = uiSpawnCells.has(key)
              const isEnd = key === uiFinishCell
              const hasTower = findTowerAtCell(c, r) != null
              const isHovered = hoveredCell?.[0] === c && hoveredCell?.[1] === r
              const tDef = selectedTowerKey ? TOWER_TYPES.find(t => t.key === selectedTowerKey) ?? null : null
              const canAfford = tDef != null && goldRef.current >= tDef.cost
              const selectedFootprint = selectedTowerKey ? getTowerFootprint(selectedTowerKey) : 1
              const isInPlacementPreview = hoveredCell != null && selectedTowerKey != null && c >= hoveredCell[0] && c < hoveredCell[0] + selectedFootprint && r >= hoveredCell[1] && r < hoveredCell[1] + selectedFootprint
              const canPlacePreview = hoveredCell != null && selectedTowerKey != null && canPlaceTowerAt(hoveredCell[0], hoveredCell[1], selectedFootprint) && (selectedTowerKey !== 'dreadnought' || !dreadnoughtLimitReached)
              return (
                <div
                  key={key}
                  onClick={() => handleCellClick(c, r)}
                  onMouseEnter={() => setHoveredCell([c, r])}
                  onMouseLeave={() => setHoveredCell(null)}
                  style={{
                    position: 'absolute',
                    left: c * cell, top: r * cell,
                    width: cell, height: cell,
                    background: isPath
                      ? (isStart ? 'rgba(78,255,190,0.18)' : isEnd ? 'rgba(255,127,127,0.18)' : 'rgba(79,137,201,0.13)')
                      : hasTower ? 'transparent'
                      : (isHovered || isInPlacementPreview) && !isPath && !hasTower
                        ? (canAfford && canPlacePreview ? 'rgba(244,63,94,0.18)' : 'rgba(255,0,0,0.14)')
                        : 'rgba(8,16,30,0.28)',
                    border: '1px solid rgba(66,99,132,0.34)',
                    cursor: isPath ? 'default' : 'pointer',
                    boxSizing: 'border-box',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1,
                  }}
                >
                  {isStart && <MothershipSpawnIcon size={Math.max(16, Math.floor(cell * 0.74))} />}
                  {isEnd && <EarthHQIcon size={Math.max(16, Math.floor(cell * 0.74))} />}
                </div>
              )
            })
          )}

          {/* Laser beams */}
          {renderedLaserBeams.length > 0 && (
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 4 }}>
              <defs>
                <filter id="laserGlow">
                  <feGaussianBlur stdDeviation="2" result="blur"/>
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              {renderedLaserBeams.map(b => (
                <g key={b.towerId}>
                  <line x1={b.x1*cell} y1={b.y1*cell} x2={b.x2*cell} y2={b.y2*cell} stroke="#dbecff" strokeWidth={isMobileViewport ? 2.8 : 4} strokeOpacity={isMobileViewport ? 0.2 : 0.25} filter={isMobileViewport ? undefined : 'url(#laserGlow)'} />
                  <line x1={b.x1*cell} y1={b.y1*cell} x2={b.x2*cell} y2={b.y2*cell} stroke="#ffffff" strokeWidth={isMobileViewport ? 1.1 : 1.5} strokeOpacity={0.9} filter={isMobileViewport ? undefined : 'url(#laserGlow)'} />
                </g>
              ))}
            </svg>
          )}

          {/* Path arrows — all paths */}
          {uiPaths.flatMap((path, pi) =>
            path.slice(0, -1).map(([c, r], i) => {
              const [nc, nr] = path[i + 1]
              const dc = nc - c, dr = nr - r
              const arrow = dc > 0 ? '→' : dc < 0 ? '←' : dr > 0 ? '↓' : '↑'
              // trunk cells (after merge col 7) shared across paths — only render once
              const isTrunk = c >= 7
              if (isTrunk && pi > 0) return null
              return (
                <div key={`arr${pi}-${i}`} style={{
                  position: 'absolute', left: c * cell, top: r * cell,
                  width: cell, height: cell,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#1a5e3a', fontSize: cell * 0.45, pointerEvents: 'none',
                }}>{arrow}</div>
              )
            })
          )}

          {uiTowers.map(tower => {
            const footprint = getTowerFootprint(tower.type)
            const towerW = footprint * cell - 4
            const towerH = footprint * cell - 4
            const shipSize = tower.type === 'dreadnought'
              ? Math.max(54, cell * 1.55)
              : isMobileViewport
                ? (cell > 38 ? 26 : 20)
                : Math.max(36, Math.min(58, cell * DESKTOP_TOWER_SHIP_SCALE[tower.type]))
            // Tower scale-in animation
            const creationTime = towerCreationTimeRef.current.get(tower.id) ?? 0
            const scaleProgress = Math.min(creationTime / 0.42, 1)
            const overshoot = 1 + Math.sin(scaleProgress * Math.PI) * 0.18
            const settle = 0.72 + (scaleProgress * 0.28)
            const scale = Math.min(1.18, overshoot * settle)
            
            // Tower selection pulse
            const pulseTime = Date.now() % 800  // 800ms cycle
            const pulseProgress = pulseTime / 800
            const pulseOpacity = 0.8 + Math.sin(pulseProgress * Math.PI * 2) * 0.2  // pulse between 0.6 and 1.0
            
            return (
              <div
                key={tower.id}
                onClick={() => setSelectedTowerOnGrid(tower)}
                onMouseDown={(e) => handleTowerMouseDown(e, tower)}
                onTouchStart={(e) => handleTowerTouchStart(e, tower)}
                style={{
                  position: 'absolute',
                  left: tower.col * cell + 2, top: tower.row * cell + 2,
                  width: towerW, height: towerH,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: draggedTower?.id === tower.id ? 'grabbing' : 'grab', overflow: 'visible',
                  zIndex: 3,
                  boxShadow: selectedTowerOnGrid?.id === tower.id 
                    ? `0 0 12px ${tower.towerDef.color}, 0 0 24px ${tower.towerDef.color}${Math.round(pulseOpacity * 255).toString(16).padStart(2, '0')}`
                    : 'none',
                  opacity: tower.type === 'laser' && tower.laserExhaust > 0 ? 0.55 : 1,
                  userSelect: 'none',
                  transform: `rotate(${tower.aimAngle}deg) scale(${scale})`,
                  transformOrigin: 'center',
                  transition: 'none',
                }}
                title={tower.towerDef.label}
              >
                {firingTowers.has(tower.id) && (
                  <div
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      width: cell * footprint * 1.05,
                      height: cell * footprint * 1.05,
                      borderRadius: '50%',
                      border: `2.5px solid ${tower.towerDef.color}`,
                      boxShadow: `0 0 14px ${tower.towerDef.color}99`,
                      animation: 'firingWave 0.48s ease-out forwards',
                      pointerEvents: 'none',
                    }}
                  />
                )}
                <TowerShip tType={tower.type} color={tower.towerDef.color} size={shipSize} />
                {tower.level > 1 && (
                  <div style={{ fontSize: cell * 0.22, color: '#ffd666', fontWeight: 700, lineHeight: 1 }}>★{tower.level}</div>
                )}
              </div>
            )
          })}

          {/* Range ring for selected tower */}
          {selectedTowerOnGrid && (() => {
            const t = selectedTowerOnGrid
            const r = t.towerDef.range * cell
            const center = getTowerCenter(t)
            return (
              <div style={{
                position: 'absolute',
                left: center.x * cell - r,
                top: center.y * cell - r,
                width: r * 2, height: r * 2,
                borderRadius: '50%',
                border: `2px dashed ${t.towerDef.color}88`,
                pointerEvents: 'none',
              }} />
            )
          })()}

          {/* On-board tower actions */}
          {selectedTowerOnGrid && !draggedTower && (() => {
            const t = selectedTowerOnGrid
            const upgradeCost = Math.floor(t.towerDef.cost * t.level * 1.2)
            const sellValue = Math.floor(t.towerDef.cost * 0.5)
            const canUpgrade = t.level < MAX_TOWER_LEVEL
            const levelXpNeed = canUpgrade ? xpNeededForNextLevel(t.level) : 0
            const levelXpPct = canUpgrade ? Math.max(0, Math.min(1, t.xp / levelXpNeed)) : 1
            const menuWidth = 160
            const menuHeight = 60
            const center = getTowerCenter(t)
            const footprint = getTowerFootprint(t.type)
            const left = Math.max(8, Math.min(boardW - menuWidth - 8, center.x * cell - menuWidth / 2))
            const preferredBelow = (t.row + footprint) * cell + 8
            const preferredAbove = center.y * cell - menuHeight - 8
            const top = preferredBelow <= boardH - menuHeight - 8 ? preferredBelow : Math.max(8, preferredAbove)

            const actionButtonStyle = (bg: string, disabled = false): React.CSSProperties => ({
              width: 72,
              minHeight: 26,
              borderRadius: 6,
              border: '1px solid #ffffff2d',
              background: disabled ? '#2a3444' : bg,
              color: '#fff',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1.05,
              fontSize: '0.65rem',
              fontWeight: 900,
              cursor: disabled ? 'not-allowed' : 'pointer',
              boxShadow: disabled ? 'none' : '0 4px 10px #00000055',
              opacity: disabled ? 0.45 : 1,
              textTransform: 'uppercase',
            })

            return (
              <div style={{
                position: 'absolute',
                left,
                top,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                padding: 5,
                borderRadius: 7,
                background: '#08111fdd',
                border: `1px solid ${t.towerDef.color}66`,
                boxShadow: '0 6px 16px #00000066',
                zIndex: 8,
              }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => upgradeTower(t)}
                    title={canUpgrade ? `Upgrade for ${upgradeCost} gold` : 'Max level reached'}
                    disabled={!canUpgrade || goldRef.current < upgradeCost}
                    style={actionButtonStyle('#6d48ff', !canUpgrade || goldRef.current < upgradeCost)}
                  >
                    <span>{canUpgrade ? 'Upgrade' : 'Max'}</span>
                    <span style={{ fontSize: '0.6rem', opacity: 0.9 }}>{canUpgrade ? `CR ${upgradeCost}` : `Lv ${MAX_TOWER_LEVEL}`}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => sellTower(t)}
                    title={`Sell for ${sellValue} gold`}
                    style={actionButtonStyle('#fb7185')}
                  >
                    <span>Sell</span>
                    <span style={{ fontSize: '0.6rem', opacity: 0.9 }}>CR {sellValue}</span>
                  </button>
                </div>

                {canUpgrade ? (
                  <div style={{ width: '100%' }}>
                    <div style={{ color: '#c6d1dd', fontSize: '0.58rem', marginBottom: 2, letterSpacing: 0.35 }}>AUTO EXP {t.xp.toFixed(1)} / {levelXpNeed}</div>
                    <div style={{ width: '100%', height: 5, borderRadius: 3, background: '#131b28', border: '1px solid #3a485f' }}>
                      <div style={{ width: `${levelXpPct * 100}%`, height: '100%', borderRadius: 3, background: 'linear-gradient(90deg,#18e6c4,#8bffdf)', boxShadow: '0 0 8px #18e6c477', transition: 'width 0.12s linear' }} />
                    </div>
                  </div>
                ) : (
                  <div style={{ color: '#ffd666', fontSize: '0.58rem', fontWeight: 800, textAlign: 'center' }}>MAX LEVEL REACHED</div>
                )}
              </div>
            )
          })()}

          {/* Enemies */}
          {uiEnemies.map(e => {
            const isFinalBoss = e.isBoss && isHeavyBossStage(uiStage, uiEndless)
            const bossScale = isFinalBoss ? 1.6 : e.isBoss ? 1.35 : 1
            const ePath = uiPaths[e.pathIdx] ?? uiPath
            const [pc, pr] = ePath[Math.min(e.pathIndex, ePath.length - 1)] ?? [e.x, e.y]
            const [nc, nr] = ePath[Math.min(e.pathIndex + 1, ePath.length - 1)] ?? [pc, pr]
            const moveAngle = angleToDeg(pc, pr, nc, nr)
            const sz = (cell - 8) * bossScale
            const borderColor = isFinalBoss ? '#cc00ff' : e.slowTimer > 0 ? '#60a5fa' : e.tint
            const hitFlashOpacity = e.hitFlash > 0 ? Math.min(1, e.hitFlash * 10) : 0  // fade out over 100ms
            const freezeOpacity = e.slowTimer > 0 ? Math.min(0.78, e.slowTimer / 2.5) : 0
            return (
            <div key={e.id} style={{
              position: 'absolute',
              // Anchor at the exact path center so ship sprite is always on-path
              left: (e.x + 0.5) * cell,
              top: (e.y + 0.5) * cell,
              width: 0, height: 0,
              pointerEvents: 'none',
              overflow: 'visible',
            }}>
              {/* HP bar + labels floated above the ship sprite */}
              <div style={{
                position: 'absolute',
                bottom: sz / 2 + 4,
                left: -(e.isBoss ? cell * bossScale / 2 + 2 : cell / 2 - 3),
                width: e.isBoss ? cell * bossScale + 4 : cell - 6,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
              }}>
                {isFinalBoss && <div style={{ fontSize: cell * 0.32, lineHeight: 1, marginBottom: 1 }}>💀</div>}
                {e.isBoss && !isFinalBoss && <div style={{ fontSize: cell * 0.28, lineHeight: 1, marginBottom: 1, color: '#fca5a5', fontWeight: 900, textShadow: '0 0 4px #ef4444' }}>BOSS</div>}
                {!e.isBoss && e.trait !== 'none' && (
                  <div style={{ color: e.trait === 'shielded' ? '#7dd3fc' : e.trait === 'armored' ? '#cbd5e1' : e.trait === 'phase' ? '#c084fc' : e.trait === 'splitter' ? '#f0abfc' : '#fbbf24', fontSize: Math.max(7, cell * 0.15), fontWeight: 900, lineHeight: 1, textShadow: '0 0 5px #000' }}>
                    {e.trait.toUpperCase()}
                  </div>
                )}
                {e.isBoss ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', color: '#fca5a5', fontSize: Math.max(8, cell * 0.18), fontWeight: 900, lineHeight: 1, marginBottom: 2, textShadow: '0 0 6px #ef4444' }}>
                      <span>{isFinalBoss ? '☠' : '⚠'}</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.ceil(e.hp)}/{e.maxHp}</span>
                    </div>
                    <div style={{ width: '100%', height: 7, background: '#1a0505', border: '1px solid #7f1d1d', borderRadius: 2, overflow: 'hidden', boxShadow: '0 0 8px #ef444466' }}>
                      <div style={{ width: `${Math.max(0, e.hp / e.maxHp) * 100}%`, height: '100%', background: e.hp / e.maxHp > 0.5 ? 'linear-gradient(90deg,#dc2626,#f87171)' : e.hp / e.maxHp > 0.25 ? 'linear-gradient(90deg,#b45309,#fbbf24)' : 'linear-gradient(90deg,#7f1d1d,#ef4444)', boxShadow: '0 0 10px #ef444488', borderRadius: 2, transition: 'width 0.06s linear' }} />
                    </div>
                  </>
                ) : (
                  <>
                    {e.maxShield > 0 && (
                      <div style={{ width: '100%', height: 2, background: '#102030', borderRadius: 2, marginBottom: 1 }}>
                        <div style={{ width: `${Math.max(0, e.shield / e.maxShield) * 100}%`, height: '100%', background: '#7dd3fc', borderRadius: 2, boxShadow: '0 0 6px #7dd3fc' }} />
                      </div>
                    )}
                    <div style={{ width: '100%', height: 3, background: '#333', borderRadius: 2 }}>
                      <div style={{ width: `${Math.max(0, e.hp / e.maxHp) * 100}%`, height: '100%', background: e.hp / e.maxHp > 0.5 ? '#34d399' : e.hp / e.maxHp > 0.25 ? '#ffd666' : '#fb7185', borderRadius: 2 }} />
                    </div>
                  </>
                )}
              </div>
              {/* Ship sprite — centered at the exact path position */}
              <div style={{
                position: 'absolute',
                width: sz, height: sz,
                left: -sz / 2, top: -sz / 2,
                overflow: 'visible',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                filter: hitFlashOpacity > 0 ? `brightness(1.5) saturate(2) hue-rotate(-10deg)` : 'none',
                transform: `rotate(${moveAngle}deg)`,
              }}>
                <AlienShip variant={e.id % 4} isBoss={e.isBoss} isFinalBoss={isFinalBoss} color={borderColor} size={Math.max(8, Math.round(sz - 4))} />
                {freezeOpacity > 0 && (
                  <>
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: `radial-gradient(circle at 30% 30%, #ffffffbb 0%, #c6efff88 28%, #7dd3fc55 60%, transparent 100%)`,
                      opacity: freezeOpacity,
                    }} />
                    <div style={{
                      position: 'absolute',
                      inset: 3,
                      border: '1px solid #d8f3ffcc',
                      boxShadow: '0 0 10px #7dd3fcaa inset, 0 0 10px #7dd3fc77',
                      opacity: freezeOpacity,
                    }} />
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      color: '#eefbff',
                      fontSize: Math.max(12, sz * 0.28),
                      fontWeight: 800,
                      textShadow: '0 0 8px #7dd3fc',
                      opacity: freezeOpacity,
                    }}>❄</div>
                  </>
                )}
              </div>
              {isFinalBoss && (
                <div style={{ position: 'absolute', top: sz / 2 + 2, left: -30, width: 60, textAlign: 'center', fontSize: cell * 0.18, color: '#cc00ff', fontWeight: 900, lineHeight: 1, textShadow: '0 0 6px #cc00ff' }}>SIEGE</div>
              )}
            </div>
            )
          })}

          {/* Dreadnought gatling drones */}
          {uiScoutDrones.map(drone => (
            <div key={drone.id} style={{
              position: 'absolute',
              left: drone.x * cell,
              top: drone.y * cell,
              width: 0,
              height: 0,
              pointerEvents: 'none',
              zIndex: 5,
              transform: `rotate(${drone.angle}deg)`,
              filter: drone.state === 'attack' ? `drop-shadow(0 0 8px ${DREADNOUGHT_SCOUT_COLOR})` : 'drop-shadow(0 0 5px #7dd3fc)',
            }}>
              <div style={{ transform: 'translate(-50%, -50%)' }}>
                <TowerShip tType="gatling" color={DREADNOUGHT_SCOUT_COLOR} size={Math.max(18, Math.min(22, cell * 0.46))} />
              </div>
            </div>
          ))}

          {/* Bullets */}
          {uiBullets.map(b => {
            const tt = b.towerType
            // Compute travel angle for elongated projectiles
            const angle = Math.atan2(b.ty - b.y, b.tx - b.x) * 180 / Math.PI

            if (tt === 'rocket' || tt === 'artillery' || tt === 'dreadnought') {
              // 🚀 Rocket / Artillery shell — elongated with flame trail
              const isArtillery = tt === 'artillery'
              const isDreadnought = tt === 'dreadnought'
              return (
                <div key={b.id} style={{
                  position: 'absolute',
                  left: b.x * cell, top: b.y * cell,
                  width: isDreadnought ? 22 : isArtillery ? 18 : 14,
                  height: isDreadnought ? 10 : isArtillery ? 8 : 6,
                  background: isDreadnought
                    ? 'linear-gradient(90deg, #f43f5e, #fda4af)'
                    : isArtillery
                    ? 'linear-gradient(90deg, #ff8800, #ffcc00)'
                    : 'linear-gradient(90deg, #ff0000, #ff6600)',
                  borderRadius: '50% 20% 20% 50%',
                  boxShadow: isDreadnought
                    ? '0 0 18px 6px #f43f5eaa, 0 0 34px 10px #fb718566'
                    : isArtillery
                    ? '0 0 14px 5px #ff880099, 0 0 28px 8px #ff440055'
                    : '0 0 18px 6px #ff000099, 0 0 36px 8px #ff660088',
                  transform: `translate(-50%,-50%) rotate(${angle}deg)`,
                  pointerEvents: 'none',
                }}>
                  {/* flame exhaust */}
                  <div style={{
                    position: 'absolute', right: '100%', top: '15%',
                    width: isDreadnought ? 12 : isArtillery ? 10 : 8,
                    height: isDreadnought ? 7 : isArtillery ? 6 : 4,
                    background: isDreadnought
                      ? 'linear-gradient(90deg, transparent, #f43f5e99)'
                      : isArtillery
                      ? 'linear-gradient(90deg, transparent, #ff880088)'
                      : 'linear-gradient(90deg, transparent, #ff660088)',
                    borderRadius: '0 50% 50% 0',
                  }} />
                </div>
              )
            }

            if (tt === 'sniper') {
              // 🎯 Sniper — thin fast needle
              return (
                <div key={b.id} style={{
                  position: 'absolute',
                  left: b.x * cell, top: b.y * cell,
                  width: 20, height: 3,
                  background: 'linear-gradient(90deg, #7c5dff, #c0aaff)',
                  borderRadius: 2,
                  boxShadow: '0 0 8px 3px #7c5dffaa',
                  transform: `translate(-50%,-50%) rotate(${angle}deg)`,
                  pointerEvents: 'none',
                }} />
              )
            }

            if (tt === 'gatling') {
              // ⚡ Gatling — tiny fast tracer
              return (
                <div key={b.id} style={{
                  position: 'absolute',
                  left: b.x * cell, top: b.y * cell,
                  width: 10, height: 2,
                  background: 'linear-gradient(90deg, #00ff0d, #aaffaa)',
                  borderRadius: 1,
                  boxShadow: '0 0 5px 2px #00ff0d99',
                  transform: `translate(-50%,-50%) rotate(${angle}deg)`,
                  pointerEvents: 'none',
                }} />
              )
            }

            if (tt === 'slow') {
              // ❄️ Slow — icy orb with pulse
              return (
                <div key={b.id} style={{
                  position: 'absolute',
                  left: b.x * cell, top: b.y * cell,
                  width: 10, height: 10,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, #a0d8ff, #fb7185)',
                  boxShadow: '0 0 10px 4px #60a5fa99, 0 0 18px 6px #fb718544',
                  transform: 'translate(-50%,-50%)',
                  pointerEvents: 'none',
                }} />
              )
            }

            if (tt === 'aoe') {
              // 💥 AOE — pulsing yellow orb
              return (
                <div key={b.id} style={{
                  position: 'absolute',
                  left: b.x * cell, top: b.y * cell,
                  width: 12, height: 12,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, #fff176, #ffd666)',
                  boxShadow: '0 0 12px 5px #ffd66699, 0 0 22px 8px #ff990044',
                  transform: 'translate(-50%,-50%)',
                  pointerEvents: 'none',
                }} />
              )
            }

            if (tt === 'burst') {
              // 🔥 Burst — big orange blast bolt
              return (
                <div key={b.id} style={{
                  position: 'absolute',
                  left: b.x * cell, top: b.y * cell,
                  width: 16, height: 5,
                  background: 'linear-gradient(90deg, #f99b45, #fff)',
                  borderRadius: '40% 60% 60% 40%',
                  boxShadow: '0 0 14px 5px #f99b4599',
                  transform: `translate(-50%,-50%) rotate(${angle}deg)`,
                  pointerEvents: 'none',
                }} />
              )
            }

            // Default (fast / unknown) — glowing dot
            const sz = 8
            return (
              <div key={b.id} style={{
                position: 'absolute',
                left: b.x * cell, top: b.y * cell,
                width: sz, height: sz,
                borderRadius: '50%',
                background: b.color,
                boxShadow: `0 0 8px 3px ${b.color}`,
                transform: 'translate(-50%,-50%)',
                pointerEvents: 'none',
              }} />
            )
          })}

          {/* Particles */}
          {renderedParticles.map((p, idx) => {
            const styles: Record<ParticleType, { color: string; glow: string; size: number }> = {
              death: { color: '#ff6b6b', glow: '#ff6b6bcc', size: 6 },
              build: { color: '#18e6c4', glow: '#18e6c4cc', size: 6 },
              sell: { color: '#ffd666', glow: '#ffd666cc', size: 6 },
              gold: { color: '#ffd666', glow: '#ffd666cc', size: 6 },
              impact: { color: '#f8fafc', glow: '#f59e0bcc', size: 4 },
              freeze: { color: '#d8f3ff', glow: '#7dd3fccc', size: 5 },
              burst: { color: '#ff1493', glow: '#ff1493dd', size: 5 },
              ember: { color: '#ff6b35', glow: '#ff6b35bb', size: 4 },
              spark: { color: '#ffff00', glow: '#ffff00ee', size: 3 },
            }
            const style = styles[p.type]
            const progress = p.life / p.maxLife
            let opacity = Math.max(0, 1 - progress)
            let scale = 1
            
            if (p.type === 'impact') {
              scale = 1.15 - progress * 0.5
            } else if (p.type === 'spark') {
              // Sparks fade and shrink fast
              scale = 1 - progress * 0.8
              opacity *= 1.2
            } else if (p.type === 'burst') {
              // Bursts pulse outward then fade
              scale = 0.7 + progress * 0.5
            } else if (p.type === 'ember') {
              // Embers glow brighter then fade
              scale = 1 - progress * 0.2
            } else {
              scale = 1 - progress * 0.35
            }
            
            return (
              <div key={`p-${idx}`} style={{
                position: 'absolute',
                left: p.x * cell, top: p.y * cell,
                width: style.size, height: style.size,
                borderRadius: '50%',
                background: style.color,
                boxShadow: isMobileViewport ? `0 0 ${3 + (1 - progress) * 2}px ${style.glow}` : `0 0 ${6 + (1 - progress) * 4}px ${style.glow}`,
                opacity: Math.min(1, opacity),
                transform: `translate(-50%, -50%) scale(${scale})`,
                pointerEvents: 'none',
              }} />
            )
          })}

          {/* Floating text (gold, rewards) */}
          {uiFloatingText.map((t, idx) => {
            const progress = t.time / t.maxTime
            const opacity = Math.max(0, 1 - progress)
            return (
              <div key={`ft-${idx}`} style={{
                position: 'absolute',
                left: t.x * cell, top: t.y * cell,
                color: t.color,
                fontWeight: 700,
                fontSize: '0.9rem',
                opacity,
                transform: `translate(-50%, -50%) translateY(${-progress * 30}px)`,
                pointerEvents: 'none',
                textShadow: '0 0 4px #00000099',
              }}>{t.text}</div>
            )
          })}

          {/* Explosion effects */}
          {renderedExplosions.map((exp, idx) => {
            const progress = exp.time / exp.maxTime
            const scale = 1 + progress * 0.3
            const opacity = Math.max(0, 1 - progress)
            const colors = {
              aoe: { inner: '#ffd66688', outer: '#ffd666' },
              rocket: { inner: '#ff444488', outer: '#ff0000' },
              heavy: { inner: '#ff880044', outer: '#ff8800' },
              dreadnought: { inner: '#f43f5e66', outer: '#f43f5e' },
            }
            const color = colors[exp.type]
            return (
              <div key={`exp-${idx}-${exp.time}`} style={{
                position: 'absolute',
                left: exp.x * cell - (exp.radius * cell * scale) / 2,
                top: exp.y * cell - (exp.radius * cell * scale) / 2,
                width: exp.radius * cell * scale,
                height: exp.radius * cell * scale,
                borderRadius: '50%',
                border: `3px solid ${color.outer}`,
                background: color.inner,
                boxShadow: `inset 0 0 ${12 * scale}px ${color.outer}99, 0 0 ${20 * scale}px ${color.outer}`,
                opacity,
                pointerEvents: 'none',
                transition: 'none',
              }} />
            )
          })}

          {/* Shockwave effects */}
          {renderedShockwaves.map((wave, idx) => {
            const scale = 1 + (1 - wave.intensity) * 0.5
            const opacity = wave.intensity * 0.7
            const thickness = 2 + wave.intensity * 3
            return (
              <div key={`wave-${idx}`} style={{
                position: 'absolute',
                left: wave.x * cell - (wave.radius * cell * scale) / 2,
                top: wave.y * cell - (wave.radius * cell * scale) / 2,
                width: wave.radius * cell * scale,
                height: wave.radius * cell * scale,
                borderRadius: '50%',
                border: `${thickness}px solid rgba(255, 200, 100, ${opacity})`,
                boxShadow: `0 0 ${15 * wave.intensity}px rgba(255, 150, 50, ${opacity * 0.8}), inset 0 0 ${10 * wave.intensity}px rgba(255, 200, 100, ${opacity * 0.5})`,
                pointerEvents: 'none',
                transition: 'none',
              }} />
            )
          })}

          {/* Tower destroy flash */}
          {destroyFlash && (() => {
            const [fc, fr] = destroyFlash.split(',').map(Number)
            return (
              <div style={{
                position: 'absolute',
                left: fc * cell, top: fr * cell,
                width: cell, height: cell,
                background: '#cc00ff44',
                border: '3px solid #cc00ff',
                borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: cell * 0.5,
                pointerEvents: 'none',
                zIndex: 5,
              }}>💥</div>
            )
          })()}

          {/* Overlay: stage_complete */}
          {uiState === 'stage_complete' && (
            <div style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.80)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
              zIndex: 130,
              pointerEvents: 'auto',
            }} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
              {uiEndless
                ? <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ff8800' }}>🔥 Endless Stage {uiStage} Clear!</div>
                : <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#ffd666' }}>🏅 Stage {uiStage} Complete!</div>}
              <div style={{ color: '#ddd', fontSize: '0.95rem', textAlign: 'center', padding: '0 20px' }}>
                Gold carries over · Towers on new path refunded 70%{uiEndless ? <><br/><span style={{color:'#ff8800'}}>Enemies keep scaling… can you hold?</span></> : <><br/>A new path awaits you…</>}
              </div>
              <button onClick={(e) => { e.stopPropagation(); advanceStage() }} style={btnStyle(uiEndless ? '#ff8800' : '#18e6c4', '#000', true)}>
                {uiEndless ? `🔥 Endless Stage ${uiStage + 1} →` : `Enter Stage ${uiStage + 1} →`}
              </button>
            </div>
          )}

          {/* Spawn portals */}
          {renderedPortals.map((portal, idx) => {
            const progress = portal.time / portal.maxTime
            const scale = 1 + progress * 0.8
            const opacity = Math.max(0, 1 - progress * 1.5)
            return (
              <div key={`portal-${idx}`} style={{
                position: 'absolute',
                left: portal.x * cell - (cell * scale) / 2,
                top: portal.y * cell - (cell * scale) / 2,
                width: cell * scale,
                height: cell * scale,
                borderRadius: '50%',
                border: `2px solid #18e6c4`,
                background: 'radial-gradient(circle, #18e6c466, transparent)',
                boxShadow: `0 0 20px 8px #18e6c4${Math.round(opacity * 100).toString(16)}`,
                pointerEvents: 'none',
                opacity,
              }} />
            )
          })}

          {/* Tower action bursts (upgrade/sell) */}
          {renderedActionBursts.map((burst, idx) => {
            const progress = burst.time / burst.maxTime
            const particles = burst.type === 'upgrade' ? 6 : 8
            return Array.from({ length: particles }).map((_, pi) => {
              const angle = (Math.PI * 2 * pi) / particles + progress * Math.PI * 4
              const radius = progress * (cell * 1.5)
              const opacity = Math.max(0, 1 - progress)
              const color = burst.type === 'upgrade' ? '#7c5dff' : '#ffd666'
              return (
                <div key={`burst-${idx}-${pi}`} style={{
                  position: 'absolute',
                  left: burst.x * cell + Math.cos(angle) * radius - 4,
                  top: burst.y * cell + Math.sin(angle) * radius - 4,
                  width: 8, height: 8,
                  borderRadius: '50%',
                  background: color,
                  boxShadow: `0 0 8px ${color}`,
                  pointerEvents: 'none',
                  opacity,
                }} />
              )
            })
          }).flat()}

          {/* Coin flow effects */}
          {renderedCoinFlows.map((flow, idx) => {
            const progress = Math.min(flow.time / flow.maxTime, 1)
            const easeProgress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2
            const x = flow.fromX + (flow.toX - flow.fromX) * easeProgress
            const y = flow.fromY + (flow.toY - flow.fromY) * easeProgress
            const opacity = Math.max(0, 1 - progress * 1.5)
            return (
              <div key={`coinflow-${idx}`} style={{
                position: 'absolute',
                left: x * cell - 8,
                top: y * cell - 8,
                width: 16, height: 16,
                borderRadius: '50%',
                background: 'radial-gradient(circle, #ffd666, #ff9800)',
                boxShadow: '0 0 12px #ffd666aa',
                pointerEvents: 'none',
                opacity,
                fontSize: '0.7rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                color: '#000',
              }}>$</div>
            )
          })}

          {/* Wave announcement overlay */}
          {waveAnnouncement && (() => {
            const progress = Math.min(waveAnnouncement.time / waveAnnouncement.maxTime, 1)
            const scale = 1.08 - progress * 0.12
            const opacity = progress > 0.72 ? (1 - (progress - 0.72) / 0.28) : 1
            return (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}>
                <div style={{
                  fontSize: '3rem',
                  fontWeight: 900,
                  color: '#18e6c4',
                  textShadow: `0 0 30px #18e6c4`,
                  opacity,
                  transform: `scale(${scale})`,
                  transformOrigin: 'center',
                }}>
                  WAVE {waveAnnouncement.wave}
                </div>
              </div>
            )
          })()}

          {/* Screen flash effect */}
          {screenFlashState > 0 && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: `rgba(255,255,255,${screenFlashState * 0.6})`,
              pointerEvents: 'none',
            }} />
          )}

          {/* Boss screen flash effect (blue) */}
          {bossScreenFlashState > 0 && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: `rgba(100,200,255,${bossScreenFlashState * 0.4})`,
              pointerEvents: 'none',
            }} />
          )}

          {/* Boss lightning effect */}
          {uiBossLightning.length > 0 && (
            <svg style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
            }}>
              {uiBossLightning.map((lightning, idx) => {
                const progress = lightning.time / lightning.maxTime
                const opacity = Math.max(0, 1 - progress * 1.5)
                const x1 = lightning.fromX * cell
                const y1 = lightning.fromY * cell
                const x2 = lightning.toX * cell
                const y2 = lightning.toY * cell
                
                // Generate jagged lightning path
                const dx = x2 - x1
                const dy = y2 - y1
                const dist = Math.sqrt(dx * dx + dy * dy)
                const segments = Math.floor(dist / 30) + 2
                let path = `M ${x1} ${y1}`
                const seed = idx * 12345 + Math.floor(progress * 100)
                
                for (let i = 1; i < segments; i++) {
                  const t = i / segments
                  const baseX = x1 + dx * t
                  const baseY = y1 + dy * t
                  // Pseudo-random offset
                  const rand = Math.sin(seed + i * 47) * 0.5
                  const offsetX = dy / dist * 20 * rand
                  const offsetY = -dx / dist * 20 * rand
                  const nextX = baseX + offsetX
                  const nextY = baseY + offsetY
                  path += ` L ${nextX} ${nextY}`
                }
                path += ` L ${x2} ${y2}`
                
                return (
                  <g key={`lightning-${idx}`} opacity={opacity}>
                    <path
                      d={path}
                      stroke="#64c8ff"
                      strokeWidth="3"
                      fill="none"
                      strokeLinecap="round"
                      filter="url(#lightningGlow)"
                    />
                    <path
                      d={path}
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      fill="none"
                      strokeLinecap="round"
                      opacity={opacity * 0.8}
                    />
                  </g>
                )
              })}
              <defs>
                <filter id="lightningGlow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
            </svg>
          )}

          {/* Stage transition overlay */}
          {stageTransitionState && (() => {
            const { phase, progress } = stageTransitionState
            const fadeOpacity = phase === 'fade' ? progress : phase === 'show' ? 1 : phase === 'in' ? Math.max(0, 1 - progress) : 0
            const textOpacity = phase === 'show' ? 1 : phase === 'fade' ? 0 : 1 - progress
            return (
              <>
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: `rgba(0,0,0,${fadeOpacity})`,
                  pointerEvents: 'none',
                }} />
                {(phase === 'show' || phase === 'in') && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                  }}>
                    <div style={{
                      fontSize: '2.2rem',
                      fontWeight: 900,
                      color: '#18e6c4',
                      textShadow: '0 0 20px #18e6c4',
                      opacity: textOpacity,
                      marginBottom: 16,
                    }}>
                      STAGE {uiStage}
                    </div>
                    <div style={{
                      fontSize: '1.2rem',
                      color: '#ffd666',
                      textShadow: '0 0 10px #ffd666',
                      opacity: textOpacity,
                    }}>
                      Get Ready!
                    </div>
                  </div>
                )}
              </>
            )
          })()}

          {/* Victory effect confetti */}
          {victoryEffect && Array.from({ length: victoryConfettiCount }).map((_, idx) => {
            const angle = (Math.PI * 2 * idx) / victoryConfettiCount + (Math.random() - 0.5) * 0.5
            const distance = (victoryEffect.time / victoryEffect.maxTime) * (cell * ROWS)
            const x = (boardW / 2) + Math.cos(angle) * distance
            const y = -50 + (victoryEffect.time / victoryEffect.maxTime) * (boardH + 100)
            const opacity = victoryEffect.time < victoryEffect.maxTime * 0.2 ? 1 : Math.max(0, 1 - (victoryEffect.time - victoryEffect.maxTime * 0.2) / (victoryEffect.maxTime * 0.8))
            const colors = ['#18e6c4', '#ffd666', '#fb7185', '#7c5dff', '#ff8800']
            const color = colors[idx % colors.length]
            return (
              <div key={`confetti-${idx}`} style={{
                position: 'absolute',
                left: x,
                top: y,
                width: 12, height: 12,
                background: color,
                borderRadius: '50%',
                boxShadow: `0 0 10px ${color}`,
                pointerEvents: 'none',
                opacity,
              }} />
            )
          })}

          {/* Overlay: gameover / victory */}
          {isOver && (
            <div style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
              zIndex: 135,
              pointerEvents: 'auto',
            }} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 14,
                pointerEvents: 'auto',
              }}>
                {uiState === 'victory' ? (
                  <>
                    <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#18e6c4' }}>🏆 VICTORY!</div>
                    <div style={{ color: '#ddd', fontSize: '0.95rem' }}>All 10 stages conquered!</div>
                    <div style={{ color: '#ffd666', fontWeight: 800, fontSize: '1.1rem' }}>Score: {uiScore.toLocaleString()}</div>
                    <div style={{ color: '#aaa', fontSize: '0.85rem' }}>Best: {uiHighScore.toLocaleString()}</div>
                    <button type="button" onClick={restart} style={btnStyle('#18e6c4', '#000', true)}>↺ Play Again</button>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fb7185' }}>💥 GAME OVER</div>
                    <div style={{ color: '#ddd', fontSize: '1.1rem' }}>Score: <b style={{ color: '#ffd666' }}>{uiScore.toLocaleString()}</b></div>
                    <div style={{ color: '#aaa', fontSize: '0.9rem' }}>Best: {uiHighScore.toLocaleString()}</div>
                    <button type="button" onClick={restart} style={btnStyle('#18e6c4', '#000', true)}>↺ Play Again</button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ flex: isCompact ? 1 : isLandscapeMobile ? 1 : '0 0 auto', minWidth: isCompact ? boardW : 0, width: isCompact ? boardW : undefined, display: 'flex', flexDirection: 'column', gap: isCompact ? 3 : 6, minHeight: 0, overflow: 'hidden', maxHeight: isLandscapeMobile ? boardH : undefined, overflowY: isLandscapeMobile ? 'auto' : undefined }}>
          {(!isCompact && !isLandscapeMobile) && <div style={{ color: '#aaa', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Deploy Ship</div>}
          <div style={{ display: 'grid', gridTemplateColumns: compactTowerShop ? 'repeat(5,minmax(0,1fr))' : isLandscapeMobile ? 'repeat(2,minmax(0,1fr))' : '1fr', gridTemplateRows: compactTowerShop ? 'repeat(2, 58px)' : undefined, gap: isCompact ? 4 : 5, flex: compactTowerShop ? '0 0 auto' : isCompact ? 1 : undefined, minHeight: isCompact ? 0 : undefined }}>
            {TOWER_TYPES.map(t => {
              const isDreadnoughtCapped = t.key === 'dreadnought' && dreadnoughtLimitReached
              return (
              <button
                key={t.key}
                onClick={() => {
                  if (isDreadnoughtCapped && selectedTowerKey !== t.key) {
                    playGameSound('hit')
                    setSelectedTowerOnGrid(null)
                    return
                  }
                  setSelectedTowerKey(prev => prev === t.key ? null : t.key as TowerKey)
                  setSelectedTowerOnGrid(null)
                }}
                style={{
                  background: selectedTowerKey === t.key ? t.color + '33' : '#111',
                  border: `2px solid ${selectedTowerKey === t.key ? t.color : '#333'}`,
                  borderRadius: 8,
                  padding: compactTowerShop ? '3px 4px' : isCompact ? '4px 5px' : '6px 7px',
                  cursor: isDreadnoughtCapped && selectedTowerKey !== t.key ? 'not-allowed' : 'pointer',
                  color: '#fff',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                  height: isCompact ? '100%' : undefined,
                  boxSizing: 'border-box',
                  opacity: isDreadnoughtCapped && selectedTowerKey !== t.key ? 0.55 : 1,
                }}
              >
                {isCompact ? (
                  /* Portrait compact: icon centred, name + cost + desc stacked */
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: compactTowerShop ? 1 : 2, height: '100%', width: '100%' }}>
                    <div style={{
                      width: compactTowerShop ? 24 : 28, height: compactTowerShop ? 24 : 28, borderRadius: 8,
                      border: `1px solid ${t.color}55`,
                      background: 'linear-gradient(180deg,#182330,#0a0f18)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, boxShadow: `inset 0 0 10px ${t.color}18`,
                    }}>
                      <TowerShip tType={t.key} color={t.color} size={compactTowerShop ? 16 : 18} />
                    </div>
                    <span style={{ fontWeight: 800, color: t.color, fontSize: compactTowerShop ? '0.55rem' : '0.68rem', textAlign: 'center', lineHeight: 1.05, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</span>
                    <span style={{ color: '#ffd666', fontSize: compactTowerShop ? '0.52rem' : '0.62rem', fontWeight: 700, lineHeight: 1 }}>{t.key === 'dreadnought' ? `${t.cost} ${dreadnoughtFieldCount}/${DREADNOUGHT_FIELD_LIMIT}` : t.cost}</span>
                    {!compactTowerShop && <span style={{ color: '#888', fontSize: '0.55rem', textAlign: 'center', lineHeight: 1.2, width: '100%', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{t.desc}</span>}
                  </div>
                ) : (
                  /* Landscape mobile (2-col) and desktop (1-col): icon left, name + cost + desc on right */
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: isLandscapeMobile ? 32 : 44, height: isLandscapeMobile ? 32 : 44, borderRadius: 10,
                      border: `1px solid ${t.color}55`,
                      background: 'linear-gradient(180deg,#182330,#0a0f18)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, boxShadow: `inset 0 0 14px ${t.color}18`,
                    }}>
                      <TowerShip tType={t.key} color={t.color} size={isLandscapeMobile ? 22 : 32} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontWeight: 800, color: t.color, fontSize: isLandscapeMobile ? '0.76rem' : '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.label}</span>
                        <span style={{ color: '#ffd666', fontSize: isLandscapeMobile ? '0.68rem' : '0.76rem', whiteSpace: 'nowrap', flexShrink: 0 }}>CR {t.cost}{t.key === 'dreadnought' ? ` | ${dreadnoughtFieldCount}/${DREADNOUGHT_FIELD_LIMIT}` : ''}</span>
                      </div>
                      <div style={{ color: '#888', fontSize: isLandscapeMobile ? '0.62rem' : '0.7rem', marginTop: 2, lineHeight: 1.3, whiteSpace: isLandscapeMobile ? 'nowrap' : undefined, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.desc}</div>
                    </div>
                  </div>
                )}
              </button>
              )
            })}
          </div>

          {isCompact && (
            <div style={{
              minHeight: 42,
              borderRadius: 7,
              border: `1px solid ${selectedTowerDef ? selectedTowerDef.color + '88' : '#2f4b40'}`,
              background: selectedTowerDef ? `${selectedTowerDef.color}14` : '#0b1511',
              padding: '6px 8px',
              display: 'grid',
              gridTemplateColumns: selectedTowerDef ? '32px 1fr auto' : '1fr',
              alignItems: 'center',
              gap: 8,
              boxShadow: 'inset 0 0 0 1px #00000088',
            }}>
              {selectedTowerDef ? (
                <>
                  <div style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    border: `1px solid ${selectedTowerDef.color}66`,
                    background: 'linear-gradient(180deg,#182330,#0a0f18)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <TowerShip tType={selectedTowerDef.key} color={selectedTowerDef.color} size={20} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: selectedTowerDef.color, fontSize: '0.68rem', fontWeight: 900, lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {selectedTowerDef.label}
                    </div>
                    <div style={{ color: '#a8b7c4', fontSize: '0.58rem', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {selectedTowerDef.desc}
                    </div>
                  </div>
                  <div style={{ color: '#ffd666', fontSize: '0.62rem', fontWeight: 900, whiteSpace: 'nowrap' }}>CR {selectedTowerDef.cost}</div>
                </>
              ) : (
                <div style={{ color: '#7f958a', fontSize: '0.64rem', fontWeight: 800, textAlign: 'center' }}>Select a ship to view its role and cost</div>
              )}
            </div>
          )}

          {isCompact && (
            <div style={{
              flex: 1,
              minHeight: 118,
              marginTop: 4,
              borderRadius: 8,
              border: '1px solid #2f5f74',
              background: 'linear-gradient(135deg,#07131f 0%,#0b2019 58%,#07110d 100%)',
              boxShadow: 'inset 0 0 0 1px #000000aa, inset 0 0 28px #38bdf81a',
              display: 'grid',
              gridTemplateColumns: '96px 1fr',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              overflow: 'hidden',
              position: 'relative',
            }}>
              <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, transparent 0 9px, #38bdf80d 9px 10px)', pointerEvents: 'none' }} />
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <EarthHQIcon size={82} />
              </div>
              <div style={{ position: 'relative', minWidth: 0 }}>
                <div style={{ color: '#dff7ff', fontWeight: 900, fontSize: '0.86rem', letterSpacing: 1, textShadow: '0 0 10px #38bdf866' }}>EARTH ORBITAL HQ</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 5, marginTop: 8 }}>
                  <div style={{ color: '#9cc3b3', fontSize: '0.62rem', fontWeight: 800 }}>LEVEL <b style={{ color: '#ffd666' }}>{uiHqLevel}</b>/{HQ_MAX_LEVEL}</div>
                  <div style={{ color: '#9cc3b3', fontSize: '0.62rem', fontWeight: 800 }}>HULL <b style={{ color: '#fb7185' }}>{uiLives}</b>/{hqMaxLives}</div>
                  <div style={{ color: '#9cc3b3', fontSize: '0.62rem', fontWeight: 800 }}>MODE <b style={{ color: uiEndless ? '#ff8800' : '#18e6c4' }}>{uiEndless ? 'ENDLESS' : 'NORMAL'}</b></div>
                  <div style={{ color: '#9cc3b3', fontSize: '0.62rem', fontWeight: 800 }}>NEXT <b style={{ color: isBossNextWave ? '#ffb4b4' : '#8bffdf' }}>{isBossNextWave ? 'BOSS' : 'WAVE'}</b></div>
                </div>
                <div style={{ marginTop: 8, height: 7, borderRadius: 4, background: '#081018', border: '1px solid #24445c', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(0, Math.min(100, (uiLives / hqMaxLives) * 100))}%`, height: '100%', background: 'linear-gradient(90deg,#fb7185,#ffd666,#7dd3fc)', boxShadow: '0 0 10px #7dd3fc88' }} />
                </div>
              </div>
            </div>
          )}

          {selectedTowerOnGrid && !isCompact && !isLandscapeMobile && (
            <div style={{ marginTop: 8, background: '#111', border: `2px solid ${selectedTowerOnGrid.towerDef.color}`, borderRadius: 8, padding: 10 }}>
              <div style={{ color: selectedTowerOnGrid.towerDef.color, fontWeight: 800, fontSize: '0.9rem' }}>{selectedTowerOnGrid.towerDef.label} Lv{selectedTowerOnGrid.level}</div>
              <div style={{ color: '#aaa', fontSize: '0.75rem', margin: '4px 0' }}>DMG: {(selectedTowerOnGrid.towerDef.dmg * (1 + (selectedTowerOnGrid.level - 1) * 0.5)).toFixed(0)} | Range: {selectedTowerOnGrid.towerDef.range}</div>
              {getTowerSynergy(selectedTowerOnGrid).active && (
                <div style={{ color: '#8bffdf', fontSize: '0.7rem', fontWeight: 800, marginBottom: 4 }}>SYNERGY ONLINE</div>
              )}
              {selectedTowerOnGrid.type === 'dreadnought' && (
                <div style={{ color: '#fda4af', fontSize: '0.7rem', fontWeight: 800, marginBottom: 4 }}>DRONES: {getDreadnoughtScoutCount(selectedTowerOnGrid)} | ACTIVE {getDreadnoughtScoutAttackTime(selectedTowerOnGrid).toFixed(1)}s</div>
              )}
              {selectedTowerOnGrid.level < MAX_TOWER_LEVEL ? (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ color: '#8fb9ad', fontSize: '0.68rem', marginBottom: 3 }}>Auto EXP: {selectedTowerOnGrid.xp.toFixed(1)} / {xpNeededForNextLevel(selectedTowerOnGrid.level)}</div>
                  <div style={{ width: '100%', height: 6, borderRadius: 3, background: '#1a2430', border: '1px solid #324254' }}>
                    <div style={{ width: `${Math.max(0, Math.min(100, (selectedTowerOnGrid.xp / xpNeededForNextLevel(selectedTowerOnGrid.level)) * 100))}%`, height: '100%', borderRadius: 3, background: 'linear-gradient(90deg,#18e6c4,#8bffdf)' }} />
                  </div>
                </div>
              ) : (
                <div style={{ color: '#ffd666', fontSize: '0.7rem', fontWeight: 700, marginBottom: 4 }}>MAX LEVEL</div>
              )}
              <div style={{ color: '#7b8797', fontSize: '0.72rem' }}>
                Use the board icons above the tower to upgrade or sell quickly.
              </div>
            </div>
          )}

          {!isCompact && !isLandscapeMobile && (
            <div style={{ marginTop: 'auto', color: '#6f7e76', fontSize: '0.7rem', lineHeight: 1.45 }}>
              <div>• Tap empty cell to deploy</div>
              <div>• Drag ship to reposition (mouse or touch)</div>
              <div>• Aliens reaching HQ cost lives</div>
              <div>• Wave 5 is boss wave, stage 10 is all bosses</div>
              <div>• Endless mode is launched from the title screen</div>
            </div>
          )}
        </div>
      </div>

      {showSettingsModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.58)',
          zIndex: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 10,
        }} onMouseDown={() => setShowSettingsModal(false)}>
          <div style={{
            width: '100%',
            maxWidth: 560,
            maxHeight: 'min(88vh, 760px)',
            overflowY: 'auto',
            background: 'linear-gradient(180deg,#101826,#090f1a)',
            border: '1px solid #3f4f63',
            borderRadius: 10,
            boxShadow: '0 12px 28px #00000099',
            padding: 14,
            color: '#d7dde5',
          }} onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: '0.98rem', fontWeight: 900, letterSpacing: 1.1, color: '#d7ecff' }}>GAME SETTINGS</div>
              <button type="button" onClick={() => setShowSettingsModal(false)} style={btnStyle('#2f3c4f', '#dce7f7', true)}>CLOSE</button>
            </div>

            <div style={{ marginBottom: 12, background: '#0f1727', border: '1px solid #2f3b53', borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#9fc7ff', marginBottom: 8 }}>LAYOUT MODE</div>
              <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'repeat(3, minmax(0,1fr))', gap: 8 }}>
                {([
                  { key: 'auto', label: 'AUTO', desc: 'Match device orientation' },
                  { key: 'portrait', label: 'PORTRAIT', desc: 'Board on top, shop below' },
                  { key: 'landscape', label: 'LANDSCAPE', desc: 'Bigger board, shop on right' },
                ] as const).map(mode => (
                  <button
                    key={mode.key}
                    type="button"
                    onClick={() => { void applyMobileLayoutMode(mode.key) }}
                    style={{
                      border: `1px solid ${mobileLayoutMode === mode.key ? '#75b8ff' : '#30435e'}`,
                      background: mobileLayoutMode === mode.key ? '#1c2f4a' : '#121c2c',
                      color: mobileLayoutMode === mode.key ? '#dff0ff' : '#adc1d8',
                      borderRadius: 8,
                      padding: '8px 9px',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: '0.76rem', fontWeight: 800, letterSpacing: 0.5 }}>{mode.label}</div>
                    <div style={{ fontSize: '0.67rem', opacity: 0.8, marginTop: 2 }}>{mode.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 12, color: '#8fa6bf', fontSize: '0.66rem', lineHeight: 1.45 }}>
              Orientation lock is best-effort on mobile browsers and depends on device/browser support.
            </div>

            <div style={{ marginBottom: 12, background: '#0f1727', border: '1px solid #2f3b53', borderRadius: 8, padding: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#9ff2cc' }}>AUDIO</div>
                <button type="button" onClick={toggleSound} style={btnStyle('#102b20', '#9ef2cc', true)}>{soundOn ? 'SFX ON' : 'SFX OFF'}</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'repeat(2,minmax(0,1fr))', gap: 8, marginTop: 8 }}>
                {([
                  { key: 'bgm', label: 'BGM', color: '#7dd3fc' },
                  { key: 'explosion', label: 'EXPLOSIONS', color: '#fb923c' },
                  { key: 'beam', label: 'BEAMS', color: '#22d3ee' },
                  { key: 'ui', label: 'UI', color: '#c4b5fd' },
                ] as const).map(control => (
                  <label key={control.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, color: '#d1d5db', fontSize: '0.72rem', letterSpacing: 0.8 }}>
                    <span style={{ color: control.color, fontWeight: 700 }}>{control.label}: {Math.round(audioMix[control.key] * 100)}%</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={audioMix[control.key]}
                      onChange={(e) => updateAudioMixSetting(control.key, Number(e.currentTarget.value))}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div style={{ color: '#8ca2bb', fontSize: '0.68rem', lineHeight: 1.5 }}>
              Changes are saved automatically and will persist next time you open the game.
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
