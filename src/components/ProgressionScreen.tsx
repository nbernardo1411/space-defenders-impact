import { useEffect, useRef, useState } from 'react'
import {
  getCompletionPercent,
  getCoreLanderModel,
  getEquippedShipCosmetics,
  getMesiahShipColor,
  hasProgressionUnlockOverride,
  isCoreLanderGodGundamUnlocked,
  isCoreLanderUnlocked,
  isShipCosmeticUnlocked,
  setCoreLanderModel,
  setMesiahShipColor,
  setShipCosmeticEquipped,
  CORE_LANDER_GOD_GUNDAM_UNLOCK_SCORE,
  SHIP_COSMETIC_SINGLE_RUN_SCORE,
  SHIP_COSMETIC_TOTAL_SCORE,
  type AchievementId,
  type CodexId,
  type ProgressState,
  type ShipMasteryRecord,
  type ShipCosmeticEquipState,
  type ShipCosmeticKey,
  type MesiahShipColor,
  type CoreLanderModel,
} from '../progression'
import { getLanguageText, getRaidText, getReleaseText, type LanguageCode } from '../i18n'
import { BossBriefingCanvas, type BriefingBossKind } from './games/GradiusRaid'
import { getRaidAlienSpriteUrl, getRaidEliteSpriteUrl, getRaidShipSpriteUrl, RAID_ALIEN_SPRITE_COUNT, RAID_ELITE_SPRITE_COUNT } from './games/RaidShipSprite'
import './ProgressionScreen.css'

type ProgressionView = 'profile' | 'achievements' | 'codex' | 'stageMap'

type ProgressionScreenProps = {
  view: ProgressionView
  progress: ProgressState
  language: LanguageCode
  playerName: string
  recoveryCode: string
  onBack: () => void
  onProgressChange: (progress: ProgressState) => void
}

const ALL_COSMETICS_PREVIEW = { trail: true, aura: true, frame: true }
const NORMAL_ALIEN_VARIANTS = Array.from({ length: RAID_ALIEN_SPRITE_COUNT }, (_, index) => index)
const ELITE_ALIEN_VARIANTS = Array.from({ length: RAID_ELITE_SPRITE_COUNT }, (_, index) => index)
const NORMAL_ALIEN_UNLOCK_STAGES = [1, 1, 2, 3, 4, 6, 8, 12]
const ELITE_ALIEN_UNLOCK_STAGES = [2, 4, 6, 8, 11]
const SHIP_PREVIEW_CANVAS_WIDTH = 104
const SHIP_PREVIEW_CANVAS_HEIGHT = 118
const SHIP_PREVIEW_SIZE = 72
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

type ShipPreviewVisualStyle = {
  core: string
  edge: string
  soft: string
  accent: string
}

const SHIP_PREVIEW_VISUAL_STYLES: Record<string, ShipPreviewVisualStyle> = {
  rocket: {
    core: 'rgba(34,211,238,0.78)',
    edge: 'rgba(15,23,42,0.9)',
    soft: 'rgba(14,165,233,0.18)',
    accent: 'rgba(226,232,240,0.76)',
  },
  fast: {
    core: 'rgba(255,255,255,0.9)',
    edge: 'rgba(239,35,60,0.76)',
    soft: 'rgba(244,63,94,0.2)',
    accent: 'rgba(226,232,240,0.84)',
  },
  gatling: {
    core: 'rgba(251,146,60,0.82)',
    edge: 'rgba(239,35,60,0.7)',
    soft: 'rgba(251,146,60,0.2)',
    accent: 'rgba(254,215,170,0.76)',
  },
  laser: {
    core: 'rgba(34,211,238,0.86)',
    edge: 'rgba(248,250,252,0.78)',
    soft: 'rgba(34,211,238,0.18)',
    accent: 'rgba(165,243,252,0.82)',
  },
  dreadnought: {
    core: 'rgba(168,85,247,0.72)',
    edge: 'rgba(30,41,59,0.92)',
    soft: 'rgba(88,28,135,0.24)',
    accent: 'rgba(216,180,254,0.7)',
  },
  xwing: {
    core: 'rgba(250,204,21,0.78)',
    edge: 'rgba(248,250,252,0.86)',
    soft: 'rgba(250,204,21,0.16)',
    accent: 'rgba(239,68,68,0.66)',
  },
  spaceEt: {
    core: 'rgba(248,250,252,0.9)',
    edge: 'rgba(56,189,248,0.7)',
    soft: 'rgba(148,163,184,0.16)',
    accent: 'rgba(15,23,42,0.86)',
  },
  mesiah: {
    core: 'rgba(226,232,240,0.92)',
    edge: 'rgba(20,184,166,0.64)',
    soft: 'rgba(15,23,42,0.2)',
    accent: 'rgba(255,255,255,0.9)',
  },
  coreLander: {
    core: 'rgba(251,146,60,0.86)',
    edge: 'rgba(239,68,68,0.68)',
    soft: 'rgba(251,146,60,0.18)',
    accent: 'rgba(255,237,213,0.9)',
  },
  godGundam: {
    core: 'rgba(250,204,21,0.88)',
    edge: 'rgba(37,99,235,0.72)',
    soft: 'rgba(250,204,21,0.2)',
    accent: 'rgba(239,68,68,0.78)',
  },
}
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
  'raid_endless_launch',
  'raid_endless_survivor',
  'raid_endless_vanguard',
  'raid_endless_legend',
  'raid_endless_boss_reaper',
  'raid_endless_score_ace',
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
  recoveryCode,
  onBack,
  onProgressChange,
}: ProgressionScreenProps) {
  const text = getReleaseText(language)
  const languageText = getLanguageText(language)
  const raidText = getRaidText(language)
  const title = getViewTitle(view, text)
  const [previewCosmeticShip, setPreviewCosmeticShip] = useState<string | null>(null)
  const [showRecoveryCode, setShowRecoveryCode] = useState(false)
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
            <article className="progress-card progress-card--account">
              <div className="progress-account__identity">
                <span>{text.commander}</span>
                <strong>{playerName}</strong>
                <p>{text.completion}: {getCompletionPercent(progress)}%</p>
              </div>
              <div className="progress-account__recovery">
                <span>{text.recoveryCode}</span>
                <strong>{showRecoveryCode ? recoveryCode || text.recoveryMissing : maskRecoveryCode(recoveryCode)}</strong>
                <p>{text.recoveryCodeDesc}</p>
                <div className="progress-card__actions">
                  <button type="button" onClick={() => setShowRecoveryCode((visible) => !visible)} disabled={!recoveryCode}>
                    {showRecoveryCode ? text.hideRecoveryCode : text.showRecoveryCode}
                  </button>
                  <button type="button" onClick={() => copyRecoveryCode(recoveryCode)} disabled={!recoveryCode}>
                    {text.copyRecoveryCode}
                  </button>
                </div>
              </div>
            </article>
            {[
              { label: text.totalRuns, value: progress.totalRuns },
              { label: text.totalScore, value: progress.totalScore.toLocaleString() },
              { label: text.playTime, value: formatTime(progress.totalPlaySeconds) },
              { label: text.victories, value: progress.victories },
              { label: text.enemies, value: progress.enemiesDestroyed },
              { label: text.bosses, value: progress.bossesDefeated },
              { label: text.pickups, value: progress.pickupsCollected },
              { label: text.nukes, value: progress.nukesUsed },
            ].map((stat) => (
              <article className="progress-card" key={stat.label}>
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
                  const mesiahColor = getMesiahShipColor(progress)
                  const coreLanderModel = getCoreLanderModel(progress)
                  const coreLanderGodUnlocked = isCoreLanderGodGundamUnlocked(progress)
                  const lockedShip = shipKey === 'coreLander' && !isCoreLanderUnlocked(progress)
                  const previewSpriteKey = shipKey === 'mesiah'
                    ? getMesiahPreviewSpriteKey(mesiahColor)
                    : shipKey === 'coreLander'
                      ? coreLanderModel
                      : shipKey
                  const cosmetics = getMasteryCosmetics(mastery, text)
                  const equippedCosmetics = getEquippedShipCosmetics(progress, shipKey)
                  const previewCosmetics = lockedShip ? { trail: false, aura: false, frame: false } : previewCosmeticShip === shipKey ? ALL_COSMETICS_PREVIEW : equippedCosmetics
                  return (
                    <div className="progress-ship-mastery" key={shipKey}>
                      <button
                        className={previewCosmeticShip === shipKey ? 'progress-ship-preview progress-ship-preview--active' : 'progress-ship-preview'}
                        type="button"
                        aria-label={`${ship.name} ${text.masteryCosmetics}`}
                        onClick={() => {
                          if (!lockedShip) setPreviewCosmeticShip(previewCosmeticShip === shipKey ? null : shipKey)
                        }}
                      >
                        <div className={getPreviewClass(shipKey)}>
                          <ShipCosmeticCanvasPreview shipKey={shipKey} spriteKey={previewSpriteKey} cosmetics={previewCosmetics} locked={lockedShip} />
                        </div>
                      </button>
                      <div className="progress-ship-info">
                        <b>{ship.name}</b>
                        <span>{text.masteryLevel} {level}</span>
                        <small>{text.masteryXp}: {(mastery?.xp ?? 0).toLocaleString()} · {text.masteryRuns}: {mastery?.runs ?? 0}</small>
                        <small>{text.bestScores}: {(mastery?.bestScore ?? 0).toLocaleString()} · {text.victories}: {mastery?.victories ?? 0} · {text.totalScore}: {(mastery?.totalScore ?? 0).toLocaleString()}</small>
                      </div>
                      <div className="progress-cosmetics" aria-label={`${ship.name} ${text.masteryCosmetics}`}>
                        {shipKey === 'mesiah' ? (
                          <div className="progress-ship-color" aria-label={text.mesiahColor}>
                            <span>{text.mesiahColor}</span>
                            {(['black', 'white'] as MesiahShipColor[]).map((color) => (
                              <button
                                key={color}
                                type="button"
                                className={mesiahColor === color ? 'progress-ship-color__button progress-ship-color__button--active' : 'progress-ship-color__button'}
                                onClick={() => onProgressChange(setMesiahShipColor(color))}
                              >
                                <i className={`progress-ship-color__swatch progress-ship-color__swatch--${color}`} />
                                {color === 'white' ? text.mesiahWhite : text.mesiahBlack}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {shipKey === 'coreLander' ? (
                          <div className="progress-ship-color" aria-label={text.coreLanderModel}>
                            <span>{text.coreLanderModel}</span>
                            {(['coreLander', 'godGundam'] as CoreLanderModel[]).map((model) => {
                              const lockedModel = model === 'godGundam' && !coreLanderGodUnlocked
                              return (
                                <button
                                  key={model}
                                  type="button"
                                  className={coreLanderModel === model ? 'progress-ship-color__button progress-ship-color__button--active' : 'progress-ship-color__button'}
                                  disabled={lockedShip || lockedModel}
                                  onClick={() => onProgressChange(setCoreLanderModel(model))}
                                >
                                  <i className={`progress-ship-color__swatch progress-ship-color__swatch--${model}`} />
                                  {model === 'godGundam' ? text.coreLanderGodGundam : text.coreLanderDefault}
                                  {lockedModel ? <small>{text.cosmeticLocked}: {CORE_LANDER_GOD_GUNDAM_UNLOCK_SCORE.toLocaleString()} {text.coreLanderScore}</small> : null}
                                </button>
                              )
                            })}
                          </div>
                        ) : null}
                        {cosmetics.map((cosmetic) => (
                          <button
                            key={cosmetic.key}
                            type="button"
                            className={equippedCosmetics[cosmetic.key] ? 'progress-cosmetic progress-cosmetic--equipped' : cosmetic.unlocked ? 'progress-cosmetic progress-cosmetic--unlocked' : 'progress-cosmetic'}
                            disabled={lockedShip || !cosmetic.unlocked}
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
          <EnemyAlmanac text={text} progress={progress} stageBossEntries={stageBossEntries} />
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
                <header className="enemy-almanac__boss-card-title">
                  <span>{boss.stage}</span>
                  <h3>{encountered ? boss.name : text.enemyAlmanac.unknownBoss}</h3>
                </header>
                <div className="enemy-almanac__boss-art">
                  {encountered ? <BossBriefingCanvas kind={boss.kind} /> : <div className="enemy-almanac__boss-locked" aria-hidden="true"><span /></div>}
                </div>
                <div className="enemy-almanac__boss-lore">
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

function maskRecoveryCode(recoveryCode: string) {
  return recoveryCode ? '••••-••••-••••' : '••••'
}

function copyRecoveryCode(recoveryCode: string) {
  if (!recoveryCode || typeof navigator === 'undefined') return
  void navigator.clipboard?.writeText(recoveryCode)
}

function ShipCosmeticCanvasPreview({ shipKey, spriteKey, cosmetics, locked = false }: { shipKey: string; spriteKey?: string; cosmetics: Required<ShipCosmeticEquipState>; locked?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const image = new Image()
    let frameId = 0
    let disposed = false

    const render = (time: number) => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2))
      const targetWidth = Math.round(SHIP_PREVIEW_CANVAS_WIDTH * dpr)
      const targetHeight = Math.round(SHIP_PREVIEW_CANVAS_HEIGHT * dpr)
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth
        canvas.height = targetHeight
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, SHIP_PREVIEW_CANVAS_WIDTH, SHIP_PREVIEW_CANVAS_HEIGHT)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      const x = SHIP_PREVIEW_CANVAS_WIDTH / 2
      const visualKey = spriteKey ?? shipKey
      const y = visualKey === 'godGundam' ? 46 : shipKey === 'coreLander' ? 43 : 40
      const previewSize = visualKey === 'godGundam' ? 96 : shipKey === 'coreLander' ? 86 : SHIP_PREVIEW_SIZE
      const style = getShipPreviewVisualStyle(visualKey)
      const drawTrailOverSprite = visualKey === 'godGundam'

      if (!locked && cosmetics.trail && !drawTrailOverSprite) drawPreviewMasteryTrail(ctx, x, y, previewSize, time, visualKey, style)
      if (!locked && cosmetics.aura && image.complete) drawPreviewMasteryAura(ctx, image, x, y, previewSize, time, style)
      drawPreviewShipSprite(ctx, image, x, y, previewSize, cosmetics.frame, locked)
      if (!locked && cosmetics.trail && drawTrailOverSprite) {
        ctx.save()
        ctx.globalAlpha *= 0.72
        drawPreviewMasteryTrail(ctx, x, y, previewSize, time, visualKey, style)
        ctx.restore()
      }

      if (!disposed && !locked && (cosmetics.trail || cosmetics.aura)) frameId = requestAnimationFrame(render)
    }

    image.onload = () => {
      if (!disposed) frameId = requestAnimationFrame(render)
    }
    image.src = getRaidShipSpriteUrl(spriteKey ?? shipKey)
    if (image.complete) frameId = requestAnimationFrame(render)

    return () => {
      disposed = true
      if (frameId) cancelAnimationFrame(frameId)
    }
  }, [shipKey, spriteKey, cosmetics.trail, cosmetics.aura, cosmetics.frame, locked])

  return (
    <canvas
      ref={canvasRef}
      className="progress-ship-preview__canvas"
      width={SHIP_PREVIEW_CANVAS_WIDTH}
      height={SHIP_PREVIEW_CANVAS_HEIGHT}
      aria-hidden="true"
    />
  )
}

function getMesiahPreviewSpriteKey(color: MesiahShipColor) {
  return color === 'white' ? 'mesiahWhite' : 'mesiahBlack'
}

function getShipPreviewVisualStyle(shipKey: string) {
  return SHIP_PREVIEW_VISUAL_STYLES[shipKey] ?? SHIP_PREVIEW_VISUAL_STYLES.rocket
}

function drawPreviewShipSprite(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, size: number, framed: boolean, locked = false) {
  if (!image.complete) return
  ctx.save()
  ctx.filter = locked ? 'brightness(0) contrast(1.18) drop-shadow(0 0 14px rgba(0,0,0,0.88))' : framed ? 'brightness(1.28) contrast(1.42) saturate(2.25)' : 'brightness(1.12) contrast(1.14) saturate(1.26)'
  ctx.drawImage(image, x - size / 2, y - size / 2, size, size)
  ctx.restore()
}

function drawPreviewMasteryTrail(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, time: number, shipKey: string, style: ShipPreviewVisualStyle) {
  const pulse = 0.96 + Math.sin(time / 180) * 0.05
  const tailScale = shipKey === 'spaceEt' ? 1.18 : shipKey === 'dreadnought' ? 0.92 : 1
  const engineSize = shipKey === 'godGundam' ? size * 0.28 : shipKey === 'coreLander' ? size * 0.74 : size
  const engineY = shipKey === 'godGundam' ? y - size * 0.285 : shipKey === 'coreLander' ? y - size * 0.085 : y
  if (shipKey === 'godGundam') {
    const ventOffset = engineSize * 0.08
    drawSinglePreviewMasteryTrail(ctx, x - ventOffset, engineY, engineSize, pulse, tailScale, shipKey, style)
    drawSinglePreviewMasteryTrail(ctx, x + ventOffset, engineY, engineSize, pulse, tailScale, shipKey, style)
    return
  }
  drawSinglePreviewMasteryTrail(ctx, x, engineY, engineSize, pulse, tailScale, shipKey, style)
}

function drawSinglePreviewMasteryTrail(ctx: CanvasRenderingContext2D, x: number, engineY: number, engineSize: number, pulse: number, tailScale: number, shipKey: string, style: ShipPreviewVisualStyle) {
  const top = engineY + engineSize * 0.34
  const length = engineSize * 0.72 * tailScale * pulse
  const width = engineSize * (shipKey === 'dreadnought' ? 0.15 : 0.13)
  const tip = top + length

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const outer = ctx.createLinearGradient(x, top, x, tip)
  outer.addColorStop(0, style.accent)
  outer.addColorStop(0.2, style.core)
  outer.addColorStop(0.58, style.edge)
  outer.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = outer
  ctx.shadowBlur = Math.max(10, engineSize * 0.16)
  ctx.shadowColor = style.soft
  ctx.beginPath()
  ctx.moveTo(x - width * 0.58, top)
  ctx.bezierCurveTo(x - width * 0.54, top + length * 0.24, x - width * 0.16, top + length * 0.74, x, tip)
  ctx.bezierCurveTo(x + width * 0.16, top + length * 0.74, x + width * 0.54, top + length * 0.24, x + width * 0.58, top)
  ctx.closePath()
  ctx.fill()

  const inner = ctx.createLinearGradient(x, top, x, top + length * 0.68)
  inner.addColorStop(0, 'rgba(255,255,255,0.86)')
  inner.addColorStop(0.36, style.accent)
  inner.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = inner
  ctx.shadowBlur = Math.max(5, engineSize * 0.07)
  ctx.beginPath()
  ctx.moveTo(x - width * 0.23, top + engineSize * 0.01)
  ctx.bezierCurveTo(x - width * 0.2, top + length * 0.2, x - width * 0.05, top + length * 0.48, x, top + length * 0.66)
  ctx.bezierCurveTo(x + width * 0.05, top + length * 0.48, x + width * 0.2, top + length * 0.2, x + width * 0.23, top + engineSize * 0.01)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawPreviewMasteryAura(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, size: number, time: number, style: ShipPreviewVisualStyle) {
  const pulse = 0.95 + Math.sin(time / 260) * 0.12
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = 0.24 * pulse
  ctx.filter = `blur(${Math.max(5.5, size * 0.07)}px) brightness(1.55) saturate(1.75)`
  ctx.drawImage(image, x - (size * 1.18) / 2, y - (size * 1.18) / 2, size * 1.18, size * 1.18)
  ctx.globalAlpha = 0.28 * pulse
  ctx.filter = `blur(${Math.max(2.2, size * 0.032)}px) brightness(1.55) saturate(1.8)`
  ctx.drawImage(image, x - (size * 1.08) / 2, y - (size * 1.08) / 2, size * 1.08, size * 1.08)
  ctx.filter = 'none'
  ctx.globalAlpha = 0.26 * pulse
  ctx.fillStyle = style.soft
  ctx.beginPath()
  ctx.ellipse(x, y, size * 0.55, size * 0.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function getRaidBestStage(progress: ProgressState) {
  if (hasProgressionUnlockOverride()) return 15
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

function getPreviewClass(shipKey: string) {
  return [
    'progress-ship-preview__ship',
    `progress-ship-preview__ship--${shipKey}`,
  ].filter(Boolean).join(' ')
}

function formatTime(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}
