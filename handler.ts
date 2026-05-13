import { readdirSync, statSync } from 'fs'
import { join } from 'path'
import config from './config.js'
import chalk from 'chalk'
import { antiLink } from './plugins/antilink.js'
import { resolveLidToRealJid } from './lib/utils.js'

const pluginCache: Map<string, any> = new Map()
const commandIndex: Map<string, any> = new Map()
let cacheLoaded = false

const ownerSet = new Set(config.owners.map((n: string) => n + '@s.whatsapp.net'))
const devSet = new Set(config.devs.map((n: string) => n + '@s.whatsapp.net'))

const getFiles = (dir: string): string[] => {
  let results: string[] = []
  const list = readdirSync(dir)
  list.forEach(file => {
    const filePath = join(dir, file)
    if (statSync(filePath).isDirectory()) {
      results = results.concat(getFiles(filePath))
    } else if (file.endsWith('.ts') || file.endsWith('.js')) {
      results.push(filePath)
    }
  })
  return results
}

async function loadPlugins() {
  const pluginFolder = join(process.cwd(), 'plugins')
  const pluginFiles = getFiles(pluginFolder)
  commandIndex.clear()
  for (const fullPath of pluginFiles) {
    try {
      const plugin = await import(`file://${fullPath}?t=${Date.now()}`)
      if (plugin.default?.command) {
        pluginCache.set(fullPath, plugin.default)
        for (const alias of plugin.default.command) {
          commandIndex.set(alias, plugin.default)
        }
      }
    } catch (e) {
      console.error(chalk.red(`[ ❌ ]  Error cargando plugin: ${fullPath.split('/').pop()}`), e)
    }
  }
  cacheLoaded = true
  console.log(chalk.green(`${pluginCache.size} plugins cargados en caché.`))
}

export const pluginsReady = loadPlugins()
export { pluginCache, commandIndex, loadPlugins }

const jidCache: Map<string, string> = new Map()

async function resolveJid(sender: string, sock: any, chat: string): Promise<string> {
  if (jidCache.has(sender)) return jidCache.get(sender)!
  const resolved = await resolveLidToRealJid(sender, sock, chat)
  jidCache.set(sender, resolved)
  setTimeout(() => jidCache.delete(sender), 30 * 60 * 1000)
  return resolved
}

export default async function handler(sock: any, m: any) {
  try {
    if (!m.message) return

    const prefix = config.prefix.find((p: string) => m.text?.startsWith(p))
    if (!prefix) {
      antiLink(sock, m).catch(() => {})
      return
    }

    const body =
      m.message.conversation ||
      m.message.extendedTextMessage?.text ||
      m.message.imageMessage?.caption ||
      m.message.videoMessage?.caption ||
      m.message.buttonsResponseMessage?.selectedButtonId ||
      m.message.listResponseMessage?.singleSelectReply?.selectedRowId ||
      m.message.templateButtonReplyMessage?.selectedId ||
      ''

    const args = m.text.slice(prefix.length).trim().split(/ +/)
    const commandName = args.shift()?.toLowerCase() || ''
    const text = args.join(' ')
    const command = body.slice(prefix.length).trim().split(/\s+/)[0].toLowerCase()

    if (!cacheLoaded) return
    const cmd = commandIndex.get(commandName)
    if (!cmd) return

    const [senderJid] = await Promise.all([
      resolveJid(m.sender, sock, m.chat),
      antiLink(sock, m).catch(() => {}),
    ])

    const senderId = senderJid.split('@')[0]
    const botId = sock?.user?.id.split(':')[0] + '@s.whatsapp.net'

    if (!global.db.users[senderId]) {
      global.db.users[senderId] = { user: m.sender, coins: 0 }
    }
    if (!global.db.chats[m.chat]) {
      global.db.chats[m.chat] = { id: m.chat, detect: true, welcome: true, antilink: true }
    }
    if (!global.db.settings[botId]) {
      global.db.users[botId] = { bot: botId }
    }

    let groupMetadata = null
    let groupAdmins: any[] = []
    let groupName = ''
    let isAdmins = false
    let isBotAdmin = false

    if (m.isGroup && (cmd.isAdmin || cmd.isBotAdmin || cmd.isGroup !== undefined)) {
      if (!(global as any).groupMetaCache) (global as any).groupMetaCache = new Map()
      const cached = (global as any).groupMetaCache.get(m.chat)
      if (cached && Date.now() - cached.ts < 5 * 60 * 1000) {
        groupMetadata = cached.data
      } else {
        groupMetadata = await sock.groupMetadata(m.chat).catch(() => null)
        if (groupMetadata)
          (global as any).groupMetaCache.set(m.chat, { data: groupMetadata, ts: Date.now() })
      }
      groupName = groupMetadata?.subject || ''
      groupAdmins =
        groupMetadata?.participants?.filter(
          (p: any) => p.admin === 'admin' || p.admin === 'superadmin'
        ) || []

      const botRaw = sock.user.id.split(':')[0].split('@')[0]
      const senderRaw = senderJid.split('@')[0]

      isBotAdmin =
        groupMetadata?.participants?.some((p: any) => {
          const pid = p.id?.split('@')[0]?.split(':')[0]
          const plid = p.lid?.split('@')[0]?.split(':')[0]
          const pphone = p.phoneNumber?.split('@')[0]
          return (
            (pid === botRaw || plid === botRaw || pphone === botRaw) &&
            (p.admin === 'admin' || p.admin === 'superadmin')
          )
        }) || false

      isAdmins =
        groupMetadata?.participants?.some((p: any) => {
          const pid = p.id?.split('@')[0]?.split(':')[0]
          const plid = p.lid?.split('@')[0]?.split(':')[0]
          const pphone = p.phoneNumber?.split('@')[0]
          return (
            (pid === senderRaw || plid === senderRaw || pphone === senderRaw) &&
            (p.admin === 'admin' || p.admin === 'superadmin')
          )
        }) || false
    }

    const time = new Date().toLocaleTimeString('es-MX', {
      timeZone: 'America/Mexico_City',
      hour12: false,
    })
    const border = chalk.hex('#7C3AED')
    const label = chalk.hex('#C4B5FD').bold
    const value = chalk.hex('#EDE9FE')
    const BAR = border('│')
    console.log(border('╭───────────────────────────────────────╮'))
    console.log(`${BAR} ${label('CMD :')} ${value(commandName)}`)
    console.log(`${BAR} ${label('USER:')} ${value(m.pushName || 'User')}`)
    console.log(`${BAR} ${label('TIME:')} ${value(time)}`)
    console.log(border('╰───────────────────────────────────────╯'))

    if (cmd.isOwner && !ownerSet.has(senderJid)) return m.reply('Dueño solamente.')
    if (cmd.isDev && !devSet.has(senderJid)) return m.reply('Creador solamente.')
    if (cmd.isGroup && !m.isGroup) return m.reply('Grupos solamente.')
    if (cmd.isAdmin && !isAdmins) return m.reply('Admins solamente.')
    if (cmd.isBotAdmin && !isBotAdmin) return m.reply('Hazme admin primero.')

    try {
      return await cmd.run(sock, m, {
        args,
        prefix,
        commandName,
        isAdmins,
        isBotAdmin,
        senderJid,
        text,
        command,
      })
    } catch (e: any) {
      console.error(chalk.red(`Error en plugin '${commandName}':`), e)
      await m.reply(`_Ocurrió un error al ejecutar el comando. Intenta de nuevo._`)
    }
  } catch (e) {
    console.error(chalk.red.bold('Error en el Handler:'), e)
  }
}
