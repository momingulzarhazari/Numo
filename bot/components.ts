import {
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} from 'discord.js';
import { ActiveGame, BlacklistRecord, TrialRecord, UserStats } from './types';

/**
 * Standard Components V2 response payload with MessageFlags.IsComponentsV2 (32768)
 * strictly colorless, minimal, and with mentions disabled so text is never highlighted.
 */
export function wrapComponentsV2(container: ContainerBuilder): any {
  return {
    flags: MessageFlags.IsComponentsV2,
    components: [container],
    allowedMentions: {
      parse: [],
      repliedUser: false,
    },
  };
}

/**
 * Short guess responses: only 'Higher.', 'Lower.', or 'Correct. <@winnerId> won!'
 * When someone wins, they are mentioned in the message with allowedMentions.
 */
export function createGuessResponse(text: 'Higher.' | 'Lower.' | 'Correct.', winnerId?: string) {
  const content = winnerId && text === 'Correct.' ? `Correct. <@${winnerId}> won!` : text;
  const container = new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(content)
  );

  if (winnerId && text === 'Correct.') {
    const isSnowflake = /^\d{16,21}$/.test(winnerId);
    return {
      flags: MessageFlags.IsComponentsV2,
      components: [container],
      allowedMentions: isSnowflake
        ? {
            users: [winnerId],
            repliedUser: true,
          }
        : {
            repliedUser: true,
            parse: ['users' as const],
          },
    };
  }

  return wrapComponentsV2(container);
}

/**
 * Game start message: only difficulty/range and the time limit.
 * e.g., 'You have 60 seconds.'
 * No emojis, no guess limits, no clutter.
 */
export function createGameStartPayload(game: ActiveGame) {
  const diffName = game.difficulty.charAt(0).toUpperCase() + game.difficulty.slice(1);
  const timeLimitSec = Math.round(game.timeoutMs / 1000);

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### Number Hunt • ${diffName}`),
      new TextDisplayBuilder().setContent(`Range: ${game.min}–${game.max}\nYou have ${timeLimitSec} seconds.`)
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('Type any number in chat to guess.')
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(`numo_stop_game_${game.channelId}_${game.hostId}`)
            .setLabel('End Game')
            .setStyle(ButtonStyle.Secondary)
        )
    );

  return wrapComponentsV2(container);
}

/**
 * Short and minimal timeout message. No emojis.
 */
export function createGameTimeoutPayload(game: ActiveGame) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('### Number Hunt'),
      new TextDisplayBuilder().setContent(`Time's up. The number was ${game.targetNumber}.`)
    );

  return wrapComponentsV2(container);
}

/**
 * Short and minimal stop message. No emojis.
 */
export function createGameStoppedPayload(game: ActiveGame) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('### Number Hunt'),
      new TextDisplayBuilder().setContent(`Game ended. The number was ${game.targetNumber}.`)
    );

  return wrapComponentsV2(container);
}

/**
 * 7-Day Trial Claim Panel. Clean, minimal, and organized.
 */
export function createTrialPanelPayload() {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('### No-Prefix Access')
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            'Run commands directly without typing a prefix.\n\n' +
            '• Duration: 7 days\n' +
            '• Limit: One claim per account'
          )
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId('numo_claim_trial')
            .setLabel('Claim 7-Day Trial')
            .setStyle(ButtonStyle.Secondary)
        )
    );

  return wrapComponentsV2(container);
}

/**
 * Trial Claim Interaction Response (ephemeral).
 */
export function createTrialClaimResponse(trial: TrialRecord, alreadyClaimed: boolean) {
  const expSec = Math.floor(trial.expiresAt / 1000);
  const container = new ContainerBuilder();

  if (alreadyClaimed) {
    const isExpired = Date.now() >= trial.expiresAt;
    container
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('### No-Prefix Trial')
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          isExpired
            ? `Your 7-day trial expired on <t:${expSec}:d>.`
            : `Your 7-day trial is active until <t:${expSec}:R>.`
        )
      );
  } else {
    container
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('### No-Prefix Trial')
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `Your 7-day trial is now active.\nExpires: <t:${expSec}:R>`
        )
      );
  }

  return {
    ...wrapComponentsV2(container),
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
  };
}

/**
 * Command Index / Help reference.
 * Purely general commands: long commands separated from short forms.
 * Staff/Owner commands are completely removed as requested.
 */
export function createHelpPayload() {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('### Numo Commands')
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '**Long Commands**\n' +
        '• `/numberhunt start [difficulty]` — Start game\n' +
        '• `/numberhunt stop` — End active game\n' +
        '• `/leaderboard` — View top players\n' +
        '• `/stats [user]` — View player statistics\n' +
        '• `/ping` — Check response latency\n' +
        '• `/about` — About Numo\n' +
        '• `/help` — Show command index'
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '**Short Forms**\n' +
        '• `!nh` (or `!nh [difficulty]`) — Start game\n' +
        '• `!nh stop` — End active game\n' +
        '• `!lb` — View top players\n' +
        '• `!s [user]` — View player statistics\n' +
        '• `!p` — Check response latency\n' +
        '• `!h` — Show command index'
      )
    );

  return wrapComponentsV2(container);
}

/**
 * About Numo overview. Clean, minimal, non-technical.
 */
export function createAboutPayload() {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('### About Numo')
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        'Numo is a fast, minimalist Number Hunt bot.\n\n' +
        '• One game runs per channel — anyone in chat can guess and compete to win.\n' +
        '• Direct integer guesses require no prefix during active rounds.\n' +
        '• Type `/help` or `!h` to see all commands.'
      )
    );

  return wrapComponentsV2(container);
}

/**
 * Player Statistics. Clean and easy to understand.
 */
export function createStatsPayload(userId: string, stats: UserStats) {
  const winRate = stats.gamesPlayed > 0
    ? ((stats.wins / stats.gamesPlayed) * 100).toFixed(1)
    : '0.0';
  const fastest = stats.fastestTimeMs > 0
    ? `${(stats.fastestTimeMs / 1000).toFixed(1)}s`
    : 'None';

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('### Player Stats')
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `• Player: <@${userId}>\n` +
        `• Games played: ${stats.gamesPlayed}\n` +
        `• Wins: ${stats.wins}\n` +
        `• Win rate: ${winRate}%\n` +
        `• Current streak: ${stats.currentStreak}\n` +
        `• Best streak: ${stats.bestStreak}\n` +
        `• Fastest win: ${fastest}`
      )
    );

  return wrapComponentsV2(container);
}

/**
 * Leaderboard display.
 */
export function createLeaderboardPayload(topStats: UserStats[]) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('### Leaderboard')
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );

  if (topStats.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('No games recorded yet.')
    );
  } else {
    const lines = topStats.map((s, idx) => {
      const fastest = s.fastestTimeMs > 0 ? `${(s.fastestTimeMs / 1000).toFixed(1)}s` : 'N/A';
      return `${idx + 1}. <@${s.userId}> — ${s.wins} wins (Streak: ${s.bestStreak}, Fastest: ${fastest})`;
    });
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(lines.join('\n'))
    );
  }

  return wrapComponentsV2(container);
}

/**
 * Ping latency payload.
 */
export function createPingPayload(wsPing: number, roundTripMs: number) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('### Latency')
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `• Gateway: ${wsPing}ms\n` +
        `• Round trip: ${roundTripMs}ms`
      )
    );

  return wrapComponentsV2(container);
}

/**
 * Staff list payload.
 */
export function createStaffListPayload(staffIds: string[], ownerId: string) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('### Staff Members')
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );

  const ownerLine = ownerId ? `• Owner: <@${ownerId}>\n` : '• Owner: Not configured\n';
  const staffLines = staffIds.length > 0
    ? staffIds.map((id) => `• <@${id}>`).join('\n')
    : '• No additional staff appointed.';

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`${ownerLine}${staffLines}`)
  );

  return wrapComponentsV2(container);
}

/**
 * Blacklist registry payload.
 */
export function createBlacklistListPayload(records: BlacklistRecord[]) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('### Blacklist')
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );

  if (records.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('The blacklist is empty.')
    );
  } else {
    const lines = records.slice(0, 20).map((r) => {
      const target = r.type === 'user' ? `<@${r.id}>` : `Guild ${r.id}`;
      return `• ${target} — ${r.reason}`;
    });
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(lines.join('\n'))
    );
  }

  return wrapComponentsV2(container);
}

/**
 * Standard info or notice payload. Clean and minimal.
 */
export function createInfoContainer(title: string, message: string, ephemeral = false) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### ${title}`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(message)
    );

  const flags = ephemeral
    ? MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
    : MessageFlags.IsComponentsV2;

  return {
    flags,
    components: [container],
    allowedMentions: {
      parse: [],
      repliedUser: false,
    },
  };
}
