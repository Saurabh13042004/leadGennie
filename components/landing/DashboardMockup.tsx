import MockupSidebar from "./MockupSidebar";
import MockupLeadsPanel from "./MockupLeadsPanel";
import MockupGennieCard from "./MockupGennieCard";

/**
 * Faithful miniature of the dashboard: #f4f4f3 shell + sidebar, white Leads panel, and a floating Ask Gennie card.
 * Built at real size (13px UI text) and made responsive by dropping the sidebar/columns rather than scaling it down.
 */
export default function DashboardMockup() {
  return (
    <div className="relative" role="img" aria-label="The LeadGennie Leads view with an Ask Gennie run">
      <div className="pointer-events-none absolute -inset-x-16 -bottom-10 -top-16 -z-10 bg-[radial-gradient(ellipse_at_30%_20%,rgba(99,102,241,0.22),transparent_55%),radial-gradient(ellipse_at_80%_70%,rgba(217,70,239,0.14),transparent_50%),radial-gradient(ellipse_at_60%_0%,rgba(56,189,248,0.14),transparent_45%)] blur-2xl" />

      <div className="lg:[perspective:2400px]" aria-hidden>
        <div className="origin-top transition-transform duration-700 ease-out lg:[transform:rotateX(9deg)_rotateY(-5deg)_rotateZ(0.6deg)] lg:hover:[transform:rotateX(4deg)_rotateY(-2deg)_rotateZ(0.2deg)]">
          <div className="overflow-hidden rounded-2xl bg-[#f4f4f3] p-1.5 shadow-[0_50px_100px_-30px_rgba(49,46,129,0.35),0_16px_40px_-16px_rgba(0,0,0,0.18),0_0_0_1px_rgba(0,0,0,0.06)] md:p-2 [mask-image:linear-gradient(to_bottom,black_78%,transparent)]">
            <div className="flex h-[440px] md:h-[560px]">
              <div className="hidden md:block">
                <MockupSidebar />
              </div>
              <MockupLeadsPanel />
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-8 -right-4 hidden lg:block xl:-right-10" aria-hidden>
        <MockupGennieCard className="rotate-[-1.5deg]" />
      </div>
    </div>
  );
}
