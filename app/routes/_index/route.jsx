
import { redirect, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import Navbar from "../../components/Navbar";
import AppIdentity from "../../components/AppIdentity";
import AppPreview from "../../components/AppPreview";
import FeaturesSection from "../../components/FeaturesSection";
import PricingSection from "../../components/PricingSection";
import ReviewsSection from "../../components/ReviewsSection";
import SupportSection from "../../components/SupportSection";


import Footer from "../../components/Footer";

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return {
    showForm: Boolean(login),
  };
};

export default function LandingPage() {
  const { showForm } = useLoaderData();

  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <section className="mx-auto max-w-7xl px-6 pt-8 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-16">


          <aside className="h-fit lg:sticky lg:top-24">
            <AppIdentity />
          </aside>


          <div className="min-w-0 space-y-16">

            <AppPreview />
          </div>

        </div>
      </section>
      <FeaturesSection />
      <PricingSection />
      <ReviewsSection />
      <SupportSection />
      <Footer />

    </main>
  );
}
