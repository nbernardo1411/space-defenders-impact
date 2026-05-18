import './App.css'
import { LeaderboardsScreen } from './components/LeaderboardsScreen'
import { ProgressionScreen } from './components/ProgressionScreen'
import { RaidMultiplayerLobby, type RaidMultiplayerSession } from './components/RaidMultiplayerLobby'
import { RunResultsOverlay } from './components/RunResultsOverlay'
import { GradiusRaid } from './components/games/GradiusRaid'
import { SpaceImpactDefense } from './components/games/SpaceImpactDefense'
import { getPublicAssetUrl } from './components/games/sound'
import { ENDLESS_UNLOCK_STORAGE_KEY } from './components/games/towerDefense/config'
import { AlienShip, TowerShip } from './components/games/towerDefense/sprites'
import {
  getInitialLanguage,
  getLanguageText,
  getReleaseText,
  isLanguageCode,
  LANGUAGE_OPTIONS,
  saveLanguage,
  type LanguageCode,
} from './i18n'
import { getStoredPlayerName, hasStoredPlayerName, saveStoredPlayerName } from './leaderboards'
import { loadProgress, recordRunResult, type ProgressState, type ProgressUpdate, type RunResult } from './progression'
import { useEffect, useMemo, useState, useRef } from 'react'

// Placeholder coins (not displayed — kept for prop compatibility)
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

type ProgressionView = 'profile' | 'achievements' | 'codex' | 'stageMap'
type ScreenState = 'title' | 'cutscene' | 'game' | 'rocketMode' | 'raidMultiplayer' | 'leaderboards' | ProgressionView
type GameMode = 'normal' | 'endless'
type ActiveGame = 'towerDefense' | 'rocketRaid'

const PROGRESSION_VIEWS: ProgressionView[] = ['profile', 'achievements', 'codex', 'stageMap']

function App() {
  const [screen, setScreen] = useState<ScreenState>('title')
  const [language, setLanguage] = useState<LanguageCode>(getInitialLanguage)
  const [gameMode, setGameMode] = useState<GameMode>('normal')
  const [activeGame, setActiveGame] = useState<ActiveGame>('towerDefense')
  const [raidMultiplayerSession, setRaidMultiplayerSession] = useState<RaidMultiplayerSession | null>(null)
  const [cutsceneIndex, setCutsceneIndex] = useState(0)
  const [playerName, setPlayerName] = useState(getStoredPlayerName)
  const [playerNameDraft, setPlayerNameDraft] = useState(playerName === 'Pilot' && !hasStoredPlayerName() ? '' : playerName)
  const [showPlayerNamePrompt, setShowPlayerNamePrompt] = useState(() => !hasStoredPlayerName())
  const [endlessUnlocked, setEndlessUnlocked] = useState(() => localStorage.getItem(ENDLESS_UNLOCK_STORAGE_KEY) === 'true')
  const [progress, setProgress] = useState<ProgressState>(() => loadProgress())
  const [lastRunUpdate, setLastRunUpdate] = useState<{ result: RunResult; update: ProgressUpdate } | null>(null)

  const text = useMemo(() => getLanguageText(language), [language])
  const releaseText = useMemo(() => getReleaseText(language), [language])
  const currentScene = useMemo(
    () => ({
      ...text.cutscene.scenes[cutsceneIndex],
      accent: CUTSCENE_SCENES[cutsceneIndex].accent,
    }),
    [cutsceneIndex, text],
  )

  const handleLanguageChange = (nextLanguage: string) => {
    if (!isLanguageCode(nextLanguage)) return
    setLanguage(nextLanguage)
    saveLanguage(nextLanguage)
  }

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
      if (bgm && screen === 'title') {
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

    if (screen === 'title') {
      if (hasInteractedRef.current) {
        bgm.play().catch(() => {})
      }
    } else {
      bgm.pause()
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
          setScreen('game')
          return current
        }
        return current + 1
      })
    }, 2600)

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
        setScreen('game')
      }
    }

    window.addEventListener('keydown', handleKeydown)

    return () => {
      window.clearTimeout(sceneTimer)
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [screen, cutsceneIndex])

  const startCutscene = () => {
    setActiveGame('towerDefense')
    setGameMode('normal')
    setCutsceneIndex(0)
    setScreen('cutscene')
  }

  const startEndless = () => {
    if (!endlessUnlocked) return
    setActiveGame('towerDefense')
    setGameMode('endless')
    setScreen('game')
  }

  const startRocketRaid = () => {
    setScreen('rocketMode')
  }

  const startRocketRaidSingle = () => {
    setRaidMultiplayerSession(null)
    setActiveGame('rocketRaid')
    setScreen('game')
  }

  const handleRunComplete = (result: RunResult) => {
    const update = recordRunResult(result)
    setProgress(update.progress)
    setLastRunUpdate({ result, update })
  }

  const savePlayerName = () => {
    if (!playerNameDraft.trim()) return
    const nextName = saveStoredPlayerName(playerNameDraft)
    setPlayerName(nextName)
    setPlayerNameDraft(nextName)
    setShowPlayerNamePrompt(false)
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
          onChange={(event) => setPlayerNameDraft(event.target.value)}
          placeholder={text.player.placeholder}
        />
        <button type="submit" disabled={!playerNameDraft.trim()}>{text.player.confirm}</button>
      </form>
    </div>
  ) : null

  const closeGame = () => {
    setEndlessUnlocked(localStorage.getItem(ENDLESS_UNLOCK_STORAGE_KEY) === 'true')
    setProgress(loadProgress())
    raidMultiplayerSession?.socket.close()
    setRaidMultiplayerSession(null)
    setScreen('title')
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
              <TowerShip tType="rocket" color="#ef233c" size={132} />
            </div>
            <div className="start-screen__sprite-ship start-screen__sprite-ship--xwing">
              <TowerShip tType="xwing" color="#38bdf8" size={108} />
            </div>
            <div className="start-screen__sprite-ship start-screen__sprite-ship--dreadnought">
              <TowerShip tType="dreadnought" color="#f97316" size={150} />
            </div>
            <div className="start-screen__sprite-ship start-screen__sprite-ship--alien-a">
              <AlienShip variant={1} isBoss={false} isFinalBoss={false} color="#a855f7" size={96} />
            </div>
            <div className="start-screen__sprite-ship start-screen__sprite-ship--alien-b">
              <AlienShip variant={3} isBoss={true} isFinalBoss={false} bossKind="carrier" color="#ef4444" size={138} />
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
                <TowerShip tType="fast" color="#ef233c" size={58} />
              </div>
              <div className="start-screen__hangar-ship start-screen__hangar-ship--two">
                <TowerShip tType="gatling" color="#f97316" size={60} />
              </div>
              <div className="start-screen__hangar-ship start-screen__hangar-ship--three">
                <TowerShip tType="laser" color="#38bdf8" size={58} />
              </div>
              <div className="start-screen__hangar-ship start-screen__hangar-ship--four">
                <TowerShip tType="spaceEt" color="#22c55e" size={64} />
              </div>
              <div className="start-screen__hangar-ship start-screen__hangar-ship--enemy">
                <AlienShip variant={2} isBoss={false} isFinalBoss={false} color="#d946ef" size={54} />
              </div>
            </div>

            <div className={endlessUnlocked ? 'start-screen__actions' : 'start-screen__actions start-screen__actions--three'} aria-label="Game modes">
              <button className="start-screen__button" onClick={startCutscene}>
                <span className="start-screen__button-kicker">{text.title.storyKicker}</span>
                <span className="start-screen__button-title">{text.title.normalTitle}</span>
                <span className="start-screen__button-copy">{text.title.normalCopy}</span>
              </button>
              {endlessUnlocked && (
                <button className="start-screen__button start-screen__button--endless" onClick={startEndless}>
                  <span className="start-screen__button-kicker">{text.title.endlessKicker}</span>
                  <span className="start-screen__button-title">{text.title.endlessTitle}</span>
                  <span className="start-screen__button-copy">{text.title.endlessCopy}</span>
                </button>
              )}
              <button className="start-screen__button start-screen__button--raid" onClick={startRocketRaid}>
                <span className="start-screen__button-kicker">{text.title.raidKicker}</span>
                <span className="start-screen__button-title">{text.title.raidTitle}</span>
                <span className="start-screen__button-copy">{text.title.raidCopy}</span>
              </button>
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
            <button className="cutscene__skip" onClick={() => setScreen('game')}>
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

  if (screen === 'rocketMode') {
    return (
      <div className="mode-screen">
        <div className="mode-screen__stars" />
        <div className="mode-screen__panel">
          <button className="mode-screen__back" onClick={() => setScreen('title')}>
            {text.rocketMode.back}
          </button>

          <div className="mode-screen__eyebrow">{text.rocketMode.eyebrow}</div>
          <h1>{text.rocketMode.title}</h1>
          <p>{text.rocketMode.copy}</p>

          <div className="mode-screen__actions">
            <button className="mode-screen__button" onClick={startRocketRaidSingle}>
              <span>{text.rocketMode.single}</span>
              <strong>{text.rocketMode.start}</strong>
            </button>
            <button className="mode-screen__button mode-screen__button--accent" onClick={() => setScreen('raidMultiplayer')}>
              <span>{text.rocketMode.twoPlayers}</span>
              <strong>{text.rocketMode.multiplayer}</strong>
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
          onBack={() => setScreen('title')}
          onProgressChange={setProgress}
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
          onBack={() => setScreen('rocketMode')}
          onStart={(session) => {
            setRaidMultiplayerSession(session)
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
          onClose={closeGame}
          multiplayerSession={raidMultiplayerSession}
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
