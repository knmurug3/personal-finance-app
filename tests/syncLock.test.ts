import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory stand-in for the AppMeta table (only what syncLock uses)
const rows = new Map<string, { value: string; updatedAt: Date }>();
const matches = (key: string, where: any) => {
  const row = rows.get(key);
  if (!row || where.key !== key) return false;
  if (where.value !== undefined && row.value !== where.value) return false;
  if (where.updatedAt?.lt && !(row.updatedAt < where.updatedAt.lt)) return false;
  return true;
};
vi.mock("@/lib/db", () => ({
  db: {
    appMeta: {
      create: async ({ data }: any) => {
        if (rows.has(data.key)) throw new Error("unique");
        rows.set(data.key, { value: data.value, updatedAt: new Date() });
      },
      updateMany: async ({ where, data }: any) => {
        if (!matches(where.key, where)) return { count: 0 };
        rows.set(where.key, { value: data.value, updatedAt: new Date() });
        return { count: 1 };
      },
      deleteMany: async ({ where }: any) => {
        if (!matches(where.key, where)) return { count: 0 };
        rows.delete(where.key);
        return { count: 1 };
      },
      upsert: async ({ where, create }: any) => {
        rows.set(where.key, { value: create.value, updatedAt: new Date() });
      },
    },
  },
}));

import { withItemSyncLock } from "../lib/syncLock";

describe("withItemSyncLock", () => {
  beforeEach(() => rows.clear());

  it("runs once and releases the lock", async () => {
    const run = vi.fn(async () => {});
    expect(await withItemSyncLock("i1", run)).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
    expect(rows.size).toBe(0);
  });

  it("a concurrent caller skips and the holder runs another pass for it", async () => {
    let second: Promise<boolean> | undefined;
    const run = vi.fn(async () => {
      if (!second) second = withItemSyncLock("i1", async () => {});
      await second;
    });
    expect(await withItemSyncLock("i1", run)).toBe(true);
    expect(await second).toBe(false);
    expect(run).toHaveBeenCalledTimes(2);
    expect(rows.size).toBe(0);
  });

  it("takes over a lease whose holder died", async () => {
    rows.set("syncLock:i1", { value: "dead", updatedAt: new Date(Date.now() - 10 * 60 * 1000) });
    const run = vi.fn(async () => {});
    expect(await withItemSyncLock("i1", run)).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("leaves a live lease alone", async () => {
    rows.set("syncLock:i1", { value: "live", updatedAt: new Date() });
    const run = vi.fn(async () => {});
    expect(await withItemSyncLock("i1", run)).toBe(false);
    expect(run).not.toHaveBeenCalled();
    expect(rows.has("syncAgain:i1")).toBe(true);
  });

  it("releases the lock when a pass throws", async () => {
    await expect(withItemSyncLock("i1", async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(rows.has("syncLock:i1")).toBe(false);
  });
});
