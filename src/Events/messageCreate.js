const { ChannelType, Collection, Events } = require("discord.js");
const ayarlar = require("../Base/ayarlar.js");
const cooldown = new Collection();

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    const { client } = message;

    if (message.author.bot) return;
    if (message.channel.type === ChannelType.DM) return;

    // Baskın bildirimi oturumu kontrolü
    if (client.baskinSessions && client.baskinSessions.has(message.author.id)) {
      const session = client.baskinSessions.get(message.author.id);
      
      if (session.step === 'collecting' && session.guildId === message.guild.id) {
        await this.handleBaskinData(client, message, session);
        return;
      }
    }

    const { prefix } = ayarlar;
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/g);
    const cmd = args.shift().toLowerCase();
    if (cmd.length === 0) return;

    let command = client.commands.get(cmd);
    command ||= client.commands.get(client.commandAliases.get(cmd));

    if (command) {
      if (command.ownerOnly && !ayarlar.owners.includes(message.author.id)) {
        return message.reply({
          content: "Sadece bot sahibi bu komutu kullanabilir.",
        });
      }

      try {
        if (command.cooldown) {
          if (cooldown.has(`${command.name}-${message.author.id}`)) {
            const nowDate = message.createdTimestamp;
            const waitedDate = cooldown.get(`${command.name}-${message.author.id}`) - nowDate;
            return message
              .reply({
                content: `Cooldown aktif, tekrar deneyin <t:${Math.floor(
                  new Date(nowDate + waitedDate).getTime() / 1000,
                )}:R>.`,
              })
              .then((msg) =>
                setTimeout(
                  () => msg.delete().catch(() => {}),
                  cooldown.get(`${command.name}-${message.author.id}`) - Date.now() + 1000,
                ),
              );
          }

          await command.prefixRun(client, message, args);

          cooldown.set(`${command.name}-${message.author.id}`, Date.now() + command.cooldown);
          setTimeout(() => {
            cooldown.delete(`${command.name}-${message.author.id}`);
          }, command.cooldown);
        } else {
          await command.prefixRun(client, message, args);
        }
      } catch (err) {
        const errPayload = {
          error: err,
          command: command.prefixData?.name || command.name || "unknown",
          type: "prefix",
          context: {
            guildId: message.guild?.id,
            channelId: message.channel.id,
            userId: message.author.id,
            content: message.content,
          },
        };
        if (message.client && typeof message.client.emit === "function") {
          message.client.emit("commandError", errPayload);
        }
        message.reply({
          content: "Komut çalıştırılırken bir hata oluştu. Bildirim gönderildi.",
        }).catch(() => {});
      }
    }
  },

  async handleBaskinData(client, message, session) {
    try {
      const content = message.content.trim();
      const lines = content.split('\n').filter(line => line.trim().length > 0);

      let addedCount = 0;
      let errors = [];

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 3) {
          errors.push(`❌ Geçersiz format: "${line}"`);
          continue;
        }

        const userId = parts[0];
        const username = parts[1];
        const reason = parts.slice(2).join(' ');

        // Basit ID doğrulaması
        if (!/^\d{17,19}$/.test(userId)) {
          errors.push(`❌ Geçersiz user ID: "${userId}"`);
          continue;
        }

        // Tekrar kontrolü
        if (session.raiders.some(r => r.userId === userId)) {
          errors.push(`⚠️ Kullanıcı zaten ekli: ${username}`);
          continue;
        }

        // Veritabanına ekle
        try {
          client.db.addRaider(session.reportId, userId, username, reason);
          session.raiders.push({ userId, username, reason });
          addedCount++;
        } catch (error) {
          console.error('Baskıncı ekleme hatası:', error);
          errors.push(`❌ Veritabanı hatası: ${username}`);
        }
      }

      // Geri bildirim mesajı
      let response = `📝 **Veri İşlem Sonucu:**\n✅ ${addedCount} baskıncı eklendi\n📊 Toplam: ${session.raiders.length} baskıncı`;

      if (errors.length > 0) {
        response += `\n\n**Hatalar:**\n${errors.slice(0, 5).join('\n')}`;
        if (errors.length > 5) {
          response += `\n... ve ${errors.length - 5} hata daha`;
        }
      }

      response += `\n\n**Not:** Daha fazla baskıncı eklemek için mesaj göndermeye devam edin veya bitirmek için ✅ butonuna basın.`;

      await message.reply({ content: response }).catch(() => {});

      // Mesajı sil (spam önleme)
      setTimeout(() => {
        message.delete().catch(() => {});
      }, 2000);

    } catch (error) {
      console.error('Baskın verisi işleme hatası:', error);
      message.reply({ content: "❌ Veri işlenirken hata oluştu." }).catch(() => {});
    }
  }
};