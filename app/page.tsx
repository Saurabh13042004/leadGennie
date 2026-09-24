import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Problem from "@/components/Problem";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import Waitlist from "@/components/Waitlist";
import Footer from "@/components/Footer";
import BackgroundEffects from "@/components/BackgroundEffects";

export default function Home() {
  return (
    <div className="relative min-h-screen bg-black text-white selection:bg-purple-500/30 selection:text-white overflow-hidden">
      {/* Interactive premium background effects (Grids, Blobs, Granulated Dust Canvas) */}
      <BackgroundEffects />
      
      <Navbar />
      
      <main className="flex flex-col relative z-10">
        <Hero />
        <Problem />
        <Features />
        <HowItWorks />
        <Waitlist />
      </main>

      <Footer />
    </div>
  );
}
