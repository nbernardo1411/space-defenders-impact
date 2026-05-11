import { createServer } from 'node:http'
import { randomBytes, createHash } from 'node:crypto'

const PORT = Number(process.env.PORT || 8787)
const MAX_PAYLOAD_BYTES = 64 * 1024

/** @type {Map<string, { code: string, hostId: string, peers: Set<string> }>} */
const rooms = new Map()
/** @type {Map<string, { id: string, socket: import('node:net').Socket, roomCode: string | null, name: string, ready: boolean, isHost: boolean }>} */
const peers = new Map()

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    })
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, peers: peers.size }))
    return
  }

  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
  res.end('Space Raid relay is running.\n')
})

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key']
  if (typeof key !== 'string') {
    socket.destroy()
    return
  }

  const accept = createHash('sha1')
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64')

  socket.write(
    [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      '',
      '',
    ].join('\r\n'),
  )

  const id = randomId()
  peers.set(id, {
    id,
    socket,
    roomCode: null,
    name: 'Pilot',
    ready: false,
    isHost: false,
  })

  send(id, { type: 'hello', peerId: id })

  let buffer = Buffer.alloc(0)

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk])

    while (buffer.length > 0) {
      const result = readFrame(buffer)
      if (!result) break

      buffer = buffer.subarray(result.bytesRead)

      if (result.opcode === 0x8) {
        cleanupPeer(id)
        socket.end()
        return
      }

      if (result.opcode === 0x9) {
        writeFrame(socket, result.payload, 0xA)
        continue
      }

      if (result.opcode !== 0x1) continue

      let message
      try {
        message = JSON.parse(result.payload.toString('utf8'))
      } catch {
        send(id, { type: 'error', message: 'Invalid message.' })
        continue
      }

      handleMessage(id, message)
    }
  })

  socket.on('close', () => cleanupPeer(id))
  socket.on('error', () => cleanupPeer(id))
})

server.listen(PORT, () => {
  console.log(`Space Raid relay listening on ${PORT}`)
})

function handleMessage(id, message) {
  const peer = peers.get(id)
  if (!peer || typeof message !== 'object' || message === null) return

  switch (message.type) {
    case 'create-room': {
      leaveRoom(peer)
      peer.name = cleanName(message.name)
      peer.ready = false
      peer.isHost = true

      const code = createRoomCode()
      rooms.set(code, { code, hostId: id, peers: new Set([id]) })
      peer.roomCode = code

      send(id, { type: 'room-created', room: snapshotRoom(code) })
      broadcastRoom(code)
      break
    }

    case 'join-room': {
      const code = cleanRoomCode(message.roomCode)
      const room = rooms.get(code)
      if (!room) {
        send(id, { type: 'error', message: 'Room not found.' })
        return
      }

      if (room.peers.size >= 2 && !room.peers.has(id)) {
        send(id, { type: 'error', message: 'Room is full.' })
        return
      }

      leaveRoom(peer)
      peer.name = cleanName(message.name)
      peer.ready = false
      peer.isHost = room.hostId === id
      peer.roomCode = code
      room.peers.add(id)

      send(id, { type: 'room-joined', room: snapshotRoom(code) })
      broadcastRoom(code)
      break
    }

    case 'set-ready': {
      peer.ready = Boolean(message.ready)
      if (peer.roomCode) broadcastRoom(peer.roomCode)
      break
    }

    case 'leave-room': {
      const previousCode = peer.roomCode
      leaveRoom(peer)
      send(id, { type: 'left-room' })
      if (previousCode) broadcastRoom(previousCode)
      break
    }

    case 'ping':
      send(id, { type: 'pong', at: Date.now() })
      break

    default:
      send(id, { type: 'error', message: 'Unknown message type.' })
  }
}

function cleanupPeer(id) {
  const peer = peers.get(id)
  if (!peer) return

  const previousCode = peer.roomCode
  leaveRoom(peer)
  peers.delete(id)

  if (previousCode) broadcastRoom(previousCode)
}

function leaveRoom(peer) {
  if (!peer.roomCode) return

  const room = rooms.get(peer.roomCode)
  if (room) {
    room.peers.delete(peer.id)

    if (room.peers.size === 0) {
      rooms.delete(room.code)
    } else if (room.hostId === peer.id) {
      const [nextHostId] = room.peers
      room.hostId = nextHostId
      const nextHost = peers.get(nextHostId)
      if (nextHost) nextHost.isHost = true
    }
  }

  peer.roomCode = null
  peer.ready = false
  peer.isHost = false
}

function broadcastRoom(code) {
  const room = rooms.get(code)
  if (!room) return

  const snapshot = snapshotRoom(code)
  for (const peerId of room.peers) {
    send(peerId, { type: 'room-update', room: snapshot })
  }
}

function snapshotRoom(code) {
  const room = rooms.get(code)
  if (!room) return null

  return {
    code: room.code,
    players: [...room.peers].map((peerId) => {
      const peer = peers.get(peerId)
      return {
        id: peerId,
        name: peer?.name || 'Pilot',
        ready: Boolean(peer?.ready),
        host: room.hostId === peerId,
      }
    }),
  }
}

function send(id, message) {
  const peer = peers.get(id)
  if (!peer || peer.socket.destroyed) return

  writeFrame(peer.socket, Buffer.from(JSON.stringify(message), 'utf8'), 0x1)
}

function readFrame(buffer) {
  if (buffer.length < 2) return null

  const first = buffer[0]
  const second = buffer[1]
  const opcode = first & 0x0f
  const masked = (second & 0x80) === 0x80
  let payloadLength = second & 0x7f
  let offset = 2

  if (payloadLength === 126) {
    if (buffer.length < offset + 2) return null
    payloadLength = buffer.readUInt16BE(offset)
    offset += 2
  } else if (payloadLength === 127) {
    if (buffer.length < offset + 8) return null
    const length64 = buffer.readBigUInt64BE(offset)
    if (length64 > BigInt(MAX_PAYLOAD_BYTES)) {
      throw new Error('Payload too large')
    }
    payloadLength = Number(length64)
    offset += 8
  }

  if (payloadLength > MAX_PAYLOAD_BYTES) {
    throw new Error('Payload too large')
  }

  const maskLength = masked ? 4 : 0
  if (buffer.length < offset + maskLength + payloadLength) return null

  const mask = masked ? buffer.subarray(offset, offset + 4) : null
  offset += maskLength

  const payload = Buffer.from(buffer.subarray(offset, offset + payloadLength))
  if (mask) {
    for (let index = 0; index < payload.length; index += 1) {
      payload[index] ^= mask[index % 4]
    }
  }

  return {
    opcode,
    payload,
    bytesRead: offset + payloadLength,
  }
}

function writeFrame(socket, payload, opcode) {
  const length = payload.length
  let header

  if (length < 126) {
    header = Buffer.alloc(2)
    header[1] = length
  } else if (length < 65536) {
    header = Buffer.alloc(4)
    header[1] = 126
    header.writeUInt16BE(length, 2)
  } else {
    header = Buffer.alloc(10)
    header[1] = 127
    header.writeBigUInt64BE(BigInt(length), 2)
  }

  header[0] = 0x80 | opcode
  socket.write(Buffer.concat([header, payload]))
}

function createRoomCode() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = `RAID-${randomBytes(2).toString('hex').toUpperCase()}`
    if (!rooms.has(code)) return code
  }

  return `RAID-${Date.now().toString(36).toUpperCase().slice(-4)}`
}

function cleanRoomCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 12)
}

function cleanName(value) {
  const name = String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 18)

  return name || 'Pilot'
}

function randomId() {
  return randomBytes(8).toString('hex')
}
