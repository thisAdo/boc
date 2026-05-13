export default {
    command: ['ping'],
    description: 'Chequea la conexión y muestra info del bot',
    category: 'general',
    run: async (sock, m, { prefix }) => {
        const start = Date.now();
        await sock.sendMessage(m.chat, { react: { text: '⏱️', key: m.key } });
        const latency = Date.now() - start;
        const up = process.uptime();
        const h = Math.floor(up / 3600);
        const min = Math.floor((up % 3600) / 60);
        const s = Math.floor(up % 60);
        const ram = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const userTag = m.pushName || 'Invitado';
        const sender = m.sender.split('@')[0];
        const msg = `Hola, ${userTag} ☀️

\`Ping:\` ${latency} ms
\`Uptime:\` [ ${h}h ${min}m ${s}s ]
\`RAM usada:\` ${ram} MB
\`Usuario ID:\` @${sender}`.trim();
        await sock.sendMessage(m.chat, { text: msg, mentions: [m.sender] }, { quoted: m });
    },
};
