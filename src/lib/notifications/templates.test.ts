import { describe, expect, it } from "vitest";
import { calendarDigestEmail, waitlistConfirmEmail } from "./templates";

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

describe("calendarDigestEmail", () => {
  const base = {
    date: "Monday 23 November",
    zone: "Europe/London",
    currencies: ["EUR", "USD"],
    calendarUrl: "https://example.test/economic-calendar",
    events: [
      {
        localTime: "13:30",
        currency: "USD",
        title: "Sample jobs report",
        forecast: "180K",
        previous: "150K",
      },
      {
        localTime: "15:00",
        currency: "EUR",
        title: "Sample rate decision",
        forecast: null,
        previous: null,
      },
    ],
  };

  it("lists events in order, labels sample data, and states it is a schedule", () => {
    const mail = calendarDigestEmail({ ...base, licensed: false });
    expect(mail.subject).toBe("2 high-impact events today · EUR, USD");
    expect(mail.text).toContain("13:30 · USD · Sample jobs report — Forecast 180K · previous 150K");
    expect(mail.text).toContain("15:00 · EUR · Sample rate decision");
    expect(mail.text.indexOf("13:30")).toBeLessThan(mail.text.indexOf("15:00"));
    expect(mail.text).toContain("fictional sample events");
    expect(mail.text).toContain("not trading advice");
    expect(mail.html).toContain("https://example.test/economic-calendar");
  });

  it("drops the sample notice for a licensed feed and uses the singular", () => {
    const mail = calendarDigestEmail({ ...base, licensed: true, events: base.events.slice(0, 1) });
    expect(mail.subject).toBe("1 high-impact event today · EUR, USD");
    expect(mail.text).not.toContain("fictional");
  });
});
