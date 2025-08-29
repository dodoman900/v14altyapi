const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const path = require("node:path");
const ayarlar = require(path.join(__dirname, "..", "Base", "ayarlar.js"));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gaskanallari')
    .setDescription('Great Anime Servers kanallarını kurar.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction) {
    try {
      if (!interaction.inGuild()) return interaction.reply({ content: "Bu komut sunucuda kullanılmalıdır.", ephemeral: true });
      // owner OR admin check
      const isOwner = Array.isArray(ayarlar.owners) && ayarlar.owners.includes(interaction.user.id);
      const member = interaction.member ?? (await interaction.guild.members.fetch(interaction.user.id).catch(()=>null));
      if (!isOwner && (!member || !member.permissions.has(PermissionFlagsBits.Administrator))) {
        return interaction.reply({ content: ':x: **Üzgünüm ama bu komutu sadece bot sahibi veya sunucu yöneticisi kullanabilir!**', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor('#000000')
        .setTitle('Komut Girişi')
        .setDescription('Gerekli dosyalar kurulsun mu?')
        .setFooter({ text: 'Bu eylemi onaylamak için "Evet" butonuna tıkla. 30 saniye içinde işlem iptal edilecek.' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('confirm_setup')
          .setLabel('Evet')
          .setStyle(ButtonStyle.Success)
      );

      await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });

      const filter = i => i.customId === 'confirm_setup' && i.user.id === interaction.user.id;
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000 });

      collector.on('collect', async i => {
        await i.deferUpdate();

        // Create category and text channels using ChannelType enums
        const category = await interaction.guild.channels.create({
          name: 'GroSS Anime Servers',
          type: ChannelType.GuildCategory
        }).catch(() => null);

        if (!category) {
          await i.editReply({ content: 'Kategori oluşturulamadı. İzinleri kontrol edin.', embeds: [], components: [] }).catch(() => {});
          collector.stop();
          return;
        }

        await Promise.all([
          interaction.guild.channels.create({ name: 'gas-tanıtım', type: ChannelType.GuildText, parent: category.id }).catch(() => null),
          interaction.guild.channels.create({ name: 'gas-sunucuları', type: ChannelType.GuildText, parent: category.id }).catch(() => null),
          interaction.guild.channels.create({ name: 'gas-etkinlikleri', type: ChannelType.GuildText, parent: category.id }).catch(() => null)
        ]);

        await i.editReply({
          content: 'Gerekli kanallar kuruluyor. Rolleri ve süsleri ayarlamak sana düşer :3',
          embeds: [],
          components: []
        });

        collector.stop();
      });

      collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
          await interaction.editReply({
            content: '⏰ Zaman aşımı! Komut iptal edildi.',
            embeds: [],
            components: []
          });
        }
      });
    } catch (e) {
      console.error(e);
      try { await interaction.reply({ content: "Hata oluştu.", ephemeral: true }); } catch {}
    }
  },

  conf: {
    enabled: true,
    guildOnly: true,
    aliases: ['gas-kanallarını-kur', 'gas-kanal', 'kanal'],
    permLevel: 3,
    kategori: 'mod'
  },

  help: {
    name: 'gaskanallari',
    description: 'Great Anime Servers kanallarını kurar.',
    usage: '/gaskanallari'
  }
};