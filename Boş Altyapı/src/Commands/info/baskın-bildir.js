const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  PermissionFlagsBits, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle
} = require("discord.js");
const ayarlar = require("../../Base/ayarlar.js");

module.exports.commandBase = {
  prefixData: {
    name: "baskin-bildir",
    aliases: ["baskin"],
  },
  slashData: new SlashCommandBuilder()
    .setName("baskin-bildir")
    .setDescription("Sunucuya baskın bildirin"),
  cooldown: 10000,
  ownerOnly: false,
  conf: {
    description: "Sunucuda baskın olduğunu düşünüyorsanız yetkililere bildirir.",
    usage: "/baskin-bildir veya !baskin-bildir",
    examples: ["/baskin-bildir", "!baskin-bildir"]
  },

  async prefixRun(client, message, args) {
    await this.handleBaskinCommand(client, message, null, 'prefix');
  },

  async slashRun(client, interaction) {
    await this.handleBaskinCommand(client, null, interaction, 'slash');
  },

  async handleBaskinCommand(client, message, interaction, type) {
    try {
      const user = message ? message.author : interaction.user;
      const guild = message ? message.guild : interaction.guild;
      const member = message ? message.member : interaction.member;

      if (!guild) {
        const content = "Bu komut sunucuda kullanılmalıdır.";
        if (type === 'prefix') return message.reply({ content });
        return interaction.reply({ content, ephemeral: true });
      }

      if (!member.permissions.has(PermissionFlagsBits.BanMembers)) {
        const content = "Bu komutu kullanmak için ban yetkisine ihtiyacın var.";
        if (type === 'prefix') return message.reply({ content });
        return interaction.reply({ content, ephemeral: true });
      }

      // Baskın raporu başlat
      const reportId = client.db.createBaskinReport(guild.id, user.id, user.tag);
      
      // Veri toplama için geçici depolama
      if (!client.baskinSessions) client.baskinSessions = new Map();
      client.baskinSessions.set(user.id, {
        reportId,
        guildId: guild.id,
        raiders: [],
        step: 'collecting'
      });

      const embed = new EmbedBuilder()
        .setTitle("🚨 Baskın Bildirimi Başlatıldı")
        .setDescription("Lütfen baskıncıların bilgilerini aşağıdaki format ile gönderin:")
        .addFields([
          { 
            name: "Format", 
            value: "```<user_id> <kullanıcı_adı> <sebep>\n<user_id> <kullanıcı_adı> <sebep>\n...```",
            inline: false 
          },
          {
            name: "Örnek",
            value: "```123456789 @troll_user spam yapıyor\n987654321 @raid_bot bot hesabı```",
            inline: false
          },
          {
            name: "Not",
            value: "• Her satırda bir kullanıcı bilgisi olmalı\n• ID, kullanıcı adı ve sebep boşluk ile ayrılmalı\n• Bitirdiğinizde ✅ butonuna basın",
            inline: false
          }
        ])
        .setColor("#FF0000")
        .setFooter({ text: `Rapor ID: ${reportId}` });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`finish_baskin_${user.id}`)
          .setLabel("✅ Veri Toplamayı Bitir")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`cancel_baskin_${user.id}`)
          .setLabel("❌ İptal Et")
          .setStyle(ButtonStyle.Danger)
      );

      if (type === 'prefix') {
        await message.reply({ embeds: [embed], components: [row] });
      } else {
        await interaction.reply({ embeds: [embed], components: [row] });
      }

    } catch (error) {
      console.error('Baskın bildir komut hatası:', error);
      const content = "Bir hata oluştu, yetkililere bildirildi.";
      if (type === 'prefix') {
        message.reply({ content }).catch(() => {});
      } else {
        interaction.reply({ content, ephemeral: true }).catch(() => {});
      }
    }
  }
};

// Export işlevleri
module.exports.handleBaskinReport = async function(client, reportId, approverId) {
  try {
    const { report, raiders } = client.db.getReportDetails(reportId);
    if (!report) return null;

    const guild = await client.guilds.fetch(report.guild_id).catch(() => null);
    if (!guild) return null;

    // Son yasaklananları getir
    const recentBans = client.db.getRecentBans(report.guild_id, 6);

    // Rapor embed'i oluştur
    const embed = new EmbedBuilder()
      .setTitle(`🚨 Baskın Raporu #${reportId}`)
      .setColor("#FF0000")
      .addFields([
        { name: "Sunucu", value: `${guild.name}`, inline: true },
        { name: "Bildiren", value: `<@${report.reporter_id}>`, inline: true },
        { name: "Tarih", value: `<t:${Math.floor(report.reported_at / 1000)}:F>`, inline: true }
      ])
      .setTimestamp();

    if (raiders.length > 0) {
      const raiderList = raiders.map(r => 
        `• **${r.username || 'Bilinmiyor'}** (${r.user_id})\n  Sebep: ${r.reason || 'Belirtilmedi'}`
      ).join('\n');

      embed.addFields([
        { name: `Baskıncılar (${raiders.length})`, value: raiderList, inline: false }
      ]);
    }

    if (recentBans.length > 0) {
      const banList = recentBans.slice(0, 10).map(ban => 
        `• **${ban.username || 'Bilinmiyor'}** - ${ban.banned_by_tag || 'Bilinmiyor'} tarafından yasaklandı\n  Sebep: ${ban.ban_reason || 'Belirtilmedi'}`
      ).join('\n');

      embed.addFields([
        { name: `Son 6 Saat Yasaklananlar (${recentBans.length})`, value: banList, inline: false }
      ]);
    }

    return embed;
  } catch (error) {
    console.error('Rapor oluşturma hatası:', error);
    return null;
  }
};