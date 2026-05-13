import {
  jidDecode,
  proto,
  extractMessageContent,
  getContentType,
  downloadContentFromMessage,
} from '@whiskeysockets/baileys'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { resolveLidToRealJid } from './utils.js'

const PREFIX_REGEX = /^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/

export const sanitizeFileName = (str: string) => {
  return str
    .replace(/[<>:"/\\|?*]/g, '')
    .substring(0, 64)
    .trim()
}

export async function getBuffer(url, options) {
  try {
    options ? options : {}
    const res = await axios({
      method: 'get',
      url,
      headers: {
        DNT: 1,
        'Upgrade-Insecure-Request': 1,
      },
      ...options,
      responseType: 'arraybuffer',
    })
    return res.data
  } catch (err) {
    return err
  }
}

export async function fixLid(sock, m) {
  const decodedJid = sock.decodeJid((m.fromMe && sock.user.id) || m.key.participant || m.chat || '')
  const realJid = await resolveLidToRealJid(decodedJid, sock, m.chat)
  return realJid
}

export const smsg = (sock: any, m: any) => {
  sock.decodeJid = (jid: string) => {
    if (!jid) return jid
    if (/:\d+@/gi.test(jid)) {
      let decode = jidDecode(jid) || {}
      return decode.user && decode.server ? decode.user + '@' + decode.server : jid
    } else return jid
  }

  sock.downloadMediaMessage = async (message: any) => {
    const msg = message.msg || message
    const mime = msg.mimetype || ''
    const messageType = (message.type || mime.split('/')[0]).replace(/Message/gi, '')
    const stream = await downloadContentFromMessage(msg, messageType)
    let buffer = Buffer.from([])
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])
    return buffer
  }

  if (!m) return m

  if (!m.chat && m.key) {
    m.id = m.key.id
    m.chat = m.key.remoteJid
    m.isGroup = m.chat.endsWith('@g.us')
    m.fromMe = m.key.fromMe
    m.isBot =
      ['HSK', 'BAE', 'B1E', '3EB0', 'B24E', 'WA'].some(
        a => m.id.startsWith(a) && [12, 16, 20, 22, 40].includes(m.id.length)
      ) ||
      /(.)\1{5,}|[^a-zA-Z0-9]|[^0-9A-F]/.test(m.id) ||
      false
    //m.sender = fixLid(sock, m)
    m.sender = sock.decodeJid((m.fromMe && sock.user.id) || m.key.participant || m.chat || '')
  }

  if (m.message) {
    m.type = getContentType(m.message) || Object.keys(m.message)[0]
    m.msg = /viewOnceMessage|viewOnceMessageV2Extension|editedMessage|ephemeralMessage/i.test(
      m.type
    )
      ? m.message[m.type].message[getContentType(m.message[m.type].message) || '']
      : extractMessageContent(m.message[m.type]) || m.message[m.type]

    m.text =
      m.type === 'conversation'
        ? m.message.conversation
        : m.type === 'imageMessage'
          ? m.message.imageMessage.caption
          : m.type === 'videoMessage'
            ? m.message.videoMessage.caption
            : m.type === 'extendedTextMessage'
              ? m.message.extendedTextMessage.text
              : m.type === 'buttonsResponseMessage'
                ? m.message.buttonsResponseMessage.selectedButtonId
                : m.type === 'listResponseMessage'
                  ? m.message.listResponseMessage.singleSelectReply.selectedRowId
                  : m.type === 'templateButtonReplyMessage'
                    ? m.message.templateButtonReplyMessage.selectedId
                    : m.msg?.conversation ||
                      m.msg?.caption ||
                      m.msg?.text ||
                      m.msg?.extendedTextMessage?.text ||
                      ''

    if (m.text) {
      const prefixMatch = m.text.match(PREFIX_REGEX)
      m.prefix = prefixMatch ? prefixMatch[0] : ''
      const parts = m.text.replace(m.prefix, '').trim().split(/ +/)
      m.command = parts.shift()?.toLowerCase() || ''
      m.args = parts
    } else {
      m.prefix = ''
      m.command = ''
      m.args = []
    }

    m.isMedia = !!m.msg?.mimetype || !!m.msg?.thumbnailDirectPath
    if (m.isMedia) {
      m.mime = m.msg?.mimetype
      if (m.mime && /webp/i.test(m.mime)) m.isAnimated = m.msg?.isAnimated
    }

    m.quoted = m.msg?.contextInfo?.quotedMessage || null
    m.mentionedJid = m.msg?.contextInfo?.mentionedJid || []

    if (m.quoted) {
      let quotedMsg = extractMessageContent(m.quoted)
      m.quoted.message = quotedMsg
      m.quoted.type = getContentType(quotedMsg) || (quotedMsg ? Object.keys(quotedMsg)[0] : '')
      m.quoted.msg = quotedMsg?.[m.quoted.type] || quotedMsg
      m.quoted.isMedia = !!m.quoted.msg?.mimetype || !!m.quoted.msg?.thumbnailDirectPath
      m.quoted.id = m.msg.contextInfo.stanzaId
      m.quoted.chat = m.chat
      m.quoted.sender = sock.decodeJid(m.msg?.contextInfo?.participant || '')
      m.quoted.fromMe = m.quoted.sender === sock.decodeJid(sock.user.id)

      if (m.quoted.isMedia) {
        m.quoted.fileSha256 = m.quoted.msg?.fileSha256 || ''
        m.quoted.mime = m.quoted.msg?.mimetype
        m.quoted.isAnimated = /webp/i.test(m.quoted.mime || '')
          ? m.quoted.msg?.isAnimated || false
          : false
      }

      m.quoted.fakeObj = proto.WebMessageInfo.fromObject({
        key: { remoteJid: m.quoted.chat, fromMe: m.quoted.fromMe, id: m.quoted.id },
        message: quotedMsg,
        ...(m.isGroup ? { participant: m.quoted.sender } : {}),
      })

      m.quoted.download = () => sock.downloadMediaMessage(m.quoted)
      m.quoted.delete = () => sock.sendMessage(m.quoted.chat, { delete: m.quoted.fakeObj.key })
    }

    m.download = () => sock.downloadMediaMessage(m)

    if (!m.reply) {
      m.reply = async (text: string, options: any = {}) => {
        await sock.sendMessage(
          m.chat,
          { text: text, mentions: [m.sender] },
          { quoted: m, ...options }
        )
      }
    }
  }
  return m
}
