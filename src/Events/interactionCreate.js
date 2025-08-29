const { Collection, Events, InteractionType } = require("discord.js");
const ayarlar = require("../Base/ayarlar.js");
const cooldown = new Collection();

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    const { client } = interaction;

    // Buton etkileşimleri
    if (interaction.isButton()) {
      try {
        const customId = interaction.customId;

        // Baskın bildirimi butonları
        if (customId.startsWith('finish_baskin_')) {
          const userId = customId.split('_')[2];
          if (interaction.user.id !== userId) {
            return interaction.reply({ content: "Bu butonu sadece raporu başlatan kullanabilir.", ephemeral: true });
          }

          const session = client.baskinSessions?.get(userId);
          if (!session) {
            return interaction.reply({ content: "Oturum bulunamadı. Lütfen komutu tekrar çalıştırın.", ephemeral: true });
          }

          if (session.raiders.length === 0) {
            return interaction.reply({ content: "Hiç baskıncı eklenmedi. Önce mesaj olarak baskıncı bilgilerini gönderin.", ephemeral: true });
          }

          // Onay için bot sahibine gönder
          await this.sendApprovalRequest(client, session, interaction);
          
        } else if (customId.startsWith('cancel_baskin_')) {
          const userId = customId.split('_')[2];
          if (interaction.user.id !== userId) {
            return interaction.reply({ content: "Bu butonu sadece raporu başlatan kullanabilir.", ephemeral: true });
          }

          // Oturumu temizle
          if (client.baskinSessions) {
            client.baskinSessions.delete(userId);
          }

          await interaction.update({ 
            content: "❌ Baskın bildirimi iptal edildi.", 
            embeds: [], 
            components: [] 
          });

        } else if (customId.startsWith('approve_report_')) {
          const reportId = parseInt(customId.split('_')[2]);
          await this.handleApproval(client, interaction, reportId, true);

        } else if (customId.startsWith('reject_report_')) {
          const reportId = parseInt(customId.split('_')[2]);
          await this.handleApproval(client, interaction, reportId, false);
        }

      } catch (error) {
        console.error('Buton etkileşim hatası:', error);
        interaction.reply({ content: "Bir hata oluştu.", ephemeral: true }).catch(() => {});
      }
    }

    // Slash komut etkileşimleri
    if (interaction.type === InteractionType.ApplicationCommand) {
      if (interaction.user.bot) return;

      try {
        const command = client.slashCommands.get(interaction.commandName);
        if (command) {
          if (command.ownerOnly && !ayarlar.owners.includes(interaction.user.id)) {
            return interaction.reply({
              content: "Sadece bot sahibi bu komutu kullanabilir.",
              ephemeral: true,
            });
          }

          if (command.cooldown) {
            if (cooldown.has(`${command.name}-${interaction.user.id}`)) {
              const nowDate = interaction.createdTimestamp;
              const waitedDate = cooldown.get(`${command.name}-${interaction.user.id}`) - nowDate;
              return interaction
                .reply({
                  content: `Cooldown aktif, tekrar deneyin <t:${Math.floor(
                    new Date(nowDate + waitedDate).getTime() / 1000,
                  )}:R>.`,
                  ephemeral: true,
                })
                .then(() =>
                  setTimeout(
                    () => interaction.deleteReply().catch(() => {}),
                    cooldown.get(`${command.name}-${interaction.user.id}`) - Date.now() + 1000,
                  ),
                );
            }

            try {
              await command.slashRun(client, interaction);
            } catch (err) {
              const errPayload = {
                error: err,
                command: command.slashData?.name || command.name || "unknown",
                type: "slash",
                context: {
                  guildId: interaction.guild?.id,
                  channelId: interaction.channelId,
                  userId: interaction.user.id,
                },
              };
              if (client && typeof client.emit === "function") client.emit("commandError", errPayload);
              interaction.reply({
                content: "Komut çalıştırılırken bir hata oluştu. Bildirim gönderildi.",
                ephemeral: true,
              }).catch(() => {});
            }

            cooldown.set(`${command.name}-${interaction.user.id}`, Date.now() + command.cooldown);
            setTimeout(() => {
              cooldown.delete(`${command.name}-${interaction.user.id}`);
            }, command.cooldown + 1000);
          } else {
            try {
              await command.slashRun(client, interaction);
            } catch (err) {
              const errPayload = {
                error: err,
                command: command.slashData?.name || command.name || "unknown",
                type: "slash",
                context: {
                  guildId: interaction.guild?.id,
                  channelId: interaction.channelId,
                  userId: interaction.user.id,
                },
              };
              if (client && typeof client.emit === "function") client.emit("commandError", errPayload);
              interaction.reply({
                content: "Komut çalıştırılırken bir hata oluştu. Bildirim gönderildi.",
                ephemeral: true,
              }).catch(() => {});
            }
          }
        }
      } catch (e) {
        console.error(e);
        interaction.reply({
          content: "Bir hata oluştu! Lütfen tekrar deneyin.",
          ephemeral: true,
        }).catch(() => {});
      }
    }
  },

  async sendApprovalRequest(client, session, interaction) {
    try {
      const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      
      const embed = new EmbedBuilder()
        .setTitle(`🔍 Onay Bekleyen Baskın Raporu #${session.reportId}`)
        .setDescription(`**Bildiren:** ${interaction.user.tag} (${interaction.user.id})\n**Sunucu:** ${interaction.guild.name}\n**Baskıncı Sayısı:** ${session.raiders.length}`)
        .setColor("#FFA500")
        .setTimestamp();

      const raiderList = session.raiders.map(r => 
        `• **${r.username}** (${r.userId})\n  Sebep: ${r.reason}`
      ).join('\n');

      embed.addFields([
        { name: "Baskıncı Listesi", value: raiderList, inline: false }
      ]);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`approve_report_${session.reportId}`)
          .setLabel("✅ Onayla")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`reject_report_${session.reportId}`)
          .setLabel("❌ Reddet")
          .setStyle(ButtonStyle.Danger)
      );

      // Bot sahibine veya log kanalına gönder
      let sent = false;

      // Önce log kanalını dene
      if (ayarlar.logChannelId) {
        const logChannel = await client.channels.fetch(ayarlar.logChannelId).catch(() => null);
        if (logChannel && logChannel.send) {
          await logChannel.send({ embeds: [embed], components: [row] });
          sent = true;
        }
      }

      // Eğer log kanalına gönderilemezse bot sahibine DM gönder
      if (!sent && ayarlar.owners && ayarlar.owners.length > 0) {
        for (const ownerId of ayarlar.owners) {
          try {
            const owner = await client.users.fetch(ownerId).catch(() => null);
            if (owner) {
              await owner.send({ embeds: [embed], components: [row] });
              sent = true;
              break;
            }
          } catch (error) {
            console.error(`Bot sahibine DM gönderilirken hata: ${ownerId}`, error);
          }
        }
      }

      if (sent) {
        // Oturumu temizle
        client.baskinSessions.delete(interaction.user.id);
        
        await interaction.update({
          content: "✅ Baskın raporu gönderildi! Onay bekleniyor...",
          embeds: [],
          components: []
        });
      } else {
        await interaction.reply({
          content: "❌ Rapor gönderilemedi. Log kanalı veya bot sahibi bulunamadı.",
          ephemeral: true
        });
      }

    } catch (error) {
      console.error('Onay isteği gönderme hatası:', error);
      interaction.reply({ content: "Rapor gönderilirken hata oluştu.", ephemeral: true }).catch(() => {});
    }
  },

  async handleApproval(client, interaction, reportId, approved) {
    try {
      const { EmbedBuilder } = require('discord.js');

      if (!ayarlar.owners.includes(interaction.user.id)) {
        return interaction.reply({ content: "Bu işlemi sadece bot sahibi yapabilir.", ephemeral: true });
      }

      if (approved) {
        client.db.approveReport(reportId, interaction.user.id);
        
        // Rapor detaylarını al ve embed oluştur
        const baskinCommand = require('../Commands/info/baskin-bildir.js');
        const reportEmbed = await baskinCommand.handleBaskinReport(client, reportId, interaction.user.id);
        
        if (reportEmbed) {
          reportEmbed.setColor("#00FF00");
          reportEmbed.setTitle(reportEmbed.data.title + " - ✅ ONAYLANDI");
        }

        await interaction.update({
          content: `✅ Rapor #${reportId} onaylandı!`,
          embeds: reportEmbed ? [reportEmbed] : [],
          components: []
        });

        // Rapor sahibine bildirim gönder
        const { report } = client.db.getReportDetails(reportId);
        if (report) {
          try {
            const reporter = await client.users.fetch(report.reporter_id).catch(() => null);
            if (reporter) {
              const notifyEmbed = new EmbedBuilder()
                .setTitle("✅ Baskın Raporunuz Onaylandı!")
                .setDescription(`Rapor #${reportId} onaylandı ve veritabanına kaydedildi.`)
                .setColor("#00FF00")
                .setTimestamp();
              
              await reporter.send({ embeds: [notifyEmbed] }).catch(() => {});
            }
          } catch (error) {
            console.error('Rapor sahibine bildirim gönderilirken hata:', error);
          }
        }

      } else {
        client.db.rejectReport(reportId, interaction.user.id);
        
        await interaction.update({
          content: `❌ Rapor #${reportId} reddedildi.`,
          embeds: [],
          components: []
        });

        // Rapor sahibine red bildirimi gönder
        const { report } = client.db.getReportDetails(reportId);
        if (report) {
          try {
            const reporter = await client.users.fetch(report.reporter_id).catch(() => null);
            if (reporter) {
              const notifyEmbed = new EmbedBuilder()
                .setTitle("❌ Baskın Raporunuz Reddedildi")
                .setDescription(`Rapor #${reportId} reddedildi.`)
                .setColor("#FF0000")
                .setTimestamp();
              
              await reporter.send({ embeds: [notifyEmbed] }).catch(() => {});
            }
          } catch (error) {
            console.error('Rapor sahibine red bildirimi gönderilirken hata:', error);
          }
        }
      }

    } catch (error) {
      console.error('Onay işleme hatası:', error);
      interaction.reply({ content: "Onay işleminde hata oluştu.", ephemeral: true }).catch(() => {});
    }
  }
};