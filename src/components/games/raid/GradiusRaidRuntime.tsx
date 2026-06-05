import { getRaidText } from '../../../i18n'
import type { LanguageCode } from '../../../i18n'
import { isCreatorPlayerName, submitLeaderboardScore } from '../../../leaderboards'
import { getCoreLanderModel, getEquippedShipCosmetics, hasProgressionUnlockOverride, isCoreLanderUnlocked, loadProgress } from '../../../progression'
import type { RunResult, RunStatus, ShipCosmeticEquipState } from '../../../progression'
import { RAID_ALIEN_SPRITE_COUNT, RAID_ELITE_SPRITE_COUNT, getRaidAlienSpriteUrl, getRaidEliteSpriteUrl, RaidShipSprite } from '../RaidShipSprite'
import { getGameAudioMixSettings, getGameSoundBgmDuckProfile, getGameSoundEnabled, getGraphicsQuality, getPublicAssetUrl, playGameSound, registerGameSoundDucker, setGameAudioMixSettings, setGraphicsQuality, stopBGM } from '../sound'
import type { AudioMixSettings, GraphicsQuality } from '../sound'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { RAID_DERELICT_WRECK_VARIANTS, RAID_DEVIL_MASTER_PROJECTILE_FILTER, RAID_DEVIL_MASTER_PROJECTILE_GLOW_STOPS, RAID_PLAYER_LASER_HEAD_STOPS, RAID_SNAKE_FANG_GLOW_STOPS, RAID_SQUID_BUBBLE_STOPS, RAID_SQUID_INK_STOPS, RAID_VENOM_SPIT_STOPS, drawCanvasSpriteContain, getDerelictWreckVariantData, getDevilMasterProjectileCanvasSprite } from './assets'
import type { CanvasSpriteEntry } from './assets'
import { playCoreLanderPhysicalAttackSound, playPickupVoiceLine, warmPickupVoiceSamples } from './audio'
import { DEFAULT_RAID_PALETTE, PixiRaidBackground, RAID_BOSS_BACKGROUND_THEME_FINAL, RAID_BOSS_BACKGROUND_THEME_SNAKE, RAID_BOSS_BACKGROUND_THEME_SQUID, drawVolcanicWorldForegroundClouds, drawWateryWorldForegroundClouds, getRaidCameraShakeOffset, isVolcanicWorldTheme, isWateryWorldTheme } from './background'
import type { RaidPalette } from './background'
import { forEachDevilBossBeamLane, forEachFinalBossBeamLane, getDevilBossBeamRadius, getDevilBossChargeDuration, getFinalBossBeamLaneCount, getFinalBossBeamRadius } from './bossAttacks'
import { drawRaidEnemy, getNormalEnemyFilter } from './bossRender'
import { PickupPreviewCanvas, getBriefingPickupType } from './briefing'
import { ALLY_PLAYER_COLOR, ASTEROID_CLUSTER_SPAWN_DELAY_SECONDS, ASTEROID_CLUSTER_WARNING_SECONDS, BOSS_COLORS, BOSS_ENTRANCE_SLAM_SECONDS, BOSS_ENTRANCE_SLOWMO_SCALE, BOSS_RESPAWN_SECONDS, BOSS_RUSH_ATTACK_COOLDOWN_SCALE, BOSS_RUSH_ENTRY_SPEED_SCALE, BOSS_RUSH_MOTION_SCALE, BOSS_RUSH_SPECIAL_RECHARGE_SCALE, BOSS_RUSH_STAGES, CORE_LANDER_AOE_RADIUS, DARK_ENEMY_COLORS, DEG, DEVIL_BOSS_MAX_STAGE_GAP, DEVIL_BOSS_MIN_STAGE_GAP, DIFFICULTY_CONFIGS, EMPTY_WEAPON_FLAGS, EMPTY_WEAPON_TIMERS, FINAL_BOSS_BEAM_CHARGE_SECONDS, FINAL_BOSS_BEAM_LIFE_SECONDS, FORCE_FIELD_ARMOR, GAMEPLAY_ALERT_SNAPSHOT_INTERVAL_MS, GAMEPLAY_SNAPSHOT_INTERVAL_MS, GOD_GUNDAM_BARRAGE_DURATION_SECONDS, GOD_GUNDAM_BARRAGE_HIT_INTERVAL_SECONDS, GOD_GUNDAM_DEFEAT_HOLD_SECONDS, GOD_GUNDAM_MELEE_DAMAGE_PER_SECOND, GOD_GUNDAM_MELEE_EXHAUST_COOLDOWN_SECONDS, GOD_GUNDAM_MELEE_EXHAUST_LIMIT_SECONDS, GOD_GUNDAM_MELEE_HEAT_RECOVERY_PER_SECOND, GOD_GUNDAM_MELEE_VISUAL_DURATION_SECONDS, GOD_GUNDAM_MELEE_VISUAL_INTERVAL_SECONDS, HEIGHT, HOMING_RETARGET_SECONDS, HOMING_RETARGET_STAGGER_SECONDS, IDLE_SNAPSHOT_INTERVAL_MS, MAX_ASTEROIDS, MAX_ION_STRIKES, MAX_METEORS, MAX_RAID_STAGE, MAX_WRECKS, MESIAH_DRONE_FIRE_INTERVAL_SECONDS, MESIAH_ROCKET_FIRE_INTERVAL_SECONDS, MINI_BOSS_COLORS, MULTIPLAYER_BOSS_HP_MULTIPLIER, MULTIPLAYER_CONNECTION_CHECK_MS, MULTIPLAYER_CORRECTION_DRAIN_RATE, MULTIPLAYER_ENTITY_MARGIN, MULTIPLAYER_GUEST_SNAP_DISTANCE_SQ, MULTIPLAYER_GUEST_STALE_MS, MULTIPLAYER_HEARTBEAT_INTERVAL_MS, MULTIPLAYER_HEARTBEAT_TIMEOUT_MS, MULTIPLAYER_INPUT_INTERVAL_MS, MULTIPLAYER_MAX_ASTEROIDS, MULTIPLAYER_MAX_BUFFERED_BYTES, MULTIPLAYER_MAX_ENEMIES, MULTIPLAYER_MAX_ENEMY_SHOTS, MULTIPLAYER_MAX_GUEST_CORRECTION, MULTIPLAYER_MAX_ION_STRIKES, MULTIPLAYER_MAX_METEORS, MULTIPLAYER_MAX_POWERUPS, MULTIPLAYER_MAX_RIPPLES, MULTIPLAYER_MAX_SHOTS, MULTIPLAYER_MAX_SPARKS, MULTIPLAYER_MAX_WRECKS, MULTIPLAYER_REMOTE_BUFFER_MAX, MULTIPLAYER_REMOTE_CORRECTION_BLEND, MULTIPLAYER_REMOTE_INPUT_BLEND, MULTIPLAYER_REMOTE_INPUT_SNAP_DISTANCE_SQ, MULTIPLAYER_STATE_INTERVAL_MS, MULTIPLAYER_STATE_LOST_MS, MULTIPLAYER_STATE_STALE_MS, NORMAL_POWER_DROP_COOLDOWN, NUKE_FLASH_SECONDS, NUKE_MISSILE_SECONDS, PLAYER_COLOR, PLAYER_MAX_RANK, PLAYER_RADIUS, POWER_PITY_KILLS, RAID_BACKGROUND_THEME_COUNT, RAID_BGM_STAGE_RATES, RAID_BOSS_APPROACH_SILENCE_SECONDS, RAID_BOSS_BGM_TRACK, RAID_BOSS_FINAL_BGM_TRACK, RAID_BOSS_SNAKE_BGM_TRACK, RAID_BOSS_SQUID_BGM_TRACK, RAID_CHECKPOINTS, RAID_DEFAULT_BGM_TRACK, RAID_ENDING_BGM_TRACK, RANDOM_EVENT_WARNING_SECONDS, SHIP_OPTIONS, SIDE_VALUES, SPACE_ET_PASSIVE_FORCE_FIELD_CHARGES, SPIEGEL_KUNAI_DAMAGE_MULTIPLIER, SPIEGEL_KUNAI_SPLASH_DAMAGE_MULTIPLIER, SPIEGEL_SHADOW_CLONE_OFFSET, STAGE_CLEAR_SECONDS, STAGE_ENTRY_SECONDS, VICTORY_BLACKOUT_SECONDS, WEAPON_FIRE_INTERVALS, WEAPON_KEYS, WEAPON_STACK_CAPS, WIDTH, getBossRushStage, getNextBossRushStage, getShipSpriteSize, pickEndlessBossKind, shouldForceLocalDerelictWreckTest, shouldForceLocalDevilBossTest } from './constants'
import { drawAsteroidHazard, drawAsteroidWarning, drawDerelictWreck, drawDevilChargeWarnings, drawFinalChargeLines, drawGodGundamBarrage, drawGodGundamPassiveStrikes, drawIonStrike, drawMeteorHazard, drawNukeBlast, drawNukeMissile, drawPowerUpCanvas, drawRandomEventOverlay, drawRandomEventWarning, getHomingMissileSprite, godBarrageDamageTargetsScratch } from './effectsRender'
import { createAsteroidHazard, getAsteroidClusterInterval, getRandomEventDuration, getRandomEventInterval, pickNextRandomRaidEventKind, splitAsteroidHazard } from './events'
import { RAID_FX_CANVAS_CONTEXT_SETTINGS, getRaidGraphicsProfile, makeRaidViewportMetrics } from './graphics'
import type { RaidViewportMetrics } from './graphics'
import { clearPickupLoadout, extendLoadoutForSuperBoss, getFormationEnemyCount, getFormationSpawnSeconds, getPowerScore, getSingleEnemySpawnSeconds, resetStageLoadout } from './loadout'
import { acquireHomingTarget, animateStageClearPlayer, applyRiftPullToPlayer, applyStartingStageLevel, fullyBuffRaidPlayer, getCoreLanderFireInterval, getGodGundamBarrageBossDamage, getGodGundamBarrageDamageMultiplier, getGodGundamMeleeDamagePerSecond, getGodGundamMeleeRange, getGodGundamPassivePose, getGodGundamStageAttackBonus, getNukeBossDamage, getNukeCooldownSeconds, getPlayerBaseAttack, getRiftCenter, getSpiegelShadowCloneDamageMultiplier, hasSpiegelShadowClones, isCoreLanderBurning, levelUpPlayer, movePlayerWithInput, revivePlayerForBossClear, updatePlayerTimers } from './mechanics'
import { clampNetworkVelocity, cloneAsteroid, cloneDerelictWreck, cloneEnemy, cloneIonStrike, cloneMeteor, cloneRaidRandomEvent, cloneVec, compactPlayer, compactVec, getBufferedAsteroidVisuals, getBufferedEnemyVisuals, getBufferedPlayerVisual, getConnectionLabel, getGuestShotTtlMs, getOwnCorrectionBlend, getPlayerPickupAudioKind, getRemoteInterpolationDelayMs, hasClearedRaidInProgress, isNetworkVisible, keepNetworkVisibleInPlace, reconcilePlayerVisual, updateDerelictWreckMotion } from './network'
import { drawRaidOptions, drawRaidPlayer, getCoreBlastSprite } from './playerRender'
import { getRaidAssetPreloadInitialState, preloadGradiusRaidAssets, warmRaidGeneratedEffectSprites } from './preload'
import { clonePlayer, getCheckpointStage, getDefaultPlayerVisualShipKey, getGodGundamGameplayRenderSize, getHighScore, getInitialPlayer, getMesiahVisualShipKeyFromProgress, getOptionSupportStacks, getPlayerCoreLanderCombatModel, getRaidPlayerVisualShipKey, getShipByKey, getUnlockedStage, isCoreLanderAoeShot, isGodGundamBarragePilot, normalizeMesiahDrones, normalizeMesiahScoutDrones, powerColor, sanitizePlayerVisualShipKey, saveCheckpointStage, saveHighScore, saveUnlockedStage } from './state'
import type { AsteroidHazard, BossDefeatExplosionEvent, BossKind, BossMessage, CameraShakeState, CoreLanderCombatModel, DerelictWreck, Enemy, FormationStyle, GamePhase, GodGundamBarrage, GodGundamPassiveStrike, IonStrike, MeteorHazard, MiniBossKind, MirageBossKind, MultiplayerAsteroidSnapshot, MultiplayerConnectionQuality, MultiplayerEnemySnapshot, MultiplayerHostState, MultiplayerInput, MultiplayerPlayerSnapshot, NukeStrike, Player, PowerKind, PowerUp, RaidAssetPreloadState, RaidBgmMode, RaidDifficulty, RaidMode, RaidMultiplayerSession, RaidRandomEvent, RaidRandomEventKind, RelayGameMessage, Ripple, ShipOption, Shot, Snapshot, Spark, Vec, WeaponKey } from './types'
import { acquireRipple, acquireSpark, buildEnemyCollisionBuckets, clamp, collectShotCollisionCandidates, compactInPlace, createEnemyCollisionBuckets, distSq, drawRadialEllipse, getCachedProjectileOrbSprite, getCachedProjectileTrailSprite, getEliteEnemyChance, getMaxActiveEliteEnemies, pickEliteEnemyKind, readRaidPalette, recycleRipple, recycleRippleList, recycleSpark, recycleSparkList, takeLastFilteredMapped, updateRipplesInPlace, updateSparksInPlace } from './utils'
import type { EnemyCollisionBuckets } from './utils'

let shotId = 1

let enemyId = 1

let meteorId = 1

let ionStrikeId = 1

let wreckId = 1

let powerId = 1

let godMeleeStrikeId = 1

const NORMAL_RAID_DEVIL_BONUS_STAGE = MAX_RAID_STAGE + 1

const NORMAL_RAID_DEVIL_BONUS_CHANCE = 0.35

const BOSS_RUSH_NEXT_BOSS_DELAY_SECONDS = 0.35

const DEVIL_ASSIST_DAMAGE_SCALE = 0.28

const DEVIL_ASSIST_KEYS = new Set<string>()

const GAMEPAD_AXIS_DEADZONE = 0.18

const GAMEPAD_MENU_AXIS_THRESHOLD = 0.55

const GAMEPAD_POINTER_LEAD = 11.5

const GAMEPAD_BUTTON_CONFIRM = 0

const GAMEPAD_BUTTON_CANCEL = 1

const GAMEPAD_BUTTON_SPECIAL = 5

const GAMEPAD_BUTTON_SPECIAL_ALT = 7

const GAMEPAD_BUTTON_START = 9

const GAMEPAD_BUTTON_DPAD_UP = 12

const GAMEPAD_BUTTON_DPAD_DOWN = 13

const GAMEPAD_BUTTON_DPAD_LEFT = 14

const GAMEPAD_BUTTON_DPAD_RIGHT = 15

function getRaidEnemyScoreValue(enemy: Enemy, wave: number) {
  if (enemy.bossKind === 'devil') return 150000
  if (enemy.bossKind === 'final') return 100000
  if (enemy.bossKind === 'snake') return 65000
  if (enemy.bossKind === 'squid') return 25000
  if (enemy.isBoss) return 2800 + wave * 220
  if (enemy.isMiniBoss) return 260 + wave * 32
  return 95 + wave * 14
}

function isCoreLanderRaidPlayer(player: Player | null | undefined) {
  return player?.ship.key === 'coreLander'
}

function getNormalRaidDevilAssistModel(player: Player, progress: ReturnType<typeof loadProgress>): CoreLanderCombatModel | null {
  if (player.ship.key !== 'coreLander') return null
  const model = getPlayerCoreLanderCombatModel(player, progress)
  if (model === 'godGundam') return 'spiegel'
  if (model === 'spiegel') return 'godGundam'
  return 'godGundam'
}

export function GradiusRaid({
  onClose,
  initialMode = 'campaign',
  multiplayerSession,
  sameScreenCoop = false,
  sameScreenGuestShipKey = 'fast',
  playerName,
  language = 'en',
  onRunComplete,
}: {
  onClose: () => void
  initialMode?: RaidMode
  multiplayerSession?: RaidMultiplayerSession | null
  sameScreenCoop?: boolean
  sameScreenGuestShipKey?: string
  playerName: string
  language?: LanguageCode
  onRunComplete?: (result: RunResult) => void
}) {
  const initialRaidMode: RaidMode = multiplayerSession || sameScreenCoop ? 'campaign' : initialMode
  const rootRef = useRef<HTMLDivElement | null>(null)
  const pixiBackgroundHostRef = useRef<HTMLDivElement | null>(null)
  const pixiBackgroundRef = useRef<PixiRaidBackground | null>(null)
  const fxCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const fxCanvasContextRef = useRef<CanvasRenderingContext2D | null>(null)
  const rafRef = useRef(0)
  const lastTimeRef = useRef(0)
  const lastRenderTimeRef = useRef(0)
  const lastIdleDrawTimeRef = useRef(0)
  const graphicsQualityRef = useRef<GraphicsQuality>(getGraphicsQuality())
  const viewportMetricsRef = useRef<RaidViewportMetrics | null>(null)
  const fxCanvasSmoothingQualityRef = useRef<ImageSmoothingQuality | null>(null)
  const snapshotKeyRef = useRef('')
  const paletteRef = useRef<RaidPalette>(DEFAULT_RAID_PALETTE)
  const paletteClassRef = useRef('')
  const cameraShakeRef = useRef<CameraShakeState>({ until: 0, duration: 0, strength: 0, seed: 0 })
  const cameraShakeAppliedRef = useRef(false)
  const keysRef = useRef(new Set<string>())
  const pointerTargetRef = useRef<Vec | null>(null)
  const pointerVisualRef = useRef<Vec | null>(null)
  const touchPointerActiveRef = useRef(false)
  const gamepadButtonsRef = useRef(new Map<number, Set<number>>())
  const gamepadPointerActiveRef = useRef<{ p1: boolean; p2: boolean }>({ p1: false, p2: false })
  const gamepadPilotAssignmentsRef = useRef<{ p1: number | null; p2: number | null }>({ p1: null, p2: null })
  const gamepadNextMenuNavRef = useRef(0)
  const selectedShipRef = useRef<ShipOption>(SHIP_OPTIONS[0])
  const progressRef = useRef(loadProgress())
  const shipCosmeticsCacheRef = useRef(new Map<string, { progress: ReturnType<typeof loadProgress>, cosmetics: Required<ShipCosmeticEquipState> }>())
  const multiplayerSessionRef = useRef<RaidMultiplayerSession | null>(multiplayerSession ?? null)
  const sameScreenCoopRef = useRef(sameScreenCoop)
  const sameScreenGuestShipKeyRef = useRef(sameScreenGuestShipKey)
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
  const coOpRunRef = useRef(Boolean(multiplayerSession || sameScreenCoop))
  const remoteKeysRef = useRef(new Set<string>())
  const remotePointerTargetRef = useRef<Vec | null>(null)
  const remotePointerVisualRef = useRef<Vec | null>(null)
  const remotePlayerRef = useRef<Player | null>(null)
  const isCoOpActive = () => Boolean(multiplayerSessionRef.current || sameScreenCoopRef.current)
  // Accumulated position error between local prediction and host state � drained gradually each frame
  const guestPositionCorrectionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  // Locally predicted shots for the guest (shown immediately, cleared when host confirms them)
  const guestLocalShotsRef = useRef<Array<Shot & { spawnedAt: number }>>([])
  // When non-null, pushShot writes to this array instead of shotsRef (used for local prediction capture)
  const fireCaptureRef = useRef<Shot[] | null>(null)
  const victoryPendingRef = useRef(false)
  const victoryBlackoutRef = useRef(0)
  // Local fire cooldowns for guest prediction � independent from network-synced player cooldowns
  const guestLocalFireCooldownRef = useRef(0)
  const guestLocalWeaponCooldownsRef = useRef<Record<WeaponKey, number>>({ ...EMPTY_WEAPON_TIMERS })
  // Stable ref to firePlayer so predictGuestPlayer can call it without a forward-declaration issue
  const firePlayerRef = useRef<(player: Player) => void>((_p: Player) => {})
  const playerRef = useRef<Player>(getInitialPlayer())
  const devilAssistPlayerRef = useRef<Player | null>(null)
  const devilAssistMoveTargetRef = useRef<Vec | null>(null)
  const devilAssistEntryRef = useRef(0)
  const leaderboardSubmittedRef = useRef(false)
  const runStartTimeRef = useRef(performance.now())
  const runReportedRef = useRef(false)
  const enemiesDestroyedRef = useRef(0)
  const bossesDefeatedRef = useRef(0)
  const devilBossEncounteredRef = useRef(false)
  const devilBossDefeatedRef = useRef(false)
  const devilBossNextEligibleStageRef = useRef(1)
  const devilPreBuffRankRef = useRef(1)
  const normalRaidDevilBonusEligibleRef = useRef(false)
  const normalRaidDevilBonusTriggeredRef = useRef(false)
  const [selectedDifficulty, setSelectedDifficulty] = useState<RaidDifficulty>('normal')
  const raidDifficultyRef = useRef<RaidDifficulty>('normal')
  const scoreMultRef = useRef(1)
  const enemyHpMultRef = useRef(1)
  const enemyDamageMultRef = useRef(1)
  const pickupsCollectedRef = useRef(0)
  const nukesUsedRef = useRef(0)
  const shotsRef = useRef<Shot[]>([])
  const enemyShotsRef = useRef<Shot[]>([])
  const expiredSquidBubblesRef = useRef<Shot[]>([])
  const spawnedSquidBubblesRef = useRef<Shot[]>([])
  const spawnedAsteroidsRef = useRef<AsteroidHazard[]>([])
  const enemiesRef = useRef<Enemy[]>([])
  const enemyCollisionBucketsRef = useRef<EnemyCollisionBuckets>(createEnemyCollisionBuckets())
  const largeEnemyCollisionRef = useRef<Enemy[]>([])
  const shotCollisionCandidatesRef = useRef<Enemy[]>([])
  const asteroidsRef = useRef<AsteroidHazard[]>([])
  const meteorsRef = useRef<MeteorHazard[]>([])
  const ionStrikesRef = useRef<IonStrike[]>([])
  const wrecksRef = useRef<DerelictWreck[]>([])
  const powerUpsRef = useRef<PowerUp[]>([])
  const sparksRef = useRef<Spark[]>([])
  const ripplesRef = useRef<Ripple[]>([])
  const homingTargetsRef = useRef<Map<number, Enemy>>(new Map())
  const phaseRef = useRef<GamePhase>('select')
  const raidModeRef = useRef<RaidMode>(initialRaidMode)
  const stageRef = useRef(1)
  const waveRef = useRef(1)
  const spawnTimerRef = useRef(0.5)
  const formationTimerRef = useRef(2.1)
  const bossTimerRef = useRef(28)
  const spawnLockRef = useRef(0)
  const powerDropCooldownRef = useRef(0)
  const finalBossSupportDropTimerRef = useRef(18 + Math.random() * 12)
  const killsSincePowerRef = useRef(0)
  const bossAlertRef = useRef(0)
  const bossMessageRef = useRef<BossMessage>(null)
  const bossEntranceSlamRef = useRef(0)
  const stageClearRef = useRef(0)
  const stageEntryRef = useRef(0)
  const pendingNextStageRef = useRef<number | null>(null)
  const nukeFlashRef = useRef(0)
  const nukeStrikeRef = useRef<NukeStrike | null>(null)
  const nukeBlastOriginRef = useRef<Vec>({ x: 50, y: 46 })
  const godBarrageRef = useRef<GodGundamBarrage | null>(null)
  const godMeleeStrikesRef = useRef<GodGundamPassiveStrike[]>([])
  const bossDefeatExplosionEventsRef = useRef<BossDefeatExplosionEvent[]>([])
  const asteroidClusterTimerRef = useRef(34 + Math.random() * 18)
  const asteroidSpawnDelayRef = useRef(0)
  const asteroidWarningRef = useRef(0)
  const randomEventRef = useRef<RaidRandomEvent | null>(null)
  const randomEventTimerRef = useRef(24 + Math.random() * 18)
  const randomEventSpawnTimerRef = useRef(0)
  const lastRandomEventKindRef = useRef<RaidRandomEventKind | null>(null)
  const localDerelictWreckTestTriggeredRef = useRef(false)
  const highScoreRef = useRef(getHighScore())
  const unlockedStageRef = useRef(getUnlockedStage())
  const raidBgmElementRef = useRef<HTMLAudioElement | null>(null)
  const raidBgmTargetVolumeRef = useRef(0)
  const raidBgmDuckAnimationRef = useRef(0)
  const raidBgmDuckRestoreTimerRef = useRef(0)
  const raidBgmDuckRestoreAtRef = useRef(0)
  const raidBgmModeRef = useRef<RaidBgmMode | null>(null)
  const raidBgmStageRef = useRef(0)
  const raidBgmTrackRef = useRef<string | null>(null)
  const raidBgmBossKindRef = useRef<BossKind | null>(null)
  const raidBgmRequestedModeRef = useRef<RaidBgmMode | null>(null)
  const raidBgmRequestedStageRef = useRef(0)
  const raidBgmRequestedBossKindRef = useRef<BossKind | null>(null)
  const startRaidBgmRef = useRef<(stage: number, mode?: RaidBgmMode, bossKind?: BossKind | null) => void>(() => {})
  const stopRaidBgmRef = useRef<() => void>(() => {})
  const [selectedShipKey, setSelectedShipKey] = useState(SHIP_OPTIONS[0].key)
  const [briefingStep, setBriefingStep] = useState(0)
  const [stagePickerOpen, setStagePickerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [difficultyOpen, setDifficultyOpen] = useState(false)
  const [audioMix, setAudioMix] = useState<AudioMixSettings>(() => getGameAudioMixSettings())
  const [assetPreload, setAssetPreload] = useState<RaidAssetPreloadState>(getRaidAssetPreloadInitialState)
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
    bossEntranceSlam: 0,
    highScore: highScoreRef.current,
    selectedShipKey: SHIP_OPTIONS[0].key,
    pointer: null,
    stageClear: 0,
    unlockedStage: unlockedStageRef.current,
    nukeCooldown: 0,
    nukeFlash: 0,
    asteroidWarning: 0,
    randomEvent: null,
    raidMode: initialRaidMode,
  }))
  const [multiplayerConnection, setMultiplayerConnection] = useState<{
    quality: MultiplayerConnectionQuality
    label: string
    rtt: number | null
  }>({ quality: 'good', label: 'Link good', rtt: null })

  useEffect(() => {
    multiplayerSessionRef.current = multiplayerSession ?? null
    sameScreenCoopRef.current = sameScreenCoop
    sameScreenGuestShipKeyRef.current = sameScreenGuestShipKey
    if (multiplayerSession || sameScreenCoop) coOpRunRef.current = true
  }, [multiplayerSession, sameScreenCoop, sameScreenGuestShipKey])

  const preloadRaidAssetsForMenu = useCallback(async (showLoading = false) => {
    if (showLoading) setAssetPreload((state) => state.status === 'ready' ? state : { status: 'loading', loaded: state.loaded, total: Math.max(1, state.total) })
    await preloadGradiusRaidAssets((loaded, total) => {
      setAssetPreload({ status: loaded >= total ? 'ready' : 'loading', loaded, total: Math.max(1, total) })
    })
    setAssetPreload((state) => ({ ...state, status: 'ready', loaded: state.total, total: Math.max(1, state.total) }))
  }, [])

  useEffect(() => {
    void preloadRaidAssetsForMenu(true)
  }, [preloadRaidAssetsForMenu])

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
    const bossEntranceSlamBucket = bossEntranceSlamRef.current > 0 ? Math.ceil(bossEntranceSlamRef.current * 20) : 0
    const stageClearBucket = stageClearRef.current > 0 ? Math.ceil(stageClearRef.current * 30) : 0
    const playerSpecialCooldownBucket = player.specialCooldown > 0 ? Math.ceil(player.specialCooldown) : 0
    const remoteSpecialCooldownBucket = remotePlayer && remotePlayer.specialCooldown > 0 ? Math.ceil(remotePlayer.specialCooldown) : 0
    const nukeFlashBucket = nukeFlashRef.current > 0 ? Math.ceil(nukeFlashRef.current * 10) : 0
    const asteroidWarningBucket = asteroidWarningRef.current > 0 ? Math.ceil(asteroidWarningRef.current * 4) : 0
    const randomEvent = randomEventRef.current
    const randomEventBucket = randomEvent ? `${randomEvent.kind}:${Math.ceil(randomEvent.warning * 4)}:${Math.ceil(randomEvent.age * 2)}` : ''
    const snapshotKey = [
      phaseRef.current,
      raidModeRef.current,
      stageRef.current,
      waveRef.current,
      bossAlertBucket,
      bossMessageRef.current ?? '',
      bossEntranceSlamBucket,
      highScoreRef.current,
      selectedShipRef.current.key,
      stageClearBucket,
      playerSpecialCooldownBucket,
      remoteSpecialCooldownBucket,
      nukeFlashBucket,
      asteroidWarningBucket,
      randomEventBucket,
      unlockedStageRef.current,
      player.hp,
      player.maxHp,
      player.visualShipKey,
      Math.ceil(player.shield * 10),
      player.forceField,
      player.score,
      player.rank,
      remotePlayer?.ship.key ?? '',
      remotePlayer?.visualShipKey ?? '',
      remotePlayer?.score ?? 0,
      remotePlayer?.hp ?? 0,
      remotePlayer?.maxHp ?? 0,
      remotePlayer?.rank ?? 0,
      remotePlayer?.forceField ?? 0,
      ...WEAPON_KEYS.map((key) => remotePlayer?.weapons[key] ?? 0),
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
      bossEntranceSlam: bossEntranceSlamRef.current,
      highScore: highScoreRef.current,
      selectedShipKey: selectedShipRef.current.key,
      pointer: null,
      stageClear: stageClearRef.current,
      unlockedStage: unlockedStageRef.current,
      nukeCooldown: player.specialCooldown,
      nukeFlash: nukeFlashRef.current,
      asteroidWarning: asteroidWarningRef.current,
      randomEvent: cloneRaidRandomEvent(randomEventRef.current),
      raidMode: raidModeRef.current,
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
    shots: takeLastFilteredMapped(shotsRef.current, MULTIPLAYER_MAX_SHOTS, isNetworkVisible, compactVec),
    enemyShots: takeLastFilteredMapped(enemyShotsRef.current, MULTIPLAYER_MAX_ENEMY_SHOTS, isNetworkVisible, compactVec),
    enemies: takeLastFilteredMapped(enemiesRef.current, MULTIPLAYER_MAX_ENEMIES, (enemy) => enemy.isBoss || isNetworkVisible(enemy), compactVec),
    asteroids: takeLastFilteredMapped(asteroidsRef.current, MULTIPLAYER_MAX_ASTEROIDS, isNetworkVisible, compactVec),
    meteors: takeLastFilteredMapped(meteorsRef.current, MULTIPLAYER_MAX_METEORS, isNetworkVisible, compactVec),
    ionStrikes: ionStrikesRef.current
      .slice(-MULTIPLAYER_MAX_ION_STRIKES)
      .map(cloneIonStrike),
    wrecks: takeLastFilteredMapped(wrecksRef.current, MULTIPLAYER_MAX_WRECKS, isNetworkVisible, compactVec),
    powerUps: takeLastFilteredMapped(powerUpsRef.current, MULTIPLAYER_MAX_POWERUPS, isNetworkVisible, compactVec),
    sparks: takeLastFilteredMapped(sparksRef.current, MULTIPLAYER_MAX_SPARKS, isNetworkVisible, compactVec),
    ripples: takeLastFilteredMapped(ripplesRef.current, MULTIPLAYER_MAX_RIPPLES, isNetworkVisible, compactVec),
    wave: waveRef.current,
    stageTheme: stageRef.current,
    bossAlert: bossAlertRef.current,
    bossMessage: bossMessageRef.current,
    bossEntranceSlam: bossEntranceSlamRef.current,
    highScore: highScoreRef.current,
    selectedShipKey: selectedShipRef.current.key,
    hostPointer: cloneVec(pointerVisualRef.current),
    guestPointer: cloneVec(remotePointerVisualRef.current),
    stageClear: stageClearRef.current,
    unlockedStage: unlockedStageRef.current,
    nukeCooldown: playerRef.current.specialCooldown,
    nukeFlash: nukeFlashRef.current,
    nukeStrike: nukeStrikeRef.current ? { ...nukeStrikeRef.current } : null,
    nukeBlastOrigin: { ...nukeBlastOriginRef.current },
    godBarrage: godBarrageRef.current ? { ...godBarrageRef.current } : null,
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

    const prevHostPlayerForAudio = session && !session.isHost ? clonePlayer(playerRef.current) : null
    const prevGuestPlayerForAudio = session && !session.isHost && remotePlayerRef.current ? clonePlayer(remotePlayerRef.current) : null
    const prevEnemiesForAudio = session && !session.isHost ? enemiesRef.current.map(cloneEnemy) : []

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
        // -- Client-side prediction reconciliation ----------------------------------
        // Do NOT pull position toward the host's stale value every packet �
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
        current.optionStacks = nextGuestPlayer.optionStacks ?? (nextGuestPlayer.optionTimer > 0 ? 1 : 0)
        current.score = nextGuestPlayer.score
        current.rank = nextGuestPlayer.rank
        current.ship = nextGuestPlayer.ship
        current.visualShipKey = nextGuestPlayer.visualShipKey
        current.weapons = { ...nextGuestPlayer.weapons }
        current.weaponTimers = { ...nextGuestPlayer.weaponTimers }
        current.specialCooldown = nextGuestPlayer.specialCooldown
        current.engineBoost = Math.max(current.engineBoost ?? 0, nextGuestPlayer.engineBoost ?? 0)
        current.spiegelAfterimageStrength = nextGuestPlayer.spiegelAfterimageStrength ?? current.spiegelAfterimageStrength ?? 0
        current.spiegelAfterimages = (nextGuestPlayer.spiegelAfterimages ?? []).map((afterimage) => ({ ...afterimage }))
        current.mesiahDroneTimer = nextGuestPlayer.mesiahDroneTimer ?? current.mesiahDroneTimer ?? 0
        current.mesiahDroneCooldown = nextGuestPlayer.mesiahDroneCooldown ?? 0
        current.mesiahDroneFireCooldown = nextGuestPlayer.mesiahDroneFireCooldown ?? current.mesiahDroneFireCooldown ?? 0
        current.mesiahRocketCooldown = nextGuestPlayer.mesiahRocketCooldown ?? current.mesiahRocketCooldown ?? 0
        current.mesiahDrones = normalizeMesiahDrones(nextGuestPlayer).map((drone) => ({ ...drone }))
        current.mesiahScoutDrones = normalizeMesiahScoutDrones(nextGuestPlayer).map((scout) => ({ ...scout }))
        current.burningBlend = nextGuestPlayer.burningBlend ?? current.burningBlend ?? 0
        current.godMeleeHeat = nextGuestPlayer.godMeleeHeat ?? current.godMeleeHeat ?? 0
        current.godMeleeExhaust = nextGuestPlayer.godMeleeExhaust ?? current.godMeleeExhaust ?? 0
        current.godMeleeVisualTimer = nextGuestPlayer.godMeleeVisualTimer ?? current.godMeleeVisualTimer ?? 0
        current.godMeleeCloak = nextGuestPlayer.godMeleeCloak ?? current.godMeleeCloak ?? 0
        current.godMeleeChainX = nextGuestPlayer.godMeleeChainX ?? current.godMeleeChainX ?? current.x
        current.godMeleeChainY = nextGuestPlayer.godMeleeChainY ?? current.godMeleeChainY ?? current.y
        current.godMeleeLastTargetKey = nextGuestPlayer.godMeleeLastTargetKey ?? current.godMeleeLastTargetKey ?? ''
        // fireCooldown and weaponCooldowns are kept local so prediction timing is unaffected
      }
      // Expire locally predicted shots � confirmed shots from host have arrived
      if (guestLocalShotsRef.current.length > 0) {
        const expiry = now - getGuestShotTtlMs(multiplayerRttRef.current)
    compactInPlace(guestLocalShotsRef.current, (shot) => shot.spawnedAt > expiry)
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
    const prevBossMessage = bossMessageRef.current
    const prevStageClear = stageClearRef.current
    const prevNukeFlash = nukeFlashRef.current
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
    bossEntranceSlamRef.current = state.bossEntranceSlam ?? 0
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
    nukeFlashRef.current = state.nukeFlash
    nukeStrikeRef.current = state.nukeStrike ? { ...state.nukeStrike } : null
    nukeBlastOriginRef.current = { ...state.nukeBlastOrigin }
    godBarrageRef.current = state.godBarrage ? { ...state.godBarrage } : null
    asteroidWarningRef.current = state.asteroidWarning ?? 0
    randomEventRef.current = cloneRaidRandomEvent(state.randomEvent ?? null)
    remotePointerVisualRef.current = cloneVec(state.guestPointer)

    if (session && !session.isHost) {
      const bossEnemy = state.enemies.find((enemy) => enemy.isBoss) ?? null
      const bossActive = !!bossEnemy || state.bossMessage === 'incoming'
      const nextBgmMode: RaidBgmMode | null = state.phase === 'victory'
        ? 'ending'
        : state.phase !== 'playing'
          ? null
          : bossActive
            ? 'boss'
            : state.stageClear > 0 || state.enemies.length > 0
              ? 'combat'
              : 'cruise'

      if (nextBgmMode) {
        startRaidBgmRef.current(state.stageTheme, nextBgmMode, bossEnemy?.bossKind ?? null)
      } else {
        stopRaidBgmRef.current()
      }

      if (state.bossMessage === 'incoming' && prevBossMessage !== 'incoming') {
        playGameSound('stinger')
      }
      const criticalBoss = state.enemies.find((enemy) => {
        if (!enemy.isBoss || enemy.hp <= 0 || enemy.maxHp <= 0 || enemy.hp / enemy.maxHp > 0.25) return false
        const previous = prevEnemiesForAudio.find((prevEnemy) => prevEnemy.id === enemy.id)
        return !previous || previous.hp / Math.max(1, previous.maxHp) > 0.25
      })
      if (criticalBoss) playGameSound('stinger_2')
      if (state.bossMessage === 'clear' && prevBossMessage !== 'clear') {
        player.godMeleeCloak = 0
        if (remotePlayerRef.current) remotePlayerRef.current.godMeleeCloak = 0
        playGameSound('levelup')
        playGameSound('combo')
      }
      if (prevStageClear <= 0 && state.stageClear > 0 && state.phase === 'playing') {
        playGameSound('score')
      }
      if (prevNukeFlash <= 0.05 && state.nukeFlash > 0.4) {
        playGameSound('nuke_explosion')
      }
      if (prevPhase !== 'gameover' && state.phase === 'gameover') {
        playGameSound('gameover')
      }
      const hostPickupKind = getPlayerPickupAudioKind(prevHostPlayerForAudio, state.hostPlayer)
      const guestPickupKind = getPlayerPickupAudioKind(prevGuestPlayerForAudio, state.guestPlayer)
      const pickupKind = guestPickupKind ?? hostPickupKind
      if (pickupKind) {
        playPickupVoiceLine(pickupKind)
        playGameSound('levelup')
      }
      if (prevHostPlayerForAudio && state.hostPlayer.hp < prevHostPlayerForAudio.hp && state.hostPlayer.hp > 0) {
        playGameSound('hit')
      }
      if (prevGuestPlayerForAudio && state.guestPlayer && state.guestPlayer.hp < prevGuestPlayerForAudio.hp && state.guestPlayer.hp > 0) {
        playGameSound('hit')
      }
      const nextEnemyIds = new Set(state.enemies.map((enemy) => enemy.id))
      const destroyedEnemy = prevEnemiesForAudio.find((enemy) => enemy.hp > 0 && enemy.y > -10 && enemy.y < HEIGHT + 10 && !nextEnemyIds.has(enemy.id))
      if (destroyedEnemy && state.phase === 'playing') {
        playGameSound(destroyedEnemy.isBoss ? 'destroyed_explosion' : destroyedEnemy.isMiniBoss ? 'explosion_big' : 'explosion')
      }
    }

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
      bossEntranceSlam: state.bossEntranceSlam ?? 0,
      highScore: state.highScore,
      selectedShipKey: ownPlayer.ship.key,
      pointer: null,
      stageClear: state.stageClear,
      unlockedStage: state.unlockedStage,
      nukeCooldown: ownPlayer.specialCooldown ?? state.nukeCooldown,
      nukeFlash: state.nukeFlash,
      asteroidWarning: state.asteroidWarning ?? 0,
      randomEvent: cloneRaidRandomEvent(state.randomEvent ?? null),
      raidMode: 'campaign',
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

    // Move own ship locally � never wait for the network
    if (stageClearRef.current > 0) {
      animateStageClearPlayer(guestPlayer, dt, 58)
      pointerTargetRef.current = null
      pointerVisualRef.current = null
      remotePointerVisualRef.current = null
      return
    }

    movePlayerWithInput(guestPlayer, dt, pointerTargetRef.current, keysRef.current, getPlayerCoreLanderCombatModel(guestPlayer, progressRef.current))
    const isSmallViewport = Boolean(viewportMetricsRef.current && viewportMetricsRef.current.cssWidth < 640)
    updatePlayerTimers(guestPlayer, dt, enemiesRef.current, isSmallViewport)

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
      if (shot.kind === 'beam' && shot.angle !== undefined && shot.spin) {
        shot.angle += shot.spin * dt
      }
      shot.x += shot.vx * dt
      shot.y += shot.vy * dt
    }
    keepNetworkVisibleInPlace(shotsRef.current)

    for (const shot of enemyShotsRef.current) {
      if (shot.kind === 'beam' && shot.angle !== undefined && shot.spin) {
        shot.angle += shot.spin * dt
      }
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
        enemy.hitFlash = Math.max(0, (enemy.hitFlash ?? 0) - dt)
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
      updateDerelictWreckMotion(wreck, dt, performance.now() / 1000)
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
    if (godBarrageRef.current) {
      godBarrageRef.current.age += dt
      if (godBarrageRef.current.age >= godBarrageRef.current.duration) godBarrageRef.current = null
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
            stopRaidBgmRef.current()
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
        remoteKeysRef.current.clear()
        for (const key of input.keys as string[]) remoteKeysRef.current.add(key.toLowerCase())
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
    const quality = graphicsQualityRef.current
    if (quality === 'low') return
    const profile = getRaidGraphicsProfile(quality, false, isCoOpActive())
    if (ripplesRef.current.length >= profile.maxRipples) {
      const trimCount = ripplesRef.current.length - Math.max(0, profile.maxRipples - 1)
      for (let index = 0; index < trimCount; index += 1) recycleRipple(ripplesRef.current[index])
      ripplesRef.current.splice(0, trimCount)
    }
    const rippleLife = 0.32
    ripplesRef.current.push(acquireRipple(x, y, color, size * 0.72, rippleLife))
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const getNow = () => (
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
    )
    const setRaidBgmVolumeSmooth = (audio: HTMLAudioElement, target: number, durationMs: number) => {
      const startVolume = audio.volume
      const startedAt = getNow()
      if (raidBgmDuckAnimationRef.current) window.cancelAnimationFrame(raidBgmDuckAnimationRef.current)

      const step = () => {
        if (raidBgmElementRef.current !== audio) return
        const progress = durationMs <= 0 ? 1 : Math.max(0, Math.min(1, (getNow() - startedAt) / durationMs))
        const eased = 1 - Math.pow(1 - progress, 3)
        audio.volume = Math.max(0, Math.min(1, startVolume + (target - startVolume) * eased))
        if (progress < 1) {
          raidBgmDuckAnimationRef.current = window.requestAnimationFrame(step)
        } else {
          raidBgmDuckAnimationRef.current = 0
        }
      }
      step()
    }
    const releaseDucker = registerGameSoundDucker((kind) => {
      const profile = getGameSoundBgmDuckProfile(kind)
      const audio = raidBgmElementRef.current
      const targetVolume = raidBgmTargetVolumeRef.current
      if (!profile || !audio || targetVolume <= 0) return
      if (raidBgmDuckRestoreTimerRef.current) window.clearTimeout(raidBgmDuckRestoreTimerRef.current)
      const now = getNow()
      const duckedVolume = Math.min(audio.volume, targetVolume * profile.volumeScale)
      raidBgmDuckRestoreAtRef.current = Math.max(raidBgmDuckRestoreAtRef.current, now + profile.holdMs)
      setRaidBgmVolumeSmooth(audio, duckedVolume, profile.attackMs)
      raidBgmDuckRestoreTimerRef.current = window.setTimeout(() => {
        raidBgmDuckRestoreTimerRef.current = 0
        raidBgmDuckRestoreAtRef.current = 0
        if (raidBgmElementRef.current === audio) {
          setRaidBgmVolumeSmooth(audio, raidBgmTargetVolumeRef.current, profile.releaseMs)
        }
      }, Math.max(0, raidBgmDuckRestoreAtRef.current - now))
    })

    return () => {
      releaseDucker()
      if (raidBgmDuckAnimationRef.current) window.cancelAnimationFrame(raidBgmDuckAnimationRef.current)
      if (raidBgmDuckRestoreTimerRef.current) window.clearTimeout(raidBgmDuckRestoreTimerRef.current)
      raidBgmDuckAnimationRef.current = 0
      raidBgmDuckRestoreTimerRef.current = 0
      raidBgmDuckRestoreAtRef.current = 0
    }
  }, [])

  const stopRaidBgm = useCallback(() => {
    if (typeof window !== 'undefined') {
      if (raidBgmDuckAnimationRef.current) window.cancelAnimationFrame(raidBgmDuckAnimationRef.current)
      if (raidBgmDuckRestoreTimerRef.current) window.clearTimeout(raidBgmDuckRestoreTimerRef.current)
    }
    raidBgmDuckAnimationRef.current = 0
    raidBgmDuckRestoreTimerRef.current = 0
    raidBgmDuckRestoreAtRef.current = 0
    raidBgmTargetVolumeRef.current = 0
    if (raidBgmElementRef.current) {
      raidBgmElementRef.current.pause()
      raidBgmElementRef.current.currentTime = 0
      raidBgmElementRef.current = null
    }
    raidBgmModeRef.current = null
    raidBgmStageRef.current = 0
    raidBgmTrackRef.current = null
    raidBgmBossKindRef.current = null
    raidBgmRequestedModeRef.current = null
    raidBgmRequestedStageRef.current = 0
    raidBgmRequestedBossKindRef.current = null
  }, [])

  const startRaidBgm = useCallback((stage: number, mode: RaidBgmMode = 'cruise', bossKind: BossKind | null = null) => {
    if (typeof window === 'undefined') return
    raidBgmRequestedModeRef.current = mode
    raidBgmRequestedStageRef.current = stage
    raidBgmRequestedBossKindRef.current = bossKind
    if (!getGameSoundEnabled()) {
      stopRaidBgm()
      return
    }

    const bossTrack =
      bossKind === 'squid' ? RAID_BOSS_SQUID_BGM_TRACK :
        bossKind === 'snake' ? RAID_BOSS_SNAKE_BGM_TRACK :
          bossKind === 'final' || bossKind === 'devil' ? RAID_BOSS_FINAL_BGM_TRACK :
            RAID_BOSS_BGM_TRACK
    const track =
      mode === 'ending' ? RAID_ENDING_BGM_TRACK :
        mode === 'boss' ? bossTrack :
          RAID_DEFAULT_BGM_TRACK
    const trackChanged = raidBgmTrackRef.current !== track
    if (raidBgmModeRef.current === mode && raidBgmStageRef.current === stage && raidBgmBossKindRef.current === bossKind && raidBgmElementRef.current && !trackChanged) {
      if (raidBgmElementRef.current.paused) {
        void raidBgmElementRef.current.play().catch(() => {})
      }
      return
    }

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
    const targetVolume = Math.max(0, Math.min(1, modeVolume * mix.master * mix.bgm))
    raidBgmTargetVolumeRef.current = targetVolume
    audio.volume = targetVolume
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
    raidBgmBossKindRef.current = bossKind

    void audio.play().catch(() => {
      raidBgmModeRef.current = null
      raidBgmStageRef.current = 0
      raidBgmTrackRef.current = null
      raidBgmBossKindRef.current = null
      raidBgmElementRef.current = null
    })
  }, [stopRaidBgm])

  stopRaidBgmRef.current = stopRaidBgm
  startRaidBgmRef.current = startRaidBgm

  useEffect(() => {
    if (typeof window === 'undefined') return

    const retryRaidAudio = () => {
      if (!getGameSoundEnabled()) return
      const requestedMode = raidBgmRequestedModeRef.current
      const requestedStage = raidBgmRequestedStageRef.current
      const requestedBossKind = raidBgmRequestedBossKindRef.current
      if (requestedMode) {
        startRaidBgmRef.current(requestedStage || stageRef.current, requestedMode, requestedBossKind)
      }
    }

    window.addEventListener('pointerdown', retryRaidAudio, { passive: true })
    window.addEventListener('keydown', retryRaidAudio)
    window.addEventListener('touchstart', retryRaidAudio, { passive: true })

    return () => {
      window.removeEventListener('pointerdown', retryRaidAudio)
      window.removeEventListener('keydown', retryRaidAudio)
      window.removeEventListener('touchstart', retryRaidAudio)
    }
  }, [])

  const getCachedEquippedCosmetics = (shipKey: string) => {
    const progress = progressRef.current
    const cached = shipCosmeticsCacheRef.current.get(shipKey)
    if (cached?.progress === progress) return cached.cosmetics
    const cosmetics = getEquippedShipCosmetics(progress, shipKey)
    shipCosmeticsCacheRef.current.set(shipKey, { progress, cosmetics })
    return cosmetics
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    const refreshViewportMetrics = () => {
      const root = rootRef.current
      if (!root) return
      viewportMetricsRef.current = makeRaidViewportMetrics(root, graphicsQualityRef.current, isCoOpActive())
    }

    refreshViewportMetrics()
    const root = rootRef.current
    const resizeObserver = typeof ResizeObserver !== 'undefined' && root ? new ResizeObserver(refreshViewportMetrics) : null
    if (root && resizeObserver) resizeObserver.observe(root)
    window.addEventListener('resize', refreshViewportMetrics, { passive: true })

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', refreshViewportMetrics)
    }
  }, [])

  useEffect(() => {
    const host = pixiBackgroundHostRef.current
    if (!host) return

    let cancelled = false
    const background = new PixiRaidBackground()
    pixiBackgroundRef.current = background

    void background.init(host).then((ready) => {
      if (cancelled) {
        background.destroy()
        return
      }
      if (!ready && pixiBackgroundRef.current === background) pixiBackgroundRef.current = null
    })

    return () => {
      cancelled = true
      if (pixiBackgroundRef.current === background) pixiBackgroundRef.current = null
      background.destroy()
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const warmupTimer = window.setTimeout(() => {
      warmRaidGeneratedEffectSprites()
      warmPickupVoiceSamples()
    }, 250)
    return () => window.clearTimeout(warmupTimer)
  }, [])

  const drawFxCanvas = useCallback((time = performance.now()) => {
    const canvas = fxCanvasRef.current
    const root = rootRef.current
    if (!canvas || !root) return

    const gfxQuality = graphicsQualityRef.current
    const multiplayerActive = isCoOpActive()
    let viewport = viewportMetricsRef.current
    if (!viewport || viewport.quality !== gfxQuality || viewport.multiplayer !== multiplayerActive) {
      viewport = makeRaidViewportMetrics(root, gfxQuality, multiplayerActive)
      viewportMetricsRef.current = viewport
    }
    const { cssWidth, cssHeight, dpr, profile: gfxProfile, visualScale } = viewport
    const width = viewport.canvasWidth
    const height = viewport.canvasHeight

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
      fxCanvasContextRef.current = null
      fxCanvasSmoothingQualityRef.current = null
    }

    const ctx = fxCanvasContextRef.current ?? canvas.getContext('2d', RAID_FX_CANVAS_CONTEXT_SETTINGS)
    if (!ctx) return
    fxCanvasContextRef.current = ctx
    const nextSmoothingQuality: ImageSmoothingQuality = gfxQuality === 'low' || gfxQuality === 'medium' ? 'medium' : 'high'
    if (fxCanvasSmoothingQualityRef.current !== nextSmoothingQuality) {
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = nextSmoothingQuality
      fxCanvasSmoothingQualityRef.current = nextSmoothingQuality
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssWidth, cssHeight)

    const toX = (value: number) => (value / WIDTH) * cssWidth
    const toY = (value: number) => (value / HEIGHT) * cssHeight

    if (paletteClassRef.current !== root.className) {
      paletteClassRef.current = root.className
      paletteRef.current = readRaidPalette(root)
    }

    const shake = getRaidCameraShakeOffset(cameraShakeRef.current, time, cssWidth, cssHeight)
    const isShaking = shake.x !== 0 || shake.y !== 0
    if (isShaking) {
      root.style.setProperty('--raid-camera-x', `${shake.x.toFixed(2)}px`)
      root.style.setProperty('--raid-camera-y', `${shake.y.toFixed(2)}px`)
      cameraShakeAppliedRef.current = true
    } else if (cameraShakeAppliedRef.current) {
      root.style.setProperty('--raid-camera-x', '0px')
      root.style.setProperty('--raid-camera-y', '0px')
      cameraShakeAppliedRef.current = false
    }
    const stageRush = stageClearRef.current > 0 ? clamp(stageClearRef.current / STAGE_CLEAR_SECONDS, 0, 1) : 0
    const activeBoss = enemiesRef.current.find((enemy) => enemy.isBoss && enemy.hp > 0)
    const bossIntensity = activeBoss ? 1 : bossAlertRef.current > 0 ? clamp(bossAlertRef.current / 2.4, 0, 1) : 0
    const devilCorruption = activeBoss?.bossKind === 'devil' ? clamp(0.45 + (1 - activeBoss.hp / Math.max(1, activeBoss.maxHp)) * 0.75, 0, 1) : 0
    const finalBattleIntensity = activeBoss?.bossKind === 'final'
      ? clamp(0.78 + (1 - activeBoss.hp / Math.max(1, activeBoss.maxHp)) * 0.22, 0, 1)
      : raidModeRef.current !== 'endless' && stageRef.current >= MAX_RAID_STAGE
        ? 0.68
        : 0
    const campaignBackgroundStageTheme =
      raidModeRef.current !== 'endless'
        ? stageRef.current === 5
          ? RAID_BOSS_BACKGROUND_THEME_SQUID
          : stageRef.current === 10
            ? RAID_BOSS_BACKGROUND_THEME_SNAKE
            : stageRef.current >= MAX_RAID_STAGE
              ? RAID_BOSS_BACKGROUND_THEME_FINAL
              : stageRef.current
        : stageRef.current
    const backgroundStageTheme =
      activeBoss?.bossKind === 'squid' ? RAID_BOSS_BACKGROUND_THEME_SQUID :
        activeBoss?.bossKind === 'snake' ? RAID_BOSS_BACKGROUND_THEME_SNAKE :
          activeBoss?.bossKind === 'final' || activeBoss?.bossKind === 'devil' ? RAID_BOSS_BACKGROUND_THEME_FINAL :
            campaignBackgroundStageTheme

    pixiBackgroundRef.current?.render({
      palette: paletteRef.current,
      width: cssWidth,
      height: cssHeight,
      time,
      quality: gfxQuality,
      stageTheme: backgroundStageTheme,
      dpr,
      stageRush,
      bossIntensity,
      devilCorruption,
      finalBattleIntensity,
    })

    const drawTrail = (shot: Shot, color: string, length: number, widthPx: number) => {
      const x = toX(shot.x)
      const y = toY(shot.y)
      const scaledLength = length * visualScale
      const scaledWidth = widthPx * visualScale
      const mag = Math.sqrt((shot.vx) * (shot.vx) + (shot.vy) * (shot.vy)) || 1
      const ux = shot.vx / mag
      const uy = shot.vy / mag
      const sprite = getCachedProjectileTrailSprite(color, scaledLength, scaledWidth)
      if (sprite) {
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(Math.atan2(uy, ux))
        ctx.drawImage(sprite.canvas, -sprite.originX, -sprite.originY, sprite.width, sprite.height)
        ctx.restore()
        return
      }
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
      const sprite = getCachedProjectileOrbSprite(color, scaledRadius)
      if (sprite) {
        ctx.drawImage(sprite.canvas, x - sprite.originX, y - sprite.originY, sprite.width, sprite.height)
        return
      }
      const gradient = ctx.createRadialGradient(x, y, 1, x, y, scaledRadius)
      gradient.addColorStop(0, 'rgba(255,255,255,0.95)')
      gradient.addColorStop(0.35, color)
      gradient.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(x, y, scaledRadius, 0, Math.PI * 2)
      ctx.fill()
    }

    const drawPlayerLaserBeam = (shot: Shot) => {
      const x = toX(shot.x)
      const y = toY(shot.y)
      const mag = Math.sqrt((shot.vx) * (shot.vx) + (shot.vy) * (shot.vy)) || 1
      const ux = shot.vx / mag
      const uy = shot.vy / mag
      const length = 76 * visualScale
      const width = Math.max(5, (shot.radius * 2.8) * visualScale)
      const coreWidth = Math.max(1.3, width * 0.24)
      const headX = x + ux * length * 0.48
      const headY = y + uy * length * 0.48
      const tailX = x - ux * length * 0.62
      const tailY = y - uy * length * 0.62
      const normalX = -uy
      const normalY = ux
      const beam = ctx.createLinearGradient(headX, headY, tailX, tailY)
      beam.addColorStop(0, 'rgba(255,255,255,0.98)')
      beam.addColorStop(0.22, 'rgba(224,242,254,0.96)')
      beam.addColorStop(0.5, 'rgba(34,211,238,0.88)')
      beam.addColorStop(1, 'rgba(34,211,238,0)')
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.strokeStyle = 'rgba(14,165,233,0.24)'
      ctx.lineWidth = width * 1.28
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(headX, headY)
      ctx.lineTo(tailX, tailY)
      ctx.stroke()
      ctx.strokeStyle = 'rgba(56,189,248,0.42)'
      ctx.lineWidth = width * 0.68
      ctx.beginPath()
      ctx.moveTo(headX, headY)
      ctx.lineTo(tailX, tailY)
      ctx.stroke()
      ctx.strokeStyle = beam
      ctx.lineWidth = coreWidth * 1.65
      ctx.beginPath()
      ctx.moveTo(headX, headY)
      ctx.lineTo(tailX, tailY)
      ctx.stroke()
      ctx.strokeStyle = 'rgba(236,254,255,0.92)'
      ctx.lineWidth = coreWidth
      ctx.beginPath()
      ctx.moveTo(headX, headY)
      ctx.lineTo(tailX, tailY)
      ctx.stroke()
      ctx.strokeStyle = 'rgba(125,249,255,0.5)'
      ctx.lineWidth = Math.max(1, visualScale * 1.4)
      for (const side of SIDE_VALUES) {
        ctx.beginPath()
        ctx.moveTo(headX + normalX * side * width * 0.52, headY + normalY * side * width * 0.52)
        ctx.lineTo(tailX + normalX * side * width * 0.52, tailY + normalY * side * width * 0.52)
        ctx.stroke()
      }
      drawRadialEllipse(ctx, headX, headY, width * 0.38, width * 0.38, RAID_PLAYER_LASER_HEAD_STOPS)
      ctx.restore()
    }

    const drawSpreadBolt = (shot: Shot) => {
      const x = toX(shot.x)
      const y = toY(shot.y)
      const mag = Math.sqrt((shot.vx) * (shot.vx) + (shot.vy) * (shot.vy)) || 1
      const ux = shot.vx / mag
      const uy = shot.vy / mag
      const nx = -uy
      const ny = ux
      const length = 30 * visualScale
      const width = 5.4 * visualScale
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.lineCap = 'round'
      const tail = ctx.createLinearGradient(x + ux * length * 0.2, y + uy * length * 0.2, x - ux * length * 0.76, y - uy * length * 0.76)
      tail.addColorStop(0, 'rgba(255,255,255,0.9)')
      tail.addColorStop(0.36, 'rgba(251,191,36,0.84)')
      tail.addColorStop(1, 'rgba(251,191,36,0)')
      ctx.strokeStyle = tail
      ctx.lineWidth = width
      ctx.beginPath()
      ctx.moveTo(x + ux * length * 0.16, y + uy * length * 0.16)
      ctx.lineTo(x - ux * length * 0.78, y - uy * length * 0.78)
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.96)'
      ctx.strokeStyle = 'rgba(251,191,36,0.9)'
      ctx.lineWidth = Math.max(0.8, visualScale)
      ctx.beginPath()
      ctx.moveTo(x + ux * length * 0.44, y + uy * length * 0.44)
      ctx.lineTo(x - ux * length * 0.08 + nx * width, y - uy * length * 0.08 + ny * width)
      ctx.lineTo(x - ux * length * 0.02, y - uy * length * 0.02)
      ctx.lineTo(x - ux * length * 0.08 - nx * width, y - uy * length * 0.08 - ny * width)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.strokeStyle = 'rgba(253,230,138,0.64)'
      ctx.lineWidth = Math.max(0.9, visualScale * 1.1)
      for (const side of SIDE_VALUES) {
        ctx.beginPath()
        ctx.moveTo(x - ux * length * 0.28 + nx * side * width * 1.2, y - uy * length * 0.28 + ny * side * width * 1.2)
        ctx.lineTo(x - ux * length * 0.54 + nx * side * width * 2.0, y - uy * length * 0.54 + ny * side * width * 2.0)
        ctx.stroke()
      }
      ctx.restore()
    }

    const drawScatterShard = (shot: Shot) => {
      const x = toX(shot.x)
      const y = toY(shot.y)
      const mag = Math.sqrt((shot.vx) * (shot.vx) + (shot.vy) * (shot.vy)) || 1
      const ux = shot.vx / mag
      const uy = shot.vy / mag
      const nx = -uy
      const ny = ux
      const length = 20 * visualScale
      const width = 6 * visualScale
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.strokeStyle = 'rgba(45,212,191,0.68)'
      ctx.lineWidth = Math.max(1, visualScale * 1.2)
      for (const side of SIDE_VALUES) {
        ctx.beginPath()
        ctx.moveTo(x - ux * length * 0.15, y - uy * length * 0.15)
        ctx.lineTo(x - ux * length * 0.62 + nx * side * width * 1.25, y - uy * length * 0.62 + ny * side * width * 1.25)
        ctx.stroke()
      }
      const glow = ctx.createRadialGradient(x, y, 1, x, y, width * 2.2)
      glow.addColorStop(0, 'rgba(255,255,255,0.92)')
      glow.addColorStop(0.34, 'rgba(45,212,191,0.72)')
      glow.addColorStop(1, 'rgba(20,184,166,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(x, y, width * 2.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(204,251,241,0.95)'
      ctx.strokeStyle = 'rgba(20,184,166,0.9)'
      ctx.lineWidth = Math.max(0.8, visualScale)
      ctx.beginPath()
      ctx.moveTo(x + ux * length * 0.48, y + uy * length * 0.48)
      ctx.lineTo(x + nx * width * 0.86, y + ny * width * 0.86)
      ctx.lineTo(x - ux * length * 0.42, y - uy * length * 0.42)
      ctx.lineTo(x - nx * width * 0.86, y - ny * width * 0.86)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }

    const drawRocketWarhead = (shot: Shot) => {
      const x = toX(shot.x)
      const y = toY(shot.y)
      const angle = Math.atan2(shot.vy, shot.vx) + Math.PI / 2
      const length = 24 * visualScale
      const width = 8.5 * visualScale
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(angle)
      ctx.globalCompositeOperation = 'lighter'
      const flame = ctx.createLinearGradient(0, length * 0.12, 0, length * 0.8)
      flame.addColorStop(0, 'rgba(255,255,255,0.9)')
      flame.addColorStop(0.3, 'rgba(251,146,60,0.82)')
      flame.addColorStop(1, 'rgba(239,68,68,0)')
      ctx.fillStyle = flame
      ctx.beginPath()
      ctx.moveTo(-width * 0.28, length * 0.18)
      ctx.quadraticCurveTo(0, length * (0.7 + Math.sin(time / 90 + shot.id) * 0.08), width * 0.28, length * 0.18)
      ctx.closePath()
      ctx.fill()
      const body = ctx.createLinearGradient(-width, 0, width, 0)
      body.addColorStop(0, '#7f1d1d')
      body.addColorStop(0.32, '#fed7aa')
      body.addColorStop(0.56, '#f97316')
      body.addColorStop(1, '#111827')
      ctx.fillStyle = body
      ctx.strokeStyle = 'rgba(255,237,213,0.86)'
      ctx.lineWidth = Math.max(0.9, visualScale)
      ctx.beginPath()
      ctx.moveTo(0, -length * 0.55)
      ctx.lineTo(width * 0.62, length * 0.1)
      ctx.lineTo(width * 0.32, length * 0.42)
      ctx.lineTo(0, length * 0.24)
      ctx.lineTo(-width * 0.32, length * 0.42)
      ctx.lineTo(-width * 0.62, length * 0.1)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.strokeStyle = 'rgba(239,68,68,0.8)'
      ctx.lineWidth = Math.max(0.8, visualScale * 0.9)
      ctx.beginPath()
      ctx.moveTo(0, -length * 0.36)
      ctx.lineTo(0, length * 0.16)
      ctx.stroke()
      ctx.restore()
    }

    const drawPulseBolt = (shot: Shot) => {
      const x = toX(shot.x)
      const y = toY(shot.y)
      const radius = 6.2 * visualScale
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      const glow = ctx.createRadialGradient(x, y, 1, x, y, radius * 2.2)
      glow.addColorStop(0, 'rgba(255,255,255,0.92)')
      glow.addColorStop(0.38, 'rgba(34,197,94,0.76)')
      glow.addColorStop(1, 'rgba(34,197,94,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(x, y, radius * 2.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(187,247,208,0.74)'
      ctx.lineWidth = Math.max(1, visualScale)
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
    const drawCoreBlast = (shot: Shot) => {
      const x = toX(shot.x)
      const y = toY(shot.y)
      const burning = shot.burning === true
      const radius = Math.max(7.2, shot.radius * visualScale * (burning ? 3.8 : 3.35))
      const frameBucket = Math.abs(Math.trunc((time / 120 + shot.id) % 4))
      const sprite = getCoreBlastSprite(radius, burning, frameBucket / 4)
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(Math.atan2(shot.vy, shot.vx) + Math.PI / 2)
      ctx.globalCompositeOperation = 'lighter'
      ctx.drawImage(sprite, -sprite.width / 2, -radius * 2.2, sprite.width, sprite.height)
      ctx.restore()
    }
    const drawSpiegelKunai = (shot: Shot) => {
      const x = toX(shot.x)
      const y = toY(shot.y)
      const radius = Math.max(5.4, shot.radius * visualScale * 2.55)
      const angle = Math.atan2(shot.vy, shot.vx) + Math.PI / 2
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(angle)
      ctx.globalCompositeOperation = 'lighter'
      const trail = ctx.createLinearGradient(0, radius * 1.9, 0, -radius * 0.2)
      trail.addColorStop(0, 'rgba(15,23,42,0)')
      trail.addColorStop(0.38, 'rgba(148,163,184,0.2)')
      trail.addColorStop(1, 'rgba(248,250,252,0.62)')
      ctx.strokeStyle = trail
      ctx.lineWidth = Math.max(1.1, radius * 0.22)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(0, radius * 1.55)
      ctx.lineTo(0, -radius * 0.2)
      ctx.stroke()

      ctx.shadowBlur = Math.max(6, radius * 0.8)
      ctx.shadowColor = 'rgba(248,113,113,0.24)'
      ctx.fillStyle = 'rgba(226,232,240,0.92)'
      ctx.strokeStyle = 'rgba(239,68,68,0.78)'
      ctx.lineWidth = Math.max(1, radius * 0.12)
      ctx.beginPath()
      ctx.moveTo(0, -radius * 1.55)
      ctx.lineTo(radius * 0.38, -radius * 0.18)
      ctx.lineTo(0, radius * 0.22)
      ctx.lineTo(-radius * 0.38, -radius * 0.18)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      ctx.shadowBlur = 0
      ctx.fillStyle = 'rgba(15,23,42,0.86)'
      ctx.fillRect(-radius * 0.13, radius * 0.08, radius * 0.26, radius * 0.74)
      ctx.strokeStyle = 'rgba(250,204,21,0.58)'
      ctx.beginPath()
      ctx.arc(0, radius * 1.02, radius * 0.24, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
    const drawPoisonCloud = (shot: Shot) => {
      const x = toX(shot.x)
      const y = toY(shot.y)
      const life = shot.life ?? 1
      const maxLife = shot.maxLife ?? 1
      const age = 1 - clamp(life / Math.max(0.01, maxLife), 0, 1)
      const alpha = Math.sin(clamp(life / Math.max(0.01, maxLife), 0, 1) * Math.PI)
      const radius = Math.max(18, shot.radius * 7.8 * visualScale) * (0.86 + age * 0.34)
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = 0.42 * alpha
      const core = ctx.createRadialGradient(x, y, radius * 0.08, x, y, radius)
      core.addColorStop(0, 'rgba(236,252,203,0.86)')
      core.addColorStop(0.26, 'rgba(132,204,22,0.56)')
      core.addColorStop(0.62, 'rgba(22,101,52,0.32)')
      core.addColorStop(1, 'rgba(22,101,52,0)')
      ctx.fillStyle = core
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 0.38 * alpha
      for (let puff = 0; puff < 7; puff += 1) {
        const angle = puff * 2.399 + shot.id * 0.17 + age * 1.8
        const dist = radius * (0.18 + (puff % 3) * 0.13)
        const px = x + Math.cos(angle) * dist
        const py = y + Math.sin(angle) * dist * 0.72
        const puffRadius = radius * (0.22 + (puff % 2) * 0.08)
        const g = ctx.createRadialGradient(px, py, 1, px, py, puffRadius)
        g.addColorStop(0, 'rgba(217,249,157,0.54)')
        g.addColorStop(0.48, 'rgba(74,222,128,0.28)')
        g.addColorStop(1, 'rgba(22,101,52,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(px, py, puffRadius, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 0.42 * alpha
      ctx.strokeStyle = 'rgba(190,242,100,0.42)'
      ctx.lineWidth = Math.max(1, visualScale * 1.5)
      ctx.beginPath()
      ctx.arc(x, y, radius * 0.62, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
    const drawEnemyBeamColumn = (shot: Shot) => {
      const x = toX(shot.x)
      const y = toY(shot.y)
      const life = shot.life ?? FINAL_BOSS_BEAM_LIFE_SECONDS
      const maxLife = shot.maxLife ?? FINAL_BOSS_BEAM_LIFE_SECONDS
      const lifeRatio = clamp(life / Math.max(0.01, maxLife), 0, 1)
      const alpha = Math.min(1, Math.sin(lifeRatio * Math.PI) * 1.25)
      const width = Math.max(42, (shot.radius / WIDTH) * cssWidth * 2.2)
      const coreWidth = Math.max(8, width * 0.22)
      const length = Math.sqrt((cssWidth) * (cssWidth) + (cssHeight) * (cssHeight)) * 1.45

      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      if (shot.angle === undefined) {
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
      } else {
        ctx.translate(x, y)
        ctx.rotate(shot.angle)
        ctx.globalAlpha = 0.24 * alpha
        ctx.fillStyle = 'rgba(14,165,233,1)'
        ctx.fillRect(-length / 2, -width * 0.72, length, width * 1.44)
        ctx.globalAlpha = 0.48 * alpha
        ctx.fillStyle = 'rgba(56,189,248,1)'
        ctx.fillRect(-length / 2, -width * 0.5, length, width)
        ctx.globalAlpha = 0.86 * alpha
        ctx.fillStyle = 'rgba(224,242,254,1)'
        ctx.fillRect(-length / 2, -coreWidth * 0.5, length, coreWidth)
        ctx.globalAlpha = 0.55 * alpha
        ctx.strokeStyle = 'rgba(125,249,255,1)'
        ctx.lineWidth = Math.max(2, visualScale * 2.4)
        ctx.beginPath()
        ctx.moveTo(-length / 2, -width * 0.47)
        ctx.lineTo(length / 2, -width * 0.47)
        ctx.moveTo(-length / 2, width * 0.47)
        ctx.lineTo(length / 2, width * 0.47)
        ctx.stroke()
      }
      ctx.restore()
    }
    const drawSquidBubble = (shot: Shot) => {
      const x = toX(shot.x)
      const y = toY(shot.y)
      const splitLevel = shot.splitLevel ?? 0
      const minRadius = Math.max(8, 26 - splitLevel * 5)
      const radius = Math.max(minRadius, shot.radius * visualScale * 7)
      const pulse = 0.85 + Math.sin(time / 160 + shot.id) * 0.12
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      drawRadialEllipse(ctx, x, y, radius * pulse, radius * pulse, RAID_SQUID_BUBBLE_STOPS)
      ctx.strokeStyle = 'rgba(250,232,255,0.76)'
      ctx.lineWidth = Math.max(1.5, visualScale * 1.4)
      ctx.beginPath()
      ctx.arc(x, y, radius * 0.82, 0, Math.PI * 2)
      ctx.stroke()
      ctx.strokeStyle = 'rgba(244,114,182,0.52)'
      ctx.beginPath()
      ctx.arc(x, y, radius * 0.48, time / 420, time / 420 + Math.PI * 1.35)
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.beginPath()
      ctx.arc(x - radius * 0.25, y - radius * 0.28, radius * 0.16, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    const drawSquidInkShot = (shot: Shot) => {
      const x = toX(shot.x)
      const y = toY(shot.y)
      const radius = Math.max(9, shot.radius * visualScale * 5.2)
      const pulse = 0.82 + Math.sin(time / 115 + shot.id) * 0.12
      const angle = Math.atan2(shot.vy, shot.vx)
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(angle)
      ctx.globalCompositeOperation = 'lighter'
      drawRadialEllipse(ctx, 0, 0, radius * 1.08 * pulse, radius * 0.82, RAID_SQUID_INK_STOPS)
      ctx.strokeStyle = 'rgba(250,232,255,0.68)'
      ctx.lineWidth = Math.max(1.2, visualScale * 1.2)
      ctx.beginPath()
      ctx.ellipse(0, 0, radius * 0.78, radius * 0.55, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.strokeStyle = 'rgba(244,114,182,0.44)'
      ctx.beginPath()
      ctx.moveTo(-radius * 1.9, -radius * 0.22)
      ctx.bezierCurveTo(-radius * 1.1, -radius * 0.75, -radius * 0.42, radius * 0.18, -radius * 0.05, 0)
      ctx.moveTo(-radius * 1.65, radius * 0.22)
      ctx.bezierCurveTo(-radius * 0.9, radius * 0.55, -radius * 0.36, -radius * 0.18, 0, 0)
      ctx.stroke()
      ctx.restore()
    }
    const drawSquidSpineShot = (shot: Shot) => {
      const x = toX(shot.x)
      const y = toY(shot.y)
      const length = Math.max(22, visualScale * 24)
      const width = Math.max(7, visualScale * 7)
      const angle = Math.atan2(shot.vy, shot.vx) + Math.PI / 2
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(angle)
      ctx.globalCompositeOperation = 'lighter'
      const spine = ctx.createLinearGradient(0, -length * 0.56, 0, length * 0.56)
      spine.addColorStop(0, 'rgba(255,255,255,0.96)')
      spine.addColorStop(0.22, 'rgba(251,113,133,0.9)')
      spine.addColorStop(0.72, 'rgba(88,28,135,0.82)')
      spine.addColorStop(1, 'rgba(24,3,36,0.2)')
      ctx.fillStyle = spine
      ctx.strokeStyle = 'rgba(250,232,255,0.72)'
      ctx.lineWidth = Math.max(1, visualScale * 1.2)
      ctx.beginPath()
      ctx.moveTo(0, -length * 0.62)
      ctx.quadraticCurveTo(width * 0.85, -length * 0.18, width * 0.35, length * 0.42)
      ctx.quadraticCurveTo(0, length * 0.62, -width * 0.35, length * 0.42)
      ctx.quadraticCurveTo(-width * 0.85, -length * 0.18, 0, -length * 0.62)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.strokeStyle = 'rgba(244,114,182,0.55)'
      ctx.beginPath()
      ctx.moveTo(0, -length * 0.3)
      ctx.lineTo(0, length * 0.38)
      ctx.stroke()
      ctx.restore()
    }
    const drawSnakeFangShot = (shot: Shot) => {
      const x = toX(shot.x)
      const y = toY(shot.y)
      const length = Math.max(24, visualScale * 26)
      const width = Math.max(8, visualScale * 8)
      const angle = Math.atan2(shot.vy, shot.vx) + Math.PI / 2
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(angle)
      ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = '#fef3c7'
      ctx.strokeStyle = 'rgba(190,242,100,0.82)'
      ctx.lineWidth = Math.max(1, visualScale * 1.3)
      ctx.beginPath()
      ctx.moveTo(0, -length * 0.64)
      ctx.quadraticCurveTo(width * 0.9, -length * 0.2, width * 0.16, length * 0.54)
      ctx.quadraticCurveTo(0, length * 0.35, -width * 0.16, length * 0.54)
      ctx.quadraticCurveTo(-width * 0.9, -length * 0.2, 0, -length * 0.64)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      drawRadialEllipse(ctx, 0, length * 0.18, width * 0.65, width * 0.42, RAID_SNAKE_FANG_GLOW_STOPS)
      ctx.restore()
    }
    let devilMasterProjectileSprite: CanvasSpriteEntry | null = null
    const drawDevilSnakeHeadShot = (shot: Shot) => {
      const x = toX(shot.x)
      const y = toY(shot.y)
      const size = getGodGundamGameplayRenderSize(cssWidth)
      const sprite = devilMasterProjectileSprite ?? (devilMasterProjectileSprite = getDevilMasterProjectileCanvasSprite())
      const angle = shot.angle ?? Math.atan2(shot.vy, shot.vx) + Math.PI / 2
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(angle)
      ctx.globalCompositeOperation = 'lighter'
      drawRadialEllipse(ctx, 0, size * 0.04, size * 0.38, size * 0.54, RAID_DEVIL_MASTER_PROJECTILE_GLOW_STOPS)
      drawCanvasSpriteContain(ctx, sprite, 0, 0, size, RAID_DEVIL_MASTER_PROJECTILE_FILTER, 1, 0, 1, '#ef4444')
      ctx.restore()
    }
    const drawVenomSpitShot = (shot: Shot) => {
      const x = toX(shot.x)
      const y = toY(shot.y)
      const radius = Math.max(8, shot.radius * visualScale * 4.6)
      const pulse = 0.86 + Math.sin(time / 130 + shot.id * 1.7) * 0.13
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      drawRadialEllipse(ctx, x, y, radius * pulse, radius * 0.78, RAID_VENOM_SPIT_STOPS)
      ctx.strokeStyle = 'rgba(253,230,138,0.68)'
      ctx.lineWidth = Math.max(1.1, visualScale * 1.1)
      ctx.beginPath()
      ctx.arc(x, y, radius * 0.7, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.72)'
      ctx.beginPath()
      ctx.arc(x - radius * 0.22, y - radius * 0.24, radius * 0.16, 0, Math.PI * 2)
      ctx.fill()
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

    if (gfxProfile.drawRipples) {
      const ripples = ripplesRef.current
      const rippleStart = Math.max(0, ripples.length - gfxProfile.maxRipples)
      let lastRippleColor = ''
      ctx.lineWidth = 1.25
      for (let i = rippleStart; i < ripples.length; i += 1) {
        const ripple = ripples[i]
        const progress = 1 - ripple.life / ripple.maxLife
        const radius = (ripple.size * 2.7) * (0.35 + progress * 1.05)
        ctx.globalAlpha = Math.max(0, ripple.life / ripple.maxLife) * 0.42
        if (ripple.color !== lastRippleColor) { ctx.strokeStyle = ripple.color; lastRippleColor = ripple.color }
        ctx.beginPath()
        ctx.arc(toX(ripple.x), toY(ripple.y), radius, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1

    const drawPlayerShot = (shot: Shot) => {
      if (!gfxProfile.drawAdvancedShotFx) {
        if (isCoreLanderAoeShot(shot)) {
          if (shot.kind === 'spiegelKunai') {
            drawTrail(shot, 'rgba(226,232,240,0.48)', 28, 1.8)
            drawOrb(shot, 'rgba(248,113,113,0.54)', 4.4)
          } else {
            drawTrail(shot, shot.burning ? 'rgba(251,191,36,0.56)' : 'rgba(249,115,22,0.52)', 34, 2.8)
            drawOrb(shot, shot.burning ? 'rgba(254,240,138,0.62)' : 'rgba(251,146,60,0.58)', 5.6)
          }
        } else if (shot.kind === 'laser' || shot.kind === 'rocket' || shot.kind === 'needle' || shot.kind === 'homing') drawTrail(shot, shot.kind === 'rocket' ? 'rgba(251,146,60,0.88)' : 'rgba(125,249,255,0.86)', 36, 3)
        else drawOrb(shot, 'rgba(34,197,94,0.86)', 6)
      }
      else if (shot.kind === 'laser') drawPlayerLaserBeam(shot)
      else if (shot.kind === 'spread') drawSpreadBolt(shot)
      else if (shot.kind === 'scatter') drawScatterShard(shot)
      else if (shot.kind === 'rocket') drawRocketWarhead(shot)
      else if (shot.kind === 'coreBlast') drawCoreBlast(shot)
      else if (shot.kind === 'spiegelKunai') drawSpiegelKunai(shot)
      else if (shot.kind === 'homing') drawMissile(shot)
      else if (shot.kind === 'needle') drawTrail(shot, 'rgba(125,249,255,0.9)', 42, 3.2)
      else drawPulseBolt(shot)
    }
    const sparks = sparksRef.current
    const sparkStart = Math.max(0, sparks.length - gfxProfile.maxSparks)
    let lastSparkColor = ''
    for (let i = sparkStart; i < sparks.length; i += 1) {
      const spark = sparks[i]
      ctx.globalAlpha = Math.max(0, spark.life / spark.maxLife)
      if (spark.color !== lastSparkColor) { ctx.fillStyle = spark.color; lastSparkColor = spark.color }
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

    if (godMeleeStrikesRef.current.length > 0) {
      drawGodGundamPassiveStrikes(ctx, godMeleeStrikesRef.current, toX, toY, cssWidth)
    }
    if (godBarrageRef.current) {
      drawGodGundamBarrage(ctx, godBarrageRef.current, enemiesRef.current, toX, toY, cssWidth, time)
    }

    for (const shot of shotsRef.current) drawPlayerShot(shot)
    // Guest client-side prediction: draw locally fired shots immediately without waiting for network
    for (const shot of guestLocalShotsRef.current) drawPlayerShot(shot)

    for (const shot of enemyShotsRef.current) {
      if (!gfxProfile.drawAdvancedShotFx) {
        if (shot.kind === 'beam') drawTrail(shot, 'rgba(56,189,248,0.88)', 82, 9)
        else drawOrb(shot, shot.kind === 'poisonCloud' || shot.kind === 'venomSpit' || shot.kind === 'snakeFang' || shot.kind === 'devilSnakeHead' ? 'rgba(132,204,22,0.68)' : shot.kind === 'squidInk' || shot.kind === 'squidSpine' ? 'rgba(244,114,182,0.78)' : 'rgba(251,113,133,0.78)', shot.kind === 'squidBubble' ? 12 : 8)
      }
      else if (shot.kind === 'squidBubble') drawSquidBubble(shot)
      else if (shot.kind === 'squidInk') drawSquidInkShot(shot)
      else if (shot.kind === 'squidSpine') drawSquidSpineShot(shot)
      else if (shot.kind === 'snakeFang') drawSnakeFangShot(shot)
      else if (shot.kind === 'devilSnakeHead') drawDevilSnakeHeadShot(shot)
      else if (shot.kind === 'venomSpit') drawVenomSpitShot(shot)
      else if (shot.kind === 'poisonCloud') drawPoisonCloud(shot)
      else if (shot.kind === 'orbShot') drawOrb(shot, 'rgba(168,85,247,0.92)', 12)
      else if (shot.kind === 'blade') drawTrail(shot, 'rgba(34,211,238,0.9)', 46, 7)
      else if (shot.kind === 'needle') drawTrail(shot, 'rgba(190,242,100,0.92)', 42, 5)
      else if (shot.kind === 'voidShot') drawOrb(shot, 'rgba(192,132,252,0.95)', 15)
      else if (shot.kind === 'beam' && shot.life !== undefined) drawEnemyBeamColumn(shot)
      else if (shot.kind === 'beam') drawTrail(shot, 'rgba(56,189,248,0.96)', 112, 14)
      else if (shot.kind === 'scatterBoss') drawTrail(shot, 'rgba(251,146,60,0.9)', 34, 5)
      else if (shot.kind === 'superShot') drawOrb(shot, 'rgba(251,191,36,0.95)', 14)
      else drawOrb(shot, 'rgba(251,113,133,0.9)', 10)
    }

    // On the guest's screen playerRef = interpolated host, remotePlayerRef = own (guest) ship.
    // Always draw the player's OWN ship in PLAYER_COLOR (red) and the ally in ALLY_PLAYER_COLOR (cyan).
    const isGuestView = Boolean(multiplayerSessionRef.current && !multiplayerSessionRef.current.isHost)
    const ownShipRef = isGuestView ? remotePlayerRef.current : playerRef.current
    const allyShipRef = isGuestView ? playerRef.current : remotePlayerRef.current
    const devilAssistShipRef = devilAssistPlayerRef.current
    const stageClearActive = stageClearRef.current > 0
    const hideOwnShipForBarrage = Boolean(ownShipRef && !stageClearActive && isGodGundamBarragePilot(ownShipRef, progressRef.current) && (godBarrageRef.current || (ownShipRef.godMeleeCloak ?? 0) > 0))
    const hideAllyShipForBarrage = Boolean(allyShipRef && !stageClearActive && isGodGundamBarragePilot(allyShipRef, progressRef.current) && (godBarrageRef.current || (allyShipRef.godMeleeCloak ?? 0) > 0))
    const hideDevilAssistForBarrage = Boolean(devilAssistShipRef && !stageClearActive && isGodGundamBarragePilot(devilAssistShipRef, progressRef.current) && (devilAssistShipRef.godMeleeCloak ?? 0) > 0)
    if (gfxProfile.drawOptionShips && ownShipRef && !hideOwnShipForBarrage) drawRaidOptions(ctx, ownShipRef, toX, toY, cssWidth, time, PLAYER_COLOR, getRaidPlayerVisualShipKey(ownShipRef, progressRef.current))
    if (gfxProfile.drawOptionShips && allyShipRef && !hideAllyShipForBarrage) drawRaidOptions(ctx, allyShipRef, toX, toY, cssWidth, time, ALLY_PLAYER_COLOR, getRaidPlayerVisualShipKey(allyShipRef, progressRef.current))
    if (gfxProfile.drawOptionShips && devilAssistShipRef && !hideDevilAssistForBarrage) drawRaidOptions(ctx, devilAssistShipRef, toX, toY, cssWidth, time, '#facc15', getRaidPlayerVisualShipKey(devilAssistShipRef, progressRef.current))
    const sameScreenIdentityAura = sameScreenCoopRef.current
    if (ownShipRef && !hideOwnShipForBarrage) drawRaidPlayer(ctx, ownShipRef, phaseRef.current, toX, toY, cssWidth, time, PLAYER_COLOR, getCachedEquippedCosmetics(ownShipRef.ship.key), getRaidPlayerVisualShipKey(ownShipRef, progressRef.current), sameScreenIdentityAura ? PLAYER_COLOR : null)
    if (allyShipRef && !hideAllyShipForBarrage) drawRaidPlayer(ctx, allyShipRef, phaseRef.current, toX, toY, cssWidth, time, ALLY_PLAYER_COLOR, getCachedEquippedCosmetics(allyShipRef.ship.key), getRaidPlayerVisualShipKey(allyShipRef, progressRef.current), sameScreenIdentityAura ? ALLY_PLAYER_COLOR : null)
    if (devilAssistShipRef && !hideDevilAssistForBarrage) drawRaidPlayer(ctx, devilAssistShipRef, phaseRef.current, toX, toY, cssWidth, time, '#facc15', getCachedEquippedCosmetics(devilAssistShipRef.ship.key), getRaidPlayerVisualShipKey(devilAssistShipRef, progressRef.current), null)

    if (isWateryWorldTheme(backgroundStageTheme)) {
      drawWateryWorldForegroundClouds(ctx, cssWidth, cssHeight, time, gfxQuality)
    } else if (isVolcanicWorldTheme(backgroundStageTheme)) {
      drawVolcanicWorldForegroundClouds(ctx, cssWidth, cssHeight, time, gfxQuality)
    }

    for (const powerUp of powerUpsRef.current) {
      drawPowerUpCanvas(ctx, powerUp, toX, toY, cssWidth, time)
    }

    drawFinalChargeLines(ctx, enemiesRef.current, toX, cssWidth, cssHeight, time)
    drawDevilChargeWarnings(ctx, enemiesRef.current, toX, toY, cssWidth, cssHeight, time)

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
    const profile = getRaidGraphicsProfile(graphicsQualityRef.current, false, isCoOpActive())
    const budget = Math.max(0, profile.maxSparks - sparksRef.current.length)
    const spawnCount = Math.min(Math.ceil(count * profile.sparkScale), budget)
    for (let i = 0; i < spawnCount; i += 1) {
      const angle = Math.random() * Math.PI * 2
      const speed = 10 + Math.random() * 32
      sparksRef.current.push(acquireSpark(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        0.3 + Math.random() * 0.6,
        color,
        size * (0.55 + Math.random() * 0.8),
      ))
    }
    if (sparksRef.current.length > profile.maxSparks) {
      const trimCount = sparksRef.current.length - profile.maxSparks
      for (let index = 0; index < trimCount; index += 1) recycleSpark(sparksRef.current[index])
      sparksRef.current.splice(0, trimCount)
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

  const triggerScreenShake = useCallback((strength: number, durationMs: number) => {
    const now = performance.now()
    const current = cameraShakeRef.current
    cameraShakeRef.current = {
      until: now + durationMs,
      duration: durationMs,
      strength: Math.max(strength, current.until > now ? current.strength * 0.72 : 0),
      seed: Math.random() * Math.PI * 2,
    }
  }, [])

  const playBossCriticalStinger = (enemy: Enemy, force = false) => {
    if (!enemy.isBoss || enemy.bossHpStingerPlayed) return
    if (!force && enemy.hp / Math.max(1, enemy.maxHp) > 0.25) return
    enemy.bossHpStingerPlayed = true
    playGameSound('stinger_2')
  }

  const detonateNuke = useCallback((targetX = 50, targetY = 46) => {
    if (phaseRef.current !== 'playing') return
    const player = playerRef.current
    const scoreMult = scoreMultRef.current
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
        if (enemy.bossKind !== 'final' && enemy.bossKind !== 'devil') enemy.chargeTimer = 0
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
      enemiesDestroyedRef.current += 1
      const scoreValue = 95 + waveRef.current * 14
      player.score += Math.round(scoreValue * scoreMult)
      if (remotePlayerRef.current) {
        remotePlayerRef.current.score += Math.round(scoreValue * scoreMult)
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
      player.score += Math.round((asteroid.tier === 2 ? 140 : asteroid.tier === 1 ? 65 : 24) * scoreMult)
      if (remotePlayerRef.current) {
        remotePlayerRef.current.score += Math.round((asteroid.tier === 2 ? 140 : asteroid.tier === 1 ? 65 : 24) * scoreMult)
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
    triggerScreenShake(3.4, 430)
    playGameSound('nuke_explosion')
    if (destroyed >= 5) window.setTimeout(() => playGameSound('combo'), 120)
    if (vaporizedAsteroids >= 2 || vaporizedMeteors >= 4) window.setTimeout(() => playGameSound('score'), 180)
    syncSnapshot()
  }, [addRipple, spawnSparks, syncSnapshot, triggerScreenShake])

  const activateNuke = useCallback((sourcePlayer = playerRef.current) => {
    const session = multiplayerSessionRef.current
    if (session && !session.isHost) {
      const localPlayer = remotePlayerRef.current
      if (phaseRef.current !== 'playing' || stageClearRef.current > 0 || !localPlayer || localPlayer.hp <= 0 || (localPlayer.specialCooldown ?? 0) > 0) return
      multiplayerLocalNukeRef.current += 1
      return
    }

    if (phaseRef.current !== 'playing' || stageClearRef.current > 0 || (sourcePlayer.specialCooldown ?? 0) > 0 || nukeStrikeRef.current) return
    if (sourcePlayer.hp <= 0) return

    const visibleEnemies = enemiesRef.current.filter((enemy) => (
      enemy.hp > 0 && enemy.y > -18 && enemy.y < HEIGHT + 16
    ))
    const visibleAsteroids = asteroidsRef.current.filter((asteroid) => (
      asteroid.hp > 0 && asteroid.y > -18 && asteroid.y < HEIGHT + 16
    ))
    const visibleBubbles = enemyShotsRef.current.filter((shot) => (
      shot.kind === 'squidBubble' && (shot.hp ?? 1) > 0 && shot.y > -18 && shot.y < HEIGHT + 16
    ))
    const hasTargets = visibleBubbles.length > 0 || visibleEnemies.length > 0 || visibleAsteroids.length > 0
    if (!hasTargets) return

    const player = sourcePlayer
    const priorityTarget = visibleEnemies.find((enemy) => enemy.isBoss) ?? visibleEnemies.find((enemy) => enemy.isMiniBoss)
    let barrageTarget: (Vec & { id: number; radius: number; isBoss?: boolean }) | null = priorityTarget ?? null
    if (!barrageTarget && visibleEnemies.length > 0) {
      barrageTarget = visibleEnemies[0]
      let nearestDistance = distSq(player, barrageTarget)
      for (let index = 1; index < visibleEnemies.length; index += 1) {
        const enemy = visibleEnemies[index]
        const distance = distSq(player, enemy)
        if (distance < nearestDistance) {
          barrageTarget = enemy
          nearestDistance = distance
        }
      }
    }
    if (!barrageTarget) {
      let nearestDistance = Infinity
      for (const target of visibleAsteroids) {
        const distance = distSq(player, target)
        if (distance < nearestDistance) {
          barrageTarget = target
          nearestDistance = distance
        }
      }
      for (const target of visibleBubbles) {
        const distance = distSq(player, target)
        if (distance < nearestDistance) {
          barrageTarget = target
          nearestDistance = distance
        }
      }
    }
    if (isGodGundamBarragePilot(player, progressRef.current)) {
      if (!barrageTarget) return
      if (godBarrageRef.current) return
      const barrageModel = getPlayerCoreLanderCombatModel(player, progressRef.current) ?? 'godGundam'
      player.specialCooldown = getNukeCooldownSeconds(stageRef.current)
      player.invuln = Math.max(player.invuln, GOD_GUNDAM_BARRAGE_DURATION_SECONDS + 0.75)
      godBarrageRef.current = {
        model: barrageModel,
        targetId: barrageTarget.id,
        startX: player.x,
        startY: player.y,
        targetX: barrageTarget.x,
        targetY: barrageTarget.y,
        age: 0,
        duration: GOD_GUNDAM_BARRAGE_DURATION_SECONDS,
        hitTimer: 0,
        hitIndex: 0,
        seed: Math.random() * 1000,
        damageMultiplier: getGodGundamBarrageDamageMultiplier(player, barrageModel),
        burning: isCoreLanderBurning(player),
      }
      player.y = HEIGHT + 18
      const barrageColor = barrageModel === 'spiegel' ? '#f87171' : '#facc15'
      const launchColor = barrageModel === 'spiegel' ? '#e2e8f0' : '#fef3c7'
      addRipple(barrageTarget.x, barrageTarget.y, barrageColor, barrageTarget.isBoss ? 18 : 13)
      addRipple(player.x, player.y, launchColor, 13)
      spawnSparks(barrageTarget.x, barrageTarget.y, barrageColor, barrageTarget.isBoss ? 42 : 26, 7)
      playCoreLanderPhysicalAttackSound(godMeleeStrikeId + barrageTarget.id)
      playGameSound('combo')
      syncSnapshot()
      return
    }
    player.specialCooldown = getNukeCooldownSeconds(stageRef.current)
    player.invuln = Math.max(player.invuln, 1.15)

    let targetX = 50
    let targetY = 46
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
    nukesUsedRef.current += 1
    syncSnapshot()
  }, [addRipple, spawnSparks, syncSnapshot])

  const resetGame = useCallback(async (startStage = 1, fullyBuffed = false, mode: RaidMode = raidModeRef.current) => {
    const session = multiplayerSessionRef.current
    const sameScreen = sameScreenCoopRef.current
    if (session && !session.isHost) return
    await preloadRaidAssetsForMenu(true)
    progressRef.current = loadProgress()
    shipCosmeticsCacheRef.current.clear()

    const isEndless = mode === 'endless'
    const isBossRush = mode === 'bossRush'
    const stage = isEndless ? Math.max(1, Math.floor(startStage)) : isBossRush ? getBossRushStage(startStage) : clamp(startStage, 1, MAX_RAID_STAGE)
    const hostRoomPlayer = session?.players.find((roomPlayer) => roomPlayer.host)
    const guestRoomPlayer = session?.players.find((roomPlayer) => !roomPlayer.host)
    const hostShip = getShipByKey(hostRoomPlayer?.shipKey, selectedShipRef.current)
    const guestShip = getShipByKey(sameScreen ? sameScreenGuestShipKeyRef.current : guestRoomPlayer?.shipKey, SHIP_OPTIONS[1])
    const hostVisualShipKey = sanitizePlayerVisualShipKey(
      hostShip.key,
      hostRoomPlayer?.visualShipKey ?? getDefaultPlayerVisualShipKey(hostShip.key, progressRef.current),
    )
    const guestVisualShipKey = sanitizePlayerVisualShipKey(
      guestShip.key,
      sameScreen
        ? getDefaultPlayerVisualShipKey(guestShip.key, progressRef.current)
        : guestRoomPlayer?.visualShipKey ?? getDefaultPlayerVisualShipKey(guestShip.key, progressRef.current),
    )
    const localVisualShipKey = getDefaultPlayerVisualShipKey(selectedShipRef.current.key, progressRef.current)

    if (session?.isHost) {
      selectedShipRef.current = hostShip
      setSelectedShipKey(hostShip.key)
    }

    playerRef.current = getInitialPlayer(session?.isHost ? hostShip : selectedShipRef.current, session?.isHost ? hostVisualShipKey : localVisualShipKey)
    devilAssistPlayerRef.current = null
    devilAssistMoveTargetRef.current = null
    devilAssistEntryRef.current = 0
    applyStartingStageLevel(playerRef.current, stage)
    if (session?.isHost || sameScreen) {
      remotePlayerRef.current = getInitialPlayer(guestShip, guestVisualShipKey)
      applyStartingStageLevel(remotePlayerRef.current, stage)
      remotePlayerRef.current.x = 58
      remotePlayerRef.current.y = 84
    }
    const coreLanderDevilBonus = isCoreLanderRaidPlayer(playerRef.current) || isCoreLanderRaidPlayer(remotePlayerRef.current)
    normalRaidDevilBonusEligibleRef.current = mode === 'campaign' && (coreLanderDevilBonus || Math.random() < NORMAL_RAID_DEVIL_BONUS_CHANCE)
    normalRaidDevilBonusTriggeredRef.current = false
    const forceLocalDevilTest = shouldForceLocalDevilBossTest(stage, mode, playerName)
    if (fullyBuffed || forceLocalDevilTest || isBossRush) {
      fullyBuffRaidPlayer(playerRef.current)
      if (remotePlayerRef.current) fullyBuffRaidPlayer(remotePlayerRef.current)
    }
    const diffCfg = DIFFICULTY_CONFIGS[raidDifficultyRef.current]
    scoreMultRef.current = diffCfg.scoreMult
    enemyHpMultRef.current = diffCfg.enemyHpMult
    enemyDamageMultRef.current = diffCfg.damageMult
    if (diffCfg.oneHp) {
      playerRef.current.hp = 1
      playerRef.current.maxHp = 1
      if (remotePlayerRef.current) { remotePlayerRef.current.hp = 1; remotePlayerRef.current.maxHp = 1 }
    } else if (diffCfg.playerHpBonus > 0) {
      playerRef.current.hp = playerRef.current.maxHp + diffCfg.playerHpBonus
      playerRef.current.maxHp = playerRef.current.maxHp + diffCfg.playerHpBonus
      if (remotePlayerRef.current) {
        remotePlayerRef.current.hp = remotePlayerRef.current.maxHp + diffCfg.playerHpBonus
        remotePlayerRef.current.maxHp = remotePlayerRef.current.maxHp + diffCfg.playerHpBonus
      }
    }
    shotsRef.current = []
    enemyShotsRef.current = []
    enemiesRef.current = []
    asteroidsRef.current = []
    meteorsRef.current = []
    ionStrikesRef.current = []
    wrecksRef.current = []
    powerUpsRef.current = []
    recycleSparkList(sparksRef.current)
    recycleRippleList(ripplesRef.current)
    phaseRef.current = 'playing'
    raidModeRef.current = mode
    stageRef.current = stage
    waveRef.current = stage
    spawnTimerRef.current = 1.25
    formationTimerRef.current = 3.4
    bossTimerRef.current = forceLocalDevilTest ? 3.2 : isBossRush ? 2.4 : isEndless ? 28 + Math.random() * 18 : stage === MAX_RAID_STAGE ? 24 : 36
    spawnLockRef.current = 0
    powerDropCooldownRef.current = 0
    killsSincePowerRef.current = 0
    bossAlertRef.current = 0
    bossMessageRef.current = null
    bossEntranceSlamRef.current = 0
    stageClearRef.current = 0
    stageEntryRef.current = 0
    pendingNextStageRef.current = null
    asteroidClusterTimerRef.current = isBossRush ? 999 : stage >= 2 ? 30 + Math.random() * 24 : getAsteroidClusterInterval()
    asteroidSpawnDelayRef.current = 0
    asteroidWarningRef.current = 0
    randomEventRef.current = null
    localDerelictWreckTestTriggeredRef.current = false
    randomEventTimerRef.current = isBossRush ? 999 : shouldForceLocalDerelictWreckTest(stage, mode) ? 0.2 : 20 + Math.random() * 18
    randomEventSpawnTimerRef.current = 0
    lastRandomEventKindRef.current = null
    playerRef.current.specialCooldown = 0
    if (remotePlayerRef.current) remotePlayerRef.current.specialCooldown = 0
    nukeFlashRef.current = 0
    nukeStrikeRef.current = null
    nukeBlastOriginRef.current = { x: 50, y: 46 }
    godBarrageRef.current = null
    godMeleeStrikesRef.current = []
    bossDefeatExplosionEventsRef.current = []
    leaderboardSubmittedRef.current = false
    runStartTimeRef.current = performance.now()
    runReportedRef.current = false
    enemiesDestroyedRef.current = 0
    bossesDefeatedRef.current = 0
    devilBossEncounteredRef.current = false
    devilBossDefeatedRef.current = false
    devilBossNextEligibleStageRef.current = stage
    pickupsCollectedRef.current = 0
    nukesUsedRef.current = 0
    remotePointerTargetRef.current = null
    remotePointerVisualRef.current = null
    remoteKeysRef.current = new Set()
    resetGuestPredictionState()
    victoryPendingRef.current = false
    victoryBlackoutRef.current = 0
    // Do NOT reset multiplayerStateSeqRef here � the guest rejects packets with seq <= its last seen.
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
  }, [playerName, preloadRaidAssetsForMenu, resetGuestPredictionState, startRaidBgm, syncSnapshot])

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
      void preloadRaidAssetsForMenu(true).then(() => {
        phaseRef.current = 'playing'
        stopBGM()
        startRaidBgmRef.current(stageRef.current, 'cruise')
        syncSnapshot()
      })
    }
  }, [multiplayerSession, preloadRaidAssetsForMenu, resetGame, resetGuestPredictionState, syncSnapshot])

  const spawnDevilEncounterAssist = useCallback((entryMode: 'stageEntry' | 'directEntry' = 'stageEntry') => {
    const isNormalBonusDevil = raidModeRef.current === 'campaign' && stageRef.current === NORMAL_RAID_DEVIL_BONUS_STAGE
    const isEndlessDevil = raidModeRef.current === 'endless'
    if (coOpRunRef.current || (!isNormalBonusDevil && !isEndlessDevil)) {
      devilAssistPlayerRef.current = null
      devilAssistMoveTargetRef.current = null
      devilAssistEntryRef.current = 0
      return
    }
    const model = getNormalRaidDevilAssistModel(playerRef.current, progressRef.current)
    if (!model) {
      devilAssistPlayerRef.current = null
      devilAssistMoveTargetRef.current = null
      devilAssistEntryRef.current = 0
      return
    }
    const assist = getInitialPlayer(getShipByKey('coreLander', selectedShipRef.current), model)
    assist.x = model === 'spiegel' ? 62 : 38
    assist.y = HEIGHT + 14
    assist.rank = Math.max(3, Math.round(playerRef.current.rank * 0.34))
    assist.invuln = STAGE_ENTRY_SECONDS + 1.25
    assist.specialCooldown = 999
    assist.fireCooldown = 0.35
    assist.engineBoost = 1.15
    assist.godMeleeChainX = assist.x
    assist.godMeleeChainY = assist.y
    devilAssistPlayerRef.current = assist
    devilAssistMoveTargetRef.current = { x: assist.x, y: 84 }
    devilAssistEntryRef.current = entryMode === 'directEntry' ? STAGE_ENTRY_SECONDS : 0
  }, [])

  const openBriefing = useCallback(() => {
    const session = multiplayerSessionRef.current
    if (session && !session.isHost) return
    raidModeRef.current = 'campaign'
    phaseRef.current = 'briefing'
    setBriefingStep(0)
    playGameSound('select')
    syncSnapshot()
  }, [syncSnapshot])

  const chooseShip = useCallback((ship: ShipOption) => {
    const session = multiplayerSessionRef.current
    if (session && !session.isHost) return
    if (ship.key === 'mesiah' && !hasProgressionUnlockOverride() && unlockedStageRef.current < MAX_RAID_STAGE && !hasClearedRaidInProgress(progressRef.current)) return
    if (ship.key === 'coreLander' && !isCoreLanderUnlocked(progressRef.current)) return
    selectedShipRef.current = ship
    setSelectedShipKey(ship.key)
    playerRef.current = getInitialPlayer(ship, getDefaultPlayerVisualShipKey(ship.key, progressRef.current))
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
    const activeBoss = enemiesRef.current.find((enemy) => enemy.isBoss) ?? null
    startRaidBgm(
      stageRef.current,
      activeBoss ? 'boss' : enemiesRef.current.length > 0 ? 'combat' : 'cruise',
      activeBoss?.bossKind ?? null,
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
    if (isGodGundamBarragePilot(player, progressRef.current) && (player.godMeleeCloak ?? 0) > 0) return
    const stacks = player.weapons
    let totalStacks = 0
    for (const key of WEAPON_KEYS) totalStacks += stacks[key]
    const shipKey = player.ship.key
    const coreLanderBurning = isCoreLanderBurning(player)
    const coreLanderCombatModel = getPlayerCoreLanderCombatModel(player, progressRef.current)
    const coreLanderFireInterval = getCoreLanderFireInterval(player)
    const isWhiteMesiah = shipKey === 'mesiah' && getRaidPlayerVisualShipKey(player, progressRef.current) === 'mesiahWhite'
    const canFireMain = player.fireCooldown <= 0
    const canFireMesiahDrones = shipKey === 'mesiah' && player.hp > 0 && player.mesiahDroneFireCooldown <= 0
    if (!canFireMain && !canFireMesiahDrones) return

    const baseDamage = getPlayerBaseAttack(player) + (isGodGundamBarragePilot(player, progressRef.current) ? getGodGundamStageAttackBonus(stageRef.current) : 0)
    const isArk = shipKey === 'dreadnought'
    const isSmallViewport = viewportMetricsRef.current?.cssWidth ? viewportMetricsRef.current.cssWidth < 640 : false
    const defaultScoutOffset = isArk
      ? (isSmallViewport ? 14 : 7.4)
      : (isSmallViewport ? 12 : 5.6)
    const pickupScoutOffset = isSmallViewport ? 8.2 : 5
    const scoutScale = isArk ? 0.9 : 0.86
    const optionSupportStacks = getOptionSupportStacks(player)
    const emitters: Array<{ x: number; y: number; scale: number; main: boolean; attackShipKey?: string; baseOnly?: boolean; target?: Enemy | null; rotation?: number; canFire?: boolean; supportWeaponMode?: 'laserHoming' }> = []

    if (canFireMain) {
      emitters.push({ x: player.x, y: player.y, scale: 1, main: true })
      if (isArk) {
        emitters.push(
          { x: clamp(player.x - defaultScoutOffset, 4, 96), y: player.y + 1.8, scale: scoutScale, main: false, attackShipKey: 'rocket' },
          { x: clamp(player.x + defaultScoutOffset, 4, 96), y: player.y + 1.8, scale: scoutScale, main: false, attackShipKey: 'rocket' },
        )
        if (optionSupportStacks > 0) {
          emitters.push(
            { x: clamp(player.x - pickupScoutOffset, 4, 96), y: player.y + 7.2, scale: 0.54, main: false, attackShipKey: 'spaceEt', baseOnly: true },
            { x: clamp(player.x + pickupScoutOffset, 4, 96), y: player.y + 7.2, scale: 0.54, main: false, attackShipKey: 'spaceEt', baseOnly: true },
          )
        }
      } else if (optionSupportStacks > 0) {
        if (shipKey === 'mesiah') {
          for (const scout of normalizeMesiahScoutDrones(player)) {
            if (!scout.active || !scout.canFire || scout.stack >= optionSupportStacks) continue
            const target = scout.targetId === null
              ? null
              : enemiesRef.current.find((enemy) => enemy.id === scout.targetId && enemy.hp > 0 && enemy.y > -8 && (enemy.isBoss || enemy.isMiniBoss)) ?? null
            emitters.push({
              x: scout.x,
              y: scout.y,
              scale: 0.72,
              main: false,
              attackShipKey: 'fast',
              supportWeaponMode: 'laserHoming',
              target,
              rotation: scout.rotation,
            })
          }
        } else {
          emitters.push(
            { x: clamp(player.x - defaultScoutOffset, 4, 96), y: player.y + 1.8, scale: scoutScale, main: false },
            { x: clamp(player.x + defaultScoutOffset, 4, 96), y: player.y + 1.8, scale: scoutScale, main: false },
          )
        }
      }
    }
    if (canFireMesiahDrones) {
      for (const drone of normalizeMesiahDrones(player)) {
        if (!drone.active || !drone.canFire || drone.targetId === null) continue
        const target = enemiesRef.current.find((enemy) => enemy.id === drone.targetId && enemy.hp > 0 && enemy.y > -8) ?? null
        if (!target) continue
        emitters.push({
          x: drone.x,
          y: drone.y,
          scale: 0.72,
          main: false,
          attackShipKey: isWhiteMesiah ? 'mesiahDroneSpaceJet' : 'mesiahDrone',
          baseOnly: true,
          target,
          rotation: drone.rotation,
          canFire: drone.canFire,
        })
      }
    }
    const firingWeapons = { ...EMPTY_WEAPON_FLAGS }
    for (const key of WEAPON_KEYS) {
      firingWeapons[key] = stacks[key] > 0 && player.weaponCooldowns[key] <= 0
    }

    let mesiahDroneFired = false
    let mesiahRocketsFired = false
    const canFireMesiahRockets = shipKey === 'mesiah' && player.mesiahRocketCooldown <= 0
    const fireBlackCometPulse = (emitter: { x: number; y: number; scale: number }, aim: Vec, radiusScale = 1) => {
      const mag = Math.sqrt((aim.x) * (aim.x) + (aim.y) * (aim.y)) || 1
      pushShot({
        x: emitter.x,
        y: emitter.y - 3.6,
        vx: (aim.x / mag) * 108,
        vy: (aim.y / mag) * 108,
        damage: Math.ceil((baseDamage + 3) * emitter.scale),
        kind: 'pulse',
        radius: 1.8 * radiusScale * emitter.scale,
      })
    }

    emitters.forEach((emitter) => {
      const damage = Math.max(1, Math.ceil(baseDamage * emitter.scale))
      const attackShipKey = emitter.attackShipKey ?? (isArk && !emitter.main ? 'rocket' : shipKey)
      const activeWeapons = emitter.supportWeaponMode === 'laserHoming'
        ? { ...EMPTY_WEAPON_FLAGS, laser: firingWeapons.laser, homing: firingWeapons.homing }
        : emitter.baseOnly ? EMPTY_WEAPON_FLAGS : firingWeapons

      // -- MESIAH DRONE: detached Space Jet support fire for white Mesiah --
      if (attackShipKey === 'mesiahDroneSpaceJet') {
        const target = emitter.target
        if (!target || !emitter.canFire) return
        const aim = { x: target.x - emitter.x, y: target.y - emitter.y }
        const mag = Math.sqrt((aim.x) * (aim.x) + (aim.y) * (aim.y)) || 1
        pushShot({
          x: emitter.x,
          y: emitter.y - 3.6,
          vx: (aim.x / mag) * 158,
          vy: (aim.y / mag) * 158,
          damage: Math.ceil((baseDamage + 1) * emitter.scale),
          kind: 'needle' as any,
          radius: 0.82 * emitter.scale,
        })
        mesiahDroneFired = true
      }

      // -- MESIAH DRONE: detached Black Comet support fire --
      else if (attackShipKey === 'mesiahDrone') {
        const target = emitter.target
        if (!target || !emitter.canFire) return
        const rotation = emitter.rotation ?? 0
        fireBlackCometPulse(emitter, target ? { x: target.x - emitter.x, y: target.y - emitter.y } : { x: Math.sin(rotation), y: -Math.cos(rotation) }, 0.58)
        mesiahDroneFired = true
      } else if (attackShipKey === 'rocket') {
        fireBlackCometPulse(emitter, { x: 0, y: -1 })
        if (activeWeapons.spread) {
          const fan = stacks.spread >= 2 ? [-34, -18, 18, 34] : [-24, 24]
          fan.forEach((vx) => pushShot({ x: emitter.x, y: emitter.y - 2.8, vx, vy: -86, damage, kind: 'spread', radius: 1.35 }))
        }
        if (activeWeapons.laser) {
          const side = stacks.laser >= 2 ? 1.6 : 0
          pushShot({ x: emitter.x - side, y: emitter.y - 5, vx: 0, vy: -132, damage: Math.ceil((baseDamage + 2 + stacks.laser) * emitter.scale), kind: 'laser', radius: 1.85, pierce: 1 + stacks.laser })
          if (stacks.laser >= 3) {
            pushShot({ x: emitter.x + side, y: emitter.y - 5, vx: 0, vy: -132, damage: Math.ceil((baseDamage + 2) * emitter.scale), kind: 'laser', radius: 1.65, pierce: 2 })
          }
        }
        if (activeWeapons.scatter) {
          const count = Math.min(8, 2 + stacks.scatter * 2)
          for (let i = 0; i < count; i++) {
            const angle = -Math.PI / 2 + (i - (count - 1) / 2) * 0.18
            pushShot({ x: emitter.x, y: emitter.y - 1.5, vx: Math.cos(angle) * 82, vy: Math.sin(angle) * 82, damage, kind: 'scatter', radius: 1.2 })
          }
        }
        if (activeWeapons.rocket) {
          const offsets = stacks.rocket >= 2 ? [-4.2, 4.2] : [0]
          offsets.forEach((offset) => {
            pushShot({ x: emitter.x + offset, y: emitter.y - 1, vx: offset * 1.7, vy: -72, damage: Math.ceil((baseDamage + 4 + stacks.rocket) * emitter.scale), kind: 'rocket', radius: 2.2 })
          })
        }
        if ((emitter.main || emitter.supportWeaponMode === 'laserHoming') && activeWeapons.homing) {
          const salvoOffsets = emitter.supportWeaponMode === 'laserHoming' ? [-3.4, 3.4] : [-5.4, 5.4, -7.2, 7.2]
          salvoOffsets.forEach((offset, index) => {
            const side = offset < 0 ? -1 : 1
            pushShot({ x: emitter.x + offset, y: emitter.y + (index < 2 ? -1.8 : 0.8), vx: side * (28 + index * 4), vy: -46 - index * 4, damage: Math.ceil((baseDamage + 4) * emitter.scale), kind: 'homing', radius: 2.1, turn: 5.2 })
          })
        }
      }

      // -- RED WRAITH: rapid twin needle streams --
      else if (attackShipKey === 'fast') {
        pushShot({ x: emitter.x - 1.2, y: emitter.y - 3, vx: -3, vy: -110, damage, kind: 'needle' as any, radius: 1.1 })
        pushShot({ x: emitter.x + 1.2, y: emitter.y - 3, vx: 3, vy: -110, damage, kind: 'needle' as any, radius: 1.1 })
        if (activeWeapons.spread) {
          const fan = stacks.spread >= 2 ? [-34, -18, 18, 34] : [-24, 24]
          fan.forEach((vx) => pushShot({ x: emitter.x, y: emitter.y - 2.8, vx, vy: -86, damage, kind: 'spread', radius: 1.35 }))
        }
        if (activeWeapons.laser) {
          const side = stacks.laser >= 2 ? 1.6 : 0
          pushShot({ x: emitter.x - side, y: emitter.y - 5, vx: 0, vy: -132, damage: Math.ceil((baseDamage + 2 + stacks.laser) * emitter.scale), kind: 'laser', radius: 1.85, pierce: 1 + stacks.laser })
          if (stacks.laser >= 3) {
            pushShot({ x: emitter.x + side, y: emitter.y - 5, vx: 0, vy: -132, damage: Math.ceil((baseDamage + 2) * emitter.scale), kind: 'laser', radius: 1.65, pierce: 2 })
          }
        }
        if (activeWeapons.scatter) {
          const count = Math.min(8, 2 + stacks.scatter * 2)
          for (let i = 0; i < count; i++) {
            const angle = -Math.PI / 2 + (i - (count - 1) / 2) * 0.18
            pushShot({ x: emitter.x, y: emitter.y - 1.5, vx: Math.cos(angle) * 82, vy: Math.sin(angle) * 82, damage, kind: 'scatter', radius: 1.2 })
          }
        }
        if (activeWeapons.rocket) {
          const offsets = stacks.rocket >= 2 ? [-4.2, 4.2] : [0]
          offsets.forEach((offset) => {
            pushShot({ x: emitter.x + offset, y: emitter.y - 1, vx: offset * 1.7, vy: -72, damage: Math.ceil((baseDamage + 4 + stacks.rocket) * emitter.scale), kind: 'rocket', radius: 2.2 })
          })
        }
        if ((emitter.main || emitter.supportWeaponMode === 'laserHoming') && activeWeapons.homing) {
          const salvoOffsets = emitter.supportWeaponMode === 'laserHoming' ? [-3.4, 3.4] : [-5.4, 5.4, -7.2, 7.2]
          salvoOffsets.forEach((offset, index) => {
            const side = offset < 0 ? -1 : 1
            pushShot({ x: emitter.x + offset, y: emitter.y + (index < 2 ? -1.8 : 0.8), vx: side * (28 + index * 4), vy: -46 - index * 4, damage: Math.ceil((baseDamage + 4) * emitter.scale), kind: 'homing', radius: 2.1, turn: 5.2 })
          })
        }
      }

      // -- MESIAH: Red Wraith stream plus default rocket pair --
      else if (attackShipKey === 'mesiah') {
        const boostedDamage = Math.ceil((baseDamage + 2) * emitter.scale)
        pushShot({ x: emitter.x - 1.45, y: emitter.y - 3.4, vx: -3, vy: -116, damage: boostedDamage, kind: 'needle' as any, radius: 1.12 })
        pushShot({ x: emitter.x + 1.45, y: emitter.y - 3.4, vx: 3, vy: -116, damage: boostedDamage, kind: 'needle' as any, radius: 1.12 })
        if (canFireMesiahRockets) {
          ;[-4.6, 4.6].forEach((offset) => {
            pushShot({ x: emitter.x + offset, y: emitter.y - 1.2, vx: offset * 1.35, vy: -76, damage: Math.ceil((baseDamage + 7) * emitter.scale), kind: 'rocket', radius: 2.35 })
          })
          mesiahRocketsFired = true
        }
        if (activeWeapons.spread) {
          const fan = stacks.spread >= 2 ? [-34, -18, 18, 34] : [-24, 24]
          fan.forEach((vx) => pushShot({ x: emitter.x, y: emitter.y - 2.8, vx, vy: -86, damage: boostedDamage, kind: 'spread', radius: 1.35 }))
        }
        if (activeWeapons.laser) {
          const side = stacks.laser >= 2 ? 1.6 : 0
          pushShot({ x: emitter.x - side, y: emitter.y - 5, vx: 0, vy: -132, damage: Math.ceil((baseDamage + 4 + stacks.laser) * emitter.scale), kind: 'laser', radius: 1.85, pierce: 1 + stacks.laser })
        }
        if (activeWeapons.scatter) {
          const count = Math.min(8, 2 + stacks.scatter * 2)
          for (let i = 0; i < count; i++) {
            const angle = -Math.PI / 2 + (i - (count - 1) / 2) * 0.18
            pushShot({ x: emitter.x, y: emitter.y - 1.5, vx: Math.cos(angle) * 82, vy: Math.sin(angle) * 82, damage: boostedDamage, kind: 'scatter', radius: 1.2 })
          }
        }
        if (activeWeapons.rocket) {
          const offsets = stacks.rocket >= 2 ? [-6.2, -3.2, 3.2, 6.2] : [-5.2, 5.2]
          offsets.forEach((offset) => {
            pushShot({ x: emitter.x + offset, y: emitter.y - 1, vx: offset * 1.5, vy: -74, damage: Math.ceil((baseDamage + 8 + stacks.rocket) * emitter.scale), kind: 'rocket', radius: 2.35 })
          })
        }
        if ((emitter.main || emitter.supportWeaponMode === 'laserHoming') && activeWeapons.homing) {
          const salvoOffsets = emitter.supportWeaponMode === 'laserHoming' ? [-3.4, 3.4] : [-5.4, 5.4, -7.2, 7.2]
          salvoOffsets.forEach((offset, index) => {
            const side = offset < 0 ? -1 : 1
            pushShot({ x: emitter.x + offset, y: emitter.y + (index < 2 ? -1.8 : 0.8), vx: side * (28 + index * 4), vy: -46 - index * 4, damage: Math.ceil((baseDamage + 5) * emitter.scale), kind: 'homing', radius: 2.1, turn: 5.6 })
          })
        }
      }

      else if (attackShipKey === 'coreLander') {
        if (coreLanderCombatModel === 'spiegel') {
          ;[
            { offset: -2.8, vx: -18, vy: -91 },
            { offset: 0, vx: 0, vy: -96 },
            { offset: 2.8, vx: 18, vy: -91 },
          ].forEach((kunai) => {
            pushShot({
              x: emitter.x + kunai.offset * emitter.scale,
              y: emitter.y - 4.8,
              vx: kunai.vx,
              vy: kunai.vy,
              damage: Math.max(1, Math.ceil((baseDamage + 4) * emitter.scale * SPIEGEL_KUNAI_DAMAGE_MULTIPLIER)),
              kind: 'spiegelKunai',
              radius: coreLanderBurning ? 2.35 : 2.15,
              burning: coreLanderBurning,
            })
          })
        } else {
          pushShot({
            x: emitter.x,
            y: emitter.y - 4.8,
            vx: 0,
            vy: -82,
            damage: Math.ceil((baseDamage + 9) * emitter.scale),
            kind: 'coreBlast',
            radius: coreLanderBurning ? 3.05 : 2.8,
            burning: coreLanderBurning,
          })
        }
        if (activeWeapons.spread) {
          const fan = stacks.spread >= 2 ? [-30, -16, 16, 30] : [-22, 22]
          fan.forEach((vx) => pushShot({ x: emitter.x, y: emitter.y - 3.2, vx, vy: -88, damage, kind: 'spread', radius: 1.28 }))
        }
        if (activeWeapons.laser) {
          const side = stacks.laser >= 2 ? 1.8 : 0
          pushShot({ x: emitter.x - side, y: emitter.y - 5.4, vx: 0, vy: -134, damage: Math.ceil((baseDamage + 3 + stacks.laser) * emitter.scale), kind: 'laser', radius: 1.9, pierce: 1 + stacks.laser })
          if (stacks.laser >= 3) {
            pushShot({ x: emitter.x + side, y: emitter.y - 5.4, vx: 0, vy: -134, damage: Math.ceil((baseDamage + 3) * emitter.scale), kind: 'laser', radius: 1.7, pierce: 2 })
          }
        }
        if (activeWeapons.scatter) {
          const count = Math.min(8, 2 + stacks.scatter * 2)
          for (let i = 0; i < count; i += 1) {
            const angle = -Math.PI / 2 + (i - (count - 1) / 2) * 0.16
            pushShot({ x: emitter.x, y: emitter.y - 2.2, vx: Math.cos(angle) * 84, vy: Math.sin(angle) * 84, damage, kind: 'scatter', radius: 1.18 })
          }
        }
        if (activeWeapons.rocket) {
          const offsets = stacks.rocket >= 2 ? [-5.6, 5.6] : [0]
          offsets.forEach((offset) => {
            pushShot({ x: emitter.x + offset, y: emitter.y - 1.6, vx: offset * 1.35, vy: -76, damage: Math.ceil((baseDamage + 5 + stacks.rocket) * emitter.scale), kind: 'rocket', radius: 2.18 })
          })
        }
        if ((emitter.main || emitter.supportWeaponMode === 'laserHoming') && activeWeapons.homing) {
          const salvoOffsets = emitter.supportWeaponMode === 'laserHoming' ? [-3.4, 3.4] : [-5.2, 5.2, -7, 7]
          salvoOffsets.forEach((offset, index) => {
            const side = offset < 0 ? -1 : 1
            pushShot({ x: emitter.x + offset, y: emitter.y + (index < 2 ? -2 : 0.6), vx: side * (26 + index * 4), vy: -48 - index * 4, damage: Math.ceil((baseDamage + 4) * emitter.scale), kind: 'homing', radius: 2.05, turn: 5.4 })
          })
        }
      }

      else if (attackShipKey === 'gatling') {
        const target = emitter.target
        const aim = target ? { x: target.x - emitter.x, y: target.y - emitter.y } : { x: 0, y: -1 }
        const mag = Math.sqrt((aim.x) * (aim.x) + (aim.y) * (aim.y)) || 1
        const shotVx = (aim.x / mag) * 112
        const shotVy = (aim.y / mag) * 112
        const perpX = -(aim.y / mag) * 3.2 * emitter.scale
        const perpY = (aim.x / mag) * 3.2 * emitter.scale
        pushShot({ x: emitter.x + perpX, y: emitter.y + perpY - 1.8, vx: shotVx - 2 * emitter.scale, vy: shotVy, damage, kind: 'pulse', radius: 1.25 * emitter.scale })
        pushShot({ x: emitter.x - perpX, y: emitter.y - perpY - 1.8, vx: shotVx + 2 * emitter.scale, vy: shotVy, damage, kind: 'pulse', radius: 1.25 * emitter.scale })
        if (activeWeapons.spread) {
          const fan = stacks.spread >= 2 ? [-34, -18, 18, 34] : [-24, 24]
          fan.forEach((vx) => pushShot({ x: emitter.x, y: emitter.y - 2.8, vx, vy: -86, damage, kind: 'spread', radius: 1.35 }))
        }
        if (activeWeapons.laser) {
          const side = stacks.laser >= 2 ? 1.6 : 0
          pushShot({ x: emitter.x - side, y: emitter.y - 5, vx: 0, vy: -132, damage: Math.ceil((baseDamage + 2 + stacks.laser) * emitter.scale), kind: 'laser', radius: 1.85, pierce: 1 + stacks.laser })
          if (stacks.laser >= 3) {
            pushShot({ x: emitter.x + side, y: emitter.y - 5, vx: 0, vy: -132, damage: Math.ceil((baseDamage + 2) * emitter.scale), kind: 'laser', radius: 1.65, pierce: 2 })
          }
        }
        if (activeWeapons.scatter) {
          const count = Math.min(8, 2 + stacks.scatter * 2)
          for (let i = 0; i < count; i++) {
            const angle = -Math.PI / 2 + (i - (count - 1) / 2) * 0.18
            pushShot({ x: emitter.x, y: emitter.y - 1.5, vx: Math.cos(angle) * 82, vy: Math.sin(angle) * 82, damage, kind: 'scatter', radius: 1.2 })
          }
        }
        if (activeWeapons.rocket) {
          const offsets = stacks.rocket >= 2 ? [-4.2, 4.2] : [0]
          offsets.forEach((offset) => {
            pushShot({ x: emitter.x + offset, y: emitter.y - 1, vx: offset * 1.7, vy: -72, damage: Math.ceil((baseDamage + 4 + stacks.rocket) * emitter.scale), kind: 'rocket', radius: 2.2 })
          })
        }
        if ((emitter.main || emitter.supportWeaponMode === 'laserHoming') && activeWeapons.homing) {
          const salvoOffsets = emitter.supportWeaponMode === 'laserHoming' ? [-3.4, 3.4] : [-5.4, 5.4, -7.2, 7.2]
          salvoOffsets.forEach((offset, index) => {
            const side = offset < 0 ? -1 : 1
            pushShot({ x: emitter.x + offset, y: emitter.y + (index < 2 ? -1.8 : 0.8), vx: side * (28 + index * 4), vy: -46 - index * 4, damage: Math.ceil((baseDamage + 4) * emitter.scale), kind: 'homing', radius: 2.1, turn: 5.2 })
          })
        }
      }

      // -- NIGHT LANCE: single thick slow piercing laser ray --
      else if (attackShipKey === 'laser') {
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
        // always fires homing salvo � signature ability
        // default 2 salvo � all emitters including scouts
        const defaultSalvo = [-5.4, 5.4]
        defaultSalvo.forEach((offset, index) => {
          const side = offset < 0 ? -1 : 1
          pushShot({ x: emitter.x + offset, y: emitter.y + (index < 2 ? -1.8 : 0.8), vx: side * (28 + index * 4), vy: -46 - index * 4, damage: Math.ceil((baseDamage + 3) * emitter.scale), kind: 'homing', radius: 2.1, turn: 5.2 })
        })

        // pickup bonus � 4 extra salvos, main ship only, fires every shot like the default
        if (emitter.main && stacks.homing > 0) {
          const bonusSalvo = [-5.4, 5.4, -7.2, 7.2]
          bonusSalvo.forEach((offset, index) => {
            const side = offset < 0 ? -1 : 1
            pushShot({ x: emitter.x + offset, y: emitter.y + (index < 2 ? -1.8 : 0.8), vx: side * (28 + index * 4), vy: -46 - index * 4, damage: Math.ceil((baseDamage + 4) * emitter.scale), kind: 'homing', radius: 2.1, turn: 5.2 })
          })
        }
        if (activeWeapons.spread) {
          const fan = stacks.spread >= 2 ? [-34, -18, 18, 34] : [-24, 24]
          fan.forEach((vx) => pushShot({ x: emitter.x, y: emitter.y - 2.8, vx, vy: -86, damage, kind: 'spread', radius: 1.35 }))
        }
        if (activeWeapons.laser) {
          const side = stacks.laser >= 2 ? 1.6 : 0
          pushShot({ x: emitter.x - side, y: emitter.y - 5, vx: 0, vy: -132, damage: Math.ceil((baseDamage + 2 + stacks.laser) * emitter.scale), kind: 'laser', radius: 1.85, pierce: 1 + stacks.laser })
          if (stacks.laser >= 3) {
            pushShot({ x: emitter.x + side, y: emitter.y - 5, vx: 0, vy: -132, damage: Math.ceil((baseDamage + 2) * emitter.scale), kind: 'laser', radius: 1.65, pierce: 2 })
          }
        }
        if (activeWeapons.scatter) {
          const count = Math.min(8, 2 + stacks.scatter * 2)
          for (let i = 0; i < count; i++) {
            const angle = -Math.PI / 2 + (i - (count - 1) / 2) * 0.18
            pushShot({ x: emitter.x, y: emitter.y - 1.5, vx: Math.cos(angle) * 82, vy: Math.sin(angle) * 82, damage, kind: 'scatter', radius: 1.2 })
          }
        }
        if (activeWeapons.rocket) {
          const offsets = stacks.rocket >= 2 ? [-4.2, 4.2] : [0]
          offsets.forEach((offset) => {
            pushShot({ x: emitter.x + offset, y: emitter.y - 1, vx: offset * 1.7, vy: -72, damage: Math.ceil((baseDamage + 4 + stacks.rocket) * emitter.scale), kind: 'rocket', radius: 2.2 })
          })
        }
      }

      // -- OBSIDIAN ARK: slow heavy rocket core --
      else if (attackShipKey === 'dreadnought') {
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

        if (activeWeapons.spread) {
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

        if (activeWeapons.laser) {
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

        if (activeWeapons.rocket) {
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

        if ((emitter.main || emitter.supportWeaponMode === 'laserHoming') && activeWeapons.homing) {
          const salvoOffsets = emitter.supportWeaponMode === 'laserHoming' ? [-3.4, 3.4] : [-5.4, 5.4, -7.2, 7.2]

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

      // -- CROSSWING NOVA: forward-aligned S-foil cannons --
      else if (attackShipKey === 'xwing') {
        const wingOffset = emitter.main ? 4.2 : 2.7
        const innerOffset = emitter.main ? 1.65 : 1.05
        pushShot({ x: emitter.x - wingOffset, y: emitter.y - 4.4, vx: -1.5, vy: -118, damage: Math.ceil((baseDamage + 2) * emitter.scale), kind: 'laser', radius: 1.35, pierce: 1 + Math.floor(stacks.laser / 2) })
        pushShot({ x: emitter.x + wingOffset, y: emitter.y - 4.4, vx: 1.5, vy: -118, damage: Math.ceil((baseDamage + 2) * emitter.scale), kind: 'laser', radius: 1.35, pierce: 1 + Math.floor(stacks.laser / 2) })
        pushShot({ x: emitter.x - innerOffset, y: emitter.y - 5.2, vx: -0.8, vy: -128, damage: Math.ceil((baseDamage + 1) * emitter.scale), kind: 'needle' as any, radius: 0.95 })
        pushShot({ x: emitter.x + innerOffset, y: emitter.y - 5.2, vx: 0.8, vy: -128, damage: Math.ceil((baseDamage + 1) * emitter.scale), kind: 'needle' as any, radius: 0.95 })
        if (activeWeapons.spread) {
          const fan = stacks.spread >= 2 ? [-34, -18, 18, 34] : [-24, 24]
          fan.forEach((vx) => pushShot({ x: emitter.x, y: emitter.y - 2.8, vx, vy: -86, damage, kind: 'spread', radius: 1.35 }))
        }
        if (activeWeapons.laser) {
          const side = stacks.laser >= 2 ? 1.6 : 0
          pushShot({ x: emitter.x - side, y: emitter.y - 5, vx: 0, vy: -132, damage: Math.ceil((baseDamage + 2 + stacks.laser) * emitter.scale), kind: 'laser', radius: 1.85, pierce: 1 + stacks.laser })
          if (stacks.laser >= 3) {
            pushShot({ x: emitter.x + side, y: emitter.y - 5, vx: 0, vy: -132, damage: Math.ceil((baseDamage + 2) * emitter.scale), kind: 'laser', radius: 1.65, pierce: 2 })
          }
        }
        if (activeWeapons.scatter) {
          const count = Math.min(8, 2 + stacks.scatter * 2)
          for (let i = 0; i < count; i++) {
            const angle = -Math.PI / 2 + (i - (count - 1) / 2) * 0.18
            pushShot({ x: emitter.x, y: emitter.y - 1.5, vx: Math.cos(angle) * 82, vy: Math.sin(angle) * 82, damage, kind: 'scatter', radius: 1.2 })
          }
        }
        if (activeWeapons.rocket) {
          const offsets = stacks.rocket >= 2 ? [-4.2, 4.2] : [0]
          offsets.forEach((offset) => {
            pushShot({ x: emitter.x + offset, y: emitter.y - 1, vx: offset * 1.7, vy: -72, damage: Math.ceil((baseDamage + 4 + stacks.rocket) * emitter.scale), kind: 'rocket', radius: 2.2 })
          })
        }
        if ((emitter.main || emitter.supportWeaponMode === 'laserHoming') && activeWeapons.homing) {
          const salvoOffsets = emitter.supportWeaponMode === 'laserHoming' ? [-3.4, 3.4] : [-5.4, 5.4, -7.2, 7.2]
          salvoOffsets.forEach((offset, index) => {
            const side = offset < 0 ? -1 : 1
            pushShot({ x: emitter.x + offset, y: emitter.y + (index < 2 ? -1.8 : 0.8), vx: side * (28 + index * 4), vy: -46 - index * 4, damage: Math.ceil((baseDamage + 4) * emitter.scale), kind: 'homing', radius: 2.1, turn: 5.2 })
          })
        }
      }

      // -- SPACE JET: single thin fast green laser line --
      else if (attackShipKey === 'spaceEt') {
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
        if (activeWeapons.spread) {
          const fan = stacks.spread >= 2 ? [-34, -18, 18, 34] : [-24, 24]
          fan.forEach((vx) => pushShot({ x: emitter.x, y: emitter.y - 2.8, vx, vy: -86, damage, kind: 'spread', radius: 1.35 }))
        }
        if (activeWeapons.laser) {
          const side = stacks.laser >= 2 ? 1.6 : 0
          pushShot({ x: emitter.x - side, y: emitter.y - 5, vx: 0, vy: -132, damage: Math.ceil((baseDamage + 2 + stacks.laser) * emitter.scale), kind: 'laser', radius: 1.85, pierce: 1 + stacks.laser })
          if (stacks.laser >= 3) {
            pushShot({ x: emitter.x + side, y: emitter.y - 5, vx: 0, vy: -132, damage: Math.ceil((baseDamage + 2) * emitter.scale), kind: 'laser', radius: 1.65, pierce: 2 })
          }
        }
        if (activeWeapons.scatter) {
          const count = Math.min(8, 2 + stacks.scatter * 2)
          for (let i = 0; i < count; i++) {
            const angle = -Math.PI / 2 + (i - (count - 1) / 2) * 0.18
            pushShot({ x: emitter.x, y: emitter.y - 1.5, vx: Math.cos(angle) * 82, vy: Math.sin(angle) * 82, damage, kind: 'scatter', radius: 1.2 })
          }
        }
        if (activeWeapons.rocket) {
          const offsets = stacks.rocket >= 2 ? [-4.2, 4.2] : [0]
          offsets.forEach((offset) => {
            pushShot({ x: emitter.x + offset, y: emitter.y - 1, vx: offset * 1.7, vy: -72, damage: Math.ceil((baseDamage + 4 + stacks.rocket) * emitter.scale), kind: 'rocket', radius: 2.2 })
          })
        }
        if ((emitter.main || emitter.supportWeaponMode === 'laserHoming') && activeWeapons.homing) {
          const salvoOffsets = emitter.supportWeaponMode === 'laserHoming' ? [-3.4, 3.4] : [-5.4, 5.4, -7.2, 7.2]
          salvoOffsets.forEach((offset, index) => {
            const side = offset < 0 ? -1 : 1
            pushShot({ x: emitter.x + offset, y: emitter.y + (index < 2 ? -1.8 : 0.8), vx: side * (28 + index * 4), vy: -46 - index * 4, damage: Math.ceil((baseDamage + 4) * emitter.scale), kind: 'homing', radius: 2.1, turn: 5.2 })
          })
        }
      }
      // -- FALLBACK --
      else {
        pushShot({ x: emitter.x, y: emitter.y - 3.6, vx: 0, vy: -96, damage, kind: 'pulse', radius: 1.35 })
      }
    })

    if (mesiahDroneFired) player.mesiahDroneFireCooldown = MESIAH_DRONE_FIRE_INTERVAL_SECONDS
    if (mesiahRocketsFired) player.mesiahRocketCooldown = MESIAH_ROCKET_FIRE_INTERVAL_SECONDS
    if (!canFireMain) {
      if (mesiahDroneFired) playGameSound('shoot')
      return
    }

    if ((shipKey === 'mesiah' || stacks.rocket > 0 || stacks.homing > 0) && Math.random() < 0.12) playGameSound('rocket')
      ; WEAPON_KEYS.forEach((key) => {
        if (firingWeapons[key]) {
          player.weaponCooldowns[key] = WEAPON_FIRE_INTERVALS[key]
        }
      })

    const baseInterval =
      shipKey === 'fast' ? 0.072 :       // Red Wraith � very rapid
        shipKey === 'gatling' ? 0.088 :    // Crimson Saw � dual gatling rhythm
          shipKey === 'mesiah' ? 0.082 :
            shipKey === 'coreLander' ? coreLanderFireInterval :
          shipKey === 'dreadnought' ? 0.32 : // Obsidian Ark � slow heavy
            shipKey === 'laser' ? 1.0 :        // Night Lance � slow thick ray
              shipKey === 'spaceEt' ? 0.001 :    // Space Jet � fastest
                shipKey === 'xwing' ? 0.5 :       // Crosswing � shotgun pump rhythm
                  0.10                              // Black Comet � default

    const tunedBaseInterval = shipKey === 'coreLander' ? coreLanderFireInterval : shipKey === 'spaceEt' ? 0.002 : shipKey === 'xwing' ? 0.34 : baseInterval
    const minFireCooldown = shipKey === 'spaceEt' ? 0.032 : 0.042
    player.fireCooldown = shipKey === 'coreLander'
      ? coreLanderFireInterval
      : Math.max(minFireCooldown, (tunedBaseInterval - Math.min(0.045, totalStacks * 0.006)) / player.ship.fireRate)
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
    const eliteCap = getMaxActiveEliteEnemies(stage, isCoOpActive())
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
    const eliteHp = Math.round((38 + hp * eliteHpMultiplier + eliteStagePressure * 11.5 + wave * 3.4 + powerPressure * 4.2) * (isCoOpActive() ? 1.36 : 1) * enemyHpMultRef.current)
    const normalHp = Math.max(1, Math.round(hp * enemyHpMultRef.current))
    enemiesRef.current.push({
      id: enemyId++,
      x: isElite ? eliteX : x,
      y: isElite ? Math.min(y, -7 - Math.random() * 16) : y,
      vx: kind === 'lancer' ? (Math.random() < 0.5 ? -1 : 1) * 10 : (Math.random() - 0.5) * (isElite ? 7 : 4),
      vy: isElite ? kind === 'brood' ? 10.4 : kind === 'lancer' ? 13.2 : 11.8 : 14 + Math.random() * 7 + wave * 0.38,
      hp: isElite ? eliteHp : normalHp,
      maxHp: isElite ? eliteHp : normalHp,
      radius: isElite ? kind === 'brood' ? 6.4 : kind === 'lancer' ? 5.7 : 6 : 3.7,
      variant: isElite ? enemyId % RAID_ELITE_SPRITE_COUNT : enemyId % RAID_ALIEN_SPRITE_COUNT,
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
      chargeTargetY: 50,
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
    const forceLocalDevilTest = shouldForceLocalDevilBossTest(stage, raidModeRef.current, playerName)
    const powerScore = getPowerScore(playerRef.current)
    const isBossRush = raidModeRef.current === 'bossRush'
    const bossCycle: BossKind[] = ['carrier', 'orb', 'mantis', 'serpent', 'hydra', 'gate']
    const isNormalRaidDevilBonusStage = raidModeRef.current === 'campaign' && stage === NORMAL_RAID_DEVIL_BONUS_STAGE
    const bossKind: BossKind = isNormalRaidDevilBonusStage
      ? 'devil'
      : raidModeRef.current === 'endless'
        ? forceLocalDevilTest ? 'devil' : pickEndlessBossKind(stage, wave, devilBossNextEligibleStageRef.current, isCreatorPlayerName(playerName))
        : stage === MAX_RAID_STAGE ? 'final' : stage === 10 ? 'snake' : stage === 5 ? 'squid' : stage % 5 === 0 ? 'super' : bossCycle[(stage - 1) % bossCycle.length]
    if (bossKind === 'devil') {
      devilPreBuffRankRef.current = player.rank
      fullyBuffRaidPlayer(player)
      player.rank = PLAYER_MAX_RANK
      if (remotePlayerRef.current) {
        fullyBuffRaidPlayer(remotePlayerRef.current)
        remotePlayerRef.current.rank = PLAYER_MAX_RANK
      }
      player.specialCooldown = 0
      if (remotePlayerRef.current) remotePlayerRef.current.specialCooldown = 0
    }
    const hpMultiplier =
      bossKind === 'devil' ? 55 :
        bossKind === 'final' ? 13.4 :
          bossKind === 'snake' ? 8.25 :
            bossKind === 'squid' ? 7.45 :
        bossKind === 'super' ? 3.45 :
          bossKind === 'gate' ? 1.75 :
            bossKind === 'hydra' ? 1.62 :
              bossKind === 'serpent' ? 1.48 :
                bossKind === 'mantis' ? 1.38 :
                  bossKind === 'orb' ? 1.3 :
                    1.16
    const stagePressure = Math.max(0, stage - 1)
    const multiplayerBossMultiplier = isCoOpActive() ? MULTIPLAYER_BOSS_HP_MULTIPLIER : 1
    const bossBaseHp = bossKind === 'devil'
      ? 1300 + wave * 165 + stagePressure * 290 + powerScore * 80
      : 1450 + wave * 180 + stagePressure * 320 + powerScore * 90
    const hp = Math.round(bossBaseHp * hpMultiplier * multiplayerBossMultiplier * enemyHpMultRef.current)
    const radius =
      bossKind === 'devil' ? 12.8 :
        bossKind === 'final' ? 25 :
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
      y: bossKind === 'devil' ? -28 : bossKind === 'final' ? -30 : bossKind === 'squid' || bossKind === 'snake' ? -27 : bossKind === 'super' || bossKind === 'gate' ? -24 : -16,
      vx: 0,
      vy: (bossKind === 'devil' ? 3.4 : bossKind === 'final' ? 4.4 : bossKind === 'squid' || bossKind === 'snake' ? 4.9 : bossKind === 'super' || bossKind === 'gate' ? 5.3 : 7) * (isBossRush ? BOSS_RUSH_ENTRY_SPEED_SCALE : 1),
      hp,
      maxHp: hp,
      radius,
      variant: bossKind === 'squid' ? 4 : bossKind === 'snake' ? 5 : stage % 4,
      isBoss: true,
      isMiniBoss: false,
      fireCooldown: (bossKind === 'devil' ? 1.35 : Math.max(0.75, 1 - stagePressure * 0.025)) * (isBossRush ? BOSS_RUSH_ATTACK_COOLDOWN_SCALE : 1),
      phase: Math.random() * Math.PI * 2,
      color: BOSS_COLORS[bossKind],
      pattern: bossKind === 'devil' ? 10 : bossKind === 'final' ? 9 : bossKind === 'snake' ? 8 : bossKind === 'squid' ? 7 : bossKind === 'super' ? 6 : bossCycle.indexOf(bossKind),
      bossKind,
      miniBossKind: null,
      shieldTime: (bossKind === 'devil' ? 7.2 : bossKind === 'final' ? 7.4 : bossKind === 'squid' || bossKind === 'snake' ? 5.8 : bossKind === 'super' || bossKind === 'gate' ? 5.4 : 3.8) + Math.min(2.2, stagePressure * 0.18),
      originX: 50,
      amplitude: bossKind === 'devil' ? 0 : bossKind === 'final' ? 34 : bossKind === 'snake' ? 36 : bossKind === 'squid' ? 24 : bossKind === 'super' ? 30 : bossKind === 'serpent' ? 28 : bossKind === 'gate' ? 18 : 23,
      trainSlot: 0,
      pathSpeed: (bossKind === 'devil' ? 0.018 : 0.05) * (isBossRush ? BOSS_RUSH_MOTION_SCALE : 1),
      chargeCooldown: bossKind === 'devil' ? 2.2 : bossKind === 'final' ? 3.2 : bossKind === 'snake' ? 3.4 : bossKind === 'squid' ? 0.75 : 999,
      mirageKind: null,
      mirageTimer: 0,
      mirageCooldown: bossKind === 'final' ? 8 + Math.random() * 6 : 0,
      chargeTimer: 0,
      chargeLane: 50,
      chargeTargetY: 50,
      chargePattern: 'single',
    })
    if (bossKind === 'devil') {
      devilBossEncounteredRef.current = true
      devilBossNextEligibleStageRef.current = stage + DEVIL_BOSS_MIN_STAGE_GAP + Math.floor(Math.random() * (DEVIL_BOSS_MAX_STAGE_GAP - DEVIL_BOSS_MIN_STAGE_GAP + 1))
      if (!devilAssistPlayerRef.current) {
        spawnDevilEncounterAssist(raidModeRef.current === 'endless' ? 'directEntry' : 'stageEntry')
      }
    }
    if (player.forceField > 0) {
      player.forceField = Math.min(FORCE_FIELD_ARMOR, player.forceField + 1)
    }
    bossAlertRef.current = 1
    bossMessageRef.current = 'incoming'
    bossEntranceSlamRef.current = BOSS_ENTRANCE_SLAM_SECONDS
    triggerScreenShake(bossKind === 'devil' || bossKind === 'final' ? 4.8 : 3.6, 260)
    startRaidBgm(stage, 'boss', bossKind)
    playGameSound('stinger')
  }, [playerName, spawnDevilEncounterAssist, startRaidBgm, triggerScreenShake])

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
    const godGundamMeleeOnly = isGodGundamBarragePilot(player, progressRef.current)
    if (player.hp < player.maxHp) candidates.push('repair')
    if (player.forceField <= 1) candidates.push('forcefield', 'forcefield')
    if (player.shield < 2.5) candidates.push('shield')
    if (!godGundamMeleeOnly && (player.ship.key === 'mesiah' ? (player.optionStacks ?? 0) < 2 : player.optionTimer <= 0)) candidates.push('option')
    if (!godGundamMeleeOnly) {
      ; WEAPON_KEYS.forEach((key) => {
        const maxStack = WEAPON_STACK_CAPS[key]
        const copies = player.weapons[key] === 0 ? 3 : player.weapons[key] >= maxStack ? 1 : 2
        for (let i = 0; i < copies; i += 1) candidates.push(key)
      })
    }

    const type = candidates[Math.floor(Math.random() * candidates.length)] ?? (godGundamMeleeOnly ? 'repair' : 'spread')
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

    const coOpRun = coOpRunRef.current
    const leaderboardName = session
      ? session.players.map((roomPlayer) => roomPlayer.name).join(' + ')
      : coOpRun
        ? `${playerName} + P2`
      : playerName

    leaderboardSubmittedRef.current = true
    void submitLeaderboardScore({
      mode: coOpRun ? 'gradius_multiplayer' : raidModeRef.current === 'endless' ? 'gradius_endless' : raidModeRef.current === 'bossRush' ? 'gradius_boss_rush' : 'gradius_solo',
      playerName: leaderboardName,
      score,
      shipKey: selectedShipRef.current.key,
      stage: stageRef.current,
    })
  }, [playerName])

  const reportRaidRunComplete = useCallback((status: RunStatus) => {
    if (runReportedRef.current) return
    const player = playerRef.current
    const remotePlayer = remotePlayerRef.current
    const score = Math.max(player.score, remotePlayer?.score ?? 0)
    if (score <= 0) return

    const session = multiplayerSessionRef.current
    const coOpRun = coOpRunRef.current
    const sameScreenPilots = sameScreenCoopRef.current && remotePlayer
      ? [
          {
            label: 'P1',
            name: playerName,
            shipKey: player.ship.key,
            score: player.score,
            hp: player.hp,
            maxHp: player.maxHp,
          },
          {
            label: 'P2',
            name: 'P2',
            shipKey: remotePlayer.ship.key,
            score: remotePlayer.score,
            hp: remotePlayer.hp,
            maxHp: remotePlayer.maxHp,
          },
        ]
      : undefined
    const commanderName = session
      ? session.players.map((roomPlayer) => roomPlayer.name).join(' + ')
      : coOpRun
        ? `${playerName} + P2`
      : playerName

    runReportedRef.current = true
    onRunComplete?.({
      mode: coOpRun ? 'gradius_multiplayer' : raidModeRef.current === 'endless' ? 'gradius_endless' : raidModeRef.current === 'bossRush' ? 'gradius_boss_rush' : 'gradius_solo',
      status,
      playerName: commanderName,
      score,
      teamScore: sameScreenPilots ? sameScreenPilots.reduce((total, pilot) => total + Math.max(0, pilot.score), 0) : undefined,
      stage: stageRef.current,
      shipKey: selectedShipRef.current.key,
      pilots: sameScreenPilots,
      durationMs: performance.now() - runStartTimeRef.current,
      enemiesDestroyed: enemiesDestroyedRef.current,
      bossesDefeated: bossesDefeatedRef.current,
      pickupsCollected: pickupsCollectedRef.current,
      nukesUsed: nukesUsedRef.current,
      raidMode: raidModeRef.current,
      difficulty: raidDifficultyRef.current,
      devilBossEncountered: devilBossEncounteredRef.current,
      devilBossDefeated: devilBossDefeatedRef.current,
    })
  }, [onRunComplete, playerName])

  const exitRaid = useCallback(() => {
    const score = Math.max(playerRef.current.score, remotePlayerRef.current?.score ?? 0)
    if (phaseRef.current === 'victory') {
      submitRaidLeaderboardScore(score)
      reportRaidRunComplete('victory')
    } else if (phaseRef.current === 'gameover') {
      submitRaidLeaderboardScore(score)
      reportRaidRunComplete('gameover')
    } else if (phaseRef.current === 'playing' || phaseRef.current === 'paused') {
      if (!coOpRunRef.current && score > highScoreRef.current) {
        highScoreRef.current = score
        saveHighScore(score)
      }
      submitRaidLeaderboardScore(score)
      reportRaidRunComplete('exit')
    }
    onClose()
  }, [onClose, reportRaidRunComplete, submitRaidLeaderboardScore])

  const damagePlayer = useCallback((amount: number, targetPlayer = playerRef.current) => {
    const player = targetPlayer
    if (player.hp <= 0 || player.invuln > 0) return
    const scaledAmount = Math.max(1, Math.round(amount * enemyDamageMultRef.current))
    if (player.forceField > 0) {
      player.forceField = Math.max(0, player.forceField - scaledAmount)
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
    player.hp -= scaledAmount
    player.invuln = 1.05
    spawnSparks(player.x, player.y, '#fca5a5', 22, 6)
    addRipple(player.x, player.y, '#ef4444', 10)
    playGameSound('hit')
    if (player.hp <= 0) {
      player.hp = 0
      playGameSound('destroyed_explosion')
      playGameSound('gameover')
      spawnSparks(player.x, player.y, '#fb7185', 62, 8)
      addRipple(player.x, player.y, '#fb7185', 18)
      const ally = player === playerRef.current ? remotePlayerRef.current : playerRef.current
      const allyAlive = Boolean(coOpRunRef.current && ally && ally.hp > 0)
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
      reportRaidRunComplete('gameover')
    }
  }, [addRipple, reportRaidRunComplete, spawnSparks, stopRaidBgm, submitRaidLeaderboardScore])

  const destroyPlayerByBossCollision = useCallback((targetPlayer: Player) => {
    const player = targetPlayer
    if (player.hp <= 0) return
    player.hp = 0
    player.forceField = 0
    player.shield = 0
    player.invuln = 2.2
    playGameSound('destroyed_explosion')
    playGameSound('gameover')
    spawnSparks(player.x, player.y, '#fb7185', 76, 9)
    addRipple(player.x, player.y, '#fb7185', 21)

    const ally = player === playerRef.current ? remotePlayerRef.current : playerRef.current
    const allyAlive = Boolean(coOpRunRef.current && ally && ally.hp > 0)
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
    reportRaidRunComplete('gameover')
  }, [addRipple, reportRaidRunComplete, spawnSparks, stopRaidBgm, submitRaidLeaderboardScore])

  const fireEnemy = useCallback((enemy: Enemy, player: Player, time = performance.now()) => {
    if (enemy.isBoss) {
      const kind = enemy.bossKind === 'final' && enemy.mirageKind && (enemy.mirageTimer ?? 0) > 0 ? enemy.mirageKind : enemy.bossKind ?? 'carrier'
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
            kind: 'squidSpine',
            radius: 2.25,
          })
        })
        ;[-15, 15].forEach((offset) => {
          const aimX = player.x - (enemy.x + offset)
          const aimY = player.y - enemy.y
          const mag = Math.sqrt((aimX) * (aimX) + (aimY) * (aimY)) || 1
          enemyShotsRef.current.push({ id: shotId++, x: enemy.x + offset, y: enemy.y + 2, vx: (aimX / mag) * 34, vy: (aimY / mag) * 34, damage: 1, kind: 'squidInk', radius: 1.9 })
        })
      }
      if (kind === 'snake') {
        const fangSpread = Math.sin(time / 260) * 7
        ;[-1, 0, 1].forEach((offset) => {
          const aimX = player.x + offset * 5 - enemy.x
          const aimY = player.y - enemy.y
          const mag = Math.sqrt((aimX) * (aimX) + (aimY) * (aimY)) || 1
          enemyShotsRef.current.push({ id: shotId++, x: enemy.x + offset * 4, y: enemy.y + 4, vx: (aimX / mag) * 42 + offset * fangSpread, vy: (aimY / mag) * 42, damage: 1, kind: 'snakeFang', radius: 1.55 })
        })
        ;[-18, 18].forEach((offset) => {
          enemyShotsRef.current.push({ id: shotId++, x: enemy.x + offset, y: enemy.y + 10, vx: -offset * 0.55, vy: 32, damage: 1, kind: 'venomSpit', radius: 1.65 })
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
          const mag = Math.sqrt((aimX) * (aimX) + (aimY) * (aimY)) || 1
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
      if (kind === 'devil') {
        enemy.devilNormalAttackTimer = 0.52
        ;[-16, 0, 16].forEach((offset, index) => {
          const aimX = player.x + (index - 1) * 3.5 - (enemy.x + offset)
          const aimY = player.y - (enemy.y + 8)
          const mag = Math.sqrt((aimX) * (aimX) + (aimY) * (aimY)) || 1
          enemyShotsRef.current.push({
            id: shotId++,
            x: enemy.x + offset,
            y: enemy.y + 10,
            vx: (aimX / mag) * 31 + offset * 0.08,
            vy: (aimY / mag) * 31 + 3,
            damage: 1,
            kind: index === 1 ? 'voidShot' : 'superShot',
            radius: index === 1 ? 2.05 : 1.65,
          })
        })
        if (Math.random() < 0.42) {
          enemyShotsRef.current.push({
            id: shotId++,
            x: clamp(player.x + (Math.random() - 0.5) * 16, 10, 90),
            y: enemy.y + 16,
            vx: Math.sin(time / 350) * 1.2,
            vy: 8.5,
            damage: 1,
            kind: 'poisonCloud',
            radius: 3.25,
            life: 3.2,
            maxLife: 3.2,
          })
        }
        playGameSound('rocket')
        return
      }
      if (kind === 'final') {
        playGameSound('laser')
        return
      }
      const aimX = player.x - enemy.x
      const aimY = player.y - enemy.y
      const mag = Math.sqrt((aimX) * (aimX) + (aimY) * (aimY)) || 1
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
          const mag = Math.sqrt((aimX) * (aimX) + (aimY) * (aimY)) || 1
          enemyShotsRef.current.push({ id: shotId++, x: enemy.x + offset, y: enemy.y + 8, vx: (aimX / mag) * 28, vy: (aimY / mag) * 28, damage: 1, kind: 'voidShot', radius: 1.55 })
        })
      } else if (kind === 'lancer') {
        const aimX = player.x - enemy.x
        const aimY = player.y - enemy.y
        const mag = Math.sqrt((aimX) * (aimX) + (aimY) * (aimY)) || 1
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
      const mag = Math.sqrt((aimX) * (aimX) + (aimY) * (aimY)) || 1
      enemyShotsRef.current.push({ id: shotId++, x: enemy.x, y: enemy.y + 2, vx: (aimX / mag) * 29, vy: (aimY / mag) * 29, damage: 1, kind: 'enemy', radius: 1.25 })
    }
  }, [])

  const updateGame = useCallback((dt: number) => {
    if (phaseRef.current !== 'playing') return

    const player = playerRef.current
    const scoreMult = scoreMultRef.current
    player.specialCooldown = Math.max(0, (player.specialCooldown ?? 0) - dt)
    const remotePlayerForCooldown = remotePlayerRef.current
    if (remotePlayerForCooldown) {
      remotePlayerForCooldown.specialCooldown = Math.max(0, (remotePlayerForCooldown.specialCooldown ?? 0) - dt)
    }
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
    if (godBarrageRef.current) {
      const barrage = godBarrageRef.current
      barrage.age = Math.min(barrage.duration, barrage.age + dt)
      if (barrage.age >= barrage.duration) {
        godBarrageRef.current = null
        if (isGodGundamBarragePilot(player, progressRef.current)) {
          player.x = clamp(barrage.startX, 8, 92)
          player.y = Math.min(player.y, 82)
          player.invuln = Math.max(player.invuln, 0.6)
        }
        const remotePlayer = remotePlayerRef.current
        if (remotePlayer && isGodGundamBarragePilot(remotePlayer, progressRef.current)) {
          remotePlayer.y = Math.min(remotePlayer.y, 84)
          remotePlayer.invuln = Math.max(remotePlayer.invuln, 0.6)
        }
      }
    }
    if (godMeleeStrikesRef.current.length > 0) {
      for (const strike of godMeleeStrikesRef.current) strike.age += dt
      compactInPlace(godMeleeStrikesRef.current, (strike) => strike.age < strike.duration)
    }
    if (bossDefeatExplosionEventsRef.current.length > 0) {
      let write = 0
      for (const event of bossDefeatExplosionEventsRef.current) {
        event.age += dt
        if (event.age < event.delay) {
          bossDefeatExplosionEventsRef.current[write] = event
          write += 1
          continue
        }
        const boss = event.boss
        const spreadX = boss.bossKind === 'devil' || boss.bossKind === 'final' || boss.bossKind === 'squid' ? 26 : boss.bossKind === 'snake' ? 18 : 16
        const spreadY = boss.bossKind === 'devil' || boss.bossKind === 'final' || boss.bossKind === 'squid' ? 28 : boss.bossKind === 'snake' ? 18 : 16
        const color = event.index % 2 === 0 ? '#fda4af' : '#fbbf24'
        spawnSparks(boss.x + (Math.random() - 0.5) * spreadX, boss.y + 10 + (Math.random() - 0.5) * spreadY, color, 52, 9)
        addRipple(boss.x + (Math.random() - 0.5) * spreadX * 0.5, boss.y + 10 + (Math.random() - 0.5) * spreadY * 0.5, event.index % 2 === 0 ? '#fb7185' : '#fbbf24', 15 + event.index * 1.2)
        playGameSound('destroyed_explosion')
        if (event.index === 0 || event.index === 4 || event.index === 9) triggerScreenShake(1.6, 180)
      }
      bossDefeatExplosionEventsRef.current.length = write
    }
    if (stageClearRef.current > 0) {
      const before = stageClearRef.current
      stageClearRef.current = Math.max(0, stageClearRef.current - dt)
      const remotePlayer = remotePlayerRef.current
      const devilAssistPlayer = devilAssistPlayerRef.current
      pointerTargetRef.current = null
      pointerVisualRef.current = null
      asteroidWarningRef.current = 0
      asteroidSpawnDelayRef.current = 0
      randomEventRef.current = null
      randomEventSpawnTimerRef.current = 0
      animateStageClearPlayer(player, dt, 50)
      if (remotePlayer) {
        animateStageClearPlayer(remotePlayer, dt, 58)
      }
      if (devilAssistPlayer) {
        animateStageClearPlayer(devilAssistPlayer, dt, devilAssistPlayer.x < 50 ? 38 : 62)
      }
      updateSparksInPlace(sparksRef.current, dt)
      updateRipplesInPlace(ripplesRef.current, dt)
      for (const enemy of enemiesRef.current) {
        if (enemy.isBoss && enemy.hp <= 0) {
          enemy.defeatTimer = Math.max(0, (enemy.defeatTimer ?? enemy.devilDefeatedTimer ?? STAGE_CLEAR_SECONDS) - dt)
          if (enemy.bossKind === 'devil') enemy.devilDefeatedTimer = enemy.defeatTimer
        }
      }
      if (before > 0 && stageClearRef.current <= 0) {
        if (victoryPendingRef.current) {
          // Victory transition: fly-forward done - fade to black then show cutscene
          victoryPendingRef.current = false
          phaseRef.current = 'victory'
          victoryBlackoutRef.current = VICTORY_BLACKOUT_SECONDS
          startRaidBgm(MAX_RAID_STAGE, 'ending')
          reportRaidRunComplete('victory')
          return
        }
        const pendingNextStage = pendingNextStageRef.current
        if (pendingNextStage !== null) {
          stageRef.current = pendingNextStage
          waveRef.current = pendingNextStage
          pendingNextStageRef.current = null
          if (pendingNextStage === NORMAL_RAID_DEVIL_BONUS_STAGE) {
            spawnDevilEncounterAssist('stageEntry')
          } else {
            devilAssistPlayerRef.current = null
            devilAssistMoveTargetRef.current = null
            devilAssistEntryRef.current = 0
          }
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
        godBarrageRef.current = null
        asteroidClusterTimerRef.current = raidModeRef.current === 'bossRush' ? 999 : getAsteroidClusterInterval()
        randomEventTimerRef.current = raidModeRef.current === 'bossRush' ? 999 : getRandomEventInterval()
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
        const nextDevilAssistPlayer = devilAssistPlayerRef.current
        if (nextDevilAssistPlayer) {
          nextDevilAssistPlayer.y = HEIGHT + 14
          nextDevilAssistPlayer.invuln = Math.max(nextDevilAssistPlayer.invuln, STAGE_ENTRY_SECONDS + 0.35)
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
      const devilAssistPlayer = devilAssistPlayerRef.current
      if (devilAssistPlayer) {
        const assistTargetX = devilAssistPlayer.visualShipKey === 'spiegel' ? 62 : 38
        devilAssistPlayer.x += (assistTargetX - devilAssistPlayer.x) * Math.min(1, dt * 6.4)
        devilAssistPlayer.y = HEIGHT + 14 + (84 - (HEIGHT + 14)) * easedEntry
        devilAssistPlayer.invuln = Math.max(devilAssistPlayer.invuln, 0.4)
        devilAssistPlayer.engineBoost = Math.max(devilAssistPlayer.engineBoost ?? 0, 1.1)
      }
      pointerTargetRef.current = null
      pointerVisualRef.current = null
      remotePointerTargetRef.current = null
      remotePointerVisualRef.current = null
      updateSparksInPlace(sparksRef.current, dt)
      updateRipplesInPlace(ripplesRef.current, dt)
      return
    }

    const playerInGodBarrage = Boolean(godBarrageRef.current && isGodGundamBarragePilot(player, progressRef.current))
    if (playerInGodBarrage) {
      player.y = HEIGHT + 18
      player.invuln = Math.max(player.invuln, 0.16)
      pointerTargetRef.current = null
      pointerVisualRef.current = null
    }
    if (player.hp > 0 && !playerInGodBarrage) {
      movePlayerWithInput(player, dt, pointerTargetRef.current, keysRef.current, getPlayerCoreLanderCombatModel(player, progressRef.current))
    }
    const remotePlayer = remotePlayerRef.current
    const remotePlayerInGodBarrage = Boolean(remotePlayer && godBarrageRef.current && isGodGundamBarragePilot(remotePlayer, progressRef.current))
    if (remotePlayerInGodBarrage && remotePlayer) {
      remotePlayer.y = HEIGHT + 18
      remotePlayer.invuln = Math.max(remotePlayer.invuln, 0.16)
      remotePointerTargetRef.current = null
      remotePointerVisualRef.current = null
    }
    if (remotePlayer && remotePlayer.hp > 0 && !remotePlayerInGodBarrage) {
      movePlayerWithInput(remotePlayer, dt, remotePointerTargetRef.current, remoteKeysRef.current, getPlayerCoreLanderCombatModel(remotePlayer, progressRef.current))
    }
    const devilAssistPlayer = devilAssistPlayerRef.current
    if (devilAssistPlayer && devilAssistPlayer.hp > 0) {
      const assistModel = getPlayerCoreLanderCombatModel(devilAssistPlayer, progressRef.current)
      if (devilAssistEntryRef.current > 0) {
        devilAssistEntryRef.current = Math.max(0, devilAssistEntryRef.current - dt)
        const entryProgress = 1 - devilAssistEntryRef.current / STAGE_ENTRY_SECONDS
        const easedEntry = 1 - Math.pow(1 - clamp(entryProgress, 0, 1), 3)
        const assistTargetX = devilAssistPlayer.visualShipKey === 'spiegel' ? 62 : 38
        devilAssistPlayer.x += (assistTargetX - devilAssistPlayer.x) * Math.min(1, dt * 5.2)
        devilAssistPlayer.y = HEIGHT + 14 + (84 - (HEIGHT + 14)) * easedEntry
        devilAssistPlayer.invuln = Math.max(devilAssistPlayer.invuln, 0.4)
        devilAssistPlayer.engineBoost = Math.max(devilAssistPlayer.engineBoost ?? 0, 1.12)
        devilAssistMoveTargetRef.current = { x: devilAssistPlayer.x, y: 84 }
      } else {
        const devilBoss = enemiesRef.current.find((enemy) => enemy.isBoss && enemy.bossKind === 'devil' && enemy.hp > 0) ?? null
        if (devilBoss) {
        const assistTime = performance.now() / 1000
        const exhausted = (devilAssistPlayer.godMeleeExhaust ?? 0) > 0
        const sideBias = assistModel === 'spiegel' ? 1 : -1
        const meleeRange = getGodGundamMeleeRange(devilAssistPlayer, assistModel)
        const meleeStandOff = clamp(meleeRange + devilBoss.radius - 9, 28, 39)
        const rangedStandOff = clamp(meleeRange + devilBoss.radius + 17, 48, 64)
        let desiredX = clamp(
          devilBoss.x +
            sideBias * (15 + Math.sin(assistTime * 0.72 + devilBoss.id) * 3.5) +
            Math.sin(assistTime * 0.48 + devilBoss.phase) * 8,
          12,
          88,
        )
        let desiredY = devilBoss.y > 0
          ? clamp(devilBoss.y + (exhausted ? rangedStandOff : meleeStandOff) + Math.cos(assistTime * 0.62) * 2.8, exhausted ? 62 : 48, exhausted ? 86 : 72)
          : 84
        let dodgeUrgency = 0
        if ((devilBoss.chargeTimer ?? 0) > 0) {
          const lanes: number[] = []
          forEachDevilBossBeamLane(devilBoss.chargeLane ?? 50, devilBoss.chargePattern ?? 'single', (lane) => lanes.push(lane))
          for (const lane of lanes) {
            if (Math.abs(desiredX - lane) < 11 || Math.abs(devilAssistPlayer.x - lane) < 12) {
              desiredX = clamp(lane + (devilAssistPlayer.x <= lane ? -17 : 17), 10, 90)
              desiredY = Math.max(desiredY, 62)
              dodgeUrgency = Math.max(dodgeUrgency, 1)
            }
          }
        }
        for (const shot of enemyShotsRef.current) {
          if ((shot.life ?? 1) <= 0) continue
          const dangerRadius = shot.kind === 'beam' ? 18 : shot.kind === 'devilSnakeHead' ? 15 : 10
          const dx = devilAssistPlayer.x - shot.x
          const dy = devilAssistPlayer.y - shot.y
          const dangerSq = dangerRadius * dangerRadius
          if (dx * dx + dy * dy > dangerSq) continue
          const mag = Math.hypot(dx, dy) || 1
          desiredX = clamp(desiredX + (dx / mag) * (shot.kind === 'beam' ? 18 : 11), 9, 91)
          desiredY = clamp(desiredY + (dy / mag) * 8, 34, 88)
          dodgeUrgency = Math.max(dodgeUrgency, shot.kind === 'beam' ? 1 : 0.7)
        }
        const moveTarget = devilAssistMoveTargetRef.current ?? { x: devilAssistPlayer.x, y: devilAssistPlayer.y }
        const targetEase = Math.min(1, dt * (dodgeUrgency > 0 ? 3.7 : 1.55))
        moveTarget.x += (desiredX - moveTarget.x) * targetEase
        moveTarget.y += (desiredY - moveTarget.y) * targetEase
        devilAssistMoveTargetRef.current = moveTarget
        const leadX = moveTarget.x - devilAssistPlayer.x
        const leadY = moveTarget.y - devilAssistPlayer.y
        const leadDistance = Math.hypot(leadX, leadY)
        const maxLead = dodgeUrgency > 0 ? 8.5 : exhausted ? 5.8 : 5.2
        const pointerTarget = leadDistance > maxLead
          ? { x: devilAssistPlayer.x + (leadX / leadDistance) * maxLead, y: devilAssistPlayer.y + (leadY / leadDistance) * maxLead }
          : moveTarget
        movePlayerWithInput(devilAssistPlayer, dt, pointerTarget, DEVIL_ASSIST_KEYS, assistModel)
        } else if (stageRef.current === NORMAL_RAID_DEVIL_BONUS_STAGE && stageClearRef.current <= 0) {
        const idleTarget = devilAssistMoveTargetRef.current ?? { x: devilAssistPlayer.x, y: devilAssistPlayer.y }
        idleTarget.x += ((devilAssistPlayer.visualShipKey === 'spiegel' ? 62 : 38) - idleTarget.x) * Math.min(1, dt * 1.8)
        idleTarget.y += (84 - idleTarget.y) * Math.min(1, dt * 1.8)
        devilAssistMoveTargetRef.current = idleTarget
        movePlayerWithInput(devilAssistPlayer, dt, idleTarget, DEVIL_ASSIST_KEYS, assistModel)
        }
      }
    }

    const isSmallViewport = Boolean(viewportMetricsRef.current && viewportMetricsRef.current.cssWidth < 640)
    if (player.hp > 0 && !playerInGodBarrage) updatePlayerTimers(player, dt, enemiesRef.current, isSmallViewport)
    if (remotePlayer && remotePlayer.hp > 0 && !remotePlayerInGodBarrage) updatePlayerTimers(remotePlayer, dt, enemiesRef.current, isSmallViewport)
    if (devilAssistPlayer && devilAssistPlayer.hp > 0) updatePlayerTimers(devilAssistPlayer, dt, enemiesRef.current, isSmallViewport)
    if (isGodGundamBarragePilot(player, progressRef.current)) clearPickupLoadout(player)
    if (remotePlayer && isGodGundamBarragePilot(remotePlayer, progressRef.current)) clearPickupLoadout(remotePlayer)
    if (devilAssistPlayer && isGodGundamBarragePilot(devilAssistPlayer, progressRef.current)) clearPickupLoadout(devilAssistPlayer)
    if (player.hp > 0 && !playerInGodBarrage) firePlayer(player)
    if (remotePlayer && remotePlayer.hp > 0 && !remotePlayerInGodBarrage) firePlayer(remotePlayer)
    if (devilAssistPlayer && devilAssistPlayer.hp > 0 && devilAssistEntryRef.current <= 0 && (devilAssistPlayer.godMeleeCloak ?? 0) <= 0) firePlayer(devilAssistPlayer)
    const livingPlayersThisTick = remotePlayer
      ? (player.hp > 0 ? (remotePlayer.hp > 0 ? [player, remotePlayer] : [player]) : remotePlayer.hp > 0 ? [remotePlayer] : [])
      : (player.hp > 0 ? [player] : [])
    const getNearestLivingPlayerThisTick = (origin: Vec) => {
      let nearest: Player | null = null
      let nearestDistance = Infinity
      for (const livingPlayer of livingPlayersThisTick) {
        if (livingPlayer.hp <= 0) continue
        const distance = distSq(origin, livingPlayer)
        if (distance < nearestDistance) {
          nearest = livingPlayer
          nearestDistance = distance
        }
      }
      return nearest ?? player
    }

    if (remotePlayer && multiplayerRemoteNukeRef.current > multiplayerHandledRemoteNukeRef.current) {
      multiplayerHandledRemoteNukeRef.current = multiplayerRemoteNukeRef.current
      activateNuke(remotePlayer)
    }

    spawnLockRef.current = Math.max(0, spawnLockRef.current - dt)
    const canSpawnStageEnemies = raidModeRef.current !== 'bossRush' && spawnLockRef.current <= 0 && stageClearRef.current <= 0
    spawnTimerRef.current -= dt
    formationTimerRef.current -= dt
    let bossActive = enemiesRef.current.some((enemy) => enemy.isBoss)
    if (!bossActive) {
      bossTimerRef.current = Math.max(0, bossTimerRef.current - dt)
    }
    const activeBossForBgm = bossActive ? enemiesRef.current.find((enemy) => enemy.isBoss) ?? null : null
    const desiredBgmMode: RaidBgmMode | null = bossActive
      ? 'boss'
      : bossTimerRef.current <= RAID_BOSS_APPROACH_SILENCE_SECONDS
        ? null
        : enemiesRef.current.length > 0 ? 'combat' : 'cruise'
    if (!getGameSoundEnabled()) {
      if (raidBgmElementRef.current) stopRaidBgm()
    } else if (desiredBgmMode === null) {
      if (raidBgmElementRef.current) stopRaidBgm()
    } else if (raidBgmModeRef.current !== desiredBgmMode || raidBgmStageRef.current !== stageRef.current || raidBgmBossKindRef.current !== (activeBossForBgm?.bossKind ?? null)) {
      startRaidBgm(stageRef.current, desiredBgmMode, activeBossForBgm?.bossKind ?? null)
    }
    powerDropCooldownRef.current = Math.max(0, powerDropCooldownRef.current - dt)
    const finalBoss = enemiesRef.current.find((enemy) => enemy.isBoss && enemy.bossKind === 'final' && enemy.hp > 0)
    if (finalBoss && finalBoss.y > 0 && stageClearRef.current <= 0) {
      finalBossSupportDropTimerRef.current = Math.max(0, finalBossSupportDropTimerRef.current - dt)
      if (finalBossSupportDropTimerRef.current <= 0) {
        let activeSupportDrops = 0
        for (const powerUp of powerUpsRef.current) {
          if (powerUp.type === 'repair' || powerUp.type === 'forcefield') activeSupportDrops += 1
          if (activeSupportDrops >= 2) break
        }
        if (activeSupportDrops < 1) {
          const hurtPlayer = player.hp < player.maxHp || (remotePlayerRef.current?.hp ?? 999) < (remotePlayerRef.current?.maxHp ?? 0)
          const dropChance = hurtPlayer ? 0.18 : 0.07
          if (Math.random() < dropChance) {
            const type: PowerKind = hurtPlayer && Math.random() < 0.62 ? 'repair' : 'forcefield'
            powerUpsRef.current.push({ id: powerId++, type, x: 12 + Math.random() * 76, y: -6, vy: 8.4, radius: type === 'forcefield' ? 3.4 : 3.1, spin: Math.random() * 360 })
          }
        }
        finalBossSupportDropTimerRef.current = 18 + Math.random() * 16
      }
    } else {
      finalBossSupportDropTimerRef.current = Math.min(finalBossSupportDropTimerRef.current, 18 + Math.random() * 12)
    }
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
          const spawnCount = Math.min(MAX_METEORS - meteorsRef.current.length, stageRef.current >= 9 ? 2 : 1)
          for (let index = 0; index < spawnCount; index += 1) {
            const x = 8 + Math.random() * 84
            meteorsRef.current.push({
              id: meteorId++,
              x,
              y: -10 - index * 7,
              vx: (Math.random() - 0.5) * 13,
              vy: 36 + Math.random() * 18 + stageRef.current * 0.35,
              radius: 1.15 + Math.random() * 1.05,
              life: 6.8,
              phase: Math.random() * Math.PI * 2,
            })
          }
          randomEventSpawnTimerRef.current = 0.58 + Math.random() * 0.18
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
          const variant = Math.floor(Math.random() * RAID_DERELICT_WRECK_VARIANTS.length)
          const variantData = getDerelictWreckVariantData(variant)
          const scale = 0.92 + Math.random() * 0.22
          wrecksRef.current.push({
            id: wreckId++,
            x: leftEntry ? 18 + Math.random() * 8 : 82 - Math.random() * 8,
            y: 26 + Math.random() * 24,
            vx: leftEntry ? 1.3 + Math.random() * 1.2 : -1.3 - Math.random() * 1.2,
            vy: -0.5 + Math.random() * 1.2,
            width: variantData.width * scale,
            height: variantData.height * scale,
            hp,
            maxHp: hp,
            phase: Math.random() * Math.PI * 2,
            variant,
            rotation: variantData.rotation + (leftEntry ? 0 : Math.PI) + (Math.random() - 0.5) * 7 * DEG,
          })
          randomEventSpawnTimerRef.current = 999
        } else if (activeRandomEvent.kind === 'ambush' && randomEventSpawnTimerRef.current <= 0) {
          const eliteCap = getMaxActiveEliteEnemies(stageRef.current, isCoOpActive())
          let activeEliteCount = 0
          for (const enemy of enemiesRef.current) {
            if (enemy.isMiniBoss) activeEliteCount += 1
            if (activeEliteCount >= eliteCap) break
          }
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
          const rift = getRiftCenter(activeRandomEvent)
          const pull = dt * 7.5
          for (const shot of enemyShotsRef.current) {
            shot.vx += clamp(rift.x - shot.x, -18, 18) * pull * 0.06
            shot.vy += clamp(rift.y - shot.y, -14, 14) * pull * 0.018
          }
          for (const shot of shotsRef.current) {
            shot.vx += clamp(rift.x - shot.x, -18, 18) * pull * 0.025
            shot.vy += clamp(rift.y - shot.y, -14, 14) * pull * 0.01
          }
          for (const powerUp of powerUpsRef.current) {
            powerUp.x += clamp(rift.x - powerUp.x, -12, 12) * dt * 0.42
            powerUp.y += clamp(rift.y - powerUp.y, -10, 10) * dt * 0.15
          }
          for (const asteroid of asteroidsRef.current) {
            asteroid.vx += clamp(rift.x - asteroid.x, -18, 18) * pull * 0.018
            asteroid.vy += clamp(rift.y - asteroid.y, -14, 14) * pull * 0.007
          }
          applyRiftPullToPlayer(player, activeRandomEvent, dt)
          if (remotePlayer) applyRiftPullToPlayer(remotePlayer, activeRandomEvent, dt)
        }
      }

      if (activeRandomEvent.age >= activeRandomEvent.duration) {
        randomEventRef.current = null
        randomEventSpawnTimerRef.current = 0
        randomEventTimerRef.current = getRandomEventInterval()
      }
    } else if (canSpawnStageEnemies && !bossActive && (stageRef.current >= 2 || shouldForceLocalDerelictWreckTest(stageRef.current, raidModeRef.current)) && !anyAsteroidEventActive) {
      randomEventTimerRef.current = Math.max(0, randomEventTimerRef.current - dt)
      if (randomEventTimerRef.current <= 0) {
        const forceLocalDerelictWreck = shouldForceLocalDerelictWreckTest(stageRef.current, raidModeRef.current) && !localDerelictWreckTestTriggeredRef.current
        if (forceLocalDerelictWreck) localDerelictWreckTestTriggeredRef.current = true
        startRandomRaidEvent(forceLocalDerelictWreck ? 'wreck' : pickNextRandomRaidEventKind(stageRef.current, stageRef.current % 2 === 0, lastRandomEventKindRef.current))
      }
    }

    const now = performance.now()
    const nowSeconds = now / 1000
    const asteroidDriftTime = now / 900

    let hasHomingShot = false
    for (const shot of shotsRef.current) {
      if (shot.kind === 'homing') {
        hasHomingShot = true
        break
      }
    }
    let homingTargets: Map<number, Enemy> | null = null
    if (hasHomingShot) {
      homingTargets = homingTargetsRef.current
      homingTargets.clear()
      for (const enemy of enemiesRef.current) {
        if (enemy.hp > 0 && enemy.y >= -10) homingTargets.set(enemy.id, enemy)
      }
    }

    const shots = shotsRef.current
    let liveShotCount = 0
    for (const shot of shots) {
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
          const mag = Math.sqrt((aimX) * (aimX) + (aimY) * (aimY)) || 1
          const speed = Math.max(62, Math.sqrt((shot.vx) * (shot.vx) + (shot.vy) * (shot.vy)))
          const turn = Math.min(1, (shot.turn ?? 8) * dt)
          shot.vx += ((aimX / mag) * speed - shot.vx) * turn
          shot.vy += ((aimY / mag) * speed - shot.vy) * turn
        }
      }
      if (shot.kind === 'beam' && shot.angle !== undefined && shot.spin) {
        shot.angle += shot.spin * dt
      }
      shot.x += shot.vx * dt
      shot.y += shot.vy * dt
      if (shot.y > -10 && shot.y < HEIGHT + 10 && shot.x > -10 && shot.x < WIDTH + 10) {
        shots[liveShotCount] = shot
        liveShotCount += 1
      }
    }
    shots.length = liveShotCount

    const expiredSquidBubbles = expiredSquidBubblesRef.current
    expiredSquidBubbles.length = 0
    const enemyShots = enemyShotsRef.current
    let liveEnemyShotCount = 0
    for (const shot of enemyShots) {
      if (shot.life !== undefined) {
        shot.life = Math.max(0, shot.life - dt)
        if (shot.life <= 0) {
          if (shot.kind === 'squidBubble' && (shot.splitLevel ?? 0) < 5) expiredSquidBubbles.push({ ...shot })
          continue
        }
      }
      if (shot.kind === 'beam' && shot.angle !== undefined && shot.spin) {
        shot.angle += shot.spin * dt
      }
      if (shot.kind === 'squidBubble') {
        shot.retargetTime = Math.max(0, (shot.retargetTime ?? 0) - dt)
        const target = getNearestLivingPlayerThisTick(shot)
        const aimX = target.x - shot.x
        const aimY = target.y - shot.y
        const mag = Math.sqrt((aimX) * (aimX) + (aimY) * (aimY)) || 1
        const level = shot.splitLevel ?? 0
        const speed = 8.8 + level * 2.9
        const turn = Math.min(1, dt * (1.05 + level * 0.12))
        shot.vx += ((aimX / mag) * speed - shot.vx) * turn
        shot.vy += ((aimY / mag) * speed - shot.vy) * turn
      }
      shot.x += shot.vx * dt
      shot.y += shot.vy * dt
      const beamMargin = shot.kind === 'beam' && shot.life !== undefined ? 120 : shot.kind === 'poisonCloud' || shot.kind === 'squidBubble' ? 24 : 12
      if (shot.kind === 'poisonCloud') {
        shot.vx += Math.sin(nowSeconds * 1.4 + shot.id) * dt * 1.6
      }
      if (shot.y > -beamMargin && shot.y < HEIGHT + beamMargin && shot.x > -12 && shot.x < WIDTH + 12) {
        enemyShots[liveEnemyShotCount] = shot
        liveEnemyShotCount += 1
      }
    }
    enemyShots.length = liveEnemyShotCount

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
      meteor.vx += Math.sin(nowSeconds * 1.7 + meteor.phase) * dt * 1.7
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
      updateDerelictWreckMotion(wreck, dt, nowSeconds)
      if (wreck.hp > 0) {
        wrecks[liveWreckCount] = wreck
        liveWreckCount += 1
      }
    }
    wrecks.length = liveWreckCount

    const enemies = enemiesRef.current
    let liveEnemyCount = 0
    for (const enemy of enemies) {
      if (!enemy.isBoss && enemy.hp <= 0) {
        const defeatTimer = Math.max(0, (enemy.defeatTimer ?? 0) - dt)
        if (defeatTimer > 0) {
          enemy.defeatTimer = defeatTimer
          enemy.hitFlash = Math.max(enemy.hitFlash ?? 0, defeatTimer)
          enemies[liveEnemyCount] = enemy
          liveEnemyCount += 1
        }
        continue
      }
      const t = nowSeconds + enemy.phase
      const bossKind = enemy.bossKind ?? 'carrier'
      const bossRushAggressive = enemy.isBoss && raidModeRef.current === 'bossRush'
      const bossMotionT = bossRushAggressive ? nowSeconds * BOSS_RUSH_MOTION_SCALE + enemy.phase : t
      const bossFireDrain = bossRushAggressive ? BOSS_RUSH_SPECIAL_RECHARGE_SCALE : 1
      const bossAttackCooldownScale = bossRushAggressive ? BOSS_RUSH_ATTACK_COOLDOWN_SCALE : 1
      if (enemy.isBoss && enemy.hp > 0) playBossCriticalStinger(enemy)
      const finalRage = bossKind === 'final' ? clamp((0.55 - enemy.hp / Math.max(1, enemy.maxHp)) / 0.55, 0, 1) : 0
      const bossX =
        bossKind === 'devil' ? 50 :
          bossKind === 'carrier' ? 50 + Math.sin(bossMotionT * 0.7) * 26 :
            bossKind === 'orb' ? 50 + Math.sin(bossMotionT * 1.4) * 18 :
              bossKind === 'squid' ? 50 + Math.sin(bossMotionT * 0.58) * 23 + Math.sin(bossMotionT * 1.4) * 4 :
                bossKind === 'snake' ? 50 + Math.sin(bossMotionT * 1.05) * 34 + Math.sin(bossMotionT * 2.1) * 6 :
                  bossKind === 'serpent' ? 50 + Math.sin(bossMotionT * 0.9) * 32 :
                    bossKind === 'mantis' ? 50 + Math.sin(bossMotionT * 1.7) * 24 :
                      bossKind === 'hydra' ? 50 + Math.sin(bossMotionT * 0.62) * 26 + Math.sin(bossMotionT * 1.8) * 5 :
                        bossKind === 'gate' ? 50 + Math.sin(bossMotionT * 0.38) * 14 :
                          bossKind === 'final' ? 50 + Math.sin(bossMotionT * (0.26 + finalRage * 0.08)) * (24 + finalRage * 2.5) + Math.sin(bossMotionT * (0.92 + finalRage * 0.18)) * (3.5 + finalRage * 1.5) :
                            50 + Math.sin(bossMotionT * 0.42) * 30
      const bossYTarget =
        bossKind === 'devil' ? 21 + Math.sin(bossMotionT * 0.42) * 1.8 :
          bossKind === 'final' ? 17 + Math.sin(bossMotionT * (0.52 + finalRage * 0.16)) * (2.2 + finalRage * 0.9) :
            bossKind === 'squid' ? 18 + Math.sin(bossMotionT * 0.75) * 3 :
              bossKind === 'snake' ? 19 + Math.sin(bossMotionT * 1.3) * 4 :
                bossKind === 'super' ? 20 + Math.sin(bossMotionT * 0.8) * 3 :
                  bossKind === 'gate' ? 18 + Math.sin(bossMotionT * 0.65) * 2 :
                    bossKind === 'hydra' ? 19 + Math.cos(bossMotionT * 0.9) * 4 :
                      bossKind === 'mantis' ? 19 + Math.sin(bossMotionT * 1.4) * 5 :
                        bossKind === 'serpent' ? 20 + Math.cos(bossMotionT * 1.1) * 5 :
                          bossKind === 'orb' ? 17 + Math.sin(bossMotionT * 1.8) * 4 :
                            18
      const trainT = (enemy.y - enemy.trainSlot * 6.2) * enemy.pathSpeed + enemy.phase
      const trainX =
        enemy.pattern === 0 ? enemy.originX + Math.sin(trainT) * enemy.amplitude :
          enemy.pattern === 1 ? enemy.originX + Math.sin(trainT) * enemy.amplitude + Math.sin(trainT * 2.1) * 5 :
            enemy.pattern === 2 ? enemy.originX + Math.sin(trainT * 0.72) * enemy.amplitude * 0.7 :
              enemy.originX + Math.cos(trainT) * enemy.amplitude
      const miniKind = enemy.miniBossKind ?? 'stalker'
      const eliteTarget = enemy.isMiniBoss ? getNearestLivingPlayerThisTick(enemy) : player
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
      let chargeTargetY = enemy.chargeTargetY ?? enemy.y + 34
      let chargePattern = enemy.chargePattern
      let rapidCharge = enemy.rapidCharge ?? false
      let beamVolleyLeft = enemy.beamVolleyLeft ?? 0
      let beamVolleyRecovery = Math.max(0, (enemy.beamVolleyRecovery ?? 0) - dt * bossFireDrain)
      let devilNormalAttackTimer = Math.max(0, (enemy.devilNormalAttackTimer ?? 0) - dt)
      let devilSnakeBurstLeft = Math.max(0, enemy.devilSnakeBurstLeft ?? 0)
      let mirageKind = enemy.mirageKind ?? null
      let mirageTimer = Math.max(0, enemy.mirageTimer ?? 0)
      let mirageCooldown = Math.max(0, (enemy.mirageCooldown ?? 0) - dt * bossFireDrain)
      let fireCooldown = enemy.fireCooldown
      let mirageActive = enemy.isBoss && bossKind === 'final' && mirageKind !== null && mirageTimer > 0
      if (mirageActive) {
        mirageTimer = Math.max(0, mirageTimer - dt)
        if (mirageTimer <= 0) {
          mirageKind = null
          mirageActive = false
          mirageCooldown = 7.5 + Math.random() * 7.5
          chargeTimer = 0
          chargeCooldown = 1.15
          beamVolleyLeft = 0
          rapidCharge = false
          nukeFlashRef.current = Math.max(nukeFlashRef.current, 0.72)
          spawnSparks(enemy.x, enemy.y, '#38bdf8', 82, 11)
          addRipple(enemy.x, enemy.y, '#38bdf8', 38)
          playGameSound('countdown')
        }
      } else if (enemy.isBoss && bossKind === 'final' && mirageCooldown <= 0 && chargeTimer <= 0 && beamVolleyLeft <= 0 && Math.random() < 0.3) {
        mirageKind = Math.random() < 0.5 ? 'squid' : 'snake'
        mirageTimer = 10 + Math.random() * 2.75
        mirageCooldown = mirageTimer + 8 + Math.random() * 8
        mirageActive = true
        chargeTimer = 0
        chargeCooldown = 0.45
        beamVolleyLeft = 0
        rapidCharge = false
        nukeFlashRef.current = Math.max(nukeFlashRef.current, 0.78)
        spawnSparks(enemy.x, enemy.y, mirageKind === 'squid' ? '#f472b6' : '#22d3ee', 96, 12)
        addRipple(enemy.x, enemy.y, mirageKind === 'squid' ? '#f472b6' : '#22d3ee', 42)
        playGameSound('countdown')
      }
      const attackBossKind: BossKind | MirageBossKind = mirageActive && mirageKind ? mirageKind : bossKind
      if (enemy.isBoss && bossKind === 'devil' && enemy.y >= bossYTarget - 0.5) {
        if (chargeTimer > 0) {
          if (chargePattern === 'diagonal') {
            const target = getNearestLivingPlayerThisTick(enemy)
            chargeLane = clamp(target.x, 16, 84)
            chargeTargetY = clamp(target.y, 32, 88)
          }
          const beforeCharge = chargeTimer
          chargeTimer = Math.max(0, chargeTimer - dt)
          if (beforeCharge > 0 && chargeTimer <= 0) {
            const emitDevilBeam = (x: number, y: number, angle?: number, radius = 3.6, life = 1.08) => {
              enemyShotsRef.current.push({
                id: shotId++,
                x,
                y,
                vx: 0,
                vy: 0,
                damage: 1,
                kind: 'beam',
                radius,
                life,
                maxLife: life,
                angle,
              })
            }
            if (chargePattern === 'horizontal') {
              emitDevilBeam(50, chargeTargetY, 0, getDevilBossBeamRadius(chargePattern), 1.04)
              ;[-18, 18].forEach((offset) => {
                enemyShotsRef.current.push({ id: shotId++, x: chargeLane + offset, y: enemy.y + 18, vx: offset * 0.18, vy: 36, damage: 1, kind: 'blade', radius: 1.8 })
              })
              addRipple(50, chargeTargetY, '#ef4444', 25)
            } else if (chargePattern === 'cross') {
              for (const target of livingPlayersThisTick) {
                if (target.hp <= 0) continue
                if (Math.abs(target.x - chargeLane) < 10.5 && Math.abs(target.y - chargeTargetY) < 8.5) {
                  damagePlayer(2, target)
                  spawnSparks(target.x, target.y, '#f97316', 46, 9)
                  addRipple(target.x, target.y, '#ef4444', 18)
                }
              }
              for (let i = 0; i < 8; i += 1) {
                const angle = (i / 8) * Math.PI * 2
                enemyShotsRef.current.push({
                  id: shotId++,
                  x: chargeLane,
                  y: chargeTargetY,
                  vx: Math.cos(angle) * 22,
                  vy: Math.sin(angle) * 16 + 12,
                  damage: 1,
                  kind: i % 2 === 0 ? 'voidShot' : 'orbShot',
                  radius: 1.55,
                })
              }
              addRipple(chargeLane, chargeTargetY, '#ef4444', 21)
            } else if (chargePattern === 'rotate') {
              const baseAngle = enemy.phase + Math.PI / 4
              emitDevilBeam(50, 50, baseAngle, getDevilBossBeamRadius(chargePattern), 1.22)
              emitDevilBeam(50, 50, baseAngle + Math.PI / 2, getDevilBossBeamRadius(chargePattern), 1.22)
              addRipple(50, 50, '#ef4444', 28)
            } else if (chargePattern === 'diagonal') {
              const startX = enemy.x
              const startY = enemy.y + 10
              const aimX = chargeLane - startX
              const aimY = chargeTargetY - startY
              const mag = Math.sqrt((aimX) * (aimX) + (aimY) * (aimY)) || 1
              enemyShotsRef.current.push({
                id: shotId++,
                x: startX,
                y: startY,
                vx: (aimX / mag) * 50,
                vy: (aimY / mag) * 50,
                damage: 1,
                kind: 'devilSnakeHead',
                radius: 4.15,
                life: 2.35,
                maxLife: 2.35,
                angle: Math.atan2(aimY, aimX) + Math.PI / 2,
              })
              addRipple(chargeLane, chargeTargetY, '#bef264', 23)
            } else {
              forEachDevilBossBeamLane(chargeLane, chargePattern, (lane) => {
                emitDevilBeam(lane, 50, undefined, getDevilBossBeamRadius(chargePattern), 1.08)
                addRipple(lane, 50, '#ef4444', chargePattern === 'scatter' ? 14 : 19)
              })
            }
            spawnSparks(enemy.x, enemy.y + 12, '#ef4444', 68, 9)
            playGameSound('laser')
            triggerScreenShake(chargePattern === 'diagonal' ? 1.5 : 2.25, chargePattern === 'rotate' ? 300 : 220)
            if (chargePattern === 'diagonal') {
              devilSnakeBurstLeft = Math.max(0, devilSnakeBurstLeft - 1)
              if (devilSnakeBurstLeft <= 0 && beamVolleyLeft > 0) beamVolleyLeft = Math.max(0, beamVolleyLeft - 1)
            } else if (beamVolleyLeft > 0) beamVolleyLeft = Math.max(0, beamVolleyLeft - 1)
            const hpRatio = enemy.hp / Math.max(1, enemy.maxHp)
            chargeCooldown = chargePattern === 'diagonal' && devilSnakeBurstLeft > 0
              ? 0.18
              : beamVolleyLeft > 0
              ? (hpRatio <= 0.36 ? 0.92 : 1.08)
              : chargePattern === 'cross' ? 4.8 + Math.random() * 1.2 : chargePattern === 'rotate' ? 5.8 + Math.random() * 1.2 : 4.2 + Math.random() * 1.2
            beamVolleyRecovery = chargePattern === 'diagonal' && devilSnakeBurstLeft > 0 ? 0.32 : beamVolleyLeft > 0 ? 1.08 : 0.86
            fireCooldown = Math.max(fireCooldown, 1.45)
          }
        } else {
          chargeCooldown = Math.max(0, chargeCooldown - dt * bossFireDrain)
          if (chargeCooldown <= 0) {
            const target = getNearestLivingPlayerThisTick(enemy)
            const hpRatio = enemy.hp / Math.max(1, enemy.maxHp)
            const volleyActive = beamVolleyLeft > 0
            const roll = Math.random()
            if (devilSnakeBurstLeft > 0) {
              chargePattern = 'diagonal'
            } else {
              if (!volleyActive) {
                const volleyChance = hpRatio <= 0.36 ? 0.62 : hpRatio <= 0.62 ? 0.34 : hpRatio <= 0.78 ? 0.18 : 0.08
                if (Math.random() < volleyChance) beamVolleyLeft = hpRatio <= 0.36 ? 3 + Math.floor(Math.random() * 2) : hpRatio <= 0.62 ? 2 + Math.floor(Math.random() * 2) : 2
              }
              const skillVolleyActive = beamVolleyLeft > 0
              chargePattern = skillVolleyActive
                ? hpRatio <= 0.36
                  ? roll < 0.18 ? 'diagonal' : roll < 0.34 ? 'trident' : roll < 0.5 ? 'pincer' : roll < 0.66 ? 'horizontal' : roll < 0.8 ? 'scatter' : roll < 0.92 ? 'cross' : 'rotate'
                  : roll < 0.18 ? 'diagonal' : roll < 0.38 ? 'trident' : roll < 0.58 ? 'pincer' : roll < 0.74 ? 'horizontal' : roll < 0.9 ? 'scatter' : 'cross'
                : hpRatio < 0.36
                  ? roll < 0.16 ? 'diagonal' : roll < 0.34 ? 'horizontal' : roll < 0.54 ? 'trident' : roll < 0.74 ? 'cross' : roll < 0.88 ? 'rotate' : 'scatter'
                  : roll < 0.14 ? 'diagonal' : roll < 0.36 ? 'trident' : roll < 0.58 ? 'horizontal' : roll < 0.78 ? 'cross' : roll < 0.92 ? 'scatter' : 'rotate'
              if (chargePattern === 'diagonal') devilSnakeBurstLeft = hpRatio <= 0.36 ? 4 : 2 + Math.floor(Math.random() * 2)
            }
            const skillVolleyActive = beamVolleyLeft > 0
            chargeTimer = getDevilBossChargeDuration(chargePattern, skillVolleyActive)
            chargeLane = chargePattern === 'rotate' ? 50 : chargePattern === 'diagonal' ? clamp(target.x, 16, 84) : clamp(target.x + (Math.random() - 0.5) * (chargePattern === 'horizontal' || chargePattern === 'cross' ? 8 : 3), 16, 84)
            chargeTargetY = chargePattern === 'diagonal' ? clamp(target.y, 32, 88) : clamp(target.y + (Math.random() - 0.5) * 8, 28, 84)
            chargeCooldown = 999
            addRipple(chargePattern === 'rotate' ? 50 : chargeLane, chargePattern === 'rotate' ? 50 : chargeTargetY, skillVolleyActive ? '#f87171' : '#ef4444', chargePattern === 'rotate' ? 27 : skillVolleyActive ? 21 : 18)
            spawnSparks(enemy.x, enemy.y + 8, skillVolleyActive ? '#fca5a5' : '#fb7185', skillVolleyActive ? 58 : 44, 8)
            playGameSound('countdown')
          }
        }
      }
      if (enemy.isBoss && bossKind === 'final' && !mirageActive && enemy.y >= bossYTarget - 0.5) {
        if (chargeTimer > 0) {
          const beforeCharge = chargeTimer
          chargeTimer = Math.max(0, chargeTimer - dt)
          if (beforeCharge > 0 && chargeTimer <= 0) {
            const wasRapidCharge = rapidCharge
            rapidCharge = false
            const beamRadius = getFinalBossBeamRadius(chargePattern) * (wasRapidCharge ? 0.82 : 1)
            const emitFinalBeam = (x: number, y: number, angle?: number, spin?: number) => {
              enemyShotsRef.current.push({
                id: shotId++,
                x,
                y,
                vx: 0,
                vy: 0,
                damage: 2,
                kind: 'beam',
                radius: beamRadius,
                life: FINAL_BOSS_BEAM_LIFE_SECONDS,
                maxLife: FINAL_BOSS_BEAM_LIFE_SECONDS,
                angle,
                spin,
              })
            }
            if (chargePattern === 'horizontal') {
              emitFinalBeam(50, chargeLane, 0)
              addRipple(50, chargeLane, '#38bdf8', 22)
            } else if (chargePattern === 'diagonal') {
              emitFinalBeam(50, 50, chargeLane < 50 ? Math.PI / 4 : -Math.PI / 4)
              addRipple(50, 50, '#38bdf8', 24)
            } else if (chargePattern === 'cross') {
              const angle = chargeLane < 50 ? Math.PI / 4 : -Math.PI / 4
              emitFinalBeam(50, 50, angle)
              emitFinalBeam(50, 50, angle + Math.PI / 2)
              addRipple(50, 50, '#38bdf8', 28)
            } else if (chargePattern === 'rotate') {
              const angle = enemy.phase + Math.PI / 4
              emitFinalBeam(50, 50, angle, 0.46)
              emitFinalBeam(50, 50, angle + Math.PI / 2, 0.46)
              addRipple(50, 50, '#38bdf8', 32)
            } else {
              forEachFinalBossBeamLane(chargeLane, chargePattern, (lane) => {
                emitFinalBeam(lane, 50)
                addRipple(lane, 50, '#38bdf8', chargePattern === 'scatter' ? 14 : 22)
              })
            }
            spawnSparks(enemy.x, enemy.y + 8, '#38bdf8', 84, 9)
            playGameSound('laser')
            if (wasRapidCharge && beamVolleyLeft > 0) {
              beamVolleyLeft -= 1
              chargeCooldown = 0.42 + Math.random() * 0.28
              fireCooldown = Math.max(fireCooldown, 2.15)
            } else {
              chargeCooldown = wasRapidCharge
                ? chargePattern === 'rotate' ? 2.6 + Math.random() * 0.7 :
                  chargePattern === 'cross' ? 2.4 + Math.random() * 0.65 :
                    chargePattern === 'horizontal' || chargePattern === 'diagonal' ? 2.05 + Math.random() * 0.55 :
                      chargePattern === 'scatter' || chargePattern === 'trident' ? 2.25 + Math.random() * 0.65 :
                        1.8 + Math.random() * 0.5
                : chargePattern === 'rotate' ? 3.45 + Math.random() * 0.9 :
                  chargePattern === 'cross' ? 3.25 + Math.random() * 0.8 :
                    chargePattern === 'horizontal' || chargePattern === 'diagonal' ? 2.95 + Math.random() * 0.8 :
                      chargePattern === 'scatter' ? 3.45 + Math.random() * 1.1 :
                        chargePattern === 'trident' ? 3.05 + Math.random() * 1 :
                          chargePattern === 'pincer' ? 2.85 + Math.random() * 0.9 :
                            2.45 + Math.random() * 0.85
              if (wasRapidCharge) beamVolleyRecovery = 4.4 + Math.random() * 1.1
              fireCooldown = Math.max(fireCooldown, wasRapidCharge ? 3.15 : chargePattern === 'rotate' || chargePattern === 'cross' ? 5.4 : 4.8)
            }
          }
        } else {
          chargeCooldown = Math.max(0, chargeCooldown - dt * bossFireDrain)
          if (chargeCooldown <= 0) {
            const hpRatio = enemy.hp / enemy.maxHp
            const roll = Math.random()
            const volleyChance = hpRatio < 0.36 ? 0.45 : hpRatio < 0.72 ? 0.28 : 0.18
            if (beamVolleyRecovery <= 0 && beamVolleyLeft <= 0 && Math.random() < volleyChance) {
              beamVolleyLeft = 2 + Math.floor(Math.random() * (hpRatio < 0.36 ? 3 : 2))
            }
            rapidCharge = beamVolleyLeft > 0 || Math.random() < (hpRatio < 0.36 ? 0.42 : hpRatio < 0.72 ? 0.28 : 0.16)
            chargeTimer = rapidCharge ? FINAL_BOSS_BEAM_CHARGE_SECONDS * (beamVolleyLeft > 0 ? 0.34 + Math.random() * 0.1 : 0.5 + Math.random() * 0.14) : FINAL_BOSS_BEAM_CHARGE_SECONDS
            chargePattern = beamVolleyLeft > 0
              ? roll < 0.16 ? 'single' : roll < 0.32 ? 'pincer' : roll < 0.52 ? 'diagonal' : roll < 0.68 ? 'horizontal' : roll < 0.84 ? 'trident' : roll < 0.93 ? 'cross' : 'rotate'
              : hpRatio < 0.34
                ? roll < 0.1 ? 'single' : roll < 0.2 ? 'pincer' : roll < 0.31 ? 'trident' : roll < 0.43 ? 'scatter' : roll < 0.56 ? 'diagonal' : roll < 0.68 ? 'horizontal' : roll < 0.82 ? 'cross' : 'rotate'
                : hpRatio < 0.68
                  ? roll < 0.2 ? 'single' : roll < 0.38 ? 'pincer' : roll < 0.55 ? 'trident' : roll < 0.68 ? 'diagonal' : roll < 0.8 ? 'horizontal' : roll < 0.92 ? 'cross' : 'rotate'
                  : roll < 0.34 ? 'single' : roll < 0.58 ? 'pincer' : roll < 0.76 ? 'trident' : roll < 0.87 ? 'diagonal' : roll < 0.96 ? 'horizontal' : 'rotate'
            chargeLane =
              chargePattern === 'horizontal'
                ? clamp(player.y + (Math.random() - 0.5) * 14, 27, 86)
                : chargePattern === 'diagonal' || chargePattern === 'cross'
                  ? (Math.random() < 0.5 ? 35 : 65)
                  : chargePattern === 'rotate'
                    ? 50
                    : chargePattern === 'scatter'
                      ? clamp(player.x + (Math.random() - 0.5) * 20, 31, 69)
                      : chargePattern === 'trident'
                        ? clamp(player.x + (Math.random() - 0.5) * 18, 23, 77)
                        : chargePattern === 'pincer'
                          ? clamp(player.x + (Math.random() - 0.5) * 22, 28, 72)
                          : clamp(player.x + (Math.random() - 0.5) * 12, 10, 90)
            chargeCooldown = 999
            const laneCount = getFinalBossBeamLaneCount(chargePattern)
            addRipple(chargeLane, 84, '#38bdf8', laneCount >= 4 ? 16 : laneCount === 3 ? 18 : laneCount === 2 ? 20 : 24)
            spawnSparks(enemy.x, enemy.y + 6, '#38bdf8', 52, 8)
            playGameSound('countdown')
          }
        }
      }
      const squidSpecialReady = enemy.y >= Math.min(bossYTarget - 0.5, 16.5)
      if (enemy.isBoss && attackBossKind === 'squid' && squidSpecialReady) {
        if (chargeTimer > 0) {
          const beforeCharge = chargeTimer
          chargeTimer = Math.max(0, chargeTimer - dt)
          if (beforeCharge > 0 && chargeTimer <= 0) {
            if (chargePattern === 'rotate') {
              const target = getNearestLivingPlayerThisTick(enemy)
              const aimX = target.x - enemy.x
              const aimY = target.y - (enemy.y + 14)
              const mag = Math.sqrt((aimX) * (aimX) + (aimY) * (aimY)) || 1
              enemyShotsRef.current.push({
                id: shotId++,
                x: enemy.x,
                y: enemy.y + 14,
                vx: (aimX / mag) * 7.2,
                vy: (aimY / mag) * 7.2,
                damage: 2,
                kind: 'squidBubble',
                radius: 13.2,
                hp: Math.round(320 + stageRef.current * 22 + getPowerScore(playerRef.current) * 12 + (remotePlayerRef.current ? getPowerScore(remotePlayerRef.current) * 6 : 0)),
                splitLevel: 0,
                life: 22,
                maxLife: 22,
              })
              spawnSparks(enemy.x, enemy.y + 10, '#f0abfc', 42, 8)
              addRipple(enemy.x, enemy.y + 14, '#f472b6', 22)
              playGameSound('laser')
              chargeCooldown = 3.65 + Math.random() * 1.05
              fireCooldown = Math.max(fireCooldown, 1.25)
            } else {
              for (const target of livingPlayersThisTick) {
                if (target.hp <= 0) continue
                const inStrikeSpot =
                  Math.abs(target.x - chargeLane) < 8.5 &&
                  Math.abs(target.y - chargeTargetY) < 7.5
                if (inStrikeSpot) {
                  damagePlayer(2, target)
                  spawnSparks(target.x, target.y, '#fb7185', 34, 8)
                  addRipple(target.x, target.y, '#fb7185', 16)
                }
              }
              spawnSparks(chargeLane, chargeTargetY, '#f472b6', 44, 8)
              addRipple(chargeLane, chargeTargetY, '#f472b6', 18)
              playGameSound('hit')
              chargeCooldown = 2.2 + Math.random() * 1.05
              fireCooldown = Math.max(fireCooldown, 1.05)
            }
          }
        } else {
          chargeCooldown = Math.max(0, chargeCooldown - dt * bossFireDrain)
          let slapTarget: Player | null = null
          let slapTargetDistance = Infinity
          for (const target of livingPlayersThisTick) {
            if (target.hp <= 0) continue
            const distance = distSq(enemy, target)
            if (distance < slapTargetDistance) {
              slapTarget = target
              slapTargetDistance = distance
            }
          }
          const bubbleTarget = slapTarget ?? getNearestLivingPlayerThisTick(enemy)
          const squidSpecialStep = bossKind === 'squid' ? Math.max(0, Math.floor(beamVolleyLeft ?? 0)) : 0
          const forceStageSquidBubble = bossKind === 'squid' && squidSpecialStep % 4 === 0
          const shouldBubble = chargeCooldown <= 0 && (forceStageSquidBubble || Math.random() < 0.38)
          if (shouldBubble) {
            chargeTimer = 0.78
            chargePattern = 'rotate'
            chargeLane = clamp(bubbleTarget.x, 8, 92)
            chargeTargetY = clamp(bubbleTarget.y, 12, 92)
            chargeCooldown = 999
            if (bossKind === 'squid') beamVolleyLeft = squidSpecialStep + 1
            addRipple(enemy.x, enemy.y + 14, '#f472b6', 18)
            spawnSparks(enemy.x, enemy.y + 7, '#f0abfc', 34, 7)
            playGameSound('countdown')
          } else if (slapTarget && chargeCooldown <= 0) {
            chargeTimer = 0.9
            chargePattern = 'single'
            chargeLane = clamp(slapTarget.x, 8, 92)
            chargeTargetY = clamp(slapTarget.y, 14, 92)
            chargeCooldown = 999
            if (bossKind === 'squid') beamVolleyLeft = squidSpecialStep + 1
            addRipple(chargeLane, chargeTargetY, '#f472b6', 18)
            spawnSparks(enemy.x, enemy.y + 10, '#a855f7', 28, 7)
            playGameSound('countdown')
          }
        }
      }
      if (enemy.isBoss && attackBossKind === 'snake' && enemy.y >= bossYTarget - 0.5) {
        if (chargeTimer > 0) {
          const beforeCharge = chargeTimer
          chargeTimer = Math.max(0, chargeTimer - dt)
          if (beforeCharge > 0 && chargeTimer <= 0) {
            const lane = clamp(chargeLane, 14, 86)
            const targetY = clamp(chargeTargetY, 24, 86)
            const emitPoisonCloud = (x: number, y: number, radius: number, vx: number, vy: number, life: number) => {
              enemyShotsRef.current.push({
                id: shotId++,
                x: clamp(x, 7, 93),
                y,
                vx,
                vy,
                damage: 1,
                kind: 'poisonCloud',
                radius,
                life,
                maxLife: life,
              })
            }
            if (chargePattern === 'horizontal') {
              for (let column = 0; column < 9; column += 1) {
                const x = 12 + column * 9.5
                const wave = Math.sin(column * 1.35 + nowSeconds) * 1.8
                emitPoisonCloud(x, targetY + wave, column % 2 === 0 ? 3.8 : 3.1, Math.sin(column) * 0.45, 3.8 + column * 0.08, 2.7)
              }
              ;[-1, 1].forEach((side) => {
                enemyShotsRef.current.push({
                  id: shotId++,
                  x: lane + side * 38,
                  y: targetY - 4,
                  vx: -side * 24,
                  vy: 6,
                  damage: 1,
                  kind: 'snakeFang',
                  radius: 1.85,
                })
              })
            } else if (chargePattern === 'cross') {
              for (const target of livingPlayersThisTick) {
                if (target.hp <= 0) continue
                const inBiteSpot =
                  Math.abs(target.x - lane) < 9.5 &&
                  Math.abs(target.y - targetY) < 7.5
                if (inBiteSpot) {
                  damagePlayer(2, target)
                  spawnSparks(target.x, target.y, '#bef264', 38, 8)
                  addRipple(target.x, target.y, '#84cc16', 17)
                }
              }
              ;[-1, 1].forEach((side) => {
                enemyShotsRef.current.push({
                  id: shotId++,
                  x: lane + side * 4.5,
                  y: targetY - 2,
                  vx: side * 5,
                  vy: 12,
                  damage: 1,
                  kind: 'venomSpit',
                  radius: 2.1,
                  life: 1.6,
                  maxLife: 1.6,
                })
              })
              emitPoisonCloud(lane, targetY, 4.4, 0, 7.2, 3.1)
              beamVolleyRecovery = 0.42
            } else if (chargePattern === 'scatter') {
              ;[-30, -16, 0, 16, 30].forEach((offset, index) => {
                emitPoisonCloud(lane + offset, enemy.y + 16 + index * 2.2, 3.7, offset * 0.08, 9.5 + index * 0.55, 3.6)
              })
            } else if (chargePattern === 'trident') {
              ;[-18, 0, 18].forEach((offset, index) => {
                emitPoisonCloud(lane + offset, enemy.y + 18 + index * 8, 4.1, offset * 0.06, 10.5, 3.8)
                emitPoisonCloud(lane + offset * 0.62, enemy.y + 34 + index * 4, 2.8, offset * 0.04, 8.8, 3.2)
              })
            } else if (chargePattern === 'pincer') {
              for (let row = 0; row < 4; row += 1) {
                ;[-1, 1].forEach((side) => {
                  emitPoisonCloud(lane + side * (25 - row * 3), enemy.y + 18 + row * 10, 3.8, -side * (1.8 + row * 0.35), 9.2 + row * 0.8, 3.7)
                })
              }
            } else {
              for (let row = 0; row < 5; row += 1) {
                const drift = Math.sin(row * 1.2) * 8
                emitPoisonCloud(lane + drift, enemy.y + 16 + row * 9, row % 2 === 0 ? 3.9 : 3.1, drift * 0.08, 9.8 + row * 0.7, 3.5)
              }
            }
            spawnSparks(enemy.x, enemy.y + 4, '#22d3ee', 44, 8)
            addRipple(lane, chargePattern === 'horizontal' || chargePattern === 'cross' ? targetY : enemy.y + 30, chargePattern === 'scatter' ? '#22d3ee' : chargePattern === 'horizontal' || chargePattern === 'cross' ? '#84cc16' : '#22d3ee', chargePattern === 'scatter' ? 20 : chargePattern === 'horizontal' ? 22 : 16)
            playGameSound('laser')
            chargeCooldown = chargePattern === 'horizontal' ? 6.8 + Math.random() * 1.2 : chargePattern === 'cross' ? 6.2 + Math.random() * 1.1 : chargePattern === 'scatter' ? 6.6 + Math.random() * 1.4 : chargePattern === 'trident' ? 5.9 + Math.random() * 1.2 : 5.2 + Math.random() * 1.2
            fireCooldown = Math.max(fireCooldown, 1.7)
          }
        } else {
          chargeCooldown = Math.max(0, chargeCooldown - dt * bossFireDrain)
          if (chargeCooldown <= 0) {
            const target = getNearestLivingPlayerThisTick(enemy)
            const hpRatio = enemy.hp / enemy.maxHp
            const snakeSpecialStep = bossKind === 'snake' ? Math.max(0, Math.floor(beamVolleyLeft ?? 0)) : -1
            const roll = Math.random()
            if (snakeSpecialStep >= 0 && snakeSpecialStep % 3 === 1) {
              chargePattern = 'cross'
            } else if (snakeSpecialStep >= 0 && snakeSpecialStep % 3 === 2) {
              chargePattern = 'horizontal'
            } else if (bossKind === 'final' && attackBossKind === 'snake' && roll < 0.46) {
              chargePattern = roll < 0.23 ? 'cross' : 'horizontal'
            } else {
              chargePattern = hpRatio < 0.38
                ? roll < 0.28 ? 'pincer' : roll < 0.58 ? 'trident' : roll < 0.82 ? 'single' : 'scatter'
                : roll < 0.38 ? 'single' : roll < 0.68 ? 'pincer' : roll < 0.9 ? 'trident' : 'scatter'
            }
            chargeTimer = chargePattern === 'horizontal' ? 1.18 : chargePattern === 'cross' ? 1.08 : chargePattern === 'scatter' ? 1.08 : 0.95
            chargeLane = clamp(target.x + (Math.random() - 0.5) * (chargePattern === 'scatter' ? 20 : 12), 14, 86)
            chargeTargetY = chargePattern === 'horizontal'
              ? clamp(target.y + (Math.random() - 0.5) * 12, 30, 86)
              : chargePattern === 'cross'
                ? clamp(target.y + 4, 26, 78)
                : enemy.y + 32
            chargeCooldown = 999
            if (bossKind === 'snake') beamVolleyLeft = snakeSpecialStep + 1
            addRipple(chargeLane, chargePattern === 'horizontal' || chargePattern === 'cross' ? chargeTargetY : enemy.y + 32, chargePattern === 'horizontal' || chargePattern === 'cross' ? '#84cc16' : '#22d3ee', chargePattern === 'scatter' ? 20 : 17)
            spawnSparks(enemy.x, enemy.y + 3, '#38bdf8', 36, 7)
            playGameSound('countdown')
          }
        }
      }
      const nextFire = fireCooldown - dt * (enemy.isBoss ? bossFireDrain : 1)
      const bossInPause = enemy.isBoss && bossKind !== 'devil' && (bossRushAggressive ? nowSeconds % 5 > 4.25 : nowSeconds % 6 > 3)
      const biteRetracting = attackBossKind === 'snake' && chargePattern === 'cross' && beamVolleyRecovery > 0
      if (nextFire <= 0 && enemy.y > 0 && chargeTimer <= 0 && !biteRetracting && !bossInPause && (bossKind !== 'final' || mirageActive)) {
        fireEnemy(enemy, getNearestLivingPlayerThisTick(enemy), now)
        if (bossKind === 'devil') devilNormalAttackTimer = Math.max(devilNormalAttackTimer, enemy.devilNormalAttackTimer ?? 0)
      }

      enemy.x = enemy.isBoss
        ? clamp(bossX, bossKind === 'devil' ? 50 : bossKind === 'final' ? 14 : bossKind === 'snake' ? 15 : bossKind === 'super' ? 20 : 16, bossKind === 'devil' ? 50 : bossKind === 'final' ? 86 : bossKind === 'snake' ? 85 : bossKind === 'super' ? 80 : 84)
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
      const nextBossFireCooldown = bossKind === 'devil'
        ? Math.max(1.05, 1.55 - waveRef.current * 0.018 - stageRef.current * 0.02)
        : Math.max(bossKind === 'final' ? 0.62 : bossKind === 'snake' ? 1.05 : bossKind === 'squid' ? 1.08 : 0.85, 1.82 - waveRef.current * 0.028 - stageRef.current * 0.035)
      enemy.fireCooldown = fireCooldown !== enemy.fireCooldown ? fireCooldown : nextFire <= 0
        ? (enemy.isBoss
          ? Math.max(0.42, nextBossFireCooldown * bossAttackCooldownScale)
          : enemy.isMiniBoss
            ? Math.max(miniKind === 'lancer' ? 1.12 : 1.28, 1.84 - stageRef.current * 0.018 + Math.random() * 0.5)
            : Math.max(1.05, 2.4 + Math.random() * 1.9 - waveRef.current * 0.05))
        : nextFire
      enemy.chargeCooldown = chargeCooldown
      enemy.chargeTimer = chargeTimer
      enemy.chargeLane = chargeLane
      enemy.chargeTargetY = chargeTargetY
      enemy.chargePattern = chargePattern
      enemy.rapidCharge = rapidCharge
      enemy.beamVolleyLeft = beamVolleyLeft
      enemy.beamVolleyRecovery = beamVolleyRecovery
      enemy.devilNormalAttackTimer = devilNormalAttackTimer
      enemy.devilSnakeBurstLeft = devilSnakeBurstLeft
      enemy.mirageKind = mirageKind
      enemy.mirageTimer = mirageTimer
      enemy.mirageCooldown = mirageCooldown
      enemy.hitFlash = Math.max(0, (enemy.hitFlash ?? 0) - dt)
      const enemyMargin = enemy.isBoss || enemy.isMiniBoss ? 90 : 28
      const enemyOnField = enemy.y > -enemyMargin && enemy.y < HEIGHT + enemyMargin && enemy.x > -enemyMargin && enemy.x < WIDTH + enemyMargin
      if ((enemy.isBoss || enemy.isMiniBoss || enemyOnField) && enemy.hp > 0) {
        enemies[liveEnemyCount] = enemy
        liveEnemyCount += 1
      }
    }
    enemies.length = liveEnemyCount

    const powerUps = powerUpsRef.current
    let livePowerUpCount = 0
    for (const powerUp of powerUps) {
      const targetPlayer = getNearestLivingPlayerThisTick(powerUp)
      const targetDx = targetPlayer.x - powerUp.x
      const targetDy = targetPlayer.y - powerUp.y
      const targetDistanceSq = targetDx * targetDx + targetDy * targetDy
      const magnetRange = powerUp.type === 'levelup' ? 31 : 18
      const magnetStrength = targetPlayer.hp > 0 && targetDistanceSq < magnetRange * magnetRange
        ? 1 - Math.sqrt(targetDistanceSq) / magnetRange
        : 0
      if (powerUp.type === 'levelup') {
        powerUp.x += (targetPlayer.x - powerUp.x) * Math.min(1, dt * 3.2)
        powerUp.y += powerUp.vy * dt + (targetPlayer.y - powerUp.y) * Math.min(1, dt * (0.8 + magnetStrength * 1.1))
      } else {
        powerUp.y += powerUp.vy * dt
        if (magnetStrength > 0) {
          const pull = Math.min(1, dt * (1.4 + magnetStrength * 5.4))
          powerUp.x += targetDx * pull * 0.82
          powerUp.y += targetDy * pull * 0.42
        }
      }
      const targetMagnet = clamp(magnetStrength * 1.25, 0, 1)
      powerUp.magnet = (powerUp.magnet ?? 0) + (targetMagnet - (powerUp.magnet ?? 0)) * Math.min(1, dt * 8)
      powerUp.spin += dt * 180
      if (powerUp.y < HEIGHT + 8) {
        powerUps[livePowerUpCount] = powerUp
        livePowerUpCount += 1
      }
    }
    powerUps.length = livePowerUpCount

    updateSparksInPlace(sparksRef.current, dt)
    updateRipplesInPlace(ripplesRef.current, dt)

    const spawnedAsteroids = spawnedAsteroidsRef.current
    spawnedAsteroids.length = 0
    const spawnedSquidBubbles = spawnedSquidBubblesRef.current
    spawnedSquidBubbles.length = 0
    const breakAsteroid = (asteroid: AsteroidHazard, awardScore: boolean) => {
      asteroid.hp = 0
      spawnedAsteroids.push(...splitAsteroidHazard(
        asteroid,
        stageRef.current,
        getPowerScore(playerRef.current) + (remotePlayerRef.current ? getPowerScore(remotePlayerRef.current) * 0.7 : 0),
      ))
      const scoreValue = asteroid.tier === 2 ? 190 : asteroid.tier === 1 ? 82 : 26
      if (awardScore) {
        player.score += Math.round((scoreValue + stageRef.current * 4) * scoreMult)
        if (remotePlayerRef.current) {
          remotePlayerRef.current.score += Math.round((scoreValue + stageRef.current * 4) * scoreMult)
        }
      }
      spawnSparks(asteroid.x, asteroid.y, asteroid.tier === 2 ? '#fb923c' : '#fbbf24', asteroid.tier === 2 ? 38 : 22, asteroid.tier === 2 ? 8 : 5)
      addRipple(asteroid.x, asteroid.y, asteroid.tier === 2 ? '#fb923c' : '#fbbf24', asteroid.tier === 2 ? 15 : 9)
      playGameSound(asteroid.tier === 2 ? 'explosion_big' : 'explosion')
    }

    const splitSquidBubble = (bubble: Shot) => {
      const splitLevel = bubble.splitLevel ?? 0
      spawnSparks(bubble.x, bubble.y, '#f0abfc', splitLevel >= 2 ? 18 : 38, 7)
      addRipple(bubble.x, bubble.y, '#f472b6', splitLevel >= 2 ? 9 : 15)
      playGameSound(splitLevel >= 2 ? 'explosion' : 'hit')
      if (splitLevel >= 2) return
      const childCount = 2
      for (let i = 0; i < childCount; i += 1) {
        const angle = (i / childCount) * Math.PI * 2 + Math.random() * 0.55
        const radius = Math.max(1.05, bubble.radius * 0.64)
        spawnedSquidBubbles.push({
          id: shotId++,
          x: bubble.x + Math.cos(angle) * radius * 0.8,
          y: bubble.y + Math.sin(angle) * radius * 0.8,
          vx: Math.cos(angle) * (6.7 + splitLevel * 2.35),
          vy: Math.sin(angle) * (6.7 + splitLevel * 2.35),
          damage: splitLevel === 0 ? 2 : 1,
          kind: 'squidBubble',
          radius,
          hp: Math.max(splitLevel === 0 ? 95 : 34, Math.ceil((bubble.hp ?? 100) * 0.58)),
          splitLevel: splitLevel + 1,
          life: Math.max(6, 13 - splitLevel * 2),
          maxLife: Math.max(6, 13 - splitLevel * 2),
          retargetTime: 0.55,
        })
      }
    }

    const detonateCoreLanderBlast = (shot: Shot, sourceEnemyId?: number) => {
      const spiegelKunai = shot.kind === 'spiegelKunai'
      const blastRadius = CORE_LANDER_AOE_RADIUS * (shot.burning ? 1.12 : 1)
      const splashDamage = Math.max(1, Math.ceil(shot.damage * (spiegelKunai ? SPIEGEL_KUNAI_SPLASH_DAMAGE_MULTIPLIER : 0.58)))
      spawnSparks(shot.x, shot.y, spiegelKunai ? '#e2e8f0' : '#fb923c', spiegelKunai ? 14 : 24, spiegelKunai ? 5 : 7)
      addRipple(shot.x, shot.y, spiegelKunai ? '#f87171' : '#fb923c', spiegelKunai ? 9 : 13)
      playGameSound('explosion')

      for (const enemy of enemiesRef.current) {
        if (enemy.hp <= 0 || enemy.id === sourceEnemyId) continue
        const hitRange = blastRadius + enemy.radius
        if (
          Math.abs(shot.x - enemy.x) <= hitRange &&
          Math.abs(shot.y - enemy.y) <= hitRange &&
          distSq(shot, enemy) <= hitRange * hitRange
        ) {
          const shielded = (enemy.isBoss && (enemy.shieldTime > 0 || enemy.y < 15)) || (enemy.isMiniBoss && (enemy.shieldTime > 0 || enemy.y < 8))
          if (shielded) continue
          const damage = enemy.isBoss ? Math.max(1, Math.ceil(splashDamage * 0.45)) : splashDamage
          enemy.hp = enemy.isBoss ? Math.max(1, enemy.hp - damage) : enemy.hp - damage
          playBossCriticalStinger(enemy)
          enemy.hitFlash = Math.max(enemy.hitFlash ?? 0, enemy.isBoss ? 0.18 : enemy.isMiniBoss ? 0.14 : 0.1)
          spawnSparks(enemy.x, enemy.y, spiegelKunai ? '#cbd5e1' : enemy.isBoss ? '#fdba74' : '#fb923c', enemy.isBoss ? 12 : enemy.isMiniBoss ? 9 : 5, enemy.isBoss || enemy.isMiniBoss ? 6 : 4)
          if (enemy.hp <= 0 && !enemy.isBoss) {
            enemiesDestroyedRef.current += 1
            const scoreValue = enemy.isMiniBoss ? 260 + waveRef.current * 32 : 95 + waveRef.current * 14
            player.score += Math.round(scoreValue * scoreMult)
            if (remotePlayer) remotePlayer.score += Math.round(scoreValue * scoreMult)
            spawnSparks(enemy.x, enemy.y, enemy.isMiniBoss ? '#c084fc' : '#fb7185', enemy.isMiniBoss ? 42 : 18, enemy.isMiniBoss ? 7 : 5)
            addRipple(enemy.x, enemy.y, enemy.isMiniBoss ? '#a855f7' : '#f97316', enemy.isMiniBoss ? 14 : 9)
            if (enemy.isMiniBoss) {
              spawnPowerUp(enemy.x, enemy.y, Math.random() < 0.55)
            } else {
              spawnPowerUp(enemy.x, enemy.y)
            }
          }
        }
      }
    }

    for (const bubble of expiredSquidBubbles) splitSquidBubble(bubble)
    expiredSquidBubbles.length = 0

    for (const shot of shotsRef.current) {
      if (shot.y <= -50) continue
      for (const bubble of enemyShotsRef.current) {
        if (bubble.kind !== 'squidBubble' || (bubble.hp ?? 1) <= 0 || (bubble.retargetTime ?? 0) > 0) continue
        const hitRange = shot.radius + bubble.radius
        if (
          Math.abs(shot.x - bubble.x) <= hitRange &&
          Math.abs(shot.y - bubble.y) <= hitRange &&
          distSq(shot, bubble) <= hitRange * hitRange
        ) {
          const bubbleLevel = bubble.splitLevel ?? 0
          const bubbleSplitHp = bubble.hp ?? 120
          const bubbleArmor = bubbleLevel === 0 ? 0.34 : bubbleLevel === 1 ? 0.42 : bubbleLevel === 2 ? 0.5 : 0.62
          const bubbleHitCap = bubbleLevel === 0 ? 20 : bubbleLevel === 1 ? 18 : bubbleLevel === 2 ? 15 : 12
          const bubbleDamage = Math.max(1, Math.ceil(Math.min(shot.damage, bubbleHitCap) * bubbleArmor))
          bubble.hp = (bubble.hp ?? 1) - bubbleDamage
          spawnSparks(shot.x, shot.y, '#f0abfc', 5, 5)
          if (isCoreLanderAoeShot(shot)) {
            detonateCoreLanderBlast(shot)
            shot.y = -999
          } else if (shot.pierce && shot.pierce > 0) {
            shot.pierce -= 1
          } else {
            shot.y = -999
          }
          if ((bubble.hp ?? 0) <= 0) {
            splitSquidBubble({ ...bubble, hp: bubbleSplitHp })
            bubble.life = 0
            bubble.y = HEIGHT + 99
          }
          break
        }
      }
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
          if (isCoreLanderAoeShot(shot)) {
            detonateCoreLanderBlast(shot)
          } else if (shot.kind === 'rocket') {
            addRipple(shot.x, shot.y, '#fb923c', 8)
            playGameSound('explosion')
          }
          if (isCoreLanderAoeShot(shot)) {
            shot.y = -999
          } else if (shot.pierce && shot.pierce > 0) {
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
          if (isCoreLanderAoeShot(shot)) {
            detonateCoreLanderBlast(shot)
            shot.y = -999
          } else if (shot.pierce && shot.pierce > 0) {
            shot.pierce -= 1
          } else {
            shot.y = -999
          }
          if (wreck.hp <= 0) {
            player.score += Math.round((240 + stageRef.current * 18) * scoreMult)
            if (remotePlayerRef.current) remotePlayerRef.current.score += Math.round((240 + stageRef.current * 18) * scoreMult)
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
    const markEnemyDefeatedByBarrage = (enemy: Enemy) => {
      enemiesDestroyedRef.current += 1
      if (enemy.isBoss) {
        bossesDefeatedRef.current += 1
        enemy.defeatTimer = STAGE_CLEAR_SECONDS
        if (enemy.bossKind === 'devil') {
          devilBossDefeatedRef.current = true
          enemy.devilDefeatedTimer = enemy.defeatTimer
          enemy.devilVisualPose = 'rage'
          enemy.devilPoseChangedAt = now
        }
      }
      const scoreValue = getRaidEnemyScoreValue(enemy, waveRef.current)
      player.score += Math.round(scoreValue * scoreMult)
      if (remotePlayerRef.current) {
        remotePlayerRef.current.score += Math.round(scoreValue * scoreMult)
      }
      spawnSparks(enemy.x, enemy.y, enemy.isBoss ? '#fda4af' : enemy.isMiniBoss ? '#c084fc' : '#fb7185', enemy.isBoss ? 60 : enemy.isMiniBoss ? 42 : 18, enemy.isBoss ? 8 : enemy.isMiniBoss ? 7 : 5)
      addRipple(enemy.x, enemy.y, enemy.isBoss ? '#fb7185' : enemy.isMiniBoss ? '#a855f7' : '#f97316', enemy.isBoss ? 18 : enemy.isMiniBoss ? 14 : 9)
      if (enemy.isMiniBoss) {
        spawnPowerUp(enemy.x, enemy.y, Math.random() < 0.55)
      } else if (!enemy.isBoss) spawnPowerUp(enemy.x, enemy.y)
      if (!enemy.isBoss) enemy.defeatTimer = Math.max(enemy.defeatTimer ?? 0, GOD_GUNDAM_DEFEAT_HOLD_SECONDS)
      if (enemy.isBoss) {
        playBossCriticalStinger(enemy, true)
        bossDefeatedThisFrame = true
        const clearedStage = stageRef.current
        const nextBossRushStage = raidModeRef.current === 'bossRush' ? getNextBossRushStage(clearedStage) : undefined
        const startNormalRaidDevilBonus =
          raidModeRef.current === 'campaign' &&
          enemy.bossKind === 'final' &&
          clearedStage >= MAX_RAID_STAGE &&
          normalRaidDevilBonusEligibleRef.current &&
          !normalRaidDevilBonusTriggeredRef.current
        if (startNormalRaidDevilBonus) {
          normalRaidDevilBonusTriggeredRef.current = true
          preserveLoadoutForSuperBoss = true
          pendingNextStageRef.current = NORMAL_RAID_DEVIL_BONUS_STAGE
          unlockedStageRef.current = MAX_RAID_STAGE
          if (!coOpRunRef.current) {
            saveUnlockedStage(MAX_RAID_STAGE)
            saveCheckpointStage(14)
          }
          bossAlertRef.current = 2.4
          bossMessageRef.current = 'clear'
        } else if (raidModeRef.current === 'bossRush' ? nextBossRushStage === null : raidModeRef.current !== 'endless' && clearedStage >= MAX_RAID_STAGE) {
          completedRun = true
          victoryPendingRef.current = true
          if (raidModeRef.current === 'campaign') {
            unlockedStageRef.current = MAX_RAID_STAGE
          }
          if (raidModeRef.current === 'campaign' && !coOpRunRef.current) {
            saveUnlockedStage(MAX_RAID_STAGE)
            saveCheckpointStage(14)
          }
          bossAlertRef.current = 2.4
          bossMessageRef.current = 'clear'
        } else {
          const nextStage = raidModeRef.current === 'bossRush' ? nextBossRushStage ?? BOSS_RUSH_STAGES[0] : clearedStage + 1
          preserveLoadoutForSuperBoss = raidModeRef.current === 'bossRush' || nextStage % 5 === 0
          pendingNextStageRef.current = nextStage
          if (raidModeRef.current === 'campaign') {
            unlockedStageRef.current = Math.max(unlockedStageRef.current, Math.min(nextStage, MAX_RAID_STAGE))
            if (!coOpRunRef.current) saveUnlockedStage(unlockedStageRef.current)
          }
          if (raidModeRef.current === 'campaign' && !coOpRunRef.current && (RAID_CHECKPOINTS as readonly number[]).includes(nextStage)) {
            saveCheckpointStage(nextStage)
          }
          bossAlertRef.current = 2.4
          bossMessageRef.current = 'clear'
        }
        player.godMeleeCloak = 0
        if (remotePlayerRef.current) remotePlayerRef.current.godMeleeCloak = 0
      playGameSound('levelup')
      playGameSound('combo')
      window.setTimeout(() => playGameSound('score'), 180)
    }
    playGameSound(enemy.isBoss ? 'destroyed_explosion' : enemy.isMiniBoss ? 'explosion_big' : 'explosion')
    }
    const spawnGodGundamPassiveStrike = (owner: Player, target: Vec & { radius: number }, visualIndex: number, sourceOverride?: Vec, preserveChain = false, attackSideOverride?: -1 | 1) => {
      const model = getPlayerCoreLanderCombatModel(owner, progressRef.current) ?? 'godGundam'
      const sourceX = sourceOverride?.x ?? owner.godMeleeChainX ?? owner.x
      const sourceY = sourceOverride?.y ?? owner.godMeleeChainY ?? owner.y
      const side = sourceX <= target.x ? -1 : 1
      godMeleeStrikesRef.current.push({
        id: godMeleeStrikeId++,
        x: target.x,
        y: target.y,
        sourceX,
        sourceY,
        model,
        pose: getGodGundamPassivePose(visualIndex, model),
        side,
        age: 0,
        duration: GOD_GUNDAM_MELEE_VISUAL_DURATION_SECONDS,
        size: 1,
        targetRadius: target.radius,
        burning: isCoreLanderBurning(owner),
        clone: preserveChain,
        attackSideOverride,
      })
      if (!preserveChain) {
        owner.godMeleeChainX = target.x
        owner.godMeleeChainY = target.y
      }
    }
    const updateGodGundamMeleePassive = (owner: Player) => {
      if (!isGodGundamBarragePilot(owner, progressRef.current) || owner.hp <= 0) {
        owner.godMeleeHeat = 0
        owner.godMeleeExhaust = 0
        owner.godMeleeVisualTimer = 0
        owner.godMeleeCloak = 0
        return
      }
      if ((owner.godMeleeExhaust ?? 0) > 0) {
        owner.godMeleeHeat = Math.max(0, (owner.godMeleeHeat ?? 0) - dt * 4)
        owner.godMeleeChainX = owner.x
        owner.godMeleeChainY = owner.y
        return
      }

      const ownerModel = getPlayerCoreLanderCombatModel(owner, progressRef.current) ?? 'godGundam'
      const ownerDamageScale = owner === devilAssistPlayerRef.current ? DEVIL_ASSIST_DAMAGE_SCALE : 1
      const meleeColor = ownerModel === 'spiegel' ? '#f87171' : '#facc15'
      const meleeRippleColor = ownerModel === 'spiegel' ? '#e2e8f0' : '#fbbf24'
      const range = getGodGundamMeleeRange(owner, ownerModel)
      type GodMeleeCandidate = {
        target: (Enemy | AsteroidHazard | Shot) & { id: number; radius: number }
        kind: 'enemy' | 'asteroid' | 'bubble'
        key: string
      }
      const meleeCandidates: Array<GodMeleeCandidate & { distance: number }> = []
      const chainOrigin = { x: owner.godMeleeChainX ?? owner.x, y: owner.godMeleeChainY ?? owner.y }
      const lastTargetKey = owner.godMeleeLastTargetKey ?? ''
      const considerTarget = (target: (Enemy | AsteroidHazard | Shot) & { id: number; radius: number }, key: string, kind: GodMeleeCandidate['kind'], hitRange: number) => {
        const ownerDistance = distSq(owner, target)
        if (ownerDistance > hitRange * hitRange) return
        const chainDistance = distSq(chainOrigin, target)
        meleeCandidates.push({ target, kind, key, distance: chainDistance })
      }
      for (const enemy of enemiesRef.current) {
        if (enemy.hp <= 0 || enemy.y < -18 || enemy.y > HEIGHT + 16) continue
        considerTarget(enemy, `e:${enemy.id}`, 'enemy', range + enemy.radius)
      }
      for (const asteroid of asteroidsRef.current) {
        if (asteroid.hp <= 0 || asteroid.y < -asteroid.radius - 20 || asteroid.y > HEIGHT + asteroid.radius + 20) continue
        considerTarget(asteroid, `a:${asteroid.id}`, 'asteroid', Math.max(range, range + asteroid.radius * 0.55))
      }
      for (const bubble of enemyShotsRef.current) {
        if (bubble.kind !== 'squidBubble' || (bubble.hp ?? 1) <= 0 || bubble.y < -18 || bubble.y > HEIGHT + 18) continue
        considerTarget(bubble, `b:${bubble.id}`, 'bubble', range + bubble.radius * 2.2)
      }
      let preferredTarget: (GodMeleeCandidate & { distance: number }) | null = null
      let fallbackTarget: (GodMeleeCandidate & { distance: number }) | null = null
      for (const candidate of meleeCandidates) {
        if (candidate.key !== lastTargetKey) {
          if (!preferredTarget || candidate.distance < preferredTarget.distance) preferredTarget = candidate
        } else if (!fallbackTarget || candidate.distance < fallbackTarget.distance) {
          fallbackTarget = candidate
        }
      }
      const candidate = preferredTarget ?? fallbackTarget
      if (!candidate) {
        owner.godMeleeHeat = Math.max(0, (owner.godMeleeHeat ?? 0) - dt * GOD_GUNDAM_MELEE_HEAT_RECOVERY_PER_SECOND)
        owner.godMeleeChainX = owner.x
        owner.godMeleeChainY = owner.y
        owner.godMeleeLastTargetKey = ''
        return
      }
      owner.godMeleeLastTargetKey = candidate.key

      owner.godMeleeHeat = (owner.godMeleeHeat ?? 0) + dt
      owner.godMeleeCloak = Math.max(owner.godMeleeCloak ?? 0, GOD_GUNDAM_MELEE_VISUAL_DURATION_SECONDS * 0.9)
      owner.invuln = Math.max(owner.invuln, 0.2)
      if (owner.godMeleeHeat >= GOD_GUNDAM_MELEE_EXHAUST_LIMIT_SECONDS) {
        owner.godMeleeHeat = 0
        owner.godMeleeExhaust = GOD_GUNDAM_MELEE_EXHAUST_COOLDOWN_SECONDS
        owner.godMeleeCloak = 0
        owner.godMeleeChainX = owner.x
        owner.godMeleeChainY = owner.y
        owner.godMeleeLastTargetKey = ''
        addRipple(owner.x, owner.y, meleeColor, 14)
        spawnSparks(owner.x, owner.y, meleeColor, 26, 6)
        return
      }

      const spiegelClonesActive = hasSpiegelShadowClones(owner, ownerModel)
      const isMeleeCandidateAlive = (meleeCandidate: GodMeleeCandidate) => {
        if (meleeCandidate.kind === 'enemy') return (meleeCandidate.target as Enemy).hp > 0
        if (meleeCandidate.kind === 'asteroid') return (meleeCandidate.target as AsteroidHazard).hp > 0
        return ((meleeCandidate.target as Shot).hp ?? 1) > 0 && ((meleeCandidate.target as Shot).life ?? 0) > 0
      }
      const pickSpiegelCloneCandidate = (side: -1 | 1, usedKeys: string[]) => {
        let best: (GodMeleeCandidate & { distance: number }) | null = null
        let fallback: (GodMeleeCandidate & { distance: number }) | null = null
        let bestScore = Number.POSITIVE_INFINITY
        let fallbackScore = Number.POSITIVE_INFINITY
        for (const meleeCandidate of meleeCandidates) {
          if (!isMeleeCandidateAlive(meleeCandidate)) continue
          const directionBias = side < 0
            ? Math.max(0, meleeCandidate.target.x - owner.x)
            : Math.max(0, owner.x - meleeCandidate.target.x)
          const score = meleeCandidate.distance + directionBias * directionBias * 0.8 + Math.abs(meleeCandidate.target.y - owner.y) * 1.8
          if (usedKeys.includes(meleeCandidate.key)) {
            if (score < fallbackScore) {
              fallback = meleeCandidate
              fallbackScore = score
            }
          } else if (score < bestScore) {
            best = meleeCandidate
            bestScore = score
          }
        }
        return best ?? fallback
      }
      const drawMeleeCandidateHit = (meleeCandidate: GodMeleeCandidate & { distance: number }, visualIndex: number, sourceOverride?: Vec, clone = false, attackSideOverride?: -1 | 1) => {
        const hitTarget = meleeCandidate.target
        spawnGodGundamPassiveStrike(owner, hitTarget, visualIndex, sourceOverride, clone, attackSideOverride)
        const strikeEnemy = meleeCandidate.kind === 'enemy' ? meleeCandidate.target as Enemy : null
        spawnSparks(hitTarget.x, hitTarget.y, clone ? '#e2e8f0' : meleeColor, strikeEnemy?.isBoss ? 7 : strikeEnemy?.isMiniBoss ? 6 : 4, clone ? 3 : 4)
        if (!clone) playCoreLanderPhysicalAttackSound(godMeleeStrikeId + hitTarget.id)
        if (!clone && godMeleeStrikeId % 4 === 0) addRipple(hitTarget.x, hitTarget.y, meleeRippleColor, strikeEnemy?.isBoss ? 6 : 4)
        if (clone && visualIndex % 3 === 0) addRipple(hitTarget.x, hitTarget.y, '#e2e8f0', strikeEnemy?.isBoss ? 5 : 3)
      }
      const damageMeleeCandidate = (meleeCandidate: GodMeleeCandidate & { distance: number }, damageScale = 1) => {
        if (meleeCandidate.kind === 'enemy') {
          const targetEnemy = meleeCandidate.target as Enemy
          if (targetEnemy.hp <= 0) return false
          const damage = getGodGundamMeleeDamagePerSecond(owner, targetEnemy, stageRef.current, ownerModel) * dt * damageScale
          targetEnemy.shieldTime = 0
          targetEnemy.hp -= damage
          playBossCriticalStinger(targetEnemy)
          targetEnemy.hitFlash = Math.max(targetEnemy.hitFlash ?? 0, targetEnemy.isBoss ? 0.18 : targetEnemy.isMiniBoss ? 0.14 : 0.1)
          if (targetEnemy.hp <= 0) markEnemyDefeatedByBarrage(targetEnemy)
          return true
        }
        if (meleeCandidate.kind === 'asteroid') {
          const targetAsteroid = meleeCandidate.target as AsteroidHazard
          if (targetAsteroid.hp <= 0) return false
          targetAsteroid.hp -= (getPlayerBaseAttack(owner) + getGodGundamStageAttackBonus(stageRef.current)) * GOD_GUNDAM_MELEE_DAMAGE_PER_SECOND * 1.35 * dt * damageScale
          if (targetAsteroid.hp <= 0) {
            const scoreValue = 180 + stageRef.current * 15 + targetAsteroid.tier * 80
            player.score += Math.round(scoreValue * scoreMult)
            if (remotePlayerRef.current) remotePlayerRef.current.score += Math.round(scoreValue * scoreMult)
            spawnSparks(targetAsteroid.x, targetAsteroid.y, targetAsteroid.tier === 2 ? '#fb923c' : '#fbbf24', targetAsteroid.tier === 2 ? 38 : 22, targetAsteroid.tier === 2 ? 8 : 5)
            addRipple(targetAsteroid.x, targetAsteroid.y, targetAsteroid.tier === 2 ? '#fb923c' : '#fbbf24', targetAsteroid.tier === 2 ? 15 : 9)
            playGameSound(targetAsteroid.tier === 2 ? 'explosion_big' : 'explosion')
          }
          return true
        }
        const targetBubble = meleeCandidate.target as Shot
        if ((targetBubble.hp ?? 1) <= 0) return false
        const splitHp = targetBubble.hp ?? 120
        targetBubble.hp = (targetBubble.hp ?? 1) - (getPlayerBaseAttack(owner) + getGodGundamStageAttackBonus(stageRef.current)) * GOD_GUNDAM_MELEE_DAMAGE_PER_SECOND * 1.42 * dt * damageScale
        if ((targetBubble.hp ?? 0) <= 0) {
          splitSquidBubble({ ...targetBubble, hp: splitHp })
          targetBubble.life = 0
          targetBubble.y = HEIGHT + 99
        }
        return true
      }

      if ((owner.godMeleeVisualTimer ?? 0) <= 0) {
        drawMeleeCandidateHit(candidate, godMeleeStrikeId)
        if (spiegelClonesActive) {
          const visualUsedKeys = [candidate.key]
          for (const side of [-1, 1] as const) {
            const cloneCandidate = pickSpiegelCloneCandidate(side, visualUsedKeys)
            if (!cloneCandidate) continue
            drawMeleeCandidateHit(cloneCandidate, godMeleeStrikeId + side * 17, { x: owner.x + side * SPIEGEL_SHADOW_CLONE_OFFSET, y: owner.y + (side < 0 ? -7 : 7) }, true, side)
            visualUsedKeys.push(cloneCandidate.key)
          }
        }
        owner.godMeleeVisualTimer = GOD_GUNDAM_MELEE_VISUAL_INTERVAL_SECONDS
      }

      damageMeleeCandidate(candidate, ownerDamageScale)
      if (spiegelClonesActive) {
        const cloneDamageMultiplier = getSpiegelShadowCloneDamageMultiplier(owner, ownerModel)
        const usedCloneKeys = [candidate.key]
        for (const side of [-1, 1] as const) {
          const cloneCandidate = pickSpiegelCloneCandidate(side, usedCloneKeys)
          if (!cloneCandidate) continue
          damageMeleeCandidate(cloneCandidate, cloneDamageMultiplier * ownerDamageScale)
          usedCloneKeys.push(cloneCandidate.key)
        }
      }
    }
    if (!bossDefeatedThisFrame) {
      if (!playerInGodBarrage) updateGodGundamMeleePassive(player)
      const remoteOwner = remotePlayerRef.current
      if (remoteOwner && !remotePlayerInGodBarrage && !bossDefeatedThisFrame) updateGodGundamMeleePassive(remoteOwner)
      const devilAssistOwner = devilAssistPlayerRef.current
      if (devilAssistOwner && devilAssistEntryRef.current <= 0 && !bossDefeatedThisFrame) updateGodGundamMeleePassive(devilAssistOwner)
    }
    const godBarrage = godBarrageRef.current
    if (godBarrage && !bossDefeatedThisFrame) {
      const barrageTargets = godBarrageDamageTargetsScratch
      barrageTargets.length = 0
      for (let index = 0; index < enemiesRef.current.length; index += 1) {
        const enemy = enemiesRef.current[index]
        if (enemy.hp > 0 && enemy.y > -18 && enemy.y < HEIGHT + 16) barrageTargets.push(enemy)
      }
      const barrageAsteroidTargets = asteroidsRef.current
      const barrageBubbleTargets = enemyShotsRef.current
      let hasBarrageUtilityTarget = false
      for (const asteroid of barrageAsteroidTargets) {
        if (asteroid.hp > 0 && asteroid.y > -18 && asteroid.y < HEIGHT + 16) {
          hasBarrageUtilityTarget = true
          break
        }
      }
      if (!hasBarrageUtilityTarget) {
        for (const bubble of barrageBubbleTargets) {
          if (bubble.kind === 'squidBubble' && (bubble.hp ?? 1) > 0 && bubble.y > -18 && bubble.y < HEIGHT + 16) {
            hasBarrageUtilityTarget = true
            break
          }
        }
      }
      if (barrageTargets.length === 0 && !hasBarrageUtilityTarget) {
        godBarrageRef.current = null
      } else {
        godBarrage.hitTimer -= dt
        const playerPowerScore = isGodGundamBarragePilot(player, progressRef.current) ? Math.max(0, player.rank - 1) : getPowerScore(player)
        const remoteOwner = remotePlayerRef.current
        const remotePowerScore = remoteOwner
          ? isGodGundamBarragePilot(remoteOwner, progressRef.current)
            ? Math.max(0, remoteOwner.rank - 1)
            : getPowerScore(remoteOwner)
          : 0
        const powerScore = playerPowerScore + (remoteOwner ? Math.round(remotePowerScore * 0.6) : 0)
        const barrageModel = godBarrage.model ?? 'godGundam'
        const damageMultiplier = godBarrage.damageMultiplier ?? getGodGundamBarrageDamageMultiplier(player, barrageModel)
        while (godBarrage.hitTimer <= 0 && !bossDefeatedThisFrame) {
          godBarrage.hitTimer += GOD_GUNDAM_BARRAGE_HIT_INTERVAL_SECONDS
          godBarrage.hitIndex += 1
          let hitAnyTarget = false
          for (let targetIndex = 0; targetIndex < barrageTargets.length; targetIndex += 1) {
            const target = barrageTargets[targetIndex]
            if (target.hp <= 0) continue
            const baseDamage = target.isBoss || target.isMiniBoss
              ? getGodGundamBarrageBossDamage(target, stageRef.current, powerScore)
              : Math.max(46 + stageRef.current * 5 + powerScore * 3, Math.round(target.maxHp * 0.34))
            const damage = Math.max(1, Math.round(baseDamage * damageMultiplier))
            spawnGodGundamPassiveStrike(player, target, godBarrage.hitIndex + target.id)
            target.shieldTime = 0
            target.hp -= damage
            playBossCriticalStinger(target)
            target.hitFlash = Math.max(target.hitFlash ?? 0, target.isBoss ? 0.26 : target.isMiniBoss ? 0.2 : 0.14)
            hitAnyTarget = true
            const side = (godBarrage.hitIndex + target.id) % 2 === 0 ? -1 : 1
            spawnSparks(target.x + side * target.radius * 0.34, target.y + ((godBarrage.hitIndex + target.id) % 3 - 1) * 4, '#facc15', target.isBoss ? 18 : target.isMiniBoss ? 12 : 7, 6)
            if ((godBarrage.hitIndex + target.id) % 3 === 0) addRipple(target.x, target.y, '#fbbf24', target.isBoss ? 10 : target.isMiniBoss ? 7 : 5)
            if (target.hp <= 0) {
              markEnemyDefeatedByBarrage(target)
              if (target.isBoss) {
                godBarrageRef.current = null
                break
              }
            }
          }
          if (!bossDefeatedThisFrame && godBarrageRef.current && barrageModel === 'spiegel' && godBarrage.burning) {
            let cloneTargetCount = 0
            for (const target of barrageTargets) {
              if (target.hp > 0) cloneTargetCount += 1
            }
            const cloneUsedTargetIds: number[] = []
            for (const side of [-1, 1] as const) {
              let cloneTarget: Enemy | null = null
              let bestCloneScore = Number.POSITIVE_INFINITY
              for (const target of barrageTargets) {
                if (target.hp <= 0) continue
                if (cloneUsedTargetIds.includes(target.id) && cloneTargetCount > 1) continue
                const directionBias = side < 0 ? Math.max(0, target.x - player.x) : Math.max(0, player.x - target.x)
                const score = directionBias * directionBias + Math.abs(target.y - player.y) * 1.5 + ((godBarrage.hitIndex + target.id) % 7) * 3
                if (score < bestCloneScore) {
                  cloneTarget = target
                  bestCloneScore = score
                }
              }
              if (!cloneTarget) continue
              const clonePower = cloneTarget.isBoss || cloneTarget.isMiniBoss
                ? getGodGundamBarrageBossDamage(cloneTarget, stageRef.current, powerScore)
                : Math.max(46 + stageRef.current * 5 + powerScore * 3, Math.round(cloneTarget.maxHp * 0.34))
              const cloneDamage = Math.max(1, Math.round(clonePower * damageMultiplier * getSpiegelShadowCloneDamageMultiplier(player, barrageModel)))
              spawnGodGundamPassiveStrike(player, cloneTarget, godBarrage.hitIndex + cloneTarget.id + side * 23, { x: player.x + side * SPIEGEL_SHADOW_CLONE_OFFSET, y: player.y + (side < 0 ? -7 : 7) }, true, side)
              cloneTarget.shieldTime = 0
              cloneTarget.hp -= cloneDamage
              playBossCriticalStinger(cloneTarget)
              cloneTarget.hitFlash = Math.max(cloneTarget.hitFlash ?? 0, cloneTarget.isBoss ? 0.2 : cloneTarget.isMiniBoss ? 0.16 : 0.11)
              hitAnyTarget = true
              cloneUsedTargetIds.push(cloneTarget.id)
              spawnSparks(cloneTarget.x + side * cloneTarget.radius * 0.28, cloneTarget.y, '#e2e8f0', cloneTarget.isBoss ? 12 : cloneTarget.isMiniBoss ? 8 : 5, 5)
              if (cloneTarget.hp <= 0) {
                markEnemyDefeatedByBarrage(cloneTarget)
                if (cloneTarget.isBoss) {
                  godBarrageRef.current = null
                  break
                }
              }
            }
          }
          if (!bossDefeatedThisFrame && godBarrageRef.current) {
            for (const asteroid of barrageAsteroidTargets) {
              if (asteroid.hp <= 0 || asteroid.y <= -18 || asteroid.y >= HEIGHT + 16) continue
              spawnGodGundamPassiveStrike(player, asteroid, godBarrage.hitIndex + asteroid.id)
              const damage = Math.max(1, Math.round(Math.max(70 + stageRef.current * 8 + powerScore * 3, asteroid.maxHp * 0.24) * damageMultiplier))
              asteroid.hp -= damage
              hitAnyTarget = true
              spawnSparks(asteroid.x, asteroid.y, '#facc15', asteroid.tier === 2 ? 10 : 6, 5)
              if (asteroid.hp <= 0) {
                const scoreValue = 180 + stageRef.current * 15 + asteroid.tier * 80
                player.score += Math.round(scoreValue * scoreMult)
                if (remotePlayerRef.current) remotePlayerRef.current.score += Math.round(scoreValue * scoreMult)
                spawnSparks(asteroid.x, asteroid.y, asteroid.tier === 2 ? '#fb923c' : '#fbbf24', asteroid.tier === 2 ? 38 : 22, asteroid.tier === 2 ? 8 : 5)
                addRipple(asteroid.x, asteroid.y, asteroid.tier === 2 ? '#fb923c' : '#fbbf24', asteroid.tier === 2 ? 15 : 9)
                playGameSound(asteroid.tier === 2 ? 'explosion_big' : 'explosion')
              }
            }
            for (const bubble of barrageBubbleTargets) {
              if (bubble.kind !== 'squidBubble' || (bubble.hp ?? 1) <= 0 || bubble.y <= -18 || bubble.y >= HEIGHT + 16) continue
              spawnGodGundamPassiveStrike(player, bubble, godBarrage.hitIndex + bubble.id)
              const splitHp = bubble.hp ?? 120
              const damage = Math.max(1, Math.round(Math.max(30 + stageRef.current * 4 + powerScore * 2, splitHp * 0.45) * damageMultiplier))
              bubble.hp = splitHp - damage
              hitAnyTarget = true
              spawnSparks(bubble.x, bubble.y, '#f0abfc', 6, 5)
              if ((bubble.hp ?? 0) <= 0) {
                splitSquidBubble({ ...bubble, hp: splitHp })
                bubble.life = 0
                bubble.y = HEIGHT + 99
              }
            }
          }
          if (hitAnyTarget) playCoreLanderPhysicalAttackSound(godBarrage.hitIndex + (godBarrage.seed % 9))
          if (!hitAnyTarget) godBarrageRef.current = null
        }
      }
    }
    const enemyCollisionBuckets = enemyCollisionBucketsRef.current
    const largeEnemyCollision = largeEnemyCollisionRef.current
    const shotCollisionCandidates = shotCollisionCandidatesRef.current
    buildEnemyCollisionBuckets(enemiesRef.current, enemyCollisionBuckets, largeEnemyCollision)
    for (const shot of shotsRef.current) {
      const collisionCandidates = collectShotCollisionCandidates(shot, enemyCollisionBuckets, largeEnemyCollision, shotCollisionCandidates)
      for (const enemy of collisionCandidates) {
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
            playBossCriticalStinger(enemy)
            enemy.hitFlash = Math.max(enemy.hitFlash ?? 0, enemy.isBoss ? 0.24 : enemy.isMiniBoss ? 0.18 : 0.12)
          }
          spawnSparks(shot.x, shot.y, bossShielded ? '#fbbf24' : enemy.isBoss ? '#fff7ad' : enemy.isMiniBoss ? '#e9d5ff' : '#fca5a5', enemy.isBoss ? 10 : enemy.isMiniBoss ? 7 : 4, enemy.isBoss || enemy.isMiniBoss ? 6 : 4)
          if (!bossShielded && (enemy.isBoss || enemy.isMiniBoss)) {
            addRipple(shot.x, shot.y, enemy.isBoss ? '#fca5a5' : '#c084fc', enemy.isBoss ? 7 : 5)
          }
          if (isCoreLanderAoeShot(shot) && !bossShielded) {
            detonateCoreLanderBlast(shot, enemy.id)
            shot.y = -999
          } else if (shot.pierce && shot.pierce > 0) {
            shot.pierce -= 1
          } else {
            // rocket explosion
            if (shot.kind === 'rocket') {
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
            enemiesDestroyedRef.current += 1
            if (enemy.isBoss) {
              bossesDefeatedRef.current += 1
              enemy.defeatTimer = STAGE_CLEAR_SECONDS
              if (enemy.bossKind === 'devil') {
                devilBossDefeatedRef.current = true
                enemy.devilDefeatedTimer = enemy.defeatTimer
                enemy.devilVisualPose = 'rage'
                enemy.devilPoseChangedAt = now
              }
            }
            const scoreValue = getRaidEnemyScoreValue(enemy, waveRef.current)
            player.score += Math.round(scoreValue * scoreMult)
            if (remotePlayerRef.current) {
              remotePlayerRef.current.score += Math.round(scoreValue * scoreMult)
            }
            spawnSparks(enemy.x, enemy.y, enemy.isBoss ? '#fda4af' : enemy.isMiniBoss ? '#c084fc' : '#fb7185', enemy.isBoss ? 60 : enemy.isMiniBoss ? 42 : 18, enemy.isBoss ? 8 : enemy.isMiniBoss ? 7 : 5)
            addRipple(enemy.x, enemy.y, enemy.isBoss ? '#fb7185' : enemy.isMiniBoss ? '#a855f7' : '#f97316', enemy.isBoss ? 18 : enemy.isMiniBoss ? 14 : 9)
            if (enemy.isMiniBoss) {
              spawnPowerUp(enemy.x, enemy.y, Math.random() < 0.55)
            } else if (!enemy.isBoss) spawnPowerUp(enemy.x, enemy.y)
            if (enemy.isBoss) {
              playBossCriticalStinger(enemy, true)
              bossDefeatedThisFrame = true
              const clearedStage = stageRef.current
              const nextBossRushStage = raidModeRef.current === 'bossRush' ? getNextBossRushStage(clearedStage) : undefined
              const startNormalRaidDevilBonus =
                raidModeRef.current === 'campaign' &&
                enemy.bossKind === 'final' &&
                clearedStage >= MAX_RAID_STAGE &&
                normalRaidDevilBonusEligibleRef.current &&
                !normalRaidDevilBonusTriggeredRef.current
              if (startNormalRaidDevilBonus) {
                normalRaidDevilBonusTriggeredRef.current = true
                preserveLoadoutForSuperBoss = true
                pendingNextStageRef.current = NORMAL_RAID_DEVIL_BONUS_STAGE
                unlockedStageRef.current = MAX_RAID_STAGE
                if (!coOpRunRef.current) {
                  saveUnlockedStage(MAX_RAID_STAGE)
                  saveCheckpointStage(14)
                }
                bossAlertRef.current = 2.4
                bossMessageRef.current = 'clear'
              } else if (raidModeRef.current === 'bossRush' ? nextBossRushStage === null : raidModeRef.current !== 'endless' && clearedStage >= MAX_RAID_STAGE) {
                completedRun = true
                victoryPendingRef.current = true
                if (raidModeRef.current === 'campaign') {
                  unlockedStageRef.current = MAX_RAID_STAGE
                }
                if (raidModeRef.current === 'campaign' && !coOpRunRef.current) {
                  saveUnlockedStage(MAX_RAID_STAGE)
                  saveCheckpointStage(14)
                }
                bossAlertRef.current = 2.4
                bossMessageRef.current = 'clear'
              } else {
                const nextStage = raidModeRef.current === 'bossRush' ? nextBossRushStage ?? BOSS_RUSH_STAGES[0] : clearedStage + 1
                preserveLoadoutForSuperBoss = raidModeRef.current === 'bossRush' || nextStage % 5 === 0
                pendingNextStageRef.current = nextStage
                if (raidModeRef.current === 'campaign') {
                  unlockedStageRef.current = Math.max(unlockedStageRef.current, Math.min(nextStage, MAX_RAID_STAGE))
                  if (!coOpRunRef.current) saveUnlockedStage(unlockedStageRef.current)
                }
                if (raidModeRef.current === 'campaign' && !coOpRunRef.current && (RAID_CHECKPOINTS as readonly number[]).includes(nextStage)) {
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
    compactInPlace(shotsRef.current, (shot) => shot.y > -50)
    if (bossDefeatedThisFrame) {
      const defeatedBoss = enemiesRef.current.find((enemy) => enemy.isBoss && enemy.hp <= 0)
      triggerScreenShake(defeatedBoss?.bossKind === 'devil' || defeatedBoss?.bossKind === 'final' ? 4 : 3, 520)
      const scheduleBossDefeatExplosions = (boss: Enemy, dropLevelUp: boolean) => {
        const explosionDelays = [80, 220, 380, 560, 760, 980, 1220, 1500, 1840, 2220, 2620]
        for (let index = 0; index < explosionDelays.length; index += 1) {
          bossDefeatExplosionEventsRef.current.push({ boss, age: 0, delay: explosionDelays[index] / 1000, index })
        }
        if (dropLevelUp) spawnLevelUpPowerUp(boss.x, boss.y)
      }
      if (completedRun) {
        shotsRef.current = []
        enemyShotsRef.current = []
        godBarrageRef.current = null
        enemiesRef.current = defeatedBoss ? [defeatedBoss] : []
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
        if (defeatedBoss) scheduleBossDefeatExplosions(defeatedBoss, false)
        return
      }
      if (preserveLoadoutForSuperBoss) {
        extendLoadoutForSuperBoss(player)
        if (remotePlayerRef.current) extendLoadoutForSuperBoss(remotePlayerRef.current)
      } else {
        resetStageLoadout(player)
        if (remotePlayerRef.current) resetStageLoadout(remotePlayerRef.current)
      }
      if (defeatedBoss?.bossKind === 'devil') {
        player.rank = devilPreBuffRankRef.current
        if (remotePlayerRef.current) remotePlayerRef.current.rank = devilPreBuffRankRef.current
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
      bossTimerRef.current =
        raidModeRef.current === 'bossRush' || pendingNextStageRef.current === NORMAL_RAID_DEVIL_BONUS_STAGE
          ? BOSS_RUSH_NEXT_BOSS_DELAY_SECONDS
          : BOSS_RESPAWN_SECONDS
      stageClearRef.current = STAGE_CLEAR_SECONDS
      spawnLockRef.current = STAGE_CLEAR_SECONDS + 1.2
      shotsRef.current = []
      enemyShotsRef.current = []
      godBarrageRef.current = null
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
        scheduleBossDefeatExplosions(defeatedBoss, true)
      }
      addRipple(player.x, player.y, '#fca5a5', 12)
    }

    for (const enemyShot of enemyShotsRef.current) {
      const hitRange = enemyShot.radius + PLAYER_RADIUS
      for (const targetPlayer of livingPlayersThisTick) {
        if (targetPlayer.hp <= 0) continue
        if (enemyShot.kind === 'beam' && enemyShot.life !== undefined) {
          const beamHitRange = enemyShot.radius * 0.82 + PLAYER_RADIUS * 0.72
          const beamHits = enemyShot.angle === undefined
            ? Math.abs(enemyShot.x - targetPlayer.x) <= beamHitRange
            : Math.abs((targetPlayer.x - enemyShot.x) * Math.sin(enemyShot.angle) - (targetPlayer.y - enemyShot.y) * Math.cos(enemyShot.angle)) <= beamHitRange
          if (beamHits) {
            damagePlayer(enemyShot.damage, targetPlayer)
          }
          continue
        }
        if (
          Math.abs(enemyShot.x - targetPlayer.x) <= hitRange &&
          Math.abs(enemyShot.y - targetPlayer.y) <= hitRange &&
          distSq(enemyShot, targetPlayer) <= hitRange * hitRange
        ) {
          if (enemyShot.kind === 'squidBubble') {
            splitSquidBubble({ ...enemyShot })
            enemyShot.life = 0
          }
          enemyShot.y = HEIGHT + 99
          damagePlayer(enemyShot.kind === 'boss' || enemyShot.kind === 'plasma' || enemyShot.kind === 'blade' || enemyShot.kind === 'orbShot' || enemyShot.kind === 'superShot' || enemyShot.kind === 'beam' || enemyShot.kind === 'scatterBoss' || enemyShot.kind === 'poisonCloud' ? 1 : enemyShot.damage, targetPlayer)
          break
        }
      }
    }
    const enemyShotList = compactInPlace(enemyShotsRef.current, (shot) => {
      const margin = shot.kind === 'beam' && shot.life !== undefined ? 120 : shot.kind === 'squidBubble' || shot.kind === 'poisonCloud' ? 34 : 24
      return shot.y > -margin && shot.y < HEIGHT + margin && shot.x > -margin && shot.x < WIDTH + margin
    })
    for (const bubble of spawnedSquidBubbles) enemyShotList.push(bubble)
    spawnedSquidBubbles.length = 0

    for (const enemy of enemiesRef.current) {
      const hitRange = enemy.radius + PLAYER_RADIUS
      for (const targetPlayer of livingPlayersThisTick) {
        if (targetPlayer.hp <= 0) continue
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
              targetPlayer.score += Math.round((70 + waveRef.current * 10) * scoreMult)
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
      for (const targetPlayer of livingPlayersThisTick) {
        if (targetPlayer.hp <= 0) continue
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
      for (const targetPlayer of livingPlayersThisTick) {
        if (targetPlayer.hp <= 0) continue
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
    compactInPlace(meteorsRef.current, (meteor) => meteor.life > 0)

    for (const strike of ionStrikesRef.current) {
      if (strike.warmup > 0) continue
      for (const targetPlayer of livingPlayersThisTick) {
        if (targetPlayer.hp <= 0) continue
        if (Math.abs(targetPlayer.x - strike.x) <= strike.width * 0.62 + PLAYER_RADIUS) {
          damagePlayer(1, targetPlayer)
        }
      }
    }

    for (const wreck of wrecksRef.current) {
      if (wreck.hp <= 0) continue
      for (const targetPlayer of livingPlayersThisTick) {
        if (targetPlayer.hp <= 0) continue
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
    compactInPlace(wrecksRef.current, (wreck) => wreck.hp > 0)

    const asteroidList = compactInPlace(asteroidsRef.current, (asteroid) => asteroid.hp > 0)
    if (spawnedAsteroids.length > 0) {
      const room = Math.max(0, MAX_ASTEROIDS - asteroidList.length)
      for (let index = 0; index < spawnedAsteroids.length && index < room; index += 1) {
        asteroidList.push(spawnedAsteroids[index])
      }
      spawnedAsteroids.length = 0
    }

    for (const powerUp of powerUpsRef.current) {
      const pickupAssist = powerUp.type === 'levelup' ? 4.2 : 1.8
      const hitRange = powerUp.radius + PLAYER_RADIUS + pickupAssist
      for (const targetPlayer of livingPlayersThisTick) {
        if (targetPlayer.hp <= 0) continue
        if (
          Math.abs(powerUp.x - targetPlayer.x) <= hitRange &&
          Math.abs(powerUp.y - targetPlayer.y) <= hitRange &&
          distSq(powerUp, targetPlayer) <= hitRange * hitRange
        ) {
          powerUp.y = HEIGHT + 99
          pickupsCollectedRef.current += 1
          if (powerUp.type === 'levelup') {
            const levelTargets = coOpRunRef.current ? livingPlayersThisTick : [targetPlayer]
            for (const levelTarget of levelTargets) {
              if (levelTarget.hp > 0) levelUpPlayer(levelTarget)
            }
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
            if (!isGodGundamBarragePilot(targetPlayer, progressRef.current)) {
              targetPlayer.optionTimer = 1
              targetPlayer.optionStacks = targetPlayer.ship.key === 'mesiah'
                ? Math.min(2, (targetPlayer.optionStacks ?? 0) + 1)
                : 1
            }
          } else {
            if (!isGodGundamBarragePilot(targetPlayer, progressRef.current)) {
              targetPlayer.weapons[powerUp.type] = Math.min(WEAPON_STACK_CAPS[powerUp.type], targetPlayer.weapons[powerUp.type] + 1)
              targetPlayer.weaponTimers[powerUp.type] = 1
            }
          }
          targetPlayer.score += Math.round(120 * scoreMult)
          spawnSparks(powerUp.x, powerUp.y, powerColor(powerUp.type), 24, 6)
          addRipple(powerUp.x, powerUp.y, powerColor(powerUp.type), 11)
          playPickupVoiceLine(powerUp.type)
          playGameSound('levelup')
          break
        }
      }
    }
    compactInPlace(powerUpsRef.current, (powerUp) => powerUp.y < HEIGHT + 20)

    if (player.score > highScoreRef.current) {
      highScoreRef.current = player.score
    }
    if (remotePlayerRef.current && remotePlayerRef.current.score > highScoreRef.current) {
      highScoreRef.current = remotePlayerRef.current.score
    }
  }, [activateNuke, addRipple, damagePlayer, destroyPlayerByBossCollision, detonateNuke, fireEnemy, firePlayer, getLivingPlayers, getNearestLivingPlayer, reportRaidRunComplete, spawnAsteroidCluster, spawnBoss, spawnEnemyAt, spawnFormation, spawnDevilEncounterAssist, spawnPowerUp, spawnLevelUpPowerUp, spawnSparks, startRaidBgm, startRandomRaidEvent, stopRaidBgm, submitRaidLeaderboardScore, triggerScreenShake])

  const getRaidFocusableControls = useCallback(() => {
    const root = rootRef.current
    if (!root) return []
    return Array.from(root.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex]:not([tabindex="-1"])')).filter((control) => {
      if (control.tabIndex < 0) return false
      const rect = control.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && getComputedStyle(control).visibility !== 'hidden'
    })
  }, [])

  const moveRaidMenuFocus = useCallback((direction: 1 | -1) => {
    const controls = getRaidFocusableControls()
    if (!controls.length) return
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const currentIndex = active ? controls.indexOf(active) : -1
    const nextIndex = currentIndex < 0 ? (direction > 0 ? 0 : controls.length - 1) : (currentIndex + direction + controls.length) % controls.length
    controls[nextIndex]?.focus()
  }, [getRaidFocusableControls])

  const activateRaidFocusedControl = useCallback(() => {
    const controls = getRaidFocusableControls()
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (active && controls.includes(active)) {
      active.click()
      return
    }
    controls[0]?.focus()
  }, [getRaidFocusableControls])

  const activateRaidBackControl = useCallback(() => {
    if (phaseRef.current === 'playing') {
      pauseGame()
      return
    }
    if (phaseRef.current === 'paused') {
      resumeGame()
      return
    }
    if (phaseRef.current === 'briefing') {
      phaseRef.current = 'select'
      syncSnapshot()
      return
    }
    exitRaid()
  }, [exitRaid, pauseGame, resumeGame, syncSnapshot])

  const pollRaidGamepads = useCallback((time: number) => {
    const gamepads = typeof navigator.getGamepads === 'function'
      ? Array.from(navigator.getGamepads()).filter((gamepad): gamepad is Gamepad => Boolean(gamepad?.connected))
      : []
    const clearPilotGamepadPointer = (pilot: 'p1' | 'p2') => {
      const activeRef = gamepadPointerActiveRef.current
      if (!activeRef[pilot]) return
      const targetRef = pilot === 'p1' ? pointerTargetRef : remotePointerTargetRef
      const visualRef = pilot === 'p1' ? pointerVisualRef : remotePointerVisualRef
      targetRef.current = null
      visualRef.current = null
      activeRef[pilot] = false
    }
    if (!gamepads.length) {
      clearPilotGamepadPointer('p1')
      clearPilotGamepadPointer('p2')
      gamepadButtonsRef.current = new Map()
      gamepadPilotAssignmentsRef.current = { p1: null, p2: null }
      return
    }
    const connectedIndexes = new Set(gamepads.map((gamepad) => gamepad.index))
    const assignments = gamepadPilotAssignmentsRef.current
    if (assignments.p1 !== null && !connectedIndexes.has(assignments.p1)) {
      assignments.p1 = null
      clearPilotGamepadPointer('p1')
    }
    if (assignments.p2 !== null && !connectedIndexes.has(assignments.p2)) {
      assignments.p2 = null
      clearPilotGamepadPointer('p2')
    }
    for (const gamepad of gamepads) {
      if (assignments.p1 === gamepad.index || assignments.p2 === gamepad.index) continue
      if (assignments.p1 === null) {
        assignments.p1 = gamepad.index
      } else if (sameScreenCoopRef.current && assignments.p2 === null) {
        assignments.p2 = gamepad.index
      }
    }
    if (!sameScreenCoopRef.current && assignments.p2 !== null) {
      assignments.p2 = null
      clearPilotGamepadPointer('p2')
    }
    const nextButtons = new Map<number, Set<number>>()
    const getPressedButtons = (gamepad: Gamepad) => {
      const pressed = new Set<number>()
      gamepad.buttons.forEach((button, index) => {
        if (button.pressed || button.value > 0.55) pressed.add(index)
      })
      nextButtons.set(gamepad.index, pressed)
      return pressed
    }
    const getJustPressed = (gamepad: Gamepad, pressed: Set<number>, button: number) => {
      const previous = gamepadButtonsRef.current.get(gamepad.index)
      return pressed.has(button) && !previous?.has(button)
    }
    const getAxis = (value: number | undefined) => {
      const axis = value ?? 0
      return Math.abs(axis) < GAMEPAD_AXIS_DEADZONE ? 0 : clamp(axis, -1, 1)
    }
    const applyPilotMovement = (pilot: 'p1' | 'p2', pilotPlayer: Player | null, gamepad: Gamepad | null, pressed: Set<number> | null) => {
      if (!pilotPlayer || pilotPlayer.hp <= 0 || !gamepad || !pressed) return
      const dpadX = (pressed.has(GAMEPAD_BUTTON_DPAD_RIGHT) ? 1 : 0) - (pressed.has(GAMEPAD_BUTTON_DPAD_LEFT) ? 1 : 0)
      const dpadY = (pressed.has(GAMEPAD_BUTTON_DPAD_DOWN) ? 1 : 0) - (pressed.has(GAMEPAD_BUTTON_DPAD_UP) ? 1 : 0)
      const axisX = dpadX !== 0 ? dpadX : getAxis(gamepad.axes[0])
      const axisY = dpadY !== 0 ? dpadY : getAxis(gamepad.axes[1])
      const activeRef = gamepadPointerActiveRef.current
      const targetRef = pilot === 'p1' ? pointerTargetRef : remotePointerTargetRef
      const visualRef = pilot === 'p1' ? pointerVisualRef : remotePointerVisualRef
      if (axisX !== 0 || axisY !== 0) {
        const magnitude = Math.min(1, Math.hypot(axisX, axisY))
        const target = {
          x: clamp(pilotPlayer.x + axisX * GAMEPAD_POINTER_LEAD * magnitude, 4, 96),
          y: clamp(pilotPlayer.y + axisY * GAMEPAD_POINTER_LEAD * magnitude, 13, 93),
        }
        targetRef.current = target
        visualRef.current = target
        activeRef[pilot] = true
      } else if (activeRef[pilot]) {
        targetRef.current = null
        visualRef.current = null
        activeRef[pilot] = false
      }
    }
    const p1Gamepad = assignments.p1 !== null ? gamepads.find((gamepad) => gamepad.index === assignments.p1) ?? null : null
    const p2Gamepad = sameScreenCoopRef.current && assignments.p2 !== null ? gamepads.find((gamepad) => gamepad.index === assignments.p2) ?? null : null
    if (!p1Gamepad) clearPilotGamepadPointer('p1')
    if (!p2Gamepad) clearPilotGamepadPointer('p2')
    const p1Pressed = p1Gamepad ? getPressedButtons(p1Gamepad) : null
    const p2Pressed = p2Gamepad ? getPressedButtons(p2Gamepad) : null
    const remotePlayer = remotePlayerRef.current
    if (phaseRef.current === 'playing') {
      applyPilotMovement('p1', playerRef.current, p1Gamepad, p1Pressed)
      if (sameScreenCoopRef.current) applyPilotMovement('p2', remotePlayer, p2Gamepad, p2Pressed)
      if (p1Gamepad && p1Pressed) {
        if (getJustPressed(p1Gamepad, p1Pressed, GAMEPAD_BUTTON_START)) pauseGame()
        if (
          getJustPressed(p1Gamepad, p1Pressed, GAMEPAD_BUTTON_SPECIAL) ||
          getJustPressed(p1Gamepad, p1Pressed, GAMEPAD_BUTTON_SPECIAL_ALT)
        ) {
          activateNuke(playerRef.current)
        }
      }
      if (sameScreenCoopRef.current && p2Gamepad && p2Pressed && remotePlayer) {
        if (
          getJustPressed(p2Gamepad, p2Pressed, GAMEPAD_BUTTON_SPECIAL) ||
          getJustPressed(p2Gamepad, p2Pressed, GAMEPAD_BUTTON_SPECIAL_ALT)
        ) {
          activateNuke(remotePlayer)
        }
      }
    } else if (p1Gamepad && p1Pressed) {
      const dpadX = (p1Pressed.has(GAMEPAD_BUTTON_DPAD_RIGHT) ? 1 : 0) - (p1Pressed.has(GAMEPAD_BUTTON_DPAD_LEFT) ? 1 : 0)
      const dpadY = (p1Pressed.has(GAMEPAD_BUTTON_DPAD_DOWN) ? 1 : 0) - (p1Pressed.has(GAMEPAD_BUTTON_DPAD_UP) ? 1 : 0)
      const navX = Math.abs(p1Gamepad.axes[0] ?? 0) > GAMEPAD_MENU_AXIS_THRESHOLD ? Math.sign(p1Gamepad.axes[0] ?? 0) : dpadX
      const navY = Math.abs(p1Gamepad.axes[1] ?? 0) > GAMEPAD_MENU_AXIS_THRESHOLD ? Math.sign(p1Gamepad.axes[1] ?? 0) : dpadY
      if (time >= gamepadNextMenuNavRef.current && (navX !== 0 || navY !== 0)) {
        moveRaidMenuFocus(navX > 0 || navY > 0 ? 1 : -1)
        gamepadNextMenuNavRef.current = time + 180
      }
      if (getJustPressed(p1Gamepad, p1Pressed, GAMEPAD_BUTTON_CONFIRM)) {
        activateRaidFocusedControl()
      }
      if (getJustPressed(p1Gamepad, p1Pressed, GAMEPAD_BUTTON_CANCEL)) {
        activateRaidBackControl()
      }
      if (getJustPressed(p1Gamepad, p1Pressed, GAMEPAD_BUTTON_START)) {
        if (phaseRef.current === 'paused') resumeGame()
        else if (phaseRef.current === 'briefing') resetGame()
        else if (phaseRef.current !== 'victory') activateRaidFocusedControl()
      }
    }
    gamepadButtonsRef.current = nextButtons
  }, [activateNuke, activateRaidBackControl, activateRaidFocusedControl, moveRaidMenuFocus, pauseGame, resetGame, resumeGame])

  useEffect(() => {
    const tick = (time: number) => {
      const dt = Math.min(0.033, (time - lastTimeRef.current) / 1000 || 0)
      lastTimeRef.current = time
      pollRaidGamepads(time)
      const entranceSlamActive = phaseRef.current === 'playing' && bossEntranceSlamRef.current > 0
      if (bossEntranceSlamRef.current > 0) {
        bossEntranceSlamRef.current = Math.max(0, bossEntranceSlamRef.current - dt)
      }
      const gameplayDt = entranceSlamActive ? dt * BOSS_ENTRANCE_SLOWMO_SCALE : dt
      const session = multiplayerSessionRef.current
      if (!session || session.isHost) updateGame(gameplayDt)
      // Tick the victory blackout on every client (host sets it in updateGame, guest in applyMultiplayerState)
      if (victoryBlackoutRef.current > 0) {
        victoryBlackoutRef.current = Math.max(0, victoryBlackoutRef.current - dt)
      }
      if (session?.isHost) sendMultiplayerState(time)
      else if (session) {
        predictGuestPlayer(gameplayDt)
        advanceGuestVisuals(gameplayDt)
        sendMultiplayerInput(time)
      }
      if (session) updateMultiplayerConnection(time)
      // Throttle canvas redraws to ~30 fps during idle (non-playing) phases to reduce GPU load and heat.
      const phase = phaseRef.current
      const isIdlePhase = phase === 'select' || phase === 'briefing' || phase === 'paused'
      if (!isIdlePhase || time - lastIdleDrawTimeRef.current >= 33) {
        if (isIdlePhase) lastIdleDrawTimeRef.current = time
        drawFxCanvas(time)
      }
      const renderInterval = phase === 'playing'
        ? (stageClearRef.current > 0 || bossAlertRef.current > 0 ? GAMEPLAY_ALERT_SNAPSHOT_INTERVAL_MS : GAMEPLAY_SNAPSHOT_INTERVAL_MS)
        : IDLE_SNAPSHOT_INTERVAL_MS
      if (time - lastRenderTimeRef.current >= renderInterval) {
        lastRenderTimeRef.current = time
        if (!session || session.isHost) syncSnapshot()
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    // Pause the animation loop when the browser tab / app is hidden to conserve CPU, GPU, and battery.
    const handleVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      } else if (rafRef.current === 0) {
        // Reset last-time so the first tick after resuming doesn't produce a huge dt spike.
        lastTimeRef.current = performance.now()
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafRef.current)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [advanceGuestVisuals, drawFxCanvas, pollRaidGamepads, predictGuestPlayer, sendMultiplayerInput, sendMultiplayerState, syncSnapshot, updateGame, updateMultiplayerConnection])

  useEffect(() => {
    const p1Keys = new Set(['w', 'a', 's', 'd'])
    const p2Keys = new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright'])
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (phaseRef.current !== 'playing' && (key === 'arrowright' || key === 'arrowdown' || key === 'arrowleft' || key === 'arrowup')) {
        event.preventDefault()
        moveRaidMenuFocus(key === 'arrowright' || key === 'arrowdown' ? 1 : -1)
        return
      }
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
        else exitRaid()
      }
      if (sameScreenCoopRef.current && phaseRef.current === 'playing') {
        if (event.code === 'Space') {
          event.preventDefault()
          if (!event.repeat) activateNuke(playerRef.current)
          return
        }
        if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
          event.preventDefault()
          if (!event.repeat && remotePlayerRef.current) activateNuke(remotePlayerRef.current)
          return
        }
        if (p1Keys.has(key)) {
          event.preventDefault()
          keysRef.current.add(key)
          return
        }
        if (p2Keys.has(key)) {
          event.preventDefault()
          remoteKeysRef.current.add(key)
          return
        }
      }
      if (event.code === 'Space' && phaseRef.current === 'playing') {
        event.preventDefault()
        if (!event.repeat) activateNuke()
        return
      }
      keysRef.current.add(key)
    }
    const up = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (sameScreenCoopRef.current) {
        if (p1Keys.has(key)) keysRef.current.delete(key)
        if (p2Keys.has(key)) remoteKeysRef.current.delete(key)
        return
      }
      keysRef.current.delete(key)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [activateNuke, exitRaid, moveRaidMenuFocus, pauseGame, resetGame, resumeGame, syncSnapshot])

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
  const raidText = getRaidText(language)
  const hudText = raidText.hud
  const menuText = raidText.menu
  const briefingPanels = raidText.briefingPanels
  const hpPips = Array.from({ length: player.maxHp }, (_, index) => index < player.hp)
  const forcePips = Array.from({ length: Math.max(FORCE_FIELD_ARMOR, Math.ceil(player.forceField)) }, (_, index) => index < player.forceField)
  const weaponEntries = WEAPON_KEYS.filter((key) => player.weapons[key] > 0)
  const briefing = briefingPanels[briefingStep] ?? briefingPanels[0]
  const stageClearProgress = snapshot.stageClear > 0 ? 1 - snapshot.stageClear / STAGE_CLEAR_SECONDS : 0
  const stageFlashOpacity =
    stageClearProgress > 0.66 && stageClearProgress < 0.9
      ? Math.sin(((stageClearProgress - 0.66) / 0.24) * Math.PI)
      : 0
  const completedCampaign = hasProgressionUnlockOverride() || snapshot.unlockedStage >= MAX_RAID_STAGE || hasClearedRaidInProgress(progressRef.current)
  const mesiahUnlocked = completedCampaign
  const coreLanderUnlocked = isCoreLanderUnlocked(progressRef.current)
  const mesiahVisualShipKey = getMesiahVisualShipKeyFromProgress(progressRef.current)
  const coreLanderVisualShipKey = getCoreLanderModel(progressRef.current)
  const playerVisualShipKey = getRaidPlayerVisualShipKey(player, progressRef.current)
  const allyVisualShipKey = snapshot.allyPlayer ? getRaidPlayerVisualShipKey(snapshot.allyPlayer, progressRef.current) : ''
  const checkpointStage = getCheckpointStage()
  const stageSelectButtons = Array.from({ length: MAX_RAID_STAGE }, (_, index) => index + 1)
  const usingGodBarrage = player.ship.key === 'coreLander' && (playerVisualShipKey === 'godGundam' || playerVisualShipKey === 'spiegel')
  const nukeCooldown = Math.ceil(snapshot.nukeCooldown)
  const nukeStageLocked = snapshot.phase === 'playing' && snapshot.stageClear > 0
  const nukeReady = snapshot.phase === 'playing' && !nukeStageLocked && snapshot.nukeCooldown <= 0
  const specialLabel = usingGodBarrage ? hudText.barrage : hudText.nuke
  const specialLaunchLabel = usingGodBarrage ? hudText.launchBarrage : hudText.launchNuke
  const specialLockedLabel = usingGodBarrage ? hudText.barrageLocked : hudText.nukeLocked
  const specialCoolingLabel = usingGodBarrage ? hudText.barrageCooling : hudText.nukeCooling
  const specialAvailableLabel = usingGodBarrage ? hudText.barrageAvailable : hudText.nukeAvailable
  const nukeDisplay = snapshot.phase === 'playing' && snapshot.nukeCooldown > 0 ? `${nukeCooldown}s` : specialLabel
  const nukeHint = snapshot.phase === 'playing' && snapshot.nukeCooldown > 0 ? hudText.cooldown : hudText.space
  const bossIncoming = snapshot.bossAlert > 0 && snapshot.bossMessage === 'incoming'
  const bossClear = snapshot.bossAlert > 0 && snapshot.bossMessage === 'clear'
  const bossEntranceSlam = snapshot.phase === 'playing'
    ? clamp(snapshot.bossEntranceSlam / BOSS_ENTRANCE_SLAM_SECONDS, 0, 1)
    : 0
  const bossEntranceSlamActive = bossEntranceSlam > 0
  const isNetworkMultiplayer = Boolean(multiplayerSession)
  const isMultiplayer = isNetworkMultiplayer || sameScreenCoop
  const isEndlessRun = snapshot.raidMode === 'endless'
  const isBossRushRun = snapshot.raidMode === 'bossRush'
  const canControlOverlay = !isNetworkMultiplayer || Boolean(multiplayerSession?.isHost)
  const canUseCampaignStageTools = !isEndlessRun && !isBossRushRun && !isMultiplayer && completedCampaign && canControlOverlay
  const canContinueCampaignCheckpoint = !isEndlessRun && !isBossRushRun && !isMultiplayer && (snapshot.phase === 'gameover' || snapshot.phase === 'select') && checkpointStage > 1
  const primaryRaidMenuLabel = snapshot.phase === 'gameover'
    ? isMultiplayer ? menuText.restartCoop : isBossRushRun ? menuText.restartBossRush : isEndlessRun ? menuText.restartEndless : menuText.restartStage1
    : isBossRushRun ? menuText.startBossRushRaid : isEndlessRun ? menuText.startEndlessRaid : menuText.startRaid
  const startCurrentRaidMode = () => {
    if (snapshot.phase === 'gameover') {
      resetGame(isBossRushRun ? BOSS_RUSH_STAGES[0] : 1, isBossRushRun, isBossRushRun ? 'bossRush' : isEndlessRun ? 'endless' : 'campaign')
      return
    }
    if (isBossRushRun) {
      resetGame(BOSS_RUSH_STAGES[0], true, 'bossRush')
      return
    }
    if (isEndlessRun) {
      resetGame(1, false, 'endless')
      return
    }
    openBriefing()
  }
  const [graphicsQuality, setGraphicsQualityState] = useState<GraphicsQuality>(() => getGraphicsQuality())
  const applyGraphicsQuality = (q: GraphicsQuality) => {
    graphicsQualityRef.current = q
    viewportMetricsRef.current = null
    setGraphicsQuality(q)
    setGraphicsQualityState(q)
  }
  const updateAudioMix = (key: keyof AudioMixSettings, value: number) => {
    const nextMix = { ...audioMix, [key]: Math.max(0, Math.min(1, value)) }
    setAudioMix(nextMix)
    setGameAudioMixSettings(nextMix)
    const audio = raidBgmElementRef.current
    const mode = raidBgmModeRef.current
    if (audio && mode) {
      const modeVolume = mode === 'ending' ? 0.42 : mode === 'boss' ? 0.58 : mode === 'combat' ? 0.34 : 0.22
      const targetVolume = Math.max(0, Math.min(1, modeVolume * nextMix.master * nextMix.bgm))
      raidBgmTargetVolumeRef.current = targetVolume
      if (raidBgmDuckRestoreTimerRef.current <= 0) audio.volume = targetVolume
    }
  }
  const audioMixControls: Array<{ key: keyof AudioMixSettings; label: string }> = [
    { key: 'master', label: menuText.masterVolume },
    { key: 'bgm', label: menuText.bgmVolume },
    { key: 'player', label: menuText.playerShotsVolume },
    { key: 'beam', label: menuText.beamVolume },
    { key: 'explosion', label: menuText.explosionVolume },
    { key: 'impact', label: menuText.impactVolume },
    { key: 'ui', label: menuText.uiVolume },
  ]
  const difficultyOptions: Array<{ key: RaidDifficulty; label: string; description: string }> = [
    { key: 'easy', label: menuText.diffEasy, description: menuText.diffEasyDesc },
    { key: 'normal', label: menuText.diffNormal, description: menuText.diffNormalDesc },
    { key: 'hard', label: menuText.diffHard, description: menuText.diffHardDesc },
    { key: 'expert', label: menuText.diffExpert, description: menuText.diffExpertDesc },
  ]
  const selectedDifficultyLabel = difficultyOptions.find((option) => option.key === selectedDifficulty)?.label ?? menuText.diffNormal
  const connectionClass = `raid__connection raid__connection--${multiplayerConnection.quality}`
  const finalScore = Math.max(player.score, snapshot.allyPlayer?.score ?? 0)
  const finaleShipSize = getShipSpriteSize(player.ship.key, 'picker') + 22
  const finaleAllyShipSize = snapshot.allyPlayer ? getShipSpriteSize(snapshot.allyPlayer.ship.key, 'picker') + 10 : 0
  const endingWingmen = ['xwing', 'dreadnought', 'spaceEt'].filter((shipKey) => shipKey !== player.ship.key && shipKey !== snapshot.allyPlayer?.ship.key)
  const endingBossesDefeated = Math.max(bossesDefeatedRef.current, snapshot.phase === 'victory' ? 3 : 0)
  const endingNukesUsed = nukesUsedRef.current
  const assetPreloadPercent = Math.min(100, Math.round(assetPreload.loaded / Math.max(1, assetPreload.total) * 100))
  const showAssetPreloadOverlay = assetPreload.status !== 'ready' && snapshot.phase !== 'playing' && snapshot.phase !== 'paused' && snapshot.phase !== 'victory'
  const displayedShipOptions = SHIP_OPTIONS
  const getWeaponStackLabel = (hudPlayer: Player) => {
    const entries = WEAPON_KEYS.filter((key) => hudPlayer.weapons[key] > 0)
    return entries.length ? entries.map((key) => `${key[0].toUpperCase()}${hudPlayer.weapons[key]}`).join(' ') : hudText.base
  }
  const renderHullPips = (hudPlayer: Player, keyPrefix: string) => {
    const hullPips = Array.from({ length: hudPlayer.maxHp }, (_, index) => index < hudPlayer.hp)
    const fieldPips = Array.from({ length: Math.max(FORCE_FIELD_ARMOR, Math.ceil(hudPlayer.forceField)) }, (_, index) => index < hudPlayer.forceField)
    return (
      <>
        {hullPips.map((filled, index) => <i key={`${keyPrefix}-hull-${index}`} className={filled ? 'raid__pip raid__pip--filled' : 'raid__pip'} />)}
        {hudPlayer.forceField > 0 && fieldPips.map((filled, index) => (
          <i key={`${keyPrefix}-force-${index}`} className={filled ? 'raid__pip raid__pip--force raid__pip--filled' : 'raid__pip raid__pip--force'} />
        ))}
      </>
    )
  }
  const getPilotSpecialHud = (hudPlayer: Player, controlHint: string) => {
    const visualShipKey = getRaidPlayerVisualShipKey(hudPlayer, progressRef.current)
    const usesBarrage = hudPlayer.ship.key === 'coreLander' && (visualShipKey === 'godGundam' || visualShipKey === 'spiegel')
    const label = usesBarrage ? hudText.barrage : hudText.nuke
    const cooldown = Math.ceil(hudPlayer.specialCooldown ?? 0)
    const hint = snapshot.phase === 'playing' && cooldown > 0
      ? `${cooldown}s`
      : nukeStageLocked
      ? hudText.cooldown
      : controlHint
    return { label, hint }
  }
  const renderPilotHud = (hudPlayer: Player, pilotKey: 'p1' | 'p2', pilotLabel: string, controlHint: string) => {
    const specialHud = getPilotSpecialHud(hudPlayer, controlHint)
    return (
      <div className={`raid__pilot-panel raid__pilot-panel--${pilotKey}`}>
        <div className="raid__pilot-tag">
          <b>{pilotLabel}</b>
          <span>{hudPlayer.ship.name}</span>
        </div>
        <div className="raid__stat">
          <span>{hudText.score}</span>
          <b>{hudPlayer.score.toLocaleString()}</b>
        </div>
        <div className="raid__stat">
          <span>{hudText.stage}</span>
          <b>{snapshot.stageTheme}</b>
        </div>
        <div className="raid__stat raid__stat--level">
          <span>{hudText.level}</span>
          <b>LV {hudPlayer.rank} ATK {getPlayerBaseAttack(hudPlayer).toFixed(1)}</b>
        </div>
        <div className="raid__stat raid__stat--weapon">
          <span>{hudText.stack}</span>
          <b>{getWeaponStackLabel(hudPlayer)}</b>
        </div>
        <div className="raid__hp raid__hp--pilot" aria-label={`${pilotLabel} ${hudText.hullAndForce}`}>
          {renderHullPips(hudPlayer, pilotKey)}
        </div>
        <div className="raid__pilot-special">
          <span>{specialHud.label}</span>
          <b>{specialHud.hint}</b>
        </div>
      </div>
    )
  }
  const sameScreenAlly = sameScreenCoop ? snapshot.allyPlayer : null

  return (
    <div
      className={`raid raid--theme-${((snapshot.stageTheme - 1) % RAID_BACKGROUND_THEME_COUNT) + 1}${sameScreenCoop ? ' raid--same-screen' : ''}`}
      ref={rootRef}
      onPointerDown={(event) => {
        if (sameScreenCoopRef.current) return
        if (isUiPointerTarget(event.target) || phaseRef.current !== 'playing') return
        updatePointer(event.clientX, event.clientY, event.pointerType)
        if (event.pointerType !== 'mouse') {
          touchPointerActiveRef.current = true
          event.currentTarget.setPointerCapture(event.pointerId)
        }
      }}
      onPointerMove={(event) => {
        if (sameScreenCoopRef.current) return
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
      {sameScreenAlly ? (
        <div className="raid__hud raid__hud--same-screen">
          {renderPilotHud(player, 'p1', 'P1', hudText.space)}
          <button className="raid__pause raid__pause--center" type="button" onClick={pauseGame}>{hudText.pause}</button>
          {renderPilotHud(sameScreenAlly, 'p2', 'P2', 'Shift')}
        </div>
      ) : (
        <div className="raid__hud">
          <div className="raid__stat">
            <span>{hudText.score}</span>
            <b>{player.score.toLocaleString()}</b>
          </div>
          <div className="raid__stat">
            <span>{hudText.stage}</span>
            <b>{snapshot.stageTheme}</b>
          </div>
          <div className="raid__stat raid__stat--level">
            <span>{hudText.level}</span>
            <b>LV {player.rank} ATK {playerBaseAttack.toFixed(1)}</b>
          </div>
          <div className="raid__stat raid__stat--weapon">
            <span>{hudText.stack}</span>
            <b>
              {weaponEntries.length
                ? weaponEntries.map((key) => `${key[0].toUpperCase()}${player.weapons[key]}`).join(' ')
                : hudText.base}
            </b>
          </div>
          <div className="raid__hp" aria-label={hudText.hullAndForce}>
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
            aria-label={nukeReady ? specialLaunchLabel : nukeStageLocked ? specialLockedLabel : snapshot.phase === 'playing' ? `${specialCoolingLabel} ${nukeCooldown} ${hudText.seconds}` : specialAvailableLabel}
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
          <button className="raid__pause" type="button" onClick={pauseGame}>{hudText.pause}</button>
        </div>
      )}

      {isNetworkMultiplayer && (
        <div className={connectionClass} aria-live="polite">
          <i aria-hidden="true" />
          <span>{multiplayerConnection.label}</span>
        </div>
      )}

      <div className="raid__playfield">
        <div ref={pixiBackgroundHostRef} className="raid__pixi-background" aria-hidden="true" />
        <canvas ref={fxCanvasRef} className="raid__fx-canvas" />
      </div>

      {bossEntranceSlamActive && (
        <div
          className="raid__boss-slam"
          style={{ opacity: 0.18 + bossEntranceSlam * 0.42 }}
          aria-hidden="true"
        />
      )}

      {nukeReady && (
        <button
          className="raid__nuke-quick"
          type="button"
          onClick={() => activateNuke()}
          aria-label={specialLaunchLabel}
        >
          <span className="raid__nuke-quick-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="raid__nuke-quick-text">{specialLabel}</span>
        </button>
      )}

      {showAssetPreloadOverlay && (
        <div className="raid__asset-loading" role="status" aria-live="polite">
          <div className="raid__asset-loading-panel">
            <div className="raid__kicker">{menuText.loadingAssets}</div>
            <strong>{assetPreloadPercent}%</strong>
            <div className="raid__asset-loading-bar" aria-hidden="true">
              <i style={{ width: `${assetPreloadPercent}%` }} />
            </div>
            <p>{assetPreloadPercent >= 100 ? menuText.loadingAssetsReady : menuText.loadingAssetsCopy}</p>
          </div>
        </div>
      )}

      {bossIncoming && (
        <div className={bossEntranceSlamActive ? 'raid__boss-warning raid__boss-warning--slam' : 'raid__boss-warning'} role="alert" aria-live="assertive">
          <div className="raid__boss-warning-panel raid__boss-warning-panel--top">
            <span>{hudText.attention}</span>
          </div>
          <div className="raid__boss-warning-panel raid__boss-warning-panel--main">
            <i aria-hidden="true" />
            <span>{hudText.securityAlert}</span>
            <i aria-hidden="true" />
          </div>
          <div className="raid__boss-warning-stripes" aria-hidden="true" />
          <small>{hudText.bossVectorIncoming}</small>
        </div>
      )}

      {bossClear && snapshot.phase !== 'victory' && (
        <div className="raid__boss-alert raid__boss-alert--clear">
          {hudText.bossDestroyed}
        </div>
      )}

      {snapshot.stageClear > 0 && (
        snapshot.raidMode !== 'endless' && snapshot.stageTheme >= MAX_RAID_STAGE
          // Final-stage fly-through: black fade instead of white flash � leads into ending cutscene
          ? <div className="raid__stage-flash" style={{
              opacity: stageClearProgress > 0.58 ? Math.min(1, (stageClearProgress - 0.58) / 0.32) : 0,
              background: '#000',
            }} />
          : <div className="raid__stage-flash" style={{ opacity: stageFlashOpacity }} />
      )}

      {snapshot.phase !== 'playing' && snapshot.phase === 'paused' && (
        <div className="raid__overlay">
          <div className="raid__panel raid__panel--pause">
            <div className="raid__kicker">{menuText.combatHold}</div>
            <h2>{menuText.paused}</h2>
            <div className="raid__records">
              <span>{hudText.stage} {snapshot.stageTheme}</span>
              <span>{hudText.score} {player.score.toLocaleString()}</span>
            </div>
            <div className="raid__pause-actions">
              {canControlOverlay ? <button type="button" className="raid__start" onClick={resumeGame}>{menuText.continue}</button> : null}
              <button type="button" className="raid__menu-button" onClick={() => setSettingsOpen(true)}>{menuText.settings}</button>
              {canControlOverlay ? <button type="button" className="raid__menu-button" onClick={() => resetGame()}>{menuText.restart}</button> : null}
              <button type="button" className="raid__menu-button" onClick={exitRaid}>{hudText.exit}</button>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (snapshot.phase === 'paused' || snapshot.phase === 'select' || snapshot.phase === 'gameover') && (
        <div className="raid__settings-overlay" role="dialog" aria-modal="true" aria-label={menuText.settings}>
          <div className="raid__panel raid__panel--settings">
            <div className="raid__kicker">{menuText.settings}</div>
            <h2>{menuText.audioSettings}</h2>
            <div className="raid__settings-section">
              <span className="raid__settings-heading">{menuText.graphics}</span>
              <div className="raid__gfx-row raid__gfx-row--settings">
                {(['low', 'medium', 'high', 'max'] as GraphicsQuality[]).map((q) => (
                  <button
                    key={q}
                    type="button"
                    className={graphicsQuality === q ? 'raid__gfx-btn raid__gfx-btn--active' : 'raid__gfx-btn'}
                    onClick={() => applyGraphicsQuality(q)}
                  >
                    {menuText[q]}
                  </button>
                ))}
              </div>
            </div>
            <div className="raid__settings-section">
              <span className="raid__settings-heading">{menuText.audioSettings}</span>
              <div className="raid__volume-list">
                {audioMixControls.map((control) => (
                  <label key={control.key} className="raid__volume-control">
                    <span>{control.label}</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={Math.round(audioMix[control.key] * 100)}
                      onChange={(event) => updateAudioMix(control.key, Number(event.target.value) / 100)}
                    />
                    <b>{Math.round(audioMix[control.key] * 100)}%</b>
                  </label>
                ))}
              </div>
            </div>
            <div className="raid__pause-actions">
              <button type="button" className="raid__start" onClick={() => setSettingsOpen(false)}>{menuText.close}</button>
            </div>
          </div>
        </div>
      )}

      {difficultyOpen && (snapshot.phase === 'paused' || snapshot.phase === 'select' || snapshot.phase === 'gameover') && (
        <div className="raid__settings-overlay" role="dialog" aria-modal="true" aria-label={menuText.selectDifficulty}>
          <div className="raid__panel raid__panel--settings raid__panel--difficulty">
            <div className="raid__kicker">{menuText.difficulty}</div>
            <h2>{menuText.selectDifficulty}</h2>
            <div className="raid__settings-section">
              <div className="raid__difficulty-grid">
                {difficultyOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`raid__difficulty-card raid__difficulty-card--${option.key}${selectedDifficulty === option.key ? ' raid__difficulty-card--active' : ''}`}
                    onClick={() => { setSelectedDifficulty(option.key); raidDifficultyRef.current = option.key }}
                  >
                    <b>{option.label}</b>
                    <span>{option.description}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="raid__pause-actions">
              <button type="button" className="raid__start" onClick={() => setDifficultyOpen(false)}>{menuText.close}</button>
            </div>
          </div>
        </div>
      )}

      {snapshot.phase === 'briefing' && (
        <div className="raid__overlay">
          <div className="raid__panel raid__panel--briefing">
            <div className="raid__kicker">{menuText.launchBriefing}</div>
            <h2>{briefing.title}</h2>
            <p className="raid__briefing-copy">{briefing.body}</p>
            {'items' in briefing && (
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
            )}
            {'bosses' in briefing && (
              <div className="raid__boss-briefing-list">
                {briefing.bosses.map((boss) => (
                  <article key={boss.kind} className="raid__boss-briefing-card raid__boss-briefing-card--intel">
                    <div className="raid__boss-briefing-copy">
                      <span>{boss.stage}</span>
                      <h3>{boss.name}</h3>
                      {boss.behavior.map((line) => <p key={line}>{line}</p>)}
                    </div>
                  </article>
                ))}
              </div>
            )}
            <div className="raid__briefing-progress" aria-label={menuText.briefingProgress}>
              {briefingPanels.map((panel, index) => (
                <button
                  key={panel.title}
                  type="button"
                  className={index === briefingStep ? 'raid__briefing-dot raid__briefing-dot--active' : 'raid__briefing-dot'}
                  onClick={() => setBriefingStep(index)}
                  aria-label={`${menuText.show} ${panel.title}`}
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
                {menuText.back}
              </button>
              <button type="button" className="raid__menu-button" onClick={() => resetGame()}>{menuText.skip}</button>
              <button
                type="button"
                className="raid__start"
                onClick={() => {
                  if (briefingStep < briefingPanels.length - 1) {
                    setBriefingStep((step) => Math.min(briefingPanels.length - 1, step + 1))
                    playGameSound('select')
                  } else {
                    resetGame()
                  }
                }}
              >
                {briefingStep < briefingPanels.length - 1 ? menuText.next : menuText.launch}
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
              <img className="raid__ending-galaxy raid__ending-galaxy--left" src={getPublicAssetUrl('assets/others/galaxy.webp')} alt="" draggable={false} />
              <img className="raid__ending-galaxy raid__ending-galaxy--right" src={getPublicAssetUrl('assets/others/galaxy_2.webp')} alt="" draggable={false} />
              <img className="raid__ending-sun-asset" src={getPublicAssetUrl('assets/others/sun.webp')} alt="" draggable={false} />
              <img className="raid__ending-comet" src={getPublicAssetUrl('assets/others/comet.webp')} alt="" draggable={false} />
              <img className="raid__ending-station" src={getPublicAssetUrl('assets/others/space_station.webp')} alt="" draggable={false} />
              <img className="raid__ending-asteroid raid__ending-asteroid--one" src={getPublicAssetUrl('assets/others/asteroid.webp')} alt="" draggable={false} />
              <img className="raid__ending-asteroid raid__ending-asteroid--two" src={getPublicAssetUrl('assets/others/asteroid.webp')} alt="" draggable={false} />
              <div className="raid__ending-sun" />
              <div className="raid__ending-final-burst">
                <i />
                <i />
                <i />
              </div>
              <img className="raid__ending-fortress" src={getPublicAssetUrl('assets/aliens/final_boss.png')} alt="" draggable={false} />
              <div className="raid__ending-retreat-wave">
                {[1, 4, 6].map((variant, index) => (
                  <img key={`ending-alien-${variant}`} src={getRaidAlienSpriteUrl(variant)} alt="" draggable={false} style={{ '--retreat-index': index } as CSSProperties} />
                ))}
                {[0, 3].map((variant, index) => (
                  <img key={`ending-elite-${variant}`} className="raid__ending-retreat-elite" src={getRaidEliteSpriteUrl(variant)} alt="" draggable={false} style={{ '--retreat-index': index + 3 } as CSSProperties} />
                ))}
              </div>
              <div className="raid__ending-earth" />
              <div className="raid__ending-city-lights">
                <i />
                <i />
                <i />
                <i />
              </div>
              <div className="raid__ending-home-signal">
                <span>{menuText.missionDebrief}</span>
                <b>{menuText.earthLineSecured}</b>
              </div>
              <div className="raid__ending-wake raid__ending-wake--host" />
              <div className="raid__ending-ship raid__ending-ship--host">
                <RaidShipSprite shipKey={playerVisualShipKey} size={finaleShipSize} />
              </div>
              {snapshot.allyPlayer ? (
                <>
                  <div className="raid__ending-wake raid__ending-wake--ally" />
                  <div className="raid__ending-ship raid__ending-ship--ally">
                    <RaidShipSprite shipKey={allyVisualShipKey} size={finaleAllyShipSize} />
                  </div>
                </>
              ) : null}
              <div className="raid__ending-fleet">
                {endingWingmen.map((shipKey, index) => (
                  <span key={shipKey} style={{ '--fleet-index': index } as CSSProperties}>
                    <RaidShipSprite shipKey={shipKey} size={44} />
                  </span>
                ))}
              </div>
            </div>

          <div className="raid__ending-panel">
            <div className="raid__kicker">{menuText.missionComplete}</div>
            <div className="raid__ending-medal" aria-hidden="true">
              <span>{MAX_RAID_STAGE}</span>
            </div>
            <h2 id="raid-ending-title">{menuText.earthLineSecured}</h2>
            <p>
              {menuText.endingCopy}
            </p>
            <div className="raid__ending-log" aria-label={menuText.missionDebrief}>
              {raidText.endingLines.map((line, index) => (
                <span key={line} style={{ '--ending-line': index } as CSSProperties}>
                  {line}
                </span>
              ))}
            </div>
            <p className="raid__ending-epilogue">{menuText.endingEpilogue}</p>
            <div className="raid__ending-stats">
              <span>
                <small>{hudText.stage}</small>
                <b>{MAX_RAID_STAGE}</b>
              </span>
              <span>
                <small>{hudText.bossDestroyed}</small>
                <b>{endingBossesDefeated}</b>
              </span>
              <span>
                <small>{hudText.nuke}</small>
                <b>{endingNukesUsed}</b>
              </span>
            </div>
            <div className="raid__ending-score">
              <span>{menuText.finalScore}</span>
              <strong>{finalScore.toLocaleString()}</strong>
            </div>
            <div className="raid__pause-actions raid__ending-actions">
              {canControlOverlay ? (
                <button type="button" className="raid__start" onClick={() => resetGame(1)}>
                  {menuText.startNewLaunch}
                </button>
              ) : null}
              <button type="button" className="raid__menu-button" onClick={exitRaid}>
                {menuText.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {stagePickerOpen && !isEndlessRun && !isBossRushRun && snapshot.phase !== 'playing' && snapshot.phase !== 'paused' && snapshot.phase !== 'briefing' && snapshot.phase !== 'victory' && (
        <div className="raid__stage-modal" role="dialog" aria-modal="true" aria-label={menuText.selectStageTitle}>
          <div className="raid__stage-modal-panel">
            <div className="raid__kicker">{menuText.selectStageTitle}</div>
            <div className="raid__stage-select raid__stage-select--modal">
              {stageSelectButtons.map((stage) => (
                <button
                  key={stage}
                  type="button"
                  className={stage === MAX_RAID_STAGE ? 'raid__stage-button raid__stage-button--final' : 'raid__stage-button'}
                  onClick={() => {
                    setStagePickerOpen(false)
                    resetGame(stage)
                  }}
                >
                  {stage}
                </button>
              ))}
            </div>
            <div className="raid__pause-actions">
              <button type="button" className="raid__menu-button raid__menu-button--wide" onClick={() => setStagePickerOpen(false)}>
                {menuText.back}
              </button>
            </div>
          </div>
        </div>
      )}
      {snapshot.phase !== 'playing' && snapshot.phase !== 'paused' && snapshot.phase !== 'briefing' && snapshot.phase !== 'victory' && (
        <div className="raid__overlay">
          <div className="raid__panel">
            <div className="raid__kicker">{snapshot.phase === 'gameover' ? menuText.runEnded : menuText.chooseShip}</div>
            <h2>{snapshot.phase === 'gameover' ? menuText.shipDestroyed : menuText.rocketRaid}</h2>
            <div className="raid__ship-grid">
              {displayedShipOptions.map((ship) => (
                (() => {
                  const shipCopy = raidText.ships[ship.key as keyof typeof raidText.ships] ?? ship
                  const locked = (ship.key === 'mesiah' && !mesiahUnlocked) || (ship.key === 'coreLander' && !coreLanderUnlocked)
                  const shipSpriteKey = ship.key === 'mesiah' ? mesiahVisualShipKey : ship.key === 'coreLander' ? coreLanderVisualShipKey : ship.key
                  const lockedCopy = ship.key === 'coreLander' ? raidText.menu.coreLanderUnlock : raidText.menu.clearRaidToUnlock
                  return (
                    <button
                      key={ship.key}
                      type="button"
                      className={[
                        'raid__ship-card',
                        selectedShipKey === ship.key ? 'raid__ship-card--active' : '',
                        locked ? 'raid__ship-card--locked' : '',
                      ].filter(Boolean).join(' ')}
                      disabled={locked}
                      onClick={() => {
                        if (!locked) chooseShip(ship)
                      }}
                    >
                      <RaidShipSprite shipKey={shipSpriteKey} size={getShipSpriteSize(ship.key, 'picker')} />
                      <span>{shipCopy.name}</span>
                      <small>{locked ? lockedCopy : shipCopy.role}</small>
                    </button>
                  )
                })()
              ))}
            </div>
            {canUseCampaignStageTools ? (
              <div className="raid__stage-picker-row">
                <button type="button" className="raid__menu-button raid__menu-button--wide" onClick={() => setStagePickerOpen(true)}>
                  {menuText.selectStage}
                </button>
              </div>
            ) : null}
            <div className="raid__pause-actions raid__pause-actions--pre">
              <button type="button" className="raid__menu-button raid__menu-button--difficulty" onClick={() => setDifficultyOpen(true)}>
                <span className="raid__menu-button-fit-text">{menuText.selectDifficulty} : {selectedDifficultyLabel}</span>
              </button>
              <button type="button" className="raid__menu-button" onClick={() => setSettingsOpen(true)}>{menuText.settings}</button>
            </div>
            <div className="raid__pause-actions">
              {canContinueCampaignCheckpoint && (
                <button type="button" className="raid__start" onClick={() => resetGame(checkpointStage, true)}>
                  {menuText.continueStage} {checkpointStage}
                </button>
              )}
              {canControlOverlay ? (
                <button
                  type="button"
                  className={canContinueCampaignCheckpoint ? 'raid__menu-button' : 'raid__start'}
                  onClick={startCurrentRaidMode}
                >
                  {primaryRaidMenuLabel}
                </button>
              ) : (
                <button type="button" className="raid__start" onClick={exitRaid}>{menuText.exitCoop}</button>
              )}
              {canControlOverlay ? (
                <button type="button" className="raid__menu-button" onClick={exitRaid}>{hudText.exit}</button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
