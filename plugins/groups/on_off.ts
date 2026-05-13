export default {
  command: ['on', 'off'],
  description: 'Activa o desactiva funciones del grupo',
  category: 'groups',
  use: 'welcome',
  isGroup: true,
  isAdmin: true,
  isBotAdmin: true,

  run: async (sock, m, { args }) => {
    const cmd = m.text.trim().split(' ')[0].slice(1).toLowerCase()
    const setting = args[0]?.toLowerCase()

    if (!setting) {
      return m.reply('Debes especificar la *función*\n\n`Ejemplo`\n!on antilink\n!off antilink')
    }

    const chatData = global.db.chats[m.chat]
    const isEnable = cmd === 'on'

    switch (setting) {
      case 'antilink':
        chatData.antilink = isEnable
        m.reply(`💬 La función *Antilink* ha sido *${isEnable ? 'activada' : 'desactivada'}*`)
        break

      case 'adminonly':
      case 'onlyadmin':
        chatData.adminonly = isEnable
        m.reply(`💬 El *Modo Admins* ha sido *${isEnable ? 'activado' : 'desactivado'}*`)
        break

      case 'welcome':
        chatData.welcome = isEnable
        m.reply(`💬 La *Bienvenida* ha sido *${isEnable ? 'activada' : 'desactivada'}*`)
        break

      case 'detect':
        chatData.detect = isEnable
        m.reply(`💬 El *Detector* ha sido *${isEnable ? 'activado' : 'desactivado'}*`)
        break

      default:
        m.reply(
          'Opción no *válida*\n\n- Opciones:\n`antilink`\n`welcome`\n`adminonly`\n`detect`\n\n> Ejemplo: .on welcome'
        )
        break
    }
  },
}
