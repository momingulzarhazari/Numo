import { startBot, getDiscordClient, applyBotPresence } from './client';
import { storage } from './storage';
import { gameManager } from './game';
import { config } from './config';

export { startBot, getDiscordClient, applyBotPresence, storage, gameManager, config };

// If executed directly (e.g. `node bot/index.ts` or `tsx bot/index.ts` or `npm run bot`):
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('bot/index.ts') ||
    process.argv[1].endsWith('bot/index.js') ||
    process.argv[1].endsWith('bot/index.cjs'));

if (isDirectRun || process.env.BOT_ONLY === 'true') {
  console.log('[Numo Bot] Starting standalone Discord bot...');
  startBot().catch((err) => {
    console.error('[Numo Bot] Fatal startup error:', err);
    process.exit(1);
  });
}
