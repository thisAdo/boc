import pg from 'pg'

const { Pool } = pg

const DATABASE_URL =
  'postgresql://neondb_owner:npg_TRw7C5AxnEYK@ep-plain-voice-abt4ve8o.eu-west-2.aws.neon.tech/neondb?sslmode=require'

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

type TableName = 'users' | 'chats' | 'settings'

const TABLES: Record<TableName, string> = {
  users: 'users',
  chats: 'chats',
  settings: 'settings',
}

async function createTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tokens (
      token TEXT PRIMARY KEY,
      uses_left INTEGER NOT NULL,
      expires_at BIGINT NOT NULL,
      created_by TEXT NOT NULL,
      used_by TEXT
    );
  `)
}

function normalizeData(data: any) {
  if (!data) return {}
  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch {
      return {}
    }
  }
  return data
}

async function persist(table: TableName, entryId: string, payload: any) {
  try {
    const tableName = TABLES[table]
    await pool.query(
      `INSERT INTO ${tableName} (id, data)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (id)
       DO UPDATE SET data = EXCLUDED.data`,
      [entryId, JSON.stringify(payload ?? {})]
    )
  } catch (error) {
    console.error(`[PostgreSQL Error] Fallo al guardar ${table}:`, error)
  }
}

function createDeepProxy(table: TableName, entryId: string, targetObject: any, rootObject = targetObject): any {
  if (!targetObject || typeof targetObject !== 'object') return targetObject

  return new Proxy(targetObject, {
    get(target, property) {
      const value = target[property as keyof typeof target]
      if (value && typeof value === 'object') {
        return createDeepProxy(table, entryId, value, rootObject)
      }
      return value
    },
    set(target, property, newValue) {
      target[property as keyof typeof target] = newValue
      void persist(table, entryId, rootObject)
      return true
    },
    deleteProperty(target, property) {
      delete target[property as keyof typeof target]
      void persist(table, entryId, rootObject)
      return true
    },
  })
}

function createTopLevelProxy(table: TableName, targetObject: Record<string, any>) {
  return new Proxy(targetObject, {
    set(target, entryId: string, newValue: any) {
      const id = String(entryId)
      target[id] = createDeepProxy(table, id, newValue)
      void persist(table, id, newValue)
      return true
    },
    deleteProperty(target, entryId: string) {
      const id = String(entryId)
      delete target[id]
      void pool.query(`DELETE FROM ${TABLES[table]} WHERE id = $1`, [id]).catch(error => {
        console.error(`[PostgreSQL Error] Fallo al eliminar ${table}:`, error)
      })
      return true
    },
  })
}

async function loadTable(table: TableName) {
  const { rows } = await pool.query(`SELECT id, data FROM ${TABLES[table]}`)
  const entries: Record<string, any> = {}

  for (const row of rows) {
    const payload = normalizeData(row.data)
    entries[row.id] = createDeepProxy(table, row.id, payload)
  }

  return createTopLevelProxy(table, entries)
}

export const tokenDB = {
  async create(token: string, usesLeft: number, expiresAt: number, createdBy: string) {
    await pool.query(
      `INSERT INTO tokens (token, uses_left, expires_at, created_by, used_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (token)
       DO UPDATE SET
         uses_left = EXCLUDED.uses_left,
         expires_at = EXCLUDED.expires_at,
         created_by = EXCLUDED.created_by,
         used_by = EXCLUDED.used_by`,
      [token, usesLeft, expiresAt, createdBy, null]
    )
  },

  async get(token: string) {
    const { rows } = await pool.query('SELECT * FROM tokens WHERE token = $1', [token])
    const row = rows[0]
    if (!row) return undefined

    return {
      token: row.token as string,
      uses_left: Number(row.uses_left),
      expires_at: Number(row.expires_at),
      created_by: row.created_by as string,
      used_by: row.used_by as string | null,
    }
  },

  async consume(token: string, usedBy: string) {
    const t = await tokenDB.get(token)
    if (!t) return false

    await pool.query('UPDATE tokens SET uses_left = $1, used_by = $2 WHERE token = $3', [
      t.uses_left - 1,
      usedBy,
      token,
    ])

    return true
  },

  async delete(token: string) {
    await pool.query('DELETE FROM tokens WHERE token = $1', [token])
  },

  async list() {
    const { rows } = await pool.query('SELECT * FROM tokens')
    return rows.map(row => ({
      token: row.token as string,
      uses_left: Number(row.uses_left),
      expires_at: Number(row.expires_at),
      created_by: row.created_by as string,
      used_by: row.used_by as string | null,
    }))
  },

  async isValid(token: string): Promise<{ valid: boolean; reason?: string; data?: any }> {
    const t = await tokenDB.get(token)
    if (!t) return { valid: false, reason: 'Token no existe' }
    if (Date.now() > t.expires_at) return { valid: false, reason: 'Token expirado' }
    if (t.uses_left <= 0) return { valid: false, reason: 'Token sin usos disponibles' }
    return { valid: true, data: t }
  },
}

function loadDB() {
  const memoryDB: any = {
    users: {},
    chats: {},
    settings: {},
    data: { users: {}, chats: {}, settings: {} },
    __loaded: false,
  }

  ;(async () => {
    try {
      await createTables()

      memoryDB.users = await loadTable('users')
      memoryDB.chats = await loadTable('chats')
      memoryDB.settings = await loadTable('settings')
      memoryDB.data = {
        users: memoryDB.users,
        chats: memoryDB.chats,
        settings: memoryDB.settings,
      }

      memoryDB.deleteUser = (id: string) => {
        delete memoryDB.users[id]
      }

      memoryDB.deleteChat = (id: string) => {
        delete memoryDB.chats[id]
      }

      memoryDB.__loaded = true
      console.log('PostgreSQL: Base de datos cargada y sincronizada.')
    } catch (error) {
      console.error('[PostgreSQL Error] No se pudo cargar la base de datos:', error)
      memoryDB.__loaded = true
    }
  })()

  return memoryDB
}

export { pool as sql, loadDB }
