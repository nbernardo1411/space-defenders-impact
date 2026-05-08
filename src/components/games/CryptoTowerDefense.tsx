import { useCallback, useEffect, useId, useRef, useState } from 'react'
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
  { key: 'fast',      label: 'Scout',    color: '#00fff2', range: 2.0, dmg: 8,   rate: 0.5,  cost: 60,   desc: 'High fire rate, short range' },
  { key: 'sniper',    label: 'Rail Gun', color: '#7c5dff', range: 10,  dmg: 45,  rate: 3.5,  cost: 120,  desc: 'Long range, heavy piercing shot' },
  { key: 'aoe',       label: 'Bomber',   color: '#ffd666', range: 2.5, dmg: 20,  rate: 1.8,  cost: 100,  desc: 'Plasma splash, hits nearby aliens' },
  { key: 'slow',      label: 'Cryo',     color: '#5e53ff', range: 2.8, dmg: 6,   rate: 1.2,  cost: 80,   desc: 'Freeze beam, slows aliens 50%' },
  { key: 'burst',     label: 'Cannon',   color: '#f99b45', range: 4.0, dmg: 170, rate: 5.0,  cost: 200,  desc: 'High burst, slow reload' },
  { key: 'gatling',   label: 'Gatling',  color: '#00ff0d', range: 4,   dmg: 4,   rate: 0.1,  cost: 400,  desc: 'Rapid-fire chain guns' },
  { key: 'rocket',    label: 'Rocket',   color: '#ff0000', range: 6,   dmg: 250, rate: 12.0, cost: 600,  desc: 'Massive AOE blast, 12s reload' },
  { key: 'laser',     label: 'Laser',    color: '#dbecff', range: 4.5, dmg: 3,   rate: 0.01, cost: 2000, desc: 'Beam 10s · exhaust 5s · 300 DPS pierce' },
  { key: 'artillery', label: 'Orbital',  color: '#ff8800', range: 999, dmg: 250, rate: 7.0,  cost: 3500, desc: 'Global range · 3 orbital strikes' },
] as const
type TowerKey = typeof TOWER_TYPES[number]['key']

const ENEMY_COLORS = ['#ff5f8a', '#ff944d', '#ffd84d', '#71f79f', '#4dd8ff', '#8f7cff', '#ff74d4'] as const

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
  tint: string
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
  xp: number
  aimAngle: number
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
  towerId: number
  dmg: number
  isAoe: boolean
  isSlow: boolean
  isRocket: boolean
  isHeavy: boolean
  isHoming: boolean
  towerType: string
  dead: boolean
}

type GameState = 'idle' | 'playing' | 'wave' | 'stage_complete' | 'gameover' | 'victory'
type ParticleType = 'death' | 'build' | 'sell' | 'gold' | 'impact' | 'freeze'
const MAX_TOWER_LEVEL = 5

function xpNeededForNextLevel(level: number) {
  // 64 -> 86 -> 108 -> 130 XP (Lv1->2..Lv4->5): keeps auto-leveling meaningful but not too fast.
  return 42 + level * 22
}

// ─── Cell size calculation ─────────────────────────────────────────────────────
function calcCell() {
  if (typeof window === 'undefined') return 44
  const isDesktop = window.innerWidth > 900
  // Reserve room for HUD + side shop on desktop, and for vertical chrome on smaller screens.
  const reservedWidth = isDesktop ? 240 : 24
  const reservedHeight = isDesktop ? 140 : 260
  const byWidth = (window.innerWidth - reservedWidth) / COLS
  const byHeight = (window.innerHeight - reservedHeight) / ROWS
  const target = Math.min(byWidth, byHeight)
  const minCell = isDesktop ? 32 : 28
  const maxCell = isDesktop ? 72 : 48
  return Math.floor(Math.max(minCell, Math.min(maxCell, target)))
}

// ─── Lerp helper ──────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number) { return a + (b - a) * t }

function angleToDeg(fromX: number, fromY: number, toX: number, toY: number) {
  return Math.atan2(toY - fromY, toX - fromX) * 180 / Math.PI + 90
}

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

// ─── Top-view Sprite Models ───────────────────────────────────────────────────
function TowerShip({ tType, color, size }: { tType: string; color: string; size: number }) {
  const s = size
  const svgId = useId().replace(/:/g, '')
  const paintGrad = `tower-paint-${svgId}`
  const hullGrad = `tower-hull-${svgId}`
  const glassGrad = `tower-glass-${svgId}`
  const engineGrad = `tower-engine-${svgId}`

  const core = color
  const hull = `url(#${hullGrad})`
  const paint = `url(#${paintGrad})`
  const glass = `url(#${glassGrad})`
  const engine = `url(#${engineGrad})`
  const dark = '#172130'
  const metal = '#617086'

  const defs = (
    <defs>
      <linearGradient id={hullGrad} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#f8fbff" />
        <stop offset="55%" stopColor="#ced9e7" />
        <stop offset="100%" stopColor="#7e8ea5" />
      </linearGradient>
      <linearGradient id={paintGrad} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
        <stop offset="18%" stopColor={core} stopOpacity="0.98" />
        <stop offset="100%" stopColor={core} stopOpacity="0.4" />
      </linearGradient>
      <linearGradient id={glassGrad} x1="0" y1="0" x2="0.7" y2="1">
        <stop offset="0%" stopColor="#f8feff" />
        <stop offset="40%" stopColor="#9cecff" />
        <stop offset="100%" stopColor="#2f6f9e" />
      </linearGradient>
      <radialGradient id={engineGrad} cx="0.5" cy="0.45" r="0.7">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
        <stop offset="28%" stopColor="#b9f6ff" stopOpacity="0.95" />
        <stop offset="68%" stopColor="#4ee0ff" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#4ee0ff" stopOpacity="0" />
      </radialGradient>
    </defs>
  )

  // ── Shared reusable micro-elements ────────────────────────────────────────
  // 2-engine glow nozzles at rear
  const eng2 = <>
    <ellipse cx="26" cy="57" rx="4.5" ry="6" fill={engine} opacity="0.92" />
    <ellipse cx="38" cy="57" rx="4.5" ry="6" fill={engine} opacity="0.92" />
  </>
  // 3-engine cluster at rear
  const eng3 = <>
    <ellipse cx="23" cy="57" rx="3.8" ry="5" fill={engine} opacity="0.88" />
    <ellipse cx="32" cy="59" rx="3.5" ry="4.5" fill={engine} opacity="0.92" />
    <ellipse cx="41" cy="57" rx="3.8" ry="5" fill={engine} opacity="0.88" />
  </>

  const shapes: Record<string, React.ReactNode> = {

    // ── SCOUT: X-Wing quad interceptor ── 4 spread wings + 4 laser cannons ──
    fast: <>
      {/* Fuselage spine */}
      <path d="M30 4 L34 4 L36 15 L36 52 L32 63 L28 52 L28 15 Z" fill={hull} />
      <path d="M30.5 7 L33.5 7 L35 17 L35 48 L32 57 L29 48 L29 17 Z" fill={paint} opacity="0.9" />
      {/* Forward-port wing — swept back */}
      <path d="M30 18 L29 29 L3 22 L1 14 L9 11 Z" fill={hull} />
      {/* Forward-stbd wing */}
      <path d="M34 18 L35 29 L61 22 L63 14 L55 11 Z" fill={hull} />
      {/* Aft-port wing */}
      <path d="M28.5 33 L27 44 L2 49 L1 41 L7 37 Z" fill={hull} />
      {/* Aft-stbd wing */}
      <path d="M35.5 33 L37 44 L62 49 L63 41 L57 37 Z" fill={hull} />
      {/* Color accent stripes */}
      <path d="M8 12 L28 22" stroke={core} strokeWidth="5" strokeLinecap="butt" />
      <path d="M56 12 L36 22" stroke={core} strokeWidth="5" strokeLinecap="butt" />
      <path d="M7 42 L26 42.5" stroke={core} strokeWidth="4.5" strokeLinecap="butt" />
      <path d="M57 42 L38 42.5" stroke={core} strokeWidth="4.5" strokeLinecap="butt" />
      {/* 4 laser cannon barrels at wing tips */}
      <line x1="-1" y1="15" x2="9" y2="15" stroke={metal} strokeWidth="3.2" strokeLinecap="square" />
      <line x1="55" y1="15" x2="65" y2="15" stroke={metal} strokeWidth="3.2" strokeLinecap="square" />
      <line x1="-1" y1="41.5" x2="8" y2="41.5" stroke={metal} strokeWidth="3.2" strokeLinecap="square" />
      <line x1="56" y1="41.5" x2="65" y2="41.5" stroke={metal} strokeWidth="3.2" strokeLinecap="square" />
      {/* Cockpit canopy */}
      <path d="M30 10 C28 13 28 21 32 23 C36 21 36 13 34 10 Z" fill={glass} opacity="0.95" />
      {/* Panel seam */}
      <path d="M26 33 L32 30 L38 33" stroke="#ffffff7a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {eng2}
    </>,

    // ── RAIL GUN: SR-71 stealth delta ── ultra-long barrel + swept wings ─────
    sniper: <>
      {/* Narrow spine hull */}
      <path d="M32 4 L38 9 L42 20 L46 34 L42 59 L22 59 L18 34 L22 20 L26 9 Z" fill={hull} />
      <path d="M32 7 L37 11 L40 21 L43 33 L39 54 L25 54 L21 33 L24 21 L27 11 Z" fill={paint} opacity="0.92" />
      {/* Ultra-long barrel pair extending past nose */}
      <rect x="30.5" y="-5" width="2.5" height="22" rx="1.2" fill={dark} />
      <rect x="31" y="-4" width="2" height="21" rx="1" fill="#9bb0c5" opacity="0.75" />
      {/* Swept-back delta wings — sharply angled */}
      <path d="M27 21 L21 13 L2 45 L4 52 L17 49 L26 35 Z" fill={hull} />
      <path d="M37 21 L43 13 L62 45 L60 52 L47 49 L38 35 Z" fill={hull} />
      {/* Wing color bar near fuselage */}
      <path d="M6 48 L18 40 L25 40" stroke={core} strokeWidth="4.5" strokeLinecap="square" />
      <path d="M58 48 L46 40 L39 40" stroke={core} strokeWidth="4.5" strokeLinecap="square" />
      {/* Scope block on barrel */}
      <rect x="28" y="10" width="8" height="6" rx="1.5" fill={dark} />
      <rect x="29.5" y="11" width="5" height="4" rx="1" fill="#9bb0c5" opacity="0.65" />
      {/* Cockpit */}
      <path d="M30.5 13 L29 16 L29 22 L32 23.5 L35 22 L35 16 L33.5 13 Z" fill={glass} />
      {eng3}
    </>,

    // ── BOMBER: Rocket-style strike craft ── pointed hull + hard wing pods ──
    aoe: <>
      {/* Pointed center fuselage, similar language to Rocket */}
      <path d="M30 5 L34 5 L37 15 L38 51 L32 62 L26 51 L27 15 Z" fill={hull} />
      <path d="M30.5 8 L33.5 8 L35.5 16 L36 47 L32 56 L28 47 L28.5 16 Z" fill={paint} opacity="0.9" />
      {/* Broad swept wings */}
      <path d="M29 20 L25 45 L4 52 L2 44 L16 33 L24 26 Z" fill={hull} />
      <path d="M35 20 L39 45 L60 52 L62 44 L48 33 L40 26 Z" fill={hull} />
      {/* Twin bomb racks each side (all angular) */}
      <path d="M5 28 L12 28 L13 41 L6 45 L4 38 Z" fill={dark} />
      <path d="M14 33 L21 33 L22 45 L16 48 L13 42 Z" fill={dark} />
      <path d="M59 28 L52 28 L51 41 L58 45 L60 38 Z" fill={dark} />
      <path d="M50 33 L43 33 L42 45 L48 48 L51 42 Z" fill={dark} />
      {/* Warhead tips */}
      <path d="M6 28 L9 22 L12 28" fill={core} opacity="0.9" />
      <path d="M15 33 L18 27 L21 33" fill={core} opacity="0.82" />
      <path d="M58 28 L55 22 L52 28" fill={core} opacity="0.9" />
      <path d="M49 33 L46 27 L43 33" fill={core} opacity="0.82" />
      {/* Angular bomb bay hatch */}
      <path d="M32 25 L38 31 L32 37 L26 31 Z" fill={dark} opacity="0.92" />
      <path d="M32 27 L35.5 31 L32 35 L28.5 31 Z" fill="#fff8b0" opacity="0.9" />
      {/* Spine panel */}
      <path d="M29 30 L32 28 L35 30 L35 44 L32 47 L29 44 Z" fill="#ffffff24" />
      {eng2}
    </>,

    // ── CRYO: Sharp arrowhead fighter ── angular ice prism, swept wings ──────
    slow: <>
      {/* Sharp arrowhead fuselage — no blobs */}
      <path d="M32 5 L40 12 L44 24 L42 50 L36 60 L28 60 L22 50 L20 24 L24 12 Z" fill={hull} />
      <path d="M32 8 L38 14 L41 24 L39 46 L35 55 L29 55 L25 46 L23 24 L26 14 Z" fill={paint} opacity="0.9" />
      {/* Swept cryo wings */}
      <path d="M23 24 L18 16 L1 34 L3 42 L21 38 L24 30 Z" fill={hull} />
      <path d="M41 24 L46 16 L63 34 L61 42 L43 38 L40 30 Z" fill={hull} />
      {/* Wing color accent */}
      <path d="M4 39 L18 32 L23 32" stroke={core} strokeWidth="4" strokeLinecap="square" />
      <path d="M60 39 L46 32 L41 32" stroke={core} strokeWidth="4" strokeLinecap="square" />
      {/* Forward ice prism emitter — sharp diamond, NO circles */}
      <path d="M32 5 L37 14 L32 21 L27 14 Z" fill="#d8fbff" opacity="0.92" />
      <path d="M32 8 L35 14 L32 19 L29 14 Z" fill="#ffffff" opacity="0.95" />
      {/* Ice beam spine down fuselage */}
      <line x1="32" y1="21" x2="32" y2="44" stroke="#a8f5ff" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      {/* Ice exhaust jets */}
      <path d="M23 49 L18 59" stroke="#a8f5ffcc" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M41 49 L46 59" stroke="#a8f5ffcc" strokeWidth="2.4" strokeLinecap="round" />
      <ellipse cx="26" cy="57" rx="4" ry="5.5" fill={engine} opacity="0.88" />
      <ellipse cx="38" cy="57" rx="4" ry="5.5" fill={engine} opacity="0.88" />
    </>,

    // ── CANNON: Heavy gunship ── swept attack wings + massive triple cannon ──
    burst: <>
      {/* Central armored fuselage */}
      <path d="M26 8 H38 L43 16 L44 44 L38 60 H26 L20 44 L21 16 Z" fill={hull} />
      <path d="M28 11 H36 L40 18 L41 41 L36 55 H28 L24 41 L23 18 Z" fill={paint} opacity="0.9" />
      {/* Triple-barrel forward cannon */}
      <rect x="27.5" y="-5" width="9" height="24" rx="3" fill={dark} />
      <rect x="28.5" y="-4" width="7" height="22" rx="2.5" fill="#8797a9" opacity="0.84" />
      <rect x="30" y="-2" width="4" height="20" rx="2" fill="#c4cedb" opacity="0.72" />
      {/* Wide swept attack wings — proper fighter wings */}
      <path d="M22 17 L18 10 L1 31 L3 42 L22 37 L24 27 Z" fill={hull} />
      <path d="M42 17 L46 10 L63 31 L61 42 L42 37 L40 27 Z" fill={hull} />
      {/* Wing weapon hardpoints */}
      <path d="M3 31 L16 28 L20 35 L4 39 Z" fill={dark} />
      <path d="M61 31 L48 28 L44 35 L60 39 Z" fill={dark} />
      <rect x="3" y="31" width="13" height="5" rx="1.5" fill={core} opacity="0.82" />
      <rect x="48" y="31" width="13" height="5" rx="1.5" fill={core} opacity="0.82" />
      {/* Wing color accent */}
      <path d="M4 38 L18 33 L22 33" stroke={core} strokeWidth="4" strokeLinecap="square" />
      <path d="M60 38 L46 33 L42 33" stroke={core} strokeWidth="4" strokeLinecap="square" />
      {/* Cockpit slit */}
      <path d="M27 13 H37 L38.5 15 V20 L37 21.5 H27 L25.5 20 V15 Z" fill={glass} opacity="0.88" />
      {eng3}
    </>,

    // ── GATLING: Assault striker ── rocket-like frame + 6 forward barrels ───
    gatling: <>
      {/* Rocket-like center hull with pointed nose */}
      <path d="M29 4 L35 4 L38 15 L39 50 L32 62 L25 50 L26 15 Z" fill={hull} />
      <path d="M29.5 7 L34.5 7 L36.5 16 L37 46 L32 56 L27 46 L27.5 16 Z" fill={paint} opacity="0.9" />
      {/* Heavy swept wings with hard edges */}
      <path d="M28 20 L24 43 L5 50 L2 42 L15 33 L23 26 Z" fill={hull} />
      <path d="M36 20 L40 43 L59 50 L62 42 L49 33 L41 26 Z" fill={hull} />
      {/* Side weapon sponsons */}
      <path d="M6 29 L14 29 L15 41 L8 45 L5 39 Z" fill={dark} />
      <path d="M58 29 L50 29 L49 41 L56 45 L59 39 Z" fill={dark} />
      {/* 6 gatling barrels in a broad rack */}
      <rect x="18" y="-6" width="3" height="20" fill={dark} />
      <rect x="22" y="-7" width="3" height="22" fill="#9bb0c5" />
      <rect x="26" y="-6" width="3" height="20" fill={dark} />
      <rect x="35" y="-6" width="3" height="20" fill={dark} />
      <rect x="39" y="-7" width="3" height="22" fill="#9bb0c5" />
      <rect x="43" y="-6" width="3" height="20" fill={dark} />
      {/* Barrel rack braces */}
      <rect x="17" y="4" width="30" height="4" fill={metal} opacity="0.82" />
      <rect x="17" y="10" width="30" height="3" fill={metal} opacity="0.62" />
      {/* Spine accents */}
      <path d="M29 31 L32 29 L35 31 L35 45 L32 48 L29 45 Z" fill="#ffffff24" />
      <path d="M8 44 L22 37" stroke={core} strokeWidth="4.5" strokeLinecap="square" />
      <path d="M56 44 L42 37" stroke={core} strokeWidth="4.5" strokeLinecap="square" />
      {eng3}
    </>,

    // ── ROCKET: Swept missile destroyer ── 4 visible pods + warhead tips ────
    rocket: <>
      {/* Central fuselage */}
      <path d="M30 5 L34 5 L36 14 L37 52 L32 62 L27 52 L28 14 Z" fill={hull} />
      <path d="M30.5 8 L33.5 8 L35 15 L35.5 48 L32 56 L28.5 48 L29 15 Z" fill={paint} opacity="0.9" />
      {/* Wide swept wings */}
      <path d="M30 21 L28 46 L5 51 L2 43 L18 33 L27 25 Z" fill={hull} />
      <path d="M34 21 L36 46 L59 51 L62 43 L46 33 L37 25 Z" fill={hull} />
      {/* 4 missile pods (angular, NOT circles) */}
      <path d="M4 27 L13 27 L13 46 L6 46 L3 38 Z" fill={dark} />
      <path d="M15 32 L23 32 L23 48 L17 48 L14 41 Z" fill={dark} />
      <path d="M51 27 L60 27 L61 38 L58 46 L51 46 Z" fill={dark} />
      <path d="M41 32 L49 32 L50 41 L47 48 L41 48 Z" fill={dark} />
      {/* Missile warhead tips */}
      <path d="M6 27 L8.5 21 L11 27" fill={core} opacity="0.92" />
      <path d="M17 32 L19.5 26 L22 32" fill={core} opacity="0.82" />
      <path d="M53 27 L56 21 L59 27" fill={core} opacity="0.92" />
      <path d="M43 32 L45.5 26 L48 32" fill={core} opacity="0.82" />
      {/* Nose cannon */}
      <rect x="30" y="1" width="4" height="16" rx="2" fill="#9bb0c5" />
      {/* Cockpit */}
      <path d="M29.5 9 L29 11 L29 20 L32 22 L35 20 L35 11 L34.5 9 Z" fill={glass} />
      {eng2}
    </>,

    // ── LASER: Kite/diamond hull ── angular prism emitter, swept fins ────────
    laser: <>
      {/* Diamond kite hull */}
      <path d="M32 4 L44 15 L47 30 L42 50 L32 62 L22 50 L17 30 L20 15 Z" fill={hull} />
      <path d="M32 7 L41 16 L44 29 L39 46 L32 55 L25 46 L20 29 L23 16 Z" fill={paint} opacity="0.9" />
      {/* Long swept-back wing fins */}
      <path d="M22 17 L4 48 L8 55 L22 45 L26 32 Z" fill={hull} />
      <path d="M42 17 L60 48 L56 55 L42 45 L38 32 Z" fill={hull} />
      {/* Wing accent */}
      <path d="M7 51 L20 41 L24 41" stroke={core} strokeWidth="3.5" strokeLinecap="square" />
      <path d="M57 51 L44 41 L40 41" stroke={core} strokeWidth="3.5" strokeLinecap="square" />
      {/* Angular prism emitter at nose tip — NO circles */}
      <path d="M32 4 L37 11 L34 14 L30 14 L27 11 Z" fill="#c8f6ff" opacity="0.96" />
      <path d="M32 6 L35.5 11 L33.5 13 L30.5 13 L28.5 11 Z" fill="#ffffff" opacity="0.9" />
      {/* Energy beam spine */}
      <line x1="32" y1="14" x2="32" y2="24" stroke="#a0f4ff" strokeWidth="3.2" strokeLinecap="round" opacity="0.9" />
      <line x1="32" y1="24" x2="32" y2="44" stroke="#a0f4ff" strokeWidth="1.6" strokeLinecap="round" opacity="0.4" />
      {/* Wing fin exhaust tips */}
      <path d="M10 53 L5 61" stroke={core} strokeWidth="3" strokeLinecap="round" />
      <path d="M54 53 L59 61" stroke={core} strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="26" cy="58" rx="4.5" ry="5.5" fill={engine} opacity="0.9" />
      <ellipse cx="38" cy="58" rx="4.5" ry="5.5" fill={engine} opacity="0.9" />
    </>,

    // ── ORBITAL: Triple-missile cruiser ── rocket body + 3 launch rails ─────
    artillery: <>
      {/* Rocket-like capital hull with pointed nose */}
      <path d="M30 4 L34 4 L40 14 L43 30 L40 49 L34 62 L30 62 L24 49 L21 30 L24 14 Z" fill={hull} />
      <path d="M30.5 7 L33.5 7 L38 16 L40 30 L37.5 46 L33.5 56 L30.5 56 L26.5 46 L24 30 L26 16 Z" fill={paint} opacity="0.88" />
      {/* Large support wings like Rocket class */}
      <path d="M25 22 L21 44 L4 50 L2 42 L15 33 L20 27 Z" fill={hull} />
      <path d="M39 22 L43 44 L60 50 L62 42 L49 33 L44 27 Z" fill={hull} />
      {/* 3 launch rails / silos across center */}
      <path d="M14 21 L22 21 L22 45 L14 45 Z" fill={dark} />
      <path d="M28 17 L36 17 L36 46 L28 46 Z" fill={dark} />
      <path d="M42 21 L50 21 L50 45 L42 45 Z" fill={dark} />
      {/* 3 rocket warheads */}
      <path d="M14 21 L18 13 L22 21" fill={core} opacity="0.9" />
      <path d="M28 17 L32 8 L36 17" fill={core} opacity="0.98" />
      <path d="M42 21 L46 13 L50 21" fill={core} opacity="0.9" />
      {/* Rail separators */}
      <line x1="24" y1="20" x2="24" y2="46" stroke="#ffffff3d" strokeWidth="1.4" />
      <line x1="40" y1="20" x2="40" y2="46" stroke="#ffffff3d" strokeWidth="1.4" />
      {/* Targeting chevron */}
      <path d="M32 48 L36 52 L32 56 L28 52 Z" fill="#fff5bc" opacity="0.8" />
      <path d="M26 52 L32 49 L38 52" stroke="#ffffff9a" strokeWidth="1.5" fill="none" />
      {eng3}
    </>,
  }

  return (
    <svg width={s} height={s} viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 4px 10px #000a)' }}>
      {defs}
      {shapes[tType] ?? shapes.fast}
    </svg>
  )
}

function AlienShip({ variant, isBoss, isFinalBoss, color, size }: { variant: number; isBoss: boolean; isFinalBoss: boolean; color: string; size: number }) {
  const s = Math.max(8, size)
  const svgId = useId().replace(/:/g, '')
  const shellGrad = `alien-shell-${svgId}`
  const paintGrad = `alien-paint-${svgId}`
  const eyeGrad = `alien-eye-${svgId}`
  const c = color
  const shell = `url(#${shellGrad})`
  const paint = `url(#${paintGrad})`
  const eye = `url(#${eyeGrad})`
  const dark = '#0e0817'
  const spine = '#2c173a'

  const defs = (
    <defs>
      <linearGradient id={shellGrad} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#5a2e72" />
        <stop offset="55%" stopColor="#2a1040" />
        <stop offset="100%" stopColor="#100818" />
      </linearGradient>
      <linearGradient id={paintGrad} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffe6f8" stopOpacity="0.88" />
        <stop offset="18%" stopColor={c} stopOpacity="0.98" />
        <stop offset="100%" stopColor={c} stopOpacity="0.38" />
      </linearGradient>
      <radialGradient id={eyeGrad} cx="0.5" cy="0.42" r="0.72">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="28%" stopColor="#fffacd" />
        <stop offset="62%" stopColor="#7ef5ff" />
        <stop offset="100%" stopColor="#7ef5ff" stopOpacity="0" />
      </radialGradient>
    </defs>
  )

  // ── FINAL BOSS: Biomechanical star fortress ──────────────────────────────
  if (isFinalBoss) {
    return (
      <svg width={s} height={s} viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 6px 16px #000a)' }}>
        {defs}
        {/* Outer star-fortress hull — 8 spiked points */}
        <path d="M32 2 L38 12 L50 8 L46 20 L60 22 L52 31 L60 40 L46 42 L50 54 L38 50 L32 62 L26 50 L14 54 L18 42 L4 40 L12 31 L4 22 L18 20 L14 8 L26 12 Z" fill={shell} />
        {/* Inner armored hull */}
        <path d="M32 8 L36 15 L46 12 L43 21 L52 23 L46 30 L52 37 L43 39 L46 48 L36 45 L32 52 L28 45 L18 48 L21 39 L12 37 L18 30 L12 23 L21 21 L18 12 L28 15 Z" fill={paint} opacity="0.82" />
        {/* Spike weapon tips (8 points) */}
        <circle cx="32" cy="3" r="2.8" fill={c} opacity="0.96" />
        <circle cx="60" cy="22" r="2.8" fill={c} opacity="0.92" />
        <circle cx="60" cy="40" r="2.8" fill={c} opacity="0.92" />
        <circle cx="32" cy="61" r="2.8" fill={c} opacity="0.96" />
        <circle cx="4" cy="40" r="2.8" fill={c} opacity="0.92" />
        <circle cx="4" cy="22" r="2.8" fill={c} opacity="0.92" />
        <circle cx="50" cy="9" r="2.2" fill={c} opacity="0.78" />
        <circle cx="14" cy="9" r="2.2" fill={c} opacity="0.78" />
        {/* Central power core (massive) */}
        <circle cx="32" cy="32" r="14" fill={dark} />
        <circle cx="32" cy="32" r="10" fill="#0a0516" />
        <circle cx="32" cy="32" r="7" fill={eye} opacity="0.78" />
        <circle cx="32" cy="32" r="4" fill="#fffde0" opacity="0.96" />
        <circle cx="32" cy="32" r="2" fill="#ffffff" />
        {/* Weapon ring details */}
        <path d="M20 20 L32 16 L44 20" stroke="#ffffff66" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <path d="M20 44 L32 48 L44 44" stroke="#ffffff44" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </svg>
    )
  }

  // ── BOSS: Alien assault carrier — wide crescent + 3 gun batteries ────────
  if (isBoss) {
    return (
      <svg width={s} height={s} viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 6px 14px #000a)' }}>
        {defs}
        {/* Wide carrier hull */}
        <path d="M6 32 C8 18 18 10 32 9 C46 10 56 18 58 32 C55 46 46 54 32 56 C18 54 9 46 6 32 Z" fill={shell} />
        <path d="M12 31 C13 20 20 15 32 14 C44 15 51 20 52 31 C50 40 44 46 32 47 C20 46 14 40 12 31 Z" fill={paint} opacity="0.9" />
        {/* Forward bow spike */}
        <path d="M29 9 L32 2 L35 9 L33.5 13 L30.5 13 Z" fill={c} opacity="0.9" />
        {/* Extended side carrier wings / landing decks */}
        <path d="M12 27 L2 20 L1 36 L12 36 Z" fill={spine} />
        <path d="M52 27 L62 20 L63 36 L52 36 Z" fill={spine} />
        <path d="M3 23 L1 20 L2 36 L4 36" stroke={c} strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.7" />
        <path d="M61 23 L63 20 L62 36 L60 36" stroke={c} strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.7" />
        {/* 3 gun battery arrays */}
        <rect x="13" y="17" width="9" height="4.5" rx="2" fill={dark} />
        <rect x="13.5" y="18" width="7" height="2.5" rx="1.2" fill={c} opacity="0.72" />
        <rect x="27.5" y="7" width="9" height="4.5" rx="2" fill={dark} />
        <rect x="28" y="8" width="7" height="2.5" rx="1.2" fill={c} opacity="0.72" />
        <rect x="42" y="17" width="9" height="4.5" rx="2" fill={dark} />
        <rect x="42.5" y="18" width="7" height="2.5" rx="1.2" fill={c} opacity="0.72" />
        {/* Command bridge sensor eye */}
        <ellipse cx="32" cy="28" rx="11" ry="7" fill={eye} opacity="0.6" />
        <circle cx="32" cy="28" r="4.5" fill="#fffae0" opacity="0.88" />
        <circle cx="32" cy="28" r="2" fill="#ffffff" />
        {/* Thruster bank */}
        <rect x="10" y="49" width="13" height="6" rx="3" fill="#5c3872" />
        <rect x="26" y="52" width="12" height="6" rx="3" fill="#5c3872" />
        <rect x="41" y="49" width="13" height="6" rx="3" fill="#5c3872" />
      </svg>
    )
  }

  switch (variant % 4) {
    // ── Variant 0: Scorpion disc — saucer with 4 scorpion claw spines ──────
    case 0:
      return (
        <svg width={s} height={s} viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 4px 10px #000a)' }}>
          {defs}
          {/* Saucer hull */}
          <path d="M12 34 C13 22 21 15 32 15 C43 15 51 22 52 34 C51 44 43 50 32 51 C21 50 13 44 12 34 Z" fill={shell} />
          <path d="M17 33 C18 24 23 20 32 19 C41 20 46 24 47 33 C46 40 41 44 32 45 C23 44 18 40 17 33 Z" fill={paint} opacity="0.92" />
          {/* Scorpion claw spines (4 directions) */}
          <path d="M17 23 L3 13 L2 20 L11 25 Z" fill={spine} />
          <path d="M47 23 L61 13 L62 20 L53 25 Z" fill={spine} />
          <path d="M17 43 L3 53 L5 59 L15 49 Z" fill={spine} />
          <path d="M47 43 L61 53 L59 59 L49 49 Z" fill={spine} />
          {/* Claw glow tips */}
          <circle cx="2" cy="13" r="2.5" fill={c} opacity="0.9" />
          <circle cx="62" cy="13" r="2.5" fill={c} opacity="0.9" />
          <circle cx="3" cy="56" r="2.5" fill={c} opacity="0.8" />
          <circle cx="61" cy="56" r="2.5" fill={c} opacity="0.8" />
          {/* Central eye */}
          <ellipse cx="32" cy="32" rx="9" ry="7" fill={eye} opacity="0.75" />
          <circle cx="32" cy="32" r="3.5" fill="#ffffff" opacity="0.9" />
        </svg>
      )

    // ── Variant 1: Bat-wing fighter — dark swept wings, predator silhouette ─
    case 1:
      return (
        <svg width={s} height={s} viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 4px 10px #000a)' }}>
          {defs}
          {/* Central spine/fuselage */}
          <path d="M30 10 L34 10 L36 20 L35 50 L32 57 L29 50 L28 20 Z" fill={shell} />
          {/* Large swept bat-wings */}
          <path d="M30 18 L13 11 L2 28 L6 39 L20 37 L28 28 Z" fill={paint} />
          <path d="M34 18 L51 11 L62 28 L58 39 L44 37 L36 28 Z" fill={paint} />
          {/* Wing inner shadow for depth */}
          <path d="M28 22 L15 16 L6 30 L9 36 L19 34 Z" fill="#00000030" />
          <path d="M36 22 L49 16 L58 30 L55 36 L45 34 Z" fill="#00000030" />
          {/* Wing edge accents */}
          <path d="M4 27 L13 12" stroke={c} strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
          <path d="M60 27 L51 12" stroke={c} strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
          {/* Claw wing tips */}
          <path d="M6 37 L2 45 L8 49 L12 41 Z" fill={spine} />
          <path d="M58 37 L62 45 L56 49 L52 41 Z" fill={spine} />
          {/* Eye */}
          <ellipse cx="32" cy="30" rx="8" ry="6" fill={eye} opacity="0.72" />
          <circle cx="32" cy="30" r="3.2" fill="#ffffff" opacity="0.88" />
        </svg>
      )

    // ── Variant 2: Crescent scythe — sharp arced hull, hollow center ────────
    case 2:
      return (
        <svg width={s} height={s} viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 4px 10px #000a)' }}>
          {defs}
          {/* Outer crescent/ring */}
          <path d="M32 4 L52 12 L61 28 L57 46 L44 56 L32 59 L20 56 L7 46 L3 28 L12 12 Z" fill={shell} />
          {/* Inner void — creates crescent illusion */}
          <path d="M32 13 L46 19 L51 28 L47 42 L37 50 L32 51 L27 50 L17 42 L13 28 L18 19 Z" fill={dark} />
          {/* Central bridge connecting crescent */}
          <path d="M30 16 H34 L34 49 H30 Z" fill={paint} opacity="0.75" />
          {/* Forward tip weapon spike */}
          <path d="M29 11 L32 4 L35 11 L33.5 15 L30.5 15 Z" fill={c} opacity="0.94" />
          {/* Crescent interior glow lines */}
          <path d="M20 20 L28 34" stroke={c} strokeWidth="1.8" strokeLinecap="round" opacity="0.6" />
          <path d="M44 20 L36 34" stroke={c} strokeWidth="1.8" strokeLinecap="round" opacity="0.6" />
          {/* Eye / sensor */}
          <circle cx="32" cy="30" r="5.5" fill={eye} opacity="0.8" />
          <circle cx="32" cy="30" r="2.5" fill="#ffffff" opacity="0.94" />
        </svg>
      )

    // ── Variant 3: Spider cruiser — oval body, 4 weapon tentacle appendages ─
    default:
      return (
        <svg width={s} height={s} viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 4px 10px #000a)' }}>
          {defs}
          {/* Central oval body */}
          <ellipse cx="32" cy="32" rx="14" ry="12" fill={shell} />
          <ellipse cx="32" cy="32" rx="10" ry="8.5" fill={paint} opacity="0.92" />
          {/* 4 long spider appendages */}
          <path d="M22 22 L4 7 L8 13 L18 23 Z" fill={spine} />
          <path d="M42 22 L60 7 L56 13 L46 23 Z" fill={spine} />
          <path d="M22 42 L4 57 L8 51 L18 41 Z" fill={spine} />
          <path d="M42 42 L60 57 L56 51 L46 41 Z" fill={spine} />
          {/* Weapon tips (glowing orbs) */}
          <circle cx="4" cy="7" r="3" fill={c} opacity="0.96" />
          <circle cx="60" cy="7" r="3" fill={c} opacity="0.96" />
          <circle cx="4" cy="57" r="3" fill={c} opacity="0.88" />
          <circle cx="60" cy="57" r="3" fill={c} opacity="0.88" />
          {/* Core eye */}
          <ellipse cx="32" cy="32" rx="7" ry="5.5" fill={eye} opacity="0.78" />
          <circle cx="32" cy="32" r="3" fill="#ffffff" opacity="0.88" />
        </svg>
      )
  }
}

function EarthHQIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ filter: 'drop-shadow(0 0 4px #7dd3fcaa)' }}>
      <circle cx="24" cy="24" r="21" fill="#1b4e96" />
      <path d="M9 20c4-5 8-6 12-5 2 1 2 4 1 6-2 3-4 4-7 4-2 0-4-2-6-5z" fill="#36c67a" />
      <path d="M20 28c2-2 6-3 9-1 2 1 4 4 3 6-1 2-5 4-8 3-3-1-5-4-4-8z" fill="#36c67a" />
      <path d="M30 13c4 1 7 4 8 8-3 1-6 0-8-2-2-1-2-4 0-6z" fill="#36c67a" />
      <circle cx="24" cy="24" r="21" fill="none" stroke="#b7f0ff" strokeWidth="2" opacity="0.75" />
    </svg>
  )
}

function MothershipSpawnIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ filter: 'drop-shadow(0 0 4px #f472b6aa)' }}>
      <ellipse cx="24" cy="30" rx="18" ry="10" fill="#3c2948" />
      <ellipse cx="24" cy="24" rx="12" ry="9" fill="#a855f7" opacity="0.92" />
      <ellipse cx="24" cy="23" rx="6" ry="4" fill="#f5d0fe" opacity="0.6" />
      <rect x="8" y="31" width="8" height="4" rx="2" fill="#6b4b7d" />
      <rect x="20" y="34" width="8" height="4" rx="2" fill="#6b4b7d" />
      <rect x="32" y="31" width="8" height="4" rx="2" fill="#6b4b7d" />
    </svg>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function SpaceImpactDefense({ availableCoins, onClose }: { availableCoins: CoinOption[]; onClose: () => void }) {
  const [cell, setCell] = useState(calcCell)
  const [soundOn, setSoundOn] = useState(getGameSoundEnabled)
  const [isCompact, setIsCompact] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 900 : false)

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
  const boardRef = useRef<HTMLDivElement | null>(null)
  const spaceCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const spaceAnimRef = useRef<number>(0)
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
    const handler = () => {
      setCell(calcCell())
      setIsCompact(window.innerWidth <= 900)
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

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
    setSoundOn(next)
    setGameSoundEnabled(next)
  }

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
          normalEscortQueueRef.current === 0 || Math.random() < (bossQueueRef.current / Math.max(1, bossQueueRef.current + normalEscortQueueRef.current))
        )
        const enemyCfg = spawnBoss ? waveCfg : normalCfg
        const baseInterval = spawnBoss ? 1.1 : 0.65
        spawnTimerRef.current = baseInterval / numSpawns
        const coin = coins[Math.floor(Math.random() * coins.length)]
        const pidx = spawnBoss ? Math.floor(Math.random() * numSpawns) : (spawnRRRef.current % numSpawns)
        if (!spawnBoss) spawnRRRef.current++
        const pos = getEnemyPos(pidx, 0, 0)
        // 30% chance a normal enemy gets a random 10-30% speed surge
        const spdMult = (!spawnBoss && Math.random() < 0.30) ? 1.1 + Math.random() * 0.20 : 1
        const tint = ENEMY_COLORS[Math.floor(Math.random() * ENEMY_COLORS.length)]
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
          destroyCooldown: (spawnBoss && stageRef.current === MAX_STAGES) ? 6.5 : 9999,
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
          e.destroyCooldown = 7.5
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
          e.destroyCooldown = 2.8 // retry sooner if no tower nearby
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
        tower.aimAngle = angleToDeg(tower.col + 0.5, tower.row + 0.5, shot.tx, shot.ty)
        bulletsRef.current.push({
          id: _bid++,
          x: tower.col + 0.5, y: tower.row + 0.5,
          tx: shot.tx, ty: shot.ty,
          speed: 7, color: '#ff8800',
          targetId: shot.targetId,
          towerId: tower.id,
          dmg: shot.dmg,
          isAoe: false, isSlow: false, isRocket: false, isHeavy: true, isHoming: true,
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
      tower.aimAngle = angleToDeg(tower.col + 0.5, tower.row + 0.5, laserTarget.x + 0.5, laserTarget.y + 0.5)
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
          const applied = hi === 0 ? tickDmg : pierceDmg
          e.hp -= hi === 0 ? tickDmg : pierceDmg
          grantTowerXp(tower, Math.max(0.06, Math.min(0.24, applied * 0.006)))
          if (Math.random() < 0.18) {
            spawnImpactParticles(particlesRef.current, e.x + 0.5, e.y + 0.5, 'impact', hi === 0 ? 3 : 2, 0.85, 0.18)
          }
          if (e.hp <= 0) {
            grantTowerXp(tower, e.isBoss ? 28 : 6)
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
        tower.aimAngle = angleToDeg(tower.col + 0.5, tower.row + 0.5, target.x + 0.5, target.y + 0.5)
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
            towerId: tower.id,
            dmg: td.dmg * (1 + (tower.level - 1) * 0.5),
            isAoe: td.key === 'aoe',
            isSlow: td.key === 'slow',
            isRocket: td.key === 'rocket',
            isHeavy: false,
            isHoming: false,
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
      if (b.isHoming) {
        const tracked = aliveEnemies.find(e => e.id === b.targetId)
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
        const target = aliveEnemies.find(e => e.id === b.targetId)
        const sourceTower = towersRef.current.find(t => t.id === b.towerId)
        if (b.isRocket) {
          // Huge AOE: 3.0 cell radius, shockwave
          explosionsRef.current.push({ x: b.tx, y: b.ty, radius: 3.0, time: 0, type: 'rocket', maxTime: 0.5 })
          for (const e of aliveEnemies) {
            const edx = e.x - b.tx, edy = e.y - b.ty
            const dist2 = Math.sqrt(edx * edx + edy * edy)
            if (dist2 <= 3.0) {
              // falloff: full damage in centre, 50% at edge
              const falloff = 1 - (dist2 / 3.0) * 0.5
              const applied = b.dmg * falloff
              e.hp -= applied
              if (sourceTower) grantTowerXp(sourceTower, Math.max(0.45, Math.min(1.8, applied * 0.03)))
              e.hitFlash = 0.1
              spawnImpactParticles(particlesRef.current, e.x + 0.5, e.y + 0.5, 'impact', 5, 1.6, 0.22)
              if (e.hp <= 0) { 
                if (sourceTower) grantTowerXp(sourceTower, e.isBoss ? 28 : 6)
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
              if (sourceTower) grantTowerXp(sourceTower, Math.max(0.45, Math.min(1.5, b.dmg * 0.028)))
              e.hitFlash = 0.1
              spawnImpactParticles(particlesRef.current, e.x + 0.5, e.y + 0.5, 'impact', 4, 1.3, 0.18)
              if (e.hp <= 0) { 
                if (sourceTower) grantTowerXp(sourceTower, e.isBoss ? 28 : 6)
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
              if (sourceTower) grantTowerXp(sourceTower, Math.max(0.5, Math.min(1.7, b.dmg * 0.03)))
              e.hitFlash = 0.1
              spawnImpactParticles(particlesRef.current, e.x + 0.5, e.y + 0.5, 'impact', 5, 1.45, 0.2)
              if (e.hp <= 0) { 
                if (sourceTower) grantTowerXp(sourceTower, e.isBoss ? 28 : 6)
                triggerEnemyDeath(e, 'artillery', e.isBoss, goldRef, scoreRef, particlesRef.current, floatingTextRef.current, screenFlashRef, coinFlowRef, setScreenFlashState)
                if (soundOn) playGameSound('combo')
              }
            }
          }
        } else if (target) {
          if (b.isSlow) target.slowTimer = 2.5
          target.hp -= b.dmg
          if (sourceTower) grantTowerXp(sourceTower, Math.max(0.45, Math.min(1.4, b.dmg * 0.027)))
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
            if (sourceTower) grantTowerXp(sourceTower, target.isBoss ? 28 : 6)
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
  function tryDropTower(clientX: number, clientY: number, boardEl: HTMLElement) {
    const movingTower = draggedTowerRef.current
    if (!movingTower) return
    const [offsetX, offsetY] = dragOffsetRef.current
    const boardRect = boardEl.getBoundingClientRect()
    const x = clientX - boardRect.left - offsetX
    const y = clientY - boardRect.top - offsetY
    const newCol = Math.round(x / cell)
    const newRow = Math.round(y / cell)

    if (newCol >= 0 && newCol < COLS && newRow >= 0 && newRow < ROWS) {
      const key = `${newCol},${newRow}`
      if (!pathSetRef.current.has(key)) {
        const existingTower = towersRef.current.find(t => t.col === newCol && t.row === newRow && t.id !== movingTower.id)
        if (!existingTower) {
          movingTower.col = newCol
          movingTower.row = newRow
          setUiTowers([...towersRef.current])
          setSelectedTowerOnGrid({ ...movingTower })
        }
      }
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
    const existing = towersRef.current.find(t => t.col === col && t.row === row)
    if (existing) {
      setSelectedTowerOnGrid(existing)
      return
    }
    setSelectedTowerOnGrid(null)
    if (!selectedTowerKey) return

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
      xp: 0,
      aimAngle: -90,
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
      towerActionBurstRef.current.push({ x: tower.col + 0.5, y: tower.row + 0.5, type: 'upgrade', time: 0, maxTime: 0.4 })
    }
    if (tower.level >= MAX_TOWER_LEVEL) tower.xp = 0
    if (leveled) {
      if (selectedTowerOnGrid?.id === tower.id) setSelectedTowerOnGrid({ ...tower })
      if (soundOn) playGameSound('levelup')
    }
  }

  function upgradeTower(tower: Tower) {
    if (tower.level >= MAX_TOWER_LEVEL) { playGameSound('hit'); return }
    const cost = tower.towerDef.cost * tower.level * 1.2
    if (goldRef.current < cost) { playGameSound('hit'); return }
    goldRef.current -= cost
    tower.level = Math.min(tower.level + 1, MAX_TOWER_LEVEL)
    if (tower.level >= MAX_TOWER_LEVEL) tower.xp = 0
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
  const chromeMaxW = Math.min(typeof window !== 'undefined' ? window.innerWidth - 10 : 1200, isCompact ? boardW + 8 : boardW + 280)

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

        @keyframes scanline {
          from { background-position: 0 0; }
          to { background-position: 0 12px; }
        }

        @keyframes firingWave {
          0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0.82; }
          100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; }
        }
      `}</style>
      <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'radial-gradient(120% 180% at 10% 0%, #203228 0%, #0c1411 42%, #070b09 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', overflowY: 'auto',
      padding: '12px 8px 24px',
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, width: '100%', maxWidth: chromeMaxW, position: 'relative', zIndex: 1 }}>
        <button onClick={onClose} style={btnStyle('#3a120f', '#f9d7bf')} aria-label="Close">X</button>
        <div style={{ flex: 1, textAlign: 'center', fontWeight: 900, fontSize: isCompact ? '0.9rem' : '1.05rem', color: '#ffcf86', letterSpacing: 1.6, whiteSpace: 'nowrap', textTransform: 'uppercase', textShadow: '0 0 12px #ff7b2f66' }}>
          SPACE IMPACT DEFENSE
        </div>
        <button onClick={toggleSound} style={btnStyle('#102b20','#9ef2cc')}>{soundOn ? 'SFX ON' : 'SFX OFF'}</button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: isCompact ? 'repeat(2,minmax(0,1fr))' : 'repeat(4,minmax(0,1fr))', gap: 8, alignItems: 'stretch', width: '100%', maxWidth: chromeMaxW, marginBottom: 8, position: 'relative', zIndex: 1 }}>
        <StatPill icon="CR" val={uiGold} color="#ffd666" />
        <StatPill icon="HP" val={uiLives} color="#fb7185" />
        <StatPill icon="SC" val={uiScore} color="#18e6c4" />
        <StatPill icon="HI" val={uiHighScore} color="#7c5dff" />
      </div>

      {/* Wave bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, width: '100%', maxWidth: chromeMaxW, flexWrap: isCompact ? 'wrap' : 'nowrap', position: 'relative', zIndex: 1, background: '#101714', border: '1px solid #335545', borderRadius: 6, padding: '6px 8px', boxShadow: 'inset 0 0 0 1px #00000088' }}>
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
        {uiState === 'idle' && endlessUnlocked && !uiEndless && (
          <button onClick={enterEndless} style={btnStyle('#7a4312', '#ffe1b3', true)}>ENDLESS</button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: isCompact ? 'column' : 'row', alignItems: isCompact ? 'center' : 'flex-start', gap: 8, width: '100%', maxWidth: chromeMaxW, position: 'relative', zIndex: 1 }}>
        {/* Board */}
        <div
          ref={boardRef}
          style={{
            position: 'relative', width: boardW, height: boardH, flexShrink: 0, border: '2px solid #4c6f5c', borderRadius: 4, overflow: 'hidden', userSelect: 'none',
            boxShadow: '0 0 0 1px #0b0f0d inset, 0 0 0 3px #1a241f inset, 0 10px 30px #00000088',
            touchAction: draggedTower ? 'none' : 'pan-y',
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
              const hasTower = towersRef.current.some(t => t.col === c && t.row === r)
              const isHovered = hoveredCell?.[0] === c && hoveredCell?.[1] === r
              const tDef = selectedTowerKey ? TOWER_TYPES.find(t => t.key === selectedTowerKey) ?? null : null
              const canAfford = tDef != null && goldRef.current >= tDef.cost
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
                      : isHovered && !isPath && !hasTower
                        ? (canAfford ? 'rgba(255,255,255,0.14)' : 'rgba(255,0,0,0.14)')
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
                  width: cell - 4, height: cell - 4,
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
                      width: cell * 1.05,
                      height: cell * 1.05,
                      borderRadius: '50%',
                      border: `2.5px solid ${tower.towerDef.color}`,
                      boxShadow: `0 0 14px ${tower.towerDef.color}99`,
                      animation: 'firingWave 0.48s ease-out forwards',
                      pointerEvents: 'none',
                    }}
                  />
                )}
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
          {selectedTowerOnGrid && !draggedTower && (() => {
            const t = selectedTowerOnGrid
            const upgradeCost = Math.floor(t.towerDef.cost * t.level * 1.2)
            const sellValue = Math.floor(t.towerDef.cost * 0.5)
            const canUpgrade = t.level < MAX_TOWER_LEVEL
            const levelXpNeed = canUpgrade ? xpNeededForNextLevel(t.level) : 0
            const levelXpPct = canUpgrade ? Math.max(0, Math.min(1, t.xp / levelXpNeed)) : 1
            const menuWidth = 160
            const menuHeight = 60
            const left = Math.max(8, Math.min(boardW - menuWidth - 8, (t.col + 0.5) * cell - menuWidth / 2))
            const preferredBelow = (t.row + 1) * cell + 8
            const preferredAbove = (t.row + 0.5) * cell - menuHeight - 8
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
            const isFinalBoss = e.isBoss && uiStage === MAX_STAGES
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
              left: e.x * cell, top: e.y * cell,
              width: cell * bossScale, height: cell * bossScale,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
              transform: `translate(${e.isBoss ? -cell*(bossScale-1)/2 : -2}px,${e.isBoss ? -cell*(bossScale-1)/2 : -2}px)`,
            }}>
              {isFinalBoss && <div style={{ fontSize: cell * 0.42, lineHeight: 1, marginBottom: 1 }}>💀</div>}
              {e.isBoss && !isFinalBoss && <div style={{ fontSize: cell * 0.35, lineHeight: 1, marginBottom: 1 }}>BOSS</div>}
              {/* Boss HP bar — wider, taller, glowing red to stand out from normal bars */}
              {e.isBoss ? (
                <div style={{ width: cell * bossScale + 4, marginBottom: 3 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fca5a5', fontSize: Math.max(8, cell * 0.18), fontWeight: 900, lineHeight: 1, marginBottom: 2, textShadow: '0 0 6px #ef4444' }}>
                    <span>{isFinalBoss ? '☠' : '⚠'}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.ceil(e.hp)}/{e.maxHp}</span>
                  </div>
                  <div style={{ width: '100%', height: 7, background: '#1a0505', border: '1px solid #7f1d1d', borderRadius: 2, overflow: 'hidden', boxShadow: '0 0 8px #ef444466' }}>
                    <div style={{ width: `${Math.max(0, e.hp / e.maxHp) * 100}%`, height: '100%', background: e.hp / e.maxHp > 0.5 ? 'linear-gradient(90deg,#dc2626,#f87171)' : e.hp / e.maxHp > 0.25 ? 'linear-gradient(90deg,#b45309,#fbbf24)' : 'linear-gradient(90deg,#7f1d1d,#ef4444)', boxShadow: '0 0 10px #ef444488', borderRadius: 2, transition: 'width 0.06s linear' }} />
                  </div>
                </div>
              ) : (
                <div style={{ width: cell * bossScale - 6, height: 3, background: '#333', borderRadius: 2, marginBottom: 2 }}>
                  <div style={{ width: `${Math.max(0, e.hp / e.maxHp) * 100}%`, height: '100%', background: e.hp / e.maxHp > 0.5 ? '#34d399' : e.hp / e.maxHp > 0.25 ? '#ffd666' : '#fb7185', borderRadius: 2 }} />
                </div>
              )}
              <div style={{
                width: sz, height: sz,
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
              zIndex: 40,
              pointerEvents: 'auto',
            }} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
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
        <div style={{ flex: 1, minWidth: isCompact ? boardW : 160, width: isCompact ? boardW : 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ color: '#aaa', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Deploy Ship</div>
          <div style={{ display: 'grid', gridTemplateColumns: isCompact ? 'repeat(2,minmax(0,1fr))' : '1fr', gap: 6 }}>
            {TOWER_TYPES.map(t => (
              <button
                key={t.key}
                onClick={() => { setSelectedTowerKey(prev => prev === t.key ? null : t.key as TowerKey); setSelectedTowerOnGrid(null) }}
                style={{
                  background: selectedTowerKey === t.key ? t.color + '33' : '#111',
                  border: `2px solid ${selectedTowerKey === t.key ? t.color : '#333'}`,
                  borderRadius: 8,
                  padding: isCompact ? '7px 8px' : '6px 8px',
                  cursor: 'pointer',
                  color: '#fff',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                  minHeight: isCompact ? 54 : 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: isCompact ? 38 : 44,
                    height: isCompact ? 38 : 44,
                    borderRadius: 10,
                    border: `1px solid ${t.color}55`,
                    background: 'linear-gradient(180deg,#182330,#0a0f18)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: `inset 0 0 14px ${t.color}18`,
                  }}>
                    <TowerShip tType={t.key} color={t.color} size={isCompact ? 28 : 32} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 800, color: t.color, fontSize: isCompact ? '0.8rem' : '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.label}</span>
                      <span style={{ color: '#ffd666', fontSize: '0.76rem', whiteSpace: 'nowrap' }}>CR {t.cost}</span>
                    </div>
                    {!isCompact && <div style={{ color: '#888', fontSize: '0.7rem', marginTop: 2 }}>{t.desc}</div>}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {selectedTowerOnGrid && (
            <div style={{ marginTop: 8, background: '#111', border: `2px solid ${selectedTowerOnGrid.towerDef.color}`, borderRadius: 8, padding: 10 }}>
              <div style={{ color: selectedTowerOnGrid.towerDef.color, fontWeight: 800, fontSize: '0.9rem' }}>{selectedTowerOnGrid.towerDef.label} Lv{selectedTowerOnGrid.level}</div>
              <div style={{ color: '#aaa', fontSize: '0.75rem', margin: '4px 0' }}>DMG: {(selectedTowerOnGrid.towerDef.dmg * (1 + (selectedTowerOnGrid.level - 1) * 0.5)).toFixed(0)} | Range: {selectedTowerOnGrid.towerDef.range}</div>
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

          <div style={{ marginTop: 'auto', color: '#6f7e76', fontSize: isCompact ? '0.66rem' : '0.7rem', lineHeight: 1.45 }}>
            <div>• Tap empty cell to deploy</div>
            <div>• Drag ship to reposition (mouse or touch)</div>
            <div>• Aliens reaching HQ cost lives</div>
            {!isCompact && <div>• Wave 5 is boss wave, stage 10 is all bosses</div>}
            {!isCompact && <div>• Beat stage 10 to unlock endless mode</div>}
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: '#111914', border: `1px solid ${color}55`, borderRadius: 4, padding: '5px 9px', boxShadow: 'inset 0 0 0 1px #00000088' }}>
      <span style={{ color: '#9ab5a8', fontSize: '0.72rem', letterSpacing: 1.1 }}>{icon}</span>
      <span style={{ color, fontWeight: 800, fontSize: '0.92rem', minWidth: 92, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{typeof val === 'number' ? val.toLocaleString() : val}</span>
    </div>
  )
}

function btnStyle(bg: string, color: string, bold = false): React.CSSProperties {
  return {
    background: bg,
    color,
    border: '1px solid #5c7e6a',
    borderRadius: 4,
    padding: '6px 12px',
    cursor: 'pointer',
    fontWeight: bold ? 800 : 600,
    fontSize: '0.76rem',
    transition: 'filter 0.15s',
    fontFamily: 'inherit',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    boxShadow: 'inset 0 0 0 1px #00000088',
  }
}
