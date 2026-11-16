import prisma from "../db.server.js";
import { updateShopSubscription } from "./plan.server.js";

const PLAN_HANDLE_MAP = {
    free: "FREE",
    starter: "STARTER",
    essential: "ESSENTIAL",
    professional: "PROFESSIONAL",
};

export async function getShopGid(admin) {
    try {
        const response = await admin.graphql(
            `#graphql
            query GetShopId {
                shop {
                    id
                }
            }`
        );
        const data = await response.json();
        return data.data?.shop?.id || null;
    } catch (err) {
        console.error("[Partner Billing] Failed to retrieve shop GID:", err);
        return null;
    }
}

export async function queryPartnerActiveSubscription(appId, shopId) {
    const partnerId = process.env.SHOPIFY_PARTNER_ID;
    const partnerToken = process.env.SHOPIFY_PARTNER_API_TOKEN;

    if (!partnerId || !partnerToken) {
        return {
            available: false,
            reason: "SHOPIFY_PARTNER_ID or SHOPIFY_PARTNER_API_TOKEN not configured in environment.",
        };
    }

    const endpoint = `https://partners.shopify.com/${partnerId}/api/2026-10/graphql.json`;

    const query = `
        query ActiveSubscription($appId: ID!, $shopId: ID!) {
            activeSubscription(appId: $appId, shopId: $shopId) {
                id
                billingPeriod
                trialEndsAt
                cancelAtEndOfCycle
                currentBillingCycle {
                    billingPeriodEnd
                }
                items {
                    ... on SubscriptionItem {
                        id
                        planPrice {
                            ... on FlatRatePlanPrice {
                                amount {
                                    amount
                                    currencyCode
                                }
                            }
                        }
                    }
                }
            }
        }
    `;

    try {
        const res = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token": partnerToken,
            },
            body: JSON.stringify({
                query,
                variables: { appId, shopId },
            }),
        });

        const json = await res.json();
        if (json.errors?.length) {
            console.error("[Partner API] GraphQL errors:", json.errors);
            return { available: false, errors: json.errors };
        }

        return {
            available: true,
            activeSubscription: json.data?.activeSubscription || null,
        };
    } catch (err) {
        console.error("[Partner API] Request failed:", err);
        return { available: false, error: err.message };
    }
}


export async function queryAdminActiveSubscriptions(admin) {
    try {
        const response = await admin.graphql(
            `#graphql
            query GetCurrentAppActiveSubscriptions {
                currentAppInstallation {
                    id
                    activeSubscriptions {
                        id
                        name
                        status
                        test
                        currentPeriodEnd
                        lineItems {
                            id
                            plan {
                                pricingDetails {
                                    ... on AppRecurringPricing {
                                        price {
                                            amount
                                            currencyCode
                                        }
                                        interval
                                    }
                                }
                            }
                        }
                    }
                }
            }`
        );

        const json = await response.json();
        const subs = json.data?.currentAppInstallation?.activeSubscriptions || [];
        return subs.filter((s) => s.status === "ACTIVE" || s.status === "ACCEPTED");
    } catch (err) {
        console.error("[Partner Billing] Failed to query Admin activeSubscriptions:", err);
        return [];
    }
}

/**
 * Verifies active subscription state and synchronizes with Prisma `ShopSubscription`.
 * Never trusts URL parameters alone.
 *
 * @param {object} params
 * @param {object} params.admin - Shopify Admin context from authenticate.admin
 * @param {string} params.shop - Myshopify domain (e.g. store.myshopify.com)
 * @param {string} [params.candidatePlanHandle] - Optional plan_handle reported in returnUrl
 */
export async function verifyAndSyncSubscription({ admin, shop, candidatePlanHandle }) {
    console.log(`[Partner Billing] Verifying subscription for shop: ${shop}`);

    let verifiedPlanKey = "FREE";
    let subscriptionId = null;
    let currentPeriodEnd = null;
    let trialEndsAt = null;
    let status = "ACTIVE";
    let verificationMethod = "NONE";

    const partnerAppId = process.env.SHOPIFY_PARTNER_APP_ID;
    const shopGid = await getShopGid(admin);

    // 1. Try Partner API first if credentials are configured
    if (partnerAppId && shopGid && process.env.SHOPIFY_PARTNER_API_TOKEN) {
        console.log(`[Partner Billing] Attempting verification via Partner API (appId: ${partnerAppId}, shopId: ${shopGid})`);
        const partnerResult = await queryPartnerActiveSubscription(partnerAppId, shopGid);

        if (partnerResult.available) {
            verificationMethod = "PARTNER_API";
            const activeSub = partnerResult.activeSubscription;

            if (activeSub && !activeSub.cancelAtEndOfCycle) {
                subscriptionId = activeSub.id;
                currentPeriodEnd = activeSub.currentBillingCycle?.billingPeriodEnd || null;
                trialEndsAt = activeSub.trialEndsAt || null;

                // Match plan handle from candidate or price
                if (candidatePlanHandle && PLAN_HANDLE_MAP[candidatePlanHandle.toLowerCase()]) {
                    verifiedPlanKey = PLAN_HANDLE_MAP[candidatePlanHandle.toLowerCase()];
                } else {
                    const priceAmount = parseFloat(activeSub.items?.[0]?.planPrice?.amount?.amount || 0);
                    if (priceAmount >= 25) verifiedPlanKey = "PROFESSIONAL";
                    else if (priceAmount >= 12) verifiedPlanKey = "ESSENTIAL";
                    else if (priceAmount >= 5) verifiedPlanKey = "STARTER";
                    else verifiedPlanKey = "FREE";
                }
            } else {
                verifiedPlanKey = "FREE";
            }
        }
    }

    // 2. If Partner API is unavailable, verify via Admin API active subscriptions
    if (verificationMethod === "NONE") {
        console.log("[Partner Billing] Querying Admin API activeSubscriptions...");
        const adminActiveSubs = await queryAdminActiveSubscriptions(admin);

        if (adminActiveSubs.length > 0) {
            verificationMethod = "ADMIN_API";
            const primarySub = adminActiveSubs[0];
            subscriptionId = primarySub.id;
            currentPeriodEnd = primarySub.currentPeriodEnd || null;

            const subName = (primarySub.name || "").toUpperCase();
            if (subName.includes("PROFESSIONAL")) {
                verifiedPlanKey = "PROFESSIONAL";
            } else if (subName.includes("ESSENTIAL")) {
                verifiedPlanKey = "ESSENTIAL";
            } else if (subName.includes("STARTER")) {
                verifiedPlanKey = "STARTER";
            } else if (candidatePlanHandle && PLAN_HANDLE_MAP[candidatePlanHandle.toLowerCase()]) {
                verifiedPlanKey = PLAN_HANDLE_MAP[candidatePlanHandle.toLowerCase()];
            } else {
                const amount = parseFloat(primarySub.lineItems?.[0]?.plan?.pricingDetails?.price?.amount || 0);
                if (amount >= 25) verifiedPlanKey = "PROFESSIONAL";
                else if (amount >= 12) verifiedPlanKey = "ESSENTIAL";
                else if (amount >= 5) verifiedPlanKey = "STARTER";
                else verifiedPlanKey = "FREE";
            }
        } else {
            verifiedPlanKey = "FREE";
            subscriptionId = null;
        }
    }

    // 3. Persist verified subscription state into Prisma
    const updated = await updateShopSubscription(shop, {
        planKey: verifiedPlanKey,
        status: status,
        shopifySubscriptionId: subscriptionId,
        currentPeriodEnd,
        trialEndsAt,
    });

    console.log(`[Partner Billing] Verification complete (${verificationMethod}). Persisted plan ${verifiedPlanKey} for ${shop}.`);

    return {
        verified: verifiedPlanKey !== "FREE" || !candidatePlanHandle || candidatePlanHandle.toLowerCase() === "free",
        planKey: verifiedPlanKey,
        verificationMethod,
        subscription: updated,
    };
}
