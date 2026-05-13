import * as baileys from '@whiskeysockets/baileys'
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  jidDecode,
  Browsers,
} = baileys
import pino from 'pino'
import { smsg } from './lib/simple.js'
import { loadDB } from './lib/db/data.js'
import handler, { pluginsReady } from './handler.js'
import chalk from 'chalk'
import config from './config.js'
import axios from 'axios'
import fs from 'fs'
import readline from 'readline'
import path from 'path'
;(global as any).comandos = new Map()

const groupMetaCache =
  (global as any).groupMetaCache || ((global as any).groupMetaCache = new Map())

const c = {
  border: chalk.hex('#7C3AED'),
  title: chalk.hex('#A78BFA').bold,
  label: chalk.hex('#C4B5FD').bold,
  value: chalk.hex('#EDE9FE'),
  success: chalk.hex('#8B5CF6').bold,
  error: chalk.hex('#F87171').bold,
  dim: chalk.hex('#6D28D9'),
  input: chalk.hex('#DDD6FE'),
  warn: chalk.hex('#FCD34D').bold,
}

const BOX_TOP = c.border('╭───────────────────────────────────────╮')
const BOX_BOT = c.border('╰───────────────────────────────────────╯')
const BAR = c.border('│')

const AUTH_FOLDER = 'auth'
const MAX_RETRIES = 5
const CACHE_MAX_MB = 100

let retryCount = 0

function clearSession() {
  try {
    if (fs.existsSync(AUTH_FOLDER)) {
      fs.rmSync(AUTH_FOLDER, { recursive: true, force: true })
      console.log('\n' + BOX_TOP)
      console.log(`${BAR}  ${c.warn('⚠  Sesión eliminada automáticamente')}      ${BAR}`)
      console.log(`${BAR}  ${c.dim('Reinicia para vincular de nuevo')}          ${BAR}`)
      console.log(BOX_BOT + '\n')
    }
  } catch (e) {
    console.error(c.error('Error al limpiar sesión:'), e)
  }
}

function cleanCache() {
  try {
    const tmpFolder = './tmp'
    if (fs.existsSync(tmpFolder)) {
      const files = fs.readdirSync(tmpFolder)
      let cleaned = 0
      for (const file of files) {
        try {
          fs.unlinkSync(path.join(tmpFolder, file))
          cleaned++
        } catch {}
      }
      if (cleaned > 0) console.log(c.dim(`[ 🧹 ] Cache: ${cleaned} archivos eliminados`))
    }
    if (fs.existsSync(AUTH_FOLDER)) {
      const getFolderSizeMB = (dir: string): number => {
        let total = 0
        for (const file of fs.readdirSync(dir)) {
          try {
            const filePath = path.join(dir, file)
            const stat = fs.statSync(filePath)
            total += stat.isDirectory() ? getFolderSizeMB(filePath) : stat.size
          } catch {}
        }
        return total / (1024 * 1024)
      }
      const sizeMB = getFolderSizeMB(AUTH_FOLDER)
      if (sizeMB > CACHE_MAX_MB) {
        console.log(c.warn(`[ ⚠ ] Auth ${sizeMB.toFixed(1)}MB — limpiando...`))
        const safeDelete = (dir: string) => {
          for (const file of fs.readdirSync(dir)) {
            const filePath = path.join(dir, file)
            const stat = fs.statSync(filePath)
            if (stat.isDirectory()) {
              safeDelete(filePath)
            } else if (!file.includes('creds') && !file.startsWith('session-')) {
              try {
                fs.unlinkSync(filePath)
              } catch {}
            }
          }
        }
        safeDelete(AUTH_FOLDER)
      }
    }
  } catch (e) {
    console.error(c.error('Error en cleanCache: '), e)
  }
}

async function getGroupMeta(sock: any, groupId: string) {
  const cached = groupMetaCache.get(groupId)
  if (cached && Date.now() - cached.ts < 5 * 60 * 1000) return cached.data
  const data = await sock.groupMetadata(groupId).catch(() => null)
  if (data) groupMetaCache.set(groupId, { data, ts: Date.now() })
  return data
}

function question(prompt: string): Promise<string> {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(prompt, ans => {
      rl.close()
      rl.removeAllListeners()
      resolve(ans.trim())
    })
    rl.on('SIGINT', () => {
      rl.close()
      resolve('')
    })
  })
}

async function startBot() {
  await pluginsReady
  global.db = loadDB()
  function waitForDB() {
    return new Promise(resolve => {
      const check = setInterval(() => {
        if (global.db.__loaded) {
          clearInterval(check)
          resolve(null)
        }
      }, 50)
    })
  }
  await waitForDB()
  cleanCache()
  setInterval(cleanCache, 6 * 60 * 60 * 1000)

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER)
  const { version } = await fetchLatestBaileysVersion()
  const hasSession = !!state.creds?.registered

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
    },
    browser: Browsers.appropriate('Safari'),
    generateHighQualityLinkPreview: false,
    shouldIgnoreJid: (jid: string) => jid.endsWith('@broadcast'),
    syncFullHistory: false,
    markOnlineOnConnect: false,
    keepAliveIntervalMs: 30000,
  })

  sock.decodeJid = (jid: string) => {
    if (!jid) return jid
    if (/:\d+@/gi.test(jid)) {
      const decode = jidDecode(jid) || {}
      return decode.user && decode.server ? `${decode.user}@${decode.server}` : jid
    }
    return jid
  }

  sock.ev.on('creds.update', saveCreds)

  let pairingDone = false
  if (!hasSession) {
    sock.ev.on('connection.update', async ({ qr }: any) => {
      if (!qr || pairingDone) return
      pairingDone = true
      console.log('\n' + BOX_TOP)
      console.log(`${BAR}  ${c.title('✦  LURUS  —  VINCULAR SESIÓN  ✦')}      ${BAR}`)
      console.log(BOX_BOT)
      try {
        let phone = await question(
          '\n' + c.input('Número (código de país, sin +)\n') + c.dim('  ›') + ' '
        )
        phone = phone.replace(/\D/g, '')
        if (!phone || phone.length < 7) {
          console.log('\n' + c.error('  ✗ Número inválido.\n'))
          pairingDone = false
          return
        }
        const code = await sock.requestPairingCode(phone, 'LURUSBOT')
        const formatted = code.match(/.{1,4}/g)?.join(' - ') || code
        console.log('\n' + BOX_TOP)
        console.log(`${BAR}  ${c.label('CÓDIGO ›')} ${c.value(formatted)}                  ${BAR}`)
        console.log(`${BAR}  ${c.dim('WhatsApp → Dispositivos vinculados')}     ${BAR}`)
        console.log(`${BAR}  ${c.dim('→ Vincular con código de teléfono')}      ${BAR}`)
        console.log(BOX_BOT + '\n')
      } catch (err) {
        console.error('\n' + c.error('  ✗ Error al generar el código:'), err)
        pairingDone = false
      }
    })
  }

  sock.ev.on('messages.upsert', async chatUpdate => {
    try {
      const kay = chatUpdate.messages[0]
      if (!kay.message || kay.key?.remoteJid === 'status@broadcast') return
      const m = await smsg(sock, kay)
      handler(sock, m).catch(err => console.log(c.error('Error:'), err))
    } catch (err) {
      console.log(c.error('Error:'), err)
    }
  })

  sock.ev.on('group-participants.update', async (anu: any) => {
    try {
      const chatData = global.db.chats[anu.id] || {}
      const metadata = await getGroupMeta(sock, anu.id)
      if (!metadata) return
      const memberCount = metadata.participants.length
      for (const p of anu.participants) {
        const jid = typeof p === 'string' ? p : p.id || p.phoneNumber || ''
        if (!jid) continue
        const phone = jid.split('@')[0]
        const pp = await sock
          .profilePictureUrl(jid, 'image')
          .catch(() => 'https://stellarwa.xyz/files/1755559736781.jpeg')
        const contextInfo = {
          mentionedJid: [jid],
          externalAdReply: {
            title: '🫟 L U R U S  S Y S T E M 🫟',
            body: metadata.subject,
            mediaType: 1,
            renderLargerThumbnail: true,
            thumbnailUrl: pp,
            sourceUrl: 'github.com/AzamiJs',
          },
        }
        if (anu.action === 'add' && chatData.welcome) {
          const text = `> Welcome *@${phone}* to *${metadata.subject}* 👋`
          await sock.sendMessage(anu.id, { text, contextInfo })
        } else if ((anu.action === 'remove' || anu.action === 'leave') && chatData.welcome) {
          const text = `> Adiós, *@${phone}* ha salido del grupo *${metadata.subject}* 👋`
          await sock.sendMessage(anu.id, { text, contextInfo })
        } else if (anu.action === 'promote' && chatData.detect) {
          const usuario = anu.author || ''
          await sock.sendMessage(anu.id, {
            text: `*@${phone}* Ha sido ascendido al rol de *administrador*.\n\n> Acción hecha por @${usuario.split('@')[0]}`,
            mentions: [jid, usuario],
          })
        } else if (anu.action === 'demote' && chatData.detect) {
          const usuario = anu.author || ''
          await sock.sendMessage(anu.id, {
            text: `☔ *@${phone}* Ha sido removido de su rol de *administrador*.\n\n> Acción hecha por @${usuario.split('@')[0]}`,
            mentions: [jid, usuario],
          })
        }
      }
    } catch (err) {
      console.log('[ EVENT ERROR ] ->', err)
    }
  })

  sock.ev.on('connection.update', (up: any) => {
    const { connection, lastDisconnect } = up
    if (connection === 'open') {
      retryCount = 0
      console.log('\n' + BOX_TOP)
      console.log(`${BAR}  ${c.success('✦  BOT CONECTADO EXITOSAMENTE  ✦')}     ${BAR}`)
      console.log(BOX_BOT + '\n')
    }
    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode
      const loggedOut = statusCode === baileys.DisconnectReason.loggedOut
      const banned = statusCode === 401
      if (loggedOut || banned) {
        console.log('\n' + BOX_TOP)
        console.log(`${BAR}  ${c.error('✗  Sesión cerrada o inválida')}            ${BAR}`)
        console.log(`${BAR}  ${c.dim('Eliminando sesión y reiniciando...')}       ${BAR}`)
        console.log(BOX_BOT + '\n')
        clearSession()
        setTimeout(() => startBot(), 3000)
        return
      }
      retryCount++
      if (retryCount >= MAX_RETRIES) {
        console.log('\n' + BOX_TOP)
        console.log(
          `${BAR}  ${c.error(`✗  ${MAX_RETRIES} intentos fallidos`)}               ${BAR}`
        )
        console.log(`${BAR}  ${c.dim('Sesión corrupta — eliminando...')}          ${BAR}`)
        console.log(BOX_BOT + '\n')
        retryCount = 0
        clearSession()
        setTimeout(() => startBot(), 3000)
        return
      }
      const delay = Math.min(5000 * retryCount, 30000)
      console.log(c.dim(`[ ↻ ] Reintentando en ${delay / 1000}s... (${retryCount}/${MAX_RETRIES})`))
      setTimeout(() => startBot(), delay)
    }
  })
}

startBot()
