import { Ban } from "lucide-react";
import ComingSoon from "@/components/dashboard/ComingSoon";

export const metadata = {
  title: "Do Not Contact | LeadGennie",
};

export default function Page() {
  return (
    <ComingSoon
      title="Do Not Contact"
      description="Exclusion list"
      icon={Ban}
    />
  );
}
