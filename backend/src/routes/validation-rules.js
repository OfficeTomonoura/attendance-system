"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
// ルール一覧の取得
router.get('/', async (req, res) => {
    try {
        const rules = await prisma.validationRule.findMany({
            include: {
                salaryGroup: true,
                attendanceField: true
            },
            orderBy: { createdAt: 'asc' }
        });
        res.json(rules);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// ルールの作成
router.post('/', async (req, res) => {
    try {
        const { salaryGroupId, attendanceFieldId, operator, referenceValue, errorMessage } = req.body;
        if (!salaryGroupId || !attendanceFieldId || !operator || !errorMessage) {
            return res.status(400).json({ error: '必須項目が不足しています' });
        }
        const rule = await prisma.validationRule.create({
            data: {
                salaryGroupId,
                attendanceFieldId,
                operator,
                referenceValue,
                errorMessage
            },
            include: {
                salaryGroup: true,
                attendanceField: true
            }
        });
        res.status(201).json(rule);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// ルールの更新
router.put('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const { operator, referenceValue, errorMessage } = req.body;
        const rule = await prisma.validationRule.update({
            where: { id },
            data: {
                operator,
                referenceValue,
                errorMessage
            },
            include: {
                salaryGroup: true,
                attendanceField: true
            }
        });
        res.json(rule);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// ルールの削除
router.delete('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        await prisma.validationRule.delete({
            where: { id }
        });
        res.status(204).send();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
exports.default = router;
//# sourceMappingURL=validation-rules.js.map