"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// 全グループの紐付け一覧取得
router.get('/', async (req, res) => {
    try {
        const allGroupFields = await prisma.salaryGroupField.findMany({
            include: {
                attendanceField: true
            }
        });
        res.json(allGroupFields);
    }
    catch (error) {
        console.error('Error fetching all salary group fields:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// グループに紐づく項目一覧取得
router.get('/:salaryGroupId', async (req, res) => {
    try {
        const salaryGroupId = req.params.salaryGroupId;
        // 通常の紐付けを取得
        const groupFields = await prisma.salaryGroupField.findMany({
            where: { salaryGroupId },
            include: {
                attendanceField: true
            }
        });
        // 共通項目を取得
        const commonFields = await prisma.attendanceField.findMany({
            where: { isCommon: true }
        });
        // マージ処理
        const existingFieldIds = new Set(groupFields.map(gf => gf.attendanceFieldId));
        const merged = [...groupFields];
        for (const cf of commonFields) {
            if (!existingFieldIds.has(cf.id)) {
                merged.push({
                    id: `common-${cf.id}`,
                    salaryGroupId,
                    attendanceFieldId: cf.id,
                    required: false, // 共通項目は任意入力とする
                    displayOrder: cf.displayOrder - 1000, // マスタの並び順ベースで先頭付近に出す
                    attendanceField: cf
                });
            }
        }
        // attendanceField の displayOrder でソート（マスタの順序と一致させる）
        merged.sort((a, b) => a.attendanceField.displayOrder - b.attendanceField.displayOrder);
        res.json(merged);
    }
    catch (error) {
        console.error('Error fetching salary group fields:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// グループ別項目設定の保存（一括更新）
router.post('/:salaryGroupId', async (req, res) => {
    try {
        const salaryGroupId = req.params.salaryGroupId;
        const { fields } = req.body;
        // fields: Array<{ attendanceFieldId: string, required: boolean, displayOrder: number }>
        if (!Array.isArray(fields)) {
            return res.status(400).json({ error: 'fields array is required' });
        }
        await prisma.$transaction(async (tx) => {
            // 一旦既存の紐付けを削除
            await tx.salaryGroupField.deleteMany({
                where: { salaryGroupId }
            });
            // 共通項目を取得
            const commonFields = await tx.attendanceField.findMany({ where: { isCommon: true } });
            const commonFieldIds = new Set(commonFields.map(cf => cf.id));
            // 新しく作成
            for (const field of fields) {
                if (commonFieldIds.has(field.attendanceFieldId))
                    continue; // 共通項目は紐付けテーブルに保存しない
                await tx.salaryGroupField.create({
                    data: {
                        salaryGroupId,
                        attendanceFieldId: field.attendanceFieldId,
                        required: field.required || false,
                        displayOrder: field.displayOrder || 0
                    }
                });
            }
        });
        res.json({ success: true, message: 'Saved successfully' });
    }
    catch (error) {
        console.error('Error saving salary group fields:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
exports.default = router;
//# sourceMappingURL=salary-group-fields.js.map