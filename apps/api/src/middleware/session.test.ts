import type { Request } from "express";
import {
  readCookie,
  serializeSessionCookie,
  signDemoSession,
  verifyDemoSession,
} from "./session";

describe("signed demo sessions", () => {
  const signingKey = "fixture-key-for-tests";
  const issuedAt = new Date("2026-09-03T00:00:00.000Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(issuedAt);
  });

  afterEach(() => vi.useRealTimers());

  it("round-trips a signed session and rejects malformed, expired, future, and tampered values", () => {
    const signed = signDemoSession("demo-user", signingKey, issuedAt);
    expect(verifyDemoSession(signed, signingKey)).toBe("demo-user");
    expect(verifyDemoSession(undefined, signingKey)).toBeNull();
    expect(verifyDemoSession("malformed", signingKey)).toBeNull();
    expect(verifyDemoSession("user.not-a-time.signature", signingKey)).toBeNull();
    expect(verifyDemoSession(`${"user"}.${Number.MAX_SAFE_INTEGER + 1}.signature`, signingKey)).toBeNull();
    expect(verifyDemoSession(signDemoSession("old-user", signingKey, issuedAt - 2_000), signingKey, 1_000)).toBeNull();
    expect(verifyDemoSession(signDemoSession("future-user", signingKey, issuedAt + 60_001), signingKey)).toBeNull();
    expect(verifyDemoSession(`${signed.slice(0, -1)}x`, signingKey)).toBeNull();
  });

  it("reads cookies safely and serializes secure and local variants", () => {
    const empty = { headers: {} } as Request;
    expect(readCookie(empty, "foodiesfeed_demo")).toBeUndefined();
    expect(readCookie({ headers: { cookie: "ignored; foodiesfeed_demo=hello%20world" } } as Request, "foodiesfeed_demo"))
      .toBe("hello world");
    expect(readCookie({ headers: { cookie: "missing; foodiesfeed_demo=%E0%A4%A" } } as Request, "foodiesfeed_demo"))
      .toBeUndefined();
    expect(readCookie({ headers: { cookie: "without-equals" } } as Request, "foodiesfeed_demo")).toBeUndefined();
    expect(serializeSessionCookie("foodiesfeed_demo", "demo.user", false)).toContain("SameSite=Lax");
    expect(serializeSessionCookie("foodiesfeed_demo", "demo.user", true)).toContain("Secure");
  });
});
