export const COLS = 14
export const ROWS = 10
export const MAX_STAGES = 10
export const WAVES_PER_STAGE = 5
export const STORAGE_KEY = 'spaceImpactDefenseHighScore'
export const ENDLESS_UNLOCK_STORAGE_KEY = 'spaceImpactDefenseEndlessUnlocked'
export const MOBILE_LAYOUT_STORAGE_KEY = 'spaceImpactDefenseLayoutMode'

export type MobileLayoutMode = 'auto' | 'portrait' | 'landscape'

// ─── Spawn point count per stage ──────────────────────────────────────────────
export function spawnCountForStage(stage: number): number {
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
export function generatePaths(stage: number): [number, number][][] {
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
export const TOWER_TYPES = [
  { key: 'fast',      label: 'Scout',    color: '#00fff2', range: 2.0, dmg: 8,   rate: 0.5,  cost: 60,   desc: 'High fire rate, short range' },
  { key: 'sniper',    label: 'Rail Gun', color: '#7c5dff', range: 10,  dmg: 45,  rate: 3.5,  cost: 120,  desc: 'Long range, heavy piercing shot' },
  { key: 'aoe',       label: 'Bomber',   color: '#ffd666', range: 2.5, dmg: 20,  rate: 1.8,  cost: 100,  desc: 'Plasma splash, hits nearby aliens' },
  { key: 'slow',      label: 'Cryo',     color: '#5e53ff', range: 2.8, dmg: 6,   rate: 1.2,  cost: 80,   desc: 'Freeze beam, slows aliens 50%' },
  { key: 'burst',     label: 'Cannon',   color: '#f99b45', range: 4.0, dmg: 170, rate: 5.0,  cost: 200,  desc: 'High burst, slow reload' },
  { key: 'gatling',   label: 'Gatling',  color: '#00ff0d', range: 4,   dmg: 4,   rate: 0.1,  cost: 400,  desc: 'Rapid-fire chain guns' },
  { key: 'rocket',    label: 'Rocket',   color: '#ff0000', range: 6,   dmg: 250, rate: 12.0, cost: 600,  desc: 'Massive AOE blast, 12s reload' },
  { key: 'laser',     label: 'Laser',    color: '#dbecff', range: 4.5, dmg: 3,   rate: 0.01, cost: 2000, desc: 'Beam 10s · exhaust 5s · 300 DPS pierce' },
  { key: 'artillery', label: 'Orbital',  color: '#ff8800', range: 999, dmg: 250, rate: 7.0,  cost: 3500, desc: 'Global range · 3 orbital strikes' },
  { key: 'dreadnought', label: 'Dreadnought', color: '#f43f5e', range: 999, dmg: 420, rate: 3.0, cost: 5000, desc: '2x2 global AOE lance barrage + scaling drone wing' },
] as const
export type TowerKey = typeof TOWER_TYPES[number]['key']

export function getTowerFootprint(type: TowerKey) {
  return type === 'dreadnought' ? 2 : 1
}

export const ENEMY_COLORS = ['#ff5f8a', '#ff944d', '#ffd84d', '#71f79f', '#4dd8ff', '#8f7cff', '#ff74d4'] as const

// ─── Wave config (dynamic per stage + wave) ───────────────────────────────────
export type WaveCfg = { count: number; hp: number; speed: number; reward: number; isBoss: boolean }

export function isHeavyBossStage(stage: number, isEndless = false) {
  return stage === MAX_STAGES || (isEndless && stage > MAX_STAGES && stage % 5 === 0)
}

export function getNormalWaveCfg(stage: number, wave: number): WaveCfg {
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

export function getWaveCfg(stage: number, wave: number, isEndless = false): WaveCfg {
  const isHeavyStage = isHeavyBossStage(stage, isEndless)
  const isBoss = wave === WAVES_PER_STAGE || isHeavyStage
  const ss = 1 + (stage - 1) * 0.65   // stage HP scale (was 0.45)
  // Stage 10 final boss — slow but destroys towers
  if (isBoss && isHeavyStage) {
    // Slow siege bosses that destroy towers and summon escorts. Endless repeats scale up.
    const heavyScale = isEndless && stage > MAX_STAGES ? 1 + (stage - MAX_STAGES) * 0.18 : 1
    return {
      count:  3,
      hp:     Math.round(22000 * heavyScale),
      speed:  0.28,
      reward: Math.round(400 * heavyScale),
      isBoss: true,
    }
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

export const MAX_TOWER_LEVEL = 5

export function xpNeededForNextLevel(level: number) {
  // 200 -> 320 -> 440 -> 560 XP (Lv1->2..Lv4->5): auto-XP from normal kills is slow;
  // the manual upgrade button remains the primary way to level up quickly.
  return 140 + level * 120
}

// ─── Cell size calculation ─────────────────────────────────────────────────────
export function calcCell(layoutMode: MobileLayoutMode = 'auto') {
  if (typeof window === 'undefined') return 44
  // A real desktop always has height > 550. Wide-landscape phones (e.g. S20 Ultra = 915×412) must not be treated as desktop.
  const isDesktop = window.innerWidth > 900 && window.innerHeight > 550
  const isMobile = !isDesktop
  const isNaturalLandscape = window.innerWidth > window.innerHeight
  const useMobileLandscape = isMobile && (
    layoutMode === 'landscape' ||
    (layoutMode === 'auto' && isNaturalLandscape)
  )

  if (!isDesktop && !useMobileLandscape) {
    // Portrait compact: CSS flex distributes remaining height to the shop,
    // so we only constrain by width to prevent horizontal overflow.
    const byWidth = (window.innerWidth - 24) / COLS
    return Math.floor(Math.max(20, Math.min(38, byWidth)))
  }

  // Desktop or landscape mobile: constrain by both width and height.
  const reservedWidth = isDesktop ? 240 : 210   // sidebar ~200px + padding
  const reservedHeight = isDesktop ? 140 : 130  // actual landscape phone HUD ≈ 110px + safety
  const byWidth = (window.innerWidth - reservedWidth) / COLS
  const byHeight = (window.innerHeight - reservedHeight) / ROWS
  const target = Math.min(byWidth, byHeight)
  const minCell = isDesktop ? 32 : 20
  const maxCell = isDesktop ? 72 : 56
  return Math.floor(Math.max(minCell, Math.min(maxCell, target)))
}

export function getIsCompactLayout(layoutMode: MobileLayoutMode) {
  if (typeof window === 'undefined') return false
  if (window.innerWidth > 900 && window.innerHeight > 550) return false
  if (layoutMode === 'portrait') return true
  if (layoutMode === 'landscape') return false
  return window.innerHeight >= window.innerWidth
}
