-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" INTEGER,
    "theme" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_rules" ("created_at", "frequency", "id", "is_enabled", "theme", "time", "updated_at", "user_id") SELECT "created_at", "frequency", "id", "is_enabled", "theme", "time", "updated_at", "user_id" FROM "rules";
DROP TABLE "rules";
ALTER TABLE "new_rules" RENAME TO "rules";
CREATE TABLE "new_notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" INTEGER,
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
INSERT INTO "new_notifications" ("action_suggestion", "created_at", "description", "id", "is_read", "rule_id", "scheduled_date", "short_text", "user_id") SELECT "action_suggestion", "created_at", "description", "id", "is_read", "rule_id", "scheduled_date", "short_text", "user_id" FROM "notifications";
DROP TABLE "notifications";
ALTER TABLE "new_notifications" RENAME TO "notifications";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
