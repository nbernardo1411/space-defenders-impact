import { useEffect, useMemo, useRef, useState } from 'react'

type RoomPlayer = {
  id: string
  name: string
  ready: boolean
  host: boolean
  shipKey: string
}

type RoomSnapshot = {
  code: string
  players: RoomPlayer[]
}

type RelayMessage =
  | { type: 'hello'; peerId: string }
  | { type: 'room-created' | 'room-joined' | 'room-update'; room: RoomSnapshot | null }
  | { type: 'game-started'; room: RoomSnapshot | null }
  | { type: 'game-message'; from: string; payload: unknown }
  | { type: 'left-room' }
  | { type: 'error'; message: string }
  | { type: 'pong'; at: number }

export type RaidMultiplayerSession = {
  socket: WebSocket
  peerId: string
  roomCode: string
  isHost: boolean
  players: RoomPlayer[]
}

type RaidMultiplayerLobbyProps = {
  onBack: () => void
  onStart: (session: RaidMultiplayerSession) => void
}

const getDefaultRelayUrl = () => {
  const configuredUrl = import.meta.env.VITE_RAID_RELAY_URL
  if (configuredUrl) return configuredUrl

  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'ws://localhost:8787'
  }

  return ''
}

const normalizeRelayUrl = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ''

  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) return trimmed
  if (trimmed.startsWith('http://')) return `ws://${trimmed.slice('http://'.length)}`
  if (trimmed.startsWith('https://')) return `wss://${trimmed.slice('https://'.length)}`

  return `wss://${trimmed}`
}

const SHIP_OPTIONS = [
  { key: 'rocket', name: 'Black Comet' },
  { key: 'fast', name: 'Red Wraith' },
  { key: 'gatling', name: 'Crimson Saw' },
  { key: 'laser', name: 'Night Lance' },
  { key: 'dreadnought', name: 'Obsidian Ark' },
  { key: 'xwing', name: 'Crosswing Nova' },
  { key: 'spaceEt', name: 'Space ET' },
]

const getShipName = (shipKey: string) => SHIP_OPTIONS.find((ship) => ship.key === shipKey)?.name ?? 'Black Comet'

export function RaidMultiplayerLobby({ onBack, onStart }: RaidMultiplayerLobbyProps) {
  const socketRef = useRef<WebSocket | null>(null)
  const handoffRef = useRef(false)
  const roomRef = useRef<RoomSnapshot | null>(null)
  const peerIdRef = useRef<string | null>(null)
  const [playerName, setPlayerName] = useState('Pilot')
  const [selectedShipKey, setSelectedShipKey] = useState(SHIP_OPTIONS[0].key)
  const relayUrl = useMemo(getDefaultRelayUrl, [])
  const [joinCode, setJoinCode] = useState('')
  const [room, setRoom] = useState<RoomSnapshot | null>(null)
  const [peerId, setPeerId] = useState<string | null>(null)
  const [status, setStatus] = useState('Choose host or join to link two pilots.')
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState(false)

  const ownPlayer = useMemo(
    () => room?.players.find((player) => player.id === peerId) ?? null,
    [peerId, room],
  )
  const canStart = Boolean(room && room.players.length === 2 && room.players.every((player) => player.ready))

  useEffect(() => {
    roomRef.current = room
  }, [room])

  useEffect(() => {
    peerIdRef.current = peerId
  }, [peerId])

  useEffect(() => {
    if (ownPlayer?.shipKey) setSelectedShipKey(ownPlayer.shipKey)
  }, [ownPlayer?.shipKey])

  useEffect(() => {
    return () => {
      if (!handoffRef.current) {
        socketRef.current?.close()
        socketRef.current = null
      }
    }
  }, [])

  const connect = (onOpen: (socket: WebSocket) => void) => {
    const url = normalizeRelayUrl(relayUrl)
    if (!url) {
      setError('Multiplayer service is not configured for this deployment.')
      return
    }

    setError('')
    setConnecting(true)
    setStatus('Connecting to multiplayer service...')

    socketRef.current?.close()
    const socket = new WebSocket(url)
    socketRef.current = socket

    socket.onopen = () => {
      setConnecting(false)
      setStatus('Connected to multiplayer service.')
      onOpen(socket)
    }

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as RelayMessage
        handleRelayMessage(message)
      } catch {
        setError('Multiplayer service sent an unreadable message.')
      }
    }

    socket.onerror = () => {
      setConnecting(false)
      setError('Could not reach the multiplayer service. Try again in a moment.')
    }

    socket.onclose = () => {
      setConnecting(false)
      setStatus('Disconnected from relay.')
      socketRef.current = null
    }
  }

  const send = (socket: WebSocket | null, payload: Record<string, unknown>) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setError('Multiplayer service is not connected.')
      return
    }

    socket.send(JSON.stringify(payload))
  }

  const handleRelayMessage = (message: RelayMessage) => {
    if (message.type === 'hello') {
      setPeerId(message.peerId)
      return
    }

    if (message.type === 'room-created') {
      setRoom(message.room)
      setStatus('Room created. Share the room code with player two.')
      return
    }

    if (message.type === 'room-joined') {
      setRoom(message.room)
      setStatus('Joined room. Mark ready when both pilots are in.')
      return
    }

    if (message.type === 'room-update') {
      setRoom(message.room)
      if (message.room?.players.length === 2) {
        setStatus('Second pilot linked. Mark ready when both players are set.')
      }
      return
    }

    if (message.type === 'game-started') {
      const startedRoom = message.room ?? roomRef.current
      const currentPeerId = peerIdRef.current
      const socket = socketRef.current
      if (!startedRoom || !currentPeerId || !socket) return

      const ownPlayer = startedRoom.players.find((player) => player.id === currentPeerId)
      if (!ownPlayer) return

      handoffRef.current = true
      onStart({
        socket,
        peerId: currentPeerId,
        roomCode: startedRoom.code,
        isHost: ownPlayer.host,
        players: startedRoom.players,
      })
      return
    }

    if (message.type === 'left-room') {
      setRoom(null)
      setStatus('Left room.')
      return
    }

    if (message.type === 'error') {
      setError(message.message)
    }
  }

  const hostRoom = () => {
    connect((socket) => {
      send(socket, { type: 'create-room', name: playerName, shipKey: selectedShipKey })
    })
  }

  const joinRoom = () => {
    const code = joinCode.trim().toUpperCase()
    if (!code) {
      setError('Enter the host room code first.')
      return
    }

    connect((socket) => {
      send(socket, { type: 'join-room', name: playerName, roomCode: code, shipKey: selectedShipKey })
    })
  }

  const chooseShip = (shipKey: string) => {
    setSelectedShipKey(shipKey)
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      send(socketRef.current, { type: 'set-ship', shipKey })
    }
  }

  const toggleReady = () => {
    send(socketRef.current, { type: 'set-ready', ready: !ownPlayer?.ready })
  }

  const startCoop = () => {
    send(socketRef.current, { type: 'start-game' })
  }

  const leaveRoom = () => {
    send(socketRef.current, { type: 'leave-room' })
    socketRef.current?.close()
    setRoom(null)
  }

  return (
    <div className="mode-screen">
      <div className="mode-screen__stars" />
      <div className="mode-screen__panel raid-lobby">
        <button className="mode-screen__back" onClick={onBack}>
          Back
        </button>

        <div className="mode-screen__eyebrow">Rocket Raid Link</div>
        <h1>Multiplayer</h1>
        <p>
          Host a two-player room online, then share the room code with the second pilot.
        </p>

        <div className="raid-lobby__grid">
          <label className="raid-lobby__field">
            <span>Pilot name</span>
            <input value={playerName} maxLength={18} onChange={(event) => setPlayerName(event.target.value)} />
          </label>
        </div>

        <div className="raid-lobby__ships" aria-label="Choose ship">
          {SHIP_OPTIONS.map((ship) => (
            <button
              key={ship.key}
              data-ship={ship.key}
              className={selectedShipKey === ship.key ? 'raid-lobby__ship raid-lobby__ship--active' : 'raid-lobby__ship'}
              type="button"
              onClick={() => chooseShip(ship.key)}
              disabled={Boolean(ownPlayer?.ready)}
            >
              <span className="raid-lobby__ship-art" aria-hidden="true" />
              <span className="raid-lobby__ship-name">{ship.name}</span>
            </button>
          ))}
        </div>

        <div className="raid-lobby__actions">
          <button disabled={connecting} onClick={hostRoom}>
            Host Room
          </button>
          <label className="raid-lobby__join">
            <input
              value={joinCode}
              placeholder="RAID-1234"
              onChange={(event) => setJoinCode(event.target.value)}
            />
            <button disabled={connecting} onClick={joinRoom}>
              Join
            </button>
          </label>
        </div>

        <div className="raid-lobby__status" role="status">
          {status}
        </div>
        {error ? <div className="raid-lobby__error">{error}</div> : null}

        {room ? (
          <div className="raid-lobby__room">
            <div className="raid-lobby__room-code">
              <span>Room code</span>
              <strong>{room.code}</strong>
            </div>

            <div className="raid-lobby__players">
              {room.players.map((player) => (
                <div className="raid-lobby__player" key={player.id}>
                  <span>{player.name}</span>
                  <strong>
                    {player.host ? 'Host' : 'Guest'} - {getShipName(player.shipKey)} - {player.ready ? 'Ready' : 'Waiting'}
                  </strong>
                </div>
              ))}
            </div>

            <div className="raid-lobby__room-actions">
              <button onClick={toggleReady}>{ownPlayer?.ready ? 'Cancel Ready' : 'Ready'}</button>
              {canStart && ownPlayer?.host ? (
                <button onClick={startCoop}>Start Co-op</button>
              ) : null}
              <button className="raid-lobby__secondary" onClick={leaveRoom}>
                Leave
              </button>
            </div>

            {canStart ? (
              <div className="raid-lobby__ready">
                Both pilots are linked. Host can launch co-op.
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
