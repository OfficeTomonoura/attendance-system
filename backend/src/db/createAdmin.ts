import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminExists = await prisma.user.findUnique({ where: { loginId: 'admin' } });
  if (!adminExists) {
    const passwordHash = await bcrypt.hash('password', 10);
    await prisma.user.create({
      data: {
        loginId: 'admin',
        passwordHash,
        role: 'ADMIN',
        name: 'システム管理者'
      }
    });
    console.log('Admin user created');
  } else {
    console.log('Admin user already exists');
  }
}
main().finally(() => prisma.$disconnect());
