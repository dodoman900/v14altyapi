const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const db = require("../../Database");
const Partner = require("../../Database/models/Partner");

module.exports.commandBase = {
  prefixData: { name: "partner-sayac", aliases: ["partner-sayaç","psayac"] },
  slashData: new SlashCommandBuilder()
    .setName("partner-sayac")
    .setDescription("Partner sayaç ayarla / göster")
    .addSubcommandGroup(group => group
      .setName("ayarlar")
      .setDescription("Sayaç ayarları")
      .addSubcommand(sub => sub
        .setName("ayarla")
        .setDescription("Sayaç kanalını ayarla")
        .addChannelOption(opt => opt
          .setName("kanal")
          .setDescription("Sayaç kanalı")
          .setRequired(true)))
      .addSubcommand(sub => sub
        .setName("goster")
        .setDescription("İstatistikleri göster")
        .addUserOption(opt => opt
          .setName("kullanici")
          .setDescription("İstatistikleri gösterilecek kullanıcı")
          .setRequired(false)))),
  cooldown: 5000,
  ownerOnly: false,
  conf: { description: "Partner sayaç yönetimi", usage: "!partner-sayac ayarla/goster", examples: ["!partner-sayac ayarla #kanal", "!partner-sayac goster @kullanici"] },

  async prefixRun(client, message, args) {
    try {
      const guild = message.guild;
      if (!guild) return message.reply("Bu komut sunucuda kullanılmalıdır.");
      const member = message.member || await guild.members.fetch(message.author.id).catch(()=>null);
      if (!member || !member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply("Yönetici yetkisi gerekir.");

      const sub = args[0]?.toLowerCase();
      await db.init();
      let doc = await Partner.findOne({ guildId: guild.id }).exec();
      if (!doc) doc = new Partner({ guildId: guild.id });

      if (sub === "ayarla") {
        const chan = args[1] ? args[1].replace(/[<#>]/g,"") : message.channel.id;
        doc.counterChannel = chan;
        await doc.save();
        return message.reply(`Sayaç kanalı ayarlandı: <#${chan}>`);
      } else {
        // goster
        const target = message.mentions.users.first() || message.author;
        const now = Date.now();
        const day = now - 24*60*60*1000;
        const week = now - 7*24*60*60*1000;
        const month = now - 30*24*60*60*1000;
        const shares = doc.shares || [];
        const userShares = shares.filter(s => s.userId === target.id);
        const daily = userShares.filter(s => new Date(s.timestamp).getTime() > day).length;
        const weekly = userShares.filter(s => new Date(s.timestamp).getTime() > week).length;
        const monthly = userShares.filter(s => new Date(s.timestamp).getTime() > month).length;
        const total = userShares.length;
        const embed = new EmbedBuilder()
          .setTitle(`Partner istatistik: ${target.tag}`)
          .addFields(
            { name: "Günlük", value: String(daily), inline: true },
            { name: "Haftalık", value: String(weekly), inline: true },
            { name: "Aylık", value: String(monthly), inline: true },
            { name: "Toplam", value: String(total), inline: true },
          );
        return message.reply({ embeds: [embed] });
      }
    } catch (e) {
      if (client && typeof client.emit === "function") client.emit("commandError", { error: e, command: "partner-sayac", type: "prefix", context: { guildId: message.guild?.id, channelId: message.channel.id, userId: message.author.id } });
      return message.reply("Hata oluştu.");
    }
  },

  async slashRun(client, interaction) {
    try {
      if (!interaction.inGuild()) return interaction.reply({ content: "Bu komut sunucuda kullanılmalıdır.", ephemeral: true });
      await interaction.deferReply({ ephemeral: true });

      const member = interaction.member ?? (await interaction.guild.members.fetch(interaction.user.id).catch(()=>null));
      if (!member || !member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.editReply({ content: "Yönetici yetkisi gerekir.", ephemeral: true });

      const sub = interaction.options.getSubcommand();
      const conn = await db.init();
      if (!conn) return interaction.editReply({ content: "Veritabanı bağlantısı yok — komut geçici olarak devre dışı.", ephemeral: true });

      let doc = await Partner.findOne({ guildId: interaction.guild.id }).exec();
      if (!doc) doc = new Partner({ guildId: interaction.guild.id });

      if (sub === "ayarla") {
        const channel = interaction.options.getChannel("kanal");
        doc.counterChannel = channel.id;
        await doc.save();
        return interaction.editReply({ content: `Sayaç kanalı ayarlandı: ${channel}`, ephemeral: true });
      } else {
        const target = interaction.options.getUser("kullanici") || interaction.user;
        const now = Date.now();
        const day = now - 24*60*60*1000;
        const week = now - 7*24*60*60*1000;
        const month = now - 30*24*60*60*1000;
        const shares = doc.shares || [];
        const userShares = shares.filter(s => s.userId === target.id);
        const daily = userShares.filter(s => new Date(s.timestamp).getTime() > day).length;
        const weekly = userShares.filter(s => new Date(s.timestamp).getTime() > week).length;
        const monthly = userShares.filter(s => new Date(s.timestamp).getTime() > month).length;
        const total = userShares.length;
        const embed = new EmbedBuilder()
          .setTitle(`Partner istatistik: ${target.tag}`)
          .addFields(
            { name: "Günlük", value: String(daily), inline: true },
            { name: "Haftalık", value: String(weekly), inline: true },
            { name: "Aylık", value: String(monthly), inline: true },
            { name: "Toplam", value: String(total), inline: true },
          );
        return interaction.editReply({ embeds: [embed], ephemeral: true });
      }
    } catch (e) {
      if (client && typeof client.emit === "function") client.emit("commandError", { error: e, command: "partner-sayac", type: "slash", context: { guildId: interaction.guild?.id, channelId: interaction.channelId, userId: interaction.user.id } });
      try { if (interaction.deferred || interaction.replied) await interaction.editReply({ content: "Hata oluştu.", ephemeral: true }); else await interaction.reply({ content: "Hata oluştu.", ephemeral: true }); } catch {}
    }
  },
};
