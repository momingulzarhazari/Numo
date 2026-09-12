import { Message, TextChannel, DMChannel, NewsChannel, ThreadChannel } from 'discord.js';
import { ActiveGame, GameDifficulty } from './types';
import { config } from './config';
import { storage } from './storage';
import {
  createGameStartPayload,
  createGameStoppedPayload,
  createGameTimeoutPayload,
  createGuessResponse,
} from './components';

type SendableChannel = TextChannel | DMChannel | NewsChannel | ThreadChannel;

export class GameManager {
  /**
   * Channel-level active games. Exactly one game can run in a channel at any time,
   * but anyone in that channel can participate and submit guesses.
   */
  private activeGames = new Map<string, ActiveGame>();

  public isGameActive(channelId: string): boolean {
    return this.activeGames.has(channelId);
  }

  public getGame(channelId: string): ActiveGame | undefined {
    return this.activeGames.get(channelId);
  }

  public startGame(
    channel: SendableChannel,
    hostId: string,
    difficultyInput?: string,
    customMin?: number,
    customMax?: number
  ): { success: boolean; error?: string; game?: ActiveGame } {
    if (this.activeGames.has(channel.id)) {
      return {
        success: false,
        error: 'A Number Hunt is already active in this channel. Anyone can guess by typing a number in chat!',
      };
    }

    let difficulty: GameDifficulty = 'normal';
    if (difficultyInput) {
      const lower = difficultyInput.toLowerCase();
      if (lower === 'easy' || lower === 'normal' || lower === 'hard' || lower === 'extreme' || lower === 'chaos') {
        difficulty = lower === 'chaos' ? 'extreme' : (lower as GameDifficulty);
      }
    }

    const preset = config.difficulties[difficulty];
    let min = preset.min;
    let max = preset.max;

    if (customMin !== undefined && customMax !== undefined) {
      if (customMin >= customMax || customMax - customMin < 5) {
        return {
          success: false,
          error: 'Custom range must have a minimum at least 5 less than maximum (e.g. `10 50`).',
        };
      }
      min = customMin;
      max = customMax;
    }

    const targetNumber = Math.floor(Math.random() * (max - min + 1)) + min;
    const timeoutMs = preset.timeoutSeconds * 1000;
    const now = Date.now();

    const channelId = typeof channel === 'string' ? channel : channel.id;
    const guildId =
      channel && typeof channel === 'object' && 'guild' in channel && (channel as any).guild
        ? (channel as any).guild.id
        : null;

    const game: ActiveGame = {
      channelId,
      guildId,
      hostId,
      difficulty,
      targetNumber,
      min,
      max,
      guessesCount: 0,
      startTime: now,
      timeoutMs,
      timeoutTimer: null,
      expiresAtTimestamp: now + timeoutMs,
      participants: new Set<string>([hostId]),
    };

    // Auto timeout cleanup
    game.timeoutTimer = setTimeout(async () => {
      await this.handleTimeout(channelId, channel);
    }, timeoutMs);

    this.activeGames.set(channelId, game);

    return { success: true, game };
  }

  public async stopGame(
    channelId: string,
    channel: SendableChannel,
    requestedById: string,
    isStaff: boolean
  ): Promise<{ success: boolean; message?: string }> {
    const game = this.activeGames.get(channelId);
    if (!game) {
      return { success: false, message: 'No active game found in this channel to stop.' };
    }

    // Only host or staff can stop the game
    if (requestedById !== game.hostId && !isStaff) {
      return {
        success: false,
        message: `Only the game host (<@${game.hostId}>) or staff can stop this game.`,
      };
    }

    if (game.timeoutTimer) {
      clearTimeout(game.timeoutTimer);
    }
    this.activeGames.delete(channelId);

    try {
      await channel.send(createGameStoppedPayload(game));
    } catch (err) {
      console.error('[Game] Error sending stop payload:', err);
    }

    return { success: true };
  }

  private async handleTimeout(channelId: string, channel: SendableChannel) {
    const game = this.activeGames.get(channelId);
    if (!game) return;

    if (game.timeoutTimer) {
      clearTimeout(game.timeoutTimer);
    }
    this.activeGames.delete(channelId);

    const participantsList = Array.from(game.participants);
    storage.recordGameResult(null, participantsList, Date.now() - game.startTime);

    try {
      await channel.send(createGameTimeoutPayload(game));
    } catch (err) {
      console.error('[Game] Error sending timeout payload:', err);
    }
  }

  /**
   * Evaluates a player's number guess.
   * Responds immediately:
   * - 'Higher.' if guess < targetNumber
   * - 'Lower.' if guess > targetNumber
   * - 'Correct. <@winnerId> won!' if guess === targetNumber (mentions winner)
   *
   * Fast, non-blocking, handles concurrent guesses safely.
   */
  public async processGuess(
    message: Message,
    guess: number
  ): Promise<boolean> {
    const channelId = message.channel.id;
    const userId = message.author.id;

    const game = this.activeGames.get(channelId);
    if (!game) {
      return false;
    }

    // When someone sends a number which is not in range, the bot should NOT reply
    if (guess < game.min || guess > game.max) {
      return false;
    }

    game.participants.add(userId);
    game.guessesCount += 1;
    game.lastGuess = guess;

    // Check if correct (win condition)
    if (guess === game.targetNumber) {
      if (game.timeoutTimer) {
        clearTimeout(game.timeoutTimer);
      }
      this.activeGames.delete(channelId);

      const elapsedMs = Date.now() - game.startTime;
      const participantsList = Array.from(game.participants);
      storage.recordGameResult(userId, participantsList, elapsedMs);

      try {
        await message.reply(createGuessResponse('Correct.', userId));
      } catch (err: any) {
        console.error('[Game] Failed to reply with win message:', err);
        if (err?.rawError) {
          console.error('[Game] rawError:', JSON.stringify(err.rawError));
        }
      }
      return true;
    }

    // Directional hint: Higher or Lower
    const responseText = guess < game.targetNumber ? 'Higher.' : 'Lower.';
    try {
      await message.reply(createGuessResponse(responseText));
    } catch (err) {
      console.error('[Game] Failed to reply with guess direction:', err);
    }

    return true;
  }
}

export const gameManager = new GameManager();
