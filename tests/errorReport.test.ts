import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/push", () => ({ sendPushToAll: vi.fn() }));
import { errorFingerprint, errorText } from "../lib/errorReport";

describe("errorFingerprint", () => {
  it("groups the same problem with different ids and numbers", () => {
    const a = errorFingerprint("Bank sync", "Brokerage A: request 4f9a1c2e-7b3d-4e5f-9a8b-112233445566 failed after 3 tries");
    const b = errorFingerprint("Bank sync", "Brokerage A: request 9e8d7c6b-5a4f-4321-8765-aabbccddeeff failed after 5 tries");
    expect(a).toBe(b);
    expect(errorFingerprint("Ask", "boom")).not.toBe(errorFingerprint("Bank sync", "boom"));
  });
});

describe("errorText", () => {
  it("prefers Plaid error codes and strips URLs and stacks", () => {
    expect(errorText({ response: { data: { error_code: "ITEM_LOGIN_REQUIRED" } } })).toBe("Plaid ITEM_LOGIN_REQUIRED");
    expect(errorText(new Error("fetch https://api.example.com/x?token=abc failed\n    at foo"))).toBe("fetch <url> failed");
  });
});
