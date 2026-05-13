import { readdirSync, statSync } from 'fs'
import { join, pathToFileURL } from 'url'
import { join as joinPath } from 'path'
import config from '../../config.ts'
import moment from 'moment-timezone'

export default {
  command: ['menu', 'help'],
  category: 'general',
  run: async (sock, m, { prefix, isOwner }) => {
    const pluginFolder = joinPath(process.cwd(), 'plugins')
    const categories = {}
    const getFiles = (dir: string) => {
      const list = readdirSync(dir)
      return list.reduce((acc: string[], file) => {
        const filePath = joinPath(dir, file)
        if (statSync(filePath).isDirectory()) {
          return acc.concat(getFiles(filePath))
        }
        if (file.endsWith('.ts') || file.endsWith('.js')) {
          acc.push(filePath)
        }
        return acc
      }, [])
    }
    const pluginFiles = getFiles(pluginFolder)
    for (const filePath of pluginFiles) {
      try {
        const fileUrl = pathToFileURL(filePath).href
        const plugin = await import(`${fileUrl}?update=${Date.now()}`)
        const data = plugin.default
        if (data?.command && data?.category) {
          const cat = data.category.toLowerCase()
          if (!categories[cat]) categories[cat] = []
          categories[cat].push(data.command[0])
        }
      } catch (e) {
        console.error(`Error en ${filePath}:`, e)
      }
    }
    const time = moment().tz('America/Mexico_City').format('HH:mm:ss')
    const name = m.pushName || 'User'
    let menuText = `*¡Hola ${name}!* espero que te encuentres bien, aquí tienes mi lista de funciones... *!!* ˙\n\n`
    const sortedCategories = Object.keys(categories).sort()
    for (const category of sortedCategories) {
      menuText += `\n☁️ \`${category.toUpperCase()}:\`\n`
      categories[category].forEach(cmd => {
        menuText += `→ ${prefix}${cmd}\n`
      })
    }
    menuText += `\`Canal\` https://whatsapp.com/channel/0029Vb5vOO0ADTOGbo78x03q\n`

    await sock.sendMessage(
      m.chat,
      {
        text: menuText.trim(),
        contextInfo: {
          externalAdReply: {
            title: 'Ai Lurus',
            body: `Hora: ${time} | Zam`,
            mediaType: 1,
            renderLargerThumbnail: false,
            thumbnailUrl:
              'https://cdn.evogb.org/AzamiJs/NevMd-37f1e73bea2c8868c8a2a1b288f42b67.jpg',
            sourceUrl: 'https://whatsapp.com/channel/0029VamN7Jt30LKWJlyWNB0D',
          },
        },
      },
      { quoted: m }
    )
  },
}
