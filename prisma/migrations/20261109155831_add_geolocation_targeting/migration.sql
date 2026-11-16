-- CreateTable
CREATE TABLE "ShopSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "shopifySubscriptionId" TEXT,
    "trialEndsAt" DATETIME,
    "currentPeriodStart" DATETIME,
    "currentPeriodEnd" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FreeShippingSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Free Shipping Bar',
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
    "upsellEnabled" BOOLEAN NOT NULL DEFAULT false,
    "upsellProductIds" TEXT NOT NULL DEFAULT '[]',
    "upsellShowArrows" BOOLEAN NOT NULL DEFAULT true,
    "upsellAutoSlide" BOOLEAN NOT NULL DEFAULT true,
    "upsellSlideInterval" INTEGER NOT NULL DEFAULT 5,
    "upsellProductsPerView" INTEGER NOT NULL DEFAULT 2,
    "geolocationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "targetCountries" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_FreeShippingSettings" ("backgroundColor", "barHeight", "borderRadius", "containerHeight", "containerWidth", "containerWidthUnit", "contentAlignment", "createdAt", "enabled", "goal", "id", "message", "name", "paddingBottom", "paddingLeft", "paddingRight", "paddingTop", "positions", "progressColor", "progressWidth", "shop", "showCartTotal", "showMessage", "showProgress", "successMessage", "textColor", "updatedAt", "upsellAutoSlide", "upsellEnabled", "upsellProductIds", "upsellProductsPerView", "upsellShowArrows", "upsellSlideInterval") SELECT "backgroundColor", "barHeight", "borderRadius", "containerHeight", "containerWidth", "containerWidthUnit", "contentAlignment", "createdAt", "enabled", "goal", "id", "message", "name", "paddingBottom", "paddingLeft", "paddingRight", "paddingTop", "positions", "progressColor", "progressWidth", "shop", "showCartTotal", "showMessage", "showProgress", "successMessage", "textColor", "updatedAt", "upsellAutoSlide", "upsellEnabled", "upsellProductIds", "upsellProductsPerView", "upsellShowArrows", "upsellSlideInterval" FROM "FreeShippingSettings";
DROP TABLE "FreeShippingSettings";
ALTER TABLE "new_FreeShippingSettings" RENAME TO "FreeShippingSettings";
CREATE INDEX "FreeShippingSettings_shop_idx" ON "FreeShippingSettings"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ShopSubscription_shop_key" ON "ShopSubscription"("shop");

-- CreateIndex
CREATE INDEX "UsageRecord_shop_periodEnd_idx" ON "UsageRecord"("shop", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "UsageRecord_shop_periodStart_key" ON "UsageRecord"("shop", "periodStart");
