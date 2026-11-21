# 11. Fraud and security

Part of the project brief. The rules in `/CLAUDE.md` §2 override anything here.


- Turnstile on sign-up, claim and waitlist forms. Rate limits on every mutating endpoint.
- One account per person. Signals for linked accounts: device hash, IP hash, checkout email reuse, receipt reuse, order reference reuse. Signals raise `risk_score`; they do not auto-ban.
- An order reference can be claimed once. Receipt files are hashed to catch re-uploads.
- Claim velocity limits and the monthly earn cap route to manual review.
- Buy → earn → refund abuse: reversals follow commission clawbacks, and repeat cases freeze redemption.
- Check-in, mission and spin endpoints validate on the server; the client is never trusted for time or state.
- Store the minimum personal data. Hash IPs with a rotating salt. Set a retention period for receipts and proofs.
- Secrets only in server environment variables. Provide `.env.example`.

