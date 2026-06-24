-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_attendance_fields" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "field_type" TEXT NOT NULL DEFAULT 'number',
    "is_common" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_attendance_fields" ("created_at", "display_order", "field_type", "id", "name", "updated_at") SELECT "created_at", "display_order", "field_type", "id", "name", "updated_at" FROM "attendance_fields";
DROP TABLE "attendance_fields";
ALTER TABLE "new_attendance_fields" RENAME TO "attendance_fields";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
