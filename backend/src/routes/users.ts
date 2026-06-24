import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

// すべてのルートで管理者権限を要求
router.use(authenticateToken);
router.use(requireAdmin);

// ユーザー一覧取得
router.get('/', async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        loginId: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ユーザー作成
router.post('/', async (req: Request, res: Response) => {
  try {
    const { loginId, password, name, role } = req.body;
    
    if (!loginId || !password || !name) {
      return res.status(400).json({ error: '必須項目が不足しています' });
    }

    const existing = await prisma.user.findUnique({ where: { loginId } });
    if (existing) {
      return res.status(400).json({ error: 'このログインIDは既に使用されています' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        loginId,
        passwordHash,
        name,
        role: role || 'GENERAL'
      },
      select: { id: true, loginId: true, name: true, role: true }
    });

    res.json(user);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ユーザー更新
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { loginId, password, name, role } = req.body;

    const data: any = {};
    if (loginId) data.loginId = loginId;
    if (name) data.name = name;
    if (role) data.role = role;
    if (password) {
      data.passwordHash = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, loginId: true, name: true, role: true }
    });

    res.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ユーザー削除
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    
    // 自分自身を削除できないようにする保護（フロントエンドのreq.userは後ほど必要）
    if ((req as any).user?.id === id) {
      return res.status(400).json({ error: '自分自身のアカウントは削除できません' });
    }

    await prisma.user.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
