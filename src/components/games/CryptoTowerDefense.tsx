import { useCallback, useEffect, useRef, useState } from 'react'
import { getGameSoundEnabled, playGameSound, setGameSoundEnabled } from './sound'
import type { CoinOption } from './types'

// ─── Constants ────────────────────────────────────────────────────────────────
const COLS = 14
const ROWS = 10
const MAX_STAGES = 10
const WAVES_PER_STAGE = 5
const STORAGE_KEY = 'spaceImpactDefenseHighScore'
const ENDLESS_KEY = 'spaceImpactDefenseEndlessUnlocked'

// ─── Spawn point count per stage ──────────────────────────────────────────────
function spawnCountForStage(stage: number): number {
  if (stage >= 14) return 6
  if (stage >= 11) return 5
  if (stage >= 9) return 4
  if (stage >= 6) return 3
  if (stage >= 3) return 2
  return 1
}

// ─── Path generator — unique multi-spawn Y-shaped paths per stage ─────────────
// Returns array of full paths (branch + shared trunk), one per spawn point.
// All paths converge at a merge column then share the same trunk to the finish.
function generatePaths(stage: number): [number, number][][] {
  const numSpawns = spawnCountForStage(stage)

  // deterministic seeded RNG
  let s = (stage + 3) * 69069 + 1
  const rng = () => { s = ((s * 1664525) + 1013904223) >>> 0; return s / 0x100000000 }
  const ri = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1))

  const MERGE_COL = 7   // all branches converge here
  const FINISH_COL = 13

  // ── Build shared trunk: merge col → finish ──────────────────────────────
  // Anchor rows for trunk
  const trunkAnchCols = [MERGE_COL, 10, FINISH_COL]
  const trunkAnchRows: number[] = [ri(2, 7)]
  trunkAnchRows.push(trunkAnchRows[0] <= 5 ? ri(6, 8) : ri(1, 3))
  trunkAnchRows.push(ri(2, 7))

  const trunk: [number, number][] = []
  const trunkUsed = new Set<string>()
  const addT = (c: number, r: number) => {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return
    const k = `${c},${r}`
    if (!trunkUsed.has(k)) { trunk.push([c, r]); trunkUsed.add(k) }
  }
  for (let seg = 0; seg < trunkAnchCols.length - 1; seg++) {
    const c0 = trunkAnchCols[seg], r0 = trunkAnchRows[seg]
    const c1 = trunkAnchCols[seg + 1], r1 = trunkAnchRows[seg + 1]
    if (seg === 0) addT(c0, r0)
    for (let c = c0 + 1; c <= c1; c++) addT(c, r0)
    const dr = r1 > r0 ? 1 : -1
    if (r1 !== r0) for (let r = r0 + dr; dr > 0 ? r <= r1 : r >= r1; r += dr) addT(c1, r)
  }
  const mergeRow = trunk[0][1]  // row at which branches must arrive

  // ── Build each branch: spawn → merge point ─────────────────────────────
  // Distribute spawn rows evenly
  const spawnRows: number[] = []
  if (numSpawns === 1) {
    spawnRows.push(mergeRow)  // single path — spawn aligns with merge
  } else {
    const step = Math.floor((ROWS - 2) / (numSpawns - 1))
    for (let i = 0; i < numSpawns; i++) spawnRows.push(1 + i * step)
  }

  const allPaths: [number, number][][] = []
  for (let sp = 0; sp < numSpawns; sp++) {
    const spawnRow = spawnRows[sp]
    const branch: [number, number][] = []
    const bUsed = new Set<string>()
    const addB = (c: number, r: number) => {
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return
      const k = `${c},${r}`
      if (!bUsed.has(k)) { branch.push([c, r]); bUsed.add(k) }
    }

    // Meander from col 0 at spawnRow → to col MERGE_COL at mergeRow
    // Multiple bends for increased complexity
    const minBendRow = Math.max(0, Math.min(spawnRow, mergeRow) - 1)
    const maxBendRow = Math.min(ROWS - 1, Math.max(spawnRow, mergeRow) + 1)
    const bend1Col = ri(2, 4)
    const bend1Row = ri(minBendRow, maxBendRow)
    const bend2Col = ri(5, 6)
    const bend2Row = ri(minBendRow, maxBendRow)
    
    addB(0, spawnRow)
    // walk right to bend1Col at spawnRow
    for (let c = 1; c <= bend1Col; c++) addB(c, spawnRow)
    // walk vertically to bend1Row at bend1Col
    if (bend1Row !== spawnRow) {
      const dr = bend1Row > spawnRow ? 1 : -1
      for (let r = spawnRow + dr; dr > 0 ? r <= bend1Row : r >= bend1Row; r += dr) addB(bend1Col, r)
    }
    // walk right from bend1Col to bend2Col at bend1Row
    for (let c = bend1Col + 1; c <= bend2Col; c++) addB(c, bend1Row)
    // walk vertically to bend2Row at bend2Col
    if (bend2Row !== bend1Row) {
      const dr = bend2Row > bend1Row ? 1 : -1
      for (let r = bend1Row + dr; dr > 0 ? r <= bend2Row : r >= bend2Row; r += dr) addB(bend2Col, r)
    }
    // walk right from bend2Col to MERGE_COL at bend2Row
    for (let c = bend2Col + 1; c <= MERGE_COL; c++) addB(c, bend2Row)
    // walk vertically to mergeRow at MERGE_COL if needed
    if (bend2Row !== mergeRow) {
      const dr = mergeRow > bend2Row ? 1 : -1
      for (let r = bend2Row + dr; dr > 0 ? r <= mergeRow : r >= mergeRow; r += dr) addB(MERGE_COL, r)
    }

    // Full path = branch (excluding merge cell) + trunk
    // Remove the merge cell from branch end to avoid duplicate when appending trunk
    const branchWithoutMerge = branch.filter(([c, r]) => !(c === MERGE_COL && r === mergeRow))
    allPaths.push([...branchWithoutMerge, ...trunk])
  }

  return allPaths
}

// Legacy single-path wrapper (kept for reference)
// function generatePath(stage: number): [number, number][] {
//   return generatePaths(stage)[0]
// }

// Tower definitions: each type maps to a ship role
const TOWER_TYPES = [
  { key: 'fast',      label: 'Scout',    color: '#18e6c4', range: 2.0, dmg: 8,   rate: 0.5,  cost: 60,   desc: 'High fire rate, short range' },
  { key: 'sniper',    label: 'Rail Gun', color: '#7c5dff', range: 10,  dmg: 45,  rate: 3.5,  cost: 120,  desc: 'Long range, heavy piercing shot' },
  { key: 'aoe',       label: 'Bomber',   color: '#ffd666', range: 2.5, dmg: 20,  rate: 1.8,  cost: 100,  desc: 'Plasma splash, hits nearby aliens' },
  { key: 'slow',      label: 'Cryo',     color: '#fb7185', range: 2.8, dmg: 6,   rate: 1.2,  cost: 80,   desc: 'Freeze beam, slows aliens 50%' },
  { key: 'burst',     label: 'Cannon',   color: '#f99b45', range: 4.0, dmg: 170, rate: 5.0,  cost: 200,  desc: 'High burst, slow reload' },
  { key: 'gatling',   label: 'Gatling',  color: '#00ff0d', range: 4,   dmg: 4,   rate: 0.1,  cost: 400,  desc: 'Rapid-fire chain guns' },
  { key: 'rocket',    label: 'Rocket',   color: '#ff0000', range: 6,   dmg: 250, rate: 12.0, cost: 600,  desc: 'Massive AOE blast, 12s reload' },
  { key: 'laser',     label: 'Laser',    color: '#dbecff', range: 4.5, dmg: 3,   rate: 0.01, cost: 2000, desc: 'Beam 10s · exhaust 5s · 300 DPS pierce' },
  { key: 'artillery', label: 'Orbital',  color: '#ff8800', range: 999, dmg: 140, rate: 7.0,  cost: 3500, desc: 'Global range · 3 orbital strikes' },
] as const
type TowerKey = typeof TOWER_TYPES[number]['key']

// ─── Wave config (dynamic per stage + wave) ───────────────────────────────────
type WaveCfg = { count: number; hp: number; speed: number; reward: number; isBoss: boolean }

function getNormalWaveCfg(stage: number, wave: number): WaveCfg {
  const ss = 1 + (stage - 1) * 0.65   // stage HP scale (was 0.45)
  const ws = 1 + (wave  - 1) * 0.22   // wave HP scale  (was 0.18)
  return {
    count:  8 + wave * 2 + stage * 4,  // was 6 + wave*2 + stage*2
    hp:     Math.round(65 * ss * ws),
    speed:  Math.min(2.6, 0.9 + (stage - 1) * 0.16 + (wave - 1) * 0.05),
    reward: 12 + stage * 4 + wave * 2,
    isBoss: false,
  }
}

function getWaveCfg(stage: number, wave: number): WaveCfg {
  const isBoss = wave === WAVES_PER_STAGE || stage === MAX_STAGES
  const ss = 1 + (stage - 1) * 0.65   // stage HP scale (was 0.45)
  // Stage 10 final boss — slow but destroys towers
  if (isBoss && stage === MAX_STAGES) return {
    count:  3,
    hp:     22000,
    speed:  0.28,
    reward: 400,
    isBoss: true,
  }
  if (isBoss) return {
    count:  spawnCountForStage(stage),
    hp:     Math.round(2000 * ss),
    speed:  Math.max(0.5, 0.65 + (stage - 1) * 0.06),
    reward: 90 + stage * 20,
    isBoss: true,
  }
  return getNormalWaveCfg(stage, wave)
}

// ─── Types ────────────────────────────────────────────────────────────────────
let _eid = 1
let _tid = 1
let _bid = 1

type Enemy = {
  id: number
  pathIdx: number  // which path (0..numSpawns-1) this enemy follows
  pathIndex: number
  progress: number // 0..1 between pathIndex and pathIndex+1
  x: number; y: number
  hp: number; maxHp: number
  speed: number
  baseSpeed: number
  slowTimer: number
  reward: number
  coinImg: string
  isBoss: boolean
  destroyCooldown: number  // stage-10 boss: smashes nearby towers
  hitFlash: number  // time remaining to show red hit indicator
  dead: boolean
  leaked: boolean
}

type Tower = {
  id: number
  col: number; row: number
  type: TowerKey
  towerDef: typeof TOWER_TYPES[number]
  coin: CoinOption
  cooldown: number
  level: number
  burstQueue: { tx: number; ty: number; targetId: number; delay: number; dmg: number }[]
  laserActive: number   // seconds remaining in beam
  laserExhaust: number  // seconds remaining in exhaust (cooldown)
}

type Bullet = {
  id: number
  x: number; y: number
  tx: number; ty: number
  speed: number
  color: string
  targetId: number
  dmg: number
  isAoe: boolean
  isSlow: boolean
  isRocket: boolean
  isHeavy: boolean
  towerType: string
  dead: boolean
}

type GameState = 'idle' | 'playing' | 'wave' | 'stage_complete' | 'gameover' | 'victory'
type ParticleType = 'death' | 'build' | 'sell' | 'gold' | 'impact' | 'freeze'

// ─── Cell size calculation ─────────────────────────────────────────────────────
function calcCell() {
  if (typeof window === 'undefined') return 44
  const maxW = Math.min(window.innerWidth - 24, 900)
  return Math.floor(Math.max(28, Math.min(48, maxW / COLS)))
}

// ─── Lerp helper ──────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number) { return a + (b - a) * t }

function spawnImpactParticles(
  particles: {x: number; y: number; type: ParticleType; vx: number; vy: number; life: number; maxLife: number}[],
  x: number,
  y: number,
  type: 'impact' | 'freeze',
  count: number,
  speed: number,
  maxLife: number,
) {
  for (let i = 0; i < count; i++) {
    const angle = (-Math.PI / 2) + (Math.random() - 0.5) * 2.2
    const velocity = speed * (0.7 + Math.random() * 0.7)
    particles.push({
      x,
      y,
      type,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: 0,
      maxLife,
    })
  }
}

// ─── Enemy death helper with animations ────────────────────────────────────────
function triggerEnemyDeath(
  e: Enemy,
  towerType: string,
  isBoss: boolean,
  goldRef: { current: number },
  scoreRef: { current: number },
  particles: {x: number; y: number; type: ParticleType; vx: number; vy: number; life: number; maxLife: number}[],
  floatingText: {x: number; y: number; text: string; time: number; maxTime: number; color: string}[],
  screenFlashRef: React.MutableRefObject<{time: number; maxTime: number; intensity: number} | null>,
  coinFlowRef: React.MutableRefObject<{fromX: number; fromY: number; toX: number; toY: number; amount: number; time: number; maxTime: number}[]>,
  setScreenFlashState: (state: number) => void
) {
  e.dead = true
  goldRef.current += e.reward
  scoreRef.current += e.reward * 10

  // Death particles based on tower type
  const deathCount = towerType === 'rocket' ? 6 : towerType === 'aoe' ? 4 : towerType === 'artillery' ? 5 : 3
  for (let i = 0; i < deathCount; i++) {
    const angle = (Math.PI * 2 * i) / deathCount
    particles.push({
      x: e.x, y: e.y,
      type: 'death',
      vx: Math.cos(angle) * 1.8, vy: Math.sin(angle) * 1.8,
      life: 0, maxLife: 0.4
    })
  }

  // Floating text
  floatingText.push({ x: e.x, y: e.y, text: `+${e.reward}`, time: 0, maxTime: 2.0, color: '#ffd666' })

  // Screen flash on boss kill
  if (isBoss) {
    screenFlashRef.current = {time: 0, maxTime: 0.1, intensity: 1.0}
    setScreenFlashState(1.0)
  }

  // Coin flow animation
  coinFlowRef.current.push({
    fromX: e.x, fromY: e.y,
    toX: 14, toY: -0.5,  // top-right corner
    amount: e.reward,
    time: 0, maxTime: 0.6
  })
}

// ─── Tower Ship SVG ────────────────────────────────────────────────────────────
function TowerShip({ tType, color, size }: { tType: string; color: string; size: number }) {
  const s = size
  const c = color
  switch (tType) {
    case 'fast': return (
      <svg width={s} height={s} viewBox="0 0 32 32">
        <polygon points="16,2 30,18 22,22 16,28 10,22 2,18" fill={c} opacity="0.85"/>
        <rect x="14" y="2" width="4" height="11" rx="2" fill={c}/>
        <circle cx="16" cy="17" r="5" fill={c} opacity="0.45"/>
        <circle cx="16" cy="17" r="2.5" fill="white" opacity="0.35"/>
      </svg>
    )
    case 'sniper': return (
      <svg width={s} height={s} viewBox="0 0 32 32">
        <polygon points="16,4 24,16 16,28 8,16" fill={c} opacity="0.8"/>
        <rect x="14" y="0" width="4" height="22" rx="1.5" fill={c}/>
        <rect x="13" y="0" width="6" height="4" rx="1" fill={c}/>
        <circle cx="16" cy="20" r="4" fill={c} opacity="0.45"/>
        <circle cx="16" cy="20" r="2" fill="white" opacity="0.4"/>
      </svg>
    )
    case 'aoe': return (
      <svg width={s} height={s} viewBox="0 0 32 32">
        <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" fill={c} opacity="0.85"/>
        <rect x="14" y="2" width="4" height="7" rx="1" fill="white" opacity="0.4"/>
        <rect x="14" y="23" width="4" height="7" rx="1" fill="white" opacity="0.4"/>
        <circle cx="16" cy="16" r="6" fill={c} opacity="0.45"/>
        <circle cx="16" cy="16" r="3" fill="white" opacity="0.35"/>
      </svg>
    )
    case 'slow': return (
      <svg width={s} height={s} viewBox="0 0 32 32">
        <polygon points="16,2 19,13 30,10 21,18 28,28 16,22 4,28 11,18 2,10 13,13" fill={c} opacity="0.85"/>
        <circle cx="16" cy="16" r="5" fill={c}/>
        <circle cx="16" cy="16" r="2.5" fill="white" opacity="0.5"/>
      </svg>
    )
    case 'burst': return (
      <svg width={s} height={s} viewBox="0 0 32 32">
        <rect x="4" y="4" width="24" height="24" rx="4" fill={c} opacity="0.85"/>
        <rect x="14" y="0" width="4" height="14" rx="2" fill={c}/>
        <circle cx="16" cy="18" r="5" fill={c} opacity="0.45"/>
        <circle cx="16" cy="18" r="2.5" fill="white" opacity="0.4"/>
      </svg>
    )
    case 'gatling': return (
      <svg width={s} height={s} viewBox="0 0 32 32">
        <circle cx="16" cy="18" r="11" fill={c} opacity="0.8"/>
        <rect x="14" y="0" width="4" height="12" rx="1" fill={c}/>
        <rect x="9"  y="2" width="4" height="9"  rx="1" fill={c} opacity="0.85"/>
        <rect x="19" y="2" width="4" height="9"  rx="1" fill={c} opacity="0.85"/>
        <circle cx="16" cy="18" r="4" fill="white" opacity="0.28"/>
      </svg>
    )
    case 'rocket': return (
      <svg width={s} height={s} viewBox="0 0 32 32">
        <polygon points="16,2 24,14 20,30 16,28 12,30 8,14" fill={c} opacity="0.9"/>
        <polygon points="8,14 1,20 5,22 8,18"  fill={c} opacity="0.7"/>
        <polygon points="24,14 31,20 27,22 24,18" fill={c} opacity="0.7"/>
        <rect x="14" y="2" width="4" height="16" rx="2" fill={c}/>
        <circle cx="16" cy="12" r="3" fill="white" opacity="0.35"/>
      </svg>
    )
    case 'laser': return (
      <svg width={s} height={s} viewBox="0 0 32 32">
        <polygon points="16,2 28,12 28,20 16,30 4,20 4,12" fill={c} opacity="0.85"/>
        <rect x="13" y="0" width="6" height="16" rx="3" fill={c}/>
        <ellipse cx="16" cy="14" rx="5" ry="3" fill="white" opacity="0.5"/>
        <circle cx="16" cy="16" r="2.5" fill="white" opacity="0.6"/>
      </svg>
    )
    case 'artillery': return (
      <svg width={s} height={s} viewBox="0 0 32 32">
        <polygon points="16,2 30,10 30,22 16,30 2,22 2,10" fill={c} opacity="0.9"/>
        <rect x="14" y="0" width="4" height="12" rx="2" fill={c}/>
        <rect x="0" y="14" width="12" height="4" rx="2" fill={c} opacity="0.7"/>
        <rect x="20" y="14" width="12" height="4" rx="2" fill={c} opacity="0.7"/>
        <circle cx="16" cy="16" r="5" fill={c} opacity="0.45"/>
        <circle cx="16" cy="16" r="2.5" fill="white" opacity="0.4"/>
      </svg>
    )
    default: return (
      <svg width={s} height={s} viewBox="0 0 32 32">
        <polygon points="16,2 30,16 16,30 2,16" fill={c} opacity="0.9"/>
        <circle cx="16" cy="16" r="5" fill="white" opacity="0.3"/>
      </svg>
    )
  }
}

// ─── Alien Ship SVG ────────────────────────────────────────────────────────────
function AlienShip({ variant, isBoss, isFinalBoss, color, size }: { variant: number; isBoss: boolean; isFinalBoss: boolean; color: string; size: number }) {
  const s = Math.max(8, size)
  const c = color
  if (isFinalBoss) return (
    <svg width={s} height={s} viewBox="0 0 32 32">
      <polygon points="16,1 31,10 31,22 16,31 1,22 1,10" fill={c} opacity="0.95"/>
      <ellipse cx="16" cy="16" rx="9" ry="9" fill={c} opacity="0.5"/>
      <circle cx="16" cy="16" r="5" fill="white" opacity="0.25"/>
      <circle cx="16" cy="16" r="2.5" fill="white" opacity="0.5"/>
      <rect x="29" y="8"  width="3" height="4" rx="1" fill={c}/>
      <rect x="29" y="20" width="3" height="4" rx="1" fill={c}/>
      <rect x="0"  y="8"  width="3" height="4" rx="1" fill={c}/>
      <rect x="0"  y="20" width="3" height="4" rx="1" fill={c}/>
    </svg>
  )
  if (isBoss) return (
    <svg width={s} height={s} viewBox="0 0 32 32">
      <ellipse cx="16" cy="19" rx="14" ry="9" fill={c} opacity="0.9"/>
      <ellipse cx="16" cy="14" rx="9" ry="7" fill={c}/>
      <circle cx="16" cy="13" r="4" fill="white" opacity="0.28"/>
      <rect x="3"  y="24" width="6" height="3" rx="1" fill="white" opacity="0.3"/>
      <rect x="13" y="26" width="6" height="3" rx="1" fill="white" opacity="0.3"/>
      <rect x="23" y="24" width="6" height="3" rx="1" fill="white" opacity="0.3"/>
    </svg>
  )
  switch (variant % 4) {
    case 0: return (   // Saucer
      <svg width={s} height={s} viewBox="0 0 32 32">
        <ellipse cx="16" cy="21" rx="13" ry="7" fill={c} opacity="0.85"/>
        <ellipse cx="16" cy="16" rx="8"  ry="6" fill={c}/>
        <circle  cx="16" cy="15" r="3" fill="white" opacity="0.35"/>
      </svg>
    )
    case 1: return (   // Bug fighter
      <svg width={s} height={s} viewBox="0 0 32 32">
        <polygon points="16,4 22,14 30,12 26,22 28,30 16,26 4,30 6,22 2,12 10,14" fill={c} opacity="0.85"/>
        <circle cx="16" cy="17" r="4" fill="white" opacity="0.28"/>
      </svg>
    )
    case 2: return (   // Angular interceptor
      <svg width={s} height={s} viewBox="0 0 32 32">
        <polygon points="16,2 30,28 22,22 16,28 10,22 2,28" fill={c} opacity="0.9"/>
        <polygon points="16,8 24,22 16,18 8,22" fill={c} opacity="0.45"/>
        <circle cx="16" cy="14" r="3" fill="white" opacity="0.3"/>
      </svg>
    )
    default: return (  // Crab
      <svg width={s} height={s} viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="9" fill={c} opacity="0.9"/>
        <rect x="1"  y="7"  width="9" height="4" rx="2" fill={c} opacity="0.8"/>
        <rect x="22" y="7"  width="9" height="4" rx="2" fill={c} opacity="0.8"/>
        <rect x="1"  y="21" width="9" height="4" rx="2" fill={c} opacity="0.8"/>
        <rect x="22" y="21" width="9" height="4" rx="2" fill={c} opacity="0.8"/>
        <circle cx="16" cy="16" r="4" fill="white" opacity="0.28"/>
      </svg>
    )
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function SpaceImpactDefense({ availableCoins, onClose }: { availableCoins: CoinOption[]; onClose: () => void }) {
  const [cell, setCell] = useState(calcCell)
  const [soundOn, setSoundOn] = useState(getGameSoundEnabled)

  // Game data refs (avoid re-render on every frame)
  const enemiesRef = useRef<Enemy[]>([])
  const towersRef = useRef<Tower[]>([])
  const bulletsRef = useRef<Bullet[]>([])
  const goldRef = useRef(400)
  const livesRef = useRef(20)
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
  const [uiWave, setUiWave] = useState(0)
  const [uiStage, setUiStage] = useState(1)
  const [uiScore, setUiScore] = useState(0)
  const [uiState, setUiState] = useState<GameState>('idle')
  const [uiPaths, setUiPaths] = useState<[number, number][][]>(() => generatePaths(1))
  const uiPath = uiPaths[0] ?? []  // kept for single-path compat (finish marker etc.)
  const [uiEnemies, setUiEnemies] = useState<Enemy[]>([])
  const [uiBullets, setUiBullets] = useState<Bullet[]>([])
  const [uiTowers, setUiTowers] = useState<Tower[]>([])
  const [uiHighScore, setUiHighScore] = useState(() => Number(localStorage.getItem(STORAGE_KEY) || 0))

  const [selectedTowerKey, setSelectedTowerKey] = useState<TowerKey>('fast')
  const [hoveredCell, setHoveredCell] = useState<[number,number]|null>(null)
  const [selectedTowerOnGrid, setSelectedTowerOnGrid] = useState<Tower|null>(null)
  const [destroyFlash, setDestroyFlash] = useState<string | null>(null)  // 'col,row' of smashed tower
  const [firingTowers, setFiringTowers] = useState<Set<number>>(new Set())  // tower ids currently flashing
  const [draggedTower, setDraggedTower] = useState<Tower|null>(null)
  const [dragOffset, setDragOffset] = useState<[number, number]>([0, 0])
  const explosionsRef = useRef<{x: number; y: number; radius: number; time: number; type: 'aoe'|'rocket'|'heavy'; maxTime: number}[]>([])
  const [uiExplosions, setUiExplosions] = useState<{x: number; y: number; radius: number; time: number; type: 'aoe'|'rocket'|'heavy'; maxTime: number}[]>([])
  const particlesRef = useRef<{x: number; y: number; type: ParticleType; vx: number; vy: number; life: number; maxLife: number}[]>([])
  const [uiParticles, setUiParticles] = useState<{x: number; y: number; type: ParticleType; vx: number; vy: number; life: number; maxLife: number}[]>([])
  const floatingTextRef = useRef<{x: number; y: number; text: string; time: number; maxTime: number; color: string}[]>([])
  const [uiFloatingText, setUiFloatingText] = useState<{x: number; y: number; text: string; time: number; maxTime: number; color: string}[]>([])
  const endlessRef = useRef(false)
  const [uiEndless, setUiEndless] = useState(false)
  const [endlessUnlocked, setEndlessUnlocked] = useState(() => localStorage.getItem(ENDLESS_KEY) === '1')

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

  const coinsRef = useRef(availableCoins)
  useEffect(() => { coinsRef.current = availableCoins }, [availableCoins])

  // ── Resize ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setCell(calcCell())
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // ── Sound toggle ──────────────────────────────────────────────────────────
  function toggleSound() {
    const next = !soundOn
    setSoundOn(next)
    setGameSoundEnabled(next)
  }

  // ── Auto-play next wave ────────────────────────────────────────────────────
  useEffect(() => {
    if (!autoPlayWave || uiState !== 'playing') return
    const timer = setTimeout(() => startWave(), 800)
    return () => clearTimeout(timer)
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
  const gameLoop = useCallback((ts: number) => {
    const dt = Math.min((ts - (lastTimeRef.current || ts)) / 1000, 0.1)
    lastTimeRef.current = ts

    const state = stateRef.current
    if (state !== 'playing' && state !== 'wave') {
      frameRef.current = requestAnimationFrame(gameLoop)
      return
    }

    const coins = coinsRef.current
    const waveCfg = getWaveCfg(stageRef.current, waveRef.current)

    // ── Spawn enemies ──────────────────────────────────────────────────────
    if (state === 'wave' && spawnQueueRef.current > 0) {
      spawnTimerRef.current -= dt
      if (spawnTimerRef.current <= 0) {
        const normalCfg = getNormalWaveCfg(stageRef.current, waveRef.current)
        const numSpawns = Math.max(1, pathsRef.current.length)
        const spawnBoss = waveCfg.isBoss && bossQueueRef.current > 0 && (
          normalEscortQueueRef.current === 0 || (spawnRRRef.current % 4 === 0)
        )
        const enemyCfg = spawnBoss ? waveCfg : normalCfg
        const baseInterval = spawnBoss ? 1.1 : 0.65
        spawnTimerRef.current = baseInterval / numSpawns
        const coin = coins[Math.floor(Math.random() * coins.length)]
        const pidx = spawnRRRef.current % numSpawns
        spawnRRRef.current++
        const pos = getEnemyPos(pidx, 0, 0)
        // 30% chance a normal enemy gets a random 10-30% speed surge
        const spdMult = (!spawnBoss && Math.random() < 0.30) ? 1.1 + Math.random() * 0.20 : 1
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
          isBoss: spawnBoss,
          destroyCooldown: (spawnBoss && stageRef.current === MAX_STAGES) ? 2.0 : 9999,
          hitFlash: 0,
          dead: false, leaked: false,
        })
        if (spawnBoss) bossQueueRef.current--
        else normalEscortQueueRef.current--
        spawnQueueRef.current--
      }
    }

    // If no spawns left and no enemies, wave ends
    if (state === 'wave' && spawnQueueRef.current === 0 && enemiesRef.current.filter(e => !e.dead && !e.leaked).length === 0) {
      if (waveRef.current >= WAVES_PER_STAGE) {
        // All waves in stage done
        if (stageRef.current >= MAX_STAGES && !endlessRef.current) {
          // Unlock endless mode permanently
          localStorage.setItem(ENDLESS_KEY, '1')
          setEndlessUnlocked(true)
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
      if (!e.leaked) {
        const pos = getEnemyPos(e.pathIdx, e.pathIndex, e.progress)
        e.x = pos.x; e.y = pos.y
      }
    }
    enemiesRef.current = enemiesRef.current.filter(e => !e.leaked && !e.dead)

    // ── Stage-10 boss: smash nearby towers ────────────────────────────────
    if (stageRef.current === MAX_STAGES) {
      for (const e of enemiesRef.current) {
        if (!e.isBoss || e.dead || e.leaked) continue
        e.destroyCooldown -= dt
        if (e.destroyCooldown > 0) continue
        // Find nearest tower within 1.8 cells
        let nearest: Tower | null = null
        let nearDist = 1.8
        for (const t of towersRef.current) {
          const dx = t.col + 0.5 - (e.x + 0.5)
          const dy = t.row + 0.5 - (e.y + 0.5)
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < nearDist) { nearDist = d; nearest = t }
        }
        if (nearest) {
          const key = `${nearest.col},${nearest.row}`
          goldRef.current += Math.floor(nearest.towerDef.cost * 0.3)
          towersRef.current = towersRef.current.filter(t => t.id !== nearest!.id)
          e.destroyCooldown = 4.5
          if (soundOn) playGameSound('hit')
          setDestroyFlash(key)
          setTimeout(() => setDestroyFlash(null), 1000)
          // Add lightning effect from boss to tower
          bossLightningRef.current.push({
            fromX: e.x + 0.5,
            fromY: e.y + 0.5,
            toX: nearest.col + 0.5,
            toY: nearest.row + 0.5,
            time: 0,
            maxTime: 0.15
          })
          // Add blue screen flash for boss attack
          bossScreenFlashRef.current = {time: 0, maxTime: 0.08, intensity: 0.8}
          setBossScreenFlashState(0.8)
        } else {
          e.destroyCooldown = 1.2 // retry sooner if no tower nearby
        }
      }
    }

    // ── Tower shooting ────────────────────────────────────────────────────
    const aliveEnemies = enemiesRef.current.filter(e => !e.dead && !e.leaked)

    // Drain burst queues (artillery 1s interval between rockets)
    for (const tower of towersRef.current) {
      if (tower.burstQueue.length === 0) continue
      tower.burstQueue[0].delay -= dt
      if (tower.burstQueue[0].delay <= 0) {
        const shot = tower.burstQueue.shift()!
        bulletsRef.current.push({
          id: _bid++,
          x: tower.col + 0.5, y: tower.row + 0.5,
          tx: shot.tx, ty: shot.ty,
          speed: 7, color: '#ff8800',
          targetId: shot.targetId,
          dmg: shot.dmg,
          isAoe: false, isSlow: false, isRocket: false, isHeavy: true,
          towerType: 'artillery',
          dead: false,
        })
        if (soundOn) playGameSound('shoot')
      }
    }

    // ── Laser beam logic (10s fire, 5s exhaust) ─────────────────────────────────
    const laserBeams: {towerId:number;x1:number;y1:number;x2:number;y2:number}[] = []
    for (const tower of towersRef.current) {
      if (tower.type !== 'laser') continue
      if (tower.laserExhaust > 0) { tower.laserExhaust -= dt; continue }
      // Find all enemies in range — furthest-along is primary, rest take pierce dmg
      const td = tower.towerDef
      const inRange: Enemy[] = []
      for (const e of aliveEnemies) {
        const dx = e.x - tower.col, dy = e.y - tower.row
        if (Math.sqrt(dx*dx+dy*dy) <= td.range) inRange.push(e)
      }
      // Sort by path progress descending so index 0 = primary target
      inRange.sort((a, b) => (b.pathIndex + b.progress) - (a.pathIndex + a.progress))
      const laserTarget = inRange[0] ?? null
      if (!laserTarget) {
        if (tower.laserActive > 0) { tower.laserActive = 0; tower.laserExhaust = 5 }
        continue
      }
      // Only pierce enemies that lie along the beam line (tower → primary target)
      const bx = laserTarget.x - tower.col, by = laserTarget.y - tower.row
      const bLen = Math.sqrt(bx*bx + by*by) || 1
      const laserHits: Enemy[] = [laserTarget]
      for (let i = 1; i < inRange.length; i++) {
        const e = inRange[i]
        const ex = e.x - tower.col, ey = e.y - tower.row
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
        const tickDmg = td.dmg * (1 + (tower.level - 1) * 0.5)
        const pierceDmg = 1.5  // flat damage per tick to secondary targets
        for (let hi = 0; hi < laserHits.length; hi++) {
          const e = laserHits[hi]
          e.hp -= hi === 0 ? tickDmg : pierceDmg
          if (Math.random() < 0.18) {
            spawnImpactParticles(particlesRef.current, e.x + 0.5, e.y + 0.5, 'impact', hi === 0 ? 3 : 2, 0.85, 0.18)
          }
          if (e.hp <= 0) {
            triggerEnemyDeath(e, 'laser', e.isBoss, goldRef, scoreRef, particlesRef.current, floatingTextRef.current, screenFlashRef, coinFlowRef, setScreenFlashState)
            if (soundOn) playGameSound('pop')
          }
        }
      }
      // Beam endpoint: furthest enemy in range for full visual pierce
      const beamEnd = laserHits[laserHits.length - 1]
      laserBeams.push({ towerId: tower.id, x1: tower.col + 0.5, y1: tower.row + 0.5, x2: beamEnd.x + 0.5, y2: beamEnd.y + 0.5 })
      if (tower.laserActive <= 0) { tower.laserActive = 0; tower.laserExhaust = 5 }
    }
    setUiLaserBeams(laserBeams)

    // ── Tower shooting (non-laser) ───────────────────────────────────────────
    for (const tower of towersRef.current) {
      if (tower.type === 'laser') continue  // handled above
      tower.cooldown -= dt
      if (tower.cooldown > 0) continue
      const td = tower.towerDef
      let target: Enemy | null = null
      let bestProgress = -1
      for (const e of aliveEnemies) {
        const dx = e.x - tower.col
        const dy = e.y - tower.row
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist <= td.range) {
          const ep = e.pathIndex + e.progress
          if (ep > bestProgress) { bestProgress = ep; target = e }
        }
      }
      if (target) {
        tower.cooldown = td.rate
        if (td.key === 'artillery') {
          // Queue 3 rockets with 1s interval each
          const topTargets = [...aliveEnemies]
            .sort((a, b) => (b.pathIndex + b.progress) - (a.pathIndex + a.progress))
            .slice(0, 3)
          const dmg = td.dmg * (1 + (tower.level - 1) * 0.5)
          topTargets.forEach((t, i) => {
            tower.burstQueue.push({
              tx: t.x + 0.5, ty: t.y + 0.5,
              targetId: t.id,
              delay: i * 1.0,  // 0s, 1s, 2s
              dmg,
            })
          })
        } else {
          bulletsRef.current.push({
            id: _bid++,
            x: tower.col + 0.5, y: tower.row + 0.5,
            tx: target.x + 0.5, ty: target.y + 0.5,
            speed: td.key === 'rocket' ? 6 : 12,
            color: td.color,
            targetId: target.id,
            dmg: td.dmg * (1 + (tower.level - 1) * 0.5),
            isAoe: td.key === 'aoe',
            isSlow: td.key === 'slow',
            isRocket: td.key === 'rocket',
            isHeavy: false,
            towerType: td.key,
            dead: false,
          })
        }
        if (soundOn) playGameSound('shoot')
        // Muzzle flash
        setFiringTowers(prev => { const s = new Set(prev); s.add(tower.id); return s })
        setTimeout(() => setFiringTowers(prev => { const s = new Set(prev); s.delete(tower.id); return s }), 80)
      }
    }

    // ── Move bullets ──────────────────────────────────────────────────────
    for (const b of bulletsRef.current) {
      if (b.dead) continue
      const dx = b.tx - b.x, dy = b.ty - b.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 0.4) {
        b.dead = true
        // apply damage
        const target = aliveEnemies.find(e => e.id === b.targetId)
        if (b.isRocket) {
          // Huge AOE: 3.0 cell radius, shockwave
          explosionsRef.current.push({ x: b.tx, y: b.ty, radius: 3.0, time: 0, type: 'rocket', maxTime: 0.5 })
          for (const e of aliveEnemies) {
            const edx = e.x - b.tx, edy = e.y - b.ty
            const dist2 = Math.sqrt(edx * edx + edy * edy)
            if (dist2 <= 3.0) {
              // falloff: full damage in centre, 50% at edge
              const falloff = 1 - (dist2 / 3.0) * 0.5
              e.hp -= b.dmg * falloff
              e.hitFlash = 0.1
              spawnImpactParticles(particlesRef.current, e.x + 0.5, e.y + 0.5, 'impact', 5, 1.6, 0.22)
              if (e.hp <= 0) { 
                triggerEnemyDeath(e, 'rocket', e.isBoss, goldRef, scoreRef, particlesRef.current, floatingTextRef.current, screenFlashRef, coinFlowRef, setScreenFlashState)
                if (soundOn) playGameSound('combo')
              }
            }
          }
        } else if (b.isAoe) {
          // AoE: 1.5 cell radius
          explosionsRef.current.push({ x: b.tx, y: b.ty, radius: 1.5, time: 0, type: 'aoe', maxTime: 0.4 })
          for (const e of aliveEnemies) {
            const edx = e.x - b.tx, edy = e.y - b.ty
            if (Math.sqrt(edx*edx+edy*edy) <= 1.5) {
              e.hp -= b.dmg
              e.hitFlash = 0.1
              spawnImpactParticles(particlesRef.current, e.x + 0.5, e.y + 0.5, 'impact', 4, 1.3, 0.18)
              if (e.hp <= 0) { 
                triggerEnemyDeath(e, 'aoe', e.isBoss, goldRef, scoreRef, particlesRef.current, floatingTextRef.current, screenFlashRef, coinFlowRef, setScreenFlashState)
                if (soundOn) playGameSound('pop')
              }
            }
          }
        } else if (b.isHeavy) {
          // Small AOE: 1.0 cell radius
          explosionsRef.current.push({ x: b.tx, y: b.ty, radius: 1.0, time: 0, type: 'heavy', maxTime: 0.35 })
          for (const e of aliveEnemies) {
            const edx = e.x - b.tx, edy = e.y - b.ty
            if (Math.sqrt(edx*edx+edy*edy) <= 1.0) {
              e.hp -= b.dmg
              e.hitFlash = 0.1
              spawnImpactParticles(particlesRef.current, e.x + 0.5, e.y + 0.5, 'impact', 5, 1.45, 0.2)
              if (e.hp <= 0) { 
                triggerEnemyDeath(e, 'artillery', e.isBoss, goldRef, scoreRef, particlesRef.current, floatingTextRef.current, screenFlashRef, coinFlowRef, setScreenFlashState)
                if (soundOn) playGameSound('combo')
              }
            }
          }
        } else if (target) {
          if (b.isSlow) target.slowTimer = 2.5
          target.hp -= b.dmg
          target.hitFlash = 0.1
          spawnImpactParticles(
            particlesRef.current,
            target.x + 0.5,
            target.y + 0.5,
            b.isSlow ? 'freeze' : 'impact',
            b.isSlow ? 6 : (b.towerType === 'gatling' ? 4 : 3),
            b.isSlow ? 1.1 : 1.25,
            b.isSlow ? 0.32 : 0.18,
          )
          if (target.hp <= 0) { 
            triggerEnemyDeath(target, b.towerType, target.isBoss, goldRef, scoreRef, particlesRef.current, floatingTextRef.current, screenFlashRef, coinFlowRef, setScreenFlashState)
            if (soundOn) playGameSound('pop')
          }
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
    if (waveAnnouncement) {
      waveAnnouncement.time += dt
      if (waveAnnouncement.time >= waveAnnouncement.maxTime) {
        setWaveAnnouncement(null)
      } else {
        setWaveAnnouncement({...waveAnnouncement})
      }
    }

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
    if (victoryEffect) {
      victoryEffect.time += dt
      if (victoryEffect.time >= victoryEffect.maxTime) {
        setVictoryEffect(null)
      } else {
        setVictoryEffect({...victoryEffect})
      }
    }

    // ── Update UI ─────────────────────────────────────────────────────────
    setUiGold(goldRef.current)
    setUiLives(livesRef.current)
    setUiScore(scoreRef.current)
    setUiEnemies([...enemiesRef.current])
    setUiBullets([...bulletsRef.current])
    setUiTowers([...towersRef.current])
    setUiExplosions([...explosionsRef.current])
    setUiParticles([...particlesRef.current])
    setUiFloatingText([...floatingTextRef.current])
    setUiBossLightning([...bossLightningRef.current])

    frameRef.current = requestAnimationFrame(gameLoop)
  }, [soundOn])

  useEffect(() => {
    frameRef.current = requestAnimationFrame(gameLoop)
    return () => cancelAnimationFrame(frameRef.current)
  }, [gameLoop])

  // ── Enter Endless Mode ─────────────────────────────────────────────────────
  function enterEndless() {
    const ps = generatePaths(MAX_STAGES + 1)
    enemiesRef.current = []
    towersRef.current = []
    bulletsRef.current = []
    goldRef.current = 50000
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
    endlessRef.current = true
    setUiEndless(true)
    setUiStage(MAX_STAGES)
    setUiWave(0)
    setUiPaths(ps)
    setUiGold(50000)
    setUiLives(20)
    setUiScore(0)
    setUiEnemies([])
    setUiBullets([])
    setUiTowers([])
    setSelectedTowerOnGrid(null)
    stateRef.current = 'playing'
    setUiState('playing')
  }

  // ── Start wave ─────────────────────────────────────────────────────────────
  function startWave() {
    if (stateRef.current !== 'playing' && stateRef.current !== 'idle') return
    const nextWave = waveRef.current + 1
    waveRef.current = nextWave
    setUiWave(nextWave)
    const cfg = getWaveCfg(stageRef.current, nextWave)
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
      .filter(t => newPathSet.has(`${t.col},${t.row}`))
      .reduce((sum, t) => sum + Math.floor(t.towerDef.cost * 0.7), 0)
    towersRef.current = towersRef.current.filter(t => !newPathSet.has(`${t.col},${t.row}`))
    goldRef.current += removedGold
    enemiesRef.current = []
    bulletsRef.current = []
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
    setUiTowers([...towersRef.current])
    setSelectedTowerOnGrid(null)
    // Stage transition animation
    stageTransitionRef.current = {phase: 'fade', time: 0, maxTime: 0.3}
    setStageTransitionState({phase: 'fade', progress: 0})
  }

  // ── Place tower ────────────────────────────────────────────────────────────
  // ── Tower drag-and-drop handlers ───────────────────────────────────────────
  function handleTowerMouseDown(e: React.MouseEvent, tower: Tower) {
    e.stopPropagation()
    const boardRect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect()
    const offsetX = e.clientX - boardRect.left - tower.col * cell
    const offsetY = e.clientY - boardRect.top - tower.row * cell
    setDraggedTower(tower)
    setDragOffset([offsetX, offsetY])
  }

  function handleBoardMouseUp(e: React.MouseEvent) {
    if (!draggedTower) return
    const boardRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - boardRect.left - dragOffset[0]
    const y = e.clientY - boardRect.top - dragOffset[1]
    const newCol = Math.round(x / cell)
    const newRow = Math.round(y / cell)

    // Validate drop location
    if (newCol >= 0 && newCol < COLS && newRow >= 0 && newRow < ROWS) {
      const key = `${newCol},${newRow}`
      if (!pathSetRef.current.has(key)) {
        // Check if another tower is already there
        const existingTower = towersRef.current.find(t => t.col === newCol && t.row === newRow && t.id !== draggedTower.id)
        if (!existingTower) {
          // Move the tower
          draggedTower.col = newCol
          draggedTower.row = newRow
          setUiTowers([...towersRef.current])
          setSelectedTowerOnGrid(draggedTower)
        }
      }
    }
    setDraggedTower(null)
  }

  function handleCellClick(col: number, row: number) {
    if (stateRef.current === 'gameover' || stateRef.current === 'victory') return
    if (draggedTower) return  // Don't build while dragging
    const key = `${col},${row}`
    if (pathSetRef.current.has(key)) return

    // Check existing tower
    const existing = towersRef.current.find(t => t.col === col && t.row === row)
    if (existing) {
      setSelectedTowerOnGrid(existing)
      return
    }
    setSelectedTowerOnGrid(null)

    const tDef = TOWER_TYPES.find(t => t.key === selectedTowerKey)!
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
      burstQueue: [],
      laserActive: 0,
      laserExhaust: 0,
    }
    towersRef.current.push(newTower)
    towerCreationTimeRef.current.set(newTower.id, 0)
    setUiTowers([...towersRef.current])
    setUiGold(goldRef.current)
    playGameSound('select')
    // Spawn portal effect
    spawnPortalRef.current.push({x: col + 0.5, y: row + 0.5, time: 0, maxTime: 0.4, pathIdx: 0})
    // Build particles
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8
      particlesRef.current.push({
        x: col + 0.5, y: row + 0.5,
        type: 'build',
        vx: Math.cos(angle) * 1.8, vy: Math.sin(angle) * 1.8,
        life: 0, maxLife: 0.35
      })
    }
  }

  // ── Upgrade tower ──────────────────────────────────────────────────────────
  function upgradeTower(tower: Tower) {
    const cost = tower.towerDef.cost * tower.level * 1.2
    if (goldRef.current < cost) { playGameSound('hit'); return }
    goldRef.current -= cost
    tower.level = Math.min(tower.level + 1, 5)
    setUiTowers([...towersRef.current])
    setUiGold(goldRef.current)
    setSelectedTowerOnGrid({...tower})
    playGameSound('levelup')
    // Upgrade burst effect
    towerActionBurstRef.current.push({x: tower.col + 0.5, y: tower.row + 0.5, type: 'upgrade', time: 0, maxTime: 0.5})
    // Upgrade particles
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6
      particlesRef.current.push({
        x: tower.col + 0.5, y: tower.row + 0.5,
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
    // Sell burst effect
    towerActionBurstRef.current.push({x: tower.col + 0.5, y: tower.row + 0.5, type: 'sell', time: 0, maxTime: 0.5})
    // Gold particles from tower to top-right
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8
      particlesRef.current.push({
        x: tower.col + 0.5, y: tower.row + 0.5,
        type: 'gold',
        vx: Math.cos(angle) * 2.0, vy: Math.sin(angle) * 2.0,
        life: 0, maxLife: 0.5
      })
    }
    towersRef.current = towersRef.current.filter(t => t.id !== tower.id)
    towerCreationTimeRef.current.delete(tower.id)
    setUiTowers([...towersRef.current])
    setUiGold(goldRef.current)
    setSelectedTowerOnGrid(null)
    playGameSound('swap')
  }

  // ── Restart ────────────────────────────────────────────────────────────────
  function restart() {
    const ps = generatePaths(1)
    enemiesRef.current = []
    towersRef.current = []
    bulletsRef.current = []
    goldRef.current = 400
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
    endlessRef.current = false
    setUiEndless(false)
    stateRef.current = 'idle'
    setUiState('idle')
    setUiWave(0)
    setUiStage(1)
    setUiPaths(ps)
    setUiGold(400)
    setUiLives(20)
    setUiScore(0)
    setUiEnemies([])
    setUiBullets([])
    setUiTowers([])
    setSelectedTowerOnGrid(null)
  }

  const boardW = cell * COLS
  const boardH = cell * ROWS

  const nextWaveNum = uiWave + 1
  const nextWaveCfg = getWaveCfg(uiStage, nextWaveNum)
  const isBossNextWave = nextWaveCfg.isBoss
  const canStartWave = uiState === 'idle' || uiState === 'playing'
  const isOver = uiState === 'gameover' || uiState === 'victory'
  const uiPathSet = new Set(uiPaths.flatMap(p => p.map(([c, r]) => `${c},${r}`)))
  // Collect all spawn starts and single finish
  const uiSpawnCells = new Set(uiPaths.map(p => p.length > 0 ? `${p[0][0]},${p[0][1]}` : ''))
  const uiFinishCell = uiPath.length > 0 ? `${uiPath[uiPath.length - 1][0]},${uiPath[uiPath.length - 1][1]}` : ''

  return (
    <>
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(8,12,24,0.97)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', overflowY: 'auto',
      padding: '12px 8px 24px',
      fontFamily: "'Rajdhani','Segoe UI',sans-serif",
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, width: '100%', maxWidth: boardW + 8 }}>
        <button onClick={onClose} style={btnStyle('#333', '#fff')} aria-label="Close">✕</button>
        <div style={{ flex: 1, textAlign: 'center', fontWeight: 800, fontSize: '1.15rem', color: '#18e6c4', letterSpacing: 1, whiteSpace: 'nowrap' }}>
          SPACE IMPACT DEFENSE
        </div>
        <button onClick={toggleSound} style={btnStyle('#222','#fff')}>{soundOn ? '🔊' : '🔇'}</button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
        <StatPill icon="💰" val={uiGold} color="#ffd666" />
        <StatPill icon="❤️" val={uiLives} color="#fb7185" />
        <StatPill icon="⭐" val={uiScore} color="#18e6c4" />
        <StatPill icon="🏆" val={uiHighScore} color="#7c5dff" />
      </div>

      {/* Wave bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, width: '100%', maxWidth: boardW + 8 }}>
        <span style={{ color: '#aaa', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
          {uiEndless
            ? <><b style={{ color: '#ff8800' }}>∞ ENDLESS</b> · Stage <b style={{ color: '#ff8800' }}>{uiStage}</b> · Wave <b style={{ color: '#ffd666' }}>{uiWave}</b>/{WAVES_PER_STAGE}</>
            : <>Stage <b style={{ color: '#18e6c4' }}>{uiStage}</b>/{MAX_STAGES} · Wave <b style={{ color: '#ffd666' }}>{uiWave}</b>/{WAVES_PER_STAGE}</>}
        </span>
        <div style={{ flex: 1, height: 6, background: '#222', borderRadius: 4 }}>
          <div style={{ width: `${((uiStage - 1) * WAVES_PER_STAGE + uiWave) / (MAX_STAGES * WAVES_PER_STAGE) * 100}%`, height: '100%', background: '#18e6c4', borderRadius: 4, transition: 'width 0.3s' }} />
        </div>
        {canStartWave && !isOver && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={startWave} style={btnStyle(isBossNextWave ? '#cc2222' : '#18e6c4', isBossNextWave ? '#fff' : '#000', true)}>
              {isBossNextWave ? `� Boss Wave ${nextWaveNum}` : uiState === 'idle' ? '▶ Start Wave 1' : `▶ Wave ${nextWaveNum}`}
            </button>
            <button onClick={() => setAutoPlayWave(!autoPlayWave)} title={autoPlayWave ? 'Disable auto-play' : 'Enable auto-play (auto-start waves)'} style={btnStyle(autoPlayWave ? '#7c5dff' : '#444', '#fff', true)}>
              {autoPlayWave ? '⚡ Auto' : '⏸ Manual'}
            </button>
          </div>
        )}
        {uiState === 'wave' && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ color: '#ffd666', fontWeight: 700 }}>⚔ Wave in progress…</span>
            <button onClick={() => setAutoPlayWave(!autoPlayWave)} title={autoPlayWave ? 'Disable auto-play' : 'Enable auto-play (auto-start waves)'} style={btnStyle(autoPlayWave ? '#7c5dff' : '#444', '#fff', true)}>
              {autoPlayWave ? '⚡ Auto' : '⏸ Manual'}
            </button>
          </div>
        )}
        {uiState === 'idle' && endlessUnlocked && !uiEndless && (
          <button onClick={enterEndless} style={btnStyle('#ff8800', '#000', true)}>🔥 Endless</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: boardW + 8, flexWrap: 'wrap' }}>
        {/* Board */}
        <div
          style={{
            position: 'relative', width: boardW, height: boardH, flexShrink: 0, border: '2px solid #1a2e44', borderRadius: 6, overflow: 'hidden', userSelect: 'none',
            transition: 'none'
          }}
          onMouseUp={handleBoardMouseUp}
          onMouseLeave={() => setDraggedTower(null)}
        >
          {/* Grid cells */}
          {Array.from({ length: ROWS }, (_, r) =>
            Array.from({ length: COLS }, (_, c) => {
              const key = `${c},${r}`
              const isPath = uiPathSet.has(key)
              const isStart = uiSpawnCells.has(key)
              const isEnd = key === uiFinishCell
              const hasTower = towersRef.current.some(t => t.col === c && t.row === r)
              const isHovered = hoveredCell?.[0] === c && hoveredCell?.[1] === r
              const tDef = TOWER_TYPES.find(t => t.key === selectedTowerKey)!
              const canAfford = goldRef.current >= tDef.cost
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
                      ? (isStart ? '#18e6c466' : isEnd ? '#fb718566' : '#1a3a2a')
                      : hasTower ? 'transparent'
                      : isHovered && !isPath && !hasTower
                        ? (canAfford ? '#ffffff18' : '#ff000018')
                        : '#0e1a2e',
                    border: '1px solid #0d1a2a',
                    cursor: isPath ? 'default' : 'pointer',
                    boxSizing: 'border-box',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: isStart || isEnd ? cell * 0.45 : 0,
                  }}
                >
                  {isStart && '�'}
                  {isEnd && '🌍'}
                </div>
              )
            })
          )}

          {/* Laser beams */}
          {uiLaserBeams.length > 0 && (
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 4 }}>
              <defs>
                <filter id="laserGlow">
                  <feGaussianBlur stdDeviation="2" result="blur"/>
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              {uiLaserBeams.map(b => (
                <g key={b.towerId}>
                  <line x1={b.x1*cell} y1={b.y1*cell} x2={b.x2*cell} y2={b.y2*cell} stroke="#dbecff" strokeWidth={4} strokeOpacity={0.25} filter="url(#laserGlow)" />
                  <line x1={b.x1*cell} y1={b.y1*cell} x2={b.x2*cell} y2={b.y2*cell} stroke="#ffffff" strokeWidth={1.5} strokeOpacity={0.9} filter="url(#laserGlow)" />
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
            // Tower scale-in animation
            const creationTime = towerCreationTimeRef.current.get(tower.id) ?? 0
            const scaleProgress = Math.min(creationTime / 0.3, 1)  // 300ms scale-in
            const scaleEase = 1 - Math.pow(1 - scaleProgress, 3)  // ease-out
            const scale = scaleEase * 1.0 + (1 - scaleEase) * 0.3  // from 0.3 to 1.0
            
            // Tower selection pulse
            const pulseTime = Date.now() % 800  // 800ms cycle
            const pulseProgress = pulseTime / 800
            const pulseOpacity = 0.8 + Math.sin(pulseProgress * Math.PI * 2) * 0.2  // pulse between 0.6 and 1.0
            
            return (
              <div
                key={tower.id}
                onClick={() => setSelectedTowerOnGrid(tower)}
                onMouseDown={(e) => handleTowerMouseDown(e, tower)}
                style={{
                  position: 'absolute',
                  left: tower.col * cell + 2, top: tower.row * cell + 2,
                  width: cell - 4, height: cell - 4,
                  borderRadius: 6,
                  background: tower.towerDef.color + '33',
                  border: `2px solid ${tower.type === 'laser' && tower.laserExhaust > 0 ? '#ff444499' : tower.towerDef.color}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: draggedTower?.id === tower.id ? 'grabbing' : 'grab', overflow: 'hidden',
                  boxShadow: selectedTowerOnGrid?.id === tower.id 
                    ? `0 0 12px ${tower.towerDef.color}, 0 0 24px ${tower.towerDef.color}${Math.round(pulseOpacity * 255).toString(16).padStart(2, '0')}`
                    : tower.type === 'laser' && tower.laserActive > 0 ? '0 0 10px 3px #dbecffaa' : firingTowers.has(tower.id) ? `0 0 14px 5px ${tower.towerDef.color}cc` : 'none',
                  opacity: tower.type === 'laser' && tower.laserExhaust > 0 ? 0.55 : 1,
                  userSelect: 'none',
                  transform: `scale(${scale})`,
                  transformOrigin: 'center',
                  transition: 'none',
                }}
                title={tower.towerDef.label}
              >
                <TowerShip tType={tower.type} color={tower.towerDef.color} size={cell > 38 ? 26 : 20} />
                {tower.level > 1 && (
                  <div style={{ fontSize: cell * 0.22, color: '#ffd666', fontWeight: 700, lineHeight: 1 }}>★{tower.level}</div>
                )}
                {tower.type === 'laser' && tower.laserExhaust > 0 && (
                  <div style={{ fontSize: cell * 0.18, color: '#fb7185', fontWeight: 900, lineHeight: 1 }}>⏳</div>
                )}
              </div>
            )
          })}

          {/* Range ring for selected tower */}
          {selectedTowerOnGrid && (() => {
            const t = selectedTowerOnGrid
            const r = t.towerDef.range * cell
            return (
              <div style={{
                position: 'absolute',
                left: (t.col + 0.5) * cell - r,
                top: (t.row + 0.5) * cell - r,
                width: r * 2, height: r * 2,
                borderRadius: '50%',
                border: `2px dashed ${t.towerDef.color}88`,
                pointerEvents: 'none',
              }} />
            )
          })()}

          {/* On-board tower actions */}
          {selectedTowerOnGrid && (() => {
            const t = selectedTowerOnGrid
            const upgradeCost = Math.floor(t.towerDef.cost * t.level * 1.2)
            const sellValue = Math.floor(t.towerDef.cost * 0.5)
            const canUpgrade = t.level < 5
            const menuWidth = canUpgrade ? 88 : 42
            const left = Math.max(8, Math.min(boardW - menuWidth - 8, (t.col + 0.5) * cell - menuWidth / 2))
            const top = Math.max(8, (t.row + 0.5) * cell - 54)

            const iconButtonStyle = (bg: string, disabled = false): React.CSSProperties => ({
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: '1px solid #ffffff33',
              background: disabled ? '#2a3444' : bg,
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontSize: '1rem',
              fontWeight: 900,
              cursor: disabled ? 'not-allowed' : 'pointer',
              boxShadow: disabled ? 'none' : '0 8px 18px #00000055',
              opacity: disabled ? 0.45 : 1,
            })

            return (
              <div style={{
                position: 'absolute',
                left,
                top,
                display: 'flex',
                gap: 10,
                padding: 6,
                borderRadius: 999,
                background: '#08111fcc',
                border: `1px solid ${t.towerDef.color}55`,
                boxShadow: '0 10px 24px #00000066',
                zIndex: 5,
              }}>
                {canUpgrade && (
                  <button
                    type="button"
                    onClick={() => upgradeTower(t)}
                    title={`Upgrade for ${upgradeCost} gold`}
                    disabled={goldRef.current < upgradeCost}
                    style={iconButtonStyle('#7c5dff', goldRef.current < upgradeCost)}
                  >
                    ↑
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => sellTower(t)}
                  title={`Sell for ${sellValue} gold`}
                  style={iconButtonStyle('#fb7185')}
                >
                  $
                </button>
              </div>
            )
          })()}

          {/* Enemies */}
          {uiEnemies.map(e => {
            const isFinalBoss = e.isBoss && uiStage === MAX_STAGES
            const bossScale = isFinalBoss ? 1.6 : e.isBoss ? 1.35 : 1
            const sz = (cell - 8) * bossScale
            const borderColor = isFinalBoss ? '#cc00ff' : e.isBoss ? '#ff0000' : (e.slowTimer > 0 ? '#60a5fa' : '#fb7185')
            const shadow = isFinalBoss ? '0 0 22px 8px #cc00ffaa, 0 0 44px 12px #ff000066' : e.isBoss ? '0 0 14px 4px #ff000099' : 'none'
            const hitFlashOpacity = e.hitFlash > 0 ? Math.min(1, e.hitFlash * 10) : 0  // fade out over 100ms
            const freezeOpacity = e.slowTimer > 0 ? Math.min(0.78, e.slowTimer / 2.5) : 0
            return (
            <div key={e.id} style={{
              position: 'absolute',
              left: e.x * cell, top: e.y * cell,
              width: cell * bossScale, height: cell * bossScale,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
              transform: `translate(${e.isBoss ? -cell*(bossScale-1)/2 : -2}px,${e.isBoss ? -cell*(bossScale-1)/2 : -2}px)`,
            }}>
              {isFinalBoss && <div style={{ fontSize: cell * 0.42, lineHeight: 1, marginBottom: 1 }}>💀</div>}
              {e.isBoss && !isFinalBoss && <div style={{ fontSize: cell * 0.35, lineHeight: 1, marginBottom: 1 }}>�</div>}
              <div style={{ width: cell * bossScale - 6, height: e.isBoss ? 5 : 3, background: '#333', borderRadius: 2, marginBottom: 2 }}>
                <div style={{ width: `${Math.max(0, e.hp / e.maxHp) * 100}%`, height: '100%', background: e.hp / e.maxHp > 0.5 ? '#34d399' : e.hp / e.maxHp > 0.25 ? '#ffd666' : '#fb7185', borderRadius: 2 }} />
              </div>
              <div style={{
                width: sz, height: sz,
                borderRadius: '50%',
                overflow: 'hidden',
                border: `${isFinalBoss ? 4 : e.isBoss ? 3 : 2}px solid ${borderColor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isFinalBoss ? '#1a001a' : '#111',
                boxShadow: shadow,
                filter: hitFlashOpacity > 0 ? `brightness(1.5) saturate(2) hue-rotate(-10deg)` : 'none',
              }}>
                <AlienShip variant={e.id % 4} isBoss={e.isBoss} isFinalBoss={isFinalBoss} color={borderColor} size={Math.max(8, Math.round(sz - 4))} />
                {freezeOpacity > 0 && (
                  <>
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      background: `radial-gradient(circle at 30% 30%, #ffffffbb 0%, #c6efff88 28%, #7dd3fc55 60%, transparent 100%)`,
                      opacity: freezeOpacity,
                    }} />
                    <div style={{
                      position: 'absolute',
                      inset: 3,
                      borderRadius: '50%',
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
                <div style={{ fontSize: cell * 0.2, color: '#cc00ff', fontWeight: 900, lineHeight: 1, marginTop: 1, textShadow: '0 0 6px #cc00ff' }}>SIEGE</div>
              )}
            </div>
            )
          })}

          {/* Bullets */}
          {uiBullets.map(b => {
            const tt = b.towerType
            // Compute travel angle for elongated projectiles
            const angle = Math.atan2(b.ty - b.y, b.tx - b.x) * 180 / Math.PI

            if (tt === 'rocket' || tt === 'artillery') {
              // 🚀 Rocket / Artillery shell — elongated with flame trail
              const isArtillery = tt === 'artillery'
              return (
                <div key={b.id} style={{
                  position: 'absolute',
                  left: b.x * cell, top: b.y * cell,
                  width: isArtillery ? 18 : 14,
                  height: isArtillery ? 8 : 6,
                  background: isArtillery
                    ? 'linear-gradient(90deg, #ff8800, #ffcc00)'
                    : 'linear-gradient(90deg, #ff0000, #ff6600)',
                  borderRadius: '50% 20% 20% 50%',
                  boxShadow: isArtillery
                    ? '0 0 14px 5px #ff880099, 0 0 28px 8px #ff440055'
                    : '0 0 18px 6px #ff000099, 0 0 36px 8px #ff660088',
                  transform: `translate(-50%,-50%) rotate(${angle}deg)`,
                  pointerEvents: 'none',
                }}>
                  {/* flame exhaust */}
                  <div style={{
                    position: 'absolute', right: '100%', top: '15%',
                    width: isArtillery ? 10 : 8, height: isArtillery ? 6 : 4,
                    background: isArtillery
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
          {uiParticles.map((p, idx) => {
            const styles: Record<ParticleType, { color: string; glow: string; size: number }> = {
              death: { color: '#ff6b6b', glow: '#ff6b6bcc', size: 6 },
              build: { color: '#18e6c4', glow: '#18e6c4cc', size: 6 },
              sell: { color: '#ffd666', glow: '#ffd666cc', size: 6 },
              gold: { color: '#ffd666', glow: '#ffd666cc', size: 6 },
              impact: { color: '#f8fafc', glow: '#f59e0bcc', size: 4 },
              freeze: { color: '#d8f3ff', glow: '#7dd3fccc', size: 5 },
            }
            const style = styles[p.type]
            const progress = p.life / p.maxLife
            const opacity = Math.max(0, 1 - progress)
            const scale = p.type === 'impact' ? (1.15 - progress * 0.5) : (1 - progress * 0.35)
            return (
              <div key={`p-${idx}`} style={{
                position: 'absolute',
                left: p.x * cell, top: p.y * cell,
                width: style.size, height: style.size,
                borderRadius: '50%',
                background: style.color,
                boxShadow: `0 0 6px ${style.glow}`,
                opacity,
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
          {uiExplosions.map((exp, idx) => {
            const progress = exp.time / exp.maxTime
            const scale = 1 + progress * 0.3
            const opacity = Math.max(0, 1 - progress)
            const colors = {
              aoe: { inner: '#ffd66688', outer: '#ffd666' },
              rocket: { inner: '#ff444488', outer: '#ff0000' },
              heavy: { inner: '#ff880044', outer: '#ff8800' },
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
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.80)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
            }}>
              {uiEndless
                ? <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ff8800' }}>🔥 Endless Stage {uiStage} Clear!</div>
                : <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#ffd666' }}>🏅 Stage {uiStage} Complete!</div>}
              <div style={{ color: '#ddd', fontSize: '0.95rem', textAlign: 'center', padding: '0 20px' }}>
                Gold carries over · Towers on new path refunded 70%{uiEndless ? <><br/><span style={{color:'#ff8800'}}>Enemies keep scaling… can you hold?</span></> : <><br/>A new path awaits you…</>}
              </div>
              <button onClick={advanceStage} style={btnStyle(uiEndless ? '#ff8800' : '#18e6c4', '#000', true)}>
                {uiEndless ? `🔥 Endless Stage ${uiStage + 1} →` : `Enter Stage ${uiStage + 1} →`}
              </button>
            </div>
          )}

          {/* Spawn portals */}
          {spawnPortals.map((portal, idx) => {
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
          {towerActionBursts.map((burst, idx) => {
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
          {coinFlows.map((flow, idx) => {
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
            const scaleProgress = progress < 0.5 ? (progress * 2) : (1 - (progress - 0.5) * 2)
            const scale = 0.5 + scaleProgress * 0.5
            const opacity = progress < 0.3 ? (progress / 0.3) : (progress > 0.7 ? (1 - (progress - 0.7) / 0.3) : 1)
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
          {victoryEffect && Array.from({ length: 20 }).map((_, idx) => {
            const angle = (Math.PI * 2 * idx) / 20 + (Math.random() - 0.5) * 0.5
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
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
            }}>
              {uiState === 'victory' ? (
                <>
                  <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#18e6c4' }}>🏆 VICTORY!</div>
                  <div style={{ color: '#ddd', fontSize: '0.95rem' }}>All 10 stages conquered!</div>
                  <div style={{ color: '#ffd666', fontWeight: 800, fontSize: '1.1rem' }}>Score: {uiScore.toLocaleString()}</div>
                  <div style={{ color: '#aaa', fontSize: '0.85rem' }}>Best: {uiHighScore.toLocaleString()}</div>
                  <button onClick={enterEndless} style={btnStyle('#ff8800', '#000', true)}>🔥 Enter Endless Mode</button>
                  <button onClick={restart} style={btnStyle('#18e6c4', '#000', true)}>↺ Play Again</button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fb7185' }}>💥 GAME OVER</div>
                  <div style={{ color: '#ddd', fontSize: '1.1rem' }}>Score: <b style={{ color: '#ffd666' }}>{uiScore.toLocaleString()}</b></div>
                  <div style={{ color: '#aaa', fontSize: '0.9rem' }}>Best: {uiHighScore.toLocaleString()}</div>
                  <button onClick={restart} style={btnStyle('#18e6c4', '#000', true)}>↺ Play Again</button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ flex: 1, minWidth: 130, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ color: '#aaa', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Deploy Ship</div>
          {TOWER_TYPES.map(t => (
            <button
              key={t.key}
              onClick={() => { setSelectedTowerKey(t.key as TowerKey); setSelectedTowerOnGrid(null) }}
              style={{
                background: selectedTowerKey === t.key ? t.color + '33' : '#111',
                border: `2px solid ${selectedTowerKey === t.key ? t.color : '#333'}`,
                borderRadius: 8, padding: '6px 8px', cursor: 'pointer',
                color: '#fff', textAlign: 'left', transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 800, color: t.color, fontSize: '0.85rem' }}>{t.label}</span>
                <span style={{ color: '#ffd666', fontSize: '0.8rem' }}>💰{t.cost}</span>
              </div>
              <div style={{ color: '#888', fontSize: '0.7rem', marginTop: 2 }}>{t.desc}</div>
            </button>
          ))}

          {selectedTowerOnGrid && (
            <div style={{ marginTop: 8, background: '#111', border: `2px solid ${selectedTowerOnGrid.towerDef.color}`, borderRadius: 8, padding: 10 }}>
              <div style={{ color: selectedTowerOnGrid.towerDef.color, fontWeight: 800, fontSize: '0.9rem' }}>{selectedTowerOnGrid.towerDef.label} Lv{selectedTowerOnGrid.level}</div>
              <div style={{ color: '#aaa', fontSize: '0.75rem', margin: '4px 0' }}>DMG: {(selectedTowerOnGrid.towerDef.dmg * (1 + (selectedTowerOnGrid.level - 1) * 0.5)).toFixed(0)} | Range: {selectedTowerOnGrid.towerDef.range}</div>
              <div style={{ color: '#7b8797', fontSize: '0.72rem' }}>
                Use the board icons above the tower to upgrade or sell quickly.
              </div>
            </div>
          )}

          <div style={{ marginTop: 'auto', color: '#555', fontSize: '0.7rem', lineHeight: 1.5 }}>
            <div>• Click empty cell to place</div>
            <div>• Click ship to inspect/sell</div>
            <div>• Start each wave manually</div>
            <div>• Aliens reach 🌍 → lose life</div>
            <div>• 👾 Wave 5 = Boss wave</div>
            <div>• Boss leak = −3 lives!</div>
            <div>• Credits carry to next stage</div>
            <div>• Stage 10 = all mothership waves</div>
            <div style={{ color: '#cc00ff', marginTop: 4 }}>• 💀💥 Mothership SMASHES</div>
            <div style={{ color: '#cc00ff' }}>&nbsp;&nbsp;nearby ships every 4.5s!</div>
            <div style={{ color: '#ff8800', marginTop: 4 }}>• 🔥 Beat stage 10 → Endless!</div>
            <div style={{ color: '#555' }}>• ⚡ Some aliens run faster</div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function StatPill({ icon, val, color }: { icon: string; val: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#111', border: `1px solid ${color}44`, borderRadius: 20, padding: '3px 10px' }}>
      <span>{icon}</span>
      <span style={{ color, fontWeight: 800, fontSize: '0.9rem' }}>{typeof val === 'number' ? val.toLocaleString() : val}</span>
    </div>
  )
}

function btnStyle(bg: string, color: string, bold = false): React.CSSProperties {
  return {
    background: bg, color, border: 'none', borderRadius: 8,
    padding: '6px 14px', cursor: 'pointer', fontWeight: bold ? 800 : 600,
    fontSize: '0.85rem', transition: 'opacity 0.15s', fontFamily: 'inherit',
  }
}
