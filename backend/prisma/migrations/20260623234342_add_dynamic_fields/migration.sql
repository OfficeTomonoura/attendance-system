-- CreateTable
CREATE TABLE "attendance_fields" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "field_type" TEXT NOT NULL DEFAULT 'number',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "salary_group_fields" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "salary_group_id" TEXT NOT NULL,
    "attendance_field_id" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "salary_group_fields_salary_group_id_fkey" FOREIGN KEY ("salary_group_id") REFERENCES "salary_groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "salary_group_fields_attendance_field_id_fkey" FOREIGN KEY ("attendance_field_id") REFERENCES "attendance_fields" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "attendance_record_values" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attendance_record_id" TEXT NOT NULL,
    "attendance_field_id" TEXT NOT NULL,
    "value" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "attendance_record_values_attendance_record_id_fkey" FOREIGN KEY ("attendance_record_id") REFERENCES "attendance_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "attendance_record_values_attendance_field_id_fkey" FOREIGN KEY ("attendance_field_id") REFERENCES "attendance_fields" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "salary_group_fields_salary_group_id_attendance_field_id_key" ON "salary_group_fields"("salary_group_id", "attendance_field_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_record_values_attendance_record_id_attendance_field_id_key" ON "attendance_record_values"("attendance_record_id", "attendance_field_id");
