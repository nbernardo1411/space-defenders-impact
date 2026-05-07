import './App.css'
import { CryptoTowerDefense } from './components/games/CryptoTowerDefense'
import { useState } from 'react'

// Sample coins for the game
const DEFAULT_COINS = [
  { id: '1', name: 'Bitcoin', symbol: 'BTC', image: '₿' },
  { id: '2', name: 'Ethereum', symbol: 'ETH', image: '◆' },
  { id: '3', name: 'Cardano', symbol: 'ADA', image: '◇' },
  { id: '4', name: 'Ripple', symbol: 'XRP', image: '✧' },
  { id: '5', name: 'Solana', symbol: 'SOL', image: '◈' },
  { id: '6', name: 'Polkadot', symbol: 'DOT', image: '●' },
]

function App() {
  const [showGame, setShowGame] = useState(true)

  if (!showGame) {
    return (
      <div className="start-screen">
        <h1>Crypto Tower Defense</h1>
        <button onClick={() => setShowGame(true)} style={{
          padding: '12px 32px',
          fontSize: '16px',
          backgroundColor: '#18e6c4',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 600,
          color: '#000'
        }}>
          Start Game
        </button>
      </div>
    )
  }

  return (
    <div className="app">
      <CryptoTowerDefense 
        availableCoins={DEFAULT_COINS}
        onClose={() => setShowGame(false)}
      />
    </div>
  )
}

export default App
