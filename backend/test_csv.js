const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const month = '2026-06';
  
  const fields = await prisma.attendanceField.findMany({
    orderBy: { displayOrder: 'asc' }
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

  const rows = records.map(r => {
    const valMap = {};
    r.recordValues.forEach(rv => {
      valMap[rv.attendanceFieldId] = rv.value ?? '';
    });

    const fieldValues = fields.map(f => {
      const val = valMap[f.id];
      if (val !== undefined && val !== null && val !== '') {
        return val;
      }
      if (f.fieldType === 'number') return '0';
      if (f.fieldType === 'time') return '00:00';
      return '';
    });

    return [
      r.employee.employeeCode,
      r.employee.name,
      r.targetMonth,
      ...fieldValues
    ].join(',');
  });

  console.log(fields.map(f => f.name).join(','));
  console.log(rows.join('\n'));
}

main().catch(console.error).finally(() => prisma.$disconnect());
