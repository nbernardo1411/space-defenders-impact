import { getPublicAssetUrl } from '../sound'
import type { GraphicsQuality } from '../sound'
import { Application, Assets, Container, FillGradient, Graphics, Sprite, Texture } from 'pixi.js'
import { RAID_DERELICT_WRECK_FILTER, RAID_OTHER_ASSET_PATHS, drawCanvasImageContain, getDerelictWreckCanvasSprite, getRaidOtherCanvasSprite } from './assets'
import type { RaidOtherAssetKey } from './assets'
import { COMET_ASSET_HEAD_ANGLE, DEG } from './constants'
import type { CameraShakeState } from './types'
import { clamp, drawRadialEllipse, drawRadialEllipse2Stop, getCachedSpeedLineSprite, seededNoise } from './utils'

export type RaidBackgroundBaseCacheEntry = {
  key: string
  canvas: HTMLCanvasElement
}

export type RaidStarfieldCacheEntry = {
  key: string
  farCanvas: HTMLCanvasElement
  farLayerHeight: number
  nearTrailCanvas: HTMLCanvasElement | null
  nearLayerHeight: number
}

export let raidBackgroundBaseCache: RaidBackgroundBaseCacheEntry | null = null

export let raidStarfieldCache: RaidStarfieldCacheEntry | null = null

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

const WATERY_WORLD_CLOUD_LAYERS: Array<{
  asset: RaidOtherAssetKey
  x: number
  ySeed: number
  speed: number
  width: number
  height: number
  alpha: number
  rotation: number
  drift: number
}> = [
  { asset: 'clouds', x: 0.18, ySeed: 0.08, speed: 0.024, width: 0.82, height: 0.28, alpha: 0.28, rotation: -6 * DEG, drift: 0.035 },
  { asset: 'clouds2', x: 0.78, ySeed: 0.32, speed: 0.021, width: 0.72, height: 0.32, alpha: 0.25, rotation: 8 * DEG, drift: 0.028 },
  { asset: 'clouds', x: 0.44, ySeed: 0.68, speed: 0.019, width: 0.92, height: 0.3, alpha: 0.2, rotation: 3 * DEG, drift: 0.024 },
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

const VOLCANIC_WORLD_CLOUD_LAYERS: Array<{
  asset: RaidOtherAssetKey
  x: number
  ySeed: number
  speed: number
  width: number
  height: number
  alpha: number
  rotation: number
  drift: number
}> = [
  { asset: 'volcanicClouds', x: 0.22, ySeed: 0.1, speed: 0.026, width: 0.86, height: 0.28, alpha: 0.25, rotation: -5 * DEG, drift: 0.032 },
  { asset: 'volcanicClouds2', x: 0.78, ySeed: 0.36, speed: 0.02, width: 0.74, height: 0.32, alpha: 0.22, rotation: 7 * DEG, drift: 0.026 },
  { asset: 'volcanicClouds', x: 0.46, ySeed: 0.7, speed: 0.017, width: 0.96, height: 0.3, alpha: 0.18, rotation: 3 * DEG, drift: 0.022 },
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

export function drawPlanetSurface(ctx: CanvasRenderingContext2D, palette: RaidPalette, width: number, height: number, seconds: number, quality: GraphicsQuality) {
  if (quality === 'low') return

  const pulse = 0.9 + Math.sin(seconds / 9) * 0.1
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = quality === 'medium' ? 0.08 : 0.12
  const wash = ctx.createLinearGradient(0, 0, width, height)
  wash.addColorStop(0, palette.surfaceA)
  wash.addColorStop(0.55, palette.surfaceB)
  wash.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, width, height)
  drawRadialEllipse2Stop(ctx, width * 0.5, height * 0.46, Math.max(width, height) * 0.62 * pulse, Math.max(width, height) * 0.62, palette.surfaceA, 'rgba(0,0,0,0)')
  ctx.restore()
}

function getTopDownBlobPoints(cx: number, cy: number, rx: number, ry: number, rotation: number, seed: number, segments: number) {
  const points: number[] = []
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  for (let i = 0; i < segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2
    const wobble = 0.9 + Math.sin(angle * 3.2 + seed * 9.1) * 0.08 + Math.sin(angle * 7.1 + seed * 4.4) * 0.045
    const localX = Math.cos(angle) * rx * wobble
    const localY = Math.sin(angle) * ry * (0.94 + Math.cos(angle * 2.3 + seed * 5.3) * 0.05)
    points.push(cx + localX * cos - localY * sin, cy + localX * sin + localY * cos)
  }
  return points
}

function drawCanvasBlob(ctx: CanvasRenderingContext2D, points: number[]) {
  if (points.length < 4) return
  ctx.beginPath()
  ctx.moveTo(points[0], points[1])
  for (let i = 2; i < points.length; i += 2) {
    ctx.lineTo(points[i], points[i + 1])
  }
  ctx.closePath()
}

function getWaterySurfaceLayerY(seconds: number, height: number, speed: number, ySeed: number, layerHeight: number) {
  const padding = Math.max(height * 0.18, layerHeight * 0.72)
  return ((seconds * speed + ySeed) % 1) * (height + padding * 2) - padding
}

function drawWateryWorldCanvasAssetLayers(ctx: CanvasRenderingContext2D, width: number, height: number, seconds: number, quality: GraphicsQuality) {
  const islandCount = quality === 'medium' ? 3 : WATERY_WORLD_ISLAND_LAYERS.length
  for (let index = 0; index < islandCount; index += 1) {
    const layer = WATERY_WORLD_ISLAND_LAYERS[index]
    const drawSize = Math.min(width, height) * layer.size
    const x = width * layer.x + Math.sin(seconds * 0.16 + index * 2.2) * width * layer.drift
    const y = getWaterySurfaceLayerY(seconds, height, WATERY_WORLD_ISLAND_SCROLL_SPEED, layer.ySeed, drawSize)
    drawRadialEllipse2Stop(ctx, x, y + drawSize * 0.08, drawSize * 0.56, drawSize * 0.34, 'rgba(2,0,10,0.52)', 'rgba(0,0,0,0)')
    drawCanvasImageContain(
      ctx,
      getRaidOtherCanvasSprite(layer.asset),
      x,
      y,
      drawSize,
      drawSize,
      'brightness(0.64) contrast(1.1) saturate(0.95)',
      layer.alpha,
      layer.rotation + Math.sin(seconds * 0.05 + index) * 2 * DEG,
    )
  }

  if (quality !== 'low') {
    const cloudCount = quality === 'medium' ? 2 : WATERY_WORLD_CLOUD_LAYERS.length
    for (let index = 0; index < cloudCount; index += 1) {
      const layer = WATERY_WORLD_CLOUD_LAYERS[index]
      const drawWidth = width * layer.width
      const drawHeight = height * layer.height
      const x = width * layer.x + Math.sin(seconds * 0.18 + index * 1.9) * width * layer.drift
      const y = getWaterySurfaceLayerY(seconds, height, layer.speed, layer.ySeed, drawHeight)
      drawCanvasImageContain(
        ctx,
        getRaidOtherCanvasSprite(layer.asset),
        x,
        y,
        drawWidth,
        drawHeight,
        'brightness(0.86) contrast(1.1) saturate(1.06)',
        layer.alpha,
        layer.rotation + Math.sin(seconds * 0.08 + index) * 1.5 * DEG,
      )
    }
  }
}

export function drawWateryWorldForegroundClouds(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, quality: GraphicsQuality) {
  if (quality === 'low') return
  const seconds = time / 1000
  const cloudCount = quality === 'medium' ? 1 : 2
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  for (let index = 0; index < cloudCount; index += 1) {
    const layer = WATERY_WORLD_CLOUD_LAYERS[index === 0 ? 1 : 2]
    const drawWidth = width * (index === 0 ? 0.9 : 0.76)
    const drawHeight = height * (index === 0 ? 0.34 : 0.26)
    const x = width * (index === 0 ? 0.58 : 0.26) + Math.sin(seconds * (0.12 + index * 0.07) + index * 2.4) * width * 0.045
    const y = getWaterySurfaceLayerY(seconds, height, index === 0 ? 0.031 : 0.017, index === 0 ? 0.72 : 0.18, drawHeight)
    drawCanvasImageContain(
      ctx,
      getRaidOtherCanvasSprite(layer.asset),
      x,
      y,
      drawWidth,
      drawHeight,
      'brightness(0.9) contrast(1.08) saturate(1.05)',
      index === 0 ? 0.105 : 0.075,
      layer.rotation * 0.55 + Math.sin(seconds * 0.07 + index) * 1.2 * DEG,
    )
  }
  ctx.restore()
}

function drawVolcanicWorldCanvasAssetLayers(ctx: CanvasRenderingContext2D, width: number, height: number, seconds: number, quality: GraphicsQuality) {
  const islandCount = quality === 'medium' ? 3 : VOLCANIC_WORLD_ISLAND_LAYERS.length
  for (let index = 0; index < islandCount; index += 1) {
    const layer = VOLCANIC_WORLD_ISLAND_LAYERS[index]
    const drawSize = Math.min(width, height) * layer.size
    const x = width * layer.x + Math.sin(seconds * 0.15 + index * 2.1) * width * layer.drift
    const y = getWaterySurfaceLayerY(seconds, height, VOLCANIC_WORLD_ISLAND_SCROLL_SPEED, layer.ySeed, drawSize)
    drawRadialEllipse2Stop(ctx, x, y + drawSize * 0.08, drawSize * 0.58, drawSize * 0.32, 'rgba(6,0,0,0.62)', 'rgba(0,0,0,0)')
    drawCanvasImageContain(
      ctx,
      getRaidOtherCanvasSprite(layer.asset),
      x,
      y,
      drawSize,
      drawSize,
      'brightness(0.72) contrast(1.12) saturate(1.05)',
      layer.alpha,
      layer.rotation + Math.sin(seconds * 0.05 + index) * 1.6 * DEG,
    )
  }

  if (quality !== 'low') {
    const cloudCount = quality === 'medium' ? 2 : VOLCANIC_WORLD_CLOUD_LAYERS.length
    for (let index = 0; index < cloudCount; index += 1) {
      const layer = VOLCANIC_WORLD_CLOUD_LAYERS[index]
      const drawWidth = width * layer.width
      const drawHeight = height * layer.height
      const x = width * layer.x + Math.sin(seconds * 0.17 + index * 1.8) * width * layer.drift
      const y = getWaterySurfaceLayerY(seconds, height, layer.speed, layer.ySeed, drawHeight)
      drawCanvasImageContain(
        ctx,
        getRaidOtherCanvasSprite(layer.asset),
        x,
        y,
        drawWidth,
        drawHeight,
        'brightness(0.9) contrast(1.12) saturate(1.06)',
        layer.alpha,
        layer.rotation + Math.sin(seconds * 0.07 + index) * 1.4 * DEG,
      )
    }
  }
}

function drawTopDownWateryWorldSurface(ctx: CanvasRenderingContext2D, width: number, height: number, seconds: number, quality: GraphicsQuality) {
  const waterGrad = ctx.createLinearGradient(0, 0, 0, height)
  waterGrad.addColorStop(0, 'rgba(2,1,10,0.98)')
  waterGrad.addColorStop(0.34, 'rgba(9,5,35,0.97)')
  waterGrad.addColorStop(0.68, 'rgba(13,5,43,0.98)')
  waterGrad.addColorStop(1, 'rgba(4,1,14,0.99)')
  ctx.fillStyle = waterGrad
  ctx.fillRect(0, 0, width, height)

  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  drawRadialEllipse2Stop(ctx, width * 0.52, height * 0.42, width * 0.72, height * 0.42, 'rgba(70,30,130,0.16)', 'rgba(0,0,0,0)')
  drawRadialEllipse2Stop(ctx, width * 0.2, height * 0.72, width * 0.46, height * 0.22, 'rgba(42,120,160,0.08)', 'rgba(0,0,0,0)')
  ctx.restore()

  if (quality !== 'low') {
    const currentCount = quality === 'medium' ? 9 : 15
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    for (let i = 0; i < currentCount; i += 1) {
      const seed = seededNoise(i + 41, 18)
      const x = width * (0.08 + seededNoise(i + 17, 22) * 0.84)
      const y = ((seconds * (0.018 + seed * 0.018) + seed) % 1) * (height * 1.24) - height * 0.12
      const drift = Math.sin(seconds * 0.45 + i * 1.7) * width * 0.025
      const lineH = height * (0.08 + seededNoise(i + 8, 3) * 0.09)
      ctx.globalAlpha = 0.035 + seededNoise(i + 12, 5) * 0.045
      ctx.strokeStyle = i % 3 === 0 ? 'rgba(160,90,230,0.9)' : 'rgba(90,210,230,0.68)'
      ctx.lineWidth = 1 + seededNoise(i + 3, 11) * 1.4
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.bezierCurveTo(x + drift, y + lineH * 0.28, x - drift * 0.5, y + lineH * 0.72, x + drift * 0.24, y + lineH)
      ctx.stroke()
    }
    ctx.restore()
  }

  drawWateryWorldCanvasAssetLayers(ctx, width, height, seconds, quality)

  if (quality !== 'low') {
    const glowCount = quality === 'medium' ? 3 : 5
    for (let i = 0; i < glowCount; i += 1) {
      const gx = width * (0.12 + i * 0.19)
      const gy = ((seconds * (0.02 + i * 0.003) + i * 0.18) % 1) * height
      drawRadialEllipse2Stop(ctx, gx, gy, width * 0.13, height * 0.045, 'rgba(80,28,180,0.10)', 'rgba(0,0,0,0)')
    }
  }
  return

  const reefDefs = [
    { seed: 0.08, x: 0.18, ySeed: 0.04, speed: 0.034, w: 0.34, h: 0.12, rot: -8 * DEG, alpha: 0.46 },
    { seed: 0.55, x: 0.78, ySeed: 0.22, speed: 0.04, w: 0.26, h: 0.1, rot: 12 * DEG, alpha: 0.38 },
    { seed: 0.29, x: 0.48, ySeed: 0.46, speed: 0.03, w: 0.44, h: 0.14, rot: 3 * DEG, alpha: 0.34 },
    { seed: 0.72, x: 0.08, ySeed: 0.72, speed: 0.026, w: 0.3, h: 0.1, rot: 16 * DEG, alpha: 0.36 },
    { seed: 0.16, x: 0.68, ySeed: 0.86, speed: 0.032, w: 0.38, h: 0.13, rot: -14 * DEG, alpha: 0.42 },
  ]
  const reefCount = quality === 'medium' ? 3 : reefDefs.length
  for (let i = 0; i < reefCount; i += 1) {
    const reef = reefDefs[i]
    const reefW = width * reef.w
    const reefH = height * reef.h
    const x = width * reef.x + Math.sin(seconds * 0.22 + reef.seed * 10) * width * 0.035
    const y = ((seconds * reef.speed + reef.ySeed) % 1) * (height + reefH * 2) - reefH
    const points = getTopDownBlobPoints(x, y, reefW * 0.5, reefH * 0.5, reef.rot, reef.seed, 18)
    drawRadialEllipse2Stop(ctx, x, y + reefH * 0.12, reefW * 0.46, reefH * 0.32, 'rgba(2,0,10,0.58)', 'rgba(0,0,0,0)')
    ctx.save()
    ctx.globalAlpha = reef.alpha
    ctx.fillStyle = 'rgba(5,2,15,0.96)'
    drawCanvasBlob(ctx, points)
    ctx.fill()
    ctx.globalCompositeOperation = 'screen'
    ctx.strokeStyle = 'rgba(130,88,210,0.28)'
    ctx.lineWidth = 1.5
    drawCanvasBlob(ctx, points)
    ctx.stroke()
    ctx.restore()
    drawRadialEllipse2Stop(ctx, x, y, reefW * 0.24, reefH * 0.3, 'rgba(96,40,160,0.12)', 'rgba(0,0,0,0)')
  }

  if (quality !== 'low') {
    const glowCount = quality === 'medium' ? 3 : 5
    for (let i = 0; i < glowCount; i += 1) {
      const gx = width * (0.12 + i * 0.19)
      const gy = ((seconds * (0.02 + i * 0.003) + i * 0.18) % 1) * height
      drawRadialEllipse2Stop(ctx, gx, gy, width * 0.13, height * 0.045, 'rgba(80,28,180,0.10)', 'rgba(0,0,0,0)')
    }
  }
}

function drawTopDownVolcanicWorldSurface(ctx: CanvasRenderingContext2D, width: number, height: number, seconds: number, quality: GraphicsQuality) {
  const groundGrad = ctx.createLinearGradient(0, 0, 0, height)
  groundGrad.addColorStop(0, 'rgba(5,1,1,0.98)')
  groundGrad.addColorStop(0.36, 'rgba(24,6,3,0.98)')
  groundGrad.addColorStop(0.72, 'rgba(47,10,5,0.97)')
  groundGrad.addColorStop(1, 'rgba(12,2,1,0.99)')
  ctx.fillStyle = groundGrad
  ctx.fillRect(0, 0, width, height)

  const eruptPulse = 0.68 + Math.sin(seconds * 1.2) * 0.32
  drawRadialEllipse2Stop(ctx, width * 0.48, height * 0.38, width * 0.74, height * 0.34, `rgba(200,58,14,${0.14 * eruptPulse})`, 'rgba(0,0,0,0)')
  drawRadialEllipse2Stop(ctx, width * 0.5, height * 0.78, width * 0.88, height * 0.18, `rgba(255,96,26,${0.12 * eruptPulse})`, 'rgba(0,0,0,0)')

  drawVolcanicWorldCanvasAssetLayers(ctx, width, height, seconds, quality)

  if (quality !== 'low') {
    const emberCount = quality === 'medium' ? 10 : 20
    ctx.save()
    ctx.fillStyle = 'rgba(255,128,38,0.7)'
    for (let i = 0; i < emberCount; i += 1) {
      const px = ((i * 0.17 + i * i * 0.031) % 1) * width
      const py = ((seconds * (0.035 + i * 0.004) + i * 0.09) % 1) * height
      ctx.globalAlpha = 0.16 + (i % 4) * 0.045
      ctx.beginPath()
      ctx.arc(px, py, 1 + (i % 3) * 0.6, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }
}

export function drawWateryWorldSurface(ctx: CanvasRenderingContext2D, width: number, height: number, seconds: number, quality: GraphicsQuality) {
  drawTopDownWateryWorldSurface(ctx, width, height, seconds, quality)
  return

  const horizonY = height * 0.58

  // Full-screen eerie violet atmosphere sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height)
  skyGrad.addColorStop(0, 'rgba(2,1,8,0.97)')
  skyGrad.addColorStop(0.38, 'rgba(10,4,28,0.96)')
  skyGrad.addColorStop(0.64, 'rgba(22,8,58,0.94)')
  skyGrad.addColorStop(1, 'rgba(6,2,18,0.97)')
  ctx.fillStyle = skyGrad
  ctx.fillRect(0, 0, width, height)

  // Alien orb / moon with glow halo
  if (quality !== 'low') {
    const orbX = width * 0.78
    const orbY = height * 0.13
    const orbR = Math.min(width, height) * 0.055
    drawRadialEllipse2Stop(ctx, orbX, orbY, orbR * 5.5, orbR * 5.5, 'rgba(90,32,170,0.10)', 'rgba(0,0,0,0)')
    drawRadialEllipse2Stop(ctx, orbX, orbY, orbR * 2.6, orbR * 2.6, 'rgba(138,68,214,0.20)', 'rgba(0,0,0,0)')
    ctx.save()
    ctx.globalAlpha = 0.88
    ctx.fillStyle = 'rgba(168,108,232,0.90)'
    ctx.beginPath()
    ctx.arc(orbX, orbY, orbR, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // Atmospheric mist / fog layers drifting at different speeds
  const mistLayers = quality === 'low' ? 2 : quality === 'medium' ? 4 : 7
  for (let i = 0; i < mistLayers; i++) {
    const layerY = horizonY - height * (0.06 + i * 0.07)
    const speed = 0.0014 + i * 0.0004
    const offsetX = (((seconds * speed + i * 0.22) % 1) * (width * 2.6)) - width * 0.8
    const mistW = width * (0.58 + i * 0.10)
    const mistH = height * (0.10 + i * 0.016)
    const alpha = Math.max(0.04, 0.20 - i * 0.022)
    drawRadialEllipse2Stop(ctx, offsetX, layerY, mistW, mistH, `rgba(70,30,130,${alpha})`, 'rgba(0,0,0,0)')
    drawRadialEllipse2Stop(ctx, offsetX + mistW * 0.55, layerY + mistH * 0.08, mistW * 0.68, mistH * 0.62, `rgba(50,20,100,${alpha * 0.68})`, 'rgba(0,0,0,0)')
  }

  // Horizon atmospheric glow
  drawRadialEllipse2Stop(ctx, width * 0.5, horizonY, width * 1.3, height * 0.14, 'rgba(52,16,108,0.30)', 'rgba(0,0,0,0)')

  // Dark violet water surface
  const waterGrad = ctx.createLinearGradient(0, horizonY, 0, height)
  waterGrad.addColorStop(0, 'rgba(16,4,40,0.97)')
  waterGrad.addColorStop(0.5, 'rgba(8,2,22,0.98)')
  waterGrad.addColorStop(1, 'rgba(3,1,10,0.99)')
  ctx.fillStyle = waterGrad
  ctx.fillRect(0, horizonY, width, height - horizonY)

  // Animated water shimmer lines
  if (quality !== 'low') {
    const shimmerCount = quality === 'medium' ? 4 : 8
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    for (let i = 0; i < shimmerCount; i++) {
      const shimY = horizonY + height * (0.04 + i * 0.04)
      const phase = seconds * (0.08 + i * 0.015) + i * 0.38
      const shimX = width * 0.5 + Math.sin(phase) * width * 0.22
      const shimW = width * (0.26 + Math.cos(phase * 0.7) * 0.08)
      ctx.globalAlpha = 0.055 + Math.abs(Math.sin(phase)) * 0.04
      const shimmer = ctx.createLinearGradient(shimX - shimW, shimY, shimX + shimW, shimY)
      shimmer.addColorStop(0, 'rgba(0,0,0,0)')
      shimmer.addColorStop(0.5, 'rgba(120,60,200,0.9)')
      shimmer.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.strokeStyle = shimmer
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(shimX - shimW, shimY)
      ctx.lineTo(shimX + shimW, shimY)
      ctx.stroke()
    }
    ctx.restore()
  }

  // Island silhouettes in parallax layers (back → front)
  const islandDefs = [
    { seed: 0.08, speed: 0.0028, laneY: 0.05,  wScale: 0.52, hScale: 0.09,  alpha: 0.62 },
    { seed: 0.55, speed: 0.0034, laneY: 0.065, wScale: 0.44, hScale: 0.075, alpha: 0.56 },
    { seed: 0.29, speed: 0.0052, laneY: 0.12,  wScale: 0.68, hScale: 0.15,  alpha: 0.76 },
    { seed: 0.72, speed: 0.0048, laneY: 0.10,  wScale: 0.56, hScale: 0.13,  alpha: 0.70 },
    { seed: 0.16, speed: 0.0075, laneY: 0.21,  wScale: 0.88, hScale: 0.24,  alpha: 0.86 },
    { seed: 0.61, speed: 0.0068, laneY: 0.18,  wScale: 0.72, hScale: 0.20,  alpha: 0.80 },
  ]
  const islandCount = quality === 'low' ? 2 : quality === 'medium' ? 3 : islandDefs.length
  for (let i = 0; i < islandCount; i++) {
    const isl = islandDefs[i]
    const islW = width * isl.wScale
    const rawX = (((seconds * isl.speed + isl.seed) % 1) * (width + islW * 1.4)) - islW * 0.7
    const islY = horizonY + height * isl.laneY
    const islH = height * isl.hScale
    const dark = i < 2 ? 'rgba(12,6,24,0.93)' : 'rgba(6,2,14,0.96)'
    ctx.save()
    ctx.globalAlpha = isl.alpha
    ctx.fillStyle = dark
    ctx.beginPath()
    ctx.moveTo(rawX - islW * 0.5, islY)
    const numSeg = 10
    for (let p = 0; p <= numSeg; p++) {
      const t = p / numSeg
      const px = rawX - islW * 0.5 + islW * t
      const bump = Math.sin(t * Math.PI * 3.5 + isl.seed * 11) * 0.38 + Math.sin(t * Math.PI * 7.2 + isl.seed * 6.4) * 0.20
      ctx.lineTo(px, islY - islH * (0.5 + bump * 0.5))
    }
    ctx.lineTo(rawX + islW * 0.5, islY)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
    // Water shadow below island
    drawRadialEllipse2Stop(ctx, rawX, islY + islH * 0.65, islW * 0.46, islH * 0.18, 'rgba(2,0,8,0.88)', 'rgba(0,0,0,0)')
  }

  // Deep-water bioluminescent glow
  if (quality !== 'low') {
    const glowCount = quality === 'medium' ? 2 : 4
    for (let i = 0; i < glowCount; i++) {
      const gx = width * (0.16 + i * 0.23)
      const gy = horizonY + height * (0.34 + Math.sin(seconds * 0.4 + i * 1.2) * 0.06)
      drawRadialEllipse2Stop(ctx, gx, gy, width * 0.14, height * 0.05, 'rgba(72,18,158,0.11)', 'rgba(0,0,0,0)')
    }
  }
}

export function drawVolcanicWorldSurface(ctx: CanvasRenderingContext2D, width: number, height: number, seconds: number, quality: GraphicsQuality) {
  drawTopDownVolcanicWorldSurface(ctx, width, height, seconds, quality)
  return

  const horizonY = height * 0.55

  // Full-screen smoggy dark red-amber atmosphere
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height)
  skyGrad.addColorStop(0, 'rgba(3,1,1,0.97)')
  skyGrad.addColorStop(0.28, 'rgba(18,5,3,0.96)')
  skyGrad.addColorStop(0.64, 'rgba(56,14,8,0.94)')
  skyGrad.addColorStop(1, 'rgba(30,6,4,0.95)')
  ctx.fillStyle = skyGrad
  ctx.fillRect(0, 0, width, height)

  // Rolling ash cloud layers drifting across sky
  const ashCount = quality === 'low' ? 3 : quality === 'medium' ? 5 : 9
  for (let i = 0; i < ashCount; i++) {
    const speed = 0.0016 + i * 0.0006
    const ashX = (((seconds * speed + i * 0.13) % 1) * (width * 2.4)) - width * 0.7
    const ashY = height * (0.07 + i * 0.065)
    const ashW = width * (0.36 + (i % 3) * 0.14)
    const ashH = height * (0.10 + (i % 2) * 0.04)
    const ashAlpha = Math.max(0.05, 0.24 - i * 0.018)
    drawRadialEllipse2Stop(ctx, ashX, ashY, ashW, ashH, `rgba(38,16,10,${ashAlpha})`, 'rgba(0,0,0,0)')
    drawRadialEllipse2Stop(ctx, ashX + ashW * 0.32, ashY + ashH * 0.1, ashW * 0.62, ashH * 0.62, `rgba(26,10,6,${ashAlpha * 0.65})`, 'rgba(0,0,0,0)')
  }

  // Horizon eruption ambient glow (pulsing)
  const eruptPulse = 0.68 + Math.sin(seconds * 1.4) * 0.32
  drawRadialEllipse2Stop(ctx, width * 0.5, horizonY, width * 1.4, height * 0.20, `rgba(200,58,14,${0.24 * eruptPulse})`, 'rgba(0,0,0,0)')
  drawRadialEllipse2Stop(ctx, width * 0.5, horizonY, width * 0.85, height * 0.11, `rgba(255,96,26,${0.20 * eruptPulse})`, 'rgba(0,0,0,0)')

  // Dark rocky ground
  const groundGrad = ctx.createLinearGradient(0, horizonY, 0, height)
  groundGrad.addColorStop(0, 'rgba(22,6,4,0.97)')
  groundGrad.addColorStop(0.5, 'rgba(12,3,2,0.98)')
  groundGrad.addColorStop(1, 'rgba(5,1,1,0.99)')
  ctx.fillStyle = groundGrad
  ctx.fillRect(0, horizonY, width, height - horizonY)

  // Distant background volcanoes
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
    ctx.save()
    ctx.globalAlpha = 0.56
    ctx.fillStyle = 'rgba(16,5,3,0.92)'
    ctx.beginPath()
    ctx.moveTo(bx - vw * 0.5, baseY)
    ctx.lineTo(bx - vw * 0.06, baseY - vh)
    ctx.lineTo(bx + vw * 0.06, baseY - vh)
    ctx.lineTo(bx + vw * 0.5, baseY)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
    const pkPulse = 0.60 + Math.sin(seconds * 1.8 + v.x * 6.2) * 0.40
    drawRadialEllipse2Stop(ctx, bx, baseY - vh, vw * 0.32, height * 0.04, `rgba(255,88,18,${0.18 * pkPulse})`, 'rgba(0,0,0,0)')
  }

  // Large foreground volcanoes with smooth silhouette, crater glow, and lava flow
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
    ctx.save()
    ctx.globalAlpha = 0.90
    ctx.fillStyle = 'rgba(10,3,2,0.96)'
    ctx.beginPath()
    for (let p = 0; p <= numSeg; p++) {
      const t = p / numSeg
      const xOff = -vw * 0.5 * Math.pow(1 - t, 0.72)
      if (p === 0) ctx.moveTo(bx + xOff, baseY - vh * t)
      else ctx.lineTo(bx + xOff, baseY - vh * t)
    }
    for (let p = numSeg; p >= 0; p--) {
      const t = p / numSeg
      ctx.lineTo(bx + vw * 0.5 * Math.pow(1 - t, 0.72), baseY - vh * t)
    }
    ctx.closePath()
    ctx.fill()
    ctx.restore()
    // Crater peak glow
    const pkPulse = 0.55 + Math.sin(seconds * 1.6 + v.seed * 9.4) * 0.45
    drawRadialEllipse2Stop(ctx, bx, baseY - vh, vw * 0.42, height * 0.07, `rgba(255,128,28,${0.28 * pkPulse})`, 'rgba(0,0,0,0)')
    drawRadialEllipse2Stop(ctx, bx, baseY - vh + height * 0.008, vw * 0.16, height * 0.035, `rgba(255,200,60,${0.42 * pkPulse})`, 'rgba(0,0,0,0)')
    // Lava flow - glowing chain down the slope
    const flowSteps = 6
    for (let s = 0; s < flowSteps; s++) {
      const t = s / (flowSteps - 1)
      const fx = bx + vw * 0.5 * Math.pow(1 - t, 0.72) * 0.32
      const fy = baseY - vh * (1 - t * 0.92)
      const fa = (1 - t * 0.7) * 0.30 * pkPulse
      const fc = t < 0.35 ? `rgba(255,190,55,${fa * 2.2})` : t < 0.65 ? `rgba(255,90,22,${fa * 2.0})` : `rgba(180,32,10,${fa * 1.5})`
      drawRadialEllipse2Stop(ctx, fx, fy, vw * 0.04, height * 0.025, fc, 'rgba(0,0,0,0)')
    }
  }

  // Lava rivers / glowing pools across ground
  const lavaRiverCount = quality === 'low' ? 1 : quality === 'medium' ? 2 : 3
  for (let i = 0; i < lavaRiverCount; i++) {
    const riverY = horizonY + height * (0.16 + i * 0.13)
    const pulse = 0.72 + Math.sin(seconds * (0.6 + i * 0.2) + i * 2.1) * 0.28
    drawRadialEllipse2Stop(ctx, width * (0.5 + Math.sin(seconds * 0.18 + i * 0.9) * 0.06), riverY, width * 0.78, height * 0.065, `rgba(255,78,16,${0.20 * pulse})`, 'rgba(0,0,0,0)')
    drawRadialEllipse2Stop(ctx, width * (0.5 + Math.sin(seconds * 0.24 + i * 1.1) * 0.04), riverY, width * 0.44, height * 0.028, `rgba(255,162,38,${0.24 * pulse})`, 'rgba(0,0,0,0)')
  }

  // Falling ash particles
  if (quality !== 'low') {
    const ashPCount = quality === 'medium' ? 7 : 16
    ctx.save()
    ctx.fillStyle = 'rgba(58,22,14,0.6)'
    for (let i = 0; i < ashPCount; i++) {
      const px = ((i * 0.17 + i * i * 0.031) % 1) * width
      const py = ((seconds * (0.04 + i * 0.008) + i * 0.09) % 1) * horizonY
      ctx.globalAlpha = 0.28 + (i % 4) * 0.07
      ctx.beginPath()
      ctx.arc(px, py, 1.2 + (i % 3), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }
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

export function makeRaidLayerCanvas(width: number, height: number, dpr: number) {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(width * dpr))
  canvas.height = Math.max(1, Math.ceil(height * dpr))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { canvas, ctx }
}

export function drawRaidBackgroundBase(ctx: CanvasRenderingContext2D, palette: RaidPalette, width: number, height: number, quality: GraphicsQuality) {
  const { baseTop, baseMid, baseBottom, bgA, bgB } = palette
  const isLow = quality === 'low'
  const base = ctx.createLinearGradient(0, 0, 0, height)
  base.addColorStop(0, baseTop)
  base.addColorStop(0.45, baseMid)
  base.addColorStop(1, baseBottom)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, width, height)

  if (!isLow) {
    drawRadialEllipse2Stop(ctx, width * 0.18, height * 0.16, width * 0.24, height * 0.24, bgA, 'rgba(0,0,0,0)')
    drawRadialEllipse2Stop(ctx, width * 0.76, height * 0.38, width * 0.26, height * 0.26, bgB, 'rgba(0,0,0,0)')
  }
}

export function drawRaidBackgroundBaseLayer(ctx: CanvasRenderingContext2D, palette: RaidPalette, width: number, height: number, quality: GraphicsQuality, dpr: number) {
  if (typeof document === 'undefined') {
    drawRaidBackgroundBase(ctx, palette, width, height, quality)
    return
  }

  const key = getRaidBackgroundBaseCacheKey(palette, width, height, quality, dpr)
  if (!raidBackgroundBaseCache || raidBackgroundBaseCache.key !== key) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(width * dpr))
    canvas.height = Math.max(1, Math.floor(height * dpr))
    const baseCtx = canvas.getContext('2d')
    if (!baseCtx) {
      drawRaidBackgroundBase(ctx, palette, width, height, quality)
      return
    }
    baseCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawRaidBackgroundBase(baseCtx, palette, width, height, quality)
    raidBackgroundBaseCache = { key, canvas }
  }

  ctx.drawImage(raidBackgroundBaseCache.canvas, 0, 0, width, height)
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

export function drawScrollingBackgroundLayer(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, width: number, height: number, layerHeight: number, offset: number) {
  if (layerHeight <= 0) return
  const y = ((offset % layerHeight) + layerHeight) % layerHeight
  ctx.drawImage(canvas, 0, y, width, layerHeight)
  ctx.drawImage(canvas, 0, y - layerHeight, width, layerHeight)
  if (y < height) ctx.drawImage(canvas, 0, y + layerHeight, width, layerHeight)
}

export function getRaidStarfieldCache(width: number, height: number, quality: GraphicsQuality, dpr: number, starTint: string, streak: string) {
  const key = getRaidStarfieldCacheKey(width, height, quality, dpr, starTint, streak)
  if (raidStarfieldCache?.key === key) return raidStarfieldCache
  if (typeof document === 'undefined') return null

  const isLow = quality === 'low'
  const isMedium = quality === 'medium'
  const isHigh = quality === 'high'
  const starLimit = isLow ? 40 : isMedium ? 100 : isHigh ? 160 : BACKGROUND_STARS.length
  const farLayerHeight = height * 1.26
  const nearLayerHeight = height * 1.38
  const farLayer = makeRaidLayerCanvas(width, farLayerHeight, dpr)
  if (!farLayer) return null

  for (let index = 0; index < starLimit; index += 1) {
    const star = BACKGROUND_STARS[index]
    const x = star.x * width
    const y = star.y * farLayerHeight
    farLayer.ctx.globalAlpha = star.alpha * 0.52
    farLayer.ctx.fillStyle = star.tint > 0.66 ? starTint : star.tint > 0.33 ? 'rgba(125,211,252,0.55)' : 'rgba(255,255,255,0.76)'
    farLayer.ctx.beginPath()
    farLayer.ctx.arc(x, y, star.size * 0.62, 0, Math.PI * 2)
    farLayer.ctx.fill()
  }

  let nearTrailCanvas: HTMLCanvasElement | null = null
  if (!isLow && !isMedium) {
    const nearLayer = makeRaidLayerCanvas(width, nearLayerHeight, dpr)
    if (nearLayer) {
      for (let index = 0; index < starLimit; index += 1) {
        const star = BACKGROUND_STARS[index]
        if (!shouldDrawRaidStarTrail(star, index, quality)) continue
        const x = star.x * width
        const y = star.y * nearLayerHeight
        nearLayer.ctx.globalAlpha = star.alpha * 0.26
        const trail = nearLayer.ctx.createLinearGradient(x, y - 14, x, y + 22)
        trail.addColorStop(0, 'rgba(255,255,255,0)')
        trail.addColorStop(0.46, star.tint > 0.78 ? streak : 'rgba(255,255,255,0.36)')
        trail.addColorStop(1, 'rgba(255,255,255,0)')
        nearLayer.ctx.strokeStyle = trail
        nearLayer.ctx.lineWidth = Math.max(1, star.size * 0.65)
        nearLayer.ctx.beginPath()
        nearLayer.ctx.moveTo(x, y - 14)
        nearLayer.ctx.lineTo(x, y + 22)
        nearLayer.ctx.stroke()
      }
      nearTrailCanvas = nearLayer.canvas
    }
  }

  raidStarfieldCache = {
    key,
    farCanvas: farLayer.canvas,
    farLayerHeight,
    nearTrailCanvas,
    nearLayerHeight,
  }
  return raidStarfieldCache
}

export function drawRaidStarfield(ctx: CanvasRenderingContext2D, width: number, height: number, seconds: number, quality: GraphicsQuality, dpr: number, starTint: string, streak: string, stageTheme: number) {
  const cache = getRaidStarfieldCache(width, height, quality, dpr, starTint, streak)
  if (!cache) return false
  const drawTrails = shouldDrawRaidStarTrails(stageTheme)
  const starSpeedScale = getRaidStarfieldSpeedScale(stageTheme)

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  drawScrollingBackgroundLayer(ctx, cache.farCanvas, width, height, cache.farLayerHeight, seconds * (15 * starSpeedScale) - height * 0.13)
  if (drawTrails && cache.nearTrailCanvas) {
    drawScrollingBackgroundLayer(ctx, cache.nearTrailCanvas, width, height, cache.nearLayerHeight, seconds * (72 * starSpeedScale) - height * 0.19)
  }
  ctx.restore()
  return true
}

export function drawRaidBackground(ctx: CanvasRenderingContext2D, palette: RaidPalette, width: number, height: number, time: number, quality: GraphicsQuality = 'max', stageTheme = 1, dpr = 1) {
  const seconds = time / 1000
  const { baseMid, nebulaA, nebulaB, starTint, streak } = palette
  const isLow = quality === 'low'
  const isMedium = quality === 'medium'
  const isHigh = quality === 'high'
  const isSurfaceStage = shouldDrawRaidSurfaceStage(stageTheme)
  const drawStars = shouldDrawRaidStars(stageTheme)
  const drawGalaxies = shouldDrawRaidGalaxies(stageTheme)
  const scene = getRaidBackgroundScene(stageTheme)

  drawRaidBackgroundBaseLayer(ctx, palette, width, height, quality, dpr)

  if (!isLow && drawGalaxies) {
    ctx.save()
    const nebulaDrift = Math.sin(seconds / 10)
    const nebulaScaleX = scene.nebulaScale * (1 + 0.035 * (0.5 + Math.sin(seconds / 7) * 0.5))
    const nebulaScaleY = scene.nebulaScale * (1 + 0.025 * (0.5 + Math.cos(seconds / 9) * 0.5))
    ctx.translate(width * 0.012 * nebulaDrift, height * 0.006 * Math.cos(seconds / 8))
    drawRadialEllipse2Stop(ctx, width * (0.2 + scene.nebulaShiftX * 0.42), height * (0.72 + scene.nebulaShiftY * 0.38), width * 0.36 * nebulaScaleX, height * 0.24 * nebulaScaleY, nebulaA, 'rgba(0,0,0,0)')
    drawRadialEllipse2Stop(ctx, width * (0.82 - scene.nebulaShiftX * 0.28), height * (0.24 - scene.nebulaShiftY * 0.24), width * 0.32 * nebulaScaleX, height * 0.22 * nebulaScaleY, nebulaB, 'rgba(0,0,0,0)')
    ctx.restore()
  }

  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  if (!isLow) {
    drawRadialEllipse2Stop(ctx, width * 0.78, height * 0.18, width * 0.48, height * 0.25, 'rgba(139,92,246,0.2)', 'rgba(0,0,0,0)')
    drawRadialEllipse2Stop(ctx, width * 0.14, height * 0.68, width * 0.36, height * 0.42, 'rgba(59,130,246,0.16)', 'rgba(0,0,0,0)')
    if (!isMedium) {
      drawRadialEllipse2Stop(ctx, width * 0.48, height * 0.42, width * 0.22, height * 0.18, 'rgba(236,72,153,0.11)', 'rgba(0,0,0,0)')
      drawRadialEllipse2Stop(ctx, width * 0.22, height * 0.22, width * 0.26, height * 0.15, 'rgba(251,191,36,0.05)', 'rgba(0,0,0,0)')
      drawRadialEllipse2Stop(ctx, width * 0.88, height * 0.72, width * 0.18, height * 0.32, 'rgba(34,211,238,0.06)', 'rgba(0,0,0,0)')
    }
  }
  ctx.restore()

  if (!isLow) {
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    const galaxyDrift = Math.sin(seconds / 18)
    const galaxyLimit = isMedium ? 1 : scene.galaxies.length
    for (let index = 0; index < galaxyLimit; index += 1) {
      const galaxy = scene.galaxies[index]
      const galaxySprite = getRaidOtherCanvasSprite(galaxy.asset)
      drawCanvasImageContain(
        ctx,
        galaxySprite,
        width * galaxy.x + galaxyDrift * width * galaxy.driftX,
        height * galaxy.y + Math.cos(seconds / 22) * height * galaxy.driftY,
        width * galaxy.width * scene.galaxyScale * (isMedium ? 0.82 : 1),
        height * galaxy.height * scene.galaxyScale * (isMedium ? 0.82 : 1),
        galaxy.filter,
        galaxy.alpha * (isMedium ? 0.78 : 1),
        galaxy.rotation,
      )
    }
    ctx.restore()
  }

  const drewCachedStarfield = drawStars
    ? drawRaidStarfield(ctx, width, height, seconds, quality, dpr, starTint, streak, stageTheme)
    : false

  if (!isLow && shouldDrawRaidBattleOverlay(stageTheme)) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const speedLineLimit = isMedium ? 2 : BACKGROUND_SPEED_LINES.length
    for (let index = 0; index < speedLineLimit; index += 1) {
      const line = BACKGROUND_SPEED_LINES[index]
      const lineColor =
        line.color === 'streak' ? streak :
          line.color === 'red' ? 'rgba(239,35,60,0.42)' :
            line.color === 'cyan' ? 'rgba(125,211,252,0.28)' :
              'rgba(255,255,255,0.26)'
      const y = (((seconds + line.delay) / 0.75) % 1) * height * 1.5 - height * 0.2
      const x = line.x * width
      const sprite = getCachedSpeedLineSprite(lineColor, line.length, line.width)
      ctx.globalAlpha = 0.36
      if (sprite) {
        ctx.drawImage(sprite.canvas, x - sprite.originX, y - sprite.originY, sprite.width, sprite.height)
      } else {
        const gradient = ctx.createLinearGradient(x, y, x, y + line.length)
        gradient.addColorStop(0, 'rgba(255,255,255,0)')
        gradient.addColorStop(0.46, lineColor)
        gradient.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.strokeStyle = gradient
        ctx.lineWidth = line.width
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x, y + line.length)
        ctx.stroke()
      }
    }
    ctx.restore()
  }

  if (drawStars && !drewCachedStarfield) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const starSpeedScale = getRaidStarfieldSpeedScale(stageTheme)
    const starLimit = isLow ? 40 : isMedium ? 100 : isHigh ? 160 : BACKGROUND_STARS.length
    for (let index = 0; index < starLimit; index += 1) {
      const star = BACKGROUND_STARS[index]
      const farY = ((star.y * height * 1.26 + seconds * (15 * starSpeedScale)) % (height * 1.26)) - height * 0.13
      const nearY = ((star.y * height * 1.38 + seconds * (72 * starSpeedScale)) % (height * 1.38)) - height * 0.19
      const x = star.x * width
      ctx.globalAlpha = star.alpha * 0.52
      ctx.fillStyle = star.tint > 0.66 ? starTint : star.tint > 0.33 ? 'rgba(125,211,252,0.55)' : 'rgba(255,255,255,0.76)'
      ctx.beginPath()
      ctx.arc(x, farY, star.size * 0.62, 0, Math.PI * 2)
      ctx.fill()

      if (shouldDrawRaidStarTrails(stageTheme) && shouldDrawRaidStarTrail(star, index, quality)) {
        ctx.globalAlpha = star.alpha * 0.26
        const trail = ctx.createLinearGradient(x, nearY - 14, x, nearY + 22)
        trail.addColorStop(0, 'rgba(255,255,255,0)')
        trail.addColorStop(0.46, star.tint > 0.78 ? streak : 'rgba(255,255,255,0.36)')
        trail.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.strokeStyle = trail
        ctx.lineWidth = Math.max(1, star.size * 0.65)
        ctx.beginPath()
        ctx.moveTo(x, nearY - 14)
        ctx.lineTo(x, nearY + 22)
        ctx.stroke()
      }
    }
    ctx.restore()
  }

  if (!isLow) {
    if (isSurfaceStage) {
      if (isWateryWorldTheme(stageTheme)) {
        drawWateryWorldSurface(ctx, width, height, seconds, quality)
      } else if (isVolcanicWorldTheme(stageTheme)) {
        drawVolcanicWorldSurface(ctx, width, height, seconds, quality)
      } else {
        drawPlanetSurface(ctx, palette, width, height, seconds, quality)
      }
    }
    ctx.save()
    ctx.globalAlpha = 1
    const planetLimit = isWateryWorldTheme(stageTheme) || isVolcanicWorldTheme(stageTheme)
      ? 0
      : isMedium
        ? Math.min(2, scene.planets.length)
        : scene.planets.length
    for (let index = 0; index < planetLimit; index += 1) {
      const planet = scene.planets[index]
      const planetSprite = getRaidOtherCanvasSprite(planet.asset)
      const radius = getRaidScenePlanetRadius(Math.min(width, height), scene, planet, stageTheme, Math.min(index, 2))
      const planetY = getRaidScenePlanetY(planet, height, seconds, radius * 2)
      const size = radius * getRaidScenePlanetDrawScale(planet.asset)
      const rotation = planet.rotation + seconds * planet.spin
      if (!drawCanvasImageContain(ctx, planetSprite, width * planet.x, planetY, size, size, planet.filter, getRaidScenePlanetAlpha(planet), rotation)) {
        const color = getRaidScenePlanetFallbackColor(palette, planet)
        drawRadialEllipse(ctx, width * planet.x, planetY, radius, radius, [[0, '#f9fafb'], [0.55, color], [1, baseMid]])
      }
    }
    const suppressSpaceDebris = isWateryWorldTheme(stageTheme) || isVolcanicWorldTheme(stageTheme)
    const wreckLimit = suppressSpaceDebris ? 0 : isMedium ? Math.min(1, scene.wrecks.length) : scene.wrecks.length
    for (let index = 0; index < wreckLimit; index += 1) {
      const wreck = scene.wrecks[index]
      const wreckSprite = getDerelictWreckCanvasSprite(wreck.variant)
      const position = getRaidSceneWreckPosition(width, height, seconds, wreck)
      drawCanvasImageContain(
        ctx,
        wreckSprite,
        position.x,
        position.y,
        position.width,
        position.height,
        RAID_DERELICT_WRECK_FILTER,
        wreck.alpha,
        wreck.rotation + seconds * wreck.spin,
      )
    }
    const scenicLimit = isMedium ? Math.min(1, scene.scenic.length) : scene.scenic.length
    for (let index = 0; index < scenicLimit; index += 1) {
      const scenic = scene.scenic[index]
      const scenicSprite = getRaidOtherCanvasSprite(scenic.asset)
      const position = getRaidSceneScenicPosition(width, height, seconds, scenic, index)
      drawCanvasImageContain(
        ctx,
        scenicSprite,
        position.x,
        position.y,
        position.width,
        position.height,
        scenic.filter,
        scenic.alpha,
        scenic.rotation + seconds * scenic.spin,
      )
    }
    ctx.restore()
  }

  if (!isLow) {
    const density = (isWateryWorldTheme(stageTheme) || isVolcanicWorldTheme(stageTheme)) ? 0 : getRaidBackgroundObjectDensity(stageTheme)
    const asteroidCap = isMedium ? 3 : BACKGROUND_ASTEROIDS.length
    const debrisCap = isMedium ? 3 : BACKGROUND_DEBRIS.length
    const asteroidLimit = Math.max(0, Math.min(asteroidCap, Math.round(asteroidCap * density)))
    const debrisLimit = Math.max(0, Math.min(debrisCap, Math.round(debrisCap * density)))
    const asteroidSprite = getRaidOtherCanvasSprite('asteroid')
    for (let index = 0; index < asteroidLimit; index += 1) {
      const asteroid = BACKGROUND_ASTEROIDS[index]
      const y = ((seconds * asteroid.speed + asteroid.delay / 22 + 1) % 1) * height * 1.15 - height * 0.05
      drawCanvasImageContain(ctx, asteroidSprite, width * asteroid.x, y, asteroid.width * 1.5 * scene.asteroidBias, asteroid.height * 1.5 * scene.asteroidBias, 'brightness(0.86) contrast(1.16) saturate(0.9)', asteroid.alpha, seconds * asteroid.spin * DEG / 10)
    }
    for (let index = 0; index < debrisLimit; index += 1) {
      const debris = BACKGROUND_DEBRIS[index]
      const y = ((seconds * debris.speed + debris.delay / 48 + 1) % 1) * height * 1.2 - height * 0.05
      drawCanvasImageContain(ctx, asteroidSprite, width * debris.x, y, debris.width * 1.35 * scene.debrisBias, debris.height * 1.35 * scene.debrisBias, 'brightness(0.86) contrast(1.16) saturate(0.9)', debris.alpha, seconds * debris.spin * DEG / 12)
    }

    if (!isMedium && density >= 0.95) {
      const clusterY1 = ((seconds / 16 + 0.56) % 1) * height * 1.15 - height * 0.04
      const clusterY2 = ((seconds / 24 + 0.25) % 1) * height * 1.15 - height * 0.04
      drawCanvasImageContain(ctx, asteroidSprite, width * 0.44, clusterY1, 24 * scene.asteroidBias, 18 * scene.asteroidBias, 'brightness(0.86) contrast(1.16) saturate(0.9)', 0.24, seconds * 0.3)
      drawCanvasImageContain(ctx, asteroidSprite, width * 0.44 + 22, clusterY1 + 14, 15 * scene.asteroidBias, 12 * scene.asteroidBias, 'brightness(0.86) contrast(1.16) saturate(0.9)', 0.2, -seconds * 0.2)
      drawCanvasImageContain(ctx, asteroidSprite, width * 0.72, clusterY2, 30 * scene.asteroidBias, 24 * scene.asteroidBias, 'brightness(0.86) contrast(1.16) saturate(0.9)', 0.22, -seconds * 0.18)
      drawCanvasImageContain(ctx, asteroidSprite, width * 0.72 + 24, clusterY2 + 18, 18 * scene.asteroidBias, 13.5 * scene.asteroidBias, 'brightness(0.86) contrast(1.16) saturate(0.9)', 0.18, seconds * 0.18)
    }
  }

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  if (!isLow && !isMedium && shouldDrawRaidBattleOverlay(stageTheme)) {
    const laserY1 = ((seconds / 6 + 0.67) % 1) * height * 1.15 - height * 0.08
    const laserY2 = ((seconds / 9 + 0.32) % 1) * height * 1.15 - height * 0.06
    const drawLaser = (x: number, y: number, length: number, rotation: number, color: string, widthPx: number) => {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rotation)
      const gradient = ctx.createLinearGradient(0, -length / 2, 0, length / 2)
      gradient.addColorStop(0, 'rgba(255,255,255,0)')
      gradient.addColorStop(0.5, color)
      gradient.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.strokeStyle = gradient
      ctx.lineWidth = widthPx
      ctx.shadowBlur = 10
      ctx.shadowColor = color
      ctx.beginPath()
      ctx.moveTo(0, -length / 2)
      ctx.lineTo(0, length / 2)
      ctx.stroke()
      ctx.restore()
    }
    drawLaser(width * 0.38, laserY1, 80, -4 * DEG, 'rgba(239,35,60,0.72)', 2)
    drawLaser(width * 0.66, laserY2, 56, 12 * DEG, 'rgba(34,211,238,0.52)', 1.5)

    const drawExplosion = (x: number, y: number, period: number, offset: number, radius: number, alpha: number) => {
      const cycle = ((seconds + offset) % period) / period
      const pulse = cycle < 0.42 ? Math.sin((cycle / 0.42) * Math.PI) : 0
      if (pulse <= 0) return
      drawRadialEllipse(ctx, x, y, radius * (0.6 + pulse * 1.4), radius * (0.6 + pulse * 1.4), [
        [0, `rgba(255,255,255,${0.45 * pulse * alpha})`],
        [0.32, `rgba(251,191,36,${0.48 * pulse * alpha})`],
        [0.64, `rgba(239,35,60,${0.32 * pulse * alpha})`],
        [1, 'rgba(0,0,0,0)'],
      ])
    }
    drawExplosion(width * 0.08, height * 0.18, 7, 4, 32, 0.9)
    drawExplosion(width * 0.9, height * 0.44, 11, 2, 24, 0.75)
  }
  ctx.restore()
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
  private readonly wateryIslandSprites = WATERY_WORLD_ISLAND_LAYERS.map(() => new Sprite(Texture.WHITE))
  private readonly wateryCloudSprites = WATERY_WORLD_CLOUD_LAYERS.map(() => new Sprite(Texture.WHITE))
  private readonly volcanicIslandSprites = VOLCANIC_WORLD_ISLAND_LAYERS.map(() => new Sprite(Texture.WHITE))
  private readonly volcanicCloudSprites = VOLCANIC_WORLD_CLOUD_LAYERS.map(() => new Sprite(Texture.WHITE))
  private readonly cometFlybySprite = new Sprite(Texture.WHITE)
  private readonly asteroidSprites = BACKGROUND_ASTEROIDS.map(() => new Sprite(Texture.WHITE))
  private readonly debrisSprites = BACKGROUND_DEBRIS.map(() => new Sprite(Texture.WHITE))
  private readonly explosionGraphics = new Graphics()
  private readonly assetTextures = new Map<PixiRaidAssetKey, Texture>()
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
      this.scene.addChild(this.speedLineGraphics)
      this.scene.addChild(this.surfaceGraphics)
      this.wateryIslandSprites.forEach((sprite) => this.scene.addChild(sprite))
      this.wateryCloudSprites.forEach((sprite) => this.scene.addChild(sprite))
      this.volcanicIslandSprites.forEach((sprite) => this.scene.addChild(sprite))
      this.volcanicCloudSprites.forEach((sprite) => this.scene.addChild(sprite))
      this.planetSprites.forEach((sprite) => this.scene.addChild(sprite))
      this.wreckSprites.forEach((sprite) => this.scene.addChild(sprite))
      this.scenicSprites.forEach((sprite) => this.scene.addChild(sprite))
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
      const { width, height, dpr, palette, quality, stageTheme, time, stageRush, bossIntensity, devilCorruption } = frame
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
    const allowBattleOverlay = shouldDrawRaidBattleOverlay(stageTheme)
    graphics.visible = !isLow && allowBattleOverlay
    if (isLow || !allowBattleOverlay) return

    const speedLineLimit = isMedium ? 2 : BACKGROUND_SPEED_LINES.length
    for (let index = 0; index < speedLineLimit; index += 1) {
      const line = BACKGROUND_SPEED_LINES[index]
      const y = (((seconds + line.delay) / 0.75) % 1) * height * 1.5 - height * 0.2
      const lineColor =
        line.color === 'streak' ? streak :
          line.color === 'red' ? 'rgba(239,35,60,0.42)' :
            line.color === 'cyan' ? 'rgba(125,211,252,0.28)' :
              'rgba(255,255,255,0.26)'
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

    const currentCount = isMedium ? 9 : 15
    for (let i = 0; i < currentCount; i += 1) {
      const seed = seededNoise(i + 41, 18)
      const x = width * (0.08 + seededNoise(i + 17, 22) * 0.84)
      const y = ((seconds * (0.018 + seed * 0.018) + seed) % 1) * (height * 1.24) - height * 0.12
      const drift = Math.sin(seconds * 0.45 + i * 1.7) * width * 0.025
      const lineH = height * (0.08 + seededNoise(i + 8, 3) * 0.09)
      const stroke = getPixiFill(i % 3 === 0 ? 'rgba(160,90,230,0.9)' : 'rgba(90,210,230,0.68)', 0.035 + seededNoise(i + 12, 5) * 0.045)
      graphics.moveTo(x, y)
      graphics.lineTo(x + drift * 0.6, y + lineH * 0.35)
      graphics.lineTo(x - drift * 0.28, y + lineH * 0.72)
      graphics.lineTo(x + drift * 0.24, y + lineH)
      graphics.stroke({ color: stroke.color, alpha: stroke.alpha, width: 1 + seededNoise(i + 3, 11) * 1.4, cap: 'round', join: 'round' })
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
      const sprite = this.wateryIslandSprites[index]
      const layer = WATERY_WORLD_ISLAND_LAYERS[index]
      const texture = this.assetTextures.get(layer.asset)
      const visible = Boolean(texture && index < islandCount)
      sprite.visible = visible
      if (!texture || !visible) continue
      const drawSize = Math.min(width, height) * layer.size
      const x = width * layer.x + Math.sin(seconds * 0.16 + index * 2.2) * width * layer.drift
      const y = getWaterySurfaceLayerY(seconds, height, WATERY_WORLD_ISLAND_SCROLL_SPEED, layer.ySeed, drawSize)
      setPixiSpriteContain(sprite, texture, x, y, drawSize, drawSize, layer.alpha, layer.rotation + Math.sin(seconds * 0.05 + index) * 2 * DEG)
      sprite.tint = 0xd8c8ff
    }

    const cloudCount = quality === 'medium' ? 2 : WATERY_WORLD_CLOUD_LAYERS.length
    for (let index = 0; index < WATERY_WORLD_CLOUD_LAYERS.length; index += 1) {
      const sprite = this.wateryCloudSprites[index]
      const layer = WATERY_WORLD_CLOUD_LAYERS[index]
      const texture = this.assetTextures.get(layer.asset)
      const visible = Boolean(texture && index < cloudCount)
      sprite.visible = visible
      if (!texture || !visible) continue
      const drawWidth = width * layer.width
      const drawHeight = height * layer.height
      const x = width * layer.x + Math.sin(seconds * 0.18 + index * 1.9) * width * layer.drift
      const y = getWaterySurfaceLayerY(seconds, height, layer.speed, layer.ySeed, drawHeight)
      setPixiSpriteContain(sprite, texture, x, y, drawWidth, drawHeight, layer.alpha, layer.rotation + Math.sin(seconds * 0.08 + index) * 1.5 * DEG)
      sprite.tint = 0xffffff
    }
  }

  private updateVolcanicWorldAssetSprites(width: number, height: number, seconds: number, quality: GraphicsQuality) {
    const islandCount = quality === 'medium' ? 3 : VOLCANIC_WORLD_ISLAND_LAYERS.length
    for (let index = 0; index < VOLCANIC_WORLD_ISLAND_LAYERS.length; index += 1) {
      const sprite = this.volcanicIslandSprites[index]
      const layer = VOLCANIC_WORLD_ISLAND_LAYERS[index]
      const texture = this.assetTextures.get(layer.asset)
      const visible = Boolean(texture && index < islandCount)
      sprite.visible = visible
      if (!texture || !visible) continue
      const drawSize = Math.min(width, height) * layer.size
      const x = width * layer.x + Math.sin(seconds * 0.15 + index * 2.1) * width * layer.drift
      const y = getWaterySurfaceLayerY(seconds, height, VOLCANIC_WORLD_ISLAND_SCROLL_SPEED, layer.ySeed, drawSize)
      setPixiSpriteContain(sprite, texture, x, y, drawSize, drawSize, layer.alpha, layer.rotation + Math.sin(seconds * 0.05 + index) * 1.6 * DEG)
      sprite.tint = 0xffd6c0
    }

    const cloudCount = quality === 'medium' ? 2 : VOLCANIC_WORLD_CLOUD_LAYERS.length
    for (let index = 0; index < VOLCANIC_WORLD_CLOUD_LAYERS.length; index += 1) {
      const sprite = this.volcanicCloudSprites[index]
      const layer = VOLCANIC_WORLD_CLOUD_LAYERS[index]
      const texture = this.assetTextures.get(layer.asset)
      const visible = Boolean(texture && index < cloudCount)
      sprite.visible = visible
      if (!texture || !visible) continue
      const drawWidth = width * layer.width
      const drawHeight = height * layer.height
      const x = width * layer.x + Math.sin(seconds * 0.17 + index * 1.8) * width * layer.drift
      const y = getWaterySurfaceLayerY(seconds, height, layer.speed, layer.ySeed, drawHeight)
      setPixiSpriteContain(sprite, texture, x, y, drawWidth, drawHeight, layer.alpha, layer.rotation + Math.sin(seconds * 0.07 + index) * 1.4 * DEG)
      sprite.tint = 0xffffff
    }
  }

  private updateTopDownVolcanicWorldSurface(graphics: Graphics, width: number, height: number, seconds: number, quality: GraphicsQuality) {
    const isMedium = quality === 'medium'
    const groundGrad = this.getGradient('topdown-volcanic-ground', {
      type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: parsePixiCssColor('rgba(5,1,1,0.98)').source },
        { offset: 0.36, color: parsePixiCssColor('rgba(24,6,3,0.98)').source },
        { offset: 0.72, color: parsePixiCssColor('rgba(47,10,5,0.97)').source },
        { offset: 1, color: parsePixiCssColor('rgba(12,2,1,0.99)').source },
      ],
    })
    graphics.rect(0, 0, width, height).fill({ fill: groundGrad, alpha: 1 })

    const eruptPulse = 0.68 + Math.sin(seconds * 1.2) * 0.32
    this.fillRadial(graphics, width * 0.48, height * 0.38, width * 0.74, height * 0.34, `rgba(200,58,14,${0.14 * eruptPulse})`, 'rgba(0,0,0,0)')
    this.fillRadial(graphics, width * 0.5, height * 0.78, width * 0.88, height * 0.18, `rgba(255,96,26,${0.12 * eruptPulse})`, 'rgba(0,0,0,0)')

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

      // Full-screen eerie violet atmosphere sky — covers all layers below
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
        this.fillRadial(graphics, offsetX, layerY, mistW, mistH, `rgba(70,30,130,${alpha})`, 'rgba(0,0,0,0)')
        this.fillRadial(graphics, offsetX + mistW * 0.55, layerY + mistH * 0.08, mistW * 0.68, mistH * 0.62, `rgba(50,20,100,${alpha * 0.68})`, 'rgba(0,0,0,0)')
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

      // Island silhouettes — parallax layers (back → front, larger and jagged)
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
        // Bumpy ridgeline using poly — shape is deterministic (seed-only, not time-based)
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
        this.fillRadial(graphics, ashX, ashY, ashW, ashH, `rgba(38,16,10,${ashAlpha})`, 'rgba(0,0,0,0)')
        this.fillRadial(graphics, ashX + ashW * 0.32, ashY + ashH * 0.1, ashW * 0.62, ashH * 0.62, `rgba(26,10,6,${ashAlpha * 0.65})`, 'rgba(0,0,0,0)')
      }

      // Horizon eruption ambient glow (pulsing)
      const eruptPulse = 0.68 + Math.sin(seconds * 1.4) * 0.32
      this.fillRadial(graphics, width * 0.5, horizonY, width * 1.4, height * 0.20, `rgba(200,58,14,${0.24 * eruptPulse})`, 'rgba(0,0,0,0)')
      this.fillRadial(graphics, width * 0.5, horizonY, width * 0.85, height * 0.11, `rgba(255,96,26,${0.20 * eruptPulse})`, 'rgba(0,0,0,0)')

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
        this.fillRadial(graphics, bx, baseY - vh, vw * 0.32, height * 0.04, `rgba(255,88,18,${0.18 * pkPulse})`, 'rgba(0,0,0,0)')
      }

      // Large foreground volcanoes — smooth convex profile, crater glow, lava flow
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
        this.fillRadial(graphics, bx, baseY - vh, vw * 0.42, height * 0.07, `rgba(255,128,28,${0.28 * pkPulse})`, 'rgba(0,0,0,0)')
        this.fillRadial(graphics, bx, baseY - vh + height * 0.008, vw * 0.16, height * 0.035, `rgba(255,200,60,${0.42 * pkPulse})`, 'rgba(0,0,0,0)')
        // Lava flow — glowing chain of radial glows down slope
        const flowSteps = 6
        for (let s = 0; s < flowSteps; s++) {
          const t = s / (flowSteps - 1)
          const fx = bx + vw * 0.5 * Math.pow(1 - t, 0.72) * 0.32
          const fy = baseY - vh * (1 - t * 0.92)
          const fa = (1 - t * 0.7) * 0.30 * pkPulse
          const fc = t < 0.35 ? `rgba(255,190,55,${fa * 2.2})` : t < 0.65 ? `rgba(255,90,22,${fa * 2.0})` : `rgba(180,32,10,${fa * 1.5})`
          this.fillRadial(graphics, fx, fy, vw * 0.04, height * 0.025, fc, 'rgba(0,0,0,0)')
        }
      }

      // Lava rivers / glowing pools across ground
      const lavaRiverCount = isMedium ? 2 : 3
      for (let i = 0; i < lavaRiverCount; i++) {
        const riverY = horizonY + height * (0.16 + i * 0.13)
        const pulse = 0.72 + Math.sin(seconds * (0.6 + i * 0.2) + i * 2.1) * 0.28
        this.fillRadial(graphics, width * (0.5 + Math.sin(seconds * 0.18 + i * 0.9) * 0.06), riverY, width * 0.78, height * 0.065, `rgba(255,78,16,${0.20 * pulse})`, 'rgba(0,0,0,0)')
        this.fillRadial(graphics, width * (0.5 + Math.sin(seconds * 0.24 + i * 1.1) * 0.04), riverY, width * 0.44, height * 0.028, `rgba(255,162,38,${0.24 * pulse})`, 'rgba(0,0,0,0)')
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
