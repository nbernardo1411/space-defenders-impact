export type CoinOption = {
  id: string
  name: string
  symbol: string
  image: string
}

export const GAME_IDS = ['flappy', 'match3', 'bubble', 'memory', 'blockblast', 'towerdefense', 'riskpuzzle'] as const

export type GameId = (typeof GAME_IDS)[number]
