const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const db = require("../../Database");
const Partner = require("../../Database/models/Partner");

module.exports.commandBase = {
  prefixData: { name: "partner-kanal-ayarla", aliases: ["partner-kanal","pkayarla"] },
  slashData: new SlashCommandBuilder()
    .setName("partner-kanal-ayarla")
    .setDescription("Partner kanalı ekle (birden fazla olabilir).")
    .addChannelOption(opt => opt.setName("kanal").setDescription("Partner kanalı").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  cooldown: 5000,
  ownerOnly: false,
  conf: { description: "Partner kanalı ayarlar.", usage: "!partner-kanal-ayarla #kanal", examples: ["!partner-kanal-ayarla #partner"] },

  async prefixRun(client, message, args) {
    try {
      const guild = message.guild;
      if (!guild) return message.reply("Bu komut sunucuda kullanılmalıdır.");
      const member = message.member || await guild.members.fetch(message.author.id).catch(()=>null);
      if (!member || !member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply("Bu komutu kullanmak için Yönetici yetkisi gerekir.");

      const chan = args[0] ? args[0].replace(/[<#>]/g, "") : message.channel.id;
      await db.init();
      let doc = await Partner.findOne({ guildId: guild.id }).exec();
      if (!doc) doc = new Partner({ guildId: guild.id });
      if (!doc.partnerChannels.includes(chan)) doc.partnerChannels.push(chan);
      await doc.save();
      return message.reply({ content: `Partner kanalı kaydedildi: <#${chan}>` });
    } catch (e) {
      if (client && typeof client.emit === "function") client.emit("commandError", { error: e, command: "partner-kanal-ayarla", type: "prefix", context: { guildId: message.guild?.id, channelId: message.channel.id, userId: message.author.id } });
      return message.reply("Hata oluştu.");
    }
  },

  async slashRun(client, interaction) {
    try {
      if (!interaction.inGuild()) return interaction.reply({ content: "Bu komut sunucuda kullanılmalıdır.", ephemeral: true });
      await interaction.deferReply({ ephemeral: true });

      const member = interaction.member ?? (await interaction.guild.members.fetch(interaction.user.id).catch(()=>null));
      if (!member || !member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.editReply({ content: "Yönetici yetkisi gerekir.", ephemeral: true });

      const channel = interaction.options.getChannel("kanal") || interaction.channel;
      const conn = await db.init();
      if (!conn) return interaction.editReply({ content: "Veritabanı bağlantısı yok — komut geçici olarak devre dışı.", ephemeral: true });

      let doc = await Partner.findOne({ guildId: interaction.guild.id }).exec();
      if (!doc) doc = new Partner({ guildId: interaction.guild.id });
      if (!doc.partnerChannels.includes(channel.id)) doc.partnerChannels.push(channel.id);
      await doc.save();
      return interaction.editReply({ content: `Partner kanalı kaydedildi: ${channel}`, ephemeral: true });
    } catch (e) {
      if (client && typeof client.emit === "function") client.emit("commandError", { error: e, command: "partner-kanal-ayarla", type: "slash", context: { guildId: interaction.guild?.id, channelId: interaction.channelId, userId: interaction.user.id } });
      try { if (interaction.deferred || interaction.replied) await interaction.editReply({ content: "Hata oluştu.", ephemeral: true }); else await interaction.reply({ content: "Hata oluştu.", ephemeral: true }); } catch {}
    }
  },
};
