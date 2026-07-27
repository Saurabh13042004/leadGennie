import { getResendClient } from "@/lib/email/resend";

export type DomainRecord = {
  record: string;
  name: string;
  value: string;
  type: string;
  ttl: string;
  status: string;
};

export type ResendDomain = {
  id: string;
  status: string;
  region: string;
  records: DomainRecord[];
};

/** Registers a sending domain with Resend and returns the exact DNS records to add. */
export async function createResendDomain(name: string): Promise<ResendDomain> {
  const result = await getResendClient().domains.create({ name });
  if (result.error) throw new Error(result.error.message);
  const data = result.data!;
  return {
    id: data.id,
    status: data.status,
    region: data.region,
    records: data.records as unknown as DomainRecord[],
  };
}

/** Re-fetches current verification status/records for a domain already registered with Resend. */
export async function getResendDomain(resendDomainId: string): Promise<ResendDomain> {
  const result = await getResendClient().domains.get(resendDomainId);
  if (result.error) throw new Error(result.error.message);
  const data = result.data!;
  return {
    id: data.id,
    status: data.status,
    region: data.region,
    records: data.records as unknown as DomainRecord[],
  };
}

/**
 * Looks up a domain already registered under this Resend account by exact
 * name — used to adopt a domain that exists on Resend (e.g. set up directly
 * in the Resend dashboard, or from a prior `create` call that succeeded on
 * Resend's side but never made it into our own `domains` table) instead of
 * failing when `create` rejects it as a duplicate.
 */
export async function findResendDomainByName(name: string): Promise<ResendDomain | null> {
  const result = await getResendClient().domains.list();
  if (result.error) throw new Error(result.error.message);
  const match = result.data?.data.find((d) => d.name === name);
  if (!match) return null;
  return getResendDomain(match.id);
}

/** Asks Resend to re-check DNS immediately rather than waiting for their next scheduled check. */
export async function verifyResendDomain(resendDomainId: string): Promise<void> {
  const result = await getResendClient().domains.verify(resendDomainId);
  if (result.error) throw new Error(result.error.message);
}

export async function removeResendDomain(resendDomainId: string): Promise<void> {
  const result = await getResendClient().domains.remove(resendDomainId);
  if (result.error) throw new Error(result.error.message);
}
