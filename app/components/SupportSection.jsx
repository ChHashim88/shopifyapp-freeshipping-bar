
const supportResources = [
    { title: "Privacy policy", url: "#" },
    { title: "FAQ", url: "#" },
    { title: "Tutorial", url: "#" },
    { title: "App Documentation", url: "#" },
];

export default function SupportSection() {
    return (
        <section
            id="support"
            className="border-t border-gray-200 bg-white px-6 py-20 sm:px-10 lg:px-12"
        >
            <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[280px_minmax(0,1fr)]">

                {/* LEFT FIXED SIDEBAR */}
                <aside className="h-fit lg:sticky lg:top-24">
                    <h2 className="text-2xl font-bold text-gray-950">
                        Support
                    </h2>

                    <p className="mt-3 text-sm leading-7 text-gray-600">
                        App support provided by the Free Shipping Booster team.
                    </p>
                </aside>

                {/* RIGHT CONTENT */}
                <div className="min-w-0">

                    {/* RESOURCES */}
                    <div>
                        <h3 className="border-b border-gray-200 pb-4 text-xl font-bold text-gray-950">
                            Resources
                        </h3>

                        <div className="divide-y divide-gray-100">
                            {supportResources.map((resource) => (
                                <div key={resource.title} className="py-5">
                                    <a
                                        href={resource.url}
                                        className="font-semibold text-gray-900 underline decoration-gray-300 underline-offset-4 hover:text-green-700"
                                    >
                                        {resource.title}
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* DEVELOPER */}
                    <div className="mt-12">
                        <h3 className="border-b border-gray-200 pb-4 text-xl font-bold text-gray-950">
                            Developer
                        </h3>

                        <div className="space-y-7 py-6">
                            <div>
                                <p className="font-semibold text-gray-900">
                                    Free Shipping Booster
                                </p>
                            </div>

                            <div>
                                <p className="text-sm font-semibold text-gray-700">
                                    Website
                                </p>
                                <p className="mt-2 text-sm text-gray-500">
                                    Website link will be added here.
                                </p>
                            </div>

                            <div>
                                <p className="text-sm font-semibold text-gray-700">
                                    Launched
                                </p>
                                <p className="mt-2 text-sm text-gray-500">
                                    Launch date to be announced.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* DATA ACCESS */}
                    <div className="mt-12">
                        <h3 className="border-b border-gray-200 pb-4 text-xl font-bold text-gray-950">
                            Data access
                        </h3>

                        <p className="mt-5 text-sm leading-7 text-gray-600">
                            This app needs access to certain store information
                            to provide its functionality. The exact permissions
                            are determined by the Shopify access scopes configured
                            for this app.
                        </p>

                        <div className="mt-8 space-y-8">
                            <div>
                                <h4 className="font-semibold text-gray-900">
                                    View staff and contributor data
                                </h4>

                                <p className="mt-3 text-sm leading-7 text-gray-600">
                                    Access details will be displayed according to
                                    the actual permissions requested by the app.
                                </p>
                            </div>

                            <div>
                                <h4 className="font-semibold text-gray-900">
                                    View and edit store data
                                </h4>

                                <p className="mt-3 text-sm leading-7 text-gray-600">
                                    Store data access will be described according
                                    to the actual Shopify access scopes.
                                </p>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
}
