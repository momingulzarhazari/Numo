import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { startBot } from './bot/client';
import { storage } from './bot/storage';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Health and status API
  app.get('/api/status', (req, res) => {
    const presence = storage.getPresence();
    res.json({
      status: presence.status || 'online',
      bot: 'Numo',
      guilds: storage.getGuildCount(),
      activityText: presence.activityText,
      customStatus: presence.customStatus,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  app.get('/api/leaderboard', (req, res) => {
    const top = storage.getTopLeaderboard(10);
    res.json(top);
  });

  // Vite middleware for development / static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Numo Server] Listening on http://0.0.0.0:${PORT}`);
    // Start Discord Bot instance
    startBot().catch((err) => {
      console.error('[Numo] Failed to initialize bot:', err);
    });
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
