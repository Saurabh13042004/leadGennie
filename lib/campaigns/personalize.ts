export function personalize(text: string, lead: { full_name: string; company: string | null }) {
  const firstName = lead.full_name.trim().split(/\s+/)[0] || lead.full_name;
  return text
    .replaceAll("{{first_name}}", firstName)
    .replaceAll("{{company}}", lead.company || "your company");
}
