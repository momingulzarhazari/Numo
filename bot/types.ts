export type GameDifficulty = 'easy' | 'normal' | 'hard' | 'extreme';

export interface UserStats {
  userId: string;
  gamesPlayed: number;
  wins: number;
  currentStreak: number;
  bestStreak: number;
  fastestTimeMs: number; // milliseconds
}

export interface TrialRecord {
  userId: string;
  claimedAt: number; // epoch ms
  expiresAt: number; // epoch ms
}

export interface BlacklistRecord {
  id: string; // user or guild snowflake ID
  type: 'user' | 'guild';
  reason: string;
  addedAt: number;
  addedBy: string;
}

export interface BotPresenceState {
  activityText: string | null;
  customStatus: string | null; // Text status displayed at top near profile (ActivityType.Custom)
  status: 'online' | 'idle' | 'dnd' | 'invisible';
}

export interface BotStorageData {
  guildIds: string[];
  staffUserIds: string[];
  blacklists: Record<string, BlacklistRecord>;
  permanentNoPrefixUserIds: string[];
  trials: Record<string, TrialRecord>;
  stats: Record<string, UserStats>;
  presence: BotPresenceState;
}

export interface ActiveGame {
  channelId: string;
  guildId: string | null;
  hostId: string;
  difficulty: GameDifficulty;
  targetNumber: number;
  min: number;
  max: number;
  startTime: number; // epoch ms
  timeoutMs: number;
  expiresAtTimestamp: number;
  timeoutTimer: NodeJS.Timeout | null;
  guessesCount: number;
  lastGuess?: number;
  participants: Set<string>;
}
