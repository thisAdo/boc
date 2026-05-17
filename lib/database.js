import fs from 'fs/promises'
import path from 'path'
import { Pool } from 'pg'
import config from '../config.js'
import { bool, boolInt, cleanName, normalizeJid, nowIso } from './helpers.js'

const DATABASE_URL = config.databaseUrl
const LEGACY_EVENTS_PATH = path.resolve(config.legacyGroupEventsPath)

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000
})

let dbReady = false
let dbInit = null
const userNameCache = new Map()

function rowToState(row) {
  if (!row || typeof row !== 'object') return null
  return {
    antilink: bool(row.antilink),
    welcome: bool(row.welcome),
    avisos: bool(row.avisos)
  }
}

function jsonValue(value) {
  return JSON.stringify(value ?? null)
}

async function createTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS group_events (
      jid TEXT PRIMARY KEY,
      antilink BOOLEAN NOT NULL DEFAULT false,
      welcome BOOLEAN NOT NULL DEFAULT false,
      avisos BOOLEAN NOT NULL DEFAULT false,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS command_seen (
      chat_jid TEXT NOT NULL,
      sender_jid TEXT NOT NULL,
      command TEXT NOT NULL,
      seen BOOLEAN NOT NULL DEFAULT true,
      used_count INTEGER NOT NULL DEFAULT 1,
      last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (chat_jid, sender_jid, command)
    );

    CREATE INDEX IF NOT EXISTS idx_command_seen_chat_used
      ON command_seen (chat_jid, used_count DESC, last_used_at DESC);

    CREATE TABLE IF NOT EXISTS users (
      jid TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS store (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT 'null'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
}

async function migrateLegacyEvents() {
  const existing = await pool.query('SELECT COUNT(*)::int AS total FROM group_events')
  if ((existing.rows[0]?.total || 0) > 0) return

  let raw = ''
  try {
    raw = await fs.readFile(LEGACY_EVENTS_PATH, 'utf8')
  } catch {
    return
  }

  let parsed = null
  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = null
  }

  if (!parsed || typeof parsed !== 'object') return

  for (const [jid, state] of Object.entries(parsed)) {
    const groupJid = normalizeJid(jid)
    if (!groupJid.endsWith('@g.us')) continue

    await pool.query(
      `INSERT INTO group_events (jid, antilink, welcome, avisos, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (jid) DO NOTHING`,
      [
        groupJid,
        boolInt(!!state?.antilink),
        boolInt(!!state?.welcome),
        boolInt(!!state?.avisos),
        nowIso()
      ]
    )
  }
}

async function ensureDbReady() {
  if (dbReady) return true

  if (!dbInit) {
    dbInit = (async () => {
      if (!DATABASE_URL) throw new Error('Falta config.databaseUrl para PostgreSQL')
      await createTables()
      await migrateLegacyEvents()
      dbReady = true
      return true
    })()
  }

  try {
    return await dbInit
  } catch (error) {
    dbInit = null
    throw error
  }
}

async function getGroupEvents(groupJid) {
  const jid = normalizeJid(groupJid)
  if (!jid.endsWith('@g.us')) return null
  await ensureDbReady()

  const { rows } = await pool.query(
    'SELECT antilink, welcome, avisos FROM group_events WHERE jid = $1 LIMIT 1',
    [jid]
  )

  return rowToState(rows[0])
}

async function saveGroupEvents(groupJid, state = {}) {
  const jid = normalizeJid(groupJid)
  if (!jid.endsWith('@g.us')) throw new Error('Grupo inválido')

  await ensureDbReady()

  const payload = {
    antilink: boolInt(!!state.antilink),
    welcome: boolInt(!!state.welcome),
    avisos: boolInt(!!state.avisos)
  }

  await pool.query(
    `INSERT INTO group_events (jid, antilink, welcome, avisos, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (jid)
     DO UPDATE SET
       antilink = EXCLUDED.antilink,
       welcome = EXCLUDED.welcome,
       avisos = EXCLUDED.avisos,
       updated_at = NOW()`,
    [jid, payload.antilink, payload.welcome, payload.avisos]
  )

  return payload
}

async function markCommandSeen({ chatJid, senderJid, command }) {
  const chat = normalizeJid(chatJid)
  const sender = normalizeJid(senderJid)
  const cmd = String(command || '').toLowerCase().trim()
  if (!chat || !sender || !cmd) return false

  await ensureDbReady()

  await pool.query(
    `INSERT INTO command_seen (chat_jid, sender_jid, command, seen, used_count, last_used_at)
     VALUES ($1, $2, $3, true, 1, NOW())
     ON CONFLICT (chat_jid, sender_jid, command)
     DO UPDATE SET
       seen = true,
       used_count = command_seen.used_count + 1,
       last_used_at = NOW()`,
    [chat, sender, cmd]
  )

  return true
}

async function upsertUser({ jid, name }) {
  const userJid = normalizeJid(jid)
  const userName = cleanName(name)
  if (!userJid || !userName) return false

  await ensureDbReady()

  await pool.query(
    `INSERT INTO users (jid, name, last_seen_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (jid)
     DO UPDATE SET name = EXCLUDED.name, last_seen_at = NOW()`,
    [userJid, userName]
  )

  userNameCache.set(userJid, userName)
  return true
}

async function getUserName(jid) {
  const userJid = normalizeJid(jid)
  if (!userJid) return null
  if (userNameCache.has(userJid)) return userNameCache.get(userJid)

  await ensureDbReady()

  const { rows } = await pool.query(
    'SELECT name FROM users WHERE jid = $1 LIMIT 1',
    [userJid]
  )

  const name = cleanName(rows[0]?.name || '')
  if (name) userNameCache.set(userJid, name)
  return name || null
}

async function getTopCommands({ chatJid = '', limit = 10 } = {}) {
  const chat = normalizeJid(chatJid)
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10))
  await ensureDbReady()

  const params = []
  let where = ''

  if (chat) {
    params.push(chat)
    where = 'WHERE chat_jid = $1'
  }

  params.push(safeLimit)

  const { rows } = await pool.query(
    `SELECT chat_jid, sender_jid, command, seen, used_count, last_used_at
     FROM command_seen
     ${where}
     ORDER BY used_count DESC, last_used_at DESC
     LIMIT $${params.length}`,
    params
  )

  return rows.map(row => ({
    ...row,
    seen: bool(row.seen),
    last_used_at: row.last_used_at instanceof Date ? row.last_used_at.toISOString() : row.last_used_at
  }))
}

async function storeGet(key) {
  await ensureDbReady()

  const { rows } = await pool.query(
    'SELECT value FROM store WHERE key = $1 LIMIT 1',
    [String(key)]
  )

  return rows[0]?.value ?? null
}

async function storeSet(key, value) {
  await ensureDbReady()

  await pool.query(
    `INSERT INTO store (key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [String(key), jsonValue(value)]
  )

  return value
}

async function storeDel(key) {
  await ensureDbReady()
  await pool.query('DELETE FROM store WHERE key = $1', [String(key)])
  return true
}

async function storeIncr(key, by = 1) {
  await ensureDbReady()

  const amount = Number(by) || 1
  const { rows } = await pool.query(
    `INSERT INTO store (key, value, updated_at)
     VALUES ($1, to_jsonb($2::numeric), NOW())
     ON CONFLICT (key)
     DO UPDATE SET
       value = to_jsonb(COALESCE((store.value #>> '{}')::numeric, 0) + $2::numeric),
       updated_at = NOW()
     RETURNING value`,
    [String(key), amount]
  )

  return Number(rows[0]?.value || 0)
}

async function close() {
  await pool.end()
}

function buildRuntime() {
  return {
    path: 'postgresql',
    init: ensureDbReady,
    close,
    getGroupEvents,
    saveGroupEvents,
    markCommandSeen,
    upsertUser,
    getUserName,
    getTopCommands,
    get: storeGet,
    set: storeSet,
    del: storeDel,
    incr: storeIncr
  }
}

function ensureGlobalRuntime() {
  if (global?.dbsq) return global.dbsq
  const runtime = buildRuntime()
  global.dbsq = runtime
  return runtime
}

export function getDb() {
  return ensureGlobalRuntime()
}

export async function setupDb() {
  const runtime = ensureGlobalRuntime()
  await runtime.init()
  return runtime
}
