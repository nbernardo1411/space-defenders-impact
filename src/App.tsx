import './App.css'
import { LeaderboardsScreen } from './components/LeaderboardsScreen'
import { RaidMultiplayerLobby, type RaidMultiplayerSession } from './components/RaidMultiplayerLobby'
import { GradiusRaid } from './components/games/GradiusRaid'
import { SpaceImpactDefense } from './components/games/SpaceImpactDefense'
import { getPublicAssetUrl } from './components/games/sound'
import { ENDLESS_UNLOCK_STORAGE_KEY } from './components/games/towerDefense/config'
import { AlienShip, TowerShip } from './components/games/towerDefense/sprites'
import { getStoredPlayerName, hasStoredPlayerName, saveStoredPlayerName } from './leaderboards'
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

type ScreenState = 'title' | 'cutscene' | 'game' | 'rocketMode' | 'raidMultiplayer' | 'leaderboards'
type GameMode = 'normal' | 'endless'
type ActiveGame = 'towerDefense' | 'rocketRaid'

function App() {
  const [screen, setScreen] = useState<ScreenState>('title')
  const [gameMode, setGameMode] = useState<GameMode>('normal')
  const [activeGame, setActiveGame] = useState<ActiveGame>('towerDefense')
  const [raidMultiplayerSession, setRaidMultiplayerSession] = useState<RaidMultiplayerSession | null>(null)
  const [cutsceneIndex, setCutsceneIndex] = useState(0)
  const [playerName, setPlayerName] = useState(getStoredPlayerName)
  const [playerNameDraft, setPlayerNameDraft] = useState(playerName === 'Pilot' && !hasStoredPlayerName() ? '' : playerName)
  const [showPlayerNamePrompt, setShowPlayerNamePrompt] = useState(() => !hasStoredPlayerName())
  const [endlessUnlocked, setEndlessUnlocked] = useState(() => localStorage.getItem(ENDLESS_UNLOCK_STORAGE_KEY) === 'true')

  const currentScene = useMemo(() => CUTSCENE_SCENES[cutsceneIndex], [cutsceneIndex])

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
        <span className="player-name-modal__eyebrow">Pilot Registration</span>
        <h2 id="player-name-title">Choose your commander name</h2>
        <p>This name is used for leaderboards and multiplayer rooms.</p>
        <input
          autoFocus
          maxLength={18}
          value={playerNameDraft}
          onChange={(event) => setPlayerNameDraft(event.target.value)}
          placeholder="Commander name"
        />
        <button type="submit" disabled={!playerNameDraft.trim()}>Confirm Name</button>
      </form>
    </div>
  ) : null

  const closeGame = () => {
    setEndlessUnlocked(localStorage.getItem(ENDLESS_UNLOCK_STORAGE_KEY) === 'true')
    raidMultiplayerSession?.socket.close()
    setRaidMultiplayerSession(null)
    setScreen('title')
  }

  if (screen === 'title') {
    return (
      <div className="start-screen">
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
              <span>Orbital Command Simulation</span>
              <span className="start-screen__version">V1.0</span>
            </div>

            <div className="start-screen__pilot">
              <span>Commander</span>
              <strong>{playerName}</strong>
              <button onClick={() => setShowPlayerNamePrompt(true)}>Change</button>
            </div>

            <div className="start-screen__title-lockup">
              <div className="start-screen__eyebrow">Earth Defense Initiative</div>
              <h1>Space Impact Defender</h1>
              <p>Deploy warships. Defend Earth. Break alien fleets across shifting space lanes.</p>
            </div>

            <div className="start-screen__status-grid" aria-label="Command status">
              <div className="start-screen__status">
                <span>Sector</span>
                <strong>Sol-3</strong>
              </div>
              <div className="start-screen__status">
                <span>Threat</span>
                <strong>Omega</strong>
              </div>
              <div className="start-screen__status">
                <span>Fleet</span>
                <strong>Ready</strong>
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

            <div className="start-screen__actions" aria-label="Game modes">
              <button className="start-screen__button" onClick={startCutscene}>
                <span className="start-screen__button-kicker">Story Briefing</span>
                <span className="start-screen__button-title">Normal Campaign</span>
                <span className="start-screen__button-copy">Hold the defense grid through escalating waves.</span>
              </button>
              {endlessUnlocked && (
                <button className="start-screen__button start-screen__button--endless" onClick={startEndless}>
                  <span className="start-screen__button-kicker">Survival Run</span>
                  <span className="start-screen__button-title">Endless Mode</span>
                  <span className="start-screen__button-copy">Fight until the fleet is overwhelmed.</span>
                </button>
              )}
              <button className="start-screen__button start-screen__button--raid" onClick={startRocketRaid}>
                <span className="start-screen__button-kicker">Pilot Assault</span>
                <span className="start-screen__button-title">Rocket Raid</span>
                <span className="start-screen__button-copy">Launch into a direct side-scroll strike.</span>
              </button>
              <button className="start-screen__button start-screen__button--leaderboards" onClick={() => setScreen('leaderboards')}>
                <span className="start-screen__button-kicker">Online Records</span>
                <span className="start-screen__button-title">Leaderboards</span>
                <span className="start-screen__button-copy">View the top ten commanders across every mode.</span>
              </button>
            </div>

            <div className="start-screen__footer">
              <span>(C) 2026 Zuki. All rights reserved.</span>
              <span>Music credit: "Shelter" by Porter Robinson &amp; Madeon.</span>
            </div>
          </div>
        </div>
        {playerNamePrompt}
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
            <div className="cutscene__tag">Command Feed</div>
            <button className="cutscene__skip" onClick={() => setScreen('game')}>
              Skip Briefing
            </button>
          </div>

          <div className="cutscene__content">
            <div className="cutscene__eyebrow">{currentScene.eyebrow}</div>
            <h2>{currentScene.title}</h2>
            <p>{currentScene.text}</p>

            <div className="cutscene__meta">
              <div className="cutscene__progress">
                {CUTSCENE_SCENES.map((scene, index) => (
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
                Press Enter, Space, or Esc to deploy immediately
              </div>
            </div>
          </div>
        </div>
        {playerNamePrompt}
      </>
    )
  }

  if (screen === 'rocketMode') {
    return (
      <div className="mode-screen">
        <div className="mode-screen__stars" />
        <div className="mode-screen__panel">
          <button className="mode-screen__back" onClick={() => setScreen('title')}>
            Back
          </button>

          <div className="mode-screen__eyebrow">Pilot Assault</div>
          <h1>Rocket Raid</h1>
          <p>Launch solo now, or open an online two-player room.</p>

          <div className="mode-screen__actions">
            <button className="mode-screen__button" onClick={startRocketRaidSingle}>
              <span>Single Player</span>
              <strong>Start Raid</strong>
            </button>
            <button className="mode-screen__button mode-screen__button--accent" onClick={() => setScreen('raidMultiplayer')}>
              <span>Two Players</span>
              <strong>Multiplayer</strong>
            </button>
          </div>
        </div>

        {playerNamePrompt}
      </div>
    )
  }

  if (screen === 'leaderboards') {
    return (
      <>
        <LeaderboardsScreen playerName={playerName} onBack={() => setScreen('title')} />
        {playerNamePrompt}
      </>
    )
  }

  if (screen === 'raidMultiplayer') {
    return (
      <>
        <RaidMultiplayerLobby
          playerName={playerName}
          onBack={() => setScreen('rocketMode')}
          onStart={(session) => {
            setRaidMultiplayerSession(session)
            setActiveGame('rocketRaid')
            setScreen('game')
          }}
        />
        {playerNamePrompt}
      </>
    )
  }

  return (
    <div className="app">
      {activeGame === 'rocketRaid' ? (
        <GradiusRaid onClose={closeGame} multiplayerSession={raidMultiplayerSession} playerName={playerName} />
      ) : (
        <SpaceImpactDefense
          availableCoins={DEFAULT_COINS}
          onClose={closeGame}
          initialMode={gameMode}
          playerName={playerName}
        />
      )}
      {playerNamePrompt}
    </div>
  )
}

export default App
