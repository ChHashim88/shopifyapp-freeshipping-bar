
const steps = [
    {
        number: "01",
        title: "Set Your Shipping Goal",
        description:
            "Choose the minimum cart value customers need to reach to unlock free shipping.",
        icon: (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                className="h-8 w-8"
            >
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="12" r="5" />
                <circle cx="12" cy="12" r="1" />
            </svg>
        ),
    },
    {
        number: "02",
        title: "Customize Your Bar",
        description:
            "Choose your messages, colors and appearance to match your storefront design.",
        icon: (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                className="h-8 w-8"
            >
                <path d="m15 5 4 4M4 20l4-.8L19 8a2.8 2.8 0 0 0-4-4L4 15z" />
                <path d="M13 5 19 11" />
            </svg>
        ),
    },
    {
        number: "03",
        title: "Encourage Bigger Orders",
        description:
            "Show customers how close they are to free shipping and motivate them to add more to their carts.",
        icon: (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                className="h-8 w-8"
            >
                <path d="M3 17l6-6 4 4 8-9" />
                <path d="M15 6h6v6" />
            </svg>
        ),
    },
];

export default function HowItWorksSection() {
    return (
        <section
            id="how-it-works"
            className="bg-white px-6 py-24"
        >
            <div className="mx-auto max-w-7xl">

                {/* Section Heading */}
                <div className="mx-auto max-w-2xl text-center">
                    <span className="text-sm font-bold uppercase tracking-widest text-green-600">
                        Simple Setup
                    </span>

                    <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                        Get started in three simple steps
                    </h2>

                    <p className="mt-5 text-lg leading-8 text-gray-600">
                        Set up your free shipping experience and start encouraging
                        customers to reach their order goals.
                    </p>
                </div>

                {/* Steps */}
                <div className="relative mt-16 grid gap-12 md:grid-cols-3">

                    {steps.map((step) => (
                        <div
                            key={step.number}
                            className="relative text-center"
                        >
                            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-green-50 text-green-600">
                                {step.icon}
                            </div>

                            <span className="mt-6 inline-block text-sm font-bold tracking-widest text-green-600">
                                STEP {step.number}
                            </span>

                            <h3 className="mt-3 text-xl font-bold text-gray-900">
                                {step.title}
                            </h3>

                            <p className="mx-auto mt-4 max-w-sm leading-7 text-gray-600">
                                {step.description}
                            </p>
                        </div>
                    ))}

                </div>
            </div>
        </section>
    );
}
