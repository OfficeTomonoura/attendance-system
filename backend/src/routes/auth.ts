import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-attendance';

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { loginId, password } = req.body;

    if (!loginId || !password) {
      return res.status(400).json({ error: 'ログインIDとパスワードは必須です' });
    }

    const user = await prisma.user.findUnique({
      where: { loginId }
    });

    if (!user) {
      return res.status(401).json({ error: 'ログインIDまたはパスワードが間違っています' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'ログインIDまたはパスワードが間違っています' });
    }

    const token = jwt.sign(
      { id: user.id, loginId: user.loginId, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        loginId: user.loginId,
        role: user.role,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

export default router;
