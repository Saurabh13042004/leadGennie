import {
  ChatText,
  ChatsCircle,
  EnvelopeSimple,
  Funnel,
  LinkedinLogo,
  ListBullets,
  MagnifyingGlass,
  Phone,
  Tag,
  TextAlignLeft,
  WhatsappLogo,
} from "@phosphor-icons/react/ssr";
import type { Tone } from "@/components/ui/Badge";
import type { NavIcon } from "@/lib/nav-config";
import type { PromptType } from "@/lib/prompts-constants";

export const TYPE_LABEL: Record<PromptType, string> = {
  email: "Email",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
  sms: "SMS",
  cold_call: "Cold call script",
  research: "Research",
  qualification: "Qualification",
  classification: "Classification",
  extraction: "Extraction",
  summarization: "Summarization",
};

export const TYPE_ICON: Record<PromptType, NavIcon> = {
  email: EnvelopeSimple,
  linkedin: LinkedinLogo,
  whatsapp: WhatsappLogo,
  sms: ChatText,
  cold_call: Phone,
  research: MagnifyingGlass,
  qualification: Funnel,
  classification: Tag,
  extraction: ListBullets,
  summarization: TextAlignLeft,
};

export const typeLabel = (t: string) => TYPE_LABEL[t as PromptType] ?? t.replace(/_/g, " ");
export const typeIcon = (t: string): NavIcon => TYPE_ICON[t as PromptType] ?? ChatsCircle;

export const STATUS_META: Record<string, { tone: Tone; label: string }> = {
  draft: { tone: "neutral", label: "Draft" },
  pending_approval: { tone: "indigo", label: "Pending approval" },
  published: { tone: "emerald", label: "Published" },
  deprecated: { tone: "neutral", label: "Deprecated" },
  rejected: { tone: "rose", label: "Rejected" },
};

export const statusMeta = (s: string) => STATUS_META[s] ?? { tone: "neutral" as Tone, label: s };
