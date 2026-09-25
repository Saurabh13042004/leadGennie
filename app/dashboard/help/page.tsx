import { Lifebuoy } from "@phosphor-icons/react/ssr";
import ComingSoon from "@/components/dashboard/ComingSoon";

export const metadata = {
  title: "Help & Support | LeadGennie",
};

export default function Page() {
  return (
    <ComingSoon
      title="Help & Support"
      description="Get assistance"
      icon={Lifebuoy}
    />
  );
}
