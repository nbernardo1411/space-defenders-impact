import { getLanguageText, getRaidText, getReleaseText, type LanguageCode } from '../i18n'
import type { ProgressUpdate, RunResult } from '../progression'

type RunResultsOverlayProps = {
  result: RunResult
  update: ProgressUpdate
  language: LanguageCode
  onClose: () => void
}

export function RunResultsOverlay({ result, update, language, onClose }: RunResultsOverlayProps) {
  const text = getReleaseText(language)
  const modeText = getLanguageText(language).leaderboards.modes[result.mode]
  const raidText = getRaidText(language)
  const statusLabel = result.status === 'victory' ? text.victory : result.status === 'gameover' ? text.gameover : text.exit
  const shipName = result.shipKey ? raidText.ships[result.shipKey as keyof typeof raidText.ships]?.name : null
  const scoreDisplay = result.teamScore ?? result.score
  const mvpPilot = result.pilots?.reduce((best, pilot) => (pilot.score > best.score ? pilot : best), result.pilots[0])
  const completedMissions = update.completedMissions.map((id) => text.missionsMap[id].title)
  const unlocks = [
    ...update.unlockedAchievements.map((id) => text.achievementsMap[id].title),
    ...update.unlockedCodex.map((id) => text.codexMap[id].title),
    ...(update.shipLevelUp && update.shipLevel ? [`${text.shipMastery} ${update.shipLevel}`] : []),
  ]

  return (
    <div className={`result-overlay result-overlay--${result.status}`} role="dialog" aria-modal="true" aria-labelledby="result-title">
      <div className="result-overlay__panel">
        <div className="result-overlay__hero">
          <span>{modeText.title} {modeText.label}</span>
          <h2 id="result-title">{statusLabel}</h2>
          <p>{text.combatReport} - {scoreDisplay.toLocaleString()} {text.score}</p>
        </div>

        <div className="result-overlay__stats">
          <div><b>{text.status}</b><strong>{statusLabel}</strong></div>
          <div><b>{result.teamScore ? text.teamScore : text.score}</b><strong>{scoreDisplay.toLocaleString()}</strong></div>
          <div><b>{text.stage}</b><strong>{result.stage}</strong></div>
          {typeof result.wave === 'number' ? <div><b>{text.wave}</b><strong>{result.wave}</strong></div> : null}
          <div><b>{text.duration}</b><strong>{formatDuration(result.durationMs ?? 0)}</strong></div>
          {result.difficulty ? <div><b>{text.difficulty}</b><strong>{formatDifficulty(result.difficulty)}</strong></div> : null}
          {mvpPilot ? <div><b>{text.mvpPilot}</b><strong>{mvpPilot.label} - {mvpPilot.score.toLocaleString()}</strong></div> : null}
          {shipName ? <div><b>{text.shipMastery}</b><strong>{shipName}</strong></div> : null}
          <div><b>{text.enemies}</b><strong>{result.enemiesDestroyed ?? 0}</strong></div>
          <div><b>{text.bosses}</b><strong>{result.bossesDefeated ?? 0}</strong></div>
          <div><b>{text.pickups}</b><strong>{result.pickupsCollected ?? 0}</strong></div>
        </div>

        {result.pilots?.length ? (
          <section className="result-overlay__pilots">
            <h3>{text.pilotBreakdown}</h3>
            <div className="result-overlay__pilot-grid">
              {result.pilots.map((pilot) => {
                const pilotShipName = raidText.ships[pilot.shipKey as keyof typeof raidText.ships]?.name ?? pilot.shipKey
                const hull = `${Math.max(0, Math.ceil(pilot.hp))}/${Math.max(1, Math.ceil(pilot.maxHp))}`
                return (
                  <article key={pilot.label} className="result-overlay__pilot-card">
                    <span>{pilot.label}</span>
                    <strong>{pilot.name}</strong>
                    <dl>
                      <div><dt>{text.ship}</dt><dd>{pilotShipName}</dd></div>
                      <div><dt>{text.score}</dt><dd>{pilot.score.toLocaleString()}</dd></div>
                      <div><dt>{text.hull}</dt><dd>{hull}</dd></div>
                    </dl>
                  </article>
                )
              })}
            </div>
          </section>
        ) : null}

        <section className="result-overlay__unlocks">
          <h3>{text.newUnlocks}</h3>
          {unlocks.length > 0 ? (
            <div>
              {unlocks.map((unlock) => <span key={unlock}>{unlock}</span>)}
            </div>
          ) : (
            <p>{text.noNewUnlocks}</p>
          )}
        </section>

        {completedMissions.length ? (
          <section className="result-overlay__unlocks result-overlay__missions">
            <h3>{text.missionsCompleted}</h3>
            <div>
              {completedMissions.map((mission) => <span key={mission}>{mission}</span>)}
            </div>
          </section>
        ) : null}

        <button type="button" onClick={onClose}>{text.continue}</button>
      </div>
    </div>
  )
}

function formatDuration(durationMs: number) {
  const seconds = Math.max(0, Math.round(durationMs / 1000))
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  if (minutes <= 0) return `${remainder}s`
  return `${minutes}m ${remainder.toString().padStart(2, '0')}s`
}

function formatDifficulty(difficulty: RunResult['difficulty']) {
  if (!difficulty) return ''
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1)
}
