import { useLoaderData, useNavigation, Form } from "react-router";
import { authenticate } from "../shopify.server";
import { getShopPlan, getCurrentUsage, updateShopSubscription } from "../utils/plan.server";
import { verifyAndSyncSubscription } from "../utils/partner-billing.server";
import { PLANS } from "../config/plans";

export const loader = async ({ request }) => {
    const { admin, session, redirect } = await authenticate.admin(request);

    const url = new URL(request.url);
    const planHandle = url.searchParams.get("plan_handle");

    if (planHandle) {
        console.log(`[Shopify App Pricing] Returned with plan_handle="${planHandle}". Verifying...`);

        try {
            await verifyAndSyncSubscription({
                admin,
                shop: session.shop,
                candidatePlanHandle: planHandle,
            });
        } catch (error) {
            console.error("[Shopify App Pricing] Verification error:", error);
        }


        return redirect("/app/plans");
    }

    const [{ subscription, plan, planKey }, usage] = await Promise.all([
        getShopPlan(session.shop),
        getCurrentUsage(session.shop),
    ]);

    return {
        subscription,
        plan,
        planKey,
        usage,
        isDev: process.env.NODE_ENV !== "production",
    };
};

export const action = async ({ request }) => {
    const { session, redirect } = await authenticate.admin(request);

    const formData = await request.formData();
    const isDevOverride = formData.get("_devOverride") === "true";

    // ── Dev-mode plan override (never runs in production) ──────────────────
    if (isDevOverride && process.env.NODE_ENV !== "production") {
        const planKey = formData.get("plan");
        console.log(`[DevOverride] Setting plan for ${session.shop} → ${planKey}`);
        await updateShopSubscription(session.shop, {
            planKey,
            status: "ACTIVE",
            shopifySubscriptionId: null,
        });
        return redirect("/app/plans");
    }

    const storeHandle = session.shop.replace(".myshopify.com", "");
    const appHandle = "free-shipping-booster";

    const pricingPlansUrl = `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;

    console.log(`[Shopify App Pricing] Redirecting ${session.shop} to hosted pricing page: ${pricingPlansUrl}`);


    return redirect(pricingPlansUrl, { target: "_top" });
};

export default function Plans() {
    const { subscription, plan, planKey, usage, isDev } = useLoaderData();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    const plans = [
        {
            key: "FREE",
            name: "Free",
            price: 0,
            views: "1,000",
            description: "Get started with essential free shipping tools.",
            features: [
                "1,000 monthly booster views",
                "Unlimited top bar boosters",
                "Unlimited product page boosters",
                "1 cart drawer booster",
            ],
        },
        {
            key: "STARTER",
            name: "Starter",
            price: 9.99,
            views: "10,000",
            description: "Reach more customers with advanced targeting.",
            trial: true,
            features: [
                "Everything in Free",
                "10,000 monthly booster views",
                "1 cart drawer booster",
                "Geolocation targeting",
                "Exclude specific products",
            ],
        },
        {
            key: "ESSENTIAL",
            name: "Essential",
            price: 14.99,
            views: "50,000",
            description: "Turn more visitors into paying customers.",
            trial: true,
            popular: true,
            features: [
                "Everything in Starter",
                "50,000 monthly booster views",
                "Unlimited cart drawer boosters",
                "Upsell products",
                "Analytics dashboard",
            ],
        },
        {
            key: "PROFESSIONAL",
            name: "Professional",
            price: 29.99,
            views: "Unlimited",
            description: "Unlock the complete growth toolkit.",
            features: [
                "Everything in Essential",
                "Unlimited monthly booster views",
                "All premium features",
            ],
        },
    ];

    const currentViews = usage?.views || 0;
    const viewLimitText = plan.monthlyViewLimit === Infinity || plan.monthlyViewLimit === null
        ? "Unlimited views"
        : `${plan.monthlyViewLimit.toLocaleString()} views/month`;

    return (
        <div style={{
            padding: "32px 24px 48px",
            maxWidth: "1400px",
            margin: "0 auto",
            color: "#202223",
        }}>
            {/* Page Header */}
            <div style={{
                textAlign: "center",
                marginBottom: "36px",
            }}>

                <h1 style={{
                    fontSize: "32px",
                    fontWeight: "700",
                    letterSpacing: "-1px",
                    margin: "0 0 12px",
                }}>
                    Choose the right plan for your store
                </h1>

                <p style={{
                    color: "#6d7175",
                    fontSize: "15px",
                    maxWidth: "550px",
                    margin: "0 auto",
                    lineHeight: "1.6",
                }}>
                    Start free and upgrade as your business grows.
                    Subscriptions and billing are securely managed directly through Shopify.
                </p>
            </div>

            {/* Current Plan & Usage Banner */}
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "16px",
                background: "#f6f6f7",
                border: "1px solid #e3e3e3",
                borderRadius: "12px",
                padding: "16px 20px",
                marginBottom: "32px",
            }}>
                <div>
                    <p style={{
                        fontSize: "12px",
                        color: "#6d7175",
                        margin: "0 0 4px",
                    }}>
                        YOUR CURRENT SUBSCRIPTION
                    </p>

                    <div style={{
                        fontSize: "17px",
                        fontWeight: "700",
                    }}>
                        {plan.name} Plan
                    </div>
                </div>

                <div style={{
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "14px",
                }}>
                    <span style={{
                        background: "#dff5e5",
                        color: "#167c3a",
                        padding: "5px 12px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: "600",
                    }}>
                        {subscription.status}
                    </span>

                    <span style={{
                        fontSize: "13px",
                        color: "#6d7175",
                    }}>
                        Views this month: <strong style={{ color: "#202223" }}>{currentViews.toLocaleString()}</strong> / {viewLimitText}
                    </span>
                </div>
            </div>

            {/* Pricing Cards */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(245px, 1fr))",
                gap: "20px",
                alignItems: "stretch",
            }}>
                {plans.map((item) => {
                    const isCurrent = planKey === item.key;

                    return (
                        <div
                            key={item.key}
                            style={{
                                position: "relative",
                                display: "flex",
                                flexDirection: "column",
                                background: "#ffffff",
                                border: item.popular
                                    ? "2px solid #303030"
                                    : "1px solid #e3e3e3",
                                borderRadius: "14px",
                                padding: "26px 22px 22px",
                                boxShadow: item.popular
                                    ? "0 5px 20px rgba(0,0,0,0.08)"
                                    : "0 2px 8px rgba(0,0,0,0.03)",
                            }}
                        >
                            {item.popular && (
                                <div style={{
                                    position: "absolute",
                                    top: "-13px",
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                    background: "#303030",
                                    color: "#ffffff",
                                    padding: "5px 14px",
                                    borderRadius: "20px",
                                    fontSize: "11px",
                                    fontWeight: "700",
                                    whiteSpace: "nowrap",
                                }}>
                                    MOST POPULAR
                                </div>
                            )}

                            {/* Plan Name */}
                            <div style={{
                                fontSize: "20px",
                                fontWeight: "700",
                                marginBottom: "8px",
                            }}>
                                {item.name}
                            </div>

                            <p style={{
                                color: "#6d7175",
                                fontSize: "13px",
                                lineHeight: "1.5",
                                minHeight: "40px",
                                margin: "0 0 22px",
                            }}>
                                {item.description}
                            </p>

                            {/* Price */}
                            <div style={{
                                display: "flex",
                                alignItems: "baseline",
                                gap: "4px",
                                marginBottom: "6px",
                            }}>
                                <span style={{
                                    fontSize: "36px",
                                    fontWeight: "750",
                                    letterSpacing: "-1.5px",
                                }}>
                                    ${item.price === 0 ? "0" : item.price.toFixed(2)}
                                </span>

                                <span style={{
                                    color: "#6d7175",
                                    fontSize: "13px",
                                }}>
                                    / month
                                </span>
                            </div>

                            {item.trial ? (
                                <div style={{
                                    color: "#167c3a",
                                    fontSize: "12px",
                                    fontWeight: "600",
                                    marginBottom: "20px",
                                }}>
                                    7-day free trial included
                                </div>
                            ) : (
                                <div style={{
                                    color: "#6d7175",
                                    fontSize: "12px",
                                    marginBottom: "20px",
                                }}>
                                    {item.price === 0 ? "No credit card required" : "Standard monthly billing"}
                                </div>
                            )}

                            {/* Monthly Views */}
                            <div style={{
                                background: "#f6f6f7",
                                borderRadius: "9px",
                                padding: "13px",
                                marginBottom: "22px",
                            }}>
                                <div style={{
                                    fontSize: "11px",
                                    color: "#6d7175",
                                    marginBottom: "4px",
                                }}>
                                    MONTHLY BOOSTER VIEWS
                                </div>

                                <div style={{
                                    fontSize: "17px",
                                    fontWeight: "700",
                                }}>
                                    {item.views}
                                </div>
                            </div>

                            {/* Features */}
                            <div style={{
                                fontSize: "13px",
                                fontWeight: "700",
                                marginBottom: "14px",
                            }}>
                                What's included
                            </div>

                            <ul style={{
                                listStyle: "none",
                                padding: 0,
                                margin: "0 0 26px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "13px",
                                flex: 1,
                            }}>
                                {item.features.map((feature) => (
                                    <li
                                        key={feature}
                                        style={{
                                            display: "flex",
                                            alignItems: "flex-start",
                                            gap: "9px",
                                            fontSize: "13px",
                                            color: "#444",
                                            lineHeight: "1.5",
                                        }}
                                    >
                                        <span style={{
                                            color: "#16803c",
                                            fontWeight: "700",
                                            fontSize: "15px",
                                            lineHeight: "1.2",
                                        }}>
                                            ✓
                                        </span>

                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            {/* Plan Action Button */}
                            <div className="mt-auto pt-8">
                                <Form method="post">
                                    <input
                                        type="hidden"
                                        name="plan"
                                        value={item.key}
                                    />

                                    <button
                                        type="submit"
                                        disabled={isCurrent || isSubmitting}
                                        className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition ${isCurrent
                                            ? "cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-500"
                                            : isSubmitting
                                                ? "cursor-wait bg-gray-400 text-white"
                                                : "bg-gray-900 text-white hover:bg-gray-700"
                                            }`}
                                    >
                                        {isCurrent
                                            ? "Current Plan"
                                            : isSubmitting
                                                ? "Opening Shopify Billing..."
                                                : "Choose " + item.name}
                                    </button>
                                </Form>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer */}
            <div style={{
                textAlign: "center",
                marginTop: "36px",
                color: "#6d7175",
                fontSize: "12px",
                lineHeight: "1.6",
            }}>
                Subscriptions are managed directly by Shopify.
                You can upgrade, downgrade, or cancel anytime from your store admin.
            </div>

            {/* Dev-Mode */}
            {isDev && (
                <div style={{
                    marginTop: "48px",

                    borderRadius: "14px",
                    padding: "24px",

                }}>



                    <div style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "10px",
                    }}>
                        {[
                            { key: "FREE", label: "Free", color: "#6b7280" },
                            { key: "STARTER", label: "Starter $9.99", color: "#6b7280" },
                            { key: "ESSENTIAL", label: "Essential $14.99", color: "#6b7280" },
                            { key: "PROFESSIONAL", label: "Professional $29.99", color: "#6b7280" },
                        ].map((p) => {
                            const isActive = planKey === p.key;
                            return (
                                <Form key={p.key} method="post">
                                    <input type="hidden" name="_devOverride" value="true" />
                                    <input type="hidden" name="plan" value={p.key} />
                                    <button
                                        type="submit"
                                        disabled={isActive || isSubmitting}
                                        style={{
                                            padding: "9px 18px",
                                            borderRadius: "9px",
                                            border: isActive
                                                ? `2px solid ${p.color}`
                                                : "2px solid transparent",
                                            background: isActive ? "#fff" : p.color,
                                            color: isActive ? p.color : "#fff",
                                            fontWeight: "700",
                                            fontSize: "13px",
                                            cursor: isActive ? "default" : "pointer",
                                            opacity: isSubmitting ? 0.6 : 1,
                                            transition: "all 0.15s",
                                        }}
                                    >
                                        {isActive ? `✓ ${p.label} (active)` : `Set ${p.label}`}
                                    </button>
                                </Form>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
