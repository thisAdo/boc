import fetch from 'node-fetch'

var handler = async (m, { conn, args, usedPrefix, command }) => {

  if (!args[0]) {
    return m.reply(
      `🍃 Has olvidado el enlace.\n` +
      `🍄 Ejemplo: ${usedPrefix + command} https://vm.tiktok.com/ZMkcmTCa6/`
    )
  }

  if (!args[0].match(/(https?:\/\/)?(www\.)?(vm\.|vt\.)?tiktok\.com\//)) {
    return m.reply(`🍃 Ese enlace no pertenece a TikTok.`)
  }

  try {
    await m.reply(`🍄 Extrayendo el contenido del enlace...\n🍃 Espera un momento.`)

    const data = await tiktokdl(args[0])

    if (!data || !data.data) {
      return m.reply(`🍃 No fue posible obtener el contenido.`)
    }

    const video = data.data.play
    const cover = data.data.cover
    const title = data.data.title || 'Sin título'

    await conn.sendMessage(m.chat, {
      image: { url: cover },
      caption: `🍃 Vista previa del contenido\n🍄 ${title}`
    }, { quoted: m })

    await conn.sendMessage(m.chat, {
      video: { url: video },
      caption: `🍃 Archivo extraído correctamente.`
    }, { quoted: m })

  } catch (e) {
    await m.reply(`🍄 Ocurrió un error inesperado.\n🍃 Detalle: ${e}`)
  }
}

handler.help = ['tiktok']
handler.tags = ['descargas']
handler.command = ['tt', 'tiktok']

export default handler

async function tiktokdl(url) {
  const api = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`
  const res = await fetch(api)
  return await res.json()
                         }
