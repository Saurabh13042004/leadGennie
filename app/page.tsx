import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingHero from "@/components/landing/LandingHero";
import LogoStrip from "@/components/landing/LogoStrip";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import FeatureGrid from "@/components/landing/FeatureGrid";
import ResultsBand from "@/components/landing/ResultsBand";
import FinalCta from "@/components/landing/FinalCta";
import LandingFooter from "@/components/landing/LandingFooter";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <LandingNavbar />
      <main>
        <LandingHero />
        <LogoStrip />
        <HowItWorksSection />
        <FeatureGrid />
        <ResultsBand />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
