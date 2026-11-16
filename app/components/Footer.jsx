
const footerGroups = [
    {
        title: "Product",
        links: [
            { label: "Features", href: "#features" },
            { label: "How it works", href: "#how-it-works" },
            { label: "Pricing", href: "#pricing" },
            { label: "Live demo", href: "#demo" },
        ],
    },
    {
        title: "Resources",
        links: [
            { label: "FAQs", href: "#faq" },
            { label: "Documentation", href: "#support" },
            { label: "Support", href: "#support" },
        ],
    },
    {
        title: "Company",
        links: [
            { label: "About", href: "#about" },
            { label: "Contact", href: "#support" },
            { label: "Reviews", href: "#reviews" },
        ],
    },
];

export default function Footer() {
    return (
        <footer className="bg-[#101828] text-white">
            {/* Main footer */}
            <div className="mx-auto max-w-7xl px-6 pb-12 pt-16 lg:px-8">

                {/* Top CTA */}
                <div className="mb-16 flex flex-col justify-between gap-8 rounded-3xl border border-white/10 bg-white/[0.05] p-8 md:flex-row md:items-center md:p-10">
                    <div className="max-w-xl">
                        <span className="mb-3 inline-flex rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                            GROW YOUR STORE
                        </span>

                        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                            Ready to turn more carts into bigger orders?
                        </h2>

                        <p className="mt-3 text-sm leading-6 text-gray-400 sm:text-base">
                            Give your customers a clear reason to add more to their carts
                            with Free Shipping Booster.
                        </p>
                    </div>

                    <a
                        href="/auth/login"
                        className="rounded-xl bg-green-600 px-7 py-3.5 font-semibold text-white shadow-lg transition hover:bg-green-700"
                    >
                        Get Started
                    </a>
                </div>


                <div className="grid grid-cols-1 gap-12 border-b border-white/10 pb-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">


                    <div className="max-w-sm">
                        <a href="/" className="inline-flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400 text-xl font-bold text-gray-950">
                                F
                            </div>

                            <span className="text-lg font-bold tracking-tight">
                                Free Shipping Booster
                            </span>
                        </a>

                        <p className="mt-5 text-sm leading-7 text-gray-400">
                            Encourage customers to spend more with a clear and engaging
                            free shipping progress bar. Make every cart count.
                        </p>

                        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs text-gray-300">
                            <span className="h-2 w-2 rounded-full bg-emerald-400" />
                            Built for Shopify stores
                        </div>
                    </div>


                    {footerGroups.map((group) => (
                        <div key={group.title}>
                            <h3 className="text-sm font-semibold text-white">
                                {group.title}
                            </h3>

                            <ul className="mt-5 space-y-4">
                                {group.links.map((link) => (
                                    <li key={link.label}>
                                        <a
                                            href={link.href}
                                            className="text-sm text-gray-400 transition hover:text-white"
                                        >
                                            {link.label}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>


                <div className="flex flex-col gap-5 pt-8 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-gray-500">
                        © {new Date().getFullYear()} Free Shipping Booster. All rights
                        reserved.
                    </p>

                    <div className="flex flex-wrap items-center gap-6">
                        <a
                            href="#support"
                            className="text-gray-400 transition hover:text-white"
                        >
                            Privacy Policy
                        </a>

                        <a
                            href="#support"
                            className="text-gray-400 transition hover:text-white"
                        >
                            Terms of Service
                        </a>

                        <a
                            href="#support"
                            className="text-gray-400 transition hover:text-white"
                        >
                            Contact Support
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
