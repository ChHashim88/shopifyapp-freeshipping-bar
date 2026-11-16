
const plans = [
    {
        name: "Free plan",
        price: "Free",
        features: [
            "Up to 1000 monthly booster views",
            "Unlimited top bar boosters",
            "Unlimited product page boosters",
        ],
        trial: null,
    },
    {
        name: "Starter",
        price: "$9.99",
        features: [
            "Up to 10 000 monthly booster views",
            "Everything in Free",
            "Geolocation targeting",
            "Exclude products",
        ],
        trial: "7-day free trial",
    },
    {
        name: "Essential",
        price: "$14.99",
        features: [
            "Up to 50 000 monthly booster views",
            "Unlimited cart page boosters",
            "Add upsell products",
            "Analytics",
        ],
        trial: "7-day free trial",
    },
    {
        name: "Professional",
        price: "$29.99",
        features: [
            "Unlimited booster views",
            "Everything in Essential",
            "All premium features",
        ],
        trial: "7-day free trial",
    },
];

export default function PricingSection() {
    return (
        <section
            id="pricing"
            className="bg-[#fafafa] px-6 py-20 sm:px-10 lg:px-12"
        >
            <div className="mx-auto max-w-7xl">


                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-gray-950">
                        Pricing
                    </h2>

                    <p className="mt-2 text-lg text-gray-600 sm:text-xl">
                        Choose the plan that best fits your business.
                    </p>
                </div>


                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {plans.map((plan) => (
                        <div
                            key={plan.name}
                            className="flex aspect-square flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg"
                        >
                            <div className="flex-1 p-5">
                                <p className="text-base font-medium text-gray-600">
                                    {plan.name}
                                </p>

                                <div className="mt-2 flex items-baseline gap-1">
                                    <span className="text-2xl font-bold tracking-tight text-black">
                                        {plan.price}
                                    </span>

                                    {plan.price !== "Free" && (
                                        <span className="text-xs text-gray-500">
                                            / month
                                        </span>
                                    )}
                                </div>

                                <h3 className="mt-5 text-base font-semibold text-gray-950">
                                    Features
                                </h3>

                                <ul className="mt-2 space-y-2">
                                    {plan.features.map((feature) => (
                                        <li
                                            key={feature}
                                            className="flex items-start gap-2 text-sm leading-5 text-gray-600"
                                        >
                                            <span className="font-bold text-green-600">✓</span>
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {plan.trial && (
                                <div className="border-t border-gray-100 bg-gray-50 px-5 py-3">
                                    <p className="text-xs font-medium text-gray-600">
                                        {plan.trial}
                                    </p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Billing Information */}
                <p className="mt-12 text-base leading-7 text-gray-500">
                    All charges are billed in USD. Recurring and usage-based charges
                    are billed every 30 days.
                </p>

            </div>
        </section>
    );
}
