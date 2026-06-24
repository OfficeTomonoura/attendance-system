import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// 従業員一覧取得
router.get('/', async (req: Request, res: Response) => {
  try {
    const { includeDeleted } = req.query;
    const whereClause = includeDeleted === 'true' ? {} : { isDeleted: false };
    
    const employees = await prisma.employee.findMany({
      where: whereClause,
      include: {
        salaryGroup: true,
      },
      orderBy: {
        employeeCode: 'asc',
      },
    });
    res.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 従業員新規登録
router.post('/', async (req: Request, res: Response) => {
  try {
    const { employeeCode, name, salaryGroupId, paidLeaveBalance } = req.body;
    
    // 必須チェック
    if (!employeeCode || !name || !salaryGroupId) {
      return res.status(400).json({ error: '必須項目が不足しています' });
    }

    // 重複チェック
    const existing = await prisma.employee.findUnique({
      where: { employeeCode }
    });
    if (existing) {
      // もし論理削除済みの同一番号がいれば、物理削除するかエラーにする等検討が必要だが、
      // 今回はシンプルに重複エラーとする
      return res.status(400).json({ error: '既に登録されているスタッフコードです' });
    }

    const employee = await prisma.employee.create({
      data: {
        employeeCode,
        name,
        salaryGroupId,
        paidLeaveBalance: paidLeaveBalance !== undefined ? Number(paidLeaveBalance) : 0,
      },
      include: {
        salaryGroup: true,
      }
    });
    res.status(201).json(employee);
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 従業員情報更新
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { employeeCode, name, salaryGroupId, paidLeaveBalance } = req.body;

    // 必須チェック
    if (!employeeCode || !name || !salaryGroupId) {
      return res.status(400).json({ error: '必須項目が不足しています' });
    }

    // 重複チェック (自分以外の同一番号)
    const existing = await prisma.employee.findUnique({
      where: { employeeCode }
    });
    if (existing && existing.id !== id) {
      return res.status(400).json({ error: '既に登録されているスタッフコードです' });
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: {
        employeeCode,
        name,
        salaryGroupId,
        paidLeaveBalance: paidLeaveBalance !== undefined ? Number(paidLeaveBalance) : 0,
      },
      include: {
        salaryGroup: true,
      }
    });
    res.json(employee);
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 従業員削除 (論理削除)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const employee = await prisma.employee.update({
      where: { id },
      data: {
        isDeleted: true,
      },
    });
    res.json({ success: true, message: 'Employee deleted (soft delete)' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 従業員完全削除 (物理削除)
router.delete('/:id/hard', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    // 勤怠データの存在チェック
    const recordsCount = await prisma.attendanceRecord.count({
      where: { employeeId: id }
    });

    if (recordsCount > 0) {
      return res.status(400).json({ error: '勤怠データが存在するため、完全に削除することはできません。' });
    }

    // 存在しなければ物理削除を実行
    await prisma.employee.delete({ where: { id } });

    res.json({ success: true, message: 'Employee hard deleted' });
  } catch (error) {
    console.error('Error hard deleting employee:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 従業員復旧
router.put('/:id/restore', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const employee = await prisma.employee.update({
      where: { id },
      data: {
        isDeleted: false,
      },
    });
    res.json({ success: true, message: 'Employee restored' });
  } catch (error) {
    console.error('Error restoring employee:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
