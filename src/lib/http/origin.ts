import { isIP } from "node:net";

/**
 * The origin to send auth redirects back to. Normally the configured site URL. In local
 * development only, a request from localhost or a private-network address (a phone on the same
 * Wi-Fi) gets its own origin back, so the PKCE cookie and the callback share an origin.
 * Any other Host header is ignored: trusting it would let a forged Host steer sign-in links.
 */
export function authOrigin(
  siteUrl: string,
  appEnv: string,
  host: string | null,
  proto: string | null,
): string {
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

/**
 * CSRF guard for cookie-authenticated POST routes: browsers send Origin on every POST, so a
 * request whose Origin is another site is refused.
 */
export function isSameOrigin(request: Request, siteUrl = process.env.NEXT_PUBLIC_SITE_URL) {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  // Behind the reverse proxy the request URL can be the internal address; the public site
  // origin is accepted as well.
  return (
    origin === new URL(request.url).origin ||
    (Boolean(siteUrl) && origin === new URL(siteUrl!).origin)
  );
}
