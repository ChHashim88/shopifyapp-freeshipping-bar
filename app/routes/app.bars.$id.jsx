import { useState } from "react";
import { useLoaderData, Form, useNavigation, useActionData, Link, redirect } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import { isFeatureAllowed, checkMonthlyViewLimit } from "../utils/plan.server";

countries.registerLocale(enLocale);

const COUNTRY_OPTIONS = Object.entries(countries.getNames("en"))
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

const COUNTRY_CODE_SET = new Set(
  COUNTRY_OPTIONS.map((country) => country.code)
);

function parseCountryCodes(value) {
  try {
    const parsed = JSON.parse(value || "[]");

    if (!Array.isArray(parsed)) return [];

    return [...new Set(
      parsed
        .map((code) => String(code).toUpperCase())
        .filter((code) => COUNTRY_CODE_SET.has(code))
    )];
  } catch {
    return [];
  }
}

const ALLOWED_POSITIONS = [
  "Announcement bar",
  "Product page",
  "Cart drawer",
];

const DEFAULT_SETTINGS = {
  name: "Free Shipping Bar",
  enabled: true,
  goal: 50,
  positions: ["Product page"],

  message: "You're only {amount} away from free shipping!",
  successMessage: "Congratulations! You've unlocked free shipping!",

  showMessage: true,
  showProgress: true,
  showCartTotal: true,

  backgroundColor: "#FFFFFF",
  progressColor: "#008060",
  textColor: "#000000",

  backgroundType: "solid",
  gradientColor1: "#DDDDDD",
  gradientColor2: "#FFFFFF",
  gradientAngle: 90,

  containerWidth: 100,
  containerWidthUnit: "%",
  containerHeight: 100,

  progressWidth: 100,
  barHeight: 12,

  contentAlignment: "center",

  paddingTop: 12,
  paddingBottom: 12,
  paddingLeft: 12,
  paddingRight: 12,

  borderRadius: 6,

  upsellEnabled: false,
  upsellProductIds: [],

  upsellShowArrows: true,
  upsellAutoSlide: true,
  upsellSlideInterval: 5,
  upsellProductsPerView: 2,

  geolocationEnabled: false,
  targetCountries: [],
  excludedProductIds: [],
};

function parsePositions(value) {
  try {
    const parsed =
      typeof value === "string" ? JSON.parse(value) : value;

    if (Array.isArray(parsed)) {
      return parsed.filter((position) =>
        ALLOWED_POSITIONS.includes(position)
      );
    }
  } catch (error) {
    console.error("Unable to parse positions:", error);
  }

  return ["Product page"];
}

function getNumber(formData, name, fallback, min, max) {
  const value = Number(formData.get(name));

  if (!Number.isFinite(value)) return fallback;

  return Math.min(max, Math.max(min, value));
}

function getBoolean(formData, name) {
  return formData.get(name) === "true";
}

export async function loader({ request, params }) {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  // Prevent accessing bar editor if monthly view limit is reached
  const viewCheck = await checkMonthlyViewLimit(shop);
  if (!viewCheck.allowed) {
    return redirect("/app");
  }

  const canUseGeolocation = await isFeatureAllowed(
    shop,
    "geolocationTargeting"
  );
  const canUseUpsellProducts = await isFeatureAllowed(
    shop,
    "upsellProducts"
  );
  const canUseExcludeProducts = await isFeatureAllowed(
    shop,
    "excludeProducts"
  );

  if (!params?.id) {
    return new Response("Free shipping bar not found", { status: 404 });
  }

  const savedSettings = await db.freeShippingSettings.findFirst({
    where: {
      id: params.id,
      shop,
    },
  });

  if (!savedSettings) {
    return new Response("Free shipping bar not found", { status: 404 });
  }

  let upsellProductIds = [];

  try {
    upsellProductIds = savedSettings?.upsellProductIds
      ? JSON.parse(savedSettings.upsellProductIds)
      : [];
  } catch (error) {
    console.error("Unable to parse upsell product IDs:", error);
  }

  let excludedProductIds = [];

  try {
    excludedProductIds = savedSettings?.excludedProductIds
      ? JSON.parse(savedSettings.excludedProductIds)
      : [];
  } catch (error) {
    console.error("Unable to parse excluded product IDs:", error);
  }

  const settings = {
    ...DEFAULT_SETTINGS,
    ...savedSettings,
    positions: savedSettings
      ? parsePositions(savedSettings.positions)
      : DEFAULT_SETTINGS.positions,
    upsellProductIds,
    excludedProductIds,

    geolocationEnabled: savedSettings.geolocationEnabled,
    targetCountries: parseCountryCodes(savedSettings.targetCountries),
  };


  const response = await admin.graphql(`
  query {
    products(first: 50) {
      edges {
        node {
          id
          title
          featuredImage {
            url
          }
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
        }
      }
    }
  }
`);

  const responseData = await response.json();

  const products =
    responseData.data?.products?.edges?.map(({ node }) => ({
      id: node.id,
      title: node.title,
      image: node.featuredImage?.url || null,
      price: node.priceRange?.minVariantPrice?.amount || "0.00",
      currencyCode:
        node.priceRange?.minVariantPrice?.currencyCode || "USD",
    })) || [];
  return {
    settings,
    products,
    canUseGeolocation,
    canUseUpsellProducts,
    canUseExcludeProducts,
  };
}

export async function action({ request, params }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // Prevent saving bar if monthly view limit is reached
  const viewCheck = await checkMonthlyViewLimit(shop);
  if (!viewCheck.allowed) {
    return {
      success: false,
      error: "Your monthly view limit has been reached. Please upgrade your plan to edit bars.",
    };
  }

  if (!params?.id) {
    return {
      success: false,
      error: "Free shipping bar not found.",
    };
  }

  const existingBar = await db.freeShippingSettings.findFirst({
    where: {
      id: params.id,
      shop,
    },
  });

  if (!existingBar) {
    return {
      success: false,
      error: "Free shipping bar not found.",
    };
  }

  const formData = await request.formData();

  const positions = formData
    .getAll("positions")
    .filter((position) => ALLOWED_POSITIONS.includes(position));

  const targetCountries = [
    ...new Set(
      formData
        .getAll("targetCountries")
        .map((code) => String(code).toUpperCase())
        .filter((code) => COUNTRY_CODE_SET.has(code))
    ),
  ];

  const containerWidthUnit =
    formData.get("containerWidthUnit") === "px" ? "px" : "%";

  const contentAlignment = ["left", "center", "right"].includes(
    formData.get("contentAlignment")
  )
    ? formData.get("contentAlignment")
    : "center";

  const goal = Number(formData.get("goal"));

  if (!Number.isFinite(goal) || goal <= 0) {
    return {
      success: false,
      error: "Free shipping goal must be greater than zero.",
    };
  }

  const canUseExcludeProducts = await isFeatureAllowed(
    shop,
    "excludeProducts"
  );

  const submittedExcludedProducts = formData
    .getAll("excludedProductIds")
    .map(String)
    .filter(Boolean);

  // If a Free plan merchant attempts to submit excluded products, reject with error
  if (!canUseExcludeProducts && submittedExcludedProducts.length > 0) {
    return {
      success: false,
      error: "Excluding products is only available on the Starter plan or higher. Please upgrade to use this feature.",
    };
  }

  // Preserve existing excluded products if downgraded to Free, otherwise save submitted
  const excludedProductIds = canUseExcludeProducts
    ? JSON.stringify(submittedExcludedProducts)
    : (existingBar?.excludedProductIds || "[]");

  const settings = {
    name: String(formData.get("name") || "").trim().slice(0, 100) || "Free Shipping Bar",
    enabled: getBoolean(formData, "enabled"),
    goal,
    positions: JSON.stringify(positions),

    message: String(formData.get("message") || "").slice(0, 250),
    successMessage: String(
      formData.get("successMessage") || ""
    ).slice(0, 250),

    geolocationEnabled: getBoolean(formData, "geolocationEnabled"),
    targetCountries: JSON.stringify(targetCountries),

    showMessage: getBoolean(formData, "showMessage"),
    showProgress: getBoolean(formData, "showProgress"),
    showCartTotal: getBoolean(formData, "showCartTotal"),

    backgroundColor: String(
      formData.get("backgroundColor") || "#FFFFFF"
    ),
    progressColor: String(
      formData.get("progressColor") || "#008060"
    ),
    textColor: String(formData.get("textColor") || "#000000"),

    backgroundType: String(
      formData.get("backgroundType") || "solid"
    ),
    gradientColor1: String(
      formData.get("gradientColor1") || "#DDDDDD"
    ),
    gradientColor2: String(
      formData.get("gradientColor2") || "#FFFFFF"
    ),
    gradientAngle: getNumber(formData, "gradientAngle", 90, 0, 360),

    containerWidth: getNumber(
      formData,
      "containerWidth", 100, 10,
      containerWidthUnit === "%" ? 100 : 2000
    ),

    containerWidthUnit,

    containerHeight: getNumber(formData, "containerHeight", 100, 0, 1000),

    progressWidth: getNumber(formData, "progressWidth", 100, 10, 100),

    barHeight: getNumber(formData, "barHeight", 12, 4, 40),

    contentAlignment,

    paddingTop: getNumber(formData, "paddingTop", 12, 0, 100),
    paddingBottom: getNumber(formData, "paddingBottom", 12, 0, 100),
    paddingLeft: getNumber(formData, "paddingLeft", 12, 0, 100),
    paddingRight: getNumber(formData, "paddingRight", 12, 0, 100),

    borderRadius: getNumber(formData, "borderRadius", 6, 0, 50),

    upsellEnabled: getBoolean(formData, "upsellEnabled"),

    upsellProductIds: JSON.stringify(
      formData.getAll("upsellProductIds")
    ),

    excludedProductIds,

    upsellShowArrows: getBoolean(formData, "upsellShowArrows"),

    upsellAutoSlide: getBoolean(formData, "upsellAutoSlide"),

    upsellSlideInterval: getNumber(formData, "upsellSlideInterval", 5, 2, 30),

    upsellProductsPerView: getNumber(formData, "upsellProductsPerView", 2, 1, 4),
  };

  await db.freeShippingSettings.update({
    where: {
      id: params.id,
      shop,
    },
    data: settings,
  });

  return { success: true };
}


const inputClass = "w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200";

const labelClass = "mb-1 block text-xs font-semibold text-gray-700";

function NumberField({
  label,
  name,
  value,
  onChange,
  defaultValue,
  min = 0,
  max = 1000,
  suffix = "px",
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>

      <div className="flex items-center gap-2">
        <input
          className={inputClass}
          type="number"
          name={name}
          value={value !== undefined ? value : defaultValue}
          onChange={onChange}
          min={min}
          max={max}
        />

        <span className="min-w-8 text-xs text-gray-500">{suffix}</span>
      </div>
    </label>
  );
}

function Toggle({ label, name, checked, onChange, defaultChecked, description }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-gray-200 p-2.5 transition hover:bg-gray-50">
      <input
        type="checkbox"
        name={name}
        value="true"
        checked={checked !== undefined ? checked : defaultChecked}
        onChange={onChange}
        className="peer sr-only"
      />

      <span className="relative mt-0.5 h-4 w-7 shrink-0 rounded-full bg-gray-300 transition peer-checked:bg-gray-900 after:absolute after:left-0.5 after:top-0.5 after:h-3 after:w-3 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-3" />

      <span>
        <span className="block text-xs font-semibold text-gray-800">
          {label}
        </span>
        {description && (
          <span className="mt-0.5 block text-[11px] text-gray-500">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

function ColorField({ label, name, value, onChange, defaultValue }) {
  const displayVal = value !== undefined ? value : defaultValue;
  return (
    <label className="flex items-center justify-between gap-2.5 rounded-lg border border-gray-200 p-2.5">
      <span className="text-xs font-medium text-gray-700">{label}</span>

      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-mono text-gray-400 uppercase">
          {displayVal}
        </span>
        <input
          type="color"
          name={name}
          value={displayVal}
          onChange={onChange}
          className="h-7 w-9 cursor-pointer rounded border border-gray-200 bg-transparent p-0.5"
        />
      </div>
    </label>
  );
}

function Section({ title, description, children }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-gray-500">{description}</p>
        )}
      </div>

      <div className="p-4">{children}</div>
    </section>
  );
}

const SECTIONS = [
  { id: "general", title: "General settings", icon: "⚙️" },
  { id: "targeting", title: "Country Targeting", icon: "🌍" },
  { id: "messages", title: "Messages and visibility", icon: "💬" },
  { id: "dimensions", title: "Container dimensions", icon: "📐" },
  { id: "progress", title: "Progress indicator", icon: "📊" },
  { id: "appearance", title: "Appearance", icon: "🎨" },
  { id: "upsell", title: "Upsell products", icon: "🛍️" },
  { id: "exclude", title: "Exclude Products", icon: "🚫" },
];

function LivePreview({
  currentSettings,
  products,
  sampleCartValue,
  setSampleCartValue,
  previewDevice,
  setPreviewDevice,
}) {
  const goal = Number(currentSettings.goal) || 50;
  const remaining = Math.max(0, goal - sampleCartValue);
  const fillPercent = Math.min(
    100,
    Math.max(0, (sampleCartValue / goal) * 100)
  );
  const isUnlocked = remaining === 0;

  const selectedUpsellProducts = products.filter((product) =>
    (currentSettings.upsellProductIds || []).includes(product.id)
  );

  const productsPerView = Math.max(
    1,
    Number(currentSettings.upsellProductsPerView || 2)
  );

  const showUpsellArrows =
    currentSettings.upsellShowArrows &&
    selectedUpsellProducts.length > productsPerView;

  const bgStyle =
    currentSettings.backgroundType === "gradient"
      ? `linear-gradient(${currentSettings.gradientAngle}deg, ${currentSettings.gradientColor1}, ${currentSettings.gradientColor2})`
      : currentSettings.backgroundColor;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Preview Header */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-800">
            Live Preview
          </h2>
        </div>

        {/* Device Switcher */}
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setPreviewDevice("desktop")}
            className={`rounded px-2 py-0.5 text-xs font-medium transition ${previewDevice === "desktop"
              ? "bg-gray-900 text-white"
              : "text-gray-600 hover:text-gray-900"
              }`}
          >
            Desktop
          </button>
          <button
            type="button"
            onClick={() => setPreviewDevice("mobile")}
            className={`rounded px-2 py-0.5 text-xs font-medium transition ${previewDevice === "mobile"
              ? "bg-gray-900 text-white"
              : "text-gray-600 hover:text-gray-900"
              }`}
          >
            Mobile
          </button>
        </div>
      </div>

      {/* Preview Canvas */}
      <div className="flex min-h-[300px] items-center justify-center border-b border-gray-100 bg-gray-100/70 p-6">
        <div
          className={`w-full transition-all duration-200 ${previewDevice === "mobile" ? "max-w-[360px]" : "max-w-full"
            }`}
        >
          {/* Free Shipping Bar Root */}
          <div
            className="mx-auto overflow-hidden shadow-md transition-all duration-200"
            style={{
              width: `${currentSettings.containerWidth}${currentSettings.containerWidthUnit}`,
              minHeight:
                currentSettings.containerHeight > 0
                  ? `${currentSettings.containerHeight}px`
                  : "auto",
              padding: `${currentSettings.paddingTop}px ${currentSettings.paddingRight}px ${currentSettings.paddingBottom}px ${currentSettings.paddingLeft}px`,
              background: bgStyle,
              color: currentSettings.textColor,
              borderRadius: `${currentSettings.borderRadius}px`,
              textAlign: currentSettings.contentAlignment,
              boxSizing: "border-box",
            }}
          >
            {/* Dynamic Message */}
            {currentSettings.showMessage && (
              <p className="text-base sm:text-lg font-bold leading-relaxed tracking-tight">
                {isUnlocked
                  ? currentSettings.successMessage
                  : currentSettings.message.replace(
                    "{amount}",
                    `$${remaining.toFixed(2)}`
                  )}
              </p>
            )}

            {/* Dynamic Progress Bar */}
            {currentSettings.showProgress && (
              <div
                className="my-3.5 overflow-hidden"
                style={{
                  width: `${currentSettings.progressWidth}%`,
                  height: `${currentSettings.barHeight}px`,
                  background: "rgba(0,0,0,0.12)",
                  borderRadius: `${currentSettings.borderRadius}px`,
                  marginLeft:
                    currentSettings.contentAlignment === "center" ? "auto" : "0",
                  marginRight:
                    currentSettings.contentAlignment === "center" ? "auto" : "0",
                }}
              >
                <div
                  style={{
                    width: `${fillPercent}%`,
                    height: "100%",
                    background: currentSettings.progressColor,
                    borderRadius: `${currentSettings.borderRadius}px`,
                    transition: "width 0.25s ease-in-out",
                  }}
                />
              </div>
            )}

            {/* Cart Total Text */}
            {currentSettings.showCartTotal && (
              <p className="text-sm sm:text-base font-semibold opacity-90 mt-1">
                ${sampleCartValue.toFixed(2)} / ${goal.toFixed(2)}
              </p>
            )}

            {/* Upsell Carousel */}
            {currentSettings.upsellEnabled && (
              <div className="mt-5 w-full text-left">
                {selectedUpsellProducts.length > 0 ? (
                  <>
                    <div className="mb-2.5 flex items-center justify-start">
                      <p className="text-xs sm:text-sm font-bold uppercase tracking-wider opacity-85">
                        You may also like
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {showUpsellArrows && (
                        <button
                          type="button"
                          className="flex shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-inherit transition hover:opacity-70"
                          aria-label="Previous products"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="22"
                            height="22"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M15 18l-6-6 6-6" />
                          </svg>
                        </button>
                      )}

                      <div
                        className="grid flex-1 min-w-0 gap-3"
                        style={{
                          gridTemplateColumns: `repeat(${productsPerView}, minmax(0, 1fr))`,
                        }}
                      >
                        {selectedUpsellProducts
                          .slice(0, productsPerView)
                          .map((product) => (
                            <div
                              key={product.id}
                              className="flex min-w-0 items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
                            >
                              {product.image ? (
                                <img
                                  src={product.image}
                                  alt={product.title}
                                  className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-lg object-cover"
                                />
                              ) : (
                                <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">
                                  No image
                                </div>
                              )}

                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs sm:text-sm font-bold text-gray-900">
                                  {product.title}
                                </p>
                                <p className="mt-0.5 text-xs sm:text-sm font-bold text-gray-800">
                                  {product.currencyCode}{" "}
                                  {Number(product.price).toFixed(2)}
                                </p>
                                <button
                                  type="button"
                                  className="mt-1.5 rounded-md bg-black px-3 py-1 text-xs font-semibold text-white hover:bg-gray-800 transition"
                                >
                                  + Add
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>

                      {showUpsellArrows && (
                        <button
                          type="button"
                          className="flex shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-inherit transition hover:opacity-70"
                          aria-label="Next products"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="22"
                            height="22"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="rounded-md border border-dashed border-gray-300 bg-white/70 p-4 text-center text-xs font-medium text-gray-500">
                    Select products in the "Upsell products" section to preview them here.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Cart Simulator */}
      <div className="space-y-3.5 bg-white p-5">
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <span className="font-bold text-gray-800">Test Cart Simulation:</span>
          <span className="font-mono text-sm sm:text-base font-bold text-gray-900">
            ${sampleCartValue.toFixed(2)} / ${goal.toFixed(2)} ({fillPercent.toFixed(0)}%)
          </span>
        </div>

        <input
          type="range"
          min="0"
          max={Math.max(100, Math.round(goal * 1.5))}
          step="1"
          value={sampleCartValue}
          onChange={(e) => setSampleCartValue(Number(e.target.value))}
          className="h-2 w-full cursor-pointer accent-gray-900"
        />

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => setSampleCartValue(0)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            Empty ($0)
          </button>
          <button
            type="button"
            onClick={() => setSampleCartValue(Math.round(goal * 0.5))}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            Halfway (${Math.round(goal * 0.5)})
          </button>
          <button
            type="button"
            onClick={() => setSampleCartValue(goal)}
            className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700 hover:bg-green-100 transition"
          >
            Unlocked (${goal})
          </button>
        </div>

        {/* Location Tags Hint */}
        <div className="flex flex-wrap items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500">
          <span className="font-medium">Active positions:</span>
          <div className="flex flex-wrap gap-1.5">
            {currentSettings.positions && currentSettings.positions.length > 0 ? (
              currentSettings.positions.map((pos) => (
                <span
                  key={pos}
                  className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700"
                >
                  {pos}
                </span>
              ))
            ) : (
              <span className="text-xs font-semibold text-red-500">None selected</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const {
    settings,
    products,
    canUseGeolocation,
    canUseUpsellProducts,
    canUseExcludeProducts,
  } = useLoaderData();

  const [activeSection, setActiveSection] = useState("general");
  const [excludeSearch, setExcludeSearch] = useState("");

  const [currentSettings, setCurrentSettings] = useState({
    name: settings.name || "Free Shipping Bar",
    enabled: settings.enabled ?? true,
    goal: settings.goal ?? 50,
    positions: Array.isArray(settings.positions)
      ? settings.positions
      : ["Product page"],
    geolocationEnabled: settings.geolocationEnabled ?? false,
    targetCountries: Array.isArray(settings.targetCountries)
      ? settings.targetCountries
      : [],
    excludedProductIds: Array.isArray(settings.excludedProductIds)
      ? settings.excludedProductIds
      : [],
    message:
      settings.message || "You're only {amount} away from free shipping!",
    successMessage:
      settings.successMessage ||
      "Congratulations! You've unlocked free shipping!",
    showMessage: settings.showMessage ?? true,
    showProgress: settings.showProgress ?? true,
    showCartTotal: settings.showCartTotal ?? true,
    containerWidth: settings.containerWidth ?? 100,
    containerWidthUnit: settings.containerWidthUnit || "%",
    containerHeight: settings.containerHeight ?? 100,
    paddingTop: settings.paddingTop ?? 12,
    paddingBottom: settings.paddingBottom ?? 12,
    paddingLeft: settings.paddingLeft ?? 12,
    paddingRight: settings.paddingRight ?? 12,
    progressWidth: settings.progressWidth ?? 100,
    barHeight: settings.barHeight ?? 12,
    borderRadius: settings.borderRadius ?? 6,
    contentAlignment: settings.contentAlignment || "center",
    backgroundType: settings.backgroundType || "solid",
    backgroundColor: settings.backgroundColor || "#FFFFFF",
    gradientColor1: settings.gradientColor1 || "#DDDDDD",
    gradientColor2: settings.gradientColor2 || "#FFFFFF",
    gradientAngle: settings.gradientAngle ?? 90,
    progressColor: settings.progressColor || "#008060",
    textColor: settings.textColor || "#000000",
    upsellEnabled: settings.upsellEnabled ?? false,
    upsellProductIds: Array.isArray(settings.upsellProductIds)
      ? settings.upsellProductIds
      : [],
    upsellShowArrows: settings.upsellShowArrows ?? true,
    upsellAutoSlide: settings.upsellAutoSlide ?? false,
    upsellSlideInterval: settings.upsellSlideInterval ?? 5,
    upsellProductsPerView: settings.upsellProductsPerView ?? 2,
  });

  const updateSetting = (key, value) => {
    setCurrentSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const [countrySearch, setCountrySearch] = useState("");
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [sampleCartValue, setSampleCartValue] = useState(30);
  const [previewDevice, setPreviewDevice] = useState("desktop");

  const navigation = useNavigation();
  const actionData = useActionData();
  const [copied, setCopied] = useState(false);

  const saving = navigation.state === "submitting";

  return (
    <s-page heading="Free Shipping Booster">
      <Form method="post" className="mx-auto max-w-7xl space-y-6 pb-12">
        {/* Navigation & Bar ID helper */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link
            to="/app"
            className="inline-flex items-center gap-1 font-medium text-gray-600 hover:text-gray-900 transition"
          >
            <span>←</span>
            <span>Back to all free shipping bars</span>
          </Link>

          {settings.id && (
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(settings.id);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              title="Click to copy Bar ID for Theme Editor"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs font-mono text-gray-700 shadow-sm hover:bg-gray-50 transition cursor-pointer"
            >
              <span className="text-gray-400">Bar ID:</span>
              <span className="font-semibold text-gray-900">{settings.id}</span>
              <span>{copied ? "✓ Copied" : "📋"}</span>
            </button>
          )}
        </div>

        {/* Dashboard heading banner */}
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-900 text-white shadow">
              <span className="text-xl">🚚</span>
            </div>

            <div>
              <h1 className="text-lg font-bold text-gray-900">
                {currentSettings.name || "Free Shipping Bar"}
              </h1>
              <p className="text-xs text-gray-500">
                Visual editor • Configure settings , preview in real time .
              </p>
            </div>
          </div>

          <span
            className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${currentSettings.enabled
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-gray-100 text-gray-600 border border-gray-200"
              }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${currentSettings.enabled ? "bg-green-500" : "bg-gray-400"
                }`}
            />
            {currentSettings.enabled ? "Bar enabled" : "Bar disabled"}
          </span>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
          {SECTIONS.map((sec) => {
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSection(sec.id)}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${isActive
                  ? "bg-gray-900 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
              >
                <span>{sec.icon}</span>
                <span>{sec.title}</span>
              </button>
            );
          })}
        </div>

        {/* Two-Column Editor Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          {/* Left Column: Settings of Currently Selected Section */}
          <div className="space-y-5 lg:col-span-5">
            {/* Section 1: General settings */}
            <div style={{ display: activeSection === "general" ? "block" : "none" }}>
              <Section
                title="General settings"
                description="Control the main behavior of your free shipping bar."
              >
                <div className="space-y-5">
                  <div className="max-w-sm">
                    <label className="block">
                      <span className={labelClass}>Bar name</span>
                      <input
                        className={inputClass}
                        type="text"
                        name="name"
                        value={currentSettings.name}
                        onChange={(e) => updateSetting("name", e.target.value)}
                        maxLength={100}
                        required
                      />
                      <span className="mt-1 block text-xs text-gray-500">
                        Internal name to identify this bar in your dashboard.
                      </span>
                    </label>
                  </div>

                  <Toggle
                    label="Enable free shipping bar"
                    name="enabled"
                    checked={currentSettings.enabled}
                    onChange={(e) => updateSetting("enabled", e.target.checked)}
                    description="Turn your storefront free shipping bar on or off."
                  />

                  <div className="max-w-sm">
                    <label className="block">
                      <span className={labelClass}>Free shipping goal</span>
                      <input
                        className={inputClass}
                        type="number"
                        name="goal"
                        min="1"
                        step="0.01"
                        value={currentSettings.goal}
                        onChange={(e) => updateSetting("goal", e.target.value)}
                        required
                      />
                      <span className="mt-1 block text-xs text-gray-500">
                        The cart amount customers need to reach for free shipping.
                      </span>
                    </label>
                  </div>

                  <div>
                    <h3 className="mb-2 text-sm font-medium text-gray-700">
                      Display locations
                    </h3>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {ALLOWED_POSITIONS.map((position) => {
                        const isChecked = (currentSettings.positions || []).includes(position);
                        return (
                          <label
                            key={position}
                            className={`flex min-w-0 cursor-pointer items-center gap-2 rounded-lg border p-2 text-xs transition ${isChecked
                              ? "border-gray-900 bg-gray-50 text-gray-900 font-medium"
                              : "border-gray-200 text-gray-700 hover:bg-gray-50"
                              }`}
                          >
                            <input
                              type="checkbox"
                              name="positions"
                              value={position}
                              checked={isChecked}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                const next = checked
                                  ? [...(currentSettings.positions || []), position]
                                  : (currentSettings.positions || []).filter(
                                    (pos) => pos !== position
                                  );
                                updateSetting("positions", next);
                              }}
                              className="h-4 w-4 shrink-0 rounded border-gray-300 accent-gray-900"
                            />
                            <span className="min-w-0 flex-1 break-words leading-tight">
                              {position}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </Section>
            </div>

            {/* Section 2: Country Targeting */}
            <div style={{ display: activeSection === "targeting" ? "block" : "none" }}>
              <Section title="Country Targeting">
                {canUseGeolocation ? (
                  <div className="space-y-4">
                    <Toggle
                      label="Enable country targeting"
                      name="geolocationEnabled"
                      checked={currentSettings.geolocationEnabled}
                      onChange={(e) =>
                        updateSetting("geolocationEnabled", e.target.checked)
                      }
                      description="Show this bar only to visitors in selected countries."
                    />

                    <div>
                      <label className="mb-2 block text-sm font-medium">
                        Select countries
                      </label>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setCountryDropdownOpen((previous) => !previous)
                          }
                          className="flex w-full max-w-xs cursor-pointer items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:border-gray-400"
                        >
                          <span className="text-gray-600">
                            Choose a country...
                          </span>

                          <svg
                            className={`h-4 w-4 transition-transform ${countryDropdownOpen ? "rotate-180" : ""
                              }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="m19 9-7 7-7-7"
                            />
                          </svg>
                        </button>

                        {countryDropdownOpen && (
                          <div className="absolute left-0 top-full z-50 mt-1 max-h-48 w-full max-w-xs overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                            <input
                              type="text"
                              value={countrySearch}
                              onChange={(event) =>
                                setCountrySearch(event.target.value)
                              }
                              placeholder="Search countries..."
                              className="sticky top-0 z-10 w-full border-b border-gray-200 bg-white px-3 py-2 text-sm outline-none"
                              onClick={(event) => event.stopPropagation()}
                            />

                            {COUNTRY_OPTIONS
                              .filter(
                                (country) =>
                                  !(currentSettings.targetCountries || []).includes(
                                    country.code
                                  ) &&
                                  country.name
                                    .toLowerCase()
                                    .includes(countrySearch.trim().toLowerCase())
                              )
                              .map((country) => (
                                <button
                                  key={country.code}
                                  type="button"
                                  onClick={() => {
                                    const next = [
                                      ...(currentSettings.targetCountries || []),
                                      country.code,
                                    ];
                                    updateSetting("targetCountries", next);
                                    setCountryDropdownOpen(false);
                                    setCountrySearch("");
                                  }}
                                  className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  {country.name}
                                </button>
                              ))}

                            {COUNTRY_OPTIONS.filter(
                              (country) =>
                                !(currentSettings.targetCountries || []).includes(
                                  country.code
                                ) &&
                                country.name
                                  .toLowerCase()
                                  .includes(countrySearch.trim().toLowerCase())
                            ).length === 0 && (
                                <p className="px-3 py-3 text-sm text-gray-500">
                                  No matching countries found.
                                </p>
                              )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Selected countries */}
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-800">
                          Selected countries
                        </p>

                        <span className="text-xs text-gray-500">
                          {(currentSettings.targetCountries || []).length} countries selected
                        </span>
                      </div>

                      {(currentSettings.targetCountries || []).length === 0 ? (
                        <p className="text-sm text-gray-500">
                          No countries selected yet.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {(currentSettings.targetCountries || []).map((code) => {
                            const country = COUNTRY_OPTIONS.find(
                              (item) => item.code === code
                            );

                            return (
                              <span
                                key={code}
                                className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-100 px-3 py-1.5 text-sm text-gray-700"
                              >
                                {country?.name || code}

                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = (
                                      currentSettings.targetCountries || []
                                    ).filter((item) => item !== code);
                                    updateSetting("targetCountries", next);
                                  }}
                                  className="cursor-pointer font-bold text-gray-500 hover:text-red-600"
                                  aria-label={`Remove ${country?.name || code}`}
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Hidden inputs for form submission */}
                    {(currentSettings.targetCountries || []).map((code) => (
                      <input
                        key={code}
                        type="hidden"
                        name="targetCountries"
                        value={code}
                      />
                    ))}

                    <p className="text-xs text-gray-500">
                      When targeting is enabled, this bar will appear only in
                      the selected countries. If no countries are selected,
                      it will not appear anywhere.
                    </p>
                  </div>
                ) : (
                  /* Locked state for Free plan */
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-200">
                        <svg
                          className="h-5 w-5 text-gray-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <rect
                            x="4"
                            y="10"
                            width="16"
                            height="11"
                            rx="2"
                            strokeWidth="1.8"
                          />
                          <path
                            d="M8 10V7a4 4 0 0 1 8 0v3"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>

                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-900">
                          Upgrade your plan to unlock Country Targeting
                        </h3>

                        <p className="mt-1 text-sm leading-6 text-gray-600">
                          Geolocation targeting is available starting from the
                          Starter plan. Upgrade to show your boosters only to
                          visitors in selected countries.
                        </p>

                        <a
                          href="/app/plans"
                          className="mt-4 inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700"
                        >
                          Upgrade to Starter
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </Section>
            </div>

            {/* Section 3: Messages and visibility */}
            <div style={{ display: activeSection === "messages" ? "block" : "none" }}>
              <Section
                title="Messages and visibility"
                description="Choose what your customers see before and after reaching the goal."
              >
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>Progress message</span>
                    <input
                      className={inputClass}
                      type="text"
                      name="message"
                      value={currentSettings.message}
                      onChange={(e) => updateSetting("message", e.target.value)}
                      maxLength={250}
                    />
                    <span className="mt-1 block text-xs text-gray-500">
                      Use {"{amount}"} to show the remaining amount.
                    </span>
                  </label>

                  <label className="block">
                    <span className={labelClass}>Success message</span>
                    <input
                      className={inputClass}
                      type="text"
                      name="successMessage"
                      value={currentSettings.successMessage}
                      onChange={(e) =>
                        updateSetting("successMessage", e.target.value)
                      }
                      maxLength={250}
                    />
                  </label>
                </div>

                <div className="mt-5">
                  <h3 className="mb-3 text-sm font-medium text-gray-700">
                    Visible content
                  </h3>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <Toggle
                      label="Show message"
                      name="showMessage"
                      checked={currentSettings.showMessage}
                      onChange={(e) =>
                        updateSetting("showMessage", e.target.checked)
                      }
                    />

                    <Toggle
                      label="Show progress"
                      name="showProgress"
                      checked={currentSettings.showProgress}
                      onChange={(e) =>
                        updateSetting("showProgress", e.target.checked)
                      }
                    />

                    <Toggle
                      label="Show cart total"
                      name="showCartTotal"
                      checked={currentSettings.showCartTotal}
                      onChange={(e) =>
                        updateSetting("showCartTotal", e.target.checked)
                      }
                    />
                  </div>
                </div>
              </Section>
            </div>

            {/* Section 4: Container dimensions */}
            <div style={{ display: activeSection === "dimensions" ? "block" : "none" }}>
              <Section
                title="Container dimensions"
                description="Adjust the overall size and spacing of the bar."
              >
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="block">
                    <span className={labelClass}>Container width</span>

                    <div className="flex gap-2">
                      <input
                        className={inputClass}
                        type="number"
                        name="containerWidth"
                        min="10"
                        max={currentSettings.containerWidthUnit === "%" ? 100 : 2000}
                        value={currentSettings.containerWidth}
                        onChange={(e) =>
                          updateSetting("containerWidth", e.target.value)
                        }
                      />

                      <select
                        className={`${inputClass} max-w-20`}
                        name="containerWidthUnit"
                        value={currentSettings.containerWidthUnit}
                        onChange={(e) =>
                          updateSetting("containerWidthUnit", e.target.value)
                        }
                      >
                        <option value="%">%</option>
                        <option value="px">px</option>
                      </select>
                    </div>
                  </label>

                  <NumberField
                    label="Container height"
                    name="containerHeight"
                    value={currentSettings.containerHeight}
                    onChange={(e) =>
                      updateSetting("containerHeight", e.target.value)
                    }
                    max={1000}
                  />

                  <NumberField
                    label="Top padding"
                    name="paddingTop"
                    value={currentSettings.paddingTop}
                    onChange={(e) =>
                      updateSetting("paddingTop", e.target.value)
                    }
                    max={100}
                  />

                  <NumberField
                    label="Bottom padding"
                    name="paddingBottom"
                    value={currentSettings.paddingBottom}
                    onChange={(e) =>
                      updateSetting("paddingBottom", e.target.value)
                    }
                    max={100}
                  />

                  <NumberField
                    label="Left padding"
                    name="paddingLeft"
                    value={currentSettings.paddingLeft}
                    onChange={(e) =>
                      updateSetting("paddingLeft", e.target.value)
                    }
                    max={100}
                  />

                  <NumberField
                    label="Right padding"
                    name="paddingRight"
                    value={currentSettings.paddingRight}
                    onChange={(e) =>
                      updateSetting("paddingRight", e.target.value)
                    }
                    max={100}
                  />
                </div>
              </Section>
            </div>

            {/* Section 5: Progress indicator */}
            <div style={{ display: activeSection === "progress" ? "block" : "none" }}>
              <Section
                title="Progress indicator"
                description="Customize the size and shape of the progress indicator."
              >
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <NumberField
                    label="Progress width"
                    name="progressWidth"
                    value={currentSettings.progressWidth}
                    onChange={(e) =>
                      updateSetting("progressWidth", e.target.value)
                    }
                    min={10}
                    max={100}
                    suffix="%"
                  />

                  <NumberField
                    label="Progress height"
                    name="barHeight"
                    value={currentSettings.barHeight}
                    onChange={(e) =>
                      updateSetting("barHeight", e.target.value)
                    }
                    min={4}
                    max={40}
                  />

                  <NumberField
                    label="Border radius"
                    name="borderRadius"
                    value={currentSettings.borderRadius}
                    onChange={(e) =>
                      updateSetting("borderRadius", e.target.value)
                    }
                    max={50}
                  />
                </div>
              </Section>
            </div>

            {/* Section 6: Appearance */}
            <div style={{ display: activeSection === "appearance" ? "block" : "none" }}>
              <Section
                title="Appearance"
                description="Set the alignment and colors to match your store design."
              >
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>Content alignment</span>
                    <select
                      className={inputClass}
                      name="contentAlignment"
                      value={currentSettings.contentAlignment}
                      onChange={(e) =>
                        updateSetting("contentAlignment", e.target.value)
                      }
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </label>

                  <div className="space-y-3">
                    <label className="block">
                      <span className={labelClass}>Background type</span>
                      <select
                        name="backgroundType"
                        value={currentSettings.backgroundType}
                        onChange={(e) =>
                          updateSetting("backgroundType", e.target.value)
                        }
                        className={inputClass}
                      >
                        <option value="solid">Solid color</option>
                        <option value="gradient">Gradient</option>
                      </select>
                    </label>

                    {currentSettings.backgroundType === "solid" ? (
                      <>
                        <ColorField
                          label="Container BG"
                          name="backgroundColor"
                          value={currentSettings.backgroundColor}
                          onChange={(e) =>
                            updateSetting("backgroundColor", e.target.value)
                          }
                        />
                        <input
                          type="hidden"
                          name="gradientColor1"
                          value={currentSettings.gradientColor1}
                        />
                        <input
                          type="hidden"
                          name="gradientColor2"
                          value={currentSettings.gradientColor2}
                        />
                        <input
                          type="hidden"
                          name="gradientAngle"
                          value={currentSettings.gradientAngle}
                        />
                      </>
                    ) : (
                      <>
                        <input
                          type="hidden"
                          name="backgroundColor"
                          value={currentSettings.backgroundColor}
                        />
                        <ColorField
                          label="Gradient color 1"
                          name="gradientColor1"
                          value={currentSettings.gradientColor1}
                          onChange={(e) =>
                            updateSetting("gradientColor1", e.target.value)
                          }
                        />

                        <ColorField
                          label="Gradient color 2"
                          name="gradientColor2"
                          value={currentSettings.gradientColor2}
                          onChange={(e) =>
                            updateSetting("gradientColor2", e.target.value)
                          }
                        />

                        <label className="block">
                          <span className={labelClass}>
                            Gradient angle (degrees)
                          </span>
                          <input
                            type="number"
                            name="gradientAngle"
                            min="0"
                            max="360"
                            value={currentSettings.gradientAngle}
                            onChange={(e) =>
                              updateSetting("gradientAngle", e.target.value)
                            }
                            className={inputClass}
                          />
                        </label>
                      </>
                    )}

                    <ColorField
                      label="Progress color"
                      name="progressColor"
                      value={currentSettings.progressColor}
                      onChange={(e) =>
                        updateSetting("progressColor", e.target.value)
                      }
                    />

                    <ColorField
                      label="Text color"
                      name="textColor"
                      value={currentSettings.textColor}
                      onChange={(e) =>
                        updateSetting("textColor", e.target.value)
                      }
                    />
                  </div>
                </div>
              </Section>
            </div>

            {/* Section 7: Upsell products */}
            <div style={{ display: activeSection === "upsell" ? "block" : "none" }}>
              {canUseUpsellProducts ? (
                <Section
                  title="Upsell products"
                  description="Choose products you want to recommend to customers below the free shipping bar."
                >
                  <div className="space-y-5">
                    <Toggle
                      label="Enable upsell products"
                      name="upsellEnabled"
                      checked={currentSettings.upsellEnabled}
                      onChange={(e) =>
                        updateSetting("upsellEnabled", e.target.checked)
                      }
                      description="Show selected products beneath your free shipping bar."
                    />

                    <div>
                      <h3 className="mb-3 text-sm font-medium text-gray-700">
                        Select products
                      </h3>

                      {products.length === 0 ? (
                        <p className="rounded-lg border border-gray-200 p-4 text-sm text-gray-500">
                          No products found in your Shopify store.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {products.map((product) => {
                            const isSelected = (
                              currentSettings.upsellProductIds || []
                            ).includes(product.id);
                            return (
                              <label
                                key={product.id}
                                className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-xs transition ${isSelected
                                  ? "border-gray-900 bg-gray-50"
                                  : "border-gray-200 hover:bg-gray-50"
                                  }`}
                              >
                                <input
                                  type="checkbox"
                                  name="upsellProductIds"
                                  value={product.id}
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    const next = checked
                                      ? [
                                        ...(currentSettings.upsellProductIds ||
                                          []),
                                        product.id,
                                      ]
                                      : (
                                        currentSettings.upsellProductIds ||
                                        []
                                      ).filter((id) => id !== product.id);
                                    updateSetting("upsellProductIds", next);
                                  }}
                                  className="h-4 w-4 shrink-0 accent-gray-900"
                                />

                                {product.image ? (
                                  <img
                                    src={product.image}
                                    alt={product.title}
                                    className="h-10 w-10 rounded-lg border border-gray-200 object-cover"
                                  />
                                ) : (
                                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">
                                    No image
                                  </div>
                                )}

                                <span className="text-xs font-medium text-gray-800">
                                  {product.title}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      <p className="mt-2 text-xs text-gray-500">
                        Select the products you want to recommend. You can select multiple products.
                      </p>
                    </div>

                    <div className="border-t border-gray-200 pt-5">
                      <h3 className="mb-3 text-sm font-semibold text-gray-800">
                        Carousel settings
                      </h3>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <Toggle
                          label="Show navigation arrows"
                          name="upsellShowArrows"
                          checked={currentSettings.upsellShowArrows}
                          onChange={(e) =>
                            updateSetting("upsellShowArrows", e.target.checked)
                          }
                          description="Allow customers to move between products."
                        />

                        <Toggle
                          label="Automatic sliding"
                          name="upsellAutoSlide"
                          checked={currentSettings.upsellAutoSlide}
                          onChange={(e) =>
                            updateSetting("upsellAutoSlide", e.target.checked)
                          }
                          description="Automatically move to the next products."
                        />
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <NumberField
                          label="Slide interval"
                          name="upsellSlideInterval"
                          value={currentSettings.upsellSlideInterval}
                          onChange={(e) =>
                            updateSetting("upsellSlideInterval", e.target.value)
                          }
                          min={2}
                          max={30}
                          suffix="seconds"
                        />

                        <NumberField
                          label="Products per view"
                          name="upsellProductsPerView"
                          value={currentSettings.upsellProductsPerView}
                          onChange={(e) =>
                            updateSetting(
                              "upsellProductsPerView",
                              e.target.value
                            )
                          }
                          min={1}
                          max={4}
                          suffix="products"
                        />
                      </div>
                    </div>
                  </div>
                </Section>
              ) : (
                <Section title="Upsell products">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                    <h3 className="text-sm font-semibold text-gray-900">
                      Upgrade your plan to unlock Upsell Products
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-gray-600">
                      Upsell Products are available starting from the Essential plan.
                      Upgrade to recommend products and increase your store's average order value.
                    </p>

                    <a
                      href="/app/plans"
                      className="mt-4 inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 transition"
                    >
                      Upgrade to Essential
                    </a>
                  </div>
                </Section>
              )}
            </div>

            {/* Section 8: Exclude Products */}
            <div style={{ display: activeSection === "exclude" ? "block" : "none" }}>
              {canUseExcludeProducts ? (
                <Section
                  title="Exclude Products"
                  description="Choose products that should be excluded from this free shipping booster."
                >
                  <div className="space-y-4">
                    {/* Selected Excluded Products Summary */}
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-gray-700">
                        Excluded products ({(currentSettings.excludedProductIds || []).length})
                      </label>

                      {(currentSettings.excludedProductIds || []).length === 0 ? (
                        <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-3 text-xs text-gray-500">
                          No products excluded yet. Select products below to exclude them from free shipping calculations.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {(currentSettings.excludedProductIds || []).map((id) => {
                            const product = products.find((p) => p.id === id);
                            return (
                              <span
                                key={id}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 py-1 pl-1.5 pr-2 text-xs font-medium text-gray-800"
                              >
                                {product?.image ? (
                                  <img
                                    src={product.image}
                                    alt={product.title}
                                    className="h-5 w-5 rounded object-cover"
                                  />
                                ) : (
                                  <span className="flex h-5 w-5 items-center justify-center rounded bg-gray-200 text-[10px]">
                                    📦
                                  </span>
                                )}
                                <span className="max-w-[140px] truncate">
                                  {product?.title || id}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = (currentSettings.excludedProductIds || []).filter(
                                      (item) => item !== id
                                    );
                                    updateSetting("excludedProductIds", next);
                                  }}
                                  className="cursor-pointer text-gray-400 hover:text-red-600 font-bold ml-0.5"
                                  aria-label={`Remove ${product?.title || id}`}
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Product Search & Selection List */}
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="text-xs font-semibold text-gray-700">
                          Select products to exclude
                        </label>
                        {(currentSettings.excludedProductIds || []).length > 0 && (
                          <button
                            type="button"
                            onClick={() => updateSetting("excludedProductIds", [])}
                            className="text-xs font-medium text-gray-500 hover:text-red-600 transition"
                          >
                            Clear all
                          </button>
                        )}
                      </div>

                      {/* Search box */}
                      <div className="relative mb-3">
                        <input
                          type="text"
                          value={excludeSearch}
                          onChange={(e) => setExcludeSearch(e.target.value)}
                          placeholder="Search products by title..."
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
                        />
                        {excludeSearch && (
                          <button
                            type="button"
                            onClick={() => setExcludeSearch("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 font-bold"
                          >
                            ×
                          </button>
                        )}
                      </div>

                      {products.length === 0 ? (
                        <p className="rounded-lg border border-gray-200 p-4 text-xs text-gray-500">
                          No products found in your Shopify store.
                        </p>
                      ) : (
                        <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100 bg-white">
                          {products
                            .filter((product) =>
                              excludeSearch.trim() === ""
                                ? true
                                : product.title
                                    .toLowerCase()
                                    .includes(excludeSearch.trim().toLowerCase())
                            )
                            .map((product) => {
                              const isExcluded = (
                                currentSettings.excludedProductIds || []
                              ).includes(product.id);
                              return (
                                <label
                                  key={product.id}
                                  className={`flex cursor-pointer items-center gap-3 p-2.5 text-xs transition ${
                                    isExcluded
                                      ? "bg-red-50/50 hover:bg-red-50"
                                      : "hover:bg-gray-50"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    name="excludedProductIds"
                                    value={product.id}
                                    checked={isExcluded}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      const next = checked
                                        ? [
                                            ...(currentSettings.excludedProductIds || []),
                                            product.id,
                                          ]
                                        : (currentSettings.excludedProductIds || []).filter(
                                            (id) => id !== product.id
                                          );
                                      updateSetting("excludedProductIds", next);
                                    }}
                                    className="h-4 w-4 shrink-0 rounded border-gray-300 accent-red-600"
                                  />

                                  {product.image ? (
                                    <img
                                      src={product.image}
                                      alt={product.title}
                                      className="h-10 w-10 shrink-0 rounded-lg border border-gray-200 object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">
                                      📦
                                    </div>
                                  )}

                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-semibold text-gray-900">
                                      {product.title}
                                    </p>
                                    <p className="text-[11px] text-gray-500">
                                      {product.currencyCode} {Number(product.price).toFixed(2)}
                                    </p>
                                  </div>

                                  {isExcluded && (
                                    <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                                      Excluded
                                    </span>
                                  )}
                                </label>
                              );
                            })}

                          {products.filter((product) =>
                            excludeSearch.trim() === ""
                              ? true
                              : product.title
                                  .toLowerCase()
                                  .includes(excludeSearch.trim().toLowerCase())
                          ).length === 0 && (
                            <p className="p-4 text-center text-xs text-gray-500">
                              No products match "{excludeSearch}".
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Section>
              ) : (
                <Section title="Exclude Products">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-200">
                        <svg
                          className="h-5 w-5 text-gray-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <rect
                            x="4"
                            y="10"
                            width="16"
                            height="11"
                            rx="2"
                            strokeWidth="1.8"
                          />
                          <path
                            d="M8 10V7a4 4 0 0 1 8 0v3"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>

                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-900">
                          Upgrade your plan to unlock Exclude Products
                        </h3>

                        <p className="mt-1 text-sm leading-6 text-gray-600">
                          Excluding products is available starting from the Starter plan ($9.99/month).
                          Upgrade to exclude specific products from free shipping calculations.
                        </p>

                        <a
                          href="/app/plans"
                          className="mt-4 inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 transition"
                        >
                          Upgrade to Starter
                        </a>
                      </div>
                    </div>
                  </div>
                </Section>
              )}
            </div>

            {/* Sticky Save settings footer */}
            <div className="sticky bottom-3 z-10 flex flex-col items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center">
              <div>
                {actionData?.success && (
                  <p className="text-sm font-medium text-green-700">
                    Settings saved successfully.
                  </p>
                )}

                {actionData?.error && (
                  <p className="text-sm font-medium text-red-600">
                    {actionData.error}
                  </p>
                )}

                {!actionData && (
                  <p className="text-sm text-gray-500">
                    Remember to save your changes.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full cursor-pointer rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {saving ? "Saving..." : "Save settings"}
              </button>
            </div>
          </div>

          {/* Right Column: Persistent Sticky Live Preview */}
          <div className="space-y-4 lg:col-span-7 lg:sticky lg:top-4">
            <LivePreview
              currentSettings={currentSettings}
              products={products}
              sampleCartValue={sampleCartValue}
              setSampleCartValue={setSampleCartValue}
              previewDevice={previewDevice}
              setPreviewDevice={setPreviewDevice}
            />
          </div>
        </div>
      </Form>
    </s-page>
  );
}