export default {
  command: ['logs'],
  description: 'Muestra el historial de cambios de funciones del grupo',
  category: 'groups',
  isGroup: true,
  isAdmin: true,
  run: async (sock, m) => {
    const chatData = global.db.data.chats[m.chat]

    if (!chatData.logs || chatData.logs.length === 0) {
      return m.reply('*No se registra historial de cambios en este grupo.*')
    }

    await m.reply('Generando reporte del historial, espere un momento...')

    let text = `Logs

> 𝖧𝗂𝗌𝗍𝗈𝗋𝗂𝖺𝗅 𝖽𝖾 𝗆𝗈𝖽𝗂𝖿𝗂𝖼𝖺𝖼𝗂𝗈𝗇𝖾𝗌 ›\n\n`

    chatData.logs.forEach((log, i) => {
      text += `*Evento* › ${i + 1}\n`
      text += `*Función* › ${log.option}\n`
      text += `*Acción* › ${log.action}\n`
      text += `*Usuario* › @${log.by.split('@')[0]}\n`
      text += `*Fecha* › ${new Date(log.date).toLocaleString()}\n\n`
    })

    await sock.sendMessage(
      m.chat,
      {
        text,
        mentions: chatData.logs.map(log => log.by),
      },
      { quoted: m }
    )
  },
}
