import { useEffect, useMemo, useRef, useState } from 'react'
import { RaidShipSprite } from './games/RaidShipSprite'
import { getLanguageText, getRaidText, type LanguageCode } from '../i18n'
import { isNativeLanRelayAvailable, startLanRelay } from '../native/lanRelay'
import { getCoreLanderModel, getMesiahShipColor, isCoreLanderUnlocked, isGradiusRaidEndlessUnlocked, loadProgress } from '../progression'

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

export type RaidMultiplayerConnectionMode = 'online' | 'local'

type RaidMultiplayerLobbyProps = {
  playerName: string
  language: LanguageCode
  connectionMode: RaidMultiplayerConnectionMode
  onBack: () => void
  onStart: (session: RaidMultiplayerSession) => void
}

const getDefaultRelayUrl = () => {
  const configuredUrl = import.meta.env.VITE_RAID_RELAY_URL
  if (configuredUrl) return configuredUrl

  if (
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1'].includes(window.location.hostname) &&
    ['5173', '4173'].includes(window.location.port)
  ) {
    return 'ws://localhost:8787'
  }

  return DEFAULT_RAID_RELAY_URL
}

const isLocalRelayEndpoint = (value: string) => (
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1)/i.test(value)
)

const normalizeRelayUrl = (value: string, preferLocal = false) => {
  const trimmed = value.trim()
  if (!trimmed) return ''

  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) return trimmed
  if (trimmed.startsWith('http://')) return `ws://${trimmed.slice('http://'.length)}`
  if (trimmed.startsWith('https://')) return `wss://${trimmed.slice('https://'.length)}`

  return `${preferLocal || isLocalRelayEndpoint(trimmed) ? 'ws' : 'wss'}://${trimmed}`
}

const normalizeLanEndpoint = (value: string) => {
  const trimmed = value.trim().replace(/^wss?:\/\//i, '').replace(/^https?:\/\//i, '').replace(/\/+$/, '')
  if (!trimmed) return ''
  return trimmed.includes(':') ? trimmed : `${trimmed}:8787`
}

const probeLanEndpoint = async (endpoint: string) => {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 4500)
  try {
    const response = await fetch(`http://${endpoint}/health?t=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) throw new Error('LAN relay health check failed')
  } finally {
    window.clearTimeout(timeout)
  }
}

const SHIP_OPTIONS = [
  { key: 'rocket', name: 'Black Comet' },
  { key: 'fast', name: 'Red Wraith' },
  { key: 'gatling', name: 'Crimson Saw' },
  { key: 'laser', name: 'Night Lance' },
  { key: 'dreadnought', name: 'Obsidian Ark' },
  { key: 'xwing', name: 'Crosswing Nova' },
  { key: 'spaceEt', name: 'Space Jet' },
  { key: 'mesiah', name: 'Mesiah' },
  { key: 'coreLander', name: 'Core Lander' },
]

const getShipName = (shipKey: string) => SHIP_OPTIONS.find((ship) => ship.key === shipKey)?.name ?? 'Black Comet'

const getLobbyShipSize = (shipKey: string) => {
  if (shipKey === 'mesiah') return 58
  if (shipKey === 'coreLander') return 56
  if (shipKey === 'dreadnought') return 52
  if (shipKey === 'spaceEt') return 54
  if (shipKey === 'xwing') return 50
  return 48
}

const getMultiplayerShipOptions = (progress: ReturnType<typeof loadProgress>) => (
  SHIP_OPTIONS.filter((ship) => {
    if (ship.key === 'mesiah') return isGradiusRaidEndlessUnlocked(progress)
    if (ship.key === 'coreLander') return isCoreLanderUnlocked(progress)
    return true
  })
)

export function RaidMultiplayerLobby({ playerName, language, connectionMode, onBack, onStart }: RaidMultiplayerLobbyProps) {
  const text = getLanguageText(language).lobby
  const raidText = getRaidText(language)
  const getLocalizedShipName = (shipKey: string) => raidText.ships[shipKey as keyof typeof raidText.ships]?.name ?? getShipName(shipKey)
  const progress = useMemo(() => loadProgress(), [])
  const availableShipOptions = useMemo(() => getMultiplayerShipOptions(progress), [progress])
  const mesiahVisualShipKey = getMesiahShipColor(progress) === 'white' ? 'mesiahWhite' : 'mesiahBlack'
  const coreLanderVisualShipKey = getCoreLanderModel(progress)
  const socketRef = useRef<WebSocket | null>(null)
  const handoffRef = useRef(false)
  const roomRef = useRef<RoomSnapshot | null>(null)
  const peerIdRef = useRef<string | null>(null)
  const [selectedShipKey, setSelectedShipKey] = useState(SHIP_OPTIONS[0].key)
  const onlineRelayUrl = useMemo(getDefaultRelayUrl, [])
  const [joinCode, setJoinCode] = useState('')
  const [localHostInput, setLocalHostInput] = useState('')
  const [localHostAddress, setLocalHostAddress] = useState('')
  const [room, setRoom] = useState<RoomSnapshot | null>(null)
  const [peerId, setPeerId] = useState<string | null>(null)
  const [status, setStatus] = useState<string>(text.statusInitial)
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState(false)
  const isLocalMode = connectionMode === 'local'

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
    if (availableShipOptions.some((ship) => ship.key === selectedShipKey)) return
    setSelectedShipKey(availableShipOptions[0]?.key ?? SHIP_OPTIONS[0].key)
  }, [availableShipOptions, selectedShipKey])

  useEffect(() => {
    return () => {
      if (!handoffRef.current) {
        socketRef.current?.close()
        socketRef.current = null
      }
    }
  }, [])

  const connect = (onOpen: (socket: WebSocket) => void, relayTarget = onlineRelayUrl) => {
    const url = normalizeRelayUrl(relayTarget, isLocalMode)
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
    let opened = false
    const connectTimeout = window.setTimeout(() => {
      if (opened || socketRef.current !== socket) return
      if (socketRef.current === socket) {
        setConnecting(false)
        setStatus(text.disconnected)
        setError(`${text.unreachable} ${relayTarget}`)
        socketRef.current = null
      }
      socket.close()
    }, 9000)
    const clearConnectTimeout = () => window.clearTimeout(connectTimeout)

    socket.onopen = () => {
      if (socketRef.current !== socket) return
      opened = true
      clearConnectTimeout()
      setConnecting(false)
      setStatus(text.connected)
      onOpen(socket)
    }

    socket.onmessage = (event) => {
      if (socketRef.current !== socket) return
      try {
        const message = JSON.parse(event.data) as RelayMessage
        handleRelayMessage(message)
      } catch {
        setError(text.unreadable)
      }
    }

    socket.onerror = () => {
      if (socketRef.current !== socket) return
      clearConnectTimeout()
      setConnecting(false)
      setError(text.unreachable)
    }

    socket.onclose = () => {
      clearConnectTimeout()
      if (socketRef.current !== socket && socketRef.current !== null) return
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
    if (!isLocalMode) {
      connect((socket) => {
        send(socket, { type: 'create-room', name: playerName, shipKey: selectedShipKey })
      })
      return
    }

    if (!isNativeLanRelayAvailable()) {
      setError(text.localHostUnavailable)
      return
    }

    setError('')
    setConnecting(true)
    setStatus(text.localHostStarting)
    void startLanRelay(8787).then((relay) => {
      if (!relay.running) {
        setConnecting(false)
        setError(text.localHostUnavailable)
        return
      }

      const port = relay.port || 8787
      const shareUrl = relay.url || (relay.ipAddress ? `ws://${relay.ipAddress}:${port}` : '')
      setLocalHostAddress(shareUrl.replace(/^ws:\/\//i, ''))
      setLocalHostInput(shareUrl.replace(/^ws:\/\//i, ''))
      connect((socket) => {
        send(socket, { type: 'create-room', name: playerName, shipKey: selectedShipKey })
      }, `127.0.0.1:${port}`)
    }).catch(() => {
      setConnecting(false)
      setError(text.localHostUnavailable)
    })
  }

  const joinRoom = () => {
    const code = joinCode.trim().toUpperCase()
    if (!code) {
      setError(text.enterCode)
      return
    }

    if (isLocalMode) {
      const endpoint = normalizeLanEndpoint(localHostInput)
      if (!endpoint) {
        setError(text.enterHostAddress)
        return
      }

      setError('')
      setConnecting(true)
      setStatus(text.connecting)
      void probeLanEndpoint(endpoint).then(() => {
        connect((socket) => {
          send(socket, { type: 'join-room', name: playerName, roomCode: code, shipKey: selectedShipKey })
        }, endpoint)
      }).catch(() => {
        setConnecting(false)
        setStatus(text.disconnected)
        setError(`${text.unreachable} ${endpoint}`)
      })
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

        <div className="mode-screen__eyebrow">{isLocalMode ? text.localEyebrow : text.eyebrow}</div>
        <h1>{isLocalMode ? text.localTitle : text.title}</h1>
        <p>
          {isLocalMode ? text.localCopy : text.copy}
        </p>

        <div className="raid-lobby__grid">
          <div className="raid-lobby__field raid-lobby__field--readonly">
            <span>{getLanguageText(language).player.pilotName}</span>
            <strong>{playerName}</strong>
          </div>
        </div>

        {isLocalMode ? (
          <div className="raid-lobby__lan-card">
            <span>{text.localHostAddress}</span>
            <strong>{localHostAddress || text.localHostWaiting}</strong>
            <small>{text.localHostHint}</small>
          </div>
        ) : null}

        <div className="raid-lobby__ships" aria-label={text.chooseShip}>
          {availableShipOptions.map((ship) => {
            const shipSpriteKey = ship.key === 'mesiah' ? mesiahVisualShipKey : ship.key === 'coreLander' ? coreLanderVisualShipKey : ship.key
            return (
              <button
                key={ship.key}
                data-ship={ship.key}
                className={selectedShipKey === ship.key ? 'raid-lobby__ship raid-lobby__ship--active' : 'raid-lobby__ship'}
                type="button"
                onClick={() => chooseShip(ship.key)}
                disabled={Boolean(ownPlayer?.ready)}
              >
                <span className="raid-lobby__ship-art" aria-hidden="true">
                  <RaidShipSprite shipKey={shipSpriteKey} size={getLobbyShipSize(ship.key)} />
                </span>
                <span className="raid-lobby__ship-name">{getLocalizedShipName(ship.key)}</span>
              </button>
            )
          })}
        </div>

        <div className="raid-lobby__actions">
          <button disabled={connecting} onClick={hostRoom}>
            {isLocalMode ? text.startLanHost : text.hostRoom}
          </button>
          <label className={isLocalMode ? 'raid-lobby__join raid-lobby__join--local' : 'raid-lobby__join'}>
            {isLocalMode ? (
              <input
                value={localHostInput}
                placeholder={text.localHostPlaceholder}
                onChange={(event) => setLocalHostInput(event.target.value)}
              />
            ) : null}
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
