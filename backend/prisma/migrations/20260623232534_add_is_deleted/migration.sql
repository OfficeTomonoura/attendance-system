-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_employees" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "salaryGroupId" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "employees_salaryGroupId_fkey" FOREIGN KEY ("salaryGroupId") REFERENCES "salary_groups" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_employees" ("createdAt", "employeeCode", "id", "name", "salaryGroupId", "updatedAt") SELECT "createdAt", "employeeCode", "id", "name", "salaryGroupId", "updatedAt" FROM "employees";
DROP TABLE "employees";
ALTER TABLE "new_employees" RENAME TO "employees";
CREATE UNIQUE INDEX "employees_employeeCode_key" ON "employees"("employeeCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
