-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "barId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "visitorId" TEXT,
    "sessionId" TEXT,
    "countryCode" TEXT,
    "orderId" TEXT,
    "value" REAL,
    "currency" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "AnalyticsEvent_shop_createdAt_idx" ON "AnalyticsEvent"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_shop_barId_createdAt_idx" ON "AnalyticsEvent"("shop", "barId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_shop_eventType_createdAt_idx" ON "AnalyticsEvent"("shop", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_shop_orderId_idx" ON "AnalyticsEvent"("shop", "orderId");
