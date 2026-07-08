import { KeyRound } from "lucide-react";
import ComingSoon from "@/components/dashboard/ComingSoon";

export const metadata = {
  title: "API Credentials | LeadGennie",
};

export default function Page() {
  return (
    <ComingSoon
      title="API Credentials"
      description="Secure API access"
      icon={KeyRound}
    />
  );
}
