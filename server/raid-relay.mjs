import { createServer } from 'node:http'
import { randomBytes, createHash } from 'node:crypto'
import pg from 'pg'

const PORT = Number(process.env.PORT || 8787)
const MAX_PAYLOAD_BYTES = 256 * 1024
const LEADERBOARD_MODES = ['ship_defense_normal', 'ship_defense_endless', 'gradius_solo', 'gradius_endless', 'gradius_boss_rush', 'gradius_multiplayer']
const LEADERBOARD_MODE_SET = new Set(LEADERBOARD_MODES)
const API_BODY_LIMIT_BYTES = 128 * 1024
const DATABASE_URL = process.env.DATABASE_URL || ''
const { Pool } = pg
const leaderboardPool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : null
let leaderboardSchemaPromise = null
let playerNameSchemaPromise = null

/** @type {Map<string, { code: string, hostId: string, peers: Set<string> }>} */
const rooms = new Map()
/** @type {Map<string, { id: string, socket: import('node:net').Socket, roomCode: string | null, name: string, ready: boolean, isHost: boolean, shipKey: string, visualShipKey: string }>} */
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

    if (url.pathname === '/players/register' || url.pathname === '/players/name-check' || url.pathname === '/players/restore' || url.pathname === '/players/progress') {
      await handlePlayerNameRequest(req, res, url)
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
    visualShipKey: 'rocket',
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

async function handlePlayerNameRequest(req, res, url) {
  if (!leaderboardPool) {
    writeJson(res, 503, { error: 'Player database is not configured.' })
    return
  }

  if (req.method === 'GET' && url.pathname === '/players/name-check') {
    const playerName = cleanName(url.searchParams.get('name'))
    const playerId = cleanPlayerId(url.searchParams.get('playerId'))
    if (!playerName) {
      writeJson(res, 400, { error: 'A valid player name is required.' })
      return
    }

    await ensurePlayerNameSchema()
    const status = await getPlayerNameStatus(playerName, playerId)
    writeJson(res, 200, status)
    return
  }

  if (req.method === 'POST' && url.pathname === '/players/register') {
    let body
    try {
      body = await readJsonBody(req)
    } catch {
      writeJson(res, 400, { error: 'Invalid JSON body.' })
      return
    }

    const playerName = cleanName(body.playerName)
    const playerId = cleanPlayerId(body.playerId)
    if (!playerName || !playerId) {
      writeJson(res, 400, { error: 'A valid player name and player id are required.' })
      return
    }

    await ensurePlayerNameSchema()
    const result = await registerPlayerName({ playerName, playerId })
    writeJson(res, result.registered ? 200 : 409, result)
    return
  }

  if (req.method === 'POST' && url.pathname === '/players/restore') {
    let body
    try {
      body = await readJsonBody(req)
    } catch {
      writeJson(res, 400, { error: 'Invalid JSON body.' })
      return
    }

    const playerName = cleanName(body.playerName)
    const recoveryCode = cleanRecoveryCode(body.recoveryCode)
    const playerId = cleanPlayerId(body.playerId)
    if (!playerName || !recoveryCode || !playerId) {
      writeJson(res, 400, { error: 'A valid player name, recovery code, and player id are required.' })
      return
    }

    await ensurePlayerNameSchema()
    const result = await restorePlayerName({ playerName, recoveryCode, playerId })
    writeJson(res, result.restored ? 200 : 403, result)
    return
  }

  if (url.pathname === '/players/progress') {
    await ensurePlayerNameSchema()
    if (req.method === 'GET') {
      const playerId = cleanPlayerId(url.searchParams.get('playerId'))
      if (!playerId) {
        writeJson(res, 400, { error: 'A valid player id is required.' })
        return
      }

      const progress = await getPlayerProgress(playerId)
      writeJson(res, 200, { progress })
      return
    }

    if (req.method === 'POST') {
      let body
      try {
        body = await readJsonBody(req)
      } catch {
        writeJson(res, 400, { error: 'Invalid JSON body.' })
        return
      }

      const playerId = cleanPlayerId(body.playerId)
      if (!playerId) {
        writeJson(res, 400, { error: 'A valid player id is required.' })
        return
      }

      const result = await savePlayerProgress(playerId, body.progress)
      writeJson(res, result.saved ? 200 : 404, result)
      return
    }
  }

  writeJson(res, 404, { error: 'Player route not found.' })
}

async function ensureLeaderboardSchema() {
  if (!leaderboardPool) throw new Error('Leaderboard database is not configured.')
  if (!leaderboardSchemaPromise) {
    leaderboardSchemaPromise = leaderboardPool.query(`
      CREATE TABLE IF NOT EXISTS leaderboard_scores (
        id BIGSERIAL PRIMARY KEY,
        mode TEXT NOT NULL CHECK (mode IN ('ship_defense_normal', 'ship_defense_endless', 'gradius_solo', 'gradius_endless', 'gradius_boss_rush', 'gradius_multiplayer')),
        player_name TEXT NOT NULL,
        score INTEGER NOT NULL CHECK (score >= 0),
        ship_key TEXT,
        stage INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE leaderboard_scores DROP CONSTRAINT IF EXISTS leaderboard_scores_mode_check;
      ALTER TABLE leaderboard_scores ADD CONSTRAINT leaderboard_scores_mode_check
        CHECK (mode IN ('ship_defense_normal', 'ship_defense_endless', 'gradius_solo', 'gradius_endless', 'gradius_boss_rush', 'gradius_multiplayer'));
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

async function ensurePlayerNameSchema() {
  if (!leaderboardPool) throw new Error('Player database is not configured.')
  if (!playerNameSchemaPromise) {
    playerNameSchemaPromise = leaderboardPool.query(`
      CREATE TABLE IF NOT EXISTS player_names (
        id BIGSERIAL PRIMARY KEY,
        player_id TEXT NOT NULL UNIQUE,
        player_name TEXT NOT NULL,
        normalized_name TEXT NOT NULL UNIQUE,
        recovery_code TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE player_names
        ADD COLUMN IF NOT EXISTS recovery_code TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS player_names_normalized_name_idx
        ON player_names (normalized_name);
      CREATE UNIQUE INDEX IF NOT EXISTS player_names_player_id_idx
        ON player_names (player_id);
      CREATE UNIQUE INDEX IF NOT EXISTS player_names_recovery_code_idx
        ON player_names (recovery_code)
        WHERE recovery_code IS NOT NULL;
      CREATE TABLE IF NOT EXISTS player_progress (
        player_id TEXT PRIMARY KEY,
        progress_json JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `).catch((error) => {
      playerNameSchemaPromise = null
      throw error
    })
  }

  return playerNameSchemaPromise
}

async function getPlayerNameStatus(playerName, playerId = null) {
  const normalizedName = normalizePlayerName(playerName)
  const result = await leaderboardPool.query(
    `
      SELECT player_id AS "playerId", player_name AS "playerName"
      FROM player_names
      WHERE normalized_name = $1
      LIMIT 1
    `,
    [normalizedName],
  )

  const existing = result.rows[0]
  const ownedByPlayer = Boolean(existing && playerId && existing.playerId === playerId)
  return {
    available: !existing || ownedByPlayer,
    taken: Boolean(existing && !ownedByPlayer),
    ownedByPlayer,
    playerName: existing?.playerName ?? playerName,
  }
}

async function registerPlayerName({ playerName, playerId }) {
  const normalizedName = normalizePlayerName(playerName)
  const client = await leaderboardPool.connect()

  try {
    await client.query('BEGIN')
    const existingName = await client.query(
      `
        SELECT player_id AS "playerId", player_name AS "playerName", recovery_code AS "recoveryCode"
        FROM player_names
        WHERE normalized_name = $1
        FOR UPDATE
      `,
      [normalizedName],
    )
    const nameOwner = existingName.rows[0]
    if (nameOwner && nameOwner.playerId !== playerId) {
      await client.query('ROLLBACK')
      return {
        registered: false,
        available: false,
        taken: true,
        reason: 'name_taken',
        playerName: nameOwner.playerName,
      }
    }

    const existingPlayer = await client.query(
      `
        SELECT id
        FROM player_names
        WHERE player_id = $1
        FOR UPDATE
      `,
      [playerId],
    )

    let saved
    if (existingPlayer.rows[0]) {
      const recoveryCode = nameOwner?.recoveryCode || generateRecoveryCode()
      const updateResult = await client.query(
        `
          UPDATE player_names
          SET player_name = $2,
              normalized_name = $3,
              recovery_code = COALESCE(recovery_code, $4),
              updated_at = NOW()
          WHERE player_id = $1
          RETURNING player_id AS "playerId", player_name AS "playerName", recovery_code AS "recoveryCode"
        `,
        [playerId, playerName, normalizedName, recoveryCode],
      )
      saved = updateResult.rows[0]
    } else {
      const recoveryCode = generateRecoveryCode()
      const insertResult = await client.query(
        `
          INSERT INTO player_names (player_id, player_name, normalized_name, recovery_code)
          VALUES ($1, $2, $3, $4)
          RETURNING player_id AS "playerId", player_name AS "playerName", recovery_code AS "recoveryCode"
        `,
        [playerId, playerName, normalizedName, recoveryCode],
      )
      saved = insertResult.rows[0]
    }

    await client.query('COMMIT')
    const progress = await getPlayerProgress(saved.playerId)
    return {
      registered: true,
      available: true,
      taken: false,
      ownedByPlayer: true,
      playerId: saved.playerId,
      playerName: saved.playerName,
      recoveryCode: saved.recoveryCode,
      progress,
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    if (error?.code === '23505') {
      return {
        registered: false,
        available: false,
        taken: true,
        reason: 'name_taken',
        playerName,
      }
    }
    throw error
  } finally {
    client.release()
  }
}

async function restorePlayerName({ playerName, recoveryCode, playerId }) {
  const normalizedName = normalizePlayerName(playerName)
  const client = await leaderboardPool.connect()

  try {
    await client.query('BEGIN')
    const existingName = await client.query(
      `
        SELECT player_id AS "playerId", player_name AS "playerName", recovery_code AS "recoveryCode"
        FROM player_names
        WHERE normalized_name = $1
        FOR UPDATE
      `,
      [normalizedName],
    )
    const owner = existingName.rows[0]
    if (!owner || cleanRecoveryCode(owner.recoveryCode) !== recoveryCode) {
      await client.query('ROLLBACK')
      return { restored: false, reason: 'invalid_recovery_code' }
    }

    await client.query('COMMIT')
    const progress = await getPlayerProgress(owner.playerId)
    return {
      restored: true,
      registered: true,
      playerId: owner.playerId,
      playerName: owner.playerName,
      recoveryCode: owner.recoveryCode,
      progress,
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    if (error?.code === '23505') {
      return { restored: false, reason: 'player_id_conflict' }
    }
    throw error
  } finally {
    client.release()
  }
}

async function getPlayerProgress(playerId) {
  const result = await leaderboardPool.query(
    `
      SELECT progress_json AS "progress"
      FROM player_progress
      WHERE player_id = $1
      LIMIT 1
    `,
    [playerId],
  )

  return result.rows[0]?.progress ?? null
}

async function savePlayerProgress(playerId, progress) {
  const playerExists = await leaderboardPool.query(
    `
      SELECT 1
      FROM player_names
      WHERE player_id = $1
      LIMIT 1
    `,
    [playerId],
  )
  if (!playerExists.rows[0]) return { saved: false, reason: 'player_not_registered' }

  await leaderboardPool.query(
    `
      INSERT INTO player_progress (player_id, progress_json, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (player_id)
      DO UPDATE SET
        progress_json = EXCLUDED.progress_json,
        updated_at = NOW()
    `,
    [playerId, progress ?? {}],
  )
  return { saved: true }
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
      if (totalBytes > API_BODY_LIMIT_BYTES) {
        reject(new Error('Request body is too large.'))
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
      peer.visualShipKey = cleanVisualShipKey(message.visualShipKey, peer.shipKey)
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
      peer.visualShipKey = cleanVisualShipKey(message.visualShipKey, peer.shipKey)
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
      peer.visualShipKey = cleanVisualShipKey(message.visualShipKey, peer.shipKey)
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
        visualShipKey: peer?.visualShipKey || peer?.shipKey || 'rocket',
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

function normalizePlayerName(value) {
  return cleanName(value).toLocaleLowerCase('en-US')
}

function cleanPlayerId(value) {
  const playerId = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 96)

  return playerId.length >= 12 ? playerId : ''
}

function cleanRecoveryCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 32)
}

function generateRecoveryCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const chars = []
  const bytes = randomBytes(12)
  for (const byte of bytes) chars.push(alphabet[byte % alphabet.length])
  return `SD-${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}`
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
  const allowedShipKeys = new Set(['rocket', 'fast', 'gatling', 'laser', 'dreadnought', 'xwing', 'spaceEt', 'mesiah', 'coreLander'])
  return allowedShipKeys.has(shipKey) ? shipKey : 'rocket'
}

function cleanVisualShipKey(value, shipKey) {
  const visualShipKey = String(value || '').trim()
  const allowedVisualShipKeys = new Set(['rocket', 'fast', 'gatling', 'laser', 'dreadnought', 'xwing', 'spaceEt', 'mesiah', 'mesiahBlack', 'mesiahWhite', 'coreLander', 'coreLanderBurning', 'godGundam', 'godGundamBurning', 'spiegel'])
  if (!allowedVisualShipKeys.has(visualShipKey)) return shipKey
  if (shipKey === 'mesiah') {
    return ['mesiah', 'mesiahBlack', 'mesiahWhite'].includes(visualShipKey) ? visualShipKey : 'mesiah'
  }
  if (shipKey === 'coreLander') {
    return ['coreLander', 'coreLanderBurning', 'godGundam', 'godGundamBurning', 'spiegel'].includes(visualShipKey) ? visualShipKey : 'coreLander'
  }
  return visualShipKey === shipKey ? visualShipKey : shipKey
}

function cleanOptionalShipKey(value) {
  if (value === null || value === undefined || value === '') return null

  const shipKey = cleanShipKey(value)
  return shipKey || null
}

function randomId() {
  return randomBytes(8).toString('hex')
}
