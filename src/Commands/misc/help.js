const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");

module.exports.commandBase = {
  prefixData: { name: "yardim", aliases: ["help","komutlar"] },
  slashData: new SlashCommandBuilder().setName("yardim").setDescription("Komut listesi (sayfalı)."),
  cooldown: 3000,
  ownerOnly: false,
  conf: { description: "Komut yardım sayfası", usage: "!yardim", examples: ["!yardim"] },

  async prefixRun(client, message) {
    return runHelp(client, message.channel, message.author.id, false);
  },

  async slashRun(client, interaction) {
    await runHelp(client, interaction.channel, interaction.user.id, true, interaction);
  },
};

async function runHelp(client, channel, userId, ephemeral=false, interaction=null) {
  const cmds = Array.from(client.commands.values()).filter(c => c.conf && c.conf.description);
  const categories = {};
  for (const c of cmds) {
    const cat = c.conf?.kategori || "Genel";
    categories[cat] = categories[cat] || [];
    categories[cat].push(c);
  }

  const pages = Object.entries(categories).map(([cat, list]) => {
    const embed = new EmbedBuilder().setTitle(`Komutlar — ${cat}`).setColor("#00AAFF");
    const desc = list.map(c => `**${c.prefixData?.name || c.slashData?.name}** — ${c.conf?.description || ""}`).join("\n");
    embed.setDescription(desc || "Yok");
    return embed;
  });

  const selectOptions = pages.map((p, i) => ({ label: `Sayfa ${i+1}`, description: p.title?.slice(0,50) || `Sayfa ${i+1}`, value: String(i) })).slice(0,25);
  const customId = `help_select_${channel.id}_${Date.now()}`;
  const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder("Sayfa seçin").addOptions(selectOptions));
  // try send to channel, if fails DM user
  try {
    const sent = await channel.send({ embeds: [pages[0]], components: selectOptions.length ? [row] : [] });
    if (!client._helpPages) client._helpPages = new Map();
    client._helpPages.set(customId, pages);
    setTimeout(() => client._helpPages.delete(customId), 10*60*1000);
  } catch (e) {
    // fallback to DM
    try {
      const user = await client.users.fetch(userId).catch(()=>null);
      if (user) {
        await user.send({ embeds: [pages[0]] }).catch(()=>{});
        if (interaction && ephemeral) await interaction.reply({ content: "Yardım DM olarak gönderildi.", ephemeral: true }).catch(()=>{});
      } else {
        if (interaction && ephemeral) await interaction.reply({ content: "Yardım gönderilemedi (DM açılamıyor).", ephemeral: true }).catch(()=>{});
      }
    } catch {}
  }
}
