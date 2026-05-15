export type LeaderboardMode = 'ship_defense_normal' | 'ship_defense_endless' | 'gradius_solo' | 'gradius_multiplayer'

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

export function getLeaderboardApiBase(): string {
  const configuredUrl = import.meta.env.VITE_RAID_RELAY_URL

  if (configuredUrl) {
    return configuredUrl
      .replace(/^wss:\/\//i, 'https://')
      .replace(/^ws:\/\//i, 'http://')
      .replace(/\/$/, '')
  }

  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:8787'
  }

  return ''
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

export async function submitLeaderboardScore(score: SubmitLeaderboardScore): Promise<{ accepted: boolean; error?: string }> {
  const apiBase = getLeaderboardApiBase()
  if (!apiBase || score.score <= 0) return { accepted: false }

  try {
    const response = await fetch(`${apiBase}/leaderboards/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
