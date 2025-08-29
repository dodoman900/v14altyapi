const DatabaseManager = require('../Base/database.js');

module.exports = {
  async execute(client) {
    try {
      // Veritabanı yöneticisini başlat
      client.db = new DatabaseManager();
      
      // Client kapanırken veritabanını kapat
      process.on('SIGINT', () => {
        console.log('\n🔄 Bot kapatılıyor...');
        if (client.db) {
          client.db.close();
          console.log('✅ Veritabanı bağlantısı kapatıldı');
        }
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        if (client.db) {
          client.db.close();
        }
        process.exit(0);
      });

      // Baskın oturumları için Map
      client.baskinSessions = new Map();

      const logger = client.logger || console;
      logger.info('✅ Veritabanı handler yüklendi');

    } catch (error) {
      console.error('❌ Veritabanı handler hatası:', error);
      throw error;
    }
  }
};