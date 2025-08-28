// Güvenlik/ tür işareti: Bu dosya 'security' rapor komutu içerir (sensitive).
// @security: { type: "report", level: "sensitive" }

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, AuditLogEvent, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require("discord.js");
const ayarlar = require("../../Base/ayarlar.js");

module.exports.commandBase = {
  prefixData: {
    name: "baskin-bildir",
    aliases: ["baskin"],
  },
  // Slash artık sadece onay ile başlıyor; ID'leri modal ile alacağız
  slashData: new SlashCommandBuilder()
    .setName("baskin-bildir")
    .setDescription("Sunucuya baskın bildirin (önce onay, sonra ID gireceksiniz)."),
  cooldown: 10000,
  ownerOnly: false,
  conf: {
    description: "Sunucuda baskın olduğunu düşünüyorsanız yetkililere bildirir.",
    usage: "/baskin-bildir (onaylanınca ikinci ekranda ID girin) veya !baskin-bildir <id id ...>",
    examples: ["/baskin-bildir", "!baskin-bildir 123 456"]
  },

  // Prefix versiyonu: önce reaksiyon ile onay, sonra ID'leri boşluk ile girme şeklinde
  async prefixRun(client, message, args) {
    try {
      if (!message.guild) return message.reply({ content: "Bu komut sunucuda kullanılmalıdır." });

      if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
        return message.reply({ content: "Bu komutu kullanmak için ban yetkisine ihtiyacın var." });
      }

      // Kullanıcıya onay sor
      const confirmMsg = await message.reply({
        content:
          "Baskına bildirmek istiyor musun? (✅ Evet / ❌ Hayır)\nIDs: Lütfen ID'leri boşluk ile ayırarak bir sonraki mesajda gönder (örnek: 123456789012345678 987654321098765432).",
      });

      await confirmMsg.react("✅").catch(() => {});
      await confirmMsg.react("❌").catch(() => {});

      const filter = (reaction, user) => ["✅", "❌"].includes(reaction.emoji.name) && user.id === message.author.id;
      let collected;
      try {
        collected = await confirmMsg.awaitReactions({ filter, max: 1, time: 30000, errors: ["time"] });
      } catch {
        return message.reply({ content: "Zaman aşımı — işlem iptal edildi." });
      }

      const reaction = collected.first();
      if (!reaction || reaction.emoji.name === "❌") {
        return message.reply({ content: "Baskın bildirimi iptal edildi." });
      }

      // ID mesajını bekle
      await message.reply({ content: "Lütfen ID'leri boşluk ile ayırarak gönderin. (örn: 123 456)" });
      const idFilter = (m) => m.author.id === message.author.id;
      let idCollected;
      try {
        idCollected = await message.channel.awaitMessages({ filter: idFilter, max: 1, time: 60000, errors: ["time"] });
      } catch {
        return message.reply({ content: "Zaman aşımı — işlem iptal edildi." });
      }

      const idsRaw = idCollected.first().content.trim();
      // Split on any whitespace
      const ids = idsRaw.split(/\s+/).map(i => i.trim()).filter(Boolean);
      if (ids.length === 0) return message.reply({ content: "Geçerli ID bulunamadı. İşlem iptal edildi." });

      await message.reply({ content: "Bildiriliyor, lütfen bekleyin..." }).catch(() => {});

      // Devam: geniş bilgi topla ve embed hazırla
      await handleReport(client, message.guild, message.author, ids, "prefix", message);
    } catch (e) {
      if (client && typeof client.emit === "function") client.emit("commandError", { error: e, command: "baskin-bildir", type: "prefix", context: { guildId: message.guild?.id, channelId: message.channel.id, userId: message.author.id } });
      message.reply({ content: "Bir hata oluştu, yetkililere bildirildi." }).catch(() => {});
    }
  },

  // Slash versiyonu: ilk etapta ephemeral onay butonları göster
  async slashRun(client, interaction) {
    try {
      if (!interaction.guild) return interaction.reply({ content: "Bu komut sunucuda kullanılmalıdır.", ephemeral: true });

      if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
        return interaction.reply({ content: "Bu komutu kullanmak için ban yetkisine ihtiyacın var.", ephemeral: true });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("baskin_confirm").setLabel("✅ Evet").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("baskin_cancel").setLabel("❌ Hayır").setStyle(ButtonStyle.Danger),
      );

      await interaction.reply({
        content: "Baskına bildirmek istiyor musunuz? (✅ Evet / ❌ Hayır)\nOnaylarsanız ikinci ekranda ID'leri boşluk ile girmeniz istenecektir (örn: 123456789012345678 987654321098765432).",
        components: [row],
        ephemeral: true,
      });
    } catch (e) {
      if (client && typeof client.emit === "function") client.emit("commandError", { error: e, command: "baskin-bildir", type: "slash", context: { guildId: interaction.guild?.id, channelId: interaction.channelId, userId: interaction.user.id } });
      interaction.followUp({ content: "Bir hata oluştu, yetkililere bildirildi.", ephemeral: true }).catch(() => {});
    }
  },
};

// Ortak rapor fonksiyonu (ayırt edilmiş kod blokları)
//  - getMemberDetails: sunucuda olup olmadığını ve üye bilgilerini getirir
//  - getRecentBanInfo: audit-log bazlı son 6 saat ban bilgilerini çözer
//  - handleReport: raporu hazırlar, sayfalara böler ve seçici ile gönderir

async function getMemberDetails(guild, client, id) {
  // Bu blok sadece üye ile ilgili bilgileri toplar (sunucuda mı, roller, joinedAt, presence)
  const info = { isMember: false, memberJoinedAt: null, roles: [], presence: null };
  try {
    const member = await guild.members.fetch(id).catch(() => null);
    if (member) {
      info.isMember = true;
      info.memberJoinedAt = member.joinedAt ? member.joinedAt.toISOString() : null;
      info.roles = member.roles.cache.filter(r => r.id !== guild.id).map(r => r.name).slice(0, 10);
      info.presence = member.presence ? member.presence.status : null;
    }
  } catch {
    info.isMember = false;
  }
  return info;
}

async function getRecentBanInfoMap(guild, sixHoursAgo) {
  // Bu blok audit log'dan son 6 saat içindeki ban hareketlerini çözer
  const map = new Map(); // id -> { entry, executorTag, createdTimestamp }
  try {
    const audit = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 200 }).catch(() => null);
    if (audit && audit.entries) {
      for (const entry of audit.entries.values()) {
        const targetId = entry.targetId ?? entry.target?.id ?? null;
        if (!targetId) continue;
        if (entry.createdTimestamp > sixHoursAgo) {
          const prev = map.get(targetId) || [];
          prev.push(entry);
          map.set(targetId, prev);
        }
      }
    }
  } catch {
    // ignore
  }
  return map;
}

async function handleReport(client, guild, reporterUser, ids, mode = "slash", responder = null) {
  try {
    const now = Date.now();
    const sixHoursAgo = now - 6 * 60 * 60 * 1000;

    // 6 saat içindeki ban hareketlerini map'le
    const recentBanMap = await getRecentBanInfoMap(guild, sixHoursAgo);

    // Her id için genel bilgi topla (user, member, ban, recentBan)
    const details = [];
    for (const id of ids.slice(0, 200)) { // üst limit yüksek tuttum, ama UI sayfalama ile kontrol edilir
      const info = { id, userTag: null, isMember: false, memberJoinedAt: null, roles: [], banned: false, banReason: null, recentBanEntries: [] };

      // user global
      try {
        const u = await client.users.fetch(id).catch(() => null);
        if (u) info.userTag = u.tag;
      } catch {}

      // member details (sunucuda olup olmadığı)
      const memberDetails = await getMemberDetails(guild, client, id);
      info.isMember = memberDetails.isMember;
      info.memberJoinedAt = memberDetails.memberJoinedAt;
      info.roles = memberDetails.roles;
      info.presence = memberDetails.presence;

      // ban info (guild.bans.fetch)
      try {
        const ban = await guild.bans.fetch(id).catch(() => null);
        if (ban && ban.user) {
          info.banned = true;
          info.banReason = ban.reason ?? null;
        }
      } catch {}

      // recent ban entries from audit-log
      const entries = recentBanMap.get(id) || [];
      info.recentBanEntries = entries.map(e => ({
        createdTimestamp: e.createdTimestamp,
        executorTag: e.executor?.tag ?? null,
        reason: e.reason ?? null,
      }));

      details.push(info);
    }

    // Sayfalara bölme (örnek: her sayfa 8 kullanıcı)
    const pageSize = 8;
    const pages = [];
    for (let i = 0; i < details.length; i += pageSize) {
      const chunk = details.slice(i, i + pageSize);
      const lines = chunk.map(d => {
        const tag = d.userTag ?? `Bilinmeyen (${d.id})`;
        const member = d.isMember ? `Üye (katılma: ${d.memberJoinedAt ? d.memberJoinedAt.split("T")[0] : "?"})` : "Sunucuda değil";
        const banned = d.banned ? `Banlı${d.banReason ? ` (sebep: ${truncate(d.banReason, 120)})` : ""}` : "Banlı değil";
        const recentBanNote = d.recentBanEntries.length ? `Son 6s ban: ${d.recentBanEntries.map(r => `${r.executorTag ?? "?"} @ ${new Date(r.createdTimestamp).toLocaleString()}`).join("; ")}` : "Son 6s ban yok";
        const roles = d.roles && d.roles.length ? `Roller: ${d.roles.join(", ")}` : "Rol yok / erişim yok";
        return `• ${d.id} — ${tag}\n   • ${member}\n   • ${banned}\n   • ${recentBanNote}\n   • ${roles}`;
      });
      const embed = new EmbedBuilder()
        .setTitle(`Baskın raporu — sayfa ${Math.floor(i / pageSize) + 1}`)
        .setColor("#FF0000")
        .addFields(
          { name: "Sunucu", value: `${guild.name} (${guild.id})`, inline: true },
          { name: "Bildiren", value: `${reporterUser.tag} (${reporterUser.id})`, inline: true },
          { name: "Zaman", value: new Date().toLocaleString(), inline: true },
          { name: `Kullanıcılar (${i + 1}-${Math.min(i + pageSize, details.length)})`, value: lines.join("\n\n"), inline: false }
        )
        .setTimestamp();
      pages.push(embed);
    }

    // Gönderim: önce ayarlardaki log kanalına dene; eğer kanala embedler çoksa ilk sayfayı gönder ve select menu ile sayfa seçme ekle
    const logChannelId = ayarlar.logChannelId || null;
    let sent = false;

    // utility: kayıt sayfası haritası kaydet (client üzerinde)
    if (!client._baskinPages) client._baskinPages = new Map();
    const selectorKey = `baskin_page_${reporterUser.id}_${Date.now()}`;

    if (pages.length === 0) {
      // hiçbir detay yoksa basit embed gönder
      const emptyEmbed = new EmbedBuilder().setTitle("Baskın Bildirimi").setDescription("Detay bulunamadı").setColor("#FFAA00");
      // try send to guild log channel then fallback...
    }

    // seçim bileşeni yalnızca sayfa > 1 ise eklenir
    let components = [];
    if (pages.length > 1) {
      const options = pages.map((p, idx) => ({
        label: `Sayfa ${idx + 1}`,
        description: `Kullanıcılar ${idx * pageSize + 1} - ${Math.min((idx + 1) * pageSize, details.length)}`,
        value: String(idx),
      })).slice(0, 25); // select max 25
      const select = new StringSelectMenuBuilder()
        .setCustomId(selectorKey)
        .setPlaceholder("Sayfa seçin")
        .addOptions(options);
      components = [new ActionRowBuilder().addComponents(select)];
      // kaydet
      client._baskinPages.set(selectorKey, pages);
      // temizleme zaman aşımı (10 dakika)
      setTimeout(() => client._baskinPages.delete(selectorKey), 10 * 60 * 1000);
    }

    // Gönderme fonksiyonu yardımcı
    async function trySendToChannelFetch(channelId) {
      if (!channelId) return false;
      try {
        const ch = await guild.channels.fetch(channelId).catch(() => null);
        if (ch && ch.isTextBased() && ch.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages)) {
          await ch.send({ embeds: [pages[0] || new EmbedBuilder().setDescription("Detay yok")], components }).catch(() => {});
          return true;
        }
      } catch {}
      return false;
    }

    if (logChannelId) {
      sent = await trySendToChannelFetch(logChannelId);
    }

    if (!sent) {
      // fallback: guild'te yazılabilir ilk kanal
      try {
        const fallback = guild.channels.cache.find(c => c.isTextBased() && c.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages));
        if (fallback) {
          await fallback.send({ embeds: [pages[0] || new EmbedBuilder().setDescription("Detay yok")], components }).catch(() => {});
          sent = true;
        }
      } catch {}
    }

    // Son çare: sahiplere DM gönder
    if (!sent && Array.isArray(ayarlar.owners) && ayarlar.owners.length) {
      for (const ownerId of ayarlar.owners) {
        try {
          const ownerUser = await client.users.fetch(ownerId).catch(() => null);
          if (ownerUser) {
            // göndereceğimiz mesajlarda sayfa seçici olmayacağından tüm sayfaları DM ile parçala
            for (const p of pages) {
              await ownerUser.send({ embeds: [p] }).catch(() => {});
            }
          }
        } catch {}
      }
    }

    // responder'a geri bildirim (slash ise followUp)
    if (mode === "slash" && responder && typeof responder.followUp === "function") {
      await responder.followUp({ content: "Baskın bildiriminiz alındı ve bildirildi (varsa log kanalına).", ephemeral: true }).catch(() => {});
    }
  } catch (e) {
    throw e;
  }
}

// export helper so interaction handler can call (already done earlier in flow)
module.exports.handleReport = handleReport;

// yardımcılar
function truncate(str, n) {
  if (!str) return str;
  return str.length > n ? str.slice(0, n - 3) + "..." : str;
}
function chunkString(str, size) {
  const chunks = [];
  for (let i = 0; i < str.length; i += size) chunks.push(str.slice(i, i + size));
  return chunks;
}

// Export security metadata
module.exports.security = { type: "security", category: "report", level: "sensitive" };