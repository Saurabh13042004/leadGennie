/**
 * Static, versioned reference lists for email classification. Bump
 * EMAIL_LISTS_VERSION whenever an entry is added or removed so a stored
 * `email_status` can be traced to the rules that produced it.
 *
 * Dependency-free (imported directly by a Node script).
 */
export const EMAIL_LISTS_VERSION = "2026-09-24";

/** Personal mailbox providers: fine to email, but the domain says nothing about the employer. */
export const FREE_MAIL_DOMAINS: ReadonlySet<string> = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "yahoo.co.in", "yahoo.fr", "ymail.com", "rocketmail.com",
  "outlook.com", "hotmail.com", "hotmail.co.uk", "live.com", "msn.com", "icloud.com", "me.com", "mac.com",
  "aol.com", "proton.me", "protonmail.com", "pm.me", "gmx.com", "gmx.net", "gmx.de", "mail.com", "zoho.com",
  "yandex.com", "yandex.ru", "mail.ru", "qq.com", "163.com", "126.com", "sina.com", "naver.com", "daum.net",
  "rediffmail.com", "web.de", "t-online.de", "orange.fr", "free.fr", "laposte.net", "libero.it", "comcast.net",
  "verizon.net", "att.net", "sbcglobal.net", "bellsouth.net", "cox.net", "fastmail.com", "hey.com", "tutanota.com",
]);

/** Throwaway-inbox providers. Deliverable in the moment, worthless as a lead. */
export const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "guerrillamailblock.com", "sharklasers.com",
  "grr.la", "spam4.me", "10minutemail.com", "10minutemail.net", "20minutemail.com", "tempmail.com", "temp-mail.org",
  "temp-mail.io", "tempmail.net", "tempmailo.com", "tempinbox.com", "throwawaymail.com", "trashmail.com", "trashmail.net",
  "trashmail.de", "yopmail.com", "yopmail.net", "yopmail.fr", "getnada.com", "nada.email", "maildrop.cc", "mailnesia.com",
  "mailcatch.com", "mintemail.com", "mytemp.email", "mohmal.com", "dispostable.com", "fakeinbox.com", "fakemailgenerator.com",
  "emailondeck.com", "getairmail.com", "harakirimail.com", "incognitomail.com", "instantemailaddress.com", "jetable.org",
  "meltmail.com", "mailforspam.com", "mailnull.com", "mailtemp.info", "moakt.com", "spambog.com", "spamgourmet.com",
  "spamex.com", "spamfree24.org", "tmail.ws", "tmpmail.org", "tmpmail.net", "tempr.email", "discard.email", "dropmail.me",
  "emailfake.com", "burnermail.io", "inboxkitten.com", "mail.tm", "mailpoof.com", "33mail.com", "anonaddy.me", "cs.email",
  "byom.de", "einrot.com", "fleckens.hu", "gustr.com", "jourrapide.com", "rhyta.com", "superrito.com", "teleworm.us",
  "armyspy.com", "cuvox.de", "dayrep.com", "fakemail.net", "mailbox92.biz", "one-time.email", "owlymail.com", "trbvm.com",
  "vomoto.com", "wegwerfmail.de", "wegwerfmail.net", "zetmail.com",
]);

/** Local parts that address a function or a mailbox nobody reads, not a person. */
export const ROLE_LOCAL_PARTS: ReadonlySet<string> = new Set([
  "info", "admin", "administrator", "support", "help", "helpdesk", "sales", "contact", "contactus", "hello", "hi", "team",
  "office", "mail", "email", "enquiries", "enquiry", "inquiries", "inquiry", "marketing", "billing", "accounts", "accounting",
  "finance", "hr", "jobs", "careers", "recruiting", "recruitment", "press", "media", "pr", "news", "newsletter", "webmaster",
  "postmaster", "hostmaster", "abuse", "security", "legal", "privacy", "compliance", "orders", "service", "services",
  "feedback", "general", "reception", "operations", "ops", "noc", "root", "mailer-daemon",
  "noreply", "no-reply", "donotreply", "do-not-reply", "notifications", "notification", "alerts", "bounce", "bounces", "unsubscribe",
]);
