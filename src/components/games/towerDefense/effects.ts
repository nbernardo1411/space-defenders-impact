import { getGameSoundEnabled, playGameSound } from '../sound'
import type { Enemy, ParticleType } from './model'

type MutableValueRef<T> = { current: T }

export function lerp(a: number, b: number, t: number) { return a + (b - a) * t }

export function angleToDeg(fromX: number, fromY: number, toX: number, toY: number) {
  return Math.atan2(toY - fromY, toX - fromX) * 180 / Math.PI + 90
}

export function spawnImpactParticles(
  particles: {x: number; y: number; type: ParticleType; vx: number; vy: number; life: number; maxLife: number}[],
  x: number,
  y: number,
  type: 'impact' | 'freeze',
  count: number,
  speed: number,
  maxLife: number,
) {
  for (let i = 0; i < count; i++) {
    const angle = (-Math.PI / 2) + (Math.random() - 0.5) * 2.2
    const velocity = speed * (0.7 + Math.random() * 0.7)
    particles.push({
      x,
      y,
      type,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: 0,
      maxLife,
    })
  }
}

// ─── Enemy death helper with animations ────────────────────────────────────────
export function triggerEnemyDeath(
  e: Enemy,
  towerType: string,
  isBoss: boolean,
  goldRef: { current: number },
  scoreRef: { current: number },
  particles: {x: number; y: number; type: ParticleType; vx: number; vy: number; life: number; maxLife: number}[],
  floatingText: {x: number; y: number; text: string; time: number; maxTime: number; color: string}[],
  screenFlashRef: MutableValueRef<{time: number; maxTime: number; intensity: number} | null>,
  coinFlowRef: MutableValueRef<{fromX: number; fromY: number; toX: number; toY: number; amount: number; time: number; maxTime: number}[]>,
  setScreenFlashState: (state: number) => void,
  shockwaves?: {x: number; y: number; radius: number; time: number; maxTime: number; intensity: number}[]
) {
  e.dead = true
  goldRef.current += e.reward
  scoreRef.current += e.reward * 10

  // Enhanced death effect with multiple particle layers
  const x = e.x + 0.5, y = e.y + 0.5
  
  // Death particles - main burst
  const deathCount = isBoss ? 12 : (towerType === 'rocket' ? 9 : towerType === 'aoe' ? 6 : towerType === 'artillery' ? 8 : 5)
  for (let i = 0; i < deathCount; i++) {
    const angle = (Math.PI * 2 * i) / deathCount + (Math.random() - 0.5) * 0.4
    const speed = isBoss ? 2.2 : 1.8
    particles.push({
      x, y,
      type: 'death',
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 0, maxLife: isBoss ? 0.5 : 0.4
    })
  }
  
  // Energy burst particles - inner burst for visual drama
  const burstCount = isBoss ? 20 : 12
  for (let i = 0; i < burstCount; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 0.4 + Math.random() * 1.5
    particles.push({
      x, y,
      type: 'burst',
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 0, maxLife: isBoss ? 0.6 : 0.45
    })
  }
  
  // Ember particles - trailing effect
  const emberCount = isBoss ? 15 : 8
  for (let i = 0; i < emberCount; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 0.3 + Math.random() * 0.9
    particles.push({
      x, y,
      type: 'ember',
      vx: Math.cos(angle) * speed, vy: (Math.sin(angle) * speed) - 0.5,  // slight upward bias
      life: 0, maxLife: isBoss ? 0.7 : 0.55
    })
  }
  
  // Spark particles - quick bright flashes
  const sparkCount = isBoss ? 12 : 6
  for (let i = 0; i < sparkCount; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 1.2 + Math.random() * 2.0
    particles.push({
      x, y,
      type: 'spark',
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 0, maxLife: 0.3
    })
  }

  // Floating text
  floatingText.push({ x: e.x, y: e.y, text: `+${e.reward}`, time: 0, maxTime: 2.0, color: '#ffd666' })

  // Play appropriate explosion sound
  const soundEnabled = getGameSoundEnabled()
  if (soundEnabled) {
    if (isBoss) playGameSound('explosion_big')
    else playGameSound('explosion')
  }

  // Screen flash on boss kill
  if (isBoss) {
    screenFlashRef.current = {time: 0, maxTime: 0.1, intensity: 1.0}
    setScreenFlashState(1.0)
  }

  // Add shockwave effect
  if (shockwaves) {
    shockwaves.push({
      x: e.x + 0.5, y: e.y + 0.5,
      radius: isBoss ? 2.0 : 1.2,
      time: 0,
      maxTime: isBoss ? 0.35 : 0.25,
      intensity: isBoss ? 1.0 : 0.8
    })
  }

  // Coin flow animation
  coinFlowRef.current.push({
    fromX: e.x, fromY: e.y,
    toX: 14, toY: -0.5,  // top-right corner
    amount: e.reward,
    time: 0, maxTime: 0.6
  })
}
