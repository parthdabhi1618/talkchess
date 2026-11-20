import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { Chess } from 'chess.js';
import { enginePool } from '../engine/enginePool.js';
import { evalDeltaToColor, classifyMove } from '../lib/evalColor.js';
import { extractFeatures } from '../lib/featureExtractor.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// POST /api/games — create a new game
router.post('/', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const game = await prisma.game.create({
      data: {
        userId,
        moves: '[]',
        fens: JSON.stringify(['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1']),
        evals: '[]',
        pvPerMove: '[]',
      },
    });

    const session = await prisma.session.create({
      data: {
        gameId: game.id,
        userId,
      },
    });

    res.json({ game, session });
  } catch (err: any) {
    console.error('Create game error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/games — list games for user
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId query param required' });

    const games = await prisma.game.findMany({
      where: { userId: String(userId) },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, result: true, status: true, createdAt: true,
        moves: true, evals: true,
      },
    });
    res.json(games);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/games/:id — get full game state
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const game = await prisma.game.findUnique({
      where: { id: req.params.id },
      include: { sessions: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!game) return res.status(404).json({ error: 'Game not found' });
    res.json({
      ...game,
      moves: JSON.parse(game.moves),
      fens: JSON.parse(game.fens),
      evals: JSON.parse(game.evals),
      pvPerMove: JSON.parse(game.pvPerMove),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/games/:id/move — make a move (user or engine)
const MoveSchema = z.object({
  moveSan: z.string().min(1),
  moveUci: z.string().optional(),
  playerColor: z.enum(['white', 'black']).default('white'),
});

router.post('/:id/move', async (req: Request, res: Response) => {
  try {
    const input = MoveSchema.parse(req.body);
    const game = await prisma.game.findUnique({ where: { id: req.params.id } });
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (game.status === 'finished') return res.status(400).json({ error: 'Game is finished' });

    const moves: string[] = JSON.parse(game.moves);
    const fens: string[] = JSON.parse(game.fens);
    const evals: number[] = JSON.parse(game.evals);
    const pvPerMove: any[] = JSON.parse(game.pvPerMove);

    const currentFen = fens[fens.length - 1];
    const chess = new Chess(currentFen);

    // Validate and apply user move
    const userMoveObj = chess.move(input.moveSan);
    if (!userMoveObj) return res.status(400).json({ error: 'Illegal move' });

    const fenAfterUser = chess.fen();

    // Analyze position before user move to get eval_before
    const beforeAnalysis = await enginePool.analyze({ fen: currentFen, depth: 15, multiPv: 3 });
    const evalBefore = beforeAnalysis.pvLines[0]?.eval ?? 0;
    
    // Analyze position after user move
    const afterAnalysis = await enginePool.analyze({ fen: fenAfterUser, depth: 15, multiPv: 3 });
    // Negate because side flipped
    const evalAfter = -(afterAnalysis.pvLines[0]?.eval ?? 0);

    moves.push(userMoveObj.san);
    fens.push(fenAfterUser);
    evals.push(evalAfter);
    pvPerMove.push(beforeAnalysis.pvLines);

    // Check game over
    let result: string | null = null;
    if (chess.isCheckmate()) {
      result = chess.turn() === 'w' ? '0-1' : '1-0';
    } else if (chess.isDraw()) {
      result = '1/2-1/2';
    }

    let engineMove: { san: string; uci: string; eval: number } | null = null;

    if (!result) {
      // Engine reply
      const engineAnalysis = await enginePool.analyze({ fen: fenAfterUser, depth: 15, multiPv: 1 });
      const engineMoveUci = engineAnalysis.bestMove;

      if (engineMoveUci && engineMoveUci !== '(none)') {
        const from = engineMoveUci.slice(0, 2);
        const to = engineMoveUci.slice(2, 4);
        const promotion = engineMoveUci.length === 5 ? engineMoveUci[4] : undefined;
        const engineMoveObj = chess.move({ from, to, promotion });

        if (engineMoveObj) {
          const fenAfterEngine = chess.fen();
          const engineEvalAfter = -(engineAnalysis.pvLines[0]?.eval ?? 0);

          moves.push(engineMoveObj.san);
          fens.push(fenAfterEngine);
          evals.push(engineEvalAfter);
          pvPerMove.push(engineAnalysis.pvLines);

          engineMove = { san: engineMoveObj.san, uci: engineMoveUci, eval: engineEvalAfter };

          if (chess.isCheckmate()) result = chess.turn() === 'w' ? '0-1' : '1-0';
          else if (chess.isDraw()) result = '1/2-1/2';
        }
      }
    }

    await prisma.game.update({
      where: { id: game.id },
      data: {
        moves: JSON.stringify(moves),
        fens: JSON.stringify(fens),
        evals: JSON.stringify(evals),
        pvPerMove: JSON.stringify(pvPerMove),
        result,
        status: result ? 'finished' : 'active',
      },
    });

    // Update user stats
    try {
      const sign = input.playerColor === 'white' ? 1 : -1;
      const evalDelta = (evalAfter - evalBefore) * sign;
      const classification = classifyMove(evalDelta);
      
      const statsField = classification === 'best' ? 'bestMoves'
        : classification === 'good' ? 'goodMoves'
        : classification === 'inaccuracy' ? 'inaccuracies'
        : classification === 'mistake' ? 'mistakes'
        : 'blunders';

      const userId = game.userId;
      await prisma.userStats.upsert({
        where: { userId },
        create: {
          userId,
          [statsField]: 1,
        },
        update: {
          [statsField]: { increment: 1 },
        },
      });
    } catch { /* stats update failure is non-fatal */ }

    res.json({
      userMove: { san: userMoveObj.san, uci: input.moveUci ?? '', evalBefore, evalAfter },
      engineMove,
      currentFen: chess.fen(),
      moves,
      fens,
      evals,
      result,
      gameOver: !!result,
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: err.errors });
    }
    console.error('Move error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
