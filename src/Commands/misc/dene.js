const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const ayarlar = require("../../Base/ayarlar.js");

module.exports.commandBase = {
  prefixData: { name: "dene", aliases: ["testall"] },
  slashData: new SlashCommandBuilder().setName("dene").setDescription("Tüm komutları güvenli şekilde test eder (owner/admin)."),
  cooldown: 0,
  ownerOnly: false,
  conf: { description: "Tüm komutları test eder ve hataları HATA_KANALI'na gönderir." },

  async prefixRun(client, message, args) {
    if (!message.guild) return message.reply("Bu komut sunucuda kullanılmalıdır.");
    const isOwner = Array.isArray(ayarlar.owners) && ayarlar.owners.includes(message.author.id);
    const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(()=>null));
    if (!isOwner && (!member || !member.permissions.has(PermissionFlagsBits.Administrator))) return message.reply("Yönetici veya bot sahibi olmalısınız.");
    await runTests(client, message.channel, message.author.id, { key: `g:${message.guild.id}:u:${message.author.id}` });
  },

  async slashRun(client, interaction) {
    if (!interaction.inGuild()) return interaction.reply({ content: "Bu komut sunucuda kullanılmalıdır.", ephemeral: true });
    const isOwner = Array.isArray(ayarlar.owners) && ayarlar.owners.includes(interaction.user.id);
    const member = interaction.member ?? (await interaction.guild.members.fetch(interaction.user.id).catch(()=>null));
    if (!isOwner && (!member || !member.permissions.has(PermissionFlagsBits.Administrator))) return interaction.reply({ content: "Yönetici veya bot sahibi olmalısınız.", ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    await runTests(client, interaction.channel, interaction.user.id, { interaction, key: `g:${interaction.guild.id}:u:${interaction.user.id}` });
    try { await interaction.editReply({ content: "Test tamamlandı. Sonuçlar HATA_KANALI'na gönderildi.", ephemeral: true }); } catch {}
  },
};

async function runTests(client, channel, userId, opts = {}) {
  if (!client._runningTests) client._runningTests = new Set();
  const lockKey = opts.key || `global:${userId}`;
  if (client._runningTests.has(lockKey)) {
    if (opts.interaction) {
      try { await opts.interaction.followUp({ content: "Zaten çalışan bir test süreciniz var. Lütfen bitmesini bekleyin.", ephemeral: true }); } catch {}
    } else {
      try { await channel.send("Zaten çalışan bir test süreciniz var. Lütfen bitmesini bekleyin."); } catch {}
    }
    return;
  }

  client._runningTests.add(lockKey);
  const results = [];
  try {
    for (const [name, cmd] of client.commands.entries()) {
      if (name === "dene" || name === "testall") { results.push({ name, ok: true, skipped: true }); continue; }

      try {
        if (typeof cmd.prefixRun === "function") {
          try { await cmd.prefixRun(client, { guild: channel.guild, author: { id: userId, tag: "tester" }, channel, reply: async ()=>{} }, []); } catch {}
        }

        if (typeof cmd.slashRun === "function") {
          const dmStub = {
            send: async (content) => ({ content }),
            createMessageCollector: (opts) => ({ on: ()=>{}, stop: ()=>{} })
          };
          const mockUser = {
            id: userId,
            createDM: async () => dmStub,
            send: async (content) => ({ content })
          };
          const mock = {
            guild: channel.guild,
            inGuild: () => !!channel.guild,
            user: mockUser,
            channel,
            client,
            deferred: false,
            replied: false,
            reply: async (opts) => { mock.replied = true; return; },
            deferReply: async () => { mock.deferred = true; return; },
            editReply: async (opts) => { mock.replied = true; return; },
            followUp: async (opts) => {},
            options: { getString: ()=>"", getSubcommand: ()=>null, getUser: ()=>null, getChannel: ()=>null }
          };
          try {
            await cmd.slashRun(client, mock);
          } catch (e) {
            // capture full stack
            throw e;
          }
        }

        results.push({ name, ok: true });
      } catch (e) {
        results.push({ name, ok: false, error: e.message || String(e), stack: e.stack || null });
      }
    }

    // prepare report
    const ayarlarMod = require("../../Base/ayarlar.js");
    const targetChannelId = ayarlarMod.hataChannelId || ayarlarMod.logChannelId || null;
    const report = results.map(r => {
      if (r.skipped) return `⏭ ${r.name} (skipped)`;
      if (r.ok) return `✅ ${r.name}`;
      return `❌ ${r.name} — ${r.error}\n${r.stack ? "```"+r.stack.slice(0,1500)+"```" : ""}`;
    }).join("\n\n");

    // try post inside same guild's channelId if configured
    let posted = false;
    if (targetChannelId && channel.guild) {
      try {
        const ch = await channel.guild.channels.fetch(targetChannelId).catch(()=>null);
        if (ch && ch.isTextBased && ch.permissionsFor(channel.guild.members.me).has("SendMessages")) {
          await ch.send({ content: `Dene sonuçları:\n${report}` }).catch(()=>{});
          posted = true;
        }
      } catch {}
    }

    // fallback to owners DM
    if (!posted) {
      for (const ownerId of (ayarlarMod.owners || [])) {
        try {
          const user = await client.users.fetch(ownerId).catch(()=>null);
          if (user) await user.send({ content: `Dene sonuçları:\n${report}` }).catch(()=>{});
        } catch {}
      }
    }
  } finally {
    client._runningTests.delete(lockKey);
  }
}
