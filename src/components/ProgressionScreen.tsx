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
import { BossBriefingCanvas, type BriefingBossKind } from './games/GradiusRaid'
import { getRaidAlienSpriteUrl, getRaidEliteSpriteUrl, RAID_ALIEN_SPRITE_COUNT, RAID_ELITE_SPRITE_COUNT } from './games/RaidShipSprite'
import { RaidShipSprite } from './games/RaidShipSprite'
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
const NORMAL_ALIEN_VARIANTS = Array.from({ length: RAID_ALIEN_SPRITE_COUNT }, (_, index) => index)
const ELITE_ALIEN_VARIANTS = Array.from({ length: RAID_ELITE_SPRITE_COUNT }, (_, index) => index)
const NORMAL_ALIEN_UNLOCK_STAGES = [1, 1, 2, 3, 4, 6, 8, 12]
const ELITE_ALIEN_UNLOCK_STAGES = [2, 4, 6, 8, 11]
const NORMAL_ALIEN_FILTERS = [
  'hue-rotate(-18deg) saturate(1.16)',
  'hue-rotate(24deg) saturate(1.22)',
  'hue-rotate(-8deg) saturate(1.08)',
  'hue-rotate(36deg) saturate(1.18)',
  'hue-rotate(-30deg) saturate(1.2)',
  'hue-rotate(12deg) saturate(1.16)',
  'hue-rotate(44deg) saturate(1.24)',
  'hue-rotate(-40deg) saturate(1.12)',
]
type StageBossEntry = {
  kind: BriefingBossKind
  name: string
  stage: string
  behavior: readonly string[]
}
const RAID_BOSS_STAGES: Record<BriefingBossKind, number> = {
  squid: 5,
  snake: 10,
  final: 15,
}
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
  const stageBossEntries = getStageBossEntries(raidText.briefingPanels)

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
                          <RaidShipSprite shipKey={shipKey} size={72} />
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
              <StageLane
                title={languageText.leaderboards.modes.ship_defense_normal.title}
                best={progress.bestStageByMode.ship_defense_normal}
                text={text}
              />
              <StageLane
                title={languageText.leaderboards.modes.gradius_solo.title}
                best={progress.bestStageByMode.gradius_solo}
                text={text}
                stageBossEntries={stageBossEntries}
              />
            </div>
            <EnemyAlmanac text={text} progress={progress} stageBossEntries={stageBossEntries} />
          </div>
        )}
      </section>
    </div>
  )
}

function EnemyAlmanac({
  text,
  progress,
  stageBossEntries,
}: {
  text: ReturnType<typeof getReleaseText>
  progress: ProgressState
  stageBossEntries: StageBossEntry[]
}) {
  const raidBestStage = getRaidBestStage(progress)

  return (
    <section className="enemy-almanac" aria-labelledby="enemy-almanac-title">
      <header className="enemy-almanac__header">
        <span>{text.enemyAlmanac.kicker}</span>
        <h2 id="enemy-almanac-title">{text.enemyAlmanac.title}</h2>
        <p>{text.enemyAlmanac.copy}</p>
      </header>

      <section className="enemy-almanac__group">
        <header>
          <span>{text.enemyAlmanac.normal}</span>
          <p>{text.enemyAlmanac.normalDesc}</p>
        </header>
        <div className="enemy-almanac__grid">
          {NORMAL_ALIEN_VARIANTS.map((variant) => {
            const unlockStage = NORMAL_ALIEN_UNLOCK_STAGES[variant] ?? 1
            const encountered = raidBestStage >= unlockStage
            return (
              <article className={encountered ? 'enemy-almanac__entry' : 'enemy-almanac__entry enemy-almanac__entry--locked'} key={variant}>
                <img
                  src={getRaidAlienSpriteUrl(variant)}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  style={{ filter: encountered ? `${NORMAL_ALIEN_FILTERS[variant]} drop-shadow(0 0 16px rgba(34, 211, 238, 0.18))` : undefined }}
                />
                <strong>{text.enemyAlmanac.normalNames[variant] ?? `${text.enemyAlmanac.variantLabel} ${variant + 1}`}</strong>
                <small>{encountered ? `${text.stage} ${unlockStage}` : text.enemyAlmanac.unencountered}</small>
              </article>
            )
          })}
        </div>
      </section>

      <section className="enemy-almanac__group">
        <header>
          <span>{text.enemyAlmanac.elite}</span>
          <p>{text.enemyAlmanac.eliteDesc}</p>
        </header>
        <div className="enemy-almanac__grid enemy-almanac__grid--elite">
          {ELITE_ALIEN_VARIANTS.map((variant) => {
            const unlockStage = ELITE_ALIEN_UNLOCK_STAGES[variant] ?? 2
            const encountered = raidBestStage >= unlockStage
            return (
              <article className={encountered ? 'enemy-almanac__entry enemy-almanac__entry--elite' : 'enemy-almanac__entry enemy-almanac__entry--elite enemy-almanac__entry--locked'} key={variant}>
                <img src={getRaidEliteSpriteUrl(variant)} alt="" aria-hidden="true" draggable={false} />
                <strong>{text.enemyAlmanac.eliteNames[variant] ?? `${text.enemyAlmanac.eliteLabel} ${variant + 1}`}</strong>
                <small>{encountered ? `${text.stage} ${unlockStage}` : text.enemyAlmanac.unencountered}</small>
              </article>
            )
          })}
        </div>
      </section>

      <section className="enemy-almanac__group">
        <header>
          <span>{text.enemyAlmanac.bossPool}</span>
          <p>{text.enemyAlmanac.bossPoolDesc}</p>
        </header>
        <div className="enemy-almanac__sprite-strip" aria-hidden="true">
          {NORMAL_ALIEN_VARIANTS.slice(0, 4).map((variant) => {
            const encountered = raidBestStage >= (NORMAL_ALIEN_UNLOCK_STAGES[variant] ?? 1)
            return (
              <span key={`normal-${variant}`} className={encountered ? 'enemy-almanac__pool-sprite' : 'enemy-almanac__pool-sprite enemy-almanac__pool-sprite--locked'}>
                <img src={getRaidAlienSpriteUrl(variant)} alt="" draggable={false} />
              </span>
            )
          })}
          {ELITE_ALIEN_VARIANTS.slice(0, 4).map((variant) => {
            const encountered = raidBestStage >= (ELITE_ALIEN_UNLOCK_STAGES[variant] ?? 2)
            return (
              <span key={`elite-${variant}`} className={encountered ? 'enemy-almanac__pool-sprite' : 'enemy-almanac__pool-sprite enemy-almanac__pool-sprite--locked'}>
                <img src={getRaidEliteSpriteUrl(variant)} alt="" draggable={false} />
              </span>
            )
          })}
        </div>
      </section>

      <section className="enemy-almanac__group">
        <header>
          <span>{text.enemyAlmanac.stageBosses}</span>
          <p>{text.enemyAlmanac.stageBossesDesc}</p>
        </header>
        <div className="enemy-almanac__boss-grid">
          {stageBossEntries.map((boss) => {
            const encountered = raidBestStage >= RAID_BOSS_STAGES[boss.kind]
            return (
              <article key={boss.kind} className={encountered ? 'enemy-almanac__boss-card' : 'enemy-almanac__boss-card enemy-almanac__boss-card--locked'}>
                {encountered ? <BossBriefingCanvas kind={boss.kind} /> : <div className="enemy-almanac__boss-locked" aria-hidden="true"><span /></div>}
                <div>
                  <span>{boss.stage}</span>
                  <h3>{encountered ? boss.name : text.enemyAlmanac.unknownBoss}</h3>
                  {encountered ? boss.behavior.map((line) => <p key={line}>{line}</p>) : <p>{text.enemyAlmanac.unencountered}</p>}
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </section>
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

function StageLane({
  title,
  best,
  text,
  stageBossEntries = [],
}: {
  title: string
  best: number
  text: ReturnType<typeof getReleaseText>
  stageBossEntries?: StageBossEntry[]
}) {
  const currentStage = clampStage(best > 0 ? best : 1)
  const bossByStage = getStageBossMap(stageBossEntries)

  return (
    <article className="stage-lane">
      <header className="stage-lane__header">
        <h2>{title}</h2>
        <span>{text.stageCurrent} {currentStage}</span>
      </header>
      <div className="stage-nodes">
        {Array.from({ length: STAGE_COUNT }, (_, index) => {
          const stage = index + 1
          const boss = bossByStage.get(stage)
          const isDone = stage <= best
          const isCurrent = stage === currentStage
          const bossEncountered = boss ? stage <= best : false
          const bossLabel = boss ? (bossEncountered ? boss.name : text.enemyAlmanac.unknownBoss) : ''
          return (
            <span
              key={stage}
              className={[
                'stage-node',
                isDone ? 'stage-node--done' : '',
                isCurrent ? 'stage-node--current' : '',
                boss ? 'stage-node--boss' : '',
                boss && !bossEncountered ? 'stage-node--boss-locked' : '',
              ].filter(Boolean).join(' ')}
              aria-label={`${title} ${text.stage} ${stage}${isCurrent ? `, ${text.stageCurrent}` : ''}${boss ? `, ${text.bossSignal}: ${bossLabel}` : ''}`}
            >
              <span className="stage-node__route" aria-hidden="true" />
              {boss && bossEncountered && (
                <span className="stage-node__boss-hologram" aria-hidden="true">
                  <BossBriefingCanvas kind={boss.kind} />
                </span>
              )}
              {boss && !bossEncountered && <span className="stage-node__boss-unknown" aria-hidden="true" />}
              <span className="stage-node__number">{stage}</span>
              {boss && <span className="stage-node__boss-label">{text.bossSignal}</span>}
              {isCurrent && <span className="stage-node__pin" aria-hidden="true" />}
            </span>
          )
        })}
      </div>
    </article>
  )
}

function clampStage(stage: number) {
  return Math.min(STAGE_COUNT, Math.max(1, Math.floor(stage)))
}

function getStageBossEntries(briefingPanels: ReturnType<typeof getRaidText>['briefingPanels']) {
  const entries: StageBossEntry[] = []
  for (const panel of briefingPanels) {
    if (!('bosses' in panel)) continue
    for (const boss of panel.bosses as readonly StageBossEntry[]) {
      entries.push(boss)
    }
  }
  return entries
}

function getStageBossMap(stageBossEntries: StageBossEntry[]) {
  const map = new Map<number, StageBossEntry>()
  for (const boss of stageBossEntries) {
    map.set(RAID_BOSS_STAGES[boss.kind], boss)
  }
  return map
}

function getRaidBestStage(progress: ProgressState) {
  return Math.max(progress.bestStageByMode.gradius_solo, progress.bestStageByMode.gradius_multiplayer)
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

function formatTime(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}
