import { listEmailsAtDomain, type EmailAtDomain } from "@/lib/db/leads-lookup";
import { normalizeDomain } from "@/lib/domain/companies/normalize";
import { isDisposableDomain, isFreeMailDomain } from "@/lib/domain/leads/email";
import { defaultMxResolver, resolveDomains, type MxResolver } from "@/lib/domain/leads/mx";
import { guessDomains, guessEmails, type EmailGuess } from "./email-guess";

/**
 * "Suggested emails" for the capture card. Everything returned here is a GUESS and is labelled as one by the UI; nothing is
 * stored until the person picks one and saves. Two real signals keep the guesses honest:
 *   - the company's domain must be able to receive mail at all (an MX lookup), else we suggest nothing;
 *   - if the workspace already has emails at that domain, the format they use is ranked first.
 */
export type SuggestInput = { fullName?: string | null; company?: string | null; companyDomain?: string | null };

export type Suggestions = {
  emails: EmailGuess[];
  /** Websites worth trying when the company's domain is unknown (each accepts mail — still only a guess). */
  domainGuesses: string[];
  /** Why there is nothing to show, when there isn't. */
  note: string | null;
};

export type SuggestDeps = {
  mx: MxResolver;
  known: (workspaceId: number, domain: string) => Promise<EmailAtDomain[]>;
};

export const defaultSuggestDeps: SuggestDeps = { mx: defaultMxResolver, known: (ws, d) => listEmailsAtDomain(ws, d, 60) };

export async function suggestForCard(workspaceId: number, input: SuggestInput, deps: SuggestDeps = defaultSuggestDeps): Promise<Suggestions> {
  const fullName = input.fullName?.trim() ?? "";
  const domain = normalizeDomain(input.companyDomain);

  if (domain) {
    if (isFreeMailDomain(domain) || isDisposableDomain(domain)) {
      return { emails: [], domainGuesses: [], note: `${domain} is a personal mail provider, not a company domain.` };
    }
    if (!fullName) return { emails: [], domainGuesses: [], note: "Enter a name to see suggested emails." };
    const [mx, known] = await Promise.all([deps.mx.resolve(domain), deps.known(workspaceId, domain)]);
    // Only a DEFINITE "no mail server" blocks suggestions; an inconclusive lookup (offline, timeout) must not hide them.
    if (mx === "no_mx") return { emails: [], domainGuesses: [], note: `${domain} has no mail server, so there are no addresses to suggest.` };
    const emails = guessEmails({ fullName, domain, known });
    return { emails, domainGuesses: [], note: emails.length ? null : "Enter a first name to see suggested emails." };
  }

  const guesses = guessDomains(input.company);
  if (guesses.length === 0) return { emails: [], domainGuesses: [], note: "Add the company website to see suggested emails." };
  const checked = await resolveDomains(deps.mx, guesses);
  const alive = guesses.filter((g) => checked.get(g) === "has_mx");
  return { emails: [], domainGuesses: alive, note: "Add the company website to see suggested emails." };
}
