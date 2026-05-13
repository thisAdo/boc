export default {
    command: ['demote', 'degradar', 'quitaradmin'],
    description: 'Degrada a un administrador en el grupo usando menciones o mensaje respondido',
    category: 'groups',
    use: '@0 o responder al mensaje',
    isGroup: true,
    isAdmin: true,
    isBotAdmin: true,
    run: async (sock, m, args) => {
        let target;
        if (m.quoted)
            target = m.quoted.sender;
        if (!target) {
            const mentions = m.mentionedJid;
            if (mentions && mentions.length > 0)
                target = mentions[0];
        }
        if (!target)
            return m.reply('Etiquete o responda al mensaje del admin que desea degradar.');
        try {
            await sock.groupParticipantsUpdate(m.chat, [target], 'demote');
            const chatData = global.db.data.chats[m.chat];
            if (!chatData.logs)
                chatData.logs = [];
            chatData.logs.push({
                action: 'demote',
                option: 'DEL ADMIN',
                by: m.sender,
                date: new Date().toISOString(),
            });
            await sock.sendMessage(m.chat, {
                text: `*@${target.split('@')[0]}* ha sido degradado de administrador.`,
                mentions: [target],
            });
        }
        catch (e) {
            m.reply('No se pudo degradar al usuario. Verifica que sea administrador.');
        }
    },
};
