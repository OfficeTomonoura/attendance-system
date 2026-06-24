"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("@prisma/client");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT || 3001);
const prisma = new client_1.PrismaClient();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const employees_1 = __importDefault(require("./routes/employees"));
const salary_groups_1 = __importDefault(require("./routes/salary-groups"));
const attendance_1 = __importDefault(require("./routes/attendance"));
const fields_1 = __importDefault(require("./routes/fields"));
const salary_group_fields_1 = __importDefault(require("./routes/salary-group-fields"));
const validation_rules_1 = __importDefault(require("./routes/validation-rules"));
const auth_1 = __importDefault(require("./routes/auth"));
const users_1 = __importDefault(require("./routes/users"));
const system_settings_1 = __importDefault(require("./routes/system-settings"));
const authMiddleware_1 = require("./middleware/authMiddleware");
// 認証不要のルート
app.use('/api/auth', auth_1.default);
// 認証必須のルート
app.use('/api/attendance', authMiddleware_1.authenticateToken, attendance_1.default);
app.use('/api/fields', authMiddleware_1.authenticateToken, fields_1.default);
app.use('/api/salary-groups', authMiddleware_1.authenticateToken, salary_groups_1.default);
app.use('/api/salary-group-fields', authMiddleware_1.authenticateToken, salary_group_fields_1.default);
app.use('/api/validation-rules', authMiddleware_1.authenticateToken, validation_rules_1.default);
// 管理者権限が必須のルート
app.use('/api/users', users_1.default); // usersRoutes内で適用済み
app.use('/api/employees', authMiddleware_1.authenticateToken, authMiddleware_1.requireAdmin, employees_1.default);
app.use('/api/system-settings', authMiddleware_1.authenticateToken, authMiddleware_1.requireAdmin, system_settings_1.default);
// ヘルスチェックAPI
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Backend server is running on http://localhost:${PORT}`);
    });
}
exports.default = app;
//# sourceMappingURL=index.js.map