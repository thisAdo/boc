import Database from 'better-sqlite3'

const sql = new Database('./database.db', { fileMustExist: false, timeout: 10000 })

sql.exec(`
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS chats (id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tokens (
  token TEXT PRIMARY KEY,
  uses_left INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  used_by TEXT
);
`)

const statements = {
  saveUser: sql.prepare('INSERT OR REPLACE INTO users (id, data) VALUES (?, ?)'),
  saveChat: sql.prepare('INSERT OR REPLACE INTO chats (id, data) VALUES (?, ?)'),
  saveSetting: sql.prepare('INSERT OR REPLACE INTO settings (id, data) VALUES (?, ?)'),
  deleteUser: sql.prepare('DELETE FROM users WHERE id = ?'),
  deleteChat: sql.prepare('DELETE FROM chats WHERE id = ?'),

  saveToken: sql.prepare(
    'INSERT OR REPLACE INTO tokens (token, uses_left, expires_at, created_by, used_by) VALUES (?, ?, ?, ?, ?)'
  ),
  getToken: sql.prepare('SELECT * FROM tokens WHERE token = ?'),
  updateToken: sql.prepare('UPDATE tokens SET uses_left = ?, used_by = ? WHERE token = ?'),
  deleteToken: sql.prepare('DELETE FROM tokens WHERE token = ?'),
  listTokens: sql.prepare('SELECT * FROM tokens'),
}

export const tokenDB = {
  create(token: string, usesLeft: number, expiresAt: number, createdBy: string) {
    statements.saveToken.run(token, usesLeft, expiresAt, createdBy, null)
  },
  get(token: string) {
    return statements.getToken.get(token) as
      | {
          token: string
          uses_left: number
          expires_at: number
          created_by: string
          used_by: string | null
        }
      | undefined
  },
  consume(token: string, usedBy: string) {
    const t = tokenDB.get(token)
    if (!t) return false
    statements.updateToken.run(t.uses_left - 1, usedBy, token)
    return true
  },
  delete(token: string) {
    statements.deleteToken.run(token)
  },
  list() {
    return statements.listTokens.all() as {
      token: string
      uses_left: number
      expires_at: number
      created_by: string
      used_by: string | null
    }[]
  },
  isValid(token: string): { valid: boolean; reason?: string; data?: any } {
    const t = tokenDB.get(token)
    if (!t) return { valid: false, reason: 'Token no existe' }
    if (Date.now() > t.expires_at) return { valid: false, reason: 'Token expirado' }
    if (t.uses_left <= 0) return { valid: false, reason: 'Token sin usos disponibles' }
    return { valid: true, data: t }
  },
}

function persist(table: string, entryId: string, payload: any) {
  try {
    if (table === 'users') statements.saveUser.run(entryId, JSON.stringify(payload))
    if (table === 'chats') statements.saveChat.run(entryId, JSON.stringify(payload))
    if (table === 'settings') statements.saveSetting.run(entryId, JSON.stringify(payload))
  } catch (error) {
    console.error(`[SQLite Error] Fallo al guardar ${table}:`, error)
  }
}

function createDeepProxy(table: string, entryId: string, targetObject: any): any {
  return new Proxy(targetObject, {
    get(target, property) {
      const value = target[property]
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return createDeepProxy(table, entryId, value)
      }
      return value
    },
    set(target, property, newValue) {
      target[property] = newValue
      persist(table, entryId, targetObject)
      return true
    },
  })
}

function loadDB() {
  const memoryDB: any = { users: {}, chats: {}, settings: {}, __loaded: false }

  const storedUsers = sql.prepare('SELECT id, data FROM users').all()
  for (const { id, data } of storedUsers as any[]) {
    memoryDB.users[id] = createDeepProxy('users', id, JSON.parse(data))
  }

  const storedChats = sql.prepare('SELECT id, data FROM chats').all()
  for (const { id, data } of storedChats as any[]) {
    memoryDB.chats[id] = createDeepProxy('chats', id, JSON.parse(data))
  }

  const storedSettings = sql.prepare('SELECT id, data FROM settings').all()
  for (const { id, data } of storedSettings as any[]) {
    memoryDB.settings[id] = createDeepProxy('settings', id, JSON.parse(data))
  }

  const createTopLevelProxy = (table: string) =>
    new Proxy(memoryDB[table], {
      set(target, entryId: string, newValue: any) {
        target[entryId] = createDeepProxy(table, entryId, newValue)
        persist(table, entryId, newValue)
        return true
      },
    })

  memoryDB.users = createTopLevelProxy('users')
  memoryDB.chats = createTopLevelProxy('chats')
  memoryDB.settings = createTopLevelProxy('settings')

  memoryDB.deleteUser = (id: string) => {
    delete memoryDB.users[id]
    statements.deleteUser.run(id)
  }
  memoryDB.deleteChat = (id: string) => {
    delete memoryDB.chats[id]
    statements.deleteChat.run(id)
  }

  memoryDB.__loaded = true
  console.log('SQLite: Base de datos cargada y sincronizada.')
  return memoryDB
}

export { sql, loadDB }
