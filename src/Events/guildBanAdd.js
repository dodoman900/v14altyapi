const { Events, AuditLogEvent } = require('discord.js');

module.exports = {
  name: Events.GuildBanAdd,
  async execute(ban) {
    try {
      const { guild, user } = ban;
      const client = guild.client;

      // Veritabanı kontrolü
      if (!client.db) {
        console.warn('Veritabanı bulunamadı, ban kaydedilemedi');
        return;
      }

      // Audit log'dan ban bilgilerini al
      let executor = null;
      let reason = ban.reason || null;
      let auditLogId = null;

      try {
        const auditLogs = await guild.fetchAuditLogs({
          type: AuditLogEvent.MemberBanAdd,
          limit: 10
        });

        // Son banlarda bu kullanıcıyı ara
        const banEntry = auditLogs.entries.find(entry => {
          return entry.target?.id === user.id && 
                 Date.now() - entry.createdTimestamp < 10000; // Son 10 saniye
        });

        if (banEntry) {
          executor = banEntry.executor;
          reason = banEntry.reason || reason;
          auditLogId = banEntry.id;
        }
      } catch (auditError) {
        console.warn('Audit log erişim hatası:', auditError.message);
      }

      // Veritabanına kaydet
      const executorId = executor?.id || 'unknown';
      const executorTag = executor?.tag || 'Bilinmiyor';
      const username = user.tag || user.username || 'Bilinmiyor';

      client.db.addRecentBan(
        guild.id,
        user.id,
        username,
        executorId,
        executorTag,
        reason,
        Date.now(),
        auditLogId
      );

      console.log(`📋 Ban kaydedildi: ${username} (${user.id}) - ${executorTag} tarafından`);

    } catch (error) {
      console.error('Ban takip hatası:', error);
    }
  }
};