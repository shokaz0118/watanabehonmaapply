/*
  Warnings:

  - Added the required column `user_id` to the `notifications` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" INTEGER NOT NULL,
    "rule_id" TEXT NOT NULL,
    "scheduled_date" DATETIME NOT NULL,
    "short_text" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "action_suggestion" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notifications_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "rules" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_notifications" ("action_suggestion", "created_at", "description", "id", "is_read", "rule_id", "scheduled_date", "short_text", "user_id") SELECT "action_suggestion", "created_at", "description", "id", "is_read", "rule_id", "scheduled_date", "short_text", 1 FROM "notifications";
DROP TABLE "notifications";
ALTER TABLE "new_notifications" RENAME TO "notifications";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
