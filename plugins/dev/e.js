import util from 'util'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

export default {
    command: ['e', 'eval'],
    description: 'Ejecuta código JS con acceso al contexto del bot',
    category: 'developer',
    isDev: true,

    run: async (sock, m, { args = [], text = '' } = {}) => {
        const code = (text || args.join(' ')).trim()

        if (!code) {
            return sock.sendMessage(m.chat, {
                text: '> ⩩ Escribe algo que ejecutar.\nEjemplo: `.e return m`',
            }, { quoted: m })
        }

        const contextInfo =
            m.message?.extendedTextMessage?.contextInfo ||
            m.msg?.contextInfo ||
            null

        const quoted = m.quoted || (
            contextInfo?.quotedMessage
                ? {
                    key: {
                        remoteJid: m.chat,
                        fromMe: false,
                        id: contextInfo.stanzaId,
                        participant: contextInfo.participant || m.sender,
                    },
                    message: contextInfo.quotedMessage,
                    sender: contextInfo.participant || m.sender,
                    type: Object.keys(contextInfo.quotedMessage)[0] || null,
                }
                : null
        )

        const cleanJson = (val) => {
            const seen = new WeakSet()

            return JSON.stringify(
                val,
                (key, value) => {
                    if (typeof value === 'bigint') {
                        return value.toString()
                    }

                    if (typeof value === 'function') {
                        return `[Function ${value.name || 'anonymous'}]`
                    }

                    if (typeof value === 'symbol') {
                        return value.toString()
                    }

                    if (Buffer.isBuffer(value)) {
                        return {
                            type: 'Buffer',
                            data: Array.from(value),
                        }
                    }

                    if (value instanceof Uint8Array) {
                        return {
                            type: 'Uint8Array',
                            data: Array.from(value),
                        }
                    }

                    if (value && typeof value === 'object') {
                        if (seen.has(value)) {
                            return '[Circular]'
                        }

                        seen.add(value)
                    }

                    return value
                },
                2
            )
        }

        try {
            const jid = m.chat
            const msg = m
            const conn = sock
            const sender = m.sender || m.key?.participant || m.key?.remoteJid
            const isGroup = jid?.endsWith('@g.us')
            const type = m.message ? Object.keys(m.message)[0] : null

            const reply = async (message) => {
                return sock.sendMessage(jid, {
                    text: String(message),
                }, { quoted: m })
            }

            const fn = new Function(
                'sock',
                'conn',
                'm',
                'msg',
                'jid',
                'sender',
                'args',
                'text',
                'quoted',
                'isGroup',
                'type',
                'reply',
                'require',
                'util',
                `
                return (async () => {
                    ${code}
                })()
                `
            )

            let result = await fn(
                sock,
                conn,
                m,
                msg,
                jid,
                sender,
                args,
                text,
                quoted,
                isGroup,
                type,
                reply,
                require,
                util
            )

            if (result === undefined) result = null

            let output

            if (typeof result === 'string') {
                output = result
            } else {
                output = cleanJson(result)
            }

            if (!output) output = 'null'

            await sock.sendMessage(
                jid,
                {
                    text: `\`\`\`json\n${output}\n\`\`\``,
                },
                { quoted: m }
            )
        } catch (err) {
            const errorJson = cleanJson({
                error: true,
                message: err.message,
                stack: err.stack,
            })

            await sock.sendMessage(
                m.chat,
                {
                    text: `> ⩩ *Error:*\n\`\`\`json\n${errorJson}\n\`\`\``,
                },
                { quoted: m }
            )
        }
    },
}