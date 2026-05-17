import { format } from 'util'

function getQuotedMessage(m) {
  const msgType = Object.keys(m.message || {})[0]
  const msgContent = m.message?.[msgType]
  const contextInfo = msgContent?.contextInfo || m.message?.extendedTextMessage?.contextInfo

  if (!contextInfo?.quotedMessage) return null

  const quotedType = Object.keys(contextInfo.quotedMessage || {})[0]

  return {
    key: {
      remoteJid: m.chat || m.key?.remoteJid,
      fromMe: false,
      id: contextInfo.stanzaId,
      participant: contextInfo.participant || m.key?.participant || m.sender
    },
    message: contextInfo.quotedMessage,
    sender: contextInfo.participant || m.key?.participant || m.sender,
    type: quotedType,
    text:
      contextInfo.quotedMessage?.conversation ||
      contextInfo.quotedMessage?.extendedTextMessage?.text ||
      contextInfo.quotedMessage?.imageMessage?.caption ||
      contextInfo.quotedMessage?.videoMessage?.caption ||
      ''
  }
}

export default {
  command: 'e',
  aliases: ['ex', 'eval', 'exec'],
  category: 'owner',
  description: 'Evalúa JavaScript desde el chat',
  usage: '.e 2 + 2',
  ownerOnly: true,

  async run({ input, args, m, sock, react, reply, invokedAs }) {
    const quoted = getQuotedMessage(m)
    const quotedJson = quoted ? JSON.stringify(quoted, null, 2) : null

    if (!input.trim()) {
      if (quotedJson) {
        return await reply(`\`\`\`json\n${quotedJson}\n\`\`\``)
      }

      return await reply('🍄 *_Debes escribir un comando a ejecutar o responder a un mensaje_*')
    }

    try {
      await react('🕒')

      let printsLeft = 15

      const print = async (...values) => {
        if (--printsLeft < 0) return
        await reply(format(...values))
      }

      const source = invokedAs === 'e' ? `return (${input})` : input

      const executor = new (async () => {}).constructor(
        'print',
        'm',
        'sock',
        'args',
        'process',
        'quoted',
        'quotedJson',
        source
      )

      const result = await executor(
        print,
        m,
        sock,
        args,
        process,
        quoted,
        quotedJson
      )

      await react('✔️')

      if (typeof result !== 'undefined') {
        await reply(format(result))
      }
    } catch (error) {
      await react('✖️')
      await reply(format(error))
    }
  }
}