import { RAID_DEVIL_BOSS_RED_FILTERS } from './assets'
import { FINAL_BOSS_BEAM_PINCER_RADIUS, FINAL_BOSS_BEAM_SCATTER_RADIUS, FINAL_BOSS_BEAM_SINGLE_RADIUS, FINAL_BOSS_BEAM_TRIDENT_RADIUS } from './constants'
import type { Enemy } from './types'
import { clamp } from './utils'

export const FINAL_BOSS_SCATTER_LANE_OFFSETS = [-31, -13, 13, 31] as const

export const FINAL_BOSS_TRIDENT_LANE_OFFSETS = [-22, 0, 22] as const

export const FINAL_BOSS_PINCER_LANE_OFFSETS = [-24, 24] as const

export const DEVIL_BOSS_SCATTER_LANE_OFFSETS = [-26, -10, 0, 10, 26] as const

export const DEVIL_BOSS_PINCER_LANE_OFFSETS = [-20, 0, 20] as const

export const DEVIL_BOSS_TRIDENT_LANE_OFFSETS = [-18, 0, 18] as const

export function forEachFinalBossBeamLane(chargeLane: number, chargePattern: Enemy['chargePattern'], visit: (lane: number) => void) {
  if (chargePattern === 'scatter') {
    for (const offset of FINAL_BOSS_SCATTER_LANE_OFFSETS) visit(clamp(chargeLane + offset, 7, 93))
    return
  }
  if (chargePattern === 'trident') {
    for (const offset of FINAL_BOSS_TRIDENT_LANE_OFFSETS) visit(clamp(chargeLane + offset, 8, 92))
    return
  }
  if (chargePattern === 'pincer') {
    for (const offset of FINAL_BOSS_PINCER_LANE_OFFSETS) visit(clamp(chargeLane + offset, 8, 92))
    return
  }
  visit(clamp(chargeLane, 9, 91))
}

export function getFinalBossBeamLaneCount(chargePattern: Enemy['chargePattern']) {
  if (chargePattern === 'scatter') return FINAL_BOSS_SCATTER_LANE_OFFSETS.length
  if (chargePattern === 'trident') return FINAL_BOSS_TRIDENT_LANE_OFFSETS.length
  if (chargePattern === 'pincer') return FINAL_BOSS_PINCER_LANE_OFFSETS.length
  return 1
}

export function getFinalBossBeamRadius(chargePattern: Enemy['chargePattern']) {
  if (chargePattern === 'rotate') return FINAL_BOSS_BEAM_TRIDENT_RADIUS
  if (chargePattern === 'cross' || chargePattern === 'diagonal' || chargePattern === 'horizontal') return FINAL_BOSS_BEAM_PINCER_RADIUS
  if (chargePattern === 'scatter') return FINAL_BOSS_BEAM_SCATTER_RADIUS
  if (chargePattern === 'trident') return FINAL_BOSS_BEAM_TRIDENT_RADIUS
  if (chargePattern === 'pincer') return FINAL_BOSS_BEAM_PINCER_RADIUS
  return FINAL_BOSS_BEAM_SINGLE_RADIUS
}

export function getDevilBossBeamRadius(chargePattern: Enemy['chargePattern']) {
  if (chargePattern === 'horizontal') return 2.65
  if (chargePattern === 'rotate' || chargePattern === 'trident') return 2.35
  if (chargePattern === 'cross' || chargePattern === 'pincer') return 2.55
  if (chargePattern === 'scatter') return 2.2
  return 2.45
}

export function forEachDevilBossBeamLane(chargeLane: number, chargePattern: Enemy['chargePattern'], visit: (lane: number) => void) {
  if (chargePattern === 'scatter') {
    for (const offset of DEVIL_BOSS_SCATTER_LANE_OFFSETS) visit(clamp(chargeLane + offset, 7, 93))
    return
  }
  if (chargePattern === 'pincer') {
    for (const offset of DEVIL_BOSS_PINCER_LANE_OFFSETS) visit(clamp(chargeLane + offset, 8, 92))
    return
  }
  if (chargePattern === 'trident' || chargePattern === 'single') {
    for (const offset of DEVIL_BOSS_TRIDENT_LANE_OFFSETS) visit(clamp(chargeLane + offset, 8, 92))
    return
  }
  forEachFinalBossBeamLane(chargeLane, chargePattern, visit)
}

export function getDevilBossChargeDuration(chargePattern: Enemy['chargePattern'], volleyActive = false) {
  const base = chargePattern === 'rotate' ? 1.82 :
    chargePattern === 'diagonal' ? 0.72 :
    chargePattern === 'cross' ? 1.48 :
      chargePattern === 'horizontal' ? 1.58 :
        chargePattern === 'scatter' ? 1.5 :
          chargePattern === 'trident' || chargePattern === 'pincer' ? 1.54 :
            1.44
  return base + (volleyActive && chargePattern !== 'diagonal' ? 0.16 : 0)
}

export function getDevilBossRedFilter(redStep: number) {
  return RAID_DEVIL_BOSS_RED_FILTERS[String(redStep)] ?? RAID_DEVIL_BOSS_RED_FILTERS['1']
}
