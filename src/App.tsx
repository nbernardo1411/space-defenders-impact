import './App.css'
import { GradiusRaid } from './components/games/GradiusRaid'
import { SpaceImpactDefense } from './components/games/SpaceImpactDefense'
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

type ScreenState = 'title' | 'cutscene' | 'game'
type GameMode = 'normal' | 'endless'
type ActiveGame = 'towerDefense' | 'rocketRaid'

function App() {
  const [screen, setScreen] = useState<ScreenState>('title')
  const [gameMode, setGameMode] = useState<GameMode>('normal')
  const [activeGame, setActiveGame] = useState<ActiveGame>('towerDefense')
  const [cutsceneIndex, setCutsceneIndex] = useState(0)

  const currentScene = useMemo(() => CUTSCENE_SCENES[cutsceneIndex], [cutsceneIndex])

  // =========================
  // MENU BGM CONTROL
  // =========================
  const bgmRef = useRef<HTMLAudioElement | null>(null)
  const hasInteractedRef = useRef(false)

  // init audio
  useEffect(() => {
    const audio = new Audio('/audio/bgm_shelter.wav')
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
    setActiveGame('towerDefense')
    setGameMode('endless')
    setScreen('game')
  }

  const startRocketRaid = () => {
    setActiveGame('rocketRaid')
    setScreen('game')
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
          <div className="start-screen__ship start-screen__ship--frigate" />
          <div className="start-screen__ship start-screen__ship--fighter" />
          <div className="start-screen__ship start-screen__ship--enemy" />
          <div className="start-screen__ship start-screen__ship--enemy2" />
        </div>

        <div className="start-screen__content">
          <div className="start-screen__eyebrow">Orbital Command Simulation</div>
          <h1>Space Impact Defense</h1>
          <p>Deploy warships. Defend Earth. Break alien fleets across shifting space lanes.</p>

          <div className="start-screen__actions">
            <button className="start-screen__button" onClick={startCutscene}>
              Normal Campaign
            </button>
            <button className="start-screen__button start-screen__button--endless" onClick={startEndless}>
              Endless Mode
            </button>
            <button className="start-screen__button start-screen__button--raid" onClick={startRocketRaid}>
              Rocket Raid
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'cutscene') {
    return (
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
    )
  }

  return (
    <div className="app">
      {activeGame === 'rocketRaid' ? (
        <GradiusRaid onClose={() => setScreen('title')} />
      ) : (
        <SpaceImpactDefense
          availableCoins={DEFAULT_COINS}
          onClose={() => setScreen('title')}
          initialMode={gameMode}
        />
      )}
    </div>
  )
}

export default App