const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

module.exports.commandBase = {
  prefixData: {
    name: "banlist",
    aliases: ["banlar", "yasak-listesi"],
  },
  slashData: new SlashCommandBuilder()
    .setName("banlist")
    .setDescription("Onaylanmış baskın raporlarını görüntüler")
    .addIntegerOption(option =>
      option.setName("sayfa")
        .setDescription("Sayfa numarası")
        .setMinValue(1)
        .setRequired(false)
    ),
  cooldown: 5000,
  ownerOnly: false,
  conf: {
    description: "Sunucuda onaylanmış baskın raporlarını listeler.",
    usage: "/banlist [sayfa] veya !banlist [sayfa]",
    examples: ["/banlist", "!banlist 2", "/banlist sayfa:1"]
  },

  async prefixRun(client, message, args) {
    try {
      if (!message.guild) return message.reply({ content: "Bu komut sunucuda kullanılmalıdır." });

      if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
        return message.reply({ content: "Bu komutu kullanmak için ban yetkisine ihtiyacın var." });
      }

      const page = parseInt(args[0]) || 1;
      const embed = await this.createBanlistEmbed(client, message.guild, page);
      
      if (!embed) {
        return message.reply({ content: "Henüz onaylanmış baskın raporu bulunmuyor." });
      }

      await message.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Banlist prefix hatası:', error);
      message.reply({ content: "Bir hata oluştu." }).catch(() => {});
    }
  },

  async slashRun(client, interaction) {
    try {
      if (!interaction.guild) {
        return interaction.reply({ content: "Bu komut sunucuda kullanılmalıdır.", ephemeral: true });
      }

      if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
        return interaction.reply({ content: "Bu komutu kullanmak için ban yetkisine ihtiyacın var.", ephemeral: true });
      }

      const page = interaction.options.getInteger("sayfa") || 1;
      const embed = await this.createBanlistEmbed(client, interaction.guild, page);
      
      if (!embed) {
        return interaction.reply({ content: "Henüz onaylanmış baskın raporu bulunmuyor.", ephemeral: true });
      }

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Banlist slash hatası:', error);
      interaction.reply({ content: "Bir hata oluştu.", ephemeral: true }).catch(() => {});
    }
  },

  async createBanlistEmbed(client, guild, page = 1) {
    try {
      const reports = client.db.getApprovedReports(guild.id);
      
      if (!reports || reports.length === 0) {
        return null;
      }

      const itemsPerPage = 5;
      const startIndex = (page - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const paginatedReports = reports.slice(startIndex, endIndex);
      
      if (paginatedReports.length === 0) {
        return null;
      }

      const embed = new EmbedBuilder()
        .setTitle(`📋 Onaylanmış Baskın Raporları - Sayfa ${page}`)
        .setColor("#00FF00")
        .setFooter({ 
          text: `Toplam ${reports.length} rapor | Sayfa ${page}/${Math.ceil(reports.length / itemsPerPage)}`,
          iconURL: guild.iconURL()
        })
        .setTimestamp();

      for (const report of paginatedReports) {
        const reportDate = new Date(report.reported_at).toLocaleString('tr-TR');
        const approvedDate = new Date(report.approved_at).toLocaleString('tr-TR');
        
        const { raiders } = client.db.getReportDetails(report.id);
        const raiderCount = raiders.length;
        const raiderPreview = raiders.slice(0, 3).map(r => 
          `• ${r.username || 'Bilinmiyor'} (${r.reason || 'Sebep yok'})`
        ).join('\n');

        const moreText = raiders.length > 3 ? `\n... ve ${raiders.length - 3} kişi daha` : '';

        embed.addFields([
          {
            name: `🆔 Rapor #${report.id}`,
            value: `**Bildiren:** <@${report.reporter_id}>\n**Tarih:** ${reportDate}\n**Onaylandı:** ${approvedDate}\n**Baskıncı Sayısı:** ${raiderCount}\n\n**Baskıncılar:**\n${raiderPreview}${moreText}`,
            inline: false
          }
        ]);
      }

      return embed;

    } catch (error) {
      console.error('Banlist embed oluşturma hatası:', error);
      return null;
    }
  }
};