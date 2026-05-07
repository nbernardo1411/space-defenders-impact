import './App.css'
import { SpaceImpactDefense } from './components/games/CryptoTowerDefense'
import { useState } from 'react'

// Placeholder coins (not displayed — kept for prop compatibility)
const DEFAULT_COINS = [
  { id: '1', name: 'Alpha', symbol: 'A', image: '' },
]

function App() {
  const [showGame, setShowGame] = useState(true)

  if (!showGame) {
    return (
      <div className="start-screen">
        <h1>Space Impact Defense</h1>
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
      <SpaceImpactDefense 
        availableCoins={DEFAULT_COINS}
        onClose={() => setShowGame(false)}
      />
    </div>
  )
}

export default App
