
import { Outlet, Link, NavLink, useLoaderData, useRouteError, useLocation, } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import { getShopPlan, checkMonthlyViewLimit } from "../utils/plan.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const [{ subscription, plan, planKey, daysUntilExpiry, trialInfo }, viewCheck] = await Promise.all([
    getShopPlan(session.shop),
    checkMonthlyViewLimit(session.shop),
  ]);

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    subscription,
    plan,
    planKey,
    daysRemaining: viewCheck?.daysRemaining ?? null,
    daysUntilExpiry,
    trialInfo,
  };
};

export default function App() {
  const { apiKey, subscription, plan, daysRemaining, daysUntilExpiry, trialInfo } = useLoaderData();
  const location = useLocation();

  const isActive = (path) => {
    if (path === "/app") {
      return location.pathname === "/app";
    }

    return location.pathname.startsWith(path);
  };

  const isSubscriptionActive =
    subscription.status === "ACTIVE" ||
    subscription.status === "ACCEPTED";

  const navClass = (active) =>
    `inline-flex items-center justify-center rounded-[7px] px-[15px] py-[9px] text-[13px] font-semibold whitespace-nowrap no-underline transition-all duration-200 ${active
      ? "bg-[#f0f0f0] text-[#111111]"
      : "text-[#525252] hover:bg-[#f5f5f5] hover:text-[#111111]"
    } max-[600px]:px-3 max-[600px]:py-2`;

  return (
    <AppProvider embedded apiKey={apiKey}>
      <header className="box-border flex min-h-16 w-full items-center justify-between gap-5 border-b border-[#e5e5e5] bg-white px-7 max-[600px]:flex-wrap max-[600px]:gap-3 max-[600px]:px-[14px] max-[600px]:py-3">
        {/* Left navigation */}
        <nav className="flex items-center gap-2 max-[600px]:w-full max-[600px]:justify-between">
          <NavLink
            to="/app"
            end
            className={({ isActive: active }) => navClass(active)}
          >
            Bars
          </NavLink>

          <NavLink
            to="/app/analytics"
            className={({ isActive: active }) => navClass(active)}
          >
            Analytics
          </NavLink>
        </nav>

        <div className="flex items-center gap-4 max-[600px]:w-full max-[600px]:justify-between max-[600px]:border-t max-[600px]:border-[#eeeeee] max-[600px]:pt-[10px]">
          <div className="flex items-center gap-[9px] border-l border-[#e5e5e5] pl-4 max-[600px]:border-l-0 max-[600px]:pl-0">
            <span className="whitespace-nowrap text-[13px] font-semibold text-[#171717]">
              Plan: {plan.name}
            </span>

            <span
              className={`inline-flex items-center gap-[5px] whitespace-nowrap rounded-[20px] px-2 py-1 text-[10px] font-bold tracking-[0.3px] ${isSubscriptionActive
                ? "bg-[#ecfdf3] text-[#15803d]"
                : "bg-[#f5f5f5] text-[#737373]"
                }`}
            >
              <span className="h-[6px] w-[6px] rounded-full bg-current" />
              {subscription.status}
            </span>

            {typeof daysRemaining === "number" && (
              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-[20px] border border-[#e5e5e5] bg-[#f5f5f5] px-2 py-[3px] text-[11px] font-semibold text-[#404040]">
                {daysRemaining} {daysRemaining === 1 ? "day" : "days"} left
              </span>
            )}
          </div>

          <Link
            to="/app/plans"
            className="inline-flex items-center justify-center gap-[6px] whitespace-nowrap rounded-[7px] border border-[#e5e5e5] bg-white px-[13px] py-[9px] text-[12px] font-semibold text-[#171717] no-underline transition-all duration-200 hover:border-[#d4d4d4] hover:bg-[#f5f5f5]"
          >
            Manage Plans <span>→</span>
          </Link>
        </div>
      </header>

      {/* Expiry warning banner — shows when ≤3 days left on a paid plan */}
      {daysUntilExpiry !== null && daysUntilExpiry > 0 && daysUntilExpiry <= 3 && (
        <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-7 py-2.5 text-sm text-amber-900 max-[600px]:flex-col max-[600px]:items-start max-[600px]:gap-2 max-[600px]:px-4">
          <span>
            <span className="mr-1.5">⚠️</span>
            <strong>Your {plan.name} plan expires in {daysUntilExpiry} {daysUntilExpiry === 1 ? "day" : "days"}.</strong>
            {" "}Renew now to avoid interruption.
          </span>
          <Link
            to="/app/plans"
            className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 no-underline"
          >
            Manage Plans →
          </Link>
        </div>
      )}

      <main className="w-full">
        <Outlet />
      </main>
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
