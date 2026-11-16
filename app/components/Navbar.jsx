
export default function Navbar() {
    return (
        <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
            <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">

                <a href="/" className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-600 text-white">
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            className="h-6 w-6"
                        >
                            <path d="M3 7h11v10H3z" />
                            <path d="M14 10h4l3 3v4h-7z" />
                            <circle cx="7.5" cy="19" r="1.5" />
                            <circle cx="17.5" cy="19" r="1.5" />
                        </svg>
                    </div>

                    <div>
                        <h1 className="text-lg font-bold tracking-tight text-gray-900">
                            Free Shipping Booster
                        </h1>
                        <p className="text-xs text-gray-500">
                            Grow your store with every order
                        </p>
                    </div>
                </a>

                <div className="hidden items-center gap-8 md:flex">
                    <a href="#features" className="text-sm font-medium text-gray-600 hover:text-green-600">
                        Features
                    </a>
                    <a href="#how-it-works" className="text-sm font-medium text-gray-600 hover:text-green-600">
                        How it works
                    </a>
                    <a href="#pricing" className="text-sm font-medium text-gray-600 hover:text-green-600">
                        Pricing
                    </a>
                    <a href="#faq" className="text-sm font-medium text-gray-600 hover:text-green-600">
                        FAQ
                    </a>
                </div>

                <div className="hidden items-center gap-3 sm:flex">

                    <a
                        href="/auth/login"
                        className="rounded-xl bg-green-600 px-7 py-3.5 font-semibold text-white shadow-lg transition hover:bg-green-700"
                    >
                        Get Started
                    </a>
                </div>

                {/* Mobile button */}
                <a
                    href="#get-started"
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white sm:hidden"
                >
                    Get Started
                </a>
            </nav>
        </header>
    );
}
