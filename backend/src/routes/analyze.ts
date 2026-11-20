import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { enginePool } from '../engine/enginePool.js';

const router = Router();

const AnalyzeSchema = z.object({
  fen: z.string().min(10),
  depth: z.number().int().min(1).max(30).optional().default(18),
  multiPv: z.number().int().min(1).max(5).optional().default(3),
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const input = AnalyzeSchema.parse(req.body);
    const result = await enginePool.analyze({
      fen: input.fen,
      depth: input.depth,
      multiPv: input.multiPv,
    });
    res.json(result);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input', details: err.errors });
    } else {
      console.error('Analyze error:', err);
      res.status(500).json({ error: 'Engine analysis failed', message: err.message });
    }
  }
});

export default router;
