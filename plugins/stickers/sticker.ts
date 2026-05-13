import fs from 'fs'
import { writeExifImg, writeExifVid } from '../../lib/stickers.js'

export default {
  command: ['sticker', 's'],
  description: 'Crea un sticker a partir de una imagen o video',
  category: 'stickers',
  use: '(responde a una imagen o video)',

  run: async (sock, m, { args }) => {
    try {
      const quoted = m.quoted ? m.quoted : m
      const mime = (quoted.msg || quoted).mimetype || ''
      const packname = 'Lurus'
      const author = 'Zam'

      if (!/image|video/.test(mime)) {
        return m.reply('Responde a una imagen o video para crear el sticker.')
      }

      await m.reply('Procesando su sticker...')

      let mediaBuffer = await quoted.download()

      if (/image/.test(mime)) {
        const sticker = await writeExifImg(mediaBuffer, { packname, author })
        await sock.sendMessage(m.chat, { sticker }, { quoted: m })
      } else if (/video/.test(mime)) {
        if ((quoted.msg || quoted).seconds > 15) {
          return m.reply('El video no puede durar más de 15 segundos para ser sticker.')
        }
        const sticker = await writeExifVid(mediaBuffer, { packname, author })
        await sock.sendMessage(m.chat, { sticker }, { quoted: m })
      }
    } catch (err) {
      console.error(err)
      return m.reply('Ocurrió un error al crear el sticker. Revisa los logs del panel.')
    }
  },
}
