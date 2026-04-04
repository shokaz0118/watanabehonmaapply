/*
  Warnings:

  - Added the required column `user_id` to the `rules` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" INTEGER NOT NULL,
    "theme" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_rules" ("created_at", "frequency", "id", "is_enabled", "theme", "time", "updated_at", "user_id") SELECT "created_at", "frequency", "id", "is_enabled", "theme", "time", "updated_at", 1 FROM "rules";
DROP TABLE "rules";
ALTER TABLE "new_rules" RENAME TO "rules";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
