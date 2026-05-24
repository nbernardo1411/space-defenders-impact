import { useEffect, useMemo, useRef, useState } from 'react'
import { RaidShipSprite } from './games/RaidShipSprite'
import { getLanguageText, getRaidText, type LanguageCode } from '../i18n'

const DEFAULT_RAID_RELAY_URL = 'https://space-raid-relay.onrender.com'

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
  playerName: string
  language: LanguageCode
  onBack: () => void
  onStart: (session: RaidMultiplayerSession) => void
}

const getDefaultRelayUrl = () => {
  const configuredUrl = import.meta.env.VITE_RAID_RELAY_URL
  if (configuredUrl) return configuredUrl

  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'ws://localhost:8787'
  }

  return DEFAULT_RAID_RELAY_URL
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
  { key: 'spaceEt', name: 'Space Jet' },
]

const getShipName = (shipKey: string) => SHIP_OPTIONS.find((ship) => ship.key === shipKey)?.name ?? 'Black Comet'

const getLobbyShipSize = (shipKey: string) => {
  if (shipKey === 'dreadnought') return 52
  if (shipKey === 'spaceEt') return 54
  if (shipKey === 'xwing') return 50
  return 48
}

export function RaidMultiplayerLobby({ playerName, language, onBack, onStart }: RaidMultiplayerLobbyProps) {
  const text = getLanguageText(language).lobby
  const raidText = getRaidText(language)
  const getLocalizedShipName = (shipKey: string) => raidText.ships[shipKey as keyof typeof raidText.ships]?.name ?? getShipName(shipKey)
  const socketRef = useRef<WebSocket | null>(null)
  const handoffRef = useRef(false)
  const roomRef = useRef<RoomSnapshot | null>(null)
  const peerIdRef = useRef<string | null>(null)
  const [selectedShipKey, setSelectedShipKey] = useState(SHIP_OPTIONS[0].key)
  const relayUrl = useMemo(getDefaultRelayUrl, [])
  const [joinCode, setJoinCode] = useState('')
  const [room, setRoom] = useState<RoomSnapshot | null>(null)
  const [peerId, setPeerId] = useState<string | null>(null)
  const [status, setStatus] = useState<string>(text.statusInitial)
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
      setError(text.noService)
      return
    }

    setError('')
    setConnecting(true)
    setStatus(text.connecting)

    socketRef.current?.close()
    const socket = new WebSocket(url)
    socketRef.current = socket

    socket.onopen = () => {
      setConnecting(false)
      setStatus(text.connected)
      onOpen(socket)
    }

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as RelayMessage
        handleRelayMessage(message)
      } catch {
        setError(text.unreadable)
      }
    }

    socket.onerror = () => {
      setConnecting(false)
      setError(text.unreachable)
    }

    socket.onclose = () => {
      setConnecting(false)
      setStatus(text.disconnected)
      socketRef.current = null
    }
  }

  const send = (socket: WebSocket | null, payload: Record<string, unknown>) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setError(text.notConnected)
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
      setStatus(text.roomCreated)
      return
    }

    if (message.type === 'room-joined') {
      setRoom(message.room)
      setStatus(text.roomJoined)
      return
    }

    if (message.type === 'room-update') {
      setRoom(message.room)
      if (message.room?.players.length === 2) {
        setStatus(text.secondLinked)
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
      setStatus(text.leftRoom)
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
      setError(text.enterCode)
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
          {text.back}
        </button>

        <div className="mode-screen__eyebrow">{text.eyebrow}</div>
        <h1>{text.title}</h1>
        <p>
          {text.copy}
        </p>

        <div className="raid-lobby__grid">
          <div className="raid-lobby__field raid-lobby__field--readonly">
            <span>{getLanguageText(language).player.pilotName}</span>
            <strong>{playerName}</strong>
          </div>
        </div>

        <div className="raid-lobby__ships" aria-label={text.chooseShip}>
          {SHIP_OPTIONS.map((ship) => (
            <button
              key={ship.key}
              data-ship={ship.key}
              className={selectedShipKey === ship.key ? 'raid-lobby__ship raid-lobby__ship--active' : 'raid-lobby__ship'}
              type="button"
              onClick={() => chooseShip(ship.key)}
              disabled={Boolean(ownPlayer?.ready)}
            >
              <span className="raid-lobby__ship-art" aria-hidden="true">
                <RaidShipSprite shipKey={ship.key} size={getLobbyShipSize(ship.key)} />
              </span>
              <span className="raid-lobby__ship-name">{getLocalizedShipName(ship.key)}</span>
            </button>
          ))}
        </div>

        <div className="raid-lobby__actions">
          <button disabled={connecting} onClick={hostRoom}>
            {text.hostRoom}
          </button>
          <label className="raid-lobby__join">
            <input
              value={joinCode}
              placeholder={text.roomPlaceholder}
              onChange={(event) => setJoinCode(event.target.value)}
            />
            <button disabled={connecting} onClick={joinRoom}>
              {text.join}
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
              <span>{text.roomCode}</span>
              <strong>{room.code}</strong>
            </div>

            <div className="raid-lobby__players">
              {room.players.map((player) => (
                <div className="raid-lobby__player" key={player.id}>
                  <span>{player.name}</span>
                  <strong>
                    {player.host ? text.host : text.guest} - {getLocalizedShipName(player.shipKey)} - {player.ready ? text.ready : text.waiting}
                  </strong>
                </div>
              ))}
            </div>

            <div className="raid-lobby__room-actions">
              <button onClick={toggleReady}>{ownPlayer?.ready ? text.cancelReady : text.ready}</button>
              {canStart && ownPlayer?.host ? (
                <button onClick={startCoop}>{text.startCoop}</button>
              ) : null}
              <button className="raid-lobby__secondary" onClick={leaveRoom}>
                {text.leave}
              </button>
            </div>

            {canStart ? (
              <div className="raid-lobby__ready">
                {text.readyMessage}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
