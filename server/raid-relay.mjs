import { createServer } from 'node:http'
import { randomBytes, createHash } from 'node:crypto'
import pg from 'pg'

const PORT = Number(process.env.PORT || 8787)
const MAX_PAYLOAD_BYTES = 256 * 1024
const LEADERBOARD_MODES = ['ship_defense_normal', 'ship_defense_endless', 'gradius_solo', 'gradius_multiplayer']
const LEADERBOARD_MODE_SET = new Set(LEADERBOARD_MODES)
const LEADERBOARD_BODY_LIMIT_BYTES = 16 * 1024
const DATABASE_URL = process.env.DATABASE_URL || ''
const { Pool } = pg
const leaderboardPool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : null
let leaderboardSchemaPromise = null

/** @type {Map<string, { code: string, hostId: string, peers: Set<string> }>} */
const rooms = new Map()
/** @type {Map<string, { id: string, socket: import('node:net').Socket, roomCode: string | null, name: string, ready: boolean, isHost: boolean, shipKey: string }>} */
const peers = new Map()

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

    if (req.method === 'OPTIONS') {
      writeJson(res, 204, null)
      return
    }

    if (url.pathname === '/health') {
      writeJson(res, 200, {
        ok: true,
        rooms: rooms.size,
        peers: peers.size,
        leaderboards: Boolean(leaderboardPool),
      })
      return
    }

    if (url.pathname === '/leaderboards' || url.pathname.startsWith('/leaderboards/')) {
      await handleLeaderboardRequest(req, res, url)
      return
    }

    res.writeHead(200, {
      'content-type': 'text/plain; charset=utf-8',
      'access-control-allow-origin': '*',
    })
    res.end('Space Raid relay is running.\n')
  } catch (error) {
    console.error('Relay request failed:', error)
    writeJson(res, 500, { error: 'Relay request failed.' })
    return
  }
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
    shipKey: 'rocket',
  })

  send(id, { type: 'hello', peerId: id })

  let buffer = Buffer.alloc(0)
  let fragmentedMessage = null

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk])

    try {
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

        if (result.opcode === 0x0) {
          if (!fragmentedMessage) continue

          fragmentedMessage.payloads.push(result.payload)
          fragmentedMessage.totalBytes += result.payload.length
          if (fragmentedMessage.totalBytes > MAX_PAYLOAD_BYTES) {
            throw new Error('Payload too large')
          }

          if (!result.fin) continue

          const payload = Buffer.concat(fragmentedMessage.payloads, fragmentedMessage.totalBytes)
          fragmentedMessage = null
          handleTextPayload(id, payload)
          continue
        }

        if (result.opcode !== 0x1) continue

        if (!result.fin) {
          fragmentedMessage = {
            payloads: [result.payload],
            totalBytes: result.payload.length,
          }
          continue
        }

        handleTextPayload(id, result.payload)
      }
    } catch {
      send(id, { type: 'error', message: 'Message too large.' })
      cleanupPeer(id)
      socket.destroy()
    }
  })

  socket.on('close', () => cleanupPeer(id))
  socket.on('error', () => cleanupPeer(id))
})

server.listen(PORT, () => {
  console.log(`Space Raid relay listening on ${PORT}`)
})

async function handleLeaderboardRequest(req, res, url) {
  if (!leaderboardPool) {
    writeJson(res, 503, { error: 'Leaderboard database is not configured.' })
    return
  }

  if (req.method === 'GET' && url.pathname === '/leaderboards') {
    await ensureLeaderboardSchema()
    const leaderboards = {}
    for (const mode of LEADERBOARD_MODES) {
      leaderboards[mode] = await getLeaderboardRows(mode)
    }
    writeJson(res, 200, { leaderboards })
    return
  }

  if (req.method === 'GET' && url.pathname.startsWith('/leaderboards/')) {
    const mode = cleanLeaderboardMode(url.pathname.replace('/leaderboards/', ''))
    if (!mode) {
      writeJson(res, 404, { error: 'Leaderboard mode not found.' })
      return
    }

    await ensureLeaderboardSchema()
    writeJson(res, 200, { mode, entries: await getLeaderboardRows(mode) })
    return
  }

  if (req.method === 'POST' && url.pathname === '/leaderboards/submit') {
    let body
    try {
      body = await readJsonBody(req)
    } catch {
      writeJson(res, 400, { error: 'Invalid JSON body.' })
      return
    }
    const mode = cleanLeaderboardMode(body.mode)
    const playerName = cleanLeaderboardName(body.playerName)
    const score = cleanLeaderboardScore(body.score)
    const shipKey = cleanOptionalShipKey(body.shipKey)
    const stage = cleanOptionalStage(body.stage)

    if (!mode || score <= 0) {
      writeJson(res, 400, { error: 'A valid mode and score are required.' })
      return
    }

    await ensureLeaderboardSchema()
    const result = await submitLeaderboardScore({ mode, playerName, score, shipKey, stage })
    writeJson(res, 200, result)
    return
  }

  writeJson(res, 404, { error: 'Leaderboard route not found.' })
}

async function ensureLeaderboardSchema() {
  if (!leaderboardPool) throw new Error('Leaderboard database is not configured.')
  if (!leaderboardSchemaPromise) {
    leaderboardSchemaPromise = leaderboardPool.query(`
      CREATE TABLE IF NOT EXISTS leaderboard_scores (
        id BIGSERIAL PRIMARY KEY,
        mode TEXT NOT NULL CHECK (mode IN ('ship_defense_normal', 'ship_defense_endless', 'gradius_solo', 'gradius_multiplayer')),
        player_name TEXT NOT NULL,
        score INTEGER NOT NULL CHECK (score >= 0),
        ship_key TEXT,
        stage INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS leaderboard_scores_mode_score_idx
        ON leaderboard_scores (mode, score DESC, created_at ASC);
      CREATE UNIQUE INDEX IF NOT EXISTS leaderboard_scores_mode_player_idx
        ON leaderboard_scores (mode, lower(player_name));
    `).catch((error) => {
      leaderboardSchemaPromise = null
      throw error
    })
  }

  return leaderboardSchemaPromise
}

async function getLeaderboardRows(mode) {
  const result = await leaderboardPool.query(
    `
      SELECT id, player_name AS "playerName", score, ship_key AS "shipKey", stage, created_at AS "createdAt"
      FROM leaderboard_scores
      WHERE mode = $1
      ORDER BY score DESC, created_at ASC
      LIMIT 10
    `,
    [mode],
  )

  return result.rows.map((row, index) => ({
    id: row.id,
    rank: index + 1,
    playerName: row.playerName,
    score: row.score,
    shipKey: row.shipKey,
    stage: row.stage,
    createdAt: row.createdAt,
  }))
}

async function submitLeaderboardScore({ mode, playerName, score, shipKey, stage }) {
  const client = await leaderboardPool.connect()
  let insertedId = null

  try {
    await client.query('BEGIN')
    const insertResult = await client.query(
      `
        INSERT INTO leaderboard_scores (mode, player_name, score, ship_key, stage)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (mode, lower(player_name))
        DO UPDATE SET
          player_name = EXCLUDED.player_name,
          score = EXCLUDED.score,
          ship_key = EXCLUDED.ship_key,
          stage = EXCLUDED.stage,
          created_at = NOW()
        WHERE EXCLUDED.score > leaderboard_scores.score
        RETURNING id
      `,
      [mode, playerName, score, shipKey, stage],
    )
    insertedId = insertResult.rows[0]?.id ?? null

    await client.query(
      `
        DELETE FROM leaderboard_scores
        WHERE id IN (
          SELECT id
          FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY mode ORDER BY score DESC, created_at ASC) AS rank
            FROM leaderboard_scores
            WHERE mode = $1
          ) ranked_scores
          WHERE ranked_scores.rank > 10
        )
      `,
      [mode],
    )

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }

  const leaderboard = await getLeaderboardRows(mode)
  const accepted = insertedId !== null && leaderboard.some((entry) => String(entry.id) === String(insertedId))
  return { accepted, mode, leaderboard }
}

function writeJson(res, statusCode, body) {
  const headers = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
    'cache-control': 'no-store',
  }

  if (statusCode === 204 || body === null) {
    res.writeHead(statusCode, headers)
    res.end()
    return
  }

  res.writeHead(statusCode, {
    ...headers,
    'content-type': 'application/json',
  })
  res.end(JSON.stringify(body))
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let totalBytes = 0
    const chunks = []

    req.on('data', (chunk) => {
      totalBytes += chunk.length
      if (totalBytes > LEADERBOARD_BODY_LIMIT_BYTES) {
        reject(new Error('Leaderboard request body is too large.'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })

    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('Invalid JSON body.'))
      }
    })

    req.on('error', reject)
  })
}

function handleTextPayload(id, payload) {
  let message
  try {
    message = JSON.parse(payload.toString('utf8'))
  } catch {
    send(id, { type: 'error', message: 'Invalid message.' })
    return
  }

  handleMessage(id, message)
}

function handleMessage(id, message) {
  const peer = peers.get(id)
  if (!peer || typeof message !== 'object' || message === null) return

  switch (message.type) {
    case 'create-room': {
      leaveRoom(peer)
      peer.name = cleanName(message.name)
      peer.shipKey = cleanShipKey(message.shipKey)
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
      peer.shipKey = cleanShipKey(message.shipKey)
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

    case 'set-ship': {
      peer.shipKey = cleanShipKey(message.shipKey)
      peer.ready = false
      if (peer.roomCode) broadcastRoom(peer.roomCode)
      break
    }

    case 'start-game': {
      if (!peer.roomCode) {
        send(id, { type: 'error', message: 'Create or join a room first.' })
        return
      }

      const room = rooms.get(peer.roomCode)
      if (!room || room.hostId !== id) {
        send(id, { type: 'error', message: 'Only the host can start co-op.' })
        return
      }

      const players = [...room.peers].map((peerId) => peers.get(peerId)).filter(Boolean)
      if (players.length < 2 || players.some((roomPeer) => !roomPeer.ready)) {
        send(id, { type: 'error', message: 'Both pilots must be ready.' })
        return
      }

      broadcast(room.code, { type: 'game-started', room: snapshotRoom(room.code) })
      break
    }

    case 'game-message': {
      if (!peer.roomCode) return
      const room = rooms.get(peer.roomCode)
      if (!room || !room.peers.has(id)) return

      broadcast(room.code, {
        type: 'game-message',
        from: id,
        payload: message.payload ?? null,
      }, id)
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
  broadcast(code, { type: 'room-update', room: snapshot })
}

function broadcast(code, message, exceptPeerId = null) {
  const room = rooms.get(code)
  if (!room) return

  for (const peerId of room.peers) {
    if (peerId !== exceptPeerId) send(peerId, message)
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
        shipKey: peer?.shipKey || 'rocket',
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
  const fin = (first & 0x80) === 0x80
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
    fin,
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

function cleanLeaderboardName(value) {
  const name = String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 36)

  return name || 'Pilot'
}

function cleanLeaderboardMode(value) {
  const mode = String(value || '').trim()
  return LEADERBOARD_MODE_SET.has(mode) ? mode : null
}

function cleanLeaderboardScore(value) {
  const score = Math.floor(Number(value))
  if (!Number.isFinite(score) || score <= 0) return 0
  return Math.min(score, 2147483647)
}

function cleanOptionalStage(value) {
  if (value === null || value === undefined || value === '') return null
  const stage = Math.floor(Number(value))
  if (!Number.isFinite(stage) || stage < 0) return null
  return Math.min(stage, 999)
}

function cleanShipKey(value) {
  const shipKey = String(value || '').trim()
  const allowedShipKeys = new Set(['rocket', 'fast', 'gatling', 'laser', 'dreadnought', 'xwing', 'spaceEt'])
  return allowedShipKeys.has(shipKey) ? shipKey : 'rocket'
}

function cleanOptionalShipKey(value) {
  if (value === null || value === undefined || value === '') return null

  const shipKey = cleanShipKey(value)
  return shipKey || null
}

function randomId() {
  return randomBytes(8).toString('hex')
}
