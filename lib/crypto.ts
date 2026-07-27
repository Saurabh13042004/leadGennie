import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

function getKey(): Buffer {
  const secret = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!secret) throw new Error("CREDENTIALS_ENCRYPTION_KEY is not set");
  const key = Buffer.from(secret, "base64");
  if (key.length !== 32) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }
  return key;
}

/**
 * INT-01: encrypts connector credentials (OAuth tokens, API keys) before they
 * ever reach a business-table column. This is application-level AES-256-GCM
 * with the key in an env var — real encryption at rest, but not the cloud
 * KMS/regional-vault the PRD describes; rotating to a managed secrets service
 * later only requires changing getKey(), not every call site.
 */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptSecret(stored: string): string {
  const [version, ivB64, authTagB64, ciphertextB64] = stored.split(":");
  if (version !== VERSION || !ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed or unsupported encrypted secret");
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]);
  return plaintext.toString("utf8");
}
