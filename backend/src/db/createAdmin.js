"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma = new client_1.PrismaClient();
async function main() {
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
        console.log('Admin user created');
    }
    else {
        console.log('Admin user already exists');
    }
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=createAdmin.js.map