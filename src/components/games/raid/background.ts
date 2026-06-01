import { getPublicAssetUrl } from '../sound'
import type { GraphicsQuality } from '../sound'
import { getRaidAlienSpriteUrl, getRaidEliteSpriteUrl, getRaidShipSpriteUrl } from '../RaidShipSprite'
import { Application, Assets, Container, FillGradient, Graphics, Sprite, Texture } from 'pixi.js'
import { RAID_OTHER_ASSET_PATHS, drawCanvasImageContain, getRaidOtherCanvasSprite } from './assets'
import type { RaidOtherAssetKey } from './assets'
import { COMET_ASSET_HEAD_ANGLE, DEG } from './constants'
import type { CameraShakeState } from './types'
import { clamp, seededNoise } from './utils'

export type RaidPalette = {
  baseTop: string
  baseMid: string
  baseBottom: string
  surfaceMode: string
  surfaceA: string
  surfaceB: string
  surfaceC: string
  bgA: string
  bgB: string
  nebulaA: string
  nebulaB: string
  starTint: string
  streak: string
  planetA: string
  planetB: string
  planetC: string
}

export const DEFAULT_RAID_PALETTE: RaidPalette = {
  baseTop: '#020307',
  baseMid: '#060812',
  baseBottom: '#070a10',
  surfaceMode: 'ruins',
  surfaceA: '#172033',
  surfaceB: '#243447',
  surfaceC: '#64748b',
  bgA: 'rgba(239, 35, 60, 0.16)',
  bgB: 'rgba(14, 165, 233, 0.13)',
  nebulaA: 'rgba(127, 29, 29, 0.3)',
  nebulaB: 'rgba(8, 47, 73, 0.32)',
  starTint: 'rgba(248, 113, 113, 0.64)',
  streak: 'rgba(239, 35, 60, 0.5)',
  planetA: '#7c3aed',
  planetB: '#7f1d1d',
  planetC: '#164e63',
}

export const BACKGROUND_STARS = Array.from({ length: 220 }, (_, index) => ({
  x: seededNoise(index, 1),
  y: seededNoise(index, 2),
  size: 0.75 + seededNoise(index, 3) * 1.35,
  alpha: 0.34 + seededNoise(index, 4) * 0.56,
  tint: seededNoise(index, 5),
}))

export const BACKGROUND_ASTEROIDS = [
  { x: 0.34, width: 22, height: 18, speed: 0.128, delay: -2, alpha: 0.52, spin: 180 },
  { x: 0.62, width: 14, height: 11, speed: 0.082, delay: -6, alpha: 0.38, spin: -240 },
  { x: 0.78, width: 32, height: 26, speed: 0.064, delay: -10, alpha: 0.44, spin: 120 },
  { x: 0.18, width: 10, height: 8, speed: 0.105, delay: -4, alpha: 0.3, spin: 300 },
  { x: 0.5, width: 18, height: 14, speed: 0.052, delay: -14, alpha: 0.35, spin: -160 },
]

export const BACKGROUND_DEBRIS = [
  { x: 0.28, width: 38, height: 28, speed: 0.034, delay: -12, alpha: 0.12, spin: 220 },
  { x: 0.58, width: 24, height: 18, speed: 0.024, delay: -28, alpha: 0.12, spin: -180 },
  { x: 0.82, width: 18, height: 14, speed: 0.03, delay: -8, alpha: 0.12, spin: 140 },
]

const FINAL_BATTLE_FIGHTERS: Array<{
  side: 'ally' | 'enemy'
  asset: string
  assetKind: 'ship' | 'alien' | 'elite'
  weapon: 'laser' | 'spread' | 'scatter' | 'rocket' | 'homing'
  x: number
  ySeed: number
  speed: number
  drift: number
  size: number
  phase: number
}> = [
  { side: 'ally', asset: 'rocket', assetKind: 'ship', weapon: 'rocket', x: 0.18, ySeed: 0.08, speed: 0.035, drift: 0.038, size: 0.05, phase: 0.4 },
  { side: 'ally', asset: 'laser', assetKind: 'ship', weapon: 'laser', x: 0.32, ySeed: 0.62, speed: 0.032, drift: 0.05, size: 0.044, phase: 1.8 },
  { side: 'ally', asset: 'xwing', assetKind: 'ship', weapon: 'spread', x: 0.68, ySeed: 0.18, speed: 0.036, drift: 0.045, size: 0.046, phase: 3.1 },
  { side: 'ally', asset: 'spaceEt', assetKind: 'ship', weapon: 'homing', x: 0.84, ySeed: 0.72, speed: 0.03, drift: 0.035, size: 0.043, phase: 4.6 },
  { side: 'enemy', asset: '0', assetKind: 'alien', weapon: 'scatter', x: 0.24, ySeed: 0.34, speed: 0.031, drift: 0.045, size: 0.05, phase: 2.2 },
  { side: 'enemy', asset: '2', assetKind: 'alien', weapon: 'spread', x: 0.44, ySeed: 0.02, speed: 0.037, drift: 0.038, size: 0.046, phase: 5.4 },
  { side: 'enemy', asset: '1', assetKind: 'elite', weapon: 'laser', x: 0.62, ySeed: 0.52, speed: 0.033, drift: 0.052, size: 0.052, phase: 0.9 },
  { side: 'enemy', asset: '4', assetKind: 'elite', weapon: 'rocket', x: 0.78, ySeed: 0.28, speed: 0.029, drift: 0.04, size: 0.055, phase: 3.7 },
]

const FINAL_BATTLE_EXPLOSIONS = [
  { x: 0.16, ySeed: 0.16, speed: 0.026, period: 5.2, offset: 0.6, radius: 0.044 },
  { x: 0.38, ySeed: 0.74, speed: 0.021, period: 6.8, offset: 2.1, radius: 0.036 },
  { x: 0.66, ySeed: 0.38, speed: 0.024, period: 5.8, offset: 3.2, radius: 0.04 },
  { x: 0.9, ySeed: 0.7, speed: 0.019, period: 7.4, offset: 1.4, radius: 0.05 },
]

const FINAL_BATTLE_CRUISERS = [
  { asset: 'dreadnought', x: 0.14, ySeed: 0.1, speed: 0.027, drift: 0.028, size: 0.096, phase: 0.8, alpha: 0.62 },
  { asset: 'mesiah', x: 0.76, ySeed: 0.42, speed: 0.021, drift: -0.018, size: 0.108, phase: 2.6, alpha: 0.54 },
  { asset: 'rocket', x: 0.42, ySeed: 0.72, speed: 0.048, drift: 0.036, size: 0.074, phase: 4.1, alpha: 0.66 },
  { asset: 'xwing', x: 0.9, ySeed: 0.86, speed: 0.056, drift: -0.032, size: 0.07, phase: 5.3, alpha: 0.62 },
] as const

function getFinalBattleTextureKey(fighter: typeof FINAL_BATTLE_FIGHTERS[number]) {
  return `final-battle:${fighter.assetKind}:${fighter.asset}`
}

function getFinalBattleTextureUrl(fighter: typeof FINAL_BATTLE_FIGHTERS[number]) {
  if (fighter.assetKind === 'ship') return getRaidShipSpriteUrl(fighter.asset)
  const variant = Number(fighter.asset) || 0
  return fighter.assetKind === 'elite' ? getRaidEliteSpriteUrl(variant) : getRaidAlienSpriteUrl(variant)
}

function getFinalBattleCruiserTextureKey(cruiser: typeof FINAL_BATTLE_CRUISERS[number]) {
  return `final-battle:cruiser:${cruiser.asset}`
}

const WORLD_SURFACE_TILE_OFFSETS = [-1, 0, 1] as const

type WorldCloudLayer = {
  asset: RaidOtherAssetKey
  band: 'low' | 'mid' | 'high'
  x: number
  ySeed: number
  speed: number
  width: number
  height: number
  alpha: number
  rotation: number
  drift: number
}

const WATERY_WORLD_CLOUD_LAYERS: WorldCloudLayer[] = [
  { asset: 'clouds2', band: 'low', x: 0.2, ySeed: 0.08, speed: 0.027, width: 0.88, height: 0.34, alpha: 0.68, rotation: -6 * DEG, drift: 0.038 },
  { asset: 'clouds', band: 'low', x: 0.78, ySeed: 0.3, speed: 0.024, width: 0.76, height: 0.3, alpha: 0.62, rotation: 8 * DEG, drift: 0.03 },
  { asset: 'clouds2', band: 'mid', x: 0.45, ySeed: 0.52, speed: 0.02, width: 1.04, height: 0.36, alpha: 0.48, rotation: 3 * DEG, drift: 0.024 },
  { asset: 'clouds', band: 'mid', x: 0.12, ySeed: 0.73, speed: 0.017, width: 0.7, height: 0.25, alpha: 0.38, rotation: -11 * DEG, drift: 0.018 },
  { asset: 'clouds2', band: 'high', x: 0.86, ySeed: 0.9, speed: 0.014, width: 0.64, height: 0.24, alpha: 0.28, rotation: 10 * DEG, drift: 0.014 },
]

const WATERY_WORLD_ISLAND_SCROLL_SPEED = 0.024

const WATERY_WORLD_ISLAND_LAYERS: Array<{
  asset: RaidOtherAssetKey
  x: number
  ySeed: number
  size: number
  alpha: number
  rotation: number
  drift: number
}> = [
  { asset: 'island', x: 0.28, ySeed: 0.1, size: 0.27, alpha: 0.58, rotation: -8 * DEG, drift: 0.024 },
  { asset: 'island2', x: 0.73, ySeed: 0.35, size: 0.22, alpha: 0.5, rotation: 13 * DEG, drift: 0.018 },
  { asset: 'island3', x: 0.48, ySeed: 0.58, size: 0.29, alpha: 0.5, rotation: 4 * DEG, drift: 0.02 },
  { asset: 'island', x: 0.84, ySeed: 0.78, size: 0.24, alpha: 0.44, rotation: -12 * DEG, drift: 0.017 },
  { asset: 'island2', x: 0.14, ySeed: 0.9, size: 0.19, alpha: 0.42, rotation: -18 * DEG, drift: 0.016 },
]

const VOLCANIC_WORLD_CLOUD_LAYERS: WorldCloudLayer[] = [
  { asset: 'volcanicClouds2', band: 'low', x: 0.22, ySeed: 0.1, speed: 0.028, width: 0.9, height: 0.34, alpha: 0.64, rotation: -5 * DEG, drift: 0.034 },
  { asset: 'volcanicClouds', band: 'low', x: 0.78, ySeed: 0.34, speed: 0.023, width: 0.76, height: 0.31, alpha: 0.58, rotation: 7 * DEG, drift: 0.027 },
  { asset: 'volcanicClouds2', band: 'mid', x: 0.46, ySeed: 0.56, speed: 0.019, width: 1, height: 0.34, alpha: 0.45, rotation: 3 * DEG, drift: 0.022 },
  { asset: 'volcanicClouds', band: 'mid', x: 0.13, ySeed: 0.76, speed: 0.016, width: 0.72, height: 0.26, alpha: 0.35, rotation: -10 * DEG, drift: 0.017 },
  { asset: 'volcanicClouds2', band: 'high', x: 0.86, ySeed: 0.92, speed: 0.013, width: 0.66, height: 0.24, alpha: 0.26, rotation: 9 * DEG, drift: 0.014 },
]

const VOLCANIC_WORLD_ISLAND_SCROLL_SPEED = 0.024

const VOLCANIC_WORLD_ISLAND_LAYERS: Array<{
  asset: RaidOtherAssetKey
  x: number
  ySeed: number
  size: number
  alpha: number
  rotation: number
  drift: number
}> = [
  { asset: 'volcano', x: 0.3, ySeed: 0.08, size: 0.34, alpha: 0.68, rotation: -6 * DEG, drift: 0.022 },
  { asset: 'volcano2', x: 0.74, ySeed: 0.34, size: 0.28, alpha: 0.58, rotation: 10 * DEG, drift: 0.018 },
  { asset: 'volcano3', x: 0.48, ySeed: 0.6, size: 0.31, alpha: 0.62, rotation: 4 * DEG, drift: 0.02 },
  { asset: 'volcano', x: 0.86, ySeed: 0.8, size: 0.24, alpha: 0.48, rotation: -13 * DEG, drift: 0.016 },
  { asset: 'volcano2', x: 0.14, ySeed: 0.92, size: 0.2, alpha: 0.44, rotation: 16 * DEG, drift: 0.014 },
]

export const BACKGROUND_SPEED_LINES = [
  { x: 0.11, length: 170, width: 2, delay: -0.2, color: 'streak' },
  { x: 0.32, length: 120, width: 1, delay: -0.42, color: 'white' },
  { x: 0.63, length: 150, width: 2, delay: -0.16, color: 'red' },
  { x: 0.88, length: 135, width: 1, delay: -0.34, color: 'cyan' },
] as const

export const RAID_PLANET_DEPTH_SCALES = [
  [1.08, 0.74, 0.88],
  [0.72, 1.2, 0.62],
  [1.34, 0.66, 1.08],
  [0.9, 1.42, 0.72],
  [1.18, 0.84, 1.28],
  [0.64, 1.06, 0.82],
] as const

export type RaidBackgroundGalaxyLayer = {
  asset: RaidOtherAssetKey
  x: number
  y: number
  width: number
  height: number
  alpha: number
  rotation: number
  driftX: number
  driftY: number
  filter: string
}

export type RaidBackgroundPlanetLayer = {
  asset: RaidOtherAssetKey
  x: number
  yOffset: number
  speed: number
  radius: number
  alpha: number
  rotation: number
  spin: number
  filter: string
  color: 'planetA' | 'planetB' | 'planetC'
}

export type RaidBackgroundScenicLayer = {
  asset: RaidOtherAssetKey
  layer?: 'far' | 'mid' | 'front'
  x: number
  yOffset: number
  speed: number
  width: number
  height: number
  alpha: number
  rotation: number
  spin: number
  driftX: number
  driftY: number
  filter: string
}

export type RaidBackgroundWreckLayer = {
  x: number
  yOffset: number
  speed: number
  width: number
  height: number
  alpha: number
  rotation: number
  spin: number
  variant: number
}

export type RaidBackgroundScene = {
  nebulaShiftX: number
  nebulaShiftY: number
  nebulaScale: number
  galaxyScale: number
  planetScale: number
  asteroidBias: number
  debrisBias: number
  galaxies: RaidBackgroundGalaxyLayer[]
  planets: RaidBackgroundPlanetLayer[]
  wrecks: RaidBackgroundWreckLayer[]
  scenic: RaidBackgroundScenicLayer[]
}

export const RAID_BOSS_BACKGROUND_THEME_SQUID = 9101

export const RAID_BOSS_BACKGROUND_THEME_SNAKE = 9102

export const RAID_BOSS_BACKGROUND_THEME_FINAL = 9103

export const RAID_BACKGROUND_SCENES: RaidBackgroundScene[] = [
  {
    nebulaShiftX: -0.08,
    nebulaShiftY: 0.05,
    nebulaScale: 1.08,
    galaxyScale: 1.14,
    planetScale: 1,
    asteroidBias: 1,
    debrisBias: 1,
    galaxies: [
      { asset: 'galaxy', x: 0.22, y: 0.64, width: 0.76, height: 0.46, alpha: 0.36, rotation: -16 * DEG, driftX: 0.014, driftY: 0.01, filter: 'brightness(0.72) contrast(1.12) saturate(1.04)' },
      { asset: 'galaxy4', x: 0.84, y: 0.2, width: 0.5, height: 0.3, alpha: 0.16, rotation: 11 * DEG, driftX: -0.01, driftY: 0.006, filter: 'brightness(0.42) contrast(1.08) saturate(0.62)' },
    ],
    planets: [
      { asset: 'planet4', x: 0.94, yOffset: 0.88, speed: 36, radius: 0.13, alpha: 0.78, rotation: 0, spin: 0.006, filter: 'brightness(0.76) contrast(1.1) saturate(0.82)', color: 'planetA' },
      { asset: 'planet2', x: 0.06, yOffset: 0.62, speed: 43, radius: 0.05, alpha: 0.68, rotation: -18 * DEG, spin: 0.002, filter: 'brightness(0.8) contrast(1.08) saturate(0.86)', color: 'planetB' },
      { asset: 'planet3', x: 0.28, yOffset: 0.38, speed: 59, radius: 0.032, alpha: 0.52, rotation: 0, spin: -0.011, filter: 'brightness(0.66) contrast(1.12) saturate(0.9)', color: 'planetC' },
    ],
    wrecks: [],
    scenic: [
      { asset: 'spaceStation', layer: 'front', x: 0.18, yOffset: 0.24, speed: 86, width: 0.17, height: 0.27, alpha: 0.44, rotation: 0, spin: 0.0004, driftX: 0.012, driftY: 0.008, filter: 'brightness(0.78) contrast(1.16) saturate(0.82)' },
    ],
  },
  {
    nebulaShiftX: 0.1,
    nebulaShiftY: -0.08,
    nebulaScale: 1.22,
    galaxyScale: 1.46,
    planetScale: 1.1,
    asteroidBias: 0.86,
    debrisBias: 0.95,
    galaxies: [
      { asset: 'galaxy3', x: 0.58, y: 0.34, width: 1.02, height: 0.56, alpha: 0.3, rotation: 7 * DEG, driftX: 0.006, driftY: 0.012, filter: 'brightness(0.64) contrast(1.12) saturate(0.88)' },
      { asset: 'galaxy', x: 0.18, y: 0.78, width: 0.44, height: 0.28, alpha: 0.14, rotation: -19 * DEG, driftX: 0.014, driftY: -0.008, filter: 'brightness(0.42) contrast(1.08) saturate(0.72)' },
    ],
    planets: [
      { asset: 'planet5', x: 0.88, yOffset: 0.56, speed: 41, radius: 0.13, alpha: 0.72, rotation: -8 * DEG, spin: 0.002, filter: 'brightness(0.72) contrast(1.12) saturate(0.92)', color: 'planetB' },
      { asset: 'planet1', x: -0.12, yOffset: 0.84, speed: 52, radius: 0.28, alpha: 0.52, rotation: 0, spin: 0.004, filter: 'brightness(0.62) contrast(1.08) saturate(0.72)', color: 'planetA' },
      { asset: 'planet3', x: 0.42, yOffset: 0.23, speed: 64, radius: 0.04, alpha: 0.42, rotation: 11 * DEG, spin: -0.007, filter: 'brightness(0.74) contrast(1.1) saturate(1)', color: 'planetC' },
    ],
    wrecks: [],
    scenic: [
      { asset: 'sun', layer: 'far', x: 0.03, yOffset: 0.1, speed: 180, width: 0.42, height: 0.42, alpha: 0.06, rotation: 0, spin: 0.0008, driftX: 0.006, driftY: 0.004, filter: 'brightness(0.9) contrast(1.14) saturate(1.08)' },
    ],
  },
  {
    nebulaShiftX: -0.16,
    nebulaShiftY: -0.03,
    nebulaScale: 1.32,
    galaxyScale: 1.06,
    planetScale: 1.18,
    asteroidBias: 1.08,
    debrisBias: 1.18,
    galaxies: [
      { asset: 'galaxy4', x: 0.72, y: 0.28, width: 0.72, height: 0.42, alpha: 0.27, rotation: 12 * DEG, driftX: -0.012, driftY: 0.008, filter: 'brightness(0.62) contrast(1.1) saturate(0.78)' },
      { asset: 'galaxy3', x: 0.24, y: 0.18, width: 0.46, height: 0.26, alpha: 0.18, rotation: -8 * DEG, driftX: 0.009, driftY: 0.014, filter: 'brightness(0.46) contrast(1.08) saturate(0.68)' },
    ],
    planets: [
      { asset: 'planetNebula', x: 1.1, yOffset: 0.72, speed: 58, radius: 0.34, alpha: 0.58, rotation: -9 * DEG, spin: -0.002, filter: 'brightness(0.62) contrast(1.12) saturate(0.86)', color: 'planetC' },
      { asset: 'planet1', x: 0.12, yOffset: 0.18, speed: 35, radius: 0.065, alpha: 0.7, rotation: 6 * DEG, spin: 0.008, filter: 'brightness(0.82) contrast(1.1) saturate(0.86)', color: 'planetA' },
      { asset: 'planet2', x: 0.64, yOffset: 0.42, speed: 69, radius: 0.036, alpha: 0.5, rotation: 18 * DEG, spin: 0.002, filter: 'brightness(0.72) contrast(1.08) saturate(0.8)', color: 'planetB' },
    ],
    wrecks: [
      { x: 0.2, yOffset: 0.18, speed: 72, width: 0.09, height: 0.04, alpha: 0.08, rotation: -13 * DEG, spin: 0.002, variant: 4 },
    ],
    scenic: [],
  },
  {
    nebulaShiftX: 0.02,
    nebulaShiftY: 0.12,
    nebulaScale: 0.96,
    galaxyScale: 0.88,
    planetScale: 0.72,
    asteroidBias: 1.22,
    debrisBias: 1.9,
    galaxies: [
      { asset: 'galaxy2', x: 0.12, y: 0.32, width: 0.5, height: 0.3, alpha: 0.19, rotation: -24 * DEG, driftX: 0.018, driftY: 0.004, filter: 'brightness(0.46) contrast(1.08) saturate(0.66)' },
      { asset: 'galaxy4', x: 0.86, y: 0.76, width: 0.48, height: 0.3, alpha: 0.13, rotation: 18 * DEG, driftX: -0.012, driftY: -0.006, filter: 'brightness(0.42) contrast(1.08) saturate(0.62)' },
    ],
    planets: [
      { asset: 'planet4', x: 0.76, yOffset: 0.46, speed: 48, radius: 0.06, alpha: 0.5, rotation: -4 * DEG, spin: 0.006, filter: 'brightness(0.56) contrast(1.08) saturate(0.62)', color: 'planetA' },
      { asset: 'planet3', x: 0.3, yOffset: 0.72, speed: 62, radius: 0.045, alpha: 0.44, rotation: 10 * DEG, spin: -0.006, filter: 'brightness(0.58) contrast(1.12) saturate(0.74)', color: 'planetC' },
    ],
    wrecks: [
      { x: 0.18, yOffset: 0.28, speed: 54, width: 0.13, height: 0.06, alpha: 0.09, rotation: -16 * DEG, spin: 0.0015, variant: 0 },
      { x: 0.74, yOffset: 0.58, speed: 68, width: 0.09, height: 0.045, alpha: 0.08, rotation: 9 * DEG, spin: -0.0018, variant: 5 },
      { x: 0.48, yOffset: 0.88, speed: 82, width: 0.11, height: 0.05, alpha: 0.07, rotation: 24 * DEG, spin: 0.0011, variant: 8 },
    ],
    scenic: [
      { asset: 'spaceStation', layer: 'front', x: 0.68, yOffset: 0.3, speed: 92, width: 0.24, height: 0.37, alpha: 0.46, rotation: 0, spin: -0.0004, driftX: -0.01, driftY: 0.006, filter: 'brightness(0.78) contrast(1.16) saturate(0.82)' },
    ],
  },
  {
    nebulaShiftX: 0.15,
    nebulaShiftY: 0.04,
    nebulaScale: 1.18,
    galaxyScale: 1.52,
    planetScale: 0.94,
    asteroidBias: 0.92,
    debrisBias: 1.1,
    galaxies: [
      { asset: 'galaxy3', x: 0.5, y: 0.42, width: 1.2, height: 0.64, alpha: 0.28, rotation: -3 * DEG, driftX: 0.004, driftY: 0.01, filter: 'brightness(0.6) contrast(1.1) saturate(0.86)' },
      { asset: 'galaxy4', x: 0.04, y: 0.16, width: 0.42, height: 0.24, alpha: 0.15, rotation: 28 * DEG, driftX: 0.01, driftY: 0.008, filter: 'brightness(0.42) contrast(1.08) saturate(0.72)' },
    ],
    planets: [
      { asset: 'planet5', x: 0.12, yOffset: 0.34, speed: 42, radius: 0.14, alpha: 0.7, rotation: 13 * DEG, spin: 0.0018, filter: 'brightness(0.72) contrast(1.12) saturate(0.92)', color: 'planetB' },
      { asset: 'planet1', x: 0.92, yOffset: 0.78, speed: 58, radius: 0.09, alpha: 0.62, rotation: -10 * DEG, spin: 0.006, filter: 'brightness(0.74) contrast(1.1) saturate(0.82)', color: 'planetA' },
      { asset: 'planet3', x: 0.58, yOffset: 0.12, speed: 71, radius: 0.034, alpha: 0.48, rotation: -18 * DEG, spin: -0.009, filter: 'brightness(0.7) contrast(1.1) saturate(0.9)', color: 'planetC' },
    ],
    wrecks: [],
    scenic: [
      { asset: 'sun', layer: 'far', x: 0.88, yOffset: 0.82, speed: 170, width: 0.46, height: 0.46, alpha: 0.055, rotation: 0, spin: 0.0007, driftX: -0.004, driftY: 0.004, filter: 'brightness(0.9) contrast(1.14) saturate(1.08)' },
    ],
  },
  {
    nebulaShiftX: -0.04,
    nebulaShiftY: -0.16,
    nebulaScale: 1.38,
    galaxyScale: 0.78,
    planetScale: 1.35,
    asteroidBias: 1,
    debrisBias: 1.25,
    galaxies: [
      { asset: 'galaxy4', x: 0.78, y: 0.18, width: 0.54, height: 0.3, alpha: 0.2, rotation: 16 * DEG, driftX: -0.012, driftY: 0.012, filter: 'brightness(0.5) contrast(1.06) saturate(0.76)' },
      { asset: 'galaxy', x: 0.34, y: 0.82, width: 0.42, height: 0.25, alpha: 0.13, rotation: -15 * DEG, driftX: 0.012, driftY: -0.006, filter: 'brightness(0.4) contrast(1.08) saturate(0.62)' },
    ],
    planets: [
      { asset: 'planetNebula', x: 0.5, yOffset: 0.62, speed: 58, radius: 0.24, alpha: 0.48, rotation: 0, spin: 0.002, filter: 'brightness(0.52) contrast(1.14) saturate(0.74)', color: 'planetA' },
      { asset: 'planet3', x: 0.18, yOffset: 0.2, speed: 64, radius: 0.07, alpha: 0.58, rotation: -18 * DEG, spin: -0.006, filter: 'brightness(0.72) contrast(1.12) saturate(0.96)', color: 'planetC' },
      { asset: 'planet4', x: 0.96, yOffset: 0.94, speed: 73, radius: 0.045, alpha: 0.48, rotation: 22 * DEG, spin: 0.004, filter: 'brightness(0.68) contrast(1.08) saturate(0.78)', color: 'planetB' },
    ],
    wrecks: [
      { x: 0.82, yOffset: 0.32, speed: 78, width: 0.09, height: 0.04, alpha: 0.07, rotation: 18 * DEG, spin: -0.0014, variant: 2 },
    ],
    scenic: [
      { asset: 'spaceStation', layer: 'front', x: 0.28, yOffset: 0.72, speed: 102, width: 0.18, height: 0.29, alpha: 0.4, rotation: 0, spin: 0.0004, driftX: 0.008, driftY: -0.008, filter: 'brightness(0.78) contrast(1.16) saturate(0.82)' },
    ],
  },
  {
    nebulaShiftX: 0.08,
    nebulaShiftY: 0.16,
    nebulaScale: 1.24,
    galaxyScale: 1.26,
    planetScale: 1.04,
    asteroidBias: 1.12,
    debrisBias: 1.36,
    galaxies: [
      { asset: 'galaxy3', x: 0.82, y: 0.58, width: 0.82, height: 0.5, alpha: 0.24, rotation: -21 * DEG, driftX: -0.012, driftY: 0.006, filter: 'brightness(0.58) contrast(1.12) saturate(0.84)' },
      { asset: 'galaxy2', x: 0.22, y: 0.28, width: 0.62, height: 0.34, alpha: 0.19, rotation: 12 * DEG, driftX: 0.014, driftY: 0.01, filter: 'brightness(0.54) contrast(1.08) saturate(0.78)' },
    ],
    planets: [
      { asset: 'planet5', x: 1.08, yOffset: 0.52, speed: 46, radius: 0.26, alpha: 0.52, rotation: -4 * DEG, spin: 0.0014, filter: 'brightness(0.58) contrast(1.12) saturate(0.66)', color: 'planetB' },
      { asset: 'planet1', x: 0.22, yOffset: 0.86, speed: 53, radius: 0.075, alpha: 0.62, rotation: 8 * DEG, spin: 0.007, filter: 'brightness(0.78) contrast(1.1) saturate(0.86)', color: 'planetA' },
      { asset: 'planetNebula', x: 0.66, yOffset: 0.16, speed: 67, radius: 0.045, alpha: 0.46, rotation: -14 * DEG, spin: -0.004, filter: 'brightness(0.66) contrast(1.1) saturate(0.88)', color: 'planetC' },
    ],
    wrecks: [
      { x: 0.1, yOffset: 0.64, speed: 74, width: 0.11, height: 0.05, alpha: 0.075, rotation: -26 * DEG, spin: 0.0012, variant: 7 },
      { x: 0.62, yOffset: 0.08, speed: 96, width: 0.08, height: 0.04, alpha: 0.065, rotation: 14 * DEG, spin: -0.0011, variant: 1 },
    ],
    scenic: [
      { asset: 'sun', layer: 'far', x: 0.12, yOffset: 0.48, speed: 190, width: 0.34, height: 0.34, alpha: 0.045, rotation: 0, spin: 0.0006, driftX: 0.004, driftY: 0.004, filter: 'brightness(0.84) contrast(1.12) saturate(1)' },
    ],
  },
]

export const RAID_BOSS_BACKGROUND_SCENE_SQUID: RaidBackgroundScene = {
  nebulaShiftX: -0.12,
  nebulaShiftY: 0.2,
  nebulaScale: 1.48,
  galaxyScale: 0.84,
  planetScale: 1.54,
  asteroidBias: 0.52,
  debrisBias: 0.74,
  galaxies: [
    { asset: 'galaxy2', x: 0.22, y: 0.18, width: 0.78, height: 0.38, alpha: 0.16, rotation: -16 * DEG, driftX: 0.01, driftY: 0.01, filter: 'brightness(0.56) contrast(1.08) saturate(1.06)' },
    { asset: 'galaxy4', x: 0.82, y: 0.46, width: 0.54, height: 0.28, alpha: 0.12, rotation: 12 * DEG, driftX: -0.01, driftY: 0.008, filter: 'brightness(0.52) contrast(1.06) saturate(0.9)' },
  ],
  planets: [
    { asset: 'planetNebula', x: 0.5, yOffset: 0.64, speed: 46, radius: 0.44, alpha: 0.72, rotation: 0, spin: -0.0018, filter: 'brightness(0.86) contrast(1.14) saturate(1.28)', color: 'planetC' },
    { asset: 'planet1', x: 0.14, yOffset: 0.22, speed: 62, radius: 0.062, alpha: 0.66, rotation: 12 * DEG, spin: 0.006, filter: 'brightness(0.84) contrast(1.08) saturate(1.18)', color: 'planetA' },
    { asset: 'planet4', x: 0.88, yOffset: 0.18, speed: 71, radius: 0.052, alpha: 0.54, rotation: -14 * DEG, spin: -0.006, filter: 'brightness(0.78) contrast(1.12) saturate(1.04)', color: 'planetB' },
  ],
  wrecks: [
    { x: 0.74, yOffset: 0.38, speed: 88, width: 0.09, height: 0.045, alpha: 0.07, rotation: 11 * DEG, spin: -0.0011, variant: 5 },
  ],
  scenic: [],
}

export const RAID_BOSS_BACKGROUND_SCENE_SNAKE: RaidBackgroundScene = {
  nebulaShiftX: 0.08,
  nebulaShiftY: -0.16,
  nebulaScale: 1.42,
  galaxyScale: 0.7,
  planetScale: 1.42,
  asteroidBias: 1.52,
  debrisBias: 1.84,
  galaxies: [
    { asset: 'galaxy3', x: 0.78, y: 0.16, width: 0.58, height: 0.28, alpha: 0.1, rotation: -14 * DEG, driftX: -0.008, driftY: 0.008, filter: 'brightness(0.48) contrast(1.08) saturate(0.74)' },
    { asset: 'galaxy2', x: 0.2, y: 0.72, width: 0.66, height: 0.36, alpha: 0.1, rotation: 9 * DEG, driftX: 0.01, driftY: -0.01, filter: 'brightness(0.44) contrast(1.06) saturate(0.7)' },
  ],
  planets: [
    { asset: 'planet5', x: 0.48, yOffset: 0.68, speed: 52, radius: 0.38, alpha: 0.7, rotation: -7 * DEG, spin: 0.0016, filter: 'brightness(0.96) contrast(1.16) saturate(1.35)', color: 'planetB' },
    { asset: 'planet3', x: 0.12, yOffset: 0.16, speed: 67, radius: 0.066, alpha: 0.62, rotation: 14 * DEG, spin: -0.006, filter: 'brightness(0.8) contrast(1.12) saturate(1.08)', color: 'planetA' },
    { asset: 'planet4', x: 0.9, yOffset: 0.22, speed: 78, radius: 0.054, alpha: 0.54, rotation: -10 * DEG, spin: 0.007, filter: 'brightness(0.84) contrast(1.12) saturate(1.1)', color: 'planetC' },
  ],
  wrecks: [
    { x: 0.28, yOffset: 0.44, speed: 74, width: 0.12, height: 0.055, alpha: 0.08, rotation: -18 * DEG, spin: 0.0014, variant: 3 },
    { x: 0.76, yOffset: 0.82, speed: 96, width: 0.08, height: 0.038, alpha: 0.07, rotation: 21 * DEG, spin: -0.0013, variant: 6 },
  ],
  scenic: [],
}

export const RAID_BOSS_BACKGROUND_SCENE_FINAL: RaidBackgroundScene = {
  nebulaShiftX: -0.04,
  nebulaShiftY: -0.04,
  nebulaScale: 1.28,
  galaxyScale: 1.28,
  planetScale: 1.16,
  asteroidBias: 1.18,
  debrisBias: 1.42,
  galaxies: [
    { asset: 'galaxy3', x: 0.48, y: 0.38, width: 1.16, height: 0.6, alpha: 0.28, rotation: -5 * DEG, driftX: 0.006, driftY: 0.01, filter: 'brightness(0.62) contrast(1.12) saturate(0.96)' },
    { asset: 'galaxy4', x: 0.88, y: 0.78, width: 0.44, height: 0.24, alpha: 0.14, rotation: 18 * DEG, driftX: -0.014, driftY: -0.008, filter: 'brightness(0.5) contrast(1.08) saturate(0.8)' },
  ],
  planets: [
    { asset: 'planetNebula', x: 1.04, yOffset: 0.62, speed: 56, radius: 0.31, alpha: 0.56, rotation: -9 * DEG, spin: -0.0018, filter: 'brightness(0.72) contrast(1.16) saturate(1.08)', color: 'planetC' },
    { asset: 'planet1', x: 0.08, yOffset: 0.2, speed: 64, radius: 0.07, alpha: 0.64, rotation: 12 * DEG, spin: 0.006, filter: 'brightness(0.86) contrast(1.1) saturate(0.9)', color: 'planetA' },
    { asset: 'planet5', x: 0.64, yOffset: 0.82, speed: 74, radius: 0.064, alpha: 0.52, rotation: -16 * DEG, spin: 0.003, filter: 'brightness(0.74) contrast(1.12) saturate(0.96)', color: 'planetB' },
  ],
  wrecks: [
    { x: 0.14, yOffset: 0.56, speed: 88, width: 0.12, height: 0.056, alpha: 0.07, rotation: -24 * DEG, spin: 0.0012, variant: 0 },
    { x: 0.82, yOffset: 0.24, speed: 74, width: 0.1, height: 0.046, alpha: 0.075, rotation: 16 * DEG, spin: -0.0012, variant: 2 },
  ],
  scenic: [],
}

export const RAID_BACKGROUND_MAX_WRECKS = RAID_BACKGROUND_SCENES.reduce((max, scene) => Math.max(max, scene.wrecks.length), 0)

export function isBossBackgroundTheme(stageTheme: number) {
  const roundedTheme = Math.floor(stageTheme)
  return roundedTheme === RAID_BOSS_BACKGROUND_THEME_SQUID || roundedTheme === RAID_BOSS_BACKGROUND_THEME_SNAKE || roundedTheme === RAID_BOSS_BACKGROUND_THEME_FINAL
}

export function getRaidPlanetDepthScale(stageTheme: number, planetIndex: number) {
  const roundedTheme = Math.floor(stageTheme)
  if (roundedTheme === RAID_BOSS_BACKGROUND_THEME_SQUID) return [1.18, 0.9, 0.84][planetIndex] ?? 1
  if (roundedTheme === RAID_BOSS_BACKGROUND_THEME_SNAKE) return [1.3, 1, 0.78][planetIndex] ?? 1
  if (roundedTheme === RAID_BOSS_BACKGROUND_THEME_FINAL) return [1.14, 0.92, 0.86][planetIndex] ?? 1
  const stageIndex = (((Math.floor(stageTheme) - 1) % RAID_PLANET_DEPTH_SCALES.length) + RAID_PLANET_DEPTH_SCALES.length) % RAID_PLANET_DEPTH_SCALES.length
  return RAID_PLANET_DEPTH_SCALES[stageIndex][planetIndex] ?? 1
}

export function getRaidBackgroundScene(stageTheme: number) {
  const roundedTheme = Math.floor(stageTheme)
  if (roundedTheme === RAID_BOSS_BACKGROUND_THEME_SQUID) return RAID_BOSS_BACKGROUND_SCENE_SQUID
  if (roundedTheme === RAID_BOSS_BACKGROUND_THEME_SNAKE) return RAID_BOSS_BACKGROUND_SCENE_SNAKE
  if (roundedTheme === RAID_BOSS_BACKGROUND_THEME_FINAL) return RAID_BOSS_BACKGROUND_SCENE_FINAL
  const index = (((Math.floor(stageTheme) - 1) % RAID_BACKGROUND_SCENES.length) + RAID_BACKGROUND_SCENES.length) % RAID_BACKGROUND_SCENES.length
  return RAID_BACKGROUND_SCENES[index]
}

export function shouldDrawRaidSurfaceStage(stageTheme: number) {
  const roundedTheme = Math.floor(stageTheme)
  if (roundedTheme === RAID_BOSS_BACKGROUND_THEME_SQUID || roundedTheme === RAID_BOSS_BACKGROUND_THEME_SNAKE) return true
  if (roundedTheme === RAID_BOSS_BACKGROUND_THEME_FINAL) return false
  return stageTheme % 2 === 0
}

export function isWateryWorldTheme(stageTheme: number) {
  return Math.floor(stageTheme) === RAID_BOSS_BACKGROUND_THEME_SQUID
}

export function isVolcanicWorldTheme(stageTheme: number) {
  return Math.floor(stageTheme) === RAID_BOSS_BACKGROUND_THEME_SNAKE
}

export function shouldDrawRaidStars(stageTheme: number) {
  return !isWateryWorldTheme(stageTheme) && !isVolcanicWorldTheme(stageTheme)
}

export function shouldDrawRaidGalaxies(stageTheme: number) {
  return !isWateryWorldTheme(stageTheme) && !isVolcanicWorldTheme(stageTheme)
}

export function shouldDrawRaidStarTrails(stageTheme: number) {
  const roundedTheme = Math.floor(stageTheme)
  return roundedTheme !== RAID_BOSS_BACKGROUND_THEME_SQUID && roundedTheme !== RAID_BOSS_BACKGROUND_THEME_SNAKE
}

export function shouldDrawRaidBattleOverlay(stageTheme: number) {
  const roundedTheme = Math.floor(stageTheme)
  return roundedTheme !== RAID_BOSS_BACKGROUND_THEME_SQUID && roundedTheme !== RAID_BOSS_BACKGROUND_THEME_SNAKE
}

function shouldDrawRaidSpeedLines(stageTheme: number) {
  return shouldDrawRaidBattleOverlay(stageTheme) || isWateryWorldTheme(stageTheme) || isVolcanicWorldTheme(stageTheme)
}

function getRaidSpeedLineColor(line: typeof BACKGROUND_SPEED_LINES[number], streak: string, stageTheme: number) {
  if (isWateryWorldTheme(stageTheme)) {
    if (line.color === 'red') return 'rgba(170,90,255,0.28)'
    if (line.color === 'cyan') return 'rgba(132,230,255,0.32)'
    return 'rgba(190,210,255,0.34)'
  }
  if (isVolcanicWorldTheme(stageTheme)) {
    if (line.color === 'red') return 'rgba(255,96,38,0.42)'
    if (line.color === 'cyan') return 'rgba(255,190,95,0.28)'
    return 'rgba(255,150,72,0.34)'
  }
  if (line.color === 'streak') return streak
  if (line.color === 'red') return 'rgba(239,35,60,0.42)'
  if (line.color === 'cyan') return 'rgba(125,211,252,0.28)'
  return 'rgba(255,255,255,0.26)'
}

export function getRaidStarfieldSpeedScale(stageTheme: number) {
  const roundedTheme = Math.floor(stageTheme)
  if (roundedTheme === RAID_BOSS_BACKGROUND_THEME_SQUID) return 0.36
  if (roundedTheme === RAID_BOSS_BACKGROUND_THEME_SNAKE) return 0.62
  if (roundedTheme === RAID_BOSS_BACKGROUND_THEME_FINAL) return 1.18
  return 1
}

export function getRaidBackgroundObjectDensity(stageTheme: number) {
  const roundedTheme = Math.floor(stageTheme)
  if (roundedTheme === RAID_BOSS_BACKGROUND_THEME_SQUID) return 0.28
  if (roundedTheme === RAID_BOSS_BACKGROUND_THEME_SNAKE) return 0.9
  if (roundedTheme === RAID_BOSS_BACKGROUND_THEME_FINAL) return 1.22
  return 1
}

export function getRaidScenePlanetY(layer: RaidBackgroundPlanetLayer, height: number, seconds: number, diameter = 0) {
  const padding = Math.max(height * 0.16, diameter * 0.65)
  const travel = height + padding * 2
  return ((seconds / layer.speed + layer.yOffset) % 1) * travel - padding
}

export function getRaidSceneScrollableY(seconds: number, height: number, speed: number, yOffset: number, objectHeight: number) {
  const padding = Math.max(1, objectHeight)
  return ((seconds / speed + yOffset) % 1) * (height + padding * 2) - padding
}

export function getRaidScenePlanetRadius(baseSize: number, scene: RaidBackgroundScene, layer: RaidBackgroundPlanetLayer, stageTheme: number, index: number) {
  return Math.max(14, baseSize * layer.radius * scene.planetScale * getRaidPlanetDepthScale(stageTheme, index))
}

export function getRaidScenePlanetDrawScale(asset: RaidOtherAssetKey) {
  if (asset === 'planet2') return 2.8
  if (asset === 'planet1') return 2.45
  return 2.25
}

export function getRaidScenePlanetAlpha(layer: RaidBackgroundPlanetLayer) {
  const floor = layer.asset === 'planetNebula' ? 0.82 : 0.88
  return clamp(Math.max(layer.alpha, floor), 0, 0.96)
}

export function getRaidSceneObjectSize(width: number, height: number, layer: RaidBackgroundScenicLayer | RaidBackgroundWreckLayer) {
  return {
    width: Math.max(42, width * layer.width),
    height: Math.max(42, height * layer.height),
  }
}

export function getRaidSceneScenicPosition(width: number, height: number, seconds: number, layer: RaidBackgroundScenicLayer, index: number) {
  const size = getRaidSceneObjectSize(width, height, layer)
  const x = width * layer.x + Math.sin(seconds / 31 + index * 1.7) * width * layer.driftX
  const y = getRaidSceneScrollableY(seconds, height, layer.speed, layer.yOffset, size.height * 0.62 + height * 0.05) +
    Math.cos(seconds / 37 + index * 1.3) * height * layer.driftY
  return { ...size, x, y }
}

export function getRaidSceneWreckPosition(width: number, height: number, seconds: number, layer: RaidBackgroundWreckLayer) {
  const size = getRaidSceneObjectSize(width, height, layer)
  return {
    ...size,
    x: width * layer.x,
    y: getRaidSceneScrollableY(seconds, height, layer.speed, layer.yOffset, size.height * 0.62 + height * 0.05),
  }
}

export function getRaidScenePlanetFallbackColor(palette: RaidPalette, layer: RaidBackgroundPlanetLayer) {
  if (layer.color === 'planetB') return palette.planetB
  if (layer.color === 'planetC') return palette.planetC
  return palette.planetA
}

export function shouldDrawRaidStarTrail(star: typeof BACKGROUND_STARS[number], index: number, quality: GraphicsQuality) {
  if (quality === 'low' || quality === 'medium') return false
  if (quality === 'high') return star.tint > 0.82 && index % 4 === 0
  return star.tint > 0.74 && index % 3 === 0
}

function getWaterySurfaceLayerY(seconds: number, height: number, speed: number, ySeed: number, layerHeight: number) {
  const span = getWaterySurfaceLayerSpan(height, layerHeight)
  return ((seconds * speed + ySeed) % 1) * span - getWaterySurfaceLayerPadding(height, layerHeight)
}

function getWaterySurfaceLayerPadding(height: number, layerHeight: number) {
  const padding = Math.max(height * 0.18, layerHeight * 0.72)
  return padding
}

function getWaterySurfaceLayerSpan(height: number, layerHeight: number) {
  const padding = getWaterySurfaceLayerPadding(height, layerHeight)
  return height + padding * 2
}

function getWorldSurfaceCopyY(baseY: number, height: number, layerHeight: number, tileIndex: number) {
  return baseY + WORLD_SURFACE_TILE_OFFSETS[tileIndex] * getWaterySurfaceLayerSpan(height, layerHeight)
}

function isWorldSurfaceCopyVisible(y: number, height: number, layerHeight: number) {
  return y > -layerHeight && y < height + layerHeight
}

function getWorldSurfaceSpriteIndex(layerIndex: number, tileIndex: number) {
  return layerIndex * WORLD_SURFACE_TILE_OFFSETS.length + tileIndex
}

function createWorldSurfaceSprites(layerCount: number) {
  return Array.from({ length: layerCount * WORLD_SURFACE_TILE_OFFSETS.length }, () => new Sprite(Texture.WHITE))
}

export function drawWateryWorldForegroundClouds(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, quality: GraphicsQuality) {
  if (quality === 'low') return
  const seconds = time / 1000
  const cloudCount = quality === 'medium' ? 2 : 3
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  for (let index = 0; index < cloudCount; index += 1) {
    const layer = WATERY_WORLD_CLOUD_LAYERS[index + 1]
    const drawWidth = width * (index === 0 ? 0.98 : index === 1 ? 0.82 : 0.66)
    const drawHeight = height * (index === 0 ? 0.36 : index === 1 ? 0.3 : 0.24)
    const x = width * (index === 0 ? 0.58 : index === 1 ? 0.28 : 0.82) + Math.sin(seconds * (0.12 + index * 0.07) + index * 2.4) * width * 0.045
    const baseY = getWaterySurfaceLayerY(seconds, height, index === 0 ? 0.031 : index === 1 ? 0.021 : 0.015, index === 0 ? 0.72 : index === 1 ? 0.18 : 0.44, drawHeight)
    for (let tileIndex = 0; tileIndex < WORLD_SURFACE_TILE_OFFSETS.length; tileIndex += 1) {
      const y = getWorldSurfaceCopyY(baseY, height, drawHeight, tileIndex)
      if (!isWorldSurfaceCopyVisible(y, height, drawHeight)) continue
      drawCanvasImageContain(
        ctx,
        getRaidOtherCanvasSprite(layer.asset),
        x,
        y,
        drawWidth,
        drawHeight,
        'brightness(1.04) contrast(1.08) saturate(1.08)',
        index === 0 ? 0.24 : index === 1 ? 0.18 : 0.12,
        layer.rotation * 0.55 + Math.sin(seconds * 0.07 + index) * 1.2 * DEG,
      )
    }
  }
  ctx.restore()
}

export function drawVolcanicWorldForegroundClouds(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, quality: GraphicsQuality) {
  if (quality === 'low') return
  const seconds = time / 1000
  const cloudCount = quality === 'medium' ? 2 : 3
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  for (let index = 0; index < cloudCount; index += 1) {
    const layer = VOLCANIC_WORLD_CLOUD_LAYERS[index + 1]
    const drawWidth = width * (index === 0 ? 0.96 : index === 1 ? 0.8 : 0.64)
    const drawHeight = height * (index === 0 ? 0.34 : index === 1 ? 0.28 : 0.23)
    const x = width * (index === 0 ? 0.6 : index === 1 ? 0.28 : 0.82) + Math.sin(seconds * (0.11 + index * 0.065) + index * 2.1) * width * 0.04
    const baseY = getWaterySurfaceLayerY(seconds, height, index === 0 ? 0.03 : index === 1 ? 0.02 : 0.014, index === 0 ? 0.7 : index === 1 ? 0.16 : 0.42, drawHeight)
    for (let tileIndex = 0; tileIndex < WORLD_SURFACE_TILE_OFFSETS.length; tileIndex += 1) {
      const y = getWorldSurfaceCopyY(baseY, height, drawHeight, tileIndex)
      if (!isWorldSurfaceCopyVisible(y, height, drawHeight)) continue
      drawCanvasImageContain(
        ctx,
        getRaidOtherCanvasSprite(layer.asset),
        x,
        y,
        drawWidth,
        drawHeight,
        'brightness(1.02) contrast(1.08) saturate(1.1)',
        index === 0 ? 0.22 : index === 1 ? 0.16 : 0.1,
        layer.rotation * 0.55 + Math.sin(seconds * 0.065 + index) * 1.1 * DEG,
      )
    }
  }
  ctx.restore()
}

export function getRaidBackgroundBaseCacheKey(palette: RaidPalette, width: number, height: number, quality: GraphicsQuality, dpr: number) {
  return [
    Math.round(width),
    Math.round(height),
    dpr.toFixed(2),
    quality,
    palette.baseTop,
    palette.baseMid,
    palette.baseBottom,
    palette.bgA,
    palette.bgB,
  ].join('|')
}

export function getRaidStarfieldCacheKey(width: number, height: number, quality: GraphicsQuality, dpr: number, starTint: string, streak: string) {
  return [
    Math.round(width),
    Math.round(height),
    dpr.toFixed(2),
    quality,
    starTint,
    streak,
  ].join('|')
}

export type PixiRaidAssetKey = RaidOtherAssetKey

export type PixiRaidBackgroundFrame = {
  palette: RaidPalette
  width: number
  height: number
  time: number
  quality: GraphicsQuality
  stageTheme: number
  dpr: number
  stageRush: number
  bossIntensity: number
  devilCorruption: number
  finalBattleIntensity?: number
}

export function setPixiSpriteContain(sprite: Sprite, texture: Texture, x: number, y: number, width: number, height: number, alpha: number, rotation = 0) {
  const textureWidth = Math.max(1, texture.width)
  const textureHeight = Math.max(1, texture.height)
  const scale = Math.min(width / textureWidth, height / textureHeight)
  sprite.texture = texture
  sprite.anchor.set(0.5)
  sprite.position.set(x, y)
  sprite.scale.set(scale)
  sprite.alpha = alpha
  sprite.rotation = rotation
  sprite.visible = alpha > 0
}

export function parsePixiCssColor(color: string) {
  const trimmed = color.trim()
  const rgba = trimmed.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i)
  if (rgba) {
    const r = clamp(Number(rgba[1]) || 0, 0, 255)
    const g = clamp(Number(rgba[2]) || 0, 0, 255)
    const b = clamp(Number(rgba[3]) || 0, 0, 255)
    const a = clamp(rgba[4] === undefined ? 1 : Number(rgba[4]) || 0, 0, 1)
    return { color: (r << 16) | (g << 8) | b, alpha: a, source: [r / 255, g / 255, b / 255, a] }
  }
  const hex = trimmed.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex) {
    const raw = hex[1].length === 3 ? hex[1].split('').map((char) => char + char).join('') : hex[1]
    const value = Number.parseInt(raw, 16)
    return { color: value, alpha: 1, source: [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255, 1] }
  }
  return { color: 0xffffff, alpha: 1, source: [1, 1, 1, 1] }
}

export function getPixiFill(color: string, alpha = 1) {
  const parsed = parsePixiCssColor(color)
  return { color: parsed.color, alpha: parsed.alpha * alpha }
}

export function getRaidCameraShakeOffset(shake: CameraShakeState, time: number, viewportWidth: number, viewportHeight: number) {
  if (shake.duration <= 0 || time >= shake.until) return { x: 0, y: 0 }
  const remaining = clamp((shake.until - time) / shake.duration, 0, 1)
  const viewportBoost = clamp(Math.min(viewportWidth, viewportHeight) / 520, 1, 1.85)
  const amplitude = shake.strength * viewportBoost * remaining * remaining
  return {
    x: Math.sin(time * 0.047 + shake.seed) * amplitude + Math.sin(time * 0.093 + shake.seed * 1.7) * amplitude * 0.32,
    y: Math.cos(time * 0.055 + shake.seed * 0.8) * amplitude * 0.72,
  }
}

export class PixiRaidBackground {
  private app: Application | null = null
  private readonly scene = new Container()
  private readonly baseGraphics = new Graphics()
  private readonly nebulaGraphics = new Graphics()
  private readonly bossTintGraphics = new Graphics()
  private readonly ambientGlowGraphics = new Graphics()
  private readonly galaxySprites = [new Sprite(Texture.WHITE), new Sprite(Texture.WHITE)]
  private readonly planetSprites = [new Sprite(Texture.WHITE), new Sprite(Texture.WHITE), new Sprite(Texture.WHITE)]
  private readonly wreckSprites = Array.from({ length: RAID_BACKGROUND_MAX_WRECKS }, () => new Sprite(Texture.WHITE))
  private readonly scenicSprites = [new Sprite(Texture.WHITE), new Sprite(Texture.WHITE)]
  private readonly farStarLayers = [new Graphics(), new Graphics(), new Graphics()]
  private readonly nearStarLayers = [new Graphics(), new Graphics(), new Graphics()]
  private readonly speedLineGraphics = new Graphics()
  private readonly surfaceGraphics = new Graphics()
  private readonly wateryIslandSprites = createWorldSurfaceSprites(WATERY_WORLD_ISLAND_LAYERS.length)
  private readonly wateryCloudSprites = createWorldSurfaceSprites(WATERY_WORLD_CLOUD_LAYERS.length)
  private readonly volcanicIslandSprites = createWorldSurfaceSprites(VOLCANIC_WORLD_ISLAND_LAYERS.length)
  private readonly volcanicCloudSprites = createWorldSurfaceSprites(VOLCANIC_WORLD_CLOUD_LAYERS.length)
  private readonly cometFlybySprite = new Sprite(Texture.WHITE)
  private readonly asteroidSprites = BACKGROUND_ASTEROIDS.map(() => new Sprite(Texture.WHITE))
  private readonly debrisSprites = BACKGROUND_DEBRIS.map(() => new Sprite(Texture.WHITE))
  private readonly finalBattleBackdropGraphics = new Graphics()
  private readonly finalBattleSprites = FINAL_BATTLE_FIGHTERS.map(() => new Sprite(Texture.WHITE))
  private readonly finalBattleGraphics = new Graphics()
  private readonly finalBattleCruiserSprites = FINAL_BATTLE_CRUISERS.map(() => new Sprite(Texture.WHITE))
  private readonly explosionGraphics = new Graphics()
  private readonly assetTextures = new Map<PixiRaidAssetKey, Texture>()
  private readonly finalBattleTextures = new Map<string, Texture>()
  private readonly gradientCache = new Map<string, FillGradient>()
  private baseKey = ''
  private starfieldKey = ''
  private ambientGlowKey = ''
  private width = 0
  private height = 0
  private dpr = 1

  async init(host: HTMLDivElement) {
    try {
      const app = new Application()
      await app.init({
        width: 1,
        height: 1,
        resolution: 1,
        backgroundAlpha: 0,
        autoDensity: true,
        autoStart: false,
        antialias: false,
        preference: 'webgl',
      })
      this.app = app
      app.stage.addChild(this.scene)
      this.scene.addChild(this.baseGraphics)
      this.scene.addChild(this.nebulaGraphics)
      this.scene.addChild(this.bossTintGraphics)
      this.scene.addChild(this.ambientGlowGraphics)
      this.galaxySprites.forEach((sprite) => this.scene.addChild(sprite))
      this.farStarLayers.forEach((layer) => this.scene.addChild(layer))
      this.nearStarLayers.forEach((layer) => this.scene.addChild(layer))
      this.scene.addChild(this.surfaceGraphics)
      this.scene.addChild(this.speedLineGraphics)
      this.wateryIslandSprites.forEach((sprite) => this.scene.addChild(sprite))
      this.wateryCloudSprites.forEach((sprite) => this.scene.addChild(sprite))
      this.volcanicIslandSprites.forEach((sprite) => this.scene.addChild(sprite))
      this.volcanicCloudSprites.forEach((sprite) => this.scene.addChild(sprite))
      this.planetSprites.forEach((sprite) => this.scene.addChild(sprite))
      this.wreckSprites.forEach((sprite) => this.scene.addChild(sprite))
      this.scenicSprites.forEach((sprite) => this.scene.addChild(sprite))
      this.scene.addChild(this.finalBattleBackdropGraphics)
      this.finalBattleSprites.forEach((sprite) => this.scene.addChild(sprite))
      this.scene.addChild(this.finalBattleGraphics)
      this.finalBattleCruiserSprites.forEach((sprite) => this.scene.addChild(sprite))
      this.scene.addChild(this.cometFlybySprite)
      this.asteroidSprites.forEach((sprite) => this.scene.addChild(sprite))
      this.debrisSprites.forEach((sprite) => this.scene.addChild(sprite))
      this.scene.addChild(this.explosionGraphics)

      const canvas = app.canvas as HTMLCanvasElement
      canvas.className = 'raid__pixi-background-canvas'
      host.textContent = ''
      host.appendChild(canvas)
      await this.loadAssets()
      return true
    } catch {
      this.destroy()
      return false
    }
  }

  destroy() {
    this.gradientCache.forEach((gradient) => gradient.destroy())
    this.gradientCache.clear()
    this.app?.destroy({ removeView: true }, { children: true })
    this.app = null
  }

  render(frame: PixiRaidBackgroundFrame) {
    const app = this.app
    if (!app) return false

    try {
      const { width, height, dpr, palette, quality, stageTheme, time, stageRush, bossIntensity, devilCorruption, finalBattleIntensity = 0 } = frame
      const seconds = time / 1000
      const isLow = quality === 'low'
      const isMedium = quality === 'medium'

      if (this.width !== width || this.height !== height || this.dpr !== dpr) {
        this.width = width
        this.height = height
        this.dpr = dpr
        app.renderer.resize(width, height, dpr)
        const canvas = app.canvas as HTMLCanvasElement
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
        this.baseKey = ''
        this.starfieldKey = ''
      }

      this.updateBaseGraphics(palette, width, height, quality, dpr)
      this.updateNebula(width, height, seconds, palette, stageTheme, isLow)
      this.updateBossTint(width, height, seconds, palette, bossIntensity, devilCorruption, isLow)
      this.updateAmbientGlows(width, height, isLow, isMedium, palette, stageTheme)
      this.updateGalaxies(width, height, seconds, stageTheme, isLow, isMedium)
      this.updateStarfield(width, height, seconds, quality, dpr, palette.starTint, palette.streak, stageRush, stageTheme)
      this.updateSpeedLines(width, height, seconds, palette.streak, isLow, isMedium, stageTheme)
      this.updateSurface(width, height, seconds, palette, quality, stageTheme)
      this.updatePlanets(width, height, seconds, palette, stageTheme, isLow, isMedium)
      this.updateWrecks(width, height, seconds, stageTheme, isLow, isMedium)
      this.updateScenic(width, height, seconds, stageTheme, isLow, isMedium)
      this.updateFinalBattleBackdrop(width, height, seconds, stageTheme, quality, finalBattleIntensity)
      this.updateFinalBattleLayer(width, height, seconds, stageTheme, quality, finalBattleIntensity)
      this.updateRareCometFlyby(width, height, seconds, isLow, isMedium, stageTheme)
      this.updateBackgroundObjects(width, height, seconds, stageTheme, isLow, isMedium)
      this.updateAmbientExplosions(width, height, seconds, isLow, isMedium, stageTheme)
      app.render()
      return true
    } catch {
      return false
    }
  }

  private async loadAssets() {
    const entries = Object.entries(RAID_OTHER_ASSET_PATHS) as Array<[PixiRaidAssetKey, string]>
    await Promise.all(entries.map(async ([key, path]) => {
      try {
        const sprite = getRaidOtherCanvasSprite(key)
        await sprite.ready
        if (sprite.loaded) {
          const source = sprite.processedImage ?? sprite.image
          const texture = Texture.from(source)
          this.assetTextures.set(key, texture)
          return
        }
        const texture = await Assets.load(getPublicAssetUrl(path))
        this.assetTextures.set(key, texture as Texture)
      } catch {
        this.assetTextures.delete(key)
      }
    }))
    await Promise.all(FINAL_BATTLE_FIGHTERS.map(async (fighter) => {
      const key = getFinalBattleTextureKey(fighter)
      if (this.finalBattleTextures.has(key)) return
      try {
        const texture = await Assets.load(getFinalBattleTextureUrl(fighter))
        this.finalBattleTextures.set(key, texture as Texture)
      } catch {
        this.finalBattleTextures.delete(key)
      }
    }))
    await Promise.all(FINAL_BATTLE_CRUISERS.map(async (cruiser) => {
      const key = getFinalBattleCruiserTextureKey(cruiser)
      if (this.finalBattleTextures.has(key)) return
      try {
        const texture = await Assets.load(getRaidShipSpriteUrl(cruiser.asset))
        this.finalBattleTextures.set(key, texture as Texture)
      } catch {
        this.finalBattleTextures.delete(key)
      }
    }))
  }

  private getGradient(key: string, options: object) {
    let gradient = this.gradientCache.get(key)
    if (!gradient) {
      gradient = new FillGradient(options as never)
      this.gradientCache.set(key, gradient)
    }
    return gradient
  }

  private fillRadial(graphics: Graphics, x: number, y: number, radiusX: number, radiusY: number, startColor: string, endColor: string, alpha = 1) {
    const gradient = this.getGradient(`radial|${startColor}|${endColor}`, {
      type: 'radial',
      center: { x: 0.5, y: 0.5 },
      outerCenter: { x: 0.5, y: 0.5 },
      innerRadius: 0,
      outerRadius: 0.5,
      colorStops: [
        { offset: 0, color: parsePixiCssColor(startColor).source },
        { offset: 1, color: parsePixiCssColor(endColor).source },
      ],
    })
    graphics.ellipse(x, y, radiusX, radiusY).fill({ fill: gradient, alpha })
  }

  private updateBaseGraphics(palette: RaidPalette, width: number, height: number, quality: GraphicsQuality, dpr: number) {
    const key = `${getRaidBackgroundBaseCacheKey(palette, width, height, quality, dpr)}|pixi-native`
    if (this.baseKey === key) return
    this.baseKey = key

    const base = this.baseGraphics
    base.clear()
    const gradient = this.getGradient(`base|${palette.baseTop}|${palette.baseMid}|${palette.baseBottom}`, {
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: parsePixiCssColor(palette.baseTop).source },
        { offset: 0.45, color: parsePixiCssColor(palette.baseMid).source },
        { offset: 1, color: parsePixiCssColor(palette.baseBottom).source },
      ],
    })
    base.rect(0, 0, width, height).fill(gradient)

    if (quality !== 'low') {
      this.fillRadial(base, width * 0.18, height * 0.16, width * 0.24, height * 0.24, palette.bgA, 'rgba(0,0,0,0)')
      this.fillRadial(base, width * 0.76, height * 0.38, width * 0.26, height * 0.26, palette.bgB, 'rgba(0,0,0,0)')
    }
  }

  private updateNebula(width: number, height: number, seconds: number, palette: RaidPalette, stageTheme: number, isLow: boolean) {
    const graphics = this.nebulaGraphics
    graphics.clear()
    const suppress = isWateryWorldTheme(stageTheme) || isVolcanicWorldTheme(stageTheme)
    graphics.visible = !isLow && !suppress
    if (isLow || suppress) return

    const scene = getRaidBackgroundScene(stageTheme)
    const drift = Math.sin(seconds / 10)
    const scaleX = scene.nebulaScale * (1 + 0.035 * (0.5 + Math.sin(seconds / 7) * 0.5))
    const scaleY = scene.nebulaScale * (1 + 0.025 * (0.5 + Math.cos(seconds / 9) * 0.5))
    this.fillRadial(
      graphics,
      width * (0.2 + scene.nebulaShiftX * 0.42) + width * 0.012 * drift,
      height * (0.72 + scene.nebulaShiftY * 0.38) + height * 0.006 * Math.cos(seconds / 8),
      width * 0.36 * scaleX,
      height * 0.24 * scaleY,
      palette.nebulaA,
      'rgba(0,0,0,0)',
    )
    this.fillRadial(
      graphics,
      width * (0.82 - scene.nebulaShiftX * 0.28) + width * 0.012 * drift,
      height * (0.24 - scene.nebulaShiftY * 0.24) + height * 0.006 * Math.cos(seconds / 8),
      width * 0.32 * scaleX,
      height * 0.22 * scaleY,
      palette.nebulaB,
      'rgba(0,0,0,0)',
    )
  }

  private updateBossTint(width: number, height: number, seconds: number, palette: RaidPalette, bossIntensity: number, devilCorruption: number, isLow: boolean) {
    const graphics = this.bossTintGraphics
    graphics.clear()
    const intensity = clamp(Math.max(bossIntensity * 0.5, devilCorruption), 0, 1)
    graphics.visible = !isLow && intensity > 0.01
    if (!graphics.visible) return

    const pulse = 0.78 + Math.sin(seconds * 2.2) * 0.22
    const color = devilCorruption > 0 ? 'rgba(239,35,60,0.18)' : palette.nebulaB
    this.fillRadial(graphics, width * 0.5, height * 0.18, width * 0.64, height * 0.28, color, 'rgba(0,0,0,0)', intensity * (0.32 + pulse * 0.08))
    const stroke = getPixiFill(devilCorruption > 0 ? 'rgba(248,113,113,0.36)' : 'rgba(251,113,133,0.28)', intensity * 0.11)
    graphics.rect(0, 0, width, height).stroke({
      color: stroke.color,
      alpha: stroke.alpha,
      width: Math.max(1, Math.min(4, width * 0.0016)),
    })
  }

  private updateAmbientGlows(width: number, height: number, isLow: boolean, isMedium: boolean, palette: RaidPalette, stageTheme: number) {
    const suppress = isWateryWorldTheme(stageTheme) || isVolcanicWorldTheme(stageTheme)
    const key = `${width}x${height}|${isLow}|${isMedium}|${palette.bgA}|${suppress ? 1 : 0}`
    if (this.ambientGlowKey === key) return
    this.ambientGlowKey = key
    const graphics = this.ambientGlowGraphics
    graphics.clear()
    graphics.alpha = 1
    graphics.visible = !isLow && !suppress
    if (isLow || suppress) return
    this.fillRadial(graphics, width * 0.78, height * 0.18, width * 0.48, height * 0.25, 'rgba(139,92,246,0.2)', 'rgba(0,0,0,0)')
    this.fillRadial(graphics, width * 0.14, height * 0.68, width * 0.36, height * 0.42, 'rgba(59,130,246,0.16)', 'rgba(0,0,0,0)')
    if (!isMedium) {
      this.fillRadial(graphics, width * 0.48, height * 0.42, width * 0.22, height * 0.18, 'rgba(236,72,153,0.11)', 'rgba(0,0,0,0)')
      this.fillRadial(graphics, width * 0.22, height * 0.22, width * 0.26, height * 0.15, 'rgba(251,191,36,0.05)', 'rgba(0,0,0,0)')
      this.fillRadial(graphics, width * 0.88, height * 0.72, width * 0.18, height * 0.32, 'rgba(34,211,238,0.06)', 'rgba(0,0,0,0)')
    }
    if (palette.bgA === 'transparent') graphics.alpha = 0.98
  }

  private updateGalaxies(width: number, height: number, seconds: number, stageTheme: number, isLow: boolean, isMedium: boolean) {
    const scene = getRaidBackgroundScene(stageTheme)
    const drift = Math.sin(seconds / 18)
    const visibleCount = isLow || !shouldDrawRaidGalaxies(stageTheme) ? 0 : isMedium ? 1 : scene.galaxies.length
    for (let index = 0; index < this.galaxySprites.length; index += 1) {
      const sprite = this.galaxySprites[index]
      const galaxy = scene.galaxies[index]
      const texture = galaxy ? this.assetTextures.get(galaxy.asset) : undefined
      sprite.visible = Boolean(texture && index < visibleCount)
      if (!texture || !galaxy || index >= visibleCount) continue
      setPixiSpriteContain(
        sprite,
        texture,
        width * galaxy.x + drift * width * galaxy.driftX,
        height * galaxy.y + Math.cos(seconds / 22) * height * galaxy.driftY,
        width * galaxy.width * scene.galaxyScale * (isMedium ? 0.82 : 1),
        height * galaxy.height * scene.galaxyScale * (isMedium ? 0.82 : 1),
        galaxy.alpha * (isMedium ? 0.78 : 1),
        galaxy.rotation,
      )
    }
  }

  private updateStarfield(width: number, height: number, seconds: number, quality: GraphicsQuality, dpr: number, starTint: string, streak: string, stageRush: number, stageTheme: number) {
    if (!shouldDrawRaidStars(stageTheme)) {
      this.updateScrollingGraphics(this.farStarLayers, Math.max(1, height), 0, false)
      this.updateScrollingGraphics(this.nearStarLayers, Math.max(1, height), 0, false)
      return
    }
    const key = getRaidStarfieldCacheKey(width, height, quality, dpr, starTint, streak)
    const isLow = quality === 'low'
    const isMedium = quality === 'medium'
    const isHigh = quality === 'high'
    const starLimit = isLow ? 40 : isMedium ? 100 : isHigh ? 160 : BACKGROUND_STARS.length
    const farLayerHeight = height * 1.26
    const nearLayerHeight = height * 1.38

    if (this.starfieldKey !== key) {
      this.starfieldKey = key
      for (const layer of this.farStarLayers) {
        layer.clear()
        for (let index = 0; index < starLimit; index += 1) {
          const star = BACKGROUND_STARS[index]
          layer.circle(star.x * width, star.y * farLayerHeight, star.size * 0.62).fill(getPixiFill(
            star.tint > 0.66 ? starTint : star.tint > 0.33 ? 'rgba(125,211,252,0.55)' : 'rgba(255,255,255,0.76)',
            star.alpha * 0.52,
          ))
        }
      }
      for (const layer of this.nearStarLayers) {
        layer.clear()
        if (!isLow && !isMedium) {
          for (let index = 0; index < starLimit; index += 1) {
            const star = BACKGROUND_STARS[index]
            if (!shouldDrawRaidStarTrail(star, index, quality)) continue
            const x = star.x * width
            const y = star.y * nearLayerHeight
            layer.moveTo(x, y - 14)
            layer.lineTo(x, y + 22)
            const trailFill = getPixiFill(star.tint > 0.78 ? streak : 'rgba(255,255,255,0.36)', star.alpha * 0.26)
            layer.stroke({
              color: trailFill.color,
              alpha: trailFill.alpha,
              width: Math.max(1, star.size * 0.65),
              cap: 'round',
            })
          }
        }
      }
    }

    const rush = clamp(stageRush, 0, 1)
    const starSpeedScale = getRaidStarfieldSpeedScale(stageTheme)
    this.updateScrollingGraphics(this.farStarLayers, farLayerHeight, seconds * ((15 + rush * 42) * starSpeedScale) - height * 0.13, true)
    this.updateScrollingGraphics(this.nearStarLayers, nearLayerHeight, seconds * ((72 + rush * 170) * starSpeedScale) - height * 0.19, !isLow && !isMedium && shouldDrawRaidStarTrails(stageTheme))
  }

  private updateScrollingGraphics(layers: Graphics[], layerHeight: number, offset: number, visible: boolean) {
    if (layerHeight <= 0) return
    const y = ((offset % layerHeight) + layerHeight) % layerHeight
    for (let index = 0; index < layers.length; index += 1) {
      const layer = layers[index]
      layer.position.set(0, y + (index - 1) * layerHeight)
      layer.alpha = visible ? 1 : 0
      layer.visible = visible
    }
  }

  private updateSpeedLines(width: number, height: number, seconds: number, streak: string, isLow: boolean, isMedium: boolean, stageTheme: number) {
    const graphics = this.speedLineGraphics
    graphics.clear()
    const allowSpeedLines = shouldDrawRaidSpeedLines(stageTheme)
    graphics.visible = !isLow && allowSpeedLines
    if (isLow || !allowSpeedLines) return

    const speedLineLimit = isMedium ? 2 : BACKGROUND_SPEED_LINES.length
    for (let index = 0; index < speedLineLimit; index += 1) {
      const line = BACKGROUND_SPEED_LINES[index]
      const y = (((seconds + line.delay) / 0.75) % 1) * height * 1.5 - height * 0.2
      const lineColor = getRaidSpeedLineColor(line, streak, stageTheme)
      const x = line.x * width
      graphics.moveTo(x, y)
      graphics.lineTo(x, y + line.length)
      const stroke = getPixiFill(lineColor, 0.36)
      graphics.stroke({ color: stroke.color, alpha: stroke.alpha, width: line.width, cap: 'round' })
    }
  }

  private updateTopDownWateryWorldSurface(graphics: Graphics, width: number, height: number, seconds: number, quality: GraphicsQuality) {
    const isMedium = quality === 'medium'
    const waterGrad = this.getGradient('topdown-watery-water', {
      type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: parsePixiCssColor('rgba(2,1,10,0.98)').source },
        { offset: 0.34, color: parsePixiCssColor('rgba(9,5,35,0.97)').source },
        { offset: 0.68, color: parsePixiCssColor('rgba(13,5,43,0.98)').source },
        { offset: 1, color: parsePixiCssColor('rgba(4,1,14,0.99)').source },
      ],
    })
    graphics.rect(0, 0, width, height).fill({ fill: waterGrad, alpha: 1 })

    this.fillRadial(graphics, width * 0.52, height * 0.42, width * 0.72, height * 0.42, 'rgba(70,30,130,0.16)', 'rgba(0,0,0,0)')
    this.fillRadial(graphics, width * 0.2, height * 0.72, width * 0.46, height * 0.22, 'rgba(42,120,160,0.08)', 'rgba(0,0,0,0)')

    const shimmerCount = isMedium ? 5 : 8
    for (let i = 0; i < shimmerCount; i += 1) {
      const y = ((seconds * (0.012 + i * 0.0018) + i * 0.17) % 1) * (height * 1.2) - height * 0.1
      const x = width * (0.2 + seededNoise(i + 13, 29) * 0.62)
      const pulse = 0.72 + Math.sin(seconds * 0.5 + i * 1.3) * 0.28
      this.fillRadial(graphics, x, y, width * (0.36 + seededNoise(i + 3, 7) * 0.22), height * (0.018 + seededNoise(i + 5, 11) * 0.018), 'rgba(92,170,220,1)', 'rgba(0,0,0,0)', 0.055 * pulse)
      this.fillRadial(graphics, width - x * 0.74, y + height * 0.09, width * 0.28, height * 0.012, 'rgba(180,110,245,1)', 'rgba(0,0,0,0)', 0.035 * pulse)
    }

    this.updateWateryWorldAssetSprites(width, height, seconds, quality)

    const glowCount = isMedium ? 3 : 5
    for (let i = 0; i < glowCount; i += 1) {
      const gx = width * (0.12 + i * 0.19)
      const gy = ((seconds * (0.02 + i * 0.003) + i * 0.18) % 1) * height
      this.fillRadial(graphics, gx, gy, width * 0.13, height * 0.045, 'rgba(80,28,180,0.10)', 'rgba(0,0,0,0)')
    }
    return
  }

  private hideWaterySurfaceSprites() {
    for (const sprite of this.wateryIslandSprites) {
      sprite.visible = false
    }
    for (const sprite of this.wateryCloudSprites) {
      sprite.visible = false
    }
    for (const sprite of this.volcanicIslandSprites) {
      sprite.visible = false
    }
    for (const sprite of this.volcanicCloudSprites) {
      sprite.visible = false
    }
  }

  private updateWateryWorldAssetSprites(width: number, height: number, seconds: number, quality: GraphicsQuality) {
    const islandCount = quality === 'medium' ? 3 : WATERY_WORLD_ISLAND_LAYERS.length
    for (let index = 0; index < WATERY_WORLD_ISLAND_LAYERS.length; index += 1) {
      const layer = WATERY_WORLD_ISLAND_LAYERS[index]
      const texture = this.assetTextures.get(layer.asset)
      const visible = Boolean(texture && index < islandCount)
      const drawSize = Math.min(width, height) * layer.size
      const x = width * layer.x + Math.sin(seconds * 0.16 + index * 2.2) * width * layer.drift
      const baseY = getWaterySurfaceLayerY(seconds, height, WATERY_WORLD_ISLAND_SCROLL_SPEED, layer.ySeed, drawSize)
      for (let tileIndex = 0; tileIndex < WORLD_SURFACE_TILE_OFFSETS.length; tileIndex += 1) {
        const sprite = this.wateryIslandSprites[getWorldSurfaceSpriteIndex(index, tileIndex)]
        if (!texture || !visible) {
          sprite.visible = false
          continue
        }
        const y = getWorldSurfaceCopyY(baseY, height, drawSize, tileIndex)
        if (!isWorldSurfaceCopyVisible(y, height, drawSize)) {
          sprite.visible = false
          continue
        }
        setPixiSpriteContain(sprite, texture, x, y, drawSize, drawSize, layer.alpha, layer.rotation + Math.sin(seconds * 0.05 + index) * 2 * DEG)
        sprite.tint = 0xd8c8ff
      }
    }

    const cloudCount = quality === 'medium' ? 3 : WATERY_WORLD_CLOUD_LAYERS.length
    for (let index = 0; index < WATERY_WORLD_CLOUD_LAYERS.length; index += 1) {
      const layer = WATERY_WORLD_CLOUD_LAYERS[index]
      const texture = this.assetTextures.get(layer.asset)
      const visible = Boolean(texture && index < cloudCount)
      const drawWidth = width * layer.width
      const drawHeight = height * layer.height
      const x = width * layer.x + Math.sin(seconds * 0.18 + index * 1.9) * width * layer.drift
      const baseY = getWaterySurfaceLayerY(seconds, height, layer.speed, layer.ySeed, drawHeight)
      for (let tileIndex = 0; tileIndex < WORLD_SURFACE_TILE_OFFSETS.length; tileIndex += 1) {
        const sprite = this.wateryCloudSprites[getWorldSurfaceSpriteIndex(index, tileIndex)]
        if (!texture || !visible) {
          sprite.visible = false
          continue
        }
        const y = getWorldSurfaceCopyY(baseY, height, drawHeight, tileIndex)
        if (!isWorldSurfaceCopyVisible(y, height, drawHeight)) {
          sprite.visible = false
          continue
        }
        setPixiSpriteContain(sprite, texture, x, y, drawWidth, drawHeight, layer.alpha, layer.rotation + Math.sin(seconds * 0.08 + index) * 1.5 * DEG)
        sprite.tint = 0xffffff
      }
    }
  }

  private updateVolcanicWorldAssetSprites(width: number, height: number, seconds: number, quality: GraphicsQuality) {
    const islandCount = quality === 'medium' ? 3 : VOLCANIC_WORLD_ISLAND_LAYERS.length
    for (let index = 0; index < VOLCANIC_WORLD_ISLAND_LAYERS.length; index += 1) {
      const layer = VOLCANIC_WORLD_ISLAND_LAYERS[index]
      const texture = this.assetTextures.get(layer.asset)
      const visible = Boolean(texture && index < islandCount)
      const drawSize = Math.min(width, height) * layer.size
      const x = width * layer.x + Math.sin(seconds * 0.15 + index * 2.1) * width * layer.drift
      const baseY = getWaterySurfaceLayerY(seconds, height, VOLCANIC_WORLD_ISLAND_SCROLL_SPEED, layer.ySeed, drawSize)
      for (let tileIndex = 0; tileIndex < WORLD_SURFACE_TILE_OFFSETS.length; tileIndex += 1) {
        const sprite = this.volcanicIslandSprites[getWorldSurfaceSpriteIndex(index, tileIndex)]
        if (!texture || !visible) {
          sprite.visible = false
          continue
        }
        const y = getWorldSurfaceCopyY(baseY, height, drawSize, tileIndex)
        if (!isWorldSurfaceCopyVisible(y, height, drawSize)) {
          sprite.visible = false
          continue
        }
        setPixiSpriteContain(sprite, texture, x, y, drawSize, drawSize, layer.alpha, layer.rotation + Math.sin(seconds * 0.05 + index) * 1.6 * DEG)
        sprite.tint = 0xffd6c0
      }
    }

    const cloudCount = quality === 'medium' ? 3 : VOLCANIC_WORLD_CLOUD_LAYERS.length
    for (let index = 0; index < VOLCANIC_WORLD_CLOUD_LAYERS.length; index += 1) {
      const layer = VOLCANIC_WORLD_CLOUD_LAYERS[index]
      const texture = this.assetTextures.get(layer.asset)
      const visible = Boolean(texture && index < cloudCount)
      const drawWidth = width * layer.width
      const drawHeight = height * layer.height
      const x = width * layer.x + Math.sin(seconds * 0.17 + index * 1.8) * width * layer.drift
      const baseY = getWaterySurfaceLayerY(seconds, height, layer.speed, layer.ySeed, drawHeight)
      for (let tileIndex = 0; tileIndex < WORLD_SURFACE_TILE_OFFSETS.length; tileIndex += 1) {
        const sprite = this.volcanicCloudSprites[getWorldSurfaceSpriteIndex(index, tileIndex)]
        if (!texture || !visible) {
          sprite.visible = false
          continue
        }
        const y = getWorldSurfaceCopyY(baseY, height, drawHeight, tileIndex)
        if (!isWorldSurfaceCopyVisible(y, height, drawHeight)) {
          sprite.visible = false
          continue
        }
        setPixiSpriteContain(sprite, texture, x, y, drawWidth, drawHeight, layer.alpha, layer.rotation + Math.sin(seconds * 0.07 + index) * 1.4 * DEG)
        sprite.tint = 0xffffff
      }
    }
  }

  private updateTopDownVolcanicWorldSurface(graphics: Graphics, width: number, height: number, seconds: number, quality: GraphicsQuality) {
    const isMedium = quality === 'medium'
    const groundGrad = this.getGradient('topdown-volcanic-ground', {
      type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: parsePixiCssColor('rgba(4,1,1,0.99)').source },
        { offset: 0.28, color: parsePixiCssColor('rgba(31,6,3,0.98)').source },
        { offset: 0.58, color: parsePixiCssColor('rgba(68,14,5,0.98)').source },
        { offset: 0.82, color: parsePixiCssColor('rgba(33,6,3,0.99)').source },
        { offset: 1, color: parsePixiCssColor('rgba(8,1,1,1)').source },
      ],
    })
    graphics.rect(0, 0, width, height).fill({ fill: groundGrad, alpha: 1 })

    const eruptPulse = 0.68 + Math.sin(seconds * 1.2) * 0.32
    this.fillRadial(graphics, width * 0.48, height * 0.38, width * 0.74, height * 0.34, 'rgba(200,58,14,1)', 'rgba(0,0,0,0)', 0.14 * eruptPulse)
    this.fillRadial(graphics, width * 0.5, height * 0.78, width * 0.88, height * 0.18, 'rgba(255,96,26,1)', 'rgba(0,0,0,0)', 0.12 * eruptPulse)

    const lavaFlowCount = isMedium ? 5 : 8
    for (let i = 0; i < lavaFlowCount; i += 1) {
      const y = ((seconds * (0.018 + i * 0.002) + i * 0.14) % 1) * (height * 1.18) - height * 0.09
      const x = width * (0.18 + seededNoise(i + 21, 15) * 0.66)
      const pulse = 0.62 + Math.sin(seconds * 0.9 + i * 1.6) * 0.38
      this.fillRadial(graphics, x, y, width * (0.34 + seededNoise(i + 4, 18) * 0.24), height * (0.024 + seededNoise(i + 2, 9) * 0.026), 'rgba(255,96,24,1)', 'rgba(0,0,0,0)', 0.08 * pulse)
      this.fillRadial(graphics, x + width * 0.08, y + height * 0.05, width * 0.16, height * 0.012, 'rgba(255,206,84,1)', 'rgba(0,0,0,0)', 0.06 * pulse)
    }

    this.updateVolcanicWorldAssetSprites(width, height, seconds, quality)

    const emberCount = isMedium ? 10 : 20
    for (let i = 0; i < emberCount; i += 1) {
      const px = ((i * 0.17 + i * i * 0.031) % 1) * width
      const py = ((seconds * (0.035 + i * 0.004) + i * 0.09) % 1) * height
      graphics.ellipse(px, py, 1 + (i % 3) * 0.6, 1 + (i % 3) * 0.6).fill(getPixiFill('rgba(255,128,38,0.7)', 0.16 + (i % 4) * 0.045))
    }
  }

  private updateSurface(width: number, height: number, seconds: number, palette: RaidPalette, quality: GraphicsQuality, stageTheme: number) {
    const graphics = this.surfaceGraphics
    graphics.clear()
    this.hideWaterySurfaceSprites()
    const isMedium = quality === 'medium'
    const isWorld = isWateryWorldTheme(stageTheme) || isVolcanicWorldTheme(stageTheme)
    const visible = quality !== 'low' && (isWorld || shouldDrawRaidSurfaceStage(stageTheme))
    graphics.visible = visible
    if (!visible) return

    if (isWateryWorldTheme(stageTheme)) {
      this.updateTopDownWateryWorldSurface(graphics, width, height, seconds, quality)
      return

      const horizonY = height * 0.58

      // Full-screen eerie violet atmosphere sky â€” covers all layers below
      const skyGrad = this.getGradient('watery-sky', {
        type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 },
        colorStops: [
          { offset: 0,    color: parsePixiCssColor('rgba(2,1,8,0.97)').source },
          { offset: 0.38, color: parsePixiCssColor('rgba(10,4,28,0.96)').source },
          { offset: 0.64, color: parsePixiCssColor('rgba(22,8,58,0.94)').source },
          { offset: 1,    color: parsePixiCssColor('rgba(6,2,18,0.97)').source },
        ],
      })
      graphics.rect(0, 0, width, height).fill({ fill: skyGrad, alpha: 0.97 })

      // Alien orb / moon with glow halo
      if (!isMedium) {
        const orbX = width * 0.78
        const orbY = height * 0.13
        const orbR = Math.min(width, height) * 0.055
        this.fillRadial(graphics, orbX, orbY, orbR * 5.5, orbR * 5.5, 'rgba(90,32,170,0.10)', 'rgba(0,0,0,0)')
        this.fillRadial(graphics, orbX, orbY, orbR * 2.6, orbR * 2.6, 'rgba(138,68,214,0.20)', 'rgba(0,0,0,0)')
        graphics.ellipse(orbX, orbY, orbR, orbR).fill(getPixiFill('rgba(168,108,232,0.90)', 0.88))
      }

      // Atmospheric mist / fog layers drifting at different speeds
      const mistLayers = isMedium ? 4 : 7
      for (let i = 0; i < mistLayers; i++) {
        const layerY = horizonY - height * (0.06 + i * 0.07)
        const speed = 0.0014 + i * 0.0004
        const offsetX = ((seconds * speed + i * 0.22) % 1) * (width * 2.6) - width * 0.8
        const mistW = width * (0.58 + i * 0.10)
        const mistH = height * (0.10 + i * 0.016)
        const alpha = Math.max(0.04, 0.20 - i * 0.022)
        this.fillRadial(graphics, offsetX, layerY, mistW, mistH, 'rgba(70,30,130,1)', 'rgba(0,0,0,0)', alpha)
        this.fillRadial(graphics, offsetX + mistW * 0.55, layerY + mistH * 0.08, mistW * 0.68, mistH * 0.62, 'rgba(50,20,100,1)', 'rgba(0,0,0,0)', alpha * 0.68)
      }

      // Horizon atmospheric glow
      this.fillRadial(graphics, width * 0.5, horizonY, width * 1.3, height * 0.14, 'rgba(52,16,108,0.30)', 'rgba(0,0,0,0)')

      // Dark violet water surface (below horizon)
      const waterGrad = this.getGradient('watery-water', {
        type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 },
        colorStops: [
          { offset: 0,   color: parsePixiCssColor('rgba(16,4,40,0.97)').source },
          { offset: 0.5, color: parsePixiCssColor('rgba(8,2,22,0.98)').source },
          { offset: 1,   color: parsePixiCssColor('rgba(3,1,10,0.99)').source },
        ],
      })
      graphics.rect(0, horizonY, width, height - horizonY).fill({ fill: waterGrad, alpha: 1 })

      // Animated water shimmer lines
      if (!isMedium) {
        const shimmerCount = 8
        for (let i = 0; i < shimmerCount; i++) {
          const shimY = horizonY + height * (0.04 + i * 0.04)
          const phase = seconds * (0.08 + i * 0.015) + i * 0.38
          const shimX = width * 0.5 + Math.sin(phase) * width * 0.22
          const shimW = width * (0.26 + Math.cos(phase * 0.7) * 0.08)
          const shimAlpha = 0.055 + Math.abs(Math.sin(phase)) * 0.04
          const shimFill = getPixiFill('rgba(120,60,200,0.7)', shimAlpha)
          graphics.moveTo(shimX - shimW, shimY).lineTo(shimX + shimW, shimY)
          graphics.stroke({ color: shimFill.color, alpha: shimFill.alpha, width: 1.5, cap: 'round' })
        }
      }

      // Island silhouettes â€” parallax layers (back â†’ front, larger and jagged)
      const islandDefs = [
        { seed: 0.08, speed: 0.0028, laneY: 0.05,  wScale: 0.52, hScale: 0.09,  alpha: 0.62 },
        { seed: 0.55, speed: 0.0034, laneY: 0.065, wScale: 0.44, hScale: 0.075, alpha: 0.56 },
        { seed: 0.29, speed: 0.0052, laneY: 0.12,  wScale: 0.68, hScale: 0.15,  alpha: 0.76 },
        { seed: 0.72, speed: 0.0048, laneY: 0.10,  wScale: 0.56, hScale: 0.13,  alpha: 0.70 },
        { seed: 0.16, speed: 0.0075, laneY: 0.21,  wScale: 0.88, hScale: 0.24,  alpha: 0.86 },
        { seed: 0.61, speed: 0.0068, laneY: 0.18,  wScale: 0.72, hScale: 0.20,  alpha: 0.80 },
      ]
      const islandCount = isMedium ? 3 : islandDefs.length
      for (let i = 0; i < islandCount; i++) {
        const isl = islandDefs[i]
        const islW = width * isl.wScale
        const rawX = ((seconds * isl.speed + isl.seed) % 1) * (width + islW * 1.4) - islW * 0.7
        const islY = horizonY + height * isl.laneY
        const islH = height * isl.hScale
        const dark = i < 2 ? 'rgba(12,6,24,0.93)' : 'rgba(6,2,14,0.96)'
        // Bumpy ridgeline using poly â€” shape is deterministic (seed-only, not time-based)
        const numSeg = 10
        const pts: number[] = [rawX - islW * 0.5, islY]
        for (let p = 0; p <= numSeg; p++) {
          const t = p / numSeg
          const bump = Math.sin(t * Math.PI * 3.5 + isl.seed * 11) * 0.38 + Math.sin(t * Math.PI * 7.2 + isl.seed * 6.4) * 0.20
          pts.push(rawX - islW * 0.5 + islW * t, islY - islH * (0.5 + bump * 0.5))
        }
        pts.push(rawX + islW * 0.5, islY)
        graphics.poly(pts).fill(getPixiFill(dark, isl.alpha))
        // Water shadow below island
        this.fillRadial(graphics, rawX, islY + islH * 0.65, islW * 0.46, islH * 0.18, 'rgba(2,0,8,0.88)', 'rgba(0,0,0,0)', isl.alpha * 0.42)
      }

      // Deep-water bioluminescent glow
      const glowCount = isMedium ? 2 : 4
      for (let i = 0; i < glowCount; i++) {
        const gx = width * (0.16 + i * 0.23)
        const gy = horizonY + height * (0.34 + Math.sin(seconds * 0.4 + i * 1.2) * 0.06)
        this.fillRadial(graphics, gx, gy, width * 0.14, height * 0.05, 'rgba(72,18,158,0.11)', 'rgba(0,0,0,0)')
      }
      return
    }

    if (isVolcanicWorldTheme(stageTheme)) {
      this.updateTopDownVolcanicWorldSurface(graphics, width, height, seconds, quality)
      return

      const horizonY = height * 0.55

      // Full-screen smoggy dark red-amber atmosphere sky
      const skyGrad = this.getGradient('volcanic-sky', {
        type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 },
        colorStops: [
          { offset: 0,    color: parsePixiCssColor('rgba(3,1,1,0.97)').source },
          { offset: 0.28, color: parsePixiCssColor('rgba(18,5,3,0.96)').source },
          { offset: 0.64, color: parsePixiCssColor('rgba(56,14,8,0.94)').source },
          { offset: 1,    color: parsePixiCssColor('rgba(30,6,4,0.95)').source },
        ],
      })
      graphics.rect(0, 0, width, height).fill({ fill: skyGrad, alpha: 0.97 })

      // Rolling ash cloud layers drifting across sky
      const ashCount = isMedium ? 5 : 9
      for (let i = 0; i < ashCount; i++) {
        const speed = 0.0016 + i * 0.0006
        const ashX = (seconds * speed + i * 0.13) % 1 * (width * 2.4) - width * 0.7
        const ashY = height * (0.07 + i * 0.065)
        const ashW = width * (0.36 + (i % 3) * 0.14)
        const ashH = height * (0.10 + (i % 2) * 0.04)
        const ashAlpha = Math.max(0.05, 0.24 - i * 0.018)
        this.fillRadial(graphics, ashX, ashY, ashW, ashH, 'rgba(38,16,10,1)', 'rgba(0,0,0,0)', ashAlpha)
        this.fillRadial(graphics, ashX + ashW * 0.32, ashY + ashH * 0.1, ashW * 0.62, ashH * 0.62, 'rgba(26,10,6,1)', 'rgba(0,0,0,0)', ashAlpha * 0.65)
      }

      // Horizon eruption ambient glow (pulsing)
      const eruptPulse = 0.68 + Math.sin(seconds * 1.4) * 0.32
      this.fillRadial(graphics, width * 0.5, horizonY, width * 1.4, height * 0.20, 'rgba(200,58,14,1)', 'rgba(0,0,0,0)', 0.24 * eruptPulse)
      this.fillRadial(graphics, width * 0.5, horizonY, width * 0.85, height * 0.11, 'rgba(255,96,26,1)', 'rgba(0,0,0,0)', 0.20 * eruptPulse)

      // Dark rocky ground (below horizon)
      const groundGrad = this.getGradient('volcanic-ground', {
        type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 },
        colorStops: [
          { offset: 0,   color: parsePixiCssColor('rgba(22,6,4,0.97)').source },
          { offset: 0.5, color: parsePixiCssColor('rgba(12,3,2,0.98)').source },
          { offset: 1,   color: parsePixiCssColor('rgba(5,1,1,0.99)').source },
        ],
      })
      graphics.rect(0, horizonY, width, height - horizonY).fill({ fill: groundGrad, alpha: 1 })

      // Distant background volcanoes (smaller, layered depth)
      const bgVolcDefs = [
        { x: 0.24, w: 0.18, h: 0.18 },
        { x: 0.66, w: 0.16, h: 0.15 },
        { x: 0.88, w: 0.13, h: 0.14 },
      ]
      for (const v of bgVolcDefs) {
        const bx = width * v.x
        const baseY = horizonY + height * 0.02
        const vw = width * v.w
        const vh = height * v.h
        graphics.poly([bx - vw * 0.5, baseY, bx - vw * 0.06, baseY - vh, bx + vw * 0.06, baseY - vh, bx + vw * 0.5, baseY])
          .fill(getPixiFill('rgba(16,5,3,0.92)', 0.56))
        const pkPulse = 0.60 + Math.sin(seconds * 1.8 + v.x * 6.2) * 0.40
        this.fillRadial(graphics, bx, baseY - vh, vw * 0.32, height * 0.04, 'rgba(255,88,18,1)', 'rgba(0,0,0,0)', 0.18 * pkPulse)
      }

      // Large foreground volcanoes â€” smooth convex profile, crater glow, lava flow
      const fgVolcDefs = [
        { x: 0.12, w: 0.32, h: 0.38, seed: 0.22 },
        { x: 0.54, w: 0.40, h: 0.46, seed: 0.68 },
        { x: 0.90, w: 0.26, h: 0.30, seed: 0.44 },
      ]
      const numSeg = 14
      for (const v of fgVolcDefs) {
        const bx = width * v.x
        const baseY = horizonY + height * 0.06
        const vw = width * v.w
        const vh = height * v.h
        // Convex mountain silhouette (steeper near peak)
        const volcPts: number[] = []
        for (let p = 0; p <= numSeg; p++) {
          const t = p / numSeg
          volcPts.push(bx - vw * 0.5 * Math.pow(1 - t, 0.72), baseY - vh * t)
        }
        for (let p = numSeg; p >= 0; p--) {
          const t = p / numSeg
          volcPts.push(bx + vw * 0.5 * Math.pow(1 - t, 0.72), baseY - vh * t)
        }
        graphics.poly(volcPts).fill(getPixiFill('rgba(10,3,2,0.96)', 0.90))
        // Crater peak glow
        const pkPulse = 0.55 + Math.sin(seconds * 1.6 + v.seed * 9.4) * 0.45
        this.fillRadial(graphics, bx, baseY - vh, vw * 0.42, height * 0.07, 'rgba(255,128,28,1)', 'rgba(0,0,0,0)', 0.28 * pkPulse)
        this.fillRadial(graphics, bx, baseY - vh + height * 0.008, vw * 0.16, height * 0.035, 'rgba(255,200,60,1)', 'rgba(0,0,0,0)', 0.42 * pkPulse)
        // Lava flow â€” glowing chain of radial glows down slope
        const flowSteps = 6
        for (let s = 0; s < flowSteps; s++) {
          const t = s / (flowSteps - 1)
          const fx = bx + vw * 0.5 * Math.pow(1 - t, 0.72) * 0.32
          const fy = baseY - vh * (1 - t * 0.92)
          const fa = (1 - t * 0.7) * 0.30 * pkPulse
          const fc = t < 0.35 ? 'rgba(255,190,55,1)' : t < 0.65 ? 'rgba(255,90,22,1)' : 'rgba(180,32,10,1)'
          const fcAlpha = t < 0.35 ? fa * 2.2 : t < 0.65 ? fa * 2.0 : fa * 1.5
          this.fillRadial(graphics, fx, fy, vw * 0.04, height * 0.025, fc, 'rgba(0,0,0,0)', fcAlpha)
        }
      }

      // Lava rivers / glowing pools across ground
      const lavaRiverCount = isMedium ? 2 : 3
      for (let i = 0; i < lavaRiverCount; i++) {
        const riverY = horizonY + height * (0.16 + i * 0.13)
        const pulse = 0.72 + Math.sin(seconds * (0.6 + i * 0.2) + i * 2.1) * 0.28
        this.fillRadial(graphics, width * (0.5 + Math.sin(seconds * 0.18 + i * 0.9) * 0.06), riverY, width * 0.78, height * 0.065, 'rgba(255,78,16,1)', 'rgba(0,0,0,0)', 0.20 * pulse)
        this.fillRadial(graphics, width * (0.5 + Math.sin(seconds * 0.24 + i * 1.1) * 0.04), riverY, width * 0.44, height * 0.028, 'rgba(255,162,38,1)', 'rgba(0,0,0,0)', 0.24 * pulse)
      }

      // Falling ash particles
      if (!isMedium) {
        const ashPCount = 16
        for (let i = 0; i < ashPCount; i++) {
          const px = ((i * 0.17 + i * i * 0.031) % 1) * width
          const py = ((seconds * (0.04 + i * 0.008) + i * 0.09) % 1) * horizonY
          graphics.ellipse(px, py, 1.2 + (i % 3), 1.2 + (i % 3)).fill(getPixiFill('rgba(58,22,14,0.6)', 0.28 + (i % 4) * 0.07))
        }
      }
      return
    }

    // Default space surface
    const { surfaceA, surfaceB } = palette
    const surfaceWash = this.getGradient(`surface-wash|${surfaceA}|${surfaceB}`, {
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 1, y: 1 },
      colorStops: [
        { offset: 0, color: parsePixiCssColor(surfaceA).source },
        { offset: 0.55, color: parsePixiCssColor(surfaceB).source },
        { offset: 1, color: parsePixiCssColor('rgba(0,0,0,0)').source },
      ],
    })
    graphics.rect(0, 0, width, height).fill({ fill: surfaceWash, alpha: quality === 'medium' ? 0.08 : 0.12 })
    const pulse = 0.9 + Math.sin(seconds / 9) * 0.1
    this.fillRadial(graphics, width * 0.5, height * 0.46, Math.max(width, height) * 0.62 * pulse, Math.max(width, height) * 0.62, surfaceA, 'rgba(0,0,0,0)', 0.16)
  }

  private updatePlanets(width: number, height: number, seconds: number, palette: RaidPalette, stageTheme: number, isLow: boolean, isMedium: boolean) {
    const scene = getRaidBackgroundScene(stageTheme)
    const fallbackAlpha = palette.planetA ? 1 : 1
    const visibleCount = isLow || isWateryWorldTheme(stageTheme) || isVolcanicWorldTheme(stageTheme)
      ? 0
      : isMedium
        ? Math.min(2, scene.planets.length)
        : scene.planets.length

    for (let index = 0; index < this.planetSprites.length; index += 1) {
      const sprite = this.planetSprites[index]
      const planet = scene.planets[index]
      const texture = planet ? this.assetTextures.get(planet.asset) : undefined
      sprite.visible = Boolean(texture && index < visibleCount)
      if (!texture || !planet || index >= visibleCount) continue
      const radius = getRaidScenePlanetRadius(Math.min(width, height), scene, planet, stageTheme, Math.min(index, 2))
      const y = getRaidScenePlanetY(planet, height, seconds, radius * 2)
      const size = radius * getRaidScenePlanetDrawScale(planet.asset)
      setPixiSpriteContain(sprite, texture, width * planet.x, y, size, size, getRaidScenePlanetAlpha(planet) * fallbackAlpha, planet.rotation + seconds * planet.spin)
    }
  }

  private updateWrecks(width: number, height: number, seconds: number, stageTheme: number, isLow: boolean, isMedium: boolean) {
    const scene = getRaidBackgroundScene(stageTheme)
    const texture = this.assetTextures.get('spaceStation')
    const suppressSpaceDebris = isWateryWorldTheme(stageTheme) || isVolcanicWorldTheme(stageTheme)
    const visibleCount = !texture || isLow || suppressSpaceDebris ? 0 : isMedium ? Math.min(1, scene.wrecks.length) : scene.wrecks.length
    for (let index = 0; index < this.wreckSprites.length; index += 1) {
      const sprite = this.wreckSprites[index]
      const wreck = scene.wrecks[index]
      sprite.visible = Boolean(texture && wreck && index < visibleCount)
      if (!texture || !wreck || index >= visibleCount) continue
      const position = getRaidSceneWreckPosition(width, height, seconds, wreck)
      setPixiSpriteContain(
        sprite,
        texture,
        position.x,
        position.y,
        position.width,
        position.height,
        wreck.alpha,
        wreck.rotation + seconds * wreck.spin,
      )
    }
  }

  private updateScenic(width: number, height: number, seconds: number, stageTheme: number, isLow: boolean, isMedium: boolean) {
    const scene = getRaidBackgroundScene(stageTheme)
    const visibleCount = isLow ? 0 : isMedium ? Math.min(1, scene.scenic.length) : scene.scenic.length
    for (let index = 0; index < this.scenicSprites.length; index += 1) {
      const sprite = this.scenicSprites[index]
      const scenic = scene.scenic[index]
      const texture = scenic ? this.assetTextures.get(scenic.asset) : undefined
      sprite.visible = Boolean(texture && index < visibleCount)
      if (!texture || !scenic || index >= visibleCount) continue
      const position = getRaidSceneScenicPosition(width, height, seconds, scenic, index)
      setPixiSpriteContain(
        sprite,
        texture,
        position.x,
        position.y,
        position.width,
        position.height,
        scenic.alpha,
        scenic.rotation + seconds * scenic.spin,
      )
    }
  }

  private updateFinalBattleBackdrop(width: number, height: number, seconds: number, stageTheme: number, quality: GraphicsQuality, intensity: number) {
    const graphics = this.finalBattleBackdropGraphics
    graphics.clear()

    const isFinalTheme = Math.floor(stageTheme) === RAID_BOSS_BACKGROUND_THEME_FINAL
    const alpha = clamp(intensity, 0, 1)
    graphics.visible = isFinalTheme && quality !== 'low' && alpha > 0.01
    if (!graphics.visible) return

    const baseSize = Math.min(width, height)
    const pulse = 0.78 + Math.sin(seconds * 0.64) * 0.14
    const isMedium = quality === 'medium'

    this.fillRadial(graphics, width * 0.5, height * 0.34, width * 0.92, height * 0.46, 'rgba(190,24,93,1)', 'rgba(0,0,0,0)', 0.064 * alpha * pulse)
    this.fillRadial(graphics, width * 0.62, height * 0.62, width * 0.78, height * 0.38, 'rgba(14,165,233,1)', 'rgba(0,0,0,0)', 0.046 * alpha)
    this.fillRadial(graphics, width * 0.48, height * 0.47, width * 0.44, height * 0.22, 'rgba(250,204,21,1)', 'rgba(0,0,0,0)', 0.034 * alpha * pulse)
    this.fillRadial(graphics, width * 0.52, height * 0.42, width * 0.64, height * 0.18, 'rgba(125,249,255,1)', 'rgba(0,0,0,0)', 0.021 * alpha)

    const bloomCount = isMedium ? 4 : 7
    for (let index = 0; index < bloomCount; index += 1) {
      const bloom = 0.72 + Math.sin(seconds * (0.22 + index * 0.018) + index * 1.7) * 0.28
      const bx = width * (0.14 + seededNoise(index + 57, 19) * 0.72)
      const by = height * (0.14 + seededNoise(index + 83, 23) * 0.62)
      const radiusX = baseSize * (0.052 + seededNoise(index + 11, 31) * 0.048)
      const radiusY = baseSize * (0.028 + seededNoise(index + 29, 37) * 0.026)
      const color = index % 3 === 0 ? 'rgba(251,146,60,1)' : index % 3 === 1 ? 'rgba(56,189,248,1)' : 'rgba(244,114,182,1)'
      this.fillRadial(graphics, bx, by, radiusX, radiusY, color, 'rgba(0,0,0,0)', 0.064 * bloom * alpha)
      this.fillRadial(graphics, bx, by, radiusX * 0.32, radiusY * 0.5, 'rgba(255,255,255,1)', 'rgba(0,0,0,0)', 0.026 * bloom * alpha)
    }

    const burstCount = isMedium ? 3 : 5
    for (let index = 0; index < burstCount; index += 1) {
      const cycle = (seconds * (0.12 + index * 0.01) + index * 0.19) % 1
      const burst = cycle < 0.36 ? Math.sin((cycle / 0.36) * Math.PI) : 0
      if (burst <= 0) continue
      const bx = width * (0.18 + seededNoise(index + 91, 17) * 0.64)
      const by = height * (0.2 + seededNoise(index + 41, 29) * 0.52)
      const radius = baseSize * (0.024 + seededNoise(index + 13, 31) * 0.024) * (0.8 + burst * 1.1)
      this.fillRadial(graphics, bx, by, radius * 1.35, radius * 1.35, 'rgba(255,255,255,1)', 'rgba(0,0,0,0)', 0.105 * burst * alpha)
      this.fillRadial(graphics, bx, by, radius, radius, index % 2 === 0 ? 'rgba(251,146,60,1)' : 'rgba(56,189,248,1)', 'rgba(0,0,0,0)', 0.16 * burst * alpha)
    }
  }

  private updateFinalBattleLayer(width: number, height: number, seconds: number, stageTheme: number, quality: GraphicsQuality, intensity: number) {
    const graphics = this.finalBattleGraphics
    graphics.clear()
    const isFinalTheme = Math.floor(stageTheme) === RAID_BOSS_BACKGROUND_THEME_FINAL
    const alpha = clamp(intensity, 0, 1)
    graphics.visible = isFinalTheme && quality !== 'low' && alpha > 0.01
    if (!graphics.visible) {
      for (const sprite of this.finalBattleSprites) sprite.visible = false
      for (const sprite of this.finalBattleCruiserSprites) sprite.visible = false
      return
    }

    const isMedium = quality === 'medium'
    const fighterLimit = isMedium ? 5 : FINAL_BATTLE_FIGHTERS.length
    const explosionLimit = isMedium ? 2 : FINAL_BATTLE_EXPLOSIONS.length
    const baseSize = Math.min(width, height)

    this.fillRadial(graphics, width * 0.5, height * 0.42, width * 0.58, height * 0.32, 'rgba(239,35,60,1)', 'rgba(0,0,0,0)', 0.08 * alpha)
    this.fillRadial(graphics, width * 0.38, height * 0.68, width * 0.48, height * 0.2, 'rgba(56,189,248,1)', 'rgba(0,0,0,0)', 0.055 * alpha)

    for (let index = 0; index < explosionLimit; index += 1) {
      const explosion = FINAL_BATTLE_EXPLOSIONS[index]
      const y = ((seconds * explosion.speed + explosion.ySeed) % 1) * height
      const x = width * (explosion.x + Math.sin(seconds * 0.18 + index * 1.7) * 0.032)
      const cycle = ((seconds + explosion.offset) % explosion.period) / explosion.period
      const pulse = cycle < 0.4 ? Math.sin((cycle / 0.4) * Math.PI) : 0
      if (pulse <= 0) continue
      const radius = baseSize * explosion.radius * (0.7 + pulse * 1.45)
      this.fillRadial(graphics, x, y, radius, radius, 'rgba(255,255,255,1)', 'rgba(0,0,0,0)', 0.18 * pulse * alpha)
      this.fillRadial(graphics, x, y, radius * 0.9, radius * 0.9, 'rgba(251,191,36,1)', 'rgba(0,0,0,0)', 0.28 * pulse * alpha)
      this.fillRadial(graphics, x, y, radius * 0.72, radius * 0.72, 'rgba(239,35,60,1)', 'rgba(0,0,0,0)', 0.16 * pulse * alpha)
    }

    for (let index = 0; index < fighterLimit; index += 1) {
      const fighter = FINAL_BATTLE_FIGHTERS[index]
      const sprite = this.finalBattleSprites[index]
      const texture = this.finalBattleTextures.get(getFinalBattleTextureKey(fighter))
      const progress = (seconds * fighter.speed + fighter.ySeed) % 1
      const laneDrift = Math.sin(fighter.phase) * fighter.drift * 0.52
      const y = fighter.side === 'ally'
        ? height * (1.1 - progress * 1.22)
        : height * (-0.1 + progress * 1.22)
      const x = width * (fighter.x + (progress - 0.5) * laneDrift)
      const travelDy = fighter.side === 'ally' ? -height * 1.22 : height * 1.22
      const angle = Math.atan2(width * laneDrift, -travelDy)
      const size = baseSize * fighter.size * (isMedium ? 0.92 : 1)
      const shipAlpha = alpha * (fighter.assetKind === 'ship' ? 0.48 : 0.52)
      if (texture) {
        const drawSize = fighter.assetKind === 'ship' ? size : size * 1.08
        setPixiSpriteContain(sprite, texture, x, y, drawSize, drawSize, shipAlpha, fighter.side === 'ally' ? angle : angle - Math.PI)
      } else {
        sprite.visible = false
      }

      const fireCycle = ((seconds * (0.72 + index * 0.045) + fighter.phase) % 1)
      if (fireCycle < 0.92) {
        this.drawFinalBattleWeaponProfile(graphics, fighter.weapon, fighter.side, x, y, size, angle, baseSize, fireCycle / 0.92, alpha)
      }
    }
    for (let index = fighterLimit; index < this.finalBattleSprites.length; index += 1) {
      this.finalBattleSprites[index].visible = false
    }

    const cruiserLimit = isMedium ? 2 : FINAL_BATTLE_CRUISERS.length
    for (let index = 0; index < cruiserLimit; index += 1) {
      const cruiser = FINAL_BATTLE_CRUISERS[index]
      const sprite = this.finalBattleCruiserSprites[index]
      const texture = this.finalBattleTextures.get(getFinalBattleCruiserTextureKey(cruiser))
      const progress = (seconds * cruiser.speed + cruiser.ySeed) % 1
      const y = height * (1.16 - progress * 1.34)
      const laneDrift = cruiser.drift * (0.65 + Math.sin(cruiser.phase) * 0.18)
      const x = width * (cruiser.x + (progress - 0.5) * laneDrift)
      const angle = Math.atan2(width * laneDrift, height * 1.34)
      const size = baseSize * cruiser.size
      const edgeFade = clamp(Math.min(progress / 0.12, (1 - progress) / 0.16, 1), 0, 1)
      const cruiserAlpha = alpha * cruiser.alpha * edgeFade
      if (texture) {
        this.drawFinalBattleCruiserTrail(graphics, x, y, size, angle, cruiserAlpha)
        setPixiSpriteContain(sprite, texture, x, y, size, size, cruiserAlpha, angle)
      } else {
        sprite.visible = false
      }
    }
    for (let index = cruiserLimit; index < this.finalBattleCruiserSprites.length; index += 1) {
      this.finalBattleCruiserSprites[index].visible = false
    }
  }

  private drawFinalBattleCruiserTrail(graphics: Graphics, x: number, y: number, size: number, angle: number, alpha: number) {
    const outerLeft = this.getBattleLocalPoint(x, y, -size * 0.09, size * 0.34, angle)
    const outerRight = this.getBattleLocalPoint(x, y, size * 0.09, size * 0.34, angle)
    const outerTip = this.getBattleLocalPoint(x, y, 0, size * 0.88, angle)
    const outerFill = getPixiFill('rgba(96,221,255,1)', 0.12 * alpha)
    graphics.poly([outerLeft.x, outerLeft.y, outerRight.x, outerRight.y, outerTip.x, outerTip.y]).fill(outerFill)

    const innerLeft = this.getBattleLocalPoint(x, y, -size * 0.035, size * 0.38, angle)
    const innerRight = this.getBattleLocalPoint(x, y, size * 0.035, size * 0.38, angle)
    const innerTip = this.getBattleLocalPoint(x, y, 0, size * 0.7, angle)
    const innerFill = getPixiFill('rgba(235,255,255,1)', 0.18 * alpha)
    graphics.poly([innerLeft.x, innerLeft.y, innerRight.x, innerRight.y, innerTip.x, innerTip.y]).fill(innerFill)
  }

  private drawFinalBattleWeaponProfile(
    graphics: Graphics,
    weapon: typeof FINAL_BATTLE_FIGHTERS[number]['weapon'],
    side: 'ally' | 'enemy',
    x: number,
    y: number,
    size: number,
    angle: number,
    baseSize: number,
    progress: number,
    alpha: number,
  ) {
    const beamColor = side === 'ally' ? 'rgba(125,249,255,1)' : 'rgba(255,86,116,1)'
    const coreColor = side === 'ally' ? 'rgba(235,255,255,1)' : 'rgba(255,220,170,1)'
    const rocketColor = side === 'ally' ? 'rgba(251,146,60,1)' : 'rgba(244,63,94,1)'
    const scatterColor = side === 'ally' ? 'rgba(244,114,182,1)' : 'rgba(192,132,252,1)'
    const muzzle = this.getBattleLocalPoint(x, y, 0, -size * 0.58, angle)

    const strokeLine = (sx: number, sy: number, ex: number, ey: number, color: string, strokeAlpha: number, widthPx: number) => {
      const stroke = getPixiFill(color, strokeAlpha)
      graphics.moveTo(sx, sy)
      graphics.lineTo(ex, ey)
      graphics.stroke({ color: stroke.color, alpha: stroke.alpha, width: Math.max(1, widthPx), cap: 'round' })
    }

    const drawTravelingBolt = (
      sx: number,
      sy: number,
      shotAngle: number,
      pathLength: number,
      shotProgress: number,
      color: string,
      core: string,
      widthPx: number,
      headRadius: number,
      curve = 0,
      trailPortion = 0.22,
    ) => {
      if (shotProgress <= 0 || shotProgress >= 1) return
      const dirX = Math.sin(shotAngle)
      const dirY = -Math.cos(shotAngle)
      const sideX = Math.cos(shotAngle)
      const sideY = Math.sin(shotAngle)
      const travel = pathLength * shotProgress
      const tailTravel = Math.max(0, travel - pathLength * trailPortion)
      const tailProgress = tailTravel / Math.max(1, pathLength)
      const headCurve = Math.sin(shotProgress * Math.PI) * curve
      const tailCurve = Math.sin(tailProgress * Math.PI) * curve
      const hx = sx + dirX * travel + sideX * headCurve
      const hy = sy + dirY * travel + sideY * headCurve
      const tx = sx + dirX * tailTravel + sideX * tailCurve
      const ty = sy + dirY * tailTravel + sideY * tailCurve
      const edgeFade = clamp(Math.min(shotProgress / 0.08, (1 - shotProgress) / 0.12, 1), 0, 1)
      const shotAlpha = alpha * edgeFade
      strokeLine(tx, ty, hx, hy, color, 0.26 * shotAlpha, widthPx)
      strokeLine(tx, ty, hx, hy, core, 0.52 * shotAlpha, Math.max(1, widthPx * 0.32))
      this.fillRadial(graphics, hx, hy, headRadius * 1.35, headRadius * 1.35, color, 'rgba(0,0,0,0)', 0.22 * shotAlpha)
      this.fillRadial(graphics, hx, hy, headRadius * 0.72, headRadius * 0.72, core, 'rgba(0,0,0,0)', 0.38 * shotAlpha)
    }

    const drawTravelingOrb = (
      sx: number,
      sy: number,
      shotAngle: number,
      pathLength: number,
      shotProgress: number,
      color: string,
      core: string,
      radius: number,
      curve = 0,
    ) => {
      if (shotProgress <= 0 || shotProgress >= 1) return
      const dirX = Math.sin(shotAngle)
      const dirY = -Math.cos(shotAngle)
      const sideX = Math.cos(shotAngle)
      const sideY = Math.sin(shotAngle)
      const travel = pathLength * shotProgress
      const bend = Math.sin(shotProgress * Math.PI) * curve
      const hx = sx + dirX * travel + sideX * bend
      const hy = sy + dirY * travel + sideY * bend
      const edgeFade = clamp(Math.min(shotProgress / 0.1, (1 - shotProgress) / 0.14, 1), 0, 1)
      const shotAlpha = alpha * edgeFade
      const tailX = hx - dirX * radius * 1.9
      const tailY = hy - dirY * radius * 1.9
      strokeLine(tailX, tailY, hx, hy, color, 0.16 * shotAlpha, radius * 0.72)
      this.fillRadial(graphics, hx, hy, radius * 1.9, radius * 1.9, color, 'rgba(0,0,0,0)', 0.24 * shotAlpha)
      this.fillRadial(graphics, hx, hy, radius, radius, core, 'rgba(0,0,0,0)', 0.5 * shotAlpha)
    }

    if (side === 'enemy') {
      const enemyColor = weapon === 'rocket' ? 'rgba(255,88,38,1)' : weapon === 'scatter' ? 'rgba(192,132,252,1)' : 'rgba(255,86,116,1)'
      const enemyCore = weapon === 'rocket' ? 'rgba(255,224,138,1)' : 'rgba(255,190,230,1)'
      const pathLength = baseSize * (weapon === 'rocket' ? 0.24 : 0.28)
      const orbRadius = size * (weapon === 'rocket' ? 0.22 : 0.18)
      if (weapon === 'spread') {
        for (const fan of [-0.24, 0, 0.24]) drawTravelingOrb(muzzle.x, muzzle.y, angle + fan, pathLength, progress, enemyColor, enemyCore, orbRadius)
        return
      }
      if (weapon === 'scatter') {
        for (let shard = 0; shard < 5; shard += 1) {
          const stagger = shard * 0.055
          const shardProgress = (progress - stagger) / Math.max(0.1, 1 - stagger)
          drawTravelingOrb(muzzle.x, muzzle.y, angle - 0.42 + shard * 0.21, baseSize * 0.22, shardProgress, enemyColor, enemyCore, size * 0.14)
        }
        return
      }
      if (weapon === 'rocket') {
        for (const offset of [-0.2, 0.2]) {
          const start = this.getBattleLocalPoint(x, y, size * offset, -size * 0.2, angle)
          drawTravelingOrb(start.x, start.y, angle + offset * 0.1, pathLength, Math.pow(progress, 0.9), enemyColor, enemyCore, orbRadius, offset * size * 0.18)
        }
        return
      }
      drawTravelingOrb(muzzle.x, muzzle.y, angle, pathLength, progress, enemyColor, enemyCore, orbRadius)
      return
    }

    if (weapon === 'laser') {
      const length = baseSize * 0.32
      for (const offset of [-0.18, 0.18]) {
        const start = this.getBattleLocalPoint(x, y, size * offset, -size * 0.62, angle)
        drawTravelingBolt(start.x, start.y, angle, length, progress, beamColor, coreColor, size * 0.1, size * 0.12, 0, 0.22)
      }
      return
    }

    if (weapon === 'spread') {
      const length = baseSize * 0.28
      for (const fan of [-0.34, 0, 0.34]) {
        drawTravelingBolt(muzzle.x, muzzle.y, angle + fan, length, progress, beamColor, coreColor, size * 0.09, size * 0.12, 0, 0.16)
      }
      return
    }

    if (weapon === 'scatter') {
      const shardCount = 6
      for (let shard = 0; shard < shardCount; shard += 1) {
        const shardAngle = angle - 0.58 + (shard / Math.max(1, shardCount - 1)) * 1.16
        const start = this.getBattleLocalPoint(x, y, (shard - 2.5) * size * 0.04, -size * 0.38, angle)
        const stagger = shard * 0.045
        const shardProgress = (progress - stagger) / Math.max(0.1, 1 - stagger)
        const length = baseSize * (0.18 + (shard % 3) * 0.024)
        drawTravelingBolt(start.x, start.y, shardAngle, length, shardProgress, scatterColor, coreColor, size * 0.075, size * 0.1, 0, 0.12)
      }
      return
    }

    if (weapon === 'rocket') {
      const length = baseSize * 0.24
      for (const offset of [-0.22, 0.22]) {
        const start = this.getBattleLocalPoint(x, y, size * offset, -size * 0.2, angle)
        drawTravelingOrb(start.x, start.y, angle + offset * 0.08, length, Math.pow(progress, 0.88), rocketColor, 'rgba(255,246,210,1)', size * 0.17, offset * size * 0.14)
      }
      return
    }

    const length = baseSize * 0.3
    for (const offset of [-0.28, 0.28]) {
      const start = this.getBattleLocalPoint(x, y, size * offset, -size * 0.16, angle)
      drawTravelingOrb(start.x, start.y, angle + offset * 0.16, length, progress, beamColor, coreColor, size * 0.13, offset * baseSize * 0.04)
    }
  }

  private getBattleLocalPoint(x: number, y: number, localX: number, localY: number, angle: number) {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    return {
      x: x + localX * cos - localY * sin,
      y: y + localX * sin + localY * cos,
    }
  }

  private updateRareCometFlyby(width: number, height: number, seconds: number, isLow: boolean, isMedium: boolean, stageTheme: number) {
    const sprite = this.cometFlybySprite
    const texture = this.assetTextures.get('comet')
    const cycle = ((seconds + 11.5) % 41) / 41
    const isWorldTheme = isWateryWorldTheme(stageTheme) || isVolcanicWorldTheme(stageTheme)
    const visible = Boolean(texture && !isLow && !isMedium && !isWorldTheme && cycle < 0.19)
    sprite.visible = visible
    if (!texture || !visible) return

    const progress = cycle / 0.19
    const x = width * (1.12 - progress * 1.28)
    const y = height * (0.14 + progress * 0.18 + Math.sin(seconds * 0.7) * 0.015)
    const size = Math.max(44, Math.min(width, height) * 0.085)
    const alpha = Math.sin(progress * Math.PI) * 0.34
    const travelAngle = Math.atan2(height * 0.18, -width * 1.28)
    setPixiSpriteContain(sprite, texture, x, y, size * 2.2, size, alpha, travelAngle - COMET_ASSET_HEAD_ANGLE)
  }

  private updateBackgroundObjects(width: number, height: number, seconds: number, stageTheme: number, isLow: boolean, isMedium: boolean) {
    const scene = getRaidBackgroundScene(stageTheme)
    const asteroidTexture = this.assetTextures.get('asteroid')
    const density = (isWateryWorldTheme(stageTheme) || isVolcanicWorldTheme(stageTheme)) ? 0 : getRaidBackgroundObjectDensity(stageTheme)
    const asteroidCap = isMedium ? 3 : BACKGROUND_ASTEROIDS.length
    const debrisCap = isMedium ? 3 : BACKGROUND_DEBRIS.length
    const asteroidLimit = !asteroidTexture || isLow ? 0 : Math.max(0, Math.min(asteroidCap, Math.round(asteroidCap * density)))
    const debrisLimit = !asteroidTexture || isLow ? 0 : Math.max(0, Math.min(debrisCap, Math.round(debrisCap * density)))
    for (let index = 0; index < this.asteroidSprites.length; index += 1) {
      const sprite = this.asteroidSprites[index]
      sprite.visible = index < asteroidLimit
      if (!asteroidTexture || index >= asteroidLimit) continue
      const asteroid = BACKGROUND_ASTEROIDS[index]
      const y = ((seconds * asteroid.speed + asteroid.delay / 22 + 1) % 1) * height * 1.15 - height * 0.05
      setPixiSpriteContain(sprite, asteroidTexture, width * asteroid.x, y, asteroid.width * 1.5 * scene.asteroidBias, asteroid.height * 1.5 * scene.asteroidBias, asteroid.alpha, seconds * asteroid.spin * DEG / 10)
    }
    for (let index = 0; index < this.debrisSprites.length; index += 1) {
      const sprite = this.debrisSprites[index]
      sprite.visible = index < debrisLimit
      if (!asteroidTexture || index >= debrisLimit) continue
      const debris = BACKGROUND_DEBRIS[index]
      const y = ((seconds * debris.speed + debris.delay / 48 + 1) % 1) * height * 1.2 - height * 0.05
      setPixiSpriteContain(sprite, asteroidTexture, width * debris.x, y, debris.width * 1.35 * scene.debrisBias, debris.height * 1.35 * scene.debrisBias, debris.alpha, seconds * debris.spin * DEG / 12)
    }
  }

  private updateAmbientExplosions(width: number, height: number, seconds: number, isLow: boolean, isMedium: boolean, stageTheme: number) {
    const graphics = this.explosionGraphics
    graphics.clear()
    const allowBattleOverlay = shouldDrawRaidBattleOverlay(stageTheme)
    graphics.visible = !isLow && !isMedium && allowBattleOverlay
    if (!allowBattleOverlay) return
    const explosions = [
      { x: width * 0.08, y: height * 0.18, period: 7, offset: 4, radius: 32, alpha: 0.9 },
      { x: width * 0.9, y: height * 0.44, period: 11, offset: 2, radius: 24, alpha: 0.75 },
    ]
    for (const explosion of explosions) {
      const cycle = ((seconds + explosion.offset) % explosion.period) / explosion.period
      const pulse = cycle < 0.42 ? Math.sin((cycle / 0.42) * Math.PI) : 0
      const visible = !isLow && !isMedium && pulse > 0
      if (!visible) continue
      const radius = explosion.radius * (0.6 + pulse * 1.4)
      this.fillRadial(graphics, explosion.x, explosion.y, radius, radius, 'rgba(255,255,255,0.45)', 'rgba(0,0,0,0)', pulse * explosion.alpha)
      this.fillRadial(graphics, explosion.x, explosion.y, radius * 0.86, radius * 0.86, 'rgba(251,191,36,0.48)', 'rgba(0,0,0,0)', pulse * explosion.alpha)
      this.fillRadial(graphics, explosion.x, explosion.y, radius * 0.7, radius * 0.7, 'rgba(239,35,60,0.32)', 'rgba(0,0,0,0)', pulse * explosion.alpha)
    }
  }
}
