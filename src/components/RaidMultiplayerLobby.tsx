import { useEffect, useMemo, useRef, useState } from 'react'

type RoomPlayer = {
  id: string
  name: string
  ready: boolean
  host: boolean
}

type RoomSnapshot = {
  code: string
  players: RoomPlayer[]
}

type RelayMessage =
  | { type: 'hello'; peerId: string }
  | { type: 'room-created' | 'room-joined' | 'room-update'; room: RoomSnapshot | null }
  | { type: 'left-room' }
  | { type: 'error'; message: string }
  | { type: 'pong'; at: number }

type RaidMultiplayerLobbyProps = {
  onBack: () => void
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

export function RaidMultiplayerLobby({ onBack }: RaidMultiplayerLobbyProps) {
  const socketRef = useRef<WebSocket | null>(null)
  const [playerName, setPlayerName] = useState('Pilot')
  const [relayUrl, setRelayUrl] = useState(getDefaultRelayUrl)
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
    return () => {
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [])

  const connect = (onOpen: (socket: WebSocket) => void) => {
    const url = normalizeRelayUrl(relayUrl)
    if (!url) {
      setError('Add the Render relay WebSocket URL first.')
      return
    }

    setError('')
    setConnecting(true)
    setStatus('Connecting to relay...')

    socketRef.current?.close()
    const socket = new WebSocket(url)
    socketRef.current = socket

    socket.onopen = () => {
      setConnecting(false)
      setStatus('Connected to relay.')
      onOpen(socket)
    }

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as RelayMessage
        handleRelayMessage(message)
      } catch {
        setError('Relay sent an unreadable message.')
      }
    }

    socket.onerror = () => {
      setConnecting(false)
      setError('Could not reach the relay. Check the URL and Render service status.')
    }

    socket.onclose = () => {
      setConnecting(false)
      setStatus('Disconnected from relay.')
      socketRef.current = null
    }
  }

  const send = (socket: WebSocket | null, payload: Record<string, unknown>) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setError('Relay is not connected.')
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
      send(socket, { type: 'create-room', name: playerName })
    })
  }

  const joinRoom = () => {
    const code = joinCode.trim().toUpperCase()
    if (!code) {
      setError('Enter the host room code first.')
      return
    }

    connect((socket) => {
      send(socket, { type: 'join-room', name: playerName, roomCode: code })
    })
  }

  const toggleReady = () => {
    send(socketRef.current, { type: 'set-ready', ready: !ownPlayer?.ready })
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
          Host a two-player room through the Render relay, then share the room code with the second pilot.
        </p>

        <div className="raid-lobby__grid">
          <label className="raid-lobby__field">
            <span>Pilot name</span>
            <input value={playerName} maxLength={18} onChange={(event) => setPlayerName(event.target.value)} />
          </label>

          <label className="raid-lobby__field">
            <span>Relay URL</span>
            <input
              value={relayUrl}
              placeholder="wss://space-raid-relay.onrender.com"
              onChange={(event) => setRelayUrl(event.target.value)}
            />
          </label>
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
                    {player.host ? 'Host' : 'Guest'} - {player.ready ? 'Ready' : 'Waiting'}
                  </strong>
                </div>
              ))}
            </div>

            <div className="raid-lobby__room-actions">
              <button onClick={toggleReady}>{ownPlayer?.ready ? 'Cancel Ready' : 'Ready'}</button>
              <button className="raid-lobby__secondary" onClick={leaveRoom}>
                Leave
              </button>
            </div>

            {canStart ? (
              <div className="raid-lobby__ready">
                Both pilots are linked. Co-op gameplay sync is the next patch.
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
