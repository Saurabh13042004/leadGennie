export type Channel = "email" | "linkedin_dm";

const EMAIL_TEMPLATES: { subject: string; body: string }[] = [
  {
    subject: "Quick question, {{first_name}}",
    body: `Hi {{first_name}},

Noticed {{company}} has been growing fast lately — congrats! Curious how you're handling outbound at scale right now.

Worth a 15-min chat next week?

— Jane`,
  },
  {
    subject: "Re: Quick question",
    body: `Bumping this up — happy to share how similar teams 3x'd reply rates last quarter. Open to a quick call?`,
  },
  {
    subject: "Last note from me, {{first_name}}",
    body: `Totally understand if the timing's off — I'll leave this here in case it's useful down the line. Door's always open if you want to chat outbound strategy at {{company}}.`,
  },
];

const LINKEDIN_TEMPLATES: string[] = [
  "Hey {{first_name}}, just sent you an email about scaling outbound at {{company}}. Would love to connect here too!",
  "Following up from my note, {{first_name}} — happy to share a quick benchmark on what's working for teams like {{company}} right now.",
];

export function generateAiMessage(stepIndex: number, channel: Channel) {
  if (channel === "email") {
    const template = EMAIL_TEMPLATES[stepIndex % EMAIL_TEMPLATES.length];
    return { subject: template.subject, body: template.body };
  }
  return { subject: undefined, body: LINKEDIN_TEMPLATES[stepIndex % LINKEDIN_TEMPLATES.length] };
}
