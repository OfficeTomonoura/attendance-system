import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// CSV基本列のデフォルト設定
const DEFAULT_CSV_BASE_COLUMNS = {
  employeeCode: { enabled: true, label: 'スタッフコード' },
  name:         { enabled: true, label: '氏名' },
  targetMonth:  { enabled: true, label: '対象年月' },
};

const CSV_BASE_COLUMNS_KEY = 'csv_base_columns';

// CSV基本列設定の取得
router.get('/csv-base-columns', async (req: Request, res: Response) => {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: CSV_BASE_COLUMNS_KEY }
    });

    if (!setting) {
      // 設定がなければデフォルト値を返す
      return res.json(DEFAULT_CSV_BASE_COLUMNS);
    }

    const parsed = JSON.parse(setting.value);
    // デフォルトとマージして欠損キーを補完
    const merged = { ...DEFAULT_CSV_BASE_COLUMNS, ...parsed };
    res.json(merged);
  } catch (error) {
    console.error('Error fetching csv base columns setting:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// CSV基本列設定の保存
router.put('/csv-base-columns', async (req: Request, res: Response) => {
  try {
    const { employeeCode, name, targetMonth } = req.body;

    const value = JSON.stringify({
      employeeCode: {
        enabled: employeeCode?.enabled !== false,
        label: employeeCode?.label?.trim() || 'スタッフコード',
      },
      name: {
        enabled: name?.enabled !== false,
        label: name?.label?.trim() || '氏名',
      },
      targetMonth: {
        enabled: targetMonth?.enabled !== false,
        label: targetMonth?.label?.trim() || '対象年月',
      },
    });

    await prisma.systemSetting.upsert({
      where: { key: CSV_BASE_COLUMNS_KEY },
      update: { value },
      create: { key: CSV_BASE_COLUMNS_KEY, value },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving csv base columns setting:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
