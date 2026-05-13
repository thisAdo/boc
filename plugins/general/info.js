import os from 'os';

export default {
    command: ['info', 'botinfo'],
    description: 'Muestra los datos técnicos del bot',
    category: 'general',

    run: async (sock, m, { prefix }) => {
        const up = process.uptime();

        const h = Math.floor(up / 3600);
        const min = Math.floor((up % 3600) / 60);
        const s = Math.floor(up % 60);

        const cpu = os.cpus()[0]?.model.trim() || 'Desconocido';
        const cores = os.cpus().length;

        const mem = [
            (os.freemem() / 1024 / 1024).toFixed(0),
            (os.totalmem() / 1024 / 1024).toFixed(0)
        ];

        const platform = `${os.platform()} ${os.release()} (${os.arch()})`;
        const nodeV = process.version;
        const host = os.hostname();
        const shell = process.env.SHELL || process.env.COMSPEC || 'desconocido';

        const now = new Date().toLocaleString('en-US', {
            timeZone: 'America/Mexico_City',
            hour12: false,
        });

        const botname = 'WaBot';
        const banner = 'https://cdn.adoolab.xyz/dl/fb5d58a1.jpg';

        const info = `*Nombre Bot:* ${botname}
*Uptime:* ${h}h ${min}m ${s}s
*Plataforma:* ${platform}
*Node.js:* ${nodeV}
*Host:* ${host}
*Shell:* ${shell}

*CPU:* ${cpu} (${cores} núcleos)
*Memoria:* ${mem[0]} MiB libre / ${mem[1]} MiB total

*Fecha & Hora:* ${now}`;

        await sock.sendMessage(
            m.chat,
            {
                image: { url: banner },
                caption: info.trim()
            },
            { quoted: m }
        );
    },
};