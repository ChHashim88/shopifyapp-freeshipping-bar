import {
    Link,
    useLoaderData,
    useSearchParams,
} from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import {
    isFeatureAllowed,
    getShopPlan,
    getCurrentUsage,
    getCurrentMonthPeriod,
} from "../utils/plan.server";
import countries from "i18n-iso-countries";
import enCountries from "i18n-iso-countries/langs/en.json";

countries.registerLocale(enCountries);

export async function loader({ request }) {
    const { session } = await authenticate.admin(request);

    // Check if active plan permits analytics dashboard
    const hasAnalytics = await isFeatureAllowed(session.shop, "analytics");
    const [{ plan, planKey, subscription }, usage] = await Promise.all([
        getShopPlan(session.shop),
        getCurrentUsage(session.shop),
    ]);

    if (!hasAnalytics) {
        return {
            isLocked: true,
            plan,
            planKey,
        };
    }

    const url = new URL(request.url);

    const range = url.searchParams.get("range") || "30d";
    const barId = url.searchParams.get("bar_id") || "all";

    // Compute start and end date
    let startDate = null;
    let endDate = null;
    const now = new Date();
    if (range === "7d") {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (range === "30d") {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (range === "90d") {
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else if (range === "month") {
        const subscriptionDate = subscription?.currentPeriodStart || subscription?.createdAt;
        const period = getCurrentMonthPeriod(subscriptionDate);
        startDate = period.periodStart;
        endDate = period.periodEnd;
    }

    // Fetch all bars for this shop
    const rawBars = await db.freeShippingSettings.findMany({
        where: { shop: session.shop },
        select: {
            id: true,
            name: true,
            enabled: true,
            goal: true,
            positions: true,
        },
        orderBy: { createdAt: "desc" },
    });

    const bars = rawBars.map((b) => {
        let pos = [];
        try {
            pos = typeof b.positions === "string" ? JSON.parse(b.positions) : b.positions;
        } catch {
            pos = [];
        }
        return {
            ...b,
            positions: Array.isArray(pos) ? pos : [],
        };
    });

    // Query events
    const whereClause = {
        shop: session.shop,
        ...(barId && barId !== "all" ? { barId } : {}),
        ...(startDate || endDate
            ? {
                createdAt: {
                    ...(startDate ? { gte: startDate } : {}),
                    ...(endDate ? { lt: endDate } : {}),
                },
            }
            : {}),
    };

    const events = await db.analyticsEvent.findMany({
        where: whereClause,
        select: {
            id: true,
            barId: true,
            eventType: true,
            countryCode: true,
            metadata: true,
            createdAt: true,
        },
        orderBy: { createdAt: "asc" },
    });

    // Calculate metrics
    let totalViews = 0;
    let totalClicks = 0;
    let totalNormalAdds = 0;
    let totalUpsellClicks = 0;
    let totalUpsellAdds = 0;
    let totalGoalsReached = 0;

    // Track per bar
    const barStatsMap = {};
    bars.forEach((b) => {
        barStatsMap[b.id] = {
            id: b.id,
            name: b.name,
            enabled: b.enabled,
            goal: b.goal,
            positions: b.positions,
            views: 0,
            clicks: 0,
            normalAdds: 0,
            upsellClicks: 0,
            upsellAdds: 0,
            goalsReached: 0,
        };
    });

    // Daily map for timeline
    const dailyMap = {};
    // Top countries map
    const countryMap = {};
    // Placement map
    const placementMap = { inline: 0, cart_drawer: 0 };

    events.forEach((ev) => {
        const type = ev.eventType;
        if (type === "bar_view") totalViews++;
        else if (type === "bar_click") totalClicks++;
        else if (type === "add_to_cart") totalNormalAdds++;
        else if (type === "upsell_click") totalUpsellClicks++;
        else if (type === "upsell_add_to_cart") totalUpsellAdds++;
        else if (type === "cart_goal_reached") totalGoalsReached++;

        // Per bar
        if (barStatsMap[ev.barId]) {
            const bStat = barStatsMap[ev.barId];
            if (type === "bar_view") bStat.views++;
            else if (type === "bar_click") bStat.clicks++;
            else if (type === "add_to_cart") bStat.normalAdds++;
            else if (type === "upsell_click") bStat.upsellClicks++;
            else if (type === "upsell_add_to_cart") bStat.upsellAdds++;
            else if (type === "cart_goal_reached") bStat.goalsReached++;
        }

        // Daily breakdown: YYYY-MM-DD
        const dateStr = ev.createdAt.toISOString().slice(0, 10);
        if (!dailyMap[dateStr]) {
            dailyMap[dateStr] = {
                date: dateStr,
                views: 0,
                normalAdds: 0,
                upsellAdds: 0,
                goalsReached: 0,
            };
        }
        if (type === "bar_view") dailyMap[dateStr].views++;
        else if (type === "add_to_cart") dailyMap[dateStr].normalAdds++;
        else if (type === "upsell_add_to_cart") dailyMap[dateStr].upsellAdds++;
        else if (type === "cart_goal_reached") dailyMap[dateStr].goalsReached++;

        // Country: only count valid bar_view impressions
        if (type === "bar_view") {
            const c = ev.countryCode ? ev.countryCode.toUpperCase().trim() : "UNKNOWN";
            countryMap[c] = (countryMap[c] || 0) + 1;
        }

        // Placement
        if (type === "bar_view") {
            if (ev.metadata && ev.metadata.includes("cart_drawer")) {
                placementMap.cart_drawer++;
            } else {
                placementMap.inline++;
            }
        }
    });

    // Calculate conversion rates
    const upsellConversionRate =
        totalUpsellClicks > 0
            ? Number(((totalUpsellAdds / totalUpsellClicks) * 100).toFixed(1))
            : 0;

    const goalReachedRate =
        totalViews > 0
            ? Number(((totalGoalsReached / totalViews) * 100).toFixed(1))
            : 0;

    const perBarStats = Object.values(barStatsMap).map((b) => ({
        ...b,
        conversionRate:
            b.upsellClicks > 0
                ? Number(((b.upsellAdds / b.upsellClicks) * 100).toFixed(1))
                : 0,
    }));

    // Sort daily trends
    const dailyTrends = Object.values(dailyMap).sort((a, b) =>
        a.date.localeCompare(b.date)
    );

    // Top countries
    const topCountries = Object.entries(countryMap)
        .map(([code, count]) => {
            const isUnknown = code === "UNKNOWN";
            const name = isUnknown
                ? "Unknown Location"
                : countries.getName(code, "en") || code;
            return {
                code,
                name,
                count,
            };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    const monthlyViews = usage?.views || 0;
    const monthlyLimit = plan.monthlyViewLimit;
    const viewLimitText =
        monthlyLimit === Infinity || monthlyLimit === null
            ? "Unlimited"
            : monthlyLimit.toLocaleString();

    return {
        bars,
        selectedRange: range,
        selectedBarId: barId,
        metrics: {
            totalViews,
            totalClicks,
            totalNormalAdds,
            totalUpsellClicks,
            totalUpsellAdds,
            totalGoalsReached,
            upsellConversionRate,
            goalReachedRate,
        },
        monthlyUsage: {
            views: monthlyViews,
            limit: monthlyLimit,
            limitText: viewLimitText,
        },
        perBarStats,
        dailyTrends,
        topCountries,
        placementStats: placementMap,
    };
}

export default function Analytics() {
    const data = useLoaderData();

    if (data.isLocked) {
        return (
            <s-page heading="Analytics">
                <div className="mx-auto max-w-2xl py-12 text-center">
                    <div className="rounded-2xl border border-gray-200 bg-white p-10 shadow-sm">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl">
                            📊
                        </div>
                        <h2 className="mb-2 text-2xl font-bold text-gray-900">
                            Analytics Dashboard is Locked
                        </h2>
                        <p className="mx-auto mb-6 max-w-md text-sm text-gray-600">
                            Your store is currently on the <strong>{data.plan.name}</strong> plan.
                            Upgrade to the <strong>Essential</strong> or <strong>Professional</strong> plan to unlock conversion metrics, click tracking, cart revenue impact, and country analytics.
                        </p>
                        <div className="flex justify-center gap-3">
                            <Link
                                to="/app/plans"
                                className="rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-700"
                            >
                                View Plans & Upgrade
                            </Link>
                        </div>
                    </div>
                </div>
            </s-page>
        );
    }

    const {
        bars,
        selectedRange,
        selectedBarId,
        metrics,
        monthlyUsage,
        perBarStats,
        dailyTrends,
        topCountries,
        placementStats,
    } = data;

    const [, setSearchParams] = useSearchParams();

    const handleRangeChange = (newRange) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set("range", newRange);
            return next;
        });
    };

    const handleBarChange = (newBarId) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (newBarId === "all") {
                next.delete("bar_id");
            } else {
                next.set("bar_id", newBarId);
            }
            return next;
        });
    };

    // Find max daily values for SVG chart scaling
    const maxDailyValue = Math.max(
        1,
        ...dailyTrends.map((d) =>
            Math.max(d.views, d.normalAdds, d.goalsReached, d.upsellAdds)
        )
    );

    const totalPlacements =
        placementStats.inline + placementStats.cart_drawer || 1;
    const inlinePct = Math.round(
        (placementStats.inline / totalPlacements) * 100
    );
    const drawerPct = Math.round(
        (placementStats.cart_drawer / totalPlacements) * 100
    );

    return (
        <s-page heading="Analytics">
            <div className="mx-auto max-w-6xl space-y-6 pb-16">
                {/* Header Banner */}
                <div className="flex flex-col justify-between gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-900 text-2xl text-white shadow-inner">
                            <span>📊</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">
                                Analytics & Insights
                            </h1>
                            <p className="text-sm text-gray-500">
                                Track impressions, normal cart additions, and upsell performance.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2 text-right">
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                                Views This Month
                            </div>
                            <div className="text-sm font-bold text-gray-900">
                                {monthlyUsage?.views?.toLocaleString() ?? 0} / {monthlyUsage?.limitText ?? "Unlimited"}
                            </div>
                        </div>
                        <Link
                            to="/app"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
                        >
                            <span>← All Bars</span>
                        </Link>
                    </div>
                </div>

                {/* Filters Toolbar */}
                <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    {/* Time Range Pills */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="mr-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Range:
                        </span>
                        {[
                            { id: "7d", label: "Last 7 Days" },
                            { id: "30d", label: "Last 30 Days" },
                            { id: "90d", label: "Last 90 Days" },
                            { id: "month", label: "This Month" },
                            { id: "all", label: "All Time" },
                        ].map((tab) => {
                            const active = selectedRange === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => handleRangeChange(tab.id)}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${active
                                            ? "bg-gray-900 text-white shadow-sm"
                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Bar Filter Dropdown */}
                    <div className="flex items-center gap-2">
                        <label
                            htmlFor="bar-filter-select"
                            className="text-xs font-semibold text-gray-500 uppercase tracking-wider"
                        >
                            Bar:
                        </label>
                        <select
                            id="bar-filter-select"
                            value={selectedBarId}
                            onChange={(e) => handleBarChange(e.target.value)}
                            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 shadow-sm transition focus:border-gray-900 focus:outline-none"
                        >
                            <option value="all">All Bars ({bars.length})</option>
                            {bars.map((bar) => (
                                <option key={bar.id} value={bar.id}>
                                    {bar.name || "Untitled Bar"} {bar.enabled ? "" : "(Disabled)"}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* KPI Stat Cards (5 Column Grid) */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    {/* Total Impressions */}
                    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                                Impressions
                            </span>
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-base text-blue-600">
                                👁️
                            </span>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-3xl font-extrabold text-gray-900">
                                {metrics.totalViews.toLocaleString()}
                            </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                            Times a bar was viewed
                        </p>
                    </div>

                    {/* Normal Add to Cart */}
                    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                                Normal Add-to-Cart
                            </span>
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-base text-emerald-600">
                                🛍️
                            </span>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-3xl font-extrabold text-gray-900">
                                {metrics.totalNormalAdds.toLocaleString()}
                            </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                            Regular product additions
                        </p>
                    </div>

                    {/* Upsell Add to Cart */}
                    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                                Upsell Add-to-Cart
                            </span>
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-base text-purple-600">
                                🎁
                            </span>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-3xl font-extrabold text-gray-900">
                                {metrics.totalUpsellAdds.toLocaleString()}
                            </span>
                            <span className="text-xs text-gray-500">
                                ({metrics.totalUpsellClicks} clicks)
                            </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                            Added via bar carousel
                        </p>
                    </div>

                    {/* Upsell Conversion Rate */}
                    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                                Upsell Conv. Rate
                            </span>
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-base text-amber-600">
                                📈
                            </span>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-3xl font-extrabold text-gray-900">
                                {metrics.upsellConversionRate}%
                            </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                            Upsell clicks to carts
                        </p>
                    </div>

                    {/* Goals Reached */}
                    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                                Goals Unlocked
                            </span>
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-base text-green-600">
                                🎯
                            </span>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-3xl font-extrabold text-gray-900">
                                {metrics.totalGoalsReached.toLocaleString()}
                            </span>
                            <span className="text-xs font-semibold text-green-600">
                                ({metrics.goalReachedRate}%)
                            </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                            Free shipping goal reached
                        </p>
                    </div>
                </div>

                {/* Daily Timeline Activity Chart */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                        <div>
                            <h2 className="text-base font-bold text-gray-900">
                                Activity Over Time
                            </h2>
                            <p className="text-xs text-gray-500">
                                Daily comparison of impressions, normal additions, upsell conversions, and unlocked goals.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-gray-600">
                            <span className="flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 rounded-full bg-blue-500"></span>
                                Impressions
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                                Normal Adds
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 rounded-full bg-purple-500"></span>
                                Upsell Adds
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 rounded-full bg-green-500"></span>
                                Goals Unlocked
                            </span>
                        </div>
                    </div>

                    {dailyTrends.length === 0 ? (
                        <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center">
                            <span className="text-2xl">📉</span>
                            <p className="mt-2 text-sm font-semibold text-gray-700">
                                No activity recorded in this period
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                                Storefront impressions and interactions will appear here automatically.
                            </p>
                        </div>
                    ) : (
                        <div className="mt-6">
                            {/* Responsive Bar Chart */}
                            <div className="flex h-44 items-end gap-2 border-b border-gray-200 pb-2">
                                {dailyTrends.map((d) => {
                                    const viewH = Math.max(4, Math.round((d.views / maxDailyValue) * 100));
                                    const normalH = Math.max(2, Math.round((d.normalAdds / maxDailyValue) * 100));
                                    const upsellH = Math.max(2, Math.round((d.upsellAdds / maxDailyValue) * 100));
                                    const goalH = Math.max(2, Math.round((d.goalsReached / maxDailyValue) * 100));

                                    return (
                                        <div
                                            key={d.date}
                                            className="group relative flex flex-1 flex-col items-center justify-end gap-1 h-full"
                                        >
                                            {/* Tooltip */}
                                            <div className="pointer-events-none absolute bottom-full mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg group-hover:block z-20">
                                                <div className="font-bold">{d.date}</div>
                                                <div>Views: {d.views}</div>
                                                <div>Normal Adds: {d.normalAdds}</div>
                                                <div>Upsell Adds: {d.upsellAdds}</div>
                                                <div>Goals Unlocked: {d.goalsReached}</div>
                                            </div>

                                            {/* Stacked bars */}
                                            <div className="flex w-full max-w-[36px] items-end justify-center gap-0.5 h-full">
                                                <div
                                                    style={{ height: `${viewH}%` }}
                                                    className="w-1/4 rounded-t bg-blue-500/90 transition-all hover:bg-blue-600"
                                                ></div>
                                                <div
                                                    style={{ height: `${normalH}%` }}
                                                    className="w-1/4 rounded-t bg-emerald-500/90 transition-all hover:bg-emerald-600"
                                                ></div>
                                                <div
                                                    style={{ height: `${upsellH}%` }}
                                                    className="w-1/4 rounded-t bg-purple-500/90 transition-all hover:bg-purple-600"
                                                ></div>
                                                <div
                                                    style={{ height: `${goalH}%` }}
                                                    className="w-1/4 rounded-t bg-green-500/90 transition-all hover:bg-green-600"
                                                ></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Date Labels */}
                            <div className="mt-2 flex justify-between text-[10px] text-gray-400">
                                <span>{dailyTrends[0]?.date}</span>
                                {dailyTrends.length > 2 && (
                                    <span>
                                        {dailyTrends[Math.floor(dailyTrends.length / 2)]?.date}
                                    </span>
                                )}
                                <span>{dailyTrends[dailyTrends.length - 1]?.date}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Per-Bar Breakdown Table */}
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                    <div className="border-b border-gray-200 p-5">
                        <h2 className="text-base font-bold text-gray-900">
                            Individual Bar Performance
                        </h2>
                        <p className="text-xs text-gray-500">
                            Breakdown of normal additions vs. upsell carousel performance for each bar.
                        </p>
                    </div>

                    {perBarStats.length === 0 ? (
                        <div className="p-8 text-center text-sm text-gray-500">
                            No free shipping bars found. Create your first bar in the dashboard.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-700">
                                <thead className="border-b border-gray-200 bg-gray-50/75 text-xs uppercase text-gray-500 font-semibold">
                                    <tr>
                                        <th scope="col" className="px-5 py-3.5">
                                            Bar Name
                                        </th>
                                        <th scope="col" className="px-4 py-3.5">
                                            Status
                                        </th>
                                        <th scope="col" className="px-4 py-3.5">
                                            Goal
                                        </th>
                                        <th scope="col" className="px-4 py-3.5 text-right">
                                            Views
                                        </th>
                                        <th scope="col" className="px-4 py-3.5 text-right text-emerald-700">
                                            Normal Adds
                                        </th>
                                        <th scope="col" className="px-4 py-3.5 text-right">
                                            Upsell Clicks
                                        </th>
                                        <th scope="col" className="px-4 py-3.5 text-right text-purple-700">
                                            Upsell Adds
                                        </th>
                                        <th scope="col" className="px-4 py-3.5 text-right">
                                            Upsell Conv.
                                        </th>
                                        <th scope="col" className="px-4 py-3.5 text-right text-green-700">
                                            Goals Unlocked
                                        </th>

                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {perBarStats.map((bar) => (
                                        <tr
                                            key={bar.id}
                                            className="transition hover:bg-gray-50/80"
                                        >
                                            <td className="px-5 py-4">
                                                <div className="font-semibold text-gray-900">
                                                    {bar.name || "Untitled Bar"}
                                                </div>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {bar.positions.map((p) => (
                                                        <span
                                                            key={p}
                                                            className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600"
                                                        >
                                                            {p}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>

                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <span
                                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${bar.enabled
                                                            ? "bg-green-100 text-green-800"
                                                            : "bg-gray-100 text-gray-600"
                                                        }`}
                                                >
                                                    <span
                                                        className={`h-1.5 w-1.5 rounded-full ${bar.enabled ? "bg-green-600" : "bg-gray-400"
                                                            }`}
                                                    ></span>
                                                    {bar.enabled ? "Active" : "Disabled"}
                                                </span>
                                            </td>

                                            <td className="px-4 py-4 whitespace-nowrap font-medium text-gray-900">
                                                ${bar.goal}
                                            </td>

                                            <td className="px-4 py-4 text-right font-medium text-gray-900">
                                                {bar.views.toLocaleString()}
                                            </td>

                                            <td className="px-4 py-4 text-right font-semibold text-emerald-700">
                                                {bar.normalAdds.toLocaleString()}
                                            </td>

                                            <td className="px-4 py-4 text-right text-gray-600">
                                                {bar.upsellClicks.toLocaleString()}
                                            </td>

                                            <td className="px-4 py-4 text-right font-semibold text-purple-700">
                                                {bar.upsellAdds.toLocaleString()}
                                            </td>

                                            <td className="px-4 py-4 text-right font-medium text-gray-900">
                                                {bar.conversionRate}%
                                            </td>

                                            <td className="px-4 py-4 text-right font-semibold text-green-700">
                                                {bar.goalsReached.toLocaleString()}
                                            </td>


                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Secondary Insights (Countries + Placements) */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {/* Top Countries */}
                    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-900">
                            Top Customer Countries
                        </h3>
                        <p className="mt-0.5 text-xs text-gray-500">
                            Where your storefront impressions originate.
                        </p>

                        {topCountries.length === 0 ? (
                            <p className="mt-6 text-xs text-gray-400 italic">
                                No geolocation data recorded yet.
                            </p>
                        ) : (
                            <div className="mt-4 space-y-3">
                                {topCountries.map((c) => {
                                    const pct = metrics.totalViews > 0
                                        ? Math.min(100, Math.round((c.count / metrics.totalViews) * 100))
                                        : 0;
                                    return (
                                        <div key={c.code} className="space-y-1">
                                            <div className="flex justify-between text-xs font-medium">
                                                <span className="text-gray-800 font-semibold">
                                                    🌐 {c.name} {c.code !== "UNKNOWN" && c.name !== c.code ? `(${c.code})` : ""}
                                                </span>
                                                <span className="text-gray-500">
                                                    {c.count.toLocaleString()} views ({pct}%)
                                                </span>
                                            </div>
                                            <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                                                <div
                                                    style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                                                    className="h-full rounded-full bg-blue-500"
                                                ></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Placement Distribution */}
                    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-900">
                            Display Placement Breakdown
                        </h3>
                        <p className="mt-0.5 text-xs text-gray-500">
                            Comparison between inline bars and cart drawer impressions.
                        </p>

                        <div className="mt-4 space-y-4">
                            <div>
                                <div className="flex justify-between text-xs font-medium">
                                    <span className="text-gray-800 font-semibold">
                                        Inline Bars (Announcement / Product)
                                    </span>
                                    <span className="text-gray-500">
                                        {placementStats.inline.toLocaleString()} views ({inlinePct}%)
                                    </span>
                                </div>
                                <div className="mt-1 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                                    <div
                                        style={{ width: `${inlinePct}%` }}
                                        className="h-full rounded-full bg-blue-500"
                                    ></div>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-xs font-medium">
                                    <span className="text-gray-800 font-semibold">
                                        Cart Drawer Bars
                                    </span>
                                    <span className="text-gray-500">
                                        {placementStats.cart_drawer.toLocaleString()} views ({drawerPct}%)
                                    </span>
                                </div>
                                <div className="mt-1 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                                    <div
                                        style={{ width: `${drawerPct}%` }}
                                        className="h-full rounded-full bg-amber-500"
                                    ></div>
                                </div>
                            </div>

                            <div className="mt-4 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                                💡 <strong>Tip:</strong> If you see higher engagement inside the Cart Drawer, consider highlighting upsell products there.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </s-page>
    );
}
