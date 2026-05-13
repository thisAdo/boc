import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import config from './config.js';
import chalk from 'chalk';
import { antiLink } from './plugins/antilink.js';
import { resolveLidToRealJid } from './lib/utils.js';

const pluginCache = new Map();
const commandIndex = new Map();
let cacheLoaded = false;

const cleanId = (value = '') => {
    if (!value || typeof value !== 'string') return '';
    return value
        .split('@')[0]
        .split(':')[0]
        .replace(/[^0-9a-zA-Z]/g, '')
        .toLowerCase();
};

const normalizeJid = (jid = '') => {
    if (!jid || typeof jid !== 'string') return '';
    const parts = jid.split('@');
    const user = cleanId(parts[0]);
    const server = parts[1] || 's.whatsapp.net';
    if (!user) return '';
    return `${user}@${server}`;
};

const jidKeys = (jid = '') => {
    const keys = new Set();
    if (!jid || typeof jid !== 'string') return keys;

    const original = jid.toLowerCase();
    const normalized = normalizeJid(jid);
    const raw = cleanId(jid);

    if (original) keys.add(original);
    if (normalized) keys.add(normalized.toLowerCase());
    if (raw) keys.add(raw);

    return keys;
};

const addKeys = (target, value) => {
    for (const key of jidKeys(value)) {
        target.add(key);
    }
};

const participantKeys = (participant = {}) => {
    const keys = new Set();

    addKeys(keys, participant.id);
    addKeys(keys, participant.jid);
    addKeys(keys, participant.lid);
    addKeys(keys, participant.phoneNumber);
    addKeys(keys, participant.pn);

    return keys;
};

const hasMatch = (a, b) => {
    for (const key of a) {
        if (b.has(key)) return true;
    }
    return false;
};

const isAdminRole = (participant = {}) => {
    return participant.admin === 'admin' || participant.admin === 'superadmin';
};

const ownerIds = new Set((config.owners || []).map(cleanId));
const devIds = new Set((config.devs || []).map(cleanId));

const getFiles = (dir) => {
    let results = [];
    const list = readdirSync(dir);

    for (const file of list) {
        const filePath = join(dir, file);

        if (statSync(filePath).isDirectory()) {
            results = results.concat(getFiles(filePath));
        } else if (file.endsWith('.js')) {
            results.push(filePath);
        }
    }

    return results;
};

async function loadPlugins() {
    const pluginFolder = join(process.cwd(), 'plugins');
    const pluginFiles = getFiles(pluginFolder);

    pluginCache.clear();
    commandIndex.clear();

    for (const fullPath of pluginFiles) {
        try {
            const fileUrl = pathToFileURL(fullPath).href;
            const plugin = await import(`${fileUrl}?t=${Date.now()}`);
            const data = plugin.default;

            if (!data || !data.command || typeof data.run !== 'function') continue;

            const commands = Array.isArray(data.command) ? data.command : [data.command];

            pluginCache.set(fullPath, data);

            for (const alias of commands) {
                if (!alias) continue;
                commandIndex.set(String(alias).toLowerCase(), data);
            }
        } catch (e) {
            console.error(chalk.red(`[ ❌ ] Error cargando plugin: ${fullPath.split('/').pop()}`), e);
        }
    }

    cacheLoaded = true;
    console.log(chalk.green(`[ ✅ ] ${pluginCache.size} plugins cargados en caché.`));
}

export const pluginsReady = loadPlugins();
export { pluginCache, commandIndex, loadPlugins };

const jidCache = new Map();

async function resolveJid(sender, sock, chat) {
    if (!sender) return sender;

    if (jidCache.has(sender)) {
        return jidCache.get(sender);
    }

    let resolved = sender;

    try {
        resolved = await resolveLidToRealJid(sender, sock, chat);
    } catch {
        resolved = sender;
    }

    if (!resolved) resolved = sender;

    jidCache.set(sender, resolved);

    setTimeout(() => {
        jidCache.delete(sender);
    }, 30 * 60 * 1000);

    return resolved;
}

function getMessageBody(m) {
    return m.message?.conversation ||
        m.message?.extendedTextMessage?.text ||
        m.message?.imageMessage?.caption ||
        m.message?.videoMessage?.caption ||
        m.message?.buttonsResponseMessage?.selectedButtonId ||
        m.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
        m.message?.templateButtonReplyMessage?.selectedId ||
        m.text ||
        '';
}

function buildBotKeys(sock) {
    const keys = new Set();

    addKeys(keys, sock?.user?.id);
    addKeys(keys, sock?.user?.jid);
    addKeys(keys, sock?.user?.lid);

    try {
        if (typeof sock?.decodeJid === 'function') {
            addKeys(keys, sock.decodeJid(sock?.user?.id));
            addKeys(keys, sock.decodeJid(sock?.user?.jid));
        }
    } catch {}

    return keys;
}

function buildSenderKeys(m, senderJid) {
    const keys = new Set();

    addKeys(keys, m.sender);
    addKeys(keys, senderJid);
    addKeys(keys, m.key?.participant);
    addKeys(keys, m.participant);

    return keys;
}

function getBotId(sock) {
    const jid = normalizeJid(sock?.user?.id || sock?.user?.jid || '');
    if (jid) return jid;
    return `${cleanId(sock?.user?.id || sock?.user?.jid || 'bot')}@s.whatsapp.net`;
}

function showLogs(data) {
    const border = chalk.hex('#7C3AED');
    const label = chalk.hex('#C4B5FD').bold;
    const value = chalk.hex('#EDE9FE');
    const muted = chalk.hex('#A78BFA');

    const rows = [
        ['CMD', data.commandName],
        ['PREFIX', data.prefix],
        ['USER', data.user],
        ['SENDER', data.sender],
        ['RESOLVED', data.resolved],
        ['CHAT', data.chat],
        ['GROUP', data.isGroup],
        ['GROUP NAME', data.groupName],
        ['OWNER', data.isOwner],
        ['DEV', data.isDev],
        ['ADMIN', data.isAdmins],
        ['BOT ADMIN', data.isBotAdmin],
        ['ARGS', data.args],
        ['TEXT', data.text],
        ['PLUGIN', data.plugin],
        ['TIME', data.time]
    ];

    console.log(border('╭────────────────────────────────────────────╮'));

    for (const [key, val] of rows) {
        console.log(`${border('│')} ${label(`${key.padEnd(10)}:`)} ${value(String(val || '-'))}`);
    }

    console.log(border('╰────────────────────────────────────────────╯'));
    console.log(muted(''));
}

export default async function handler(sock, m) {
    try {
        if (!m.message) return;

        const body = getMessageBody(m);
        const prefix = (config.prefix || []).find((p) => body.startsWith(p));

        if (!prefix) {
            antiLink(sock, m).catch(() => {});
            return;
        }

        const args = body.slice(prefix.length).trim().split(/ +/).filter(Boolean);
        const commandName = args.shift()?.toLowerCase() || '';
        const text = args.join(' ');
        const command = commandName;

        if (!cacheLoaded) return;

        const cmd = commandIndex.get(commandName);
        if (!cmd) return;

        const [senderJid] = await Promise.all([
            resolveJid(m.sender, sock, m.chat),
            antiLink(sock, m).catch(() => {})
        ]);

        const senderId = cleanId(senderJid || m.sender);
        const botId = getBotId(sock);

        global.db = global.db || {};
        global.db.users = global.db.users || {};
        global.db.chats = global.db.chats || {};
        global.db.settings = global.db.settings || {};

        if (!global.db.users[senderId]) {
            global.db.users[senderId] = {
                user: senderJid || m.sender,
                coins: 0
            };
        }

        if (!global.db.chats[m.chat]) {
            global.db.chats[m.chat] = {
                id: m.chat,
                detect: true,
                welcome: true,
                antilink: true
            };
        }

        if (!global.db.settings[botId]) {
            global.db.settings[botId] = {
                bot: botId
            };
        }

        let groupMetadata = null;
        let groupAdmins = [];
        let groupName = '';
        let isAdmins = false;
        let isBotAdmin = false;

        if (m.isGroup) {
            if (!global.groupMetaCache) {
                global.groupMetaCache = new Map();
            }

            const cached = global.groupMetaCache.get(m.chat);

            if (cached && Date.now() - cached.ts < 2 * 60 * 1000) {
                groupMetadata = cached.data;
            } else {
                groupMetadata = await sock.groupMetadata(m.chat).catch(() => null);

                if (groupMetadata) {
                    global.groupMetaCache.set(m.chat, {
                        data: groupMetadata,
                        ts: Date.now()
                    });
                }
            }

            groupName = groupMetadata?.subject || '';
            groupAdmins = groupMetadata?.participants?.filter(isAdminRole) || [];

            const botKeys = buildBotKeys(sock);
            const senderKeys = buildSenderKeys(m, senderJid);

            isBotAdmin = groupAdmins.some((participant) => {
                return hasMatch(participantKeys(participant), botKeys);
            });

            isAdmins = groupAdmins.some((participant) => {
                return hasMatch(participantKeys(participant), senderKeys);
            });
        }

        const isOwner = ownerIds.has(cleanId(senderJid)) || ownerIds.has(cleanId(m.sender));
        const isDev = devIds.has(cleanId(senderJid)) || devIds.has(cleanId(m.sender));

        const time = new Date().toLocaleString('es-HN', {
            timeZone: config.timezone || 'America/Tegucigalpa',
            hour12: false
        });

        showLogs({
            commandName,
            prefix,
            user: m.pushName || 'User',
            sender: m.sender || '-',
            resolved: senderJid || '-',
            chat: m.chat || '-',
            isGroup: m.isGroup ? 'Sí' : 'No',
            groupName: groupName || '-',
            isOwner: isOwner ? 'Sí' : 'No',
            isDev: isDev ? 'Sí' : 'No',
            isAdmins: m.isGroup ? isAdmins ? 'Sí' : 'No' : 'N/A',
            isBotAdmin: m.isGroup ? isBotAdmin ? 'Sí' : 'No' : 'N/A',
            args: args.length,
            text: text || '-',
            plugin: cmd.category || 'Sin categoría',
            time
        });

        if (cmd.isOwner && !isOwner) {
            return m.reply('Dueño solamente.');
        }

        if (cmd.isDev && !isDev) {
            return m.reply('Creador solamente.');
        }

        if (cmd.isGroup && !m.isGroup) {
            return m.reply('Grupos solamente.');
        }

        if (cmd.isAdmin && !isAdmins) {
            return m.reply('Admins solamente.');
        }

        if (cmd.isBotAdmin && !isBotAdmin) {
            return m.reply('Hazme admin primero.');
        }

        try {
            return await cmd.run(sock, m, {
                args,
                prefix,
                commandName,
                isAdmins,
                isBotAdmin,
                isOwner,
                isDev,
                senderJid,
                text,
                command,
                groupMetadata,
                groupAdmins,
                groupName
            });
        } catch (e) {
            console.error(chalk.red(`Error en plugin '${commandName}':`), e);
            await m.reply('_Ocurrió un error al ejecutar el comando. Intenta de nuevo._');
        }
    } catch (e) {
        console.error(chalk.red.bold('Error en el Handler:'), e);
    }
}