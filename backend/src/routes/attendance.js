"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// 対象月の従業員一覧と勤怠データを取得
router.get('/', async (req, res) => {
    try {
        const { month } = req.query;
        if (!month || typeof month !== 'string') {
            return res.status(400).json({ error: 'month (YYYY-MM) は必須です' });
        }
        // 対象月の勤怠データを取得
        const records = await prisma.attendanceRecord.findMany({
            where: {
                targetMonth: month,
            },
            include: {
                recordValues: true
            }
        });
        const recordEmployeeIds = records.map(r => r.employeeId);
        // 全従業員を取得（論理削除されていない、または対象月にレコードが存在する）
        const employees = await prisma.employee.findMany({
            where: {
                OR: [
                    { isDeleted: false },
                    { id: { in: recordEmployeeIds } }
                ]
            },
            include: {
                salaryGroup: true
            },
            orderBy: { employeeCode: 'asc' }
        });
        // 対象月のステータスを取得
        let monthlyStatus = await prisma.monthlyStatus.findUnique({
            where: { targetMonth: month }
        });
        // もしステータスが存在しなければ初期状態(draft)として扱う
        if (!monthlyStatus) {
            monthlyStatus = {
                id: '',
                targetMonth: month,
                status: 'draft',
                submittedBy: null,
                submittedAt: null,
                approvedBy: null,
                approvedAt: null,
                createdAt: new Date(),
                updatedAt: new Date()
            };
        }
        // 従業員ごとにマッピングして返却
        const employeeData = employees.map(emp => {
            const record = records.find(r => r.employeeId === emp.id);
            // 動的フィールドの値をキーバリューでマップする
            const values = {};
            if (record && record.recordValues) {
                record.recordValues.forEach(rv => {
                    values[rv.attendanceFieldId] = rv.value;
                });
            }
            return {
                employee: emp,
                recordId: record?.id || null,
                snapshotSalaryGroupId: record?.snapshotSalaryGroupId || null,
                values: values,
            };
        });
        res.json({
            monthStatus: monthlyStatus.status,
            submittedBy: monthlyStatus.submittedBy,
            submittedAt: monthlyStatus.submittedAt,
            approvedBy: monthlyStatus.approvedBy,
            approvedAt: monthlyStatus.approvedAt,
            data: employeeData
        });
    }
    catch (error) {
        console.error('Error fetching attendance:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// 入力済み月別一覧取得
router.get('/list', async (req, res) => {
    try {
        const { month } = req.query;
        if (!month || typeof month !== 'string') {
            return res.status(400).json({ error: 'month (YYYY-MM) は必須です' });
        }
        const records = await prisma.attendanceRecord.findMany({
            where: {
                targetMonth: month,
            },
            include: {
                employee: true,
                recordValues: {
                    include: {
                        attendanceField: true
                    }
                }
            },
            orderBy: {
                employee: {
                    employeeCode: 'asc'
                }
            }
        });
        // 全フィールド定義を取得
        const fields = await prisma.attendanceField.findMany({
            orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }]
        });
        // 全グループ別フィールド紐付けを取得（どのグループがどのフィールドを使うか）
        const salaryGroupFields = await prisma.salaryGroupField.findMany();
        // salaryGroupId -> Set<attendanceFieldId> のマップを構築
        const groupFieldMap = new Map();
        salaryGroupFields.forEach(sgf => {
            if (!groupFieldMap.has(sgf.salaryGroupId)) {
                groupFieldMap.set(sgf.salaryGroupId, new Set());
            }
            groupFieldMap.get(sgf.salaryGroupId).add(sgf.attendanceFieldId);
        });
        // 対象月のステータスを取得
        let monthlyStatus = await prisma.monthlyStatus.findUnique({
            where: { targetMonth: month }
        });
        const result = records.map(r => {
            const values = {};
            const valueNames = {};
            const rvMap = {};
            r.recordValues.forEach(rv => {
                rvMap[rv.attendanceFieldId] = rv.value;
            });
            // この従業員の給与規定グループに紐づくフィールドIDセット
            const groupId = r.snapshotSalaryGroupId || r.employee.salaryGroupId;
            const linkedFieldIds = groupFieldMap.get(groupId) || new Set();
            fields.forEach(f => {
                // 共通項目か、または給与規定グループに紐づいている項目のみ値を設定
                const isApplicable = f.isCommon || linkedFieldIds.has(f.id);
                if (!isApplicable) {
                    // 紐づいていない項目はnullを返す（表示側で「-」を表示）
                    values[f.id] = null;
                    valueNames[f.name] = null;
                    return;
                }
                const val = rvMap[f.id];
                let finalVal = val;
                if (val === undefined || val === null || val === '') {
                    // 紐づいている項目のデフォルト値
                    if (f.fieldType === 'number')
                        finalVal = '0';
                    else if (f.fieldType === 'time')
                        finalVal = '00:00';
                    else
                        finalVal = '';
                }
                values[f.id] = finalVal;
                valueNames[f.name] = finalVal;
            });
            return {
                employeeCode: r.employee.employeeCode,
                name: r.employee.name,
                salaryGroupId: groupId, // フロントエンドが参照できるようにグループIDも返す
                values: values,
                valueNames: valueNames, // フィールド名ベースの値マップ
                updatedAt: r.updatedAt,
            };
        });
        res.json({
            monthStatus: monthlyStatus?.status || 'draft',
            data: result
        });
    }
    catch (error) {
        console.error('Error fetching attendance list:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// CSV出力
router.get('/export', async (req, res) => {
    try {
        const { month } = req.query;
        if (!month || typeof month !== 'string') {
            return res.status(400).json({ error: 'month (YYYY-MM) は必須です' });
        }
        // CSV基本列設定を取得（未設定の場合はデフォルト）
        const DEFAULT_BASE = {
            employeeCode: { enabled: true, label: 'スタッフコード' },
            name: { enabled: true, label: '氏名' },
            targetMonth: { enabled: true, label: '対象年月' },
        };
        const baseColSetting = await prisma.systemSetting.findUnique({
            where: { key: 'csv_base_columns' }
        });
        const baseCols = baseColSetting
            ? { ...DEFAULT_BASE, ...JSON.parse(baseColSetting.value) }
            : DEFAULT_BASE;
        // csvEnabled=true のフィールドのみ取得してヘッダーを構築
        const fields = await prisma.attendanceField.findMany({
            where: { csvEnabled: true },
            orderBy: { displayOrder: 'asc' }
        });
        // 全グループ別フィールド紐付けを取得
        const salaryGroupFields = await prisma.salaryGroupField.findMany();
        const groupFieldMap = new Map();
        salaryGroupFields.forEach(sgf => {
            if (!groupFieldMap.has(sgf.salaryGroupId)) {
                groupFieldMap.set(sgf.salaryGroupId, new Set());
            }
            groupFieldMap.get(sgf.salaryGroupId).add(sgf.attendanceFieldId);
        });
        const records = await prisma.attendanceRecord.findMany({
            where: { targetMonth: month },
            include: {
                employee: true,
                recordValues: {
                    include: { attendanceField: true }
                }
            },
            orderBy: { employee: { employeeCode: 'asc' } }
        });
        const escapeCsv = (str) => `"${String(str ?? '').replace(/"/g, '""')}"`;
        // 有効な基本列のみヘッダーに追加
        const baseHeaders = [];
        if (baseCols.employeeCode.enabled)
            baseHeaders.push(baseCols.employeeCode.label);
        if (baseCols.name.enabled)
            baseHeaders.push(baseCols.name.label);
        if (baseCols.targetMonth.enabled)
            baseHeaders.push(baseCols.targetMonth.label);
        // csvLabel が設定されていればそれを、なければ name をヘッダーとして使用
        const fieldHeaders = fields.map(f => f.csvLabel?.trim() || f.name);
        const headers = [...baseHeaders, ...fieldHeaders].map(escapeCsv);
        const rows = records.map(r => {
            const valMap = {};
            r.recordValues.forEach(rv => {
                valMap[rv.attendanceFieldId] = rv.value ?? '';
            });
            // この従業員の給与規定グループに紐づくフィールドIDセット
            const groupId = r.snapshotSalaryGroupId || r.employee.salaryGroupId;
            const linkedFieldIds = groupFieldMap.get(groupId) || new Set();
            // 有効な基本列の値のみ行に追加
            const baseValues = [];
            if (baseCols.employeeCode.enabled)
                baseValues.push(escapeCsv(r.employee.employeeCode));
            if (baseCols.name.enabled)
                baseValues.push(escapeCsv(r.employee.name));
            if (baseCols.targetMonth.enabled)
                baseValues.push(escapeCsv(r.targetMonth));
            const fieldValues = fields.map(f => {
                // 共通項目でも、グループに紐づいている項目でもなければ空文字
                const isApplicable = f.isCommon || linkedFieldIds.has(f.id);
                if (!isApplicable)
                    return '';
                const val = valMap[f.id];
                if (val !== undefined && val !== null && val !== '') {
                    return val;
                }
                // 紐づいている項目の未入力デフォルト値
                if (f.fieldType === 'number')
                    return '0';
                if (f.fieldType === 'time')
                    return '00:00';
                return '';
            });
            return [...baseValues, ...fieldValues.map(escapeCsv)].join(',');
        });
        const csvContent = [headers.join(','), ...rows].join('\r\n');
        const bom = '\uFEFF';
        const csvWithBom = bom + csvContent;
        const filename = `attendance_${month.replace('-', '_')}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csvWithBom);
    }
    catch (error) {
        console.error('Error exporting CSV:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// 勤怠データの一括保存
router.post('/save', async (req, res) => {
    try {
        const { month, data } = req.body;
        // data は [{ employeeId: string, values: { [fieldId: string]: string | null } }] の想定
        if (!month || !Array.isArray(data)) {
            return res.status(400).json({ error: 'month と data(配列) は必須です' });
        }
        const employeeIds = data.map(item => item.employeeId);
        // 1. 従業員情報を一括取得してMap化
        const employees = await prisma.employee.findMany({
            where: { id: { in: employeeIds } }
        });
        const employeeMap = new Map(employees.map(e => [e.id, e]));
        // 2. 月のステータスを取得
        const monthlyStatus = await prisma.monthlyStatus.findUnique({
            where: { targetMonth: month }
        });
        const isApproved = monthlyStatus?.status === 'approved';
        if (isApproved) {
            return res.status(400).json({ error: '承認済みのデータは保存できません' });
        }
        // 3. 既存の勤怠レコードを一括取得してMap化
        const records = await prisma.attendanceRecord.findMany({
            where: {
                targetMonth: month,
                employeeId: { in: employeeIds }
            },
            include: {
                recordValues: true
            }
        });
        const recordMap = new Map(records.map(r => [r.employeeId, r]));
        // 4. 不足している勤怠レコードを特定して一括作成
        const missingEmployeeIds = employeeIds.filter(empId => !recordMap.has(empId));
        if (missingEmployeeIds.length > 0) {
            await Promise.all(missingEmployeeIds.map(async (empId) => {
                const emp = employeeMap.get(empId);
                const newRec = await prisma.attendanceRecord.create({
                    data: {
                        employeeId: empId,
                        targetMonth: month,
                        snapshotSalaryGroupId: emp?.salaryGroupId || null
                    },
                    include: {
                        recordValues: true
                    }
                });
                recordMap.set(empId, newRec);
            }));
        }
        const recordUpdates = [];
        const auditLogCreates = [];
        const valueUpserts = [];
        // 5. データの比較と更新クエリの蓄積
        for (const item of data) {
            const { employeeId, values } = item;
            const record = recordMap.get(employeeId);
            if (!record)
                continue;
            const emp = employeeMap.get(employeeId);
            const currentSalaryGroupId = emp?.salaryGroupId || null;
            // 給与グループが変更されている場合はスナップショットを更新
            if (record.snapshotSalaryGroupId !== currentSalaryGroupId) {
                recordUpdates.push(prisma.attendanceRecord.update({
                    where: { id: record.id },
                    data: { snapshotSalaryGroupId: currentSalaryGroupId }
                }));
            }
            if (values && typeof values === 'object') {
                const existingValueMap = new Map(record.recordValues.map(rv => [rv.attendanceFieldId, rv.value]));
                for (const [fieldId, val] of Object.entries(values)) {
                    const newValStr = (val !== null && val !== undefined && val !== '') ? String(val) : null;
                    const oldValStr = existingValueMap.get(fieldId) || null;
                    if (newValStr !== oldValStr) {
                        // 変更履歴のログを作成
                        auditLogCreates.push(prisma.attendanceAuditLog.create({
                            data: {
                                attendanceRecordId: record.id,
                                fieldName: `Field:${fieldId}`,
                                oldValue: oldValStr,
                                newValue: newValStr,
                                updatedBy: '開発用モックユーザー'
                            }
                        }));
                        // 値のアップサート
                        valueUpserts.push(prisma.attendanceRecordValue.upsert({
                            where: {
                                attendanceRecordId_attendanceFieldId: {
                                    attendanceRecordId: record.id,
                                    attendanceFieldId: fieldId
                                }
                            },
                            create: {
                                attendanceRecordId: record.id,
                                attendanceFieldId: fieldId,
                                value: newValStr
                            },
                            update: {
                                value: newValStr
                            }
                        }));
                    }
                }
            }
        }
        // 6. クエリを並列に一括実行（これにより通信の往復遅延を解消）
        if (recordUpdates.length > 0) {
            await Promise.all(recordUpdates);
        }
        if (auditLogCreates.length > 0) {
            await Promise.all(auditLogCreates);
        }
        if (valueUpserts.length > 0) {
            await Promise.all(valueUpserts);
        }
        res.json({ success: true, message: 'Saved successfully' });
    }
    catch (error) {
        console.error('Error saving attendance:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
const authMiddleware_1 = require("../middleware/authMiddleware");
// ステータス変更（提出）
router.post('/submit', async (req, res) => {
    try {
        const { month } = req.body;
        if (!month)
            return res.status(400).json({ error: 'Invalid payload' });
        const submittedBy = req.user?.name || req.user?.loginId || '不明';
        const submittedAt = new Date();
        await prisma.monthlyStatus.upsert({
            where: { targetMonth: month },
            update: { status: 'submitted', submittedBy, submittedAt },
            create: { targetMonth: month, status: 'submitted', submittedBy, submittedAt }
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// ステータス変更（提出の取り下げ）
router.post('/withdraw', async (req, res) => {
    try {
        const { month } = req.body;
        if (!month)
            return res.status(400).json({ error: 'Invalid payload' });
        const ms = await prisma.monthlyStatus.findUnique({ where: { targetMonth: month } });
        if (!ms || ms.status === 'approved') {
            return res.status(400).json({ error: '承認済みのデータは取り下げできません' });
        }
        if (ms.status === 'submitted') {
            await prisma.monthlyStatus.update({
                where: { targetMonth: month },
                data: { status: 'draft', submittedBy: null, submittedAt: null }
            });
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// 勤怠データの承認 (管理者のみ)
router.post('/approve', authMiddleware_1.requireAdmin, async (req, res) => {
    try {
        const { month } = req.body;
        if (!month) {
            return res.status(400).json({ error: 'month は必須です' });
        }
        const ms = await prisma.monthlyStatus.findUnique({ where: { targetMonth: month } });
        if (!ms || ms.status !== 'submitted') {
            return res.status(400).json({ error: '提出済みデータのみ承認できます' });
        }
        const approvedBy = req.user?.name || req.user?.loginId || '不明';
        const approvedAt = new Date();
        await prisma.monthlyStatus.update({
            where: { targetMonth: month },
            data: { status: 'approved', approvedBy, approvedAt }
        });
        res.json({ success: true, status: 'approved' });
    }
    catch (error) {
        console.error('Error approving attendance:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// 勤怠データの差し戻し (管理者のみ)
router.post('/reject', authMiddleware_1.requireAdmin, async (req, res) => {
    try {
        const { month } = req.body;
        if (!month) {
            return res.status(400).json({ error: 'month は必須です' });
        }
        const ms = await prisma.monthlyStatus.findUnique({ where: { targetMonth: month } });
        if (!ms || ms.status === 'draft') {
            return res.status(400).json({ error: '未提出のデータは差戻しできません' });
        }
        await prisma.monthlyStatus.update({
            where: { targetMonth: month },
            data: { status: 'draft' }
        });
        res.json({ success: true, status: 'draft' });
    }
    catch (error) {
        console.error('Error rejecting attendance:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// 修正履歴一覧取得
router.get('/history', async (req, res) => {
    try {
        const logs = await prisma.attendanceAuditLog.findMany({
            include: {
                attendanceRecord: {
                    include: {
                        employee: true
                    }
                }
            },
            orderBy: {
                updatedAt: 'desc'
            },
            take: 100
        });
        // fieldName が 'Field:xxxxx' のようになっている場合、マスタから名前を引くための準備
        const fields = await prisma.attendanceField.findMany();
        const fieldMap = Object.fromEntries(fields.map(f => [f.id, f.name]));
        const result = logs.map(log => {
            let displayName = log.fieldName;
            if (log.fieldName.startsWith('Field:')) {
                const fId = log.fieldName.replace('Field:', '');
                displayName = fieldMap[fId] || '削除された項目';
            }
            return {
                id: log.id,
                employeeCode: log.attendanceRecord.employee.employeeCode,
                employeeName: log.attendanceRecord.employee.name,
                targetMonth: log.attendanceRecord.targetMonth,
                fieldName: displayName,
                oldValue: log.oldValue,
                newValue: log.newValue,
                updatedBy: log.updatedBy,
                updatedAt: log.updatedAt
            };
        });
        res.json(result);
    }
    catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// 勤怠データの編集ロック取得・延長（ハートビート）
router.post('/lock', async (req, res) => {
    try {
        const { month } = req.body;
        const userId = req.user?.id;
        const userName = req.user?.name || '他のユーザー';
        if (!month || typeof month !== 'string') {
            return res.status(400).json({ error: 'month (YYYY-MM) は必須です' });
        }
        if (!userId) {
            return res.status(401).json({ error: '認証情報が不足しています' });
        }
        const now = new Date();
        const lockDurationMs = 3 * 60 * 1000; // 有効期限: 3分
        const expiresAt = new Date(now.getTime() + lockDurationMs);
        // 1. 期限切れの古いロックをクリーンアップ
        await prisma.editLock.deleteMany({
            where: {
                expiresAt: { lt: now }
            }
        });
        // 2. 対象月のロックを確認
        const existingLock = await prisma.editLock.findUnique({
            where: { targetMonth: month }
        });
        if (existingLock) {
            // 自分がロックを保持している場合 ➔ 延長する
            if (existingLock.userId === userId) {
                const updatedLock = await prisma.editLock.update({
                    where: { targetMonth: month },
                    data: { expiresAt }
                });
                return res.json({ success: true, message: 'ロックを延長しました', lock: updatedLock });
            }
            else {
                // 他のユーザーがロックを保持している場合 ➔ エラー
                return res.status(409).json({
                    error: 'conflict',
                    message: `${existingLock.userName}さんが入力中です`
                });
            }
        }
        // 3. 新規ロックを取得
        try {
            const newLock = await prisma.editLock.create({
                data: {
                    targetMonth: month,
                    userId,
                    userName,
                    expiresAt
                }
            });
            return res.json({ success: true, message: 'ロックを取得しました', lock: newLock });
        }
        catch (createError) {
            // 一意性制約違反（P2002）➔ 同時リクエストにより他人が先にインサートした場合
            if (createError.code === 'P2002') {
                const doubleCheckLock = await prisma.editLock.findUnique({
                    where: { targetMonth: month }
                });
                return res.status(409).json({
                    error: 'conflict',
                    message: `${doubleCheckLock?.userName || '他のユーザー'}さんが入力中です`
                });
            }
            throw createError;
        }
    }
    catch (error) {
        console.error('Error locking target month:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// 勤怠データの編集ロック解除
router.post('/unlock', async (req, res) => {
    try {
        const { month } = req.body;
        const userId = req.user?.id;
        if (!month || typeof month !== 'string') {
            return res.status(400).json({ error: 'month (YYYY-MM) は必須です' });
        }
        if (!userId) {
            return res.status(401).json({ error: '認証情報が不足しています' });
        }
        // 自分が保持しているロックがあれば削除
        const lock = await prisma.editLock.findUnique({
            where: { targetMonth: month }
        });
        if (lock && lock.userId === userId) {
            await prisma.editLock.delete({
                where: { targetMonth: month }
            });
            return res.json({ success: true, message: 'ロックを解除しました' });
        }
        res.json({ success: true, message: 'ロックは存在しないか、既に解除されています' });
    }
    catch (error) {
        console.error('Error unlocking target month:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
exports.default = router;
//# sourceMappingURL=attendance.js.map