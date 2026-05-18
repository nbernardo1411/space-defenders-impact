import { useState } from 'react'
import {
  getCompletionPercent,
  getEquippedShipCosmetics,
  isShipCosmeticUnlocked,
  setShipCosmeticEquipped,
  SHIP_COSMETIC_LEVELS,
  type AchievementId,
  type CodexId,
  type ProgressState,
  type ShipCosmeticKey,
} from '../progression'
import { getLanguageText, getRaidText, getReleaseText, type LanguageCode } from '../i18n'
import { TowerShip } from './games/towerDefense/sprites'
import './ProgressionScreen.css'

type ProgressionView = 'profile' | 'achievements' | 'codex' | 'stageMap'

type ProgressionScreenProps = {
  view: ProgressionView
  progress: ProgressState
  language: LanguageCode
  playerName: string
  onBack: () => void
  onProgressChange: (progress: ProgressState) => void
}

const STAGE_COUNT = 15
const ALL_COSMETICS_PREVIEW = { trail: true, aura: true, frame: true }
const DEFENSE_ACHIEVEMENT_IDS: AchievementId[] = ['first_sortie', 'defense_clear', 'endless_survivor', 'boss_breaker']
const RAID_ACHIEVEMENT_IDS: AchievementId[] = ['raid_clear', 'coop_wingman', 'nuke_saver', 'ship_specialist', 'squid_hunter', 'serpent_breaker', 'fortress_fall', 'arsenal_runner', 'ace_master', 'all_modes']
const DEFENSE_CODEX_IDS: CodexId[] = ['earth_defense_grid', 'alien_swarm', 'endless_swarm']
const RAID_CODEX_IDS: CodexId[] = ['elite_contacts', 'asteroid_cluster', 'abyss_squid', 'serpent_guardian', 'orbital_fortress', 'ship_hangar', 'pickup_arsenal', 'nuke_protocol', 'raid_events']

export function ProgressionScreen({
  view,
  progress,
  language,
  playerName,
  onBack,
  onProgressChange,
}: ProgressionScreenProps) {
  const text = getReleaseText(language)
  const languageText = getLanguageText(language)
  const raidText = getRaidText(language)
  const title = getViewTitle(view, text)
  const [previewCosmeticShip, setPreviewCosmeticShip] = useState<string | null>(null)

  return (
    <div className="progress-screen">
      <div className="progress-screen__stars" />
      <section className="progress-panel" aria-labelledby="progress-title">
        <button className="progress-panel__back" type="button" onClick={onBack}>
          {text.back}
        </button>

        <header className="progress-panel__header">
          <span>{text.deckTitle}</span>
          <h1 id="progress-title">{title}</h1>
          <p>{text.deckCopy} {text.commander}: {playerName}. {text.completion}: {getCompletionPercent(progress)}%</p>
        </header>

        {view === 'profile' && (
          <div className="progress-grid">
            <article className="progress-card progress-card--wide">
              <span>{text.commander}</span>
              <strong>{playerName}</strong>
              <p>{text.completion}: {getCompletionPercent(progress)}%</p>
            </article>
            {[
              { label: text.totalRuns, value: progress.totalRuns },
              { label: text.totalScore, value: progress.totalScore.toLocaleString() },
              { label: text.playTime, value: formatTime(progress.totalPlaySeconds) },
              { label: text.victories, value: progress.victories },
              { label: text.enemies, value: progress.enemiesDestroyed },
              { label: text.bosses, value: progress.bossesDefeated },
              { label: text.pickups, value: progress.pickupsCollected, wide: true },
              { label: text.nukes, value: progress.nukesUsed, wide: true },
            ].map((stat) => (
              <article className={stat.wide ? 'progress-card progress-card--wide' : 'progress-card'} key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </article>
            ))}
            <article className="progress-card progress-card--wide progress-card--scores">
              <span>{text.bestScores}</span>
              <div className="progress-list">
                {Object.entries(languageText.leaderboards.modes).map(([mode, copy]) => (
                  <div key={mode}>
                    <b>{copy.title} {copy.label}</b>
                    <span>{progress.bestScoreByMode[mode as keyof typeof progress.bestScoreByMode].toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </article>
            <article className="progress-card progress-card--wide progress-card--mastery">
              <span>{text.masteryCosmetics}</span>
              <div className="progress-list">
                {Object.entries(raidText.ships).map(([shipKey, ship]) => {
                  const mastery = progress.shipMastery[shipKey]
                  const level = mastery?.level ?? 1
                  const cosmetics = getMasteryCosmetics(level, text)
                  const equippedCosmetics = getEquippedShipCosmetics(progress, shipKey)
                  const previewCosmetics = previewCosmeticShip === shipKey ? ALL_COSMETICS_PREVIEW : equippedCosmetics
                  return (
                    <div className="progress-ship-mastery" key={shipKey}>
                      <button
                        className={previewCosmeticShip === shipKey ? 'progress-ship-preview progress-ship-preview--active' : 'progress-ship-preview'}
                        type="button"
                        aria-label={`${ship.name} ${text.masteryCosmetics}`}
                        onClick={() => setPreviewCosmeticShip(previewCosmeticShip === shipKey ? null : shipKey)}
                      >
                        <div className={getPreviewClass(previewCosmetics, shipKey)}>
                          <TowerShip tType={shipKey} color={previewCosmetics.frame ? getMasteryPaintColor(shipKey) : '#ef233c'} size={72} elite={previewCosmetics.frame} />
                        </div>
                      </button>
                      <div className="progress-ship-info">
                        <b>{ship.name}</b>
                        <span>{text.masteryLevel} {level}</span>
                        <small>{text.masteryXp}: {(mastery?.xp ?? 0).toLocaleString()} · {text.masteryRuns}: {mastery?.runs ?? 0}</small>
                      </div>
                      <div className="progress-cosmetics" aria-label={`${ship.name} ${text.masteryCosmetics}`}>
                        {cosmetics.map((cosmetic) => (
                          <button
                            key={cosmetic.key}
                            type="button"
                            className={equippedCosmetics[cosmetic.key] ? 'progress-cosmetic progress-cosmetic--equipped' : cosmetic.unlocked ? 'progress-cosmetic progress-cosmetic--unlocked' : 'progress-cosmetic'}
                            disabled={!cosmetic.unlocked}
                            onClick={() => onProgressChange(setShipCosmeticEquipped(shipKey, cosmetic.key, !equippedCosmetics[cosmetic.key]))}
                          >
                            <span>{cosmetic.label}</span>
                            <i>{cosmetic.unlocked ? equippedCosmetics[cosmetic.key] ? text.cosmeticEquipped : text.cosmeticEquip : `${text.cosmeticLocked} Lv ${SHIP_COSMETIC_LEVELS[cosmetic.key]}`}</i>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </article>
          </div>
        )}

        {view === 'achievements' && (
          <div className="unlock-sections">
            <UnlockSection
              title={languageText.leaderboards.modes.ship_defense_normal.title}
              ids={DEFENSE_ACHIEVEMENT_IDS}
              unlockedMap={progress.achievements}
              copyMap={text.achievementsMap}
              unlockedLabel={text.unlocked}
              lockedLabel={text.locked}
            />
            <UnlockSection
              title={languageText.leaderboards.modes.gradius_solo.title}
              ids={RAID_ACHIEVEMENT_IDS}
              unlockedMap={progress.achievements}
              copyMap={text.achievementsMap}
              unlockedLabel={text.unlocked}
              lockedLabel={text.locked}
            />
          </div>
        )}

        {view === 'codex' && (
          <div className="unlock-sections">
            <UnlockSection
              title={languageText.leaderboards.modes.ship_defense_normal.title}
              ids={DEFENSE_CODEX_IDS}
              unlockedMap={progress.codex}
              copyMap={text.codexMap}
              unlockedLabel={text.unlocked}
              lockedLabel={text.locked}
            />
            <UnlockSection
              title={languageText.leaderboards.modes.gradius_solo.title}
              ids={RAID_CODEX_IDS}
              unlockedMap={progress.codex}
              copyMap={text.codexMap}
              unlockedLabel={text.unlocked}
              lockedLabel={text.locked}
            />
          </div>
        )}

        {view === 'stageMap' && (
          <div className="stage-map">
            <p>{text.stageMapCopy}</p>
            <div className="stage-map__lanes">
              <StageLane title={languageText.leaderboards.modes.ship_defense_normal.title} best={progress.bestStageByMode.ship_defense_normal} />
              <StageLane title={languageText.leaderboards.modes.gradius_solo.title} best={progress.bestStageByMode.gradius_solo} />
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function UnlockSection<TId extends AchievementId | CodexId>({
  title,
  ids,
  unlockedMap,
  copyMap,
  unlockedLabel,
  lockedLabel,
}: {
  title: string
  ids: TId[]
  unlockedMap: Partial<Record<TId, string>>
  copyMap: Record<TId, { title: string; desc: string }>
  unlockedLabel: string
  lockedLabel: string
}) {
  const unlockedCount = ids.filter((id) => unlockedMap[id]).length
  return (
    <section className="unlock-section">
      <header className="unlock-section__header">
        <span>{title}</span>
        <b>{unlockedCount}/{ids.length}</b>
      </header>
      <div className="unlock-grid unlock-grid--large">
        {ids.map((id) => (
          <UnlockCard
            key={id}
            unlocked={Boolean(unlockedMap[id])}
            title={copyMap[id].title}
            desc={copyMap[id].desc}
            unlockedLabel={unlockedLabel}
            lockedLabel={lockedLabel}
          />
        ))}
      </div>
    </section>
  )
}

function UnlockCard({
  unlocked,
  title,
  desc,
  unlockedLabel,
  lockedLabel,
}: {
  unlocked: boolean
  title: string
  desc: string
  unlockedLabel: string
  lockedLabel: string
}) {
  return (
    <article className={unlocked ? 'unlock-card unlock-card--unlocked' : 'unlock-card'}>
      <span>{unlocked ? unlockedLabel : lockedLabel}</span>
      <strong>{title}</strong>
      <p>{desc}</p>
    </article>
  )
}

function StageLane({ title, best }: { title: string; best: number }) {
  return (
    <article className="stage-lane">
      <h2>{title}</h2>
      <div className="stage-nodes">
        {Array.from({ length: STAGE_COUNT }, (_, index) => {
          const stage = index + 1
          return (
            <span key={stage} className={stage <= best ? 'stage-node stage-node--done' : 'stage-node'}>
              {stage}
            </span>
          )
        })}
      </div>
    </article>
  )
}

function getViewTitle(view: ProgressionView, text: ReturnType<typeof getReleaseText>) {
  if (view === 'profile') return text.profile
  if (view === 'achievements') return text.achievements
  if (view === 'stageMap') return text.stageMap
  return text.codex
}

function getMasteryCosmetics(level: number, text: ReturnType<typeof getReleaseText>): Array<{ key: ShipCosmeticKey; label: string; unlocked: boolean }> {
  return [
    { key: 'trail', label: text.cosmeticTrail, unlocked: isShipCosmeticUnlocked(level, 'trail') },
    { key: 'aura', label: text.cosmeticAura, unlocked: isShipCosmeticUnlocked(level, 'aura') },
    { key: 'frame', label: text.cosmeticFrame, unlocked: isShipCosmeticUnlocked(level, 'frame') },
  ]
}

function getPreviewClass(equipped: ReturnType<typeof getEquippedShipCosmetics>, shipKey: string) {
  return [
    'progress-ship-preview__ship',
    `progress-ship-preview__ship--${shipKey}`,
    equipped.trail ? 'progress-ship-preview__ship--trail' : '',
    equipped.aura ? 'progress-ship-preview__ship--aura' : '',
    equipped.frame ? 'progress-ship-preview__ship--frame' : '',
  ].filter(Boolean).join(' ')
}

function getMasteryPaintColor(shipKey: string) {
  return {
    rocket: '#38bdf8',
    fast: '#ffffff',
    gatling: '#fb923c',
    laser: '#67e8f9',
    dreadnought: '#a855f7',
    xwing: '#fde047',
    spaceEt: '#f59e0b',
  }[shipKey] ?? '#6ef5cb'
}

function formatTime(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}
