import { describe, it, expect, beforeEach, vi } from "vitest";

const update = vi.fn(async (_args: { where: { id: string }; data: { accessToken: string } }) => ({}));
vi.mock("@/lib/db", () => ({ db: { bankItem: { update: (args: any) => update(args) } } }));

import { encrypt, decrypt } from "../lib/encryption";
import { plaidAccessToken } from "../lib/plaidToken";

describe("encryption", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = "a".repeat(64);
  });

  it("round-trips a Plaid access token", () => {
    const token = "access-production-00000000-0000-0000-0000-000000000000";
    const enc = encrypt(token);
    expect(enc).not.toContain(token);
    expect(enc.split(":")).toHaveLength(3);
    expect(decrypt(enc)).toBe(token);
  });

  it("rejects tampered ciphertext and plaintext tokens", () => {
    const enc = encrypt("secret");
    const [iv, tag, data] = enc.split(":");
    const flipped = data.slice(0, -1) + (data.endsWith("0") ? "1" : "0");
    expect(() => decrypt(`${iv}:${tag}:${flipped}`)).toThrow();
    expect(() => decrypt("access-production-plaintext")).toThrow();
  });

  it("refuses to run without a proper ENCRYPTION_KEY (no SESSION_SECRET fallback)", () => {
    delete process.env.ENCRYPTION_KEY;
    process.env.SESSION_SECRET = "s".repeat(32);
    expect(() => encrypt("x")).toThrow(/ENCRYPTION_KEY/);
    process.env.ENCRYPTION_KEY = "too-short";
    expect(() => encrypt("x")).toThrow(/ENCRYPTION_KEY/);
  });
});

describe("plaidAccessToken", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = "b".repeat(64);
    update.mockClear();
  });

  it("encrypts a legacy plaintext token in place and still returns it", async () => {
    const token = "access-production-legacy";
    expect(await plaidAccessToken({ id: "item1", accessToken: token })).toBe(token);
    expect(update).toHaveBeenCalledTimes(1);
    const saved = update.mock.calls[0][0].data.accessToken;
    expect(saved).not.toContain(token);
    expect(decrypt(saved)).toBe(token);
  });

  it("decrypts an already-encrypted token without writing", async () => {
    const enc = encrypt("access-production-new");
    expect(await plaidAccessToken({ id: "item2", accessToken: enc })).toBe("access-production-new");
    expect(update).not.toHaveBeenCalled();
  });
});
