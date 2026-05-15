import { useEffect, useMemo, useState } from 'react'
import {
  EMPTY_LEADERBOARDS,
  fetchLeaderboards,
  LEADERBOARD_MODES,
  type LeaderboardMap,
  type LeaderboardMode,
} from '../leaderboards'

type LeaderboardsScreenProps = {
  playerName: string
  onBack: () => void
}

export function LeaderboardsScreen({ playerName, onBack }: LeaderboardsScreenProps) {
  const [activeMode, setActiveMode] = useState<LeaderboardMode>('ship_defense_normal')
  const [leaderboards, setLeaderboards] = useState<LeaderboardMap>({ ...EMPTY_LEADERBOARDS })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const activeModeInfo = useMemo(
    () => LEADERBOARD_MODES.find((mode) => mode.key === activeMode) ?? LEADERBOARD_MODES[0],
    [activeMode],
  )
  const activeEntries = leaderboards[activeMode] ?? []
  const playerKey = playerName.trim().toLowerCase()

  const loadLeaderboards = async () => {
    setLoading(true)
    setError('')

    try {
      setLeaderboards(await fetchLeaderboards())
    } catch {
      setError('Leaderboards are temporarily unavailable.')
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
            Back
          </button>
          <div>
            <span className="leaderboards-screen__eyebrow">Online Command Records</span>
            <h1>Leaderboards</h1>
            <p>Signed in as <strong>{playerName}</strong></p>
          </div>
          <button className="leaderboards-screen__refresh" onClick={loadLeaderboards} disabled={loading}>
            {loading ? 'Syncing' : 'Refresh'}
          </button>
        </header>

        <div className="leaderboards-screen__modes" aria-label="Leaderboard modes">
          {LEADERBOARD_MODES.map((mode) => (
            <button
              key={mode.key}
              className={`leaderboards-screen__mode${activeMode === mode.key ? ' leaderboards-screen__mode--active' : ''}`}
              onClick={() => setActiveMode(mode.key)}
            >
              <span>{mode.title}</span>
              <strong>{mode.label}</strong>
            </button>
          ))}
        </div>

        <section className="leaderboards-screen__board" aria-live="polite">
          <div className="leaderboards-screen__board-header">
            <div>
              <span>{activeModeInfo.title}</span>
              <h2>{activeModeInfo.label}</h2>
            </div>
            <p>{activeModeInfo.description}</p>
          </div>

          {error ? (
            <div className="leaderboards-screen__empty">{error}</div>
          ) : loading ? (
            <div className="leaderboards-screen__empty">Loading records...</div>
          ) : activeEntries.length === 0 ? (
            <div className="leaderboards-screen__empty">No scores yet. Be the first name on this board.</div>
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
                      <small>{entry.shipKey ? entry.shipKey : 'command run'}</small>
                    </span>
                    <span className="leaderboards-screen__stage">
                      {entry.stage !== null && entry.stage !== undefined ? `Stage ${entry.stage}` : 'Final run'}
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
