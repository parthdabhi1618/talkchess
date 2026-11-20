import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';
import { createHash } from 'crypto';

const router = Router();

function hashPassword(password: string): string {
  return createHash('sha256').update(password + 'talkchess_salt').digest('hex');
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) return res.status(409).json({ error: 'Username already taken' });
    
    const user = await prisma.user.create({
      data: { username, passwordHash: hashPassword(password) },
      select: { id: true, username: true, createdAt: true },
    });
    
    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || user.passwordHash !== hashPassword(password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Simple session token (in production, use JWT/sessions)
    const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
    
    res.json({
      user: { id: user.id, username: user.username },
      token,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
