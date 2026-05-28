import { useEffect, useRef, useState, type ReactNode } from 'react'
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
import { getPublicAssetUrl } from './games/sound'
import './ProgressionScreen.css'

type ProgressionView = 'profile' | 'achievements' | 'codex' | 'stageMap'
type UnlockTab = 'raid' | 'defense'
type UnlockTabEntry = {
  key: UnlockTab
  title: string
  unlockedCount: number
  total: number
  content: ReactNode
}

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
    core: 'rgba(251,191,36,0.92)',
    edge: 'rgba(217,119,6,0.78)',
    soft: 'rgba(245,158,11,0.28)',
    accent: 'rgba(254,240,138,0.94)',
  },
  spiegel: {
    core: 'rgba(248,250,252,0.88)',
    edge: 'rgba(239,68,68,0.74)',
    soft: 'rgba(15,23,42,0.24)',
    accent: 'rgba(250,204,21,0.84)',
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
  devil: 1,
}
const DEFENSE_ACHIEVEMENT_IDS: AchievementId[] = [
  'first_sortie',
  'defense_clear',
  'defense_veteran',
  'defense_legend',
  'defense_score_elite',
  'endless_survivor',
  'endless_warden',
  'endless_legend',
  'defense_overwatch',
  'defense_endless_commander',
  'boss_breaker',
  'boss_executioner',
  'boss_annihilator',
  'swarm_reaper',
  'swarm_extinction',
  'supply_magnet',
  'supply_chain_master',
  'battle_hardened',
  'run_centurion',
  'score_chaser',
  'score_legend',
  'score_mythic',
  'score_transcendent',
]
const RAID_ACHIEVEMENT_IDS: AchievementId[] = [
  'raid_clear',
  'raid_hard_clear',
  'raid_expert_clear',
  'expert_clean_reactor',
  'raid_score_vanguard',
  'raid_score_overlord',
  'raid_expert_ace',
  'raid_endless_launch',
  'raid_endless_survivor',
  'raid_endless_vanguard',
  'raid_endless_legend',
  'raid_endless_boss_reaper',
  'raid_endless_score_ace',
  'raid_endless_super_junkie',
  'raid_endless_ultimate_junkie',
  'raid_endless_deep_space',
  'raid_endless_void_cartographer',
  'raid_endless_boss_hunter',
  'devil_contact',
  'devil_breaker',
  'devil_clean_break',
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
  'fleet_paragon',
  'all_ships_sortie',
  'fleet_mastery_circle',
  'mesiah_commander',
  'mesiah_ace',
  'core_lander_awakening',
  'god_frame_unlocked',
  'core_lander_devotee',
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
  'difficulty_protocols',
  'score_multiplier_table',
  'expert_ops_manual',
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
  'devil_gundam',
  'devil_cells',
  'master_projectile_trace',
  'devil_break_report',
  'fortress_beam_core',
  'final_gauntlet',
  'ship_hangar',
  'fleet_registry',
  'mastery_lab',
  'pilot_academy',
  'boss_defeat_chain',
  'mesiah_battleship',
  'mesiah_command_log',
  'comet_drone_protocol',
  'core_lander_frame',
  'core_frame_variants',
  'burning_mode',
  'god_barrage_art',
  'spiegel_mirage_system',
  'deep_endless_chart',
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
  const [activeUnlockTab, setActiveUnlockTab] = useState<UnlockTab>('raid')
  const stageBossEntries = getStageBossEntries(raidText.briefingPanels, text.enemyAlmanac.devilBoss)
  const raidModeTitle = languageText.leaderboards.modes.gradius_solo.title
  const defenseModeTitle = languageText.leaderboards.modes.ship_defense_normal.title

  useEffect(() => {
    if (view === 'achievements' || view === 'codex') setActiveUnlockTab('raid')
  }, [view])

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
                            {(['coreLander', 'godGundam', 'spiegel'] as CoreLanderModel[]).map((model) => {
                              const lockedModel = model !== 'coreLander' && !coreLanderGodUnlocked
                              return (
                                <button
                                  key={model}
                                  type="button"
                                  className={coreLanderModel === model ? 'progress-ship-color__button progress-ship-color__button--active' : 'progress-ship-color__button'}
                                  disabled={lockedShip || lockedModel}
                                  onClick={() => onProgressChange(setCoreLanderModel(model))}
                                >
                                  <i className={`progress-ship-color__swatch progress-ship-color__swatch--${model}`} />
                                  {model === 'godGundam' ? text.coreLanderGodGundam : model === 'spiegel' ? text.coreLanderSpiegel : text.coreLanderDefault}
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
          <UnlockTabbedSections
            activeTab={activeUnlockTab}
            onTabChange={setActiveUnlockTab}
            tabs={[
              {
                key: 'raid',
                title: raidModeTitle,
                unlockedCount: getUnlockedCount(RAID_ACHIEVEMENT_IDS, progress.achievements),
                total: RAID_ACHIEVEMENT_IDS.length,
                content: (
                  <UnlockSection
                    title={raidModeTitle}
                    ids={RAID_ACHIEVEMENT_IDS}
                    unlockedMap={progress.achievements}
                    copyMap={text.achievementsMap}
                    unlockedLabel={text.unlocked}
                    lockedLabel={text.locked}
                  />
                ),
              },
              {
                key: 'defense',
                title: defenseModeTitle,
                unlockedCount: getUnlockedCount(DEFENSE_ACHIEVEMENT_IDS, progress.achievements),
                total: DEFENSE_ACHIEVEMENT_IDS.length,
                content: (
                  <UnlockSection
                    title={defenseModeTitle}
                    ids={DEFENSE_ACHIEVEMENT_IDS}
                    unlockedMap={progress.achievements}
                    copyMap={text.achievementsMap}
                    unlockedLabel={text.unlocked}
                    lockedLabel={text.locked}
                  />
                ),
              },
            ]}
          />
        )}

        {view === 'codex' && (
          <UnlockTabbedSections
            activeTab={activeUnlockTab}
            onTabChange={setActiveUnlockTab}
            tabs={[
              {
                key: 'raid',
                title: raidModeTitle,
                unlockedCount: getUnlockedCount(RAID_CODEX_IDS, progress.codex),
                total: RAID_CODEX_IDS.length,
                content: (
                  <UnlockSection
                    title={raidModeTitle}
                    ids={RAID_CODEX_IDS}
                    unlockedMap={progress.codex}
                    copyMap={text.codexMap}
                    unlockedLabel={text.unlocked}
                    lockedLabel={text.locked}
                  />
                ),
              },
              {
                key: 'defense',
                title: defenseModeTitle,
                unlockedCount: getUnlockedCount(DEFENSE_CODEX_IDS, progress.codex),
                total: DEFENSE_CODEX_IDS.length,
                content: (
                  <UnlockSection
                    title={defenseModeTitle}
                    ids={DEFENSE_CODEX_IDS}
                    unlockedMap={progress.codex}
                    copyMap={text.codexMap}
                    unlockedLabel={text.unlocked}
                    lockedLabel={text.locked}
                  />
                ),
              },
            ]}
          />
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
            const encountered = boss.kind === 'devil'
              ? Boolean(progress.codex.devil_gundam) || hasProgressionUnlockOverride()
              : raidBestStage >= RAID_BOSS_STAGES[boss.kind]
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

function UnlockTabbedSections({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: UnlockTabEntry[]
  activeTab: UnlockTab
  onTabChange: (tab: UnlockTab) => void
}) {
  const currentTab = tabs.find((tab) => tab.key === activeTab) ?? tabs[0]

  return (
    <div className="unlock-tabbed">
      <div className="unlock-tabs" role="tablist" aria-label={currentTab.title}>
        {tabs.map((tab) => {
          const active = tab.key === currentTab.key
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              className={active ? 'unlock-tab unlock-tab--active' : 'unlock-tab'}
              onClick={() => onTabChange(tab.key)}
            >
              <span>{tab.title}</span>
              <b>{tab.unlockedCount}/{tab.total}</b>
            </button>
          )
        })}
      </div>
      <div className="unlock-tabbed__panel" role="tabpanel">
        {currentTab.content}
      </div>
    </div>
  )
}

function getUnlockedCount<TId extends AchievementId | CodexId>(ids: TId[], unlockedMap: Partial<Record<TId, string>>) {
  return ids.filter((id) => unlockedMap[id]).length
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
            id={id}
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
  id,
  unlocked,
  title,
  desc,
  unlockedLabel,
  lockedLabel,
}: {
  id: AchievementId | CodexId
  unlocked: boolean
  title: string
  desc: string
  unlockedLabel: string
  lockedLabel: string
}) {
  const badge = getUnlockBadge(id)
  const tier = badge.tier ?? 'standard'
  return (
    <article className={`unlock-card unlock-card--tier-${tier}${unlocked ? ' unlock-card--unlocked' : ''}`}>
      <UnlockBadge badge={badge} unlocked={unlocked} />
      <div className="unlock-card__body">
        <span>{unlocked ? unlockedLabel : lockedLabel}</span>
        <strong>{title}</strong>
        <p>{desc}</p>
      </div>
    </article>
  )
}

type UnlockBadgeTone = 'defense' | 'endless' | 'raid' | 'boss' | 'nuke' | 'pickup' | 'ship' | 'score' | 'coop' | 'codex'
type UnlockBadgeMark = 'shield' | 'tower' | 'orbit' | 'wing' | 'target' | 'reactor' | 'plus' | 'frame' | 'trophy' | 'link' | 'archive' | 'swarm' | 'clock' | 'beam' | 'drone' | 'cell' | 'blade' | 'map'
type UnlockBadgeAssetKind = 'ship' | 'boss' | 'wide' | 'small' | 'planet' | 'hazard'
type UnlockBadgeTier = 'standard' | 'advanced' | 'elite' | 'legendary' | 'mythic'
type UnlockBadgeDef = { tone: UnlockBadgeTone; mark: UnlockBadgeMark; label?: string; asset?: string; assetKind?: UnlockBadgeAssetKind; tier?: UnlockBadgeTier }

const BADGE_ASSETS = {
  blackComet: 'assets/ships/black-comet.png',
  redWraith: 'assets/ships/red-wraith.png',
  crimsonSaw: 'assets/ships/crimson-saw.png',
  nightLance: 'assets/ships/night-lance.png',
  obsidianArk: 'assets/ships/obsidian-ark.png',
  xWing: 'assets/ships/x-wing.png',
  spaceJet: 'assets/ships/space-jet.png',
  mesiah: 'assets/ships/mesiah-black.png',
  mesiahRaptor: 'assets/ships/mesiah-raptor-black.png',
  coreLander: 'assets/ships/core-lander.png',
  coreLanderBurning: 'assets/ships/core-lander-burning.png',
  godGundam: 'assets/ships/god-gundam.png',
  spiegel: 'assets/ships/spiegel.png',
  alien: 'assets/aliens/alien_v0.png',
  elite: 'assets/aliens/elite_3.png',
  squid: 'assets/aliens/squid_boss.png',
  cobra: 'assets/aliens/cobra_boss.png',
  finalBoss: 'assets/aliens/final_boss.png',
  devil: 'assets/GundamEnemy/devil-rage.png',
  masterGundam: 'assets/GundamEnemy/master-gundam.png',
  asteroid: 'assets/others/asteroid.png',
  comet: 'assets/others/comet.png',
  galaxy: 'assets/others/galaxy.png',
  planet: 'assets/others/planet_1.png',
} as const

const UNLOCK_BADGE_MARKS: Record<UnlockBadgeMark, string> = {
  shield: 'M32 11 47 17v10c0 11-5.8 19.2-15 25-9.2-5.8-15-14-15-25V17l15-6z',
  tower: 'M24 46h16v7H24v-7zm4-32h8v32h-8V14zm-11 9h30v7H17v-7zm4 13h22v7H21v-7z',
  orbit: 'M32 14c9.9 0 18 8.1 18 18s-8.1 18-18 18-18-8.1-18-18 8.1-18 18-18zm0 8c-5.5 0-10 4.5-10 10s4.5 10 10 10 10-4.5 10-10-4.5-10-10-10zm-19 8 38-12-13 38-6-15-13 8 8-13-14-6z',
  wing: 'M15 43 28 14l5 19 16-19-9 31-8-9-8 9-9-2z',
  target: 'M32 11a21 21 0 1 1 0 42 21 21 0 0 1 0-42zm0 9a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm0 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10z',
  reactor: 'M32 12 48 40H16L32 12zm0 12-6 10h12l-6-10zm0 20a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  plus: 'M28 16h8v12h12v8H36v12h-8V36H16v-8h12V16z',
  frame: 'M32 9 49 24l-7 22-10 9-10-9-7-22L32 9zm0 10-9 8 4 13 5 5 5-5 4-13-9-8z',
  trophy: 'M22 13h20v7h7c0 10-5 16-13 17v7h8v7H20v-7h8v-7c-8-1-13-7-13-17h7v-7zm0 7h-3c1 5 3 8 7 10-2-3-3-6-4-10zm20 0c-1 4-2 7-4 10 4-2 6-5 7-10h-3z',
  link: 'M23 38c-5 0-9-4-9-9s4-9 9-9h9v7h-9a2 2 0 0 0 0 4h9v7h-9zm9-11h-5v10h5V27zm0-7h9c5 0 9 4 9 9s-4 9-9 9h-9v-7h9a2 2 0 0 0 0-4h-9v-7z',
  archive: 'M16 15h14c3 0 5 2 5 5v31c-2-2-4-3-7-3H16V15zm21 0h11v33H37V15zm-16 9h9v5h-9v-5zm0 10h9v5h-9v-5z',
  swarm: 'M22 19a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm20 0a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM32 35a8 8 0 1 1 0 16 8 8 0 0 1 0-16z',
  clock: 'M32 11a21 21 0 1 1 0 42 21 21 0 0 1 0-42zm-3 10h6v11l9 5-3 6-12-7V21z',
  beam: 'M29 8h6v24h9L32 56 20 32h9V8z',
  drone: 'M32 12 48 22v18L32 52 16 40V22l16-10zm-7 15v8l7 5 7-5v-8l-7-4-7 4z',
  cell: 'M32 13a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm-13 22a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm26 0a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm-13 2a7 7 0 1 1 0 14 7 7 0 0 1 0-14z',
  blade: 'M35 8 48 16 31 52l-14 4 13-36 5-12z',
  map: 'M14 18 26 13l12 5 12-5v33l-12 5-12-5-12 5V18zm12 3v17l12 5V26L26 21z',
}

const UNLOCK_BADGE_OVERRIDES: Partial<Record<AchievementId | CodexId, UnlockBadgeDef>> = {
  first_sortie: { tone: 'raid', mark: 'wing', label: '01' },
  defense_clear: { tone: 'defense', mark: 'shield', label: 'DEF' },
  raid_clear: { tone: 'boss', mark: 'target', label: 'R15', asset: BADGE_ASSETS.finalBoss, assetKind: 'boss' },
  boss_breaker: { tone: 'boss', mark: 'target', label: 'B10' },
  defense_veteran: { tone: 'defense', mark: 'shield', label: 'S10' },
  defense_legend: { tone: 'defense', mark: 'shield', label: '15K' },
  defense_score_elite: { tone: 'score', mark: 'trophy', label: '30K' },
  endless_survivor: { tone: 'endless', mark: 'orbit', label: 'E15' },
  endless_warden: { tone: 'endless', mark: 'tower', label: 'E25' },
  endless_legend: { tone: 'endless', mark: 'trophy', label: 'E40' },
  defense_overwatch: { tone: 'defense', mark: 'tower', label: 'E60' },
  defense_endless_commander: { tone: 'defense', mark: 'tower', label: 'E80' },
  raid_endless_launch: { tone: 'endless', mark: 'orbit', label: 'INF', asset: BADGE_ASSETS.galaxy, assetKind: 'planet' },
  raid_endless_survivor: { tone: 'endless', mark: 'orbit', label: 'G10', asset: BADGE_ASSETS.spaceJet, assetKind: 'ship' },
  raid_endless_vanguard: { tone: 'endless', mark: 'wing', label: 'G20', asset: BADGE_ASSETS.nightLance, assetKind: 'ship' },
  raid_endless_legend: { tone: 'endless', mark: 'trophy', label: 'G30', asset: BADGE_ASSETS.obsidianArk, assetKind: 'ship' },
  raid_endless_boss_reaper: { tone: 'boss', mark: 'target', label: 'EB10', asset: BADGE_ASSETS.elite, assetKind: 'boss' },
  raid_endless_score_ace: { tone: 'score', mark: 'trophy', label: '150K' },
  raid_endless_super_junkie: { tone: 'score', mark: 'trophy', label: '5M', asset: BADGE_ASSETS.galaxy, assetKind: 'planet' },
  raid_endless_ultimate_junkie: { tone: 'score', mark: 'trophy', label: '10M', asset: BADGE_ASSETS.finalBoss, assetKind: 'boss' },
  raid_endless_deep_space: { tone: 'endless', mark: 'orbit', label: 'G50', asset: BADGE_ASSETS.galaxy, assetKind: 'planet' },
  raid_endless_void_cartographer: { tone: 'endless', mark: 'map', label: 'G75', asset: BADGE_ASSETS.comet, assetKind: 'hazard' },
  raid_endless_boss_hunter: { tone: 'boss', mark: 'target', label: 'EB25', asset: BADGE_ASSETS.finalBoss, assetKind: 'boss' },
  raid_hard_clear: { tone: 'raid', mark: 'wing', label: 'HARD' },
  raid_expert_clear: { tone: 'raid', mark: 'wing', label: 'EX' },
  expert_clean_reactor: { tone: 'nuke', mark: 'reactor', label: 'EX0' },
  raid_score_vanguard: { tone: 'score', mark: 'trophy', label: '75K', asset: BADGE_ASSETS.redWraith, assetKind: 'ship' },
  raid_score_overlord: { tone: 'score', mark: 'trophy', label: '150K', asset: BADGE_ASSETS.finalBoss, assetKind: 'boss' },
  raid_expert_ace: { tone: 'score', mark: 'trophy', label: 'EX+', asset: BADGE_ASSETS.nightLance, assetKind: 'ship' },
  devil_contact: { tone: 'boss', mark: 'cell', label: 'DG', asset: BADGE_ASSETS.devil, assetKind: 'boss' },
  devil_breaker: { tone: 'boss', mark: 'target', label: 'DGK', asset: BADGE_ASSETS.devil, assetKind: 'boss' },
  devil_clean_break: { tone: 'nuke', mark: 'shield', label: 'DG0', asset: BADGE_ASSETS.devil, assetKind: 'boss' },
  swarm_reaper: { tone: 'boss', mark: 'swarm', label: '500' },
  swarm_extinction: { tone: 'boss', mark: 'swarm', label: '2500' },
  boss_executioner: { tone: 'boss', mark: 'target', label: 'B50' },
  boss_annihilator: { tone: 'boss', mark: 'target', label: 'B150' },
  supply_magnet: { tone: 'pickup', mark: 'plus', label: 'P150' },
  supply_chain_master: { tone: 'pickup', mark: 'plus', label: 'P500' },
  battle_hardened: { tone: 'defense', mark: 'shield', label: 'R25' },
  run_centurion: { tone: 'defense', mark: 'archive', label: 'R100' },
  score_chaser: { tone: 'score', mark: 'trophy', label: '100K' },
  score_legend: { tone: 'score', mark: 'trophy', label: '500K' },
  score_mythic: { tone: 'score', mark: 'trophy', label: '2.5M' },
  score_transcendent: { tone: 'score', mark: 'trophy', label: '10M' },
  coop_wingman: { tone: 'coop', mark: 'link', label: 'CO' },
  coop_clear: { tone: 'coop', mark: 'link', label: '2P' },
  coop_veteran: { tone: 'coop', mark: 'link', label: 'C10' },
  nuke_saver: { tone: 'nuke', mark: 'reactor', label: 'N0' },
  nuke_commander: { tone: 'nuke', mark: 'reactor', label: 'N20' },
  restraint_protocol: { tone: 'nuke', mark: 'shield', label: 'R0' },
  ship_specialist: { tone: 'ship', mark: 'frame', label: 'L3', asset: BADGE_ASSETS.redWraith, assetKind: 'ship' },
  ship_adept: { tone: 'ship', mark: 'frame', label: 'L8', asset: BADGE_ASSETS.xWing, assetKind: 'ship' },
  ship_elite: { tone: 'ship', mark: 'frame', label: 'L12', asset: BADGE_ASSETS.nightLance, assetKind: 'ship' },
  ship_legend: { tone: 'ship', mark: 'frame', label: 'L16', asset: BADGE_ASSETS.obsidianArk, assetKind: 'ship' },
  fleet_captain: { tone: 'ship', mark: 'wing', label: 'F4', asset: BADGE_ASSETS.crimsonSaw, assetKind: 'ship' },
  fleet_legend: { tone: 'ship', mark: 'trophy', label: 'F5', asset: BADGE_ASSETS.spaceJet, assetKind: 'ship' },
  fleet_paragon: { tone: 'ship', mark: 'trophy', label: 'F8', asset: BADGE_ASSETS.blackComet, assetKind: 'ship' },
  all_ships_sortie: { tone: 'ship', mark: 'map', label: 'ALL', asset: BADGE_ASSETS.xWing, assetKind: 'ship' },
  fleet_mastery_circle: { tone: 'ship', mark: 'trophy', label: 'F12', asset: BADGE_ASSETS.obsidianArk, assetKind: 'ship' },
  mesiah_commander: { tone: 'ship', mark: 'drone', label: 'MSH', asset: BADGE_ASSETS.mesiah, assetKind: 'wide' },
  mesiah_ace: { tone: 'score', mark: 'trophy', label: 'M1M', asset: BADGE_ASSETS.mesiah, assetKind: 'wide' },
  core_lander_awakening: { tone: 'ship', mark: 'beam', label: 'CORE', asset: BADGE_ASSETS.coreLander, assetKind: 'ship' },
  god_frame_unlocked: { tone: 'ship', mark: 'frame', label: 'GOD', asset: BADGE_ASSETS.godGundam, assetKind: 'boss' },
  core_lander_devotee: { tone: 'score', mark: 'trophy', label: 'C5M', asset: BADGE_ASSETS.coreLanderBurning, assetKind: 'ship' },
  squid_hunter: { tone: 'boss', mark: 'target', label: 'SQ5', asset: BADGE_ASSETS.squid, assetKind: 'boss' },
  squid_breaker: { tone: 'boss', mark: 'blade', label: 'SQ+', asset: BADGE_ASSETS.squid, assetKind: 'boss' },
  serpent_breaker: { tone: 'boss', mark: 'target', label: 'S10', asset: BADGE_ASSETS.cobra, assetKind: 'boss' },
  serpent_slayer: { tone: 'boss', mark: 'blade', label: 'S+', asset: BADGE_ASSETS.cobra, assetKind: 'boss' },
  fortress_fall: { tone: 'boss', mark: 'target', label: 'F15', asset: BADGE_ASSETS.finalBoss, assetKind: 'boss' },
  fortress_ace: { tone: 'score', mark: 'trophy', label: '30K' },
  campaign_marathon: { tone: 'raid', mark: 'clock', label: '10M' },
  arsenal_runner: { tone: 'pickup', mark: 'plus', label: 'P50' },
  ace_master: { tone: 'ship', mark: 'trophy', label: 'ACE', asset: BADGE_ASSETS.redWraith, assetKind: 'ship' },
  all_modes: { tone: 'codex', mark: 'map', label: 'ALL' },
  earth_defense_grid: { tone: 'defense', mark: 'shield', label: 'GRID' },
  tower_command: { tone: 'defense', mark: 'tower', label: 'TWR' },
  alien_swarm: { tone: 'boss', mark: 'swarm', label: 'SWM' },
  boss_anatomy: { tone: 'boss', mark: 'target', label: 'BOSS' },
  supply_routes: { tone: 'pickup', mark: 'plus', label: 'SUP' },
  commander_records: { tone: 'codex', mark: 'archive', label: 'LOG' },
  weapon_lab: { tone: 'raid', mark: 'beam', label: 'LAB' },
  difficulty_protocols: { tone: 'raid', mark: 'map', label: 'DIFF' },
  score_multiplier_table: { tone: 'score', mark: 'trophy', label: 'MULT' },
  expert_ops_manual: { tone: 'raid', mark: 'wing', label: 'EX' },
  elite_contacts: { tone: 'boss', mark: 'target', label: 'ELT', asset: BADGE_ASSETS.elite, assetKind: 'boss' },
  elite_hunter_cells: { tone: 'boss', mark: 'cell', label: 'CELL', asset: BADGE_ASSETS.elite, assetKind: 'boss' },
  asteroid_cluster: { tone: 'endless', mark: 'orbit', label: 'AST', asset: BADGE_ASSETS.asteroid, assetKind: 'hazard' },
  asteroid_debris: { tone: 'endless', mark: 'swarm', label: 'DEB', asset: BADGE_ASSETS.asteroid, assetKind: 'hazard' },
  rift_weather: { tone: 'endless', mark: 'orbit', label: 'RIFT', asset: BADGE_ASSETS.comet, assetKind: 'hazard' },
  derelict_wrecks: { tone: 'codex', mark: 'archive', label: 'WRK' },
  planetary_routes: { tone: 'endless', mark: 'map', label: 'PLNT', asset: BADGE_ASSETS.planet, assetKind: 'planet' },
  abyss_squid: { tone: 'boss', mark: 'target', label: 'SQD', asset: BADGE_ASSETS.squid, assetKind: 'boss' },
  squid_biology: { tone: 'boss', mark: 'cell', label: 'BIO', asset: BADGE_ASSETS.squid, assetKind: 'boss' },
  serpent_guardian: { tone: 'boss', mark: 'target', label: 'SER', asset: BADGE_ASSETS.cobra, assetKind: 'boss' },
  serpent_scales: { tone: 'boss', mark: 'shield', label: 'SCL', asset: BADGE_ASSETS.cobra, assetKind: 'boss' },
  orbital_fortress: { tone: 'boss', mark: 'target', label: 'ORB', asset: BADGE_ASSETS.finalBoss, assetKind: 'boss' },
  devil_gundam: { tone: 'boss', mark: 'cell', label: 'DG', asset: BADGE_ASSETS.devil, assetKind: 'boss' },
  devil_cells: { tone: 'boss', mark: 'cell', label: 'DG-C', asset: BADGE_ASSETS.devil, assetKind: 'boss' },
  master_projectile_trace: { tone: 'boss', mark: 'blade', label: 'MST', asset: BADGE_ASSETS.masterGundam, assetKind: 'boss' },
  devil_break_report: { tone: 'boss', mark: 'target', label: 'DGK', asset: BADGE_ASSETS.devil, assetKind: 'boss' },
  fortress_beam_core: { tone: 'boss', mark: 'beam', label: 'BEAM', asset: BADGE_ASSETS.finalBoss, assetKind: 'boss' },
  final_gauntlet: { tone: 'boss', mark: 'target', label: 'END', asset: BADGE_ASSETS.finalBoss, assetKind: 'boss' },
  endless_swarm: { tone: 'endless', mark: 'swarm', label: 'INF' },
  ship_hangar: { tone: 'ship', mark: 'frame', label: 'SHIP', asset: BADGE_ASSETS.blackComet, assetKind: 'ship' },
  fleet_registry: { tone: 'ship', mark: 'map', label: 'FLEET', asset: BADGE_ASSETS.spaceJet, assetKind: 'ship' },
  mastery_lab: { tone: 'ship', mark: 'trophy', label: 'MST', asset: BADGE_ASSETS.redWraith, assetKind: 'ship' },
  pilot_academy: { tone: 'ship', mark: 'wing', label: 'PIL', asset: BADGE_ASSETS.xWing, assetKind: 'ship' },
  boss_defeat_chain: { tone: 'boss', mark: 'target', label: 'B25', asset: BADGE_ASSETS.elite, assetKind: 'boss' },
  mesiah_battleship: { tone: 'ship', mark: 'drone', label: 'MSH', asset: BADGE_ASSETS.mesiah, assetKind: 'wide' },
  mesiah_command_log: { tone: 'ship', mark: 'archive', label: 'MLOG', asset: BADGE_ASSETS.mesiah, assetKind: 'wide' },
  comet_drone_protocol: { tone: 'ship', mark: 'drone', label: 'DRN', asset: BADGE_ASSETS.mesiahRaptor, assetKind: 'ship' },
  core_lander_frame: { tone: 'ship', mark: 'beam', label: 'CORE', asset: BADGE_ASSETS.coreLander, assetKind: 'ship' },
  core_frame_variants: { tone: 'ship', mark: 'frame', label: 'VAR', asset: BADGE_ASSETS.godGundam, assetKind: 'boss' },
  burning_mode: { tone: 'nuke', mark: 'beam', label: 'BURN', asset: BADGE_ASSETS.coreLanderBurning, assetKind: 'ship' },
  god_barrage_art: { tone: 'ship', mark: 'blade', label: 'GOD', asset: BADGE_ASSETS.godGundam, assetKind: 'boss' },
  spiegel_mirage_system: { tone: 'ship', mark: 'drone', label: 'SPG', asset: BADGE_ASSETS.spiegel, assetKind: 'ship' },
  deep_endless_chart: { tone: 'endless', mark: 'map', label: 'G50', asset: BADGE_ASSETS.galaxy, assetKind: 'planet' },
  pickup_arsenal: { tone: 'pickup', mark: 'plus', label: 'PKUP' },
  nuke_protocol: { tone: 'nuke', mark: 'reactor', label: 'NUKE' },
  nuke_failsafe: { tone: 'nuke', mark: 'shield', label: 'SAFE' },
  coop_link: { tone: 'coop', mark: 'link', label: 'LINK' },
  raid_events: { tone: 'raid', mark: 'map', label: 'EVT' },
}

const UNLOCK_BADGE_TIERS: Partial<Record<AchievementId | CodexId, UnlockBadgeTier>> = {
  defense_clear: 'advanced',
  raid_clear: 'elite',
  boss_breaker: 'advanced',
  defense_legend: 'advanced',
  defense_score_elite: 'elite',
  endless_warden: 'advanced',
  endless_legend: 'elite',
  defense_overwatch: 'elite',
  defense_endless_commander: 'legendary',
  raid_endless_vanguard: 'advanced',
  raid_endless_legend: 'elite',
  raid_endless_boss_reaper: 'elite',
  raid_endless_score_ace: 'advanced',
  raid_endless_super_junkie: 'legendary',
  raid_endless_ultimate_junkie: 'mythic',
  raid_endless_deep_space: 'elite',
  raid_endless_void_cartographer: 'legendary',
  raid_endless_boss_hunter: 'legendary',
  raid_hard_clear: 'elite',
  raid_expert_clear: 'legendary',
  expert_clean_reactor: 'legendary',
  raid_score_vanguard: 'advanced',
  raid_score_overlord: 'legendary',
  raid_expert_ace: 'legendary',
  devil_contact: 'elite',
  devil_breaker: 'legendary',
  devil_clean_break: 'mythic',
  swarm_extinction: 'elite',
  boss_executioner: 'elite',
  boss_annihilator: 'legendary',
  supply_chain_master: 'elite',
  run_centurion: 'advanced',
  score_legend: 'advanced',
  score_mythic: 'legendary',
  score_transcendent: 'mythic',
  coop_clear: 'advanced',
  coop_veteran: 'elite',
  nuke_saver: 'elite',
  restraint_protocol: 'elite',
  ship_elite: 'elite',
  ship_legend: 'legendary',
  fleet_legend: 'elite',
  fleet_paragon: 'legendary',
  all_ships_sortie: 'legendary',
  fleet_mastery_circle: 'mythic',
  mesiah_commander: 'elite',
  mesiah_ace: 'legendary',
  core_lander_awakening: 'elite',
  god_frame_unlocked: 'legendary',
  core_lander_devotee: 'mythic',
  squid_breaker: 'advanced',
  serpent_breaker: 'advanced',
  serpent_slayer: 'elite',
  fortress_fall: 'legendary',
  fortress_ace: 'elite',
  campaign_marathon: 'elite',
  ace_master: 'advanced',
  all_modes: 'elite',
  score_multiplier_table: 'advanced',
  expert_ops_manual: 'elite',
  orbital_fortress: 'elite',
  devil_gundam: 'elite',
  devil_cells: 'elite',
  master_projectile_trace: 'elite',
  devil_break_report: 'legendary',
  fortress_beam_core: 'elite',
  final_gauntlet: 'legendary',
  fleet_registry: 'advanced',
  boss_defeat_chain: 'elite',
  mesiah_battleship: 'elite',
  mesiah_command_log: 'legendary',
  core_frame_variants: 'legendary',
  burning_mode: 'elite',
  god_barrage_art: 'legendary',
  spiegel_mirage_system: 'legendary',
  deep_endless_chart: 'elite',
}

function UnlockBadge({ badge, unlocked }: { badge: UnlockBadgeDef; unlocked: boolean }) {
  const assetKind = badge.assetKind ?? 'small'
  const tier = badge.tier ?? 'standard'
  return (
    <span className={`unlock-card__badge unlock-card__badge--${badge.tone} unlock-card__badge--tier-${tier}${unlocked ? ' unlock-card__badge--unlocked' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 64 64" focusable="false">
        <path className="unlock-card__badge-plate" d="M32 4 54 17v30L32 60 10 47V17L32 4z" />
        <path className="unlock-card__badge-core" d="M32 12 47 21v22L32 52 17 43V21l15-9z" />
        {!badge.asset ? (
          <path className={badge.label ? 'unlock-card__badge-mark unlock-card__badge-mark--ghost' : 'unlock-card__badge-mark'} d={UNLOCK_BADGE_MARKS[badge.mark]} />
        ) : null}
        {!badge.asset && badge.label ? (
          <text className="unlock-card__badge-label" x="32" y="33" textAnchor="middle" dominantBaseline="middle">
            {badge.label}
          </text>
        ) : null}
      </svg>
      {badge.asset ? (
        <>
          <img
            className={`unlock-card__badge-asset unlock-card__badge-asset--${assetKind}`}
            src={getPublicAssetUrl(badge.asset)}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            draggable={false}
          />
          {badge.label ? <i className="unlock-card__badge-chip">{badge.label}</i> : null}
        </>
      ) : null}
    </span>
  )
}

function getUnlockBadge(id: AchievementId | CodexId): UnlockBadgeDef {
  const override = UNLOCK_BADGE_OVERRIDES[id]
  if (override) return { ...override, tier: override.tier ?? getUnlockBadgeTier(id) }
  const key = String(id)
  const tier = getUnlockBadgeTier(id)
  if (key.includes('devil')) return { tone: 'boss', mark: 'target', tier }
  if (key.includes('nuke') || key.includes('reactor')) return { tone: 'nuke', mark: 'reactor', tier }
  if (key.includes('supply') || key.includes('pickup') || key.includes('arsenal')) return { tone: 'pickup', mark: 'plus', tier }
  if (key.includes('score') || key.includes('ace') || key.includes('legend') || key.includes('paragon')) return { tone: 'score', mark: 'trophy', tier }
  if (key.includes('coop') || key.includes('link')) return { tone: 'coop', mark: 'link', tier }
  if (key.includes('ship') || key.includes('fleet') || key.includes('mastery') || key.includes('mesiah') || key.includes('core_lander') || key.includes('god') || key.includes('spiegel')) {
    return { tone: 'ship', mark: 'frame', tier }
  }
  if (key.includes('boss') || key.includes('squid') || key.includes('serpent') || key.includes('fortress') || key.includes('gauntlet')) return { tone: 'boss', mark: 'target', tier }
  if (key.includes('endless') || key.includes('rift') || key.includes('orbit') || key.includes('planetary')) return { tone: 'endless', mark: 'orbit', tier }
  if (key.includes('defense') || key.includes('earth') || key.includes('tower') || key.includes('warden')) return { tone: 'defense', mark: 'shield', tier }
  if (key.includes('difficulty') || key.includes('raid') || key.includes('weapon')) return { tone: 'raid', mark: 'wing', tier }
  return { tone: 'codex', mark: 'archive', tier }
}

function getUnlockBadgeTier(id: AchievementId | CodexId): UnlockBadgeTier {
  return UNLOCK_BADGE_TIERS[id] ?? 'standard'
}

function getStageBossEntries(briefingPanels: ReturnType<typeof getRaidText>['briefingPanels'], devilBoss: StageBossEntry) {
  const entries: StageBossEntry[] = []
  for (const panel of briefingPanels) {
    if (!('bosses' in panel)) continue
    for (const boss of panel.bosses as readonly StageBossEntry[]) {
      entries.push(boss)
    }
  }
  entries.push(devilBoss)
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
      const usesCombatModel = visualKey === 'godGundam' || visualKey === 'spiegel'
      const y = usesCombatModel ? 46 : shipKey === 'coreLander' ? 43 : 40
      const previewSize = usesCombatModel ? 96 : shipKey === 'coreLander' ? 86 : SHIP_PREVIEW_SIZE
      const style = getShipPreviewVisualStyle(visualKey)
      const drawTrailOverSprite = usesCombatModel

      if (!locked && cosmetics.trail && !drawTrailOverSprite) drawPreviewMasteryTrail(ctx, x, y, previewSize, time, visualKey, style)
      if (!locked && cosmetics.aura && image.complete) drawPreviewMasteryAura(ctx, image, x, y, previewSize, time, style)
      drawPreviewShipSprite(ctx, image, x, y, previewSize, cosmetics.frame, locked, visualKey)
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

function getPreviewShipFrameFilter(shipKey: string) {
  if (shipKey === 'godGundam') return 'brightness(1.18) contrast(1.34) saturate(2.45) sepia(0.46) hue-rotate(350deg)'
  if (shipKey === 'spiegel') return 'brightness(1.2) contrast(1.34) saturate(1.9) sepia(0.24) hue-rotate(342deg)'
  return 'brightness(1.28) contrast(1.42) saturate(2.25)'
}

function drawPreviewShipSprite(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, size: number, framed: boolean, locked = false, shipKey = '') {
  if (!image.complete) return
  ctx.save()
  ctx.filter = locked ? 'brightness(0) contrast(1.18) drop-shadow(0 0 14px rgba(0,0,0,0.88))' : framed ? getPreviewShipFrameFilter(shipKey) : 'brightness(1.12) contrast(1.14) saturate(1.26)'
  ctx.drawImage(image, x - size / 2, y - size / 2, size, size)
  ctx.restore()
}

function drawPreviewMasteryTrail(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, time: number, shipKey: string, style: ShipPreviewVisualStyle) {
  const pulse = 0.96 + Math.sin(time / 180) * 0.05
  const tailScale = shipKey === 'spaceEt' ? 1.18 : shipKey === 'dreadnought' ? 0.92 : 1
  const usesCombatModel = shipKey === 'godGundam' || shipKey === 'spiegel'
  const engineSize = usesCombatModel ? size * 0.28 : shipKey === 'coreLander' ? size * 0.74 : size
  const engineY = usesCombatModel ? y - size * 0.285 : shipKey === 'coreLander' ? y - size * 0.085 : y
  if (usesCombatModel) {
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
