import './App.css'
import { LeaderboardsScreen } from './components/LeaderboardsScreen'
import { ProgressionScreen } from './components/ProgressionScreen'
import { RaidMultiplayerLobby, type RaidMultiplayerConnectionMode, type RaidMultiplayerSession } from './components/RaidMultiplayerLobby'
import { RunResultsOverlay } from './components/RunResultsOverlay'
import { GradiusRaid, preloadGradiusRaidAssets, type RaidAssetPreloadState } from './components/games/GradiusRaid'
import { getRaidAlienSpriteUrl, getRaidEliteSpriteUrl, getRaidShipSpriteUrl, RaidShipSprite } from './components/games/RaidShipSprite'
import { SpaceImpactDefense } from './components/games/SpaceImpactDefense'
import { getPublicAssetUrl } from './components/games/sound'
import {
  getInitialLanguage,
  getLanguageText,
  getRaidText,
  getReleaseText,
  isLanguageCode,
  LANGUAGE_OPTIONS,
  saveLanguage,
  type LanguageCode,
} from './i18n'
import { getStoredPlayerName, getStoredRecoveryCode, hasStoredPlayerName, isCreatorPlayerName, registerPlayerName, restorePlayerName, saveStoredPlayerName, uploadPlayerProgress, type PlayerNameRegistrationResult } from './leaderboards'
import { CORE_LANDER_GOD_GUNDAM_UNLOCK_SCORE, CORE_LANDER_UNLOCK_GRADIUS_ENDLESS_SCORE, getCoreLanderModel, getEquippedShipCosmetics, getMesiahShipColor, getStoredTowerDefenseEndlessUnlock, isCoreLanderUnlocked, isGradiusRaidEndlessUnlocked, isShipCosmeticUnlocked, loadProgress, normalizeProgress, recordRunResult, resetProgressForNewAccount, saveProgress, SHIP_COSMETIC_SINGLE_RUN_SCORE, SHIP_COSMETIC_TOTAL_SCORE, type ProgressState, type ProgressUpdate, type RunResult } from './progression'
import { useEffect, useMemo, useState, useRef, type CSSProperties } from 'react'

// Placeholder coins (not displayed - kept for prop compatibility)
const DEFAULT_COINS = [
  { id: '1', name: 'Alpha', symbol: 'A', image: '' },
]

const CUTSCENE_SCENES = [
  {
    eyebrow: 'Emergency Transmission',
    title: 'Earth Is Under Siege',
    text: 'Long-range orbital arrays confirm a hostile armada emerging from deep-space rifts on multiple approach vectors.',
    accent: 'cyan',
  },
  {
    eyebrow: 'Threat Assessment',
    title: 'Motherships Are Deploying Strike Waves',
    text: 'Alien carriers are launching assault craft by the thousands. Civilian corridors are collapsing faster than command can evacuate.',
    accent: 'amber',
  },
  {
    eyebrow: 'Command Directive',
    title: 'Establish The Defense Grid',
    text: 'Deploy warships, intercept the fleet, and hold the Earth line at all costs. If the HQ falls, the planet falls with it.',
    accent: 'teal',
  },
] as const

type ProgressionView = 'profile' | 'missions' | 'achievements' | 'codex' | 'stageMap'
type ScreenState = 'title' | 'cutscene' | 'game' | 'rocketMode' | 'raidHangar' | 'raidStory' | 'raidEndingArchive' | 'defenseEndingArchive' | 'raidCoopMode' | 'raidSameScreenBriefing' | 'raidMultiplayer' | 'leaderboards' | ProgressionView
type GameMode = 'normal' | 'endless'
type ActiveGame = 'towerDefense' | 'rocketRaid'
type RaidLaunchMode = 'campaign' | 'endless' | 'bossRush'
type CodexCutsceneMode = 'raid' | 'defense' | null

const PROGRESSION_VIEWS: ProgressionView[] = ['profile', 'missions', 'achievements', 'codex', 'stageMap']

const RAID_COOP_SHIP_OPTIONS = [
  { key: 'rocket', name: 'Black Comet' },
  { key: 'fast', name: 'Red Wraith' },
  { key: 'gatling', name: 'Crimson Saw' },
  { key: 'laser', name: 'Night Lance' },
  { key: 'dreadnought', name: 'Obsidian Ark' },
  { key: 'xwing', name: 'Crosswing Nova' },
  { key: 'spaceEt', name: 'Space Jet' },
  { key: 'mesiah', name: 'Mesiah' },
  { key: 'coreLander', name: 'Core Lander' },
] as const

const RAID_STORY_SCENE_DURATION_MS = 6200
const RAID_STORY_FADE_MS = 720
const CODEX_ENDING_SCENE_DURATION_MS = 6400
const CODEX_ENDING_FADE_MS = 720
const RAID_HANGAR_SHIP_OPTIONS = RAID_COOP_SHIP_OPTIONS
const RAID_HANGAR_COSMETICS = ['trail', 'aura', 'frame'] as const
const RAID_STORY_SCENE_VISUALS = [
  {
    planet: 'planet_1.webp',
    galaxy: 'galaxy_2.webp',
    boss: 'assets/aliens/final_boss.png',
    secondaryBoss: 'assets/aliens/elite_4.png',
    fleet: [
      { key: 'fast', size: 54 },
      { key: 'xwing', size: 48 },
      { key: 'spaceEt', size: 52 },
    ],
    enemies: [
      { kind: 'normal', variant: 2 },
      { kind: 'elite', variant: 0 },
      { kind: 'normal', variant: 5 },
    ],
  },
  {
    planet: 'planet_4.webp',
    galaxy: 'galaxy_3.webp',
    boss: 'assets/aliens/squid_boss.png',
    secondaryBoss: 'assets/aliens/elite_2.png',
    fleet: [
      { key: 'rocket', size: 50 },
      { key: 'laser', size: 54 },
      { key: 'dreadnought', size: 58 },
    ],
    enemies: [
      { kind: 'normal', variant: 0 },
      { kind: 'normal', variant: 6 },
      { kind: 'elite', variant: 3 },
    ],
  },
  {
    planet: 'planet_5.webp',
    galaxy: 'galaxy_4.webp',
    boss: 'assets/aliens/cobra_boss.png',
    secondaryBoss: 'assets/aliens/elite_3.png',
    fleet: [
      { key: 'mesiahBlack', size: 68 },
      { key: 'gatling', size: 50 },
      { key: 'laser', size: 50 },
    ],
    enemies: [
      { kind: 'elite', variant: 1 },
      { kind: 'normal', variant: 7 },
      { kind: 'elite', variant: 4 },
    ],
  },
  {
    planet: 'planet_3.webp',
    galaxy: 'galaxy.webp',
    boss: 'assets/aliens/final_boss.png',
    secondaryBoss: 'assets/aliens/squid_boss.png',
    fleet: [
      { key: 'rocket', size: 54 },
      { key: 'dreadnought', size: 58 },
      { key: 'xwing', size: 52 },
      { key: 'spaceEt', size: 54 },
    ],
    enemies: [
      { kind: 'normal', variant: 3 },
      { kind: 'elite', variant: 2 },
      { kind: 'normal', variant: 4 },
    ],
  },
] as const

function isMenuBgmScreen(screen: ScreenState) {
  return screen !== 'game'
}

function MenuShipSprite({ shipKey }: { shipKey: string }) {
  return (
    <img
      className="start-screen__asset-sprite"
      src={getRaidShipSpriteUrl(shipKey)}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  )
}

function MenuAlienSprite({ variant }: { variant: number }) {
  return (
    <img
      className="start-screen__asset-sprite"
      src={getRaidAlienSpriteUrl(variant)}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  )
}

function getHangarAttackClass(shipKey: string) {
  if (shipKey === 'fast') return 'wraith'
  if (shipKey === 'gatling') return 'scatter'
  if (shipKey === 'laser') return 'lance'
  if (shipKey === 'dreadnought') return 'ark'
  if (shipKey === 'xwing') return 'nova'
  if (shipKey === 'spaceEt') return 'comet'
  if (shipKey === 'mesiah') return 'mesiah'
  if (shipKey === 'coreLander') return 'core'
  return 'comet'
}

function App() {
  const [screen, setScreen] = useState<ScreenState>('title')
  const [language, setLanguage] = useState<LanguageCode>(getInitialLanguage)
  const [gameMode, setGameMode] = useState<GameMode>('normal')
  const [activeGame, setActiveGame] = useState<ActiveGame>('towerDefense')
  const [raidLaunchMode, setRaidLaunchMode] = useState<RaidLaunchMode>('campaign')
  const [raidMultiplayerConnectionMode, setRaidMultiplayerConnectionMode] = useState<RaidMultiplayerConnectionMode>('online')
  const [raidMultiplayerSession, setRaidMultiplayerSession] = useState<RaidMultiplayerSession | null>(null)
  const [raidSameScreenCoop, setRaidSameScreenCoop] = useState(false)
  const [sameScreenGuestShipKey, setSameScreenGuestShipKey] = useState('fast')
  const [hangarShipKey, setHangarShipKey] = useState('rocket')
  const [raidStoryIndex, setRaidStoryIndex] = useState(0)
  const [raidStoryFading, setRaidStoryFading] = useState(false)
  const [codexCutsceneMode, setCodexCutsceneMode] = useState<CodexCutsceneMode>(null)
  const [codexEndingIndex, setCodexEndingIndex] = useState(0)
  const [codexEndingFading, setCodexEndingFading] = useState(false)
  const menuGamepadButtonsRef = useRef(new Map<number, Set<number>>())
  const menuGamepadPrimaryRef = useRef<number | null>(null)
  const menuGamepadNextNavRef = useRef(0)
  const raidStoryTransitionTimerRef = useRef<number | null>(null)
  const raidStoryAutoFadeTimerRef = useRef<number | null>(null)
  const raidStoryAutoSceneTimerRef = useRef<number | null>(null)
  const codexEndingTransitionTimerRef = useRef<number | null>(null)
  const codexEndingAutoFadeTimerRef = useRef<number | null>(null)
  const codexEndingAutoSceneTimerRef = useRef<number | null>(null)
  const [cutsceneIndex, setCutsceneIndex] = useState(0)
  const [playerName, setPlayerName] = useState(getStoredPlayerName)
  const [playerNameDraft, setPlayerNameDraft] = useState(playerName === 'Pilot' && !hasStoredPlayerName() ? '' : playerName)
  const [showPlayerNamePrompt, setShowPlayerNamePrompt] = useState(() => !hasStoredPlayerName())
  const [playerNameSaving, setPlayerNameSaving] = useState(false)
  const [playerNameError, setPlayerNameError] = useState('')
  const [playerNameRestoreMode, setPlayerNameRestoreMode] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState(getStoredRecoveryCode)
  const [recoveryCodeDraft, setRecoveryCodeDraft] = useState('')
  const [endlessUnlocked, setEndlessUnlocked] = useState(getStoredTowerDefenseEndlessUnlock)
  const [progress, setProgress] = useState<ProgressState>(() => loadProgress())
  const [lastRunUpdate, setLastRunUpdate] = useState<{ result: RunResult; update: ProgressUpdate } | null>(null)
  const [raidAssetPreload, setRaidAssetPreload] = useState<RaidAssetPreloadState>({ status: 'idle', loaded: 0, total: 1 })

  const text = useMemo(() => getLanguageText(language), [language])
  const raidText = useMemo(() => getRaidText(language), [language])
  const releaseText = useMemo(() => getReleaseText(language), [language])
  const creatorUnlock = isCreatorPlayerName(playerName)
  const canPlayEndless = endlessUnlocked || creatorUnlock
  const canPlayGradiusEndless = progress.gradiusRaidEndlessUnlocked || creatorUnlock
  const sameScreenShipOptions = useMemo(() => (
    RAID_COOP_SHIP_OPTIONS.filter((ship) => {
      if (ship.key === 'mesiah') return isGradiusRaidEndlessUnlocked(progress)
      if (ship.key === 'coreLander') return isCoreLanderUnlocked(progress)
      return true
    })
  ), [progress])
  const getSameScreenShipSpriteKey = (shipKey: string) => (
    shipKey === 'mesiah'
      ? getMesiahShipColor(progress) === 'white' ? 'mesiahWhite' : 'mesiahBlack'
      : shipKey === 'coreLander'
        ? getCoreLanderModel(progress)
        : shipKey
  )
  const currentScene = useMemo(
    () => ({
      ...text.cutscene.scenes[cutsceneIndex],
      accent: CUTSCENE_SCENES[cutsceneIndex].accent,
    }),
    [cutsceneIndex, text],
  )
  const currentRaidStoryScene = text.raidStory.scenes[raidStoryIndex] ?? text.raidStory.scenes[0]
  const currentCodexEndingScenes = codexCutsceneMode === 'defense'
    ? releaseText.cutsceneArchive.defenseEndingScenes
    : releaseText.cutsceneArchive.raidEndingScenes
  const currentCodexEndingScene = currentCodexEndingScenes[codexEndingIndex] ?? currentCodexEndingScenes[0]
  const raidAssetPreloadPercent = Math.min(100, Math.round(raidAssetPreload.loaded / Math.max(1, raidAssetPreload.total) * 100))
  const raidAssetsReady = raidAssetPreload.status === 'ready'
  const closeCodexCutsceneArchive = () => {
    setCodexCutsceneMode(null)
    setCodexEndingIndex(0)
    setCodexEndingFading(false)
    setScreen('codex')
  }
  const openCodexEndingArchive = (mode: Exclude<CodexCutsceneMode, null>) => {
    setCodexCutsceneMode(mode)
    setCodexEndingIndex(0)
    setCodexEndingFading(false)
    setScreen(mode === 'raid' ? 'raidEndingArchive' : 'defenseEndingArchive')
  }
  const finishDefenseCutsceneIntro = () => {
    if (codexCutsceneMode === 'defense') {
      openCodexEndingArchive('defense')
      return
    }
    setScreen('game')
  }
  const transitionCodexEnding = (target: 'close' | 'next' | number) => {
    const sceneCount = Math.max(1, currentCodexEndingScenes.length)

    if (typeof target === 'number' && target === codexEndingIndex) return
    if (codexEndingAutoFadeTimerRef.current !== null) {
      window.clearTimeout(codexEndingAutoFadeTimerRef.current)
      codexEndingAutoFadeTimerRef.current = null
    }
    if (codexEndingAutoSceneTimerRef.current !== null) {
      window.clearTimeout(codexEndingAutoSceneTimerRef.current)
      codexEndingAutoSceneTimerRef.current = null
    }
    if (codexEndingTransitionTimerRef.current !== null) {
      window.clearTimeout(codexEndingTransitionTimerRef.current)
    }

    setCodexEndingFading(true)
    codexEndingTransitionTimerRef.current = window.setTimeout(() => {
      codexEndingTransitionTimerRef.current = null

      if (target === 'close' || (target === 'next' && codexEndingIndex >= sceneCount - 1)) {
        closeCodexCutsceneArchive()
        return
      }

      if (typeof target === 'number') {
        setCodexEndingIndex(Math.max(0, Math.min(target, sceneCount - 1)))
      } else {
        setCodexEndingIndex((current) => Math.min(current + 1, sceneCount - 1))
      }
      setCodexEndingFading(false)
    }, CODEX_ENDING_FADE_MS)
  }
  const transitionRaidStory = (target: 'back' | 'game' | 'next' | number) => {
    if (typeof target === 'number' && target === raidStoryIndex) return
    if (raidStoryAutoFadeTimerRef.current !== null) {
      window.clearTimeout(raidStoryAutoFadeTimerRef.current)
      raidStoryAutoFadeTimerRef.current = null
    }
    if (raidStoryAutoSceneTimerRef.current !== null) {
      window.clearTimeout(raidStoryAutoSceneTimerRef.current)
      raidStoryAutoSceneTimerRef.current = null
    }
    if (raidStoryTransitionTimerRef.current !== null) {
      window.clearTimeout(raidStoryTransitionTimerRef.current)
    }
    setRaidStoryFading(true)
    raidStoryTransitionTimerRef.current = window.setTimeout(() => {
      raidStoryTransitionTimerRef.current = null
      if (target === 'back') {
        if (codexCutsceneMode === 'raid') {
          closeCodexCutsceneArchive()
          setRaidStoryFading(false)
          return
        }
        setScreen('rocketMode')
      } else if (target === 'game' || (target === 'next' && raidStoryIndex >= text.raidStory.scenes.length - 1)) {
        if (codexCutsceneMode === 'raid') openCodexEndingArchive('raid')
        else setScreen('game')
      } else if (typeof target === 'number') {
        setRaidStoryIndex(Math.max(0, Math.min(target, text.raidStory.scenes.length - 1)))
      } else {
        setRaidStoryIndex((current) => Math.min(current + 1, text.raidStory.scenes.length - 1))
      }
      setRaidStoryFading(false)
    }, RAID_STORY_FADE_MS)
  }

  useEffect(() => {
    if (sameScreenShipOptions.some((ship) => ship.key === sameScreenGuestShipKey)) return
    setSameScreenGuestShipKey(sameScreenShipOptions[1]?.key ?? sameScreenShipOptions[0]?.key ?? 'fast')
  }, [sameScreenGuestShipKey, sameScreenShipOptions])

  useEffect(() => {
    let cancelled = false
    setRaidAssetPreload((state) => state.status === 'ready' ? state : { status: 'loading', loaded: state.loaded, total: Math.max(1, state.total) })
    void preloadGradiusRaidAssets((loaded, total) => {
      if (cancelled) return
      setRaidAssetPreload({ status: loaded >= total ? 'ready' : 'loading', loaded, total: Math.max(1, total) })
    }).then(() => {
      if (cancelled) return
      setRaidAssetPreload((state) => ({ status: 'ready', loaded: state.total, total: Math.max(1, state.total) }))
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => () => {
    if (raidStoryTransitionTimerRef.current !== null) {
      window.clearTimeout(raidStoryTransitionTimerRef.current)
    }
    if (raidStoryAutoFadeTimerRef.current !== null) {
      window.clearTimeout(raidStoryAutoFadeTimerRef.current)
    }
    if (raidStoryAutoSceneTimerRef.current !== null) {
      window.clearTimeout(raidStoryAutoSceneTimerRef.current)
    }
    if (codexEndingTransitionTimerRef.current !== null) {
      window.clearTimeout(codexEndingTransitionTimerRef.current)
    }
    if (codexEndingAutoFadeTimerRef.current !== null) {
      window.clearTimeout(codexEndingAutoFadeTimerRef.current)
    }
    if (codexEndingAutoSceneTimerRef.current !== null) {
      window.clearTimeout(codexEndingAutoSceneTimerRef.current)
    }
  }, [])

  const handleLanguageChange = (nextLanguage: string) => {
    if (!isLanguageCode(nextLanguage)) return
    setLanguage(nextLanguage)
    saveLanguage(nextLanguage)
  }

  const syncCloudProgress = (nextProgress: ProgressState) => {
    void uploadPlayerProgress(nextProgress)
  }

  const applyRegisteredPlayer = (
    result: PlayerNameRegistrationResult,
    fallbackName: string,
    options: { uploadLocalWhenEmpty?: boolean; resetLocalWhenEmpty?: boolean } = {},
  ) => {
    const { uploadLocalWhenEmpty = true, resetLocalWhenEmpty = false } = options
    const nextName = saveStoredPlayerName(result.playerName ?? fallbackName)
    setPlayerName(nextName)
    setPlayerNameDraft(nextName)
    setRecoveryCode(result.recoveryCode ?? getStoredRecoveryCode())
    setRecoveryCodeDraft('')
    setPlayerNameRestoreMode(false)
    setShowPlayerNamePrompt(false)

    if (result.progress) {
      const cloudProgress = normalizeProgress(result.progress)
      saveProgress(cloudProgress)
      setProgress(cloudProgress)
      setEndlessUnlocked(cloudProgress.towerDefenseEndlessUnlocked)
      return
    }

    if (resetLocalWhenEmpty) {
      const freshProgress = resetProgressForNewAccount()
      setProgress(freshProgress)
      setEndlessUnlocked(freshProgress.towerDefenseEndlessUnlocked)
      syncCloudProgress(freshProgress)
      return
    }

    const localProgress = loadProgress()
    setEndlessUnlocked(localProgress.towerDefenseEndlessUnlocked)
    if (uploadLocalWhenEmpty) syncCloudProgress(localProgress)
  }

  useEffect(() => {
    if (!hasStoredPlayerName()) return

    let cancelled = false
    registerPlayerName(playerName).then((result) => {
      if (cancelled) return
      if (result.registered) {
        applyRegisteredPlayer(result, playerName)
        return
      }

      setPlayerNameDraft(playerName)
      setPlayerNameRestoreMode(Boolean(result.taken))
      setPlayerNameError(result.taken ? text.player.nameTakenRecovery : text.player.nameRegisterError)
      setShowPlayerNamePrompt(true)
    })

    return () => {
      cancelled = true
    }
  }, [])

  // =========================
  // MENU BGM CONTROL
  // =========================
  const bgmRef = useRef<HTMLAudioElement | null>(null)
  const hasInteractedRef = useRef(false)

  // init audio
  useEffect(() => {
    const audio = new Audio(getPublicAssetUrl('audio/bgm_shelter.wav'))
    audio.loop = true
    audio.volume = 0.5

    bgmRef.current = audio

    return () => {
      audio.pause()
      bgmRef.current = null
    }
  }, [])

  // detect first interaction (required by browser)
  useEffect(() => {
    const unlockAudio = () => {
      hasInteractedRef.current = true

      const bgm = bgmRef.current
      if (bgm && isMenuBgmScreen(screen)) {
        bgm.play().catch(() => {})
      }

      window.removeEventListener('click', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
    }

    window.addEventListener('click', unlockAudio)
    window.addEventListener('keydown', unlockAudio)

    return () => {
      window.removeEventListener('click', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
    }
  }, [screen])

  // control music when switching screens
  useEffect(() => {
    const bgm = bgmRef.current
    if (!bgm) return

    if (isMenuBgmScreen(screen)) {
      if (hasInteractedRef.current) {
        bgm.play().catch(() => {})
      }
    } else {
      bgm.pause()
    }
  }, [screen])

  useEffect(() => {
    if (screen === 'game') return
    const focusableSelector = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    const isTypingTarget = (target: Element | null) => target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
    const getFocusableControls = () => Array.from(document.querySelectorAll<HTMLElement>(focusableSelector)).filter((control) => {
      if (control.tabIndex < 0) return false
      const rect = control.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && getComputedStyle(control).visibility !== 'hidden'
    })
    const moveFocus = (direction: 1 | -1) => {
      const controls = getFocusableControls()
      if (!controls.length) return
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
      const currentIndex = active ? controls.indexOf(active) : -1
      const nextIndex = currentIndex < 0 ? (direction > 0 ? 0 : controls.length - 1) : (currentIndex + direction + controls.length) % controls.length
      controls[nextIndex]?.focus()
    }
    const activateFocusedControl = () => {
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
      if (active && !isTypingTarget(active)) {
        active.click()
        return
      }
      const firstButton = getFocusableControls().find((control) => control instanceof HTMLButtonElement)
      firstButton?.focus()
    }
    const activateBackControl = () => {
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
      if (isTypingTarget(active)) {
        active.blur()
        return
      }
      const backControl = document.querySelector<HTMLElement>('.mode-screen__back, .leaderboards-screen__back, .progress-panel__back, .cutscene__skip, .raid__menu-button')
      backControl?.click()
    }
    const handleKeydown = (event: KeyboardEvent) => {
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
      if (isTypingTarget(active)) {
        if (event.key === 'Escape') {
          event.preventDefault()
          active.blur()
        }
        return
      }
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault()
        moveFocus(1)
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault()
        moveFocus(-1)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        activateBackControl()
      }
    }
    const getPressedButtons = (gamepad: Gamepad) => {
      const pressed = new Set<number>()
      gamepad.buttons.forEach((button, index) => {
        if (button.pressed || button.value > 0.55) pressed.add(index)
      })
      return pressed
    }
    let raf = 0
    const tick = (time: number) => {
      const gamepads = typeof navigator.getGamepads === 'function'
        ? Array.from(navigator.getGamepads()).filter((pad): pad is Gamepad => Boolean(pad?.connected))
        : []
      const connectedIndexes = new Set(gamepads.map((pad) => pad.index))
      if (menuGamepadPrimaryRef.current !== null && !connectedIndexes.has(menuGamepadPrimaryRef.current)) {
        menuGamepadPrimaryRef.current = null
      }
      if (menuGamepadPrimaryRef.current === null && gamepads[0]) {
        menuGamepadPrimaryRef.current = gamepads[0].index
      }
      const gamepad = menuGamepadPrimaryRef.current !== null
        ? gamepads.find((pad) => pad.index === menuGamepadPrimaryRef.current) ?? null
        : null
      if (gamepad) {
        const pressed = getPressedButtons(gamepad)
        const previous = menuGamepadButtonsRef.current.get(gamepad.index) ?? new Set<number>()
        const justPressed = (button: number) => pressed.has(button) && !previous.has(button)
        const axisX = gamepad.axes[0] ?? 0
        const axisY = gamepad.axes[1] ?? 0
        const dpadX = (pressed.has(15) ? 1 : 0) - (pressed.has(14) ? 1 : 0)
        const dpadY = (pressed.has(13) ? 1 : 0) - (pressed.has(12) ? 1 : 0)
        const navX = Math.abs(axisX) > 0.55 ? Math.sign(axisX) : dpadX
        const navY = Math.abs(axisY) > 0.55 ? Math.sign(axisY) : dpadY
        if (time >= menuGamepadNextNavRef.current && (navX !== 0 || navY !== 0)) {
          moveFocus(navX > 0 || navY > 0 ? 1 : -1)
          menuGamepadNextNavRef.current = time + 180
        }
        if (justPressed(0)) activateFocusedControl()
        if (justPressed(1)) activateBackControl()
        menuGamepadButtonsRef.current.set(gamepad.index, pressed)
      }
      raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    window.addEventListener('keydown', handleKeydown)
    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [screen])
  // =========================
  // CUTSCENE TIMER LOGIC
  // =========================
  useEffect(() => {
    if (screen !== 'cutscene') return

    const sceneTimer = window.setTimeout(() => {
      setCutsceneIndex((current) => {
        if (current >= CUTSCENE_SCENES.length - 1) {
          finishDefenseCutsceneIntro()
          return current
        }
        return current + 1
      })
    }, 2600)

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (codexCutsceneMode === 'defense') closeCodexCutsceneArchive()
        else setScreen('game')
      } else if (event.key === 'Enter' || event.key === ' ') {
        finishDefenseCutsceneIntro()
      }
    }

    window.addEventListener('keydown', handleKeydown)

    return () => {
      window.clearTimeout(sceneTimer)
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [screen, cutsceneIndex, codexCutsceneMode])

  useEffect(() => {
    if (screen !== 'raidStory') return
    setRaidStoryFading(false)

    raidStoryAutoFadeTimerRef.current = window.setTimeout(() => {
      raidStoryAutoFadeTimerRef.current = null
      setRaidStoryFading(true)
    }, RAID_STORY_SCENE_DURATION_MS - RAID_STORY_FADE_MS)

    raidStoryAutoSceneTimerRef.current = window.setTimeout(() => {
      raidStoryAutoSceneTimerRef.current = null
      setRaidStoryIndex((current) => {
        if (current >= text.raidStory.scenes.length - 1) {
          if (codexCutsceneMode === 'raid') openCodexEndingArchive('raid')
          else setScreen('game')
          return current
        }
        return current + 1
      })
      setRaidStoryFading(false)
    }, RAID_STORY_SCENE_DURATION_MS)

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        transitionRaidStory('back')
        return
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        transitionRaidStory('game')
      }
    }

    window.addEventListener('keydown', handleKeydown)

    return () => {
      if (raidStoryAutoFadeTimerRef.current !== null) {
        window.clearTimeout(raidStoryAutoFadeTimerRef.current)
        raidStoryAutoFadeTimerRef.current = null
      }
      if (raidStoryAutoSceneTimerRef.current !== null) {
        window.clearTimeout(raidStoryAutoSceneTimerRef.current)
        raidStoryAutoSceneTimerRef.current = null
      }
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [screen, raidStoryIndex, text.raidStory.scenes.length, codexCutsceneMode])

  useEffect(() => {
    if (screen !== 'raidEndingArchive' && screen !== 'defenseEndingArchive') return
    setCodexEndingFading(false)

    if (codexEndingIndex < currentCodexEndingScenes.length - 1) {
      codexEndingAutoFadeTimerRef.current = window.setTimeout(() => {
        codexEndingAutoFadeTimerRef.current = null
        setCodexEndingFading(true)
      }, CODEX_ENDING_SCENE_DURATION_MS - CODEX_ENDING_FADE_MS)

      codexEndingAutoSceneTimerRef.current = window.setTimeout(() => {
        codexEndingAutoSceneTimerRef.current = null
        setCodexEndingIndex((current) => Math.min(current + 1, currentCodexEndingScenes.length - 1))
        setCodexEndingFading(false)
      }, CODEX_ENDING_SCENE_DURATION_MS)
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        transitionCodexEnding('close')
        return
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        transitionCodexEnding('next')
      }
    }

    window.addEventListener('keydown', handleKeydown)

    return () => {
      if (codexEndingAutoFadeTimerRef.current !== null) {
        window.clearTimeout(codexEndingAutoFadeTimerRef.current)
        codexEndingAutoFadeTimerRef.current = null
      }
      if (codexEndingAutoSceneTimerRef.current !== null) {
        window.clearTimeout(codexEndingAutoSceneTimerRef.current)
        codexEndingAutoSceneTimerRef.current = null
      }
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [screen, codexEndingIndex, currentCodexEndingScenes.length])

  const startCutscene = () => {
    setCodexCutsceneMode(null)
    setActiveGame('towerDefense')
    setGameMode('normal')
    setCutsceneIndex(0)
    setScreen('cutscene')
  }

  const startEndless = () => {
    if (!canPlayEndless) return
    setCodexCutsceneMode(null)
    setActiveGame('towerDefense')
    setGameMode('endless')
    setScreen('game')
  }

  const startRocketRaid = () => {
    if (!raidAssetsReady) return
    setCodexCutsceneMode(null)
    setScreen('rocketMode')
  }

  const startRocketRaidSingle = (mode: RaidLaunchMode = 'campaign') => {
    if ((mode === 'endless' || mode === 'bossRush') && !canPlayGradiusEndless) return
    setCodexCutsceneMode(null)
    setRaidMultiplayerSession(null)
    setRaidSameScreenCoop(false)
    setRaidLaunchMode(mode)
    setActiveGame('rocketRaid')
    if (mode === 'campaign') {
      setRaidStoryIndex(0)
      setScreen('raidStory')
      return
    }
    setScreen('game')
  }

  const startSameScreenCoop = () => {
    setCodexCutsceneMode(null)
    setRaidMultiplayerSession(null)
    setRaidSameScreenCoop(true)
    setRaidLaunchMode('campaign')
    setActiveGame('rocketRaid')
    setScreen('game')
  }

  const startCodexCutscenePlayback = (mode: Exclude<CodexCutsceneMode, null>) => {
    setCodexCutsceneMode(mode)
    setCodexEndingIndex(0)
    setCodexEndingFading(false)
    setLastRunUpdate(null)
    if (mode === 'raid') {
      setActiveGame('rocketRaid')
      setRaidStoryIndex(0)
      setRaidStoryFading(false)
      setScreen('raidStory')
      return
    }
    setActiveGame('towerDefense')
    setGameMode('normal')
    setCutsceneIndex(0)
    setScreen('cutscene')
  }

  const handleRunComplete = (result: RunResult) => {
    const update = recordRunResult(result)
    setProgress(update.progress)
    setEndlessUnlocked(update.progress.towerDefenseEndlessUnlocked)
    syncCloudProgress(update.progress)
    setLastRunUpdate({ result, update })
  }

  const savePlayerName = async () => {
    if (!playerNameDraft.trim()) return
    setPlayerNameSaving(true)
    setPlayerNameError('')
    const result = playerNameRestoreMode
      ? await restorePlayerName(playerNameDraft, recoveryCodeDraft)
      : await registerPlayerName(playerNameDraft)
    setPlayerNameSaving(false)

    if (!result.registered) {
      if (result.taken) setPlayerNameRestoreMode(true)
      setPlayerNameError(
        playerNameRestoreMode
          ? text.player.recoveryInvalid
          : result.taken ? text.player.nameTakenRecovery : text.player.nameRegisterError,
      )
      return
    }

    applyRegisteredPlayer(result, playerNameDraft, {
      resetLocalWhenEmpty: !playerNameRestoreMode,
    })
  }

  const playerNamePrompt = showPlayerNamePrompt ? (
    <div className="player-name-modal" role="dialog" aria-modal="true" aria-labelledby="player-name-title">
      <form
        className="player-name-modal__panel"
        onSubmit={(event) => {
          event.preventDefault()
          savePlayerName()
        }}
      >
        <span className="player-name-modal__eyebrow">{text.player.registration}</span>
        <h2 id="player-name-title">{text.player.chooseName}</h2>
        <p>{text.player.nameUse}</p>
        <input
          autoFocus
          maxLength={18}
          value={playerNameDraft}
          onChange={(event) => {
            setPlayerNameDraft(event.target.value)
            setPlayerNameError('')
            setPlayerNameRestoreMode(false)
          }}
          placeholder={text.player.placeholder}
        />
        {playerNameRestoreMode ? (
          <input
            maxLength={32}
            value={recoveryCodeDraft}
            onChange={(event) => {
              setRecoveryCodeDraft(event.target.value)
              setPlayerNameError('')
            }}
            placeholder={text.player.recoveryPlaceholder}
          />
        ) : null}
        {playerNameError ? <small className="player-name-modal__error">{playerNameError}</small> : null}
        <button type="submit" disabled={!playerNameDraft.trim() || playerNameSaving || (playerNameRestoreMode && !recoveryCodeDraft.trim())}>
          {playerNameSaving ? text.player.checking : playerNameRestoreMode ? text.player.restore : text.player.confirm}
        </button>
      </form>
    </div>
  ) : null

  const closeGame = () => {
    const nextProgress = loadProgress()
    setProgress(nextProgress)
    setEndlessUnlocked(nextProgress.towerDefenseEndlessUnlocked)
    syncCloudProgress(nextProgress)
    raidMultiplayerSession?.socket.close()
    setRaidMultiplayerSession(null)
    setRaidSameScreenCoop(false)
    setScreen('title')
  }

  const closeRocketRaid = () => {
    const nextProgress = loadProgress()
    setProgress(nextProgress)
    setEndlessUnlocked(nextProgress.towerDefenseEndlessUnlocked)
    syncCloudProgress(nextProgress)
    raidMultiplayerSession?.socket.close()
    setRaidMultiplayerSession(null)
    setRaidSameScreenCoop(false)
    setScreen('rocketMode')
  }

  const runResultsOverlay = lastRunUpdate ? (
    <RunResultsOverlay
      result={lastRunUpdate.result}
      update={lastRunUpdate.update}
      language={language}
      onClose={() => setLastRunUpdate(null)}
    />
  ) : null

  if (screen === 'title') {
    return (
      <div className="start-screen">
        <label className="language-picker">
          <span>{text.language}</span>
          <select value={language} onChange={(event) => handleLanguageChange(event.target.value)}>
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="start-screen__stars" />
        <div className="start-screen__nebula start-screen__nebula--a" />
        <div className="start-screen__nebula start-screen__nebula--b" />
        <div className="start-screen__battlefield">
          <div className="start-screen__beam start-screen__beam--a" />
          <div className="start-screen__beam start-screen__beam--b" />
          <div className="start-screen__beam start-screen__beam--c" />
          <div className="start-screen__sprite-fleet" aria-hidden="true">
            <div className="start-screen__sprite-ship start-screen__sprite-ship--rocket">
              <MenuShipSprite shipKey="rocket" />
            </div>
            <div className="start-screen__sprite-ship start-screen__sprite-ship--xwing">
              <MenuShipSprite shipKey="xwing" />
            </div>
            <div className="start-screen__sprite-ship start-screen__sprite-ship--dreadnought">
              <MenuShipSprite shipKey="dreadnought" />
            </div>
            <div className="start-screen__sprite-ship start-screen__sprite-ship--alien-a">
              <MenuAlienSprite variant={1} />
            </div>
            <div className="start-screen__sprite-ship start-screen__sprite-ship--alien-b">
              <MenuAlienSprite variant={3} />
            </div>
          </div>
        </div>

        <div className="start-screen__content">
          <div className="start-screen__command-panel">
            <div className="start-screen__brand">
              <span className="start-screen__signal" />
              <span>{text.title.brand}</span>
              <span className="start-screen__version">{text.title.version}</span>
            </div>

            <div className="start-screen__pilot">
              <span>{text.player.commander}</span>
              <strong>{playerName}</strong>
              <button onClick={() => setShowPlayerNamePrompt(true)}>{text.player.change}</button>
            </div>

            <div className="start-screen__title-lockup">
              <div className="start-screen__eyebrow">{text.title.eyebrow}</div>
              <h1>{text.title.name}</h1>
              <p>{text.title.subtitle}</p>
            </div>

            <div className="start-screen__status-grid" aria-label="Command status">
              <div className="start-screen__status">
                <span>{text.title.sector}</span>
                <strong>Sol-3</strong>
              </div>
              <div className="start-screen__status">
                <span>{text.title.threat}</span>
                <strong>Omega</strong>
              </div>
              <div className="start-screen__status">
                <span>{text.title.fleet}</span>
                <strong>{text.title.ready}</strong>
              </div>
            </div>

            <div className="start-screen__hangar" aria-hidden="true">
              <div className="start-screen__hangar-ship start-screen__hangar-ship--one">
                <MenuShipSprite shipKey="fast" />
              </div>
              <div className="start-screen__hangar-ship start-screen__hangar-ship--two">
                <MenuShipSprite shipKey="gatling" />
              </div>
              <div className="start-screen__hangar-ship start-screen__hangar-ship--three">
                <MenuShipSprite shipKey="laser" />
              </div>
              <div className="start-screen__hangar-ship start-screen__hangar-ship--four">
                <MenuShipSprite shipKey="spaceEt" />
              </div>
              <div className="start-screen__hangar-ship start-screen__hangar-ship--enemy">
                <MenuAlienSprite variant={2} />
              </div>
            </div>

            <div className={canPlayEndless ? 'start-screen__actions' : 'start-screen__actions start-screen__actions--three'} aria-label="Game modes">
              <button
                className={raidAssetsReady ? "start-screen__button start-screen__button--raid" : "start-screen__button start-screen__button--raid start-screen__button--loading"}
                onClick={startRocketRaid}
                disabled={!raidAssetsReady}
              >
                <span className="start-screen__button-kicker">{text.title.raidKicker}</span>
                <span className="start-screen__button-title">{text.title.raidTitle}</span>
                <span className="start-screen__button-copy">
                  {raidAssetsReady ? text.title.raidCopy : `${raidText.menu.loadingAssets} ${raidAssetPreloadPercent}%`}
                </span>
              </button>
              <button className="start-screen__button" onClick={startCutscene}>
                <span className="start-screen__button-kicker">{text.title.storyKicker}</span>
                <span className="start-screen__button-title">{text.title.normalTitle}</span>
                <span className="start-screen__button-copy">{text.title.normalCopy}</span>
              </button>
              {canPlayEndless && (
                <button className="start-screen__button start-screen__button--endless" onClick={startEndless}>
                  <span className="start-screen__button-kicker">{text.title.endlessKicker}</span>
                  <span className="start-screen__button-title">{text.title.endlessTitle}</span>
                  <span className="start-screen__button-copy">{text.title.endlessCopy}</span>
                </button>
              )}
              <button className="start-screen__button start-screen__button--leaderboards" onClick={() => setScreen('leaderboards')}>
                <span className="start-screen__button-kicker">{text.title.recordsKicker}</span>
                <span className="start-screen__button-title">{text.title.recordsTitle}</span>
                <span className="start-screen__button-copy">{text.title.recordsCopy}</span>
              </button>
            </div>

            <div className="start-screen__command-deck" aria-label={releaseText.deckTitle}>
              <button type="button" onClick={() => setScreen('profile')}>{releaseText.profile}</button>
              <button type="button" onClick={() => setScreen('achievements')}>{releaseText.achievements}</button>
              <button type="button" onClick={() => setScreen('codex')}>{releaseText.codex}</button>
              <button type="button" onClick={() => setScreen('stageMap')}>{releaseText.stageMap}</button>
            </div>

            <div className="start-screen__footer">
              <span>{text.title.copyright}</span>
              <span>{text.title.musicCredit}</span>
            </div>
          </div>
        </div>
        {!raidAssetsReady && (
          <div className="start-screen__asset-loading" role="status" aria-live="polite">
            <div className="start-screen__asset-loading-panel">
              <span>{raidText.menu.loadingAssets}</span>
              <strong>{raidAssetPreloadPercent}%</strong>
              <div className="start-screen__asset-loading-bar" aria-hidden="true">
                <i style={{ width: `${raidAssetPreloadPercent}%` }} />
              </div>
              <p>{raidText.menu.loadingAssetsCopy}</p>
            </div>
          </div>
        )}
        {playerNamePrompt}
        {runResultsOverlay}
      </div>
    )
  }

  if (screen === 'cutscene') {
    return (
      <>
        <div className={`cutscene cutscene--${currentScene.accent}`}>
          <div className="cutscene__stars" />
          <div className="cutscene__scanlines" />
          <div className="cutscene__planet" />
          <div className="cutscene__hazard cutscene__hazard--one" />
          <div className="cutscene__hazard cutscene__hazard--two" />
          <div className="cutscene__hazard cutscene__hazard--three" />

          <div className="cutscene__fleet cutscene__fleet--allied">
            <div className="cutscene__vessel cutscene__vessel--capital" />
            <div className="cutscene__vessel cutscene__vessel--escort" />
          </div>

          <div className="cutscene__fleet cutscene__fleet--hostile">
            <div className="cutscene__vessel cutscene__vessel--raider" />
            <div className="cutscene__vessel cutscene__vessel--mothership" />
          </div>

          <div className="cutscene__hud">
            <div className="cutscene__tag">{text.cutscene.commandFeed}</div>
            <button className="cutscene__skip" onClick={finishDefenseCutsceneIntro}>
              {text.cutscene.skip}
            </button>
          </div>

          <div className="cutscene__content">
            <div className="cutscene__eyebrow">{currentScene.eyebrow}</div>
            <h2>{currentScene.title}</h2>
            <p>{currentScene.text}</p>

            <div className="cutscene__meta">
              <div className="cutscene__progress">
                {text.cutscene.scenes.map((scene, index) => (
                  <span
                    key={scene.title}
                    className={
                      index === cutsceneIndex
                        ? 'cutscene__dot cutscene__dot--active'
                        : 'cutscene__dot'
                    }
                  />
                ))}
              </div>
              <div className="cutscene__hint">
                {text.cutscene.deployHint}
              </div>
            </div>
          </div>
        </div>
        {playerNamePrompt}
        {runResultsOverlay}
      </>
    )
  }

  if (screen === 'defenseEndingArchive') {
    const isLastEndingScene = codexEndingIndex >= currentCodexEndingScenes.length - 1
    const endingAccent = codexEndingIndex === 0 ? 'teal' : codexEndingIndex === 1 ? 'cyan' : 'amber'

    return (
      <>
        <div className={codexEndingFading ? `cutscene cutscene--${endingAccent} cutscene--ending-archive cutscene--archive-fading` : `cutscene cutscene--${endingAccent} cutscene--ending-archive`}>
          <div className="cutscene__stars" />
          <div className="cutscene__scanlines" />
          <div className="cutscene__planet" />
          <img className="cutscene__asset cutscene__asset--earth" src={getPublicAssetUrl('assets/others/planet_1.webp')} alt="" draggable={false} />
          <img className="cutscene__asset cutscene__asset--station" src={getPublicAssetUrl('assets/others/space_station.webp')} alt="" draggable={false} />
          <img className="cutscene__asset cutscene__asset--sun" src={getPublicAssetUrl('assets/others/sun.webp')} alt="" draggable={false} />
          <div className="cutscene__asset-fleet" aria-hidden="true">
            {['rocket', 'fast', 'xwing', 'spaceEt'].map((shipKey, index) => (
              <span key={shipKey} style={{ '--fleet-index': index } as CSSProperties}>
                <RaidShipSprite shipKey={shipKey} size={index === 0 ? 54 : 44} />
              </span>
            ))}
          </div>
          <div className="cutscene__asset-enemies" aria-hidden="true">
            {[0, 3, 6].map((variant, index) => (
              <img key={`defense-ending-alien-${variant}`} src={getRaidAlienSpriteUrl(variant)} alt="" draggable={false} style={{ '--retreat-index': index } as CSSProperties} />
            ))}
            <img className="cutscene__asset-enemy--elite" src={getRaidEliteSpriteUrl(2)} alt="" draggable={false} />
          </div>
          <div className="cutscene__hazard cutscene__hazard--one" />
          <div className="cutscene__hazard cutscene__hazard--two" />
          <div className="cutscene__fleet cutscene__fleet--allied">
            <div className="cutscene__vessel cutscene__vessel--capital" />
            <div className="cutscene__vessel cutscene__vessel--escort" />
          </div>
          <div className="cutscene__hud">
            <div className="cutscene__tag">{releaseText.cutsceneArchive.ending}</div>
            <button className="cutscene__skip" type="button" onClick={() => transitionCodexEnding('close')}>
              {releaseText.close}
            </button>
          </div>
          <section className="cutscene__content cutscene__content--ending" aria-labelledby="defense-ending-archive-title">
            <div className="cutscene__eyebrow">{currentCodexEndingScene.eyebrow}</div>
            <h2 id="defense-ending-archive-title">{currentCodexEndingScene.title}</h2>
            <p>{currentCodexEndingScene.text}</p>
            <div className="cutscene__meta cutscene__meta--archive">
              <div className="cutscene__progress" aria-label={releaseText.cutsceneArchive.progress.replace('{current}', String(codexEndingIndex + 1)).replace('{total}', String(currentCodexEndingScenes.length))}>
                {currentCodexEndingScenes.map((scene, index) => (
                  <button
                    key={scene.title}
                    type="button"
                    className={index === codexEndingIndex ? 'cutscene__dot cutscene__dot--active' : 'cutscene__dot'}
                    aria-current={index === codexEndingIndex ? 'step' : undefined}
                    aria-label={releaseText.cutsceneArchive.progress.replace('{current}', String(index + 1)).replace('{total}', String(currentCodexEndingScenes.length))}
                    onClick={() => transitionCodexEnding(index)}
                  />
                ))}
              </div>
              <button className="cutscene__next" type="button" onClick={() => transitionCodexEnding(isLastEndingScene ? 'close' : 'next')}>
                {isLastEndingScene ? releaseText.close : releaseText.cutsceneArchive.next}
              </button>
            </div>
          </section>
        </div>
        {playerNamePrompt}
      </>
    )
  }

  if (screen === 'raidStory') {
    const isLastStoryScene = raidStoryIndex >= text.raidStory.scenes.length - 1
    const storySceneClass = `raid-story--scene-${raidStoryIndex + 1}`
    const storyVisuals = RAID_STORY_SCENE_VISUALS[raidStoryIndex] ?? RAID_STORY_SCENE_VISUALS[0]

    return (
      <>
        <div className={raidStoryFading ? `raid-story ${storySceneClass} raid-story--fading` : `raid-story ${storySceneClass}`}>
          <div className="raid-story__stars" />
          <div className="raid-story__rift" />
          <img className="raid-story__earth" src={getPublicAssetUrl(`assets/others/${storyVisuals.planet}`)} alt="" aria-hidden="true" draggable={false} />
          <img className="raid-story__galaxy" src={getPublicAssetUrl(`assets/others/${storyVisuals.galaxy}`)} alt="" aria-hidden="true" draggable={false} />
          <img className="raid-story__fortress" src={getPublicAssetUrl(storyVisuals.boss)} alt="" aria-hidden="true" draggable={false} />
          <img className="raid-story__secondary-boss" src={getPublicAssetUrl(storyVisuals.secondaryBoss)} alt="" aria-hidden="true" draggable={false} />
          <div className="raid-story__fleet" aria-hidden="true">
            {storyVisuals.fleet.map((ship) => (
              <RaidShipSprite key={ship.key} shipKey={ship.key} size={ship.size} />
            ))}
          </div>
          <div className="raid-story__enemy-wave" aria-hidden="true">
            {storyVisuals.enemies.map((enemy) => (
              <img
                key={`${enemy.kind}-${enemy.variant}`}
                className={enemy.kind === 'elite' ? 'raid-story__enemy raid-story__enemy--elite' : 'raid-story__enemy'}
                src={enemy.kind === 'elite' ? getRaidEliteSpriteUrl(enemy.variant) : getRaidAlienSpriteUrl(enemy.variant)}
                alt=""
                draggable={false}
              />
            ))}
          </div>

          <div className="raid-story__hud">
            <button className="raid-story__skip" type="button" onClick={() => transitionRaidStory('back')}>
              {text.raidStory.back}
            </button>
            <button className="raid-story__skip raid-story__skip--launch" type="button" onClick={() => transitionRaidStory('game')}>
              {text.raidStory.skip}
            </button>
          </div>

          <section className="raid-story__panel" aria-labelledby="raid-story-title">
            <div className="raid-story__eyebrow">{currentRaidStoryScene.eyebrow}</div>
            <h1 id="raid-story-title">{currentRaidStoryScene.title}</h1>
            <p>{currentRaidStoryScene.text}</p>

            <div className="raid-story__meta">
              <div className="raid-story__progress" aria-label={text.raidStory.progress}>
                {text.raidStory.scenes.map((scene, index) => (
                  <button
                    key={scene.title}
                    type="button"
                    className={index === raidStoryIndex ? 'raid-story__dot raid-story__dot--active' : 'raid-story__dot'}
                    aria-current={index === raidStoryIndex ? 'step' : undefined}
                    aria-label={`${text.raidStory.progress}: ${index + 1}. ${scene.title}`}
                    onClick={() => transitionRaidStory(index)}
                  />
                ))}
              </div>
              <button
                className="raid-story__next"
                type="button"
                onClick={() => {
                  transitionRaidStory(isLastStoryScene ? 'game' : 'next')
                }}
              >
                {isLastStoryScene ? text.raidStory.launch : text.raidStory.next}
              </button>
            </div>
          </section>
        </div>
        {playerNamePrompt}
        {runResultsOverlay}
      </>
    )
  }

  if (screen === 'raidEndingArchive') {
    const isLastEndingScene = codexEndingIndex >= currentCodexEndingScenes.length - 1
    const endingArchiveClass = `raid raid--ending-archive raid--ending-archive-scene-${codexEndingIndex + 1}${codexEndingFading ? ' raid--ending-archive-fading' : ''}`
    const archiveWingmen = ['fast', 'xwing', 'spaceEt', 'dreadnought']

    return (
      <>
        <div className={endingArchiveClass}>
          <div className="raid__ending" role="dialog" aria-modal="true" aria-labelledby="raid-ending-archive-title">
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
                <span>{releaseText.cutsceneArchive.ending}</span>
                <b>{currentCodexEndingScene.title}</b>
              </div>
              <div className="raid__ending-wake raid__ending-wake--host" />
              <div className="raid__ending-ship raid__ending-ship--host">
                <RaidShipSprite shipKey="rocket" size={92} />
              </div>
              <div className="raid__ending-fleet">
                {archiveWingmen.map((shipKey, index) => (
                  <span key={shipKey} style={{ '--fleet-index': index } as CSSProperties}>
                    <RaidShipSprite shipKey={shipKey} size={44} />
                  </span>
                ))}
              </div>
            </div>

            <div className="raid__ending-panel">
              <div className="raid__kicker">{releaseText.cutsceneArchive.ending}</div>
              <h2 id="raid-ending-archive-title">{currentCodexEndingScene.title}</h2>
              <p>{currentCodexEndingScene.text}</p>
              <div className="raid__ending-log raid__ending-log--archive" aria-label={releaseText.cutsceneArchive.ending}>
                {currentCodexEndingScenes.map((scene, index) => (
                  <button
                    key={scene.title}
                    type="button"
                    className={index === codexEndingIndex ? 'raid__ending-signal raid__ending-signal--active' : 'raid__ending-signal'}
                    aria-current={index === codexEndingIndex ? 'step' : undefined}
                    aria-label={releaseText.cutsceneArchive.progress.replace('{current}', String(index + 1)).replace('{total}', String(currentCodexEndingScenes.length))}
                    onClick={() => transitionCodexEnding(index)}
                    style={{ '--ending-line': index } as CSSProperties}
                  />
                ))}
              </div>
              <div className="raid__pause-actions raid__ending-actions">
                <button type="button" className="raid__menu-button" onClick={() => transitionCodexEnding(isLastEndingScene ? 'close' : 'next')}>
                  {isLastEndingScene ? raidText.menu.close : releaseText.cutsceneArchive.next}
                </button>
              </div>
            </div>
          </div>
        </div>
        {playerNamePrompt}
      </>
    )
  }

  if (screen === 'raidHangar') {
    const selectedShip = RAID_HANGAR_SHIP_OPTIONS.find((ship) => ship.key === hangarShipKey) ?? RAID_HANGAR_SHIP_OPTIONS[0]
    const selectedShipCopy = raidText.ships[selectedShip.key as keyof typeof raidText.ships] ?? selectedShip
    const selectedMastery = progress.shipMastery[selectedShip.key] ?? { xp: 0, level: 1, runs: 0, bestScore: 0, totalScore: 0, victories: 0 }
    const selectedCosmetics = getEquippedShipCosmetics(progress, selectedShip.key)
    const selectedSpriteKey = getSameScreenShipSpriteKey(selectedShip.key)
    const selectedAttackClass = getHangarAttackClass(selectedShip.key)
    const attackCopy = text.raidHangar.attacks[selectedShip.key as keyof typeof text.raidHangar.attacks] ?? text.raidHangar.attacks.rocket
    const specialCopy = text.raidHangar.specials[selectedShip.key as keyof typeof text.raidHangar.specials] ?? text.raidHangar.specials.rocket
    const isSelectedUnlocked = selectedShip.key === 'mesiah'
      ? canPlayGradiusEndless
      : selectedShip.key === 'coreLander'
        ? isCoreLanderUnlocked(progress)
        : true
    const unlockCopy = isSelectedUnlocked
      ? text.raidHangar.unlocked
      : selectedShip.key === 'coreLander'
        ? text.raidHangar.coreUnlock.replace('{score}', CORE_LANDER_UNLOCK_GRADIUS_ENDLESS_SCORE.toLocaleString())
        : text.raidHangar.raidClearUnlock

    return (
      <>
        <div className="raid-hangar">
          <div className="raid-hangar__stars" />
          <div className="raid-hangar__panel">
            <button className="mode-screen__back" type="button" onClick={() => setScreen('rocketMode')}>
              {text.rocketMode.back}
            </button>

            <div className="raid-hangar__intro">
              <span>{text.raidHangar.eyebrow}</span>
              <h1>{text.raidHangar.title}</h1>
              <p>{text.raidHangar.copy}</p>
            </div>

            <div className="raid-hangar__layout">
              <div className="raid-hangar__preview">
                <div className={isSelectedUnlocked ? 'raid-hangar__display' : 'raid-hangar__display raid-hangar__display--locked'}>
                  <div className={selectedCosmetics.aura ? 'raid-hangar__aura raid-hangar__aura--active' : 'raid-hangar__aura'} />
                  <div className={selectedCosmetics.frame ? 'raid-hangar__frame raid-hangar__frame--active' : 'raid-hangar__frame'} />
                  <div className={selectedCosmetics.trail ? 'raid-hangar__trail raid-hangar__trail--active' : 'raid-hangar__trail'} />
                  <RaidShipSprite shipKey={selectedSpriteKey} size={selectedShip.key === 'mesiah' ? 136 : selectedShip.key === 'coreLander' ? 122 : 106} />
                </div>
                <div className={`raid-hangar__attack raid-hangar__attack--${selectedAttackClass}`} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <span />
                </div>
              </div>

              <div className="raid-hangar__details">
                <span className={isSelectedUnlocked ? 'raid-hangar__status raid-hangar__status--ready' : 'raid-hangar__status'}>
                  {unlockCopy}
                </span>
                <h2>{selectedShipCopy.name}</h2>
                <p>{selectedShipCopy.role}</p>

                <div className="raid-hangar__stats">
                  <span>
                    <small>{text.raidHangar.mastery}</small>
                    <b>{text.raidHangar.level.replace('{level}', selectedMastery.level.toLocaleString())}</b>
                  </span>
                  <span>
                    <small>{text.raidHangar.best}</small>
                    <b>{selectedMastery.bestScore.toLocaleString()}</b>
                  </span>
                  <span>
                    <small>{text.raidHangar.total}</small>
                    <b>{selectedMastery.totalScore.toLocaleString()}</b>
                  </span>
                  <span>
                    <small>{text.raidHangar.victories}</small>
                    <b>{selectedMastery.victories.toLocaleString()}</b>
                  </span>
                </div>

                <div className="raid-hangar__systems">
                  <div>
                    <span>{text.raidHangar.attackProfile}</span>
                    <p>{attackCopy}</p>
                  </div>
                  <div>
                    <span>{text.raidHangar.specialSystems}</span>
                    <p>{specialCopy}</p>
                  </div>
                </div>

                <div className="raid-hangar__cosmetics">
                  {RAID_HANGAR_COSMETICS.map((cosmetic) => {
                    const unlocked = isShipCosmeticUnlocked(progress.shipMastery[selectedShip.key], cosmetic)
                    const equipped = selectedCosmetics[cosmetic]
                    const label = text.raidHangar.cosmetics[cosmetic]
                    return (
                      <span key={cosmetic} className={equipped ? 'raid-hangar__cosmetic raid-hangar__cosmetic--equipped' : 'raid-hangar__cosmetic'}>
                        <b>{label}</b>
                        <small>{unlocked ? equipped ? text.raidHangar.equipped : text.raidHangar.unlocked : cosmetic === 'trail' ? text.raidHangar.trailUnlock.replace('{score}', SHIP_COSMETIC_SINGLE_RUN_SCORE.toLocaleString()) : cosmetic === 'aura' ? text.raidHangar.auraUnlock : text.raidHangar.frameUnlock.replace('{score}', SHIP_COSMETIC_TOTAL_SCORE.toLocaleString())}</small>
                      </span>
                    )
                  })}
                </div>

                {selectedShip.key === 'coreLander' ? (
                  <p className="raid-hangar__model-note">
                    {text.raidHangar.coreModelUnlock.replace('{score}', CORE_LANDER_GOD_GUNDAM_UNLOCK_SCORE.toLocaleString())}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="raid-hangar__roster" aria-label={text.raidHangar.roster}>
              {RAID_HANGAR_SHIP_OPTIONS.map((ship) => {
                const shipCopy = raidText.ships[ship.key as keyof typeof raidText.ships] ?? ship
                const spriteKey = ship.key === 'mesiah'
                  ? getMesiahShipColor(progress) === 'white' ? 'mesiahWhite' : 'mesiahBlack'
                  : ship.key === 'coreLander'
                    ? getCoreLanderModel(progress)
                    : ship.key
                const unlocked = ship.key === 'mesiah'
                  ? canPlayGradiusEndless
                  : ship.key === 'coreLander'
                    ? isCoreLanderUnlocked(progress)
                    : true
                return (
                  <button
                    key={ship.key}
                    type="button"
                    className={ship.key === selectedShip.key ? 'raid-hangar__ship-button raid-hangar__ship-button--active' : 'raid-hangar__ship-button'}
                    onClick={() => setHangarShipKey(ship.key)}
                  >
                    <span className={unlocked ? 'raid-hangar__ship-thumb' : 'raid-hangar__ship-thumb raid-hangar__ship-thumb--locked'}>
                      <RaidShipSprite shipKey={spriteKey} size={ship.key === 'mesiah' || ship.key === 'coreLander' ? 48 : 40} />
                    </span>
                    <b>{shipCopy.name}</b>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        {playerNamePrompt}
        {runResultsOverlay}
      </>
    )
  }

  if (screen === 'rocketMode') {
    return (
      <div className="mode-screen">
        <div className="mode-screen__stars" />
        <div className="mode-screen__panel">
          <div className="mode-screen__topbar">
            <div className="mode-screen__topbar-group">
              <button className="mode-screen__utility" type="button" onClick={() => setScreen('missions')}>
                {releaseText.missions}
              </button>
              <button className="mode-screen__utility" type="button" onClick={() => setScreen('raidHangar')}>
                {text.rocketMode.hangar}
              </button>
            </div>
            <button className="mode-screen__back" onClick={() => setScreen('title')}>
              {text.rocketMode.back}
            </button>
          </div>

          <div className="mode-screen__eyebrow">{text.rocketMode.eyebrow}</div>
          <h1>{text.rocketMode.title}</h1>
          <p>{text.rocketMode.copy}</p>

          <div className="mode-screen__actions mode-screen__actions--raid">
            <button className="mode-screen__button" onClick={() => startRocketRaidSingle('campaign')}>
              <span>{text.rocketMode.single}</span>
              <strong className="mode-screen__button-fit-text">{text.rocketMode.start}</strong>
            </button>
            <button
              className="mode-screen__button mode-screen__button--endless"
              disabled={!canPlayGradiusEndless}
              onClick={() => startRocketRaidSingle('endless')}
            >
              <span>{text.rocketMode.endless}</span>
              <strong className="mode-screen__button-fit-text">{canPlayGradiusEndless ? text.rocketMode.startEndless : text.rocketMode.endlessLocked}</strong>
            </button>
            <button
              className="mode-screen__button mode-screen__button--boss-rush"
              disabled={!canPlayGradiusEndless}
              onClick={() => startRocketRaidSingle('bossRush')}
            >
              <span>{text.rocketMode.bossRush}</span>
              <strong className="mode-screen__button-fit-text">{canPlayGradiusEndless ? text.rocketMode.startBossRush : text.rocketMode.bossRushLocked}</strong>
            </button>
            <button className="mode-screen__button mode-screen__button--accent" onClick={() => setScreen('raidCoopMode')}>
              <span>{text.rocketMode.twoPlayers}</span>
              <strong className="mode-screen__button-fit-text">{text.rocketMode.multiplayer}</strong>
            </button>
          </div>
        </div>

        {playerNamePrompt}
        {runResultsOverlay}
      </div>
    )
  }

  if (screen === 'raidCoopMode') {
    const canUseLocalCoop = true
    const canUseSameScreenCoop = true

    return (
      <div className="mode-screen">
        <div className="mode-screen__stars" />
        <div className="mode-screen__panel">
          <button className="mode-screen__back" onClick={() => setScreen('rocketMode')}>
            {text.lobby.back}
          </button>

          <div className="mode-screen__eyebrow">{text.lobby.modeEyebrow}</div>
          <h1>{text.lobby.modeTitle}</h1>
          <p>{canUseLocalCoop ? text.lobby.modeCopy : canUseSameScreenCoop ? text.lobby.sameScreenModeCopy : text.lobby.onlineCoopDesc}</p>

          <div className={canUseLocalCoop || canUseSameScreenCoop ? 'mode-screen__actions mode-screen__actions--coop' : 'mode-screen__actions mode-screen__actions--coop mode-screen__actions--coop-online-only'}>
            {canUseSameScreenCoop ? (
              <button
                className="mode-screen__button mode-screen__button--same-screen"
                onClick={() => setScreen('raidSameScreenBriefing')}
              >
                <span>{text.lobby.sameScreenCoop}</span>
                <strong>{text.lobby.sameScreenCoopTitle}</strong>
                <small>{text.lobby.sameScreenCoopDesc}</small>
              </button>
            ) : null}
            {canUseLocalCoop ? (
              <button
                className="mode-screen__button mode-screen__button--local"
                onClick={() => {
                  setRaidMultiplayerConnectionMode('local')
                  setScreen('raidMultiplayer')
                }}
              >
                <span>{text.lobby.localCoop}</span>
                <strong>{text.lobby.localCoopTitle}</strong>
                <small>{text.lobby.localCoopDesc}</small>
              </button>
            ) : null}
            <button
              className="mode-screen__button mode-screen__button--accent"
              onClick={() => {
                setRaidMultiplayerConnectionMode('online')
                setScreen('raidMultiplayer')
              }}
            >
              <span>{text.lobby.onlineCoop}</span>
              <strong>{text.lobby.onlineCoopTitle}</strong>
              <small>{text.lobby.onlineCoopDesc}</small>
            </button>
          </div>
        </div>

        {playerNamePrompt}
        {runResultsOverlay}
      </div>
    )
  }

  if (screen === 'raidSameScreenBriefing') {
    const selectedGuestShip = sameScreenShipOptions.find((ship) => ship.key === sameScreenGuestShipKey) ?? sameScreenShipOptions[0]

    return (
      <div className="mode-screen">
        <div className="mode-screen__stars" />
        <div className="mode-screen__panel mode-screen__panel--briefing">
          <button className="mode-screen__back" onClick={() => setScreen('raidCoopMode')}>
            {text.lobby.back}
          </button>

          <div className="mode-screen__eyebrow">{text.lobby.sameScreenEyebrow}</div>
          <h1>{text.lobby.sameScreenTitle}</h1>
          <p>{text.lobby.sameScreenCopy}</p>

          <div className="same-screen-briefing">
            <div className="same-screen-briefing__card">
              <span>{text.lobby.sameScreenP1}</span>
              <strong>{text.lobby.sameScreenP1Controls}</strong>
            </div>
            <div className="same-screen-briefing__card same-screen-briefing__card--accent">
              <span>{text.lobby.sameScreenP2}</span>
              <strong>{text.lobby.sameScreenP2Controls}</strong>
            </div>
          </div>

          <div className="same-screen-ships" aria-label={text.lobby.sameScreenP2Ship}>
            <span>{text.lobby.sameScreenP2Ship}</span>
            <div className="same-screen-ships__grid">
              {sameScreenShipOptions.map((ship) => {
                const shipCopy = raidText.ships[ship.key as keyof typeof raidText.ships] ?? ship
                const spriteKey = getSameScreenShipSpriteKey(ship.key)
                return (
                  <button
                    key={ship.key}
                    type="button"
                    className={sameScreenGuestShipKey === ship.key ? 'same-screen-ships__button same-screen-ships__button--active' : 'same-screen-ships__button'}
                    onClick={() => setSameScreenGuestShipKey(ship.key)}
                  >
                    <RaidShipSprite shipKey={spriteKey} size={ship.key === 'mesiah' || ship.key === 'coreLander' ? 50 : 42} />
                    <strong>{shipCopy.name}</strong>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mode-screen__actions mode-screen__actions--briefing">
            <button className="mode-screen__button" onClick={() => setScreen('raidCoopMode')}>
              <strong>{text.lobby.back}</strong>
            </button>
            <button className="mode-screen__button mode-screen__button--accent" disabled={!selectedGuestShip} onClick={startSameScreenCoop}>
              <strong>{text.lobby.sameScreenStart}</strong>
            </button>
          </div>
        </div>

        {playerNamePrompt}
        {runResultsOverlay}
      </div>
    )
  }

  if (screen === 'leaderboards') {
    return (
      <>
        <LeaderboardsScreen playerName={playerName} language={language} onBack={() => setScreen('title')} />
        {playerNamePrompt}
        {runResultsOverlay}
      </>
    )
  }

  if (PROGRESSION_VIEWS.includes(screen as ProgressionView)) {
    return (
      <>
        <ProgressionScreen
          view={screen as ProgressionView}
          progress={progress}
          language={language}
          playerName={playerName}
          recoveryCode={recoveryCode}
          onBack={() => setScreen(screen === 'missions' ? 'rocketMode' : 'title')}
          onPlayCutscenes={startCodexCutscenePlayback}
          onProgressChange={(nextProgress) => {
            setProgress(nextProgress)
            syncCloudProgress(nextProgress)
          }}
        />
        {playerNamePrompt}
        {runResultsOverlay}
      </>
    )
  }

  if (screen === 'raidMultiplayer') {
    return (
      <>
        <RaidMultiplayerLobby
          playerName={playerName}
          language={language}
          connectionMode={raidMultiplayerConnectionMode}
          onBack={() => setScreen('raidCoopMode')}
          onStart={(session) => {
            setCodexCutsceneMode(null)
            setRaidMultiplayerSession(session)
            setRaidSameScreenCoop(false)
            setRaidLaunchMode('campaign')
            setActiveGame('rocketRaid')
            setScreen('game')
          }}
        />
        {playerNamePrompt}
        {runResultsOverlay}
      </>
    )
  }

  return (
    <div className="app">
      {activeGame === 'rocketRaid' ? (
        <GradiusRaid
          onClose={closeRocketRaid}
          initialMode={raidLaunchMode}
          multiplayerSession={raidMultiplayerSession}
          sameScreenCoop={raidSameScreenCoop}
          sameScreenGuestShipKey={sameScreenGuestShipKey}
          playerName={playerName}
          language={language}
          onRunComplete={handleRunComplete}
        />
      ) : (
        <SpaceImpactDefense
          availableCoins={DEFAULT_COINS}
          onClose={closeGame}
          initialMode={gameMode}
          playerName={playerName}
          language={language}
          onRunComplete={handleRunComplete}
        />
      )}
      {playerNamePrompt}
      {runResultsOverlay}
    </div>
  )
}

export default App
