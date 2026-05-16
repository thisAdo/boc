export default {
    command: ['newsletter', 'canal', 'channel', 'getnewsletter'],
    description: 'Obtiene la metadata/JID de un canal de WhatsApp usando su link o código',
    category: 'owner',
    isOwner: false,

    run: async (sock, m, { args, text }) => {
        try {
            const input = (text || args?.join(' ') || '').trim();

            if (!input) {
                return m.reply(
                    `Uso correcto:\n\n` +
                    `*.newsletter https://whatsapp.com/channel/0029VbB2QCHCMY0Qz0j23y3a*\n\n` +
                    `También puedes usar solo el código:\n` +
                    `*.newsletter 0029VbB2QCHCMY0Qz0j23y3a*`
                );
            }

            const getNewsletterKey = (value) => {
                const clean = value.trim();

                const channelMatch = clean.match(/(?:https?:\/\/)?(?:www\.)?whatsapp\.com\/channel\/([A-Za-z0-9_-]+)/i);
                if (channelMatch) {
                    return {
                        type: 'invite',
                        key: channelMatch[1]
                    };
                }

                if (clean.endsWith('@newsletter')) {
                    return {
                        type: 'jid',
                        key: clean
                    };
                }

                return {
                    type: 'invite',
                    key: clean
                };
            };

            const { type, key } = getNewsletterKey(input);

            await m.reply('Buscando información del newsletter...');

            const metadata = await sock.newsletterMetadata(type, key);

            if (!metadata) {
                return m.reply('No pude obtener información de ese newsletter.');
            }

            const newsletterJid = metadata.id?.includes('@newsletter')
                ? metadata.id
                : `${metadata.id}@newsletter`;

            const name = metadata.name || 'Sin nombre';
            const description = metadata.description || metadata.thread_metadata?.description || 'Sin descripción';
            const subscribers = metadata.subscribers || 'No disponible';
            const invite = metadata.invite || key;
            const verification = metadata.verification || 'No disponible';
            const muteState = metadata.mute_state || 'No disponible';
            const creationTime = metadata.creation_time
                ? new Date(Number(metadata.creation_time) * 1000).toLocaleString()
                : 'No disponible';

            const message =
                `*NEWSLETTER ENCONTRADO*\n\n` +
                `*Nombre:* ${name}\n` +
                `*JID:* ${newsletterJid}\n` +
                `*Invite:* ${invite}\n` +
                `*Descripción:* ${description}\n` +
                `*Suscriptores:* ${subscribers}\n` +
                `*Verificación:* ${verification}\n` +
                `*Silenciado:* ${muteState}\n` +
                `*Creado:* ${creationTime}\n\n` +
                `*JSON completo:*\n` +
                '```json\n' +
                JSON.stringify(metadata, null, 2) +
                '\n```';

            return sock.sendMessage(
                m.chat,
                { text: message },
                { quoted: m }
            );
        } catch (e) {
            console.error(e);
            return m.reply('Error al sacar el newsletter: ' + e.message);
        }
    },
};