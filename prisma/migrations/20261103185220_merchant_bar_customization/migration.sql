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
    "successMessage" TEXT NOT NULL DEFAULT 'Congratulations! You''ve unlocked free shipping!',
    "showMessage" BOOLEAN NOT NULL DEFAULT true,
    "showProgress" BOOLEAN NOT NULL DEFAULT true,
    "showCartTotal" BOOLEAN NOT NULL DEFAULT true,
    "backgroundColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "progressColor" TEXT NOT NULL DEFAULT '#008060',
    "textColor" TEXT NOT NULL DEFAULT '#000000',
    "containerWidth" INTEGER NOT NULL DEFAULT 100,
    "containerWidthUnit" TEXT NOT NULL DEFAULT '%',
    "containerHeight" INTEGER NOT NULL DEFAULT 100,
    "progressWidth" INTEGER NOT NULL DEFAULT 100,
    "barHeight" INTEGER NOT NULL DEFAULT 12,
    "contentAlignment" TEXT NOT NULL DEFAULT 'center',
    "paddingTop" INTEGER NOT NULL DEFAULT 12,
    "paddingBottom" INTEGER NOT NULL DEFAULT 12,
    "paddingLeft" INTEGER NOT NULL DEFAULT 12,
    "paddingRight" INTEGER NOT NULL DEFAULT 12,
    "borderRadius" INTEGER NOT NULL DEFAULT 6,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_FreeShippingSettings" ("backgroundColor", "barHeight", "borderRadius", "createdAt", "enabled", "goal", "id", "message", "positions", "progressColor", "shop", "textColor", "updatedAt") SELECT "backgroundColor", "barHeight", "borderRadius", "createdAt", "enabled", "goal", "id", "message", "positions", "progressColor", "shop", "textColor", "updatedAt" FROM "FreeShippingSettings";
DROP TABLE "FreeShippingSettings";
ALTER TABLE "new_FreeShippingSettings" RENAME TO "FreeShippingSettings";
CREATE UNIQUE INDEX "FreeShippingSettings_shop_key" ON "FreeShippingSettings"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
