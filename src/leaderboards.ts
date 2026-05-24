export type LeaderboardMode = 'ship_defense_normal' | 'ship_defense_endless' | 'gradius_solo' | 'gradius_endless' | 'gradius_multiplayer'

export type LeaderboardEntry = {
  id?: number | string
  rank: number
  playerName: string
  score: number
  shipKey?: string | null
  stage?: number | null
  createdAt?: string
}

export type LeaderboardMap = Record<LeaderboardMode, LeaderboardEntry[]>

export type SubmitLeaderboardScore = {
  mode: LeaderboardMode
  playerName: string
  score: number
  shipKey?: string | null
  stage?: number | null
}

export const PLAYER_NAME_STORAGE_KEY = 'space-defenders-player-name'
export const PLAYER_ID_STORAGE_KEY = 'space-defenders-player-id'
export const PLAYER_RECOVERY_CODE_STORAGE_KEY = 'space-defenders-player-recovery-code'
export const CREATOR_PLAYER_NAME = 'zukito'
const DEFAULT_RAID_RELAY_URL = 'https://space-raid-relay.onrender.com'

export const LEADERBOARD_MODES: Array<{
  key: LeaderboardMode
  title: string
  label: string
  description: string
}> = [
  {
    key: 'ship_defense_normal',
    title: 'Ship Defense',
    label: 'Normal',
    description: 'Best campaign clears and last stands.',
  },
  {
    key: 'ship_defense_endless',
    title: 'Ship Defense',
    label: 'Endless',
    description: 'Highest survival scores.',
  },
  {
    key: 'gradius_solo',
    title: 'Gradius Raid',
    label: 'Solo',
    description: 'Top solo pilot assault runs.',
  },
  {
    key: 'gradius_endless',
    title: 'Gradius Raid',
    label: 'Endless Flight',
    description: 'Longest Endless Flight survival runs.',
  },
  {
    key: 'gradius_multiplayer',
    title: 'Gradius Raid',
    label: 'Co-op',
    description: 'Top two-pilot raid scores.',
  },
]

export const EMPTY_LEADERBOARDS = LEADERBOARD_MODES.reduce((boards, mode) => {
  boards[mode.key] = []
  return boards
}, {} as LeaderboardMap)

export function sanitizePlayerName(value: string, maxLength = 18): string {
  const name = value.trim().replace(/\s+/g, ' ').slice(0, maxLength)
  return name || 'Pilot'
}

export function isCreatorPlayerName(value: string): boolean {
  return sanitizePlayerName(value).toLocaleLowerCase('en-US') === CREATOR_PLAYER_NAME
}

export function getOrCreateStoredPlayerId(): string {
  if (typeof window === 'undefined') return 'server-player'

  const existing = window.localStorage.getItem(PLAYER_ID_STORAGE_KEY)?.trim()
  if (existing) return existing

  const nextId = typeof window.crypto?.randomUUID === 'function'
    ? window.crypto.randomUUID()
    : `player-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  window.localStorage.setItem(PLAYER_ID_STORAGE_KEY, nextId)
  return nextId
}

export function saveStoredPlayerId(value: string): string {
  const playerId = value.trim()
  if (typeof window !== 'undefined' && playerId) {
    window.localStorage.setItem(PLAYER_ID_STORAGE_KEY, playerId)
  }
  return playerId
}

export function getStoredRecoveryCode(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(PLAYER_RECOVERY_CODE_STORAGE_KEY)?.trim() ?? ''
}

export function saveStoredRecoveryCode(value: string): string {
  const recoveryCode = value.trim().toUpperCase()
  if (typeof window !== 'undefined' && recoveryCode) {
    window.localStorage.setItem(PLAYER_RECOVERY_CODE_STORAGE_KEY, recoveryCode)
  }
  return recoveryCode
}

export function getStoredPlayerName(): string {
  if (typeof window === 'undefined') return 'Pilot'
  return sanitizePlayerName(window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY) || '')
}

export function hasStoredPlayerName(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean(window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY)?.trim())
}

export function saveStoredPlayerName(value: string): string {
  const name = sanitizePlayerName(value)
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, name)
  }
  return name
}

export type PlayerNameRegistrationResult = {
  registered: boolean
  available: boolean
  taken: boolean
  restored?: boolean
  offline?: boolean
  playerId?: string
  playerName?: string
  recoveryCode?: string
  progress?: unknown
  error?: string
}

export function getLeaderboardApiBase(): string {
  const configuredUrl = import.meta.env.VITE_RAID_RELAY_URL

  if (configuredUrl) {
    return configuredUrl
      .replace(/^wss:\/\//i, 'https://')
      .replace(/^ws:\/\//i, 'http://')
      .replace(/\/$/, '')
  }

  if (
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1'].includes(window.location.hostname) &&
    ['5173', '4173'].includes(window.location.port)
  ) {
    return 'http://localhost:8787'
  }

  return DEFAULT_RAID_RELAY_URL
}

export async function fetchLeaderboards(): Promise<LeaderboardMap> {
  const apiBase = getLeaderboardApiBase()
  if (!apiBase) return { ...EMPTY_LEADERBOARDS }

  const response = await fetch(`${apiBase}/leaderboards`, {
    headers: { accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error('Leaderboards are temporarily unavailable.')
  }

  const data = await response.json()
  return normalizeLeaderboardMap(data.leaderboards)
}

export async function registerPlayerName(value: string): Promise<PlayerNameRegistrationResult> {
  const playerName = sanitizePlayerName(value)
  const playerId = getOrCreateStoredPlayerId()
  const apiBase = getLeaderboardApiBase()
  if (!apiBase) return { registered: true, available: true, taken: false, offline: true, playerId, playerName, recoveryCode: getStoredRecoveryCode() }

  try {
    const response = await fetch(`${apiBase}/players/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ playerName, playerId }),
    })

    const data = await response.json().catch(() => ({}))
    if (response.status === 409 || data?.reason === 'name_taken') {
      return {
        registered: false,
        available: false,
        taken: true,
        playerName: typeof data?.playerName === 'string' ? data.playerName : playerName,
      }
    }

    if (!response.ok || !data?.registered) {
      return { registered: false, available: false, taken: false, error: 'Name registration failed.', playerName }
    }

    return {
      registered: true,
      available: true,
      taken: false,
      playerId: typeof data.playerId === 'string' ? saveStoredPlayerId(data.playerId) : playerId,
      playerName: typeof data.playerName === 'string' ? sanitizePlayerName(data.playerName) : playerName,
      recoveryCode: typeof data.recoveryCode === 'string' ? saveStoredRecoveryCode(data.recoveryCode) : getStoredRecoveryCode(),
      progress: data.progress ?? null,
    }
  } catch {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      return { registered: true, available: true, taken: false, offline: true, playerId, playerName, recoveryCode: getStoredRecoveryCode() }
    }
    return { registered: false, available: false, taken: false, error: 'Name registration failed.', playerName }
  }
}

export async function restorePlayerName(value: string, recoveryCodeValue: string): Promise<PlayerNameRegistrationResult> {
  const playerName = sanitizePlayerName(value)
  const recoveryCode = recoveryCodeValue.trim().toUpperCase()
  const playerId = getOrCreateStoredPlayerId()
  const apiBase = getLeaderboardApiBase()
  if (!apiBase) return { registered: false, available: false, taken: false, error: 'Name restoration failed.', playerName }

  try {
    const response = await fetch(`${apiBase}/players/restore`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ playerName, recoveryCode, playerId }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data?.restored) {
      return { registered: false, restored: false, available: false, taken: false, error: 'Name restoration failed.', playerName }
    }

    return {
      registered: true,
      restored: true,
      available: true,
      taken: false,
      playerId: typeof data.playerId === 'string' ? saveStoredPlayerId(data.playerId) : playerId,
      playerName: typeof data.playerName === 'string' ? sanitizePlayerName(data.playerName) : playerName,
      recoveryCode: typeof data.recoveryCode === 'string' ? saveStoredRecoveryCode(data.recoveryCode) : recoveryCode,
      progress: data.progress ?? null,
    }
  } catch {
    return { registered: false, restored: false, available: false, taken: false, error: 'Name restoration failed.', playerName }
  }
}

export async function uploadPlayerProgress(progress: unknown): Promise<{ saved: boolean; error?: string }> {
  const apiBase = getLeaderboardApiBase()
  if (!apiBase) return { saved: false }

  try {
    const response = await fetch(`${apiBase}/players/progress`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ playerId: getOrCreateStoredPlayerId(), progress }),
    })
    if (!response.ok) return { saved: false, error: 'Progress was not saved.' }
    const data = await response.json().catch(() => ({}))
    return { saved: Boolean(data.saved) }
  } catch {
    return { saved: false, error: 'Progress was not saved.' }
  }
}

export async function submitLeaderboardScore(score: SubmitLeaderboardScore): Promise<{ accepted: boolean; error?: string }> {
  const apiBase = getLeaderboardApiBase()
  if (!apiBase || score.score <= 0) return { accepted: false }

  try {
    const response = await fetch(`${apiBase}/leaderboards/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        ...score,
        playerName: sanitizePlayerName(score.playerName, 36),
        score: Math.max(0, Math.floor(score.score)),
      }),
    })

    if (!response.ok) {
      return { accepted: false, error: 'Score was not submitted.' }
    }

    const data = await response.json()
    return { accepted: Boolean(data.accepted) }
  } catch {
    return { accepted: false, error: 'Score was not submitted.' }
  }
}

function normalizeLeaderboardMap(value: unknown): LeaderboardMap {
  const leaderboards = { ...EMPTY_LEADERBOARDS }
  if (!value || typeof value !== 'object') return leaderboards

  for (const mode of LEADERBOARD_MODES) {
    const entries = (value as Record<string, unknown>)[mode.key]
    leaderboards[mode.key] = Array.isArray(entries)
      ? entries.map(normalizeLeaderboardEntry).filter((entry): entry is LeaderboardEntry => Boolean(entry))
      : []
  }

  return leaderboards
}

function normalizeLeaderboardEntry(value: unknown): LeaderboardEntry | null {
  if (!value || typeof value !== 'object') return null

  const entry = value as Record<string, unknown>
  return {
    id: typeof entry.id === 'number' || typeof entry.id === 'string' ? entry.id : undefined,
    rank: Number(entry.rank) || 0,
    playerName: sanitizePlayerName(String(entry.playerName || 'Pilot'), 36),
    score: Math.max(0, Math.floor(Number(entry.score) || 0)),
    shipKey: typeof entry.shipKey === 'string' ? entry.shipKey : null,
    stage: entry.stage === null || entry.stage === undefined ? null : Math.floor(Number(entry.stage) || 0),
    createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : undefined,
  }
}
