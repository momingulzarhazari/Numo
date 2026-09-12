import dotenv from 'dotenv';
import { GameDifficulty } from './types';

dotenv.config();

export const config = {
  token: process.env.DISCORD_TOKEN || '',
  clientId: process.env.DISCORD_CLIENT_ID || '',
  ownerId: process.env.OWNER_ID || '',
  defaultPrefix: '!',
  trialDurationDays: 7,
  difficulties: {
    easy: {
      name: 'Easy',
      min: 1,
      max: 50,
      timeoutSeconds: 60,
    },
    normal: {
      name: 'Normal',
      min: 1,
      max: 100,
      timeoutSeconds: 45,
    },
    hard: {
      name: 'Hard',
      min: 1,
      max: 500,
      timeoutSeconds: 30,
    },
    extreme: {
      name: 'Extreme',
      min: 1,
      max: 1000,
      timeoutSeconds: 20,
    },
  } as Record<GameDifficulty, {
    name: string;
    min: number;
    max: number;
    timeoutSeconds: number;
  }>,
};
