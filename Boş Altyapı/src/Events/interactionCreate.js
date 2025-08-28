const { Collection, Events, InteractionType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require("discord.js");
const ayarlar = require("../Base/ayarlar.js");
const cooldown = new Collection();

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    const { client } = interaction;

    // Buton tıklamalarını işle
    if (interaction.isButton()) {
      try {
        if (interaction.customId === "baskin_confirm") {
          // Kullanıcı onayladı -> modal göster
          const modal = new ModalBuilder()
            .setCustomId("baskin_ids_modal")
            .setTitle("Baskın ID'leri");

          const idsInput = new TextInputBuilder()
            .setCustomId("ids_input")
            .setLabel("Baskıncı ID'leri (boşluk ile ayırın)")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Örnek: 123456789012345678 987654321098765432")
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(idsInput));

          await interaction.showModal(modal);
        } else if (interaction.customId === "baskin_cancel") {
          // İptal
          await interaction
            .update({
              content: "Baskın bildirimi iptal edildi.",
              components: [],
              ephemeral: true,
            })
            .catch(() => {});
        }
      } catch (e) {
        console.error("Button handling error:", e);
        // emit error
        if (client && typeof client.emit === "function")
          client.emit("commandError", {
            error: e,
            command: "baskin-bildir-button",
            type: "button",
            context: {
              guildId: interaction.guild?.id,
              channelId: interaction.channelId,
              userId: interaction.user.id,
            },
          });
      }
      return;
    }

    // Modal submit handling
    if (interaction.isModalSubmit && interaction.isModalSubmit()) {
      if (interaction.customId === "baskin_ids_modal") {
        try {
          // Acknowledge modal submit so we can followUp later
          await interaction.deferReply({ ephemeral: true });

          const idsRaw = interaction.fields.getTextInputValue("ids_input");
          const ids = idsRaw
            .split(/[\s,]+/)
            .map((i) => i.trim())
            .filter(Boolean);
          if (!ids.length) {
            await interaction.followUp({
              content: "Geçerli ID bulunamadı. İşlem iptal edildi.",
              ephemeral: true,
            });
            return;
          }

          // require the command module and call exported handleReport
          const cmd = require("../Commands/info/baskin-bildir.js");
          if (cmd && typeof cmd.handleReport === "function") {
            await cmd.handleReport(
              client,
              interaction.guild,
              interaction.user,
              ids,
              "slash",
              interaction,
            );
          } else {
            throw new Error("handleReport fonksiyonu bulunamadı.");
          }
        } catch (e) {
          console.error("Modal submit handling error:", e);
          if (client && typeof client.emit === "function")
            client.emit("commandError", {
              error: e,
              command: "baskin-bildir-modal",
              type: "modal",
              context: {
                guildId: interaction.guild?.id,
                channelId: interaction.channelId,
                userId: interaction.user.id,
              },
            });
          try {
            await interaction.followUp({
              content: "Bir hata oluştu, yetkililere bildirildi.",
              ephemeral: true,
            });
          } catch {}
        }
        return;
      }
    }

    // Select menu handling: sayfa seçici
    if (interaction.isStringSelectMenu && interaction.isStringSelectMenu()) {
      const customId = interaction.customId;
      // baskin_page_<reporterId>_timestamp
      if (customId && customId.startsWith("baskin_page_")) {
        try {
          // izin kontrolü: yalnızca bildiren kullanıcı veya bot sahibi seçebilir
          const parts = customId.split("_");
          const reporterId = parts[2]; // baskin_page_<reporterId>_...
          if (interaction.user.id !== reporterId && !ayarlar.owners.includes(interaction.user.id)) {
            return interaction.reply({ content: "Bu sayfa seçimini yalnızca bildiriyi yapan kullanıcı veya sahibi yapabilir.", ephemeral: true });
          }

          // pages stored on client
          const pages = client._baskinPages ? client._baskinPages.get(customId) : null;
          if (!pages || !pages.length) {
            return interaction.reply({ content: "Sayfalar bulunamadı veya süresi dolmuş.", ephemeral: true });
          }

          const selected = Number(interaction.values[0] || "0");
          const pageIndex = Math.max(0, Math.min(selected, pages.length - 1));
          // Update the original message (interaction.message) embed
          try {
            await interaction.update({ embeds: [pages[pageIndex]] });
          } catch {
            // fallback: deferUpdate then edit
            await interaction.deferUpdate().catch(() => {});
            try { await interaction.message.edit({ embeds: [pages[pageIndex]] }).catch(() => {}); } catch {}
          }
        } catch (e) {
          console.error("Select handling error:", e);
          if (client && typeof client.emit === "function") client.emit("commandError", { error: e, command: "baskin-bildir-select", type: "select", context: { guildId: interaction.guild?.id, channelId: interaction.channelId, userId: interaction.user.id } });
          try { await interaction.reply({ content: "Bir hata oluştu.", ephemeral: true }); } catch {}
        }
        return;
      }
    }

    if (interaction.type === InteractionType.ApplicationCommand) {
      if (interaction.user.bot) {
        return;
      }

      try {
        const command = client.slashCommands.get(interaction.commandName);
        if (command) {
          if (
            command.ownerOnly &&
            !ayarlar.owners.includes(interaction.user.id)
          ) {
            return interaction.reply({
              content: "Sadece bot sahibi bu komutu kullanabilir.",
              ephemeral: true,
            });
          }

          if (command.cooldown) {
            if (cooldown.has(`${command.name}-${interaction.user.id}`)) {
              const nowDate = interaction.createdTimestamp;
              const waitedDate =
                cooldown.get(`${command.name}-${interaction.user.id}`) -
                nowDate;
              return interaction
                .reply({
                  content: `Cooldown is currently active, please try again <t:${Math.floor(
                    new Date(nowDate + waitedDate).getTime() / 1000,
                  )}:R>.`,
                  ephemeral: true,
                })
                .then(() =>
                  setTimeout(
                    () => interaction.deleteReply(),
                    cooldown.get(`${command.name}-${interaction.user.id}`) -
                      Date.now() +
                      1000,
                  ),
                );
            }

            try {
              await command.slashRun(client, interaction);
            } catch (err) {
              const errPayload = {
                error: err,
                command: command.slashData?.name || command.name || "unknown",
                type: "slash",
                context: {
                  guildId: interaction.guild?.id,
                  channelId: interaction.channelId,
                  userId: interaction.user.id,
                },
              };
              if (client && typeof client.emit === "function")
                client.emit("commandError", errPayload);
              // kullanıcıya kısa bildirim
              interaction
                .reply({
                  content:
                    "Komut çalıştırılırken bir hata oluştu. Bildirim gönderildi.",
                  ephemeral: true,
                })
                .catch(() => {});
            }

            cooldown.set(
              `${command.name}-${interaction.user.id}`,
              Date.now() + command.cooldown,
            );

            setTimeout(() => {
              cooldown.delete(`${command.name}-${interaction.user.id}`);
            }, command.cooldown + 1000);
          } else {
            try {
              await command.slashRun(client, interaction);
            } catch (err) {
              const errPayload = {
                error: err,
                command: command.slashData?.name || command.name || "unknown",
                type: "slash",
                context: {
                  guildId: interaction.guild?.id,
                  channelId: interaction.channelId,
                  userId: interaction.user.id,
                },
              };
              if (client && typeof client.emit === "function")
                client.emit("commandError", errPayload);
              interaction
                .reply({
                  content:
                    "Komut çalıştırılırken bir hata oluştu. Bildirim gönderildi.",
                  ephemeral: true,
                })
                .catch(() => {});
            }
          }
        }
      } catch (e) {
        console.error(e);
        interaction.reply({
          content:
            "Bir hata oluştu! Lütfen tekrar deneyin.",
          ephemeral: true,
        });
      }
    }
  },
};

/*
  interactionCreate event:
  - ApplicationCommand tipi interaction'lar slash komutlarını temsil eder.
  - Slash komutları client.slashCommands koleksiyonundan alınır.
  - command.ownerOnly === true ise ayarlar.owners dizisinde kontrol edilir.
*/
