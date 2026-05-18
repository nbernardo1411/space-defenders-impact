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
  const unlocks = [
    ...update.unlockedAchievements.map((id) => text.achievementsMap[id].title),
    ...update.unlockedCodex.map((id) => text.codexMap[id].title),
    ...(update.shipLevelUp && update.shipLevel ? [`${text.shipMastery} ${update.shipLevel}`] : []),
  ]

  return (
    <div className="result-overlay" role="dialog" aria-modal="true" aria-labelledby="result-title">
      <div className="result-overlay__panel">
        <span>{modeText.title} {modeText.label}</span>
        <h2 id="result-title">{text.results}</h2>

        <div className="result-overlay__stats">
          <div><b>{text.status}</b><strong>{statusLabel}</strong></div>
          <div><b>{text.score}</b><strong>{result.score.toLocaleString()}</strong></div>
          <div><b>{text.stage}</b><strong>{result.stage}</strong></div>
          {typeof result.wave === 'number' ? <div><b>{text.wave}</b><strong>{result.wave}</strong></div> : null}
          {shipName ? <div><b>{text.shipMastery}</b><strong>{shipName}</strong></div> : null}
          <div><b>{text.enemies}</b><strong>{result.enemiesDestroyed ?? 0}</strong></div>
          <div><b>{text.bosses}</b><strong>{result.bossesDefeated ?? 0}</strong></div>
          <div><b>{text.pickups}</b><strong>{result.pickupsCollected ?? 0}</strong></div>
        </div>

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

        <button type="button" onClick={onClose}>{text.continue}</button>
      </div>
    </div>
  )
}
