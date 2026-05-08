import type { CoinOption } from '../types'
import type { TOWER_TYPES, TowerKey } from './config'

export type EnemyTrait = 'none' | 'shielded' | 'armored' | 'phase' | 'splitter' | 'blink'

export type Enemy = {
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
  trait: EnemyTrait
  shield: number
  maxShield: number
  blinkUsed: boolean
  destroyCooldown: number  // stage-10 boss: smashes nearby towers
  summonCooldown: number  // stage-10 boss: spawns normal escorts
  hitFlash: number  // time remaining to show red hit indicator
  dead: boolean
  leaked: boolean
}

export type Tower = {
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
  scoutCooldown: number  // dreadnought: seconds until next escort wing launch
}

export type ScoutDrone = {
  id: number
  towerId: number
  x: number; y: number
  angle: number
  orbit: number
  timer: number
  cooldown: number
  targetId: number | null
  state: 'launch' | 'attack' | 'return'
  dead: boolean
}

export type Bullet = {
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

export type GameState = 'idle' | 'playing' | 'wave' | 'stage_complete' | 'gameover' | 'victory'
export type ParticleType = 'death' | 'build' | 'sell' | 'gold' | 'impact' | 'freeze' | 'burst' | 'ember' | 'spark'
