
const features = [
    {
        number: "01",
        title: "Multiple Placements",
        description:
            "Display your free shipping progress bar in supported storefront locations, helping customers see their progress while shopping.",
        icon: (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                className="h-7 w-7"
            >
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <path d="M3 9h18M9 9v12" />
            </svg>
        ),
    },
    {
        number: "02",
        title: "Customizable Design",
        description:
            "Customize colors, messages, dimensions and progress appearance to match your Shopify store's branding.",
        icon: (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                className="h-7 w-7"
            >
                <path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 1.5-3.3 1.8 1.8 0 0 1 1.4-3h1.1A3.5 3.5 0 0 0 21 11.2C21 6.7 17 3 12 3Z" />
                <circle cx="7.5" cy="10" r="1" />
                <circle cx="11" cy="7" r="1" />
                <circle cx="16" cy="8" r="1" />
            </svg>
        ),
    },
    {
        number: "03",
        title: "Cart Integration",
        description:
            "Keep the progress bar updated as customers add or remove products from their shopping cart.",
        icon: (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                className="h-7 w-7"
            >
                <path d="M3 3h2l2.5 12h10.8l2-8H6" />
                <circle cx="9" cy="19" r="1.5" />
                <circle cx="17" cy="19" r="1.5" />
            </svg>
        ),
    },
];

export default function FeaturesSection() {
    return (
        <section
            id="features"
            className="border-y border-gray-100  px-6 py-24"
        >
            <div className="mx-auto max-w-7xl">

                <div className="mx-auto max-w-2xl text-center">
                    <span className="text-sm font-bold uppercase tracking-widest text-green-600">
                        Powerful Features
                    </span>

                    <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                        Everything you need to encourage bigger orders
                    </h2>

                    <p className="mt-5 text-lg leading-8 text-gray-600">
                        Give your customers a clear reason to add more products
                        to their carts with a simple free shipping experience.
                    </p>
                </div>

                <div className="mt-16 grid gap-6 md:grid-cols-3">
                    {features.map((feature) => (
                        <div
                            key={feature.number}
                            className="group rounded-2xl border border-gray-200 bg-white p-8 transition duration-300 hover:-translate-y-1 hover:border-green-200 hover:shadow-xl"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-green-50 text-green-600 transition group-hover:bg-green-600 group-hover:text-white">
                                    {feature.icon}
                                </div>

                                <span className="text-sm font-bold text-gray-300">
                                    {feature.number}
                                </span>
                            </div>

                            <h3 className="mt-8 text-xl font-bold text-gray-900">
                                {feature.title}
                            </h3>

                            <p className="mt-4 leading-7 text-gray-600">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
