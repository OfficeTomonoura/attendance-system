import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// 勤怠項目一覧取得
router.get('/', async (req: Request, res: Response) => {
  try {
    const fields = await prisma.attendanceField.findMany({
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'asc' }
      ]
    });
    res.json(fields);
  } catch (error) {
    console.error('Error fetching fields:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 勤怠項目追加
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, fieldType, isCommon, csvEnabled, csvLabel } = req.body;
    if (!name || !fieldType) {
      return res.status(400).json({ error: 'name, fieldType are required' });
    }

    const maxField = await prisma.attendanceField.findFirst({
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true }
    });
    const nextOrder = (maxField?.displayOrder ?? -1) + 1;

    const newField = await prisma.attendanceField.create({
      data: {
        name,
        fieldType,
        isCommon: isCommon || false,
        displayOrder: nextOrder,
        csvEnabled: csvEnabled !== undefined ? csvEnabled : true,
        csvLabel: csvLabel || null
      }
    });
    res.status(201).json(newField);
  } catch (error) {
    console.error('Error creating field:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 勤怠項目更新
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, fieldType, isCommon, csvEnabled, csvLabel } = req.body;
    
    if (!name || !fieldType) {
      return res.status(400).json({ error: 'name, fieldType are required' });
    }

    const updatedField = await prisma.attendanceField.update({
      where: { id },
      data: {
        name,
        fieldType,
        isCommon: isCommon !== undefined ? isCommon : false,
        csvEnabled: csvEnabled !== undefined ? csvEnabled : true,
        csvLabel: csvLabel || null
      }
    });
    res.json(updatedField);
  } catch (error) {
    console.error('Error updating field:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 勤怠項目削除
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    
    // 使用中かどうかのチェック (今回はCascade削除か、使用中は消せないようにする)
    // 今回は強制削除でCascadeされる設定になっている
    await prisma.attendanceField.delete({
      where: { id }
    });
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting field:', error);
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
        prisma.attendanceField.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        })
      )
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering fields:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 勤怠項目に紐づくグループ一覧取得
router.get('/:id/salary-groups', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const mappings = await prisma.salaryGroupField.findMany({
      where: { attendanceFieldId: id }
    });
    res.json(mappings.map(m => m.salaryGroupId));
  } catch (error) {
    console.error('Error fetching field groups:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 勤怠項目のグループ紐付け一括更新
router.put('/:id/salary-groups', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { groupIds } = req.body;
    
    if (!Array.isArray(groupIds)) {
      return res.status(400).json({ error: 'groupIds must be an array' });
    }

    await prisma.$transaction(async (tx) => {
      // 既存の紐付けを削除
      await tx.salaryGroupField.deleteMany({
        where: { attendanceFieldId: id }
      });

      // 新しく紐付けを作成
      for (const groupId of groupIds) {
        await tx.salaryGroupField.create({
          data: {
            attendanceFieldId: id,
            salaryGroupId: groupId,
            required: false,
            displayOrder: 999
          }
        });
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating field groups:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
