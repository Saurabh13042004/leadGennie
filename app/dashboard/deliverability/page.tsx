import { Mail } from "lucide-react";
import ComingSoon from "@/components/dashboard/ComingSoon";

export const metadata = {
  title: "Email Deliverability | LeadGennie",
};

export default function Page() {
  return (
    <ComingSoon
      title="Email Deliverability"
      description="Mailboxes, domains & warmup"
      icon={Mail}
    />
  );
}
