import { useEffect, useMemo, useState } from 'react'
import {
  EMPTY_LEADERBOARDS,
  fetchLeaderboards,
  LEADERBOARD_MODES,
  type LeaderboardMap,
  type LeaderboardMode,
} from '../leaderboards'
import { getLanguageText, type LanguageCode } from '../i18n'

type LeaderboardsScreenProps = {
  playerName: string
  language: LanguageCode
  onBack: () => void
}

export function LeaderboardsScreen({ playerName, language, onBack }: LeaderboardsScreenProps) {
  const text = getLanguageText(language).leaderboards
  const [activeMode, setActiveMode] = useState<LeaderboardMode>('ship_defense_normal')
  const [leaderboards, setLeaderboards] = useState<LeaderboardMap>({ ...EMPTY_LEADERBOARDS })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const activeModeInfo = useMemo(
    () => LEADERBOARD_MODES.find((mode) => mode.key === activeMode) ?? LEADERBOARD_MODES[0],
    [activeMode],
  )
  const activeModeText = text.modes[activeModeInfo.key]
  const activeEntries = leaderboards[activeMode] ?? []
  const playerKey = playerName.trim().toLowerCase()

  const loadLeaderboards = async () => {
    setLoading(true)
    setError('')

    try {
      setLeaderboards(await fetchLeaderboards())
    } catch {
      setError(text.unavailable)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadLeaderboards()
  }, [])

  return (
    <div className="leaderboards-screen">
      <div className="leaderboards-screen__stars" />
      <div className="leaderboards-screen__shell">
        <header className="leaderboards-screen__header">
          <button className="leaderboards-screen__back" onClick={onBack}>
            {text.back}
          </button>
          <div>
            <span className="leaderboards-screen__eyebrow">{text.eyebrow}</span>
            <h1>{text.title}</h1>
            <p>{text.signedIn} <strong>{playerName}</strong></p>
          </div>
          <button className="leaderboards-screen__refresh" onClick={loadLeaderboards} disabled={loading}>
            {loading ? text.syncing : text.refresh}
          </button>
        </header>

        <div className="leaderboards-screen__modes" aria-label="Leaderboard modes">
          {LEADERBOARD_MODES.map((mode) => (
            <button
              key={mode.key}
              className={`leaderboards-screen__mode${activeMode === mode.key ? ' leaderboards-screen__mode--active' : ''}`}
              onClick={() => setActiveMode(mode.key)}
            >
              <span>{text.modes[mode.key].title}</span>
              <strong>{text.modes[mode.key].label}</strong>
            </button>
          ))}
        </div>

        <section className="leaderboards-screen__board" aria-live="polite">
          <div className="leaderboards-screen__board-header">
            <div>
              <span>{activeModeText.title}</span>
              <h2>{activeModeText.label}</h2>
            </div>
            <p>{activeModeText.description}</p>
          </div>

          {error ? (
            <div className="leaderboards-screen__empty">{error}</div>
          ) : loading ? (
            <div className="leaderboards-screen__empty">{text.loading}</div>
          ) : activeEntries.length === 0 ? (
            <div className="leaderboards-screen__empty">{text.empty}</div>
          ) : (
            <ol className="leaderboards-screen__list">
              {activeEntries.map((entry) => {
                const isPlayer = entry.playerName.trim().toLowerCase() === playerKey

                return (
                  <li
                    key={`${entry.rank}-${entry.playerName}-${entry.score}-${entry.createdAt ?? ''}`}
                    className={`leaderboards-screen__row${isPlayer ? ' leaderboards-screen__row--player' : ''}`}
                  >
                    <span className="leaderboards-screen__rank">#{entry.rank}</span>
                    <span className="leaderboards-screen__pilot">
                      <strong>{entry.playerName}</strong>
                      <small>{entry.shipKey ? entry.shipKey : text.commandRun}</small>
                    </span>
                    <span className="leaderboards-screen__stage">
                      {entry.stage !== null && entry.stage !== undefined ? `${text.stage} ${entry.stage}` : text.finalRun}
                    </span>
                    <span className="leaderboards-screen__score">{entry.score.toLocaleString()}</span>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}
