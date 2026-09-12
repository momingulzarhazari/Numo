import {
  ActivityType,
  Client,
  Events,
  GatewayIntentBits,
  Interaction,
  Message,
  Partials,
} from 'discord.js';
import { config } from './config';
import { storage } from './storage';
import { gameManager } from './game';
import { handleSlashCommand, handleTextMessage, registerSlashCommands } from './commands';
import { createTrialClaimResponse, createInfoContainer } from './components';

let clientInstance: Client | null = null;

export function applyBotPresence(client: Client) {
  if (!client.user) return;
  const presence = storage.getPresence();
  const activities: Array<{ name: string; type: ActivityType; state?: string }> = [];

  // Text status displayed at the top near profile card (Custom Status)
  if (presence.customStatus) {
    activities.push({
      name: 'custom',
      type: ActivityType.Custom,
      state: presence.customStatus,
    });
  }

  // Activity like "Playing Number Hunt"
  if (presence.activityText) {
    activities.push({
      name: presence.activityText,
      type: ActivityType.Playing,
    });
  }

  client.user.setPresence({
    status: presence.status,
    activities,
  });
}

export function getDiscordClient(): Client {
  if (clientInstance) return clientInstance;

  clientInstance = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  clientInstance.on(Events.ClientReady, async (client) => {
    console.log(`[Numo] Authenticated as ${client.user.tag} (${client.user.id})`);

    // Sync installed guilds
    const guildIds = client.guilds.cache.map((g) => g.id);
    storage.syncGuilds(guildIds);
    console.log(`[Numo] Synchronized ${guildIds.length} installed guild(s).`);

    // Set initial activity and custom text status near profile
    applyBotPresence(client);

    // Register slash commands
    await registerSlashCommands(client);
  });

  clientInstance.on(Events.GuildCreate, (guild) => {
    storage.addGuild(guild.id);
    console.log(`[Numo] Joined guild ${guild.name} (${guild.id})`);
  });

  clientInstance.on(Events.GuildDelete, (guild) => {
    storage.removeGuild(guild.id);
    console.log(`[Numo] Removed from guild ${guild.name} (${guild.id})`);
  });

  clientInstance.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        await handleSlashCommand(interaction);
        return;
      }

      if (interaction.isButton()) {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        // Blacklist check
        if (storage.isBlacklisted(userId) || (guildId && storage.isBlacklisted(guildId))) {
          await interaction.reply(
            createInfoContainer('Access Denied', 'Your account or server is restricted.', true)
          );
          return;
        }

        // 1. Claim 7-day No-Prefix Trial
        if (interaction.customId === 'numo_claim_trial') {
          const claimResult = storage.claimTrial(userId);
          await interaction.reply(
            createTrialClaimResponse(claimResult.trial, claimResult.alreadyClaimed)
          );
          return;
        }

        // 2. Stop Game Button
        if (interaction.customId.startsWith('numo_stop_game_')) {
          const rawId = interaction.customId.replace('numo_stop_game_', '');
          const parts = rawId.split('_');
          const channelId = parts[0];
          const hostId = parts[1];
          const isStaff = storage.isStaff(userId);
          const channel = interaction.channel;

          if (!channel || !('send' in channel)) {
            await interaction.reply(
              createInfoContainer('Error', 'Invalid channel.', true)
            );
            return;
          }

          const stopRes = await gameManager.stopGame(channelId, channel as any, userId, isStaff);
          if (stopRes.success) {
            await interaction.reply(
              createInfoContainer('Game Ended', 'The Number Hunt was ended.', true)
            );
          } else {
            await interaction.reply(
              createInfoContainer('Notice', stopRes.message || 'Unable to stop game.', true)
            );
          }
          return;
        }
      }
    } catch (err) {
      console.error('[Numo] Interaction error:', err, (err as any)?.rawError || '');
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply(
          createInfoContainer('Error', 'An internal error occurred while executing this interaction.', true)
        ).catch(() => null);
      }
    }
  });

  clientInstance.on(Events.MessageCreate, async (message: Message) => {
    try {
      if (message.author.bot) return;

      const userId = message.author.id;
      const guildId = message.guildId;

      // Silent rejection for blacklisted entities
      if (storage.isBlacklisted(userId) || (guildId && storage.isBlacklisted(guildId))) {
        return;
      }

      const trimmed = message.content.trim();

      // Check if there is an active game in this channel and message is a pure integer guess
      if (/^-?\d+$/.test(trimmed)) {
        if (gameManager.isGameActive(message.channel.id)) {
          const guess = parseInt(trimmed, 10);
          if (!isNaN(guess)) {
            const handled = await gameManager.processGuess(message, guess);
            if (handled) return;
          }
        }
      }

      // Process prefix or no-prefix command
      await handleTextMessage(message);
    } catch (err) {
      console.error('[Numo] MessageCreate error:', err, (err as any)?.rawError || '');
    }
  });

  clientInstance.on(Events.Error, (err) => {
    console.error('[Numo] Gateway error:', err);
  });

  return clientInstance;
}

export async function startBot() {
  // Prevent duplicate bot instances when running inside the Google AI Studio container
  // or whenever DISABLE_DISCORD_GATEWAY=true is set.
  // This guarantees that only your external hosting connects to the Discord gateway.
  const isAiStudioEnv =
    process.env.DISABLE_DISCORD_GATEWAY === 'true' ||
    Boolean(process.env.AIS_ENVIRONMENT) ||
    Boolean(process.env.K_SERVICE && process.env.K_REVISION && process.env.K_SERVICE.includes('ais-dev'));

  if (isAiStudioEnv) {
    console.log('------------------------------------------------------------');
    console.log('[Numo Bot] AI Studio preview environment detected.');
    console.log('[Numo Bot] Discord Gateway connection is DISABLED here.');
    console.log('[Numo Bot] Only your external hosting service will run the bot.');
    console.log('------------------------------------------------------------');
    return;
  }

  if (!config.token) {
    console.log('------------------------------------------------------------');
    console.log('[Numo] DISCORD_TOKEN is not configured.');
    console.log('[Numo] Provide DISCORD_TOKEN in the environment or Settings panel.');
    console.log('------------------------------------------------------------');
    return;
  }

  try {
    const client = getDiscordClient();
    console.log('[Numo] Connecting to Discord Gateway...');
    await client.login(config.token);
  } catch (err) {
    console.error('[Numo] Login failed:', err);
  }
}
