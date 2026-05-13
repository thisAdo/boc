import os from 'os'
import { join } from 'path'
import { readFileSync } from 'fs'

export default {
  command: ['info', 'botinfo'],
  description: 'Muestra los datos técnicos del bot',
  category: 'general',
  run: async (sock: any, m: any, { prefix }: any) => {
    const up = process.uptime()
    const h = Math.floor(up / 3600)
    const min = Math.floor((up % 3600) / 60)
    const s = Math.floor(up % 60)
    const cpu = os.cpus()[0]?.model.trim() || 'Desconocido'
    const cores = os.cpus().length
    const mem = [(os.freemem() / 1024 / 1024).toFixed(0), (os.totalmem() / 1024 / 1024).toFixed(0)]
    const platform = `${os.platform()} ${os.release()} (${os.arch()})`
    const nodeV = process.version
    const host = os.hostname()
    const shell = process.env.SHELL || process.env.COMSPEC || 'desconocido'
    const now = new Date().toLocaleString('en-US', {
      timeZone: 'America/Mexico_City',
      hour12: false,
    })

    const botname = 'Ai Lurus'
    const banner = 'https://cdn.evogb.org/AzamiJs/nlqIX-ecaaf4d537558d8dd7122798523ea667.jpg'

    const info = `*Nombre Bot:* ${botname}
*Versión:* Ts-testing@1.0.0
*Autor:* Zam | Ai Lurus
*Uptime:* ${h}h ${min}m ${s}s
*Plataforma:* ${platform}
*Node.js:* ${nodeV}
*Host:* ${host}
*Shell:* ${shell}

*CPU:* ${cpu} (${cores} núcleos)
*Memoria:* ${mem[0]} MiB libre / ${mem[1]} MiB total

*Fecha & Hora:* ${now}`

    await sock.sendMessage(
      m.chat,
      {
        text: info.trim(),
        contextInfo: {
          externalAdReply: {
            title: 'Ai Lurus',
            body: `Hora: ${now} | Zam`,
            mediaType: 1,
            renderLargerThumbnail: false,
            thumbnailUrl: banner,
            sourceUrl: 'https://whatsapp.com/channel/0029Vb5vOO0ADTOGbo78x03q',
          },
        },
      },
      { quoted: m }
    )
  },
}
