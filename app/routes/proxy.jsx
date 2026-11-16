import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
    getShopPlan,
    checkMonthlyViewLimit,
    incrementMonthlyViews,
} from "../utils/plan.server";

const DEFAULT_SETTINGS = {
    enabled: true,
    goal: 50,
    positions: ["Product page"],

    message: "You're only {amount} away from free shipping!",
    successMessage: "Congratulations! You've unlocked free shipping!",

    showMessage: true,
    showProgress: true,
    showCartTotal: true,

    backgroundColor: "#FFFFFF",
    backgroundType: "solid",
    gradientColor1: "#DDDDDD",
    gradientColor2: "#FFFFFF",
    gradientAngle: 90,

    progressColor: "#008060",
    textColor: "#000000",

    containerWidth: 100,
    containerWidthUnit: "%",
    containerHeight: 0,

    progressWidth: 100,
    barHeight: 12,

    contentAlignment: "center",

    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 12,
    paddingRight: 12,

    borderRadius: 6,

    geolocationEnabled: false,
    targetCountries: [],
    excludedProductIds: [],
};

function parsePositions(value) {
    if (Array.isArray(value)) {
        return value;
    }

    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);

            return Array.isArray(parsed)
                ? parsed
                : DEFAULT_SETTINGS.positions;
        } catch {
            return DEFAULT_SETTINGS.positions;
        }
    }

    return DEFAULT_SETTINGS.positions;
}

function parseProductIds(value) {
    if (Array.isArray(value)) {
        return value;
    }

    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    return [];
}

function parseCountryCodes(value) {
    if (Array.isArray(value)) {
        return value;
    }

    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);

            return Array.isArray(parsed)
                ? [...new Set(
                    parsed
                        .filter((code) => typeof code === "string")
                        .map((code) => code.toUpperCase())
                )]
                : [];
        } catch {
            return [];
        }
    }

    return [];
}

export async function loader({ request }) {
    try {
        const { session, admin } =
            await authenticate.public.appProxy(request);

        if (!session || !admin) {
            return Response.json(
                { error: "Shop not authenticated" },
                { status: 401 }
            );
        }

        const url = new URL(request.url);
        const barId = url.searchParams.get("bar_id")?.trim();
        const position = url.searchParams.get("position")?.trim();

        const noStoreHeaders = {
            "Cache-Control": "no-store, no-cache, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
        };

        // Enforce monthly booster view limits based on shop plan
        const viewCheck = await checkMonthlyViewLimit(session.shop);
        if (!viewCheck.allowed) {
            console.warn(`[Proxy] Monthly view limit reached for ${session.shop} (${viewCheck.currentViews}/${viewCheck.limit})`);
            return Response.json(
                { enabled: false, reason: "monthly_view_limit_reached", bars: [] },
                { headers: noStoreHeaders }
            );
        }

        const { plan } = await getShopPlan(session.shop);

        // Helper: enrich a DB row with upsell products via GraphQL
        async function enrichBar(savedSettings) {
            // Enforce plan-level feature entitlements
            const allowGeolocation = plan.features?.geolocationTargeting !== false;
            const allowUpsell = plan.features?.upsellProducts === true;
            const allowExcludes = plan.features?.excludeProducts === true;

            const responseSettings = {
                ...DEFAULT_SETTINGS,
                ...savedSettings,
                positions: parsePositions(savedSettings.positions),

                geolocationEnabled: allowGeolocation ? savedSettings.geolocationEnabled : false,
                targetCountries: allowGeolocation ? parseCountryCodes(savedSettings.targetCountries) : [],
                excludedProductIds: allowExcludes ? parseProductIds(savedSettings.excludedProductIds) : [],
            };

            const selectedProductIds = (allowUpsell && responseSettings.upsellEnabled)
                ? parseProductIds(savedSettings?.upsellProductIds)
                : [];

            let upsellProducts = [];

            if (selectedProductIds.length > 0) {
                try {
                    const productsResponse = await admin.graphql(
                        `#graphql
                query UpsellProducts($ids: [ID!]!) {
                    nodes(ids: $ids) {
                        ... on Product {
                            id
                            title
                            handle
                            onlineStoreUrl
                            featuredImage {
                                url
                                altText
                            }
                            variants(first: 10) {
                                nodes {
                                    id
                                    price
                                    availableForSale
                                }
                            }
                        }
                    }
                }`,
                        { variables: { ids: selectedProductIds } }
                    );

                    const productsData = await productsResponse.json();

                    if (productsData.errors) {
                        console.error(
                            "GraphQL errors fetching upsell products:",
                            productsData.errors
                        );
                    } else {
                        upsellProducts = (productsData.data?.nodes || [])
                            .filter(Boolean)
                            .map((product) => {
                                const variant =
                                    product.variants?.nodes?.find(
                                        (item) => item.availableForSale
                                    ) || product.variants?.nodes?.[0];

                                return {
                                    id: product.id,
                                    title: product.title,
                                    handle: product.handle,
                                    url: product.onlineStoreUrl,
                                    image: product.featuredImage?.url || null,
                                    imageAlt: product.featuredImage?.altText || product.title,
                                    price: variant?.price || null,
                                    variantId: variant?.id?.split("/").pop() || null,
                                };
                            });
                    }
                } catch (graphqlErr) {
                    console.error("Failed to fetch upsell products for bar:", graphqlErr);
                }
            }

            return {
                ...responseSettings,
                upsellProductIds: selectedProductIds,
                upsellProducts,
            };
        }

        // 1. Explicit Bar ID provided: query by both ID and shop
        if (barId) {
            const savedSettings = await prisma.freeShippingSettings.findFirst({
                where: { id: barId, shop: session.shop },
            });

            if (!savedSettings || !savedSettings.enabled) {
                return Response.json(
                    { enabled: false, bars: [] },
                    { headers: noStoreHeaders }
                );
            }

            const enriched = await enrichBar(savedSettings);

            return Response.json(
                { ...enriched, bars: [enriched] },
                { headers: noStoreHeaders }
            );
        }

        // 2. Position provided: return ALL enabled bars matching this position
        if (position) {
            const candidateBars = await prisma.freeShippingSettings.findMany({
                where: { shop: session.shop, enabled: true },
                orderBy: { updatedAt: "desc" },
            });

            const matchingBars = candidateBars.filter((bar) =>
                parsePositions(bar.positions).includes(position)
            );

            // Sort priority:
            matchingBars.sort((a, b) => {
                if (a.upsellEnabled !== b.upsellEnabled) {
                    return a.upsellEnabled ? -1 : 1;
                }
                const aLen = parsePositions(a.positions).length;
                const bLen = parsePositions(b.positions).length;
                if (aLen !== bLen) return aLen - bLen;
                return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            });

            // Cart drawer / cart page: all plans can show 1 bar.
            // Only Essential+ can show unlimited bars simultaneously (cartPageBarLimit: null).
            if (position === "Cart drawer" || position === "Cart page") {
                const isUnlimited = plan.features?.cartPageBarLimit === null;
                const cartBarLimit = isUnlimited
                    ? null
                    : (typeof plan.features?.cartPageBarLimit === "number" ? plan.features.cartPageBarLimit : 1);

                if (!isUnlimited && cartBarLimit !== null && matchingBars.length > cartBarLimit) {
                    matchingBars.splice(cartBarLimit); // keep only the first N
                }
            }

            if (matchingBars.length === 0) {
                return Response.json(
                    { enabled: false, bars: [] },
                    { headers: noStoreHeaders }
                );
            }

            const enriched = await Promise.all(matchingBars.map(enrichBar));

            return Response.json(
                {
                    ...enriched[0],
                    bars: enriched,
                },
                { headers: noStoreHeaders }
            );
        }

        // 3. Fallback: latest enabled bar
        const savedSettings = await prisma.freeShippingSettings.findFirst({
            where: { shop: session.shop, enabled: true },
            orderBy: { updatedAt: "desc" },
        });

        if (!savedSettings || !savedSettings.enabled) {
            return Response.json(
                { enabled: false, bars: [] },
                { headers: noStoreHeaders }
            );
        }

        const enriched = await enrichBar(savedSettings);

        return Response.json(
            { ...enriched, bars: [enriched] },
            { headers: noStoreHeaders }
        );
    } catch (error) {
        console.error("Free Shipping App Proxy error:", error);

        return Response.json(
            { error: "Unable to load shipping settings" },
            { status: 500 }
        );
    }
}

const ALLOWED_EVENTS = [
    "bar_view",
    "bar_click",
    "add_to_cart",
    "upsell_click",
    "upsell_add_to_cart",
    "cart_goal_reached",
];

export async function action({ request }) {
    try {
        const { session } =
            await authenticate.public.appProxy(request);

        if (!session) {
            return Response.json(
                { error: "Shop not authenticated" },
                { status: 401 }
            );
        }

        const body = await request.json();

        const {
            barId,
            eventType,
            visitorId,
            sessionId,
            countryCode,
            metadata,
        } = body;

        // Validate required fields
        if (!barId || !eventType) {
            return Response.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        // Allow only supported storefront events
        if (!ALLOWED_EVENTS.includes(eventType)) {
            return Response.json(
                { error: "Invalid event type" },
                { status: 400 }
            );
        }

        // Verify that this bar belongs to the authenticated shop
        const bar = await prisma.freeShippingSettings.findFirst({
            where: {
                id: barId,
                shop: session.shop,
            },
            select: {
                id: true,
            },
        });

        if (!bar) {
            return Response.json(
                { error: "Bar not found" },
                { status: 404 }
            );
        }

        // Deduplicate rapid duplicate bar_view requests from the same session within 5 seconds
        if (eventType === "bar_view" && sessionId) {
            const recentView = await prisma.analyticsEvent.findFirst({
                where: {
                    shop: session.shop,
                    barId: bar.id,
                    eventType: "bar_view",
                    sessionId,
                    createdAt: {
                        gte: new Date(Date.now() - 5000),
                    },
                },
            });

            if (recentView) {
                return Response.json({ success: true, deduplicated: true });
            }
        }

        // Deduplicate cart_goal_reached so a single session/order is only counted once
        if (eventType === "cart_goal_reached" && sessionId) {
            const existingGoal = await prisma.analyticsEvent.findFirst({
                where: {
                    shop: session.shop,
                    barId: bar.id,
                    eventType: "cart_goal_reached",
                    sessionId,
                },
            });

            if (existingGoal) {
                return Response.json({ success: true, deduplicated: true });
            }
        }

        // For bar_view events, atomically create event and increment monthly views in a transaction
        if (eventType === "bar_view") {
            await prisma.$transaction(async (tx) => {
                await tx.analyticsEvent.create({
                    data: {
                        shop: session.shop,
                        barId: bar.id,
                        eventType,

                        visitorId:
                            typeof visitorId === "string"
                                ? visitorId.slice(0, 100)
                                : null,

                        sessionId:
                            typeof sessionId === "string"
                                ? sessionId.slice(0, 100)
                                : null,

                        countryCode:
                            typeof countryCode === "string"
                                ? countryCode.slice(0, 2).toUpperCase()
                                : null,

                        metadata: metadata
                            ? JSON.stringify(metadata).slice(0, 2000)
                            : null,
                    },
                });

                await incrementMonthlyViews(session.shop, 1, tx);
            });
        } else {
            // Other events (clicks, add-to-cart, upsell, etc.) create record only and NEVER increment monthly views
            await prisma.analyticsEvent.create({
                data: {
                    shop: session.shop,
                    barId: bar.id,
                    eventType,

                    visitorId:
                        typeof visitorId === "string"
                            ? visitorId.slice(0, 100)
                            : null,

                    sessionId:
                        typeof sessionId === "string"
                            ? sessionId.slice(0, 100)
                            : null,

                    countryCode:
                        typeof countryCode === "string"
                            ? countryCode.slice(0, 2).toUpperCase()
                            : null,

                    metadata: metadata
                        ? JSON.stringify(metadata).slice(0, 2000)
                        : null,
                },
            });
        }

        return Response.json({ success: true });
    } catch (error) {
        console.error("Analytics event error:", error);

        return Response.json(
            { error: "Unable to save analytics event" },
            { status: 500 }
        );
    }
}