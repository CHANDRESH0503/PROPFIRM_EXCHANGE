import "server-only";
import { connection } from "next/server";
import { headers } from "next/headers";
import { isIP } from "node:net";

/**
 * Request metadata, read in one place.
 *
 * Client IP: in production the origin accepts traffic only from Cloudflare and Caddy forwards
 * exactly one `CF-Connecting-IP`, so that header is trusted. Anywhere else (local, staging
 * without Cloudflare) we fall back to the first `X-Forwarded-For` hop, which is spoofable and
 * therefore used only for rate limiting and coarse fraud signals, never for decisions alone.
 */
export interface RequestMeta {
  requestId: string;
  ip: string | null;
  /** ISO country from Cloudflare (`CF-IPCountry`), when present. */
  ipCountry: string | null;
  userAgent: string | null;
}

export function parseRequestMeta(h: Headers): RequestMeta {
  const cf = h.get("cf-connecting-ip")?.trim();
  const xff = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = cf || xff || h.get("x-real-ip")?.trim() || null;
  const country = h.get("cf-ipcountry")?.trim().toUpperCase() ?? null;
  return {
    requestId: h.get("x-request-id") ?? crypto.randomUUID(),
    ip: candidate && isIP(candidate) ? candidate : null,
    // Cloudflare uses XX for unknown and T1 for Tor.
    ipCountry:
      country && /^[A-Z]{2}$/.test(country) && country !== "XX" && country !== "T1"
        ? country
        : null,
    userAgent: h.get("user-agent"),
  };
}

export async function requestMeta(): Promise<RequestMeta> {
  await connection();
  return parseRequestMeta(await headers());
}
