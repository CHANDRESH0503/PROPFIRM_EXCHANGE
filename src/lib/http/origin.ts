import { isIP } from "node:net";

/**
 * The origin to send auth redirects back to. Normally the configured site URL. In local
 * development only, a request from localhost or a private-network address (a phone on the same
 * Wi-Fi) gets its own origin back, so the PKCE cookie and the callback share an origin.
 * Any other Host header is ignored: trusting it would let a forged Host steer sign-in links.
 */
export function authOrigin(siteUrl: string, appEnv: string, host: string | null, proto: string | null): string {
  const site = new URL(siteUrl).origin;
  if (appEnv !== "local" || !host) return site;
  const scheme = proto === "https" ? "https" : "http";
  let candidate: URL;
  try {
    candidate = new URL(`${scheme}://${host}`);
  } catch {
    return site;
  }
  if (candidate.origin === site) return site;
  return isLocalHost(candidate.hostname) ? candidate.origin : site;
}

function isLocalHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") return true;
  if (isIP(hostname) !== 4) return false;
  const [a, b] = hostname.split(".").map(Number) as [number, number];
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}
