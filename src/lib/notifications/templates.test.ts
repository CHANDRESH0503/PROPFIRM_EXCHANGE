import { describe, expect, it } from "vitest";
import { waitlistConfirmEmail } from "./templates";

describe("waitlistConfirmEmail", () => {
  it("includes the link in both parts and escapes it in HTML", () => {
    const url = 'https://fundback.example/waitlist/open?token=abc&x="<b>';
    const mail = waitlistConfirmEmail(url);
    expect(mail.subject).toContain("Fundback");
    expect(mail.text).toContain(url);
    expect(mail.html).not.toContain('"<b>');
    expect(mail.html).toContain("&quot;&lt;b&gt;");
    expect(mail.html).not.toMatch(/guaranteed|risk-free/i);
  });
});
