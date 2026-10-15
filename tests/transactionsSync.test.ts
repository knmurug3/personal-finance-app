import { describe, it, expect, vi, beforeEach } from "vitest";
import { plaidClient, fetchTransactionChanges } from "../lib/plaid";

const page = (over: Partial<Record<string, any>>) => ({
  data: { added: [], modified: [], removed: [], next_cursor: "c", has_more: false, ...over },
});
const tx = (id: string) => ({ transaction_id: id } as any);

describe("fetchTransactionChanges", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("follows has_more pages and returns the final cursor", async () => {
    const spy = vi
      .spyOn(plaidClient, "transactionsSync")
      .mockResolvedValueOnce(page({ added: [tx("a")], next_cursor: "c1", has_more: true }) as any)
      .mockResolvedValueOnce(page({ modified: [tx("b")], removed: [{ transaction_id: "r" }], next_cursor: "c2" }) as any);

    const res = await fetchTransactionChanges("tok", "c0");
    expect(res.added.map((t) => t.transaction_id)).toEqual(["a"]);
    expect(res.modified.map((t) => t.transaction_id)).toEqual(["b"]);
    expect(res.removed).toEqual(["r"]);
    expect(res.nextCursor).toBe("c2");
    expect(spy.mock.calls.map((c) => c[0].cursor)).toEqual(["c0", "c1"]);
  });

  it("restarts from the original cursor when data mutates mid-pagination", async () => {
    const mutation = Object.assign(new Error("mutated"), {
      response: { data: { error_code: "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION" } },
    });
    const spy = vi
      .spyOn(plaidClient, "transactionsSync")
      .mockResolvedValueOnce(page({ added: [tx("stale")], next_cursor: "c1", has_more: true }) as any)
      .mockRejectedValueOnce(mutation)
      .mockResolvedValueOnce(page({ added: [tx("fresh")], next_cursor: "c9" }) as any);

    const res = await fetchTransactionChanges("tok", null);
    expect(res.added.map((t) => t.transaction_id)).toEqual(["fresh"]);
    expect(res.nextCursor).toBe("c9");
    expect(spy.mock.calls.map((c) => c[0].cursor)).toEqual([undefined, "c1", undefined]);
  });

  it("surfaces other Plaid errors", async () => {
    vi.spyOn(plaidClient, "transactionsSync").mockRejectedValueOnce(
      Object.assign(new Error("login"), { response: { data: { error_code: "ITEM_LOGIN_REQUIRED" } } })
    );
    await expect(fetchTransactionChanges("tok", null)).rejects.toThrow("login");
  });
});
