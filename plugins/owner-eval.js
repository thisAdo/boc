import util from 'util'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

const cleanJson = (val) => {
  const seen = new WeakSet()

  return JSON.stringify(
    val,
    (key, value) => {
      if (typeof value === 'bigint') return value.toString()
      if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`
      if (typeof value === 'symbol') return value.toString()

      if (Buffer.isBuffer(value)) {
        return {
          type: 'Buffer',
          data: Array.from(value)
        }
      }

      if (value instanceof Uint8Array) {
        return {
          type: 'Uint8Array',
          data: Array.from(value)
        }
      }

      if (value && typeof value === 'object') {
        if (seen.has(value)) return '[Circular]'
        seen.add(value)
      }

      return value
    },
    2
  )
}

const getMessageType = (message = {}) => {
  return Object.keys(message || {})[0] || null
}

const getContextInfo = (msg) => {
  const message = msg?.message || {}
  const type = getMessageType(message)
  const content = message?.[type]

  return (
    content?.contextInfo ||
    message?.extendedTextMessage?.contextInfo ||
    message?.imageMessage?.contextInfo ||
    message?.videoMessage?.contextInfo ||
    message?.documentMessage?.contextInfo ||
    message?.stickerMessage?.contextInfo ||
    message?.audioMessage?.contextInfo ||
    null
  )
}

const getQuoted = (msg) => {
  const contextInfo = getContextInfo(msg)

  if (!contextInfo?.quotedMessage) return null

  return {
    key: {
      remoteJid: msg.chat || msg.key?.remoteJid,
      fromMe: false,
      id: contextInfo.stanzaId,
      participant: contextInfo.participant || msg.key?.participant || msg.sender
    },
    message: contextInfo.quotedMessage,
    sender: contextInfo.participant || msg.key?.participant || msg.sender,
    type: getMessageType(contextInfo.quotedMessage)
  }
}

export default {
  command: 'e',
  aliases: ['ex', 'eval', 'exec'],
  category: 'owner',
  description: 'Evalúa JavaScript desde el chat',
  usage: '.e return m',
  ownerOnly: true,

  async run({ input, args, m, sock, react, reply }) {
    const code = (input || args?.join(' ') || '').trim()
    const quoted = getQuoted(m)

    const msg = {
      key: m.key,
      message: m.message,
      sender: m.sender || m.key?.participant || m.key?.remoteJid,
      jid: m.chat || m.key?.remoteJid,
      chat: m.chat || m.key?.remoteJid,
      quoted,
      type: getMessageType(m.message),
      text: code,
      isGroup: (m.chat || m.key?.remoteJid || '').endsWith('@g.us')
    }

    if (!code) {
      if (quoted) {
        return await reply(`\`\`\`json\n${cleanJson(quoted)}\n\`\`\``)
      }

      return await reply('> ⩩ Escribe algo que ejecutar. Ej: `.e return m`')
    }

    try {
      if (react) await react('🕒')

      let printsLeft = 15

      const print = async (...values) => {
        if (--printsLeft < 0) return
        await reply(util.format(...values))
      }

      const finalCode = code.startsWith('return ')
        ? code
        : `return (${code})`

      const fn = new Function(
        'sock',
        'msg',
        'm',
        'quoted',
        'args',
        'print',
        'require',
        'util',
        'process',
        `return (async () => { ${finalCode} })()`
      )

      let result = await fn(
        sock,
        msg,
        msg,
        quoted,
        args,
        print,
        require,
        util,
        process
      )

      if (result === undefined) result = null

      if (react) await react('✔️')

      await reply(`\`\`\`json\n${cleanJson(result)}\n\`\`\``)
    } catch (err) {
      if (react) await react('✖️')

      const errorJson = cleanJson({
        error: true,
        message: err.message,
        stack: err.stack
      })

      await reply(`> ⩩ *Error:*\n\`\`\`json\n${errorJson}\n\`\`\``)
    }
  }
}