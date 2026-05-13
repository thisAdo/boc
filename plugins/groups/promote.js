export default {
    command: ['promote', 'ascender', 'daradmin'],
    description: 'Agrega un nuevo administrador',
    category: 'groups',
    use: '@0 o responder al mensaje',
    isGroup: true,
    isAdmin: true,
    isBotAdmin: true,
    run: async (sock, m, { args }) => {
        let target = m.quoted
            ? m.quoted.sender
            : m.mentionedJid && m.mentionedJid.length > 0
                ? m.mentionedJid[0]
                : null;
        if (!target)
            return m.reply('Etiqueta o responde al mensaje del usuario que deseas ascender.');
        const cleanTarget = target.split(':')[0] + '@s.whatsapp.net';
        const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        if (cleanTarget === botJid)
            return m.reply('Ya soy administrador del grupo.');
        try {
            await sock.groupParticipantsUpdate(m.chat, [target], 'promote');
            if (global.db.data.chats[m.chat]) {
                const chatData = global.db.data.chats[m.chat];
                if (!chatData.logs)
                    chatData.logs = [];
                chatData.logs.push({
                    action: 'promote',
                    option: 'ADD ADMIN',
                    target: cleanTarget,
                    by: m.sender,
                    date: new Date().toISOString(),
                });
            }
            return sock.sendMessage(m.chat, {
                text: `*${m.pushName}* ahora es administrador.`,
                mentions: [cleanTarget],
            });
        }
        catch (e) {
            console.error(e);
            return m.reply('No se pudo realizar el ascenso. Verifica mis permisos en el grupo.');
        }
    },
};
