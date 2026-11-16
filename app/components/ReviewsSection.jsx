
const ratingLevels = [
    { stars: 5, count: "—", percentage: 0 },
    { stars: 4, count: "—", percentage: 0 },
    { stars: 3, count: "—", percentage: 0 },
    { stars: 2, count: "—", percentage: 0 },
    { stars: 1, count: "—", percentage: 0 },
];

const sampleReviews = [
    {
        date: "Sample review",
        title: "A simple shopping experience",
        content:
            "This space will display verified feedback from merchants using Free Shipping Booster. Reviews can highlight setup, customization and storefront performance.",
        store: "Merchant store",
        location: "Country",
        duration: "Time using the app",
    },
    {
        date: "Sample review",
        title: "Easy to customize",
        content:
            "Merchant feedback about customizing the progress bar, matching store branding and displaying shipping goals across the storefront.",
        store: "Merchant store",
        location: "Country",
        duration: "Time using the app",
    },
    {
        date: "Sample review",
        title: "Helpful app experience",
        content:
            "Merchant feedback about the app experience, cart progress updates and customer support.",
        store: "Merchant store",
        location: "Country",
        duration: "Time using the app",
    },
];

function StarRating({ rating = 5 }) {
    return (
        <div className="flex items-center gap-1 text-amber-500">
            {Array.from({ length: 5 }).map((_, index) => (
                <svg
                    key={index}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className={`h-4 w-4 ${index < rating ? "" : "text-gray-200"
                        }`}
                >
                    <path d="M10 1.8l2.5 5.1 5.6.8-4.05 3.95.96 5.58L10 14.6l-5.01 2.63.96-5.58L1.9 7.7l5.6-.8L10 1.8z" />
                </svg>
            ))}
        </div>
    );
}

export default function ReviewsSection() {
    return (
        <section
            id="reviews"
            className="border-t border-gray-200 bg-white px-6 py-20"
        >
            <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[280px_minmax(0,1fr)]">

                {/* LEFT SIDEBAR */}
                <aside className="h-fit lg:sticky lg:top-24">
                    <h2 className="text-2xl font-bold text-gray-950">
                        Reviews
                    </h2>

                    <p className="mt-2 text-sm text-gray-500">
                        Merchant feedback
                    </p>

                    {/* Overall Rating */}
                    <div className="mt-8 border-b border-gray-200 pb-7">
                        <p className="text-sm font-semibold text-gray-800">
                            Overall rating
                        </p>

                        <div className="mt-3 flex items-center gap-3">
                            <span className="text-5xl font-bold text-gray-950">
                                —
                            </span>

                            <div>
                                <StarRating />
                                <p className="mt-1 text-xs text-gray-500">
                                    Rating not yet available
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Rating Distribution */}
                    <div className="space-y-4 border-b border-gray-200 py-7">
                        {ratingLevels.map((level) => (
                            <div
                                key={level.stars}
                                className="flex items-center gap-3"
                            >
                                <span className="w-3 text-sm text-gray-600">
                                    {level.stars}
                                </span>

                                <StarRating rating={level.stars} />

                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                                    <div
                                        className="h-full rounded-full bg-amber-400"
                                        style={{ width: `${level.percentage}%` }}
                                    />
                                </div>

                                <span className="w-5 text-right text-xs text-gray-500">
                                    {level.count}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Write Review */}
                    <button
                        type="button"
                        className="mt-7 w-full rounded-lg border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
                    >
                        Write a review
                    </button>

                    {/* Review Navigation */}
                    <div className="mt-8">
                        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
                            Browse reviews
                        </p>

                        <a
                            href="#all-reviews"
                            className="block rounded-lg bg-green-50 px-4 py-3 text-sm font-semibold text-green-700"
                        >
                            All reviews
                        </a>
                    </div>
                </aside>

                {/* RIGHT CONTENT */}
                <div id="all-reviews" className="min-w-0">

                    {/* Overview */}
                    <div className="rounded-2xl bg-gray-50 p-7 sm:p-9">
                        <span className="text-xs font-bold uppercase tracking-widest text-green-600">
                            Merchant Feedback
                        </span>

                        <h3 className="mt-3 text-2xl font-bold text-gray-950">
                            What merchants think
                        </h3>

                        <p className="mt-4 max-w-3xl text-base leading-8 text-gray-600">
                            This section will showcase genuine experiences from
                            merchants using Free Shipping Booster, including their
                            feedback on setup, customization, storefront display
                            and customer support.
                        </p>
                    </div>

                    {/* Individual Review Cards */}
                    <div className="mt-8 divide-y divide-gray-200">
                        {sampleReviews.map((review, index) => (
                            <article
                                key={index}
                                className="py-8 first:pt-0 last:pb-0"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <span className="text-sm text-gray-500">
                                        {review.date}
                                    </span>

                                    <StarRating />
                                </div>

                                <h4 className="mt-4 text-lg font-bold text-gray-950">
                                    {review.title}
                                </h4>

                                <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600">
                                    {review.content}
                                </p>

                                <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
                                    <span className="font-semibold text-gray-800">
                                        {review.store}
                                    </span>

                                    <span>{review.location}</span>

                                    <span>{review.duration}</span>
                                </div>
                            </article>
                        ))}
                    </div>

                    <p className="mt-8 rounded-lg border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">
                        Verified merchant reviews will be displayed here when available.
                    </p>
                </div>
            </div>
        </section>
    );
}
