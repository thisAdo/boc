import { readdirSync, statSync } from 'fs';
import { pathToFileURL } from 'url';
import { join as joinPath } from 'path';
import moment from 'moment-timezone';

export default {
    command: ['menu', 'help'],
    category: 'general',

    run: async (sock, m, { prefix, isOwner }) => {
        const pluginFolder = joinPath(process.cwd(), 'plugins');
        const categories = {};

        const getFiles = (dir) => {
            const list = readdirSync(dir);

            return list.reduce((acc, file) => {
                const filePath = joinPath(dir, file);

                if (statSync(filePath).isDirectory()) {
                    return acc.concat(getFiles(filePath));
                }

                if (file.endsWith('.js')) {
                    acc.push(filePath);
                }

                return acc;
            }, []);
        };

        const pluginFiles = getFiles(pluginFolder);

        for (const filePath of pluginFiles) {
            try {
                const fileUrl = pathToFileURL(filePath).href;
                const plugin = await import(`${fileUrl}?update=${Date.now()}`);
                const data = plugin.default;

                if (data?.command && data?.category) {
                    const cat = data.category.toLowerCase();

                    if (!categories[cat]) categories[cat] = [];

                    categories[cat].push(data.command[0]);
                }
            } catch (e) {
                console.error(`Error en ${filePath}:`, e);
            }
        }

        const time = moment().tz('America/Mexico_City').format('HH:mm:ss');
        const name = m.pushName || 'User';

        const banner = 'https://cdn.evogb.org/AzamiJs/NevMd-37f1e73bea2c8868c8a2a1b288f42b67.jpg';

        let menuText = `*¡Hola ${name}!* espero que te encuentres bien, aquí tienes mi lista de funciones... *!!* ˙\n\n`;

        const sortedCategories = Object.keys(categories).sort();

        for (const category of sortedCategories) {
            menuText += `\n☁️ \`${category.toUpperCase()}:\`\n`;

            categories[category].forEach((cmd) => {
                menuText += `→ ${prefix}${cmd}\n`;
            });
        }

        menuText += `\n\`Canal\` https://whatsapp.com/channel/0029Vb5vOO0ADTOGbo78x03q\n`;
        menuText += `\n⏰ *Hora:* ${time}`;

        await sock.sendMessage(
            m.chat,
            {
                image: { url: banner },
                caption: menuText.trim()
            },
            { quoted: m }
        );
    },
};