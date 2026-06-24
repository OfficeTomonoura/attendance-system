import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3001);
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

import employeeRoutes from './routes/employees';
import salaryGroupRoutes from './routes/salary-groups';
import attendanceRoutes from './routes/attendance';
import fieldsRoutes from './routes/fields';
import salaryGroupFieldsRoutes from './routes/salary-group-fields';
import validationRulesRoutes from './routes/validation-rules';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import systemSettingsRoutes from './routes/system-settings';
import { authenticateToken, requireAdmin } from './middleware/authMiddleware';

// 認証不要のルート
app.use(['/api/auth', '/auth'], authRoutes);

// 認証必須のルート
app.use(['/api/attendance', '/attendance'], authenticateToken, attendanceRoutes);
app.use(['/api/fields', '/fields'], authenticateToken, fieldsRoutes);
app.use(['/api/salary-groups', '/salary-groups'], authenticateToken, salaryGroupRoutes);
app.use(['/api/salary-group-fields', '/salary-group-fields'], authenticateToken, salaryGroupFieldsRoutes);
app.use(['/api/validation-rules', '/validation-rules'], authenticateToken, validationRulesRoutes);

// 管理者権限が必須のルート
app.use(['/api/users', '/users'], usersRoutes); // usersRoutes内で適用済み
app.use(['/api/employees', '/employees'], authenticateToken, requireAdmin, employeeRoutes);
app.use(['/api/system-settings', '/system-settings'], authenticateToken, requireAdmin, systemSettingsRoutes);

// ヘルスチェックAPI
app.get(['/api/health', '/health'], (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
  });
}

export default app;
