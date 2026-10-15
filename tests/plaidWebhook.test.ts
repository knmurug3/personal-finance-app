import { describe, it, expect, vi, beforeAll } from "vitest";
import * as crypto from "crypto";

const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = publicKey.export({ format: "jwk" });

vi.mock("@/lib/plaid", () => ({
  plaidClient: {
    webhookVerificationKeyGet: vi.fn(async () => ({ data: { key: { ...jwk, expired_at: null } } })),
  },
}));
import { verifyPlaidWebhook } from "../lib/plaidWebhook";

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

function sign(body: string, opts: { iat?: number; alg?: string } = {}) {
  const header = b64url(JSON.stringify({ alg: opts.alg || "ES256", kid: "k1", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iat: opts.iat ?? Math.floor(Date.now() / 1000),
      request_body_sha256: crypto.createHash("sha256").update(body).digest("hex"),
    })
  );
  const sig = crypto.sign("sha256", Buffer.from(`${header}.${payload}`), { key: privateKey, dsaEncoding: "ieee-p1363" });
  return `${header}.${payload}.${b64url(sig)}`;
}

describe("verifyPlaidWebhook", () => {
  const body = JSON.stringify({ webhook_type: "TRANSACTIONS", webhook_code: "SYNC_UPDATES_AVAILABLE", item_id: "i1" });

  it("accepts a correctly signed, fresh webhook", async () => {
    expect(await verifyPlaidWebhook(body, sign(body))).toBe(true);
  });
  it("rejects a tampered body", async () => {
    expect(await verifyPlaidWebhook(body.replace("i1", "i2"), sign(body))).toBe(false);
  });
  it("rejects stale tokens", async () => {
    expect(await verifyPlaidWebhook(body, sign(body, { iat: Math.floor(Date.now() / 1000) - 600 }))).toBe(false);
  });
  it("rejects missing headers and other algorithms", async () => {
    expect(await verifyPlaidWebhook(body, null)).toBe(false);
    expect(await verifyPlaidWebhook(body, sign(body, { alg: "HS256" }))).toBe(false);
  });
});
