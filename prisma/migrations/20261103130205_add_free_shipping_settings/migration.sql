-- CreateTable
CREATE TABLE "FreeShippingSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "goal" REAL NOT NULL DEFAULT 50,
    "position" TEXT NOT NULL DEFAULT 'Cart drawer',
    "message" TEXT NOT NULL DEFAULT 'You''re only {amount} away from free shipping!',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "FreeShippingSettings_shop_key" ON "FreeShippingSettings"("shop");
