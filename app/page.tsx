import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingHero from "@/components/landing/LandingHero";
import IntegrationsStrip from "@/components/landing/IntegrationsStrip";
import ProblemSolution from "@/components/landing/ProblemSolution";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import ProductSurface from "@/components/landing/ProductSurface";
import AgentBuilderSection from "@/components/landing/AgentBuilderSection";
import SecuritySection from "@/components/landing/SecuritySection";
import PricingSection from "@/components/landing/PricingSection";
import FaqSection from "@/components/landing/FaqSection";
import FinalCta from "@/components/landing/FinalCta";
import LandingFooter from "@/components/landing/LandingFooter";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <LandingNavbar />
      <main>
        <LandingHero />
        <IntegrationsStrip />
        <ProblemSolution />
        <HowItWorksSection />
        <ProductSurface />
        <AgentBuilderSection />
        <SecuritySection />
        <PricingSection />
        <FaqSection />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
