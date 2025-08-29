const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const ayarlar = require("../Base/ayarlar.js");
const { applyFooter } = require("../Base/embedUtil.js");

module.exports.commandBase = {
  prefixData: {
    name: "gastanit",
    aliases: ["gas-tanıt", "gas-tanit", "gastanıtım", "gastanit"],
  },
  slashData: new SlashCommandBuilder()
    .setName("gastanit")
    .setDescription("GroSS Anime Servers tanıtımını yapar.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  cooldown: 5000,
  ownerOnly: false,
  conf: {
    description: "GroSS Anime Servers tanıtım mesajlarını gönderir.",
    usage: "!gastanit veya /gastanit",
    examples: ["!gastanit", "/gastanit"],
  },

  // Prefix çalıştırma
  async prefixRun(client, message, args) {
    try {
      // Guild toleranslı tespiti
      let guild = message.guild;
      if (!guild && message.guildId) {
        guild = await client.guilds.fetch(message.guildId).catch(() => null);
      }
      if (!guild) return message.reply({ content: "Bu komut sunucuda kullanılmalıdır." });

      // member bilgisi, cache yoksa fetch et
      const member = message.member ?? (await guild.members.fetch(message.author.id).catch(() => null));
      const isOwner = Array.isArray(ayarlar.owners) && ayarlar.owners.includes(message.author.id);
      if (!member && !isOwner) return message.reply({ content: "Üyelik bilgilerinize erişilemiyor; tekrar deneyin veya yetkiliye başvurun." });

      // izin kontrolü: ya sahib ya admin
      const hasPerm = isOwner || (member && member.permissions && member.permissions.has(PermissionFlagsBits.Administrator));
      if (!hasPerm) {
        return message.reply({ content: ":x: **Üzgünüm ama bu komutu sadece bot sahibi veya sunucu yöneticisi kullanabilir!**" });
      }

      // Embed'leri hazırla (kısa, toleranslı)
      const embed1 = new EmbedBuilder()
        .setColor("#800080")
        .setTitle("GroSS Anime Servers")
        .setDescription(
          "Bu topluluk sunucular arasında daha kuvvetli bağlar yapmak için kurulmuş bir topluluktur. Tamamen Anime/Manga temalı sunucuları kapsar. GAS topluluğu, sunucular arası etkileşimi arttırmayı amaçlar."
        );

      const embed2 = new EmbedBuilder()
        .setColor("#800080")
        .setTitle("Sıkça Sorulan Sorular")
        .addFields(
          { name: "Neden bu isim?", value: "Almanca'da 'Groß' büyük/ihtişamlı anlamına gelir.", inline: false },
          { name: "Bot özgün mü?", value: "Kısmen — altyapı örnek üstüne geliştirilmiştir.", inline: false }
        );

      const embed3 = new EmbedBuilder()
        .setColor("#800080")
        .setTitle("Kriterler")
        .setDescription("Sunucu kriterleri: adil yönetim, şeffaf kurallar, üyeler için uygun içerik.")
        .setImage("https://cdn.discordapp.com/attachments/841667665408163921/875123645209534525/GAS-BANNER.png");

      const embed4 = new EmbedBuilder()
        .setColor("#800080")
        .setTitle("Başvuru & Kayıt")
        .setDescription("Başvuru için: https://discord.gg/EWqXEF2Hd9\nİrtibat: <@782215331765813258>");

      // apply footer to all embeds
      [embed1, embed2, embed3, embed4].forEach(e => applyFooter(e, client));

      const embeds = [embed1, embed2, embed3, embed4];

      await message.channel.send({ embeds }).catch(async () => {
        // fallback: DM sahibi (izin yoksa)
        if (ayarlar.owners.includes(message.author.id)) {
          await message.author.send({ embeds }).catch(() => {});
        }
      });
    } catch (e) {
      if (message.client && typeof message.client.emit === "function") {
        message.client.emit("commandError", { error: e, command: "gastanit", type: "prefix", context: { guildId: message.guild?.id, channelId: message.channel.id, userId: message.author.id } });
      }
      message.reply({ content: "Bir hata oluştu. Yetkililere bildirildi." }).catch(() => {});
    }
  },

  // Slash çalıştırma: ephemeral onay yok — public embed atması yaygın istenir fakat isterseniz ephemeral true yapabilirsiniz
  async slashRun(client, interaction) {
    try {
      if (!interaction.inGuild()) return interaction.reply({ content: "Bu komut sunucuda kullanılmalıdır.", ephemeral: true });
      const member = interaction.member ?? (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));
      const isOwner = Array.isArray(ayarlar.owners) && ayarlar.owners.includes(interaction.user.id);
      const hasPerm = isOwner || (member && member.permissions && member.permissions.has(PermissionFlagsBits.Administrator));
      if (!hasPerm) return interaction.reply({ content: ":x: **Yetki yok**", ephemeral: true });

      await interaction.deferReply({ ephemeral: false });

      // build embeds (existing)
      const embeds = [];

      const embed1 = new EmbedBuilder()
        .setColor("#800080")
        .setTitle("GroSS Anime Servers")
        .setDescription("Bu topluluk sunucular arasında daha kuvvetli bağlar yapmak için kurulmuş bir topluluktur. Tamamen Anime/Manga temalı sunucuları kapsar. GAS topluluğu, sunucular arası etkileşimi arttırmayı amaçlar.");

      const embed2 = new EmbedBuilder()
        .setColor("#800080")
        .setTitle("Sıkça Sorulan Sorular")
        .addFields(
          { name: "Neden bu isim?", value: "Almanca'da 'Groß' büyük/ihtişamlı anlamına gelir.", inline: false },
          { name: "Bot özgün mü?", value: "Kısmen — altyapı örnek üstüne geliştirilmiştir.", inline: false }
        );

      const embed3 = new EmbedBuilder()
        .setColor("#800080")
        .setTitle("Kriterler")
        .setDescription("Sunucu kriterleri: adil yönetim, şeffaf kurallar, üyeler için uygun içerik.")
        .setImage("https://cdn.discordapp.com/attachments/841667665408163921/875123645209534525/GAS-BANNER.png");

      const embed4 = new EmbedBuilder()
        .setColor("#800080")
        .setTitle("Başvuru & Kayıt")
        .setDescription("Başvuru için: https://discord.gg/EWqXEF2Hd9\nİrtibat: <@782215331765813258>");

      // applyFooter as before
      [/*embed1,embed2,embed3,embed4*/].forEach(e => applyFooter(e, client));

      // send sequentially as followUp (ensures each is delivered)
      for (const emb of [embed1, embed2, embed3, embed4]) {
        await interaction.followUp({ embeds: [emb] }).catch(()=>{});
      }
    } catch (e) {
      if (client && typeof client.emit === "function") client.emit("commandError", { error: e, command: "gastanit", type: "slash", context: { guildId: interaction.guild?.id, channelId: interaction.channelId, userId: interaction.user.id } });
      interaction.reply({ content: "Bir hata oluştu. Yetkililere bildirildi.", ephemeral: true }).catch(() => {});
    }
  },
};