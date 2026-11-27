/**
 * Analytics consent cookie, shared by the browser banner and the server. First-party, one
 * year, no personal data: just the visitor's choice.
 */
export const CONSENT_COOKIE = "analytics_consent";
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 365;

export type Consent = "granted" | "denied";

export function parseConsent(value: string | undefined | null): Consent | null {
  return value === "granted" || value === "denied" ? value : null;
}

/** The Set-Cookie string for a choice; Secure whenever the site runs on HTTPS. */
export function consentCookie(choice: Consent, secure: boolean) {
  return [
    `${CONSENT_COOKIE}=${choice}`,
    "Path=/",
    `Max-Age=${CONSENT_MAX_AGE}`,
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}
