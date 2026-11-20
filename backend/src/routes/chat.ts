import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { prisma } from '../db.js';
import { runOrchestrator, OrchestratorContext, ChatMessage } from '../llm/orchestrator.js';

export function setupChatWebSocket(wss: WebSocketServer) {
  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? '', `http://localhost`);
    const sessionId = url.searchParams.get('sessionId');
    const gameId = url.searchParams.get('gameId');
    const userId = url.searchParams.get('userId');

    if (!sessionId || !gameId || !userId) {
      ws.send(JSON.stringify({ type: 'error', data: 'Missing sessionId, gameId, or userId' }));
      ws.close();
      return;
    }

    console.log(`[Chat WS] Connected: session=${sessionId} game=${gameId}`);

    ws.on('message', async (rawData) => {
      try {
        const msg = JSON.parse(rawData.toString());
        
        if (msg.type === 'chat') {
          const userMessage: string = msg.content;
          
          // Load game and session
          const [game, session] = await Promise.all([
            prisma.game.findUnique({ where: { id: gameId } }),
            prisma.session.findUnique({ where: { id: sessionId } }),
          ]);

          if (!game || !session) {
            ws.send(JSON.stringify({ type: 'error', data: 'Game or session not found' }));
            return;
          }

          const fens: string[] = JSON.parse(game.fens);
          const currentFen = fens[fens.length - 1];

          // Load chat history
          const dbMessages = await prisma.chatMessage.findMany({
            where: { sessionId },
            orderBy: { createdAt: 'asc' },
            take: 20, // Last 20 messages for context window
          });

          const history: ChatMessage[] = dbMessages.map(m => ({
            role: m.role as 'user' | 'assistant' | 'tool',
            content: m.content,
            toolCalls: JSON.parse(m.toolCalls),
          }));

          // Save user message
          await prisma.chatMessage.create({
            data: {
              sessionId,
              gameId,
              moveIndex: JSON.parse(game.moves).length - 1,
              role: 'user',
              content: userMessage,
              toolCalls: '[]',
            },
          });

          const ctx: OrchestratorContext = {
            gameId,
            sessionId,
            currentFen,
            moveIndex: JSON.parse(game.moves).length - 1,
            boardState: session.boardState as 'live' | 'sandbox' | 'idle',
            history,
          };

          let finalContent = '';
          let finalToolCalls: any[] = [];

          // Run orchestrator and stream events to client
          await runOrchestrator(userMessage, ctx, (event) => {
            ws.send(JSON.stringify(event));
            if (event.type === 'done') {
              finalContent = event.data.content;
              finalToolCalls = event.data.toolCalls;
            }
          });

          // Save assistant message
          await prisma.chatMessage.create({
            data: {
              sessionId,
              gameId,
              moveIndex: JSON.parse(game.moves).length - 1,
              role: 'assistant',
              content: finalContent,
              toolCalls: JSON.stringify(finalToolCalls),
            },
          });

        } else if (msg.type === 'set_board_state') {
          // Update session board state
          await prisma.session.update({
            where: { id: sessionId },
            data: {
              boardState: msg.boardState,
              sandboxFen: msg.sandboxFen ?? null,
            },
          });
          ws.send(JSON.stringify({ type: 'board_state_updated', data: msg.boardState }));
        }
      } catch (err: any) {
        console.error('[Chat WS] Error:', err);
        ws.send(JSON.stringify({ type: 'error', data: err.message }));
      }
    });

    ws.on('close', () => {
      console.log(`[Chat WS] Disconnected: session=${sessionId}`);
    });
  });
}
