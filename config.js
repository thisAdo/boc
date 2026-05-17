const config = {
  prefix: '.',
  sessionDir: './sesiones',
  databaseUrl: 'postgresql://neondb_owner:npg_ASO7lYNCn6BM@ep-bitter-bonus-aq0sg4hk-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  legacyGroupEventsPath: './lib/group-events.json',
  browser: ['Ubuntu', 'Chrome', '120.0.0.0'],
  pairing: {
    enabled: true,
    phoneNumber: ''
  },
  owners: ['573135180876', '50498273976'],
  bot: {
    name: 'XDroid',
    packageName: '🌵 XDroid',
    packageAuthor: '• 𝗺ᴀᴅᴇ ʙʏ causotes'
  },
  media: {
    pingThumbnail: 'https://adofiles.i11.eu/dl/9f78f366.jpg',
    updateThumbnail: 'https://adofiles.i11.eu/dl/9f78f366.jpg',
    eventsBanner: 'https://adofiles.i11.eu/dl/14ce36bb.jpg',
    defaultProfile: 'https://adofiles.vercel.app/dl/buzz-patrick.jpg'
  },
  limits: {
    reconnectAttempts: 15,
    antilinkWarnings: 2,
    ffmpegStickerSeconds: 10,
    commandReplyLength: 3800,
    updateReplyLength: 1200
  }
}

export default config
