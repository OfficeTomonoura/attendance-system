/*
  Warnings:

  - You are about to drop the column `createdAt` on the `attendance_records` table. All the data in the column will be lost.
  - You are about to drop the column `employeeId` on the `attendance_records` table. All the data in the column will be lost.
  - You are about to drop the column `targetMonth` on the `attendance_records` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `attendance_records` table. All the data in the column will be lost.
  - You are about to drop the column `attendanceRecordId` on the `attendance_values` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `attendance_values` table. All the data in the column will be lost.
  - You are about to drop the column `scheduledWorkDays` on the `attendance_values` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `attendance_values` table. All the data in the column will be lost.
  - Added the required column `employee_id` to the `attendance_records` table without a default value. This is not possible if the table is not empty.
  - Added the required column `target_month` to the `attendance_records` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `attendance_records` table without a default value. This is not possible if the table is not empty.
  - Added the required column `attendance_record_id` to the `attendance_values` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `attendance_values` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "attendance_audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attendance_record_id" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "updated_by" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendance_audit_logs_attendance_record_id_fkey" FOREIGN KEY ("attendance_record_id") REFERENCES "attendance_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_attendance_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employee_id" TEXT NOT NULL,
    "target_month" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "attendance_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_attendance_records" ("id", "status") SELECT "id", "status" FROM "attendance_records";
DROP TABLE "attendance_records";
ALTER TABLE "new_attendance_records" RENAME TO "attendance_records";
CREATE UNIQUE INDEX "attendance_records_employee_id_target_month_key" ON "attendance_records"("employee_id", "target_month");
CREATE TABLE "new_attendance_values" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attendance_record_id" TEXT NOT NULL,
    "scheduled_work_days" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "attendance_values_attendance_record_id_fkey" FOREIGN KEY ("attendance_record_id") REFERENCES "attendance_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_attendance_values" ("id") SELECT "id" FROM "attendance_values";
DROP TABLE "attendance_values";
ALTER TABLE "new_attendance_values" RENAME TO "attendance_values";
CREATE UNIQUE INDEX "attendance_values_attendance_record_id_key" ON "attendance_values"("attendance_record_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
