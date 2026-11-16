export default function HeroSection() {
    return (
        <section className="mx-auto flex min-h-[500px] max-w-7xl items-center justify-center px-6 py-16 text-center lg:px-8">
            <div className="flex max-w-4xl flex-col items-center">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
                    Smart Free Shipping Progress Bar
                </div>

                <h1 className="max-w-4xl text-4xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
                    Turn more carts into
                    <span className="text-green-600"> bigger orders.</span>
                </h1>

                <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600">
                    Encourage customers to spend more with a customizable free shipping
                    progress bar. Set your shipping goal and turn every cart into an
                    opportunity.
                </p>

                <div className="mt-8 flex flex-wrap justify-center gap-4">
                    <a
                        href="/auth/login"
                        className="rounded-xl bg-green-600 px-7 py-3.5 font-semibold text-white shadow-lg transition hover:bg-green-700"
                    >
                        Get Started
                    </a>

                    <a
                        href="https://essentials-dev-szq4cn5c.myshopify.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl border border-gray-300 px-7 py-3.5 font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                        View Live Demo
                    </a>
                </div>


                <p className="mt-5 text-sm text-gray-500">
                    Easy setup · Flexible customization · Free to get started
                </p>
            </div>
        </section>
    );
}