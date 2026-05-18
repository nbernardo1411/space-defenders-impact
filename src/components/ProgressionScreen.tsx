import { useState } from 'react'
import {
  getCompletionPercent,
  getEquippedShipCosmetics,
  isShipCosmeticUnlocked,
  setShipCosmeticEquipped,
  SHIP_COSMETIC_SINGLE_RUN_SCORE,
  SHIP_COSMETIC_TOTAL_SCORE,
  type AchievementId,
  type CodexId,
  type ProgressState,
  type ShipMasteryRecord,
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
const DEFENSE_ACHIEVEMENT_IDS: AchievementId[] = [
  'first_sortie',
  'defense_clear',
  'defense_veteran',
  'defense_legend',
  'endless_survivor',
  'endless_warden',
  'endless_legend',
  'boss_breaker',
  'boss_executioner',
  'swarm_reaper',
  'swarm_extinction',
  'supply_magnet',
  'battle_hardened',
  'score_chaser',
  'score_legend',
]
const RAID_ACHIEVEMENT_IDS: AchievementId[] = [
  'raid_clear',
  'coop_wingman',
  'coop_clear',
  'coop_veteran',
  'nuke_saver',
  'nuke_commander',
  'restraint_protocol',
  'ship_specialist',
  'ship_adept',
  'ship_elite',
  'ship_legend',
  'fleet_captain',
  'fleet_legend',
  'squid_hunter',
  'squid_breaker',
  'serpent_breaker',
  'serpent_slayer',
  'fortress_fall',
  'fortress_ace',
  'campaign_marathon',
  'arsenal_runner',
  'ace_master',
  'all_modes',
]
const DEFENSE_CODEX_IDS: CodexId[] = [
  'earth_defense_grid',
  'tower_command',
  'alien_swarm',
  'boss_anatomy',
  'supply_routes',
  'commander_records',
  'endless_swarm',
]
const RAID_CODEX_IDS: CodexId[] = [
  'elite_contacts',
  'elite_hunter_cells',
  'asteroid_cluster',
  'asteroid_debris',
  'rift_weather',
  'derelict_wrecks',
  'planetary_routes',
  'abyss_squid',
  'squid_biology',
  'serpent_guardian',
  'serpent_scales',
  'orbital_fortress',
  'fortress_beam_core',
  'final_gauntlet',
  'ship_hangar',
  'mastery_lab',
  'pilot_academy',
  'weapon_lab',
  'pickup_arsenal',
  'nuke_protocol',
  'nuke_failsafe',
  'coop_link',
  'raid_events',
]

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
                  const cosmetics = getMasteryCosmetics(mastery, text)
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
                        <small>{text.bestScores}: {(mastery?.bestScore ?? 0).toLocaleString()} · {text.victories}: {mastery?.victories ?? 0} · {text.totalScore}: {(mastery?.totalScore ?? 0).toLocaleString()}</small>
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
                            <i>{cosmetic.unlocked ? equippedCosmetics[cosmetic.key] ? text.cosmeticEquipped : text.cosmeticEquip : `${text.cosmeticLocked}: ${cosmetic.requirement}`}</i>
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

function getMasteryCosmetics(mastery: ShipMasteryRecord | undefined, text: ReturnType<typeof getReleaseText>): Array<{ key: ShipCosmeticKey; label: string; unlocked: boolean; requirement: string }> {
  return [
    { key: 'trail', label: text.cosmeticTrail, unlocked: isShipCosmeticUnlocked(mastery, 'trail'), requirement: `${SHIP_COSMETIC_SINGLE_RUN_SCORE.toLocaleString()} ${text.cosmeticSingleRun}` },
    { key: 'aura', label: text.cosmeticAura, unlocked: isShipCosmeticUnlocked(mastery, 'aura'), requirement: text.cosmeticClearRaid },
    { key: 'frame', label: text.cosmeticFrame, unlocked: isShipCosmeticUnlocked(mastery, 'frame'), requirement: `${SHIP_COSMETIC_TOTAL_SCORE.toLocaleString()} ${text.cosmeticTotalScore}` },
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
    spaceEt: '#f8fafc',
  }[shipKey] ?? '#6ef5cb'
}

function formatTime(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}
