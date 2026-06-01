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

export const RAID_BACKGROUND_MAX_WRECKS = RAID_BACKGROUND_SCENES.reduce((max, scene) => Math.max(max, scene.wrecks.length), 0)

export function getRaidPlanetDepthScale(stageTheme: number, planetIndex: number) {
  const stageIndex = (((Math.floor(stageTheme) - 1) % RAID_PLANET_DEPTH_SCALES.length) + RAID_PLANET_DEPTH_SCALES.length) % RAID_PLANET_DEPTH_SCALES.length
  return RAID_PLANET_DEPTH_SCALES[stageIndex][planetIndex] ?? 1
}

export function getRaidBackgroundScene(stageTheme: number) {
  const index = (((Math.floor(stageTheme) - 1) % RAID_BACKGROUND_SCENES.length) + RAID_BACKGROUND_SCENES.length) % RAID_BACKGROUND_SCENES.length
  return RAID_BACKGROUND_SCENES[index]
}

export function getRaidScenePlanetY(layer: RaidBackgroundPlanetLayer, height: number, seconds: number) {
  return ((seconds / layer.speed + layer.yOffset) % 1) * height * 1.34 - height * 0.16
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

export function drawRaidStarfield(ctx: CanvasRenderingContext2D, width: number, height: number, seconds: number, quality: GraphicsQuality, dpr: number, starTint: string, streak: string) {
  const cache = getRaidStarfieldCache(width, height, quality, dpr, starTint, streak)
  if (!cache) return false

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  drawScrollingBackgroundLayer(ctx, cache.farCanvas, width, height, cache.farLayerHeight, seconds * 15 - height * 0.13)
  if (cache.nearTrailCanvas) {
    drawScrollingBackgroundLayer(ctx, cache.nearTrailCanvas, width, height, cache.nearLayerHeight, seconds * 72 - height * 0.19)
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
  const isSurfaceStage = stageTheme % 2 === 0
  const scene = getRaidBackgroundScene(stageTheme)

  drawRaidBackgroundBaseLayer(ctx, palette, width, height, quality, dpr)

  if (!isLow) {
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

  const drewCachedStarfield = drawRaidStarfield(ctx, width, height, seconds, quality, dpr, starTint, streak)

  if (!isLow) {
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

  if (!drewCachedStarfield) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const starLimit = isLow ? 40 : isMedium ? 100 : isHigh ? 160 : BACKGROUND_STARS.length
    for (let index = 0; index < starLimit; index += 1) {
      const star = BACKGROUND_STARS[index]
      const farY = ((star.y * height * 1.26 + seconds * 15) % (height * 1.26)) - height * 0.13
      const nearY = ((star.y * height * 1.38 + seconds * 72) % (height * 1.38)) - height * 0.19
      const x = star.x * width
      ctx.globalAlpha = star.alpha * 0.52
      ctx.fillStyle = star.tint > 0.66 ? starTint : star.tint > 0.33 ? 'rgba(125,211,252,0.55)' : 'rgba(255,255,255,0.76)'
      ctx.beginPath()
      ctx.arc(x, farY, star.size * 0.62, 0, Math.PI * 2)
      ctx.fill()

      if (shouldDrawRaidStarTrail(star, index, quality)) {
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
      drawPlanetSurface(ctx, palette, width, height, seconds, quality)
    }
    ctx.save()
    ctx.globalAlpha = 1
    const planetLimit = isMedium ? Math.min(2, scene.planets.length) : scene.planets.length
    for (let index = 0; index < planetLimit; index += 1) {
      const planet = scene.planets[index]
      const planetSprite = getRaidOtherCanvasSprite(planet.asset)
      const planetY = getRaidScenePlanetY(planet, height, seconds)
      const radius = getRaidScenePlanetRadius(Math.min(width, height), scene, planet, stageTheme, Math.min(index, 2))
      const size = radius * getRaidScenePlanetDrawScale(planet.asset)
      const rotation = planet.rotation + seconds * planet.spin
      if (!drawCanvasImageContain(ctx, planetSprite, width * planet.x, planetY, size, size, planet.filter, getRaidScenePlanetAlpha(planet), rotation)) {
        const color = getRaidScenePlanetFallbackColor(palette, planet)
        drawRadialEllipse(ctx, width * planet.x, planetY, radius, radius, [[0, '#f9fafb'], [0.55, color], [1, baseMid]])
      }
    }
    const wreckLimit = isMedium ? Math.min(1, scene.wrecks.length) : scene.wrecks.length
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
    const asteroidLimit = isMedium ? 3 : BACKGROUND_ASTEROIDS.length
    const debrisLimit = isMedium ? 3 : BACKGROUND_DEBRIS.length
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

    if (!isMedium) {
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
  if (!isLow && !isMedium) {
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
      this.updateAmbientGlows(width, height, isLow, isMedium, palette)
      this.updateGalaxies(width, height, seconds, stageTheme, isLow, isMedium)
      this.updateStarfield(width, height, seconds, quality, dpr, palette.starTint, palette.streak, stageRush)
      this.updateSpeedLines(width, height, seconds, palette.streak, isLow, isMedium)
      this.updateSurface(width, height, seconds, palette, quality, stageTheme)
      this.updatePlanets(width, height, seconds, palette, stageTheme, isLow, isMedium)
      this.updateWrecks(width, height, seconds, stageTheme, isLow, isMedium)
      this.updateScenic(width, height, seconds, stageTheme, isLow, isMedium)
      this.updateRareCometFlyby(width, height, seconds, isLow, isMedium)
      this.updateBackgroundObjects(width, height, seconds, stageTheme, isLow, isMedium)
      this.updateAmbientExplosions(width, height, seconds, isLow, isMedium)
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
    graphics.visible = !isLow
    if (isLow) return

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

  private updateAmbientGlows(width: number, height: number, isLow: boolean, isMedium: boolean, palette: RaidPalette) {
    const key = `${width}x${height}|${isLow}|${isMedium}|${palette.bgA}`
    if (this.ambientGlowKey === key) return
    this.ambientGlowKey = key
    const graphics = this.ambientGlowGraphics
    graphics.clear()
    graphics.alpha = 1
    graphics.visible = !isLow
    if (isLow) return
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
    const visibleCount = isLow ? 0 : isMedium ? 1 : scene.galaxies.length
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

  private updateStarfield(width: number, height: number, seconds: number, quality: GraphicsQuality, dpr: number, starTint: string, streak: string, stageRush: number) {
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
    this.updateScrollingGraphics(this.farStarLayers, farLayerHeight, seconds * (15 + rush * 42) - height * 0.13, true)
    this.updateScrollingGraphics(this.nearStarLayers, nearLayerHeight, seconds * (72 + rush * 170) - height * 0.19, !isLow && !isMedium)
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

  private updateSpeedLines(width: number, height: number, seconds: number, streak: string, isLow: boolean, isMedium: boolean) {
    const graphics = this.speedLineGraphics
    graphics.clear()
    graphics.visible = !isLow
    if (isLow) return

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

  private updateSurface(width: number, height: number, seconds: number, palette: RaidPalette, quality: GraphicsQuality, stageTheme: number) {
    const graphics = this.surfaceGraphics
    graphics.clear()
    const visible = quality !== 'low' && stageTheme % 2 === 0
    graphics.visible = visible
    if (!visible) return

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
    const visibleCount = isLow ? 0 : isMedium ? Math.min(2, scene.planets.length) : scene.planets.length

    for (let index = 0; index < this.planetSprites.length; index += 1) {
      const sprite = this.planetSprites[index]
      const planet = scene.planets[index]
      const texture = planet ? this.assetTextures.get(planet.asset) : undefined
      sprite.visible = Boolean(texture && index < visibleCount)
      if (!texture || !planet || index >= visibleCount) continue
      const y = getRaidScenePlanetY(planet, height, seconds)
      const radius = getRaidScenePlanetRadius(Math.min(width, height), scene, planet, stageTheme, Math.min(index, 2))
      const size = radius * getRaidScenePlanetDrawScale(planet.asset)
      setPixiSpriteContain(sprite, texture, width * planet.x, y, size, size, getRaidScenePlanetAlpha(planet) * fallbackAlpha, planet.rotation + seconds * planet.spin)
    }
  }

  private updateWrecks(width: number, height: number, seconds: number, stageTheme: number, isLow: boolean, isMedium: boolean) {
    const scene = getRaidBackgroundScene(stageTheme)
    const texture = this.assetTextures.get('spaceStation')
    const visibleCount = !texture || isLow ? 0 : isMedium ? Math.min(1, scene.wrecks.length) : scene.wrecks.length
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

  private updateRareCometFlyby(width: number, height: number, seconds: number, isLow: boolean, isMedium: boolean) {
    const sprite = this.cometFlybySprite
    const texture = this.assetTextures.get('comet')
    const cycle = ((seconds + 11.5) % 41) / 41
    const visible = Boolean(texture && !isLow && !isMedium && cycle < 0.19)
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
    const asteroidLimit = !asteroidTexture || isLow ? 0 : isMedium ? 3 : BACKGROUND_ASTEROIDS.length
    const debrisLimit = !asteroidTexture || isLow ? 0 : isMedium ? 3 : BACKGROUND_DEBRIS.length
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

  private updateAmbientExplosions(width: number, height: number, seconds: number, isLow: boolean, isMedium: boolean) {
    const graphics = this.explosionGraphics
    graphics.clear()
    graphics.visible = !isLow && !isMedium
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
