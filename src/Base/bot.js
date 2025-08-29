const { Client, GatewayIntentBits, Partials } = require("discord.js");
const { readdirSync } = require("node:fs");
const path = require("node:path");
const ayarlar = require("./ayarlar.js");

class BaseClient {
  constructor(token) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration, // Ban eventi için gerekli
        GatewayIntentBits.GuildMembers // Üye bilgileri için (opsiyonel)
      ],
      partials: Object.values(Partials),
      shards: "auto",
    });
    this.token = token;
  }

  async loadHandlers() {
    const handlersPath = path.join(__dirname, "..", "Handlers");
    let files = readdirSync(handlersPath);
    
    // Handler yükleme sırası: logger -> database -> command -> event -> error
    const loadOrder = ['logger.js', 'database.js', 'command.js', 'event.js', 'error.js'];
    const orderedFiles = [];
    
    // Önce belirli sıradaki dosyaları ekle
    for (const fileName of loadOrder) {
      if (files.includes(fileName)) {
        orderedFiles.push(fileName);
      }
    }
    
    // Kalan dosyaları ekle
    const remainingFiles = files.filter(file => !loadOrder.includes(file));
    orderedFiles.push(...remainingFiles);

    for (const file of orderedFiles) {
      try {
        const handler = require(path.join(handlersPath, file));
        if (typeof handler.execute === "function") {
          await handler.execute(this.client);
          console.log(`✅ Handler yüklendi: ${file}`);
        } else {
          console.warn(`⚠️ Handler execute fonksiyonu bulunamadı: ${file}`);
        }
      } catch (error) {
        console.error(`❌ Handler yükleme hatası (${file}):`, error);
      }
    }
  }

  async start() {
    try {
      console.log('🚀 Bot başlatılıyor...');
      await this.loadHandlers();
      
      console.log('🔐 Discord\'a bağlanılıyor...');
      await this.client.login(this.token);
      
    } catch (e) {
      console.error("❌ Bot başlatma hatası:", e.message || e);
      console.error("📋 Kontrol listesi:");
      console.error("- BOT_TOKEN doğru mu?");
      console.error("- Botunuzda gerekli intentler etkin mi? (Message Content, Guild, etc.)");
      console.error("- Veritabanı dosyası yazma izni var mı?");
      process.exit(1);
    }
  }

  // Temiz kapanma
  async shutdown() {
    console.log('🔄 Bot kapatılıyor...');
    
    // Baskın oturumlarını temizle
    if (this.client.baskinSessions) {
      this.client.baskinSessions.clear();
    }
    
    // Veritabanını kapat
    if (this.client.db) {
      this.client.db.close();
      console.log('✅ Veritabanı bağlantısı kapatıldı');
    }
    
    // Discord bağlantısını kapat
    this.client.destroy();
    console.log('✅ Bot kapatıldı');
  }
}

const token = ayarlar.token;
const client = new BaseClient(token);

// Graceful shutdown
process.on('SIGINT', async () => {
  await client.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await client.shutdown();
  process.exit(0);
});

// Unhandled rejections
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

client.start().catch(async (e) => {
  console.error('❌ Bot başlatılamadı:', e);
  await client.shutdown();
  process.exit(1);
});