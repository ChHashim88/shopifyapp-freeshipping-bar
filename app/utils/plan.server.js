import prisma from "../db.server.js";
import { PLANS } from "../config/plans.js";


export async function getShopPlan(shop) {
    let subscription = await prisma.shopSubscription.findUnique({
        where: { shop },
    });

    const now = new Date();

    let wasDowngraded = false;

    if (!subscription) {
        subscription = await prisma.shopSubscription.create({
            data: {
                shop,
                plan: "FREE",
                status: "ACTIVE",
                currentPeriodStart: now,
                currentPeriodEnd: addMonths(now, 1),
            },
        });
    } else if (
        subscription.plan !== "FREE" &&
        subscription.currentPeriodEnd &&
        now > new Date(subscription.currentPeriodEnd) &&
        !subscription.shopifySubscriptionId
    ) {
        const newStart = new Date(subscription.currentPeriodEnd);
        subscription = await prisma.shopSubscription.update({
            where: { shop },
            data: {
                plan: "FREE",
                status: "ACTIVE",
                shopifySubscriptionId: null,
                currentPeriodStart: newStart,
                currentPeriodEnd: addMonths(newStart, 1),
            },
        });
        wasDowngraded = true;
    }

    const plan = PLANS[subscription.plan] || PLANS.FREE;

    
    let daysUntilExpiry = null;
    if (subscription.plan !== "FREE" && subscription.currentPeriodEnd) {
        const msPerDay = 1000 * 60 * 60 * 24;
        const diff = new Date(subscription.currentPeriodEnd).getTime() - now.getTime();
        daysUntilExpiry = Math.ceil(diff / msPerDay);
    }

    // Trial info
    let trialInfo = { isTrialActive: false, trialDaysRemaining: 0, trialEndsAt: null };
    if (subscription.trialEndsAt) {
        const trialEnd = new Date(subscription.trialEndsAt);
        if (now < trialEnd) {
            const msLeft = trialEnd.getTime() - now.getTime();
            trialInfo = {
                isTrialActive: true,
                trialDaysRemaining: Math.ceil(msLeft / (1000 * 60 * 60 * 24)),
                trialEndsAt: trialEnd.toISOString(),
            };
        }
    }

    return {
        subscription,
        plan,
        planKey: PLANS[subscription.plan] ? subscription.plan : "FREE",
        wasDowngraded,
        daysUntilExpiry,
        trialInfo,
    };
}

export function addMonths(date, months) {
    const d = new Date(date);
    const targetMonth = d.getUTCMonth() + months;
    const targetYear = d.getUTCFullYear() + Math.floor(targetMonth / 12);
    const normalizedMonth = ((targetMonth % 12) + 12) % 12;

    const originalDay = d.getUTCDate();
    const result = new Date(Date.UTC(
        targetYear,
        normalizedMonth,
        1,
        d.getUTCHours(),
        d.getUTCMinutes(),
        d.getUTCSeconds(),
        d.getUTCMilliseconds()
    ));
    const maxDays = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
    result.setUTCDate(Math.min(originalDay, maxDays));
    return result;
}

export async function updateShopSubscription(shop, {
    planKey,
    status = "ACTIVE",
    shopifySubscriptionId = null,
    currentPeriodStart = null,
    currentPeriodEnd = null,
    trialEndsAt = null,
}) {
    const validPlanKey = PLANS[planKey] ? planKey : "FREE";

    const now = new Date();
    const periodStartVal = currentPeriodStart
        ? new Date(currentPeriodStart)
        : now;

    const periodEndVal = currentPeriodEnd
        ? new Date(currentPeriodEnd)
        : addMonths(periodStartVal, 1);

    return await prisma.shopSubscription.upsert({
        where: { shop },
        update: {
            plan: validPlanKey,
            status,
            shopifySubscriptionId,
            currentPeriodStart: periodStartVal,
            currentPeriodEnd: periodEndVal,
            trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null,
        },
        create: {
            shop,
            plan: validPlanKey,
            status,
            shopifySubscriptionId,
            currentPeriodStart: periodStartVal,
            currentPeriodEnd: periodEndVal,
            trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null,
        },
    });
}

export function getCurrentMonthPeriod(subscriptionDate, now = new Date()) {
    const anchorDate = new Date(subscriptionDate || now);

    if (Number.isNaN(anchorDate.getTime())) {
        throw new Error("Invalid subscription date");
    }

    let monthsElapsed =
        (now.getUTCFullYear() - anchorDate.getUTCFullYear()) * 12 +
        now.getUTCMonth() - anchorDate.getUTCMonth();

    let periodStart = addMonths(anchorDate, monthsElapsed);

    if (now < periodStart) {
        monthsElapsed--;
        periodStart = addMonths(anchorDate, monthsElapsed);
    }

    return {
        periodStart,
        periodEnd: addMonths(anchorDate, monthsElapsed + 1),
    };
}

export async function getCurrentUsage(shop) {
    const { subscription } = await getShopPlan(shop);
    const subscriptionDate = subscription?.currentPeriodStart || subscription?.createdAt;

    const { periodStart, periodEnd } = getCurrentMonthPeriod(subscriptionDate);

    const usage = await prisma.usageRecord.upsert({
        where: {
            shop_periodStart: {
                shop,
                periodStart,
            },
        },
        update: {},
        create: {
            shop,
            periodStart,
            periodEnd,
            views: 0,
        },
    });

    return usage;
}

export async function incrementMonthlyViews(shop, count = 1, client = prisma) {
    const subscription = await client.shopSubscription.findUnique({
        where: { shop },
    });
    const subscriptionDate = subscription?.currentPeriodStart || subscription?.createdAt;

    const { periodStart, periodEnd } = getCurrentMonthPeriod(subscriptionDate);

    return await client.usageRecord.upsert({
        where: {
            shop_periodStart: {
                shop,
                periodStart,
            },
        },
        update: {
            views: { increment: count },
        },
        create: {
            shop,
            periodStart,
            periodEnd,
            views: count,
        },
    });
}


export async function checkMonthlyViewLimit(shop) {
    const [{ plan, planKey }, usage] = await Promise.all([
        getShopPlan(shop),
        getCurrentUsage(shop),
    ]);

    const limit = plan.monthlyViewLimit;
    const currentViews = usage.views;

    const isUnlimited = limit === null || limit === Infinity;
    const isAllowed = isUnlimited || currentViews < limit;
    const remaining = isUnlimited ? null : Math.max(0, limit - currentViews);

    const now = new Date();
    const msPerDay = 1000 * 60 * 60 * 24;
    const diffMs = Math.max(0, new Date(usage.periodEnd).getTime() - now.getTime());
    const daysRemaining = Math.max(1, Math.floor(diffMs / msPerDay));

    return {
        allowed: isAllowed,
        currentViews,
        limit,
        remaining,
        isUnlimited,
        planKey,
        planName: plan.name,
        periodEnd: usage.periodEnd instanceof Date ? usage.periodEnd.toISOString() : usage.periodEnd,
        periodStart: usage.periodStart instanceof Date ? usage.periodStart.toISOString() : usage.periodStart,
        daysRemaining,
    };
}


export async function isFeatureAllowed(shop, featureName) {
    const { plan, subscription } = await getShopPlan(shop);

    if (subscription.status !== "ACTIVE" && subscription.status !== "ACCEPTED") {
        return false;
    }

    return Boolean(plan.features?.[featureName]);
}
