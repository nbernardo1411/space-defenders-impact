import type { GraphicsQuality } from '../sound'
import { MAX_ASTEROIDS, MAX_ION_STRIKES, MAX_METEORS, MAX_RIPPLES, MAX_SPARKS } from './constants'
import { clamp } from './utils'

export const RAID_FX_CANVAS_CONTEXT_SETTINGS: CanvasRenderingContext2DSettings = { alpha: true, desynchronized: true }

export type RaidGraphicsProfile = {
  dprCap: number
  maxSparks: number
  sparkScale: number
  maxRipples: number
  maxAsteroids: number
  maxMeteors: number
  maxIonStrikes: number
  maxPowerUps: number
  drawRipples: boolean
  drawAdvancedShotFx: boolean
  drawDecorativeOverlays: boolean
  drawOptionShips: boolean
}

export const raidGraphicsProfileCache = new Map<string, RaidGraphicsProfile>()

export function getRaidGraphicsProfile(quality: GraphicsQuality, isSmallViewport: boolean, isMultiplayer: boolean): RaidGraphicsProfile {
  const cacheKey = `${quality}:${isSmallViewport ? 1 : 0}:${isMultiplayer ? 1 : 0}`
  const cached = raidGraphicsProfileCache.get(cacheKey)
  if (cached) return cached

  const smallScale = isSmallViewport ? 0.7 : 1
  const multiplayerScale = isMultiplayer ? 0.82 : 1
  let profile: RaidGraphicsProfile
  if (quality === 'low') {
    profile = {
      dprCap: 1.25,
      maxSparks: isSmallViewport ? 10 : 14,
      sparkScale: 0.18,
      maxRipples: 0,
      maxAsteroids: isSmallViewport ? 5 : 7,
      maxMeteors: isSmallViewport ? 6 : 8,
      maxIonStrikes: 3,
      maxPowerUps: 8,
      drawRipples: false,
      drawAdvancedShotFx: true,
      drawDecorativeOverlays: true,
      drawOptionShips: true,
    }
  } else if (quality === 'medium') {
    profile = {
      dprCap: 1.25,
      maxSparks: Math.floor(24 * smallScale * multiplayerScale),
      sparkScale: 0.35,
      maxRipples: Math.max(2, Math.floor(3 * smallScale)),
      maxAsteroids: Math.floor(10 * smallScale),
      maxMeteors: Math.floor(12 * smallScale),
      maxIonStrikes: 5,
      maxPowerUps: 12,
      drawRipples: true,
      drawAdvancedShotFx: true,
      drawDecorativeOverlays: true,
      drawOptionShips: true,
    }
  } else if (quality === 'high') {
    profile = {
      dprCap: 1.5,
      maxSparks: Math.floor(34 * smallScale * multiplayerScale),
      sparkScale: 0.7,
      maxRipples: Math.max(3, Math.floor(4 * smallScale)),
      maxAsteroids: Math.floor(14 * smallScale),
      maxMeteors: Math.floor(16 * smallScale),
      maxIonStrikes: 7,
      maxPowerUps: 16,
      drawRipples: true,
      drawAdvancedShotFx: true,
      drawDecorativeOverlays: true,
      drawOptionShips: true,
    }
  } else {
    profile = {
      dprCap: isMultiplayer ? 1.35 : 2,
      maxSparks: MAX_SPARKS,
      sparkScale: 1,
      maxRipples: isMultiplayer ? 4 : MAX_RIPPLES,
      maxAsteroids: MAX_ASTEROIDS,
      maxMeteors: MAX_METEORS,
      maxIonStrikes: MAX_ION_STRIKES,
      maxPowerUps: 999,
      drawRipples: true,
      drawAdvancedShotFx: true,
      drawDecorativeOverlays: true,
      drawOptionShips: true,
    }
  }
  raidGraphicsProfileCache.set(cacheKey, profile)
  return profile
}

export type RaidViewportMetrics = {
  cssWidth: number
  cssHeight: number
  dpr: number
  canvasWidth: number
  canvasHeight: number
  isSmallViewport: boolean
  isDesktopViewport: boolean
  visualScale: number
  profile: RaidGraphicsProfile
  quality: GraphicsQuality
  multiplayer: boolean
}

export function makeRaidViewportMetrics(root: HTMLElement, quality: GraphicsQuality, multiplayer: boolean): RaidViewportMetrics {
  const cssWidth = Math.max(1, root.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1) || 1)
  const cssHeight = Math.max(1, root.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 1) || 1)
  const isSmallViewport = cssWidth <= 860 || cssHeight <= 560
  const profile = getRaidGraphicsProfile(quality, isSmallViewport, multiplayer)
  const dpr = Math.min(profile.dprCap, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
  const isDesktopViewport = cssWidth > 1100 && cssHeight > 700
  const visualScale = clamp(Math.min(cssWidth, cssHeight) / (isDesktopViewport ? 760 : 560), 0.72, isDesktopViewport ? 1.08 : 1.28)
  return {
    cssWidth,
    cssHeight,
    dpr,
    canvasWidth: Math.max(1, Math.floor(cssWidth * dpr)),
    canvasHeight: Math.max(1, Math.floor(cssHeight * dpr)),
    isSmallViewport,
    isDesktopViewport,
    visualScale,
    profile,
    quality,
    multiplayer,
  }
}
