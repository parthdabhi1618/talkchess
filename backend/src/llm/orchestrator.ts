import { Ollama } from 'ollama';
import { enginePool } from '../engine/enginePool.js';
import { extractFeatures, FeatureInput } from '../lib/featureExtractor.js';
import { prisma } from '../db.js';

const ollama = new Ollama({
  host: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
});

const MODEL = process.env.OLLAMA_MODEL ?? 'qwen3.5:4b';

// ============================================================
// HARD GUARDRAIL SYSTEM PROMPT
// The LLM may NEVER state a chess fact without a tool result
// from this turn backing it.
// ============================================================
const SYSTEM_PROMPT = `You are TalkChess Coach, an AI chess coach built on top of Stockfish — the world's strongest chess engine.

CRITICAL RULES (non-negotiable):
1. You MUST call a tool BEFORE making any claim about:
   - Move evaluations ("this move loses X pawns")
   - Best moves or alternatives ("Bd6 was better")
   - Position assessments ("White is winning")
   - Tactical motifs or reasons ("this weakens your king")
2. You are a NARRATOR of Stockfish's output, not an independent chess reasoner.
3. Never invent chess analysis. If you haven't called a tool this turn, you cannot speak about chess truth.
4. You CAN greet, ask questions, encourage, or explain concepts without tool calls.
5. When you receive tool results, explain them clearly in plain language a club player can understand.
6. Keep explanations concise (2-4 sentences unless asked for more).
7. In sandbox mode, you may use propose_board_action to demonstrate lines on the board.

You have access to these tools:
- call_engine: Analyze any chess position with Stockfish
- get_features: Get structured explanation of why a move was classified as it was  
- propose_board_action: Propose moves on the board (sandbox mode only)`;

// Tool definitions for Ollama
const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'call_engine',
      description: 'Analyze a chess position using Stockfish. Returns eval, best moves, and principal variations. You MUST call this before stating any chess eval or best move.',
      parameters: {
        type: 'object',
        properties: {
          fen: { type: 'string', description: 'FEN string of the position to analyze' },
          depth: { type: 'number', description: 'Search depth (default 18, max 25)' },
          multiPv: { type: 'number', description: 'Number of best lines to return (default 3)' },
        },
        required: ['fen'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_features',
      description: 'Get structured explanation of a specific move: classification (best/good/inaccuracy/mistake/blunder), eval delta, and reason tags. Call this to explain why a move was rated the way it was.',
      parameters: {
        type: 'object',
        properties: {
          fen: { type: 'string', description: 'FEN before the move' },
          moveSan: { type: 'string', description: 'Move in SAN notation (e.g. Nf3, exd5)' },
          moveUci: { type: 'string', description: 'Move in UCI notation (e.g. g1f3, e4d5)' },
          evalBefore: { type: 'number', description: 'Engine eval before move (white perspective)' },
          evalAfter: { type: 'number', description: 'Engine eval after move (white perspective)' },
        },
        required: ['fen', 'moveSan', 'moveUci'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'propose_board_action',
      description: 'Propose a move on the board to demonstrate a line (sandbox mode only). The board must be in sandbox state for this to work.',
      parameters: {
        type: 'object',
        properties: {
          moveUci: { type: 'string', description: 'UCI move to play on board (e.g. e2e4)' },
          explanation: { type: 'string', description: 'Brief explanation of why you are making this move' },
        },
        required: ['moveUci', 'explanation'],
      },
    },
  },
];

export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: any[];
}

export interface OrchestratorContext {
  gameId: string;
  sessionId: string;
  currentFen: string;
  moveIndex: number;
  boardState: 'live' | 'sandbox' | 'idle';
  history: ChatMessage[];
}

export interface StreamEvent {
  type: 'token' | 'tool_call' | 'tool_result' | 'done' | 'error' | 'board_action';
  data: any;
}

/**
 * Runs the LLM orchestration loop.
 * Calls tools as needed, streams tokens back via the onEvent callback.
 * Enforces: no chess claims without tool results.
 */
export async function runOrchestrator(
  userMessage: string,
  ctx: OrchestratorContext,
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  const messages: any[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...ctx.history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const allToolCalls: any[] = [];
  let iterations = 0;
  const MAX_TOOL_ITERATIONS = 5;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    const response = await ollama.chat({
      model: MODEL,
      messages,
      tools: TOOLS,
      stream: false, // We'll handle streaming after tool calls resolve
      options: {
        temperature: 0.3,
        num_ctx: 8192,
      },
    });

    const assistantMsg = response.message;

    if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
      // Execute tool calls
      messages.push(assistantMsg);

      for (const toolCall of assistantMsg.tool_calls) {
        const fnName = toolCall.function.name;
        const fnArgs = toolCall.function.arguments as any;

        onEvent({ type: 'tool_call', data: { name: fnName, args: fnArgs } });
        allToolCalls.push({ name: fnName, args: fnArgs });

        let toolResult: any;
        try {
          toolResult = await executeToolCall(fnName, fnArgs, ctx, onEvent);
        } catch (err) {
          toolResult = { error: String(err) };
        }

        onEvent({ type: 'tool_result', data: { name: fnName, result: toolResult } });

        messages.push({
          role: 'tool',
          content: JSON.stringify(toolResult),
        });
      }
      // Continue loop to let model respond with the tool results
    } else {
      // Final text response — stream it token-by-token simulation
      const content = assistantMsg.content ?? '';
      
      // Simulate streaming by chunking the content
      const words = content.split(' ');
      for (const word of words) {
        onEvent({ type: 'token', data: word + ' ' });
        await sleep(20); // small delay for streaming effect
      }

      onEvent({ type: 'done', data: { content, toolCalls: allToolCalls } });
      return;
    }
  }

  onEvent({ type: 'error', data: 'Max tool call iterations reached' });
}

async function executeToolCall(
  name: string,
  args: any,
  ctx: OrchestratorContext,
  onEvent: (event: StreamEvent) => void,
): Promise<any> {
  switch (name) {
    case 'call_engine': {
      const result = await enginePool.analyze({
        fen: args.fen,
        depth: Math.min(args.depth ?? 18, 25),
        multiPv: Math.min(args.multiPv ?? 3, 5),
      });
      return {
        fen: result.fen,
        bestMove: result.bestMove,
        eval: result.pvLines[0]?.eval ?? 0,
        pvLines: result.pvLines.map(l => ({
          rank: l.rank,
          eval: l.eval,
          moves: l.moves.slice(0, 5),
          mateIn: l.mateIn,
        })),
        depth: result.depth,
        mateScore: result.mateScore,
      };
    }

    case 'get_features': {
      // Need eval before/after — if not provided, analyze
      let evalBefore = args.evalBefore;
      let evalAfter = args.evalAfter;
      let pvLines: any[] = [];

      if (evalBefore === undefined) {
        const beforeResult = await enginePool.analyze({ fen: args.fen, depth: 15, multiPv: 3 });
        evalBefore = beforeResult.pvLines[0]?.eval ?? 0;
        pvLines = beforeResult.pvLines;
      }

      if (evalAfter === undefined && args.fen) {
        try {
          const { Chess } = await import('chess.js');
          const chess = new Chess(args.fen);
          chess.move(args.moveSan);
          const afterResult = await enginePool.analyze({ fen: chess.fen(), depth: 15, multiPv: 1 });
          evalAfter = afterResult.pvLines[0]?.eval ?? 0;
          // Negate because side flipped
          evalAfter = -evalAfter;
        } catch {
          evalAfter = evalBefore;
        }
      }

      const featureInput: FeatureInput = {
        fen: args.fen,
        moveSan: args.moveSan,
        moveUci: args.moveUci ?? args.moveSan,
        evalBefore: evalBefore ?? 0,
        evalAfter: evalAfter ?? 0,
        pvLines,
      };

      return extractFeatures(featureInput);
    }

    case 'propose_board_action': {
      if (ctx.boardState !== 'sandbox') {
        return { error: 'Board is not in sandbox mode. Cannot propose moves in live game without permission.' };
      }
      onEvent({
        type: 'board_action',
        data: { moveUci: args.moveUci, explanation: args.explanation },
      });
      return { success: true, moveUci: args.moveUci, applied: true };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
