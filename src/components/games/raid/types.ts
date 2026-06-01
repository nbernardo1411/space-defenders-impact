import type { CoreLanderModel } from '../../../progression'
import type { GodGundamBarragePose } from './assets'

export type WeaponKey = 'spread' | 'laser' | 'scatter' | 'rocket' | 'homing'

export type PowerKind = WeaponKey | 'option' | 'shield' | 'forcefield' | 'repair' | 'levelup'

export type GamePhase = 'select' | 'briefing' | 'playing' | 'paused' | 'gameover' | 'victory'

export type BossMessage = 'incoming' | 'clear' | null

export type BossKind = 'carrier' | 'orb' | 'serpent' | 'mantis' | 'hydra' | 'gate' | 'super' | 'squid' | 'snake' | 'final' | 'devil'

export type MirageBossKind = 'squid' | 'snake'

export type MiniBossKind = 'stalker' | 'brood' | 'lancer'

export type RaidBgmMode = 'cruise' | 'combat' | 'boss' | 'ending'

export type RaidMode = 'campaign' | 'endless'

export type RaidDifficulty = 'easy' | 'normal' | 'hard' | 'expert'

export type RaidAssetPreloadState = { status: 'idle' | 'loading' | 'ready'; loaded: number; total: number }

export type DevilBossPose = 'idle' | 'idle2' | 'attack' | 'attack2' | 'rage'

export type MultiplayerConnectionQuality = 'good' | 'ok' | 'poor' | 'offline'

export type RaidRandomEventKind = 'meteor' | 'solar' | 'rift' | 'wreck' | 'ambush' | 'ion'

export type CoreLanderCombatModel = Extract<CoreLanderModel, 'godGundam' | 'spiegel'>

export type Vec = { x: number; y: number }

export type CameraShakeState = { until: number; duration: number; strength: number; seed: number }

export type ShipOption = {
  key: string
  name: string
  role: string
  speed: number
  hp: number
  fireRate: number
}

export type MesiahDroneUnit = Vec & {
  side: -1 | 1
  targetId: number | null
  rotation: number
  active: boolean
  canFire: boolean
}

export type MesiahScoutUnit = MesiahDroneUnit & {
  stack: number
}

export type SpiegelAfterimage = Vec & {
  life: number
}

export type Player = Vec & {
  hp: number
  maxHp: number
  invuln: number
  shield: number
  forceField: number
  passiveForceFieldRegen: number
  optionTimer: number
  optionStacks: number
  fireCooldown: number
  specialCooldown: number
  weaponCooldowns: Record<WeaponKey, number>
  score: number
  rank: number
  ship: ShipOption
  visualShipKey: string
  weapons: Record<WeaponKey, number>
  weaponTimers: Record<WeaponKey, number>
  engineBoost: number
  spiegelAfterimageStrength: number
  spiegelAfterimages: SpiegelAfterimage[]
  mesiahDroneTimer: number
  mesiahDroneCooldown: number
  mesiahDroneFireCooldown: number
  mesiahRocketCooldown: number
  mesiahDrones: MesiahDroneUnit[]
  mesiahScoutDrones: MesiahScoutUnit[]
  burningBlend: number
  godMeleeHeat: number
  godMeleeExhaust: number
  godMeleeVisualTimer: number
  godMeleeCloak: number
  godMeleeChainX: number
  godMeleeChainY: number
  godMeleeLastTargetKey: string
}

export type Shot = Vec & {
  id: number
  vx: number
  vy: number
  damage: number
  kind: WeaponKey | 'pulse' | 'coreBlast' | 'spiegelKunai' | 'enemy' | 'boss' | 'plasma' | 'blade' | 'orbShot' | 'superShot' | 'needle' | 'voidShot' | 'beam' | 'scatterBoss' | 'poisonCloud' | 'squidBubble' | 'squidInk' | 'squidSpine' | 'snakeFang' | 'devilSnakeHead' | 'venomSpit'
  radius: number
  pierce?: number
  turn?: number
  homingTargetId?: number
  retargetTime?: number
  life?: number
  maxLife?: number
  angle?: number
  spin?: number
  hp?: number
  splitLevel?: number
  burning?: boolean
}

export type Enemy = Vec & {
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
  chargeTargetY: number
  rapidCharge?: boolean
  beamVolleyLeft?: number
  beamVolleyRecovery?: number
  mirageKind?: MirageBossKind | null
  mirageTimer?: number
  mirageCooldown?: number
  hitFlash?: number
  devilVisualPose?: DevilBossPose
  devilPoseChangedAt?: number
  devilNormalAttackTimer?: number
  devilDefeatedTimer?: number
  devilSnakeBurstLeft?: number
  defeatTimer?: number
  bossHpStingerPlayed?: boolean
  chargePattern: 'single' | 'pincer' | 'trident' | 'scatter' | 'diagonal' | 'horizontal' | 'cross' | 'rotate'
}

export type FormationStyle = {
  color: string
  pattern: number
  originX: number
  amplitude: number
  pathSpeed: number
}

export type PowerUp = Vec & {
  id: number
  type: PowerKind
  vy: number
  radius: number
  spin: number
  magnet?: number
}

export type Spark = Vec & {
  id: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

export type Ripple = Vec & {
  id: number
  life: number
  maxLife: number
  color: string
  size: number
}

export type NukeStrike = {
  startX: number
  startY: number
  targetX: number
  targetY: number
  age: number
  duration: number
}

export type BossDefeatExplosionEvent = {
  boss: Enemy
  age: number
  delay: number
  index: number
}

export type GodGundamBarrage = {
  model?: CoreLanderCombatModel
  targetId: number
  startX: number
  startY: number
  targetX: number
  targetY: number
  age: number
  duration: number
  hitTimer: number
  hitIndex: number
  seed: number
  damageMultiplier?: number
  burning?: boolean
}

export type GodGundamPassiveStrike = Vec & {
  id: number
  sourceX: number
  sourceY: number
  model: CoreLanderCombatModel
  pose: GodGundamBarragePose
  side: -1 | 1
  age: number
  duration: number
  size: number
  targetRadius: number
  burning?: boolean
  clone?: boolean
  attackSideOverride?: -1 | 1
}

export type AsteroidHazard = Vec & {
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

export type RaidRandomEvent = {
  kind: RaidRandomEventKind
  age: number
  duration: number
  warning: number
  seed: number
}

export type MeteorHazard = Vec & {
  id: number
  vx: number
  vy: number
  radius: number
  life: number
  phase: number
}

export type IonStrike = {
  id: number
  x: number
  width: number
  warmup: number
  life: number
  duration: number
}

export type DerelictWreck = Vec & {
  id: number
  vx: number
  vy: number
  width: number
  height: number
  hp: number
  maxHp: number
  phase: number
  variant?: number
  rotation?: number
}

export type Snapshot = {
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
  bossEntranceSlam: number
  highScore: number
  selectedShipKey: string
  pointer: Vec | null
  stageClear: number
  unlockedStage: number
  nukeCooldown: number
  nukeFlash: number
  asteroidWarning: number
  randomEvent: RaidRandomEvent | null
  raidMode: RaidMode
}

export type MultiplayerInput = {
  target: Vec | null
  pointer: Vec | null
  position: Vec | null
  keys: string[]
  nuke: number
  at: number
}

export type MultiplayerHostState = {
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
  bossEntranceSlam: number
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
  godBarrage: GodGundamBarrage | null
  asteroids: AsteroidHazard[]
  asteroidWarning: number
  randomEvent: RaidRandomEvent | null
  meteors: MeteorHazard[]
  ionStrikes: IonStrike[]
  wrecks: DerelictWreck[]
}

export type MultiplayerPlayerSnapshot = {
  at: number
  player: Player
}

export type MultiplayerEnemySnapshot = {
  at: number
  enemies: Enemy[]
}

export type MultiplayerAsteroidSnapshot = {
  at: number
  asteroids: AsteroidHazard[]
}

export type RelayGameMessage =
  | { type: 'game-message'; from: string; payload: { type: 'input'; input: MultiplayerInput } }
  | { type: 'game-message'; from: string; payload: { type: 'state'; state: MultiplayerHostState } }
  | { type: 'room-update'; room: { players: RaidMultiplayerSession['players'] } | null }
  | { type: 'pong'; at: number }
  | { type: 'left-room' }
  | { type: string; [key: string]: unknown }

export type BriefingBossKind = Extract<BossKind, 'squid' | 'snake' | 'final' | 'devil'>

export type RaidMultiplayerSession = {
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
    visualShipKey?: string
  }>
}
