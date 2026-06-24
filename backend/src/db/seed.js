"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma = new client_1.PrismaClient();
async function main() {
    // 既存のデータをクリア
    await prisma.employee.deleteMany();
    await prisma.salaryGroup.deleteMany();
    // 給与規定グループの作成
    const group1 = await prisma.salaryGroup.create({
        data: {
            name: '一般社員（月給）',
        },
    });
    const group2 = await prisma.salaryGroup.create({
        data: {
            name: 'パートタイム（時給）',
        },
    });
    // 従業員の作成
    await prisma.employee.createMany({
        data: [
            { employeeCode: 'EMP001', name: '田中 太郎', salaryGroupId: group1.id },
            { employeeCode: 'EMP002', name: '鈴木 花子', salaryGroupId: group1.id },
            { employeeCode: 'EMP003', name: '佐藤 一郎', salaryGroupId: group2.id },
        ],
    });
    // 管理者ユーザーの作成
    const adminExists = await prisma.user.findUnique({ where: { loginId: 'admin' } });
    if (!adminExists) {
        const passwordHash = await bcrypt_1.default.hash('password', 10);
        await prisma.user.create({
            data: {
                loginId: 'admin',
                passwordHash,
                role: 'ADMIN',
                name: 'システム管理者'
            }
        });
    }
    console.log('Seed data created successfully!');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map