import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';

const router = Router();

// GET /api/stats?userId=... — get user move quality stats
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const stats = await prisma.userStats.findUnique({
      where: { userId: String(userId) },
    });

    if (!stats) {
      return res.json({ bestMoves: 0, goodMoves: 0, inaccuracies: 0, mistakes: 0, blunders: 0 });
    }

    res.json({
      bestMoves: stats.bestMoves,
      goodMoves: stats.goodMoves,
      inaccuracies: stats.inaccuracies,
      mistakes: stats.mistakes,
      blunders: stats.blunders,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
