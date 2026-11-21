import { afterEach, describe, expect, it, vi } from "vitest";
import { log } from "./log";

afterEach(() => vi.restoreAllMocks());

describe("log", () => {
  it("redacts personal fields and keeps the event name", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log("info", "waitlist.joined", { email: "a@b.co", ip: "1.2.3.4", ipHash: "x", token: "t", code: "P0001", signupId: "s1", description: "ok" });
    const line = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(line).toMatchObject({ event: "waitlist.joined", email: "[redacted]", ip: "[redacted]", ipHash: "[redacted]", token: "[redacted]" });
    expect(line).toMatchObject({ code: "P0001", signupId: "s1", description: "ok" });
  });

  it("writes warnings and errors to stderr", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    log("error", "x.failed");
    expect(spy).toHaveBeenCalledOnce();
  });
});
