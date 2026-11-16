
export default function AppIdentity() {
    return (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-md">

            <div className="flex flex-col items-center text-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-green-500 to-green-700 shadow-lg shadow-green-600/20">
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-12 w-12"
                    >
                        <path d="M3 7h11v10H3z" />
                        <path d="M14 10h4l3 3v4h-7z" />
                        <circle cx="7.5" cy="19" r="1.5" />
                        <circle cx="17.5" cy="19" r="1.5" />
                    </svg>
                </div>

                <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-gray-900">
                    Free Shipping Booster
                </h2>

                <p className="mt-3 max-w-xs text-sm leading-6 text-gray-500">
                    Increase your average order value with smart, customizable free
                    shipping goals.
                </p>

                <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
                        Free during testing
                    </span>

                    <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600">
                        Shopify App
                    </span>
                </div>

                <div className="my-6 w-full border-t border-gray-100" />


                <div className="flex w-full flex-col gap-3">

                    <a
                        href="https://essentials-dev-szq4cn5c.myshopify.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="..."
                    >
                        View Demo Store
                    </a>

                    <a
                        href="#get-started"
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3.5 text-sm font-semibold text-white shadow-md shadow-green-600/20 transition duration-200 hover:-translate-y-0.5 hover:bg-green-700"
                    >
                        Install
                        <span aria-hidden="true">→</span>
                    </a>

                </div>

                <p className="mt-5 text-xs text-gray-400">
                    Simple setup. Flexible customization.
                </p>

            </div>
        </section>
    );
}
