import { describe, it, expect, beforeEach } from "vitest";
import { signSession, verifySession, parseAuthSession, clientIp, SESSION_MAX_AGE_SECONDS } from "../lib/requireAuth";

beforeEach(() => {
  process.env.SESSION_SECRET = "test-secret-at-least-16-chars";
  process.env.AUTH_PASSWORD = "pw";
});

describe("sessions", () => {
  it("round-trips a valid session", () => {
    const v = `auth:owner:abc:${Date.now() + 60_000}`;
    expect(verifySession(signSession(v))).toBe(v);
  });
  it("rejects expired sessions", () => {
    expect(verifySession(signSession(`auth:owner:abc:${Date.now() - 1}`))).toBeNull();
  });
  it("rejects sessions with no expiry", () => {
    expect(verifySession(signSession("auth:owner:abc"))).toBeNull();
  });
  it("rejects tampering and password changes", () => {
    const signed = signSession(`auth:owner:abc:${Date.now() + 60_000}`);
    expect(verifySession(signed.replace("owner", "demo"))).toBeNull();
    process.env.AUTH_PASSWORD = "other";
    expect(verifySession(signed)).toBeNull();
  });
  it("throws without SESSION_SECRET", () => {
    delete process.env.SESSION_SECRET;
    expect(() => signSession("x")).toThrow();
  });
});

describe("parseAuthSession", () => {
  it("extracts user, session id and issue time", () => {
    const exp = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
    expect(parseAuthSession(`auth:owner:abc:${exp}`)).toEqual({ username: "owner", sid: "abc", issuedAt: exp - SESSION_MAX_AGE_SECONDS * 1000 });
  });
  it("rejects non-session signed values", () => {
    expect(parseAuthSession("wa:login:challenge:123")).toBeNull();
    expect(parseAuthSession(null)).toBeNull();
    expect(parseAuthSession("auth::abc:1")).toBeNull();
  });
});

describe("clientIp", () => {
  const req = (h: Record<string, string>) => new Request("https://x.test", { headers: h });
  it("prefers the platform header", () => {
    expect(clientIp(req({ "x-vercel-forwarded-for": "1.1.1.1", "x-forwarded-for": "9.9.9.9" }))).toBe("1.1.1.1");
  });
  it("uses the last X-Forwarded-For hop, not a client-supplied first one", () => {
    expect(clientIp(req({ "x-forwarded-for": "6.6.6.6, 2.2.2.2" }))).toBe("2.2.2.2");
  });
});
