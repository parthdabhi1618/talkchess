import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { extractFeatures } from '../lib/featureExtractor.js';
import { enginePool } from '../engine/enginePool.js';
import { Chess } from 'chess.js';

const router = Router();

const FeaturesSchema = z.object({
  fen: z.string().min(10),
  moveSan: z.string().min(1),
  moveUci: z.string().min(4),
  evalBefore: z.number().optional(),
  evalAfter: z.number().optional(),
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const input = FeaturesSchema.parse(req.body);

    let evalBefore = input.evalBefore;
    let evalAfter = input.evalAfter;
    let pvLines: any[] = [];

    // If evals not provided, compute them
    if (evalBefore === undefined) {
      const beforeResult = await enginePool.analyze({ fen: input.fen, depth: 15, multiPv: 3 });
      evalBefore = beforeResult.pvLines[0]?.eval ?? 0;
      pvLines = beforeResult.pvLines;
    }

    if (evalAfter === undefined) {
      const chess = new Chess(input.fen);
      chess.move(input.moveSan);
      const afterResult = await enginePool.analyze({ fen: chess.fen(), depth: 15, multiPv: 1 });
      // Negate: after move, side flipped, so white eval is negated
      evalAfter = -(afterResult.pvLines[0]?.eval ?? 0);
    }

    const features = extractFeatures({
      fen: input.fen,
      moveSan: input.moveSan,
      moveUci: input.moveUci,
      evalBefore,
      evalAfter,
      pvLines,
    });

    res.json(features);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input', details: err.errors });
    } else {
      console.error('Features error:', err);
      res.status(500).json({ error: 'Feature extraction failed', message: err.message });
    }
  }
});

export default router;
