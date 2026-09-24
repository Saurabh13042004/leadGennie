import type { DraftClaim, GenerationOutput, PersonalizationContext, ValidationIssue } from "./types";

/**
 * Deterministic draft validators (spec WP3.2). Pure functions: no IO, no LLM. They prove TRACEABILITY — every
 * assertion about the recipient/company must be a phrase the model tied to a verified evidence row that says the
 * same thing — not truth; evidence quality (the engine's Evidence Validator) is the ceiling on truth.
 *
 * Fail closed: anything they cannot tie to the supplied context is an error, and a draft with errors is never
 * approvable without a human editing it.
 */

const err = (code: string, message: string): ValidationIssue => ({ code, severity: "error", message });
const warn = (code: string, message: string): ValidationIssue => ({ code, severity: "warning", message });

// ---- text helpers -------------------------------------------------------------------------------------------

export const normText = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const STOP = new Set(
  "the a an and or but of to in on at for with from by as is are was were be been being it its this that these those you your yours we our us i my me they their them he she his her not no so if then than too very can could would should will just about into over out up down more most some any all each other such only own same also have has had do does did get got make made".split(" "),
);

/** Sentence-leading words that are capitalized by grammar, beyond the plain stop words. */
const LEADING = new Set(["after", "since", "given", "recent", "new", "congrats", "congratulations", "noticing", "seeing", "saw", "as", "following"]);

/** Very light stemmer: "hiring"/"hires"/"hired" → "hir", "meetings" → "meet", "qualified"/"qualify" → "quali". */
export function stem(word: string): string {
  let w = word.toLowerCase();
  for (let i = 0; i < 2; i++) {
    const m = /(ing|ed|es|ly|s|e|y)$/.exec(w);
    if (m && w.length - m[0].length >= 3) w = w.slice(0, -m[0].length);
    else break;
  }
  return w.slice(0, 5);
}

const contentWords = (s: string): string[] =>
  normText(s).split(" ").filter((w) => w.length > 2 && !STOP.has(w)).map(stem);

/**
 * Words that carry no factual content in a cold email — conversation, intent, scheduling. A sentence made only of
 * these plus words from the supplied context asserts nothing new. Extending this list loosens the "unsupported
 * statement" check, so add only words that can't state a fact about anybody.
 */
const GENERIC = new Set(
  (
    "hi hello hey dear thanks thank best regards cheers quick brief short chat call talk discuss discussion explore learn share show see ask asked asking wanted want wondering wonder curious " +
    "interested open worth love hope hoping thought think thinking reach reaching touch connect help helps helping helped work works working worked team teams company business time week weeks month today tomorrow " +
    "next currently now right often way ways approach plan plans planning handle handling handles priority radar quarter question questions idea ideas example similar like just much many really also still even ever " +
    "always never something anything everything someone anyone people folks email message note reply respond response available schedule chance minutes minute fit relevant mind look looking looks know knowing " +
    "there together would could might should shall let lets get gets going come take give put make makes need needs bit little lot part side point thing things day days year years first last around about"
  )
    .split(" ")
    .map(stem),
);

const wordSet = (s: string) => new Set(normText(s).split(" ").filter(Boolean));

/** Sentences and lines, in order. Each line start counts as a sentence start (greetings, sign-offs). */
export function sentencesOf(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---- allowed-context knowledge ------------------------------------------------------------------------------

function knownText(ctx: PersonalizationContext): string {
  const parts = [
    ctx.lead.fullName, ctx.lead.title ?? "", ctx.company.name, ctx.company.domain ?? "", ctx.company.industry ?? "", ctx.company.description ?? "",
    ctx.sender.name ?? "", ctx.sender.company ?? "", ctx.sender.positioning,
    ...ctx.evidence.flatMap((e) => [e.claim, e.snippet, e.sourceTitle ?? ""]),
    ...(ctx.strategy ? [ctx.strategy.whyContact, ctx.strategy.whyNow, ctx.strategy.whyPerson, ctx.strategy.recommendedAngle] : []),
  ];
  return parts.join(" \n ");
}

/** Capitalized words that are not names of anything: weekdays, months, generic business acronyms. */
const COMMON_CAPS = new Set(
  [
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
    "crm", "api", "saas", "b2b", "b2c", "ai", "roi", "kpi", "sdr", "bdr", "ceo", "cto", "cfo", "coo", "cmo", "vp", "hr", "it", "us", "uk", "eu",
    "utc", "ps", "fyi", "seo", "smb", "gtm", "icp", "llm", "pst", "est", "ist", "gmt", "am", "pm", "ok",
  ],
);

// ---- individual validators ----------------------------------------------------------------------------------

const PLACEHOLDER = /\{\{[^}]*\}\}|\{[a-z_]+\}|\[\s*(?:first ?name|name|company|your [a-z ]+|insert [a-z ]+|[A-Z][A-Z _]{2,})\s*\]|<\s*(?:first ?name|name|company)[^>]*>/i;

function placeholders(text: string): ValidationIssue[] {
  const m = text.match(PLACEHOLDER);
  return m ? [err("unresolved_placeholder", `The email contains an unfilled placeholder (“${m[0]}”).`)] : [];
}

/** Inference dressed as observation. The model may only report what the evidence says, not what it "suggests". */
const SPECULATION = /\b(which (?:suggests?|means|indicates?|implies|shows)|suggest(?:s|ing)? that|indicat(?:es|ing) (?:that|a|an|your)|impl(?:ies|ying) that|apparently|presumably|probably|seems? (?:to|like|that)|must be|i (?:assume|imagine|guess|suspect)|no doubt|surely|obviously|clearly your)\b/i;

const SPAM: [RegExp, string][] = [
  [/\bfree (trial|demo|quote|gift|consultation|audit|report)\b/i, "spammy “free …” offer"],
  [/\b(guarantee[ds]?|risk[- ]free|no obligation|act now|limited[- ]time|buy now|click here|last chance|once in a lifetime|today only|don'?t miss)\b/i, "spam/urgency wording"],
  [/\b100\s?%/i, "“100%” claim"],
  [/\burgent(ly)?\b/i, "artificial urgency"],
  [/\b(before it'?s too late|offer expires|expires (today|soon|tonight))\b/i, "artificial urgency"],
];
const FLATTERY: [RegExp, string][] = [
  [/\b(impressed|impressive|amazing|incredible|fantastic|awesome|great work|kudos|admire|love what you|big fan)\b/i, "flattery the sender cannot back"],
];
const EMBELLISHMENT: [RegExp, string][] = [
  [/\b(seamless(?:ly)?|effortless(?:ly)?|robust|innovative|powerful|cutting[- ]edge|world[- ]class|state[- ]of[- ]the[- ]art|revolutionary|ever[- ]evolving|best[- ]in[- ]class|game[- ]chang\w+|industry[- ]leading|market[- ]leading)\b/i, "embellishment the evidence does not contain"],
];
const FAKE_FAMILIARITY: [RegExp, string][] = [
  [/\b(as we discussed|per our (call|conversation|chat)|following up on our|our (last|previous|earlier) (call|conversation|chat|meeting)|as promised)\b/i, "refers to a prior conversation that never happened"],
  [/\b(we (met|spoke|talked|connected)|great (meeting|talking|speaking) (to|with) you|good to see you|nice (meeting|seeing) you)\b/i, "claims a prior meeting"],
  [/\bmutual (connection|friend|contact|acquaintance)s?\b/i, "invents a mutual connection"],
];
const FILLER: [RegExp, string][] = [
  [/\bi hope (this|you)[^.!?\n]{0,40}(finds you well|are doing well|are well)\b/i, "filler opening"],
  [/\b(just )?(checking in|touching base|circling back)\b/i, "filler wording"],
  [/\b(synergy|leverage|streamline|unlock|revolutioni[sz]e)\b/i, "corporate buzzword"],
];

function bannedPhrases(text: string): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  for (const [rx, why] of [...SPAM, ...FLATTERY, ...EMBELLISHMENT, ...FAKE_FAMILIARITY]) if (rx.test(text)) out.push(err("banned_phrase", `Not allowed in cold email: ${why} (“${text.match(rx)![0]}”).`));
  const spec = text.match(SPECULATION);
  if (spec) out.push(err("speculation", `Speculation presented as insight (“${spec[0]}”): state only what the evidence says.`));
  for (const [rx, why] of FILLER) if (rx.test(text)) out.push(warn("weak_phrase", `Consider rewording: ${why} (“${text.match(rx)![0]}”).`));
  return out;
}

const URL_LIKE = /\bhttps?:\/\/[^\s)>\]]+|\bwww\.[^\s)>\]]+|\b[a-z0-9][a-z0-9-]*\.(?:com|io|ai|co|net|org|app|dev|xyz|so|me|us|uk|in)\b(?:\/[^\s)>\]]*)?/gi;
const EMAIL_LIKE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

function links(text: string, ctx: PersonalizationContext): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  if (EMAIL_LIKE.test(text)) out.push(err("disallowed_link", "The email contains an email address; cold copy must not include contact addresses."));
  EMAIL_LIKE.lastIndex = 0;
  const allowed = (ctx.company.domain ?? "").toLowerCase().replace(/^www\./, "");
  const stripped = text.replace(EMAIL_LIKE, " ");
  for (const m of stripped.match(URL_LIKE) ?? []) {
    const host = m.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
    if (allowed && host === allowed) continue;
    out.push(err("disallowed_link", `The email contains a link (“${m}”). Only the unsubscribe footer (added at send time) may carry links.`));
  }
  return out;
}

function lengthAndSubject(subject: string, body: string): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  if (words < 15) out.push(err("too_short", `The body is ${words} words; it needs at least 15 to read as a real email.`));
  if (words > 180) out.push(err("too_long", `The body is ${words} words; keep it under 180 (aim for 60–120).`));
  else if (words > 130) out.push(warn("long", `The body is ${words} words; shorter emails get more replies.`));
  if (!subject.trim()) out.push(err("empty_subject", "The subject is empty."));
  if (subject.length > 80) out.push(err("subject_too_long", `The subject is ${subject.length} characters; keep it under 80.`));
  if (/^\s*(re|fwd?)\s*:/i.test(subject)) out.push(err("fake_reply_subject", "The subject fakes an existing thread (Re:/Fwd:)."));
  if (subject.length > 6 && subject === subject.toUpperCase()) out.push(warn("shouty_subject", "The subject is in ALL CAPS."));
  if ((subject.match(/!/g) ?? []).length > 1) out.push(warn("shouty_subject", "The subject has multiple exclamation marks."));
  if ((body.match(/\?/g) ?? []).length > 2) out.push(warn("multiple_questions", "The email asks several questions; one clear call to action converts better."));
  return out;
}

const GREETING = /^\s*(?:hi|hello|hey|dear|good (?:morning|afternoon|evening))\s+([^,!.\n]{1,40})\s*[,!.:]?\s*$|^\s*(?:hi|hello|hey|dear)\s+([^,!.\n]{1,40})\s*[,!.:]/i;

function recipient(body: string, ctx: PersonalizationContext): ValidationIssue[] {
  const first = body.split("\n").find((l) => l.trim())?.trim() ?? "";
  const m = first.match(GREETING);
  if (!m) return [];
  const name = (m[1] ?? m[2] ?? "").trim();
  if (!name) return [];
  const lower = name.toLowerCase();
  if (ctx.lead.firstName ? lower === ctx.lead.firstName.toLowerCase() : /^(there|team)$/.test(lower)) return [];
  if (/^(there|team)$/.test(lower)) return []; // a neutral greeting is never wrong
  return [err("wrong_recipient", `The greeting addresses “${name}” but the recipient is ${ctx.lead.firstName ?? ctx.lead.fullName}.`)];
}

/** "Exploring Meeting Efficiency": most substantial words capitalized. Capitals carry no "this is a name" signal there. */
function isTitleCase(text: string): boolean {
  const words = (text.match(/[\p{L}][\p{L}'’-]*/gu) ?? []).filter((w) => w.length > 3);
  return words.length >= 3 && words.filter((w) => /^\p{Lu}/u.test(w)).length / words.length >= 0.6;
}

/** Capitalized mid-sentence words that appear nowhere in the supplied context: names, products, places we made up. */
function unknownEntities(text: string, ctx: PersonalizationContext, known: Set<string>): ValidationIssue[] {
  const found = new Set<string>();
  for (const sentence of sentencesOf(text)) {
    const tokens = sentence.match(/[\p{L}][\p{L}\p{N}&'’.-]*/gu) ?? [];
    tokens.forEach((raw, i) => {
      if (i === 0) return; // sentence/line start is capitalized by grammar, not because it is a name
      const t = raw.replace(/['’]s$/i, "").replace(/[.'’-]+$/g, "");
      if (t.length < 2 || !/^\p{Lu}/u.test(t)) return;
      if (/^I['’]/.test(raw)) return;
      const lower = t.toLowerCase();
      if (COMMON_CAPS.has(lower) || known.has(lower)) return;
      // Hyphenated/dotted compounds are known if every part is ("Series-B" is not; "Co-founder" is).
      if (lower.split(/[-.]/).every((p) => !p || known.has(p) || COMMON_CAPS.has(p))) return;
      found.add(t);
    });
  }
  return [...found].map((t) =>
    err("unknown_entity", `“${t}” is named in the email but appears nowhere in the verified context (possible invented company, product, person or place).`),
  );
}

// ---- claim → evidence ---------------------------------------------------------------------------------------

/** Vocabulary that marks a sentence as asserting something about the world (funding, hiring, news, events …). */
const CLAIM_VOCAB =
  /(?:(?<![A-Za-z])\d|[$€£%])|\b(?:congrat\w*|funding|funded|raised|raising|series [a-e]\b|seed round|invested in|hired?|hiring|expan\w+|launch\w*|acqui\w+|announc\w+|partnered|partnership with|opened|opening (?:a|an|its|new)|growing|grew|promot\w+|appointed|joined|revenue|valuation|ipo|layoffs?|award\w*|ranked|noticed|saw that|read that|heard that|came across|mentioned|your recent|recently|newly|just (?:raised|launched|hired|announced))\b/i;

function hasClaimVocab(sentence: string, ctx: PersonalizationContext): boolean {
  let s = sentence;
  // The recipient's own title/company name and "15-minute call" are not assertions.
  if (ctx.lead.title) s = s.split(ctx.lead.title).join(" ");
  if (ctx.company.name) s = s.split(ctx.company.name).join(" ");
  s = s.replace(/\b\d+\s*-?\s*(?:minutes?|mins?|hours?|days?|weeks?)\b/gi, " ");
  const positioning = ctx.sender.positioning.toLowerCase();
  const positioningStems = new Set(contentWords(ctx.sender.positioning));
  const rx = new RegExp(CLAIM_VOCAB.source, "gi");
  for (const m of s.matchAll(rx)) {
    const hit = m[0].toLowerCase();
    // Words the sender used to describe their OWN offer ("without hiring more SDRs") are not claims about anyone else.
    if (/\d/.test(hit) ? positioning.includes(hit) : positioningStems.has(stem(hit.split(" ")[0]))) continue;
    return true;
  }
  return false;
}

/** Does `claim` say what the evidence says? Numbers, names and most content words must be present in the evidence. */
export function claimSupported(claimText: string, evidenceText: string, whitelist: Set<string>): { ok: boolean; reason: string } {
  const evNorm = normText(evidenceText);
  const evWords = wordSet(evidenceText);
  // Whole numbers only: "4" must not be "found" inside "14" or "2024".
  const evNumbers = new Set(evidenceText.replace(/(\d),(?=\d{3})/g, "$1").match(/\d+(?:\.\d+)?/g) ?? []);
  for (const n of claimText.replace(/(\d),(?=\d{3})/g, "$1").match(/\d+(?:\.\d+)?/g) ?? []) {
    if (!evNumbers.has(n)) return { ok: false, reason: `the number ${n} is not in the cited evidence` };
  }
  let failed = "";
  const caps = (claimText.match(/[\p{L}][\p{L}\p{N}&'’.-]*/gu) ?? []).map((t) => t.replace(/['’]s$/i, "").replace(/[.'’-]+$/g, ""));
  caps.forEach((t, i) => {
    if (t.length < 2 || !/^\p{Lu}/u.test(t)) return;
    const lower = t.toLowerCase();
    // A claim phrase often begins a sentence ("With Dana joining…"): a leading function word is grammar, not a name.
    if (i === 0 && (STOP.has(lower) || LEADING.has(lower))) return;
    if (!evWords.has(lower) && !whitelist.has(lower) && !COMMON_CAPS.has(lower) && !evNorm.includes(lower)) {
      failed = `“${t}” is not in the cited evidence`;
    }
  });
  if (failed) return { ok: false, reason: failed };
  const cw = contentWords(claimText);
  if (cw.length === 0) return { ok: false, reason: "the claim has no substantive content to check" };
  const ev = new Set(contentWords(evidenceText));
  const overlap = cw.filter((w) => ev.has(w)).length / cw.length;
  if (overlap < 0.5) return { ok: false, reason: "the cited evidence does not say this" };
  return { ok: true, reason: "" };
}

const containsNorm = (haystack: string, needle: string) => normText(haystack).includes(normText(needle));

export type ValidateInput = {
  subject: string;
  body: string;
  claims: { text: string; evidence_id: number }[];
  usedEvidenceIds: number[];
};

export type ValidateOptions = {
  /** User-edited text: claims whose phrase was edited away are simply dropped instead of being an error. */
  edited?: boolean;
};

export function validateDraft(input: ValidateInput, ctx: PersonalizationContext, opts: ValidateOptions = {}): ValidationIssue[] {
  const { subject, body } = input;
  const all = `${subject}\n${body}`;
  const known = wordSet(knownText(ctx));
  const evById = new Map(ctx.evidence.map((e) => [e.id, e]));
  const issues: ValidationIssue[] = [];

  issues.push(...placeholders(all), ...bannedPhrases(all), ...links(all, ctx), ...lengthAndSubject(subject, body), ...recipient(body, ctx));
  // A Title-Case subject can't be checked by capitalization; its words are still held to the claim rules below.
  issues.push(...unknownEntities(body, ctx, known), ...(isTitleCase(subject) ? [] : unknownEntities(subject, ctx, known)));

  // 1. Evidence ids must be ones we supplied (verified, this lead, this workspace).
  for (const id of new Set(input.usedEvidenceIds)) {
    if (!evById.has(id)) issues.push(err("unknown_evidence", `The draft cites evidence #${id}, which is not part of this lead's verified evidence.`));
  }

  // 2. Every personalized claim: real evidence, present in the text, and actually supported by that evidence.
  const activeClaims: { text: string; evidence_id: number }[] = [];
  for (const c of input.claims) {
    const ev = evById.get(c.evidence_id);
    if (!ev) {
      issues.push(err("unknown_evidence", `“${c.text}” cites evidence #${c.evidence_id}, which is not part of this lead's verified evidence.`));
      continue;
    }
    if (!containsNorm(all, c.text)) {
      if (!opts.edited) issues.push(err("claim_not_in_text", `The claim “${c.text}” is listed but does not appear in the email.`));
      continue;
    }
    activeClaims.push(c);
    const support = claimSupported(c.text, `${ev.claim} ${ev.snippet} ${ev.sourceTitle ?? ""}`, known);
    if (!support.ok) issues.push(err("claim_unsupported", `“${c.text}” is not backed by its cited source: ${support.reason}.`));
  }

  // 3. Any sentence that asserts something must be one of those claims (or describe the sender's own offer).
  const positioning = contentWords(ctx.sender.positioning);
  const positioningSet = new Set(positioning);
  const claimTexts = activeClaims.map((c) => c.text);
  const sentences = sentencesOf(all);
  const lastLineIsSignoff = (s: string, i: number) => i >= sentences.length - 2 && s.split(/\s+/).length <= 4;
  sentences.forEach((s, i) => {
    if (GREETING.test(s) || lastLineIsSignoff(s, i)) return;
    if (!hasClaimVocab(s, ctx)) return;
    if (claimTexts.some((c) => containsNorm(s, c) || containsNorm(c, s))) return;
    const cw = contentWords(s);
    // Describing what the SENDER offers is not a claim about the recipient.
    if (cw.length > 0 && cw.filter((w) => positioningSet.has(w)).length / cw.length >= 0.6) return;
    const covering = activeClaims.some((c) => {
      const claimWords = contentWords(c.text);
      const sw = new Set(cw);
      return claimWords.length > 0 && claimWords.filter((w) => sw.has(w)).length / claimWords.length >= 0.75;
    });
    if (covering) return;
    issues.push(err("unsupported_claim", `“${s.length > 140 ? `${s.slice(0, 140)}…` : s}” asserts something about the recipient or company that is not tied to verified evidence.`));
  });

  // 4. Every other declarative sentence must be made of words the context actually contains: what the evidence
  //    says, what the sender said about their own offer, or plain conversational filler. The remainder of a
  //    claim sentence is checked too, so an inference can't ride along behind a valid claim.
  const knownStems = new Set(contentWords(knownText(ctx)));
  const claimNorms = activeClaims.map((c) => normText(c.text));
  const bodySentences = sentencesOf(body);
  bodySentences.forEach((s, i) => {
    if (GREETING.test(s) || (i >= bodySentences.length - 2 && s.split(/\s+/).length <= 4)) return;
    let checked = s;
    if (/\?\s*$/.test(s)) {
      // Plain questions assert nothing. But “As you continue to enhance X, would …?” asserts its lead-in clause.
      const lead = /^(?:as|since|given|with|now that|because|while|after|following|considering)\b[^,?]*,/i.exec(s);
      if (!lead) return;
      checked = lead[0];
    }
    let rest = normText(checked);
    for (const c of claimNorms) rest = rest.split(c).join(" ");
    const unknown = [
      ...new Set(
        rest.split(" ").filter((w) => w.length > 2 && !STOP.has(w) && !GENERIC.has(stem(w)) && !knownStems.has(stem(w))),
      ),
    ];
    if (unknown.length >= 2) {
      issues.push(err("unsupported_statement", `“${s.length > 140 ? `${s.slice(0, 140)}…` : s}” says things the evidence does not (${unknown.slice(0, 4).join(", ")}).`));
    }
  });

  // De-duplicate identical messages while keeping order.
  const seen = new Set<string>();
  return issues.filter((i) => (seen.has(`${i.code}|${i.message}`) ? false : (seen.add(`${i.code}|${i.message}`), true)));
}

export const hasErrors = (issues: ValidationIssue[]) => issues.some((i) => i.severity === "error");

/** Validates a model output straight from generation. */
export function validateGeneration(out: GenerationOutput, ctx: PersonalizationContext): ValidationIssue[] {
  return validateDraft({ subject: out.subject, body: out.body, claims: out.personalized_claims, usedEvidenceIds: out.used_evidence_ids }, ctx);
}

/** Edited drafts: a person owns their words, so problems become warnings (and are logged), never blocks. */
export function validateEdit(input: ValidateInput, ctx: PersonalizationContext): ValidationIssue[] {
  return validateDraft(input, ctx, { edited: true }).map((i) => ({ ...i, severity: "warning" as const }));
}

export function toDraftClaims(claims: { text: string; evidence_id: number }[]): DraftClaim[] {
  return claims.map((c) => ({ text: c.text, evidenceId: c.evidence_id }));
}
