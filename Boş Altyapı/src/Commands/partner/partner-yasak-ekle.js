const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const db = require("../../Database");
const Partner = require("../../Database/models/Partner");

module.exports.commandBase = {
  prefixData: { name: "partner-yasak-ekle", aliases: ["partner-yasak","pyasak"] },
  slashData: new SlashCommandBuilder()
    .setName("partner-yasak-ekle")
    .setDescription("Bir sunucuyu partner paylaşımında yasaklar (id veya invite).")
    .addStringOption(o => o.setName("sunucu").setDescription("Sunucu id veya invite link").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  cooldown: 5000,
  conf: { description: "Partner yasak yönetimi", usage: "!partner-yasak-ekle <id|invite>", examples: ["!partner-yasak-ekle 123456789012345678"] },

  async prefixRun(client, message, args) {
    try {
      const guild = message.guild;
      if (!guild) return message.reply("Bu komut sunucuda kullanılmalıdır.");
      const member = message.member || await guild.members.fetch(message.author.id).catch(()=>null);
      if (!member || !member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply("Yönetici yetkisi gerekir.");
      const input = args.join(" ").trim();
      if (!input) return message.reply("Lütfen sunucu id veya invite girin.");

      await db.init();
      let doc = await Partner.findOne({ guildId: guild.id }).exec();
      if (!doc) doc = new Partner({ guildId: guild.id });
      if (!doc.bannedGuilds.includes(input)) doc.bannedGuilds.push(input);
      await doc.save();
      return message.reply(`Yasaklı eklendi: ${input}`);
    } catch (e) {
      if (client && typeof client.emit === "function") client.emit("commandError", { error: e, command: "partner-yasak-ekle", type: "prefix", context: { guildId: message.guild?.id, channelId: message.channel.id, userId: message.author.id } });
      return message.reply("Hata oluştu.");
    }
  },

  async slashRun(client, interaction) {
    try {
      if (!interaction.inGuild()) return interaction.reply({ content: "Bu komut sunucuda kullanılmalıdır.", ephemeral: true });
      await interaction.deferReply({ ephemeral: true });

      const member = interaction.member ?? (await interaction.guild.members.fetch(interaction.user.id).catch(()=>null));
      if (!member || !member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.editReply({ content: "Yönetici yetkisi gerekir.", ephemeral: true });

      const input = interaction.options.getString("sunucu");
      const conn = await db.init();
      if (!conn) return interaction.editReply({ content: "Veritabanı bağlantısı yok — komut geçici olarak devre dışı.", ephemeral: true });

      let doc = await Partner.findOne({ guildId: interaction.guild.id }).exec();
      if (!doc) doc = new Partner({ guildId: interaction.guild.id });
      if (!doc.bannedGuilds.includes(input)) doc.bannedGuilds.push(input);
      await doc.save();
      return interaction.editReply({ content: `Yasaklı eklendi: ${input}`, ephemeral: true });
    } catch (e) {
      if (client && typeof client.emit === "function") client.emit("commandError", { error: e, command: "partner-yasak-ekle", type: "slash", context: { guildId: interaction.guild?.id, channelId: interaction.channelId, userId: interaction.user.id } });
      try { if (interaction.deferred || interaction.replied) await interaction.editReply({ content: "Hata oluştu.", ephemeral: true }); else await interaction.reply({ content: "Hata oluştu.", ephemeral: true }); } catch {}
    }
  },
};
