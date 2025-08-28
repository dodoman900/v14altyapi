const { Collection } = require("discord.js");
const { readdirSync } = require("node:fs");
const path = require("node:path");

module.exports = {
  async execute(client) {
    client.commands = new Collection();
    client.commandAliases = new Collection();
    client.slashCommands = new Collection();
    client.slashDatas = [];

    const commandsPath = path.join(__dirname, "../Commands");
    const commandFolders = readdirSync(commandsPath);

    const prefixLoaded = [];
    const slashLoaded = [];
    const failedLoads = [];

    await Promise.all(
      commandFolders.map(async (category) => {
        const categoryPath = path.join(commandsPath, category);
        const commandFiles = readdirSync(categoryPath);

        await Promise.all(
          commandFiles.map(async (file) => {
            try {
              const commands = require(path.join(categoryPath, file));

              if (commands && commands.commandBase) {
                const base = commands.commandBase;

                if (base.prefixData) {
                  const prefixCommand = base;
                  client.commands.set(prefixCommand.prefixData.name, prefixCommand);
                  prefixLoaded.push(prefixCommand.prefixData.name);

                  if (prefixCommand.prefixData.aliases && Array.isArray(prefixCommand.prefixData.aliases)) {
                    prefixCommand.prefixData.aliases.forEach((alias) => {
                      client.commandAliases.set(alias, prefixCommand.prefixData.name);
                    });
                  }
                }

                if (base.slashData) {
                  const slashCommand = base;
                  client.slashDatas.push(slashCommand.slashData.toJSON());
                  client.slashCommands.set(slashCommand.slashData.name, slashCommand);
                  slashLoaded.push(slashCommand.slashData.name);
                }
              } else {
                // desteklenmeyen format
                failedLoads.push({ file: path.join(category, file), reason: "missing commandBase export" });
              }
            } catch (e) {
              failedLoads.push({ file: path.join(category, file), reason: e.message || String(e) });
            }
          }),
        );
      }),
    );

    const logger = client.logger || console;
    try {
      logger.info(`Prefix commands loaded (${prefixLoaded.length}): ${prefixLoaded.join(", ") || "none"}`);
      logger.info(`Slash commands loaded (${slashLoaded.length}): ${slashLoaded.join(", ") || "none"}`);
      if (failedLoads.length > 0) {
        logger.warn(`Failed to load ${failedLoads.length} command file(s):`);
        failedLoads.forEach(f => logger.warn(` - ${f.file}: ${f.reason}`));
      }
    } catch (e) {
      console.log("Komut yükleme özeti yazılırken hata:", e);
    }
  },
};

/*
  Handler expectations (command module exports must match one of these forms):

  module.exports.commandBase = {
    prefixData: { name: "ping", aliases: ["pong"] }, // optional: prefix command
    slashData: new SlashCommandBuilder().setName("ping").setDescription("..."), // optional: slash
    cooldown: 5000, // ms
    ownerOnly: false,
    conf: { // OPTIONAL metadata for docs / help commands
      description: "Pings the bot",
      usage: "!ping",
      examples: ["!ping", "/ping"]
    },
    async prefixRun(client, message, args) { ... },
    async slashRun(client, interaction) { ... }
  }

  - Handlers automatically register prefix and slash commands when present.
  - 'conf' is only metadata and not used for logic by handlers (useful for help/README).
*/
