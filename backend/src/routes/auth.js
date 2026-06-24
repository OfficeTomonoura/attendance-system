"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-attendance';
router.post('/login', async (req, res) => {
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
        const isMatch = await bcrypt_1.default.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ error: 'ログインIDまたはパスワードが間違っています' });
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, loginId: user.loginId, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
        res.json({
            token,
            user: {
                id: user.id,
                loginId: user.loginId,
                role: user.role,
                name: user.name
            }
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map