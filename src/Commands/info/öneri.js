const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const ayarlar = require("../../Base/ayarlar.js");

module.exports.commandBase = {
  prefixData: {
    name: "öneri",
    aliases: ["oneri", "oner", "öner"],
  },
  slashData: new SlashCommandBuilder()
    .setName("öneri")
    .setDescription("Önerinizi bildirirsiniz.")
    .addStringOption((o) =>
      o.setName("metin").setDescription("Öneriniz").setRequired(true),
    ),
  cooldown: 5000,
  ownerOnly: false,
  conf: {
    description: "Kullanıcıdan öneri alır ve bot sahibine bildirir.",
    usage: "!öneri <metin> veya /öneri metin:<metin>",
    examples: ["!öneri Bot'a yeni özellik ekle", "/öneri metin:Bot'a yeni özellik ekle"]
  },
  async prefixRun(client, message, args) {
    try {
      const text = args.join(" ").trim();
      if (!text) return message.reply({ content: "Lütfen önerinizi girin." });

      const embed = new EmbedBuilder()
        .setTitle("Yeni Öneri")
        .setDescription(text)
        .addFields({
          name: "Gönderen",
          value: `${message.author.tag} (${message.author.id})`,
        })
        .setTimestamp();

      await message.reply({ content: "Öneriniz alındı, teşekkürler!" });

      const ownerId = Array.isArray(ayarlar.owners) ? ayarlar.owners[0] : null;
      if (ownerId) {
        const owner = await client.users.fetch(ownerId).catch(() => null);
        if (owner) await owner.send({ embeds: [embed] }).catch(() => {});
      }
    } catch (e) {
      console.error("Öneri (prefix) hatası:", e);
      message.reply({ content: "Bir hata oluştu. Daha sonra tekrar deneyin." }).catch(() => {});
    }
  },
  async slashRun(client, interaction) {
    try {
      const text = interaction.options.getString("metin");
      const embed = new EmbedBuilder()
        .setTitle("Yeni Öneri")
        .setDescription(text)
        .addFields({
          name: "Gönderen",
          value: `${interaction.user.tag} (${interaction.user.id})`,
        })
        .setTimestamp();

      await interaction.reply({ content: "Öneriniz alındı, teşekkürler!", ephemeral: true });

      const ownerId = Array.isArray(ayarlar.owners) ? ayarlar.owners[0] : null;
      if (ownerId) {
        const owner = await client.users.fetch(ownerId).catch(() => null);
        if (owner) await owner.send({ embeds: [embed] }).catch(() => {});
      }
    } catch (e) {
      console.error("Öneri (slash) hatası:", e);
      interaction.reply({ content: "Bir hata oluştu. Daha sonra tekrar deneyin.", ephemeral: true }).catch(() => {});
    }
  },
};