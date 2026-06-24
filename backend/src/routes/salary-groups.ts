import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// グループ一覧取得
router.get('/', async (req: Request, res: Response) => {
  try {
    const groups = await prisma.salaryGroup.findMany({
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'asc' }
      ],
    });
    res.json(groups);
  } catch (error) {
    console.error('Error fetching salary groups:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// グループ新規登録
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'グループ名は必須です' });
    }

    const maxGroup = await prisma.salaryGroup.findFirst({
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true }
    });
    const nextOrder = (maxGroup?.displayOrder ?? -1) + 1;

    const group = await prisma.salaryGroup.create({
      data: { name, displayOrder: nextOrder },
    });
    res.status(201).json(group);
  } catch (error) {
    console.error('Error creating salary group:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// グループ編集
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'グループ名は必須です' });
    }

    const group = await prisma.salaryGroup.update({
      where: { id },
      data: { name },
    });
    res.json(group);
  } catch (error) {
    console.error('Error updating salary group:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// グループ削除
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    // 使用中のグループかチェック
    const employeesCount = await prisma.employee.count({
      where: { salaryGroupId: id },
    });

    if (employeesCount > 0) {
      return res.status(400).json({ error: 'このグループは従業員に使用されているため削除できません' });
    }

    await prisma.salaryGroup.delete({
      where: { id },
    });
    
    res.json({ success: true, message: 'Salary group deleted' });
  } catch (error) {
    console.error('Error deleting salary group:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 表示順の更新
router.put('/reorder/all', async (req: Request, res: Response) => {
  try {
    const { items } = req.body;
    // items: Array<{ id: string, displayOrder: number }>

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items must be an array' });
    }

    await prisma.$transaction(
      items.map((item) =>
        prisma.salaryGroup.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        })
      )
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering salary groups:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
