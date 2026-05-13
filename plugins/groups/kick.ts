import config from '../../config.js'

export default {
  command: ['kick', 'kill', 'matar', 'sacar'],
  description: 'Expulsa a un miembro del grupo',
  category: 'groups',
  isGroup: true,
  isAdmin: true,
  isBotAdmin: true,
  use: '(@0 o responder a un mensaje)',

  run: async (sock, m, { args, isOwner }) => {
    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net'

    let user =
      m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : null

    if (!user) return m.reply('Etiqueta o responde al mensaje de la persona que quieres eliminar.')

    const targetUser = user.split(':')[0] + '@s.whatsapp.net'
    if (targetUser === botJid) return m.reply('No puedo eliminarme a mí mismo del grupo.')

    try {
      await sock.groupParticipantsUpdate(m.chat, [user], 'remove')

      if (global.db.data.chats[m.chat]) {
        const chatData = global.db.data.chats[m.chat]
        if (!chatData.logs) chatData.logs = []
        chatData.logs.push({
          action: 'kick',
          target: targetUser,
          by: m.sender,
          date: new Date().toISOString(),
        })
      }

      return m.reply('Usuario eliminado correctamente.')
    } catch (e) {
      console.error(e)
      return m.reply(
        'No se pudo eliminar al usuario. Verifica que sea un número válido o mis permisos.'
      )
    }
  },
}
