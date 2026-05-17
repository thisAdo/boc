import config from '../config.js'

export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function normalizeJid(jid = '') {
  if (jid && typeof jid === 'object') jid = jid?.id || jid?.jid || jid?.phoneNumber || jid?.lid || ''
  return String(jid || '')
    .trim()
    .replace(/:\d+(?=@)/, '')
    .toLowerCase()
}

export function isLidJid(jid = '') {
  const value = normalizeJid(jid)
  return value.endsWith('@lid')
}

export function isPhoneJid(jid = '') {
  const value = normalizeJid(jid)
  return value.endsWith('@s.whatsapp.net') || value.endsWith('@c.us')
}

export function jidToNumber(jid = '') {
  return String(jid || '').replace(/[^\d]/g, '')
}

export function isGroupJid(jid = '') {
  return normalizeJid(jid).endsWith('@g.us')
}

export function bool(value) {
  return value === true || value === 1
}

export function boolInt(value) {
  return value ? true : false
}

export function nowIso() {
  return new Date().toISOString()
}

export function cleanName(name = '', max = 120) {
  return String(name || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

export function truncate(text = '', max = config.limits.commandReplyLength) {
  const value = String(text ?? '')
  return value.length > max ? `${value.slice(0, max)}\n...` : value
}

export function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function unwrapMessage(message = {}) {
  let current = message
  if (current?.ephemeralMessage?.message) current = current.ephemeralMessage.message
  if (current?.viewOnceMessage?.message) current = current.viewOnceMessage.message
  if (current?.viewOnceMessageV2?.message) current = current.viewOnceMessageV2.message
  if (current?.viewOnceMessageV2Extension?.message) current = current.viewOnceMessageV2Extension.message
  if (current?.documentWithCaptionMessage?.message) current = current.documentWithCaptionMessage.message
  return current || {}
}

export function getMessageText(message = {}) {
  const msg = unwrapMessage(message)
  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.documentMessage?.caption ||
    msg.buttonsResponseMessage?.selectedButtonId ||
    msg.listResponseMessage?.singleSelectReply?.selectedRowId ||
    msg.templateButtonReplyMessage?.selectedId ||
    ''
  ).trim()
}

export function getIncomingText(m) {
  return getMessageText(m?.message || {})
}

export function getQuotedMessage(m) {
  const msg = unwrapMessage(m?.message || {})
  const context = msg?.extendedTextMessage?.contextInfo || msg?.imageMessage?.contextInfo || msg?.videoMessage?.contextInfo || msg?.documentMessage?.contextInfo
  if (!context?.quotedMessage) return null
  return { message: unwrapMessage(context.quotedMessage) }
}

export function getSenderJid(m) {
  const from = normalizeJid(m?.key?.remoteJid || '')
  const fromAlt = normalizeJid(m?.key?.remoteJidAlt || m?.remoteJidAlt || '')

  if (!isGroupJid(from)) {
    if (isPhoneJid(from)) return from
    if (isPhoneJid(fromAlt)) return fromAlt
    return from || fromAlt
  }

  const participant = normalizeJid(m?.key?.participant || m?.participant || '')
  const participantAlt = normalizeJid(m?.key?.participantAlt || m?.participantAlt || '')

  if (isPhoneJid(participantAlt)) return participantAlt
  if (isPhoneJid(participant)) return participant
  return participantAlt || participant
}

export function getSenderCandidates(m) {
  const values = [
    m?.key?.participantAlt,
    m?.participantAlt,
    m?.key?.participant,
    m?.participant,
    m?.key?.remoteJidAlt,
    m?.remoteJidAlt,
    getSenderJid(m)
  ]

  return buildCandidateJids(values)
}

export function isOwnerJid(jid = '') {
  const number = jidToNumber(jid)
  return config.owners.map(owner => jidToNumber(owner)).includes(number)
}

export function mentionTag(jid = '') {
  const number = jidToNumber(jid)
  if (number) return `@${number}`
  const id = normalizeJid(jid).split('@')[0]
  return id ? `@${id}` : '@usuario'
}

export function mentionJid(jid = '') {
  const number = jidToNumber(jid)
  return number ? `${number}@s.whatsapp.net` : normalizeJid(jid)
}

export function isAdminFlag(value) {
  return value === 'admin' || value === 'superadmin' || value === true || value === 'admin_add'
}

export function buildCandidateJids(...values) {
  const result = []
  for (const raw of values.flat(Infinity)) {
    if (!raw) continue
    const jid = normalizeJid(raw)
    if (!jid || jid === '[object object]') continue

    result.push(jid)

    const number = jidToNumber(jid)
    if (number) {
      result.push(number)
      result.push(`${number}@s.whatsapp.net`)
      result.push(`${number}@c.us`)
    }
  }
  return Array.from(new Set(result))
}

export function findParticipant(meta, candidates = []) {
  const participants = meta?.participants || []
  const candidateJids = candidates.filter(Boolean).map(normalizeJid)
  const candidateSet = new Set(candidateJids)
  const candidateNumbers = new Set(candidateJids.map(jidToNumber).filter(Boolean))

  for (const participant of participants) {
    const values = [
      normalizeJid(participant?.id || ''),
      normalizeJid(participant?.jid || ''),
      normalizeJid(participant?.lid || ''),
      normalizeJid(participant?.phoneNumber || participant?.pn || '')
    ].filter(Boolean)

    for (const value of values) {
      if (candidateSet.has(value)) return participant
      const number = jidToNumber(value)
      if (number && candidateNumbers.has(number)) return participant
    }
  }

  return null
}

export async function safeSend(sock, jid, content, quoted = null) {
  try {
    if (quoted) return await sock.sendMessage(jid, content, { quoted })
    return await sock.sendMessage(jid, content)
  } catch {
    return null
  }
}

export async function reply(sock, m, text, extra = {}) {
  const from = normalizeJid(m?.key?.remoteJid || '')
  if (!from) return null
  return await safeSend(sock, from, { text: truncate(text), ...extra }, m)
}

export async function react(sock, m, emoji) {
  try {
    return await sock.sendMessage(m.key.remoteJid, { react: { text: emoji, key: m.key } })
  } catch {
    return null
  }
}

export async function markMessageRead(sock, m) {
  const key = m?.key
  if (!key?.id || !key?.remoteJid) return
  try {
    await sock.readMessages([key])
  } catch {}
}

export function parseCommand(text, prefix = config.prefix) {
  const body = String(text || '').trim()
  if (!body || !body.startsWith(prefix)) return null

  const withoutPrefix = body.slice(prefix.length).trim()
  if (!withoutPrefix) return null

  const pieces = withoutPrefix.split(/\s+/)
  const command = (pieces.shift() || '').toLowerCase()
  const args = pieces
  const input = withoutPrefix.slice(command.length).trim()

  return {
    body,
    command,
    args,
    input,
    prefix
  }
}

export async function getGroupMeta(sock, jid) {
  try {
    return await sock.groupMetadata(jid)
  } catch {
    return null
  }
}

export async function isUserAdmin(sock, m) {
  const chatJid = normalizeJid(m?.key?.remoteJid || '')
  if (!isGroupJid(chatJid)) return false
  const meta = await getGroupMeta(sock, chatJid)
  if (!meta?.participants?.length) return false

  const participant = findParticipant(meta, getSenderCandidates(m))
  return isAdminFlag(participant?.admin) || participant?.isAdmin === true || participant?.isSuperAdmin === true
}

export async function isBotAdmin(sock, m) {
  const chatJid = normalizeJid(m?.key?.remoteJid || '')
  if (!isGroupJid(chatJid)) return false
  const meta = await getGroupMeta(sock, chatJid)
  if (!meta?.participants?.length) return false

  const user = sock?.user || {}
  const participant = findParticipant(meta, buildCandidateJids(
    user.id,
    user.jid,
    user.lid,
    user.phoneNumber,
    user.pn,
    user.user,
    user.me?.id,
    user.me?.jid,
    user.me?.lid,
    user.me?.phoneNumber,
    jidToNumber(user.id),
    jidToNumber(user.jid),
    jidToNumber(user.lid),
    jidToNumber(user.phoneNumber),
    jidToNumber(user.pn)
  ))

  return isAdminFlag(participant?.admin) || participant?.isAdmin === true || participant?.isSuperAdmin === true
}

export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / (1024 ** index)).toFixed(2)} ${units[index]}`
}

export function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const parts = []
  if (days) parts.push(`${days}d`)
  if (hours) parts.push(`${hours}h`)
  if (minutes) parts.push(`${minutes}m`)
  parts.push(`${secs}s`)
  return parts.join(' ')
}

export function sortByText(items = [], pick = item => item) {
  return [...items].sort((a, b) => String(pick(a)).localeCompare(String(pick(b))))
}
