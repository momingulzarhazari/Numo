import {
  ChatInputCommandInteraction,
  Client,
  Message,
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js';
import { config } from './config';
import { storage } from './storage';
import { gameManager } from './game';
import { applyBotPresence } from './client';
import {
  createAboutPayload,
  createBlacklistListPayload,
  createGameStartPayload,
  createHelpPayload,
  createInfoContainer,
  createLeaderboardPayload,
  createPingPayload,
  createStaffListPayload,
  createStatsPayload,
  createTrialPanelPayload,
} from './components';

export const NO_MENTIONS = {
  repliedUser: false,
  parse: [] as [],
};

export const slashCommands = [
  new SlashCommandBuilder()
    .setName('numberhunt')
    .setDescription('Start or manage a Number Hunt game')
    .addSubcommand((sub) =>
      sub
        .setName('start')
        .setDescription('Begin a new Number Hunt round in this channel')
        .addStringOption((opt) =>
          opt
            .setName('difficulty')
            .setDescription('Difficulty mode')
            .addChoices(
              { name: 'Easy (1-50, 60s)', value: 'easy' },
              { name: 'Normal (1-100, 45s)', value: 'normal' },
              { name: 'Hard (1-500, 30s)', value: 'hard' },
              { name: 'Extreme (1-1000, 20s)', value: 'extreme' }
            )
        )
        .addIntegerOption((opt) => opt.setName('range_min').setDescription('Custom minimum value'))
        .addIntegerOption((opt) => opt.setName('range_max').setDescription('Custom maximum value'))
    )
    .addSubcommand((sub) =>
      sub.setName('stop').setDescription('Terminate your active round in this channel')
    ),

  new SlashCommandBuilder()
    .setName('about')
    .setDescription('Learn more about Numo'),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Display available Numo commands and features'),

  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View player game statistics')
    .addUserOption((opt) => opt.setName('user').setDescription('User to view stats for')),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Display the top 10 Number Hunt winners'),

  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot gateway and REST response latency'),
];

export async function registerSlashCommands(client: Client) {
  if (!config.token || !config.clientId) {
    console.warn('[Commands] DISCORD_TOKEN or DISCORD_CLIENT_ID missing; skipping slash registration.');
    return;
  }

  try {
    const rest = new REST({ version: '10' }).setToken(config.token);
    const body = slashCommands.map((c) => c.toJSON());

    console.log(`[Commands] Registering ${body.length} global slash commands...`);
    await rest.put(Routes.applicationCommands(config.clientId), { body });
    console.log('[Commands] Global slash commands registered successfully.');
  } catch (err) {
    console.error('[Commands] Failed to register slash commands:', err);
  }
}

export async function handleSlashCommand(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  // Security check: blacklist
  if (storage.isBlacklisted(userId) || (guildId && storage.isBlacklisted(guildId))) {
    await interaction.reply({
      ...createInfoContainer('Access Denied', 'Your account or server is restricted from using Numo.'),
      ephemeral: true,
      allowedMentions: NO_MENTIONS,
    });
    return;
  }

  const { commandName } = interaction;

  if (commandName === 'about') {
    await interaction.reply({
      ...createAboutPayload(),
      allowedMentions: NO_MENTIONS,
    });
    return;
  }

  if (commandName === 'ping') {
    const wsPing = interaction.client.ws.ping;
    const roundTrip = Math.max(1, Date.now() - interaction.createdTimestamp);
    await interaction.reply({
      ...createPingPayload(wsPing, roundTrip),
      allowedMentions: NO_MENTIONS,
    });
    return;
  }

  if (commandName === 'help') {
    await interaction.reply({
      ...createHelpPayload(),
      allowedMentions: NO_MENTIONS,
    });
    return;
  }

  if (commandName === 'stats') {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const stats = storage.getUserStats(targetUser.id);
    await interaction.reply({
      ...createStatsPayload(targetUser.id, stats),
      allowedMentions: NO_MENTIONS,
    });
    return;
  }

  if (commandName === 'leaderboard') {
    const top = storage.getTopLeaderboard(10);
    await interaction.reply({
      ...createLeaderboardPayload(top),
      allowedMentions: NO_MENTIONS,
    });
    return;
  }

  if (commandName === 'numberhunt') {
    const sub = interaction.options.getSubcommand();
    const channel = interaction.channel;
    if (!channel || !('send' in channel)) {
      await interaction.reply(
        createInfoContainer('Error', 'Commands cannot be executed in this channel type.', true)
      );
      return;
    }

    if (sub === 'stop') {
      const isStaff = storage.isStaff(userId);
      const res = await gameManager.stopGame(channel.id, channel as any, userId, isStaff);
      if (!res.success) {
        await interaction.reply(
          createInfoContainer('Notice', res.message || 'No active game found to stop.', true)
        );
      } else {
        await interaction.reply(
          createInfoContainer('Game Terminated', 'Your active Number Hunt was ended.', true)
        );
      }
      return;
    }

    if (sub === 'start') {
      const difficulty = interaction.options.getString('difficulty') || 'normal';
      const rangeMin = interaction.options.getInteger('range_min') ?? undefined;
      const rangeMax = interaction.options.getInteger('range_max') ?? undefined;

      const result = gameManager.startGame(channel as any, userId, difficulty, rangeMin, rangeMax);
      if (!result.success || !result.game) {
        await interaction.reply(
          createInfoContainer('Cannot Start Game', result.error || 'Failed to start game.', true)
        );
        return;
      }

      await interaction.reply({
        ...createGameStartPayload(result.game),
        allowedMentions: NO_MENTIONS,
      });
      return;
    }
  }
}

async function replyNoMentions(message: Message, payload: any) {
  return message.reply({
    ...payload,
    allowedMentions: NO_MENTIONS,
  });
}

async function sendNoMentions(channel: any, payload: any) {
  return channel.send({
    ...payload,
    allowedMentions: NO_MENTIONS,
  });
}

/**
 * Parses and executes text commands with standard prefix '!' OR
 * without prefix if the user has active No-Prefix access / trial.
 * Mentions are strictly disabled in all responses.
 */
export async function handleTextMessage(message: Message): Promise<boolean> {
  const userId = message.author.id;
  const guildId = message.guildId;

  // Security check: blacklisted entities rejected silently
  if (storage.isBlacklisted(userId) || (guildId && storage.isBlacklisted(guildId))) {
    return false;
  }

  const raw = message.content.trim();
  const hasNoPrefix = storage.hasNoPrefixAccess(userId);
  const prefix = config.defaultPrefix;

  let commandBody = '';

  if (raw.startsWith(prefix)) {
    commandBody = raw.slice(prefix.length).trim();
  } else if (hasNoPrefix) {
    commandBody = raw;
  } else {
    return false;
  }

  if (!commandBody) return false;

  const parts = commandBody.split(/\s+/);
  const trigger = parts[0].toLowerCase();
  const args = parts.slice(1);

  const isOwner = userId === config.ownerId;
  const isStaff = storage.isStaff(userId);

  // 1. General User & Game Commands
  if (trigger === 'nh' || trigger === 'numberhunt') {
    if (args[0]?.toLowerCase() === 'stop') {
      const res = await gameManager.stopGame(message.channel.id, message.channel as any, userId, isStaff);
      if (!res.success) {
        await replyNoMentions(message, createInfoContainer('Notice', res.message || 'No active game found to stop.'));
      }
      return true;
    }

    // Determine difficulty and custom bounds
    let difficulty = 'normal';
    let customMin: number | undefined;
    let customMax: number | undefined;

    if (args[0]) {
      const first = args[0].toLowerCase();
      if (['easy', 'normal', 'hard', 'extreme', 'chaos'].includes(first)) {
        difficulty = first;
        if (args[1] && args[2] && !isNaN(parseInt(args[1], 10)) && !isNaN(parseInt(args[2], 10))) {
          customMin = parseInt(args[1], 10);
          customMax = parseInt(args[2], 10);
        }
      } else if (!isNaN(parseInt(args[0], 10)) && args[1] && !isNaN(parseInt(args[1], 10))) {
        customMin = parseInt(args[0], 10);
        customMax = parseInt(args[1], 10);
      }
    }

    const startRes = gameManager.startGame(message.channel as any, userId, difficulty, customMin, customMax);
    if (!startRes.success || !startRes.game) {
      await replyNoMentions(message, createInfoContainer('Notice', startRes.error || 'Failed to start game.'));
      return true;
    }

    await sendNoMentions(message.channel, createGameStartPayload(startRes.game));
    return true;
  }

  if (trigger === 'about') {
    await replyNoMentions(message, createAboutPayload());
    return true;
  }

  if (trigger === 'help' || trigger === 'h') {
    await replyNoMentions(message, createHelpPayload());
    return true;
  }

  if (trigger === 'stats' || trigger === 's') {
    const mentioned = message.mentions.users.first();
    const targetId = mentioned ? mentioned.id : (args[0] && /^\d+$/.test(args[0]) ? args[0] : userId);
    const stats = storage.getUserStats(targetId);
    await replyNoMentions(message, createStatsPayload(targetId, stats));
    return true;
  }

  if (trigger === 'lb' || trigger === 'leaderboard') {
    const top = storage.getTopLeaderboard(10);
    await replyNoMentions(message, createLeaderboardPayload(top));
    return true;
  }

  if (trigger === 'ping' || trigger === 'p') {
    const wsPing = message.client.ws.ping;
    const roundTrip = Math.max(1, Date.now() - message.createdTimestamp);
    await replyNoMentions(message, createPingPayload(wsPing, roundTrip));
    return true;
  }

  // 2. Staff Commands
  if (trigger === 'nppanel') {
    if (!isStaff) return false;
    await sendNoMentions(message.channel, createTrialPanelPayload());
    return true;
  }

  if (trigger === 'blacklist') {
    if (!isStaff) return false;
    const sub = args[0]?.toLowerCase();

    if (sub === 'list') {
      const records = storage.getAllBlacklists();
      await replyNoMentions(message, createBlacklistListPayload(records));
      return true;
    }

    if (sub === 'add') {
      const targetId = args[1]?.replace(/[<@!>]/g, '');
      if (!targetId || !/^\d+$/.test(targetId)) {
        await replyNoMentions(message, createInfoContainer('Invalid Target', 'Provide a valid ID to blacklist.'));
        return true;
      }
      const reason = args.slice(2).join(' ') || 'Policy violation';
      const isGuild = message.client.guilds.cache.has(targetId);
      const success = storage.addBlacklist(targetId, isGuild ? 'guild' : 'user', reason, userId);
      if (success) {
        await replyNoMentions(
          message,
          createInfoContainer('Blacklist Updated', `Added \`${targetId}\` to blacklist. Reason: ${reason}`)
        );
      } else {
        await replyNoMentions(message, createInfoContainer('Notice', `ID \`${targetId}\` is already blacklisted.`));
      }
      return true;
    }

    if (sub === 'remove') {
      const targetId = args[1]?.replace(/[<@!>]/g, '');
      if (!targetId) {
        await replyNoMentions(message, createInfoContainer('Invalid Target', 'Provide a valid ID to remove.'));
        return true;
      }
      const removed = storage.removeBlacklist(targetId);
      if (removed) {
        await replyNoMentions(message, createInfoContainer('Blacklist Updated', `Removed \`${targetId}\` from blacklist.`));
      } else {
        await replyNoMentions(message, createInfoContainer('Notice', `ID \`${targetId}\` was not found in blacklist.`));
      }
      return true;
    }

    await replyNoMentions(message, createInfoContainer('Usage', '`!blacklist <add|remove|list> [target_id] [reason]`'));
    return true;
  }

  if (trigger === 'noprefix') {
    if (!isStaff) return false;
    const sub = args[0]?.toLowerCase();
    const targetId = args[1]?.replace(/[<@!>]/g, '');

    if (sub === 'add') {
      if (!targetId || !/^\d+$/.test(targetId)) {
        await replyNoMentions(message, createInfoContainer('Invalid Target', 'Specify a valid user ID.'));
        return true;
      }
      const added = storage.addPermanentNoPrefix(targetId);
      if (added) {
        await replyNoMentions(message, createInfoContainer('No-Prefix Granted', `User <@${targetId}> has permanent no-prefix access.`));
      } else {
        await replyNoMentions(message, createInfoContainer('Notice', `User <@${targetId}> already has permanent no-prefix access.`));
      }
      return true;
    }

    if (sub === 'remove') {
      if (!targetId || !/^\d+$/.test(targetId)) {
        await replyNoMentions(message, createInfoContainer('Invalid Target', 'Specify a valid user ID.'));
        return true;
      }
      const removed = storage.removePermanentNoPrefix(targetId);
      if (removed) {
        await replyNoMentions(message, createInfoContainer('No-Prefix Revoked', `Permanent no-prefix revoked for <@${targetId}>.`));
      } else {
        await replyNoMentions(message, createInfoContainer('Notice', `User <@${targetId}> was not found in permanent list.`));
      }
      return true;
    }

    await replyNoMentions(message, createInfoContainer('Usage', '`!noprefix <add|remove> <userId>`'));
    return true;
  }

  // 3. Numo Core (Owner Only Commands)
  if (trigger === 'activity') {
    if (!isOwner) return false;
    if (args[0]?.toLowerCase() === 'clear') {
      storage.setPresence(null);
      message.client.user?.setActivity(undefined);
      await replyNoMentions(message, createInfoContainer('Activity Cleared', 'Custom activity status has been cleared.'));
      return true;
    }

    const text = args.join(' ');
    if (!text) {
      await replyNoMentions(message, createInfoContainer('Usage', '`!activity <text>` or `!activity clear`'));
      return true;
    }

    if (text === 'clear') {
      storage.setPresence(null);
      applyBotPresence(message.client);
      await replyNoMentions(message, createInfoContainer('Activity Cleared', 'Playing activity has been removed.'));
      return true;
    }

    storage.setPresence(text);
    applyBotPresence(message.client);
    await replyNoMentions(message, createInfoContainer('Activity Updated', `Playing activity set to: ${text}`));
    return true;
  }

  if (trigger === 'customstatus' || trigger === 'textstatus' || trigger === 'cs') {
    if (!isOwner) return false;
    const text = args.join(' ').trim();

    if (!text) {
      await replyNoMentions(message, createInfoContainer('Usage', '`!customstatus <text>` or `!customstatus clear`'));
      return true;
    }

    if (text.toLowerCase() === 'clear') {
      storage.setCustomStatus(null);
      applyBotPresence(message.client);
      await replyNoMentions(message, createInfoContainer('Text Status Cleared', 'Text status at top near profile has been cleared.'));
      return true;
    }

    storage.setCustomStatus(text);
    applyBotPresence(message.client);
    await replyNoMentions(
      message,
      createInfoContainer('Text Status Updated', `Text status near profile set to: ${text}`)
    );
    return true;
  }

  if (trigger === 'status') {
    if (!isOwner) return false;
    const statusArg = args[0]?.toLowerCase() as 'online' | 'idle' | 'dnd' | 'invisible';
    const validStatuses = ['online', 'idle', 'dnd', 'invisible'];

    if (!validStatuses.includes(statusArg)) {
      await replyNoMentions(message, createInfoContainer('Usage', '`!status <online|idle|dnd|invisible> [text status]`'));
      return true;
    }

    const customText = args.slice(1).join(' ').trim();
    if (customText) {
      storage.setPresence(storage.getPresence().activityText, statusArg, customText);
    } else {
      storage.setPresence(storage.getPresence().activityText, statusArg);
    }
    applyBotPresence(message.client);

    await replyNoMentions(
      message,
      createInfoContainer(
        'Status Updated',
        `Online Status: ${statusArg}\nText Status: ${storage.getPresence().customStatus || 'None'}\nActivity: ${storage.getPresence().activityText || 'None'}`
      )
    );
    return true;
  }

  if (trigger === 'staff') {
    if (!isOwner) return false;
    const sub = args[0]?.toLowerCase();

    if (sub === 'list') {
      const staffList = storage.getStaffList();
      await replyNoMentions(message, createStaffListPayload(staffList, config.ownerId));
      return true;
    }

    if (sub === 'add') {
      const targetId = args[1]?.replace(/[<@!>]/g, '');
      if (!targetId || !/^\d+$/.test(targetId)) {
        await replyNoMentions(message, createInfoContainer('Invalid Target', 'Specify a valid user ID.'));
        return true;
      }
      const added = storage.addStaff(targetId);
      if (added) {
        await replyNoMentions(message, createInfoContainer('Staff Appointed', `User <@${targetId}> is now Numo staff.`));
      } else {
        await replyNoMentions(message, createInfoContainer('Notice', `User <@${targetId}> is already staff.`));
      }
      return true;
    }

    if (sub === 'remove') {
      const targetId = args[1]?.replace(/[<@!>]/g, '');
      if (!targetId || !/^\d+$/.test(targetId)) {
        await replyNoMentions(message, createInfoContainer('Invalid Target', 'Specify a valid user ID.'));
        return true;
      }
      const removed = storage.removeStaff(targetId);
      if (removed) {
        await replyNoMentions(message, createInfoContainer('Staff Revoked', `Staff authorization removed for <@${targetId}>.`));
      } else {
        await replyNoMentions(message, createInfoContainer('Notice', `User <@${targetId}> is not currently staff.`));
      }
      return true;
    }

    await replyNoMentions(message, createInfoContainer('Usage', '`!staff <add|remove|list> <userId>`'));
    return true;
  }

  return false;
}
