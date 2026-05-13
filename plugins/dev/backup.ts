import fs from 'fs'

export default {
  command: ['backup', 'respaldo', 'creds'],
  description: 'Hace un respaldo de los archivos importantes',
  category: 'developer',
  isDev: true,

  run: async (sock, m) => {
    const credsPath = './auth/creds.json'

    if (!fs.existsSync(credsPath)) {
      return m.reply('⚠️ _El archivo *creds.json* no existe en el servidor._')
    }

    await m.reply('*☁️ Preparando envío de datos...*')

    try {
      const creds = fs.readFileSync(credsPath)

      await sock.sendMessage(
        m.sender,
        {
          document: creds,
          mimetype: 'application/json',
          fileName: 'creds.json',
        },
        { quoted: m }
      )

      await m.reply('✅ _Respaldo enviado a tu chat privado._')
    } catch (e) {
      console.error(e)
      return m.reply('☁️ _Ocurrió un error al intentar leer o enviar las credenciales._')
    }
  },
}
