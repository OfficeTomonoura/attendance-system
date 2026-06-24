"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Starting migration script...');
    // 1. "所定労働日数" フィールドを作成
    let scheduledWorkDaysField = await prisma.attendanceField.findFirst({
        where: { name: '所定労働日数' }
    });
    if (!scheduledWorkDaysField) {
        scheduledWorkDaysField = await prisma.attendanceField.create({
            data: {
                name: '所定労働日数',
                fieldType: 'number'
            }
        });
        console.log(`Created field: 所定労働日数 (ID: ${scheduledWorkDaysField.id})`);
    }
    // 2. 全ての SalaryGroup に対して "所定労働日数" を紐付ける
    const groups = await prisma.salaryGroup.findMany();
    for (const group of groups) {
        const existing = await prisma.salaryGroupField.findUnique({
            where: {
                salaryGroupId_attendanceFieldId: {
                    salaryGroupId: group.id,
                    attendanceFieldId: scheduledWorkDaysField.id
                }
            }
        });
        if (!existing) {
            await prisma.salaryGroupField.create({
                data: {
                    salaryGroupId: group.id,
                    attendanceFieldId: scheduledWorkDaysField.id,
                    required: false,
                    displayOrder: 1
                }
            });
            console.log(`Linked field to group: ${group.name}`);
        }
    }
    // 3. 既存の AttendanceValue の値を AttendanceRecordValue に移行
    const oldValues = await prisma.attendanceValue.findMany();
    for (const oldVal of oldValues) {
        if (oldVal.scheduledWorkDays !== null) {
            const existingRecordVal = await prisma.attendanceRecordValue.findUnique({
                where: {
                    attendanceRecordId_attendanceFieldId: {
                        attendanceRecordId: oldVal.attendanceRecordId,
                        attendanceFieldId: scheduledWorkDaysField.id
                    }
                }
            });
            if (!existingRecordVal) {
                await prisma.attendanceRecordValue.create({
                    data: {
                        attendanceRecordId: oldVal.attendanceRecordId,
                        attendanceFieldId: scheduledWorkDaysField.id,
                        value: String(oldVal.scheduledWorkDays)
                    }
                });
                console.log(`Migrated value for record ${oldVal.attendanceRecordId}: ${oldVal.scheduledWorkDays}`);
            }
        }
    }
    console.log('Migration completed successfully.');
}
main()
    .catch(e => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=migrate_values.js.map