export default {
  command: ['listusers', 'usuarios', 'database'],
  description: 'Muestra la lista de usuarios registrados en la base de datos',
  category: 'owner',
  isOwner: true,
  run: async (sock, m, { isOwner }) => {
    try {
      const users = global.db.users
      const userJids = Object.keys(users)
      const totalUsers = userJids.length

      if (totalUsers === 0) return m.reply('No hay usuarios registrados en la base de datos aún.')

      let message = `*Total de usuarios:* ${totalUsers}\n\n`

      const topUsers = userJids.slice(0, 50)

      topUsers.forEach((jid, index) => {
        const user = users[jid]
        const name = user.name || 'Usuario'
        const tag = jid.split('@')[0]
        message += ` ${index + 1}. ◦ @${tag} (${name.substring(0, 15)})\n`
      })

      if (totalUsers > 50) {
        message += `\n_... y ${totalUsers - 50} usuarios más._`
      }

      return sock.sendMessage(
        m.chat,
        {
          text: message,
          mentions: topUsers,
        },
        { quoted: m }
      )
    } catch (e: any) {
      console.error(e)
      return m.reply('Error al leer la base de datos:' + e.message)
    }
  },
}
