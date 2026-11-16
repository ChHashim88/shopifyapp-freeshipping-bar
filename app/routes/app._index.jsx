import { useState } from "react";
import {
  Link,
  useLoaderData,
  Form,
  useNavigation,
  useActionData,
  redirect,
} from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { checkMonthlyViewLimit, getShopPlan } from "../utils/plan.server";

const ALLOWED_POSITIONS = [
  "Announcement bar",
  "Product page",
  "Cart drawer",
];

function parsePositions(value) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (Array.isArray(parsed)) {
      return parsed.filter((pos) => ALLOWED_POSITIONS.includes(pos));
    }
  } catch (error) {
    console.error("Unable to parse positions:", error);
  }
  return ["Product page"];
}

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);

  // Check monthly booster view limits before loading dashboard
  const [viewCheck, { wasDowngraded }] = await Promise.all([
    checkMonthlyViewLimit(session.shop),
    getShopPlan(session.shop),
  ]);

  if (!viewCheck.allowed) {
    return {
      isLocked: true,
      usageInfo: viewCheck,
      bars: [],
      wasDowngraded: false,
    };
  }

  const rawBars = await db.freeShippingSettings.findMany({
    where: {
      shop: session.shop,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const bars = rawBars.map((bar) => ({
    ...bar,
    positions: parsePositions(bar.positions),
  }));

  return { isLocked: false, usageInfo: viewCheck, bars, wasDowngraded };
}

export async function action({ request }) {
  const { session } = await authenticate.admin(request);

  // Prevent any bar management actions if monthly view limit is reached
  const viewCheck = await checkMonthlyViewLimit(session.shop);
  if (!viewCheck.allowed) {
    return {
      success: false,
      error: "Your monthly view limit has been reached. Please upgrade your plan to manage bars.",
    };
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const count = await db.freeShippingSettings.count({
      where: { shop: session.shop },
    });

    const newBar = await db.freeShippingSettings.create({
      data: {
        shop: session.shop,
        name: `Free Shipping Bar #${count + 1}`,
      },
    });

    return redirect(`/app/bars/${newBar.id}`);
  }

  if (intent === "duplicate") {
    const id = formData.get("id");
    const sourceBar = await db.freeShippingSettings.findFirst({
      where: { id, shop: session.shop },
    });

    if (!sourceBar) {
      return { success: false, error: "Bar not found." };
    }

    // eslint-disable-next-line no-unused-vars
    const { id: _id, createdAt: _c, updatedAt: _u, ...dataToCopy } = sourceBar;

    const copy = await db.freeShippingSettings.create({
      data: {
        ...dataToCopy,
        name: `${sourceBar.name || "Free Shipping Bar"} (Copy)`,
      },
    });

    return redirect(`/app/bars/${copy.id}`);
  }

  if (intent === "delete") {
    const id = formData.get("id");
    await db.freeShippingSettings.deleteMany({
      where: {
        id,
        shop: session.shop,
      },
    });

    return { success: true, message: "Free shipping bar deleted." };
  }

  if (intent === "toggle") {
    const id = formData.get("id");
    const enabled = formData.get("enabled") === "true";

    await db.freeShippingSettings.updateMany({
      where: {
        id,
        shop: session.shop,
      },
      data: {
        enabled,
      },
    });

    return { success: true };
  }

  // Fallback to safely handle any legacy single-bar save attempts without upsert()
  const firstBar = await db.freeShippingSettings.findFirst({
    where: { shop: session.shop },
  });

  const goal = Number(formData.get("goal"));
  const validGoal = Number.isFinite(goal) && goal > 0 ? goal : 50;

  const positions = formData
    .getAll("positions")
    .filter((pos) => ALLOWED_POSITIONS.includes(pos));

  const settings = {
    enabled: formData.get("enabled") === "true",
    goal: validGoal,
    positions: JSON.stringify(positions.length > 0 ? positions : ["Product page"]),
    message: String(formData.get("message") || "").slice(0, 250),
    successMessage: String(formData.get("successMessage") || "").slice(0, 250),
    showMessage: formData.get("showMessage") === "true",
    showProgress: formData.get("showProgress") === "true",
    showCartTotal: formData.get("showCartTotal") === "true",
    backgroundColor: String(formData.get("backgroundColor") || "#FFFFFF"),
    progressColor: String(formData.get("progressColor") || "#008060"),
    textColor: String(formData.get("textColor") || "#000000"),
  };

  if (firstBar) {
    await db.freeShippingSettings.update({
      where: { id: firstBar.id },
      data: settings,
    });
  } else {
    await db.freeShippingSettings.create({
      data: {
        shop: session.shop,
        ...settings,
      },
    });
  }

  return { success: true, message: "Settings saved successfully." };
}

export default function FreeShippingBarsList() {
  const { isLocked, usageInfo, bars, wasDowngraded } = useLoaderData();
  const navigation = useNavigation();
  const actionData = useActionData();
  const [copiedId, setCopiedId] = useState(null);
  const [showExpiredModal, setShowExpiredModal] = useState(!!wasDowngraded);

  if (isLocked) {
    return <MonthlyUsageLimitLockout usageInfo={usageInfo} />;
  }

  const isCreating =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "create";

  const activeCount = bars.filter((bar) => bar.enabled).length;

  return (
    <s-page heading="Free Shipping Booster">
      {/* ── Plan Expired Modal ───────────────────────────────────────────── */}
      {showExpiredModal && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
          className="bg-black/50 backdrop-blur-sm"
        >
          <div className="relative mx-4 w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
            {/* Icon */}
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl">
              ⏰
            </div>

            {/* Title */}
            <h2 className="mb-2 text-center text-2xl font-bold text-gray-900">
              Your Plan Has Expired
            </h2>

            {/* Description */}
            <p className="mb-6 text-center text-sm leading-relaxed text-gray-500">
              Your subscription has ended and you've been moved to the{" "}
              <strong className="text-gray-700">Free plan</strong>. Your storefront bars are still active with 1,000 monthly views. Upgrade anytime to restore your previous features.
            </p>

            {/* Detail box */}
            <div className="mb-6 rounded-xl border border-gray-100 bg-gray-50 p-4 text-xs leading-relaxed text-gray-600">
              To unlock geolocation targeting, analytics, upsells, and higher view limits, upgrade your plan.
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-3">
              <Link
                to="/app/plans"
                onClick={() => setShowExpiredModal(false)}
                className="w-full rounded-xl bg-gray-900 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-gray-700 no-underline"
              >
                Manage Plans →
              </Link>
              <button
                type="button"
                onClick={() => setShowExpiredModal(false)}
                className="w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Continue on Free Plan
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-5xl space-y-6 pb-12">
        {/* Top Header Card */}
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-900 text-2xl text-white shadow-inner">
              <span>🚚</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Free Shipping Bars
              </h1>
              <p className="text-sm text-gray-500">
                Create and manage independent free shipping bars for your store.
              </p>
            </div>
          </div>

          <Form method="post">
            <input type="hidden" name="intent" value="create" />
            <button
              type="submit"
              disabled={isCreating}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              <span>+</span>
              <span>{isCreating ? "Creating..." : "Create New Bar"}</span>
            </button>
          </Form>
        </div>

        {/* How to show bars guidance */}
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-xs text-blue-900">
          <p className="font-semibold text-blue-950">💡 How to display multiple bars in your store:</p>
          <ul className="mt-1.5 list-disc pl-4 space-y-1 text-blue-800">
            <li>
              <strong>Automatic by position:</strong> In your Shopify Theme Editor (Customize), add the Free Shipping Bar app block and select a placement (e.g. <em>Announcement bar</em>, <em>Product page</em>, or <em>Cart drawer</em>). The active bar configured for that position displays automatically.
            </li>
            <li>
              <strong>Specific Bar:</strong> Copy any Bar ID below and paste it into the <em>Free Shipping Bar ID</em> setting of a block in your Theme Editor to show that exact bar.
            </li>
          </ul>
        </div>

        {/* Notifications */}
        {actionData?.message && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800">
            {actionData.message}
          </div>
        )}
        {actionData?.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {actionData.error}
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Total Bars
            </span>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {bars.length}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Active Bars
            </span>
            <p className="mt-1 text-2xl font-bold text-green-600">
              {activeCount}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Inactive Bars
            </span>
            <p className="mt-1 text-2xl font-bold text-gray-500">
              {bars.length - activeCount}
            </p>
          </div>
        </div>

        {/* Bars List */}
        {bars.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-3xl">
              📦
            </div>
            <h2 className="mt-4 text-base font-semibold text-gray-900">
              No free shipping bars yet
            </h2>
            <p className="mt-1 max-w-sm text-sm text-gray-500">
              Create your first free shipping bar to encourage shoppers to add
              more items to their cart.
            </p>
            <Form method="post" className="mt-6">
              <input type="hidden" name="intent" value="create" />
              <button
                type="submit"
                disabled={isCreating}
                className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-700 disabled:opacity-60"
              >
                {isCreating ? "Creating..." : "Create your first bar"}
              </button>
            </Form>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">
                Your Free Shipping Bars
              </h2>
            </div>

            <div className="divide-y divide-gray-100">
              {bars.map((bar) => (
                <div
                  key={bar.id}
                  className="flex flex-col gap-4 p-6 transition hover:bg-gray-50/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="font-semibold text-gray-900">
                        {bar.name || "Free Shipping Bar"}
                      </h3>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(bar.id);
                          setCopiedId(bar.id);
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                        title="Click to copy Bar ID for Theme Editor"
                        className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-mono text-gray-600 hover:bg-gray-100 transition"
                      >
                        <span>ID: {bar.id.slice(0, 10)}...</span>
                        <span className="text-gray-400">
                          {copiedId === bar.id ? "✓ Copied" : "📋"}
                        </span>
                      </button>

                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                          bar.enabled
                            ? "border-green-200 bg-green-50 text-green-700"
                            : "border-gray-200 bg-gray-50 text-gray-600"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            bar.enabled ? "bg-green-500" : "bg-gray-400"
                          }`}
                        />
                        {bar.enabled ? "Active" : "Disabled"}
                      </span>

                      {bar.upsellEnabled && (
                        <span className="inline-flex items-center rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                          Upsell active
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span>
                        Goal:{" "}
                        <strong className="text-gray-900">
                          ${Number(bar.goal).toFixed(2)}
                        </strong>
                      </span>

                      {bar.positions && bar.positions.length > 0 && (
                        <span>
                          Locations:{" "}
                          <span className="text-gray-700">
                            {bar.positions.join(", ")}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Form method="post">
                      <input type="hidden" name="intent" value="toggle" />
                      <input type="hidden" name="id" value={bar.id} />
                      <input
                        type="hidden"
                        name="enabled"
                        value={bar.enabled ? "false" : "true"}
                      />
                      <button
                        type="submit"
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
                      >
                        {bar.enabled ? "Disable" : "Enable"}
                      </button>
                    </Form>

                    <Form method="post">
                      <input type="hidden" name="intent" value="duplicate" />
                      <input type="hidden" name="id" value={bar.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
                      >
                        Duplicate
                      </button>
                    </Form>

                    <Form
                      method="post"
                      onSubmit={(e) => {
                        if (
                          !confirm(
                            `Are you sure you want to delete "${
                              bar.name || "this bar"
                            }"?`
                          )
                        ) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="id" value={bar.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm transition hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </Form>

                    <Link
                      to={`/app/bars/${bar.id}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-gray-700"
                    >
                      <span>Edit bar</span>
                      <span>→</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </s-page>
  );
}

function MonthlyUsageLimitLockout({ usageInfo }) {
  const planName = usageInfo?.planName || "Free";
  const viewsUsed = usageInfo?.currentViews?.toLocaleString() ?? "0";
  const limitStr = usageInfo?.limit?.toLocaleString() ?? "0";
  const daysText = `${usageInfo?.daysRemaining ?? 0} ${
    usageInfo?.daysRemaining === 1 ? "day" : "days"
  } remaining`;

  return (
    <s-page heading="Free Shipping Bars">
      <div className="mx-auto max-w-3xl space-y-6 pb-12 pt-4">
        {/* Main Alert Card */}
        <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
          {/* Header area with warning styling */}
          <div className="border-b border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50/40 p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-900">
                <span className="h-2 w-2 rounded-full bg-amber-600 animate-pulse" />
                Usage limit reached
              </span>
            </div>

            <h1 className="mt-4 text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
              Your monthly view limit has been reached
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-600 sm:text-base">
              Your free-shipping bars have been temporarily disabled on your storefront because you've used all your monthly views.
            </p>
          </div>

          {/* Usage Information Grid */}
          <div className="bg-gray-50/70 p-6 sm:p-8">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Usage Information
            </h2>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Current Plan */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs">
                <p className="text-xs font-medium text-gray-500">Current Plan</p>
                <p className="mt-1 text-lg font-bold text-gray-900">{planName}</p>
              </div>

              {/* Monthly Views Used */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs">
                <p className="text-xs font-medium text-gray-500">Monthly Views Used</p>
                <p className="mt-1 text-lg font-bold text-gray-900">
                  {viewsUsed} / {limitStr}
                </p>
              </div>

              {/* Next Reset */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs">
                <p className="text-xs font-medium text-gray-500">Next Reset</p>
                <p className="mt-1 text-lg font-bold text-gray-900">{daysText}</p>
              </div>
            </div>
          </div>

          {/* Upgrade Section */}
          <div className="border-t border-gray-100 bg-white p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xl">
                <h3 className="text-base font-bold text-gray-900">
                  Want to continue using Free Shipping Booster?
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Upgrade your plan to restore your bars immediately and get a higher monthly view allowance.
                </p>
              </div>

              <Link
                to="/app/plans"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800"
              >
                <span>Upgrade Plan</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <p className="text-center text-xs text-gray-500">
          Your bars will automatically become available again when your monthly usage resets if you remain on your current plan.
        </p>
      </div>
    </s-page>
  );
}
