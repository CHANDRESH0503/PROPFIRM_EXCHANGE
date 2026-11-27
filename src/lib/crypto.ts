import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";

/** 32 random bytes, base64url. Used for emailed access tokens. */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Keyed hash of an IP address. The month is part of the key, so hashes rotate monthly and
 * cannot be joined across long periods (11-fraud-security.md: "hash IPs with a rotating salt").
 */
export function hashIp(ip: string, salt: string, now: Date = new Date()): string {
  const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return createHmac("sha256", `${salt}:${period}`).update(ip).digest("hex");
}

/** Rebuild a queued confirmation link without keeping its bearer secret in Postgres. */
export function waitlistToken(nonce: string, secret: string): string {
  return createHmac("sha256", secret)
    .update("waitlist-confirm/v1:" + nonce)
    .digest("base64url");
}
