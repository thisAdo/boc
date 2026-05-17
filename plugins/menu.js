import {
  proto,
  prepareWAMessageMedia,
  generateWAMessageFromContent,
  extractImageThumb
} from 'bail'

function formatCategoryLabel(value = '') {
  return String(value || 'general')
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function sortCategories(a = '', b = '') {
  if (a === 'general') return -1
  if (b === 'general') return 1

  return a.localeCompare(b, 'es', {
    sensitivity: 'base'
  })
}

async function getThumbnailData(url) {
  const res = await fetch(url)

  if (!res.ok) {
    throw new Error(`Error descargando thumbnail: ${res.status}`)
  }

  const raw = Buffer.from(await res.arrayBuffer())

  try {
    const width = 800
    const { buffer, original } = await extractImageThumb(raw, width)

    const height = original?.width && original?.height
      ? Math.round(width * original.height / original.width)
      : 450

    return {
      buffer,
      width,
      height
    }
  } catch {
    return {
      buffer: raw,
      width: 800,
      height: 450
    }
  }
}

export default {
  command: 'menu',
  aliases: ['help'],
  category: 'general',
  description: 'Muestra el menú principal',
  usage: '.menu',

  async run({
    m,
    conn,
    sock,
    plugins = [],
    config,
    reply
  }) {
    const client = conn || sock
    const jid = m.chat || m.key?.remoteJid

    const safeReply = async (text) => {
      if (typeof reply === 'function') {
        return await reply(text)
      }

      return await client.sendMessage(
        jid,
        { text },
        { quoted: m }
      )
    }

    try {
      if (!client) {
        throw new Error('No se encontró conn ni sock en el handler')
      }

      if (typeof client.waUploadToServer !== 'function') {
        throw new Error('client.waUploadToServer no existe en el socket')
      }

      const grouped = new Map()

      for (const plugin of plugins) {
        const cmd = Array.isArray(plugin?.command)
          ? plugin.command[0]
          : plugin?.command

        if (!cmd || typeof plugin.run !== 'function') continue

        const category = String(plugin.category || 'general')
          .trim()
          .toLowerCase() || 'general'

        if (!grouped.has(category)) {
          grouped.set(category, [])
        }

        grouped.get(category).push({
          ...plugin,
          command: cmd
        })
      }

      const sections = [...grouped.entries()]
        .sort(([a], [b]) => sortCategories(a, b))
        .map(([category, items]) => {
          const lines = items
            .sort((a, b) =>
              String(a.command).localeCompare(String(b.command), 'es', {
                sensitivity: 'base'
              })
            )
            .map(plugin => {
              const description = String(
                plugin.description || 'Sin descripción'
              ).trim()

              return `◦ *${config.prefix}${plugin.command}* — ${description}`
            })

          return `🍃 *${formatCategoryLabel(category)}*\n${lines.join('\n')}`
        })

      const text = [
        `🌴 ¡Hola! Soy *${config.bot.name}*, un gusto ayudarte.`,
        '*[🍄]* *Aquí tienes mi lista de comandos*',
        '',
        ...sections,
        '',
        `🌾 *Prefix actual:* ${config.prefix}`
      ].join('\n')

      const thumbUrl = 'https://adofiles.vercel.app/dl/buzz-patrick.jpg%3A0212c591.jpg'
      const thumb = await getThumbnailData(thumbUrl)

      const fakeDocument = Buffer.from(text, 'utf-8')

      const prepared = await prepareWAMessageMedia(
        {
          document: fakeDocument,
          mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          fileName: `🍄 ${config.bot.name} Menu.xlsx`,
          caption: text,
          jpegThumbnail: thumb.buffer,
          thumbnailWidth: thumb.width,
          thumbnailHeight: thumb.height
        },
        {
          upload: client.waUploadToServer
        }
      )

      const documentMessage = prepared.documentMessage

      documentMessage.fileName = `🍄 ${config.bot.name} Menu.xlsx`
      documentMessage.title = `${config.bot.name} Menu`
      documentMessage.caption = text
      documentMessage.mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      documentMessage.pageCount = 0
      documentMessage.jpegThumbnail = thumb.buffer
      documentMessage.thumbnailWidth = thumb.width
      documentMessage.thumbnailHeight = thumb.height

      const waMsg = generateWAMessageFromContent(
        jid,
        {
          documentMessage: proto.Message.DocumentMessage.fromObject(documentMessage)
        },
        {
          userJid: client.user?.id
        }
      )

      await client.relayMessage(
        jid,
        waMsg.message,
        {
          messageId: waMsg.key.id
        }
      )
    } catch (e) {
      console.error(e)

      await safeReply(
        `🌾 *_Error enviando el menú_*\n◦ *Detalle:* ${String(e?.message || e)}`
      )
    }
  }
}