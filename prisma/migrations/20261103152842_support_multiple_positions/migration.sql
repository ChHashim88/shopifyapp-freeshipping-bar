/*
  Warnings:

  - You are about to drop the column `position` on the `FreeShippingSettings` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FreeShippingSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "goal" REAL NOT NULL DEFAULT 50,
    "positions" TEXT NOT NULL DEFAULT '["Product page"]',
    "message" TEXT NOT NULL DEFAULT 'You''re only {amount} away from free shipping!',
    "backgroundColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "progressColor" TEXT NOT NULL DEFAULT '#008060',
    "textColor" TEXT NOT NULL DEFAULT '#000000',
    "barHeight" INTEGER NOT NULL DEFAULT 12,
    "borderRadius" INTEGER NOT NULL DEFAULT 6,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_FreeShippingSettings" (
    "backgroundColor",
    "barHeight",
    "borderRadius",
    "createdAt",
    "enabled",
    "goal",
    "id",
    "message",
    "positions",
    "progressColor",
    "shop",
    "textColor",
    "updatedAt"
)
SELECT
    "backgroundColor",
    "barHeight",
    "borderRadius",
    "createdAt",
    "enabled",
    "goal",
    "id",
    "message",
    CASE "position"
        WHEN 'Product page' THEN '["Product page"]'
        WHEN 'Cart drawer' THEN '["Cart drawer"]'
        WHEN 'Announcement bar' THEN '["Announcement bar"]'
        WHEN 'Cart page' THEN '["Cart page"]'
        ELSE '["Product page"]'
    END,
    "progressColor",
    "shop",
    "textColor",
    "updatedAt"
FROM "FreeShippingSettings";
DROP TABLE "FreeShippingSettings";
ALTER TABLE "new_FreeShippingSettings" RENAME TO "FreeShippingSettings";
CREATE UNIQUE INDEX "FreeShippingSettings_shop_key" ON "FreeShippingSettings"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
