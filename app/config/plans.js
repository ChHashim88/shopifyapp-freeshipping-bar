
export const PLANS = {
    FREE: {
        name: "Free",
        price: 0,
        monthlyViewLimit: 1000,
        trialDays: 0,

        features: {
            topBar: true,
            productPage: true,
            cartPageBarLimit: 1,
            geolocationTargeting: false,
            excludeProducts: false,
            upsellProducts: false,
            analytics: false,
            premiumFeatures: false,
        },
    },

    STARTER: {
        name: "Starter",
        price: 9.99,
        monthlyViewLimit: 10000,
        trialDays: 7,

        features: {
            topBar: true,
            productPage: true,
            cartPageBarLimit: 1,
            geolocationTargeting: true,
            excludeProducts: true,
            upsellProducts: false,
            analytics: false,
            premiumFeatures: false,
        },
    },

    ESSENTIAL: {
        name: "Essential",
        price: 14.99,
        monthlyViewLimit: 50000,
        trialDays: 7,

        features: {
            topBar: true,
            productPage: true,
            cartPageBarLimit: null,
            geolocationTargeting: true,
            excludeProducts: true,
            upsellProducts: true,
            analytics: true,
            premiumFeatures: false,
        },
    },

    PROFESSIONAL: {
        name: "Professional",
        price: 29.99,
        monthlyViewLimit: null,
        trialDays: 0,

        features: {
            topBar: true,
            productPage: true,
            cartPageBarLimit: null,
            geolocationTargeting: true,
            excludeProducts: true,
            upsellProducts: true,
            analytics: true,
            premiumFeatures: true,
        },
    },
};
