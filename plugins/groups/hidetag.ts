import { generateWAMessageFromContent } from '@whiskeysockets/baileys'

export default {
  command: ['hidetag', 'tag'],
  description: 'Menciona a todos sin mostrar los @',
  category: 'groups',
  isGroup: true,
  isAdmin: true,
  isBotAdmin: false,
  use: '(*ingresa* o responde a un *texto*)',

  run: async (sock, m, { text, prefix, commandName, isAdmins }) => {
    const groupMetadata = await sock.groupMetadata(m.chat).catch(() => null)
    if (!groupMetadata) return m.reply('No pude obtener la información del grupo.')

    const participants = groupMetadata.participants.map(p => sock.decodeJid(p.id))
    const mentions = participants

    const q = m.quoted ? m.quoted : m
    const mime = q.mimetype || q.msg?.mimetype || ''
    const isMedia = /image|video|sticker|audio/.test(mime)

    if (!text && !m.quoted && !isMedia)
      return m.reply('Ingresa un texto o responde a un mensaje para taguear.')

    let finalText = text || q.text || q.msg?.caption || q.msg?.text || ''

    if (!text && !m.quoted && q.msg?.caption) {
      const commandStr = prefix + commandName
      if (q.msg.caption.toLowerCase().startsWith(commandStr.toLowerCase())) {
        finalText = q.msg.caption.slice(commandStr.length).trim()
      } else {
        finalText = q.msg.caption
      }
    }

    try {
      if (isMedia) {
        const media = await q.download()
        const messageType = q.mtype || q.type || m.type

        if (messageType === 'imageMessage' || mime.includes('image')) {
          return sock.sendMessage(
            m.chat,
            { image: media, caption: finalText, mentions },
            { quoted: null }
          )
        } else if (messageType === 'videoMessage' || mime.includes('video')) {
          return sock.sendMessage(
            m.chat,
            { video: media, mimetype: 'video/mp4', caption: finalText, mentions },
            { quoted: null }
          )
        } else if (messageType === 'audioMessage' || mime.includes('audio')) {
          return sock.sendMessage(
            m.chat,
            { audio: media, mimetype: 'audio/mp4', ptt: true, mentions },
            { quoted: null }
          )
        } else if (messageType === 'stickerMessage' || mime.includes('sticker')) {
          return sock.sendMessage(m.chat, { sticker: media, mentions }, { quoted: null })
        }
      }

      return sock.sendMessage(m.chat, { text: finalText, mentions }, { quoted: null })
    } catch (e) {
      console.error(e)
      return m.reply('Error al enviar el hidetag:' + e)
    }
  },
}
