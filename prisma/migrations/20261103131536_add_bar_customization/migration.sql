-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FreeShippingSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "goal" REAL NOT NULL DEFAULT 50,
    "position" TEXT NOT NULL DEFAULT 'Cart drawer',
    "message" TEXT NOT NULL DEFAULT 'You''re only {amount} away from free shipping!',
    "backgroundColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "progressColor" TEXT NOT NULL DEFAULT '#008060',
    "textColor" TEXT NOT NULL DEFAULT '#000000',
    "barHeight" INTEGER NOT NULL DEFAULT 12,
    "borderRadius" INTEGER NOT NULL DEFAULT 6,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_FreeShippingSettings" ("createdAt", "enabled", "goal", "id", "message", "position", "shop", "updatedAt") SELECT "createdAt", "enabled", "goal", "id", "message", "position", "shop", "updatedAt" FROM "FreeShippingSettings";
DROP TABLE "FreeShippingSettings";
ALTER TABLE "new_FreeShippingSettings" RENAME TO "FreeShippingSettings";
CREATE UNIQUE INDEX "FreeShippingSettings_shop_key" ON "FreeShippingSettings"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
