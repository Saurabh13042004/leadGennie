import { isIntelligenceConfigured } from "@/lib/intelligence/client";
import { linkedinAutomationEnabled } from "@/lib/feature-flags";

/** What this server can do, told to the extension so its UI never offers something that would fail. */
export type ExtensionFeatures = { linkedinAutomation: boolean; research: boolean };

export function extensionFeatures(): ExtensionFeatures {
  return { linkedinAutomation: linkedinAutomationEnabled(), research: isIntelligenceConfigured() };
}
