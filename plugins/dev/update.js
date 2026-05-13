import { exec } from 'child_process';
import { promisify } from 'util';
import { loadPlugins, pluginCache } from '../../handler.js';
const execute = promisify(exec);
export default {
    command: ['update', 'actualizar'],
    description: 'Actualiza el repositorio y recarga los plugins en caliente',
    category: 'owner',
    isOwner: true,
    run: async (sock, m) => {
        try {
            await m.reply('Buscando actualizaciones en el repositorio...');
            const { stdout } = await execute('git pull');
            if (stdout.includes('Already up to date')) {
                return await m.reply('El sistema ya esta actualizado.');
            }
            await m.reply('Cambios detectados. Limpiando cache y recargando plugins...');
            pluginCache.clear();
            await loadPlugins();
            await m.reply('Actualizacion completada con exito.\n\n' + stdout);
        }
        catch (e) {
            await m.reply('Error durante la actualizacion:\n' + e.message);
        }
    },
};
