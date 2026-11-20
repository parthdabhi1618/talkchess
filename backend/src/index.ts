import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import analyzeRouter from './routes/analyze.js';
import featuresRouter from './routes/features.js';
import gamesRouter from './routes/games.js';
import authRouter from './routes/auth.js';
import statsRouter from './routes/stats.js';
import { setupChatWebSocket } from './routes/chat.js';
import { prisma } from './db.js';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/features', featuresRouter);
app.use('/api/games', gamesRouter);
app.use('/api/stats', statsRouter);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// HTTP + WebSocket server
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws/chat' });
setupChatWebSocket(wss);

async function main() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected');
  } catch (err) {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  }

  httpServer.listen(PORT, () => {
    console.log(`🚀 TalkChess backend running on http://localhost:${PORT}`);
    console.log(`🔌 WebSocket chat on ws://localhost:${PORT}/ws/chat`);
  });
}

main();
