export default {
    command: ['restart', 'reiniciar'],
    description: 'Reinicia el bot remotamente',
    category: 'developer',
    isDev: true,
    run: async (sock, m) => {
        await sock.sendMessage(m.chat, {
            text: `☁️ *WaBot* se estará reiniciando...\n> Espere mientras el sock se reinicia`,
        }, { quoted: m });
        setTimeout(() => {
            process.exit(0);
        }, 3000);
    },
};
